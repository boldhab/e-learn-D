const express = require('express');
const quizController = require('../controllers/quizController');
const verifyTeacher = require('../middleware/verifyTeacher');
const verifyToken = require('../middleware/verifyToken');

const router = express.Router();

router.post('/quizzes', verifyTeacher, quizController.createQuiz);
router.put('/quizzes/:id', verifyTeacher, quizController.updateQuiz);
router.delete('/quizzes/:id', verifyTeacher, quizController.deleteQuiz);
router.post('/quizzes/:id/publish', verifyTeacher, quizController.publishQuiz);
router.get('/teacher/quizzes/:id', verifyTeacher, quizController.getTeacherQuizDetails);
router.get('/teacher/quizzes/:id/attempts', verifyTeacher, quizController.getQuizAttempts);

router.post('/quizzes/:quizId/questions', verifyTeacher, quizController.addQuestion);
router.put('/questions/:id', verifyTeacher, quizController.updateQuestion);
router.delete('/questions/:id', verifyTeacher, quizController.deleteQuestion);
router.post('/questions/:id/options', verifyTeacher, quizController.addOption);

router.get('/courses/:courseId/quizzes', verifyToken, quizController.getCourseQuizzes);
router.get('/courses/:courseId/students/:studentId/quiz-completion', verifyToken, quizController.getCourseQuizCompletion);
router.get('/quizzes/:id', verifyToken, quizController.getQuizDetails);
router.post('/quizzes/:id/attempt', verifyToken, quizController.startAttempt);
router.post('/attempts/:attemptId/submit', verifyToken, quizController.submitAttempt);
router.get('/attempts/:attemptId/result', verifyToken, quizController.getAttemptResult);
router.get('/students/:studentId/quiz-history', verifyToken, quizController.getQuizHistory);

module.exports = router;
