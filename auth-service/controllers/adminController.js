const { query } = require('../db');

const getServiceUrl = (envName, fallback) => process.env[envName] || fallback;

const fetchJson = async (url, token) => {
  const response = await fetch(url, {
    headers: token ? { Authorization: token } : undefined,
  });

  if (!response.ok) {
    const errorText = await response.text();
    const error = new Error(errorText || `Request failed for ${url}`);
    error.status = response.status;
    throw error;
  }

  return response.json();
};

const csvEscape = (value) => {
  const text = value === null || value === undefined ? '' : String(value);
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
};

const buildCsv = (rows) => rows.map((row) => row.map(csvEscape).join(',')).join('\n');

const xmlEscape = (value) =>
  String(value === null || value === undefined ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const buildExcelXml = (rows, sheetName) => {
  const sheetRows = rows
    .map((row) => {
      const cells = row
        .map((cell) => `<Cell><Data ss:Type="String">${xmlEscape(cell)}</Data></Cell>`)
        .join('');
      return `<Row>${cells}</Row>`;
    })
    .join('');

  return `<?xml version="1.0"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:o="urn:schemas-microsoft-com:office:office"
  xmlns:x="urn:schemas-microsoft-com:office:excel"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Worksheet ss:Name="${xmlEscape(sheetName)}">
    <Table>${sheetRows}</Table>
  </Worksheet>
</Workbook>`;
};

const getUsers = async (req, res) => {
  try {
    const result = await query(
      'SELECT id, name, email, role, is_active, created_at FROM users ORDER BY created_at DESC'
    );

    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const updateUserStatus = async (req, res) => {
  const { id } = req.params;
  const { is_active } = req.body;

  if (typeof is_active !== 'boolean') {
    return res.status(400).json({ error: 'is_active must be a boolean' });
  }

  if (parseInt(id, 10) === req.user.id) {
    return res.status(400).json({ error: 'You cannot deactivate your own account' });
  }

  try {
    const result = await query(
      `UPDATE users
       SET is_active = $1
       WHERE id = $2
       RETURNING id, name, email, role, is_active, created_at`,
      [is_active, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      message: `User ${is_active ? 'activated' : 'deactivated'} successfully`,
      user: result.rows[0],
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getAnalytics = async (req, res) => {
  try {
    const [userCounts, courseSummary, learningSummary] = await Promise.all([
      query(`
        SELECT
          COUNT(*)::int AS total_users,
          COUNT(*) FILTER (WHERE is_active = TRUE)::int AS active_users,
          COUNT(*) FILTER (WHERE role = 'STUDENT')::int AS students,
          COUNT(*) FILTER (WHERE role = 'TEACHER')::int AS teachers,
          COUNT(*) FILTER (WHERE role = 'ADMIN')::int AS admins
        FROM users
      `),
      fetchJson(
        `${getServiceUrl('COURSE_SERVICE_URL', 'http://localhost:5002')}/api/admin/summary`,
        req.headers.authorization
      ),
      fetchJson(
        `${getServiceUrl('LEARNING_SERVICE_URL', 'http://localhost:5003')}/api/admin/summary`,
        req.headers.authorization
      ),
    ]);

    res.json({
      users: userCounts.rows[0],
      courses: courseSummary,
      learning: learningSummary,
    });
  } catch (error) {
    console.error(error);
    res.status(error.status || 500).json({ error: error.message || 'Internal server error' });
  }
};

const getSystemHealth = async (req, res) => {
  const services = [
    {
      name: 'auth-service',
      url: `${getServiceUrl('AUTH_SERVICE_URL', 'http://localhost:5001')}/health`,
    },
    {
      name: 'course-service',
      url: `${getServiceUrl('COURSE_SERVICE_URL', 'http://localhost:5002')}/health`,
    },
    {
      name: 'learning-service',
      url: `${getServiceUrl('LEARNING_SERVICE_URL', 'http://localhost:5003')}/health`,
    },
  ];

  try {
    const checks = await Promise.all(
      services.map(async (service) => {
        try {
          const response = await fetch(service.url);
          const payload = await response.json().catch(() => ({}));

          return {
            service: service.name,
            healthy: response.ok,
            status: payload.status || (response.ok ? 'OK' : 'DOWN'),
          };
        } catch (error) {
          return {
            service: service.name,
            healthy: false,
            status: 'DOWN',
          };
        }
      })
    );

    res.json({ services: checks });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const exportReports = async (req, res) => {
  const dataset = (req.query.dataset || 'summary').toLowerCase();
  const format = (req.query.format || 'csv').toLowerCase();

  try {
    let rows = [];

    if (dataset === 'users') {
      const users = await query(
        'SELECT id, name, email, role, is_active, created_at FROM users ORDER BY created_at DESC'
      );
      rows = [
        ['id', 'name', 'email', 'role', 'status', 'created_at'],
        ...users.rows.map((user) => [
          user.id,
          user.name,
          user.email,
          user.role,
          user.is_active ? 'ACTIVE' : 'INACTIVE',
          user.created_at,
        ]),
      ];
    } else if (dataset === 'courses') {
      const courseSummary = await fetchJson(
        `${getServiceUrl('COURSE_SERVICE_URL', 'http://localhost:5002')}/api/admin/courses`,
        req.headers.authorization
      );
      rows = [
        ['id', 'title', 'teacher_id', 'approved', 'lessons', 'created_at'],
        ...courseSummary.courses.map((course) => [
          course.id,
          course.title,
          course.teacher_id,
          course.approved ? 'APPROVED' : 'PENDING',
          course.lesson_count || 0,
          course.created_at,
        ]),
      ];
    } else if (dataset === 'reports') {
      const reports = await fetchJson(
        `${getServiceUrl('COURSE_SERVICE_URL', 'http://localhost:5002')}/api/admin/reports`,
        req.headers.authorization
      );
      rows = [
        ['id', 'content_type', 'content_id', 'content_title', 'status', 'reason', 'created_at'],
        ...reports.map((report) => [
          report.id,
          report.content_type,
          report.content_id,
          report.content_title,
          report.status,
          report.reason,
          report.created_at,
        ]),
      ];
    } else {
      const [userCounts, courseSummary, learningSummary] = await Promise.all([
        query(`
          SELECT
            COUNT(*)::int AS total_users,
            COUNT(*) FILTER (WHERE is_active = TRUE)::int AS active_users,
            COUNT(*) FILTER (WHERE role = 'STUDENT')::int AS students,
            COUNT(*) FILTER (WHERE role = 'TEACHER')::int AS teachers,
            COUNT(*) FILTER (WHERE role = 'ADMIN')::int AS admins
          FROM users
        `),
        fetchJson(
          `${getServiceUrl('COURSE_SERVICE_URL', 'http://localhost:5002')}/api/admin/summary`,
          req.headers.authorization
        ),
        fetchJson(
          `${getServiceUrl('LEARNING_SERVICE_URL', 'http://localhost:5003')}/api/admin/summary`,
          req.headers.authorization
        ),
      ]);

      rows = [
        ['metric', 'value'],
        ['total_users', userCounts.rows[0].total_users],
        ['active_users', userCounts.rows[0].active_users],
        ['students', userCounts.rows[0].students],
        ['teachers', userCounts.rows[0].teachers],
        ['admins', userCounts.rows[0].admins],
        ['total_courses', courseSummary.total_courses],
        ['approved_courses', courseSummary.approved_courses],
        ['pending_courses', courseSummary.pending_courses],
        ['total_reports', courseSummary.total_reports],
        ['open_reports', courseSummary.open_reports],
        ['total_enrollments', learningSummary.total_enrollments],
        ['average_progress', learningSummary.average_progress],
        ['completed_enrollments', learningSummary.completed_enrollments],
      ];
    }

    const fileBase = `${dataset}-report`;

    if (format === 'excel') {
      const xml = buildExcelXml(rows, dataset);
      res.setHeader('Content-Type', 'application/vnd.ms-excel');
      res.setHeader('Content-Disposition', `attachment; filename="${fileBase}.xls"`);
      return res.send(xml);
    }

    const csv = buildCsv(rows);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${fileBase}.csv"`);
    return res.send(csv);
  } catch (error) {
    console.error(error);
    res.status(error.status || 500).json({ error: error.message || 'Internal server error' });
  }
};

module.exports = {
  getUsers,
  updateUserStatus,
  getAnalytics,
  getSystemHealth,
  exportReports,
};
