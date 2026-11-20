-- Collision-free invoice numbers.
-- The old scheme (count() + 1 computed inside the completion transaction)
-- let two concurrent COMPLETED transitions derive the same number; the loser
-- hit invoiceNumber @unique and the WHOLE completion tx aborted (table-free,
-- cash-SUCCESS, status change all rolled back).
-- A sequence hands out unique numbers atomically without serializing the
-- transactions. It continues after any existing INV-#### numbers.

CREATE SEQUENCE IF NOT EXISTS "InvoiceInvoiceNumberSeq" AS BIGINT START 1;

SELECT setval(
  '"InvoiceInvoiceNumberSeq"',
  GREATEST(
    COALESCE(
      (SELECT MAX(SUBSTRING("invoiceNumber" FROM 'INV-([0-9]+)')::bigint)
       FROM "Invoice"),
      0
    ),
    0
  ) + 1,
  false
);
