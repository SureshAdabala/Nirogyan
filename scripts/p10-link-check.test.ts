import type { Server } from 'node:http';

import express from 'express';
import { afterEach, describe, expect, it } from 'vitest';

import { assertPublicLinkCheckUrl, checkSiteLinks, extractHtmlLinks } from './p10-link-check';

const servers: Server[] = [];

async function fixtureSite(home: string) {
  const app = express();
  app.get('/', (_request, response) => response.type('html').send(home));
  app.get('/ok', (_request, response) => response.type('html').send('<a href="/">Home</a>'));
  app.get('/broken', (_request, response) => response.status(404).send('missing'));
  const server = app.listen(0);
  servers.push(server);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Fixture site unavailable.');
  return `http://127.0.0.1:${address.port}/`;
}

afterEach(async () => {
  await Promise.all(
    servers
      .splice(0)
      .map(
        (server) =>
          new Promise<void>((resolve, reject) =>
            server.close((error) => (error ? reject(error) : resolve())),
          ),
      ),
  );
});

describe('P10 rendered-link checker', () => {
  it('extracts quoted and unquoted anchors without duplicating them', () => {
    expect(
      extractHtmlLinks('<a href="/one">1</a><a href=\'/two\'>2</a><a href=/one>again</a>'),
    ).toEqual(['/one', '/two']);
  });

  it('crawls same-origin links and handles cycles deterministically', async () => {
    const result = await checkSiteLinks({ baseUrl: await fixtureSite('<a href="/ok">OK</a>') });
    expect(result).toMatchObject({ status: 'ok', pagesVisited: 2, linksChecked: 2 });
  });

  it('fails on broken and unsafe rendered links', async () => {
    await expect(
      checkSiteLinks({
        baseUrl: await fixtureSite(
          '<a href="/broken">Broken</a><a href="javascript:alert(1)">Unsafe</a>',
        ),
      }),
    ).rejects.toThrow(/returned 404|unsafe link protocol/);
  });

  it('keeps scheduled public checks HTTPS-only, credential-free, and off private hosts', () => {
    expect(() => assertPublicLinkCheckUrl(new URL('https://www.example.com/'))).not.toThrow();
    for (const url of [
      'http://www.example.com/',
      'https://user:password@www.example.com/',
      'https://localhost/',
      'https://127.0.0.1/',
      'https://service.internal/',
      'https://www.example.com:8443/',
    ]) {
      expect(() => assertPublicLinkCheckUrl(new URL(url))).toThrow(/Public link checks/u);
    }
  });

  it('forbids secret-bearing base queries before a scheduled request is made', async () => {
    await expect(
      checkSiteLinks({
        baseUrl: 'https://www.example.com/?token=not-allowed',
        checkExternal: true,
        publicOnly: true,
      }),
    ).rejects.toThrow('must not contain a query or fragment');
  });
});
