import type { SQLiteDatabase } from "expo-sqlite";

/**
 * Migrations receive either the database or an open transaction, so this asks
 * for the smallest surface both satisfy.
 */
type MigrationTarget = Pick<SQLiteDatabase, "execAsync" | "runAsync">;

type Migration = (db: MigrationTarget) => Promise<void>;

/**
 * Forward-only migrations, indexed by the version they upgrade *from*:
 * `MIGRATIONS[0]` takes a fresh database to v1. `MIGRATIONS.length` is
 * therefore always the latest schema version.
 *
 * Never edit a migration that has already shipped to a device — append a new
 * one instead, or installs in the field will disagree about their schema.
 */
const MIGRATIONS: Migration[] = [
  // v0 -> v1: initial schema.
  async (db) => {
    await db.execAsync(`
      CREATE TABLE notes (
        id          TEXT    PRIMARY KEY NOT NULL,
        title       TEXT    NOT NULL DEFAULT '',
        content     TEXT    NOT NULL DEFAULT '',
        is_favorite INTEGER NOT NULL DEFAULT 0,
        position    REAL    NOT NULL,
        created_at  INTEGER NOT NULL,
        updated_at  INTEGER NOT NULL
      );

      CREATE INDEX idx_notes_position ON notes (position);

      CREATE INDEX idx_notes_favorite ON notes (is_favorite) WHERE is_favorite = 1;
    `);
  },

  /**
   * v1 -> v2: favourites became pins.
   *
   * `RENAME COLUMN` rather than a new column and a copy, so existing notes keep
   * their flag instead of being silently reset. SQLite rewrites index and
   * trigger references to the renamed column automatically, but not index
   * *names*, so the old index is replaced with one covering the sort order the
   * app actually queries by.
   */
  async (db) => {
    await db.execAsync(`
      ALTER TABLE notes RENAME COLUMN is_favorite TO is_pinned;

      DROP INDEX IF EXISTS idx_notes_favorite;
      DROP INDEX IF EXISTS idx_notes_position;

      CREATE INDEX idx_notes_order ON notes (is_pinned DESC, position ASC);
    `);
  },
];

export const LATEST_VERSION = MIGRATIONS.length;

/**
 * Brings the database up to `LATEST_VERSION`, applying only what is missing.
 *
 * expo-sqlite ships no migration engine, so the schema version lives in
 * SQLite's own `user_version` header field.
 */
export async function runMigrations(db: SQLiteDatabase): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>(
    "PRAGMA user_version",
  );
  const current = row?.user_version ?? 0;

  if (current > LATEST_VERSION) {
    throw new Error(
      `This database is at schema v${current}, but the app only understands ` +
        `v${LATEST_VERSION}. Downgrading would discard data, so opening it is refused.`,
    );
  }

  for (let version = current; version < LATEST_VERSION; version++) {
    // The schema change and the version bump commit together. If the app dies
    // mid-migration both roll back, so a migration can never half-apply and
    // leave the header lying about what the schema actually is.
    await db.withExclusiveTransactionAsync(async (txn) => {
      await MIGRATIONS[version](txn);

      // PRAGMA statements cannot take bound parameters. Interpolating is safe
      // here only because `version` is a loop counter we control, never input.
      await txn.execAsync(`PRAGMA user_version = ${version + 1}`);
    });
  }
}
