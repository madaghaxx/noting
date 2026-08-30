import * as SQLite from "expo-sqlite";

import { runMigrations } from "./migrations";

const DATABASE_NAME = "noting.db";

let connection: Promise<SQLite.SQLiteDatabase> | null = null;

async function connect(): Promise<SQLite.SQLiteDatabase> {
  const db = await SQLite.openDatabaseAsync(DATABASE_NAME);

  // NOTE ON ENCRYPTION: this is where `PRAGMA key` would go, and it is
  // deliberately absent. Stock SQLite silently ignores unknown pragmas, so
  // adding it while running in Expo Go would produce code that looks encrypted
  // and writes plaintext. Real encryption needs the `useSQLCipher` config
  // plugin flag plus a development build, which is a separate decision.
  //
  // As things stand, notes are stored unencrypted and protected only by the
  // biometric gate and Android's per-app sandbox.

  // WAL lets reads proceed while a write is in flight. It cannot be set from
  // inside a transaction, so it has to happen before any migration runs.
  await db.execAsync("PRAGMA journal_mode = WAL");
  await db.execAsync("PRAGMA foreign_keys = ON");

  await runMigrations(db);

  return db;
}

/**
 * The app's single database connection, opened on first use.
 *
 * The in-flight promise is cached rather than the resolved database, so
 * simultaneous callers all await one `connect()` instead of racing to open
 * several. A failed open clears the cache — otherwise one transient error
 * would be replayed to every future caller for the life of the process.
 */
export function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!connection) {
    connection = connect().catch((error: unknown) => {
      connection = null;
      throw error;
    });
  }

  return connection;
}
