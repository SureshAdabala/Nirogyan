interface VerificationOptions {
  readonly apiOrigin: string;
  readonly siteOrigin: string;
  readonly expectedReleaseId: string;
  readonly allowHttpLocal?: boolean;
  readonly fetchImplementation?: typeof fetch;
}

function verifiedOrigin(value: string, allowHttpLocal: boolean): string {
  const url = new URL(value);
  const loopback = ['localhost', '127.0.0.1', '::1'].includes(url.hostname);
  if (url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw new Error('Verification targets must be credential-free origins.');
  }
  if (url.protocol !== 'https:' && !(allowHttpLocal && loopback && url.protocol === 'http:')) {
    throw new Error('Verification targets must use HTTPS (or explicit loopback-only HTTP).');
  }
  return url.origin;
}

async function fetchWithDeadline(fetchImplementation: typeof fetch, url: string) {
  return fetchImplementation(url, {
    redirect: 'error',
    signal: AbortSignal.timeout(10_000),
    headers: { 'user-agent': 'niro-release-verifier/1' },
  });
}

export async function verifyDeployment(options: VerificationOptions): Promise<{
  readonly status: 'ok';
  readonly releaseId: string;
}> {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/u.test(options.expectedReleaseId)) {
    throw new Error('Expected release ID must be a safe identifier.');
  }
  const apiOrigin = verifiedOrigin(options.apiOrigin, options.allowHttpLocal ?? false);
  const siteOrigin = verifiedOrigin(options.siteOrigin, options.allowHttpLocal ?? false);
  const fetchImplementation = options.fetchImplementation ?? fetch;
  const health = await fetchWithDeadline(fetchImplementation, `${apiOrigin}/healthz`);
  if (!health.ok) throw new Error(`Liveness check failed with HTTP ${health.status}.`);
  const healthBody = (await health.json()) as Record<string, unknown>;
  if (healthBody.status !== 'ok' || healthBody.releaseId !== options.expectedReleaseId) {
    throw new Error('Liveness response does not match the expected immutable release.');
  }
  const readiness = await fetchWithDeadline(fetchImplementation, `${apiOrigin}/readyz`);
  if (!readiness.ok) throw new Error(`Readiness check failed with HTTP ${readiness.status}.`);
  const readinessBody = (await readiness.json()) as Record<string, unknown>;
  if (readinessBody.status !== 'ready' || readinessBody.releaseId !== options.expectedReleaseId) {
    throw new Error('Readiness response does not match the expected immutable release.');
  }
  const clientHealth = await fetchWithDeadline(fetchImplementation, `${siteOrigin}/api/healthz`);
  if (!clientHealth.ok) {
    throw new Error(`Client liveness check failed with HTTP ${clientHealth.status}.`);
  }
  const clientHealthBody = (await clientHealth.json()) as Record<string, unknown>;
  if (
    clientHealthBody.status !== 'ok' ||
    clientHealthBody.releaseId !== options.expectedReleaseId
  ) {
    throw new Error('Client liveness response does not match the expected immutable release.');
  }
  const site = await fetchWithDeadline(fetchImplementation, `${siteOrigin}/`);
  if (!site.ok) throw new Error(`Public-site smoke check failed with HTTP ${site.status}.`);
  if (site.headers.get('x-content-type-options') !== 'nosniff') {
    throw new Error('Public site is missing X-Content-Type-Options: nosniff.');
  }
  if (!options.allowHttpLocal && !site.headers.get('strict-transport-security')) {
    throw new Error('Public site is missing the host/CDN HSTS header.');
  }
  return { status: 'ok', releaseId: options.expectedReleaseId };
}

function argument(argv: readonly string[], prefix: string): string | undefined {
  return argv.find((value) => value.startsWith(prefix))?.slice(prefix.length);
}

if (require.main === module) {
  const argv = process.argv.slice(2);
  const known = argv.every(
    (value) =>
      value === '--allow-http-local' ||
      ['--api-origin=', '--site-origin=', '--expected-release-id='].some((prefix) =>
        value.startsWith(prefix),
      ),
  );
  const apiOrigin = argument(argv, '--api-origin=');
  const siteOrigin = argument(argv, '--site-origin=');
  const expectedReleaseId = argument(argv, '--expected-release-id=');
  if (!known || !apiOrigin || !siteOrigin || !expectedReleaseId) {
    console.error(
      'Usage: --api-origin=<origin> --site-origin=<origin> --expected-release-id=<id> [--allow-http-local]',
    );
    process.exitCode = 1;
  } else {
    void verifyDeployment({
      apiOrigin,
      siteOrigin,
      expectedReleaseId,
      allowHttpLocal: argv.includes('--allow-http-local'),
    })
      .then((result) => console.log(JSON.stringify(result)))
      .catch((error: unknown) => {
        console.error(error instanceof Error ? error.message : 'Deployment verification failed.');
        process.exitCode = 1;
      });
  }
}
