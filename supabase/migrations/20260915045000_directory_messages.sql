create table public.directory_messages (
 id uuid primary key default gen_random_uuid(),
 shop_id uuid not null references public.directory_shops(id) on delete cascade,
 sender_id uuid not null references auth.users(id) on delete cascade,
 kind text not null check(kind in ('quote','report')),
 body text not null check(length(body) between 10 and 3000),
 email text not null check(length(email) between 3 and 254),
 created_at timestamptz not null default now()
);
alter table public.directory_messages enable row level security;
revoke all on public.directory_messages from anon,authenticated;
grant select,insert on public.directory_messages to authenticated;
create index directory_messages_shop_idx on public.directory_messages(shop_id);
create index directory_messages_sender_idx on public.directory_messages(sender_id);
create policy messages_read on public.directory_messages for select to authenticated using (
 sender_id=(select auth.uid()) or public.shop_is_admin() or (kind='quote' and exists(select 1 from public.directory_shops s where s.id=shop_id and s.owner_id=(select auth.uid())))
);
create policy messages_send on public.directory_messages for insert to authenticated with check (
 sender_id=(select auth.uid()) and exists(select 1 from public.directory_shops s where s.id=shop_id and s.status='approved')
);
