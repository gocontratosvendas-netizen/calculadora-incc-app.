-- Clientes ainda aguardando para entrar com o processo.
alter type public.caso_status add value if not exists 'stand_by' before 'processo_de_venda';
