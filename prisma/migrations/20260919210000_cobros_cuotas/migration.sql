-- Catálogo de cuotas Cx. Fin. Cobros / cobros

CREATE TABLE IF NOT EXISTS "cobros_cuotas" (
  "id" TEXT NOT NULL,
  "cantidad" INTEGER NOT NULL,
  "orden" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "cobros_cuotas_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "cobros_cuotas_cantidad_key" ON "cobros_cuotas"("cantidad");
CREATE INDEX IF NOT EXISTS "cobros_cuotas_orden_idx" ON "cobros_cuotas"("orden");

-- Semilla base (idempotente)
INSERT INTO "cobros_cuotas" ("id", "cantidad", "orden", "created_at", "updated_at")
SELECT v.id, v.cantidad, v.orden, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM (
  VALUES
    ('cmtcuota000000000000000001', 1, 1),
    ('cmtcuota000000000000000003', 3, 2),
    ('cmtcuota000000000000000006', 6, 3),
    ('cmtcuota000000000000000009', 9, 4),
    ('cmtcuota000000000000000012', 12, 5),
    ('cmtcuota000000000000000018', 18, 6)
) AS v(id, cantidad, orden)
WHERE NOT EXISTS (
  SELECT 1 FROM "cobros_cuotas" c WHERE c."cantidad" = v.cantidad
);
