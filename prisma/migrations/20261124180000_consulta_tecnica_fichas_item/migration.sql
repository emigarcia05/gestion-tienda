-- Memoria del resumen leído en la hoja del fabricante. Una fila por ítem.

CREATE TABLE "consulta_tecnica_fichas_item" (
    "cod_tienda" TEXT NOT NULL,
    "url_ficha" VARCHAR(500) NOT NULL DEFAULT '',
    "preparacion" VARCHAR(500) NOT NULL DEFAULT '',
    "dilucion" VARCHAR(500) NOT NULL DEFAULT '',
    "secado_entre_manos" VARCHAR(300) NOT NULL DEFAULT '',
    "secado_final" VARCHAR(300) NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "consulta_tecnica_fichas_item_pkey" PRIMARY KEY ("cod_tienda")
);

ALTER TABLE "consulta_tecnica_fichas_item"
    ADD CONSTRAINT "consulta_tecnica_fichas_item_cod_tienda_fkey"
    FOREIGN KEY ("cod_tienda") REFERENCES "prod_lista"("cod_tienda")
    ON DELETE CASCADE ON UPDATE CASCADE;
