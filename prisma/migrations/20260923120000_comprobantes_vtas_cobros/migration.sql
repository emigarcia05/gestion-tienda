-- Líneas de cobro del modal post-emisión (no tesorería).

CREATE TABLE IF NOT EXISTS "comprobantes_vtas_cobros" (
  "id" TEXT NOT NULL,
  "comprobante_id" TEXT NOT NULL,
  "orden" INTEGER NOT NULL,
  "pago_nombre" TEXT NOT NULL,
  "entidad_nombre" TEXT NOT NULL DEFAULT '',
  "cuota_etiqueta" TEXT,
  "monto_cents" INTEGER NOT NULL,
  "es_cuenta_corriente" BOOLEAN NOT NULL DEFAULT false,
  "plazo_dias" INTEGER,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "comprobantes_vtas_cobros_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'comprobantes_vtas_cobros_comprobante_id_fkey'
  ) THEN
    ALTER TABLE "comprobantes_vtas_cobros"
      ADD CONSTRAINT "comprobantes_vtas_cobros_comprobante_id_fkey"
      FOREIGN KEY ("comprobante_id") REFERENCES "comprobantes_vtas"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "comprobantes_vtas_cobros_comp_idx"
  ON "comprobantes_vtas_cobros" ("comprobante_id");
