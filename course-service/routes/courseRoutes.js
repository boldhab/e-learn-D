const express = require('express');
const {
  createCourse,
  getAllCourses,
  getCourseById,
  addLesson,
  getTeacherCourses,
  getAdminCourses,
  approveCourse,
  reportContent,
  getReportedContent,
  updateReportStatus,
  getAdminSummary
} = require('../controllers/courseController');
const verifyTeacher = require('../middleware/verifyTeacher');
const verifyToken = require('../middleware/verifyToken');
const verifyAdmin = require('../middleware/verifyAdmin');

const router = express.Router();

router.post('/courses', verifyTeacher, createCourse);
router.get('/courses', getAllCourses);
router.get('/courses/:id', getCourseById);
router.post('/lessons', verifyTeacher, addLesson);
router.get('/teacher/:teacherId/courses', getTeacherCourses);
router.post('/report', verifyToken, reportContent);
router.get('/admin/courses', verifyAdmin, getAdminCourses);
router.patch('/admin/courses/:id/approve', verifyAdmin, approveCourse);
router.get('/admin/reports', verifyAdmin, getReportedContent);
router.patch('/admin/reports/:id', verifyAdmin, updateReportStatus);
router.get('/admin/summary', verifyAdmin, getAdminSummary);

module.exports = router;
