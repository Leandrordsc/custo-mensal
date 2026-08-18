import crypto from "node:crypto";

export type PaymentMethod = "CONTA" | "CARTAO";
export type ExpenseClassificationStatus = "CONFIRMADO" | "PENDENTE_REVISAO";

export type ExpenseInput = {
  description: string;
  amount: string;
  date: string;
  competenceMonth: string;
  categoryId: string;
  paymentMethod: PaymentMethod;
  accountId?: string | null;
  cardId?: string | null;
  notes?: string | null;
  classificationStatus: ExpenseClassificationStatus;
  isInstallment: boolean;
  installments: number;
};

export type NormalizedExpenseInput = Omit<ExpenseInput, "amount" | "installments"> & {
  amountCents: number;
  installments: number;
};

export type GeneratedInstallment = {
  installmentNumber: number;
  totalInstallments: number;
  competenceMonth: string;
  amountCents: number;
};

export function normalizeExpenseInput(input: ExpenseInput): NormalizedExpenseInput {
  const description = requiredText(input.description, "descricao");
  const date = requiredDate(input.date, "data");
  const competenceMonth = requiredMonth(input.competenceMonth, "competencia");
  const categoryId = requiredText(input.categoryId, "categoria");
  const amountCents = parseBrlToCents(input.amount);
  const installments = input.isInstallment ? assertPositiveInteger(input.installments, "parcelas") : 1;

  if (input.paymentMethod !== "CONTA" && input.paymentMethod !== "CARTAO") {
    throw new Error("Meio de pagamento invalido.");
  }

  if (input.paymentMethod === "CONTA" && !input.accountId?.trim()) {
    throw new Error("Conta obrigatoria para despesa em conta.");
  }

  if (input.paymentMethod === "CARTAO" && !input.cardId?.trim()) {
    throw new Error("Cartao obrigatorio para despesa no cartao.");
  }

  if (input.classificationStatus !== "CONFIRMADO" && input.classificationStatus !== "PENDENTE_REVISAO") {
    throw new Error("Estado da classificacao invalido para despesa manual.");
  }

  return {
    ...input,
    description,
    date,
    competenceMonth,
    categoryId,
    accountId: input.accountId?.trim() || null,
    cardId: input.cardId?.trim() || null,
    notes: input.notes?.trim() || null,
    amountCents,
    installments,
  };
}

export function parseBrlToCents(value: string) {
  const normalized = value.trim().replace(/\s/g, "").replace(/^R\$/i, "");

  if (!/^\d{1,12}([,.]\d{1,2})?$/.test(normalized)) {
    throw new Error("Valor deve estar em reais, como 123,45.");
  }

  const [reais, cents = ""] = normalized.replace(",", ".").split(".");
  return Number.parseInt(reais, 10) * 100 + Number.parseInt(cents.padEnd(2, "0"), 10);
}

export function generateInstallments(totalAmountCents: number, totalInstallments: number, firstCompetenceMonth: string): GeneratedInstallment[] {
  assertSafeCents(totalAmountCents, "valor total");
  assertPositiveInteger(totalInstallments, "parcelas");
  requiredMonth(firstCompetenceMonth, "competencia inicial");

  const base = Math.floor(totalAmountCents / totalInstallments);
  const remainder = totalAmountCents % totalInstallments;

  return Array.from({ length: totalInstallments }, (_, index) => ({
    installmentNumber: index + 1,
    totalInstallments,
    competenceMonth: addMonths(firstCompetenceMonth, index),
    amountCents: base + (index < remainder ? 1 : 0),
  }));
}

export function addMonths(month: string, offset: number) {
  requiredMonth(month, "competencia");
  const [year, monthNumber] = month.split("-").map(Number);
  const zeroBased = monthNumber - 1 + offset;
  const nextYear = year + Math.floor(zeroBased / 12);
  const nextMonth = (zeroBased % 12) + 1;
  return `${nextYear}-${String(nextMonth).padStart(2, "0")}`;
}

export function createId(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`;
}

export function nowIso() {
  return new Date().toISOString();
}

function requiredText(value: string | null | undefined, field: string) {
  const text = value?.trim();
  if (!text) {
    throw new Error(`${field} obrigatorio.`);
  }
  return text;
}

function requiredDate(value: string, field: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`${field} deve usar formato YYYY-MM-DD.`);
  }
  return value;
}

function requiredMonth(value: string, field: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) {
    throw new Error(`${field} deve usar formato YYYY-MM.`);
  }
  return value;
}

function assertPositiveInteger(value: number, field: string) {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error(`${field} deve ser inteiro maior ou igual a 1.`);
  }
  return value;
}

function assertSafeCents(value: number, field: string) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${field} deve ser inteiro em centavos maior ou igual a zero.`);
  }
}
