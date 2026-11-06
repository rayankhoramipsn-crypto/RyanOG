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
 if exists(select 1 from public.market_txid_claims where txid=p_txid) then raise exception 'TXID already claimed'; end if;
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
lock table public.market_txid_claims in share row exclusive mode;
insert into public.store_used_txid select lower(txid) from public.market_txid_claims;
create function public.store_reserve_txid() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.txid is not null and (tg_op='INSERT' or old.txid is distinct from new.txid) then
   insert into public.store_used_txid values(lower(new.txid));
 end if;
 return new;
end $$;
revoke all on function public.store_reserve_txid() from public,anon,authenticated;
create trigger reserve_market_txid before insert or update of txid on public.market_txid_claims for each row execute function public.store_reserve_txid();
create trigger reserve_store_txid before update of txid on public.store_crypto_invoice for each row execute function public.store_reserve_txid();