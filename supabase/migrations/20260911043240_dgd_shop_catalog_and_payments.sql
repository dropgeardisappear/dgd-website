-- DGD merchandise. Additive: community tables and policies are unchanged.
-- Shop access uses its own protected membership, not editable profile fields.
create table public.shop_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.shop_admins enable row level security;
revoke all on public.shop_admins from anon, authenticated;
grant select on public.shop_admins to authenticated;
create policy shop_admin_self on public.shop_admins for select to authenticated using (user_id = (select auth.uid()));

-- Bootstrap the existing administrators once; future profile edits grant no shop access.
insert into public.shop_admins(user_id) select id from public.profiles where is_admin = true;

create function public.shop_is_admin() returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.shop_admins where user_id = auth.uid());
$$;
revoke all on function public.shop_is_admin() from public, anon;
grant execute on function public.shop_is_admin() to authenticated, service_role;

create table public.shop_products (
  id uuid primary key default gen_random_uuid(),
  handle text not null unique check (handle ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(handle) <= 120),
  title text not null check (length(trim(title)) between 1 and 160),
  description text not null default '' check (length(description) <= 10000),
  category text not null default 'Goods' check (length(category) <= 80),
  status text not null default 'draft' check (status in ('draft','active','archived')),
  price_cents integer check (price_cents between 50 and 99999999),
  stock_quantity integer not null default 0 check (stock_quantity between 0 and 1000000),
  reserved_quantity integer not null default 0 check (reserved_quantity >= 0 and reserved_quantity <= stock_quantity),
  sku text not null default '' check (length(sku) <= 80),
  dimensions text not null default '' check (length(dimensions) <= 300),
  material text not null default '' check (length(material) <= 300),
  finish text not null default '' check (length(finish) <= 300),
  application_care text not null default '' check (length(application_care) <= 3000),
  weight_grams integer check (weight_grams between 1 and 100000),
  images jsonb not null default '[]'::jsonb check (jsonb_typeof(images) = 'array' and jsonb_array_length(images) <= 10),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status <> 'active' or (price_cents is not null and weight_grams is not null and jsonb_array_length(images) > 0))
);
alter table public.shop_products enable row level security;
revoke all on public.shop_products from anon, authenticated;
grant select on public.shop_products to anon, authenticated;
grant insert(handle,title,description,category,status,price_cents,stock_quantity,sku,dimensions,material,finish,application_care,weight_grams,images),
  update(handle,title,description,category,status,price_cents,stock_quantity,sku,dimensions,material,finish,application_care,weight_grams,images)
  on public.shop_products to authenticated;
create policy shop_catalog_public on public.shop_products for select to anon, authenticated using (status = 'active');
create policy shop_products_owner_read on public.shop_products for select to authenticated using ((select public.shop_is_admin()));
create policy shop_products_owner_insert on public.shop_products for insert to authenticated with check ((select public.shop_is_admin()));
create policy shop_products_owner_update on public.shop_products for update to authenticated using ((select public.shop_is_admin())) with check ((select public.shop_is_admin()));
create index shop_products_catalog_idx on public.shop_products(status, created_at desc, id);

create function public.shop_touch_updated_at() returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = clock_timestamp(); return new; end;
$$;
revoke all on function public.shop_touch_updated_at() from public;
create trigger shop_products_updated before update on public.shop_products for each row execute function public.shop_touch_updated_at();

create table public.shop_settings (
  id integer primary key default 1 check (id = 1),
  store_open boolean not null default false,
  support_email text not null default '' check (length(support_email) <= 254),
  shipping_flat_cents integer check (shipping_flat_cents between 0 and 100000),
  free_shipping_over_cents integer check (free_shipping_over_cents between 0 and 99999999),
  shipping_countries text[] not null default array['US']::text[] check (cardinality(shipping_countries) between 1 and 30),
  tax_mode text not null default 'unconfigured' check (tax_mode in ('unconfigured','stripe_tax','no_tax')),
  shipping_policy text not null default '' check (length(shipping_policy) <= 10000),
  refund_policy text not null default '' check (length(refund_policy) <= 10000),
  updated_at timestamptz not null default now(),
  check (not store_open or (support_email ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' and shipping_flat_cents is not null and tax_mode <> 'unconfigured' and length(trim(shipping_policy)) > 0 and length(trim(refund_policy)) > 0))
);
insert into public.shop_settings(id) values (1);
alter table public.shop_settings enable row level security;
revoke all on public.shop_settings from anon, authenticated;
grant select on public.shop_settings to anon, authenticated;
grant update(store_open,support_email,shipping_flat_cents,free_shipping_over_cents,shipping_countries,tax_mode,shipping_policy,refund_policy) on public.shop_settings to authenticated;
create policy shop_settings_public on public.shop_settings for select to anon, authenticated using (true);
create policy shop_settings_owner_update on public.shop_settings for update to authenticated using ((select public.shop_is_admin())) with check ((select public.shop_is_admin()));
create trigger shop_settings_updated before update on public.shop_settings for each row execute function public.shop_touch_updated_at();

create table public.shop_orders (
  id uuid primary key default gen_random_uuid(),
  order_number bigint generated always as identity unique,
  cart_key uuid not null,
  stripe_session_id text not null unique check (stripe_session_id like 'cs_%'),
  stripe_payment_intent text unique,
  livemode boolean not null,
  status text not null default 'pending' check (status in ('pending','paid','expired','failed')),
  fulfillment_status text not null default 'unfulfilled' check (fulfillment_status in ('unfulfilled','shipped')),
  subtotal_cents integer not null check (subtotal_cents >= 50),
  shipping_cents integer not null check (shipping_cents >= 0),
  tax_cents integer not null default 0 check (tax_cents >= 0),
  total_cents integer check (total_cents >= 0),
  refunded_cents integer not null default 0 check (refunded_cents >= 0),
  currency text not null default 'usd' check (currency = 'usd'),
  customer_email text,
  customer_name text,
  shipping_address jsonb,
  tracking_number text not null default '' check (length(tracking_number) <= 200),
  carrier text not null default '' check (length(carrier) <= 100),
  client_hash text not null check (length(client_hash) = 64),
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  notification_sent_at timestamptz,
  shipped_at timestamptz,
  unique(cart_key, livemode)
);
create table public.shop_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.shop_orders(id) on delete cascade,
  product_id uuid not null references public.shop_products(id),
  title text not null,
  sku text not null,
  unit_price_cents integer not null check (unit_price_cents >= 50),
  quantity integer not null check (quantity between 1 and 99),
  unique(order_id, product_id)
);
alter table public.shop_orders enable row level security;
alter table public.shop_order_items enable row level security;
revoke all on public.shop_orders, public.shop_order_items from anon, authenticated;
grant select on public.shop_orders, public.shop_order_items to authenticated;
create policy shop_orders_owner_read on public.shop_orders for select to authenticated using ((select public.shop_is_admin()));
create policy shop_order_items_owner_read on public.shop_order_items for select to authenticated using ((select public.shop_is_admin()));
create index shop_orders_pending_idx on public.shop_orders(created_at) where status = 'pending';
create index shop_orders_client_idx on public.shop_orders(client_hash, created_at);
create index shop_order_items_product_idx on public.shop_order_items(product_id);
grant all on public.shop_admins, public.shop_products, public.shop_settings, public.shop_orders, public.shop_order_items to service_role;
grant usage, select on sequence public.shop_orders_order_number_seq to service_role;

-- Called only by the payment server, after creating a Checkout Session and
-- before its URL is sent to the buyer. Locks prevent concurrent overselling.
create function public.shop_reserve_order(p_cart_key uuid, p_items jsonb, p_session_id text, p_livemode boolean, p_client_hash text, p_shipping_cents integer, p_tax_mode text)
returns public.shop_orders language plpgsql security definer set search_path = '' as $$
declare
  v_order public.shop_orders; v_product public.shop_products; v_settings public.shop_settings;
  v_item jsonb; v_subtotal bigint := 0; v_quantity integer; v_shipping integer;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Payment server access required.'; end if;
  if p_cart_key is null or p_livemode is null or p_client_hash is null or length(p_client_hash) <> 64 or p_session_id not like 'cs_%' then raise exception 'Invalid checkout.'; end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) not between 1 and 30 then raise exception 'Invalid cart.'; end if;
  if (select count(distinct value->>'product_id') from jsonb_array_elements(p_items)) <> jsonb_array_length(p_items) then raise exception 'Duplicate cart items.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_cart_key::text || p_livemode::text, 0));
  select * into v_order from public.shop_orders where cart_key=p_cart_key and livemode=p_livemode;
  if found then return v_order; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_client_hash, 1));
  if (select count(*) from public.shop_orders where client_hash=p_client_hash and created_at > now()-interval '10 minutes') >= 10 then raise exception 'Too many checkout attempts. Please wait a few minutes.'; end if;
  select * into v_settings from public.shop_settings where id=1;
  if not found or not v_settings.store_open or v_settings.tax_mode is distinct from p_tax_mode then raise exception 'The shop is not ready for checkout.'; end if;
  for v_item in select value from jsonb_array_elements(p_items) order by value->>'product_id' loop
    if jsonb_typeof(v_item->'quantity') <> 'number' or (v_item->>'quantity') !~ '^[1-9][0-9]?$' then raise exception 'Invalid quantity.'; end if;
    v_quantity := (v_item->>'quantity')::integer;
    select * into v_product from public.shop_products where id=(v_item->>'product_id')::uuid for update;
    if not found or v_product.status <> 'active' then raise exception 'An item is no longer available.'; end if;
    if v_product.price_cents is distinct from (v_item->>'unit_price_cents')::integer then raise exception 'An item price changed. Refresh your cart.'; end if;
    if v_product.stock_quantity-v_product.reserved_quantity < v_quantity then raise exception 'An item no longer has enough stock. Update your cart.'; end if;
    v_subtotal := v_subtotal + v_product.price_cents::bigint*v_quantity;
  end loop;
  if v_subtotal > 99999999 then raise exception 'This order is too large.'; end if;
  v_shipping := case when v_settings.free_shipping_over_cents is not null and v_subtotal >= v_settings.free_shipping_over_cents then 0 else v_settings.shipping_flat_cents end;
  if v_shipping is null or v_shipping is distinct from p_shipping_cents then raise exception 'Shipping changed. Refresh your cart.'; end if;
  insert into public.shop_orders(cart_key,stripe_session_id,livemode,subtotal_cents,shipping_cents,client_hash)
    values(p_cart_key,p_session_id,p_livemode,v_subtotal,v_shipping,p_client_hash) returning * into v_order;
  for v_item in select value from jsonb_array_elements(p_items) order by value->>'product_id' loop
    select * into v_product from public.shop_products where id=(v_item->>'product_id')::uuid;
    v_quantity := (v_item->>'quantity')::integer;
    insert into public.shop_order_items(order_id,product_id,title,sku,unit_price_cents,quantity)
      values(v_order.id,v_product.id,v_product.title,v_product.sku,v_product.price_cents,v_quantity);
    if p_livemode then update public.shop_products set reserved_quantity=reserved_quantity+v_quantity where id=v_product.id; end if;
  end loop;
  return v_order;
end;
$$;
revoke all on function public.shop_reserve_order(uuid,jsonb,text,boolean,text,integer,text) from public, anon, authenticated;
grant execute on function public.shop_reserve_order(uuid,jsonb,text,boolean,text,integer,text) to service_role;

-- The payment server verifies the Stripe signature and retrieves the current
-- Session before calling this. Duplicate events never deduct inventory twice.
create function public.shop_settle_order(p_session_id text, p_state text, p_livemode boolean, p_payment_intent text default null, p_subtotal integer default null, p_shipping integer default null, p_tax integer default null, p_total integer default null, p_email text default null, p_name text default null, p_address jsonb default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_order public.shop_orders; v_item public.shop_order_items;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Payment server access required.'; end if;
  if p_state not in ('paid','expired','failed') then raise exception 'Invalid payment state.'; end if;
  select * into v_order from public.shop_orders where stripe_session_id=p_session_id for update;
  if not found then return null; end if;
  if v_order.livemode is distinct from p_livemode then raise exception 'Payment environment mismatch.'; end if;
  if v_order.status <> 'pending' then
    if p_state='paid' and v_order.status<>'paid' then raise exception 'Payment needs manual review.'; end if;
    return v_order.id;
  end if;
  if p_state='paid' and (p_subtotal is distinct from v_order.subtotal_cents or p_shipping is distinct from v_order.shipping_cents or p_tax is null or p_tax<0 or p_total is distinct from (p_subtotal+p_shipping+p_tax) or p_payment_intent is null) then raise exception 'Payment totals do not match the order.'; end if;
  for v_item in select * from public.shop_order_items where order_id=v_order.id order by product_id loop
    if v_order.livemode then
      update public.shop_products set reserved_quantity=reserved_quantity-v_item.quantity,
        stock_quantity=stock_quantity-case when p_state='paid' then v_item.quantity else 0 end where id=v_item.product_id;
    end if;
  end loop;
  update public.shop_orders set status=p_state, stripe_payment_intent=p_payment_intent,
    tax_cents=coalesce(p_tax,0), total_cents=p_total, customer_email=p_email, customer_name=p_name,
    shipping_address=p_address, paid_at=case when p_state='paid' then now() else null end where id=v_order.id;
  return v_order.id;
end;
$$;
revoke all on function public.shop_settle_order(text,text,boolean,text,integer,integer,integer,integer,text,text,jsonb) from public, anon, authenticated;
grant execute on function public.shop_settle_order(text,text,boolean,text,integer,integer,integer,integer,text,text,jsonb) to service_role;

create function public.shop_mark_shipped(p_order_id uuid, p_carrier text, p_tracking text) returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.shop_is_admin() then raise exception 'Shop owner access required.'; end if;
  if length(trim(coalesce(p_carrier,''))) not between 1 and 100 or length(coalesce(p_tracking,'')) > 200 then raise exception 'Enter a carrier and valid tracking number.'; end if;
  update public.shop_orders set fulfillment_status='shipped', carrier=trim(p_carrier), tracking_number=trim(coalesce(p_tracking,'')), shipped_at=now()
    where id=p_order_id and status='paid' and refunded_cents=0;
  if not found then raise exception 'Only paid, non-refunded orders can be marked shipped.'; end if;
end;
$$;
revoke all on function public.shop_mark_shipped(uuid,text,text) from public, anon;
grant execute on function public.shop_mark_shipped(uuid,text,text) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
  values('shop-product-images','shop-product-images',true,5242880,array['image/jpeg','image/png','image/webp']);
create policy shop_images_owner_insert on storage.objects for insert to authenticated
  with check (bucket_id='shop-product-images' and (select public.shop_is_admin()));
create policy shop_images_owner_delete on storage.objects for delete to authenticated
  using (bucket_id='shop-product-images' and (select public.shop_is_admin()));
create policy shop_images_owner_read on storage.objects for select to authenticated
  using (bucket_id='shop-product-images' and (select public.shop_is_admin()));

-- A private draft only. Price, dimensions, weight and sellable stock await the owner.
insert into public.shop_products(handle,title,description,category,images)
values('dgd-logo-sticker','DGD Logo Sticker','The DGD logo in black and white. Pinstriping, wheel details, and a little garage attitude.','Stickers',
  '[{"url":"/dgd-logo-sticker.png","altText":"Black and white DGD logo sticker with pinstriping and wheel artwork","width":1774,"height":887}]'::jsonb);
