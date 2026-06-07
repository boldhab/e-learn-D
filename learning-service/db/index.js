const distributedDB = require('../../shared/db-distributed');

const { query, transaction, getReplicationLag, getStats, checkHealth } = distributedDB;

const initDB = async () => {
    const createEnrollmentsTable = `
        CREATE TABLE IF NOT EXISTS enrollments (
            id SERIAL PRIMARY KEY,
            student_id INTEGER NOT NULL,
            course_id INTEGER NOT NULL,
            progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
            enrolled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(student_id, course_id)
        );
    `;

    const createCertificatesTable = `
        CREATE TABLE IF NOT EXISTS certificates (
            id SERIAL PRIMARY KEY,
            student_id INTEGER NOT NULL,
            course_id INTEGER NOT NULL,
            certificate_code VARCHAR(80) UNIQUE NOT NULL,
            student_name VARCHAR(100) NOT NULL,
            course_title VARCHAR(200) NOT NULL,
            issued_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(student_id, course_id)
        );
    `;

    const createLessonCompletionsTable = `
        CREATE TABLE IF NOT EXISTS lesson_completions (
            id SERIAL PRIMARY KEY,
            student_id INTEGER NOT NULL,
            course_id INTEGER NOT NULL,
            lesson_id INTEGER NOT NULL,
            completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(student_id, lesson_id)
        );
    `;
    
    try {
        await query(createEnrollmentsTable);
        await query(createCertificatesTable);
        await query(createLessonCompletionsTable);
        await query(`CREATE INDEX IF NOT EXISTS idx_lesson_completions_student_course ON lesson_completions(student_id, course_id);`);
        console.log('✅ Learning DB tables initialized on PRIMARY');
        
        const lag = await getReplicationLag();
        console.log(`📊 Replication lag: ${lag} seconds`);
        
    } catch (error) {
        console.error('Error initializing learning DB:', error);
        throw error;
    }
};

const getHealthStatus = async () => {
    await checkHealth();
    const lag = await getReplicationLag();
    const stats = getStats();
    
    return {
        primary: {
            host: process.env.DB_PRIMARY_HOST,
            port: process.env.DB_PRIMARY_PORT,
            healthy: stats.primary_healthy,
            connections: stats.primary_connections,
        },
        replica: {
            host: process.env.DB_REPLICA_HOST,
            port: process.env.DB_REPLICA_PORT,
            healthy: stats.replica_healthy,
            connections: stats.replica_connections,
        },
        replication_lag_seconds: lag,
        timestamp: new Date().toISOString(),
    };
};

module.exports = { query, transaction, initDB, getHealthStatus, getReplicationLag, getStats, checkHealth };
