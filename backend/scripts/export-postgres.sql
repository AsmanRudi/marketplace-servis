-- Run through psql with unaligned tuples-only output. A single snapshot keeps related rows consistent.
BEGIN ISOLATION LEVEL REPEATABLE READ;
SELECT to_regclass('public.online_checkouts') IS NOT NULL AS has_checkout,
       to_regclass('public.service_payments') IS NOT NULL AS has_payment \gset
\if :has_checkout
CREATE TEMP VIEW migration_checkouts AS SELECT order_id,to_jsonb(c)-'order_id' AS data FROM online_checkouts c;
\else
CREATE TEMP VIEW migration_checkouts AS SELECT NULL::uuid AS order_id,NULL::jsonb AS data WHERE false;
\endif
\if :has_payment
CREATE TEMP VIEW migration_payments AS SELECT order_id,to_jsonb(p)-'order_id' AS data FROM service_payments p;
\else
CREATE TEMP VIEW migration_payments AS SELECT NULL::uuid AS order_id,NULL::jsonb AS data WHERE false;
\endif
WITH exports(kind,document) AS (
  SELECT 'users', (to_jsonb(u)-'id') || jsonb_build_object('_id',u.id) FROM users u
  UNION ALL
  SELECT 'sessions', (to_jsonb(s)-'token_hash') || jsonb_build_object('_id',s.token_hash)
  FROM sessions s WHERE s.expires_at > transaction_timestamp()
  UNION ALL
  SELECT 'shops', (to_jsonb(s)-'id') || jsonb_build_object(
    '_id',s.id,'dropoff_address',to_jsonb(s)->'dropoff_address',
    'members',COALESCE((SELECT jsonb_agg((to_jsonb(m)-'shop_id') || jsonb_build_object('name',u.name) ORDER BY m.user_id)
                        FROM memberships m JOIN users u ON u.id=m.user_id WHERE m.shop_id=s.id),'[]'),
    'services',COALESCE((SELECT jsonb_agg((to_jsonb(l)-'shop_id') || jsonb_build_object(
                          'warranty_days',COALESCE(to_jsonb(l)->'warranty_days','0')) ORDER BY l.id)
                         FROM services l WHERE l.shop_id=s.id),'[]')) FROM shops s
  UNION ALL
  SELECT 'tickets', (to_jsonb(o)-'id') || jsonb_build_object(
    '_id',o.id,'revision',0,'shop_name',s.name,'service_name',l.name,'device',l.device,'technician_name',t.name,
    'completed_at',to_jsonb(o)->'completed_at','warranty_days',COALESCE(to_jsonb(o)->'warranty_days','0'),
    'quotes',COALESCE((SELECT jsonb_agg(to_jsonb(q)-'order_id' ORDER BY q.created_at DESC,q.id DESC) FROM quotes q WHERE q.order_id=o.id),'[]'),
    'events',COALESCE((SELECT jsonb_agg((to_jsonb(e)-'id'-'order_id') || jsonb_build_object('legacy_id',e.id::text) ORDER BY e.id)
                       FROM order_events e WHERE e.order_id=o.id),'[]'),
    'review',(SELECT to_jsonb(r)-'order_id' FROM reviews r WHERE r.order_id=o.id),
    'payment',p.data,'checkout',c.data)
  FROM orders o JOIN shops s ON s.id=o.shop_id JOIN services l ON l.id=o.service_id
  LEFT JOIN users t ON t.id=o.technician_id
  LEFT JOIN migration_payments p ON p.order_id=o.id LEFT JOIN migration_checkouts c ON c.order_id=o.id
)
SELECT jsonb_build_object('kind',kind,'document',document) FROM exports ORDER BY kind,document->>'_id';
COMMIT;
