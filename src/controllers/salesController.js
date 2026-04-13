// المسار: src/controllers/salesController.js
const db = require('../config/db');

// --- محرك شراء الكروت (للموزعين) ---
exports.purchaseCard = async (req, res) => {
    const { package_id } = req.body;
    const agentId = req.user.agentId; // نجلب الـ ID الخاص بالموزع من التوكن

    if (!package_id) {
        return res.status(400).json({ error: "الرجاء تحديد الباقة المراد شراؤها" });
    }

    const connection = await db.getConnection();
    // 🔴 بدء المعاملة المالية (Transaction)
    await connection.beginTransaction();

    try {
        // 1. قفل حساب الموزع (Row Locking) لمنع أي خصم متزامن من جهاز آخر لنفس الموزع
        const [agents] = await connection.query(
            `SELECT balance FROM agents WHERE id = ? FOR UPDATE`,
            [agentId]
        );

        if (agents.length === 0) {
            await connection.rollback();
            return res.status(404).json({ error: "نقطة البيع غير صالحة" });
        }

        // 2. جلب سعر الباقة واسمها
        const [packages] = await connection.query(
            `SELECT price, name FROM packages WHERE id = ?`,
            [package_id]
        );

        if (packages.length === 0) {
            await connection.rollback();
            return res.status(404).json({ error: "الباقة غير موجودة" });
        }

        const agentBalance = parseFloat(agents[0].balance);
        const packagePrice = parseFloat(packages[0].price);
        const packageName = packages[0].name;

        // 3. التحقق من الرصيد الكافي
        if (agentBalance < packagePrice) {
            await connection.rollback();
            return res.status(400).json({ error: "رصيدك غير كافٍ لإتمام العملية" });
        }

        // 4. سحب الكرت وقفل الصف (SKIP LOCKED لتخطي الكروت المسحوبة بواسطة طلبات أخرى)
        const [cards] = await connection.query(
            `SELECT id, voucher_code FROM cards 
             WHERE package_id = ? AND status = 'available' 
             LIMIT 1 FOR UPDATE SKIP LOCKED`,
            [package_id]
        );

        if (cards.length === 0) {
            await connection.rollback();
            return res.status(404).json({ error: "عذراً، نفدت الكروت من هذه الفئة. يرجى إبلاغ الإدارة." });
        }

        const card = cards[0];
        const newBalance = agentBalance - packagePrice;

        // 5. خصم الرصيد من الموزع
        await connection.query(
            `UPDATE agents SET balance = ? WHERE id = ?`,
            [newBalance, agentId]
        );

        // 6. تسجيل العملية المالية (Ledger) كـ Deduction (خصم)
        const [transaction] = await connection.query(
            `INSERT INTO transactions 
            (agent_id, type, amount, balance_before, balance_after, description) 
            VALUES (?, 'deduction', ?, ?, ?, ?)`,
            [agentId, packagePrice, agentBalance, newBalance, `شراء كرت: ${packageName}`]
        );

        // 7. تحديث حالة الكرت إلى 'sold' (مباع) وربطه بالموزع
        await connection.query(
            `UPDATE cards SET status = 'sold', agent_id = ?, sold_at = NOW() WHERE id = ?`,
            [agentId, card.id]
        );

        // 8. تسجيل العملية في جدول المبيعات المستقل للتقارير (Sales)
        await connection.query(
            `INSERT INTO sales (transaction_id, agent_id, card_id) VALUES (?, ?, ?)`,
            [transaction.insertId, agentId, card.id]
        );

        // 🟢 تأكيد العملية (Commit) وتخزينها في قاعدة البيانات
        await connection.commit();

        // 9. إرجاع النتيجة (الكرت) للموزع لطباعته
        return res.status(200).json({
            success: true,
            message: "تمت عملية الشراء بنجاح",
            data: {
                voucher_code: card.voucher_code,
                package_name: packageName,
                price_deducted: packagePrice,
                new_balance: newBalance,
                transaction_id: transaction.insertId
            }
        });

    } catch (error) {
        // في حال حدوث أي خلل (انقطاع اتصال، خطأ برمجي)، يتم التراجع عن كل شيء!
        await connection.rollback();
        console.error("Sales Error:", error);
        return res.status(500).json({ error: "حدث خطأ داخلي، لم يتم خصم الرصيد." });
    } finally {
        connection.release();
    }
};