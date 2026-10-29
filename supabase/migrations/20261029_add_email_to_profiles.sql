-- 1. Add email column to profiles table if not exists
alter table profiles add column if not exists email text;

-- 2. Backfill existing profile emails from auth.users
update profiles p
set email = u.email
from auth.users u
where u.id = p.id;

-- 3. Function to automatically create a profile when a new auth user signs up
create or replace function handle_new_user() returns trigger
language plpgsql security definer as $$
begin
  insert into profiles(id, name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', new.email),
    new.email,
    coalesce(new.raw_user_meta_data->>'role', 'teammate')
  )
  on conflict (id) do update set
    email = excluded.email,
    name = coalesce(profiles.name, excluded.name);
  return new;
end $$;

-- 4. Trigger on auth.users to execute handle_new_user on sign up
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
