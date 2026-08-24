-- Permite anexos avulsos (qualquer arquivo) além dos documentos padrão do caso.
-- chave deixa de ser enum para aceitar identificadores únicos como anexo-<uuid>.
alter table public.documentos_caso
  alter column chave type text using chave::text;

drop type if exists public.documento_chave;
