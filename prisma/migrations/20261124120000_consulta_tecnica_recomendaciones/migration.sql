-- Fichas de Consulta Técnica: una por marca y rubro.
-- Uso, dilución, aplicación y rendimiento los carga el editor. WhatsApp todavía no las lee.

CREATE TABLE "consulta_tecnica_recomendaciones" (
    "id" TEXT NOT NULL,
    "id_marca" TEXT NOT NULL,
    "id_rubro" TEXT NOT NULL,
    "uso" VARCHAR(400) NOT NULL DEFAULT '',
    "dilucion" VARCHAR(240) NOT NULL DEFAULT '',
    "aplicacion" VARCHAR(400) NOT NULL DEFAULT '',
    "rendimiento" VARCHAR(160) NOT NULL DEFAULT '',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "consulta_tecnica_recomendaciones_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "consulta_tecnica_recomendaciones_texto_chk" CHECK (
        length(btrim("uso")) > 0
        OR length(btrim("dilucion")) > 0
        OR length(btrim("aplicacion")) > 0
        OR length(btrim("rendimiento")) > 0
    )
);

CREATE UNIQUE INDEX "consulta_tecnica_recomendaciones_marca_rubro_key"
    ON "consulta_tecnica_recomendaciones"("id_marca", "id_rubro");

CREATE INDEX "consulta_tecnica_recomendaciones_activo_idx"
    ON "consulta_tecnica_recomendaciones"("activo");

ALTER TABLE "consulta_tecnica_recomendaciones"
    ADD CONSTRAINT "consulta_tecnica_recomendaciones_id_marca_fkey"
    FOREIGN KEY ("id_marca") REFERENCES "prod_marcas"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "consulta_tecnica_recomendaciones"
    ADD CONSTRAINT "consulta_tecnica_recomendaciones_id_rubro_fkey"
    FOREIGN KEY ("id_rubro") REFERENCES "prod_rubros"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
