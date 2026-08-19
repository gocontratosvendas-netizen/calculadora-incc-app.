-- Passo 2: cria slot do documento em casos já existentes.
insert into public.documentos_caso (id, caso_id, chave, rotulo, obrigatorio)
select
  'doc-' || c.id || '-memoria_revisao_incc',
  c.id,
  'memoria_revisao_incc',
  'Memória de Cálculo Revisão INCC',
  false
from public.casos c
where not exists (
  select 1
  from public.documentos_caso d
  where d.caso_id = c.id and d.chave = 'memoria_revisao_incc'
);
