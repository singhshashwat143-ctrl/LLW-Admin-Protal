const now = new Date("2026-04-10T13:00:00+05:30");
const oneRupeeInPaise = 100;
const priceMinusOneRupee = (amount) => Math.max(Number(amount || 0) - oneRupeeInPaise, 0);

const makeId = (prefix, value) => `${prefix}-${value}`;
const slugify = (value) =>
  String(value)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const instructors = [
  { id: "20000000-0000-0000-0000-000000000001", name: "Bibin", slug: "bibin", market_type: "INDIAN", languages: ["MALAYALAM", "HINDI"], experience_years: 8, speciality: "Indian Market", short_bio: "Malayalam-first Indian market mentor.", is_active: true, display_order: 1, photo_url: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=300&q=80" },
  { id: "20000000-0000-0000-0000-000000000002", name: "Deepanshu", slug: "deepanshu", market_type: "INDIAN", languages: ["ENGLISH"], experience_years: 7, speciality: "Indian Market", short_bio: "Structured trading systems and execution.", is_active: true, display_order: 2, photo_url: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=300&q=80" },
  { id: "20000000-0000-0000-0000-000000000003", name: "Basavaraj", slug: "basavaraj", market_type: "INDIAN", languages: ["ENGLISH"], experience_years: 9, speciality: "Indian Market", short_bio: "Discipline-led setups and live sessions.", is_active: true, display_order: 3, photo_url: "https://images.unsplash.com/photo-1507591064344-4c6ce005b128?auto=format&fit=crop&w=300&q=80" },
  { id: "20000000-0000-0000-0000-000000000004", name: "Hari Krishnan", slug: "hari-krishnan", market_type: "INDIAN", languages: ["MALAYALAM", "ENGLISH"], experience_years: 6, speciality: "Indian Market", short_bio: "Malayalam and English classroom delivery.", is_active: true, display_order: 4, photo_url: "https://images.unsplash.com/photo-1504257432389-52343af06ae3?auto=format&fit=crop&w=300&q=80" },
  { id: "20000000-0000-0000-0000-000000000005", name: "Adithya Singh", slug: "adithya-singh", market_type: "INDIAN", languages: ["ENGLISH"], experience_years: 5, speciality: "Indian Market", short_bio: "High-energy market mindset sessions.", is_active: true, display_order: 5, photo_url: "https://images.unsplash.com/photo-1506795660198-e95c77602129?auto=format&fit=crop&w=300&q=80" },
  { id: "20000000-0000-0000-0000-000000000006", name: "Sachin", slug: "sachin", market_type: "FOREX", languages: ["MALAYALAM"], experience_years: 10, speciality: "Forex", short_bio: "Forex mentor for Malayalam audiences.", is_active: true, display_order: 6, photo_url: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=300&q=80" },
  { id: "20000000-0000-0000-0000-000000000007", name: "Dhanush", slug: "dhanush", market_type: "FOREX", languages: ["ENGLISH"], experience_years: 7, speciality: "Forex", short_bio: "Advanced forex strategy and drills.", is_active: true, display_order: 7, photo_url: "https://images.unsplash.com/photo-1541534401786-2077eed87a72?auto=format&fit=crop&w=300&q=80" },
  { id: "20000000-0000-0000-0000-000000000008", name: "Divyananth", slug: "divyananth", market_type: "FOREX", languages: ["ENGLISH"], experience_years: 8, speciality: "Forex", short_bio: "Conversion-focused forex mentor.", is_active: true, display_order: 8, photo_url: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=300&q=80" },
];

const products = [
  ["Indian Market (Online)", "indian-market-online", "ONLINE", "INDIAN", 4000000],
  ["Forex Market (Online)", "forex-market-online", "ONLINE", "FOREX", 4000000],
  ["Indian + Forex CTP (Online)", "indian-forex-ctp-online", "ONLINE", "CTP", 6000000],
  ["Indian + LiveX0 (Online)", "indian-livex0-online", "ONLINE", "INDIAN_LIVEX0", 5500000],
  ["Forex + LiveX0 (Online)", "forex-livex0-online", "ONLINE", "FOREX_LIVEX0", 5500000],
  ["CTP + LiveX0 (Online)", "ctp-livex0-online", "ONLINE", "CTP_LIVEX0", 7000000],
  ["Indian Market (Offline)", "indian-market-offline", "OFFLINE", "INDIAN", 7000000],
  ["Forex Market (Offline)", "forex-market-offline", "OFFLINE", "FOREX", 7000000],
  ["Indian + Forex CTP (Offline)", "indian-forex-ctp-offline", "OFFLINE", "CTP", 14000000],
  ["Indian + LiveX0 (Offline)", "indian-livex0-offline", "OFFLINE", "INDIAN_LIVEX0", 8500000],
  ["Forex + LiveX0 (Offline)", "forex-livex0-offline", "OFFLINE", "FOREX_LIVEX0", 8500000],
  ["CTP + LiveX0 (Offline)", "ctp-livex0-offline", "OFFLINE", "CTP_LIVEX0", 17000000],
].map((item, index) => ({
  id: `30000000-0000-0000-0000-${String(index + 1).padStart(12, "0")}`,
  name: item[0],
  slug: item[1],
  mode: item[2],
  category: item[3],
  price: item[4],
  discounted_price: priceMinusOneRupee(item[4]),
  duration_months: 6,
  short_description: `${item[0]} intensive program.`,
  long_description: `${item[0]} with mentorship, live sessions, and action plans.`,
  whatsapp_group_url: "https://chat.whatsapp.com/demo-group",
  welcome_kit_url: "https://livelongwealth-assets.s3.amazonaws.com/welcome-kit.pdf",
  onboarding_form_url: "https://forms.gle/demo-onboarding",
  is_active: true,
  razorpay_plan_id: `plan_${index + 1}`,
}));

const team = [
  { id: "10000000-0000-0000-0000-000000000001", name: "Shashwat Singh", email: "shashwat@livelongwealth.com", role: "SUPER_ADMIN", is_active: true, password: "$2b$10$demo.hash.value" },
  { id: "10000000-0000-0000-0000-000000000002", name: "Nisha Rao", email: "nisha@livelongwealth.com", role: "ADMIN", is_active: true, password: "$2b$10$demo.hash.value" },
  { id: "10000000-0000-0000-0000-000000000003", name: "Rahul Bhat", email: "rahul@livelongwealth.com", role: "BDA", is_active: true, password: "$2b$10$demo.hash.value" },
  { id: "7f3e29b8-8e31-4f3e-bcc8-3d5c1f6b2d10", name: "Dhanush", email: "dhanush@livelongwealth.com", role: "ADMIN", is_active: true, password: "google-oauth" },
];

const students = [
  { id: makeId("student", "001"), name: "Abhinav Menon", phone: "919645812284", email: "abhinav@example.com", city: "Kochi", state: "Kerala", product_ids: [products[0].id], enrolled_at: "2026-04-10T10:15:00+05:30", source: "Masterclass", bda_id: team[2].id, is_active: true, created_at: "2026-04-10T10:00:00+05:30" },
  { id: makeId("student", "002"), name: "Sneha Kulkarni", phone: "919876543210", email: "sneha@example.com", city: "Pune", state: "Maharashtra", product_ids: [products[2].id], enrolled_at: "2026-04-09T18:10:00+05:30", source: "Website", bda_id: team[2].id, is_active: true, created_at: "2026-04-09T17:50:00+05:30" },
  { id: makeId("student", "003"), name: "Ajmal Rahman", phone: "919876500001", email: "ajmal@example.com", city: "Malappuram", state: "Kerala", product_ids: [products[1].id], enrolled_at: "2026-04-08T14:20:00+05:30", source: "WhatsApp", bda_id: team[2].id, is_active: true, created_at: "2026-04-08T13:55:00+05:30" },
];

const links = [
  { id: makeId("link", "001"), label: "Bibin Host Link", original_url: "https://livelongwealth.com/webinar/host/llw-room-001", short_url: "https://tinyurl.com/llw-host-001", created_at: "2026-04-08T16:00:00+05:30" },
  { id: makeId("link", "002"), label: "Bibin Attendee Link", original_url: "https://livelongwealth.com/webinar/attend/llw-room-001", short_url: "https://tinyurl.com/llw-att-001", created_at: "2026-04-08T16:00:00+05:30" },
];

const bootcamps = [
  {
    id: makeId("bootcamp", "001"),
    title: "Indian Market Wealth Sprint",
    slug: "indian-market-wealth-sprint",
    sub_heading: "From market basics to action-ready execution",
    short_description: "Six-month guided bootcamp with live mentoring.",
    long_description: "<p>Learn setups, risk systems, and guided execution with mentor support.</p>",
    instructor_id: instructors[0].id,
    facilitator_id: team[2].id,
    price: 4000000,
    discounted_price: priceMinusOneRupee(4000000),
    duration: 6,
    duration_type: "Months",
    subcategories: ["Basics", "Psychology", "Execution"],
    banner_url: "https://images.unsplash.com/photo-1520607162513-77705c0f0d4a?auto=format&fit=crop&w=1200&q=80",
    show_gold_card: true,
    bx_level: 1,
    whatsapp_group_url: "https://chat.whatsapp.com/demo-group",
    welcome_kit_url: "https://livelongwealth-assets.s3.amazonaws.com/welcome-kit.pdf",
    onboarding_form_url: "https://forms.gle/demo-onboarding",
    token_whatsapp_url: "https://chat.whatsapp.com/demo-token",
    doubt_form_url: "https://forms.gle/demo-doubt",
    public_page_url: "https://livelongwealth.com/bootcamp/indian-market-wealth-sprint",
    razorpay_link: "https://rzp.io/l/llw-bootcamp-001",
    is_active: true,
    created_at: "2026-04-05T10:30:00+05:30",
    updated_at: "2026-04-10T09:00:00+05:30",
  },
];

const webinars = [
  {
    id: makeId("webinar", "001"),
    title: "Indian Market Masterclass",
    slug: "indian-market-masterclass-april",
    type: "MASTERCLASS",
    instructor_id: instructors[0].id,
    category: "Indian",
    language: "Malayalam",
    description: "Luxury-style conversion masterclass for Indian market learners.",
    banner_url: "https://images.unsplash.com/photo-1559526324-4b87b5e36e44?auto=format&fit=crop&w=1200&q=80",
    thumbnail_url: "https://images.unsplash.com/photo-1559526324-4b87b5e36e44?auto=format&fit=crop&w=600&q=80",
    start_time: "2026-04-10T19:00:00+05:30",
    end_time: "2026-04-10T21:00:00+05:30",
    livekit_room_name: "llw-room-001",
    host_token: "demo-host-token",
    attendee_token: "demo-attendee-token",
    host_url: "/webinar/host/llw-room-001",
    attendee_url: "/webinar/attend/llw-room-001",
    short_host_url: "https://tinyurl.com/llw-host-001",
    short_attendee_url: "https://tinyurl.com/llw-att-001",
    ui_type: "WEBINAR",
    server_no: "Livekit-New-06",
    product_ids: [products[0].id, products[2].id],
    payment_required: false,
    price_inr: 0,
    razorpay_link: "",
    status: "LIVE",
    peak_attendance: 612,
    total_entries: 904,
    total_attendees: 688,
    is_simulation: false,
    created_by: team[0].id,
    created_at: "2026-04-08T16:00:00+05:30",
    updated_at: "2026-04-10T18:55:00+05:30",
  },
  {
    id: makeId("webinar", "002"),
    title: "Forex Conversion Bootcamp Preview",
    slug: "forex-conversion-preview",
    type: "BOOTCAMP",
    instructor_id: instructors[5].id,
    category: "Forex",
    language: "English",
    description: "Preview room for premium forex conversion.",
    banner_url: "https://images.unsplash.com/photo-1642543492481-44e81e3914a7?auto=format&fit=crop&w=1200&q=80",
    thumbnail_url: "https://images.unsplash.com/photo-1642543492481-44e81e3914a7?auto=format&fit=crop&w=600&q=80",
    start_time: "2026-04-11T11:00:00+05:30",
    end_time: "2026-04-11T13:00:00+05:30",
    livekit_room_name: "llw-room-002",
    host_token: "demo-host-token-2",
    attendee_token: "demo-attendee-token-2",
    host_url: "/webinar/host/llw-room-002",
    attendee_url: "/webinar/attend/llw-room-002",
    short_host_url: "https://tinyurl.com/llw-host-002",
    short_attendee_url: "https://tinyurl.com/llw-att-002",
    ui_type: "MEETING",
    server_no: "Livekit-New-08",
    product_ids: [products[1].id],
    payment_required: true,
    price_inr: priceMinusOneRupee(products[1].price),
    razorpay_link: "https://rzp.io/l/llw-webinar-002",
    status: "SCHEDULED",
    peak_attendance: 0,
    total_entries: 0,
    total_attendees: 0,
    is_simulation: true,
    created_by: team[1].id,
    created_at: "2026-04-09T11:00:00+05:30",
    updated_at: "2026-04-09T11:00:00+05:30",
  },
];

const orders = [
  { id: makeId("order", "001"), order_number: "LLW-20260410-001", student_id: students[0].id, product_id: products[0].id, bootcamp_id: null, webinar_id: webinars[0].id, amount_inr: products[0].discounted_price, status: "PAID", razorpay_order_id: "order_001", razorpay_payment_id: "pay_001", razorpay_signature: "sig_001", utm_source: "meta", utm_medium: "cpc", utm_campaign: "april-masterclass", bda_id: team[2].id, created_at: "2026-04-10T10:15:00+05:30", updated_at: "2026-04-10T10:16:00+05:30" },
  { id: makeId("order", "002"), order_number: "LLW-20260409-004", student_id: students[1].id, product_id: products[2].id, bootcamp_id: bootcamps[0].id, webinar_id: null, amount_inr: products[2].discounted_price, status: "PAID", razorpay_order_id: "order_002", razorpay_payment_id: "pay_002", razorpay_signature: "sig_002", utm_source: "whatsapp", utm_medium: "broadcast", utm_campaign: "ctp-promo", bda_id: team[2].id, created_at: "2026-04-09T18:10:00+05:30", updated_at: "2026-04-09T18:12:00+05:30" },
  { id: makeId("order", "003"), order_number: "LLW-20260408-011", student_id: students[2].id, product_id: products[1].id, bootcamp_id: null, webinar_id: webinars[1].id, amount_inr: products[1].discounted_price, status: "PENDING", razorpay_order_id: "order_003", razorpay_payment_id: "", razorpay_signature: "", utm_source: "youtube", utm_medium: "organic", utm_campaign: "forex-preview", bda_id: team[2].id, created_at: "2026-04-08T14:20:00+05:30", updated_at: "2026-04-08T14:20:00+05:30" },
];

const webinarAttendance = [
  { id: makeId("att", "001"), webinar_id: webinars[0].id, student_id: students[0].id, name: "Abhinav Menon", phone: "919645812284", join_time: "2026-04-10T19:02:00+05:30", leave_time: "2026-04-10T20:45:00+05:30", duration_mins: 103, device: "Mobile", rating: 4.6, enroll_clicks: 2, payment_status: "PAID", connection_quality: 92, camera_duration: 0, mic_duration: 0, join_counts: 1, mic_toggle_count: 0, camera_toggle_count: 0 },
  { id: makeId("att", "002"), webinar_id: webinars[0].id, student_id: students[1].id, name: "Sneha Kulkarni", phone: "919876543210", join_time: "2026-04-10T19:10:00+05:30", leave_time: "2026-04-10T20:32:00+05:30", duration_mins: 82, device: "Desktop", rating: 4.4, enroll_clicks: 1, payment_status: "PAID", connection_quality: 89, camera_duration: 3, mic_duration: 1, join_counts: 2, mic_toggle_count: 1, camera_toggle_count: 2 },
  { id: makeId("att", "003"), webinar_id: webinars[0].id, student_id: students[2].id, name: "Ajmal Rahman", phone: "919876500001", join_time: "2026-04-10T19:15:00+05:30", leave_time: "2026-04-10T20:05:00+05:30", duration_mins: 50, device: "Android App", rating: 4.1, enroll_clicks: 0, payment_status: "PENDING", connection_quality: 78, camera_duration: 0, mic_duration: 0, join_counts: 1, mic_toggle_count: 0, camera_toggle_count: 0 },
];

const attendanceTimeline = [
  { minute: "19:00", concurrent: 120 },
  { minute: "19:15", concurrent: 288 },
  { minute: "19:30", concurrent: 412 },
  { minute: "19:45", concurrent: 510 },
  { minute: "20:00", concurrent: 612 },
  { minute: "20:15", concurrent: 548 },
  { minute: "20:30", concurrent: 471 },
  { minute: "20:45", concurrent: 362 },
  { minute: "21:00", concurrent: 190 },
];

function isSameDay(dateText, baseDate) {
  const date = new Date(dateText);
  return date.toDateString() === baseDate.toDateString();
}

function isWithinDays(dateText, days) {
  const date = new Date(dateText);
  const diff = now.getTime() - date.getTime();
  return diff >= 0 && diff <= days * 24 * 60 * 60 * 1000;
}

function buildDashboardStats() {
  const todayOrders = orders.filter((order) => order.status === "PAID" && isSameDay(order.created_at, now));
  const weekOrders = orders.filter((order) => order.status === "PAID" && isWithinDays(order.created_at, 7));
  const monthOrders = orders.filter((order) => order.status === "PAID" && isWithinDays(order.created_at, 30));

  return {
    todayRevenue: todayOrders.reduce((sum, order) => sum + order.amount_inr, 0),
    todayCount: todayOrders.length,
    weekRevenue: weekOrders.reduce((sum, order) => sum + order.amount_inr, 0),
    weekCount: weekOrders.length,
    monthRevenue: monthOrders.reduce((sum, order) => sum + order.amount_inr, 0),
    monthCount: monthOrders.length,
    activeWebinarsToday: webinars.filter((item) => item.status === "LIVE").length,
  };
}

function buildSalesSummary() {
  return [
    { label: "Today", amount: products[0].discounted_price, count: 1 },
    { label: "Yesterday", amount: products[2].discounted_price, count: 1 },
    { label: "This Week", amount: products[0].discounted_price + products[2].discounted_price, count: 2 },
    { label: "This Month", amount: products[0].discounted_price + products[2].discounted_price, count: 2 },
    { label: "Last Month", amount: 0, count: 0 },
  ];
}

function buildRevenueSeries() {
  return Array.from({ length: 12 }, (_, index) => ({
    label: ["May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr"][index],
    value: [45, 56, 72, 88, 61, 93, 110, 104, 96, 118, 134, 152][index],
  }));
}

function buildEnrollmentTrend() {
  return [
    { label: "Indian", value: 182 },
    { label: "Forex", value: 156 },
    { label: "CTP", value: 224 },
    { label: "LiveX0", value: 194 },
  ];
}

function buildPODSales() {
  return ["INDIAN", "FOREX", "CTP", "INDIAN_LIVEX0", "FOREX_LIVEX0", "CTP_LIVEX0"].map((category, index) => ({
    category,
    today: index < 2 ? 100 : 0,
    yesterday: index === 2 ? 100 : 0,
    week: index < 3 ? 100 : 0,
    month: index < 3 ? 100 : 0,
    lastMonth: 0,
  }));
}

function attachInstructor(record) {
  return { ...record, instructor: instructors.find((item) => item.id === record.instructor_id) ?? null };
}

function attachProduct(record) {
  return { ...record, product: products.find((item) => item.id === record.product_id) ?? null };
}

function attachOrder(record) {
  return {
    ...record,
    student: students.find((item) => item.id === record.student_id) ?? null,
    product: products.find((item) => item.id === record.product_id) ?? null,
    bda: team.find((item) => item.id === record.bda_id) ?? null,
  };
}

function attachBootcamp(record) {
  return {
    ...record,
    instructor: instructors.find((item) => item.id === record.instructor_id) ?? null,
    facilitator: team.find((item) => item.id === record.facilitator_id) ?? null,
  };
}

function generateShortUrl(label) {
  const alias = slugify(label).slice(0, 18);
  return `https://tinyurl.com/${alias || "llw-link"}`;
}

function createWebinarRecord(input) {
  const roomName = `llw-${crypto.randomUUID()}`;
  const slug = slugify(input.title);
  const hostUrl = `/webinar/host/${roomName}`;
  const attendeeUrl = `/webinar/attend/${roomName}`;
  return {
    id: crypto.randomUUID(),
    title: input.title,
    slug,
    type: input.type ?? "MASTERCLASS",
    instructor_id: input.instructor_id ?? null,
    category: input.category ?? "Finance",
    language: input.language ?? "English",
    description: input.description ?? "",
    banner_url: input.banner_url ?? "",
    thumbnail_url: input.thumbnail_url ?? "",
    start_time: input.start_time,
    end_time: input.end_time,
    livekit_room_name: roomName,
    host_token: `host-${roomName}`,
    attendee_token: `attendee-${roomName}`,
    host_url: hostUrl,
    attendee_url: attendeeUrl,
    short_host_url: generateShortUrl(`${slug}-host`),
    short_attendee_url: generateShortUrl(`${slug}-attendee`),
    ui_type: input.ui_type ?? "WEBINAR",
    server_no: input.server_no ?? "Livekit-New-01",
    product_ids: input.product_ids ?? [],
    payment_required: Boolean(input.payment_required),
    price_inr: Number(input.price_inr ?? 0),
    razorpay_link: input.razorpay_link ?? "",
    status: input.status ?? "SCHEDULED",
    peak_attendance: 0,
    total_entries: 0,
    total_attendees: 0,
    is_simulation: Boolean(input.is_simulation),
    created_by: input.created_by ?? team[0].id,
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
  };
}

export function createDashboardStore() {
  return {
    data: {
      now,
      instructors: structuredClone(instructors),
      products: structuredClone(products),
      team: structuredClone(team),
      students: structuredClone(students),
      webinars: structuredClone(webinars),
      bootcamps: structuredClone(bootcamps),
      orders: structuredClone(orders),
      links: structuredClone(links),
      webinarAttendance: structuredClone(webinarAttendance),
      attendanceTimeline: structuredClone(attendanceTimeline),
    },
    getOverview() {
      return {
        stats: buildDashboardStats(),
        revenueSeries: buildRevenueSeries(),
        enrollmentTrend: buildEnrollmentTrend(),
        recentOrders: this.data.orders.map(attachOrder).slice(0, 10),
        upcomingWebinars: this.data.webinars.map(attachInstructor).filter((item) => ["LIVE", "SCHEDULED"].includes(item.status)),
      };
    },
    getSalesSummary() {
      return {
        summary: buildSalesSummary(),
        monthlyRevenue: buildRevenueSeries(),
        podSales: buildPODSales(),
      };
    },
    getTracker(teacher) {
      const rows = this.data.webinars.map(attachInstructor);
      return rows.filter((row) => !teacher || teacher === "ALL" || row.instructor?.id === teacher);
    },
    createWebinar(input) {
      const record = createWebinarRecord(input);
      this.data.webinars.unshift(record);
      this.data.links.unshift(
        { id: crypto.randomUUID(), label: `${record.title} Host`, original_url: record.host_url, short_url: record.short_host_url, created_at: now.toISOString() },
        { id: crypto.randomUUID(), label: `${record.title} Attendee`, original_url: record.attendee_url, short_url: record.short_attendee_url, created_at: now.toISOString() },
      );
      return attachInstructor(record);
    },
    createShortLink(input) {
      const record = {
        id: crypto.randomUUID(),
        label: input.label || "Custom link",
        original_url: input.original_url,
        short_url: generateShortUrl(input.label || "custom-link"),
        created_at: now.toISOString(),
      };
      this.data.links.unshift(record);
      return record;
    },
  };
}

export const constants = {
  serverOptions: Array.from({ length: 12 }, (_, index) => `Livekit-New-${String(index + 1).padStart(2, "0")}`),
  roles: ["SUPER_ADMIN", "ADMIN", "BDM", "OPERATIONS", "MARKETING", "BDA"],
  webinarTimeline: attendanceTimeline,
};
