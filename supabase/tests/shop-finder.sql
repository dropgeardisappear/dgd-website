begin;
insert into auth.users(id) values('a2ca0f08-a57b-402f-81ac-76887b9da111'),('a2ca0f08-a57b-402f-81ac-76887b9da222');
set local role authenticated;
select set_config('request.jwt.claim.sub','a2ca0f08-a57b-402f-81ac-76887b9da111',true);
select public.save_directory_shop('a2ca0f08-a57b-402f-81ac-76887b9da333','Temporary RLS test shop','{"city":"Test city","tags":["Brakes"]}'::jsonb,'test@example.invalid');
do $$begin
 if not exists(select 1 from public.directory_shops where id='a2ca0f08-a57b-402f-81ac-76887b9da333' and status='pending' and plan='free') then raise exception 'Owner cannot read submitted listing';end if;
 if not exists(select 1 from public.directory_contacts where shop_id='a2ca0f08-a57b-402f-81ac-76887b9da333')then raise exception 'Owner cannot read private contact';end if;
 begin
  update public.directory_shops set status='approved' where id='a2ca0f08-a57b-402f-81ac-76887b9da333';
  raise exception 'TEST FAILED: Owner approved their own listing';
 exception when raise_exception then if SQLERRM<>'DGD review access required' then raise;end if;end;
end;$$;
select set_config('request.jwt.claim.sub','a2ca0f08-a57b-402f-81ac-76887b9da222',true);
do $$begin
 if exists(select 1 from public.directory_shops where id='a2ca0f08-a57b-402f-81ac-76887b9da333')then raise exception 'Another user can read pending listing';end if;
 if exists(select 1 from public.directory_contacts where shop_id='a2ca0f08-a57b-402f-81ac-76887b9da333')then raise exception 'Another user can read private email';end if;
 update public.directory_shops set name='Unauthorized' where id='a2ca0f08-a57b-402f-81ac-76887b9da333';
 if found then raise exception 'Another user changed a listing';end if;
end;$$;
reset role;
insert into public.shop_admins(user_id) values('a2ca0f08-a57b-402f-81ac-76887b9da222');
set local role authenticated;
update public.directory_shops set status='approved' where id='a2ca0f08-a57b-402f-81ac-76887b9da333';
set local role anon;
select set_config('request.jwt.claim.sub','',true);
do $$begin
 if not exists(select 1 from public.directory_shops where id='a2ca0f08-a57b-402f-81ac-76887b9da333')then raise exception 'Public cannot read approved shop';end if;
 begin perform email from public.directory_contacts;raise exception 'TEST FAILED: Public contact email exposed';exception when insufficient_privilege then null;end;
end;$$;
set local role authenticated;
select set_config('request.jwt.claim.sub','a2ca0f08-a57b-402f-81ac-76887b9da111',true);
select public.save_directory_shop('a2ca0f08-a57b-402f-81ac-76887b9da333','Edited shop','{"city":"Test city","tags":["Brakes"]}'::jsonb,'test@example.invalid');
do $$begin
 if not exists(select 1 from public.directory_shops where id='a2ca0f08-a57b-402f-81ac-76887b9da333' and status='pending')then raise exception 'Edit did not reset review';end if;
end;$$;
rollback;
