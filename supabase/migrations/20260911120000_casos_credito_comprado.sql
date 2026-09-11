-- Flag de cessão/compra do crédito: o escritório fica com o êxito e com a diferença do valor da causa.
alter table public.casos
  add column if not exists credito_comprado boolean not null default false;
