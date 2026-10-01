-- Optional cloud backup for Track Daily. Run once in the Supabase SQL editor.
-- Each signed-in user can read and write only their own single backup row.
create table if not exists track_daily_backups (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table track_daily_backups enable row level security;

drop policy if exists "Users manage their own backup" on track_daily_backups;
create policy "Users manage their own backup"
  on track_daily_backups for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
