const { Pool } = require('pg');

const config = {
    primary: {
        host: process.env.DB_PRIMARY_HOST || 'localhost',
        port: parseInt(process.env.DB_PRIMARY_PORT, 10) || 5432,
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || '1234',
        database: process.env.DB_NAME,
        max: parseInt(process.env.DB_POOL_MAX, 10) || 10,
        min: parseInt(process.env.DB_POOL_MIN, 10) || 2,
        idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT, 10) || 30000,
        connectionTimeoutMillis: parseInt(process.env.DB_CONN_TIMEOUT, 10) || 5000,
        statementTimeout: parseInt(process.env.DB_STMT_TIMEOUT, 10) || 30000,
    },
    replica: {
        host: process.env.DB_REPLICA_HOST || 'localhost',
        port: parseInt(process.env.DB_REPLICA_PORT, 10) || 5433,
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || '1234',
        database: process.env.DB_NAME,
        max: parseInt(process.env.DB_REPLICA_POOL_MAX, 10) || 10,
        min: parseInt(process.env.DB_POOL_MIN, 10) || 2,
        idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT, 10) || 30000,
        connectionTimeoutMillis: parseInt(process.env.DB_CONN_TIMEOUT, 10) || 5000,
        statementTimeout: parseInt(process.env.DB_STMT_TIMEOUT, 10) || 30000,
    },
};

const primaryPool = new Pool(config.primary);
const replicaPool = new Pool(config.replica);

let isPrimaryHealthy = true;
let isReplicaHealthy = true;
let isFailoverMode = process.env.DB_FAILOVER_MODE === 'true';
let failoverInProgress = false;
let readCount = 0;
let writeCount = 0;

const healthCheckIntervalMs = parseInt(process.env.DB_HEALTH_CHECK_INTERVAL_MS, 10) || 10000;
const enableAutoFailover = process.env.DB_AUTO_FAILOVER !== 'false';
const replicaPromoteTriggerFile = process.env.DB_REPLICA_TRIGGER_FILE ||
    'C:\\PostgreSQL_data\\18_replica\\data\\trigger_file';  // ← Update this path

const getActivePool = () => (isFailoverMode ? replicaPool : primaryPool);

function isWriteOperation(sql) {
    const upperSQL = sql.trim().toUpperCase();
    const writeCommands = ['INSERT', 'UPDATE', 'DELETE', 'CREATE', 'ALTER', 'DROP', 'TRUNCATE'];
    return writeCommands.some((cmd) => upperSQL.startsWith(cmd));
}

async function promoteReplicaToPrimary() {
    if (isFailoverMode) {
        return { promoted: false, message: 'Already in failover mode' };
    }

    if (!isReplicaHealthy) {
        throw new Error('Cannot promote replica because it is unhealthy');
    }

    failoverInProgress = true;

    try {
        const fs = require('fs');

        if (replicaPromoteTriggerFile) {
            fs.writeFileSync(replicaPromoteTriggerFile, 'promote');
            console.log(`Promotion trigger written: ${replicaPromoteTriggerFile}`);
        }

        await new Promise((resolve) => setTimeout(resolve, 5000));
        await replicaPool.query('SELECT 1');

        isFailoverMode = true;
        process.env.DB_FAILOVER_MODE = 'true';
        console.log('Failover complete. Standby replica is now the active database.');
        sendFailoverAlert();

        return { promoted: true, message: 'Replica promoted to active database' };
    } finally {
        failoverInProgress = false;
    }
}

async function failbackToOriginalPrimary() {
    console.log('Failback requested. Switching active database back to original primary.');
    await primaryPool.query('SELECT 1');
    isFailoverMode = false;
    process.env.DB_FAILOVER_MODE = 'false';
    isPrimaryHealthy = true;
    return { restored: true, message: 'Original primary is active again' };
}

function sendFailoverAlert() {
    console.log('ALERT: Database failover occurred');
    console.log('Time:', new Date().toISOString());
    console.log(`New active database: ${config.replica.host}:${config.replica.port}`);
}

async function checkHealth() {
    try {
        await primaryPool.query('SELECT 1');
        isPrimaryHealthy = true;
    } catch (err) {
        console.error('Primary database unhealthy:', err.message);
        isPrimaryHealthy = false;
    }

    try {
        await replicaPool.query('SELECT 1');
        isReplicaHealthy = true;
    } catch (err) {
        console.error('Replica database unhealthy:', err.message);
        isReplicaHealthy = false;
    }

    if (enableAutoFailover && !isPrimaryHealthy && isReplicaHealthy && !isFailoverMode && !failoverInProgress) {
        console.log('Primary failure detected. Initiating failover to standby replica.');
        promoteReplicaToPrimary().catch((promoteErr) => {
            console.error('Failover failed:', promoteErr.message);
        });
    }

    return isFailoverMode ? isReplicaHealthy : isPrimaryHealthy;
}

// Standby query router:
// - Normal mode: reads and writes use primary; replica stays standby.
// - Failover mode: reads and writes use promoted replica.
async function query(sql, params = [], options = {}) {
    const isWrite = options.isWrite !== undefined ? options.isWrite : isWriteOperation(sql);

    if (isFailoverMode) {
        if (!isReplicaHealthy) {
            throw new Error('Failover database unavailable');
        }

        if (isWrite) {
            writeCount += 1;
            console.log(`[FAILOVER WRITE] PROMOTED REPLICA: ${sql.substring(0, 60)}...`);
        } else {
            readCount += 1;
            console.log(`[FAILOVER READ] PROMOTED REPLICA: ${sql.substring(0, 60)}...`);
        }

        return replicaPool.query(sql, params);
    }

    if (!isPrimaryHealthy) {
        throw new Error(`Primary database unavailable for ${isWrite ? 'write' : 'read'} operations`);
    }

    if (isWrite) {
        writeCount += 1;
        console.log(`[WRITE] PRIMARY: ${sql.substring(0, 60)}...`);
    } else {
        readCount += 1;
        console.log(`[READ] PRIMARY: ${sql.substring(0, 60)}...`);
    }

    return primaryPool.query(sql, params);
}

async function transaction(callback) {
    const activePool = getActivePool();

    if (isFailoverMode && !isReplicaHealthy) {
        throw new Error('Cannot start transaction: Failover database unavailable');
    }

    if (!isFailoverMode && !isPrimaryHealthy) {
        throw new Error('Cannot start transaction: Primary database unavailable');
    }

    const client = await activePool.connect();
    console.log(`Starting transaction on ${isFailoverMode ? 'PROMOTED REPLICA' : 'PRIMARY'}`);

    try {
        await client.query('BEGIN');
        const result = await callback(client);
        await client.query('COMMIT');
        console.log('Transaction committed');
        return result;
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Transaction rolled back:', err.message);
        throw err;
    } finally {
        client.release();
    }
}

async function getReplicationLag() {
    if (isFailoverMode) {
        return null;
    }

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

function getStats() {
    return {
        primary_healthy: isPrimaryHealthy,
        replica_healthy: isReplicaHealthy,
        failover_mode: isFailoverMode,
        failover_in_progress: failoverInProgress,
        active_database: isFailoverMode ? 'replica' : 'primary',
        primary_connections: primaryPool.totalCount,
        replica_connections: replicaPool.totalCount,
        reads: readCount,
        writes: writeCount,
    };
}

setInterval(checkHealth, healthCheckIntervalMs);
checkHealth();

module.exports = {
    query,
    transaction,
    getReplicationLag,
    getStats,
    checkHealth,
    promoteReplicaToPrimary,
    failbackToOriginalPrimary,
    get isFailoverMode() {
        return isFailoverMode;
    },
    primaryPool,
    replicaPool,
};
