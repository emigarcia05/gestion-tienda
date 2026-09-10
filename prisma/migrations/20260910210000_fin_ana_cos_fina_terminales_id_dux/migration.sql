-- ID DUX de terminal (`id_terminal` de cobros) para asociar pagos a una terminal.
ALTER TABLE "fin_ana_cos_fina_terminales"
ADD COLUMN "id_dux" TEXT;

CREATE UNIQUE INDEX "fin_ana_cos_fina_terminales_id_dux_key"
ON "fin_ana_cos_fina_terminales"("id_dux");
