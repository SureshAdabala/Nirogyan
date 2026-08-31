"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const app_1 = require("./app");
const env_1 = require("./config/env");
const connection_1 = require("./db/connection");
async function main() {
    const environment = (0, env_1.loadEnvironment)();
    if (environment.mongoUri) {
        await (0, connection_1.connectDatabase)({ environment });
    }
    else if (environment.nodeEnv === 'production') {
        throw new Error('MONGODB_URI is required in production');
    }
    const app = (0, app_1.createApp)(environment, { databaseReady: connection_1.isDatabaseReady });
    const server = app.listen(environment.port, environment.host, () => {
        console.log(`Niro server foundation listening on http://${environment.host}:${environment.port}`);
    });
    function shutdown(signal) {
        console.log(`Received ${signal}; shutting down server foundation`);
        void server.close(async () => {
            const { disconnectDatabase } = await Promise.resolve().then(() => __importStar(require('./db/connection')));
            await disconnectDatabase();
            process.exit(0);
        });
    }
    process.once('SIGINT', () => shutdown('SIGINT'));
    process.once('SIGTERM', () => shutdown('SIGTERM'));
}
void main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
});
//# sourceMappingURL=server.js.map