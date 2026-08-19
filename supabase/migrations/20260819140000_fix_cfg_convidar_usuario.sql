-- Corrige ambiguidade entre variável PL/pgSQL "email" e coluna cfg_usuarios.email.
create or replace function public.cfg_convidar_usuario(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
  v_nome text;
  v_papel text;
  existente public.cfg_usuarios;
  uid uuid;
begin
  if not public.cfg_pode_acessar('configuracoes.usuarios', 'total') then
    return public.cfg_forbidden();
  end if;
  v_nome := trim(coalesce(payload->>'nome', ''));
  v_email := lower(trim(coalesce(payload->>'email', '')));
  v_papel := coalesce(payload->>'papelId', '');
  if char_length(v_nome) < 3 then
    return jsonb_build_object('ok', false, 'errors', jsonb_build_object('nome', 'Informe o nome.'));
  end if;
  if position('@' in v_email) = 0 then
    return jsonb_build_object('ok', false, 'errors', jsonb_build_object('email', 'E-mail inválido.'));
  end if;
  if not exists (select 1 from public.cfg_papeis where id = v_papel) then
    return jsonb_build_object('ok', false, 'errors', jsonb_build_object('papelId', 'Papel inexistente.'));
  end if;
  select * into existente
    from public.cfg_usuarios u
   where lower(u.email) = v_email
     and u.situacao = 'desativado'
   limit 1;
  if existente is not null then
    return jsonb_build_object(
      'ok', false,
      'code', 'desativado',
      'message', 'Este e-mail pertence a uma conta desativada. Ofereça um novo convite (novo registro).'
    );
  end if;
  if exists (
    select 1
      from public.cfg_usuarios u
     where lower(u.email) = v_email
       and u.situacao <> 'desativado'
  ) then
    return jsonb_build_object('ok', false, 'errors', jsonb_build_object('email', 'E-mail já cadastrado.'));
  end if;
  uid := public.cfg_convidar_interno(v_nome, v_email, v_papel, auth.uid());
  select * into existente from public.cfg_usuarios where id = uid;
  return jsonb_build_object('ok', true, 'usuario', public.cfg_json_usuario(existente));
end;
$$;

-- Convite administrativo (service_role / scripts).
create or replace function public.cfg_convidar_usuario_admin(
  p_nome text,
  p_email text,
  p_papel text default 'socio'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(p_email));
  v_nome text := trim(p_nome);
  u public.cfg_usuarios;
  uid uuid;
  raw text;
  v_link text;
begin
  if char_length(v_nome) < 3 then
    return jsonb_build_object('ok', false, 'message', 'Nome inválido.');
  end if;
  if position('@' in v_email) = 0 then
    return jsonb_build_object('ok', false, 'message', 'E-mail inválido.');
  end if;
  if not exists (select 1 from public.cfg_papeis where id = p_papel) then
    return jsonb_build_object('ok', false, 'message', 'Papel inexistente.');
  end if;

  select * into u from public.cfg_usuarios where lower(email) = v_email limit 1;

  if u is not null and u.situacao = 'desativado' then
    return jsonb_build_object('ok', false, 'message', 'E-mail desativado.');
  end if;
  if u is not null and u.situacao = 'ativo' then
    return jsonb_build_object('ok', false, 'message', 'Usuário já ativo.', 'email', v_email);
  end if;
  if u is not null and u.situacao = 'suspenso' then
    return jsonb_build_object('ok', false, 'message', 'Usuário suspenso.');
  end if;

  if u is not null and u.situacao = 'convidado' then
    raw := public.cfg_emitir_token(u.id, 'convite');
    v_link := public.cfg_app_url() || '/convite/' || raw;
    perform public.cfg_enfileirar_email(
      'convite',
      v_email,
      'Novo convite para o VERUM',
      'Use o novo link para definir sua senha.',
      jsonb_build_object('token', raw, 'link', v_link, 'nome', u.nome, 'papel', p_papel)
    );
    return jsonb_build_object('ok', true, 'usuarioId', u.id, 'link', v_link, 'reenviado', true);
  end if;

  uid := public.cfg_convidar_interno(
    v_nome,
    v_email,
    p_papel,
    '00000000-0000-0000-0000-000000000000'::uuid
  );

  select payload->>'link'
    into v_link
    from public.cfg_emails_fila
   where destinatario = v_email
     and tipo = 'convite'
   order by criado_em desc
   limit 1;

  return jsonb_build_object('ok', true, 'usuarioId', uid, 'link', v_link, 'reenviado', false);
end;
$$;

grant execute on function public.cfg_convidar_usuario_admin(text, text, text) to service_role;
