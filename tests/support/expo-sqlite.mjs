/**
 * Minimal stand-in for expo-sqlite, backed by Node's built-in SQLite.
 *
 * Only the surface `src/db` actually calls is implemented, and it is implemented
 * against a real SQLite engine — the point is to run the app's own migrations
 * and queries for real, not to fake their results.
 */
import { DatabaseSync } from "node:sqlite";

function wrap(db) {
  const api = {
    async execAsync(source) {
      db.exec(source);
    },

    async runAsync(source, ...params) {
      return db.prepare(source).run(...params);
    },

    async getAllAsync(source, ...params) {
      return db.prepare(source).all(...params);
    },

    async getFirstAsync(source, ...params) {
      // expo-sqlite resolves to null for an empty result; node:sqlite gives
      // undefined, which would slip past the app's `?? 0` style fallbacks.
      return db.prepare(source).get(...params) ?? null;
    },

    async withExclusiveTransactionAsync(task) {
      db.exec("BEGIN IMMEDIATE");

      try {
        await task(api);
        db.exec("COMMIT");
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }
    },
  };

  return api;
}

export async function openDatabaseAsync() {
  // Each run gets a fresh in-memory database, so migrations always start at v0
  // and a test can never see another run's rows.
  return wrap(new DatabaseSync(":memory:"));
}
