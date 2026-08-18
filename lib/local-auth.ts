import { requireAuthenticatedUser, type AuthenticatedUserContext } from "./auth-context.ts";

export const defaultLocalUserId = "local-user";

export function getLocalAuthenticatedUser(env: NodeJS.ProcessEnv = process.env): AuthenticatedUserContext {
  return requireAuthenticatedUser({ userId: env.LOCAL_USER_ID ?? defaultLocalUserId });
}
