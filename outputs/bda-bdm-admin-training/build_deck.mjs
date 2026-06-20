const fs = await import("node:fs/promises");
const path = await import("node:path");
const { Presentation, PresentationFile } = await import("@oai/artifact-tool");

const W = 1280;
const H = 720;

const DECK_ID = "bda-bdm-admin-training";
const OUT_DIR = "/Users/shashwatsingh/Desktop/llw_webinare/outputs/bda-bdm-admin-training";
const SCRATCH_DIR = "/Users/shashwatsingh/Desktop/llw_webinare/tmp/slides/bda-bdm-admin-training";
const PREVIEW_DIR = path.join(SCRATCH_DIR, "preview");
const VERIFICATION_DIR = path.join(SCRATCH_DIR, "verification");
const INSPECT_PATH = path.join(SCRATCH_DIR, "inspect.ndjson");

const ASSETS = {
  logo: "/Users/shashwatsingh/Desktop/llw_webinare/src/assets/logo.png",
  adminPreview: "/Users/shashwatsingh/Desktop/llw_webinare/outputs/bda-bdm-admin-training/refs/admin.html.png",
  webinarPreview: "/Users/shashwatsingh/Desktop/llw_webinare/outputs/bda-bdm-admin-training/refs/webinar.html.png",
  databasePreview: "/Users/shashwatsingh/Desktop/llw_webinare/outputs/bda-bdm-admin-training/refs/database.html.png",
};

const BG = "#F6F8FC";
const NAVY = "#0F172A";
const SLATE = "#334155";
const MUTED = "#64748B";
const WHITE = "#FFFFFF";
const BORDER = "#E2E8F0";
const INDIGO = "#4F46E5";
const INDIGO_SOFT = "#EEF2FF";
const GOLD = "#D4A72C";
const GOLD_SOFT = "#FEF3C7";
const GREEN = "#10B981";
const GREEN_SOFT = "#D1FAE5";
const RED = "#EF4444";
const RED_SOFT = "#FEE2E2";
const SKY_SOFT = "#E0F2FE";
const TEAL = "#0F766E";
const TEAL_SOFT = "#CCFBF1";
const TRANSPARENT = "#00000000";

const TITLE_FACE = "Poppins";
const BODY_FACE = "Lato";
const MONO_FACE = "Aptos Mono";

const SOURCES = {
  routing: "Application routes and modules: src/App.tsx, src/components/Sidebar.tsx",
  permissions: "Role permissions and restriction copy: src/lib/permissions.ts",
  dashboard: "Dashboard and team visibility copy: src/pages/Dashboard.tsx, src/pages/Team.tsx",
  onboarding: "BDA onboarding and AiSensy payment-link flow: src/pages/Onboarding.tsx",
  payments: "Payments board, recovery links, and checkout behavior: src/pages/Payments.tsx",
  tracker: "Tracker and recovery follow-up flow: src/pages/Tracker.tsx",
  operations: "Operations queue and fulfilment checklist: src/pages/Operations.tsx",
  refunds: "Refund workflow and admin approval behavior: src/pages/Refunds.tsx",
  exports: "Exports filter behavior and access scope: src/pages/Exports.tsx",
  server: "Payment verification and AiSensy endpoints: server/webinar-server.mjs",
  schema: "Order, student, and payment entities: db/schema.sql, server/data-store.mjs",
  staticViews: "Static product overview pages used as support visuals: admin.html, webinar.html, database.html",
};

const inspectRecords = [];

async function ensureDirs() {
  await fs.mkdir(OUT_DIR, { recursive: true });
  await fs.mkdir(SCRATCH_DIR, { recursive: true });
  await fs.mkdir(PREVIEW_DIR, { recursive: true });
  await fs.mkdir(VERIFICATION_DIR, { recursive: true });
}

async function readImageBlob(imagePath) {
  const bytes = await fs.readFile(imagePath);
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

function lineConfig(fill = TRANSPARENT, width = 0) {
  return { style: "solid", fill, width };
}

function normalizeText(text) {
  if (Array.isArray(text)) return text.map((item) => String(item ?? "")).join("\n");
  return String(text ?? "");
}

function textLineCount(text) {
  const value = normalizeText(text);
  if (!value.trim()) return 0;
  return Math.max(1, value.split(/\n/).length);
}

function requiredTextHeight(text, fontSize, lineHeight = 1.18, minHeight = 8) {
  const lines = textLineCount(text);
  if (!lines) return minHeight;
  return Math.max(minHeight, lines * fontSize * lineHeight);
}

function assertTextFits(text, boxHeight, fontSize, role = "text") {
  const required = requiredTextHeight(text, fontSize);
  const tolerance = Math.max(2, fontSize * 0.08);
  if (normalizeText(text).trim() && boxHeight + tolerance < required) {
    throw new Error(`${role} text box too short. height=${boxHeight}, required>=${required}`);
  }
}

function wrapText(text, widthChars) {
  const words = normalizeText(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > widthChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines.join("\n");
}

function recordShape(slideNo, shape, role, shapeType, x, y, w, h) {
  inspectRecords.push({
    kind: "shape",
    slide: slideNo,
    id: shape?.id || `slide-${slideNo}-${role}-${inspectRecords.length + 1}`,
    role,
    shapeType,
    bbox: [x, y, w, h],
  });
}

function recordText(slideNo, shape, role, text, x, y, w, h) {
  const value = normalizeText(text);
  inspectRecords.push({
    kind: "textbox",
    slide: slideNo,
    id: shape?.id || `slide-${slideNo}-${role}-${inspectRecords.length + 1}`,
    role,
    text: value,
    textPreview: value.replace(/\n/g, " | ").slice(0, 180),
    textChars: value.length,
    textLines: textLineCount(value),
    bbox: [x, y, w, h],
  });
}

function recordImage(slideNo, image, role, imagePath, x, y, w, h) {
  inspectRecords.push({
    kind: "image",
    slide: slideNo,
    id: image?.id || `slide-${slideNo}-${role}-${inspectRecords.length + 1}`,
    role,
    path: imagePath,
    bbox: [x, y, w, h],
  });
}

function addShape(slide, slideNo, geometry, x, y, w, h, fill = TRANSPARENT, line = TRANSPARENT, lineWidth = 0, role = geometry) {
  const shape = slide.shapes.add({
    geometry,
    position: { left: x, top: y, width: w, height: h },
    fill,
    line: lineConfig(line, lineWidth),
  });
  recordShape(slideNo, shape, role, geometry, x, y, w, h);
  return shape;
}

function addText(
  slide,
  slideNo,
  text,
  x,
  y,
  w,
  h,
  {
    size = 22,
    color = NAVY,
    bold = false,
    face = BODY_FACE,
    align = "left",
    valign = "top",
    fill = TRANSPARENT,
    line = TRANSPARENT,
    lineWidth = 0,
    role = "text",
    checkFit = true,
  } = {},
) {
  if (checkFit) assertTextFits(text, h, size, role);
  const box = addShape(slide, slideNo, "rect", x, y, w, h, fill, line, lineWidth, role);
  box.text = text;
  box.text.fontSize = size;
  box.text.color = color;
  box.text.bold = bold;
  box.text.typeface = face;
  box.text.alignment = align;
  box.text.verticalAlignment = valign;
  box.text.insets = { left: 0, right: 0, top: 0, bottom: 0 };
  box.text.autoFit = "shrinkText";
  recordText(slideNo, box, role, text, x, y, w, h);
  return box;
}

async function addImage(slide, slideNo, imagePath, x, y, w, h, role, fit = "contain") {
  const image = slide.images.add({
    blob: await readImageBlob(imagePath),
    fit,
    alt: role,
    geometry: "roundRect",
  });
  image.position = { left: x, top: y, width: w, height: h };
  image.geometry = "roundRect";
  recordImage(slideNo, image, role, imagePath, x, y, w, h);
  return image;
}

function addPill(slide, slideNo, text, x, y, w, h, fill, color, role = "pill") {
  addShape(slide, slideNo, "roundRect", x, y, w, h, fill, TRANSPARENT, 0, role);
  addText(slide, slideNo, text, x + 12, y + 6, w - 24, h - 10, {
    size: 11,
    color,
    bold: true,
    face: MONO_FACE,
    align: "center",
    valign: "mid",
    role: `${role} label`,
  });
}

function addPanel(slide, slideNo, x, y, w, h, fill = WHITE, line = BORDER, lineWidth = 1.2, role = "panel") {
  return addShape(slide, slideNo, "roundRect", x, y, w, h, fill, line, lineWidth, role);
}

function addBulletLines(lines) {
  return lines.map((line) => `• ${line}`).join("\n");
}

function addCard(slide, slideNo, x, y, w, h, title, body, accentFill = INDIGO_SOFT, accentText = INDIGO, role = "card") {
  addPanel(slide, slideNo, x, y, w, h, WHITE, BORDER, 1.2, `${role} panel`);
  addShape(slide, slideNo, "rect", x, y, w, 6, accentText, TRANSPARENT, 0, `${role} accent`);
  addText(slide, slideNo, title, x + 20, y + 18, w - 40, 24, {
    size: 16,
    color: NAVY,
    bold: true,
    face: TITLE_FACE,
    role: `${role} title`,
  });
  addText(slide, slideNo, wrapText(body, Math.max(30, Math.floor(w / 11))), x + 20, y + 54, w - 40, h - 68, {
    size: 13,
    color: SLATE,
    face: BODY_FACE,
    role: `${role} body`,
    checkFit: false,
  });
}

async function addScreenshotCard(slide, slideNo, imagePath, x, y, w, h, title, caption) {
  addPanel(slide, slideNo, x, y, w, h, WHITE, BORDER, 1.2, "screenshot panel");
  await addImage(slide, slideNo, imagePath, x + 18, y + 18, w - 36, h - 96, "product screenshot", "contain");
  addText(slide, slideNo, title, x + 18, y + h - 68, w - 36, 24, {
    size: 15,
    color: NAVY,
    bold: true,
    face: TITLE_FACE,
    role: "screenshot title",
  });
  addText(slide, slideNo, caption, x + 18, y + h - 42, w - 36, 22, {
    size: 11,
    color: MUTED,
    face: BODY_FACE,
    role: "screenshot caption",
  });
}

function addStepCard(slide, slideNo, index, title, body, x, y, w, h, fill = WHITE, accent = INDIGO) {
  addPanel(slide, slideNo, x, y, w, h, fill, BORDER, 1.2, `step ${index}`);
  addShape(slide, slideNo, "ellipse", x + 18, y + 18, 36, 36, accent, TRANSPARENT, 0, `step ${index} marker`);
  addText(slide, slideNo, String(index), x + 18, y + 24, 36, 20, {
    size: 15,
    color: WHITE,
    bold: true,
    face: MONO_FACE,
    align: "center",
    role: `step ${index} number`,
  });
  addText(slide, slideNo, title, x + 66, y + 20, w - 84, 24, {
    size: 17,
    color: NAVY,
    bold: true,
    face: TITLE_FACE,
    role: `step ${index} title`,
  });
  addText(slide, slideNo, wrapText(body, Math.max(24, Math.floor(w / 11))), x + 20, y + 64, w - 40, h - 82, {
    size: 14,
    color: SLATE,
    face: BODY_FACE,
    role: `step ${index} body`,
    checkFit: false,
  });
}

function addArrow(slide, slideNo, x, y, w, h, fill = INDIGO_SOFT, line = INDIGO) {
  addShape(slide, slideNo, "rightArrow", x, y, w, h, fill, line, 1, "flow arrow");
}

function addSlideHeader(slide, slideNo, section, title, subtitle, { dark = false } = {}) {
  const ink = dark ? WHITE : NAVY;
  const subInk = dark ? "#CBD5E1" : MUTED;
  slide.background.fill = dark ? NAVY : BG;
  addShape(slide, slideNo, "ellipse", -120, -90, 360, 220, dark ? "#1E293B" : "#EAEFFE", TRANSPARENT, 0, "backdrop orb");
  addShape(slide, slideNo, "ellipse", 1010, 516, 300, 210, dark ? "#1D4ED8" : "#DBEAFE", TRANSPARENT, 0, "backdrop orb");
  addPill(slide, slideNo, section.toUpperCase(), 64, 34, 178, 30, dark ? "#1E293B" : INDIGO_SOFT, dark ? "#C7D2FE" : INDIGO, "section pill");
  addText(slide, slideNo, `${String(slideNo).padStart(2, "0")} / 09`, 1120, 40, 96, 18, {
    size: 12,
    color: subInk,
    bold: true,
    face: MONO_FACE,
    align: "right",
    role: "slide count",
    checkFit: false,
  });
  addText(slide, slideNo, title, 64, 84, 820, 82, {
    size: 34,
    color: ink,
    bold: true,
    face: TITLE_FACE,
    role: "title",
  });
  addText(slide, slideNo, subtitle, 64, 170, 820, 46, {
    size: 17,
    color: subInk,
    face: BODY_FACE,
    role: "subtitle",
  });
  addShape(slide, slideNo, "rect", 64, 228, 1152, 2, dark ? "#334155" : BORDER, TRANSPARENT, 0, "header rule");
}

function addFooter(slide, slideNo, text, { dark = false } = {}) {
  addText(slide, slideNo, text, 64, 688, 780, 16, {
    size: 11,
    color: dark ? "#94A3B8" : MUTED,
    face: BODY_FACE,
    role: "footer",
    checkFit: false,
  });
}

function addNotes(slide, body, sourceKeys) {
  const sourceLines = sourceKeys.map((key) => `- ${SOURCES[key] || key}`).join("\n");
  slide.speakerNotes.setText(`${body}\n\n[Sources]\n${sourceLines}`);
}

async function slide1(presentation) {
  const slideNo = 1;
  const slide = presentation.slides.add();
  slide.background.fill = NAVY;
  addShape(slide, slideNo, "ellipse", -140, -70, 380, 240, "#1E3A8A", TRANSPARENT, 0, "cover orb");
  addShape(slide, slideNo, "ellipse", 910, 470, 420, 250, "#312E81", TRANSPARENT, 0, "cover orb");
  addPanel(slide, slideNo, 56, 56, 700, 608, "#F8FAFC", TRANSPARENT, 0, "cover panel");
  await addImage(slide, slideNo, ASSETS.logo, 84, 78, 180, 68, "llw logo");
  addPill(slide, slideNo, "LLW APPLICATION TRAINING", 84, 164, 236, 30, INDIGO_SOFT, INDIGO, "cover eyebrow");
  addText(slide, slideNo, "BDA, BDM\n& Admin", 84, 214, 352, 116, {
    size: 42,
    color: NAVY,
    bold: true,
    face: TITLE_FACE,
    role: "cover title",
  });
  addText(
    slide,
    slideNo,
    "Training deck for usability of the application, role-based work areas, and the full customer journey from lead to fulfilment.",
    84,
    360,
    564,
    66,
    {
      size: 19,
      color: SLATE,
      face: BODY_FACE,
      role: "cover subtitle",
    },
  );
  addPill(slide, slideNo, "BDA", 84, 460, 88, 30, SKY_SOFT, INDIGO, "audience pill");
  addPill(slide, slideNo, "BDM", 182, 460, 88, 30, GOLD_SOFT, "#92400E", "audience pill");
  addPill(slide, slideNo, "ADMIN", 280, 460, 100, 30, GREEN_SOFT, "#065F46", "audience pill");
  addPanel(slide, slideNo, 84, 512, 592, 118, "#EEF4FF", TRANSPARENT, 0, "cover note");
  addText(
    slide,
    slideNo,
    "Focus for this session:\n• how teams use the app today\n• where each role should work\n• what happens after payment right now\n• what we may automate in future updates",
    104,
    536,
    548,
    92,
    {
      size: 14,
      color: SLATE,
      face: BODY_FACE,
      role: "cover note text",
    },
  );
  await addScreenshotCard(slide, slideNo, ASSETS.webinarPreview, 792, 74, 408, 180, "Webinar side", "Lead capture, live sessions, and conversion visibility");
  await addScreenshotCard(slide, slideNo, ASSETS.adminPreview, 752, 264, 448, 214, "Admin workspace", "Payments, onboarding, tracker, team, and fulfilment");
  await addScreenshotCard(slide, slideNo, ASSETS.databasePreview, 812, 490, 388, 146, "Shared data layer", "Orders, payments, refunds, students, and ops status stay connected");
  addFooter(slide, slideNo, "LLW internal training deck • April 2026", { dark: true });
  addNotes(
    slide,
    "Open with the shared objective: one connected workflow for revenue, operations, webinars, and fulfilment. Set the expectation that the deck is about current training usability first, then future-state messaging.",
    ["routing", "staticViews"],
  );
}

async function slide2(presentation) {
  const slideNo = 2;
  const slide = presentation.slides.add();
  addSlideHeader(
    slide,
    slideNo,
    "Platform Overview",
    "One application, shared business workflow",
    "The product combines acquisition, payment tracking, customer follow-up, operations, and webinar coordination in one workspace.",
  );
  await addScreenshotCard(slide, slideNo, ASSETS.databasePreview, 64, 268, 462, 336, "Connected system view", "Shared tables keep orders, students, payments, and refunds in sync");
  addCard(
    slide,
    slideNo,
    554,
    268,
    292,
    154,
    "Acquisition & enrollment",
    addBulletLines([
      "Leads can come from webinar, bootcamp, website, WhatsApp, or manual campaigns.",
      "Enrollment can start from Onboarding Form or Payment Desk.",
      "BDA ownership can be assigned during onboarding.",
    ]),
    SKY_SOFT,
    INDIGO,
    "overview acquisition",
  );
  addCard(
    slide,
    slideNo,
    866,
    268,
    350,
    154,
    "Revenue & tracking",
    addBulletLines([
      "Dashboard, tracker, team, and payments reflect sold value, collected amount, due amount, and refunds.",
      "Orders keep BDA, BDM, product, and transaction mapping together.",
    ]),
    GOLD_SOFT,
    "#92400E",
    "overview revenue",
  );
  addCard(
    slide,
    slideNo,
    554,
    442,
    662,
    162,
    "Fulfilment & governance",
    addBulletLines([
      "Only fully paid orders move to the Operations Queue.",
      "Operations then tracks portal access, broker setup, demat setup, and welcome kit completion.",
      "Refunds remain auditable and are reviewed separately from day-to-day payment handling.",
    ]),
    GREEN_SOFT,
    "#065F46",
    "overview fulfilment",
  );
  addPill(slide, slideNo, "Dashboard", 64, 624, 108, 28, INDIGO_SOFT, INDIGO, "module pill");
  addPill(slide, slideNo, "Tracker", 182, 624, 96, 28, INDIGO_SOFT, INDIGO, "module pill");
  addPill(slide, slideNo, "Students", 288, 624, 104, 28, INDIGO_SOFT, INDIGO, "module pill");
  addPill(slide, slideNo, "Orders", 402, 624, 90, 28, INDIGO_SOFT, INDIGO, "module pill");
  addPill(slide, slideNo, "Payments", 502, 624, 108, 28, INDIGO_SOFT, INDIGO, "module pill");
  addPill(slide, slideNo, "Onboarding", 620, 624, 118, 28, INDIGO_SOFT, INDIGO, "module pill");
  addPill(slide, slideNo, "Operations", 748, 624, 116, 28, INDIGO_SOFT, INDIGO, "module pill");
  addPill(slide, slideNo, "Refunds", 874, 624, 98, 28, INDIGO_SOFT, INDIGO, "module pill");
  addPill(slide, slideNo, "Team & Exports", 982, 624, 156, 28, INDIGO_SOFT, INDIGO, "module pill");
  addFooter(slide, slideNo, "Current usability groups business activity into one connected admin operating system.");
  addNotes(
    slide,
    "Explain that this is not just a payment tool. It is a shared operations system where revenue, webinar activity, refunds, and fulfilment all touch the same customer/order records.",
    ["routing", "schema", "staticViews"],
  );
}

async function slide3(presentation) {
  const slideNo = 3;
  const slide = presentation.slides.add();
  addSlideHeader(
    slide,
    slideNo,
    "Role Access",
    "BDA vs BDM vs Admin",
    "Each role works in the same product, but the responsibilities and restricted areas are different.",
  );

  addCard(
    slide,
    slideNo,
    64,
    268,
    360,
    164,
    "BDA",
    addBulletLines([
      "Use onboarding, tracker, students, orders, and payments.",
      "Track due follow-ups and customer ownership.",
      "Can raise refund requests from the payment desk but cannot approve them.",
    ]),
    SKY_SOFT,
    INDIGO,
    "bda role",
  );
  addCard(
    slide,
    slideNo,
    452,
    268,
    360,
    164,
    "BDM",
    addBulletLines([
      "Monitor dashboard, manager view, top-BDA performance, and recoveries.",
      "Can export team-related data and access settings.",
      "Works more on oversight than on basic enrollment entry.",
    ]),
    GOLD_SOFT,
    "#92400E",
    "bdm role",
  );
  addCard(
    slide,
    slideNo,
    840,
    268,
    376,
    164,
    "Admin",
    addBulletLines([
      "Owns payment desk, refund approvals, operations queue, settings, links, marketing, and governance.",
      "Can review and approve restricted workflows across the system.",
    ]),
    GREEN_SOFT,
    "#065F46",
    "admin role",
  );

  const startX = 64;
  const startY = 444;
  const rowH = 34;
  const labelW = 298;
  const colW = 250;
  const headers = [
    ["Module / area", WHITE, NAVY],
    ["BDA", SKY_SOFT, INDIGO],
    ["BDM", GOLD_SOFT, "#92400E"],
    ["Admin", GREEN_SOFT, "#065F46"],
  ];
  headers.forEach(([label, fill, color], index) => {
    const x = startX + (index === 0 ? 0 : labelW + (index - 1) * colW);
    const w = index === 0 ? labelW : colW - 8;
    addShape(slide, slideNo, "rect", x, startY, w, rowH, fill, BORDER, 1, "table header");
    addText(slide, slideNo, label, x + 12, startY + 8, w - 24, 16, {
      size: 13,
      color,
      bold: true,
      face: MONO_FACE,
      role: "table header text",
    });
  });

  const rows = [
    ["Dashboard / Team view", "View team dashboard", "Team dashboard + manager view", "Full visibility"],
    ["Onboarding + Tracker", "Core working area", "View and review", "Full visibility"],
    ["Payments board", "Use daily", "Review with team lens", "Full control"],
    ["Exports", "Restricted", "Own-team export use", "Full export access"],
    ["Refund workflow", "Raise request only", "Restricted", "Review + approve"],
    ["Settings / Links / Ops", "Restricted", "Settings only", "Full access"],
  ];
  rows.forEach((row, rowIndex) => {
    const y = startY + rowH + rowIndex * rowH;
    addShape(slide, slideNo, "rect", startX, y, labelW, rowH, WHITE, BORDER, 1, "table label cell");
    addText(slide, slideNo, row[0], startX + 12, y + 8, labelW - 24, 16, {
      size: 13,
      color: NAVY,
      bold: rowIndex % 2 === 0,
      face: BODY_FACE,
      role: "table row label",
    });
    [1, 2, 3].forEach((col) => {
      const x = startX + labelW + (col - 1) * colW;
      addShape(slide, slideNo, "rect", x, y, colW - 8, rowH, "#FBFCFF", BORDER, 1, "table value cell");
      addText(slide, slideNo, row[col], x + 12, y + 8, colW - 32, 16, {
        size: 12,
        color: SLATE,
        face: BODY_FACE,
        role: "table value",
      });
    });
  });
  await addImage(slide, slideNo, ASSETS.logo, 1072, 92, 136, 48, "llw logo small");
  addFooter(slide, slideNo, "Training note: the user sees one product, but permissions decide which actions are open or restricted.");
  addNotes(
    slide,
    "Call out that route access is not only about page visibility. Some workflows, like refunds, are operationally split: BDA can initiate a request from payments, but admin users must approve it.",
    ["permissions", "payments", "refunds", "exports"],
  );
}

async function slide4(presentation) {
  const slideNo = 4;
  const slide = presentation.slides.add();
  addSlideHeader(
    slide,
    slideNo,
    "Customer Journey",
    "Lead to payment to fulfilment",
    "The customer journey spans acquisition, enrollment, collection, recovery follow-up, and final fulfilment.",
  );
  addStepCard(slide, slideNo, 1, "Lead captured", "Lead comes from webinar, bootcamp, website, WhatsApp, or a manual campaign source.", 64, 268, 236, 150, WHITE, INDIGO);
  addArrow(slide, slideNo, 308, 324, 46, 24);
  addStepCard(slide, slideNo, 2, "Enrollment created", "Onboarding Form captures customer info, product, BDA assignment, payment type, and source.", 364, 268, 236, 150, WHITE, INDIGO);
  addArrow(slide, slideNo, 608, 324, 46, 24);
  addStepCard(slide, slideNo, 3, "Payment link or manual payment", "The team creates a Razorpay link or records cash / bank transfer details.", 664, 268, 216, 150, WHITE, INDIGO);
  await addScreenshotCard(slide, slideNo, ASSETS.webinarPreview, 904, 268, 312, 210, "Lead entry point", "Webinar and conversion activity supports the top of the funnel");
  addStepCard(slide, slideNo, 4, "Payment completed", "Successful payment updates the order and moves the customer closer to fulfilment.", 64, 454, 236, 150, WHITE, GREEN);
  addArrow(slide, slideNo, 308, 510, 46, 24, GREEN_SOFT, GREEN);
  addStepCard(slide, slideNo, 5, "Token / due follow-up", "If the customer paid only a token, the tracker and payments board handle the next follow-up and remaining amount link.", 364, 454, 300, 150, WHITE, GOLD);
  addArrow(slide, slideNo, 672, 510, 46, 24, GOLD_SOFT, GOLD);
  addStepCard(slide, slideNo, 6, "Operations fulfilment", "Fully paid orders appear in the Operations Queue for portal access, broker setup, demat setup, and welcome kit completion.", 728, 454, 488, 150, WHITE, TEAL);
  addFooter(slide, slideNo, "Today’s working model: collection and fulfilment are linked, but post-payment customer messaging is not yet a finished automated journey.");
  addNotes(
    slide,
    "Present this as the simplest end-to-end story. After payment, there are two important branches: token follow-up for remaining dues, and operations fulfilment for fully paid customers.",
    ["onboarding", "payments", "tracker", "operations", "schema"],
  );
}

async function slide5(presentation) {
  const slideNo = 5;
  const slide = presentation.slides.add();
  addSlideHeader(
    slide,
    slideNo,
    "BDA Workflow",
    "How a BDA uses the application today",
    "BDAs spend most of their time on enrollment capture, payment initiation, due follow-up, and customer ownership visibility.",
  );
  await addScreenshotCard(slide, slideNo, ASSETS.adminPreview, 64, 268, 438, 334, "Primary BDA working surface", "Onboarding, tracker, students, orders, and payments stay closely connected");
  addCard(
    slide,
    slideNo,
    530,
    268,
    306,
    150,
    "1. Start from Onboarding Form",
    addBulletLines([
      "Enter customer name, phone, email, source, product, and assigned BDA.",
      "Choose full payment or token payment.",
      "Select Razorpay, bank transfer, or cash.",
    ]),
    SKY_SOFT,
    INDIGO,
    "bda step one",
  );
  addCard(
    slide,
    slideNo,
    856,
    268,
    360,
    150,
    "2. Share or record payment",
    addBulletLines([
      "Create the enrollment and generate the payment link.",
      "For manual payments, store reference details in the workflow.",
      "The due amount is calculated automatically when token is used.",
    ]),
    GOLD_SOFT,
    "#92400E",
    "bda step two",
  );
  addCard(
    slide,
    slideNo,
    530,
    436,
    306,
    166,
    "3. Use AiSensy manually when needed",
    addBulletLines([
      "After the link is generated, the BDA can use the manual 'Send via AiSensy' action from onboarding.",
      "This is a payment-link send flow, not a post-payment welcome automation.",
    ]),
    TEAL_SOFT,
    TEAL,
    "bda step three",
  );
  addCard(
    slide,
    slideNo,
    856,
    436,
    360,
    166,
    "4. Track recovery and ownership",
    addBulletLines([
      "Use Tracker and Payments Board to follow up on token dues and pending amounts.",
      "Students and orders help the BDA see history, ownership, and status context.",
    ]),
    GREEN_SOFT,
    "#065F46",
    "bda step four",
  );
  addPill(slide, slideNo, "Restriction: no export + no refund approval", 530, 620, 406, 28, RED_SOFT, "#991B1B", "restriction pill");
  addFooter(slide, slideNo, "BDA training focus: clean onboarding entry, accurate payment mode selection, and disciplined follow-up.");
  addNotes(
    slide,
    "Emphasize accuracy at data entry time. Good onboarding setup controls the rest of the customer journey, including tracker visibility and recovery follow-up.",
    ["onboarding", "payments", "tracker", "permissions"],
  );
}

async function slide6(presentation) {
  const slideNo = 6;
  const slide = presentation.slides.add();
  addSlideHeader(
    slide,
    slideNo,
    "BDM Workflow",
    "How a BDM uses the application today",
    "BDMs work more as performance owners: they watch team collections, recoveries, manager summaries, and exports.",
  );
  await addScreenshotCard(slide, slideNo, ASSETS.adminPreview, 760, 268, 456, 324, "BDM visibility view", "Dashboard and team-oriented summaries provide manager-level control");
  addPanel(slide, slideNo, 64, 268, 660, 124, WHITE, BORDER, 1.2, "metric strip");
  addPill(slide, slideNo, "Collections", 84, 288, 110, 26, SKY_SOFT, INDIGO, "metric pill");
  addPill(slide, slideNo, "Recovery", 250, 288, 98, 26, GOLD_SOFT, "#92400E", "metric pill");
  addPill(slide, slideNo, "Leaderboard", 404, 288, 118, 26, GREEN_SOFT, "#065F46", "metric pill");
  addPill(slide, slideNo, "Exports", 576, 288, 84, 26, INDIGO_SOFT, INDIGO, "metric pill");
  addText(
    slide,
    slideNo,
    "A BDM typically uses Dashboard, Team, Tracker, and Export views to understand how the team is performing, where recovery pipeline sits, and which BDA needs support.",
    84,
    326,
    610,
    44,
    {
      size: 16,
      color: SLATE,
      face: BODY_FACE,
      role: "bdm summary",
    },
  );
  addCard(
    slide,
    slideNo,
    64,
    416,
    202,
    176,
    "Dashboard",
    addBulletLines([
      "See sold value vs cash in hand.",
      "Monitor new revenue and recovery revenue.",
      "Check manager snapshot and recent orders.",
    ]),
    SKY_SOFT,
    INDIGO,
    "bdm dashboard",
  );
  addCard(
    slide,
    slideNo,
    284,
    416,
    202,
    176,
    "Team view",
    addBulletLines([
      "Review manager track.",
      "Compare top-BDA performance.",
      "See customer count and pipeline.",
    ]),
    GOLD_SOFT,
    "#92400E",
    "bdm team",
  );
  addCard(
    slide,
    slideNo,
    504,
    416,
    220,
    176,
    "Tracker oversight",
    addBulletLines([
      "Watch promises due today and overdue.",
      "Track follow-up pressure by BDA and product.",
    ]),
    GREEN_SOFT,
    "#065F46",
    "bdm tracker",
  );
  addPill(slide, slideNo, "Access note: BDM can export team data and access settings, but refund approval remains restricted.", 64, 620, 690, 28, INDIGO_SOFT, INDIGO, "bdm access note");
  addFooter(slide, slideNo, "BDM training focus: read the system as a team-performance dashboard, not just a transaction list.");
  addNotes(
    slide,
    "Position the BDM workflow as supervisory. They still live in the same platform, but their core value is visibility, review, and escalation rather than basic data entry.",
    ["dashboard", "team", "tracker", "exports", "permissions"],
  );
}

async function slide7(presentation) {
  const slideNo = 7;
  const slide = presentation.slides.add();
  addSlideHeader(
    slide,
    slideNo,
    "Admin Workflow",
    "How Admin uses the application today",
    "Admin users connect collection, approvals, fulfilment, and settings so the whole customer journey stays governed.",
  );
  await addScreenshotCard(slide, slideNo, ASSETS.adminPreview, 64, 268, 454, 340, "Admin working surface", "Payments, refunds, operations, settings, links, marketing, and exports");
  addCard(
    slide,
    slideNo,
    548,
    268,
    318,
    150,
    "Payments desk",
    addBulletLines([
      "Filter by source, state, mode, method, and date.",
      "Mark paid or failed, create due links, request refunds, and monitor transaction history.",
    ]),
    SKY_SOFT,
    INDIGO,
    "admin payments",
  );
  addCard(
    slide,
    slideNo,
    886,
    268,
    330,
    150,
    "Refund governance",
    addBulletLines([
      "Admin reviews incoming refund requests and keeps the approval trail separate from routine payment work.",
      "This is the approval layer that BDA and BDM do not own.",
    ]),
    RED_SOFT,
    "#991B1B",
    "admin refunds",
  );
  addCard(
    slide,
    slideNo,
    548,
    436,
    318,
    172,
    "Operations queue",
    addBulletLines([
      "Only fully paid orders show here.",
      "The queue is meant for fulfilment, not collection follow-up.",
      "This keeps operations clean and action-oriented.",
    ]),
    TEAL_SOFT,
    TEAL,
    "admin ops",
  );
  addPanel(slide, slideNo, 886, 436, 330, 172, WHITE, BORDER, 1.2, "ops checklist panel");
  addText(slide, slideNo, "Fulfilment checklist", 906, 456, 200, 24, {
    size: 18,
    color: NAVY,
    bold: true,
    face: TITLE_FACE,
    role: "checklist title",
  });
  addPill(slide, slideNo, "Portal access", 906, 494, 128, 28, GREEN_SOFT, "#065F46", "ops pill");
  addPill(slide, slideNo, "Broker setup", 1044, 494, 118, 28, GREEN_SOFT, "#065F46", "ops pill");
  addPill(slide, slideNo, "Demat setup", 906, 534, 118, 28, GREEN_SOFT, "#065F46", "ops pill");
  addPill(slide, slideNo, "Welcome kit", 1034, 534, 118, 28, GREEN_SOFT, "#065F46", "ops pill");
  addText(
    slide,
    slideNo,
    "Admin and operations users close the loop after collection so the order can move from paid status into actual learner fulfilment.",
    906,
    576,
    278,
    26,
    {
      size: 12,
      color: MUTED,
      face: BODY_FACE,
      role: "checklist note",
    },
  );
  addFooter(slide, slideNo, "Admin training focus: keep the revenue layer accurate and the fulfilment layer disciplined.");
  addNotes(
    slide,
    "Explain why the operations queue only shows fully paid orders: it protects the ops team from collection clutter and keeps fulfilment steps cleanly separated.",
    ["payments", "refunds", "operations", "permissions"],
  );
}

async function slide8(presentation) {
  const slideNo = 8;
  const slide = presentation.slides.add();
  addSlideHeader(
    slide,
    slideNo,
    "Current Usability",
    "How payment and messaging work right now",
    "This is the current usability today. The payment workflow is operational, but the post-payment messaging journey is still incomplete.",
    { dark: true },
  );
  addPanel(slide, slideNo, 64, 268, 544, 340, "#111827", "#334155", 1.2, "today panel");
  addText(slide, slideNo, "What happens now", 88, 292, 220, 26, {
    size: 22,
    color: WHITE,
    bold: true,
    face: TITLE_FACE,
    role: "today title",
  });
  addText(
    slide,
    slideNo,
    addBulletLines([
      "BDA or admin creates enrollment or payment link.",
      "Razorpay or manual payment details are captured.",
      "From Onboarding Form, the team can manually use 'Send via AiSensy' after generating the payment link.",
      "Tracker and Payments Board handle due follow-up for token or partial collections.",
      "After full payment, the order moves to the Operations Queue for fulfilment steps.",
    ]),
    88,
    334,
    492,
    220,
    {
      size: 16,
      color: "#D8E1F0",
      face: BODY_FACE,
      role: "today bullets",
    },
  );
  addPill(slide, slideNo, "Current usability is like this", 88, 564, 240, 30, INDIGO_SOFT, INDIGO, "today note pill");

  addPanel(slide, slideNo, 636, 268, 580, 340, "#111827", "#334155", 1.2, "not yet panel");
  addText(slide, slideNo, "What is not automatic yet", 660, 292, 260, 26, {
    size: 22,
    color: WHITE,
    bold: true,
    face: TITLE_FACE,
    role: "not yet title",
  });
  addText(
    slide,
    slideNo,
    addBulletLines([
      "A confirmed automatic post-payment AiSensy confirmation flow is not yet the main usable process for training.",
      "A confirmed automatic AiSensy welcome message after payment completion is also not yet the standard working flow.",
      "Because of that, teams should treat the current journey as: payment link send first, payment completion second, fulfilment actions after that.",
    ]),
    660,
    334,
    520,
    168,
    {
      size: 16,
      color: "#D8E1F0",
      face: BODY_FACE,
      role: "not yet bullets",
    },
  );
  addPill(slide, slideNo, "Today: manual payment-link send exists", 660, 526, 270, 30, TEAL_SOFT, TEAL, "status pill");
  addPill(slide, slideNo, "Today: post-payment welcome automation is pending", 660, 566, 350, 30, RED_SOFT, "#991B1B", "status pill");
  await addImage(slide, slideNo, ASSETS.logo, 1068, 618, 132, 46, "llw logo small");
  addFooter(slide, slideNo, "Training instruction: teach the current workflow first, then mention the future automation plan.", { dark: true });
  addNotes(
    slide,
    "Be explicit that the app already supports manual AiSensy payment-link sends from onboarding, but the automated post-payment confirmation and welcome sequence should still be presented as future-facing training context.",
    ["onboarding", "payments", "server"],
  );
}

async function slide9(presentation) {
  const slideNo = 9;
  const slide = presentation.slides.add();
  addSlideHeader(
    slide,
    slideNo,
    "Future Update",
    "What we will try after payment completion",
    "Future updates may improve the messaging handoff after successful payment, while the current operational flow remains unchanged for now.",
  );
  addPanel(slide, slideNo, 64, 268, 446, 320, WHITE, BORDER, 1.2, "now panel");
  addText(slide, slideNo, "Use now", 88, 292, 120, 24, {
    size: 22,
    color: NAVY,
    bold: true,
    face: TITLE_FACE,
    role: "use now title",
  });
  addText(
    slide,
    slideNo,
    addBulletLines([
      "Create enrollment or payment link.",
      "Share payment link or record manual payment.",
      "Use tracker and payments board for pending amounts.",
      "Move fully paid orders into operations fulfilment.",
    ]),
    88,
    334,
    392,
    144,
    {
      size: 16,
      color: SLATE,
      face: BODY_FACE,
      role: "use now bullets",
    },
  );
  addPill(slide, slideNo, "Current standard process", 88, 520, 192, 30, INDIGO_SOFT, INDIGO, "use now pill");

  addPanel(slide, slideNo, 536, 268, 680, 320, WHITE, BORDER, 1.2, "future panel");
  addText(slide, slideNo, "Future updates we will try", 560, 292, 270, 24, {
    size: 22,
    color: NAVY,
    bold: true,
    face: TITLE_FACE,
    role: "future title",
  });
  addStepCard(slide, slideNo, 1, "Payment completed", "Successful payment becomes the event that can trigger the next communication step.", 560, 338, 180, 170, WHITE, GREEN);
  addArrow(slide, slideNo, 748, 406, 40, 24, GREEN_SOFT, GREEN);
  addStepCard(slide, slideNo, 2, "AiSensy confirmation", "We will try sending a confirmation message once payment is completed successfully.", 796, 338, 186, 170, WHITE, INDIGO);
  addArrow(slide, slideNo, 990, 406, 40, 24, INDIGO_SOFT, INDIGO);
  addStepCard(slide, slideNo, 3, "AiSensy welcome", "We will also try sending a welcome message after payment completion in future updates.", 1038, 338, 154, 170, WHITE, GOLD);
  addPill(slide, slideNo, "Goal: reduce manual follow-up and improve onboarding consistency", 560, 532, 460, 30, GOLD_SOFT, "#92400E", "goal pill");
  await addImage(slide, slideNo, ASSETS.logo, 1084, 614, 124, 44, "llw logo small");
  addFooter(slide, slideNo, "Close the training by reinforcing the current working flow, then position automation as the next improvement.");
  addNotes(
    slide,
    "This closing slide should sound practical, not speculative. The future-state message is: after payment completion, the team will try to send AiSensy confirmation and welcome messages. Until that is complete, the current usability stays as already trained.",
    ["server", "onboarding", "operations"],
  );
}

async function createDeck() {
  await ensureDirs();
  const presentation = Presentation.create({ slideSize: { width: W, height: H } });
  await slide1(presentation);
  await slide2(presentation);
  await slide3(presentation);
  await slide4(presentation);
  await slide5(presentation);
  await slide6(presentation);
  await slide7(presentation);
  await slide8(presentation);
  await slide9(presentation);
  return presentation;
}

async function saveBlobToFile(blob, filePath) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  await fs.writeFile(filePath, bytes);
}

async function writeInspectArtifact(presentation) {
  inspectRecords.unshift({
    kind: "deck",
    id: DECK_ID,
    slideCount: presentation.slides.count,
    slideSize: { width: W, height: H },
  });
  presentation.slides.items.forEach((slide, index) => {
    inspectRecords.splice(index + 1, 0, {
      kind: "slide",
      slide: index + 1,
      id: slide?.id || `slide-${index + 1}`,
    });
  });
  await fs.writeFile(INSPECT_PATH, `${inspectRecords.map((record) => JSON.stringify(record)).join("\n")}\n`, "utf8");
}

async function verifyAndExport(presentation) {
  await writeInspectArtifact(presentation);
  for (let idx = 0; idx < presentation.slides.items.length; idx += 1) {
    const slide = presentation.slides.items[idx];
    const preview = await presentation.export({ slide, format: "png", scale: 1 });
    const previewPath = path.join(PREVIEW_DIR, `slide-${String(idx + 1).padStart(2, "0")}.png`);
    await saveBlobToFile(preview, previewPath);
  }
  const pptxBlob = await PresentationFile.exportPptx(presentation);
  const pptxPath = path.join(OUT_DIR, "output.pptx");
  await pptxBlob.save(pptxPath);
  const loopRecordPath = path.join(VERIFICATION_DIR, "render_verify_loops.ndjson");
  const loopRecord = {
    kind: "render_verify_loop",
    deckId: DECK_ID,
    loop: 1,
    maxLoops: 3,
    timestamp: new Date().toISOString(),
    slideCount: presentation.slides.count,
    previewDir: PREVIEW_DIR,
    inspectPath: INSPECT_PATH,
    pptxPath,
  };
  await fs.writeFile(loopRecordPath, `${JSON.stringify(loopRecord)}\n`, "utf8");
  return pptxPath;
}

const presentation = await createDeck();
const pptxPath = await verifyAndExport(presentation);
console.log(pptxPath);
