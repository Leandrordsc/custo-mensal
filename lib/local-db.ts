import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

export function getLocalDatabasePath(env: NodeJS.ProcessEnv = process.env) {
  return resolve(process.cwd(), env.LOCAL_DATABASE_PATH ?? "./data/custo-mensal.local.sqlite");
}

export function openLocalDatabase(databasePath = getLocalDatabasePath()) {
  mkdirSync(dirname(databasePath), { recursive: true });
  const db = new DatabaseSync(databasePath);
  db.exec("PRAGMA foreign_keys = ON");
  return db;
}
