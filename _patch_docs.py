from pathlib import Path

back = Path("docs/BACKEND_GUIDELINES.md")
t = back.read_text(encoding="utf-8")
old = "**`nombre_proyecto`** TEXT NOT NULL MAYÚSCULAS (puede ser `''` si hay otro dato)"
new = (
    "**`nombre_proyecto`** TEXT NOT NULL MAYÚSCULAS; vacío o solo espacios persiste "
    "`PRINCIPAL` (`nombreProyectoPersistido`; default SQL + CHECK `clientes_proyectos_nombre_proyecto_chk`; "
    "migración `20260929150000_clientes_proyectos_nombre_principal` backfill)"
)
if old not in t:
    raise SystemExit("BACKEND nombre_proyecto string not found")
back.write_text(t.replace(old, new, 1), encoding="utf-8")
print("backend ok")

front = Path("docs/FRONTEND_GUIDELINES.md")
tf = front.read_text(encoding="utf-8")
oldf = "Modal de proyecto: `CrearEditarEnviosDireccionModal` (campo **NOMBRE PROYECTO** MAYÚSCULAS)."
newf = (
    "Modal de proyecto: `CrearEditarEnviosDireccionModal` (campo **NOMBRE PROYECTO** MAYÚSCULAS; "
    "vacío persiste **PRINCIPAL**; `placeholder` PRINCIPAL)."
)
if oldf not in tf:
    raise SystemExit("FRONTEND proyecto modal string not found")
front.write_text(tf.replace(oldf, newf, 1), encoding="utf-8")
print("frontend ok")
