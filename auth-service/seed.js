const { Pool } = require('pg');
const bcrypt = require('bcrypt');

const seed = async () => {
  try {
    // 1. AUTH DB
    const authPool = new Pool({
      user: 'postgres', host: 'localhost', database: 'auth_db', password: '1234', port: 5432
    });
    
    await authPool.query('DROP TABLE IF EXISTS users CASCADE;');
    await authPool.query(`
      CREATE TABLE users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(20) CHECK (role IN ('STUDENT', 'TEACHER', 'ADMIN')) NOT NULL,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    const hash = await bcrypt.hash('password123', 10);
    
    // Create 1 teacher and 2 students
    await authPool.query(`
      INSERT INTO users (id, name, email, password, role) VALUES 
      (1, 'Alice Teacher', 'alice@teacher.com', $1, 'TEACHER'),
      (2, 'Bob Student', 'bob@student.com', $1, 'STUDENT'),
      (3, 'Charlie Student', 'charlie@student.com', $1, 'STUDENT')
    `, [hash]);

    await authPool.query(`
      INSERT INTO users (id, name, email, password, role) VALUES 
      (4, 'Hab Admin', 'hab@admin.com', $1, 'ADMIN')
    `, [hash]);
    
    // Reset sequence
    await authPool.query(`SELECT setval('users_id_seq', 4);`);
    await authPool.end();
    console.log('✅ auth_db seeded (3 users created)');

    // 2. COURSE DB
    const coursePool = new Pool({
      user: 'postgres', host: 'localhost', database: 'course_db', password: '1234', port: 5432
    });
    
    await coursePool.query('DROP TABLE IF EXISTS lessons CASCADE;');
    await coursePool.query('DROP TABLE IF EXISTS courses CASCADE;');
    
    await coursePool.query(`
      CREATE TABLE courses (
        id SERIAL PRIMARY KEY,
        title VARCHAR(200) NOT NULL,
        description TEXT,
        teacher_id INTEGER NOT NULL,
        approved BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    await coursePool.query(`
      CREATE TABLE lessons (
        id SERIAL PRIMARY KEY,
        course_id INTEGER REFERENCES courses(id) ON DELETE CASCADE,
        title VARCHAR(200) NOT NULL,
        content TEXT,
        video_url VARCHAR(500),
        "order" INTEGER DEFAULT 0
      );
    `);
    
    await coursePool.query(`
      INSERT INTO courses (id, title, description, teacher_id) VALUES 
      (1, 'Advanced Node.js', 'Deep dive into Node.js architecture.', 1),
      (2, 'React Mastery', 'Learn React hooks and context API.', 1)
    `);
    await coursePool.query(`SELECT setval('courses_id_seq', 2);`);
    
    await coursePool.query(`
      INSERT INTO lessons (course_id, title, content, "order") VALUES 
      (1, 'Event Loop', 'Understanding the event loop in Node.', 1),
      (1, 'Streams', 'Working with Node.js streams.', 2),
      (2, 'React Context', 'State management with Context API.', 1),
      (2, 'React Hooks', 'Using useEffect and useState.', 2)
    `);
    await coursePool.end();
    console.log('✅ course_db seeded (2 courses, 4 lessons created)');

    // 3. LEARNING DB
    const learningPool = new Pool({
      user: 'postgres', host: 'localhost', database: 'learning_db', password: '1234', port: 5432
    });
    
    await learningPool.query('DROP TABLE IF EXISTS enrollments CASCADE;');
    await learningPool.query(`
      CREATE TABLE enrollments (
        id SERIAL PRIMARY KEY,
        student_id INTEGER NOT NULL,
        course_id INTEGER NOT NULL,
        progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
        enrolled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(student_id, course_id)
      );
    `);
    
    await learningPool.query(`
      INSERT INTO enrollments (student_id, course_id, progress) VALUES 
      (2, 1, 50),
      (3, 1, 100),
      (3, 2, 0)
    `);
    await learningPool.end();
    console.log('✅ learning_db seeded (3 enrollments created)');
    
  } catch (err) {
    console.error('❌ Seeding failed:', err);
  }
};

seed();
