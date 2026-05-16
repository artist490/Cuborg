import initSqlJs from "sql.js";
import sqlWasmUrl from "sql.js/dist/sql-wasm.wasm?url";

const DATABASE_NAME = "personal-secure-vault";
const DATABASE_STORE = "database-files";
const DATABASE_KEY = "vault.db";

let sqlRuntimePromise = null;

function openIndexedDb() {
  return new Promise((resolve, reject) => {
    if (!globalThis.indexedDB) {
      reject(new Error("IndexedDB is unavailable in this browser context."));
      return;
    }

    const request = globalThis.indexedDB.open(DATABASE_NAME, 1);

    request.onupgradeneeded = () => {
      const database = request.result;

      if (!database.objectStoreNames.contains(DATABASE_STORE)) {
        database.createObjectStore(DATABASE_STORE);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Failed to open IndexedDB."));
  });
}

function runIndexedDbTransaction(mode, action) {
  return openIndexedDb().then(
    (database) =>
      new Promise((resolve, reject) => {
        const transaction = database.transaction(DATABASE_STORE, mode);
        const store = transaction.objectStore(DATABASE_STORE);
        let settled = false;

        transaction.oncomplete = () => {
          database.close();

          if (!settled) {
            settled = true;
            resolve(undefined);
          }
        };

        transaction.onerror = () => {
          database.close();
          reject(transaction.error ?? new Error("IndexedDB transaction failed."));
        };

        transaction.onabort = () => {
          database.close();
          reject(transaction.error ?? new Error("IndexedDB transaction aborted."));
        };

        action(store, (value) => {
          if (!settled) {
            settled = true;
            resolve(value);
          }
        }, reject);
      }),
  );
}

async function readPersistedDatabase() {
  return runIndexedDbTransaction("readonly", (store, resolve, reject) => {
    const request = store.get(DATABASE_KEY);

    request.onsuccess = () => resolve(request.result ?? null);
    request.onerror = () => reject(request.error ?? new Error("Failed to read the persisted vault database."));
  });
}

async function writePersistedDatabase(databaseBytes) {
  const bytes = databaseBytes instanceof Uint8Array ? databaseBytes : new Uint8Array(databaseBytes);

  return runIndexedDbTransaction("readwrite", (store, resolve, reject) => {
    const request = store.put(bytes, DATABASE_KEY);

    request.onsuccess = () => resolve(true);
    request.onerror = () => reject(request.error ?? new Error("Failed to persist the vault database."));
  });
}

async function deletePersistedDatabase() {
  return runIndexedDbTransaction("readwrite", (store, resolve, reject) => {
    const request = store.delete(DATABASE_KEY);

    request.onsuccess = () => resolve(true);
    request.onerror = () => reject(request.error ?? new Error("Failed to delete the persisted vault database."));
  });
}

function getSqlRuntime() {
  if (!sqlRuntimePromise) {
    sqlRuntimePromise = initSqlJs({
      locateFile: () => sqlWasmUrl,
    });
  }

  return sqlRuntimePromise;
}

function exec(database, sql, params = []) {
  const statement = database.prepare(sql);

  try {
    statement.bind(params);
    statement.step();
  } finally {
    statement.free();
  }
}

function queryAll(database, sql, params = []) {
  const statement = database.prepare(sql);
  const rows = [];

  try {
    statement.bind(params);

    while (statement.step()) {
      rows.push(statement.getAsObject());
    }
  } finally {
    statement.free();
  }

  return rows;
}

function queryOne(database, sql, params = []) {
  return queryAll(database, sql, params)[0] ?? null;
}

function migrate(database) {
  database.run("PRAGMA foreign_keys = ON;");
  database.run("PRAGMA journal_mode = WAL;");

  database.run(`
    CREATE TABLE IF NOT EXISTS system_auth (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      salt TEXT NOT NULL,
      verifier TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  database.run(`
    CREATE TABLE IF NOT EXISTS vault_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL CHECK (type IN ('password', 'note', 'card')),
      title TEXT NOT NULL,
      subtitle TEXT,
      username TEXT,
      secret TEXT,
      url TEXT,
      notes TEXT,
      tags TEXT NOT NULL DEFAULT '[]',
      favorite INTEGER NOT NULL DEFAULT 0 CHECK (favorite IN (0, 1)),
      archived INTEGER NOT NULL DEFAULT 0 CHECK (archived IN (0, 1)),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  database.run(`
    CREATE INDEX IF NOT EXISTS idx_vault_items_type_archived
    ON vault_items (type, archived, updated_at);
  `);

  database.run(`
    CREATE INDEX IF NOT EXISTS idx_vault_items_favorite
    ON vault_items (favorite, updated_at);
  `);
}

function normalizeItem(row) {
  if (!row) {
    return null;
  }

  return {
    id: Number(row.id),
    type: row.type,
    title: row.title,
    subtitle: row.subtitle ?? "",
    username: row.username ?? "",
    secret: row.secret ?? "",
    url: row.url ?? "",
    notes: row.notes ?? "",
    tags: row.tags ? JSON.parse(row.tags) : [],
    favorite: Boolean(row.favorite),
    archived: Boolean(row.archived),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function serializeTags(tags) {
  if (!Array.isArray(tags)) {
    return "[]";
  }

  return JSON.stringify(tags.map((tag) => String(tag).trim()).filter(Boolean));
}

export async function openVaultDatabase() {
  const SQL = await getSqlRuntime();
  const persistedBytes = await readPersistedDatabase();
  const database = persistedBytes ? new SQL.Database(new Uint8Array(persistedBytes)) : new SQL.Database();

  migrate(database);

  return database;
}

export function hasAuthRecord(database) {
  const row = queryOne(database, "SELECT COUNT(*) AS count FROM system_auth WHERE id = 1;");
  return Number(row?.count ?? 0) === 1;
}

export function getAuthRecord(database) {
  return queryOne(database, "SELECT salt, verifier, created_at, updated_at FROM system_auth WHERE id = 1;");
}

export function saveAuthRecord(database, { salt, verifier }) {
  exec(
    database,
    `
      INSERT INTO system_auth (id, salt, verifier, updated_at)
      VALUES (1, ?, ?, datetime('now'))
      ON CONFLICT(id) DO UPDATE SET
        salt = excluded.salt,
        verifier = excluded.verifier,
        updated_at = datetime('now');
    `,
    [salt, verifier],
  );
}

export function listVaultItems(database, { type = "password", search = "", includeArchived = false } = {}) {
  const params = [type, includeArchived ? 1 : 0];
  let sql = `
    SELECT *
    FROM vault_items
    WHERE type = ?
      AND (? = 1 OR archived = 0)
  `;

  const normalizedSearch = search.trim().toLowerCase();

  if (normalizedSearch) {
    params.push(`%${normalizedSearch}%`);
    sql += `
      AND (
        lower(title) LIKE ?
        OR lower(coalesce(subtitle, '')) LIKE ?
        OR lower(coalesce(username, '')) LIKE ?
        OR lower(coalesce(url, '')) LIKE ?
        OR lower(tags) LIKE ?
      )
    `;
    params.push(...Array(4).fill(`%${normalizedSearch}%`));
  }

  sql += " ORDER BY favorite DESC, updated_at DESC, id DESC;";

  return queryAll(database, sql, params).map(normalizeItem);
}

export function getVaultItem(database, id) {
  return normalizeItem(queryOne(database, "SELECT * FROM vault_items WHERE id = ?;", [id]));
}

export function createVaultItem(database, item) {
  exec(
    database,
    `
      INSERT INTO vault_items (
        type,
        title,
        subtitle,
        username,
        secret,
        url,
        notes,
        tags,
        favorite,
        archived,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'));
    `,
    [
      item.type,
      item.title,
      item.subtitle ?? "",
      item.username ?? "",
      item.secret ?? "",
      item.url ?? "",
      item.notes ?? "",
      serializeTags(item.tags),
      item.favorite ? 1 : 0,
      item.archived ? 1 : 0,
    ],
  );

  return Number(queryOne(database, "SELECT last_insert_rowid() AS id;").id);
}

export function updateVaultItem(database, id, item) {
  exec(
    database,
    `
      UPDATE vault_items
      SET
        type = ?,
        title = ?,
        subtitle = ?,
        username = ?,
        secret = ?,
        url = ?,
        notes = ?,
        tags = ?,
        favorite = ?,
        archived = ?,
        updated_at = datetime('now')
      WHERE id = ?;
    `,
    [
      item.type,
      item.title,
      item.subtitle ?? "",
      item.username ?? "",
      item.secret ?? "",
      item.url ?? "",
      item.notes ?? "",
      serializeTags(item.tags),
      item.favorite ? 1 : 0,
      item.archived ? 1 : 0,
      id,
    ],
  );
}

export function deleteVaultItem(database, id) {
  exec(database, "DELETE FROM vault_items WHERE id = ?;", [id]);
}

export function archiveVaultItem(database, id, archived = true) {
  exec(
    database,
    "UPDATE vault_items SET archived = ?, updated_at = datetime('now') WHERE id = ?;",
    [archived ? 1 : 0, id],
  );
}

export function setVaultItemFavorite(database, id, favorite = true) {
  exec(
    database,
    "UPDATE vault_items SET favorite = ?, updated_at = datetime('now') WHERE id = ?;",
    [favorite ? 1 : 0, id],
  );
}

export async function persistVaultDatabase(database) {
  const bytes = database.export();
  await writePersistedDatabase(bytes);
  return bytes;
}

export function exportVaultDatabase(database) {
  return database.export();
}

export async function importVaultDatabase(fileOrBytes) {
  let bytes;

  if (fileOrBytes instanceof Uint8Array) {
    bytes = fileOrBytes;
  } else if (fileOrBytes instanceof ArrayBuffer) {
    bytes = new Uint8Array(fileOrBytes);
  } else if (fileOrBytes instanceof Blob) {
    bytes = new Uint8Array(await fileOrBytes.arrayBuffer());
  } else {
    throw new TypeError("Import source must be a File, Blob, ArrayBuffer, or Uint8Array.");
  }

  const SQL = await getSqlRuntime();
  const database = new SQL.Database(bytes);

  migrate(database);
  await writePersistedDatabase(database.export());

  return database;
}

export async function resetVaultDatabase() {
  await deletePersistedDatabase();
  const SQL = await getSqlRuntime();
  const database = new SQL.Database();

  migrate(database);
  return database;
}

export function createDownloadUrl(database) {
  const bytes = exportVaultDatabase(database);
  const blob = new Blob([bytes], { type: "application/vnd.sqlite3" });

  return URL.createObjectURL(blob);
}

export function revokeDownloadUrl(url) {
  if (url) {
    URL.revokeObjectURL(url);
  }
}

export function closeVaultDatabase(database) {
  database?.close();
}

export const dbConfig = Object.freeze({
  databaseName: DATABASE_NAME,
  databaseStore: DATABASE_STORE,
  databaseKey: DATABASE_KEY,
  wasmFile: sqlWasmUrl,
});
