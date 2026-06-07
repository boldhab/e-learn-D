const express = require('express');
const {
  enrollStudent,
  getStudentCourses,
  getDashboard,
  getTeacherEnrollmentStats,
  completeLesson,
  updateProgress,
  getProgress,
  getCertificate,
  downloadCertificate,
  getAdminSummary
} = require('../controllers/learningController');
const verifyToken = require('../middleware/verifyToken');
const verifyAdmin = require('../middleware/verifyAdmin');

const router = express.Router();

router.post('/enroll', verifyToken, enrollStudent);
router.get('/my-courses/:studentId', verifyToken, getStudentCourses);
router.get('/dashboard/:studentId', verifyToken, getDashboard);
router.get('/teacher/:teacherId/stats', verifyToken, getTeacherEnrollmentStats);
router.post('/lessons/complete', verifyToken, completeLesson);
router.put('/progress', verifyToken, updateProgress);
router.get('/progress/:studentId/:courseId', verifyToken, getProgress);
router.get('/certificates/:studentId/:courseId', verifyToken, getCertificate);
router.get('/certificates/:studentId/:courseId/download', verifyToken, downloadCertificate);
router.get('/admin/summary', verifyAdmin, getAdminSummary);

module.exports = router;
