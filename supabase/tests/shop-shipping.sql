-- Temporary fixtures only. No carrier, Stripe, email, or customer calls.
begin;
do $$
declare
  product uuid; other_product uuid; owner_id uuid; suffix text := replace(gen_random_uuid()::text,'-','');
  q integer; charge integer; envelopes integer; weight integer;
  quote jsonb; items jsonb; saved_order public.shop_orders;
begin
  select user_id into owner_id from public.shop_admins limit 1;
  assert owner_id is not null, 'Owner fixture required';
  perform set_config('dgd.shipping_owner',owner_id::text,true);
  update public.shop_settings set store_open=false,shipping_mode='stamped_letters',shipping_countries=array['US'],
    letter_rate_cents=150,letter_max_items=3,free_shipping_over_cents=null where id=1;
  insert into public.shop_products(handle,title,status,price_cents,stock_quantity,weight_grams,ships_as_letter,images)
    values('shipping-'||suffix,'Letter fixture','active',500,99,8,true,'[{"url":"/dgd-logo-sticker.png"}]') returning id into product;
  insert into public.shop_products(handle,title,status,price_cents,stock_quantity,weight_grams,ships_as_letter,images)
    values('other-shipping-'||suffix,'Other fixture','active',500,99,8,true,'[{"url":"/dgd-logo-sticker.png"}]') returning id into other_product;
  perform set_config('dgd.shipping_product',product::text,true);
  perform set_config('dgd.shipping_other',other_product::text,true);
  for q,charge,envelopes in values (1,150,1),(3,150,1),(4,300,2),(6,300,2),(7,450,3),(99,4950,33) loop
    quote := public.shop_quote_shipping(jsonb_build_array(jsonb_build_object('product_id',product,'quantity',q,'unit_price_cents',1)));
    assert (quote->>'shipping_cents')::integer=charge, 'Wrong quantity tier';
    assert (quote->>'envelope_count')::integer=envelopes, 'Wrong envelope count';
    assert (quote->>'subtotal_cents')::integer=q*500, 'Quote must ignore caller prices';
  end loop;
  items := jsonb_build_array(jsonb_build_object('product_id',product,'quantity',3));
  update public.shop_products set weight_grams=14 where id=product;
  assert (public.shop_quote_shipping(items)->>'shipping_cents')::integer=300, 'Two 14g units fit the weight limit';
  foreach weight in array array[15,28] loop
    update public.shop_products set weight_grams=weight where id=product;
    assert (public.shop_quote_shipping(items)->>'shipping_cents')::integer=450, 'Heavier units need separate letters';
  end loop;
  update public.shop_products set weight_grams=29 where id=product;
  begin
    perform public.shop_quote_shipping(items); raise exception 'Overweight letter accepted';
  exception when raise_exception then if sqlerrm not like 'Shipping needs to be arranged%' then raise; end if; end;
  update public.shop_products set weight_grams=8,ships_as_letter=false where id=product;
  begin
    perform public.shop_quote_shipping(items); raise exception 'Unapproved item accepted';
  exception when raise_exception then if sqlerrm not like 'Shipping needs to be arranged%' then raise; end if; end;
  update public.shop_products set ships_as_letter=true where id=product;
  quote := public.shop_quote_shipping(jsonb_build_array(jsonb_build_object('product_id',product,'quantity',1),jsonb_build_object('product_id',other_product,'quantity',1)));
  assert (quote->>'envelope_count')::integer=2, 'Different products use separate packing plans';
  begin
    perform public.shop_quote_shipping(items||items); raise exception 'Duplicate item accepted';
  exception when raise_exception then if sqlerrm not like 'Duplicate or invalid%' then raise; end if; end;
  begin
    perform public.shop_quote_shipping(jsonb_build_array(jsonb_build_object('product_id',product,'quantity',0))); raise exception 'Zero quantity accepted';
  exception when raise_exception then if sqlerrm not like 'Invalid quantity%' then raise; end if; end;
  begin
    update public.shop_settings set shipping_countries=array['US','CA'] where id=1; raise exception 'International letter accepted';
  exception when check_violation then null; end;
  update public.shop_settings set free_shipping_over_cents=1500 where id=1;
  assert (public.shop_quote_shipping(items)->>'shipping_cents')::integer=0, 'Free shipping starts at its threshold';
  update public.shop_settings set free_shipping_over_cents=null,store_open=true,support_email='shipping-test@example.invalid',
    tax_mode='no_tax',shipping_policy='Fixture',refund_policy='Fixture' where id=1;
  perform set_config('request.jwt.claims','{"role":"service_role"}',true);
  items := jsonb_build_array(jsonb_build_object('product_id',product,'quantity',4,'unit_price_cents',500));
  begin
    perform public.shop_reserve_order(gen_random_uuid(),items,'cs_shipping_wrong_'||suffix,true,repeat('1',64),150,'no_tax');
    raise exception 'Incorrect shipping accepted';
  exception when raise_exception then if sqlerrm not like 'Shipping changed%' then raise; end if; end;
  assert (select reserved_quantity=0 from public.shop_products where id=product), 'Rejected quote must not reserve stock';
  saved_order := public.shop_reserve_order(gen_random_uuid(),items,'cs_shipping_correct_'||suffix,true,repeat('2',64),300,'no_tax');
  assert saved_order.shipping_cents=300 and (saved_order.shipping_details->>'envelope_count')::integer=2, 'Reservation stores shipping and packing';
  assert (select reserved_quantity=4 from public.shop_products where id=product), 'Accepted checkout reserves stock';
  update public.shop_settings set letter_max_items=1 where id=1;
  assert (public.shop_quote_shipping(items)->>'envelope_count')::integer=4, 'New settings apply without a deploy';
  assert (select (shipping_details->>'envelope_count')::integer=2 from public.shop_orders where id=saved_order.id), 'Existing packing snapshot must not change';
  perform public.shop_settle_order(saved_order.stripe_session_id,'failed',true);
  perform public.shop_settle_order(saved_order.stripe_session_id,'failed',true);
  assert (select reserved_quantity=0 and stock_quantity=99 from public.shop_products where id=product), 'Failed payments release stock exactly once';
  update public.shop_settings set store_open=false,shipping_mode='flat',shipping_flat_cents=725 where id=1;
  update public.shop_products set ships_as_letter=false where id=product;
  assert (public.shop_quote_shipping(items)->>'shipping_cents')::integer=725, 'Flat shipping supports other merchandise';
  update public.shop_products set ships_as_letter=true where id=product;
  update public.shop_products set status='draft' where id=other_product;
  update public.shop_settings set shipping_mode='stamped_letters',letter_max_items=3 where id=1;
end;
$$;

select set_config('request.jwt.claims','{"role":"anon"}',true);
set local role anon;
do $$
begin
  assert (public.shop_quote_shipping(jsonb_build_array(jsonb_build_object('product_id',current_setting('dgd.shipping_product'),'quantity',1)))->>'shipping_cents')::integer=150, 'Visitors can quote while the store is closed';
  begin
    perform public.shop_quote_shipping(jsonb_build_array(jsonb_build_object('product_id',current_setting('dgd.shipping_other'),'quantity',1)));
    raise exception 'Draft was quoted';
  exception when raise_exception then if sqlerrm not like 'An item is no longer available%' then raise; end if; end;
  begin perform count(*) from public.shop_orders; raise exception 'Visitor read orders'; exception when insufficient_privilege then null; end;
end;
$$;
reset role;

select set_config('request.jwt.claims',jsonb_build_object('role','authenticated','sub',gen_random_uuid())::text,true);
set local role authenticated;
do $$
declare changed integer;
begin
  update public.shop_settings set letter_rate_cents=1 where id=1;
  get diagnostics changed=row_count;
  assert changed=0, 'Members cannot change the shipping price';
  update public.shop_products set ships_as_letter=false where id=current_setting('dgd.shipping_product')::uuid;
  get diagnostics changed=row_count;
  assert changed=0, 'Members cannot change packing eligibility';
end;
$$;
reset role;

select set_config('request.jwt.claims',jsonb_build_object('role','authenticated','sub',current_setting('dgd.shipping_owner'))::text,true);
set local role authenticated;
do $$
declare changed integer;
begin
  update public.shop_settings set letter_rate_cents=175,letter_max_items=2 where id=1;
  get diagnostics changed=row_count;
  assert changed=1, 'Owner can change shipping settings';
  assert (public.shop_quote_shipping(jsonb_build_array(jsonb_build_object('product_id',current_setting('dgd.shipping_product'),'quantity',3)))->>'shipping_cents')::integer=350, 'Owner setting change affects quotes';
  update public.shop_products set ships_as_letter=false where id=current_setting('dgd.shipping_product')::uuid;
  get diagnostics changed=row_count;
  assert changed=1, 'Owner can change letter eligibility';
end;
$$;
reset role;
rollback;
