-- Desativa temporariamente o bloqueio de Configurações por 2FA.
create or replace function public.cfg_2fa_bloqueia(u public.cfg_usuarios, p_recurso text)
returns boolean
language sql
stable
as $$
  select false;
$$;

update public.cfg_usuarios
   set dois_fatores_desde = null
 where papel_id = 'socio'
   and coalesce(dois_fatores_ativo, false) = false
   and dois_fatores_desde is not null;
