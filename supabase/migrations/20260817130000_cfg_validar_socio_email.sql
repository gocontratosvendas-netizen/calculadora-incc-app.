-- cfg_validar_socio_payload declara a variável "email" e consulta cfg_socios.email
-- sem alias: Postgres acusa "column reference email is ambiguous".

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
