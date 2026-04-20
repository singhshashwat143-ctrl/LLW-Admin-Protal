window.LLW_DATA = {
  courses: [
    ["Indian Market", "online", 40000, 1, 362, 5],
    ["Forex Market", "online", 40000, 1, 341, 4],
    ["Indian + Forex (CTP)", "online", 60000, 1, 418, 6],
    ["Indian + Livexo", "online", 55000, 1, 387, 5],
    ["Forex + Livexo", "online", 55000, 1, 391, 5],
    ["CTP + Livexo", "online", 70000, 1, 456, 7],
    ["Indian Market", "offline", 70000, 1, 128, 3],
    ["Forex Market", "offline", 70000, 1, 121, 3],
    ["Indian + Forex (CTP)", "offline", 140000, 1, 144, 4],
    ["Indian + Livexo", "offline", 85000, 1, 130, 3],
    ["Forex + Livexo", "offline", 85000, 1, 126, 3],
    ["CTP + Livexo", "offline", 170000, 1, 152, 4]
  ],
  teachers: [
    ["Aarav Mehta", "aarav.mehta@llw.academy", "Mumbai", "Indian Market", 4.8, 1240],
    ["Isha Sharma", "isha.sharma@llw.academy", "Delhi", "Forex Market", 4.7, 980],
    ["Rohan Kapoor", "rohan.kapoor@llw.academy", "Pune", "CTP Strategy", 4.9, 1680],
    ["Kavya Nair", "kavya.nair@llw.academy", "Bengaluru", "Live Trading", 4.6, 840],
    ["Vihaan Sethi", "vihaan.sethi@llw.academy", "Chandigarh", "Swing + Momentum", 4.5, 1130],
    ["Ananya Rao", "ananya.rao@llw.academy", "Hyderabad", "Forex Psychology", 4.7, 760],
    ["Arjun Malhotra", "arjun.malhotra@llw.academy", "Jaipur", "Options + CTP", 4.8, 1490],
    ["Meera Iyer", "meera.iyer@llw.academy", "Chennai", "Portfolio + Livexo", 4.6, 910],
    ["Kabir Chawla", "kabir.chawla@llw.academy", "Ahmedabad", "Beginner Trading", 4.4, 620],
    ["Sana Qureshi", "sana.qureshi@llw.academy", "Kolkata", "Risk Systems", 4.9, 1760]
  ],
  webinars: [
    ["Indian Market Masterclass Launch", "Aarav Mehta", "Indian Market", "10 Apr 2026, 07:00 PM", "Live", 1984, 1188, 734, 216, "Livekit-IN-03", 96],
    ["Forex Market Conversion Room", "Isha Sharma", "Forex Market", "11 Apr 2026, 11:00 AM", "Upcoming", 1410, 0, 0, 0, "Livekit-IN-06", 98],
    ["CTP + Livexo Premium Webinar", "Rohan Kapoor", "Premium Combo", "09 Apr 2026, 06:30 PM", "Completed", 2220, 1472, 810, 302, "Livekit-IN-04", 93],
    ["Offline Bootcamp Orientation", "Sana Qureshi", "Offline", "13 Apr 2026, 05:00 PM", "Upcoming", 540, 0, 0, 0, "Livekit-IN-08", 99]
  ],
  payments: [
    ["Satyanarayana", "94******11", "Indian Market", "Website", 1, "completed", "08 Mar 2026, 01:52 AM"],
    ["Gautam Naik", "97******15", "Forex Market", "Recovery", 1, "pending", "08 Mar 2026, 01:01 AM"],
    ["Sonu", "97******13", "Indian + Forex (CTP)", "Website", 1, "completed", "08 Mar 2026, 12:25 AM"],
    ["Soudamini Somvanshi", "98******61", "Indian + Livexo", "Recovery", 1, "failed", "07 Mar 2026, 11:43 PM"],
    ["Parthasarathi Dalai", "94******23", "Forex + Livexo", "Website", 1, "completed", "07 Mar 2026, 11:39 PM"],
    ["Vishwajit Chakraborty", "98******37", "CTP + Livexo", "WhatsApp", 1, "pending", "07 Mar 2026, 10:58 PM"]
  ],
  databaseTables: [
    ["teachers", "Teacher master data for admin and webinar scheduling", ["id", "name", "email", "city", "rating"]],
    ["courses", "Catalog with online/offline fee structure", ["id", "title", "delivery_mode", "original_fee", "live_fee"]],
    ["cohorts", "Batch mapping for enrolled students and active slots", ["id", "course_id", "teacher_id", "status"]],
    ["webinars", "Session metadata, attendance, conversions, and quality", ["id", "course_id", "teacher_id", "status"]],
    ["payments", "Sales collection and payment status records", ["id", "course_id", "student_name", "amount", "status"]],
    ["refund_requests", "Refund approval and history workflow", ["id", "payment_id", "requested_by", "status"]]
  ]
};
