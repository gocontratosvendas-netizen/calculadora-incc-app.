-- Quem já existia em auth/profiles antes do módulo Configurações não ganhou
-- linha em cfg_usuarios. Sem isso, o menu aparece (fallback de sócio) e a
-- página responde 403. Garante o cadastro na sessão e preenche os existentes.

create or replace function public.cfg_garantir_usuario()
returns public.cfg_usuarios
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  uid uuid := auth.uid();
  u public.cfg_usuarios;
  p public.profiles;
  mail text;
  papel text;
begin
  if uid is null then
    return null;
  end if;

  select * into u from public.cfg_usuarios where id = uid;
  if found then
    if u.situacao = 'convidado' then
      update public.cfg_usuarios
         set situacao = 'ativo',
             ja_logou = true,
             ultimo_acesso = now(),
             atualizado_em = now()
       where id = uid
       returning * into u;
    end if;
    return u;
  end if;

  select * into p from public.profiles where id = uid;
  select email into mail from auth.users where id = uid;
  papel := case when p.papel = 'socio' then 'socio' else 'operacao' end;

  insert into public.cfg_usuarios (
    id, nome, email, papel_id, situacao,
    dois_fatores_desde, ultima_reauth_em, ja_logou, ultimo_acesso
  ) values (
    uid,
    coalesce(nullif(trim(p.nome), ''), split_part(coalesce(mail, uid::text), '@', 1)),
    lower(coalesce(mail, uid::text || '@local')),
    papel,
    'ativo',
    case when papel = 'socio' then now() else null end,
    now(),
    true,
    now()
  )
  on conflict (id) do nothing;

  select * into u from public.cfg_usuarios where id = uid;
  return u;
end;
$$;

create or replace function public.cfg_sessao_atual()
returns jsonb
language plpgsql
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
  u := public.cfg_garantir_usuario();
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
  u := public.cfg_garantir_usuario();
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

create or replace function public.cfg_pode_acessar(p_recurso text, p_nivel text)
returns boolean
language plpgsql
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
  u := public.cfg_garantir_usuario();
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

insert into public.cfg_usuarios (
  id, nome, email, papel_id, situacao, dois_fatores_desde, ja_logou, ultimo_acesso
)
select
  p.id,
  coalesce(nullif(trim(p.nome), ''), split_part(au.email, '@', 1)),
  lower(au.email),
  case when p.papel = 'socio' then 'socio' else 'operacao' end,
  'ativo',
  case when p.papel = 'socio' then now() else null end,
  true,
  now()
from public.profiles p
join auth.users au on au.id = p.id
on conflict (id) do nothing;

notify pgrst, 'reload schema';
