import { loadEnvironment, loadProjectEnvironment } from '../apps/server/src/config/env';
import { assertProductionRuntimeEnvironment } from '../apps/server/src/config/production';

export function validateProductionEnvironment(source: NodeJS.ProcessEnv = process.env) {
  const environment = loadEnvironment(source);
  return assertProductionRuntimeEnvironment(source, environment);
}

if (require.main === module) {
  try {
    loadProjectEnvironment();
    const result = validateProductionEnvironment();
    console.log(
      JSON.stringify({
        status: 'ok',
        deploymentEnvironment: result.deploymentEnvironment,
        releaseId: result.releaseId,
        siteOrigin: result.siteUrl,
        apiBaseUrl: result.apiBaseUrl,
        secrets: 'validated-without-output',
      }),
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Production validation failed.');
    process.exitCode = 1;
  }
}
