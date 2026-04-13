// المسار: src/middlewares/auth.js
const jwt = require('jsonwebtoken');

// 1. دالة التحقق من تسجيل الدخول (للمدراء والموزعين)
const verifyToken = (req, res, next) => {
    // جلب التوكن من الـ Headers
    const authHeader = req.headers['authorization'];
    if (!authHeader) {
        return res.status(403).json({ error: "مرفوض: لا يوجد تصريح دخول (Token)!" });
    }

    const token = authHeader.split(" ")[1]; // فصل كلمة Bearer عن التوكن

    try {
        // فك تشفير التوكن والتأكد من صحته
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded; // { id, role, agentId }
        next(); // السماح بالمرور للخطوة التالية
    } catch (err) {
        return res.status(401).json({ error: "تصريح الدخول غير صالح أو انتهت صلاحيته" });
    }
};

// 2. دالة التحقق من صلاحيات المدير فقط (لمنع الموزعين من شحن رصيد لأنفسهم)
const isAdmin = (req, res, next) => {
    if (req.user.role !== 'admin' && req.user.role !== 'superadmin') {
        return res.status(403).json({ error: "صلاحيات غير كافية: هذه العملية تتطلب حساب مدير." });
    }
    next();
};

module.exports = { verifyToken, isAdmin };