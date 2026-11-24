-- La hoja del fabricante es una por producto, no por presentación ni por color.

DROP TABLE "consulta_tecnica_fichas_item";

CREATE TABLE "consulta_tecnica_fichas" (
    "id" TEXT NOT NULL,
    "clave" VARCHAR(300) NOT NULL,
    "id_marca" TEXT,
    "url_ficha" VARCHAR(500) NOT NULL DEFAULT '',
    "preparacion" VARCHAR(500) NOT NULL DEFAULT '',
    "dilucion" VARCHAR(500) NOT NULL DEFAULT '',
    "secado_entre_manos" VARCHAR(300) NOT NULL DEFAULT '',
    "secado_final" VARCHAR(300) NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "consulta_tecnica_fichas_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "consulta_tecnica_fichas_clave_key" ON "consulta_tecnica_fichas"("clave");

CREATE INDEX "consulta_tecnica_fichas_id_marca_idx" ON "consulta_tecnica_fichas"("id_marca");

ALTER TABLE "consulta_tecnica_fichas"
    ADD CONSTRAINT "consulta_tecnica_fichas_id_marca_fkey"
    FOREIGN KEY ("id_marca") REFERENCES "prod_marcas"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
