import re, json, sys
src = open(sys.argv[1]).read()
out = []
# Familias de negocio (§1-10)
for m in re.finditer(r"^### `([a-z0-9-]+)` · (\S+)\n(.*?)(?=^### |^## |\Z)", src, re.S | re.M):
    id_, cat, body = m.group(1), m.group(2), m.group(3)
    def campo(nombre):
        mm = re.search(rf"- \*\*{nombre}\*\*: (.*?)(?=\n- \*\*|\n\n|\Z)", body, re.S)
        return re.sub(r"\s+", " ", mm.group(1)).strip() if mm else ""
    ejemplos = [e.strip() for e in campo("Así lo escribe María").split(" · ") if e.strip()]
    out.append({"id": id_, "categoria": cat.replace("ñ", "n").replace("ó", "o"), "grupo": "negocio",
                "responde": campo("Responde"), "dato": campo("Dato"), "entidades": campo("Entidades"),
                "ejemplos": ejemplos, "modelo": campo("Respuesta modelo")})
def tabla(seccion_re, grupo):
    sec = re.search(seccion_re, src, re.S | re.M).group(0)
    for fila in re.findall(r"^\| `([a-z0-9-]+)` \|(.*)\|\s*$", sec, re.M):
        id_, resto = fila
        cols = [c.strip() for c in resto.split("|")]
        yield id_, cols
for id_, cols in tabla(r"^## 11\..*?(?=^---)", "charla"):
    out.append({"id": id_, "categoria": "charla", "grupo": "charla", "ejemplos": [e.strip() for e in cols[0].split(" · ")], "modelo": cols[1].strip("«»")})
for id_, cols in tabla(r"^## 12\..*?(?=^## 13)", "plan"):
    out.append({"id": id_, "categoria": "plan", "grupo": "plan", "ejemplos": [e.strip() for e in re.sub(r"^\(.*?\)\s*", "", cols[0]).split(" · ")], "plan": cols[1], "alternativa": cols[2], "mensaje": cols[3].strip("«»")})
for id_, cols in tabla(r"^## 13\..*?(?=^---)", "tecnica"):
    out.append({"id": id_, "categoria": "tecnica", "grupo": "tecnica", "ejemplos": [e.strip() for e in cols[0].split(" · ")], "solucion": cols[1], "guia": cols[2]})
from collections import Counter
print(json.dumps(Counter(x["grupo"] for x in out)), file=sys.stderr)
print(json.dumps(out, ensure_ascii=False, indent=1))

# Uso: python3 scripts/generar-especificacion-asistente.py <preguntas-universo.md> > /tmp/c.json
#      y después --ts: reescribe src/lib/asistente/especificacion.ts conservando su cabecera.
if "--ts" in sys.argv:
    ruta = "src/lib/asistente/especificacion.ts"
    ts = open(ruta).read()
    cab = ts[: ts.index("export const ESPECIFICACION")]
    open(ruta, "w").write(cab + "export const ESPECIFICACION: FamiliaEspecificacion[] = " + json.dumps(out, ensure_ascii=False, indent=2) + ";\n")
