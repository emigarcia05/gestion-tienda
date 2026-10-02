-- Centraliza cobros de factura en tesoreria_movimientos y elimina comprobantes_vtas_cobros.

ALTER TABLE "tesoreria_movimientos"
  ALTER COLUMN "caja_id" DROP NOT NULL;

ALTER TABLE "tesoreria_movimientos"
  ADD COLUMN IF NOT EXISTS "comprobante_id" TEXT,
  ADD COLUMN IF NOT EXISTS "orden" INTEGER,
  ADD COLUMN IF NOT EXISTS "cliente_cobro_id" TEXT,
  ADD COLUMN IF NOT EXISTS "nota_credito_id" TEXT;

CREATE INDEX IF NOT EXISTS "tesoreria_movimientos_comprobante_idx"
  ON "tesoreria_movimientos"("comprobante_id");
CREATE INDEX IF NOT EXISTS "tesoreria_movimientos_cliente_cobro_idx"
  ON "tesoreria_movimientos"("cliente_cobro_id");
CREATE INDEX IF NOT EXISTS "tesoreria_movimientos_nota_credito_idx"
  ON "tesoreria_movimientos"("nota_credito_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tesoreria_movimientos_comprobante_id_fkey'
  ) THEN
    ALTER TABLE "tesoreria_movimientos"
      ADD CONSTRAINT "tesoreria_movimientos_comprobante_id_fkey"
      FOREIGN KEY ("comprobante_id") REFERENCES "comprobantes_vtas"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tesoreria_movimientos_cliente_cobro_id_fkey'
  ) THEN
    ALTER TABLE "tesoreria_movimientos"
      ADD CONSTRAINT "tesoreria_movimientos_cliente_cobro_id_fkey"
      FOREIGN KEY ("cliente_cobro_id") REFERENCES "clientes_cobros"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tesoreria_movimientos_nota_credito_id_fkey'
  ) THEN
    ALTER TABLE "tesoreria_movimientos"
      ADD CONSTRAINT "tesoreria_movimientos_nota_credito_id_fkey"
      FOREIGN KEY ("nota_credito_id") REFERENCES "comprobantes_vtas"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

ALTER TABLE "tesoreria_movimientos" DROP CONSTRAINT IF EXISTS "tesoreria_movimientos_cobro_chk";
ALTER TABLE "tesoreria_movimientos" DROP CONSTRAINT IF EXISTS "tesoreria_movimientos_caja_requerida_chk";
ALTER TABLE "tesoreria_movimientos" DROP CONSTRAINT IF EXISTS "tesoreria_movimientos_transferencia_chk";

ALTER TABLE "tesoreria_movimientos"
  ADD CONSTRAINT "tesoreria_movimientos_caja_requerida_chk" CHECK (
    ("caja_id" IS NOT NULL)
    OR ("cat_movimiento" = 'NOTA_CREDITO' AND "nota_credito_id" IS NOT NULL)
  ),
  ADD CONSTRAINT "tesoreria_movimientos_cobro_chk" CHECK (
    (
      "cat_movimiento" = 'COBRO'
      AND "pago_id" IS NOT NULL
      AND "caja_id" IS NOT NULL
    )
    OR (
      "cat_movimiento" = 'NOTA_CREDITO'
      AND (
        ("pago_id" IS NOT NULL AND "caja_id" IS NOT NULL)
        OR ("nota_credito_id" IS NOT NULL AND "pago_id" IS NULL AND "caja_id" IS NULL
            AND "entidad_id" IS NULL AND "cuota_id" IS NULL AND "cx_fin_id" IS NULL)
      )
    )
    OR (
      "cat_movimiento" NOT IN ('COBRO', 'NOTA_CREDITO')
      AND "pago_id" IS NULL
      AND "entidad_id" IS NULL
      AND "cuota_id" IS NULL
      AND "cx_fin_id" IS NULL
      AND "comprobante_id" IS NULL
      AND "cliente_cobro_id" IS NULL
      AND "nota_credito_id" IS NULL
      AND "orden" IS NULL
    )
  ),
  ADD CONSTRAINT "tesoreria_movimientos_transferencia_chk" CHECK (
    (
      "cat_movimiento" = 'TRANSFERENCIA_ENTRE_CAJAS'
      AND "transferencia_grupo_id" IS NOT NULL
      AND "caja_contraparte_id" IS NOT NULL
      AND "caja_id" IS NOT NULL
      AND "caja_contraparte_id" <> "caja_id"
    )
    OR (
      "cat_movimiento" <> 'TRANSFERENCIA_ENTRE_CAJAS'
      AND "transferencia_grupo_id" IS NULL
      AND "caja_contraparte_id" IS NULL
    )
  );

-- Backup de filas legacy antes de migrar/borrar
CREATE TABLE IF NOT EXISTS "_backup_comprobantes_vtas_cobros_20261002" AS
SELECT * FROM "comprobantes_vtas_cobros";

-- Cobros con caja resoluble
INSERT INTO "tesoreria_movimientos" (
  "id", "caja_id", "tipo_movimiento", "cat_movimiento", "monto", "fecha", "observacion",
  "pago_id", "entidad_id", "cuota_id", "cx_fin_id", "sucursal_id", "personal_id",
  "comprobante_id", "orden", "cliente_cobro_id", "created_at", "updated_at"
)
SELECT
  c."id",
  vinc."caja_destino_id",
  'INGRESO'::"SentidoMovimientoTesoreria",
  'COBRO'::"CategoriaMovimientoTesoreria",
  GREATEST(1, ROUND(c."monto_cents" / 100.0)::int),
  cv."fecha",
  'Migrado desde comprobantes_vtas_cobros',
  p."id",
  e."id",
  cu."id",
  (
    SELECT cx."id" FROM "cobros_cx_fin" cx
    WHERE cx."pago_id" = p."id"
      AND cx."terminal_id" IS NOT DISTINCT FROM e."id"
      AND cx."cuota_id" IS NOT DISTINCT FROM cu."id"
    LIMIT 1
  ),
  COALESCE(caja."sucursal_id", suc_pers."id", (
    SELECT s."id" FROM "sucursales" s ORDER BY s."codigo" ASC LIMIT 1
  )),
  cv."personal_id",
  c."comprobante_id",
  c."orden",
  c."cliente_cobro_id",
  c."created_at",
  c."created_at"
FROM "comprobantes_vtas_cobros" c
JOIN "comprobantes_vtas" cv ON cv."id" = c."comprobante_id"
JOIN "cobros_forma_pago" p ON upper(trim(p."nombre")) = upper(trim(c."pago_nombre"))
LEFT JOIN "cobros_entidades" e
  ON nullif(trim(c."entidad_nombre"), '') IS NOT NULL
 AND upper(trim(e."nombre")) = upper(trim(c."entidad_nombre"))
LEFT JOIN "cobros_cuotas" cu
  ON nullif(trim(c."cuota_etiqueta"), '') IS NOT NULL
 AND upper(trim(cu."cuotas")) = upper(trim(c."cuota_etiqueta"))
LEFT JOIN "personal" per ON per."id_personal" = cv."personal_id"
LEFT JOIN "sucursales" suc_pers ON suc_pers."codigo" = per."sucursal_por_defecto"
LEFT JOIN LATERAL (
  SELECT v."caja_destino_id", v."sucursal_id"
  FROM "cobros_vinc_cajas" v
  WHERE v."pago_id" = p."id"
    AND v."entidad_id" IS NOT DISTINCT FROM e."id"
    AND v."caja_destino_id" IS NOT NULL
  ORDER BY CASE WHEN suc_pers."id" IS NOT NULL AND v."sucursal_id" = suc_pers."id" THEN 0 ELSE 1 END
  LIMIT 1
) vinc ON true
LEFT JOIN "tesoreria_cajas" caja ON caja."id" = vinc."caja_destino_id"
WHERE upper(trim(c."pago_nombre")) NOT IN ('NOTA DE CRÉDITO', 'NOTA DE CREDITO')
  AND vinc."caja_destino_id" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "tesoreria_movimientos" tm WHERE tm."id" = c."id");

-- Imputaciones NC
INSERT INTO "tesoreria_movimientos" (
  "id", "caja_id", "tipo_movimiento", "cat_movimiento", "monto", "fecha", "observacion",
  "pago_id", "sucursal_id", "personal_id", "comprobante_id", "orden", "nota_credito_id",
  "created_at", "updated_at"
)
SELECT
  c."id",
  NULL,
  'EGRESO'::"SentidoMovimientoTesoreria",
  'NOTA_CREDITO'::"CategoriaMovimientoTesoreria",
  GREATEST(1, ROUND(c."monto_cents" / 100.0)::int),
  cv."fecha",
  'Migrado imputación NC ' || trim(c."entidad_nombre"),
  NULL,
  COALESCE(suc_pers."id", (SELECT s."id" FROM "sucursales" s ORDER BY s."codigo" ASC LIMIT 1)),
  cv."personal_id",
  c."comprobante_id",
  c."orden",
  nc."id",
  c."created_at",
  c."created_at"
FROM "comprobantes_vtas_cobros" c
JOIN "comprobantes_vtas" cv ON cv."id" = c."comprobante_id"
LEFT JOIN "personal" per ON per."id_personal" = cv."personal_id"
LEFT JOIN "sucursales" suc_pers ON suc_pers."codigo" = per."sucursal_por_defecto"
JOIN "comprobantes_vtas" nc
  ON nc."tipo_comprobante" IN ('nota_credito_fiscal', 'nota_credito_no_fiscal')
 AND (
   trim(c."entidad_nombre") = (lpad(nc."pto_venta", 5, '0') || '-' || lpad(nc."cbte_nro"::text, 8, '0'))
   OR trim(c."entidad_nombre") = (nc."pto_venta" || '-' || nc."cbte_nro"::text)
 )
WHERE upper(trim(c."pago_nombre")) IN ('NOTA DE CRÉDITO', 'NOTA DE CREDITO')
  AND NOT EXISTS (SELECT 1 FROM "tesoreria_movimientos" tm WHERE tm."id" = c."id");

DROP TABLE IF EXISTS "comprobantes_vtas_cobros";
