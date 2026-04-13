// المسار: src/routes/authRoutes.js
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// مسار تسجيل الدخول
router.post('/login', authController.login);

// مسار إنشاء المدير (يفضل حذفه أو إيقافه بعد إنشاء أول مدير لحماية النظام)
router.post('/setup', authController.setupSuperAdmin);

module.exports = router;