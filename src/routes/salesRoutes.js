// المسار: src/routes/salesRoutes.js
const express = require('express');
const router = express.Router();
const salesController = require('../controllers/salesController');
const { verifyToken } = require('../middlewares/auth');

// مسار الشراء (للموزعين فقط - يتطلب توكن)
// POST /api/v1/sales/buy
router.post('/buy', verifyToken, salesController.purchaseCard);

module.exports = router;