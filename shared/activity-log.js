const calls = [];
const MAX_CALLS = 50;

function routedServerFor(req) {
    return ['GET', 'HEAD', 'OPTIONS'].includes(req.method) ? 'Replica' : 'Primary';
}

function activityMiddleware(serviceName) {
    return (req, res, next) => {
        const start = Date.now();

        res.on('finish', () => {
            if (req.path.includes('/health') || req.path.includes('/monitoring')) {
                return;
            }

            calls.unshift({
                timestamp: new Date().toISOString(),
                service: serviceName,
                method: req.method,
                path: req.originalUrl || req.url,
                status: res.statusCode,
                server: routedServerFor(req),
                duration_ms: Date.now() - start,
            });

            if (calls.length > MAX_CALLS) {
                calls.length = MAX_CALLS;
            }
        });

        next();
    };
}

function getRecentActivity(limit = 10) {
    return calls.slice(0, limit);
}

module.exports = {
    activityMiddleware,
    getRecentActivity,
};
