-- Status intermediário entre processo de venda e ajuizamento.
alter type public.caso_status add value if not exists 'confeccao_de_peticao_inicial' after 'processo_de_venda';
