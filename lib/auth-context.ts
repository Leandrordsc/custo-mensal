export type AuthenticatedUserContext = {
  userId: string;
};

export function requireAuthenticatedUser(context: AuthenticatedUserContext | null | undefined): AuthenticatedUserContext {
  const userId = context?.userId?.trim();

  if (!userId) {
    throw new Error("Usuario autenticado obrigatorio para acessar dados financeiros.");
  }

  return { userId };
}
