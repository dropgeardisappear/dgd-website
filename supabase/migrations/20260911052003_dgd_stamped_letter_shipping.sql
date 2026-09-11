-- Owner-selected U.S. letter shipping; checkout remains closed during setup.
alter table public.shop_products add column ships_as_letter boolean not null default false;
grant insert(ships_as_letter), update(ships_as_letter) on public.shop_products to authenticated;

alter table public.shop_settings
  add column shipping_mode text not null default 'flat' check (shipping_mode in ('flat','stamped_letters')),
  add column letter_rate_cents integer not null default 150 check (letter_rate_cents between 50 and 100000),
  add column letter_max_items integer not null default 3 check (letter_max_items between 1 and 3),
  add constraint shop_letters_domestic_only check (shipping_mode <> 'stamped_letters' or shipping_countries = array['US']::text[]);
grant update(shipping_mode,letter_rate_cents,letter_max_items) on public.shop_settings to authenticated;
alter table public.shop_settings drop constraint shop_settings_check;
alter table public.shop_settings add constraint shop_settings_check check (
  not store_open or (
    support_email ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$'
    and (shipping_mode = 'stamped_letters' or shipping_flat_cents is not null)
    and tax_mode <> 'unconfigured'
    and length(trim(shipping_policy)) > 0 and length(trim(refund_policy)) > 0
  )
);
alter table public.shop_orders add column shipping_details jsonb;

-- Public quote uses the same calculation as the locked reservation transaction.
-- It reads only active catalog rows and public settings; it cannot write data.
create function public.shop_quote_shipping(p_items jsonb) returns jsonb
language plpgsql stable security invoker set search_path = '' as $$
declare
  v_settings public.shop_settings; v_product public.shop_products; v_item jsonb;
  v_quantity integer; v_capacity integer; v_count integer; v_envelopes integer := 0;
  v_subtotal bigint := 0; v_shipping integer; v_packing jsonb := '[]'::jsonb;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) not between 1 and 30 then raise exception 'Invalid cart.'; end if;
  if (select count(distinct (value->>'product_id')::uuid) from jsonb_array_elements(p_items)) <> jsonb_array_length(p_items) then raise exception 'Duplicate or invalid cart items.'; end if;
  select * into v_settings from public.shop_settings where id=1;
  if not found then raise exception 'Shipping is not configured yet.'; end if;
  for v_item in select value from jsonb_array_elements(p_items) order by value->>'product_id' loop
    if jsonb_typeof(v_item->'quantity') is distinct from 'number' or coalesce(v_item->>'quantity','') !~ '^[1-9][0-9]?$' then raise exception 'Invalid quantity.'; end if;
    v_quantity := (v_item->>'quantity')::integer;
    select * into v_product from public.shop_products where id=(v_item->>'product_id')::uuid and status='active';
    if not found or v_product.price_cents is null then raise exception 'An item is no longer available.'; end if;
    v_subtotal := v_subtotal + v_product.price_cents::bigint*v_quantity;
    if v_settings.shipping_mode='stamped_letters' then
      if not v_product.ships_as_letter or v_product.weight_grams is null or v_product.weight_grams not between 1 and 28 then
        raise exception 'Shipping needs to be arranged for an item in your cart. Please contact the shop.';
      end if;
      -- Conservative: count the packed weight for every unit, including its
      -- envelope. Each envelope stays below 1 oz (28.35g) and at most 3 items.
      -- Different products are packed separately; no combined-package guess.
      v_capacity := least(v_settings.letter_max_items,28/v_product.weight_grams);
      v_count := (v_quantity+v_capacity-1)/v_capacity;
      v_envelopes := v_envelopes+v_count;
      v_packing := v_packing || jsonb_build_array(jsonb_build_object(
        'product_id',v_product.id,'title',v_product.title,'quantity',v_quantity,
        'envelopes',v_count,'items_per_envelope',v_capacity
      ));
    end if;
  end loop;
  if v_subtotal>99999999 then raise exception 'This order is too large.'; end if;
  v_shipping := case when v_settings.shipping_mode='stamped_letters' then v_settings.letter_rate_cents*v_envelopes else v_settings.shipping_flat_cents end;
  if v_shipping is null then raise exception 'Shipping is not configured yet.'; end if;
  if v_settings.free_shipping_over_cents is not null and v_subtotal>=v_settings.free_shipping_over_cents then v_shipping := 0; end if;
  if v_subtotal+v_shipping>99999999 then raise exception 'This order is too large.'; end if;
  return jsonb_build_object('shipping_cents',v_shipping,'subtotal_cents',v_subtotal,
    'method',v_settings.shipping_mode,'envelope_count',v_envelopes,'packing',v_packing);
end;
$$;
revoke all on function public.shop_quote_shipping(jsonb) from public;
grant execute on function public.shop_quote_shipping(jsonb) to anon, authenticated, service_role;

create or replace function public.shop_reserve_order(p_cart_key uuid, p_items jsonb, p_session_id text, p_livemode boolean, p_client_hash text, p_shipping_cents integer, p_tax_mode text)
returns public.shop_orders language plpgsql security definer set search_path = '' as $$
declare
  v_order public.shop_orders; v_product public.shop_products; v_settings public.shop_settings;
  v_item jsonb; v_quote jsonb; v_subtotal bigint := 0; v_quantity integer; v_shipping integer;
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
  select * into v_settings from public.shop_settings where id=1 for share;
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
  v_quote := public.shop_quote_shipping(p_items);
  if (v_quote->>'subtotal_cents')::bigint is distinct from v_subtotal then raise exception 'An item price changed. Refresh your cart.'; end if;
  v_shipping := (v_quote->>'shipping_cents')::integer;
  if v_shipping is null or v_shipping is distinct from p_shipping_cents then raise exception 'Shipping changed. Refresh your cart.'; end if;
  insert into public.shop_orders(cart_key,stripe_session_id,livemode,subtotal_cents,shipping_cents,client_hash,shipping_details)
    values(p_cart_key,p_session_id,p_livemode,v_subtotal,v_shipping,p_client_hash,v_quote) returning * into v_order;
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
