-- El producto (lo que es igual) queda aparte del SKU.
-- Presentación, color y terminación siguen en prod_lista.

CREATE TABLE "prod_productos" (
    "id" TEXT NOT NULL,
    "id_marca" TEXT NOT NULL,
    "nombre" VARCHAR(300) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "prod_productos_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "prod_productos_id_marca_nombre_key" ON "prod_productos"("id_marca", "nombre");

CREATE INDEX "prod_productos_id_marca_idx" ON "prod_productos"("id_marca");

ALTER TABLE "prod_productos"
    ADD CONSTRAINT "prod_productos_id_marca_fkey"
    FOREIGN KEY ("id_marca") REFERENCES "prod_marcas"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "prod_lista" ADD COLUMN "id_producto" TEXT;
ALTER TABLE "prod_lista" ADD COLUMN "producto_manual" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "prod_lista_id_producto_idx" ON "prod_lista"("id_producto");

ALTER TABLE "prod_lista"
    ADD CONSTRAINT "prod_lista_id_producto_fkey"
    FOREIGN KEY ("id_producto") REFERENCES "prod_productos"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
