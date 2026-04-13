// المسار: src/controllers/dashboardController.js
const db = require('../config/db');

exports.getSystemStats = async (req, res) => {
    try {
        // تنفيذ 4 استعلامات سريعة ومستقلة لجلب الإحصائيات
        
        // 1. إجمالي الموزعين
        const [[agentsCount]] = await db.query(`SELECT COUNT(*) as count FROM agents`);
        
        // 2. الكروت المتوفرة في المخزن
        const [[cardsCount]] = await db.query(`SELECT COUNT(*) as count FROM cards WHERE status = 'available'`);
        
        // 3. إجمالي أرصدة السوق
        const [[balanceSum]] = await db.query(`SELECT COALESCE(SUM(balance), 0) as total FROM agents`);
        
        // 4. مبيعات اليوم (عدد الكروت المباعة اليوم)
        const [[todaySales]] = await db.query(`SELECT COUNT(*) as count FROM sales WHERE DATE(created_at) = CURDATE()`);

        // 5. جلب آخر 5 حركات في النظام (نشاط حديث)
        const [recentActivity] = await db.query(`
            SELECT t.id, t.type, t.amount, t.created_at, a.company_name 
            FROM transactions t 
            JOIN agents a ON t.agent_id = a.id 
            ORDER BY t.created_at DESC 
            LIMIT 5
        `);

        res.status(200).json({
            success: true,
            data: {
                total_agents: agentsCount.count,
                available_cards: cardsCount.count,
                total_market_balance: balanceSum.total,
                today_sales: todaySales.count,
                recent_activity: recentActivity
            }
        });
    } catch (error) {
        console.error("Dashboard Stats Error:", error);
        res.status(500).json({ error: "خطأ في جلب إحصائيات النظام" });
    }
};