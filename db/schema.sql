CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(200) NOT NULL,
  email VARCHAR(200) UNIQUE NOT NULL,
  password TEXT NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('SUPER_ADMIN', 'ADMIN', 'BDA')),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE instructors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  market_type VARCHAR(20) NOT NULL CHECK (market_type IN ('INDIAN', 'FOREX', 'BOTH')),
  languages TEXT[] NOT NULL,
  bio TEXT,
  short_bio VARCHAR(300),
  photo_url TEXT,
  experience_years INT,
  speciality TEXT,
  linkedin_url TEXT,
  youtube_url TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  display_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(200) NOT NULL,
  slug VARCHAR(200) UNIQUE NOT NULL,
  mode VARCHAR(10) NOT NULL CHECK (mode IN ('ONLINE', 'OFFLINE')),
  category VARCHAR(30) NOT NULL CHECK (category IN ('INDIAN', 'FOREX', 'CTP', 'INDIAN_LIVEX0', 'FOREX_LIVEX0', 'CTP_LIVEX0')),
  price INTEGER NOT NULL,
  discounted_price INTEGER NOT NULL,
  duration_months INT DEFAULT 6,
  short_description TEXT,
  long_description TEXT,
  banner_url TEXT,
  whatsapp_group_url TEXT,
  welcome_kit_url TEXT,
  onboarding_form_url TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  razorpay_plan_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(200),
  phone VARCHAR(20) UNIQUE NOT NULL,
  email VARCHAR(200),
  city TEXT,
  state TEXT,
  dob DATE,
  product_ids UUID[],
  enrolled_at TIMESTAMPTZ,
  source TEXT,
  bda_id UUID REFERENCES admin_users(id),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE webinars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(300) NOT NULL,
  slug VARCHAR(300) UNIQUE NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('MASTERCLASS', 'BOOTCAMP')),
  instructor_id UUID REFERENCES instructors(id),
  category VARCHAR(30),
  language VARCHAR(50),
  description TEXT,
  banner_url TEXT,
  thumbnail_url TEXT,
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  livekit_room_name TEXT UNIQUE,
  host_token TEXT,
  attendee_token TEXT,
  host_url TEXT,
  attendee_url TEXT,
  short_host_url TEXT,
  short_attendee_url TEXT,
  ui_type VARCHAR(20) DEFAULT 'WEBINAR' CHECK (ui_type IN ('WEBINAR', 'MEETING')),
  server_no VARCHAR(50),
  product_ids UUID[],
  payment_required BOOLEAN DEFAULT FALSE,
  price_inr INTEGER DEFAULT 0,
  razorpay_link TEXT,
  status VARCHAR(20) DEFAULT 'SCHEDULED' CHECK (status IN ('SCHEDULED', 'LIVE', 'ENDED', 'CANCELLED')),
  peak_attendance INTEGER DEFAULT 0,
  total_entries INTEGER DEFAULT 0,
  total_attendees INTEGER DEFAULT 0,
  is_simulation BOOLEAN DEFAULT FALSE,
  created_by UUID REFERENCES admin_users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE bootcamps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(300) NOT NULL,
  slug VARCHAR(300) UNIQUE NOT NULL,
  sub_heading VARCHAR(500),
  short_description TEXT,
  long_description TEXT,
  instructor_id UUID REFERENCES instructors(id),
  facilitator_id UUID REFERENCES admin_users(id),
  price INTEGER NOT NULL,
  discounted_price INTEGER NOT NULL,
  duration INT,
  duration_type VARCHAR(20) DEFAULT 'Months',
  subcategories TEXT[],
  banner_url TEXT,
  show_gold_card BOOLEAN DEFAULT FALSE,
  bx_level INT DEFAULT 1,
  whatsapp_group_url TEXT,
  welcome_kit_url TEXT,
  onboarding_form_url TEXT,
  token_whatsapp_url TEXT,
  doubt_form_url TEXT,
  public_page_url TEXT,
  razorpay_link TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number VARCHAR(50) UNIQUE NOT NULL,
  student_id UUID REFERENCES students(id),
  product_id UUID REFERENCES products(id),
  bootcamp_id UUID REFERENCES bootcamps(id),
  webinar_id UUID REFERENCES webinars(id),
  amount_inr INTEGER NOT NULL,
  status VARCHAR(20) CHECK (status IN ('PENDING', 'PAID', 'FAILED', 'REFUNDED')),
  razorpay_order_id TEXT,
  razorpay_payment_id TEXT,
  razorpay_signature TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  bda_id UUID REFERENCES admin_users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE webinar_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webinar_id UUID REFERENCES webinars(id),
  student_id UUID REFERENCES students(id),
  name VARCHAR(200),
  phone VARCHAR(20),
  join_time TIMESTAMPTZ,
  leave_time TIMESTAMPTZ,
  duration_mins INT,
  device TEXT,
  rating NUMERIC(4, 2),
  enroll_clicks INT DEFAULT 0,
  payment_status VARCHAR(20),
  connection_quality NUMERIC(4, 2)
);

CREATE TABLE app_runtime_state (
  store_key TEXT PRIMARY KEY,
  payload JSONB NOT NULL,
  checksum TEXT NOT NULL,
  revision BIGINT NOT NULL DEFAULT 1,
  source TEXT NOT NULL DEFAULT 'server',
  last_reason TEXT NOT NULL DEFAULT 'persist',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
