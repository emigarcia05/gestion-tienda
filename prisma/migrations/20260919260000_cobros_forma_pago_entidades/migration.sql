-- N:M `cobros_forma_pago` ↔ `tesoreria_cobros_entidades` (mín. 1 entidad por forma de pago en app).

CREATE TABLE IF NOT EXISTS "cobros_forma_pago_entidades" (
  "pago_id" TEXT NOT NULL,
  "entidad_id" TEXT NOT NULL,
  CONSTRAINT "cobros_forma_pago_entidades_pkey" PRIMARY KEY ("pago_id", "entidad_id"),
  CONSTRAINT "cobros_forma_pago_entidades_pago_id_fkey"
    FOREIGN KEY ("pago_id") REFERENCES "cobros_forma_pago"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "cobros_forma_pago_entidades_entidad_id_fkey"
    FOREIGN KEY ("entidad_id") REFERENCES "tesoreria_cobros_entidades"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "cobros_forma_pago_entidades_entidad_id_idx"
  ON "cobros_forma_pago_entidades" ("entidad_id");

-- Backfill desde la matriz de costos (pares ya usados).
INSERT INTO "cobros_forma_pago_entidades" ("pago_id", "entidad_id")
SELECT DISTINCT f."pago_id", f."terminal_id"
FROM "fin_ana_cos_fina" f
ON CONFLICT DO NOTHING;

-- Pagos sin ningún vínculo: asociar todas las entidades existentes.
INSERT INTO "cobros_forma_pago_entidades" ("pago_id", "entidad_id")
SELECT p."id", e."id"
FROM "cobros_forma_pago" p
CROSS JOIN "tesoreria_cobros_entidades" e
WHERE NOT EXISTS (
  SELECT 1
  FROM "cobros_forma_pago_entidades" x
  WHERE x."pago_id" = p."id"
)
ON CONFLICT DO NOTHING;
