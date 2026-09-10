-- Líneas de cobranza DUX (GET /v2/cobros). Unique (id_cobro, linea) evita duplicados
-- al reconsultar el último día persistido.

CREATE TABLE IF NOT EXISTS "fin_vtas_cobros" (
  "id" TEXT NOT NULL,
  "id_cobro" BIGINT NOT NULL,
  "id_sucursal" INTEGER NOT NULL,
  "fecha" DATE NOT NULL,
  "descripcion" VARCHAR(500) NOT NULL DEFAULT '',
  "monto" DECIMAL(14, 2) NOT NULL,
  "id_tarjeta" BIGINT,
  "id_plan_tarjeta" BIGINT,
  "id_terminal" BIGINT,
  "tipo_valor" VARCHAR(40) NOT NULL,
  "linea" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "fin_vtas_cobros_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "fin_vtas_cobros_ux"
ON "fin_vtas_cobros" ("id_cobro", "linea");

CREATE INDEX IF NOT EXISTS "fin_vtas_cobros_fecha_idx"
ON "fin_vtas_cobros" ("fecha");

CREATE INDEX IF NOT EXISTS "fin_vtas_cobros_id_sucursal_idx"
ON "fin_vtas_cobros" ("id_sucursal");
