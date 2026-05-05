CREATE OR REPLACE VIEW runtime_orders AS
WITH runtime AS (
  SELECT payload
  FROM app_runtime_state
  WHERE store_key = 'primary'
),
orders AS (
  SELECT order_json
  FROM runtime,
  LATERAL jsonb_array_elements(COALESCE(payload->'orders', '[]'::jsonb)) AS order_json
),
students AS (
  SELECT student_json
  FROM runtime,
  LATERAL jsonb_array_elements(COALESCE(payload->'students', '[]'::jsonb)) AS student_json
),
products AS (
  SELECT product_json
  FROM runtime,
  LATERAL jsonb_array_elements(COALESCE(payload->'products', '[]'::jsonb)) AS product_json
),
team AS (
  SELECT member_json
  FROM runtime,
  LATERAL jsonb_array_elements(COALESCE(payload->'team', '[]'::jsonb)) AS member_json
)
SELECT
  order_json->>'id' AS order_id,
  order_json->>'order_number' AS order_number,
  order_json->>'status' AS order_status,
  order_json->>'payment_mode' AS payment_mode,
  order_json->>'team_name' AS team_name,
  order_json->>'manager_name' AS manager_name,
  COALESCE(bda_member.member_json->>'name', order_json->>'created_by_name', '') AS bda_name,
  COALESCE(student.student_json->>'name', '') AS student_name,
  COALESCE(student.student_json->>'phone', '') AS student_phone,
  COALESCE(student.student_json->>'email', '') AS student_email,
  COALESCE(product.product_json->>'name', '') AS product_name,
  order_json->>'batch_month_key' AS batch_key,
  COALESCE(batch.batch_json->>'label', order_json->>'batch_month_label', '') AS batch_label,
  COALESCE((batch.batch_json->>'is_active')::boolean, true) AS batch_is_operational,
  order_json->>'coupon_code' AS coupon_code,
  order_json->>'created_by_name' AS created_by_name,
  order_json->>'created_by_role' AS created_by_role,
  order_json->>'created_by_email' AS created_by_email,
  order_json->>'razorpay_payment_id' AS razorpay_payment_id,
  COALESCE((order_json->>'portal_access_done')::boolean, false) AS portal_access_done,
  COALESCE((order_json->>'broker_setup_done')::boolean, false) AS broker_setup_done,
  COALESCE((order_json->>'access_revoked')::boolean, false) AS access_revoked,
  COALESCE((order_json->>'original_product_value_inr')::numeric, 0) / 100.0 AS gross_value_rs,
  COALESCE((order_json->>'discount_inr')::numeric, 0) / 100.0 AS discount_rs,
  COALESCE((order_json->>'product_value_inr')::numeric, 0) / 100.0 AS sold_value_rs,
  COALESCE((order_json->>'amount_paid_inr')::numeric, 0) / 100.0 AS paid_amount_rs,
  COALESCE((order_json->>'amount_due_inr')::numeric, 0) / 100.0 AS due_amount_rs,
  COALESCE((order_json->>'net_cash_in_hand_inr')::numeric, 0) / 100.0 AS net_cash_in_hand_rs,
  COALESCE((order_json->>'refunded_amount_inr')::numeric, 0) / 100.0 AS refunded_amount_rs,
  COALESCE((order_json->>'created_at')::timestamptz, NULL) AS created_at,
  COALESCE((order_json->>'updated_at')::timestamptz, NULL) AS updated_at
FROM orders
LEFT JOIN LATERAL (
  SELECT student_json
  FROM students
  WHERE student_json->>'id' = order_json->>'student_id'
  LIMIT 1
) AS student ON true
LEFT JOIN LATERAL (
  SELECT product_json
  FROM products
  WHERE product_json->>'id' = order_json->>'product_id'
  LIMIT 1
) AS product ON true
LEFT JOIN LATERAL (
  SELECT batch_json
  FROM jsonb_array_elements(COALESCE(product.product_json->'batches', '[]'::jsonb)) AS batch_json
  WHERE batch_json->>'key' = order_json->>'batch_month_key'
  LIMIT 1
) AS batch ON true
LEFT JOIN LATERAL (
  SELECT member_json
  FROM team
  WHERE member_json->>'id' = order_json->>'bda_id'
  LIMIT 1
) AS bda_member ON true;

CREATE OR REPLACE VIEW runtime_payments AS
WITH runtime AS (
  SELECT payload
  FROM app_runtime_state
  WHERE store_key = 'primary'
),
payments AS (
  SELECT payment_json
  FROM runtime,
  LATERAL jsonb_array_elements(COALESCE(payload->'payment_records', '[]'::jsonb)) AS payment_json
),
orders AS (
  SELECT order_json
  FROM runtime,
  LATERAL jsonb_array_elements(COALESCE(payload->'orders', '[]'::jsonb)) AS order_json
),
students AS (
  SELECT student_json
  FROM runtime,
  LATERAL jsonb_array_elements(COALESCE(payload->'students', '[]'::jsonb)) AS student_json
),
products AS (
  SELECT product_json
  FROM runtime,
  LATERAL jsonb_array_elements(COALESCE(payload->'products', '[]'::jsonb)) AS product_json
)
SELECT
  payment_json->>'id' AS payment_id,
  payment_json->>'transaction_id' AS transaction_id,
  payment_json->>'razorpay_payment_id' AS razorpay_payment_id,
  payment_json->>'status' AS payment_status,
  payment_json->>'method' AS payment_method,
  payment_json->>'type' AS payment_type,
  payment_json->>'stage' AS payment_stage,
  order_row.order_json->>'order_number' AS order_number,
  order_row.order_json->>'status' AS order_status,
  COALESCE(student.student_json->>'name', '') AS student_name,
  COALESCE(product.product_json->>'name', '') AS product_name,
  COALESCE((payment_json->>'amount_inr')::numeric, 0) / 100.0 AS payment_amount_rs,
  COALESCE((payment_json->>'paid_at')::timestamptz, NULL) AS paid_at,
  COALESCE((payment_json->>'created_at')::timestamptz, NULL) AS created_at,
  payment_json->>'payment_link' AS payment_link
FROM payments
LEFT JOIN LATERAL (
  SELECT order_json
  FROM orders
  WHERE order_json->>'id' = payment_json->>'order_id'
  LIMIT 1
) AS order_row ON true
LEFT JOIN LATERAL (
  SELECT student_json
  FROM students
  WHERE student_json->>'id' = payment_json->>'student_id'
  LIMIT 1
) AS student ON true
LEFT JOIN LATERAL (
  SELECT product_json
  FROM products
  WHERE product_json->>'id' = payment_json->>'product_id'
  LIMIT 1
) AS product ON true;
