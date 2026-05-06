INSERT INTO admin_users (id, name, email, password, role, is_active)
VALUES
  ('10000000-0000-0000-0000-000000000001', 'Shashwat Singh', 'shashwat@livelongwealth.com', '$2b$10$demo.hash.value', 'SUPER_ADMIN', TRUE),
  ('10000000-0000-0000-0000-000000000002', 'Nisha Rao', 'nisha@livelongwealth.com', '$2b$10$demo.hash.value', 'ADMIN', TRUE),
  ('10000000-0000-0000-0000-000000000003', 'Rahul Bhat', 'rahul@livelongwealth.com', '$2b$10$demo.hash.value', 'BDA', TRUE),
  ('7f3e29b8-8e31-4f3e-bcc8-3d5c1f6b2d10', 'Dhanush', 'dhanush@livelongwealth.com', 'google-oauth', 'ADMIN', TRUE)
ON CONFLICT (id) DO NOTHING;

INSERT INTO instructors (id, name, slug, market_type, languages, short_bio, experience_years, speciality, is_active, display_order)
VALUES
  ('20000000-0000-0000-0000-000000000001', 'Bibin', 'bibin', 'INDIAN', ARRAY['MALAYALAM', 'HINDI'], 'Indian market mentor with strong classroom engagement.', 8, 'Indian market', TRUE, 1),
  ('20000000-0000-0000-0000-000000000002', 'Deepanshu', 'deepanshu', 'INDIAN', ARRAY['ENGLISH'], 'Focuses on structured market education.', 7, 'Indian market', TRUE, 2),
  ('20000000-0000-0000-0000-000000000006', 'Sachin', 'sachin', 'FOREX', ARRAY['MALAYALAM'], 'Forex sessions with Malayalam delivery.', 10, 'Forex', TRUE, 6)
ON CONFLICT (id) DO NOTHING;

INSERT INTO products (id, name, slug, mode, category, price, discounted_price, duration_months, is_active)
VALUES
  ('30000000-0000-0000-0000-000000000001', 'Indian Market (Online)', 'indian-market-online', 'ONLINE', 'INDIAN', 4000000, 3999900, 6, TRUE),
  ('30000000-0000-0000-0000-000000000002', 'Forex Market (Online)', 'forex-market-online', 'ONLINE', 'FOREX', 4000000, 3999900, 6, TRUE),
  ('30000000-0000-0000-0000-000000000003', 'Indian + Forex CTP (Online)', 'indian-forex-ctp-online', 'ONLINE', 'CTP', 6000000, 5999900, 6, TRUE)
ON CONFLICT (id) DO NOTHING;

INSERT INTO students (id, name, phone, email, city, state, product_ids, enrolled_at, source, bda_id, is_active)
VALUES
  ('40000000-0000-0000-0000-000000000001', 'Abhinav Menon', '919645812284', 'abhinav@example.com', 'Kochi', 'Kerala', ARRAY['30000000-0000-0000-0000-000000000001']::UUID[], '2026-04-10T10:15:00+05:30', 'Masterclass', '10000000-0000-0000-0000-000000000003', TRUE),
  ('40000000-0000-0000-0000-000000000002', 'Sneha Kulkarni', '919876543210', 'sneha@example.com', 'Pune', 'Maharashtra', ARRAY['30000000-0000-0000-0000-000000000003']::UUID[], '2026-04-09T18:10:00+05:30', 'Website', '10000000-0000-0000-0000-000000000003', TRUE),
  ('40000000-0000-0000-0000-000000000003', 'Ajmal Rahman', '919876500001', 'ajmal@example.com', 'Malappuram', 'Kerala', ARRAY['30000000-0000-0000-0000-000000000002']::UUID[], '2026-04-08T14:20:00+05:30', 'WhatsApp', '10000000-0000-0000-0000-000000000003', TRUE)
ON CONFLICT (id) DO NOTHING;

INSERT INTO webinars (
  id, title, slug, type, instructor_id, category, language, description, start_time, end_time,
  livekit_room_name, host_token, attendee_token, host_url, attendee_url, short_host_url, short_attendee_url,
  ui_type, server_no, product_ids, payment_required, price_inr, razorpay_link, status, peak_attendance,
  total_entries, total_attendees, is_simulation, created_by
)
VALUES
  (
    '50000000-0000-0000-0000-000000000001',
    'Indian Market Masterclass',
    'indian-market-masterclass-april',
    'MASTERCLASS',
    '20000000-0000-0000-0000-000000000001',
    'Indian',
    'Malayalam',
    'Luxury-style conversion masterclass for Indian market learners.',
    '2026-04-10T19:00:00+05:30',
    '2026-04-10T21:00:00+05:30',
    'llw-room-001',
    'demo-host-token',
    'demo-attendee-token',
    '/webinar/host/llw-room-001',
    '/webinar/attend/llw-room-001',
    'https://tinyurl.com/llw-host-001',
    'https://tinyurl.com/llw-att-001',
    'WEBINAR',
    'Livekit-New-06',
    ARRAY['30000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000003']::UUID[],
    FALSE,
    0,
    '',
    'LIVE',
    612,
    904,
    688,
    FALSE,
    '10000000-0000-0000-0000-000000000001'
  ),
  (
    '50000000-0000-0000-0000-000000000002',
    'Forex Conversion Bootcamp Preview',
    'forex-conversion-preview',
    'BOOTCAMP',
    '20000000-0000-0000-0000-000000000006',
    'Forex',
    'English',
    'Preview room for premium forex conversion.',
    '2026-04-11T11:00:00+05:30',
    '2026-04-11T13:00:00+05:30',
    'llw-room-002',
    'demo-host-token-2',
    'demo-attendee-token-2',
    '/webinar/host/llw-room-002',
    '/webinar/attend/llw-room-002',
    'https://tinyurl.com/llw-host-002',
    'https://tinyurl.com/llw-att-002',
    'MEETING',
    'Livekit-New-08',
    ARRAY['30000000-0000-0000-0000-000000000002']::UUID[],
    TRUE,
    3999900,
    'https://rzp.io/l/llw-webinar-002',
    'SCHEDULED',
    0,
    0,
    0,
    TRUE,
    '10000000-0000-0000-0000-000000000002'
  )
ON CONFLICT (id) DO NOTHING;

INSERT INTO orders (
  id, order_number, student_id, product_id, webinar_id, amount_inr, status,
  razorpay_order_id, razorpay_payment_id, razorpay_signature, utm_source, utm_medium, utm_campaign, bda_id
)
VALUES
  ('60000000-0000-0000-0000-000000000001', 'LLW-20260410-001', '40000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', 3999900, 'PAID', 'order_001', 'pay_001', 'sig_001', 'meta', 'cpc', 'april-masterclass', '10000000-0000-0000-0000-000000000003'),
  ('60000000-0000-0000-0000-000000000002', 'LLW-20260409-004', '40000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000003', NULL, 5999900, 'PAID', 'order_002', 'pay_002', 'sig_002', 'whatsapp', 'broadcast', 'ctp-promo', '10000000-0000-0000-0000-000000000003'),
  ('60000000-0000-0000-0000-000000000003', 'LLW-20260408-011', '40000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000002', 3999900, 'PENDING', 'order_003', NULL, NULL, 'youtube', 'organic', 'forex-preview', '10000000-0000-0000-0000-000000000003')
ON CONFLICT (id) DO NOTHING;

INSERT INTO webinar_attendance (
  id, webinar_id, student_id, name, phone, join_time, leave_time, duration_mins, device, rating, enroll_clicks, payment_status, connection_quality
)
VALUES
  ('70000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 'Abhinav Menon', '919645812284', '2026-04-10T19:02:00+05:30', '2026-04-10T20:45:00+05:30', 103, 'Mobile', 4.60, 2, 'PAID', 92.00),
  ('70000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000002', 'Sneha Kulkarni', '919876543210', '2026-04-10T19:10:00+05:30', '2026-04-10T20:32:00+05:30', 82, 'Desktop', 4.40, 1, 'PAID', 89.00),
  ('70000000-0000-0000-0000-000000000003', '50000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000003', 'Ajmal Rahman', '919876500001', '2026-04-10T19:15:00+05:30', '2026-04-10T20:05:00+05:30', 50, 'Android App', 4.10, 0, 'PENDING', 78.00)
ON CONFLICT (id) DO NOTHING;
