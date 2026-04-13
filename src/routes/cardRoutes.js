const express = require('express');
const router = express.Router();
const multer = require('multer');
const cardController = require('../controllers/cardController');

// استدعاء الصلاحيات مرة واحدة فقط هنا!
const { verifyToken, isAdmin } = require('../middlewares/auth');

// إعداد multer لاستقبال ملفات الـ CSV في الذاكرة (بدون حفظها في السيرفر)
const upload = multer({ storage: multer.memoryStorage() });

// --- مسارات الكروت (جميعها تتطلب توكن وصلاحية إدارة) ---

// 1. استيراد الكروت عبر ملف CSV
router.post('/import', verifyToken, isAdmin, upload.single('csv_file'), cardController.importCards);

// 2. جلب جميع الكروت (مع البحث والفلترة)
router.get('/', verifyToken, isAdmin, cardController.getAllCards);

// 3. حذف كرت (إذا لم يتم بيعه)
router.delete('/:id', verifyToken, isAdmin, cardController.deleteCard);
// مسار جلب الباقات (يجب أن يكون قبل مسار /:id لتجنب التداخل)
router.get('/packages', verifyToken, isAdmin, cardController.getPackages);

module.exports = router;