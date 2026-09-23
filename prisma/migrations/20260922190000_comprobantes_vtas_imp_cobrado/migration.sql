-- Monto ya cobrado del comprobante (saldo pendiente = imp_total − imp_cobrado).

ALTER TABLE "comprobantes_vtas"
  ADD COLUMN IF NOT EXISTS "imp_cobrado" DECIMAL(14, 2) NOT NULL DEFAULT 0;
