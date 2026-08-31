import { type Express } from 'express';
import type { AppEnvironment } from './config/env';
export interface ReadinessState {
    readonly databaseReady: () => boolean;
}
export declare function createApp(environment: AppEnvironment, readiness?: ReadinessState): Express;
//# sourceMappingURL=app.d.ts.map