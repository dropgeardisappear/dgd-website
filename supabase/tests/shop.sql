-- Assertions use temporary fixture rows and roll back all data changes.
-- No Stripe API calls or customer charges. Identity sequences may advance.
begin;
do $$
declare
  product uuid; draft uuid; cart uuid := gen_random_uuid(); test_cart uuid := gen_random_uuid();
  suffix text := replace(gen_random_uuid()::text,'-','');
  owner_id uuid; order_row public.shop_orders; repeat_row public.shop_orders;
  items jsonb; saved_stock integer; saved_reserved integer;
begin
  select user_id into owner_id from public.shop_admins limit 1;
  assert owner_id is not null, 'An existing owner must have shop access';
  perform set_config('dgd.test_owner',owner_id::text,true);
  perform set_config('request.jwt.claims','{"role":"service_role"}',true);
  update public.shop_settings set store_open=true,support_email='shop-test@example.invalid',shipping_flat_cents=100,
    tax_mode='no_tax',shipping_policy='Test fixture',refund_policy='Test fixture' where id=1;
  insert into public.shop_products(handle,title,status,price_cents,stock_quantity,weight_grams,images)
    values('test-'||suffix,'Fixture','active',500,3,10,'[{"url":"/dgd-logo-sticker.png"}]') returning id into product;
  insert into public.shop_products(handle,title) values('draft-'||suffix,'Private fixture') returning id into draft;
  perform set_config('dgd.test_product',product::text,true);
  perform set_config('dgd.test_draft',draft::text,true);
  items := jsonb_build_array(jsonb_build_object('product_id',product,'quantity',2,'unit_price_cents',500));
  order_row := public.shop_reserve_order(cart,items,'cs_live_'||suffix,true,repeat('a',64),100,'no_tax');
  repeat_row := public.shop_reserve_order(cart,items,'cs_live_duplicate_'||suffix,true,repeat('a',64),100,'no_tax');
  assert order_row.id=repeat_row.id, 'Repeated checkout must reuse its order';
  perform set_config('dgd.test_order',order_row.id::text,true);
  select stock_quantity,reserved_quantity into saved_stock,saved_reserved from public.shop_products where id=product;
  assert saved_stock=3 and saved_reserved=2, 'Live checkout reserves exactly once';
  begin
    perform public.shop_reserve_order(gen_random_uuid(),items,'cs_live_oversell_'||suffix,true,repeat('b',64),100,'no_tax');
    raise exception 'Overselling was incorrectly permitted';
  exception when raise_exception then
    if sqlerrm not like 'An item no longer has enough stock%' then raise; end if;
  end;
  begin
    perform public.shop_reserve_order(gen_random_uuid(),jsonb_build_array(jsonb_build_object('product_id',product,'quantity',1,'unit_price_cents',1)),'cs_live_tamper_'||suffix,true,repeat('c',64),100,'no_tax');
    raise exception 'Tampered price was incorrectly permitted';
  exception when raise_exception then
    if sqlerrm not like 'An item price changed%' then raise; end if;
  end;
  begin
    perform public.shop_settle_order(order_row.stripe_session_id,'paid',true,'pi_'||suffix,1000,100,0,1);
    raise exception 'Incorrect paid total was permitted';
  exception when raise_exception then
    if sqlerrm not like 'Payment totals do not match%' then raise; end if;
  end;
  assert (select status='pending' from public.shop_orders where id=order_row.id), 'Invalid payment must leave order pending';
  perform public.shop_settle_order(order_row.stripe_session_id,'paid',true,'pi_'||suffix,1000,100,0,1100);
  perform public.shop_settle_order(order_row.stripe_session_id,'paid',true,'pi_'||suffix,1000,100,0,1100);
  select stock_quantity,reserved_quantity into saved_stock,saved_reserved from public.shop_products where id=product;
  assert saved_stock=1 and saved_reserved=0, 'Duplicate payment must deduct stock only once';
  items := jsonb_build_array(jsonb_build_object('product_id',product,'quantity',1,'unit_price_cents',500));
  repeat_row := public.shop_reserve_order(gen_random_uuid(),items,'cs_live_expire_'||suffix,true,repeat('d',64),100,'no_tax');
  perform public.shop_settle_order(repeat_row.stripe_session_id,'expired',true);
  perform public.shop_settle_order(repeat_row.stripe_session_id,'expired',true);
  select stock_quantity,reserved_quantity into saved_stock,saved_reserved from public.shop_products where id=product;
  assert saved_stock=1 and saved_reserved=0, 'Expiry releases reservations without deducting stock';
  begin
    perform public.shop_settle_order(repeat_row.stripe_session_id,'paid',true,'pi_late_'||suffix,500,100,0,600);
    raise exception 'Released order was paid without review';
  exception when raise_exception then
    if sqlerrm not like 'Payment needs manual review%' then raise; end if;
  end;
  repeat_row := public.shop_reserve_order(test_cart,items,'cs_test_'||suffix,false,repeat('e',64),100,'no_tax');
  select stock_quantity,reserved_quantity into saved_stock,saved_reserved from public.shop_products where id=product;
  assert saved_stock=1 and saved_reserved=0, 'Test checkout must not reserve live stock';
  perform public.shop_settle_order(repeat_row.stripe_session_id,'paid',false,'pi_test_'||suffix,500,100,0,600);
  select stock_quantity,reserved_quantity into saved_stock,saved_reserved from public.shop_products where id=product;
  assert saved_stock=1 and saved_reserved=0, 'Test payment must not deduct live stock';
end;
$$;

set local role anon;
do $$
begin
  assert (select count(*)=1 from public.shop_products where id=current_setting('dgd.test_product')::uuid), 'Public must read active products';
  assert (select count(*)=0 from public.shop_products where id=current_setting('dgd.test_draft')::uuid), 'Public must not read drafts';
  begin perform count(*) from public.shop_orders; raise exception 'Public could read orders'; exception when insufficient_privilege then null; end;
  begin perform public.shop_reserve_order(gen_random_uuid(),'[]','cs_test_forbidden',false,repeat('f',64),100,'no_tax'); raise exception 'Public could reserve orders'; exception when insufficient_privilege then null; end;
end;
$$;
reset role;

select set_config('request.jwt.claims',jsonb_build_object('role','authenticated','sub',gen_random_uuid())::text,true);
set local role authenticated;
do $$
declare changed integer;
begin
  assert not public.shop_is_admin(), 'Non-owner must not be an admin';
  assert (select count(*)=0 from public.shop_orders), 'Members must not read orders';
  assert (select count(*)=0 from public.shop_order_items), 'Members must not read order items';
  assert (select count(*)=0 from public.shop_products where id=current_setting('dgd.test_draft')::uuid), 'Members must not read drafts';
  update public.shop_products set title='Unauthorized' where id=current_setting('dgd.test_product')::uuid;
  get diagnostics changed = row_count;
  assert changed=0, 'Members must not edit products';
  update public.shop_settings set store_open=false where id=1;
  get diagnostics changed = row_count;
  assert changed=0, 'Members must not change store settings';
  begin insert into public.shop_products(handle,title) values('forbidden-test','Forbidden'); raise exception 'Member could insert product'; exception when insufficient_privilege then null; end;
  begin insert into public.shop_admins(user_id) values(auth.uid()); raise exception 'Member could grant shop access'; exception when insufficient_privilege then null; end;
  begin perform public.shop_mark_shipped(current_setting('dgd.test_order')::uuid,'Test',''); raise exception 'Member could ship order'; exception when raise_exception then if sqlerrm not like 'Shop owner access required%' then raise; end if; end;
end;
$$;
reset role;

select set_config('request.jwt.claims',jsonb_build_object('role','authenticated','sub',current_setting('dgd.test_owner'))::text,true);
set local role authenticated;
do $$
declare changed integer;
begin
  assert public.shop_is_admin(), 'Bootstrapped owner must have access';
  assert (select count(*)=1 from public.shop_products where id=current_setting('dgd.test_draft')::uuid), 'Owner must read drafts';
  assert (select count(*)=1 from public.shop_orders where id=current_setting('dgd.test_order')::uuid), 'Owner must read orders';
  update public.shop_products set title='Owner edit' where id=current_setting('dgd.test_product')::uuid;
  get diagnostics changed = row_count;
  assert changed=1, 'Owner must edit product';
  begin update public.shop_products set reserved_quantity=0 where id=current_setting('dgd.test_product')::uuid; raise exception 'Owner browser could edit reserved stock'; exception when insufficient_privilege then null; end;
  begin update public.shop_orders set status='paid' where id=current_setting('dgd.test_order')::uuid; raise exception 'Owner browser could fake a payment'; exception when insufficient_privilege then null; end;
  begin perform public.shop_settle_order('cs_test_forbidden','paid',false); raise exception 'Owner browser could settle payment'; exception when insufficient_privilege then null; end;
  perform public.shop_mark_shipped(current_setting('dgd.test_order')::uuid,'Stamped mail','');
  assert (select fulfillment_status='shipped' from public.shop_orders where id=current_setting('dgd.test_order')::uuid), 'Owner must be able to record fulfillment';
end;
$$;
reset role;
rollback;
