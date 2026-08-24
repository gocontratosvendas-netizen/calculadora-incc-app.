-- Contrato de compra e venda passa a ser documento obrigatório do caso.
update public.documentos_caso
set obrigatorio = true
where chave = 'contrato';
