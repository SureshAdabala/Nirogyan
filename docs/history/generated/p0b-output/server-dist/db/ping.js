"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const connection_1 = require("./connection");
async function main() {
    const mongoose = await (0, connection_1.connectDatabase)();
    try {
        console.log(JSON.stringify({
            status: (0, connection_1.isDatabaseReady)() ? 'ok' : 'not_ready',
            database: mongoose.connection.name,
            host: mongoose.connection.host,
            readyState: mongoose.connection.readyState,
        }, null, 2));
    }
    finally {
        await (0, connection_1.disconnectDatabase)();
    }
}
void main().catch(async (error) => {
    await (0, connection_1.disconnectDatabase)();
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
});
//# sourceMappingURL=ping.js.map