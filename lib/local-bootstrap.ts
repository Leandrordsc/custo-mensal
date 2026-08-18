import type { DatabaseSync } from "node:sqlite";
import type { AuthenticatedUserContext } from "./auth-context.ts";
import { requireAuthenticatedUser } from "./auth-context.ts";
import { nowIso } from "./expense-domain.ts";

export function bootstrapLocalUser(db: DatabaseSync, context: AuthenticatedUserContext) {
  const { userId } = requireAuthenticatedUser(context);
  const timestamp = nowIso();
  const prefix = localIdPrefix(userId);

  db.exec("BEGIN IMMEDIATE");
  try {
    db.prepare(`
      insert into users (id, email, name, created_at, updated_at)
      values (?, ?, ?, ?, ?)
      on conflict(id) do update set updated_at = excluded.updated_at
    `).run(userId, `${prefix}@local.invalid`, "Usuario local", timestamp, timestamp);

    for (const [slug, name] of [
      ["moradia", "Moradia"],
      ["alimentacao", "Alimentacao"],
      ["transporte", "Transporte"],
      ["saude", "Saude"],
      ["lazer", "Lazer"],
      ["outros", "Outros"],
    ]) {
      db.prepare(`
        insert into categories (id, user_id, name, counts_as_living_cost, active)
        values (?, ?, ?, 1, 1)
        on conflict(user_id, name) do update set active = 1
      `).run(`${prefix}_category_${slug}`, userId, name);
    }

    db.prepare(`
      insert into accounts (id, user_id, name, account_type, currency, opening_balance_cents, balance_date, active)
      values (?, ?, 'Conta principal', 'CONTA', 'BRL', 0, '2026-01-01', 1)
      on conflict(user_id, name) do update set active = 1
    `).run(`${prefix}_account_principal`, userId);

    for (const card of [
      ["btg", "BTG", "BTG", 20, 10, 100],
      ["mercado_pago", "Mercado Pago", "Mercado Pago", 15, 5, 50],
    ] as const) {
      const cardId = `${prefix}_card_${card[0]}`;
      db.prepare(`
        insert into cards (id, user_id, name, issuer, status, closing_day, due_day)
        values (?, ?, ?, ?, 'ATIVO', ?, ?)
        on conflict(user_id, name) do update set status = 'ATIVO'
      `).run(cardId, userId, card[1], card[2], card[3], card[4]);

      db.prepare(`
        insert into card_rules (id, user_id, card_id, cashback_rate_bps, valid_from, valid_to)
        values (?, ?, ?, ?, '2026-01-01', null)
        on conflict(id) do update set cashback_rate_bps = excluded.cashback_rate_bps
      `).run(`${cardId}_cashback_rule`, userId, cardId, card[5]);
    }

    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

function localIdPrefix(userId: string) {
  return userId.replace(/[^a-zA-Z0-9_]/g, "_");
}
