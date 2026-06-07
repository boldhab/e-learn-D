const { query } = require('../db');

const DIFFICULTY_LEVELS = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'];
const SORT_OPTIONS = {
  newest: 'c.created_at DESC',
  popular: 'c.popularity DESC, c.created_at DESC',
  most_popular: 'c.popularity DESC, c.created_at DESC',
  highest_rated: 'c.average_rating DESC, c.rating_count DESC, c.created_at DESC',
};

const normalizeTags = (tags) => {
  if (!tags) {
    return [];
  }

  if (Array.isArray(tags)) {
    return tags.map((tag) => String(tag).trim()).filter(Boolean);
  }

  return String(tags)
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
};

const getCurrentUser = async (authorization) => {
  if (!authorization) {
    return null;
  }

  const response = await fetch(`${process.env.AUTH_SERVICE_URL}/auth/me`, {
    headers: { Authorization: authorization }
  });

  if (!response.ok) {
    const error = new Error('Authentication failed');
    error.status = response.status;
    throw error;
  }

  return response.json();
};

const getViewer = async (authorization) => {
  try {
    return await getCurrentUser(authorization);
  } catch (error) {
    return null;
  }
};

const createCourse = async (req, res) => {
  const { title, description, difficulty = 'BEGINNER', category } = req.body;
  const teacherId = req.user.id;
  const teacherName = req.user.name;
  const normalizedDifficulty = String(difficulty).toUpperCase();
  const tags = normalizeTags(req.body.tags);

  if (!title) {
    return res.status(400).json({ error: 'Title is required' });
  }

  if (!DIFFICULTY_LEVELS.includes(normalizedDifficulty)) {
    return res.status(400).json({ error: 'Difficulty must be BEGINNER, INTERMEDIATE, or ADVANCED' });
  }

  try {
    const result = await query(
      `INSERT INTO courses
        (title, description, teacher_id, teacher_name, difficulty, category, tags, approved)
       VALUES ($1, $2, $3, $4, $5, $6, $7, FALSE)
       RETURNING *`,
      [title, description, teacherId, teacherName, normalizedDifficulty, category || null, tags]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getAllCourses = async (req, res) => {
  try {
    const viewer = await getViewer(req.headers.authorization);
    const {
      search,
      q,
      difficulty,
      category,
      tag,
      tags,
      sort = 'newest',
    } = req.query;
    const searchTerm = search || q;
    const tagFilters = normalizeTags(tags || tag);
    const where = [];
    const params = [];

    const addParam = (value) => {
      params.push(value);
      return `$${params.length}`;
    };

    // Renamed from 'query' to 'sql' to avoid shadowing the imported query() function
    let sql = `
      SELECT c.*, COUNT(l.id)::int as lesson_count
      FROM courses c
      LEFT JOIN lessons l ON c.id = l.course_id
    `;

    if (viewer?.role === 'ADMIN') {
      // Admin can see every course.
    } else if (viewer?.role === 'TEACHER') {
      where.push(`(c.approved = TRUE OR c.teacher_id = ${addParam(viewer.id)})`);
    } else {
      where.push('c.approved = TRUE');
    }

    if (searchTerm) {
      const param = addParam(`%${searchTerm}%`);
      where.push(`(c.title ILIKE ${param} OR c.description ILIKE ${param} OR c.teacher_name ILIKE ${param})`);
    }

    if (difficulty) {
      const normalizedDifficulty = String(difficulty).toUpperCase();
      if (!DIFFICULTY_LEVELS.includes(normalizedDifficulty)) {
        return res.status(400).json({ error: 'Difficulty must be BEGINNER, INTERMEDIATE, or ADVANCED' });
      }
      where.push(`c.difficulty = ${addParam(normalizedDifficulty)}`);
    }

    if (category) {
      where.push(`c.category ILIKE ${addParam(category)}`);
    }

    if (tagFilters.length > 0) {
      where.push(`c.tags && ${addParam(tagFilters)}::text[]`);
    }

    if (where.length > 0) {
      sql += ` WHERE ${where.join(' AND ')}`;
    }

    sql += `
      GROUP BY c.id
      ORDER BY ${SORT_OPTIONS[sort] || SORT_OPTIONS.newest}
    `;

    const result = await query(sql, params);
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(error.status || 500).json({ error: error.message || 'Internal server error' });
  }
};

const getCourseById = async (req, res) => {
  const { id } = req.params;

  try {
    const courseResult = await query('SELECT * FROM courses WHERE id = $1', [id]);

    if (courseResult.rows.length === 0) {
      return res.status(404).json({ error: 'Course not found' });
    }

    const viewer = await getViewer(req.headers.authorization);
    const course = courseResult.rows[0];
    const canView = course.approved || viewer?.role === 'ADMIN' || viewer?.id === course.teacher_id;

    if (!canView) {
      return res.status(403).json({ error: 'Course is awaiting approval' });
    }

    const lessonsResult = await query(
      'SELECT * FROM lessons WHERE course_id = $1 ORDER BY "order" ASC',
      [id]
    );

    res.json({
      ...course,
      lessons: lessonsResult.rows
    });
  } catch (error) {
    console.error(error);
    res.status(error.status || 500).json({ error: error.message || 'Internal server error' });
  }
};

const addLesson = async (req, res) => {
  const { course_id, title, content, video_url, order } = req.body;

  if (!course_id || !title) {
    return res.status(400).json({ error: 'Course ID and title required' });
  }

  try {
    // Verify course exists and user owns it
    const courseCheck = await query('SELECT * FROM courses WHERE id = $1', [course_id]);

    if (courseCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Course not found' });
    }

    if (courseCheck.rows[0].teacher_id !== req.user.id) {
      return res.status(403).json({ error: 'You can only add lessons to your own courses' });
    }

    const result = await query(
      'INSERT INTO lessons (course_id, title, content, video_url, "order") VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [course_id, title, content, video_url, order || 0]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getTeacherCourses = async (req, res) => {
  const { teacherId } = req.params;

  try {
    const result = await query(
      'SELECT * FROM courses WHERE teacher_id = $1 ORDER BY created_at DESC',
      [teacherId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getAdminCourses = async (req, res) => {
  try {
    const result = await query(`
      SELECT c.*, COUNT(l.id) AS lesson_count
      FROM courses c
      LEFT JOIN lessons l ON c.id = l.course_id
      GROUP BY c.id
      ORDER BY c.created_at DESC
    `);

    res.json({ courses: result.rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const approveCourse = async (req, res) => {
  const { id } = req.params;
  const { approved = true } = req.body;

  try {
    const result = await query(
      `UPDATE courses
       SET approved = $1
       WHERE id = $2
       RETURNING *`,
      [approved, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Course not found' });
    }

    res.json({
      message: approved ? 'Course approved' : 'Course marked as pending',
      course: result.rows[0],
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const reportContent = async (req, res) => {
  const { content_type, content_id, reason } = req.body;
  const reporterId = req.user.id;

  if (!content_type || !content_id || !reason) {
    return res.status(400).json({ error: 'Content type, content ID, and reason are required' });
  }

  if (!['COURSE', 'LESSON'].includes(content_type)) {
    return res.status(400).json({ error: 'Content type must be COURSE or LESSON' });
  }

  try {
    let contentTitle = '';

    if (content_type === 'COURSE') {
      const contentResult = await query('SELECT title FROM courses WHERE id = $1', [content_id]);
      if (contentResult.rows.length === 0) {
        return res.status(404).json({ error: 'Course not found' });
      }
      contentTitle = contentResult.rows[0].title;
    } else {
      const contentResult = await query('SELECT title FROM lessons WHERE id = $1', [content_id]);
      if (contentResult.rows.length === 0) {
        return res.status(404).json({ error: 'Lesson not found' });
      }
      contentTitle = contentResult.rows[0].title;
    }

    const result = await query(
      `INSERT INTO reports (reporter_id, content_type, content_id, content_title, reason, status)
       VALUES ($1, $2, $3, $4, $5, 'OPEN')
       RETURNING *`,
      [reporterId, content_type, content_id, contentTitle, reason]
    );

    res.status(201).json({
      message: 'Content reported successfully',
      report: result.rows[0],
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getReportedContent = async (req, res) => {
  try {
    const result = await query(`
      SELECT *
      FROM reports
      ORDER BY created_at DESC
    `);

    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const updateReportStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!['OPEN', 'RESOLVED', 'DISMISSED'].includes(status)) {
    return res.status(400).json({ error: 'Invalid report status' });
  }

  try {
    const result = await query(
      `UPDATE reports
       SET status = $1,
           resolved_at = CASE WHEN $1 = 'OPEN' THEN NULL ELSE CURRENT_TIMESTAMP END
       WHERE id = $2
       RETURNING *`,
      [status, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Report not found' });
    }

    res.json({
      message: 'Report status updated',
      report: result.rows[0],
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getAdminSummary = async (req, res) => {
  try {
    const courseCounts = await query(`
      SELECT
        COUNT(*)::int AS total_courses,
        COUNT(*) FILTER (WHERE approved = TRUE)::int AS approved_courses,
        COUNT(*) FILTER (WHERE approved = FALSE)::int AS pending_courses
      FROM courses
    `);

    const reportCounts = await query(`
      SELECT
        COUNT(*)::int AS total_reports,
        COUNT(*) FILTER (WHERE status = 'OPEN')::int AS open_reports,
        COUNT(*) FILTER (WHERE status = 'RESOLVED')::int AS resolved_reports,
        COUNT(*) FILTER (WHERE status = 'DISMISSED')::int AS dismissed_reports
      FROM reports
    `);

    res.json({
      ...courseCounts.rows[0],
      ...reportCounts.rows[0],
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
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
  getAdminSummary,
};
