-- Se eliminó la sincronización GET con la API DUX (botón SINCRONIZAR del sidebar).
-- `sync_dux_status` guardaba solo el estado de esa corrida; no tiene FKs entrantes.
DROP TABLE IF EXISTS "sync_dux_status";
