-- Disposable test fixture reconstructed from the archive. NOT a production migration.
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE SCHEMA auth;
CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,raw_app_meta_data jsonb DEFAULT '{}');
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
GRANT USAGE ON SCHEMA auth,public TO anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION auth.uid() TO anon,authenticated,service_role;
CREATE FUNCTION public.is_admin() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$SELECT EXISTS(SELECT 1 FROM auth.users WHERE id=auth.uid() AND raw_app_meta_data->>'role'='admin')$$;
CREATE TABLE public.products(id bigint PRIMARY KEY,title text,price numeric(12,2),stock int CHECK(stock>=0),status text,min_qty int DEFAULT 1,max_qty int DEFAULT 999);
CREATE TABLE public.market_listings(id bigint PRIMARY KEY,seller_id uuid REFERENCES auth.users(id),title text,price numeric(12,2),status text CHECK(status IN ('pending','approved','declined','removed')));
CREATE TABLE public.market_conversations(id bigint PRIMARY KEY,buyer_id uuid,seller_id uuid);
CREATE TABLE public.market_messages(id bigint PRIMARY KEY,conversation_id bigint,sender_id uuid,body text);
