-- Receita de pró-labore (ajuizamento). Distinta de 4.02.002 (despesa de pessoal).
insert into public.fin_classificacoes (id, codigo, nome, movimentacao, grupo_dre, ordem, ativa, sistema)
values
  ('3.01.005', '3.01.005', 'Pró-labore', 'entrada', 'receita_bruta', 105, true, true)
on conflict (id) do update set
  codigo = excluded.codigo,
  nome = excluded.nome,
  movimentacao = excluded.movimentacao,
  grupo_dre = excluded.grupo_dre,
  ordem = excluded.ordem,
  ativa = true,
  sistema = true;
