-- VERUM — schema inicial (casos, parcerias, mural, materiais)

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Profiles (1:1 com auth.users)
-- ---------------------------------------------------------------------------
create type public.papel_usuario as enum ('socio', 'advogado');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nome text not null,
  iniciais text not null,
  papel public.papel_usuario not null default 'advogado',
  criado_em timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, nome, iniciais, papel)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nome', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'iniciais', upper(left(split_part(new.email, '@', 1), 2))),
    coalesce((new.raw_user_meta_data->>'papel')::public.papel_usuario, 'advogado')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.current_papel()
returns public.papel_usuario
language sql
stable
security definer
set search_path = public
as $$
  select papel from public.profiles where id = auth.uid();
$$;

create or replace function public.is_socio()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and papel = 'socio'
  );
$$;

-- ---------------------------------------------------------------------------
-- Parceiros
-- ---------------------------------------------------------------------------
create type public.estagio_parceria as enum (
  'prospeccao', 'em_negociacao', 'ativa', 'encerrada'
);
create type public.tipo_parceiro as enum (
  'imobiliaria', 'administradora', 'sindico',
  'assessoria_credito', 'contabilidade', 'outro'
);
create type public.modelo_comissao as enum (
  'percentual_exito', 'valor_fixo', 'misto', 'a_definir'
);

create table public.parceiros (
  id text primary key,
  nome text not null,
  iniciais text not null,
  tipo public.tipo_parceiro not null,
  detalhe text,
  documento text,
  contato_pessoa text not null,
  contato_cargo text,
  contato_email text,
  contato_telefone text,
  estagio public.estagio_parceria not null default 'prospeccao',
  responsavel_id uuid not null references public.profiles (id),
  proximo_passo text,
  ultimo_contato_em timestamptz,
  encerrada_em timestamptz,
  observacoes text,
  comissao_modelo public.modelo_comissao not null default 'a_definir',
  comissao_percentual numeric,
  comissao_valor_por_caso numeric,
  casos_indicados integer not null default 0,
  excesso_originado numeric not null default 0,
  criado_em timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Casos
-- ---------------------------------------------------------------------------
create type public.caso_status as enum (
  'processo_de_venda', 'ajuizado', 'encerrado'
);
create type public.desfecho as enum (
  'procedente', 'parcialmente_procedente', 'improcedente', 'acordo', 'desistencia'
);
create type public.situacao_obra as enum ('em_andamento', 'entregue');
create type public.tipo_andamento as enum (
  'contato', 'documento', 'calculo', 'protocolo', 'decisao',
  'prazo', 'financeiro', 'status', 'sistema'
);
create type public.documento_chave as enum (
  'memorial', 'contrato', 'chaves', 'comprovantes'
);

create table public.casos (
  id text primary key,
  cliente_nome text not null,
  cliente_email text,
  cliente_telefone text,
  empreendimento text not null default 'A definir',
  incorporadora text not null default 'A definir',
  data_assinatura date,
  valor_contrato numeric not null default 0,
  parcelas_reais integer not null default 0,
  parcelas_contrato integer not null default 0,
  parcela_residual numeric,
  situacao_obra public.situacao_obra not null default 'em_andamento',
  data_chaves date,
  excesso_apurado numeric,
  valor_causa numeric,
  prescricao_em date,
  status public.caso_status not null default 'processo_de_venda',
  numero_processo text,
  data_protocolo date,
  vara_comarca text,
  desfecho public.desfecho,
  valor_recuperado numeric,
  parceiro_id text references public.parceiros (id) on delete set null,
  canal_origem text not null default 'Direto',
  responsavel_id uuid not null references public.profiles (id),
  criterios jsonb not null default '[]'::jsonb,
  atualizado_em timestamptz not null default now(),
  criado_em timestamptz not null default now()
);

create table public.andamentos (
  id text primary key,
  caso_id text not null references public.casos (id) on delete cascade,
  tipo public.tipo_andamento not null,
  titulo text not null,
  descricao text,
  data date not null,
  autor_id uuid not null references public.profiles (id),
  anexo_id text,
  anexo_nome text,
  anexo_tamanho_bytes bigint,
  anexo_url text,
  acao_rotulo text,
  acao_destino text,
  automatico boolean not null default false,
  criado_em timestamptz not null default now()
);

create index andamentos_caso_id_idx on public.andamentos (caso_id, criado_em desc);

create table public.prazos (
  id text primary key,
  caso_id text not null references public.casos (id) on delete cascade,
  titulo text not null,
  descricao text,
  vence_em date not null,
  concluido boolean not null default false,
  concluido_em timestamptz
);

create index prazos_caso_id_idx on public.prazos (caso_id);

create table public.documentos_caso (
  id text primary key default gen_random_uuid()::text,
  caso_id text not null references public.casos (id) on delete cascade,
  chave public.documento_chave not null,
  rotulo text not null,
  obrigatorio boolean not null default false,
  arquivo_id text,
  arquivo_nome text,
  arquivo_tamanho_bytes bigint,
  arquivo_url text,
  unique (caso_id, chave)
);

-- ---------------------------------------------------------------------------
-- Mural
-- ---------------------------------------------------------------------------
create type public.post_tipo as enum ('usuario', 'atualizacao');

create table public.posts (
  id text primary key,
  tipo public.post_tipo not null default 'usuario',
  autor_id uuid references public.profiles (id) on delete set null,
  texto text not null,
  caso_id text references public.casos (id) on delete set null,
  caso_snapshot jsonb,
  anexo_id text,
  anexo_nome text,
  anexo_formato text,
  anexo_tamanho_bytes bigint,
  anexo_versao text,
  anexo_url text,
  restrito_a_socios boolean not null default false,
  criado_em timestamptz not null default now()
);

create index posts_criado_em_idx on public.posts (criado_em desc);

create table public.post_mencoes (
  id bigserial primary key,
  post_id text not null references public.posts (id) on delete cascade,
  usuario_id text not null, -- uuid text or 'todos'
  offset_start integer not null,
  length integer not null
);

create table public.comentarios (
  id text primary key,
  post_id text not null references public.posts (id) on delete cascade,
  autor_id uuid not null references public.profiles (id),
  texto text not null,
  criado_em timestamptz not null default now()
);

create index comentarios_post_id_idx on public.comentarios (post_id, criado_em desc);

create table public.post_curtidas (
  post_id text not null references public.posts (id) on delete cascade,
  usuario_id uuid not null references public.profiles (id) on delete cascade,
  criado_em timestamptz not null default now(),
  primary key (post_id, usuario_id)
);

create table public.marcacoes (
  id text primary key,
  post_id text not null references public.posts (id) on delete cascade,
  destinatario_id uuid not null references public.profiles (id) on delete cascade,
  autor_id uuid not null references public.profiles (id),
  resumo text not null,
  lida boolean not null default false,
  criado_em timestamptz not null default now()
);

create index marcacoes_dest_idx on public.marcacoes (destinatario_id, lida);

create table public.itens_atencao (
  id text primary key,
  tipo text not null check (tipo in ('revisao', 'prescricao', 'memorial')),
  quantidade integer,
  cliente text,
  meses integer,
  href text not null
);

-- ---------------------------------------------------------------------------
-- Materiais
-- ---------------------------------------------------------------------------
create type public.material_categoria as enum ('comercial', 'juridico', 'operacional');
create type public.material_formato as enum ('pdf', 'docx', 'xlsx');
create type public.thumb_variant as enum (
  'carta', 'carta-bloco', 'tabela', 'checklist', 'memorando', 'relatorio'
);

create table public.materiais (
  id text primary key,
  nome text not null,
  descricao text not null default '',
  categoria public.material_categoria not null,
  formato public.material_formato not null,
  thumb public.thumb_variant not null default 'carta',
  tamanho_bytes bigint not null default 0,
  url text not null,
  storage_path text,
  atualizado_em timestamptz not null default now(),
  criado_em timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Storage buckets
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values
  ('casos-arquivos', 'casos-arquivos', true),
  ('mural-anexos', 'mural-anexos', true),
  ('materiais', 'materiais', true)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.parceiros enable row level security;
alter table public.casos enable row level security;
alter table public.andamentos enable row level security;
alter table public.prazos enable row level security;
alter table public.documentos_caso enable row level security;
alter table public.posts enable row level security;
alter table public.post_mencoes enable row level security;
alter table public.comentarios enable row level security;
alter table public.post_curtidas enable row level security;
alter table public.marcacoes enable row level security;
alter table public.itens_atencao enable row level security;
alter table public.materiais enable row level security;

-- Profiles: authenticated read all; update own
create policy profiles_select on public.profiles for select to authenticated using (true);
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- Generic CRUD for authenticated on operational tables
create policy parceiros_all on public.parceiros for all to authenticated using (true) with check (true);
create policy casos_all on public.casos for all to authenticated using (true) with check (true);
create policy andamentos_all on public.andamentos for all to authenticated using (true) with check (true);
create policy prazos_all on public.prazos for all to authenticated using (true) with check (true);
create policy documentos_caso_all on public.documentos_caso for all to authenticated using (true) with check (true);
create policy post_mencoes_all on public.post_mencoes for all to authenticated using (true) with check (true);
create policy comentarios_all on public.comentarios for all to authenticated using (true) with check (true);
create policy post_curtidas_all on public.post_curtidas for all to authenticated using (true) with check (true);
create policy marcacoes_all on public.marcacoes for all to authenticated using (true) with check (true);
create policy itens_atencao_all on public.itens_atencao for all to authenticated using (true) with check (true);
create policy materiais_all on public.materiais for all to authenticated using (true) with check (true);

-- Posts: hide socio-only from non-socios
create policy posts_select on public.posts for select to authenticated
  using (not restrito_a_socios or public.is_socio());
create policy posts_insert on public.posts for insert to authenticated
  with check (
    (not restrito_a_socios or public.is_socio())
    and (autor_id is null or autor_id = auth.uid() or tipo = 'atualizacao')
  );
create policy posts_update on public.posts for update to authenticated using (true) with check (true);
create policy posts_delete on public.posts for delete to authenticated using (true);

-- Storage: authenticated read/write on app buckets
create policy storage_casos_select on storage.objects for select to authenticated
  using (bucket_id in ('casos-arquivos', 'mural-anexos', 'materiais'));
create policy storage_casos_insert on storage.objects for insert to authenticated
  with check (bucket_id in ('casos-arquivos', 'mural-anexos', 'materiais'));
create policy storage_casos_update on storage.objects for update to authenticated
  using (bucket_id in ('casos-arquivos', 'mural-anexos', 'materiais'));
create policy storage_casos_delete on storage.objects for delete to authenticated
  using (bucket_id in ('casos-arquivos', 'mural-anexos', 'materiais'));
