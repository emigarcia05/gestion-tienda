-- tesoreria_titulares: nombre_completo → nombre

ALTER TABLE "tesoreria_titulares" RENAME COLUMN "nombre_completo" TO "nombre";

ALTER INDEX "tesoreria_titulares_nombre_completo_key"
  RENAME TO "tesoreria_titulares_nombre_key";
