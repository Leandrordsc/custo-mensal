import assert from "node:assert/strict";
import test from "node:test";
import { assertNoReversalCycle } from "../lib/reversal-rules.ts";

test("reversal rules rejeitam autorreferencia", () => {
  assert.throws(
    () => assertNoReversalCycle({ id: "tx_a", reversalTransactionId: "tx_a" }, []),
    /si propria/,
  );
});

test("reversal rules rejeitam alvo inexistente ou ids invalidos", () => {
  assert.throws(
    () => assertNoReversalCycle({ id: "", reversalTransactionId: "tx_b" }, [{ id: "tx_b", reversalTransactionId: null }]),
    /possuir id/,
  );
  assert.throws(
    () => assertNoReversalCycle({ id: "tx_a", reversalTransactionId: "tx_missing" }, []),
    /nao existe/,
  );
  assert.throws(
    () => assertNoReversalCycle(
      { id: "tx_a", reversalTransactionId: "tx_b" },
      [
        { id: "tx_b", reversalTransactionId: null },
        { id: "tx_b", reversalTransactionId: null },
      ],
    ),
    /duplicados/,
  );
});

test("reversal rules rejeitam ciclo direto", () => {
  assert.throws(
    () => assertNoReversalCycle(
      { id: "tx_a", reversalTransactionId: "tx_b" },
      [{ id: "tx_b", reversalTransactionId: "tx_a" }],
    ),
    /Ciclo de reversao/,
  );
});

test("reversal rules rejeitam ciclo maior que dois registros", () => {
  assert.throws(
    () => assertNoReversalCycle(
      { id: "tx_a", reversalTransactionId: "tx_b" },
      [
        { id: "tx_b", reversalTransactionId: "tx_c" },
        { id: "tx_c", reversalTransactionId: "tx_a" },
      ],
    ),
    /Ciclo de reversao/,
  );
});

test("reversal rules aceitam cadeia sem ciclo", () => {
  assert.doesNotThrow(() => assertNoReversalCycle(
    { id: "tx_a", reversalTransactionId: "tx_b" },
    [
      { id: "tx_b", reversalTransactionId: "tx_c" },
      { id: "tx_c", reversalTransactionId: null },
    ],
  ));
});
