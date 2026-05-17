const mysql = require("mysql2");

// إعداد حوض الاتصالات (Pool) لتحمل آلاف الطلبات المتزامنة
const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "netpro_cloud",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// 🛡️ [السر هنا]: يجب تصدير الـ Promise لكي تعمل دوال await في الكونترولرات بدون أخطاء
module.exports = pool.promise();
