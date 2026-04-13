const db = require('../config/db');
const bcrypt = require('bcryptjs');

// 1. جلب جميع المستخدمين
exports.getUsers = async (req, res) => {
    try {
        // لا نجلب كلمات المرور لأسباب أمنية
        const [users] = await db.query('SELECT id, username, role, status, created_at FROM users ORDER BY id DESC');
        res.status(200).json({ success: true, data: users });
    } catch (error) {
        res.status(500).json({ error: "فشل جلب المستخدمين من قاعدة البيانات" });
    }
};

// 2. إضافة مستخدم جديد (مدير أو موزع)
exports.createUser = async (req, res) => {
    const { username, password, role } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: "اسم المستخدم وكلمة المرور مطلوبان" });
    }

    try {
        // فحص ما إذا كان المستخدم موجوداً مسبقاً
        const [existing] = await db.query('SELECT id FROM users WHERE username = ?', [username]);
        if (existing.length > 0) {
            return res.status(400).json({ error: "اسم المستخدم هذا محجوز مسبقاً!" });
        }

        // تشفير كلمة المرور لحماية النظام
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // إدخال المستخدم في قاعدة البيانات (لاحظ أن العمود اسمه password_hash كما في قاعدتك)
        await db.query(
            'INSERT INTO users (username, password_hash, role, status) VALUES (?, ?, ?, ?)',
            [username, hashedPassword, role || 'admin', 'active']
        );

        res.status(201).json({ success: true, message: "تم إنشاء الحساب بنجاح" });
    } catch (error) {
        console.error("Add User Error:", error);
        res.status(500).json({ error: "حدث خطأ داخلي أثناء إضافة المستخدم" });
    }
};

// 3. تفعيل أو إيقاف حساب
exports.toggleStatus = async (req, res) => {
    const userId = req.params.id;
    try {
        const [users] = await db.query('SELECT status, role FROM users WHERE id = ?', [userId]);
        if (users.length === 0) return res.status(404).json({ error: "المستخدم غير موجود" });
        
        if (users[0].role === 'superadmin') {
            return res.status(403).json({ error: "لا يمكن إيقاف حساب المدير العام!" });
        }

        const newStatus = users[0].status === 'active' ? 'suspended' : 'active';
        await db.query('UPDATE users SET status = ? WHERE id = ?', [newStatus, userId]);
        
        res.status(200).json({ success: true, newStatus });
    } catch (error) {
        res.status(500).json({ error: "فشل تحديث حالة الحساب" });
    }
};
// 4. تحديث بيانات المستخدم (تعديل)
exports.updateUser = async (req, res) => {
    const userId = req.params.id;
    const { username, role, password } = req.body;

    try {
        // حماية المدير العام من التعديل
        const [users] = await db.query('SELECT role FROM users WHERE id = ?', [userId]);
        if (users.length === 0) return res.status(404).json({ error: "المستخدم غير موجود" });
        if (users[0].role === 'superadmin') return res.status(403).json({ error: "لا يمكن تعديل بيانات المدير العام من هنا!" });

        // فحص ما إذا كان اسم المستخدم الجديد محجوزاً لشخص آخر
        const [existing] = await db.query('SELECT id FROM users WHERE username = ? AND id != ?', [username, userId]);
        if (existing.length > 0) return res.status(400).json({ error: "اسم المستخدم هذا محجوز مسبقاً!" });

        // إذا أدخل كلمة مرور جديدة، نقوم بتشفيرها وتحديثها
        if (password && password.trim() !== '') {
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(password, salt);
            await db.query(
                'UPDATE users SET username = ?, role = ?, password_hash = ? WHERE id = ?',
                [username, role, hashedPassword, userId]
            );
        } else {
            // إذا ترك حقل الباسورد فارغاً، نحدث الاسم والصلاحية فقط
            await db.query(
                'UPDATE users SET username = ?, role = ? WHERE id = ?',
                [username, role, userId]
            );
        }

        res.status(200).json({ success: true, message: "تم تحديث البيانات بنجاح" });
    } catch (error) {
        res.status(500).json({ error: "فشل تحديث بيانات المستخدم" });
    }
};