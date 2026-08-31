export interface AppEnvironment {
    readonly nodeEnv: 'development' | 'test' | 'production';
    readonly host: string;
    readonly port: number;
    readonly corsOrigins: readonly string[];
    readonly logLevel: string;
    readonly mongoUri: string | undefined;
    readonly mongoDbName: string;
    readonly mongoServerSelectionTimeoutMs: number;
    readonly mongoMaxPoolSize: number;
}
export declare function loadEnvironment(source?: NodeJS.ProcessEnv): AppEnvironment;
//# sourceMappingURL=env.d.ts.map