create or replace function public.save_directory_shop(shop_id uuid,shop_name text,shop_data jsonb,contact_email text) returns uuid language plpgsql security invoker set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Sign in to save your shop'; end if;
 insert into public.directory_shops(id,owner_id,name,data) values(shop_id,auth.uid(),shop_name,shop_data)
 on conflict(id) do update set name=excluded.name,data=excluded.data where directory_shops.owner_id=auth.uid();
 if not found then raise exception 'You cannot edit this listing'; end if;
 insert into public.directory_contacts(shop_id,email) values(shop_id,contact_email) on conflict on constraint directory_contacts_pkey do update set email=excluded.email;
 return shop_id;
end; $$;
