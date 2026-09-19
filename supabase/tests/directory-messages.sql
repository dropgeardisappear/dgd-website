begin;
insert into auth.users(id) values('b2ca0f08-a57b-402f-81ac-76887b9da111'),('b2ca0f08-a57b-402f-81ac-76887b9da222'),('b2ca0f08-a57b-402f-81ac-76887b9da444');
insert into public.directory_shops(id,owner_id,name,data,status) values('b2ca0f08-a57b-402f-81ac-76887b9da333','b2ca0f08-a57b-402f-81ac-76887b9da111','Test','{}','approved');
set local role authenticated;
select set_config('request.jwt.claim.sub','b2ca0f08-a57b-402f-81ac-76887b9da222',true);
insert into public.directory_messages(shop_id,sender_id,kind,body,email) values('b2ca0f08-a57b-402f-81ac-76887b9da333','b2ca0f08-a57b-402f-81ac-76887b9da222','quote','Test quote message','test@example.invalid'),('b2ca0f08-a57b-402f-81ac-76887b9da333','b2ca0f08-a57b-402f-81ac-76887b9da222','report','Test report message','test@example.invalid');
select set_config('request.jwt.claim.sub','b2ca0f08-a57b-402f-81ac-76887b9da444',true);
do $$ begin if exists(select 1 from public.directory_messages where shop_id='b2ca0f08-a57b-402f-81ac-76887b9da333')then raise exception 'Unrelated user sees messages';end if;end $$;
select set_config('request.jwt.claim.sub','b2ca0f08-a57b-402f-81ac-76887b9da111',true);
do $$ begin
 if (select count(*) from public.directory_messages where shop_id='b2ca0f08-a57b-402f-81ac-76887b9da333')<>1 then raise exception 'Owner message isolation failed';end if;
 begin update public.directory_shops set verified=true where id='b2ca0f08-a57b-402f-81ac-76887b9da333'; raise exception 'Owner self-verified';exception when raise_exception then if SQLERRM<>'DGD verification access required' then raise;end if;end;
end $$;
set local role service_role;
do $$ begin
 if not public.directory_take_usage('test-limit',1,now()+interval '1 hour') then raise exception 'First reservation failed';end if;
 if public.directory_take_usage('test-limit',1,now()+interval '1 hour') then raise exception 'Limit exceeded';end if;
end $$;
rollback;
