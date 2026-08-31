/* global __ENV, __ITER, __VU */

import http from 'k6/http';
import { check } from 'k6';

export const options = {
  scenarios: {
    publicAssessment: {
      executor: 'shared-iterations',
      vus: Number(__ENV.P10_K6_VUS || 3),
      iterations: Number(__ENV.P10_K6_ITERATIONS || 18),
      maxDuration: __ENV.P10_K6_MAX_DURATION || '30s',
    },
  },
  thresholds: {
    checks: ['rate==1'],
    http_req_failed: ['rate==0'],
    'http_req_duration{operation:assess}': ['p(95)<300'],
  },
};

const API_BASE_URL = (__ENV.P10_API_BASE_URL || 'http://127.0.0.1:4000/api/v1').replace(/\/$/, '');
const SLUG = __ENV.P10_CALCULATOR_SLUG;
const INPUTS = JSON.parse(__ENV.P10_PERFORMANCE_INPUTS || '{}');

function responseHeader(response, expectedName) {
  const expected = expectedName.toLowerCase();
  const actualName = Object.keys(response.headers).find((name) => name.toLowerCase() === expected);
  return actualName ? response.headers[actualName] : undefined;
}

export function setup() {
  if (!SLUG) throw new Error('P10_CALCULATOR_SLUG is required.');
  const url = `${API_BASE_URL}/calculators/${encodeURIComponent(SLUG)}`;
  const cold = http.get(url, {
    headers: { 'Cache-Control': 'no-cache' },
    tags: { operation: 'config-cold' },
  });
  const etag = responseHeader(cold, 'etag');
  if (!etag) throw new Error('Cold configuration response omitted its ETag.');
  const warm = http.get(url, {
    headers: { 'If-None-Match': etag },
    tags: { operation: 'config-warm' },
  });
  check(cold, { 'cold config is 200': (response) => response.status === 200 });
  check(warm, { 'warm config is 304': (response) => response.status === 304 });
  return { slug: SLUG };
}

export default function (state) {
  const idempotencyKey = `p10-k6-${__VU}-${__ITER}-${Date.now()}`;
  const response = http.post(
    `${API_BASE_URL}/calculators/${encodeURIComponent(state.slug)}/assess`,
    JSON.stringify({ inputs: INPUTS }),
    {
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
      tags: { operation: 'assess' },
    },
  );
  check(response, { 'assessment is 200': (item) => item.status === 200 });
}
