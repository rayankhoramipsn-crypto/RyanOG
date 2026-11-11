-- READ ONLY. Run against the intended staging target before any approved rollout.
BEGIN TRANSACTION READ ONLY;
SELECT current_database() AS database_name, current_setting('server_version') AS postgres_version;
SELECT 'columns' AS component,count(*) AS objects,md5(string_agg(table_name||'.'||column_name||':'||udt_name||':'||is_nullable, E'\n' ORDER BY table_name,ordinal_position)) AS fingerprint FROM information_schema.columns WHERE table_schema='public'
UNION ALL SELECT 'constraints',count(*),md5(string_agg(c.relname||'.'||con.conname||':'||pg_get_constraintdef(con.oid),E'\n' ORDER BY c.relname,con.conname)) FROM pg_constraint con JOIN pg_class c ON c.oid=con.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public'
UNION ALL SELECT 'policies',count(*),md5(string_agg(tablename||'.'||policyname||':'||cmd||':'||coalesce(qual,'')||':'||coalesce(with_check,''),E'\n' ORDER BY tablename,policyname)) FROM pg_policies WHERE schemaname='public'
UNION ALL SELECT 'functions',count(*),md5(string_agg(p.proname||':'||pg_get_function_identity_arguments(p.oid)||':'||p.prosrc,E'\n' ORDER BY p.proname,pg_get_function_identity_arguments(p.oid))) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public';
SELECT count(*) AS public_tables_without_rls FROM pg_tables WHERE schemaname='public' AND NOT rowsecurity;
SELECT count(*) AS orders_with_missing_auth FROM public.tc42_orders o WHERE NOT EXISTS(SELECT 1 FROM auth.users u WHERE u.id=o.customer_id);
SELECT count(*) AS listings_with_missing_auth FROM public.market_listings l WHERE NOT EXISTS(SELECT 1 FROM auth.users u WHERE u.id=l.seller_id);
SELECT count(*) AS cross_system_duplicate_txids FROM public.store_crypto_invoice i JOIN public.market_txid_claims c ON lower(i.txid)=lower(c.txid);
SELECT pubname,tablename FROM pg_publication_tables WHERE schemaname='public' ORDER BY pubname,tablename;
SELECT id,public,file_size_limit,allowed_mime_types FROM storage.buckets ORDER BY id;
COMMIT;
-- Compare fingerprints with the recorded baseline before applying migrations.
-- If the target already has feature migrations, inspect its migration history instead;
-- do not attempt to force it to match the old baseline or replay successful migrations.
