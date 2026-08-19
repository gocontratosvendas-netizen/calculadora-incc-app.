-- Passo 1: novo valor no enum (deve rodar em transação separada do backfill).
alter type public.documento_chave add value if not exists 'memoria_revisao_incc';
