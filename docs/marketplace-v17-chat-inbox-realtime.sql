-- TRISOCMD marketplace V17: persistent participant unread counters and
-- cross-account realtime delivery of new conversations.
-- Existing conversations/messages are preserved without modification.

create table if not exists public.market_conversation_reads (
  conversation_id bigint not null references public.market_conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);
alter table public.market_conversation_reads enable row level security;

drop policy if exists market_conversation_reads_self on public.market_conversation_reads;
create policy market_conversation_reads_self on public.market_conversation_reads
  for select to authenticated
  using (user_id = (select auth.uid())
    and exists (
      select 1 from public.market_conversations c
      where c.id = conversation_id
        and (c.buyer_id = (select auth.uid()) or c.seller_id = (select auth.uid()))
    ));

revoke all on public.market_conversation_reads from public, anon;
grant select on public.market_conversation_reads to authenticated;

create index if not exists market_messages_conversation_recent_idx
  on public.market_messages(conversation_id, created_at desc, id desc);

-- Read-only authenticated inbox. SECURITY INVOKER keeps conversation/message
-- RLS fully active; each participant sees only their own conversations.
create or replace function public.market_inbox()
returns table (
  id bigint,
  listing_id bigint,
  listing_title text,
  seller_id uuid,
  buyer_id uuid,
  created_at timestamptz,
  last_message_at timestamptz,
  last_message_preview text,
  last_sender_id uuid,
  unread_count bigint
)
language sql
stable
security invoker
set search_path = ''
as $function$
  select c.id,
         c.listing_id,
         coalesce(l.title, 'Listing #' || c.listing_id::text) as listing_title,
         c.seller_id, c.buyer_id, c.created_at,
         latest.created_at as last_message_at,
         left(latest.body, 180) as last_message_preview,
         latest.sender_id as last_sender_id,
         (
           select count(*)
           from public.market_messages m
           where m.conversation_id = c.id
             and m.sender_id <> auth.uid()
             and m.created_at > coalesce(read_state.last_read_at, 'epoch'::timestamptz)
         ) as unread_count
  from public.market_conversations c
  left join public.market_listings l on l.id = c.listing_id
  left join public.market_conversation_reads read_state
    on read_state.conversation_id = c.id and read_state.user_id = auth.uid()
  left join lateral (
    select m.body, m.created_at, m.sender_id
    from public.market_messages m
    where m.conversation_id = c.id
    order by m.created_at desc, m.id desc
    limit 1
  ) latest on true
  where auth.uid() is not null
    and (c.buyer_id = auth.uid() or c.seller_id = auth.uid())
  order by coalesce(latest.created_at, c.created_at) desc, c.id desc
  limit 100
$function$;

-- Updating unread state is restricted server-side to the conversation's
-- actual buyer/seller, never by a client-provided user ID.
create or replace function public.market_mark_read(p_conversation bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'Sign in required' using errcode = '28000';
  end if;
  if not exists (
    select 1 from public.market_conversations c
    where c.id = p_conversation and (c.buyer_id = v_user or c.seller_id = v_user)
  ) then
    raise exception 'Conversation unavailable' using errcode = '42501';
  end if;

  insert into public.market_conversation_reads (conversation_id, user_id, last_read_at)
    values (p_conversation, v_user, now())
  on conflict (conversation_id, user_id)
    do update set last_read_at = greatest(
      public.market_conversation_reads.last_read_at, excluded.last_read_at
    );
end
$function$;

revoke all on function public.market_inbox() from public, anon;
revoke all on function public.market_mark_read(bigint) from public, anon;
grant execute on function public.market_inbox() to authenticated, service_role;
grant execute on function public.market_mark_read(bigint) to authenticated, service_role;

-- Realtime INSERT notifications are filtered by existing RLS:
-- new conversations reach their seller and buyer; message INSERTs already
-- use participant-only policies. Polling remains the fallback.
do $block$
begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime')
    and not exists (
      select 1 from pg_publication_tables
      where pubname='supabase_realtime'
        and schemaname='public' and tablename='market_conversations'
    )
  then
    alter publication supabase_realtime add table public.market_conversations;
  end if;
end
$block$;
