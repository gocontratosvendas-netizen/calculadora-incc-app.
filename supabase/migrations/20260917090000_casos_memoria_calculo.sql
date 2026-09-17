-- Memória de cálculo persistida no cadastro do caso (auditoria financeira).

alter table public.casos
  add column if not exists memoria_calculo jsonb;

comment on column public.casos.memoria_calculo is
  'Lançamentos e parâmetros da calculadora usados para montar a auditoria financeira do caso.';
