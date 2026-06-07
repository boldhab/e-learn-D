const distributedDB = require('../../shared/db-distributed');
const bcrypt = require('bcrypt');

// Export distributed functions
const { query, transaction, getReplicationLag, getStats, checkHealth } = distributedDB;

const ensureDefaultAdmin = async () => {
  const adminEmail = 'hab@admin.com';
  const adminPassword = await bcrypt.hash('password123', 10);
  const existingAdmin = await query('SELECT id FROM users WHERE email = $1', [adminEmail]);

  if (existingAdmin.rows.length === 0) {
    await query(
      'INSERT INTO users (name, email, password, role, is_active) VALUES ($1, $2, $3, $4, TRUE)',
      ['Hab Admin', adminEmail, adminPassword, 'ADMIN']
    );
  }
};

// Initialize tables (automatically routed to PRIMARY for all writes/DDL)
const initDB = async () => {
    const createTableQuery = `
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            name VARCHAR(100) NOT NULL,
            email VARCHAR(255) UNIQUE NOT NULL,
            password VARCHAR(255) NOT NULL,
            role VARCHAR(20) CHECK (role IN ('STUDENT', 'TEACHER', 'ADMIN')) NOT NULL,
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    `;
    
    try {
        await query(createTableQuery);
        await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;`);
        await query(`ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;`);
        await query(`
            ALTER TABLE users
            ADD CONSTRAINT users_role_check
            CHECK (role IN ('STUDENT', 'TEACHER', 'ADMIN'));
        `);
        await query(`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);`);
        await query(`CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);`);
        await ensureDefaultAdmin();
        console.log('✅ Auth DB tables initialized on PRIMARY');
        
        // Test replication
        const lag = await getReplicationLag();
        console.log(`📊 Replication lag: ${lag} seconds`);
        
        const stats = getStats();
        console.log(`📈 DB Stats: Primary=${stats.primary_healthy ? 'UP' : 'DOWN'}, Replica=${stats.replica_healthy ? 'UP' : 'DOWN'}`);
        
    } catch (error) {
        console.error('Error initializing auth DB:', error);
        throw error;
    }
};

// Health endpoint for monitoring
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

module.exports = { 
    query,           // Use this for ALL database queries
    transaction,     // Use for transactions
    initDB,
    getHealthStatus,
    getReplicationLag,
    getStats,
    ensureDefaultAdmin,
    checkHealth
};
