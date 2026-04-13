// المسار: src/controllers/authController.js
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');

// --- 1. إنشاء أول حساب مدير للنظام (مسار تأسيسي) ---
exports.setupSuperAdmin = async (req, res) => {
    const { username, password } = req.body;
    try {
        // تشفير كلمة المرور
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // إدخال المدير لقاعدة البيانات
        await db.query(
            'INSERT INTO users (username, password_hash, role) VALUES (?, ?, "superadmin")', 
            [username, hashedPassword]
        );
        res.status(201).json({ success: true, message: "تم إنشاء حساب الإدارة بنجاح!" });
    } catch (error) {
        res.status(500).json({ error: "حدث خطأ، ربما اسم المستخدم مسجل مسبقاً" });
    }
};

// --- 2. تسجيل الدخول (Login) للمدراء والموزعين ---
exports.login = async (req, res) => {
    const { username, password } = req.body;
    
    try {
        // البحث عن المستخدم
        const [users] = await db.query('SELECT * FROM users WHERE username = ? AND status = "active"', [username]);
        if (users.length === 0) {
            return res.status(401).json({ error: "اسم المستخدم أو كلمة المرور غير صحيحة" });
        }

        const user = users[0];

        // مطابقة كلمة المرور
        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) {
            return res.status(401).json({ error: "اسم المستخدم أو كلمة المرور غير صحيحة" });
        }

        // إذا كان المستخدم موزع (agent)، سنجلب بيانات محفظته أيضاً
        let agentId = null;
        if (user.role === 'agent') {
            const [agents] = await db.query('SELECT id FROM agents WHERE user_id = ?', [user.id]);
            if (agents.length > 0) agentId = agents[0].id;
        }

        // إنشاء التوكن (صلاحيته 8 ساعات)
        const token = jwt.sign(
            { id: user.id, role: user.role, agentId: agentId }, 
            process.env.JWT_SECRET, 
            { expiresIn: '8h' }
        );

        res.status(200).json({
            success: true,
            message: "تم تسجيل الدخول بنجاح",
            token: token,
            user: {
                id: user.id,
                username: user.username,
                role: user.role,
                agent_id: agentId
            }
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "خطأ داخلي في السيرفر" });
    }
};