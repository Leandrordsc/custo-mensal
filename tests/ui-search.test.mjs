import assert from "node:assert/strict";
import test from "node:test";
import { matchesSearch } from "../lib/ui-search.ts";

test("busca vazia preserva todas as linhas", () => {
  assert.equal(matchesSearch("   ", ["Conta de luz"]), true);
});

test("busca ignora caixa, acentos e espacos repetidos", () => {
  assert.equal(matchesSearch("  CARTAO   historico ", ["Cartao", "Histórico"]), true);
});

test("busca usa substring e exige todos os termos", () => {
  assert.equal(matchesSearch("mxr fii", ["MXRF11", "FII", "BRL"]), true);
  assert.equal(matchesSearch("mxr usd", ["MXRF11", "FII", "BRL"]), false);
});

test("busca aceita valores ausentes e nao textuais", () => {
  assert.equal(matchesSearch("2026", [null, undefined, 2026, false]), true);
  assert.equal(matchesSearch("ausente", [null, undefined]), false);
});

test("busca normaliza espaco inquebravel e caracteres de compatibilidade", () => {
  assert.equal(matchesSearch("fi 11", ["FI\u00a011"]), true);
  assert.equal(matchesSearch("ffi", ["ＦＦＩ"]), true);
});
