const { query, transaction } = require('../db');
const axios = require('axios');

const QUESTION_TYPES = ['MCQ', 'TRUE_FALSE', 'TEXT'];
const LEARNING_SERVICE_URL = process.env.LEARNING_SERVICE_URL || 'http://localhost:5003';

const normalizeAnswer = (answer) => String(answer || '').trim().toLowerCase();

const ensureStudentEnrolled = async (studentId, courseId, authorization) => {
  try {
    await axios.get(
      `${LEARNING_SERVICE_URL}/api/progress/${studentId}/${courseId}`,
      { headers: { Authorization: authorization } }
    );
  } catch (error) {
    const status = error.response?.status;
    const message = status === 404
      ? 'You must be enrolled to access this quiz'
      : error.response?.data?.error || 'Unable to verify course enrollment';
    const enrollmentError = new Error(message);
    enrollmentError.status = status === 404 ? 403 : status || 502;
    throw enrollmentError;
  }
};

const notifyLessonCompletion = async ({ studentId, courseId, lessonId, authorization }) => {
  if (!lessonId) {
    return null;
  }

  try {
    const response = await axios.post(
      `${LEARNING_SERVICE_URL}/api/lessons/complete`,
      {
        student_id: studentId,
        course_id: courseId,
        lesson_id: lessonId,
      },
      { headers: { Authorization: authorization } }
    );
    return response.data;
  } catch (error) {
    console.error('Failed to update lesson completion', error.response?.data || error.message);
    return null;
  }
};

// Helper: ownership check reads go through distributed router (replica for SELECT)
const getQuizForTeacher = async (quizId, teacherId) => {
  const result = await query(
    `SELECT q.*
     FROM quizzes q
     JOIN courses c ON q.course_id = c.id
     WHERE q.id = $1 AND c.teacher_id = $2`,
    [quizId, teacherId]
  );

  return result.rows[0];
};

const getQuestionForTeacher = async (questionId, teacherId) => {
  const result = await query(
    `SELECT q.*
     FROM questions q
     JOIN quizzes quiz ON q.quiz_id = quiz.id
     JOIN courses c ON quiz.course_id = c.id
     WHERE q.id = $1 AND c.teacher_id = $2`,
    [questionId, teacherId]
  );

  return result.rows[0];
};

const canViewQuiz = (quiz, user) => {
  return quiz.is_published || user.role === 'ADMIN' || user.id === quiz.teacher_id;
};

const validateQuizForPublish = async (quizId) => {
  const questions = await query(
    `SELECT q.*,
            COUNT(o.id)::int as option_count,
            COUNT(o.id) FILTER (WHERE o.is_correct = TRUE)::int as correct_count
     FROM questions q
     LEFT JOIN question_options o ON q.id = o.question_id
     WHERE q.quiz_id = $1
     GROUP BY q.id`,
    [quizId]
  );

  if (questions.rows.length === 0) {
    return 'Cannot publish quiz without questions';
  }

  for (const question of questions.rows) {
    if (question.question_type === 'TEXT' && !question.expected_answer) {
      return 'Text questions require an expected answer before publishing';
    }

    if (question.question_type === 'MCQ' && (question.option_count < 2 || question.correct_count < 1)) {
      return 'Multiple choice questions require at least two options and one correct answer';
    }

    if (question.question_type === 'TRUE_FALSE' && (question.option_count !== 2 || question.correct_count !== 1)) {
      return 'True/false questions require exactly two options and one correct answer';
    }
  }

  return null;
};

const createQuiz = async (req, res) => {
  const { course_id, lesson_id, title, description, time_limit, passing_score = 50, max_attempts = 3 } = req.body;

  if (!course_id || !title) {
    return res.status(400).json({ error: 'Course ID and title are required' });
  }

  try {
    const courseCheck = await query(
      'SELECT * FROM courses WHERE id = $1 AND teacher_id = $2',
      [course_id, req.user.id]
    );

    if (courseCheck.rows.length === 0) {
      return res.status(403).json({ error: 'You can only create quizzes for your own courses' });
    }

    if (lesson_id) {
      const lessonCheck = await query(
        'SELECT id FROM lessons WHERE id = $1 AND course_id = $2',
        [lesson_id, course_id]
      );

      if (lessonCheck.rows.length === 0) {
        return res.status(400).json({ error: 'Lesson does not belong to this course' });
      }
    }

    const result = await query(
      `INSERT INTO quizzes (course_id, lesson_id, title, description, time_limit, passing_score, max_attempts)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [course_id, lesson_id || null, title, description || null, time_limit || null, passing_score, max_attempts]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create quiz' });
  }
};

const updateQuiz = async (req, res) => {
  const { id } = req.params;
  const { title, description, time_limit, passing_score, max_attempts, lesson_id } = req.body;

  try {
    const quiz = await getQuizForTeacher(id, req.user.id);
    if (!quiz) {
      return res.status(404).json({ error: 'Quiz not found' });
    }

    const result = await query(
      `UPDATE quizzes
       SET title = COALESCE($1, title),
           description = COALESCE($2, description),
           time_limit = $3,
           passing_score = COALESCE($4, passing_score),
           max_attempts = COALESCE($5, max_attempts),
           lesson_id = $6,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $7
       RETURNING *`,
      [
        title || null,
        description || null,
        time_limit === undefined ? quiz.time_limit : time_limit,
        passing_score || null,
        max_attempts || null,
        lesson_id === undefined ? quiz.lesson_id : lesson_id,
        id,
      ]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update quiz' });
  }
};

const deleteQuiz = async (req, res) => {
  const { id } = req.params;

  try {
    const quiz = await getQuizForTeacher(id, req.user.id);
    if (!quiz) {
      return res.status(404).json({ error: 'Quiz not found' });
    }

    await query('DELETE FROM quizzes WHERE id = $1', [id]);
    res.json({ message: 'Quiz deleted' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to delete quiz' });
  }
};

const publishQuiz = async (req, res) => {
  const { id } = req.params;
  const { is_published = true } = req.body;

  try {
    const quiz = await getQuizForTeacher(id, req.user.id);
    if (!quiz) {
      return res.status(404).json({ error: 'Quiz not found' });
    }

    if (is_published) {
      const validationError = await validateQuizForPublish(id);
      if (validationError) {
        return res.status(400).json({ error: validationError });
      }
    }

    const result = await query(
      'UPDATE quizzes SET is_published = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
      [is_published, id]
    );

    res.json({ message: is_published ? 'Quiz published' : 'Quiz unpublished', quiz: result.rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to publish quiz' });
  }
};

// Refactored: uses transaction() helper instead of pool.connect() directly.
// Permission check (getQuizForTeacher) runs as a read outside the transaction
// so it correctly routes to the replica via the distributed query router.
const addQuestion = async (req, res) => {
  const { quizId } = req.params;
  const { question_text, question_type, points = 1, explanation, expected_answer, order = 0, options = [] } = req.body;

  if (!question_text || !QUESTION_TYPES.includes(question_type)) {
    return res.status(400).json({ error: 'Question text and a valid question type are required' });
  }

  try {
    // Ownership check — read-only, routes to replica
    const quiz = await getQuizForTeacher(quizId, req.user.id);
    if (!quiz) {
      return res.status(404).json({ error: 'Quiz not found' });
    }

    // All writes inside a single atomic transaction on PRIMARY
    const result = await transaction(async (client) => {
      const questionResult = await client.query(
        `INSERT INTO questions (quiz_id, question_text, question_type, points, explanation, expected_answer, "order")
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [quizId, question_text, question_type, points, explanation || null, expected_answer || null, order]
      );

      const question = questionResult.rows[0];
      const createdOptions = [];

      for (const [index, option] of options.entries()) {
        if (!option.option_text) {
          continue;
        }

        const optionResult = await client.query(
          `INSERT INTO question_options (question_id, option_text, is_correct, "order")
           VALUES ($1, $2, $3, $4)
           RETURNING *`,
          [question.id, option.option_text, Boolean(option.is_correct), option.order ?? index]
        );
        createdOptions.push(optionResult.rows[0]);
      }

      return { ...question, options: createdOptions };
    });

    res.status(201).json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to add question' });
  }
};

const updateQuestion = async (req, res) => {
  const { id } = req.params;
  const { question_text, question_type, points, explanation, expected_answer, order } = req.body;

  if (question_type && !QUESTION_TYPES.includes(question_type)) {
    return res.status(400).json({ error: 'Invalid question type' });
  }

  try {
    const question = await getQuestionForTeacher(id, req.user.id);
    if (!question) {
      return res.status(404).json({ error: 'Question not found' });
    }

    const result = await query(
      `UPDATE questions
       SET question_text = COALESCE($1, question_text),
           question_type = COALESCE($2, question_type),
           points = COALESCE($3, points),
           explanation = COALESCE($4, explanation),
           expected_answer = COALESCE($5, expected_answer),
           "order" = COALESCE($6, "order")
       WHERE id = $7
       RETURNING *`,
      [question_text || null, question_type || null, points || null, explanation || null, expected_answer || null, order ?? null, id]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update question' });
  }
};

const deleteQuestion = async (req, res) => {
  const { id } = req.params;

  try {
    const question = await getQuestionForTeacher(id, req.user.id);
    if (!question) {
      return res.status(404).json({ error: 'Question not found' });
    }

    await query('DELETE FROM questions WHERE id = $1', [id]);
    res.json({ message: 'Question deleted' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to delete question' });
  }
};

const addOption = async (req, res) => {
  const { id: questionId } = req.params;
  const { option_text, is_correct = false, order = 0 } = req.body;

  if (!option_text) {
    return res.status(400).json({ error: 'Option text is required' });
  }

  try {
    const question = await getQuestionForTeacher(questionId, req.user.id);
    if (!question) {
      return res.status(404).json({ error: 'Question not found' });
    }

    const result = await query(
      `INSERT INTO question_options (question_id, option_text, is_correct, "order")
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [questionId, option_text, is_correct, order]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to add option' });
  }
};

const getTeacherQuizDetails = async (req, res) => {
  const { id } = req.params;

  try {
    const quiz = await getQuizForTeacher(id, req.user.id);
    if (!quiz) {
      return res.status(404).json({ error: 'Quiz not found' });
    }

    const questions = await query(
      `SELECT q.*,
              COALESCE(
                json_agg(
                  json_build_object(
                    'id', o.id,
                    'text', o.option_text,
                    'is_correct', o.is_correct,
                    'order', o."order"
                  )
                  ORDER BY o."order"
                ) FILTER (WHERE o.id IS NOT NULL),
                '[]'::json
              ) as options
       FROM questions q
       LEFT JOIN question_options o ON o.question_id = q.id
       WHERE q.quiz_id = $1
       GROUP BY q.id
       ORDER BY q."order" ASC`,
      [id]
    );

    res.json({ quiz, questions: questions.rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch quiz details' });
  }
};

const getCourseQuizzes = async (req, res) => {
  const { courseId } = req.params;

  try {
    const courseResult = await query('SELECT * FROM courses WHERE id = $1', [courseId]);
    if (courseResult.rows.length === 0) {
      return res.status(404).json({ error: 'Course not found' });
    }

    const course = courseResult.rows[0];
    const isOwner = req.user.id === course.teacher_id;
    const canSeeDrafts = req.user.role === 'ADMIN' || isOwner;

    if (!course.approved && !canSeeDrafts) {
      return res.status(403).json({ error: 'Course is awaiting approval' });
    }

    if (req.user.role === 'STUDENT') {
      await ensureStudentEnrolled(req.user.id, courseId, req.headers.authorization);
    }

    const params = [req.user.id, courseId];
    let publishFilter = '';

    if (!canSeeDrafts) {
      publishFilter = 'AND q.is_published = TRUE';
    }

    const quizzes = await query(
      `SELECT q.*,
              COUNT(DISTINCT qs.id)::int as total_questions,
              COUNT(DISTINCT qa.id)::int as attempts_count,
              MAX(qa.percentage) as best_percentage,
              BOOL_OR(qa.passed) as passed
       FROM quizzes q
       LEFT JOIN questions qs ON q.id = qs.quiz_id
       LEFT JOIN quiz_attempts qa ON q.id = qa.quiz_id AND qa.student_id = $1
       WHERE q.course_id = $2 ${publishFilter}
       GROUP BY q.id
       ORDER BY q.created_at ASC`,
      params
    );

    res.json(quizzes.rows);
  } catch (error) {
    console.error(error);
    res.status(error.status || 500).json({ error: error.message || 'Failed to fetch quizzes' });
  }
};

const getCourseQuizCompletion = async (req, res) => {
  const { courseId, studentId } = req.params;

  if (parseInt(studentId) !== req.user.id && req.user.role !== 'TEACHER' && req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Access denied' });
  }

  try {
    const quizzes = await query(
      `SELECT q.id, q.title,
              COALESCE(BOOL_OR(qa.passed), FALSE) as passed,
              MAX(qa.percentage) as best_percentage
       FROM quizzes q
       LEFT JOIN quiz_attempts qa ON qa.quiz_id = q.id AND qa.student_id = $1
       WHERE q.course_id = $2 AND q.is_published = TRUE
       GROUP BY q.id
       ORDER BY q.created_at ASC`,
      [studentId, courseId]
    );

    const totalRequired = quizzes.rows.length;
    const passedRequired = quizzes.rows.filter((quiz) => quiz.passed).length;

    res.json({
      course_id: parseInt(courseId),
      student_id: parseInt(studentId),
      total_required: totalRequired,
      passed_required: passedRequired,
      completed: totalRequired === passedRequired,
      quizzes: quizzes.rows,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch quiz completion' });
  }
};

const getQuizDetails = async (req, res) => {
  const { id } = req.params;

  try {
    const quizResult = await query(
      `SELECT q.*, c.title as course_title, c.teacher_id, c.approved
       FROM quizzes q
       JOIN courses c ON q.course_id = c.id
       WHERE q.id = $1`,
      [id]
    );

    if (quizResult.rows.length === 0) {
      return res.status(404).json({ error: 'Quiz not found' });
    }

    const quiz = quizResult.rows[0];
    if (!canViewQuiz(quiz, req.user) || (!quiz.approved && req.user.role !== 'ADMIN' && req.user.id !== quiz.teacher_id)) {
      return res.status(403).json({ error: 'Quiz is not available' });
    }

    if (req.user.role === 'STUDENT') {
      await ensureStudentEnrolled(req.user.id, quiz.course_id, req.headers.authorization);
    }

    const questions = await query(
      `SELECT q.id, q.question_text, q.question_type, q.points, q.explanation, q."order",
              COALESCE(
                json_agg(
                  json_build_object('id', o.id, 'text', o.option_text, 'order', o."order")
                  ORDER BY o."order"
                ) FILTER (WHERE o.id IS NOT NULL),
                '[]'::json
              ) as options
       FROM questions q
       LEFT JOIN question_options o ON o.question_id = q.id
       WHERE q.quiz_id = $1
       GROUP BY q.id
       ORDER BY q."order" ASC`,
      [id]
    );

    res.json({
      quiz: {
        id: quiz.id,
        course_id: quiz.course_id,
        lesson_id: quiz.lesson_id,
        course_title: quiz.course_title,
        title: quiz.title,
        description: quiz.description,
        time_limit: quiz.time_limit,
        passing_score: quiz.passing_score,
        max_attempts: quiz.max_attempts,
        total_questions: questions.rows.length,
        total_points: questions.rows.reduce((sum, question) => sum + question.points, 0),
      },
      questions: questions.rows,
    });
  } catch (error) {
    console.error(error);
    res.status(error.status || 500).json({ error: error.message || 'Failed to fetch quiz details' });
  }
};

const startAttempt = async (req, res) => {
  const { id: quizId } = req.params;
  const studentId = req.user.id;

  if (req.user.role !== 'STUDENT') {
    return res.status(403).json({ error: 'Only students can start quiz attempts' });
  }

  try {
    const quizResult = await query(
      `SELECT q.*, c.approved
       FROM quizzes q
       JOIN courses c ON q.course_id = c.id
       WHERE q.id = $1 AND q.is_published = TRUE`,
      [quizId]
    );

    if (quizResult.rows.length === 0 || !quizResult.rows[0].approved) {
      return res.status(404).json({ error: 'Quiz not found' });
    }

    const quiz = quizResult.rows[0];
    await ensureStudentEnrolled(studentId, quiz.course_id, req.headers.authorization);

    const unfinishedAttempt = await query(
      `SELECT * FROM quiz_attempts
       WHERE quiz_id = $1 AND student_id = $2 AND completed_at IS NULL
       ORDER BY started_at DESC
       LIMIT 1`,
      [quizId, studentId]
    );

    if (unfinishedAttempt.rows.length > 0) {
      return res.json({
        attempt_id: unfinishedAttempt.rows[0].id,
        message: 'Resuming previous attempt',
      });
    }

    const attemptCount = await query(
      'SELECT COUNT(*)::int FROM quiz_attempts WHERE quiz_id = $1 AND student_id = $2',
      [quizId, studentId]
    );

    if (attemptCount.rows[0].count >= quiz.max_attempts) {
      return res.status(400).json({ error: 'You have reached the maximum number of attempts' });
    }

    const result = await query(
      `INSERT INTO quiz_attempts (quiz_id, student_id, attempt_number)
       VALUES ($1, $2, $3)
       RETURNING id, attempt_number, started_at`,
      [quizId, studentId, attemptCount.rows[0].count + 1]
    );

    res.status(201).json({
      attempt_id: result.rows[0].id,
      attempt_number: result.rows[0].attempt_number,
      started_at: result.rows[0].started_at,
      message: 'Quiz started',
    });
  } catch (error) {
    console.error(error);
    res.status(error.status || 500).json({ error: error.message || 'Failed to start quiz' });
  }
};

// Refactored: uses transaction() helper instead of pool.connect() directly.
// The 404 early-exit becomes a thrown error (status=404) that the outer catch
// translates back into a proper HTTP 404 response.
const submitAttempt = async (req, res) => {
  const { attemptId } = req.params;
  const { answers = [], time_spent } = req.body;
  const studentId = req.user.id;

  try {
    const result = await transaction(async (client) => {
      const attemptResult = await client.query(
        `SELECT qa.*, q.passing_score, q.course_id, q.lesson_id
         FROM quiz_attempts qa
         JOIN quizzes q ON qa.quiz_id = q.id
         WHERE qa.id = $1 AND qa.student_id = $2 AND qa.completed_at IS NULL`,
        [attemptId, studentId]
      );

      if (attemptResult.rows.length === 0) {
        const err = new Error('Attempt not found or already completed');
        err.status = 404;
        throw err;
      }

      const attempt = attemptResult.rows[0];
      const questions = await client.query(
        'SELECT * FROM questions WHERE quiz_id = $1 ORDER BY "order" ASC',
        [attempt.quiz_id]
      );

      await client.query('DELETE FROM student_answers WHERE attempt_id = $1', [attemptId]);

      let totalPoints = 0;
      let earnedPoints = 0;
      const gradedAnswers = [];

      for (const question of questions.rows) {
        totalPoints += question.points;
        const userAnswer = answers.find((answer) => parseInt(answer.question_id) === question.id);
        let isCorrect = false;
        let pointsEarned = 0;
        let selectedOptionId = null;

        if (['MCQ', 'TRUE_FALSE'].includes(question.question_type) && userAnswer?.selected_option_id) {
          const optionCheck = await client.query(
            'SELECT * FROM question_options WHERE id = $1 AND question_id = $2',
            [userAnswer.selected_option_id, question.id]
          );

          if (optionCheck.rows.length > 0) {
            selectedOptionId = optionCheck.rows[0].id;
            isCorrect = optionCheck.rows[0].is_correct;
            pointsEarned = isCorrect ? question.points : 0;
          }
        } else if (question.question_type === 'TEXT' && question.expected_answer && userAnswer?.text_answer) {
          isCorrect = normalizeAnswer(userAnswer.text_answer) === normalizeAnswer(question.expected_answer);
          pointsEarned = isCorrect ? question.points : 0;
        }

        earnedPoints += pointsEarned;

        await client.query(
          `INSERT INTO student_answers
           (attempt_id, question_id, selected_option_id, text_answer, is_correct, points_earned)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [attemptId, question.id, selectedOptionId, userAnswer?.text_answer || null, isCorrect, pointsEarned]
        );

        gradedAnswers.push({
          question_id: question.id,
          is_correct: isCorrect,
          points_earned: pointsEarned,
          max_points: question.points,
        });
      }

      const percentage = totalPoints === 0 ? 0 : Number(((earnedPoints / totalPoints) * 100).toFixed(2));
      const passed = percentage >= attempt.passing_score;

      const updatedAttempt = await client.query(
        `UPDATE quiz_attempts
         SET score = $1,
             percentage = $2,
             passed = $3,
             completed_at = CURRENT_TIMESTAMP,
             time_spent = $4
         WHERE id = $5
         RETURNING *`,
        [earnedPoints, percentage, passed, time_spent || null, attemptId]
      );

      return {
        attempt: updatedAttempt.rows[0],
        totalPoints,
        earnedPoints,
        percentage,
        passed,
        gradedAnswers,
      };
    });

    const lessonCompletion = result.percentage >= 50
      ? await notifyLessonCompletion({
        studentId,
        courseId: result.attempt.course_id,
        lessonId: result.attempt.lesson_id,
        authorization: req.headers.authorization,
      })
      : null;

    res.json({
      message: 'Quiz submitted',
      attempt: result.attempt,
      total_points: result.totalPoints,
      earned_points: result.earnedPoints,
      percentage: result.percentage,
      passed: result.passed,
      lesson_completion: lessonCompletion,
      answers: result.gradedAnswers,
    });
  } catch (error) {
    console.error(error);
    res.status(error.status || 500).json({ error: error.message || 'Failed to submit quiz' });
  }
};

const getAttemptResult = async (req, res) => {
  const { attemptId } = req.params;

  try {
    const attemptResult = await query(
      `SELECT qa.*, q.title as quiz_title, q.passing_score, q.course_id, q.lesson_id, c.teacher_id
       FROM quiz_attempts qa
       JOIN quizzes q ON qa.quiz_id = q.id
       JOIN courses c ON q.course_id = c.id
       WHERE qa.id = $1`,
      [attemptId]
    );

    if (attemptResult.rows.length === 0) {
      return res.status(404).json({ error: 'Attempt not found' });
    }

    const attempt = attemptResult.rows[0];
    const canView = req.user.role === 'ADMIN' || req.user.id === attempt.student_id || req.user.id === attempt.teacher_id;

    if (!canView) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const answers = await query(
      `SELECT sa.*, q.question_text, q.points as max_points, q.explanation,
              qo.option_text as selected_option,
              (SELECT option_text FROM question_options WHERE question_id = q.id AND is_correct = TRUE ORDER BY "order" LIMIT 1) as correct_answer
       FROM student_answers sa
       JOIN questions q ON sa.question_id = q.id
       LEFT JOIN question_options qo ON sa.selected_option_id = qo.id
       WHERE sa.attempt_id = $1
       ORDER BY q."order"`,
      [attemptId]
    );

    res.json({
      attempt: {
        id: attempt.id,
        quiz_id: attempt.quiz_id,
        course_id: attempt.course_id,
        lesson_id: attempt.lesson_id,
        quiz_title: attempt.quiz_title,
        score: attempt.score,
        percentage: attempt.percentage,
        passed: attempt.passed,
        passing_score: attempt.passing_score,
        completed_at: attempt.completed_at,
        time_spent: attempt.time_spent,
      },
      answers: answers.rows,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch results' });
  }
};

const getQuizAttempts = async (req, res) => {
  const { id } = req.params;

  try {
    const quiz = await getQuizForTeacher(id, req.user.id);
    if (!quiz) {
      return res.status(404).json({ error: 'Quiz not found' });
    }

    const attempts = await query(
      `SELECT qa.*
       FROM quiz_attempts qa
       WHERE qa.quiz_id = $1
       ORDER BY qa.completed_at DESC NULLS LAST, qa.started_at DESC`,
      [id]
    );

    res.json(attempts.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch quiz attempts' });
  }
};

const getQuizHistory = async (req, res) => {
  const { studentId } = req.params;

  if (parseInt(studentId) !== req.user.id && req.user.role !== 'TEACHER' && req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Access denied' });
  }

  try {
    const history = await query(
      `SELECT qa.*, q.title as quiz_title, q.passing_score, c.title as course_title
       FROM quiz_attempts qa
       JOIN quizzes q ON qa.quiz_id = q.id
       JOIN courses c ON q.course_id = c.id
       WHERE qa.student_id = $1
       ORDER BY qa.completed_at DESC NULLS LAST, qa.started_at DESC`,
      [studentId]
    );

    res.json(history.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch quiz history' });
  }
};

module.exports = {
  createQuiz,
  updateQuiz,
  deleteQuiz,
  publishQuiz,
  addQuestion,
  updateQuestion,
  deleteQuestion,
  addOption,
  getTeacherQuizDetails,
  getCourseQuizzes,
  getCourseQuizCompletion,
  getQuizDetails,
  startAttempt,
  submitAttempt,
  getAttemptResult,
  getQuizAttempts,
  getQuizHistory,
};
