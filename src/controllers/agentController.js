// المسار: src/controllers/agentController.js
const bcrypt = require('bcryptjs');
const db = require('../config/db');

// --- 1. إضافة نقطة بيع جديدة (صلاحية الإدارة فقط) ---
exports.createAgent = async (req, res) => {
    const { username, password, company_name, phone } = req.body;

    if (!username || !password || !company_name || !phone) {
        return res.status(400).json({ error: "جميع الحقول مطلوبة" });
    }

    const connection = await db.getConnection();
    await connection.beginTransaction();

    try {
        // 1. تشفير كلمة المرور
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // 2. إنشاء حساب المستخدم (للدخول)
        const [userResult] = await connection.query(
            'INSERT INTO users (username, password_hash, role) VALUES (?, ?, "agent")',
            [username, hashedPassword]
        );
        const newUserId = userResult.insertId;

        // 3. إنشاء المحفظة والبيانات التجارية للموزع
        await connection.query(
            'INSERT INTO agents (user_id, company_name, phone, balance) VALUES (?, ?, ?, 0.00)',
            [newUserId, company_name, phone]
        );

        // 4. تأكيد العملية
        await connection.commit();

        res.status(201).json({ 
            success: true, 
            message: "تم إنشاء نقطة البيع بنجاح!",
            agent: { username, company_name, phone, balance: 0.00 }
        });

    } catch (error) {
        await connection.rollback();
        console.error("Create Agent Error:", error);
        
        // معالجة خطأ التكرار (رقم الهاتف أو اسم المستخدم موجود مسبقاً)
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ error: "اسم المستخدم أو رقم الهاتف مسجل مسبقاً في النظام." });
        }
        res.status(500).json({ error: "حدث خطأ داخلي أثناء إضافة الموزع." });
    } finally {
        connection.release();
    }
};

// --- 2. جلب جميع الموزعين (صلاحية الإدارة - لعرضهم في لوحة التحكم) ---
exports.getAllAgents = async (req, res) => {
    try {
        const [agents] = await db.query(`
            SELECT a.id, u.username, u.status, a.company_name, a.phone, a.balance 
            FROM agents a
            JOIN users u ON a.user_id = u.id
            ORDER BY a.id DESC
        `);
        res.status(200).json({ success: true, count: agents.length, data: agents });
    } catch (error) {
        res.status(500).json({ error: "حدث خطأ أثناء جلب البيانات" });
    }
};
// --- 4. تعديل بيانات موزع (صلاحية الإدارة) ---
exports.updateAgent = async (req, res) => {
    const agentId = req.params.id;
    const { company_name, phone } = req.body;

    if (!company_name || !phone) {
        return res.status(400).json({ error: "اسم المحل ورقم الهاتف مطلوبان" });
    }

    try {
        await db.query(
            'UPDATE agents SET company_name = ?, phone = ? WHERE id = ?',
            [company_name, phone, agentId]
        );
        res.status(200).json({ success: true, message: "تم تحديث بيانات النقطة بنجاح" });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ error: "رقم الهاتف مستخدم لموزع آخر" });
        }
        res.status(500).json({ error: "حدث خطأ أثناء التحديث" });
    }
};

// --- 5. تجميد / تفعيل حساب موزع (بديل الحذف) ---
exports.toggleAgentStatus = async (req, res) => {
    const agentId = req.params.id;
    
    const connection = await db.getConnection();
    try {
        // جلب user_id المرتبط بهذا الموزع
        const [agents] = await connection.query('SELECT user_id FROM agents WHERE id = ?', [agentId]);
        if (agents.length === 0) return res.status(404).json({ error: "الموزع غير موجود" });
        
        const userId = agents[0].user_id;

        // جلب الحالة الحالية وعكسها
        const [users] = await connection.query('SELECT status FROM users WHERE id = ?', [userId]);
        const newStatus = users[0].status === 'active' ? 'suspended' : 'active';

        // تحديث الحالة في جدول users (حتى لا يتمكن من تسجيل الدخول)
        await connection.query('UPDATE users SET status = ? WHERE id = ?', [newStatus, userId]);

        res.status(200).json({ 
            success: true, 
            message: `تم ${newStatus === 'active' ? 'تفعيل' : 'إيقاف'} الحساب بنجاح`,
            newStatus: newStatus
        });
    } catch (error) {
        res.status(500).json({ error: "حدث خطأ أثناء تغيير حالة الحساب" });
    } finally {
        connection.release();
    }
};

// --- 3. جلب بيانات محفظتي (صلاحية الموزع - لعرضها في التطبيق) ---
exports.getMyProfile = async (req, res) => {
    const agentId = req.user.agentId; // يتم استخراجه من التوكن بواسطة الـ Middleware

    if (!agentId) {
        return res.status(403).json({ error: "هذا الحساب غير مرتبط بنقطة بيع" });
    }

    try {
        const [agent] = await db.query(
            'SELECT company_name, phone, balance FROM agents WHERE id = ?', 
            [agentId]
        );

        if (agent.length === 0) return res.status(404).json({ error: "النقطة غير موجودة" });

        res.status(200).json({ success: true, data: agent[0] });
    } catch (error) {
        res.status(500).json({ error: "حدث خطأ أثناء جلب بيانات المحفظة" });
    }
};
