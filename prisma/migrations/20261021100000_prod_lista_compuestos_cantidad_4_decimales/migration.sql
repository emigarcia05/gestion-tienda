-- Cantidad de componente por kit con hasta 4 decimales (p. ej. 0,005 de un tambor de 200 L).
-- Solo amplía precisión: los valores existentes (1 decimal) se conservan.

ALTER TABLE "prod_lista_compuestos"
  ALTER COLUMN "cantidad" TYPE DECIMAL(14,4);
