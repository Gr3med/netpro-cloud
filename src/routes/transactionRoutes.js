// المسار: src/routes/transactionRoutes.js
const express = require('express');
const router = express.Router();
const transactionController = require('../controllers/transactionController');
const { verifyToken, isAdmin } = require('../middlewares/auth');

// مسار شحن الرصيد (للمدير)
router.post('/recharge', verifyToken, isAdmin, transactionController.rechargeWallet);

// مسار كشف الحساب (للموزع)
router.get('/statement', verifyToken, transactionController.getMyStatement);

module.exports = router;