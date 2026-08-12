import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const databasePath = process.env.LOCAL_DATABASE_PATH ?? "./data/custo-mensal.local.sqlite";
const databaseDir = dirname(resolve(process.cwd(), databasePath));

await mkdir(databaseDir, { recursive: true });
