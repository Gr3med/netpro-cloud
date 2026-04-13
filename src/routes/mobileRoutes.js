const express = require('express');
const router = express.Router();
const mobileController = require('../controllers/mobileController');
const { verifyToken } = require('../middlewares/auth');

router.get('/dashboard', verifyToken, mobileController.getDashboard);
router.post('/sell', verifyToken, mobileController.sellCard);

// 🔥 هذا هو السطر الذي ينقصك ليظهر السجل
router.get('/history', verifyToken, mobileController.getAgentHistory);

module.exports = router;