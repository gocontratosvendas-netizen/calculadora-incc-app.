-- Percentual de êxito do caso (10, 20, 30…) e consulta de pró-labore vinculado.
alter table public.casos
  add column if not exists percentual_exito numeric(5, 2) not null default 30;

alter table public.casos
  drop constraint if exists casos_percentual_exito_check;

alter table public.casos
  add constraint casos_percentual_exito_check
  check (percentual_exito >= 0 and percentual_exito <= 100);

create index if not exists fin_lancamentos_caso_id_idx
  on public.fin_lancamentos (caso_id)
  where deletado_em is null and caso_id is not null;

-- Leitura agregada para a ficha do caso. Qualquer autenticado que vê o caso
-- precisa do status do pró-labore, sem acesso pleno ao módulo financeiro.
create or replace function public.fin_pro_labore_do_caso(p_caso_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  pago bigint := 0;
  pendente bigint := 0;
begin
  if auth.uid() is null then
    raise exception 'Não autenticado' using errcode = '28000';
  end if;

  if p_caso_id is null or trim(p_caso_id) = '' then
    return jsonb_build_object('ok', true, 'valorPago', 0, 'valorPendente', 0);
  end if;

  select
    coalesce(sum(valor) filter (where data_pagamento is not null), 0),
    coalesce(sum(valor) filter (where data_pagamento is null), 0)
  into pago, pendente
  from public.fin_lancamentos
  where caso_id = p_caso_id
    and deletado_em is null
    and movimentacao = 'entrada'
    and classificacao_id = '3.01.005';

  return jsonb_build_object(
    'ok', true,
    'valorPago', pago,
    'valorPendente', pendente
  );
end;
$$;

revoke all on function public.fin_pro_labore_do_caso(text) from public;
grant execute on function public.fin_pro_labore_do_caso(text) to authenticated;
