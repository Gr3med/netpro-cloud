const db = require('../config/db');

// 1. جلب بيانات لوحة تحكم الموزع (الرصيد والباقات المتاحة)
exports.getDashboard = async (req, res) => {
    try {
        const [agents] = await db.query('SELECT id, company_name, balance FROM agents WHERE user_id = ?', [req.user.id]);
        if (agents.length === 0) return res.status(403).json({error: "بيانات الموزع غير موجودة"});
        const agent = agents[0];

        // جلب الباقات مع عدد الكروت المتبقية في المخزن لكل باقة
        const [packages] = await db.query(`
            SELECT p.id, p.name, p.price, 
            (SELECT COUNT(*) FROM cards c WHERE c.package_id = p.id AND c.status = 'available') as stock
            FROM packages p
        `);

        res.json({ success: true, agent, packages });
    } catch (error) {
        res.status(500).json({ error: "خطأ داخلي في السيرفر" });
    }
};

// 2. عملية سحب وبيع كرت
// 1. تعديل عملية البيع لتشمل رقم الهاتف
exports.sellCard = async (req, res) => {
    const { packageId, customerPhone } = req.body; // استلام رقم الهاتف
    try {
        const [agents] = await db.query('SELECT * FROM agents WHERE user_id = ?', [req.user.id]);
        const agent = agents[0];
        const [packages] = await db.query('SELECT * FROM packages WHERE id = ?', [packageId]);
        const pkg = packages[0];

        if (Number(agent.balance) < Number(pkg.price)) {
            return res.status(400).json({error: "رصيدك غير كافٍ"});
        }

        const [cards] = await db.query('SELECT id, voucher_code FROM cards WHERE package_id = ? AND status = "available" LIMIT 1', [packageId]);
        if (cards.length === 0) return res.status(400).json({error: "نفد المخزن"});
        const card = cards[0];

        const newBalance = Number(agent.balance) - Number(pkg.price);

        // تحديث الكرت مع رقم هاتف الزبون
        await db.query('UPDATE cards SET status = "sold", agent_id = ?, sold_at = NOW(), customer_phone = ? WHERE id = ?', 
            [agent.id, customerPhone || null, card.id]);
        
        await db.query('UPDATE agents SET balance = ? WHERE id = ?', [newBalance, agent.id]);
        
        await db.query('INSERT INTO transactions (agent_id, type, amount, balance_before, balance_after, description, reference_id) VALUES (?, "deduction", ?, ?, ?, ?, ?)',
            [agent.id, pkg.price, agent.balance, newBalance, `شراء ${pkg.name}`, card.id]
        );

        res.json({ success: true, voucher_code: card.voucher_code, new_balance: newBalance });
    } catch (error) {
        res.status(500).json({error: "فشل البيع"});
    }
};

// 2. دالة جلب سجل العمليات للموزع
exports.getAgentHistory = async (req, res) => {
    try {
        const [agents] = await db.query('SELECT id FROM agents WHERE user_id = ?', [req.user.id]);
        const agentId = agents[0].id;

        // جلب العمليات مع تفاصيل الكرت (PIN) ورقم الزبون
        const [history] = await db.query(`
            SELECT t.*, c.voucher_code, c.customer_phone, p.name as package_name
            FROM transactions t
            LEFT JOIN cards c ON t.reference_id = c.id
            LEFT JOIN packages p ON c.package_id = p.id
            WHERE t.agent_id = ?
            ORDER BY t.created_at DESC
        `, [agentId]);

        res.json({ success: true, data: history });
    } catch (error) {
        res.status(500).json({ error: "فشل جلب السجل" });
    }
};