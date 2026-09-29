-- TEMPLATE ONLY. Replace every STARTER_* value before running.
-- MySQL / MariaDB; run against the membership service database.
-- Existing schema is assumed to allocate IDs explicitly.

START TRANSACTION;

SET @starter_product_id = (
    SELECT id FROM api_product
    WHERE name = 'STARTER_PRODUCT_NAME' AND deleted_at IS NULL
    ORDER BY id LIMIT 1
);
SET @next_product_id = (SELECT COALESCE(MAX(id), 0) + 1 FROM api_product);

INSERT INTO api_product
    (id, name, description, status, attributes, created_at, updated_at)
SELECT @next_product_id, 'STARTER_PRODUCT_NAME',
       '免费版每自然月可执行 3 次核心操作；会员不限次数。', 1,
       JSON_OBJECT('product_scope', 'STARTER_PRODUCT_SCOPE'), NOW(), NOW()
WHERE @starter_product_id IS NULL;

SET @starter_product_id = (
    SELECT id FROM api_product
    WHERE name = 'STARTER_PRODUCT_NAME' AND deleted_at IS NULL
    ORDER BY id LIMIT 1
);
SET @next_sale_id = (SELECT COALESCE(MAX(id), 0) + 1 FROM api_sale_product);

INSERT INTO api_sale_product
    (id, product_id, product_code, name, description, price, original_price,
     stock, sales_count, status, sort_order, attributes, created_at, updated_at)
SELECT @next_sale_id, @starter_product_id, 'STARTER_VIP_MONTH', '月度会员',
       '有效期 30 天，不自动续费。', 9.90, 15.90, -1, 0, 1, 100,
       JSON_OBJECT('product_scope', 'STARTER_PRODUCT_SCOPE', 'vip_type', 'month',
                   'vip_level', 1, 'validity_days', 30, 'badge', '灵活使用',
                   'recommended', FALSE,
                   'features', JSON_ARRAY('不限次数使用核心功能', '有效期 30 天', '不自动续费')),
       NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM api_sale_product WHERE product_code = 'STARTER_VIP_MONTH');

INSERT INTO api_sale_product
    (id, product_id, product_code, name, description, price, original_price,
     stock, sales_count, status, sort_order, attributes, created_at, updated_at)
SELECT @next_sale_id + 1, @starter_product_id, 'STARTER_VIP_YEAR', '年度会员',
       '有效期 365 天，不自动续费。', 39.00, 69.00, -1, 0, 1, 120,
       JSON_OBJECT('product_scope', 'STARTER_PRODUCT_SCOPE', 'vip_type', 'year',
                   'vip_level', 1, 'validity_days', 365, 'badge', '推荐',
                   'recommended', TRUE,
                   'features', JSON_ARRAY('不限次数使用核心功能', '有效期 365 天', '不自动续费')),
       NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM api_sale_product WHERE product_code = 'STARTER_VIP_YEAR');

INSERT INTO api_sale_product
    (id, product_id, product_code, name, description, price, original_price,
     stock, sales_count, status, sort_order, attributes, created_at, updated_at)
SELECT @next_sale_id + 2, @starter_product_id, 'STARTER_VIP_LIFETIME', '终身会员',
       '一次购买，永久有效。', 99.00, 149.00, -1, 0, 1, 110,
       JSON_OBJECT('product_scope', 'STARTER_PRODUCT_SCOPE', 'vip_type', 'lifetime',
                   'vip_level', 1, 'validity_days', 0, 'badge', '一次买断',
                   'recommended', FALSE,
                   'features', JSON_ARRAY('不限次数使用核心功能', '永久有效', '一次买断')),
       NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM api_sale_product WHERE product_code = 'STARTER_VIP_LIFETIME');

COMMIT;

