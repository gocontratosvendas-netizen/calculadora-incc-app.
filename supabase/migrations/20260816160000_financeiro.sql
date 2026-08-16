-- Módulo Financeiro (isolado). Prefixo fin_.
-- Contrato HTTP equivalente (hoje: RPCs Postgres + RLS):
--   POST   /api/financeiro/lancamentos              → fin_criar_lancamento
--   PATCH  /api/financeiro/lancamentos/:id          → fin_editar_lancamento
--   POST   /api/financeiro/lancamentos/:id/liquidar → fin_liquidar_lancamento
--   DELETE /api/financeiro/lancamentos/:id          → fin_excluir_lancamento
-- Sem FK para casos, profiles ou qualquer tabela de outro módulo.

-- ---------------------------------------------------------------------------
-- Allowlist de acesso (além de profiles.papel = socio)
-- ---------------------------------------------------------------------------
create table public.fin_acessos (
  usuario_id uuid primary key,
  papel_fin text not null check (papel_fin in ('socio', 'financeiro')),
  criado_em timestamptz not null default now()
);

create or replace function public.fin_pode_acessar()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_socio()
    or exists (
      select 1 from public.fin_acessos where usuario_id = auth.uid()
    );
$$;

revoke all on function public.fin_pode_acessar() from public;
grant execute on function public.fin_pode_acessar() to authenticated;

-- ---------------------------------------------------------------------------
-- Plano de contas
-- ---------------------------------------------------------------------------
create table public.fin_classificacoes (
  id text primary key,
  codigo text not null unique,
  nome text not null,
  movimentacao text not null check (movimentacao in ('entrada', 'saida')),
  grupo_dre text check (
    grupo_dre is null or grupo_dre in (
      'receita_bruta',
      'imposto_sobre_receita',
      'custo_direto',
      'despesa_operacional',
      'depreciacao',
      'resultado_financeiro',
      'ir_csll'
    )
  ),
  ordem integer not null,
  ativa boolean not null default true,
  sistema boolean not null default false,
  criado_em timestamptz not null default now()
);

insert into public.fin_classificacoes (id, codigo, nome, movimentacao, grupo_dre, ordem, ativa, sistema)
values
  ('3.01.001', '3.01.001', 'Cessão de crédito', 'entrada', 'receita_bruta', 101, true, true),
  ('3.01.002', '3.01.002', 'Honorários de êxito', 'entrada', 'receita_bruta', 102, true, true),
  ('3.01.003', '3.01.003', 'Upside CDC (dobro)', 'entrada', 'receita_bruta', 103, true, true),
  ('3.01.004', '3.01.004', 'Outras receitas', 'entrada', 'receita_bruta', 104, true, true),
  ('3.02.001', '3.02.001', 'Aporte de sócios', 'entrada', null, 201, true, true),
  ('3.02.002', '3.02.002', 'Empréstimo / funding', 'entrada', null, 202, true, true),
  ('4.01.001', '4.01.001', 'Honorários escritório parceiro', 'saida', 'custo_direto', 301, true, true),
  ('4.01.002', '4.01.002', 'Custas e despesas processuais', 'saida', 'custo_direto', 302, true, true),
  ('4.01.003', '4.01.003', 'Perícia e cálculos', 'saida', 'custo_direto', 303, true, true),
  ('4.01.004', '4.01.004', 'Comissão de originação', 'saida', 'custo_direto', 304, true, true),
  ('4.01.005', '4.01.005', 'Deságio na cessão', 'saida', 'custo_direto', 305, true, true),
  ('4.02.001', '4.02.001', 'Marketing e originação', 'saida', 'despesa_operacional', 401, true, true),
  ('4.02.002', '4.02.002', 'Pessoal e pró-labore', 'saida', 'despesa_operacional', 402, true, true),
  ('4.02.003', '4.02.003', 'Tecnologia e infraestrutura', 'saida', 'despesa_operacional', 403, true, true),
  ('4.02.004', '4.02.004', 'Administrativo e contábil', 'saida', 'despesa_operacional', 404, true, true),
  ('4.02.005', '4.02.005', 'Jurídico e societário', 'saida', 'despesa_operacional', 405, true, true),
  ('4.02.006', '4.02.006', 'Ocupação e utilidades', 'saida', 'despesa_operacional', 406, true, true),
  ('4.02.007', '4.02.007', 'Viagens e representação', 'saida', 'despesa_operacional', 407, true, true),
  ('4.03.001', '4.03.001', 'Impostos sobre receita', 'saida', 'imposto_sobre_receita', 501, true, true),
  ('4.03.002', '4.03.002', 'Despesas bancárias e financeiras', 'saida', 'resultado_financeiro', 502, true, true),
  ('4.03.003', '4.03.003', 'Juros e encargos', 'saida', 'resultado_financeiro', 503, true, true),
  ('4.03.004', '4.03.004', 'Depreciação e amortização', 'saida', 'depreciacao', 504, true, true),
  ('4.03.005', '4.03.005', 'IRPJ e CSLL', 'saida', 'ir_csll', 505, true, true)
on conflict (id) do update set
  codigo = excluded.codigo,
  nome = excluded.nome,
  movimentacao = excluded.movimentacao,
  grupo_dre = excluded.grupo_dre,
  ordem = excluded.ordem,
  sistema = true;

-- ---------------------------------------------------------------------------
-- Lançamentos (valor em centavos, sempre positivo)
-- ---------------------------------------------------------------------------
create table public.fin_lancamentos (
  id text primary key default gen_random_uuid()::text,
  data_emissao date not null,
  movimentacao text not null check (movimentacao in ('entrada', 'saida')),
  historico text not null check (char_length(historico) between 3 and 120),
  classificacao_id text not null references public.fin_classificacoes (id),
  valor bigint not null check (valor > 0),
  vencimento date not null,
  data_pagamento date,
  caso_id text,
  observacao text,
  deletado_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint fin_lancamentos_vencimento_chk check (vencimento >= data_emissao),
  constraint fin_lancamentos_pagamento_chk check (data_pagamento is null or data_pagamento >= data_emissao)
);

create index fin_lancamentos_data_emissao_idx on public.fin_lancamentos (data_emissao);
create index fin_lancamentos_data_pagamento_idx on public.fin_lancamentos (data_pagamento);
create index fin_lancamentos_classificacao_id_idx on public.fin_lancamentos (classificacao_id);

create or replace function public.fin_touch_atualizado_em()
returns trigger
language plpgsql
as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$;

create trigger fin_lancamentos_touch
  before update on public.fin_lancamentos
  for each row execute function public.fin_touch_atualizado_em();

-- ---------------------------------------------------------------------------
-- Auditoria
-- ---------------------------------------------------------------------------
create table public.fin_auditoria (
  id text primary key default gen_random_uuid()::text,
  lancamento_id text not null,
  autor_id uuid not null,
  acao text not null check (acao in ('criar', 'editar', 'excluir', 'liquidar')),
  valores_antes jsonb,
  valores_depois jsonb,
  criado_em timestamptz not null default now()
);

create index fin_auditoria_lancamento_id_idx on public.fin_auditoria (lancamento_id, criado_em desc);

-- ---------------------------------------------------------------------------
-- RLS: só socio ou fin_acessos. Mutação só via RPC (security definer).
-- ---------------------------------------------------------------------------
alter table public.fin_acessos enable row level security;
alter table public.fin_classificacoes enable row level security;
alter table public.fin_lancamentos enable row level security;
alter table public.fin_auditoria enable row level security;

create policy fin_acessos_select on public.fin_acessos
  for select to authenticated using (public.fin_pode_acessar());

create policy fin_classificacoes_select on public.fin_classificacoes
  for select to authenticated using (public.fin_pode_acessar());

create policy fin_lancamentos_select on public.fin_lancamentos
  for select to authenticated using (public.fin_pode_acessar());

create policy fin_auditoria_select on public.fin_auditoria
  for select to authenticated using (public.fin_pode_acessar());

-- ---------------------------------------------------------------------------
-- Validação compartilhada (espelha o schema Zod do cliente)
-- ---------------------------------------------------------------------------
create or replace function public.fin_validar_payload(payload jsonb)
returns jsonb
language plpgsql
stable
as $$
declare
  errors jsonb := '{}'::jsonb;
  historico text := trim(coalesce(payload->>'historico', ''));
  movimentacao text := payload->>'movimentacao';
  classificacao_id text := payload->>'classificacaoId';
  valor bigint;
  data_emissao date;
  vencimento date;
  data_pagamento date;
  classif record;
begin
  begin
    data_emissao := (payload->>'dataEmissao')::date;
  exception when others then
    data_emissao := null;
  end;
  if data_emissao is null then
    errors := errors || '{"dataEmissao":"Data de emissão obrigatória."}'::jsonb;
  end if;

  if movimentacao is null or movimentacao not in ('entrada', 'saida') then
    errors := errors || '{"movimentacao":"Informe se é entrada ou saída."}'::jsonb;
  end if;

  if char_length(historico) < 3 or char_length(historico) > 120 then
    errors := errors || '{"historico":"Histórico deve ter entre 3 e 120 caracteres."}'::jsonb;
  end if;

  if coalesce(classificacao_id, '') = '' then
    errors := errors || '{"classificacaoId":"Selecione uma classificação."}'::jsonb;
  else
    select * into classif from public.fin_classificacoes where id = classificacao_id;
    if classif is null then
      errors := errors || '{"classificacaoId":"Classificação não encontrada."}'::jsonb;
    elsif movimentacao in ('entrada', 'saida') and classif.movimentacao <> movimentacao then
      errors := errors || '{"classificacaoId":"Classificação incompatível com a movimentação."}'::jsonb;
    end if;
  end if;

  begin
    valor := (payload->>'valor')::bigint;
  exception when others then
    valor := null;
  end;
  if valor is null or valor <= 0 then
    errors := errors || '{"valor":"Informe um valor maior que zero."}'::jsonb;
  end if;

  begin
    vencimento := (payload->>'vencimento')::date;
  exception when others then
    vencimento := null;
  end;
  if vencimento is null then
    errors := errors || '{"vencimento":"Vencimento obrigatório."}'::jsonb;
  elsif data_emissao is not null and vencimento < data_emissao then
    errors := errors || '{"vencimento":"Vencimento não pode ser anterior à emissão."}'::jsonb;
  end if;

  if payload ? 'dataPagamento' and payload->>'dataPagamento' is not null and payload->>'dataPagamento' <> '' then
    begin
      data_pagamento := (payload->>'dataPagamento')::date;
    exception when others then
      data_pagamento := null;
      errors := errors || '{"dataPagamento":"Data de pagamento inválida."}'::jsonb;
    end;
    if data_pagamento is not null and data_emissao is not null and data_pagamento < data_emissao then
      errors := errors || '{"dataPagamento":"Pagamento não pode ser anterior à emissão."}'::jsonb;
    end if;
  end if;

  return errors;
end;
$$;

create or replace function public.fin_assert_acesso()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Não autenticado' using errcode = '28000';
  end if;
  if not public.fin_pode_acessar() then
    raise exception 'Acesso negado' using errcode = '42501';
  end if;
  return uid;
end;
$$;

create or replace function public.fin_row_lancamento(r public.fin_lancamentos)
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'id', r.id,
    'dataEmissao', r.data_emissao,
    'movimentacao', r.movimentacao,
    'historico', r.historico,
    'classificacaoId', r.classificacao_id,
    'valor', r.valor,
    'vencimento', r.vencimento,
    'dataPagamento', r.data_pagamento,
    'casoId', r.caso_id,
    'observacao', r.observacao,
    'deletadoEm', r.deletado_em,
    'criadoEm', r.criado_em,
    'atualizadoEm', r.atualizado_em
  );
$$;

-- POST /api/financeiro/lancamentos
create or replace function public.fin_criar_lancamento(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid;
  errors jsonb;
  novo public.fin_lancamentos;
  pagamento date;
begin
  uid := public.fin_assert_acesso();
  errors := public.fin_validar_payload(payload);
  if errors <> '{}'::jsonb then
    return jsonb_build_object('ok', false, 'errors', errors);
  end if;

  if not exists (
    select 1 from public.fin_classificacoes
    where id = payload->>'classificacaoId' and ativa = true
  ) then
    return jsonb_build_object('ok', false, 'errors', jsonb_build_object('classificacaoId', 'Classificação inativa.'));
  end if;

  if payload->>'dataPagamento' is null or payload->>'dataPagamento' = '' then
    pagamento := null;
  else
    pagamento := (payload->>'dataPagamento')::date;
  end if;

  insert into public.fin_lancamentos (
    data_emissao, movimentacao, historico, classificacao_id, valor,
    vencimento, data_pagamento, caso_id, observacao
  ) values (
    (payload->>'dataEmissao')::date,
    payload->>'movimentacao',
    trim(payload->>'historico'),
    payload->>'classificacaoId',
    (payload->>'valor')::bigint,
    (payload->>'vencimento')::date,
    pagamento,
    nullif(payload->>'casoId', ''),
    nullif(trim(coalesce(payload->>'observacao', '')), '')
  )
  returning * into novo;

  insert into public.fin_auditoria (lancamento_id, autor_id, acao, valores_antes, valores_depois)
  values (novo.id, uid, 'criar', null, public.fin_row_lancamento(novo));

  return jsonb_build_object('ok', true, 'lancamento', public.fin_row_lancamento(novo));
end;
$$;

-- PATCH /api/financeiro/lancamentos/:id
create or replace function public.fin_editar_lancamento(p_id text, payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid;
  errors jsonb;
  antigo public.fin_lancamentos;
  novo public.fin_lancamentos;
  pagamento date;
begin
  uid := public.fin_assert_acesso();
  errors := public.fin_validar_payload(payload);
  if errors <> '{}'::jsonb then
    return jsonb_build_object('ok', false, 'errors', errors);
  end if;

  select * into antigo from public.fin_lancamentos where id = p_id and deletado_em is null;
  if antigo is null then
    return jsonb_build_object('ok', false, 'message', 'Lançamento não encontrado.');
  end if;

  if payload->>'dataPagamento' is null or payload->>'dataPagamento' = '' then
    pagamento := null;
  else
    pagamento := (payload->>'dataPagamento')::date;
  end if;

  update public.fin_lancamentos set
    data_emissao = (payload->>'dataEmissao')::date,
    movimentacao = payload->>'movimentacao',
    historico = trim(payload->>'historico'),
    classificacao_id = payload->>'classificacaoId',
    valor = (payload->>'valor')::bigint,
    vencimento = (payload->>'vencimento')::date,
    data_pagamento = pagamento,
    caso_id = nullif(payload->>'casoId', ''),
    observacao = nullif(trim(coalesce(payload->>'observacao', '')), '')
  where id = p_id
  returning * into novo;

  insert into public.fin_auditoria (lancamento_id, autor_id, acao, valores_antes, valores_depois)
  values (novo.id, uid, 'editar', public.fin_row_lancamento(antigo), public.fin_row_lancamento(novo));

  return jsonb_build_object('ok', true, 'lancamento', public.fin_row_lancamento(novo));
end;
$$;

-- POST /api/financeiro/lancamentos/:id/liquidar
create or replace function public.fin_liquidar_lancamento(p_id text, p_data_pagamento date)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid;
  antigo public.fin_lancamentos;
  novo public.fin_lancamentos;
begin
  uid := public.fin_assert_acesso();

  select * into antigo from public.fin_lancamentos where id = p_id and deletado_em is null;
  if antigo is null then
    return jsonb_build_object('ok', false, 'message', 'Lançamento não encontrado.');
  end if;
  if p_data_pagamento is null then
    return jsonb_build_object('ok', false, 'errors', jsonb_build_object('dataPagamento', 'Informe a data de pagamento.'));
  end if;
  if p_data_pagamento < antigo.data_emissao then
    return jsonb_build_object('ok', false, 'errors', jsonb_build_object('dataPagamento', 'Pagamento não pode ser anterior à emissão.'));
  end if;

  update public.fin_lancamentos set data_pagamento = p_data_pagamento
  where id = p_id
  returning * into novo;

  insert into public.fin_auditoria (lancamento_id, autor_id, acao, valores_antes, valores_depois)
  values (novo.id, uid, 'liquidar', public.fin_row_lancamento(antigo), public.fin_row_lancamento(novo));

  return jsonb_build_object('ok', true, 'lancamento', public.fin_row_lancamento(novo));
end;
$$;

-- DELETE /api/financeiro/lancamentos/:id  (soft delete)
create or replace function public.fin_excluir_lancamento(p_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid;
  antigo public.fin_lancamentos;
  novo public.fin_lancamentos;
begin
  uid := public.fin_assert_acesso();

  select * into antigo from public.fin_lancamentos where id = p_id and deletado_em is null;
  if antigo is null then
    return jsonb_build_object('ok', false, 'message', 'Lançamento não encontrado.');
  end if;

  update public.fin_lancamentos set deletado_em = now()
  where id = p_id
  returning * into novo;

  insert into public.fin_auditoria (lancamento_id, autor_id, acao, valores_antes, valores_depois)
  values (novo.id, uid, 'excluir', public.fin_row_lancamento(antigo), public.fin_row_lancamento(novo));

  return jsonb_build_object('ok', true, 'lancamento', public.fin_row_lancamento(novo));
end;
$$;

create or replace function public.fin_criar_classificacao(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid;
  novo public.fin_classificacoes;
  codigo text := trim(coalesce(payload->>'codigo', ''));
  nome text := trim(coalesce(payload->>'nome', ''));
  max_ordem integer;
begin
  uid := public.fin_assert_acesso();
  if uid is null then
    return jsonb_build_object('ok', false, 'message', 'Não autenticado.');
  end if;
  if char_length(codigo) < 3 or char_length(nome) < 3 then
    return jsonb_build_object('ok', false, 'message', 'Código e nome são obrigatórios.');
  end if;
  if exists (select 1 from public.fin_classificacoes where fin_classificacoes.codigo = codigo) then
    return jsonb_build_object('ok', false, 'errors', jsonb_build_object('codigo', 'Código já existe.'));
  end if;

  select coalesce(max(ordem), 800) + 1 into max_ordem from public.fin_classificacoes;

  insert into public.fin_classificacoes (id, codigo, nome, movimentacao, grupo_dre, ordem, ativa, sistema)
  values (
    gen_random_uuid()::text,
    codigo,
    nome,
    payload->>'movimentacao',
    nullif(payload->>'grupoDRE', ''),
    max_ordem,
    true,
    false
  )
  returning * into novo;

  return jsonb_build_object(
    'ok', true,
    'classificacao', jsonb_build_object(
      'id', novo.id,
      'codigo', novo.codigo,
      'nome', novo.nome,
      'movimentacao', novo.movimentacao,
      'grupoDRE', novo.grupo_dre,
      'ordem', novo.ordem,
      'ativa', novo.ativa,
      'sistema', novo.sistema
    )
  );
end;
$$;

revoke all on function public.fin_criar_lancamento(jsonb) from public;
revoke all on function public.fin_editar_lancamento(text, jsonb) from public;
revoke all on function public.fin_liquidar_lancamento(text, date) from public;
revoke all on function public.fin_excluir_lancamento(text) from public;
revoke all on function public.fin_criar_classificacao(jsonb) from public;
grant execute on function public.fin_criar_lancamento(jsonb) to authenticated;
grant execute on function public.fin_editar_lancamento(text, jsonb) to authenticated;
grant execute on function public.fin_liquidar_lancamento(text, date) to authenticated;
grant execute on function public.fin_excluir_lancamento(text) to authenticated;
grant execute on function public.fin_criar_classificacao(jsonb) to authenticated;
