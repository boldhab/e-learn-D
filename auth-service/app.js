const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');
const { activityMiddleware } = require('../shared/activity-log');

const app = express();

// ============================================
// MONITORING ENDPOINTS
// ============================================

if (!global.apiActivity) {
    global.apiActivity = [];
}

const trackApiActivity = (req, res, next) => {
    const startTime = Date.now();
    const originalEnd = res.end;

    res.end = function(chunk, encoding, callback) {
        const duration = Date.now() - startTime;

        global.apiActivity.unshift({
            timestamp: new Date().toISOString(),
            method: req.method,
            path: req.path,
            status: res.statusCode,
            duration,
            server: process.env.DB_NAME || 'unknown',
        });

        if (global.apiActivity.length > 100) {
            global.apiActivity = global.apiActivity.slice(0, 100);
        }

        return originalEnd.call(this, chunk, encoding, callback);
    };

    next();
};

// General rate limit for all requests
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
});

// Strict rate limit for auth endpoints (login/register)
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // Limit each IP to 5 login attempts per 15 minutes
    message: 'Too many login attempts, please try again later.',
    skipSuccessfulRequests: true,
});

app.use(cors());
app.use(express.json());
app.use(activityMiddleware('auth-service'));
app.use(trackApiActivity);

// Apply stricter limits to auth routes
app.use('/auth/login', authLimiter);
app.use('/auth/register', authLimiter);

// Apply general rate limit to other auth/admin routes
app.use('/auth', limiter);
app.use('/admin', limiter);

app.use('/auth', authRoutes);
app.use('/admin', adminRoutes);

// Basic health check
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        service: process.env.npm_package_name || 'auth-service',
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
        service: process.env.npm_package_name || 'auth-service',
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
    const stats = {
        totalUsers: 0,
        totalCourses: 0,
        totalEnrollments: 0,
        reads: 0,
        writes: 0,
        service: process.env.DB_NAME || 'auth_db',
        timestamp: new Date().toISOString(),
    };

    try {
        const users = await query('SELECT COUNT(*) FROM users');
        const dbStats = getStats();
        stats.totalUsers = parseInt(users.rows[0].count, 10);
        stats.reads = dbStats.reads || 0;
        stats.writes = dbStats.writes || 0;
        res.json(stats);
    } catch (error) {
        console.error('Stats error:', error.message);
        res.json(stats);
    }
});

app.get('/api/monitoring/activity', (req, res) => {
    res.json(global.apiActivity || []);
});

module.exports = app;
