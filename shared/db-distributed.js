const { Pool } = require('pg');

// Configuration for distributed database
const config = {
    primary: {
        host: process.env.DB_PRIMARY_HOST || 'localhost',
        port: parseInt(process.env.DB_PRIMARY_PORT) || 5432,
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || '1234',
        database: process.env.DB_NAME,
        // Tuned pool settings
        max: parseInt(process.env.DB_POOL_MAX) || 10,      // Maximum clients in pool
        min: parseInt(process.env.DB_POOL_MIN) || 2,       // Minimum clients kept
        idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT) || 30000,
        connectionTimeoutMillis: parseInt(process.env.DB_CONN_TIMEOUT) || 5000,
        statementTimeout: parseInt(process.env.DB_STMT_TIMEOUT) || 30000,
    },
    replica: {
        host: process.env.DB_REPLICA_HOST || 'localhost',
        port: parseInt(process.env.DB_REPLICA_PORT) || 5433,
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || '1234',
        database: process.env.DB_NAME,
        max: parseInt(process.env.DB_REPLICA_POOL_MAX) || 20,  // Replicas can handle more reads
        min: parseInt(process.env.DB_POOL_MIN) || 2,
        idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT) || 30000,
        connectionTimeoutMillis: parseInt(process.env.DB_CONN_TIMEOUT) || 5000,
    }
};

// Create connection pools
const primaryPool = new Pool(config.primary);
const replicaPool = new Pool(config.replica);

// Track health status
let isPrimaryHealthy = true;
let isReplicaHealthy = true;
let readCount = 0;
let writeCount = 0;

// Health check
async function checkHealth() {
    try {
        await primaryPool.query('SELECT 1');
        isPrimaryHealthy = true;
    } catch (err) {
        console.error('❌ Primary database unhealthy:', err.message);
        isPrimaryHealthy = false;
    }
    
    try {
        await replicaPool.query('SELECT 1');
        isReplicaHealthy = true;
    } catch (err) {
        console.error('⚠️ Replica database unhealthy:', err.message);
        isReplicaHealthy = false;
    }
    return isPrimaryHealthy;
}

// Determine if query is a write operation
function isWriteOperation(sql) {
    const upperSQL = sql.trim().toUpperCase();
    const writeCommands = ['INSERT', 'UPDATE', 'DELETE', 'CREATE', 'ALTER', 'DROP', 'TRUNCATE'];
    for (const cmd of writeCommands) {
        if (upperSQL.startsWith(cmd)) {
            return true;
        }
    }
    return false;
}

// Smart query router - automatically sends writes to primary, reads to replica
async function query(sql, params = [], options = {}) {
    const isWrite = options.isWrite !== undefined ? options.isWrite : isWriteOperation(sql);
    
    if (isWrite) {
        // WRITES always go to PRIMARY
        if (!isPrimaryHealthy) {
            throw new Error('Primary database unavailable for write operations');
        }
        writeCount += 1;
        console.log(`📝 [WRITE] PRIMARY: ${sql.substring(0, 60)}...`);
        const result = await primaryPool.query(sql, params);
        return result;
    } else {
        readCount += 1;
        // READS go to REPLICA if healthy, otherwise PRIMARY
        if (isReplicaHealthy) {
            console.log(`📖 [READ] REPLICA: ${sql.substring(0, 60)}...`);
            try {
                return await replicaPool.query(sql, params);
            } catch (err) {
                console.warn('Replica read failed, falling back to primary');
                return await primaryPool.query(sql, params);
            }
        } else {
            console.log(`📖 [READ] PRIMARY (fallback): ${sql.substring(0, 60)}...`);
            return await primaryPool.query(sql, params);
        }
    }
}

// Transaction support (must use primary for consistency)
async function transaction(callback) {
    if (!isPrimaryHealthy) {
        throw new Error('Cannot start transaction: Primary database unavailable');
    }
    
    const client = await primaryPool.connect();
    console.log('🔒 Starting transaction on PRIMARY');
    
    try {
        await client.query('BEGIN');
        const result = await callback(client);
        await client.query('COMMIT');
        console.log('✅ Transaction committed');
        return result;
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('❌ Transaction rolled back:', err.message);
        throw err;
    } finally {
        client.release();
    }
}

// Check replication lag — must query the REPLICA, not the primary.
// pg_last_xact_replay_timestamp() is a replica-side function and returns
// NULL on the primary, which would always produce 0 lag (a false reading).
async function getReplicationLag() {
    try {
        const result = await replicaPool.query(`
            SELECT 
                EXTRACT(EPOCH FROM (NOW() - pg_last_xact_replay_timestamp())) as lag_seconds
        `);
        return result.rows[0].lag_seconds || 0;
    } catch (err) {
        return null;
    }
}

// Get statistics
function getStats() {
    return {
        primary_healthy: isPrimaryHealthy,
        replica_healthy: isReplicaHealthy,
        primary_connections: primaryPool.totalCount,
        replica_connections: replicaPool.totalCount,
        reads: readCount,
        writes: writeCount,
    };
}

// Start monitoring
setInterval(checkHealth, 30000);
checkHealth();

module.exports = {
    query,
    transaction,
    getReplicationLag,
    getStats,
    checkHealth,
    primaryPool,
    replicaPool
};
