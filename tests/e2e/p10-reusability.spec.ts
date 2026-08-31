import { createHash } from 'node:crypto';
import { resolve } from 'node:path';

import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test';

import { runCacheInvalidationCli } from '../../apps/server/src/ops/cache-invalidation-cli';
import { P7_FIXTURE_PASSWORD, p7FixtureKeys } from '../../scripts/p7-fixture-identity';
import { p10CalculatorSlug } from '../../scripts/p10-fixture-identity';
import { checkSiteLinks } from '../../scripts/p10-link-check';
import { configurationDifferences } from '../../scripts/p10-reusability-gate';

const axePath = resolve(process.cwd(), 'node_modules', 'axe-core', 'axe.min.js');
const nonce = process.env.P10_E2E_NONCE;
if (!nonce) throw new Error('P10_E2E_NONCE is required for the isolated P10 browser gate.');
const slug = p10CalculatorSlug(nonce);
const keys = p7FixtureKeys(nonce);
const calculatorName = `Synthetic P10 adaptability check ${nonce.slice(0, 10)}`;
const biomarkerName = 'Synthetic P7 Studio marker';
const biomarkerAlias = 'P7 synthetic marker';
const biomarkerDomain = 'synthetic-studio';
const apiBase = process.env.P10_API_BASE_URL ?? 'http://127.0.0.1:4100/api/v1';
const clientUrl = process.env.P10_CLIENT_URL ?? 'http://127.0.0.1:3100';

interface AxeViolation {
  readonly id: string;
  readonly impact: string | null;
  readonly help: string;
  readonly nodes: readonly {
    readonly target: readonly string[];
    readonly failureSummary?: string;
  }[];
}

async function assertAxeClean(page: Page, label: string): Promise<void> {
  await page.addScriptTag({ path: axePath });
  const violations = await page.evaluate(async () => {
    const axe = (
      window as unknown as {
        axe: { run: () => Promise<{ violations: AxeViolation[] }> };
      }
    ).axe;
    return (await axe.run()).violations;
  });
  expect(
    violations,
    `${label} axe violations:\n${violations
      .map((item) => `${item.id} (${item.impact}): ${item.help}`)
      .join('\n')}`,
  ).toEqual([]);
}

async function assertNoDocumentOverflow(page: Page, label: string): Promise<void> {
  const dimensions = await page.evaluate(() => ({
    viewport: window.innerWidth,
    document: document.documentElement.scrollWidth,
  }));
  expect(
    dimensions.document,
    `${label} document width ${dimensions.document}px exceeds ${dimensions.viewport}px viewport`,
  ).toBeLessThanOrEqual(dimensions.viewport + 1);
}

function assertPublicBiomarkerPrivacy(serialized: string, label: string): void {
  expect(serialized, `${label} exposed a persistence, governance, or scoring field`).not.toMatch(
    /"(?:_id|createdBy|definitionHash|expression|formulas?|governance|inputBounds|migrationProvenance|publishBlockers|reviewHash|reviewedBy|reviewerId|scoringRules|trace|verifiedAt)"\s*:/iu,
  );
}

async function login(page: Page, email: string): Promise<void> {
  await page.goto('/admin/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(P7_FIXTURE_PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/admin$/u, { timeout: 300_000 });
  await expect(page.getByRole('heading', { name: 'Calculator Studio' })).toBeVisible();
}

async function createBlankDraftWithOneRecovery(page: Page): Promise<boolean> {
  const target = new RegExp(`/admin/calculators/${slug}/versions/1$`, 'u');
  const error = page.locator('.admin-alert--error').first();
  const button = page.getByRole('button', { name: 'Create draft' });
  for (let attempt = 0; attempt < 2; attempt += 1) {
    if (attempt > 0) await page.waitForTimeout(5_000);
    if (attempt === 0) {
      await reachByKeyboard(page, button);
      expect(await button.evaluate((element) => element.matches(':focus-visible'))).toBe(true);
      await page.keyboard.press('Enter');
    } else {
      await button.click();
    }
    if (attempt > 0) await expect(error).toBeHidden();
    await expect
      .poll(
        async () => {
          if (target.test(page.url())) return 'created';
          if (await error.isVisible()) return 'error';
          return 'waiting';
        },
        { timeout: 300_000 },
      )
      .not.toBe('waiting');
    if (target.test(page.url())) return attempt > 0;
    if (attempt > 0) {
      throw new Error(
        `Studio draft creation failed twice: ${(await error.textContent())?.trim() ?? 'unknown error'}`,
      );
    }
  }
  throw new Error('Studio draft creation did not produce a terminal outcome.');
}

async function openReleaseTab(page: Page): Promise<void> {
  await page.getByRole('tab', { name: 'Preview, tests & publish' }).click();
  await expect(page.getByRole('heading', { name: 'Live preview and trace' })).toBeVisible();
}

function previewScore(page: Page) {
  return page
    .getByRole('region', { name: 'Live preview and trace' })
    .locator('.admin-metric-grid > div')
    .filter({ has: page.getByText('Score', { exact: true }) })
    .locator('strong');
}

async function runPreview(page: Page, inputs: Record<string, unknown>): Promise<void> {
  const panel = page.getByRole('region', { name: 'Live preview and trace' });
  await panel.getByLabel('Inputs JSON').fill(JSON.stringify(inputs));
  await panel.getByRole('button', { name: 'Run preview' }).click();
  const success = page.getByText('Preview executed with the production engine.');
  const failure = page.locator('.admin-alert--error').first();
  await expect(success.or(failure)).toBeVisible();
  if (await failure.isVisible()) {
    throw new Error(`Studio preview failed: ${(await failure.textContent())?.trim() ?? 'unknown'}`);
  }
  await expect(panel.getByText('Executable', { exact: true })).toBeVisible();
}

async function attachEvidence(testInfo: TestInfo, value: unknown): Promise<void> {
  await testInfo.attach('p10-reusability-evidence.json', {
    body: Buffer.from(`${JSON.stringify(value, null, 2)}\n`),
    contentType: 'application/json',
  });
}

async function readAdminVersion(page: Page): Promise<{
  readonly payload: Readonly<Record<string, unknown>>;
  readonly versionHash?: string;
}> {
  const response = await page.request.get(
    `${apiBase}/admin/calculators/${encodeURIComponent(slug)}/versions/1`,
  );
  expect(response.status()).toBe(200);
  const envelope = (await response.json()) as {
    readonly data?: {
      readonly payload?: Readonly<Record<string, unknown>>;
      readonly versionHash?: string;
    };
  };
  expect(envelope.data?.payload).toBeTruthy();
  return {
    payload: envelope.data?.payload ?? {},
    versionHash: envelope.data?.versionHash,
  };
}

async function reachByKeyboard(page: Page, target: Locator): Promise<void> {
  for (let index = 0; index < 80; index += 1) {
    if (await target.evaluate((element) => element === document.activeElement)) return;
    await page.keyboard.press('Tab');
  }
  throw new Error('Keyboard traversal did not reach the required public calculator control.');
}

async function expectStudioSavedWithOneRecovery(page: Page, retryControl: Locator): Promise<void> {
  const saveState = page.locator('.admin-save-state');
  try {
    await expect(saveState).toHaveText('saved', { timeout: 60_000 });
    return;
  } catch (error) {
    if ((await saveState.textContent())?.trim() !== 'error') throw error;
  }
  // A transient Atlas selection failure leaves the draft dirty but recoverable. Re-entering
  // equivalent JSON through Studio causes exactly one normal autosave retry without changing
  // calculator semantics; a persistent outage still fails this gate.
  await page.waitForTimeout(5_000);
  await retryControl.fill(`${await retryControl.inputValue()} `);
  await retryControl.blur();
  await expect(saveState).toHaveText('saved', { timeout: 120_000 });
}

async function authorNumericParameter(
  page: Page,
  options: {
    readonly key: string;
    readonly label: string;
    readonly group: string;
    readonly order: number;
    readonly missingPolicy: 'block' | 'exclude-from-group';
    readonly required: boolean;
    readonly biomarkerName?: string;
  },
): Promise<void> {
  await page.getByRole('button', { name: 'Add parameter' }).click();
  const editor = page.getByRole('dialog', { name: 'Parameter editor' });
  if (options.biomarkerName) {
    await editor.getByRole('button', { name: options.biomarkerName }).click();
  }
  await editor.getByLabel('Parameter key').fill(options.key);
  await editor.getByLabel('Label').fill(options.label);
  await editor.getByLabel('Group key').fill(options.group);
  await editor.getByLabel('Input type').selectOption('number');
  await editor.getByLabel('Order').fill(String(options.order));
  await editor.getByLabel('Missing-value policy').selectOption(options.missingPolicy);
  await editor.getByLabel('min', { exact: true }).fill('0');
  await editor.getByLabel('max', { exact: true }).fill('100');
  const required = editor.getByLabel('Required');
  if (options.required) await required.check();
  else await required.uncheck();
  await editor.getByRole('button', { name: 'Close parameter editor' }).click();
}

async function authorNumericScoringRule(
  page: Page,
  ruleNumber: number,
  parameterKey: string,
  threshold: number,
): Promise<void> {
  await page.getByRole('button', { name: 'Add scoring rule' }).click();
  const rule = page
    .locator('details')
    .filter({ has: page.getByText(new RegExp(`^Rule ${ruleNumber}:`, 'u')) });
  await rule.locator('summary').click();
  await rule.getByLabel('Parameter').selectOption(parameterKey);
  // Selecting the parameter changes the React key and remounts the closed <details>.
  await rule.locator('summary').click();
  await rule.getByLabel('Rule type').selectOption('bands');
  await rule.getByLabel('Default edge semantics').selectOption('min-inclusive');
  const contexts = rule.getByRole('region', { name: 'Scoring contexts' });
  await contexts.getByRole('button', { name: 'Add band' }).click();
  await contexts.getByRole('button', { name: 'Add band' }).click();
  const lower = contexts.getByRole('group', { name: 'Band 1' });
  await lower.getByLabel('Upper boundary type').selectOption('exclusive');
  await lower.getByLabel('Upper boundary value').fill(String(threshold));
  await lower.getByLabel('Points').fill('0');
  const upper = contexts.getByRole('group', { name: 'Band 2' });
  await upper.getByLabel('Lower boundary type').selectOption('inclusive');
  await upper.getByLabel('Lower boundary value').fill(String(threshold));
  await upper.getByLabel('Points').fill('1');
}

async function authorDomain(
  page: Page,
  number: number,
  options: { readonly key: string; readonly label: string; readonly parameter: string },
): Promise<void> {
  await page.getByRole('button', { name: 'Add domain' }).click();
  const domain = page.getByRole('group', { name: `Domain ${number}` });
  await domain.getByLabel('Key').fill(options.key);
  await domain.getByLabel('Label').fill(options.label);
  await domain.getByLabel('Weight (percent)').fill('50');
  await domain
    .getByRole('group', { name: 'Assigned parameters' })
    .getByLabel(options.parameter)
    .check();
}

async function authorCategory(
  page: Page,
  number: number,
  options: {
    readonly label: string;
    readonly color: string;
    readonly lower?: number;
    readonly upper?: number;
  },
): Promise<void> {
  await page.getByRole('button', { name: 'Add category' }).click();
  const category = page.getByRole('group', { name: `Category ${number}` });
  await category.getByLabel('Label').fill(options.label);
  await category.getByLabel('Color').fill(options.color);
  if (options.lower !== undefined) {
    await category.getByLabel('Lower boundary type').selectOption('inclusive');
    await category.getByLabel('Lower boundary value').fill(String(options.lower));
  }
  if (options.upper !== undefined) {
    await category.getByLabel('Upper boundary type').selectOption('exclusive');
    await category.getByLabel('Upper boundary value').fill(String(options.upper));
  }
  await category
    .getByLabel('Message')
    .fill(`The synthetic inputs produced the ${options.label.toLowerCase()} test category.`);
  await category
    .getByLabel('Recommendation')
    .fill('No medical action is associated with this fixture.');
}

async function authorBlankCalculatorThroughStudio(page: Page): Promise<void> {
  await page
    .getByLabel('Short description')
    .fill(
      'A temporary nonclinical calculator authored from a blank draft through Calculator Studio.',
    );
  await page.getByLabel('Engine semantic version').fill('1.0.0');
  await page
    .getByLabel('Educational disclaimers — one per line')
    .fill('Synthetic fixture only. It provides no medical advice or diagnosis.');

  await page.getByRole('tab', { name: 'Parameters' }).click();
  await authorNumericParameter(page, {
    key: 'readinessValue',
    label: 'Synthetic readiness value',
    group: 'questionnaire',
    order: 1,
    missingPolicy: 'block',
    required: true,
  });
  await authorNumericParameter(page, {
    key: 'markerValue',
    label: 'Optional synthetic marker value',
    group: 'measurements',
    order: 2,
    missingPolicy: 'exclude-from-group',
    required: false,
    biomarkerName: 'Synthetic P7 Studio marker',
  });

  await page.getByRole('tab', { name: 'Scoring & rules' }).click();
  await authorNumericScoringRule(page, 1, 'readinessValue', 1);
  await authorNumericScoringRule(page, 2, 'markerValue', 50);

  await page.getByRole('tab', { name: 'Domains & formulas' }).click();
  await authorDomain(page, 1, {
    key: 'questionnaire',
    label: 'Synthetic questionnaire',
    parameter: 'readinessValue',
  });
  await authorDomain(page, 2, {
    key: 'measurements',
    label: 'Synthetic measurements',
    parameter: 'markerValue',
  });

  await page.getByRole('tab', { name: 'Categories' }).click();
  await page.getByLabel('Default edge semantics').selectOption('min-inclusive');
  const scale = page.getByRole('group', { name: 'Score scale' });
  await scale.getByLabel('Minimum').fill('0');
  await scale.getByLabel('Maximum').fill('2');
  await scale.getByLabel('Direction').selectOption('higher-is-worse');
  await authorCategory(page, 1, {
    label: 'Lower synthetic score',
    color: '#26734D',
    upper: 1,
  });
  await authorCategory(page, 2, {
    label: 'Higher synthetic score',
    color: '#9A5B00',
    lower: 1,
  });

  await page.getByRole('tab', { name: 'Layout, content & SEO' }).click();
  await page.getByRole('button', { name: 'Add form step' }).click();
  const step = page.getByRole('group', { name: 'Form step 1' });
  await step.getByLabel('Step key').fill('assessment');
  await step.getByLabel('Step title').fill('Synthetic assessment');
  await step.getByLabel('Parameter groups (comma separated)').fill('questionnaire, measurements');

  const content = page.getByRole('group', { name: 'Associated structured content' });
  await content.getByLabel('Content schema version').fill('content-page.v1');
  await content.getByLabel('Content ID').fill(`${slug}-content`);
  await content.getByLabel('Content slug').fill(slug);
  await content.getByLabel('Locale').fill('en-IN');
  await content.getByLabel('Page title').fill(calculatorName);
  await content
    .getByLabel('Page summary')
    .fill('Reviewed nonclinical content authored through Calculator Studio for the P10 gate.');
  await content.getByLabel('Content version').fill('1');
  await content.getByLabel('Content blocks JSON').fill(
    JSON.stringify([
      {
        id: 'fixture-notice',
        type: 'markdown',
        markdown: 'This temporary calculator contains only synthetic nonclinical test logic.',
      },
    ]),
  );
  await content.getByLabel('Content blocks JSON').blur();

  const claims = page.getByRole('group', { name: 'Claims and citations' });
  await claims.getByRole('button', { name: 'Add claim' }).click();
  await claims.getByRole('button', { name: 'Remove claim 1' }).click();
  await claims.getByRole('button', { name: 'Add citation' }).click();
  await claims.getByRole('button', { name: 'Remove citation 1' }).click();

  const authorship = page.getByRole('group', { name: 'Authorship and medical review metadata' });
  await authorship.getByLabel('ownerId').fill('p10-automation');
  await authorship.getByLabel('createdAt').fill('2026-08-28T00:00:00.000Z');
  await authorship.getByLabel('updatedAt').fill('2026-08-28T00:00:00.000Z');
  await authorship
    .getByLabel('Authorship contributors JSON')
    .fill(
      JSON.stringify([{ id: 'p10-automation', displayName: 'P10 automation', role: 'author' }]),
    );
  await authorship.getByLabel('Authorship contributors JSON').blur();
  await authorship.getByLabel('Medical review status').selectOption('not-applicable');
  await authorship.getByLabel('Medical review scope').selectOption('not-applicable');

  const seo = page.getByRole('group', { name: 'SEO and publication' });
  await seo.getByLabel('metaTitle').fill(calculatorName);
  await seo
    .getByLabel('metaDescription')
    .fill(
      'Temporary nonclinical Calculator Studio fixture for automated reusability verification.',
    );
  await seo.getByLabel('canonicalPath').fill(`/c/${slug}`);
  await seo.getByLabel('Allow indexing').check();
  await seo.getByLabel('Allow indexing').uncheck();
  await seo.getByLabel('Allow link following').check();
  await seo.getByLabel('Allow link following').uncheck();
  await seo.getByLabel('Schema types (comma separated)').fill('WebPage');
  await seo.getByLabel('Content publication status').selectOption('approved');
  await seo.getByLabel('Content changelog').fill('Created from a blank Studio draft for P10.');

  const governance = page.getByRole('group', { name: 'Calculator governance' });
  await governance.getByLabel('Clinical status').selectOption('not-applicable');
  await governance.getByLabel('Source review status').selectOption('not-applicable');
  await governance.getByLabel('Publish blockers (one per line)').fill('');

  await page.getByText('Advanced contract fields').click();
  await page
    .getByLabel('Formulas JSON')
    .fill(JSON.stringify([{ key: 'final-score', expression: 'sum(points)' }]));
  await page.getByLabel('Formulas JSON').blur();
  await page.getByLabel('Domain aggregation policy JSON').fill(
    JSON.stringify({
      zeroDenominator: 'unscored',
      missingDomainPolicy: 'exclude-and-renormalize',
      negativeDomainPolicy: 'preserve',
    }),
  );
  await page.getByLabel('Domain aggregation policy JSON').blur();
  const sourceManifest = page.getByLabel('Calculator source manifest JSON');
  await sourceManifest.fill(
    JSON.stringify([
      {
        type: 'internal',
        ref: `p10-studio-only:${nonce}`,
        title: 'P10 automated nonclinical Studio fixture',
        verification: 'source-provided',
        demoPoints: true,
      },
    ]),
  );
  await sourceManifest.blur();
  await expectStudioSavedWithOneRecovery(page, sourceManifest);
}

test.describe('P10 Studio-only Reusability Gate', () => {
  test('creates, edits, previews, reviews, publishes, runs, shares, and hardens a new calculator', async ({
    page,
    request,
  }, testInfo) => {
    const browserErrors: string[] = [];
    const expectedNegativeHttpResponses: string[] = [];
    const unexpectedNegativeHttpResponses: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') browserErrors.push(`console: ${message.text()}`);
    });
    page.on('pageerror', (error) => browserErrors.push(`pageerror: ${error.message}`));
    page.on('response', (response) => {
      if (response.status() < 400) return;
      const url = new URL(response.url());
      const expected =
        (response.status() === 401 &&
          (url.pathname === '/api/v1/admin/me' || url.pathname === '/api/v1/admin/auth/refresh')) ||
        (response.status() === 503 && url.pathname === `/api/v1/calculators/${slug}/assess`);
      const observation = `${response.status()} ${url.pathname}`;
      if (expected) expectedNegativeHttpResponses.push(observation);
      else unexpectedNegativeHttpResponses.push(observation);
    });
    await page.goto('/admin/login');
    await assertAxeClean(page, 'admin login');
    await login(page, keys.adminEmail);
    await assertAxeClean(page, 'admin home');

    await page.setViewportSize({ width: 375, height: 812 });
    await expect(page.getByRole('heading', { name: 'Calculator Studio' })).toBeVisible();
    await assertNoDocumentOverflow(page, 'mobile Calculator Studio home');
    await page.setViewportSize({ width: 768, height: 1024 });
    await assertNoDocumentOverflow(page, 'tablet Calculator Studio home');
    await page.setViewportSize({ width: 1280, height: 720 });

    const slugInput = page.getByLabel('Slug');
    await reachByKeyboard(page, slugInput);
    await page.keyboard.type(slug);
    const nameInput = page.getByLabel('Name');
    await reachByKeyboard(page, nameInput);
    await page.keyboard.type(calculatorName);
    await expect(page.getByLabel('Optional draft configuration JSON')).toHaveValue('');
    const studioCreateTransientRecoveryUsed = await createBlankDraftWithOneRecovery(page);
    await expect(page.getByText('draft', { exact: true }).first()).toBeVisible();
    const blankAdminVersion = await readAdminVersion(page);
    await testInfo.attach('p10-blank-draft-config.json', {
      body: Buffer.from(`${JSON.stringify(blankAdminVersion.payload, null, 2)}\n`),
      contentType: 'application/json',
    });
    await authorBlankCalculatorThroughStudio(page);

    await openReleaseTab(page);
    await page.getByRole('button', { name: 'Add case' }).click();
    const partialCase = page.locator('fieldset.admin-test-case').nth(0);
    await partialCase.getByLabel('Key').fill('p10-partial-labs');
    await partialCase.getByLabel('Name').fill('Questionnaire result with optional lab omitted');
    await partialCase.getByLabel('Kind').selectOption('nonclinical-fixture');
    await partialCase.getByLabel('Inputs JSON').fill(JSON.stringify({ readinessValue: 0 }));
    await partialCase
      .getByLabel('Expected JSON')
      .fill(JSON.stringify({ finalScore: 0, category: 'Lower synthetic score' }));
    await page.getByRole('button', { name: 'Save tests' }).click();
    await expect(page.getByText('Test cases saved.')).toBeVisible();
    await page.getByRole('button', { name: 'Validate' }).click();
    await expect(page.getByText('Validation completed with blockers.')).toBeVisible();
    const validationSidebar = page.getByRole('complementary', { name: 'Validation' });
    await expect(validationSidebar).not.toContainText('structural ·');
    await expect(validationSidebar).not.toContainText('semantic ·');
    await expect(validationSidebar).toContainText('publish · PUB-004 · $.status');
    const authoredAt50 = await readAdminVersion(page);
    await testInfo.attach('p10-studio-authored-threshold-50-config.json', {
      body: Buffer.from(`${JSON.stringify(authoredAt50.payload, null, 2)}\n`),
      contentType: 'application/json',
    });
    await runPreview(page, { readinessValue: 0, markerValue: 55 });
    await expect(previewScore(page)).toHaveText('1');
    await page.getByText(/Internal trace/u).click();
    await expect(page.locator('.admin-trace')).toContainText('score');

    await page.getByRole('tab', { name: 'Scoring & rules' }).click();
    const markerRule = page
      .locator('details')
      .filter({ has: page.getByText('Rule 2: markerValue', { exact: true }) });
    await markerRule.locator('summary').click();
    const markerUpperBoundary = markerRule
      .getByRole('group', { name: 'Band 1' })
      .getByLabel('Upper boundary value');
    await markerUpperBoundary.fill('60');
    await markerRule
      .getByRole('group', { name: 'Band 2' })
      .getByLabel('Lower boundary value')
      .fill('60');
    await expectStudioSavedWithOneRecovery(page, markerUpperBoundary);
    const authoredAt60 = await readAdminVersion(page);
    await testInfo.attach('p10-studio-authored-threshold-60-config.json', {
      body: Buffer.from(`${JSON.stringify(authoredAt60.payload, null, 2)}\n`),
      contentType: 'application/json',
    });

    await openReleaseTab(page);
    await runPreview(page, { readinessValue: 0, markerValue: 55 });
    await expect(previewScore(page)).toHaveText('0');
    await expect(page.locator('.admin-trace')).toContainText('score');

    await page.getByRole('button', { name: 'Add case' }).click();
    const thresholdCase = page.locator('fieldset.admin-test-case').nth(1);
    await thresholdCase.getByLabel('Key').fill('p10-threshold');
    await thresholdCase.getByLabel('Name').fill('Synthetic marker at the authored threshold');
    await thresholdCase.getByLabel('Kind').selectOption('boundary');
    await thresholdCase
      .getByLabel('Inputs JSON')
      .fill(JSON.stringify({ readinessValue: 0, markerValue: 60 }));
    await thresholdCase
      .getByLabel('Expected JSON')
      .fill(JSON.stringify({ finalScore: 1, category: 'Higher synthetic score' }));
    await page.getByRole('button', { name: 'Save tests' }).click();
    await expect(page.getByText('Test cases saved.')).toBeVisible();
    await page.getByRole('button', { name: 'Run all' }).click();
    await expect(page.getByText('All saved tests passed.')).toBeVisible();
    await page.getByRole('button', { name: 'Validate' }).click();
    await expect(page.getByText('Validation completed with blockers.')).toBeVisible();
    await expect(validationSidebar).not.toContainText('structural ·');
    await expect(validationSidebar).not.toContainText('semantic ·');
    await assertAxeClean(page, 'Calculator Studio release workspace');

    await page.getByRole('button', { name: 'Submit review' }).click();
    await expect(page.getByText('Draft submitted for independent review.')).toBeVisible();
    await page.getByRole('button', { name: 'Sign out' }).click();
    await expect(page).toHaveURL(/\/admin\/login/u, { timeout: 300_000 });

    await login(page, keys.reviewerEmail);
    await page.goto(`/admin/calculators/${slug}/versions/1`);
    await openReleaseTab(page);
    await page.getByRole('button', { name: 'Approve review' }).click();
    await expect(page.getByText('Authenticated review evidence recorded.')).toBeVisible();
    await page.getByRole('button', { name: 'Sign out' }).click();

    await login(page, keys.adminEmail);
    await page.goto(`/admin/calculators/${slug}/versions/1`);
    await openReleaseTab(page);
    await page.getByRole('button', { name: 'Validate' }).click();
    await expect(page.getByText('All publication gates pass.')).toBeVisible();
    await page.getByLabel('Publication changelog').fill('P10 Studio-only reusability gate.');
    await page.getByRole('button', { name: 'Publish immutable version' }).click();
    await expect(page.getByText('Version published transactionally.')).toBeVisible();
    await expect(page.getByText('published', { exact: true }).first()).toBeVisible();
    // Exercise the same leased, signed outbox dispatcher used by the production
    // scheduler before asserting that the separately deployed Next.js catalog
    // reflects this publication. Without the worker, ISR is intentionally
    // eventually consistent and the first request can receive the stale build.
    await runCacheInvalidationCli();
    const publishedAdminVersion = await readAdminVersion(page);
    expect(publishedAdminVersion.versionHash).toMatch(/^[a-f0-9]{64}$/u);
    await testInfo.attach('p10-published-calculator-config.json', {
      body: Buffer.from(`${JSON.stringify(publishedAdminVersion.payload, null, 2)}\n`),
      contentType: 'application/json',
    });
    const configOnlyDiff = {
      schemaVersion: 'p10-config-only-diff.v1',
      stages: {
        blankToAuthoredThreshold50: configurationDifferences(
          blankAdminVersion.payload,
          authoredAt50.payload,
        ),
        authoredThreshold50To60: configurationDifferences(
          authoredAt50.payload,
          authoredAt60.payload,
        ),
        authoredThreshold60ToPublished: configurationDifferences(
          authoredAt60.payload,
          publishedAdminVersion.payload,
        ),
      },
    } as const;
    expect(configOnlyDiff.stages.blankToAuthoredThreshold50.length).toBeGreaterThan(0);
    expect(configOnlyDiff.stages.authoredThreshold50To60).toEqual([
      {
        operation: 'replace',
        path: '/scoringRules/1/contexts/0/bands/0/max',
        before: 50,
        after: 60,
      },
      {
        operation: 'replace',
        path: '/scoringRules/1/contexts/0/bands/1/min',
        before: 50,
        after: 60,
      },
    ]);
    await testInfo.attach('p10-config-only-diff.json', {
      body: Buffer.from(`${JSON.stringify(configOnlyDiff, null, 2)}\n`),
      contentType: 'application/json',
    });

    const publicConfigResponse = await request.get(`${apiBase}/calculators/${slug}`);
    expect(publicConfigResponse.status()).toBe(200);
    const etag = publicConfigResponse.headers().etag;
    expect(etag).toBeTruthy();
    const publicConfigText = await publicConfigResponse.text();
    expect(publicConfigText).not.toMatch(
      /scoringRules|formulas|optionPoints|points|weights?|trace|adjustmentRules|floorRules/iu,
    );
    const warm = await request.get(`${apiBase}/calculators/${slug}`, {
      headers: { 'if-none-match': etag ?? '' },
    });
    expect(warm.status()).toBe(304);

    const biomarkerListResponse = await request.get(`${apiBase}/biomarkers`);
    expect(biomarkerListResponse.status()).toBe(200);
    expect(biomarkerListResponse.headers()['cache-control']).toContain('public');
    const biomarkerListText = await biomarkerListResponse.text();
    assertPublicBiomarkerPrivacy(biomarkerListText, 'public biomarker list');
    const biomarkerList = JSON.parse(biomarkerListText) as {
      readonly data?: readonly {
        readonly key?: string;
        readonly revision?: number;
        readonly displayName?: string;
      }[];
    };
    expect(biomarkerList.data).toEqual([
      expect.objectContaining({
        key: keys.measurement,
        revision: 1,
        displayName: biomarkerName,
      }),
    ]);

    const biomarkerDetailResponse = await request.get(
      `${apiBase}/biomarkers/${encodeURIComponent(keys.measurement)}`,
    );
    expect(biomarkerDetailResponse.status()).toBe(200);
    expect(biomarkerDetailResponse.headers()['cache-control']).toContain('public');
    const biomarkerDetailEtag = biomarkerDetailResponse.headers().etag;
    expect(biomarkerDetailEtag).toBeTruthy();
    const biomarkerDetailText = await biomarkerDetailResponse.text();
    assertPublicBiomarkerPrivacy(biomarkerDetailText, 'public biomarker detail');
    const biomarkerDetail = JSON.parse(biomarkerDetailText) as {
      readonly data?: {
        readonly key?: string;
        readonly definition?: {
          readonly aliases?: readonly string[];
          readonly domainKeys?: readonly string[];
          readonly conversions?: readonly { readonly factor?: number }[];
          readonly referenceRanges?: readonly { readonly label?: string }[];
        };
        readonly sources?: readonly { readonly title?: string }[];
        readonly relatedBiomarkers?: readonly unknown[];
        readonly usedInCalculators?: readonly {
          readonly calculatorSlug?: string;
          readonly version?: number;
          readonly name?: string;
        }[];
      };
    };
    expect(biomarkerDetail.data).toMatchObject({
      key: keys.measurement,
      definition: {
        aliases: [biomarkerAlias],
        domainKeys: [biomarkerDomain],
        conversions: [expect.objectContaining({ factor: 10 })],
        referenceRanges: [expect.objectContaining({ label: 'Synthetic interface interval' })],
      },
      sources: [
        expect.objectContaining({ title: 'Synthetic nonclinical browser-fixture evidence' }),
      ],
      relatedBiomarkers: [],
      usedInCalculators: [
        expect.objectContaining({ calculatorSlug: slug, version: 1, name: calculatorName }),
      ],
    });
    const warmBiomarkerDetail = await request.get(
      `${apiBase}/biomarkers/${encodeURIComponent(keys.measurement)}`,
      { headers: { 'if-none-match': biomarkerDetailEtag ?? '' } },
    );
    expect(warmBiomarkerDetail.status()).toBe(304);

    await page.goto('/');
    await expect(
      page.getByRole('heading', { name: 'Simple, evidence-aware health calculators.' }),
    ).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Published calculators' })).toBeVisible();
    const directoryCalculatorLink = page.getByRole('link', {
      name: calculatorName,
      exact: true,
    });
    await expect(directoryCalculatorLink).toBeVisible();
    const calculatorSearch = page.getByLabel('Search calculators');
    await calculatorSearch.fill('adaptability check');
    await expect(directoryCalculatorLink).toBeVisible();
    await calculatorSearch.fill(`missing-${nonce}`);
    await expect(
      page.getByRole('heading', { name: 'No calculators match that search' }),
    ).toBeVisible();
    await calculatorSearch.fill('');
    await expect(directoryCalculatorLink).toBeVisible();
    await assertAxeClean(page, 'public calculator directory');
    await assertNoDocumentOverflow(page, 'desktop public calculator directory');
    await page.setViewportSize({ width: 375, height: 812 });
    await expect(directoryCalculatorLink).toBeVisible();
    await assertNoDocumentOverflow(page, 'mobile public calculator directory');
    await page.setViewportSize({ width: 1280, height: 720 });

    await page.goto('/biomarkers');
    await expect(page.getByRole('heading', { name: 'Biomarkers', exact: true })).toBeVisible();
    const biomarkerDirectory = page.locator('.biomarker-directory');
    const biomarkerStatus = biomarkerDirectory
      .locator('.biomarker-directory__status-row')
      .getByRole('status');
    const biomarkerLink = page.getByRole('link', { name: biomarkerName, exact: true });
    await expect(biomarkerStatus).toHaveText('1 reviewed measurement shown.');
    await expect(biomarkerLink).toBeVisible();
    await assertAxeClean(page, 'public biomarker directory');
    await assertNoDocumentOverflow(page, 'desktop public biomarker directory');

    const alphabet = page.getByRole('navigation', { name: 'Browse biomarkers alphabetically' });
    await expect(alphabet.getByRole('button', { name: 'A', exact: true })).toBeDisabled();
    const letterS = alphabet.getByRole('button', { name: 'S', exact: true });
    await expect(letterS).toBeEnabled();
    await letterS.click();
    await expect(letterS).toHaveAttribute('aria-pressed', 'true');
    await expect(page).toHaveURL(/[?&]letter=S(?:&|$)/u);
    await expect(biomarkerLink).toBeVisible();
    await alphabet.getByRole('button', { name: 'All', exact: true }).click();
    await expect.poll(() => new URL(page.url()).searchParams.get('letter')).toBeNull();

    const biomarkerSearch = page.getByLabel('Search biomarkers and measurements');
    const aliasResponsePromise = page.waitForResponse((response) => {
      const url = new URL(response.url());
      return (
        url.pathname === '/api/v1/biomarkers' && url.searchParams.get('search') === biomarkerAlias
      );
    });
    await biomarkerSearch.fill(biomarkerAlias);
    expect((await aliasResponsePromise).status()).toBe(200);
    await expect(biomarkerLink).toBeVisible();
    await expect.poll(() => new URL(page.url()).searchParams.get('search')).toBe(biomarkerAlias);
    await biomarkerDirectory.getByRole('button', { name: 'Clear filters' }).click();
    await expect(biomarkerSearch).toHaveValue('');

    const domainSelect = page.getByLabel('Browse by health domain');
    const domainResponsePromise = page.waitForResponse((response) => {
      const url = new URL(response.url());
      return (
        url.pathname === '/api/v1/biomarkers' && url.searchParams.get('domain') === biomarkerDomain
      );
    });
    await domainSelect.selectOption(biomarkerDomain);
    expect((await domainResponsePromise).status()).toBe(200);
    await expect(domainSelect).toHaveValue(biomarkerDomain);
    await expect(biomarkerStatus).toHaveText('1 reviewed measurement shown.');
    await expect(biomarkerLink).toBeVisible();
    await page.setViewportSize({ width: 375, height: 812 });
    await expect(biomarkerSearch).toBeVisible();
    await expect(domainSelect).toBeVisible();
    await expect(biomarkerLink).toBeVisible();
    await assertNoDocumentOverflow(page, 'mobile public biomarker directory');
    await page.setViewportSize({ width: 1280, height: 720 });

    await biomarkerLink.click();
    await expect(page).toHaveURL(`/biomarkers/${keys.measurement}`);
    await expect(page.getByRole('heading', { name: biomarkerName, exact: true })).toBeVisible();
    await expect(page.getByText(`Also known as: ${biomarkerAlias}`)).toBeVisible();
    await expect(page.getByText('Health domains: Synthetic Studio')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Reviewed reference ranges' })).toBeVisible();
    await expect(page.getByText('Synthetic interface interval', { exact: true })).toBeVisible();
    await page.getByText('View source provenance for Synthetic interface interval').click();
    await expect(
      page.getByText('Synthetic nonclinical browser-fixture evidence').first(),
    ).toBeVisible();
    const relatedBiomarkers = page.locator('section').filter({
      has: page.getByRole('heading', { name: 'Related biomarkers' }),
    });
    await expect(relatedBiomarkers).toContainText(
      'No reviewed related biomarkers are currently linked.',
    );
    const usedInCalculators = page.locator('section').filter({
      has: page.getByRole('heading', { name: 'Used in calculators' }),
    });
    const calculatorInterlink = usedInCalculators.getByRole('link', {
      name: calculatorName,
      exact: true,
    });
    await expect(calculatorInterlink).toHaveAttribute('href', `/c/${slug}`);
    await assertAxeClean(page, 'public biomarker detail');
    await assertNoDocumentOverflow(page, 'desktop public biomarker detail');
    await page.setViewportSize({ width: 375, height: 812 });
    await expect(calculatorInterlink).toBeVisible();
    await assertNoDocumentOverflow(page, 'mobile public biomarker detail');
    await page.setViewportSize({ width: 1280, height: 720 });
    await calculatorInterlink.click();
    await expect(page).toHaveURL(`/c/${slug}`);
    await expect(page.getByRole('heading', { name: calculatorName })).toBeVisible();

    const injection = await request.post(`${apiBase}/calculators/${slug}/assess`, {
      headers: {
        'content-type': 'application/json',
        'idempotency-key': 'p10-injection-check',
      },
      data: {
        inputs: { readinessValue: 0, markerValue: { $gt: 0 }, $where: 'return true' },
        unknownField: { prototype: { polluted: true } },
      },
    });
    expect(injection.status()).toBe(422);
    expect(await injection.text()).not.toMatch(/stack|node_modules|scoringRules|trace/iu);

    await page.goto(`/c/${slug}`);
    await expect(page.getByRole('heading', { name: calculatorName })).toBeVisible();
    await assertAxeClean(page, 'public calculator');
    await page.setViewportSize({ width: 375, height: 812 });
    await assertNoDocumentOverflow(page, 'mobile public calculator');
    await expect(page.getByLabel('Synthetic readiness value')).toBeVisible();
    await page.setViewportSize({ width: 768, height: 1024 });
    await assertNoDocumentOverflow(page, 'tablet public calculator');
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.getByLabel('Synthetic readiness value').fill('0');
    await page.getByLabel("I don't have this value").check();

    let failOnce = true;
    await page.route(`**/api/v1/calculators/${slug}/assess`, async (route) => {
      if (!failOnce) {
        await route.continue();
        return;
      }
      failOnce = false;
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({
          error: { code: 'PERSISTENCE_UNAVAILABLE', message: 'Temporary fixture outage.' },
        }),
      });
    });
    await page.getByRole('button', { name: 'Calculate' }).click();
    await expect(page.locator('.calculator-submit-error')).toHaveText('Temporary fixture outage.');
    await page.unroute(`**/api/v1/calculators/${slug}/assess`);
    await page.getByRole('button', { name: 'Calculate' }).click();

    await expect(page.getByRole('heading', { name: `${calculatorName} result` })).toBeVisible();
    await expect(page.getByText('Information used')).toBeVisible();
    await expect(page.getByText('Not provided', { exact: true }).first()).toBeVisible();
    await expect(page.getByLabel('Temporary share link')).toBeVisible();
    await assertAxeClean(page, 'partial-laboratory result');
    const shareUrl = await page.getByLabel('Temporary share link').inputValue();
    expect(shareUrl).toMatch(
      new RegExp(`^${clientUrl.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')}/results/`),
    );
    await page.getByRole('button', { name: 'Copy share link' }).click();
    await expect(page.getByRole('status')).toHaveText('Share link copied.');

    const shareToken = new URL(shareUrl).pathname.split('/').at(-1);
    expect(shareToken).toBeTruthy();
    const sharedApiResponse = await request.get(`${apiBase}/results/${shareToken}`);
    expect(sharedApiResponse.status()).toBe(200);
    expect(sharedApiResponse.headers()['cache-control']).toContain('no-store');
    expect(sharedApiResponse.headers()['x-robots-tag']).toBe('noindex, nofollow');
    const sharedText = await sharedApiResponse.text();
    expect(sharedText).not.toMatch(
      /scoringRules|formulas|weights?|trace|idempotency|visitorId|sessionId/iu,
    );
    const shared = JSON.parse(sharedText) as {
      data?: { presentation?: { calculatorVersion?: number } };
    };
    expect(shared.data?.presentation?.calculatorVersion).toBe(1);

    await page.goto(shareUrl);
    await expect(page.getByRole('heading', { name: 'Assessment result' })).toBeVisible();
    await assertAxeClean(page, 'shared result');
    const clientHeaders = await request.get(shareUrl);
    expect(clientHeaders.headers()['cache-control']).toContain('no-store');
    expect(clientHeaders.headers()['referrer-policy']).toBe('no-referrer');
    expect(clientHeaders.headers()['x-robots-tag']).toContain('noindex');

    await page.goto(`/c/${slug}`);
    const keyboardReadiness = page.getByLabel('Synthetic readiness value');
    await reachByKeyboard(page, keyboardReadiness);
    expect(await keyboardReadiness.evaluate((element) => element.matches(':focus-visible'))).toBe(
      true,
    );
    await page.keyboard.type('0');
    const keyboardMissingMarker = page.getByLabel("I don't have this value");
    await reachByKeyboard(page, keyboardMissingMarker);
    await page.keyboard.press('Space');
    await expect(keyboardMissingMarker).toBeChecked();
    const keyboardCalculate = page.getByRole('button', { name: 'Calculate' });
    await reachByKeyboard(page, keyboardCalculate);
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { name: `${calculatorName} result` })).toBeVisible();

    const linkResult = await checkSiteLinks({ baseUrl: clientUrl, maxPages: 30 });
    expect(linkResult.status).toBe('ok');
    await attachEvidence(testInfo, {
      schemaVersion: 'p10-reusability-browser-evidence.v1',
      fixtureOnly: true,
      calculatorSlug: slug,
      calculatorVersion: 1,
      createdFromBlankStudioDraft: true,
      fullConfigurationJsonImportUsed: false,
      subsequentlyEditedReviewedPublishedViaStudioUi: true,
      studioCreateTransientRecoveryUsed,
      advancedContractFieldsAuthoredThroughStudioUi: [
        'formulas',
        'domainAggregationPolicy',
        'sources',
        'content.blocks',
        'content.authorship.contributors',
      ],
      blankDraftConfigSha256: createHash('sha256')
        .update(JSON.stringify(blankAdminVersion.payload))
        .digest('hex'),
      publishedConfigSha256: createHash('sha256')
        .update(JSON.stringify(publishedAdminVersion.payload))
        .digest('hex'),
      publishedVersionHash: publishedAdminVersion.versionHash,
      configOnlyDiffArtifact: 'p10-config-only-diff.json',
      configOnlyDiffOperationCounts: {
        blankToAuthoredThreshold50: configOnlyDiff.stages.blankToAuthoredThreshold50.length,
        authoredThreshold50To60: configOnlyDiff.stages.authoredThreshold50To60.length,
        authoredThreshold60ToPublished: configOnlyDiff.stages.authoredThreshold60ToPublished.length,
      },
      blankToPublishedTopLevelKeysAdded: Object.keys(publishedAdminVersion.payload)
        .filter((key) => !(key in blankAdminVersion.payload))
        .sort(),
      thresholdEditedThroughStudioUi: {
        before: 50,
        after: 60,
        previewScoreAt55: { before: 1, after: 0 },
        beforeConfigSha256: createHash('sha256')
          .update(JSON.stringify(authoredAt50.payload))
          .digest('hex'),
        afterConfigSha256: createHash('sha256')
          .update(JSON.stringify(authoredAt60.payload))
          .digest('hex'),
      },
      publicConfigSha256: createHash('sha256').update(publicConfigText).digest('hex'),
      publicBiomarkerListSha256: createHash('sha256').update(biomarkerListText).digest('hex'),
      publicBiomarkerDetailSha256: createHash('sha256').update(biomarkerDetailText).digest('hex'),
      sharedResultSha256: createHash('sha256').update(sharedText).digest('hex'),
      publicProtectedFieldsAbsent: true,
      publicBiomarkerProtectedFieldsAbsent: true,
      publicDirectoryCoverage: {
        homepageCalculatorDiscovery: true,
        calculatorSearch: true,
        biomarkerDirectoryDiscovery: true,
        biomarkerAliasSearch: true,
        biomarkerAlphabetFilter: true,
        biomarkerDomainFilter: true,
        biomarkerReviewedRangeAndSource: true,
        biomarkerToCalculatorInterlink: true,
        desktopAndMobileOverflowChecks: true,
      },
      partialLaboratoryJourney: true,
      keyboardOnlyAssessmentJourney: true,
      responsiveViewports: ['1280x720', '768x1024', '375x812'],
      sharePrivacyHeaders: true,
      renderedLinkCheck: {
        pagesVisited: linkResult.pagesVisited,
        linksChecked: linkResult.linksChecked,
      },
      expectedNegativeHttpResponses,
      unexpectedBrowserConsoleAndPageErrors: browserErrors.filter(
        (message) =>
          !/^console: Failed to load resource: the server responded with a status of (401 \(Unauthorized\)|503 \(Service Unavailable\))$/u.test(
            message,
          ),
      ),
    });
    expect(unexpectedNegativeHttpResponses, 'unexpected HTTP failures in the page').toEqual([]);
    const expectedNetworkConsoleErrors = browserErrors.filter((message) =>
      /^console: Failed to load resource: the server responded with a status of (401 \(Unauthorized\)|503 \(Service Unavailable\))$/u.test(
        message,
      ),
    );
    expect(expectedNetworkConsoleErrors).toHaveLength(expectedNegativeHttpResponses.length);
    expect(
      browserErrors.filter((message) => !expectedNetworkConsoleErrors.includes(message)),
      'unexpected browser console/page errors',
    ).toEqual([]);
  });
});
