import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isNeon, getDB } from '../apps/server/src/db.js';

describe('OmniWatch Serverless Database Driver Isolation Suite', () => {
  it('Driver Selection: isNeon() correctly reflects environment configuration', () => {
    // Test SQLite override
    const originalUseSqlite = process.env.USE_SQLITE;
    const originalDbUrl = process.env.DATABASE_URL;

    try {
      process.env.USE_SQLITE = '1';
      assert.equal(isNeon(), false, 'USE_SQLITE=1 must enforce SQLite mode');

      delete process.env.USE_SQLITE;
      process.env.DATABASE_URL = 'postgresql://user:pass@host:5432/db';
      assert.equal(isNeon(), true, 'DATABASE_URL presence must activate Neon mode');
    } finally {
      if (originalUseSqlite !== undefined) process.env.USE_SQLITE = originalUseSqlite;
      else delete process.env.USE_SQLITE;

      if (originalDbUrl !== undefined) process.env.DATABASE_URL = originalDbUrl;
      else delete process.env.DATABASE_URL;
    }
  });

  it('Serverless Guard: getDB() rejects direct SQLite invocation while in Neon mode', () => {
    const originalUseSqlite = process.env.USE_SQLITE;
    const originalDbUrl = process.env.DATABASE_URL;

    try {
      delete process.env.USE_SQLITE;
      process.env.DATABASE_URL = 'postgresql://mock_user:mock_pass@mock_host/db';
      assert.equal(isNeon(), true);

      assert.throws(
        () => getDB(),
        /getDB\(\) called while running in Neon PostgreSQL mode/,
        'Calling getDB() in Neon mode must fail fast with a descriptive guard'
      );
    } finally {
      if (originalUseSqlite !== undefined) process.env.USE_SQLITE = originalUseSqlite;
      else delete process.env.USE_SQLITE;

      if (originalDbUrl !== undefined) process.env.DATABASE_URL = originalDbUrl;
      else delete process.env.DATABASE_URL;
    }
  });

  it('Backward Compatibility: SQLite driver instantiates cleanly when in SQLite mode', () => {
    const originalUseSqlite = process.env.USE_SQLITE;
    try {
      process.env.USE_SQLITE = '1';
      assert.equal(isNeon(), false);
      const db = getDB();
      assert.ok(db, 'SQLite instance must be available in local SQLite mode');
      const row = db.prepare('SELECT 1 as val').get();
      assert.equal(row.val, 1);
    } finally {
      if (originalUseSqlite !== undefined) process.env.USE_SQLITE = originalUseSqlite;
      else delete process.env.USE_SQLITE;
    }
  });
});
