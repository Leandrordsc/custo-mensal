export type ReversalLink = {
  id: string;
  reversalTransactionId: string | null;
};

export function assertNoReversalCycle(candidate: ReversalLink, existing: ReversalLink[]) {
  if (!candidate.id.trim()) {
    throw new Error("Transacao candidata deve possuir id.");
  }

  if (!candidate.reversalTransactionId) {
    return;
  }

  if (candidate.id === candidate.reversalTransactionId) {
    throw new Error("Transacao nao pode referenciar a si propria como reversao.");
  }

  const links = new Map<string, string | null>();

  for (const transaction of existing) {
    if (!transaction.id.trim()) {
      throw new Error("Transacao existente deve possuir id.");
    }

    if (links.has(transaction.id)) {
      throw new Error("Lista de reversoes contem ids duplicados.");
    }

    links.set(transaction.id, transaction.reversalTransactionId);
  }

  if (!links.has(candidate.reversalTransactionId)) {
    throw new Error("Transacao de reversao referenciada nao existe no conjunto validado.");
  }

  links.set(candidate.id, candidate.reversalTransactionId);

  const visited = new Set<string>();
  let current: string | null | undefined = candidate.id;

  while (current) {
    if (visited.has(current)) {
      throw new Error("Ciclo de reversao detectado.");
    }

    visited.add(current);
    current = links.get(current);
  }
}
