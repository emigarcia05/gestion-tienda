-- Los rangos de Cat. M.C. no cubren obligatoriamente 0…100.
-- El máximo puede superar 100 (misma escala que PORC. UTILIDAD, tope 300).
ALTER TABLE "fin_ana_mc_cat" DROP CONSTRAINT "fin_ana_mc_cat_rango_check";

ALTER TABLE "fin_ana_mc_cat"
  ADD CONSTRAINT "fin_ana_mc_cat_rango_check"
  CHECK ("desde_pct" >= 0 AND "hasta_pct" <= 300 AND "desde_pct" < "hasta_pct");
