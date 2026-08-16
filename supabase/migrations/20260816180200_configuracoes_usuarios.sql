-- Usuários, papéis, auditoria, RLS e pontes com o restante do VERUM.

-- GET /api/configuracoes/usuarios
create or replace function public.cfg_listar_usuarios()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.cfg_pode_acessar('configuracoes.usuarios', 'ler') then
    return public.cfg_forbidden();
  end if;
  return jsonb_build_object(
    'ok', true,
    'usuarios', coalesce((
      select jsonb_agg(public.cfg_json_usuario(u) order by u.nome)
        from public.cfg_usuarios u
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.cfg_listar_papeis()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not (
    public.cfg_pode_acessar('configuracoes.usuarios', 'ler')
    or public.cfg_pode_acessar('configuracoes.socios', 'ler')
  ) then
    return public.cfg_forbidden();
  end if;
  return jsonb_build_object(
    'ok', true,
    'papeis', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id,
        'nome', p.nome,
        'descricao', p.descricao,
        'imutavel', p.imutavel,
        'permissoes', public.cfg_mapa_permissoes(p.id),
        'usuariosVinculados', (select count(*) from public.cfg_usuarios u where u.papel_id = p.id and u.situacao <> 'desativado')
      ) order by p.imutavel desc, p.nome)
      from public.cfg_papeis p
    ), '[]'::jsonb)
  );
end;
$$;

-- POST /api/configuracoes/usuarios
create or replace function public.cfg_convidar_usuario(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  email text;
  nome text;
  papel text;
  existente public.cfg_usuarios;
  uid uuid;
begin
  if not public.cfg_pode_acessar('configuracoes.usuarios', 'total') then
    return public.cfg_forbidden();
  end if;
  nome := trim(coalesce(payload->>'nome', ''));
  email := lower(trim(coalesce(payload->>'email', '')));
  papel := coalesce(payload->>'papelId', '');
  if char_length(nome) < 3 then
    return jsonb_build_object('ok', false, 'errors', jsonb_build_object('nome', 'Informe o nome.'));
  end if;
  if position('@' in email) = 0 then
    return jsonb_build_object('ok', false, 'errors', jsonb_build_object('email', 'E-mail inválido.'));
  end if;
  if not exists (select 1 from public.cfg_papeis where id = papel) then
    return jsonb_build_object('ok', false, 'errors', jsonb_build_object('papelId', 'Papel inexistente.'));
  end if;
  select * into existente from public.cfg_usuarios where lower(cfg_usuarios.email) = email and situacao = 'desativado' limit 1;
  if existente is not null then
    return jsonb_build_object('ok', false, 'code', 'desativado', 'message', 'Este e-mail pertence a uma conta desativada. Ofereça um novo convite (novo registro).');
  end if;
  if exists (select 1 from public.cfg_usuarios where lower(cfg_usuarios.email) = email and situacao <> 'desativado') then
    return jsonb_build_object('ok', false, 'errors', jsonb_build_object('email', 'E-mail já cadastrado.'));
  end if;
  uid := public.cfg_convidar_interno(nome, email, papel, auth.uid());
  select * into existente from public.cfg_usuarios where id = uid;
  return jsonb_build_object('ok', true, 'usuario', public.cfg_json_usuario(existente));
end;
$$;

create or replace function public.cfg_reenviar_convite(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  u public.cfg_usuarios;
  raw text;
  link text;
  pnome text;
begin
  if not public.cfg_pode_acessar('configuracoes.usuarios', 'editar') then
    return public.cfg_forbidden();
  end if;
  select * into u from public.cfg_usuarios where id = p_id;
  if u is null or u.situacao <> 'convidado' then
    return jsonb_build_object('ok', false, 'message', 'Convite não encontrado.');
  end if;
  raw := public.cfg_emitir_token(u.id, 'convite');
  link := public.cfg_app_url() || '/convite/' || raw;
  select nome into pnome from public.cfg_papeis where id = u.papel_id;
  perform public.cfg_enfileirar_email(
    'convite', u.email, 'Novo convite para o VERUM',
    'O convite anterior foi invalidado. Use o novo link.',
    jsonb_build_object('token', raw, 'link', link, 'nome', u.nome, 'papel', coalesce(pnome, u.papel_id))
  );
  perform public.cfg_auditar('convidar', 'configuracoes', 'usuario', u.id::text, 'Reenviou o convite de ' || u.nome, null, null);
  raise notice 'CFG_INVITE_URL %', link;
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.cfg_alterar_papel_usuario(p_id uuid, p_papel text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  u public.cfg_usuarios;
  anterior text;
  ativos int;
begin
  if not public.cfg_pode_acessar('configuracoes.usuarios', 'total') then
    return public.cfg_forbidden();
  end if;
  if p_id = auth.uid() then
    return jsonb_build_object('ok', false, 'message', 'Ninguém altera o próprio papel.');
  end if;
  select * into u from public.cfg_usuarios where id = p_id;
  if u is null then
    return jsonb_build_object('ok', false, 'message', 'Usuário não encontrado.');
  end if;
  if not exists (select 1 from public.cfg_papeis where id = p_papel) then
    return jsonb_build_object('ok', false, 'message', 'Papel inexistente.');
  end if;
  if u.papel_id = 'socio' and p_papel <> 'socio' then
    select count(*) into ativos
      from public.cfg_usuarios
     where situacao = 'ativo' and papel_id = 'socio' and id <> p_id;
    if ativos < 1 then
      return jsonb_build_object('ok', false, 'message', 'O sistema não pode ficar sem usuário sócio ativo.');
    end if;
  end if;
  anterior := u.papel_id;
  update public.cfg_usuarios
     set papel_id = p_papel,
         dois_fatores_desde = case
           when p_papel = 'socio' and dois_fatores_desde is null then now()
           else dois_fatores_desde
         end
   where id = p_id
   returning * into u;
  perform public.cfg_auditar(
    'editar', 'configuracoes', 'usuario', u.id::text,
    'Alterou o papel de ' || u.nome || ' de ' || anterior || ' para ' || p_papel,
    jsonb_build_object('papelId', anterior),
    jsonb_build_object('papelId', p_papel)
  );
  perform public.cfg_notificar_socios(
    'Alteração de papel',
    'O papel de ' || u.nome || ' mudou de ' || anterior || ' para ' || p_papel,
    jsonb_build_object('usuarioId', u.id)
  );
  return jsonb_build_object('ok', true, 'usuario', public.cfg_json_usuario(u));
end;
$$;

create or replace function public.cfg_mudar_situacao_usuario(p_id uuid, p_situacao text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  u public.cfg_usuarios;
  anterior text;
  acao text;
  ativos int;
begin
  if not public.cfg_pode_acessar('configuracoes.usuarios', 'total') then
    return public.cfg_forbidden();
  end if;
  if p_id = auth.uid() then
    return jsonb_build_object('ok', false, 'message', 'Ninguém altera a própria conta desta forma.');
  end if;
  select * into u from public.cfg_usuarios where id = p_id;
  if u is null then
    return jsonb_build_object('ok', false, 'message', 'Usuário não encontrado.');
  end if;
  if p_situacao = 'suspenso' then
    acao := 'suspender';
  elsif p_situacao = 'ativo' and u.situacao = 'suspenso' then
    acao := 'reativar';
  elsif p_situacao = 'desativado' then
    acao := 'desativar';
  else
    return jsonb_build_object('ok', false, 'message', 'Transição inválida.');
  end if;
  if u.situacao = 'desativado' then
    return jsonb_build_object('ok', false, 'message', 'Conta desativada não se reativa. Envie um novo convite.');
  end if;
  if u.papel_id = 'socio' and u.situacao = 'ativo' and p_situacao <> 'ativo' then
    select count(*) into ativos
      from public.cfg_usuarios
     where situacao = 'ativo' and papel_id = 'socio' and id <> p_id;
    if ativos < 1 then
      return jsonb_build_object('ok', false, 'message', 'O sistema não pode ficar sem usuário sócio ativo.');
    end if;
  end if;
  anterior := u.situacao;
  update public.cfg_usuarios
     set situacao = p_situacao,
         sessoes_revogadas_em = case when p_situacao in ('suspenso', 'desativado') then now() else sessoes_revogadas_em end
   where id = p_id
   returning * into u;
  perform public.cfg_auditar(
    acao, 'configuracoes', 'usuario', u.id::text,
    initcap(acao) || ' ' || u.nome,
    jsonb_build_object('situacao', anterior),
    jsonb_build_object('situacao', p_situacao)
  );
  return jsonb_build_object('ok', true, 'usuario', public.cfg_json_usuario(u));
end;
$$;

create or replace function public.cfg_forcar_redefinicao(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  u public.cfg_usuarios;
  raw text;
  link text;
begin
  if not public.cfg_pode_acessar('configuracoes.usuarios', 'editar') then
    return public.cfg_forbidden();
  end if;
  select * into u from public.cfg_usuarios where id = p_id;
  if u is null or u.situacao <> 'ativo' then
    return jsonb_build_object('ok', false, 'message', 'Usuário não encontrado.');
  end if;
  raw := public.cfg_emitir_token(u.id, 'redefinicao');
  link := public.cfg_app_url() || '/redefinir-senha/' || raw;
  perform public.cfg_enfileirar_email(
    'redefinicao', u.email, 'Redefinição de senha no VERUM',
    'Use o link para definir uma nova senha. Vale por 1 hora.',
    jsonb_build_object('token', raw, 'link', link, 'nome', u.nome)
  );
  perform public.cfg_auditar('editar', 'configuracoes', 'usuario', u.id::text, 'Forçou a redefinição de senha de ' || u.nome, null, null);
  raise notice 'CFG_RESET_URL %', link;
  return jsonb_build_object('ok', true);
end;
$$;

-- Token peek (anon): nunca revela se o e-mail existe em outros fluxos
create or replace function public.cfg_peek_token(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  t public.cfg_tokens;
  u public.cfg_usuarios;
  pnome text;
begin
  select * into t from public.cfg_tokens where token_hash = public.cfg_hash_token(p_token);
  if t is null then
    return jsonb_build_object('ok', false, 'code', 'invalido');
  end if;
  if t.usado_em is not null then
    return jsonb_build_object('ok', false, 'code', 'usado');
  end if;
  if t.expires_at <= now() then
    return jsonb_build_object('ok', false, 'code', 'expirado');
  end if;
  select * into u from public.cfg_usuarios where id = t.usuario_id;
  select nome into pnome from public.cfg_papeis where id = u.papel_id;
  return jsonb_build_object(
    'ok', true,
    'tipo', t.tipo,
    'nome', u.nome,
    'email', u.email,
    'papel', coalesce(pnome, u.papel_id),
    'usuarioId', u.id
  );
end;
$$;

create or replace function public.cfg_consumir_token(p_token text, p_tipo text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  t public.cfg_tokens;
begin
  select * into t from public.cfg_tokens where token_hash = public.cfg_hash_token(p_token) for update;
  if t is null or t.tipo <> p_tipo or t.usado_em is not null or t.expires_at <= now() then
    return null;
  end if;
  update public.cfg_tokens set usado_em = now() where id = t.id;
  return t.usuario_id;
end;
$$;

create or replace function public.cfg_marcar_usuario_ativo(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.cfg_usuarios
     set situacao = 'ativo',
         ultima_reauth_em = now(),
         ja_logou = true,
         ultimo_acesso = now()
   where id = p_id;
end;
$$;

create or replace function public.cfg_solicitar_redefinicao(p_email text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  u public.cfg_usuarios;
  raw text;
  link text;
begin
  -- sempre a mesma resposta
  select * into u from public.cfg_usuarios where lower(email) = lower(trim(p_email)) and situacao = 'ativo';
  if u is not null then
    raw := public.cfg_emitir_token(u.id, 'redefinicao');
    link := public.cfg_app_url() || '/redefinir-senha/' || raw;
    perform public.cfg_enfileirar_email(
      'redefinicao', u.email, 'Redefinição de senha no VERUM',
      'Use o link para definir uma nova senha. Vale por 1 hora.',
      jsonb_build_object('token', raw, 'link', link, 'nome', u.nome)
    );
    raise notice 'CFG_RESET_URL %', link;
  end if;
  return jsonb_build_object('ok', true, 'message', 'Se o e-mail existir, enviaremos um link de redefinição.');
end;
$$;

create or replace function public.cfg_solicitar_novo_convite(p_email text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.cfg_notificar_socios(
    'Solicitação de novo convite',
    'Pediram um novo convite para ' || lower(trim(p_email)) || '. Não confirmamos se o e-mail existe.',
    jsonb_build_object('email', lower(trim(p_email)))
  );
  return jsonb_build_object('ok', true, 'message', 'Se o pedido for válido, um sócio enviará um novo convite.');
end;
$$;

create or replace function public.cfg_revogar_sessoes(p_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.cfg_usuarios set sessoes_revogadas_em = now() where id = p_id;
$$;

create or replace function public.cfg_logout()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', true);
  end if;
  update public.cfg_usuarios
     set sessoes_revogadas_em = now()
   where id = auth.uid();
  return jsonb_build_object('ok', true);
end;
$$;

-- Matriz
create or replace function public.cfg_alterar_permissao(p_papel text, p_recurso text, p_nivel text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  antigo text;
begin
  if not public.cfg_pode_acessar('configuracoes.usuarios', 'total') then
    return public.cfg_forbidden();
  end if;
  if public.cfg_precisa_reauth() then
    return jsonb_build_object('ok', false, 'code', 'reauth', 'message', 'Confirme sua senha para continuar.');
  end if;
  if p_papel = 'socio' then
    return jsonb_build_object('ok', false, 'message', 'A coluna Sócio é bloqueada.');
  end if;
  if p_recurso = 'configuracoes.auditoria' and p_nivel not in ('nenhum', 'ler') then
    return jsonb_build_object('ok', false, 'message', 'Auditoria não admite edição por nenhum papel.');
  end if;
  if p_nivel not in ('nenhum', 'ler', 'editar', 'total') then
    return jsonb_build_object('ok', false, 'message', 'Nível inválido.');
  end if;
  if exists (select 1 from public.cfg_papeis where id = p_papel and imutavel) then
    return jsonb_build_object('ok', false, 'message', 'Papel imutável.');
  end if;
  select nivel into antigo from public.cfg_papel_permissoes where papel_id = p_papel and recurso = p_recurso;
  update public.cfg_papel_permissoes
     set nivel = p_nivel, customizada = true
   where papel_id = p_papel and recurso = p_recurso;
  perform public.cfg_auditar(
    'alterar_permissao', 'configuracoes', 'papel', p_papel,
    'Alterou ' || p_recurso || ' do papel ' || p_papel || ' de ' || coalesce(antigo, 'nenhum') || ' para ' || p_nivel,
    jsonb_build_object('nivel', antigo),
    jsonb_build_object('nivel', p_nivel, 'recurso', p_recurso)
  );
  perform public.cfg_notificar_socios(
    'Alteração de permissão',
    'Permissão de ' || p_papel || ' em ' || p_recurso || ' agora é ' || p_nivel,
    jsonb_build_object('papelId', p_papel, 'recurso', p_recurso)
  );
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.cfg_criar_papel(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  pid text;
  origem text;
  rec record;
begin
  if not public.cfg_pode_acessar('configuracoes.usuarios', 'total') then
    return public.cfg_forbidden();
  end if;
  origem := payload->>'origemId';
  if not exists (select 1 from public.cfg_papeis where id = origem) then
    return jsonb_build_object('ok', false, 'message', 'Papel de origem inexistente.');
  end if;
  pid := coalesce(nullif(trim(payload->>'id'), ''), regexp_replace(lower(trim(payload->>'nome')), '[^a-z0-9]+', '_', 'g'));
  if exists (select 1 from public.cfg_papeis where id = pid) then
    return jsonb_build_object('ok', false, 'message', 'Já existe um papel com esse identificador.');
  end if;
  insert into public.cfg_papeis (id, nome, descricao, imutavel, origem_id)
  values (pid, trim(payload->>'nome'), trim(coalesce(payload->>'descricao', '')), false, origem);
  for rec in select recurso, nivel from public.cfg_papel_permissoes where papel_id = origem loop
    insert into public.cfg_papel_permissoes (papel_id, recurso, nivel, customizada)
    values (pid, rec.recurso, rec.nivel, false);
  end loop;
  perform public.cfg_auditar('criar', 'configuracoes', 'papel', pid, 'Criou o papel ' || trim(payload->>'nome'), null, jsonb_build_object('origemId', origem));
  return jsonb_build_object('ok', true, 'papelId', pid);
end;
$$;

create or replace function public.cfg_excluir_papel(p_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  n int;
begin
  if not public.cfg_pode_acessar('configuracoes.usuarios', 'total') then
    return public.cfg_forbidden();
  end if;
  if exists (select 1 from public.cfg_papeis where id = p_id and imutavel) then
    return jsonb_build_object('ok', false, 'message', 'Papel imutável.');
  end if;
  select count(*) into n from public.cfg_usuarios where papel_id = p_id and situacao <> 'desativado';
  if n > 0 then
    return jsonb_build_object('ok', false, 'message', 'Migre os usuários deste papel antes de excluí-lo.');
  end if;
  delete from public.cfg_papeis where id = p_id;
  perform public.cfg_auditar('excluir', 'configuracoes', 'papel', p_id, 'Excluiu o papel ' || p_id, jsonb_build_object('id', p_id), null);
  return jsonb_build_object('ok', true);
end;
$$;

-- GET /api/configuracoes/auditoria
create or replace function public.cfg_listar_auditoria(
  p_autor uuid default null,
  p_acao text default null,
  p_modulo text default null,
  p_entidade text default null,
  p_busca text default null,
  p_de timestamptz default null,
  p_ate timestamptz default null,
  p_limite int default 100,
  p_offset int default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.cfg_pode_acessar('configuracoes.auditoria', 'ler') then
    return public.cfg_forbidden();
  end if;
  return jsonb_build_object(
    'ok', true,
    'registros', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', a.id,
        'autorId', a.autor_id,
        'autorNome', a.autor_nome,
        'acao', a.acao,
        'modulo', a.modulo,
        'entidade', a.entidade,
        'entidadeId', a.entidade_id,
        'descricao', a.descricao,
        'valorAnterior', a.valor_anterior,
        'valorNovo', a.valor_novo,
        'ip', a.ip,
        'criadoEm', a.criado_em
      ) order by a.criado_em desc)
      from (
        select *
          from public.cfg_auditoria a
         where (p_autor is null or a.autor_id = p_autor)
           and (p_acao is null or a.acao = p_acao)
           and (p_modulo is null or a.modulo = p_modulo)
           and (p_entidade is null or a.entidade = p_entidade)
           and (p_de is null or a.criado_em >= p_de)
           and (p_ate is null or a.criado_em <= p_ate)
           and (p_busca is null or p_busca = '' or a.descricao ilike '%' || p_busca || '%' or a.autor_nome ilike '%' || p_busca || '%')
         order by a.criado_em desc
         limit greatest(1, least(coalesce(p_limite, 100), 500))
         offset greatest(coalesce(p_offset, 0), 0)
      ) a
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.cfg_filhos_fila()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  -- service_role only in practice; authenticated sócios podem flushar em dev
  if auth.role() <> 'service_role' and not public.cfg_pode_acessar('configuracoes.usuarios', 'ler') then
    return public.cfg_forbidden();
  end if;
  return jsonb_build_object(
    'ok', true,
    'itens', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', e.id,
        'tipo', e.tipo,
        'destinatario', e.destinatario,
        'assunto', e.assunto,
        'corpo', e.corpo,
        'payload', e.payload,
        'criadoEm', e.criado_em
      ) order by e.criado_em)
      from public.cfg_emails_fila e
      where e.enviado_em is null
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.cfg_marcar_email_enviado(p_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.cfg_emails_fila set enviado_em = now() where id = p_id;
$$;

create or replace function public.cfg_definir_app_url(p_url text)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.cfg_secrets (chave, valor) values ('app_url', p_url)
  on conflict (chave) do update set valor = excluded.valor;
$$;

create or replace function public.cfg_definir_chave_cripto(p_valor text)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.cfg_secrets (chave, valor) values ('encryption_key', p_valor)
  on conflict (chave) do nothing;
$$;

create or replace function public.cfg_bootstrap_socio(p_email text, p_nome text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid;
  existe int;
begin
  select count(*) into existe from public.cfg_usuarios;
  if existe > 0 then
    return jsonb_build_object('ok', true, 'skipped', true);
  end if;
  uid := public.cfg_convidar_interno(p_nome, p_email, 'socio', '00000000-0000-0000-0000-000000000000'::uuid);
  insert into public.cfg_socios (
    usuario_id, nome_completo, cpf_hash, cpf_cipher, email,
    participacao, aporte_comprometido, aporte_integralizado, data_entrada, situacao
  ) values (
    uid, p_nome,
    public.cfg_hash_cpf('00000000000'),
    public.cfg_encrypt_text('00000000000'),
    lower(trim(p_email)),
    100, 0, 0, current_date, 'ativo'
  );
  return jsonb_build_object('ok', true, 'usuarioId', uid, 'skipped', false);
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.cfg_secrets enable row level security;
alter table public.cfg_papeis enable row level security;
alter table public.cfg_papel_permissoes enable row level security;
alter table public.cfg_usuarios enable row level security;
alter table public.cfg_socios enable row level security;
alter table public.cfg_tokens enable row level security;
alter table public.cfg_auditoria enable row level security;
alter table public.cfg_login_tentativas enable row level security;
alter table public.cfg_emails_fila enable row level security;

revoke all on public.cfg_secrets from anon, authenticated;
revoke all on public.cfg_tokens from anon, authenticated;
revoke all on public.cfg_login_tentativas from anon, authenticated;
revoke all on public.cfg_emails_fila from anon, authenticated;
revoke update, delete on public.cfg_auditoria from anon, authenticated, public;

-- Nenhuma policy em secrets/tokens/fila: só security definer.
create policy cfg_auditoria_select on public.cfg_auditoria for select to authenticated
  using (public.cfg_pode_acessar('configuracoes.auditoria', 'ler'));
-- sem policy de update/delete

create policy cfg_socios_select on public.cfg_socios for select to authenticated
  using (public.cfg_pode_acessar('configuracoes.socios', 'ler') and deletado_em is null);
create policy cfg_usuarios_select on public.cfg_usuarios for select to authenticated
  using (
    id = auth.uid()
    or public.cfg_pode_acessar('configuracoes.usuarios', 'ler')
  );
create policy cfg_papeis_select on public.cfg_papeis for select to authenticated using (true);
create policy cfg_papel_perm_select on public.cfg_papel_permissoes for select to authenticated using (true);

-- ---------------------------------------------------------------------------
-- Pontes: is_socio, financeiro, perfil, casos (parceiro)
-- ---------------------------------------------------------------------------
create or replace function public.is_socio()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select u.papel_id = 'socio' and u.situacao = 'ativo'
      from public.cfg_usuarios u
     where u.id = auth.uid()
  ), (
    select exists (
      select 1 from public.profiles where id = auth.uid() and papel = 'socio'
    )
  ));
$$;

create or replace function public.fin_pode_acessar()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.cfg_pode_acessar('financeiro.lancamentos', 'ler')
    or public.is_socio()
    or exists (select 1 from public.fin_acessos where usuario_id = auth.uid());
$$;

create or replace function public.cfg_pode_ver_caso(p_responsavel uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  u public.cfg_usuarios;
begin
  if not exists (select 1 from public.cfg_usuarios limit 1) then
    return true;
  end if;
  if not public.cfg_pode_acessar('casos', 'ler') then
    return false;
  end if;
  select * into u from public.cfg_usuarios where id = auth.uid();
  if u.papel_id = 'parceiro_juridico' then
    return p_responsavel = auth.uid();
  end if;
  return true;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  nome text;
  iniciais text;
  papel_legado public.papel_usuario;
begin
  nome := coalesce(new.raw_user_meta_data->>'nome', split_part(new.email, '@', 1));
  iniciais := coalesce(new.raw_user_meta_data->>'iniciais', upper(left(split_part(new.email, '@', 1), 2)));
  papel_legado := coalesce((new.raw_user_meta_data->>'papel')::public.papel_usuario, 'advogado');
  insert into public.profiles (id, nome, iniciais, papel)
  values (new.id, nome, iniciais, papel_legado)
  on conflict (id) do update set nome = excluded.nome, iniciais = excluded.iniciais;

  insert into public.cfg_usuarios (id, nome, email, papel_id, situacao, dois_fatores_desde)
  values (
    new.id,
    nome,
    lower(new.email),
    case when papel_legado = 'socio' then 'socio' else 'operacao' end,
    'ativo',
    case when papel_legado = 'socio' then now() else null end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
grant execute on function public.cfg_pode_acessar(text, text) to authenticated;
grant execute on function public.cfg_sessao_atual() to authenticated;
grant execute on function public.cfg_pos_login(text) to authenticated;
grant execute on function public.cfg_marcar_reauth() to authenticated;
grant execute on function public.cfg_logout() to authenticated;
grant execute on function public.cfg_listar_socios(boolean) to authenticated;
grant execute on function public.cfg_criar_socio(jsonb) to authenticated;
grant execute on function public.cfg_editar_socio(uuid, jsonb) to authenticated;
grant execute on function public.cfg_registrar_saida(uuid, jsonb) to authenticated;
grant execute on function public.cfg_reverter_saida(uuid) to authenticated;
grant execute on function public.cfg_excluir_socio(uuid, jsonb) to authenticated;
grant execute on function public.cfg_revelar_cpf(uuid) to authenticated;
grant execute on function public.cfg_listar_usuarios() to authenticated;
grant execute on function public.cfg_listar_papeis() to authenticated;
grant execute on function public.cfg_convidar_usuario(jsonb) to authenticated;
grant execute on function public.cfg_reenviar_convite(uuid) to authenticated;
grant execute on function public.cfg_alterar_papel_usuario(uuid, text) to authenticated;
grant execute on function public.cfg_mudar_situacao_usuario(uuid, text) to authenticated;
grant execute on function public.cfg_forcar_redefinicao(uuid) to authenticated;
grant execute on function public.cfg_alterar_permissao(text, text, text) to authenticated;
grant execute on function public.cfg_criar_papel(jsonb) to authenticated;
grant execute on function public.cfg_excluir_papel(text) to authenticated;
grant execute on function public.cfg_listar_auditoria(uuid, text, text, text, text, timestamptz, timestamptz, int, int) to authenticated;
grant execute on function public.cfg_filhos_fila() to authenticated, service_role;
grant execute on function public.cfg_marcar_email_enviado(uuid) to authenticated;

grant execute on function public.cfg_peek_token(text) to anon, authenticated;
grant execute on function public.cfg_solicitar_redefinicao(text) to anon, authenticated;
grant execute on function public.cfg_solicitar_novo_convite(text) to anon, authenticated;
grant execute on function public.cfg_registrar_login_falho(text, text) to anon, authenticated;
grant execute on function public.cfg_login_liberado(text, text) to anon, authenticated;
grant execute on function public.cfg_situacao_por_email(text) to anon, authenticated;
grant execute on function public.cfg_consumir_token(text, text) to anon, authenticated, service_role;
grant execute on function public.cfg_marcar_usuario_ativo(uuid) to anon, authenticated, service_role;
grant execute on function public.cfg_revogar_sessoes(uuid) to service_role;
grant execute on function public.cfg_bootstrap_socio(text, text) to service_role;
grant execute on function public.cfg_seed_papeis() to service_role;
grant execute on function public.cfg_definir_app_url(text) to service_role;
grant execute on function public.cfg_definir_chave_cripto(text) to service_role;
grant execute on function public.cfg_pos_login(text) to authenticated, service_role;

create or replace function public.cfg_marcar_2fa(p_ativo boolean)
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
     set dois_fatores_ativo = p_ativo,
         dois_fatores_desde = case when p_ativo then dois_fatores_desde else coalesce(dois_fatores_desde, now()) end
   where id = auth.uid();
  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.cfg_marcar_2fa(boolean) to authenticated;

create or replace function public.cfg_criar_socio_seed(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  cpf text;
  uid uuid;
  sit text;
begin
  if exists (select 1 from public.cfg_socios s where lower(s.email) = lower(trim(payload->>'email')) and s.deletado_em is null) then
    return jsonb_build_object('ok', true, 'skipped', true);
  end if;
  cpf := regexp_replace(payload->>'cpf', '\D', '', 'g');
  uid := nullif(payload->>'usuarioId', '')::uuid;
  sit := public.cfg_derivar_situacao_socio(
    null,
    coalesce((payload->>'aporteComprometido')::bigint, 0),
    coalesce((payload->>'aporteIntegralizado')::bigint, 0)
  );
  insert into public.cfg_socios (
    usuario_id, nome_completo, cpf_hash, cpf_cipher, email,
    participacao, aporte_comprometido, aporte_integralizado, data_entrada, situacao
  ) values (
    uid,
    trim(payload->>'nomeCompleto'),
    public.cfg_hash_cpf(cpf),
    public.cfg_encrypt_text(cpf),
    lower(trim(payload->>'email')),
    (payload->>'participacao')::numeric,
    coalesce((payload->>'aporteComprometido')::bigint, 0),
    coalesce((payload->>'aporteIntegralizado')::bigint, 0),
    coalesce((payload->>'dataEntrada')::date, current_date),
    sit
  );
  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.cfg_criar_socio_seed(jsonb) to service_role;
grant execute on function public.cfg_marcar_email_enviado(uuid) to service_role;
