-- Baja lógica de productos de tienda: un ítem con historia (stock, ventas, compras, etc.) no se borra,
-- queda `habilitado = false` y se oculta de Lista Productos y de los buscadores operativos.
ALTER TABLE "prod_lista" ADD COLUMN "habilitado" BOOLEAN NOT NULL DEFAULT true;
