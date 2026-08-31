import mongoose from 'mongoose';
import { type AppEnvironment } from '../config/env';
export interface ConnectDatabaseOptions {
    readonly environment?: AppEnvironment;
    readonly uri?: string;
    readonly dbName?: string;
    readonly serverSelectionTimeoutMs?: number;
    readonly maxPoolSize?: number;
}
export declare class DatabaseConfigurationError extends Error {
    constructor(message: string);
}
export declare function isDatabaseReady(): boolean;
export declare function connectDatabase(options?: ConnectDatabaseOptions): Promise<typeof mongoose>;
export declare function disconnectDatabase(): Promise<void>;
//# sourceMappingURL=connection.d.ts.map