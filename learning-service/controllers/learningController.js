const { query } = require('../db');
const axios = require('axios');
const PDFDocument = require('pdfkit');

const generateCertificateCode = (studentId, courseId) => {
  const uniquePart = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return `CERT-${studentId}-${courseId}-${uniquePart}`.toUpperCase();
};

const getCourseDetails = async (courseId, authorization) => {
  const headers = authorization ? { Authorization: authorization } : {};
  const response = await axios.get(
    `${process.env.COURSE_SERVICE_URL}/api/courses/${courseId}`,
    { headers }
  );
  return response.data;
};

const getQuizCompletion = async (studentId, courseId, authorization) => {
  const headers = authorization ? { Authorization: authorization } : {};
  const response = await axios.get(
    `${process.env.COURSE_SERVICE_URL}/api/courses/${courseId}/students/${studentId}/quiz-completion`,
    { headers }
  );
  return response.data;
};

const ensureQuizCompletion = async (studentId, courseId, authorization) => {
  const completion = await getQuizCompletion(studentId, courseId, authorization);

  if (!completion.completed) {
    const error = new Error('All required quizzes must be passed before certificate generation');
    error.status = 400;
    error.quiz_completion = completion;
    throw error;
  }

  return completion;
};

const findOrCreateCertificate = async ({ studentId, courseId, studentName, authorization }) => {
  const existing = await query(
    'SELECT * FROM certificates WHERE student_id = $1 AND course_id = $2',
    [studentId, courseId]
  );

  if (existing.rows.length > 0) {
    return existing.rows[0];
  }

  const course = await getCourseDetails(courseId, authorization);
  const result = await query(
    `INSERT INTO certificates (student_id, course_id, certificate_code, student_name, course_title)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (student_id, course_id) DO UPDATE
       SET student_name = EXCLUDED.student_name
     RETURNING *`,
    [
      studentId,
      courseId,
      generateCertificateCode(studentId, courseId),
      studentName || 'Student',
      course.title,
    ]
  );

  return result.rows[0];
};

const streamCertificatePdf = (certificate, res) => {
  const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 50 });
  const issuedDate = new Date(certificate.issued_at).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="certificate-${certificate.course_id}.pdf"`
  );

  doc.pipe(res);

  doc
    .rect(30, 30, 782, 535)
    .lineWidth(3)
    .strokeColor('#1f2937')
    .stroke();

  doc
    .fontSize(34)
    .fillColor('#111827')
    .text('Certificate of Completion', 0, 95, { align: 'center' });

  doc
    .moveDown(1.2)
    .fontSize(16)
    .fillColor('#4b5563')
    .text('This certifies that', { align: 'center' });

  doc
    .moveDown(0.6)
    .fontSize(30)
    .fillColor('#111827')
    .text(certificate.student_name, { align: 'center' });

  doc
    .moveDown(0.7)
    .fontSize(16)
    .fillColor('#4b5563')
    .text('has successfully completed', { align: 'center' });

  doc
    .moveDown(0.5)
    .fontSize(24)
    .fillColor('#2563eb')
    .text(certificate.course_title, { align: 'center' });

  doc
    .moveDown(1.4)
    .fontSize(13)
    .fillColor('#374151')
    .text(`Issued on ${issuedDate}`, { align: 'center' });

  doc
    .moveDown(0.5)
    .fontSize(10)
    .fillColor('#6b7280')
    .text(`Certificate ID: ${certificate.certificate_code}`, { align: 'center' });

  doc.end();
};

const enrollStudent = async (req, res) => {
  const { course_id } = req.body;
  const student_id = req.user.id;
  
  if (!course_id) {
    return res.status(400).json({ error: 'Course ID required' });
  }
  
  // Verify student role
  if (req.user.role !== 'STUDENT') {
    return res.status(403).json({ error: 'Only students can enroll' });
  }
  
  try {
    // Verify course exists via course-service
    const courseResponse = await axios.get(
      `${process.env.COURSE_SERVICE_URL}/api/courses/${course_id}`,
      { headers: { Authorization: req.headers.authorization } }
    );
    
    if (!courseResponse.data) {
      return res.status(404).json({ error: 'Course not found' });
    }
    
    // Check for duplicate enrollment
    const existing = await query(
      'SELECT * FROM enrollments WHERE student_id = $1 AND course_id = $2',
      [student_id, course_id]
    );
    
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Already enrolled in this course' });
    }
    
    const result = await query(
      'INSERT INTO enrollments (student_id, course_id, progress) VALUES ($1, $2, $3) RETURNING *',
      [student_id, course_id, 0]
    );
    
    res.status(201).json({
      message: 'Successfully enrolled',
      enrollment: result.rows[0]
    });
  } catch (error) {
    if (error.response && error.response.status === 404) {
      return res.status(404).json({ error: 'Course not found' });
    }
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getStudentCourses = async (req, res) => {
  const { studentId } = req.params;
  
  // Only allow users to see their own courses
  if (parseInt(studentId) !== req.user.id && req.user.role !== 'TEACHER') {
    return res.status(403).json({ error: 'Access denied' });
  }
  
  try {
    const enrollments = await query(
      'SELECT * FROM enrollments WHERE student_id = $1',
      [studentId]
    );
    
    // Fetch course details for each enrollment
    const courses = await Promise.all(
      enrollments.rows.map(async (enrollment) => {
        try {
          const courseResponse = await axios.get(
            `${process.env.COURSE_SERVICE_URL}/api/courses/${enrollment.course_id}`
          );
          return {
            ...courseResponse.data,
            progress: enrollment.progress,
            enrolled_at: enrollment.enrolled_at
          };
        } catch (err) {
          return null;
        }
      })
    );
    
    res.json(courses.filter(c => c !== null));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const updateProgress = async (req, res) => {
  const { student_id, course_id, progress } = req.body;
  
  if (!student_id || !course_id || progress === undefined) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  
  if (progress < 0 || progress > 100) {
    return res.status(400).json({ error: 'Progress must be between 0 and 100' });
  }
  
  // Verify user is updating their own progress
  if (parseInt(student_id) !== req.user.id) {
    return res.status(403).json({ error: 'You can only update your own progress' });
  }
  
  try {
    const previous = await query(
      'SELECT * FROM enrollments WHERE student_id = $1 AND course_id = $2',
      [student_id, course_id]
    );

    if (previous.rows.length === 0) {
      return res.status(404).json({ error: 'Enrollment not found' });
    }

    let certificate = null;
    let quizCompletion = null;

    if (progress === 100 && previous.rows[0].progress < 100) {
      certificate = await findOrCreateCertificate({
        studentId: parseInt(student_id),
        courseId: parseInt(course_id),
        studentName: req.user.name,
        authorization: req.headers.authorization,
      });
    }

    const result = await query(
      `UPDATE enrollments 
       SET progress = $1, updated_at = CURRENT_TIMESTAMP 
       WHERE student_id = $2 AND course_id = $3 
       RETURNING *`,
      [progress, student_id, course_id]
    );
    
    res.json({
      message: 'Progress updated',
      enrollment: result.rows[0],
      quiz_completion: quizCompletion,
      certificate
    });
  } catch (error) {
    console.error(error);
    res.status(error.status || 500).json({
      error: error.message || 'Internal server error',
      quiz_completion: error.quiz_completion,
    });
  }
};

const getProgress = async (req, res) => {
  const { studentId, courseId } = req.params;
  
  if (parseInt(studentId) !== req.user.id && req.user.role !== 'TEACHER') {
    return res.status(403).json({ error: 'Access denied' });
  }
  
  try {
    const result = await query(
      'SELECT * FROM enrollments WHERE student_id = $1 AND course_id = $2',
      [studentId, courseId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Enrollment not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const completeLesson = async (req, res) => {
  const { student_id, course_id, lesson_id } = req.body;

  if (!student_id || !course_id || !lesson_id) {
    return res.status(400).json({ error: 'Student ID, course ID, and lesson ID are required' });
  }

  if (parseInt(student_id, 10) !== req.user.id && req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'You can only complete your own lessons' });
  }

  try {
    const enrollment = await query(
      'SELECT * FROM enrollments WHERE student_id = $1 AND course_id = $2',
      [student_id, course_id]
    );

    if (enrollment.rows.length === 0) {
      return res.status(404).json({ error: 'Enrollment not found' });
    }

    const course = await getCourseDetails(course_id, req.headers.authorization);
    const totalLessons = Array.isArray(course.lessons) ? course.lessons.length : 0;

    if (totalLessons === 0) {
      return res.status(400).json({ error: 'Course has no lessons to complete' });
    }

    const lessonBelongsToCourse = course.lessons.some((lesson) => Number(lesson.id) === Number(lesson_id));
    if (!lessonBelongsToCourse) {
      return res.status(400).json({ error: 'Lesson does not belong to this course' });
    }

    await query(
      `INSERT INTO lesson_completions (student_id, course_id, lesson_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (student_id, lesson_id)
       DO UPDATE SET completed_at = CURRENT_TIMESTAMP`,
      [student_id, course_id, lesson_id]
    );

    const completionCount = await query(
      'SELECT COUNT(*)::int AS completed_lessons FROM lesson_completions WHERE student_id = $1 AND course_id = $2',
      [student_id, course_id]
    );

    const completedLessons = completionCount.rows[0].completed_lessons;
    const progress = Math.min(100, Math.round((completedLessons / totalLessons) * 100));

    const updatedEnrollment = await query(
      `UPDATE enrollments
       SET progress = $1, updated_at = CURRENT_TIMESTAMP
       WHERE student_id = $2 AND course_id = $3
       RETURNING *`,
      [progress, student_id, course_id]
    );

    res.json({
      message: 'Lesson completed',
      completed_lessons: completedLessons,
      total_lessons: totalLessons,
      progress,
      course_completed: progress === 100,
      enrollment: updatedEnrollment.rows[0],
    });
  } catch (error) {
    console.error(error);
    res.status(error.response?.status || error.status || 500).json({
      error: error.response?.data?.error || error.message || 'Internal server error',
    });
  }
};

const getDashboard = async (req, res) => {
  const { studentId } = req.params;

  if (parseInt(studentId, 10) !== req.user.id && req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Access denied' });
  }

  try {
    const stats = await query(
      `SELECT
         COUNT(*)::int AS total_courses_enrolled,
         COUNT(*) FILTER (WHERE progress = 100)::int AS completed_courses,
         COALESCE(ROUND(AVG(progress)::numeric, 2), 0)::float AS average_progress
       FROM enrollments
       WHERE student_id = $1`,
      [studentId]
    );

    const recent = await query(
      `SELECT *
       FROM enrollments
       WHERE student_id = $1
       ORDER BY updated_at DESC, enrolled_at DESC
       LIMIT 5`,
      [studentId]
    );

    const recent_activity = await Promise.all(
      recent.rows.map(async (enrollment) => {
        try {
          const course = await getCourseDetails(enrollment.course_id, req.headers.authorization);
          return {
            course_id: enrollment.course_id,
            title: course.title,
            progress: enrollment.progress,
            last_accessed_at: enrollment.updated_at || enrollment.enrolled_at
          };
        } catch {
          return {
            course_id: enrollment.course_id,
            title: `Course #${enrollment.course_id}`,
            progress: enrollment.progress,
            last_accessed_at: enrollment.updated_at || enrollment.enrolled_at
          };
        }
      })
    );

    res.json({
      ...stats.rows[0],
      recent_activity
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getTeacherEnrollmentStats = async (req, res) => {
  const { teacherId } = req.params;

  if (parseInt(teacherId, 10) !== req.user.id && req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Access denied' });
  }

  try {
    const response = await axios.get(
      `${process.env.COURSE_SERVICE_URL}/api/teacher/${teacherId}/courses`,
      { headers: { Authorization: req.headers.authorization } }
    );
    const courses = response.data || [];
    const courseIds = courses.map((course) => Number(course.id));

    if (courseIds.length === 0) {
      return res.json({ total_students_enrolled: 0, courses: [], recent_enrollments: [] });
    }

    const byCourse = await query(
      `SELECT course_id, COUNT(DISTINCT student_id)::int AS student_count
       FROM enrollments
       WHERE course_id = ANY($1::int[])
       GROUP BY course_id`,
      [courseIds]
    );

    const recent = await query(
      `SELECT *
       FROM enrollments
       WHERE course_id = ANY($1::int[])
       ORDER BY enrolled_at DESC
       LIMIT 5`,
      [courseIds]
    );

    const counts = new Map(byCourse.rows.map((row) => [Number(row.course_id), Number(row.student_count)]));

    res.json({
      total_students_enrolled: byCourse.rows.reduce((sum, row) => sum + Number(row.student_count), 0),
      courses: courses.map((course) => ({
        id: course.id,
        title: course.title,
        student_count: counts.get(Number(course.id)) || 0
      })),
      recent_enrollments: recent.rows.map((enrollment) => ({
        id: enrollment.id,
        course_id: enrollment.course_id,
        course_title: courses.find((course) => Number(course.id) === Number(enrollment.course_id))?.title || `Course #${enrollment.course_id}`,
        student_id: enrollment.student_id,
        progress: enrollment.progress,
        enrolled_at: enrollment.enrolled_at
      }))
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getCompletedEnrollment = async (studentId, courseId, user, authorization) => {
  if (parseInt(studentId) !== user.id && user.role !== 'TEACHER' && user.role !== 'ADMIN') {
    const error = new Error('Access denied');
    error.status = 403;
    throw error;
  }

  const result = await query(
    'SELECT * FROM enrollments WHERE student_id = $1 AND course_id = $2',
    [studentId, courseId]
  );

  if (result.rows.length === 0) {
    const error = new Error('Enrollment not found');
    error.status = 404;
    throw error;
  }

  if (result.rows[0].progress < 100) {
    const error = new Error('Course is not completed yet');
    error.status = 400;
    throw error;
  }

  return result.rows[0];
};

const getCertificate = async (req, res) => {
  const { studentId, courseId } = req.params;

  try {
    await getCompletedEnrollment(studentId, courseId, req.user, req.headers.authorization);

    const certificate = await findOrCreateCertificate({
      studentId: parseInt(studentId),
      courseId: parseInt(courseId),
      studentName: parseInt(studentId) === req.user.id ? req.user.name : 'Student',
      authorization: req.headers.authorization,
    });

    res.json(certificate);
  } catch (error) {
    console.error(error);
    res.status(error.status || 500).json({ error: error.message || 'Internal server error' });
  }
};

const downloadCertificate = async (req, res) => {
  const { studentId, courseId } = req.params;

  try {
    await getCompletedEnrollment(studentId, courseId, req.user, req.headers.authorization);

    const certificate = await findOrCreateCertificate({
      studentId: parseInt(studentId),
      courseId: parseInt(courseId),
      studentName: parseInt(studentId) === req.user.id ? req.user.name : 'Student',
      authorization: req.headers.authorization,
    });

    streamCertificatePdf(certificate, res);
  } catch (error) {
    console.error(error);
    res.status(error.status || 500).json({ error: error.message || 'Internal server error' });
  }
};

const getAdminSummary = async (req, res) => {
  try {
    const enrollmentCounts = await query(`
      SELECT
        COUNT(*)::int AS total_enrollments,
        ROUND(AVG(progress)::numeric, 2)::float AS average_progress,
        COUNT(*) FILTER (WHERE progress = 100)::int AS completed_enrollments,
        COUNT(*) FILTER (WHERE progress > 0 AND progress < 100)::int AS in_progress_enrollments
      FROM enrollments
    `);

    res.json(enrollmentCounts.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
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
};
