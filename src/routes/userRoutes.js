const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { verifyToken, isAdmin } = require('../middlewares/auth');

// جميع مسارات المستخدمين تتطلب صلاحية مدير
router.get('/', verifyToken, isAdmin, userController.getUsers);
router.post('/', verifyToken, isAdmin, userController.createUser);
router.patch('/:id/status', verifyToken, isAdmin, userController.toggleStatus);
// مسار التعديل
router.put('/:id', verifyToken, isAdmin, userController.updateUser);
module.exports = router;