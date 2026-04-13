// المسار: src/routes/agentRoutes.js
const express = require('express');
const router = express.Router();
const agentController = require('../controllers/agentController');
const { verifyToken, isAdmin } = require('../middlewares/auth');

// 1. مسارات الإدارة (تتطلب تسجيل دخول + صلاحية مدير)
// POST /api/v1/agents
router.post('/', verifyToken, isAdmin, agentController.createAgent);

// GET /api/v1/agents
router.get('/', verifyToken, isAdmin, agentController.getAllAgents);

// 2. مسارات الموزع (تتطلب تسجيل دخول فقط)
// GET /api/v1/agents/me
router.get('/me', verifyToken, agentController.getMyProfile);
// PUT /api/v1/agents/:id - تعديل بيانات الموزع
router.put('/:id', verifyToken, isAdmin, agentController.updateAgent);

// PATCH /api/v1/agents/:id/status - إيقاف أو تفعيل الموزع
router.patch('/:id/status', verifyToken, isAdmin, agentController.toggleAgentStatus);
module.exports = router;