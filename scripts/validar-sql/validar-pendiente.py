# Uso: con SUPABASE_PROJECT_REF y SUPABASE_ACCESS_TOKEN en el entorno (cargados con `source`, nunca escritos aquí):
#   python3 scripts/validar-sql/validar-pendiente.py supabase/pendiente.sql [scripts/validar-sql/comprobar-NN.sql]
"""Valida supabase/pendiente.sql contra producción SIN aplicar nada:
volcado de esquema antes → begin; pendiente; rollback → comprobación dentro
de la transacción (termina en excepción a propósito) → volcado después.
Credenciales por entorno (source del fichero protegido); nunca se imprimen."""
import hashlib, json, os, sys, urllib.request, urllib.error

REF = os.environ["SUPABASE_PROJECT_REF"]
TOKEN = os.environ["SUPABASE_ACCESS_TOKEN"]
URL = f"https://api.supabase.com/v1/projects/{REF}/database/query"

def q(sql):
    req = urllib.request.Request(URL, data=json.dumps({"query": sql}).encode(), method="POST",
        headers={"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json", "User-Agent": "sishow-validar"})
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            return True, json.loads(r.read() or b"null")
    except urllib.error.HTTPError as e:
        return False, e.read().decode(errors="replace")[:2000]

VOLCADO = """
select json_agg(x order by x) from (
  select 'col|'||table_name||'|'||column_name||'|'||data_type||'|'||is_nullable||'|'||coalesce(column_default,'') as x
    from information_schema.columns where table_schema='public'
  union all select 'con|'||conrelid::regclass||'|'||conname||'|'||pg_get_constraintdef(oid) from pg_constraint where connamespace='public'::regnamespace
  union all select 'idx|'||tablename||'|'||indexname||'|'||indexdef from pg_indexes where schemaname='public'
  union all select 'rls|'||relname||'|'||relrowsecurity from pg_class where relnamespace='public'::regnamespace and relkind='r'
  union all select 'fn|'||proname from pg_proc where pronamespace='public'::regnamespace
  union all select 'trg|'||tgname||'|'||tgrelid::regclass from pg_trigger where not tgisinternal
  union all select 'filas|salon_members|'||count(*)||'|'||string_agg(rol, ',' order by rol) from salon_members
) t;"""

def volcado():
    ok, r = q(VOLCADO)
    if not ok: sys.exit(f"volcado falló: {r}")
    texto = json.dumps(r, sort_keys=True)
    return hashlib.sha256(texto.encode()).hexdigest(), r[0]["json_agg"] if r and isinstance(r, list) else r

sql = open(sys.argv[1]).read()
comprobacion = open(sys.argv[2]).read() if len(sys.argv) > 2 else ""

h1, v1 = volcado()
print("antes:", h1[:16], len(v1 or []), "líneas")

ok, r = q("begin;\n" + sql + "\nrollback;")
print("begin; pendiente.sql; rollback →", "OK" if ok else "ERROR", "" if ok else r)

if comprobacion:
    ok2, r2 = q("begin;\n" + sql + "\n" + comprobacion)
    # Termina en excepción a propósito: el mensaje trae la comprobación y la transacción se deshace.
    print("comprobación dentro de la transacción →", r2 if not ok2 else f"(sin excepción: {r2})")
    q("rollback;")

h2, v2 = volcado()
print("después:", h2[:16], len(v2 or []), "líneas")
print("IDÉNTICO" if h1 == h2 else "DISTINTO")
if h1 != h2:
    a, b = set(v1 or []), set(v2 or [])
    print("solo antes:", sorted(a - b)[:20]); print("solo después:", sorted(b - a)[:20])
