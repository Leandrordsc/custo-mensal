import crypto from "node:crypto";
import { mkdir, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { DatabaseSync } from "node:sqlite";

const migrationsTable = "__drizzle_migrations";

export async function readLocalMigrations(migrationsDir = "drizzle") {
  const journalPath = resolve(process.cwd(), migrationsDir, "meta", "_journal.json");
  const journal = JSON.parse(await readFile(journalPath, "utf8"));

  return Promise.all(
    journal.entries.map(async (entry) => {
      const migrationPath = resolve(process.cwd(), migrationsDir, `${entry.tag}.sql`);
      const sql = await readFile(migrationPath, "utf8");

      return {
        tag: entry.tag,
        createdAt: entry.when,
        hash: crypto.createHash("sha256").update(sql).digest("hex"),
        statements: sql.split("--> statement-breakpoint").map((statement) => statement.trim()).filter(Boolean),
      };
    }),
  );
}

function ensureMigrationsTable(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS ${migrationsTable} (
      id SERIAL PRIMARY KEY,
      hash text NOT NULL,
      created_at numeric
    )
  `);
}

function getAppliedMigrations(db) {
  return new Map(
    db.prepare(`SELECT hash, created_at FROM ${migrationsTable} ORDER BY created_at`).all()
      .map((row) => [Number(row.created_at), row.hash]),
  );
}

function setForeignKeys(db, enabled) {
  db.exec(`PRAGMA foreign_keys = ${enabled ? "ON" : "OFF"}`);
  const row = db.prepare("PRAGMA foreign_keys").get();
  assertPragma(row.foreign_keys === (enabled ? 1 : 0), `PRAGMA foreign_keys nao ficou ${enabled ? "ON" : "OFF"}`);
}

function assertPragma(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function foreignKeyCheck(db) {
  const violations = db.prepare("PRAGMA foreign_key_check").all();
  if (violations.length > 0) {
    throw new Error(`PRAGMA foreign_key_check encontrou violacoes: ${JSON.stringify(violations)}`);
  }
}

export function applyMigrationAtomically(db, migration) {
  ensureMigrationsTable(db);
  setForeignKeys(db, false);
  let transactionStarted = false;

  try {
    db.exec("BEGIN IMMEDIATE");
    transactionStarted = true;

    for (const statement of migration.statements) {
      if (/^PRAGMA\s+foreign_keys\s*=/i.test(statement)) {
        continue;
      }

      db.exec(statement);
    }

    db.prepare(`INSERT INTO ${migrationsTable} ("hash", "created_at") VALUES (?, ?)`).run(migration.hash, migration.createdAt);
    db.exec("COMMIT");
    transactionStarted = false;
  } catch (error) {
    if (transactionStarted) {
      db.exec("ROLLBACK");
    }
    throw error;
  } finally {
    setForeignKeys(db, true);
  }

  foreignKeyCheck(db);
}

export async function migrateLocalDatabase({
  databasePath = process.env.LOCAL_DATABASE_PATH ?? "./data/custo-mensal.local.sqlite",
  migrationsDir = process.env.LOCAL_MIGRATIONS_DIR ?? "drizzle",
} = {}) {
  const absoluteDatabasePath = resolve(process.cwd(), databasePath);
  await mkdir(dirname(absoluteDatabasePath), { recursive: true });

  const db = new DatabaseSync(absoluteDatabasePath);
  try {
    setForeignKeys(db, true);
    ensureMigrationsTable(db);

    const appliedMigrations = getAppliedMigrations(db);
    const migrations = await readLocalMigrations(migrationsDir);

    for (const migration of migrations) {
      const appliedHash = appliedMigrations.get(migration.createdAt);

      if (!appliedHash) {
        applyMigrationAtomically(db, migration);
        console.log(`Applied ${migration.tag}`);
      } else if (appliedHash !== migration.hash) {
        throw new Error(
          [
            `Migration aplicada mudou: ${migration.tag}.`,
            `Hash registrado: ${appliedHash}.`,
            `Hash atual: ${migration.hash}.`,
            "Nao edite migrations ja aplicadas; migrations commitadas sao imutaveis. Crie uma nova migration numerada, como 0002.",
          ].join(" "),
        );
      }
    }
  } finally {
    db.close();
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  await migrateLocalDatabase();
}
