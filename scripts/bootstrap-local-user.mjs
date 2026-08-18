import { bootstrapLocalUser } from "../lib/local-bootstrap.ts";
import { getLocalAuthenticatedUser } from "../lib/local-auth.ts";
import { getLocalDatabasePath, openLocalDatabase } from "../lib/local-db.ts";

const databasePath = getLocalDatabasePath();
const db = openLocalDatabase(databasePath);

try {
  const context = getLocalAuthenticatedUser();
  bootstrapLocalUser(db, context);
  console.log(`Usuario local pronto: ${context.userId}`);
  console.log(`Banco: ${databasePath}`);
} finally {
  db.close();
}
