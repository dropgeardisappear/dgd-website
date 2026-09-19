-- Shop Finder is separate from merchandise products and checkout.
create table public.directory_shops (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id),
 name text not null check(length(trim(name)) between 1 and 150),
 data jsonb not null check(jsonb_typeof(data)='object' and octet_length(data::text)<20000 and not (data ? 'email')),
 status text not null default 'pending' check(status in ('pending','approved','rejected')),
 plan text not null default 'free' check(plan in ('free','pro','exclusive')), created_at timestamptz not null default now()
);
create index directory_shops_owner on public.directory_shops(owner_id);
create index directory_shops_status on public.directory_shops(status);
create table public.directory_contacts(shop_id uuid primary key references public.directory_shops(id) on delete cascade,email text not null check(length(email)<320));
alter table public.directory_shops enable row level security;
alter table public.directory_contacts enable row level security;
revoke all on public.directory_shops,public.directory_contacts from anon,authenticated;
grant select on public.directory_shops to anon,authenticated;
grant insert(id,owner_id,name,data),update(name,data,status) on public.directory_shops to authenticated;
grant select,insert,update on public.directory_contacts to authenticated;
grant all on public.directory_shops,public.directory_contacts to service_role;
create policy directory_public on public.directory_shops for select to anon,authenticated using(status='approved');
create policy directory_owner_read on public.directory_shops for select to authenticated using(owner_id=(select auth.uid()) or (select public.shop_is_admin()));
create policy directory_owner_insert on public.directory_shops for insert to authenticated with check(owner_id=(select auth.uid()) and status='pending' and plan='free');
create policy directory_owner_update on public.directory_shops for update to authenticated using(owner_id=(select auth.uid()) or (select public.shop_is_admin())) with check(owner_id=(select auth.uid()) or (select public.shop_is_admin()));
create policy directory_contact_read on public.directory_contacts for select to authenticated using(exists(select 1 from public.directory_shops s where s.id=shop_id and (s.owner_id=(select auth.uid()) or (select public.shop_is_admin()))));
create policy directory_contact_insert on public.directory_contacts for insert to authenticated with check(exists(select 1 from public.directory_shops s where s.id=shop_id and s.owner_id=(select auth.uid())));
create policy directory_contact_update on public.directory_contacts for update to authenticated using(exists(select 1 from public.directory_shops s where s.id=shop_id and s.owner_id=(select auth.uid()))) with check(exists(select 1 from public.directory_shops s where s.id=shop_id and s.owner_id=(select auth.uid())));
create function public.directory_protect_review() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.owner_id<>old.owner_id or new.plan<>old.plan then raise exception 'Owner and membership cannot be changed here'; end if;
 if new.name is distinct from old.name or new.data is distinct from old.data then new.status:='pending';
 elsif new.status is distinct from old.status and not public.shop_is_admin() then raise exception 'DGD review access required'; end if;
 return new;
end; $$;
create trigger directory_review_guard before update on public.directory_shops for each row execute function public.directory_protect_review();
create function public.save_directory_shop(shop_id uuid,shop_name text,shop_data jsonb,contact_email text) returns uuid language plpgsql security invoker set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Sign in to save your shop'; end if;
 insert into public.directory_shops(id,owner_id,name,data) values(shop_id,auth.uid(),shop_name,shop_data)
 on conflict(id) do update set name=excluded.name,data=excluded.data where directory_shops.owner_id=auth.uid();
 if not found then raise exception 'You cannot edit this listing'; end if;
 insert into public.directory_contacts(shop_id,email) values(shop_id,contact_email) on conflict(shop_id) do update set email=excluded.email;
 return shop_id;
end; $$;
revoke all on function public.save_directory_shop(uuid,text,jsonb,text) from public,anon;
grant execute on function public.save_directory_shop(uuid,text,jsonb,text) to authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('directory-logos','directory-logos',true,3145728,array['image/png','image/jpeg','image/webp']);
create policy directory_logo_insert on storage.objects for insert to authenticated with check(bucket_id='directory-logos' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy directory_logo_owner_read on storage.objects for select to authenticated using(bucket_id='directory-logos' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy directory_logo_owner_delete on storage.objects for delete to authenticated using(bucket_id='directory-logos' and (storage.foldername(name))[1]=(select auth.uid())::text);
