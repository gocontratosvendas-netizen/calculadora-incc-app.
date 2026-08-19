-- Corrige busca por e-mail em cfg_convidar_usuario_admin (ambiguidade de "email").
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
  v_papel_nome text;
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

  select * into u
    from public.cfg_usuarios usr
   where lower(usr.email) = v_email
   limit 1;

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
    select nome into v_papel_nome from public.cfg_papeis where id = p_papel;
    perform public.cfg_enfileirar_email(
      'convite',
      v_email,
      'Novo convite para o VERUM',
      'Use o novo link para definir sua senha.',
      jsonb_build_object('token', raw, 'link', v_link, 'nome', u.nome, 'papel', coalesce(v_papel_nome, p_papel))
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
