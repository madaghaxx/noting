/**
 * Migrations, including the upgrade path a phone that already has notes on it
 * will take. Runs the app's real `runMigrations` against real SQLite.
 *
 * The v1 schema is written out by hand below rather than imported: the point is
 * to stand in for an install that shipped before the later migrations existed,
 * and reusing today's code to build it would defeat that.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { LATEST_VERSION, runMigrations } from "@/src/db/migrations";

import { openDatabaseAsync } from "./support/expo-sqlite.mjs";

const V1_SCHEMA = `
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
`;

const version = async (db) =>
  (await db.getFirstAsync("PRAGMA user_version")).user_version;

const columns = async (db) =>
  (await db.getAllAsync("PRAGMA table_info(notes)")).map((row) => row.name);

const indexes = async (db) =>
  (await db.getAllAsync("PRAGMA index_list(notes)")).map((row) => row.name);

test("a fresh database migrates to the latest version", async () => {
  const db = await openDatabaseAsync();

  await runMigrations(db);

  assert.equal(await version(db), LATEST_VERSION);
});

test("the migrated schema has the columns the app reads", async () => {
  const db = await openDatabaseAsync();
  await runMigrations(db);

  const names = await columns(db);

  for (const column of [
    "id",
    "title",
    "content",
    "is_pinned",
    "position",
    "deleted_at",
    "created_at",
    "updated_at",
  ]) {
    assert.ok(names.includes(column), `missing column ${column}`);
  }

  assert.ok(
    !names.includes("is_favorite"),
    "the favourite column outlived its migration",
  );
});

test("the migrated schema indexes both halves of the table", async () => {
  const db = await openDatabaseAsync();
  await runMigrations(db);

  const names = await indexes(db);

  assert.ok(names.includes("idx_notes_order"), "no index for the notes list");
  assert.ok(names.includes("idx_notes_trash"), "no index for the trash");
  assert.ok(
    !names.includes("idx_notes_favorite"),
    "the favourite index outlived its migration",
  );
});

test("a v1 install keeps its notes, and its favourites become pins", async () => {
  const db = await openDatabaseAsync();

  await db.execAsync(V1_SCHEMA);
  await db.execAsync("PRAGMA user_version = 1");

  await db.runAsync(
    `INSERT INTO notes (id, title, content, is_favorite, position, created_at, updated_at)
     VALUES ('keep', 'Kept', 'Body text', 1, 3.5, 100, 200)`,
  );
  await db.runAsync(
    `INSERT INTO notes (id, title, content, is_favorite, position, created_at, updated_at)
     VALUES ('plain', 'Plain', '', 0, 7, 300, 400)`,
  );

  await runMigrations(db);

  assert.equal(await version(db), LATEST_VERSION);

  const rows = await db.getAllAsync("SELECT * FROM notes ORDER BY position ASC");

  assert.deepEqual(
    rows.map((row) => [row.id, row.is_pinned, row.position, row.deleted_at]),
    [
      ["keep", 1, 3.5, null],
      ["plain", 0, 7, null],
    ],
  );

  // Content and timestamps came through untouched, not just the flag.
  assert.equal(rows[0].title, "Kept");
  assert.equal(rows[0].content, "Body text");
  assert.equal(rows[0].created_at, 100);
  assert.equal(rows[0].updated_at, 200);
});

test("migrating an already-current database changes nothing", async () => {
  const db = await openDatabaseAsync();
  await runMigrations(db);

  await db.runAsync(
    `INSERT INTO notes (id, title, content, is_pinned, position, created_at, updated_at)
     VALUES ('only', 'Only', '', 0, 0, 1, 1)`,
  );

  const before = await columns(db);

  await runMigrations(db);

  assert.equal(await version(db), LATEST_VERSION);
  assert.deepEqual(await columns(db), before);
  assert.equal(
    (await db.getFirstAsync("SELECT COUNT(*) AS n FROM notes")).n,
    1,
  );
});

test("a database from a newer version of the app is refused", async () => {
  const db = await openDatabaseAsync();
  await runMigrations(db);

  await db.execAsync(`PRAGMA user_version = ${LATEST_VERSION + 5}`);

  await assert.rejects(
    () => runMigrations(db),
    /schema v/,
    "opening a future schema should refuse rather than migrate downwards",
  );
});
