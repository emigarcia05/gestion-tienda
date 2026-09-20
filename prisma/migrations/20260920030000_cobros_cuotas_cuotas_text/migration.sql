-- cobros_cuotas: drop `orden`; `cantidad` (int) → `cuotas` (text libre, unique).
-- Valores numéricos existentes se normalizan a texto con cero a la izquierda (1 → 01).

DROP INDEX IF EXISTS "cobros_cuotas_orden_idx";
ALTER TABLE "cobros_cuotas" DROP COLUMN IF EXISTS "orden";

DROP INDEX IF EXISTS "cobros_cuotas_cantidad_key";

ALTER TABLE "cobros_cuotas"
  ALTER COLUMN "cantidad" TYPE TEXT
  USING (
    CASE
      WHEN "cantidad" < 10 THEN lpad("cantidad"::text, 2, '0')
      ELSE "cantidad"::text
    END
  );

ALTER TABLE "cobros_cuotas" RENAME COLUMN "cantidad" TO "cuotas";

CREATE UNIQUE INDEX IF NOT EXISTS "cobros_cuotas_cuotas_key"
  ON "cobros_cuotas" ("cuotas");
