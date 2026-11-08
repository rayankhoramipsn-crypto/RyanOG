create table public.tc42_orders(id uuid primary key default gen_random_uuid(), customer_id uuid not null references auth.users(id),status text not null default 'awaiting_payment' check(status in ('awaiting_payment','payment_review','paid','fulfilled','cancelled')),currency text not null default 'USD' check(currency='USD'),total_amount numeric not null check(total_amount>=0),items jsonb not null check(jsonb_typeof(items)='array'),created_at timestamptz not null default now());
alter table public.tc42_orders enable row level security;
revoke all on public.tc42_orders from public,anon,authenticated;
grant select on public.tc42_orders to authenticated;
grant select,insert,update on public.tc42_orders to service_role;
create policy read_own_orders on public.tc42_orders for select to authenticated using(customer_id=(select auth.uid()));
CREATE OR REPLACE FUNCTION public.tc42_create_order(p_items jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_user uuid := auth.uid(); v_entry jsonb; v_product record; v_id bigint; v_qty int; v_total numeric(12,2):=0; v_lines jsonb:='[]'::jsonb; v_order uuid;
BEGIN
 IF v_user IS NULL THEN RAISE EXCEPTION 'Sign in to save an order'; END IF;
 IF p_items IS NULL OR jsonb_typeof(p_items)<>'array' OR jsonb_array_length(p_items) NOT BETWEEN 1 AND 20 THEN RAISE EXCEPTION 'Invalid cart size'; END IF;
 FOR v_entry IN SELECT value FROM jsonb_array_elements(p_items) LOOP
  IF (v_entry->>'id') IS NULL OR (v_entry->>'qty') IS NULL OR jsonb_typeof(v_entry)<>'object' OR (v_entry->>'id') !~ '^[0-9]{1,18}$' OR (v_entry->>'qty') !~ '^[0-9]{1,5}$' THEN RAISE EXCEPTION 'Invalid cart item'; END IF;
  v_id:=(v_entry->>'id')::bigint; v_qty:=(v_entry->>'qty')::int;
  IF v_qty<1 THEN RAISE EXCEPTION 'Invalid quantity'; END IF;
  SELECT id,title,price,stock,status,min_qty,max_qty INTO v_product FROM public.products WHERE id=v_id FOR SHARE;
  IF NOT FOUND OR v_product.status IS DISTINCT FROM 'available' OR v_product.stock<v_qty THEN RAISE EXCEPTION 'Product unavailable'; END IF;
  IF v_qty<v_product.min_qty OR (v_product.max_qty IS NOT NULL AND v_qty>v_product.max_qty) THEN RAISE EXCEPTION 'Quantity outside allowed range'; END IF;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(v_lines) x WHERE (x->>'id')::bigint=v_id) THEN RAISE EXCEPTION 'Duplicate product'; END IF;
  v_total:=v_total+round(v_product.price*v_qty,2);
  IF v_total>9999999999 THEN RAISE EXCEPTION 'Cart total too large'; END IF;
  v_lines:=v_lines||jsonb_build_array(jsonb_build_object('id',v_id,'title',v_product.title,'unit_price',v_product.price,'qty',v_qty));
 END LOOP;
 INSERT INTO public.tc42_orders(customer_id,total_amount,items) VALUES(v_user,v_total,v_lines) RETURNING id INTO v_order;
 RETURN v_order;
END;$function$;

revoke all on function public.tc42_create_order(jsonb) from public,anon;
grant execute on function public.tc42_create_order(jsonb) to authenticated;
create table public.store_crypto_invoice (
  order_id uuid primary key references public.tc42_orders(id),
  network text not null check (network in ('BTC','LTC')),
  address text not null,
  units bigint not null check (units between 1000 and 9007199254740991),
  issued_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz not null default (clock_timestamp() + interval '20 minutes'),
  txid text unique check(txid ~ '^[0-9a-f]{64}$'),
  unique(network,address,units)
);
alter table public.store_crypto_invoice enable row level security;
revoke all on public.store_crypto_invoice from public,anon,authenticated;
grant select,insert,update on public.store_crypto_invoice to service_role;

create function public.store_issue_crypto(p_user uuid,p_order uuid,p_network text,p_address text,p_rate numeric)
returns public.store_crypto_invoice language plpgsql security invoker set search_path='' as $$
declare o public.tc42_orders; i public.store_crypto_invoice; base bigint; discount int;
begin
 select * into strict o from public.tc42_orders where id=p_order and customer_id=p_user for update;
 if o.status <> 'awaiting_payment' then raise exception 'Order unavailable'; end if;
 select * into i from public.store_crypto_invoice where order_id=p_order;
 if found then
   if i.network<>p_network or i.expires_at<=now() then raise exception 'Use a new order for a different or expired quote'; end if;
   return i;
 end if;
 if p_rate<=0 or p_rate is null or o.total_amount<=0 then raise exception 'Invalid quote'; end if;
 base:=ceil(o.total_amount*100000000/p_rate);
 if base<1000 then raise exception 'Amount below invoice minimum'; end if;
 -- Never reuse an amount at this shared destination, even after expiration.
 -- Resolve collisions with a discount capped at 0.25 percent.
 for discount in 0..least(255, floor(base*0.0025),base-1000)::int loop
   insert into public.store_crypto_invoice(order_id,network,address,units)
   values(p_order,p_network,p_address,base-discount)
   on conflict(network,address,units) do nothing returning * into i;
   if found then return i; end if;
 end loop;
 raise exception 'No distinct quote available';
end $$;

create function public.store_settle_crypto(p_user uuid,p_order uuid,p_txid text)
returns text language plpgsql security invoker set search_path='' as $$
declare o public.tc42_orders; i public.store_crypto_invoice; item record; enough boolean:=true; result text;
begin
 select * into strict o from public.tc42_orders where id=p_order and customer_id=p_user for update;
 select * into strict i from public.store_crypto_invoice where order_id=p_order for update;
 if i.txid=p_txid then return o.status; end if;
 if i.txid is not null or o.status<>'awaiting_payment' then raise exception 'Order already processed'; end if;
 for item in select * from jsonb_to_recordset(o.items) as x(id bigint,qty int) order by id loop
   perform 1 from public.products where id=item.id and status='available' and stock>=item.qty for update;
   if not found then enough:=false; end if;
 end loop;
 if enough then
   update public.products p set stock=p.stock-x.qty from jsonb_to_recordset(o.items) as x(id bigint,qty int) where p.id=x.id;
 end if;
 result:=case when enough then 'paid' else 'payment_review' end;
 update public.store_crypto_invoice set txid=p_txid where order_id=p_order;
 update public.tc42_orders set status=result where id=p_order;
 return result;
end $$;
revoke all on function public.store_issue_crypto(uuid,uuid,text,text,numeric),public.store_settle_crypto(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.store_issue_crypto(uuid,uuid,text,text,numeric),public.store_settle_crypto(uuid,uuid,text) to service_role;
-- One namespace for previously claimed marketplace hashes and verified store receipts.
create table public.store_used_txid(txid text primary key);
alter table public.store_used_txid enable row level security;
revoke all on public.store_used_txid from public,anon,authenticated;
grant insert,select on public.store_used_txid to service_role;
create function public.store_reserve_txid() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.txid is not null and (tg_op='INSERT' or old.txid is distinct from new.txid) then
   insert into public.store_used_txid values(lower(new.txid));
 end if;
 return new;
end $$;
revoke all on function public.store_reserve_txid() from public,anon,authenticated;
create trigger reserve_store_txid before update of txid on public.store_crypto_invoice for each row execute function public.store_reserve_txid();
create table public.store_buyers (id uuid primary key);
alter table public.store_buyers enable row level security;
revoke all on public.store_buyers from public,anon,authenticated;
grant select,insert on public.store_buyers to service_role;
alter table public.tc42_orders drop constraint tc42_orders_customer_id_fkey, add constraint store_order_buyer_fk foreign key(customer_id) references public.store_buyers(id);
revoke all on public.tc42_orders from authenticated;
revoke all on function public.tc42_create_order(jsonb) from authenticated;
grant execute on function public.tc42_create_order(jsonb) to service_role;
create function public.store_checkout_order(buyer uuid,items jsonb) returns uuid language plpgsql security invoker set search_path='' as $$
begin
 insert into public.store_buyers(id) values(buyer) on conflict do nothing;
 perform set_config('request.jwt.claim.sub',buyer::text,true);
 return public.tc42_create_order(items);
end $$;
revoke all on function public.store_checkout_order(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.store_checkout_order(uuid,jsonb) to service_role;