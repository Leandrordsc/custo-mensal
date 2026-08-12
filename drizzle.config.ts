import { defineConfig } from "drizzle-kit";

const localDatabasePath = process.env.LOCAL_DATABASE_PATH ?? "./data/custo-mensal.local.sqlite";

export default defineConfig({
  out: "./drizzle",
  schema: "./db/schema.ts",
  dialect: "sqlite",
  dbCredentials: {
    url: localDatabasePath,
  },
});
