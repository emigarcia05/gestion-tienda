-- Facturación ARCA (WSFEv1): comprobantes, líneas, intentos y tickets WSAA.
-- Receptor fiscal = snapshot en fact_comprobantes (no altera `clientes` de Envios).

CREATE TABLE "fact_comprobantes" (
  "id" TEXT NOT NULL,
  "tipo_local" VARCHAR(32) NOT NULL,
  "cbte_tipo" INTEGER,
  "letra" CHAR(1),
  "pto_vta_id" TEXT NOT NULL,
  "pto_venta" CHAR(5) NOT NULL,
  "cbte_nro" INTEGER,
  "fecha" DATE NOT NULL,
  "concepto" VARCHAR(8) NOT NULL DEFAULT '1',
  "moneda" VARCHAR(8) NOT NULL DEFAULT 'PES',
  "cotizacion" DECIMAL(14,6) NOT NULL DEFAULT 1,
  "receptor_nombre" TEXT NOT NULL,
  "receptor_doc_tipo" INTEGER,
  "receptor_doc_nro" VARCHAR(20),
  "receptor_condicion_iva" INTEGER,
  "imp_neto" DECIMAL(14,2) NOT NULL,
  "imp_iva" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "imp_exento" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "imp_tot_conc" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "imp_trib" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "imp_op_ex" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "imp_total" DECIMAL(14,2) NOT NULL,
  "desc_pct" DECIMAL(5,2) NOT NULL DEFAULT 0,
  "desc_importe" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "cae" VARCHAR(14),
  "cae_vto" DATE,
  "resultado" CHAR(1),
  "observaciones_arca" TEXT,
  "ambiente" VARCHAR(8) NOT NULL,
  "comentarios" TEXT NOT NULL DEFAULT '',
  "estado" VARCHAR(16) NOT NULL,
  "cbte_asoc_id" TEXT,
  "cbte_asoc_tipo" INTEGER,
  "cbte_asoc_pto_vta" INTEGER,
  "cbte_asoc_nro" INTEGER,
  "cbte_asoc_cae" VARCHAR(14),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "fact_comprobantes_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "fact_comprobantes"
  ADD CONSTRAINT "fact_comprobantes_tipo_local_chk"
  CHECK ("tipo_local" IN ('presupuesto', 'factura', 'factura_fiscal', 'nota_credito'));

ALTER TABLE "fact_comprobantes"
  ADD CONSTRAINT "fact_comprobantes_estado_chk"
  CHECK ("estado" IN ('borrador', 'autorizado', 'rechazado'));

ALTER TABLE "fact_comprobantes"
  ADD CONSTRAINT "fact_comprobantes_ambiente_chk"
  CHECK ("ambiente" IN ('homo', 'prod'));

ALTER TABLE "fact_comprobantes"
  ADD CONSTRAINT "fact_comprobantes_resultado_chk"
  CHECK ("resultado" IS NULL OR "resultado" IN ('A', 'R', 'P'));

CREATE TABLE "fact_comprobante_lineas" (
  "id" TEXT NOT NULL,
  "comprobante_id" TEXT NOT NULL,
  "orden" INTEGER NOT NULL,
  "cod_tienda" TEXT NOT NULL,
  "descripcion" TEXT NOT NULL,
  "cantidad" DECIMAL(12,4) NOT NULL,
  "px" DECIMAL(14,2) NOT NULL,
  "descuento_pct" DECIMAL(5,2) NOT NULL DEFAULT 0,
  "alicuota_iva" DECIMAL(5,2) NOT NULL,
  "iva_id" INTEGER NOT NULL,
  "importe" DECIMAL(14,2) NOT NULL,
  "comentario" TEXT NOT NULL DEFAULT '',

  CONSTRAINT "fact_comprobante_lineas_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "fact_comprobante_intentos" (
  "id" TEXT NOT NULL,
  "comprobante_id" TEXT NOT NULL,
  "request_id" TEXT NOT NULL,
  "operacion" VARCHAR(64) NOT NULL,
  "resultado" VARCHAR(8),
  "errores" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "fact_comprobante_intentos_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "arca_wsaa_tickets" (
  "id" TEXT NOT NULL,
  "cuit" VARCHAR(11) NOT NULL,
  "servicio" VARCHAR(32) NOT NULL,
  "ambiente" VARCHAR(8) NOT NULL,
  "token" TEXT NOT NULL,
  "sign" TEXT NOT NULL,
  "expiration" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "arca_wsaa_tickets_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "arca_wsaa_tickets"
  ADD CONSTRAINT "arca_wsaa_tickets_ambiente_chk"
  CHECK ("ambiente" IN ('homo', 'prod'));

ALTER TABLE "fact_comprobantes"
  ADD CONSTRAINT "fact_comprobantes_pto_vta_id_fkey"
  FOREIGN KEY ("pto_vta_id") REFERENCES "ptos_vtas"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "fact_comprobantes"
  ADD CONSTRAINT "fact_comprobantes_receptor_iva_fkey"
  FOREIGN KEY ("receptor_condicion_iva") REFERENCES "pto_ventas_cod_arca"("codigo")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "fact_comprobantes"
  ADD CONSTRAINT "fact_comprobantes_cbte_asoc_id_fkey"
  FOREIGN KEY ("cbte_asoc_id") REFERENCES "fact_comprobantes"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "fact_comprobante_lineas"
  ADD CONSTRAINT "fact_comprobante_lineas_comprobante_id_fkey"
  FOREIGN KEY ("comprobante_id") REFERENCES "fact_comprobantes"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "fact_comprobante_intentos"
  ADD CONSTRAINT "fact_comprobante_intentos_comprobante_id_fkey"
  FOREIGN KEY ("comprobante_id") REFERENCES "fact_comprobantes"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "fact_comprobantes_tipo_fecha_idx"
  ON "fact_comprobantes"("tipo_local", "fecha" DESC);

CREATE INDEX "fact_comprobantes_pto_vta_idx"
  ON "fact_comprobantes"("pto_vta_id");

CREATE INDEX "fact_comprobantes_cae_idx"
  ON "fact_comprobantes"("cae");

CREATE INDEX "fact_comprobantes_receptor_iva_idx"
  ON "fact_comprobantes"("receptor_condicion_iva");

CREATE INDEX "fact_comprobante_lineas_comp_idx"
  ON "fact_comprobante_lineas"("comprobante_id");

CREATE INDEX "fact_comprobante_intentos_comp_idx"
  ON "fact_comprobante_intentos"("comprobante_id");

CREATE UNIQUE INDEX "arca_wsaa_tickets_cuit_serv_amb_key"
  ON "arca_wsaa_tickets"("cuit", "servicio", "ambiente");

-- Numeración fiscal autorizada: no duplicar CAE / nro en el mismo ambiente.
CREATE UNIQUE INDEX "fact_comprobantes_fiscal_nro_key"
  ON "fact_comprobantes"("ambiente", "cbte_tipo", "pto_venta", "cbte_nro")
  WHERE "cbte_nro" IS NOT NULL AND "cae" IS NOT NULL AND "cbte_tipo" IS NOT NULL;
