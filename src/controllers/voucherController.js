const db = require("../config/db");

// ----------------------------------------------------
// 1. استيراد الكروت (مخصص لمدير الشبكة)
// الواجهة سترسل رقم الباقة، ومصفوفة (Array) تحتوي على أرقام الكروت
// ----------------------------------------------------
const importVouchers = async (req, res) => {
  const { package_id, pins } = req.body; 
  const network_id = req.user.network_id;

  if (!package_id || !pins || !Array.isArray(pins) || pins.length === 0) {
    return res.status(400).json({ error: "يرجى تحديد الباقة وإدخال أرقام الكروت" });
  }

  // نفتح اتصالاً مخصصاً لضمان إتمام العملية ككتلة واحدة
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    // 1. التأكد أن الباقة تابعة لشبكة هذا المدير فعلاً
    const [packages] = await connection.execute(
      "SELECT id FROM packages WHERE id = ? AND network_id = ?",
      [package_id, network_id]
    );

    if (packages.length === 0) {
      throw new Error("الباقة غير موجودة أو لا تتبع لشبكتك");
    }

    // 2. تجهيز جملة الإدخال المتعدد (Bulk Insert) لتكون سريعة جداً حتى مع 10,000 كرت
    const values = pins.map(pin => [network_id, package_id, pin, 'available']);
    
    // نستخدم query بدلاً من execute في الإدخال المتعدد
    await connection.query(
      "INSERT IGNORE INTO vouchers (network_id, package_id, pin_code, status) VALUES ?",
      [values]
    );

    // 3. تحديث مخزون الباقة ليعكس العدد الجديد للكروت المتاحة
    await connection.execute(
      `UPDATE packages 
       SET stock = (SELECT COUNT(*) FROM vouchers WHERE package_id = ? AND status = 'available') 
       WHERE id = ?`,
      [package_id, package_id]
    );

    await connection.commit();
    res.status(201).json({ message: `تم استيراد الكروت بنجاح وتحديث المخزون` });

  } catch (error) {
    await connection.rollback();
    console.error("Import Vouchers Error:", error);
    res.status(500).json({ error: error.message || "حدث خطأ أثناء استيراد الكروت" });
  } finally {
    connection.release();
  }
};

// ----------------------------------------------------
// 2. بيع كرت (مخصص للموزع عبر تطبيق الموبايل)
// العملية الأخطر: سحب كرت، خصم الرصيد، وتسجيل العملية
// ----------------------------------------------------
const sellVoucher = async (req, res) => {
  const { package_id, customer_phone } = req.body;
  const agent_id = req.user.id;
  const network_id = req.user.network_id;

  if (!package_id) {
    return res.status(400).json({ error: "يرجى تحديد الباقة المطلوبة" });
  }

  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    // 1. جلب بيانات الباقة للتأكد من السعر، وبيانات الموزع للتأكد من رصيده (بشكل متزامن)
    const [packages] = await connection.execute(
      "SELECT price, stock FROM packages WHERE id = ? AND network_id = ? FOR UPDATE",
      [package_id, network_id]
    );
    const [agents] = await connection.execute(
      "SELECT balance FROM users WHERE id = ? AND network_id = ? FOR UPDATE",
      [agent_id, network_id]
    );

    if (packages.length === 0 || agents.length === 0) {
      throw new Error("بيانات غير صالحة");
    }

    const packagePrice = packages[0].price;
    const agentBalance = agents[0].balance;

    if (packages[0].stock <= 0) {
      throw new Error("عذراً، نفدت الكروت من هذه الباقة");
    }

    if (agentBalance < packagePrice) {
      throw new Error("رصيدك غير كافٍ لإتمام عملية الشراء");
    }

    // 2. سحب كرت واحد (أقدم كرت متاح) وقفله حتى لا يسحبه موزع آخر في نفس الثانية
    const [vouchers] = await connection.execute(
      "SELECT id, pin_code FROM vouchers WHERE package_id = ? AND status = 'available' ORDER BY id ASC LIMIT 1 FOR UPDATE",
      [package_id]
    );

    if (vouchers.length === 0) {
      throw new Error("حدث خطأ، لا يوجد كروت متاحة");
    }

    const voucher = vouchers[0];

    // 3. خصم الرصيد من الموزع
    await connection.execute(
      "UPDATE users SET balance = balance - ? WHERE id = ?",
      [packagePrice, agent_id]
    );

    // 4. تغيير حالة الكرت إلى 'مباع' وربطه بالموزع الذي باعه
    await connection.execute(
      "UPDATE vouchers SET status = 'sold', agent_id = ?, sold_at = CURRENT_TIMESTAMP WHERE id = ?",
      [agent_id, voucher.id]
    );

    // 5. تسجيل العملية في السجل (Transaction) للشفافية المالية
    await connection.execute(
      "INSERT INTO transactions (network_id, agent_id, voucher_id, amount, customer_phone) VALUES (?, ?, ?, ?, ?)",
      [network_id, agent_id, voucher.id, packagePrice, customer_phone || null]
    );

    // 6. إنقاص مخزون الباقة بواحد
    await connection.execute(
      "UPDATE packages SET stock = stock - 1 WHERE id = ?",
      [package_id]
    );

    // اعتماد العملية البنكية
    await connection.commit();

    // إرسال الكرت للموزع
    res.json({
      message: "تم الشراء بنجاح",
      pin_code: voucher.pin_code,
      new_balance: agentBalance - packagePrice
    });

  } catch (error) {
    // التراجع عن كل شيء إذا حدث أي خطأ (لن يخصم رصيد ولن يُفقد كرت)
    await connection.rollback();
    console.error("Sell Voucher Error:", error);
    res.status(400).json({ error: error.message || "حدث خطأ أثناء عملية البيع" });
  } finally {
    connection.release();
  }
};

module.exports = { importVouchers, sellVoucher };
