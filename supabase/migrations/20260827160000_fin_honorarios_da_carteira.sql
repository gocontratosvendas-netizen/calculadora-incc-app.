-- Leitura agregada de pró-labore e honorários de êxito por caso, para a
-- tabela da carteira. Qualquer autenticado que vê os casos precisa do
-- status, sem acesso pleno ao módulo financeiro.
create or replace function public.fin_honorarios_da_carteira()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Não autenticado' using errcode = '28000';
  end if;

  return jsonb_build_object(
    'ok', true,
    'itens', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'casoId', caso_id,
          'proLaborePago', "proLaborePago",
          'proLaborePendente', "proLaborePendente",
          'exitoPago', "exitoPago",
          'exitoPendente', "exitoPendente"
        )
      )
      from (
        select
          caso_id,
          coalesce(sum(valor) filter (
            where classificacao_id = '3.01.005' and data_pagamento is not null
          ), 0) as "proLaborePago",
          coalesce(sum(valor) filter (
            where classificacao_id = '3.01.005' and data_pagamento is null
          ), 0) as "proLaborePendente",
          coalesce(sum(valor) filter (
            where classificacao_id = '3.01.002' and data_pagamento is not null
          ), 0) as "exitoPago",
          coalesce(sum(valor) filter (
            where classificacao_id = '3.01.002' and data_pagamento is null
          ), 0) as "exitoPendente"
        from public.fin_lancamentos
        where deletado_em is null
          and movimentacao = 'entrada'
          and caso_id is not null
          and classificacao_id in ('3.01.005', '3.01.002')
        group by caso_id
      ) agregado
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.fin_honorarios_da_carteira() from public;
grant execute on function public.fin_honorarios_da_carteira() to authenticated;
