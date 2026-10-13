-- Forma de pago que genera un cheque en cartera (la caja destino debe tener recibe_cheque).
ALTER TABLE "cobros_forma_pago" ADD COLUMN "es_cheque" BOOLEAN NOT NULL DEFAULT false;
