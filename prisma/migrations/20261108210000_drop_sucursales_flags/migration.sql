-- Todas las sucursales imputan costos, entran al balance / ventas mensuales
-- y generan estadísticas. Los flags dejaron de distinguir nada.
ALTER TABLE "sucursales" DROP COLUMN "centro_costo";
ALTER TABLE "sucursales" DROP COLUMN "genera_balance";
ALTER TABLE "sucursales" DROP COLUMN "genera_est";
