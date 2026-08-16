-- Módulo Configurações (autoridade de autorização do VERUM). Prefixo cfg_.
-- Contrato HTTP equivalente (RPCs + RLS; identidade: Supabase Auth):
--   GET    /api/configuracoes/sessao
--   GET    /api/configuracoes/socios
--   POST   /api/configuracoes/socios
--   PATCH  /api/configuracoes/socios/:id
--   POST   /api/configuracoes/socios/:id/saida
--   POST   /api/configuracoes/socios/:id/reverter-saida
--   DELETE /api/configuracoes/socios/:id
--   GET    /api/configuracoes/usuarios
--   POST   /api/configuracoes/usuarios (convite)
--   GET    /api/configuracoes/auditoria
-- Sem UPDATE/DELETE em cfg_auditoria.

-- ---------------------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------------------
create table public.cfg_secrets (
  chave text primary key,
  valor text not null
);

insert into public.cfg_secrets (chave, valor) values
  ('encryption_key', encode(gen_random_bytes(32), 'hex')),
  ('app_url', 'http://localhost:5173')
on conflict (chave) do nothing;

create table public.cfg_papeis (
  id text primary key,
  nome text not null,
  descricao text not null default '',
  imutavel boolean not null default false,
  origem_id text references public.cfg_papeis (id),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table public.cfg_papel_permissoes (
  papel_id text not null references public.cfg_papeis (id) on delete cascade,
  recurso text not null,
  nivel text not null check (nivel in ('nenhum', 'ler', 'editar', 'total')),
  customizada boolean not null default false,
  primary key (papel_id, recurso)
);

create table public.cfg_usuarios (
  id uuid primary key,
  nome text not null,
  email text not null,
  papel_id text not null references public.cfg_papeis (id),
  situacao text not null check (situacao in ('ativo', 'convidado', 'suspenso', 'desativado')),
  dois_fatores_ativo boolean not null default false,
  dois_fatores_desde timestamptz,
  ultimo_acesso timestamptz,
  ja_logou boolean not null default false,
  convidado_por uuid,
  sessoes_revogadas_em timestamptz,
  ultima_reauth_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create unique index cfg_usuarios_email_vivos_uidx
  on public.cfg_usuarios (lower(email))
  where situacao in ('ativo', 'convidado', 'suspenso');

create table public.cfg_socios (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid references public.cfg_usuarios (id) on delete set null,
  nome_completo text not null,
  cpf_hash bytea not null,
  cpf_cipher bytea not null,
  email text not null,
  telefone_cipher bytea,
  participacao numeric(5,2) not null check (participacao >= 0.01 and participacao <= 100),
  aporte_comprometido bigint not null check (aporte_comprometido >= 0),
  aporte_integralizado bigint not null check (aporte_integralizado >= 0),
  data_entrada date not null,
  data_saida date,
  motivo_saida text,
  situacao text not null check (situacao in ('ativo', 'aporte_pendente', 'inativo')),
  observacao text,
  deletado_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint cfg_socios_aporte_chk check (aporte_integralizado <= aporte_comprometido)
);

create unique index cfg_socios_cpf_vivos_uidx
  on public.cfg_socios (cpf_hash) where deletado_em is null;
create unique index cfg_socios_email_vivos_uidx
  on public.cfg_socios (lower(email)) where deletado_em is null;

create table public.cfg_tokens (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.cfg_usuarios (id),
  tipo text not null check (tipo in ('convite', 'redefinicao')),
  token_hash bytea not null unique,
  expires_at timestamptz not null,
  usado_em timestamptz,
  criado_em timestamptz not null default now()
);

create table public.cfg_auditoria (
  id uuid primary key default gen_random_uuid(),
  autor_id uuid not null,
  autor_nome text not null,
  acao text not null,
  modulo text not null,
  entidade text not null,
  entidade_id text not null,
  descricao text not null,
  valor_anterior jsonb,
  valor_novo jsonb,
  ip text,
  criado_em timestamptz not null default now()
);

create index cfg_auditoria_criado_em_idx on public.cfg_auditoria (criado_em desc);

create table public.cfg_login_tentativas (
  id bigserial primary key,
  email text not null,
  ip text,
  ok boolean not null default false,
  criado_em timestamptz not null default now()
);

create index cfg_login_tentativas_email_idx on public.cfg_login_tentativas (lower(email), criado_em desc);
create index cfg_login_tentativas_ip_idx on public.cfg_login_tentativas (ip, criado_em desc);

create table public.cfg_emails_fila (
  id uuid primary key default gen_random_uuid(),
  tipo text not null,
  destinatario text not null,
  assunto text not null,
  corpo text not null,
  payload jsonb,
  enviado_em timestamptz,
  criado_em timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Imutabilidade da auditoria
-- ---------------------------------------------------------------------------
create or replace function public.cfg_auditoria_imovel()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Auditoria é irretocável';
end;
$$;

create trigger cfg_auditoria_no_update
  before update on public.cfg_auditoria
  for each row execute function public.cfg_auditoria_imovel();

create trigger cfg_auditoria_no_delete
  before delete on public.cfg_auditoria
  for each row execute function public.cfg_auditoria_imovel();

create or replace function public.cfg_touch_atualizado_em()
returns trigger
language plpgsql
as $$
begin
  new.atualizado_em := now();
  return new;
end;
$$;

create trigger cfg_papeis_touch before update on public.cfg_papeis
  for each row execute function public.cfg_touch_atualizado_em();
create trigger cfg_usuarios_touch before update on public.cfg_usuarios
  for each row execute function public.cfg_touch_atualizado_em();
create trigger cfg_socios_touch before update on public.cfg_socios
  for each row execute function public.cfg_touch_atualizado_em();

-- ---------------------------------------------------------------------------
-- Segredo / cripto / hash
-- ---------------------------------------------------------------------------
create or replace function public.cfg_segredo(p_chave text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select valor from public.cfg_secrets where chave = p_chave;
$$;

create or replace function public.cfg_chave_cripto()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select public.cfg_segredo('encryption_key');
$$;

create or replace function public.cfg_hash_cpf(p_cpf text)
returns bytea
language sql
immutable
set search_path = public, extensions
as $$
  select digest(convert_to(p_cpf, 'UTF8'), 'sha256');
$$;

create or replace function public.cfg_mask_cpf(p_cpf text)
returns text
language sql
immutable
as $$
  select left(p_cpf, 3) || '.***.***-' || right(p_cpf, 2);
$$;

create or replace function public.cfg_encrypt_text(p_valor text)
returns bytea
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
begin
  if p_valor is null or p_valor = '' then
    return null;
  end if;
  return pgp_sym_encrypt(p_valor, public.cfg_chave_cripto());
end;
$$;

create or replace function public.cfg_decrypt_text(p_cipher bytea)
returns text
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
begin
  if p_cipher is null then
    return null;
  end if;
  return pgp_sym_decrypt(p_cipher, public.cfg_chave_cripto());
end;
$$;

create or replace function public.cfg_hash_token(p_token text)
returns bytea
language sql
immutable
set search_path = public, extensions
as $$
  select digest(convert_to(p_token, 'UTF8'), 'sha256');
$$;

-- ---------------------------------------------------------------------------
-- Níveis e autorização
-- ---------------------------------------------------------------------------
create or replace function public.cfg_nivel_rank(p_nivel text)
returns integer
language sql
immutable
as $$
  select case p_nivel
    when 'nenhum' then 0
    when 'ler' then 1
    when 'editar' then 2
    when 'total' then 3
    else 0
  end;
$$;

create or replace function public.cfg_derivar_situacao_socio(
  p_saida date,
  p_comprometido bigint,
  p_integralizado bigint
)
returns text
language sql
immutable
as $$
  select case
    when p_saida is not null then 'inativo'
    when p_integralizado < p_comprometido then 'aporte_pendente'
    else 'ativo'
  end;
$$;

create or replace function public.cfg_usuario_sessao_valida(u public.cfg_usuarios)
returns boolean
language plpgsql
stable
as $$
declare
  iat bigint;
begin
  if u is null or u.situacao <> 'ativo' then
    return false;
  end if;
  if u.sessoes_revogadas_em is not null then
    iat := coalesce((auth.jwt() ->> 'iat')::bigint, 0);
    if iat < extract(epoch from u.sessoes_revogadas_em) then
      return false;
    end if;
  end if;
  return true;
end;
$$;

create or replace function public.cfg_2fa_bloqueia(u public.cfg_usuarios, p_recurso text)
returns boolean
language sql
stable
as $$
  select
    p_recurso like 'configuracoes.%'
    and u.papel_id = 'socio'
    and coalesce(u.dois_fatores_ativo, false) = false
    and u.dois_fatores_desde is not null
    and u.dois_fatores_desde + interval '7 days' < now();
$$;

create or replace function public.cfg_pode_acessar(p_recurso text, p_nivel text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  u public.cfg_usuarios;
  niv text;
begin
  if auth.uid() is null then
    return false;
  end if;
  select * into u from public.cfg_usuarios where id = auth.uid();
  if not public.cfg_usuario_sessao_valida(u) then
    return false;
  end if;
  if public.cfg_2fa_bloqueia(u, p_recurso) then
    return false;
  end if;
  select nivel into niv
    from public.cfg_papel_permissoes
    where papel_id = u.papel_id and recurso = p_recurso;
  return coalesce(public.cfg_nivel_rank(niv), 0) >= public.cfg_nivel_rank(p_nivel);
end;
$$;

create or replace function public.cfg_forbidden()
returns jsonb
language sql
immutable
as $$
  select jsonb_build_object('ok', false, 'code', 'forbidden', 'message', 'Acesso restrito.');
$$;

create or replace function public.cfg_precisa_reauth()
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  u public.cfg_usuarios;
begin
  select * into u from public.cfg_usuarios where id = auth.uid();
  if u is null then
    return true;
  end if;
  if u.ultima_reauth_em is null then
    return true;
  end if;
  return u.ultima_reauth_em < now() - interval '30 minutes';
end;
$$;

create or replace function public.cfg_marcar_reauth()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return public.cfg_forbidden();
  end if;
  update public.cfg_usuarios
     set ultima_reauth_em = now()
   where id = auth.uid();
  return jsonb_build_object('ok', true);
end;
$$;

-- ---------------------------------------------------------------------------
-- Auditoria + e-mails
-- ---------------------------------------------------------------------------
create or replace function public.cfg_auditar(
  p_acao text,
  p_modulo text,
  p_entidade text,
  p_entidade_id text,
  p_descricao text,
  p_anterior jsonb default null,
  p_novo jsonb default null,
  p_ip text default null,
  p_autor_id uuid default null,
  p_autor_nome text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  aid uuid;
  anome text;
begin
  aid := coalesce(p_autor_id, auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid);
  anome := p_autor_nome;
  if anome is null then
    select nome into anome from public.cfg_usuarios where id = aid;
  end if;
  insert into public.cfg_auditoria (
    autor_id, autor_nome, acao, modulo, entidade, entidade_id, descricao, valor_anterior, valor_novo, ip
  ) values (
    aid,
    coalesce(anome, 'Sistema'),
    p_acao,
    p_modulo,
    p_entidade,
    p_entidade_id,
    p_descricao,
    p_anterior,
    p_novo,
    p_ip
  );
end;
$$;

create or replace function public.cfg_enfileirar_email(
  p_tipo text,
  p_destinatario text,
  p_assunto text,
  p_corpo text,
  p_payload jsonb default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.cfg_emails_fila (tipo, destinatario, assunto, corpo, payload)
  values (p_tipo, p_destinatario, p_assunto, p_corpo, p_payload);
end;
$$;

create or replace function public.cfg_notificar_socios(p_assunto text, p_corpo text, p_payload jsonb default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  dest text;
begin
  for dest in
    select distinct s.email
      from public.cfg_socios s
     where s.deletado_em is null
       and s.data_saida is null
       and s.email is not null
       and s.email <> ''
  loop
    perform public.cfg_enfileirar_email('socios', dest, p_assunto, p_corpo, p_payload);
  end loop;
end;
$$;

create or replace function public.cfg_app_url()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.cfg_segredo('app_url'), 'http://localhost:5173');
$$;

-- ---------------------------------------------------------------------------
-- Seed idempotente de papéis
-- ---------------------------------------------------------------------------
create or replace function public.cfg_seed_papeis()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  rec record;
begin
  insert into public.cfg_papeis (id, nome, descricao, imutavel) values
    ('socio', 'Sócio', 'Acesso total, incluindo configurações e financeiro. Imutável.', true),
    ('financeiro', 'Financeiro', 'Lança e concilia; vê a DRE em leitura.', false),
    ('operacao', 'Operação', 'Calculadora, casos, parcerias e documentos. Sem acesso a dado financeiro.', false),
    ('parceiro_juridico', 'Parceiro jurídico', 'Acesso externo restrito aos casos em que é responsável.', false),
    ('leitura', 'Leitura', 'Consulta sem alteração, sem financeiro.', false)
  on conflict (id) do update set
    nome = excluded.nome,
    descricao = excluded.descricao,
    imutavel = excluded.imutavel;

  for rec in
    select * from (values
      ('socio', 'calculadora', 'total'),
      ('socio', 'casos', 'total'),
      ('socio', 'parcerias', 'total'),
      ('socio', 'documentos', 'total'),
      ('socio', 'financeiro.lancamentos', 'total'),
      ('socio', 'financeiro.dre', 'total'),
      ('socio', 'configuracoes.socios', 'total'),
      ('socio', 'configuracoes.usuarios', 'total'),
      ('socio', 'configuracoes.auditoria', 'ler'),
      ('financeiro', 'calculadora', 'ler'),
      ('financeiro', 'casos', 'ler'),
      ('financeiro', 'parcerias', 'ler'),
      ('financeiro', 'documentos', 'ler'),
      ('financeiro', 'financeiro.lancamentos', 'total'),
      ('financeiro', 'financeiro.dre', 'ler'),
      ('financeiro', 'configuracoes.socios', 'nenhum'),
      ('financeiro', 'configuracoes.usuarios', 'nenhum'),
      ('financeiro', 'configuracoes.auditoria', 'nenhum'),
      ('operacao', 'calculadora', 'total'),
      ('operacao', 'casos', 'editar'),
      ('operacao', 'parcerias', 'editar'),
      ('operacao', 'documentos', 'editar'),
      ('operacao', 'financeiro.lancamentos', 'nenhum'),
      ('operacao', 'financeiro.dre', 'nenhum'),
      ('operacao', 'configuracoes.socios', 'nenhum'),
      ('operacao', 'configuracoes.usuarios', 'nenhum'),
      ('operacao', 'configuracoes.auditoria', 'nenhum'),
      ('parceiro_juridico', 'calculadora', 'ler'),
      ('parceiro_juridico', 'casos', 'editar'),
      ('parceiro_juridico', 'parcerias', 'nenhum'),
      ('parceiro_juridico', 'documentos', 'editar'),
      ('parceiro_juridico', 'financeiro.lancamentos', 'nenhum'),
      ('parceiro_juridico', 'financeiro.dre', 'nenhum'),
      ('parceiro_juridico', 'configuracoes.socios', 'nenhum'),
      ('parceiro_juridico', 'configuracoes.usuarios', 'nenhum'),
      ('parceiro_juridico', 'configuracoes.auditoria', 'nenhum'),
      ('leitura', 'calculadora', 'ler'),
      ('leitura', 'casos', 'ler'),
      ('leitura', 'parcerias', 'ler'),
      ('leitura', 'documentos', 'ler'),
      ('leitura', 'financeiro.lancamentos', 'nenhum'),
      ('leitura', 'financeiro.dre', 'nenhum'),
      ('leitura', 'configuracoes.socios', 'nenhum'),
      ('leitura', 'configuracoes.usuarios', 'nenhum'),
      ('leitura', 'configuracoes.auditoria', 'nenhum')
    ) as t(papel_id, recurso, nivel)
  loop
    insert into public.cfg_papel_permissoes (papel_id, recurso, nivel, customizada)
    values (rec.papel_id, rec.recurso, rec.nivel, false)
    on conflict (papel_id, recurso) do update set
      nivel = case
        when public.cfg_papel_permissoes.papel_id = 'socio' then excluded.nivel
        when public.cfg_papel_permissoes.customizada then public.cfg_papel_permissoes.nivel
        else excluded.nivel
      end;
  end loop;
end;
$$;

select public.cfg_seed_papeis();

-- Recurso novo: papéis que ainda não o têm recebem o padrão seguro
create or replace function public.cfg_garantir_recurso(p_recurso text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  n text;
begin
  for r in select id from public.cfg_papeis loop
    n := case when r.id = 'socio' then 'total' else 'nenhum' end;
    if p_recurso = 'configuracoes.auditoria' and r.id = 'socio' then
      n := 'ler';
    end if;
    insert into public.cfg_papel_permissoes (papel_id, recurso, nivel, customizada)
    values (r.id, p_recurso, n, false)
    on conflict do nothing;
  end loop;
end;
$$;
