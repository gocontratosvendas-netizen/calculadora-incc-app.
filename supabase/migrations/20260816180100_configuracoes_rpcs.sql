-- RPCs do módulo Configurações (continuação).

-- ---------------------------------------------------------------------------
-- Sessão
-- ---------------------------------------------------------------------------
create or replace function public.cfg_mapa_permissoes(p_papel_id text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_object_agg(recurso, nivel), '{}'::jsonb)
    from public.cfg_papel_permissoes
   where papel_id = p_papel_id;
$$;

create or replace function public.cfg_iniciais(p_nome text)
returns text
language sql
immutable
as $$
  select upper(
    left((string_to_array(trim(p_nome), ' '))[1], 1) ||
    left(
      (string_to_array(trim(p_nome), ' '))[
        array_length(string_to_array(trim(p_nome), ' '), 1)
      ],
      1
    )
  );
$$;

create or replace function public.cfg_json_usuario(u public.cfg_usuarios)
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'id', u.id,
    'nome', u.nome,
    'email', u.email,
    'papelId', u.papel_id,
    'situacao', u.situacao,
    'doisFatoresAtivo', u.dois_fatores_ativo,
    'ultimoAcesso', u.ultimo_acesso,
    'convidadoPor', u.convidado_por,
    'criadoEm', u.criado_em,
    'atualizadoEm', u.atualizado_em
  );
$$;

-- GET /api/configuracoes/sessao
create or replace function public.cfg_sessao_atual()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  u public.cfg_usuarios;
  pnome text;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', true, 'usuario', null);
  end if;
  select * into u from public.cfg_usuarios where id = auth.uid();
  if u is null or not public.cfg_usuario_sessao_valida(u) then
    return jsonb_build_object('ok', true, 'usuario', null);
  end if;
  select nome into pnome from public.cfg_papeis where id = u.papel_id;
  return jsonb_build_object(
    'ok', true,
    'usuario', jsonb_build_object(
      'id', u.id,
      'nome', u.nome,
      'email', u.email,
      'papelId', u.papel_id,
      'papelNome', coalesce(pnome, u.papel_id),
      'situacao', u.situacao,
      'doisFatoresAtivo', u.dois_fatores_ativo,
      'doisFatoresDesde', u.dois_fatores_desde,
      'permissoes', public.cfg_mapa_permissoes(u.papel_id),
      'ultimaReauthEm', u.ultima_reauth_em,
      'iniciais', public.cfg_iniciais(u.nome)
    )
  );
end;
$$;

create or replace function public.cfg_pos_login(p_ip text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  u public.cfg_usuarios;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'message', 'E-mail ou senha incorretos.');
  end if;
  select * into u from public.cfg_usuarios where id = auth.uid();
  if u is null or u.situacao <> 'ativo' then
    return jsonb_build_object('ok', false, 'message', 'E-mail ou senha incorretos.');
  end if;
  update public.cfg_usuarios
     set ultimo_acesso = now(),
         ja_logou = true,
         ultima_reauth_em = now()
   where id = u.id;
  perform public.cfg_auditar('login', 'auth', 'usuario', u.id::text, 'Login bem-sucedido', null, null, p_ip, u.id, u.nome);
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.cfg_registrar_login_falho(p_email text, p_ip text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  n_email int;
  n_ip int;
begin
  select count(*) into n_email
    from public.cfg_login_tentativas
   where lower(email) = lower(p_email)
     and criado_em > now() - interval '15 minutes';
  if n_email >= 5 then
    return jsonb_build_object('ok', false, 'code', 'rate', 'message', 'E-mail ou senha incorretos.');
  end if;
  if p_ip is not null then
    select count(*) into n_ip
      from public.cfg_login_tentativas
     where ip = p_ip
       and criado_em > now() - interval '1 hour';
    if n_ip >= 20 then
      return jsonb_build_object('ok', false, 'code', 'rate', 'message', 'E-mail ou senha incorretos.');
    end if;
  end if;
  insert into public.cfg_login_tentativas (email, ip, ok) values (lower(trim(p_email)), p_ip, false);
  perform public.cfg_auditar(
    'login_falho', 'auth', 'usuario', lower(trim(p_email)),
    'Tentativa de login falhou',
    null, jsonb_build_object('email', lower(trim(p_email))), p_ip,
    '00000000-0000-0000-0000-000000000000'::uuid, 'Sistema'
  );
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.cfg_login_liberado(p_email text, p_ip text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  n_email int;
  n_ip int;
begin
  select count(*) into n_email
    from public.cfg_login_tentativas
   where lower(email) = lower(p_email)
     and ok = false
     and criado_em > now() - interval '15 minutes';
  if n_email >= 5 then
    return jsonb_build_object('ok', false, 'code', 'rate');
  end if;
  if p_ip is not null then
    select count(*) into n_ip
      from public.cfg_login_tentativas
     where ip = p_ip and ok = false and criado_em > now() - interval '1 hour';
    if n_ip >= 20 then
      return jsonb_build_object('ok', false, 'code', 'rate');
    end if;
  end if;
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.cfg_situacao_por_email(p_email text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select situacao from public.cfg_usuarios where lower(email) = lower(trim(p_email)) limit 1;
$$;

-- ---------------------------------------------------------------------------
-- Sócios — serialização e resumo
-- ---------------------------------------------------------------------------
create or replace function public.cfg_soma_participacao(p_ignorar uuid default null)
returns integer
language sql
stable
as $$
  select coalesce(sum(round(participacao * 100))::int, 0)
    from public.cfg_socios
   where deletado_em is null
     and data_saida is null
     and (p_ignorar is null or id <> p_ignorar);
$$;

create or replace function public.cfg_socio_tem_fin(p_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  tem boolean := false;
begin
  if to_regclass('public.fin_lancamentos') is null then
    return false;
  end if;
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'fin_lancamentos' and column_name = 'socio_id'
  ) then
    execute
      'select exists (select 1 from public.fin_lancamentos where socio_id = $1 and deletado_em is null)'
      into tem using p_id;
    return tem;
  end if;
  return false;
end;
$$;

create or replace function public.cfg_pode_excluir_socio(s public.cfg_socios)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  ja boolean;
  ativos int;
begin
  if s.aporte_integralizado > 0 then
    return false;
  end if;
  if public.cfg_socio_tem_fin(s.id) then
    return false;
  end if;
  if s.usuario_id is not null then
    select ja_logou into ja from public.cfg_usuarios where id = s.usuario_id;
    if coalesce(ja, false) then
      return false;
    end if;
  end if;
  select count(*) into ativos
    from public.cfg_socios
   where deletado_em is null and data_saida is null;
  if s.data_saida is null and ativos <= 1 then
    return false;
  end if;
  return true;
end;
$$;

create or replace function public.cfg_json_socio(s public.cfg_socios)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  cpf text;
begin
  cpf := public.cfg_decrypt_text(s.cpf_cipher);
  return jsonb_build_object(
    'id', s.id,
    'usuarioId', s.usuario_id,
    'nomeCompleto', s.nome_completo,
    'cpfMascarado', public.cfg_mask_cpf(cpf),
    'email', s.email,
    'telefone', public.cfg_decrypt_text(s.telefone_cipher),
    'participacao', s.participacao,
    'aporteComprometido', s.aporte_comprometido,
    'aporteIntegralizado', s.aporte_integralizado,
    'dataEntrada', s.data_entrada,
    'dataSaida', s.data_saida,
    'motivoSaida', s.motivo_saida,
    'situacao', s.situacao,
    'observacao', s.observacao,
    'deletadoEm', s.deletado_em,
    'criadoEm', s.criado_em,
    'atualizadoEm', s.atualizado_em,
    'podeExcluir', public.cfg_pode_excluir_socio(s)
  );
end;
$$;

create or replace function public.cfg_resumo_socios()
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'ativos', count(*) filter (where data_saida is null),
    'participacaoCentesimos', coalesce(sum(round(participacao * 100)) filter (where data_saida is null), 0)::int,
    'aportado', coalesce(sum(aporte_integralizado) filter (where data_saida is null), 0)::bigint,
    'pendente', coalesce(sum(aporte_comprometido - aporte_integralizado) filter (where data_saida is null), 0)::bigint
  )
  from public.cfg_socios
  where deletado_em is null;
$$;

-- GET /api/configuracoes/socios
create or replace function public.cfg_listar_socios(p_incluir_inativos boolean default false)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.cfg_pode_acessar('configuracoes.socios', 'ler') then
    return public.cfg_forbidden();
  end if;
  return jsonb_build_object(
    'ok', true,
    'socios', coalesce((
      select jsonb_agg(public.cfg_json_socio(s) order by s.nome_completo)
        from public.cfg_socios s
       where s.deletado_em is null
         and (p_incluir_inativos or s.data_saida is null)
    ), '[]'::jsonb),
    'resumo', public.cfg_resumo_socios()
  );
end;
$$;

create or replace function public.cfg_validar_socio_payload(payload jsonb, p_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  errors jsonb := '{}'::jsonb;
  cpf text;
  email text;
  part numeric;
  comp bigint;
  integ bigint;
  entrada date;
  soma int;
begin
  cpf := regexp_replace(coalesce(payload->>'cpf', ''), '\D', '', 'g');
  email := lower(trim(coalesce(payload->>'email', '')));
  if char_length(trim(coalesce(payload->>'nomeCompleto', ''))) < 3 then
    errors := errors || jsonb_build_object('nomeCompleto', 'Informe o nome completo.');
  end if;
  if char_length(cpf) <> 11 then
    errors := errors || jsonb_build_object('cpf', 'CPF inválido.');
  end if;
  if email = '' or position('@' in email) = 0 then
    errors := errors || jsonb_build_object('email', 'E-mail inválido.');
  end if;
  part := coalesce((payload->>'participacao')::numeric, 0);
  if part < 0.01 or part > 100 then
    errors := errors || jsonb_build_object('participacao', 'Participação deve estar entre 0,01% e 100,00%.');
  end if;
  comp := coalesce((payload->>'aporteComprometido')::bigint, 0);
  integ := coalesce((payload->>'aporteIntegralizado')::bigint, 0);
  if integ > comp then
    errors := errors || jsonb_build_object('aporteIntegralizado', 'Aporte integralizado não pode exceder o comprometido.');
  end if;
  entrada := (payload->>'dataEntrada')::date;
  if entrada is null then
    errors := errors || jsonb_build_object('dataEntrada', 'Data inválida.');
  elsif entrada > current_date then
    errors := errors || jsonb_build_object('dataEntrada', 'Data de entrada não pode ser futura.');
  end if;
  if cpf <> '' and exists (
    select 1 from public.cfg_socios s
     where s.deletado_em is null
       and s.cpf_hash = public.cfg_hash_cpf(cpf)
       and (p_id is null or s.id <> p_id)
  ) then
    errors := errors || jsonb_build_object('cpf', 'CPF já cadastrado.');
  end if;
  if email <> '' and exists (
    select 1 from public.cfg_socios s
     where s.deletado_em is null
       and lower(s.email) = email
       and (p_id is null or s.id <> p_id)
  ) then
    errors := errors || jsonb_build_object('email', 'E-mail já cadastrado.');
  end if;
  soma := public.cfg_soma_participacao(p_id) + round(part * 100)::int;
  if soma > 10000 then
    errors := errors || jsonb_build_object(
      'participacao',
      'A soma das participações excede 100% em ' || to_char((soma - 10000) / 100.0, 'FM990.00') || ' pontos percentuais.'
    );
  end if;
  return errors;
end;
$$;

create or replace function public.cfg_emitir_token(p_usuario uuid, p_tipo text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  raw text;
  validade interval;
begin
  raw := encode(extensions.gen_random_bytes(32), 'hex');
  validade := case when p_tipo = 'convite' then interval '7 days' else interval '1 hour' end;
  update public.cfg_tokens
     set usado_em = coalesce(usado_em, now())
   where usuario_id = p_usuario and tipo = p_tipo and usado_em is null;
  insert into public.cfg_tokens (usuario_id, tipo, token_hash, expires_at)
  values (p_usuario, p_tipo, public.cfg_hash_token(raw), now() + validade);
  return raw;
end;
$$;

create or replace function public.cfg_convidar_interno(p_nome text, p_email text, p_papel text, p_autor uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid;
  raw text;
  link text;
  pnome text;
begin
  uid := gen_random_uuid();
  insert into public.cfg_usuarios (id, nome, email, papel_id, situacao, convidado_por, dois_fatores_desde)
  values (
    uid, p_nome, lower(trim(p_email)), p_papel, 'convidado', p_autor,
    case when p_papel = 'socio' then now() else null end
  );
  raw := public.cfg_emitir_token(uid, 'convite');
  link := public.cfg_app_url() || '/convite/' || raw;
  select nome into pnome from public.cfg_papeis where id = p_papel;
  perform public.cfg_enfileirar_email(
    'convite',
    lower(trim(p_email)),
    'Convite para o VERUM',
    'Você foi convidado. Defina sua senha pelo link.',
    jsonb_build_object('token', raw, 'link', link, 'nome', p_nome, 'papel', coalesce(pnome, p_papel), 'convidadoPor', p_autor)
  );
  perform public.cfg_auditar(
    'convidar', 'configuracoes', 'usuario', uid::text,
    'Convidou ' || p_nome || ' com o papel ' || coalesce(pnome, p_papel),
    null, jsonb_build_object('email', lower(trim(p_email)), 'papelId', p_papel)
  );
  raise notice 'CFG_INVITE_URL %', link;
  return uid;
end;
$$;

-- POST /api/configuracoes/socios
create or replace function public.cfg_criar_socio(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  errors jsonb;
  novo public.cfg_socios;
  cpf text;
  uid uuid;
begin
  if not public.cfg_pode_acessar('configuracoes.socios', 'total') then
    return public.cfg_forbidden();
  end if;
  errors := public.cfg_validar_socio_payload(payload, null);
  if errors <> '{}'::jsonb then
    return jsonb_build_object('ok', false, 'errors', errors);
  end if;
  cpf := regexp_replace(payload->>'cpf', '\D', '', 'g');
  insert into public.cfg_socios (
    nome_completo, cpf_hash, cpf_cipher, email, telefone_cipher,
    participacao, aporte_comprometido, aporte_integralizado,
    data_entrada, situacao, observacao
  ) values (
    trim(payload->>'nomeCompleto'),
    public.cfg_hash_cpf(cpf),
    public.cfg_encrypt_text(cpf),
    lower(trim(payload->>'email')),
    public.cfg_encrypt_text(nullif(trim(coalesce(payload->>'telefone', '')), '')),
    (payload->>'participacao')::numeric,
    (payload->>'aporteComprometido')::bigint,
    (payload->>'aporteIntegralizado')::bigint,
    (payload->>'dataEntrada')::date,
    public.cfg_derivar_situacao_socio(null, (payload->>'aporteComprometido')::bigint, (payload->>'aporteIntegralizado')::bigint),
    nullif(trim(coalesce(payload->>'observacao', '')), '')
  ) returning * into novo;

  if coalesce((payload->>'convidarConta')::boolean, true) then
    uid := public.cfg_convidar_interno(novo.nome_completo, novo.email, 'socio', auth.uid());
    update public.cfg_socios set usuario_id = uid where id = novo.id returning * into novo;
  end if;

  perform public.cfg_auditar(
    'criar', 'configuracoes', 'socio', novo.id::text,
    'Cadastrou o sócio ' || novo.nome_completo,
    null, public.cfg_json_socio(novo)
  );
  perform public.cfg_notificar_socios(
    'Alteração no quadro societário',
    'Novo sócio cadastrado: ' || novo.nome_completo,
    jsonb_build_object('socioId', novo.id)
  );
  return jsonb_build_object('ok', true, 'socio', public.cfg_json_socio(novo), 'resumo', public.cfg_resumo_socios());
end;
$$;

-- PATCH /api/configuracoes/socios/:id
create or replace function public.cfg_editar_socio(p_id uuid, payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  antigo public.cfg_socios;
  novo public.cfg_socios;
  errors jsonb;
  cpf text;
  part numeric;
  diffs jsonb := '[]'::jsonb;
  descricao text := '';
begin
  if not public.cfg_pode_acessar('configuracoes.socios', 'editar') then
    return public.cfg_forbidden();
  end if;
  select * into antigo from public.cfg_socios where id = p_id and deletado_em is null;
  if antigo is null then
    return jsonb_build_object('ok', false, 'message', 'Sócio não encontrado.');
  end if;
  if payload ? 'participacao'
     or payload ? 'aporteComprometido'
     or payload ? 'aporteIntegralizado'
     or payload ? 'dataEntrada' then
    if not public.cfg_pode_acessar('configuracoes.socios', 'total') then
      return public.cfg_forbidden();
    end if;
    if public.cfg_precisa_reauth() then
      return jsonb_build_object('ok', false, 'code', 'reauth', 'message', 'Confirme sua senha para continuar.');
    end if;
    if antigo.usuario_id is not null and antigo.usuario_id = auth.uid() and payload ? 'participacao' then
      return jsonb_build_object('ok', false, 'message', 'Ninguém edita a própria participação.');
    end if;
  end if;
  errors := public.cfg_validar_socio_payload(payload, p_id);
  if errors <> '{}'::jsonb then
    return jsonb_build_object('ok', false, 'errors', errors);
  end if;
  cpf := regexp_replace(payload->>'cpf', '\D', '', 'g');
  part := (payload->>'participacao')::numeric;
  update public.cfg_socios set
    nome_completo = trim(payload->>'nomeCompleto'),
    cpf_hash = public.cfg_hash_cpf(cpf),
    cpf_cipher = public.cfg_encrypt_text(cpf),
    email = lower(trim(payload->>'email')),
    telefone_cipher = public.cfg_encrypt_text(nullif(trim(coalesce(payload->>'telefone', '')), '')),
    participacao = part,
    aporte_comprometido = (payload->>'aporteComprometido')::bigint,
    aporte_integralizado = (payload->>'aporteIntegralizado')::bigint,
    data_entrada = (payload->>'dataEntrada')::date,
    observacao = nullif(trim(coalesce(payload->>'observacao', '')), ''),
    situacao = public.cfg_derivar_situacao_socio(
      data_saida,
      (payload->>'aporteComprometido')::bigint,
      (payload->>'aporteIntegralizado')::bigint
    ),
    usuario_id = case
      when payload ? 'usuarioId' then nullif(payload->>'usuarioId', '')::uuid
      else usuario_id
    end
  where id = p_id
  returning * into novo;

  if antigo.participacao is distinct from novo.participacao then
    descricao := 'Alterou a participação de ' || novo.nome_completo || ' de '
      || trim(to_char(antigo.participacao, 'FM990.0')) || '% para '
      || trim(to_char(novo.participacao, 'FM990.0')) || '%';
    diffs := diffs || jsonb_build_array(jsonb_build_object('campo', 'participacao', 'de', antigo.participacao, 'para', novo.participacao));
  end if;
  if public.cfg_decrypt_text(antigo.cpf_cipher) is distinct from cpf then
    diffs := diffs || jsonb_build_array(jsonb_build_object('campo', 'cpf', 'de', public.cfg_mask_cpf(public.cfg_decrypt_text(antigo.cpf_cipher)), 'para', public.cfg_mask_cpf(cpf)));
    if descricao = '' then descricao := 'Alterou o CPF de ' || novo.nome_completo; end if;
  end if;
  if antigo.email is distinct from novo.email then
    diffs := diffs || jsonb_build_array(jsonb_build_object('campo', 'email', 'de', antigo.email, 'para', novo.email));
    if descricao = '' then descricao := 'Alterou o e-mail de ' || novo.nome_completo; end if;
  end if;
  if antigo.nome_completo is distinct from novo.nome_completo then
    diffs := diffs || jsonb_build_array(jsonb_build_object('campo', 'nomeCompleto', 'de', antigo.nome_completo, 'para', novo.nome_completo));
    if descricao = '' then descricao := 'Alterou o nome de ' || antigo.nome_completo || ' para ' || novo.nome_completo; end if;
  end if;
  if descricao = '' then
    descricao := 'Editou o cadastro de ' || novo.nome_completo;
  end if;
  if diffs <> '[]'::jsonb then
    perform public.cfg_auditar('editar', 'configuracoes', 'socio', novo.id::text, descricao, public.cfg_json_socio(antigo), public.cfg_json_socio(novo));
  end if;
  if antigo.participacao is distinct from novo.participacao then
    perform public.cfg_notificar_socios('Alteração de participação', descricao, jsonb_build_object('socioId', novo.id));
  end if;
  return jsonb_build_object('ok', true, 'socio', public.cfg_json_socio(novo), 'resumo', public.cfg_resumo_socios());
end;
$$;

create or replace function public.cfg_registrar_saida(p_id uuid, payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  antigo public.cfg_socios;
  novo public.cfg_socios;
  saida date;
begin
  if not public.cfg_pode_acessar('configuracoes.socios', 'total') then
    return public.cfg_forbidden();
  end if;
  if public.cfg_precisa_reauth() then
    return jsonb_build_object('ok', false, 'code', 'reauth', 'message', 'Confirme sua senha para continuar.');
  end if;
  select * into antigo from public.cfg_socios where id = p_id and deletado_em is null;
  if antigo is null then
    return jsonb_build_object('ok', false, 'message', 'Sócio não encontrado.');
  end if;
  if antigo.usuario_id is not null and antigo.usuario_id = auth.uid() then
    return jsonb_build_object('ok', false, 'message', 'Ninguém registra a própria saída.');
  end if;
  if antigo.data_saida is null and public.cfg_soma_participacao(antigo.id) = 0 then
    -- soma sem este já é o quadro restante; se não há outros ativos, bloqueia
    if not exists (
      select 1 from public.cfg_socios where deletado_em is null and data_saida is null and id <> p_id
    ) then
      return jsonb_build_object('ok', false, 'message', 'O sistema não pode ficar sem sócio ativo.');
    end if;
  end if;
  saida := coalesce((payload->>'dataSaida')::date, current_date);
  update public.cfg_socios set
    data_saida = saida,
    motivo_saida = nullif(trim(coalesce(payload->>'motivo', '')), ''),
    situacao = 'inativo'
  where id = p_id
  returning * into novo;
  if coalesce((payload->>'suspenderConta')::boolean, true) and novo.usuario_id is not null then
    update public.cfg_usuarios
       set situacao = 'suspenso',
           sessoes_revogadas_em = now()
     where id = novo.usuario_id and situacao = 'ativo';
  end if;
  perform public.cfg_auditar(
    'registrar_saida', 'configuracoes', 'socio', novo.id::text,
    'Registrou a saída de ' || novo.nome_completo,
    public.cfg_json_socio(antigo), public.cfg_json_socio(novo)
  );
  perform public.cfg_notificar_socios('Saída de sócio', 'Saída registrada: ' || novo.nome_completo, jsonb_build_object('socioId', novo.id));
  return jsonb_build_object('ok', true, 'socio', public.cfg_json_socio(novo), 'resumo', public.cfg_resumo_socios());
end;
$$;

create or replace function public.cfg_reverter_saida(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  antigo public.cfg_socios;
  novo public.cfg_socios;
  soma int;
begin
  if not public.cfg_pode_acessar('configuracoes.socios', 'total') then
    return public.cfg_forbidden();
  end if;
  select * into antigo from public.cfg_socios where id = p_id and deletado_em is null;
  if antigo is null or antigo.data_saida is null then
    return jsonb_build_object('ok', false, 'message', 'Sócio não encontrado.');
  end if;
  soma := public.cfg_soma_participacao(null) + round(antigo.participacao * 100)::int;
  if soma > 10000 then
    return jsonb_build_object('ok', false, 'message', 'A reversão ultrapassaria 100% de participação.');
  end if;
  update public.cfg_socios set
    data_saida = null,
    motivo_saida = null,
    situacao = public.cfg_derivar_situacao_socio(null, aporte_comprometido, aporte_integralizado)
  where id = p_id
  returning * into novo;
  perform public.cfg_auditar(
    'reverter_saida', 'configuracoes', 'socio', novo.id::text,
    'Reverteu a saída de ' || novo.nome_completo,
    public.cfg_json_socio(antigo), public.cfg_json_socio(novo)
  );
  perform public.cfg_notificar_socios('Reversão de saída', 'Reverteu a saída de ' || novo.nome_completo, jsonb_build_object('socioId', novo.id));
  return jsonb_build_object('ok', true, 'socio', public.cfg_json_socio(novo), 'resumo', public.cfg_resumo_socios());
end;
$$;

-- DELETE /api/configuracoes/socios/:id  (soft)
create or replace function public.cfg_excluir_socio(p_id uuid, payload jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  antigo public.cfg_socios;
  nome_digitado text;
begin
  if not public.cfg_pode_acessar('configuracoes.socios', 'total') then
    return public.cfg_forbidden();
  end if;
  if public.cfg_precisa_reauth() then
    return jsonb_build_object('ok', false, 'code', 'reauth', 'message', 'Confirme sua senha para continuar.');
  end if;
  select * into antigo from public.cfg_socios where id = p_id and deletado_em is null;
  if antigo is null then
    return jsonb_build_object('ok', false, 'message', 'Sócio não encontrado.');
  end if;
  if antigo.usuario_id is not null and antigo.usuario_id = auth.uid() then
    return jsonb_build_object('ok', false, 'message', 'Ninguém exclui o próprio cadastro.');
  end if;
  if not public.cfg_pode_excluir_socio(antigo) then
    return jsonb_build_object('ok', false, 'message', 'Este sócio tem histórico no sistema e não pode ser excluído. Use "Registrar saída".');
  end if;
  nome_digitado := trim(coalesce(payload->>'confirmacaoNome', ''));
  if nome_digitado <> antigo.nome_completo then
    return jsonb_build_object('ok', false, 'message', 'Digite o nome completo do sócio para confirmar.');
  end if;
  update public.cfg_socios set deletado_em = now() where id = p_id;
  if coalesce((payload->>'desativarConvite')::boolean, false)
     and antigo.usuario_id is not null then
    update public.cfg_usuarios
       set situacao = 'desativado',
           sessoes_revogadas_em = now()
     where id = antigo.usuario_id and situacao = 'convidado';
  end if;
  perform public.cfg_auditar(
    'excluir', 'configuracoes', 'socio', antigo.id::text,
    'Excluiu o cadastro de ' || antigo.nome_completo,
    public.cfg_json_socio(antigo), null
  );
  return jsonb_build_object('ok', true, 'resumo', public.cfg_resumo_socios());
end;
$$;

create or replace function public.cfg_revelar_cpf(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.cfg_socios;
  cpf text;
begin
  if not public.cfg_pode_acessar('configuracoes.socios', 'ler') then
    return public.cfg_forbidden();
  end if;
  select * into s from public.cfg_socios where id = p_id and deletado_em is null;
  if s is null then
    return jsonb_build_object('ok', false, 'message', 'Sócio não encontrado.');
  end if;
  cpf := public.cfg_decrypt_text(s.cpf_cipher);
  perform public.cfg_auditar(
    'editar', 'configuracoes', 'socio', s.id::text,
    'Revelou o CPF de ' || s.nome_completo,
    jsonb_build_object('cpf', public.cfg_mask_cpf(cpf)),
    jsonb_build_object('cpf', 'revelado')
  );
  return jsonb_build_object('ok', true, 'cpf', cpf);
end;
$$;
