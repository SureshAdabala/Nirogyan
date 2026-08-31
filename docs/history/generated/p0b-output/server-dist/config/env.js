"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadEnvironment = loadEnvironment;
function parsePort(value) {
    const port = Number(value ?? '4000');
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
        throw new Error('PORT must be an integer between 1 and 65535');
    }
    return port;
}
function parsePositiveInteger(value, fallback, name) {
    const parsed = Number(value ?? fallback);
    if (!Number.isInteger(parsed) || parsed < 1) {
        throw new Error(`${name} must be a positive integer`);
    }
    return parsed;
}
function loadEnvironment(source = process.env) {
    const nodeEnv = source.NODE_ENV ?? 'development';
    if (nodeEnv !== 'development' && nodeEnv !== 'test' && nodeEnv !== 'production') {
        throw new Error('NODE_ENV must be development, test, or production');
    }
    return {
        nodeEnv,
        host: source.HOST ?? '127.0.0.1',
        port: parsePort(source.PORT),
        corsOrigins: (source.CORS_ORIGINS ?? 'http://localhost:3000')
            .split(',')
            .map((origin) => origin.trim())
            .filter(Boolean),
        logLevel: source.LOG_LEVEL ?? 'info',
        mongoUri: source.MONGODB_URI,
        mongoDbName: source.MONGODB_DB_NAME ?? 'niro_dev',
        mongoServerSelectionTimeoutMs: parsePositiveInteger(source.MONGODB_SERVER_SELECTION_TIMEOUT_MS, 10_000, 'MONGODB_SERVER_SELECTION_TIMEOUT_MS'),
        mongoMaxPoolSize: parsePositiveInteger(source.MONGODB_MAX_POOL_SIZE, 10, 'MONGODB_MAX_POOL_SIZE'),
    };
}
//# sourceMappingURL=env.js.map