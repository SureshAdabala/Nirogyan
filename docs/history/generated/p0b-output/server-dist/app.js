"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createApp = createApp;
const cors_1 = __importDefault(require("cors"));
const express_1 = __importDefault(require("express"));
const helmet_1 = __importDefault(require("helmet"));
const pino_http_1 = __importDefault(require("pino-http"));
function createApp(environment, readiness = { databaseReady: () => false }) {
    const app = (0, express_1.default)();
    app.disable('x-powered-by');
    app.use((0, helmet_1.default)());
    app.use((0, cors_1.default)({ origin: [...environment.corsOrigins] }));
    app.use(express_1.default.json({ limit: '1mb' }));
    app.use((0, pino_http_1.default)({ level: environment.logLevel }));
    app.get('/healthz', (_request, response) => {
        response.status(200).json({ status: 'ok', service: 'niro-server' });
    });
    app.get('/readyz', (_request, response) => {
        if (readiness.databaseReady()) {
            response.status(200).json({ status: 'ready', service: 'niro-server' });
            return;
        }
        response.status(503).json({ status: 'not_ready', reason: 'database connection is not ready' });
    });
    return app;
}
//# sourceMappingURL=app.js.map