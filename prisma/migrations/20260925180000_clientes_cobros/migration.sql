-- Cobro de cuenta corriente a nivel cliente (anticipo / pago a aplicar).

CREATE TABLE IF NOT EXISTS "clientes_cobros" (
  "id" TEXT NOT NULL,
  "cliente_id" TEXT NOT NULL,
  "pago_nombre" TEXT NOT NULL,
  "entidad_nombre" TEXT NOT NULL DEFAULT '',
  "cuota_etiqueta" TEXT,
  "monto_cents" INTEGER NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "clientes_cobros_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'clientes_cobros_cliente_id_fkey'
  ) THEN
    ALTER TABLE "clientes_cobros"
      ADD CONSTRAINT "clientes_cobros_cliente_id_fkey"
      FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "clientes_cobros_cliente_id_idx"
  ON "clientes_cobros" ("cliente_id");

ALTER TABLE "comprobantes_vtas_cobros"
  ADD COLUMN IF NOT EXISTS "cliente_cobro_id" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'comprobantes_vtas_cobros_cliente_cobro_id_fkey'
  ) THEN
    ALTER TABLE "comprobantes_vtas_cobros"
      ADD CONSTRAINT "comprobantes_vtas_cobros_cliente_cobro_id_fkey"
      FOREIGN KEY ("cliente_cobro_id") REFERENCES "clientes_cobros"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "comprobantes_vtas_cobros_cliente_cobro_idx"
  ON "comprobantes_vtas_cobros" ("cliente_cobro_id");
