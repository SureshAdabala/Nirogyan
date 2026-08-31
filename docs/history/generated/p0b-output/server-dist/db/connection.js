"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatabaseConfigurationError = void 0;
exports.isDatabaseReady = isDatabaseReady;
exports.connectDatabase = connectDatabase;
exports.disconnectDatabase = disconnectDatabase;
const mongoose_1 = __importDefault(require("mongoose"));
const env_1 = require("../config/env");
class DatabaseConfigurationError extends Error {
    constructor(message) {
        super(message);
        this.name = 'DatabaseConfigurationError';
    }
}
exports.DatabaseConfigurationError = DatabaseConfigurationError;
function containsPlaceholder(uri) {
    return /<[^>]+>/.test(uri);
}
function isDatabaseReady() {
    return mongoose_1.default.connection.readyState === 1;
}
async function connectDatabase(options = {}) {
    const environment = options.environment ?? (0, env_1.loadEnvironment)();
    const uri = options.uri ?? environment.mongoUri;
    if (!uri) {
        throw new DatabaseConfigurationError('MONGODB_URI is not configured. Copy .env.example to .env and set the MongoDB Atlas SRV URI.');
    }
    if (containsPlaceholder(uri)) {
        throw new DatabaseConfigurationError('MONGODB_URI still contains an unresolved <placeholder>.');
    }
    if (isDatabaseReady()) {
        return mongoose_1.default;
    }
    await mongoose_1.default.connect(uri, {
        dbName: options.dbName ?? environment.mongoDbName,
        serverSelectionTimeoutMS: options.serverSelectionTimeoutMs ?? environment.mongoServerSelectionTimeoutMs,
        maxPoolSize: options.maxPoolSize ?? environment.mongoMaxPoolSize,
        retryWrites: true,
        w: 'majority',
    });
    return mongoose_1.default;
}
async function disconnectDatabase() {
    if (mongoose_1.default.connection.readyState !== 0) {
        await mongoose_1.default.disconnect();
    }
}
//# sourceMappingURL=connection.js.map