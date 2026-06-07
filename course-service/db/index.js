const distributedDB = require('../../shared/db-distributed');

const { query, transaction, getReplicationLag, getStats, checkHealth } = distributedDB;

const initDB = async () => {
    const createCoursesTable = `
        CREATE TABLE IF NOT EXISTS courses (
            id SERIAL PRIMARY KEY,
            title VARCHAR(200) NOT NULL,
            description TEXT,
            teacher_id INTEGER NOT NULL,
            teacher_name VARCHAR(100),
            difficulty VARCHAR(20) NOT NULL DEFAULT 'BEGINNER',
            category VARCHAR(100),
            tags TEXT[] NOT NULL DEFAULT '{}',
            popularity INTEGER NOT NULL DEFAULT 0,
            average_rating NUMERIC(3,2) NOT NULL DEFAULT 0,
            rating_count INTEGER NOT NULL DEFAULT 0,
            approved BOOLEAN NOT NULL DEFAULT TRUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    `;

    const createLessonsTable = `
        CREATE TABLE IF NOT EXISTS lessons (
            id SERIAL PRIMARY KEY,
            course_id INTEGER REFERENCES courses(id) ON DELETE CASCADE,
            title VARCHAR(200) NOT NULL,
            content TEXT,
            video_url VARCHAR(500),
            "order" INTEGER DEFAULT 0
        );
    `;

    const createReportsTable = `
        CREATE TABLE IF NOT EXISTS reports (
            id SERIAL PRIMARY KEY,
            reporter_id INTEGER NOT NULL,
            content_type VARCHAR(20) NOT NULL CHECK (content_type IN ('COURSE', 'LESSON')),
            content_id INTEGER NOT NULL,
            content_title VARCHAR(200) NOT NULL,
            reason TEXT NOT NULL,
            status VARCHAR(20) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'RESOLVED', 'DISMISSED')),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            resolved_at TIMESTAMP
        );
    `;

    const createQuizzesTable = `
        CREATE TABLE IF NOT EXISTS quizzes (
            id SERIAL PRIMARY KEY,
            course_id INTEGER REFERENCES courses(id) ON DELETE CASCADE,
            lesson_id INTEGER REFERENCES lessons(id) ON DELETE CASCADE,
            title VARCHAR(200) NOT NULL,
            description TEXT,
            time_limit INTEGER,
            passing_score INTEGER NOT NULL DEFAULT 70,
            max_attempts INTEGER NOT NULL DEFAULT 3,
            is_published BOOLEAN NOT NULL DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    `;

    const createQuestionsTable = `
        CREATE TABLE IF NOT EXISTS questions (
            id SERIAL PRIMARY KEY,
            quiz_id INTEGER REFERENCES quizzes(id) ON DELETE CASCADE,
            question_text TEXT NOT NULL,
            question_type VARCHAR(20) NOT NULL CHECK (question_type IN ('MCQ', 'TRUE_FALSE', 'TEXT')),
            points INTEGER NOT NULL DEFAULT 1,
            explanation TEXT,
            expected_answer TEXT,
            "order" INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    `;

    const createQuestionOptionsTable = `
        CREATE TABLE IF NOT EXISTS question_options (
            id SERIAL PRIMARY KEY,
            question_id INTEGER REFERENCES questions(id) ON DELETE CASCADE,
            option_text TEXT NOT NULL,
            is_correct BOOLEAN NOT NULL DEFAULT FALSE,
            "order" INTEGER DEFAULT 0
        );
    `;

    const createQuizAttemptsTable = `
        CREATE TABLE IF NOT EXISTS quiz_attempts (
            id SERIAL PRIMARY KEY,
            quiz_id INTEGER REFERENCES quizzes(id) ON DELETE CASCADE,
            student_id INTEGER NOT NULL,
            attempt_number INTEGER NOT NULL DEFAULT 1,
            score INTEGER,
            percentage NUMERIC(5,2),
            passed BOOLEAN NOT NULL DEFAULT FALSE,
            started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            completed_at TIMESTAMP,
            time_spent INTEGER
        );
    `;

    const createStudentAnswersTable = `
        CREATE TABLE IF NOT EXISTS student_answers (
            id SERIAL PRIMARY KEY,
            attempt_id INTEGER REFERENCES quiz_attempts(id) ON DELETE CASCADE,
            question_id INTEGER REFERENCES questions(id),
            selected_option_id INTEGER REFERENCES question_options(id),
            text_answer TEXT,
            is_correct BOOLEAN,
            points_earned INTEGER NOT NULL DEFAULT 0,
            answered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    `;

    try {
        await query(createCoursesTable);
        await query(createLessonsTable);
        await query(createReportsTable);
        await query(createQuizzesTable);
        await query(createQuestionsTable);
        await query(createQuestionOptionsTable);
        await query(createQuizAttemptsTable);
        await query(createStudentAnswersTable);
        await query(`ALTER TABLE courses ADD COLUMN IF NOT EXISTS approved BOOLEAN NOT NULL DEFAULT TRUE;`);
        await query(`ALTER TABLE courses ADD COLUMN IF NOT EXISTS teacher_name VARCHAR(100);`);
        await query(`ALTER TABLE courses ADD COLUMN IF NOT EXISTS difficulty VARCHAR(20) NOT NULL DEFAULT 'BEGINNER';`);
        await query(`ALTER TABLE courses ADD COLUMN IF NOT EXISTS category VARCHAR(100);`);
        await query(`ALTER TABLE courses ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}';`);
        await query(`ALTER TABLE courses ADD COLUMN IF NOT EXISTS popularity INTEGER NOT NULL DEFAULT 0;`);
        await query(`ALTER TABLE courses ADD COLUMN IF NOT EXISTS average_rating NUMERIC(3,2) NOT NULL DEFAULT 0;`);
        await query(`ALTER TABLE courses ADD COLUMN IF NOT EXISTS rating_count INTEGER NOT NULL DEFAULT 0;`);
        await query(`ALTER TABLE lessons ADD COLUMN IF NOT EXISTS teacher_notes TEXT;`);
        await query(`ALTER TABLE questions ADD COLUMN IF NOT EXISTS expected_answer TEXT;`);
        await query(`ALTER TABLE courses DROP CONSTRAINT IF EXISTS courses_difficulty_check;`);
        await query(`
            ALTER TABLE courses
            ADD CONSTRAINT courses_difficulty_check
            CHECK (difficulty IN ('BEGINNER', 'INTERMEDIATE', 'ADVANCED'));
        `);
        await query(`CREATE INDEX IF NOT EXISTS idx_quizzes_course ON quizzes(course_id);`);
        await query(`CREATE INDEX IF NOT EXISTS idx_questions_quiz ON questions(quiz_id);`);
        await query(`CREATE INDEX IF NOT EXISTS idx_options_question ON question_options(question_id);`);
        await query(`CREATE INDEX IF NOT EXISTS idx_attempts_student ON quiz_attempts(student_id);`);
        await query(`CREATE INDEX IF NOT EXISTS idx_attempts_quiz ON quiz_attempts(quiz_id);`);
        await query(`CREATE INDEX IF NOT EXISTS idx_answers_attempt ON student_answers(attempt_id);`);
        console.log('✅ Course DB tables initialized on PRIMARY');
        
        const lag = await getReplicationLag();
        console.log(`📊 Replication lag: ${lag} seconds`);
        
    } catch (error) {
        console.error('Error initializing course DB:', error);
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
