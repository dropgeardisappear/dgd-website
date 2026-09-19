alter table public.directory_shops add column verified boolean not null default false;
grant update(verified) on public.directory_shops to authenticated;
create function public.directory_verify_guard() returns trigger language plpgsql security invoker set search_path='' as $$ begin
 if new.verified is distinct from old.verified and not public.shop_is_admin() then raise exception 'DGD verification access required'; end if;
 if new.name is distinct from old.name or new.data is distinct from old.data then new.verified=false; end if;
 return new;
end $$;
create trigger directory_verification_guard before update on public.directory_shops for each row execute function public.directory_verify_guard();
create table public.directory_usage (bucket text primary key, hits integer not null, expires_at timestamptz not null);
alter table public.directory_usage enable row level security;
revoke all on public.directory_usage from public,anon,authenticated;
grant all on public.directory_usage to service_role;
create function public.directory_take_usage(bucket_key text, maximum integer, expiry timestamptz) returns boolean language plpgsql security invoker set search_path='' as $$
declare count_now integer;
begin
 delete from public.directory_usage where expires_at<now();
 insert into public.directory_usage(bucket,hits,expires_at) values(bucket_key,1,expiry)
 on conflict(bucket) do update set hits=directory_usage.hits+1 where directory_usage.hits<maximum returning hits into count_now;
 return count_now is not null;
end $$;
revoke all on function public.directory_take_usage(text,integer,timestamptz) from public,anon,authenticated;
grant execute on function public.directory_take_usage(text,integer,timestamptz) to service_role;
