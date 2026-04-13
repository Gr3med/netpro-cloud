// المسار: src/controllers/transactionController.js
const db = require('../config/db');

// --- 1. شحن رصيد نقطة بيع (صلاحية مدير) ---
exports.rechargeWallet = async (req, res) => {
    const { agent_id, amount, description } = req.body;
    const adminId = req.user.id;

    if (!amount || amount <= 0) {
        return res.status(400).json({ error: "المبلغ يجب أن يكون أكبر من الصفر" });
    }

    const connection = await db.getConnection();
    await connection.beginTransaction();

    try {
        // قفل الرصيد لمنع التداخل (Pessimistic Locking)
        const [agents] = await connection.query(
            `SELECT balance FROM agents WHERE id = ? FOR UPDATE`,
            [agent_id]
        );

        if (agents.length === 0) {
            await connection.rollback();
            return res.status(404).json({ error: "نقطة البيع غير موجودة" });
        }

        const oldBalance = parseFloat(agents[0].balance);
        const rechargeAmount = parseFloat(amount);
        const newBalance = oldBalance + rechargeAmount;

        // تحديث الرصيد
        await connection.query(
            `UPDATE agents SET balance = ? WHERE id = ?`,
            [newBalance, agent_id]
        );

        // تسجيل الحركة المالية (Ledger)
        const [transaction] = await connection.query(
            `INSERT INTO transactions 
            (agent_id, type, amount, balance_before, balance_after, description, reference_id) 
            VALUES (?, 'recharge', ?, ?, ?, ?, ?)`,
            [agent_id, rechargeAmount, oldBalance, newBalance, description || 'إيداع نقدي', adminId]
        );

        await connection.commit();

        res.status(200).json({
            success: true,
            message: "تم شحن الرصيد بنجاح",
            receipt: {
                transaction_id: transaction.insertId,
                amount_added: rechargeAmount,
                new_balance: newBalance
            }
        });

    } catch (error) {
        await connection.rollback();
        res.status(500).json({ error: "حدث خطأ أثناء الشحن" });
    } finally {
        connection.release();
    }
};

// --- 2. كشف الحساب (صلاحية الموزع لرؤية حركاته) ---
exports.getMyStatement = async (req, res) => {
    const agentId = req.user.agentId;

    try {
        const [transactions] = await db.query(
            `SELECT id, type, amount, balance_before, balance_after, description, created_at 
             FROM transactions 
             WHERE agent_id = ? 
             ORDER BY created_at DESC LIMIT 50`,
            [agentId]
        );
        res.status(200).json({ success: true, data: transactions });
    } catch (error) {
        res.status(500).json({ error: "خطأ في جلب كشف الحساب" });
    }
};