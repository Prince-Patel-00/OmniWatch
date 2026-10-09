import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import handler from '../api/index.js';

describe('Vercel Monorepo Rewrites & Serverless Handler Suite', () => {
  it('vercel.json conforms to Vercel deployment spec', () => {
    const raw = fs.readFileSync('vercel.json', 'utf8');
    const config = JSON.parse(raw);

    assert.equal(config.framework, 'vite');
    assert.equal(config.outputDirectory, 'apps/client/dist');
    assert.ok(config.buildCommand.includes('apps/client'));

    // Rewrites check
    assert.ok(Array.isArray(config.rewrites));
    const apiRewrite = config.rewrites.find(r => r.source === '/api/(.*)');
    assert.ok(apiRewrite, 'Must have /api/(.*) rewrite');
    assert.equal(apiRewrite.destination, '/api');

    const spaRewrite = config.rewrites.find(r => r.source === '/(.*)');
    assert.ok(spaRewrite, 'Must have SPA fallback rewrite');
    assert.equal(spaRewrite.destination, '/index.html');

    // Cron check
    assert.ok(Array.isArray(config.crons));
    assert.equal(config.crons[0].path, '/api/mirrors/check');
    assert.equal(config.crons[0].schedule, '0 */6 * * *');
  });

  it('api/index.js handler normalizes URLs and serves API routes', async () => {
    let responseBody = null;

    const mockReq = {
      method: 'GET',
      url: '/api/health',
      headers: { host: 'omniwatch.vercel.app' }
    };

    await new Promise((resolve) => {
      const mockRes = {
        statusCode: 200,
        setHeader: () => {},
        getHeader: () => undefined,
        status(code) {
          this.statusCode = code;
          return this;
        },
        json(data) {
          responseBody = data;
          resolve();
          return this;
        },
        send(data) {
          try {
            responseBody = typeof data === 'string' ? JSON.parse(data) : data;
          } catch {
            responseBody = data;
          }
          resolve();
          return this;
        },
        end() {
          resolve();
          return this;
        }
      };

      handler(mockReq, mockRes);
    });

    assert.equal(responseBody?.status, 'ok');
  });

  it('api/index.js handler restores /api prefix when proxy passes stripped path', async () => {
    let responseBody = null;

    const mockReq = {
      method: 'GET',
      url: '/health', // Missing /api prefix
      headers: { host: 'omniwatch.vercel.app' }
    };

    await new Promise((resolve) => {
      const mockRes = {
        statusCode: 200,
        setHeader: () => {},
        getHeader: () => undefined,
        status(code) {
          this.statusCode = code;
          return this;
        },
        json(data) {
          responseBody = data;
          resolve();
          return this;
        },
        send(data) {
          try {
            responseBody = typeof data === 'string' ? JSON.parse(data) : data;
          } catch {
            responseBody = data;
          }
          resolve();
          return this;
        },
        end() {
          resolve();
          return this;
        }
      };

      handler(mockReq, mockRes);
    });

    assert.equal(mockReq.url, '/api/health', 'Handler must normalize url to /api/health');
    assert.equal(responseBody?.status, 'ok');
  });
});
