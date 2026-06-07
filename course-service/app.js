const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const courseRoutes = require('./routes/courseRoutes');
const quizRoutes = require('./routes/quizRoutes');
const { activityMiddleware, getRecentActivity } = require('../shared/activity-log');

const app = express();

// General rate limit for all requests
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
});

app.use(cors());
app.use(express.json());
app.use(activityMiddleware('course-service'));

// Apply to all routes
app.use('/api/', limiter);

app.use('/api', courseRoutes);
app.use('/api', quizRoutes);

// Basic health check
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        service: process.env.npm_package_name || 'course-service',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
    });
});

// Detailed health check with database status
app.get('/health/detailed', async (req, res) => {
    const { getHealthStatus } = require('./db');
    const dbStatus = await getHealthStatus();
    
    res.json({
        status: 'OK',
        service: process.env.npm_package_name || 'course-service',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        database: dbStatus,
    });
});

// Readiness probe (for orchestration)
app.get('/ready', async (req, res) => {
    const { checkHealth } = require('./db');
    const healthy = await checkHealth();
    
    if (healthy) {
        res.status(200).json({ status: 'ready' });
    } else {
        res.status(503).json({ status: 'not ready' });
    }
});

// Liveness probe
app.get('/live', (req, res) => {
    res.status(200).json({ status: 'alive' });
});

// Keep /api/health/distributed for backwards compatibility/tests
app.get('/api/health/distributed', async (req, res) => {
    const { getHealthStatus } = require('./db');
    const status = await getHealthStatus();
    res.json(status);
});

app.get('/api/monitoring/stats', async (req, res) => {
    const { query, getStats } = require('./db');
    const courses = await query('SELECT COUNT(*)::int AS total FROM courses');
    const stats = getStats();

    res.json({
        service: 'course-service',
        totalUsers: 0,
        totalCourses: courses.rows[0].total,
        totalEnrollments: 0,
        reads: stats.reads,
        writes: stats.writes,
        timestamp: new Date().toISOString(),
    });
});

app.get('/api/monitoring/activity', (req, res) => {
    res.json({ service: 'course-service', activity: getRecentActivity(10) });
});

module.exports = app;
