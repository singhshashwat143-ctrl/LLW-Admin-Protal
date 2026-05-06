INSERT INTO admin_users (id, name, email, password, role, is_active) VALUES
  ('10000000-0000-0000-0000-000000000001', 'Shashwat Singh', 'shashwat@livelongwealth.com', '$2b$10$demo.hash.value', 'SUPER_ADMIN', TRUE),
  ('10000000-0000-0000-0000-000000000002', 'Nisha Rao', 'nisha@livelongwealth.com', '$2b$10$demo.hash.value', 'ADMIN', TRUE),
  ('10000000-0000-0000-0000-000000000003', 'Rahul Bhat', 'rahul@livelongwealth.com', '$2b$10$demo.hash.value', 'BDA', TRUE),
  ('7f3e29b8-8e31-4f3e-bcc8-3d5c1f6b2d10', 'Dhanush', 'dhanush@livelongwealth.com', 'google-oauth', 'ADMIN', TRUE);

INSERT INTO instructors (id, name, slug, market_type, languages, short_bio, experience_years, speciality, is_active, display_order) VALUES
  ('20000000-0000-0000-0000-000000000001', 'Bibin', 'bibin', 'INDIAN', ARRAY['MALAYALAM', 'HINDI'], 'Indian market mentor with strong classroom engagement.', 8, 'Indian market', TRUE, 1),
  ('20000000-0000-0000-0000-000000000002', 'Deepanshu', 'deepanshu', 'INDIAN', ARRAY['ENGLISH'], 'Focuses on structured market education.', 7, 'Indian market', TRUE, 2),
  ('20000000-0000-0000-0000-000000000003', 'Basavaraj', 'basavaraj', 'INDIAN', ARRAY['ENGLISH'], 'Practical setups and disciplined execution.', 9, 'Indian market', TRUE, 3),
  ('20000000-0000-0000-0000-000000000004', 'Hari Krishnan', 'hari-krishnan', 'INDIAN', ARRAY['MALAYALAM', 'ENGLISH'], 'Malayalam-first mentor for Indian market learners.', 6, 'Indian market', TRUE, 4),
  ('20000000-0000-0000-0000-000000000005', 'Adithya Singh', 'adithya-singh', 'INDIAN', ARRAY['ENGLISH'], 'Momentum and mindset sessions for new traders.', 5, 'Indian market', TRUE, 5),
  ('20000000-0000-0000-0000-000000000006', 'Sachin', 'sachin', 'FOREX', ARRAY['MALAYALAM'], 'Forex sessions with Malayalam delivery.', 10, 'Forex', TRUE, 6),
  ('20000000-0000-0000-0000-000000000007', 'Dhanush', 'dhanush', 'FOREX', ARRAY['ENGLISH'], 'Forex strategy sessions and live drills.', 7, 'Forex', TRUE, 7),
  ('20000000-0000-0000-0000-000000000008', 'Divyananth', 'divyananth', 'FOREX', ARRAY['ENGLISH'], 'Forex mentor for advanced conversion webinars.', 8, 'Forex', TRUE, 8);

INSERT INTO products (id, name, slug, mode, category, price, discounted_price, duration_months, is_active) VALUES
  ('30000000-0000-0000-0000-000000000001', 'Indian Market (Online)', 'indian-market-online', 'ONLINE', 'INDIAN', 4000000, 3999900, 6, TRUE),
  ('30000000-0000-0000-0000-000000000002', 'Forex Market (Online)', 'forex-market-online', 'ONLINE', 'FOREX', 4000000, 3999900, 6, TRUE),
  ('30000000-0000-0000-0000-000000000003', 'Indian + Forex CTP (Online)', 'indian-forex-ctp-online', 'ONLINE', 'CTP', 6000000, 5999900, 6, TRUE),
  ('30000000-0000-0000-0000-000000000004', 'Indian + LiveX0 (Online)', 'indian-livex0-online', 'ONLINE', 'INDIAN_LIVEX0', 5500000, 5499900, 6, TRUE),
  ('30000000-0000-0000-0000-000000000005', 'Forex + LiveX0 (Online)', 'forex-livex0-online', 'ONLINE', 'FOREX_LIVEX0', 5500000, 5499900, 6, TRUE),
  ('30000000-0000-0000-0000-000000000006', 'CTP + LiveX0 (Online)', 'ctp-livex0-online', 'ONLINE', 'CTP_LIVEX0', 7000000, 6999900, 6, TRUE),
  ('30000000-0000-0000-0000-000000000007', 'Indian Market (Offline)', 'indian-market-offline', 'OFFLINE', 'INDIAN', 7000000, 6999900, 6, TRUE),
  ('30000000-0000-0000-0000-000000000008', 'Forex Market (Offline)', 'forex-market-offline', 'OFFLINE', 'FOREX', 7000000, 6999900, 6, TRUE),
  ('30000000-0000-0000-0000-000000000009', 'Indian + Forex CTP (Offline)', 'indian-forex-ctp-offline', 'OFFLINE', 'CTP', 14000000, 13999900, 6, TRUE),
  ('30000000-0000-0000-0000-000000000010', 'Indian + LiveX0 (Offline)', 'indian-livex0-offline', 'OFFLINE', 'INDIAN_LIVEX0', 8500000, 8499900, 6, TRUE),
  ('30000000-0000-0000-0000-000000000011', 'Forex + LiveX0 (Offline)', 'forex-livex0-offline', 'OFFLINE', 'FOREX_LIVEX0', 8500000, 8499900, 6, TRUE),
  ('30000000-0000-0000-0000-000000000012', 'CTP + LiveX0 (Offline)', 'ctp-livex0-offline', 'OFFLINE', 'CTP_LIVEX0', 17000000, 16999900, 6, TRUE);
