const express = require('express');
const authMiddleware = require('../middleware/auth');
const adminOnly = require('../middleware/admin');
const {
  getUsers,
  updateUserStatus,
  getAnalytics,
  getSystemHealth,
  exportReports,
} = require('../controllers/adminController');

const router = express.Router();

router.get('/users', authMiddleware, adminOnly, getUsers);
router.patch('/users/:id/status', authMiddleware, adminOnly, updateUserStatus);
router.get('/analytics', authMiddleware, adminOnly, getAnalytics);
router.get('/system-health', authMiddleware, adminOnly, getSystemHealth);
router.get('/reports/export', authMiddleware, adminOnly, exportReports);

module.exports = router;
