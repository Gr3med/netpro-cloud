// المسار: src/routes/dashboardRoutes.js
const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const { verifyToken, isAdmin } = require('../middlewares/auth');

// جلب الإحصائيات (مخصص للمدراء)
router.get('/stats', verifyToken, isAdmin, dashboardController.getSystemStats);

module.exports = router;