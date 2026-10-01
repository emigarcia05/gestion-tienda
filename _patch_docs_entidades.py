from pathlib import Path

front = Path("docs/FRONTEND_GUIDELINES.md")
t = front.read_text(encoding="utf-8")
old = (
    "**ENTIDAD OBLIGATORIA** y **ENTIDADES** (`FiltroMultiSelect`; m\u00edn. 1 solo si ENTIDAD OBLIGATORIA). "
    "No alta inline ni edici\u00f3n en la fila."
)
# The actual sentence may differ. Print index context to a file.
idx = t.find("ENTIDAD OBLIGATORIA")
Path("_snip_ent.txt").write_text(t[idx - 200 : idx + 500], encoding="utf-8")

back = Path("docs/BACKEND_GUIDELINES.md")
b = back.read_text(encoding="utf-8")
# Alias list: cobros_entidades deja de ser nombre prohibido.
old_alias = "`cobros_entidades`, "
if old_alias not in b:
    raise SystemExit("alias token missing")
b = b.replace(old_alias, "`tesoreria_cobros_entidades`, ", 1)
b = b.replace("tesoreria_cobros_entidades", "cobros_entidades")
# Add column drop note next to forma pago alias row if present.
needle = "`cobros_forma_pago` (sin columna `codigo`)"
insert = "`cobros_forma_pago` (sin columna `codigo` ni `entidad_obligatoria`; N:M con `cobros_entidades` opcional)"
if needle not in b:
    raise SystemExit("forma pago row missing")
b = b.replace(needle, insert, 1)
# Mention optional link in analisis sentence by appending a short clause after first cobros_entidades mention of entidades UI if unique enough.
note = "N:M + `acepta_cuotas`"
note2 = "N:M opcional (puede no haber entidades) + `acepta_cuotas`"
if note not in b:
    raise SystemExit("matriz note missing")
b = b.replace(note, note2, 1)
back.write_text(b, encoding="utf-8")

ft = front.read_text(encoding="utf-8")
ft = ft.replace("tesoreria_cobros_entidades", "cobros_entidades")
front.write_text(ft, encoding="utf-8")
print("docs base ok")
