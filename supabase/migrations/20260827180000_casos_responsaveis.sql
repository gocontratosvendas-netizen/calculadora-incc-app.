-- Vários responsáveis por caso. O responsavel_id do caso continua sendo o principal.
create table if not exists public.casos_responsaveis (
  caso_id text not null references public.casos (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  ordem smallint not null default 0,
  criado_em timestamptz not null default now(),
  primary key (caso_id, profile_id)
);

create index if not exists casos_responsaveis_profile_id_idx
  on public.casos_responsaveis (profile_id);

alter table public.casos_responsaveis enable row level security;

drop policy if exists casos_responsaveis_all on public.casos_responsaveis;
create policy casos_responsaveis_all on public.casos_responsaveis
  for all to authenticated using (true) with check (true);

insert into public.casos_responsaveis (caso_id, profile_id, ordem)
select id, responsavel_id, 0
from public.casos
on conflict (caso_id, profile_id) do nothing;

-- Novos casos herdam o responsável principal na lista.
create or replace function public.casos_sync_responsavel_principal()
returns trigger
language plpgsql
as $$
begin
  insert into public.casos_responsaveis (caso_id, profile_id, ordem)
  values (new.id, new.responsavel_id, 0)
  on conflict (caso_id, profile_id) do nothing;
  return new;
end;
$$;

drop trigger if exists casos_sync_responsavel_principal on public.casos;
create trigger casos_sync_responsavel_principal
  after insert on public.casos
  for each row
  execute function public.casos_sync_responsavel_principal();
