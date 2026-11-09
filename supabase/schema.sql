-- FreeFork: схема облака. Выполните целиком в Supabase → SQL Editor → New query → Run.
-- Одна строка на пользователя: весь дневник хранится как JSON. Доступ — только к своей строке.

create table if not exists public.user_data (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  data       jsonb       not null,
  updated_at timestamptz not null default now()
);

alter table public.user_data enable row level security;

drop policy if exists "own select" on public.user_data;
drop policy if exists "own insert" on public.user_data;
drop policy if exists "own update" on public.user_data;
drop policy if exists "own delete" on public.user_data;

create policy "own select" on public.user_data for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "own insert" on public.user_data for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "own update" on public.user_data for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own delete" on public.user_data for delete to authenticated
  using ((select auth.uid()) = user_id);

-- Кнопка «Удалить аккаунт» в приложении: пользователь может удалить только самого себя.
create or replace function public.delete_my_account()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from auth.users where id = (select auth.uid());
$$;

revoke execute on function public.delete_my_account() from public, anon;
grant  execute on function public.delete_my_account() to authenticated;
