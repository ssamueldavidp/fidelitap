#!/bin/sh
# Deja lista la configuración de producción en Supabase Cloud (proyecto fidelitap).
# Uso, desde la carpeta del proyecto:   sh scripts/prod-setup.sh
# Cada paso muestra lo que va a cambiar y te pide confirmar. Requiere haber hecho
# `pnpm supabase login` y `pnpm supabase link --project-ref dytajdactdafuyprhwgo`.
set -e

REF="dytajdactdafuyprhwgo"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
W="/tmp/supabase-prod"

echo "== Paso 1: autenticación de producción =="
echo "   Site URL https://fidelitap.co, enlaces de retorno, códigos de 6 dígitos,"
echo "   usuarios anónimos (app) y envío de correos por Resend (noreply@fidelitap.co)."
echo
rm -rf "$W" && mkdir -p "$W/supabase/templates"
cp "$ROOT/supabase/config.toml" "$W/supabase/config.toml"
cp "$ROOT/supabase/templates/magic_link.html" "$W/supabase/templates/"
cp -r "$ROOT/supabase/.temp" "$W/supabase/" 2>/dev/null || true

python3 - <<'PY'
import re
p='/tmp/supabase-prod/supabase/config.toml'
s=open(p).read()
s=s.replace('site_url = "http://127.0.0.1:3000"','site_url = "https://fidelitap.co"',1)
s=re.sub(r'additional_redirect_urls = \[.*?\n\]','''additional_redirect_urls = [
  "https://fidelitap.co/auth/callback",
  "https://fidelitap.co/auth/callback?next=/reset-password",
  "https://www.fidelitap.co/auth/callback",
  "https://www.fidelitap.co/auth/callback?next=/reset-password",
]''',s,count=1,flags=re.S)
s=re.sub(r'(\[auth\.mfa\.totp\]\n)enroll_enabled = false\nverify_enabled = false',r'\1enroll_enabled = true\nverify_enabled = true',s)
open(p,'w').write(s)
PY

# La llave de Resend sale de .env.local (no se imprime)
set -a; . "$ROOT/.env.local"; set +a
cd "$W"
( cd "$ROOT" && pnpm supabase --workdir "$W" config push --project-ref "$REF" )

echo
echo "== Paso 2: tareas programadas de notificaciones (pg_cron) =="
SECRET_FILE="$HOME/fidelitap-secrets/cron-secret"
[ -f "$SECRET_FILE" ] || { echo "No encuentro $SECRET_FILE"; exit 1; }
printf "¿Registrar la URL de la app y el CRON_SECRET en la base de producción? (escribe SI): "
read -r OK
[ "$OK" = "SI" ] || { echo "Omitido."; exit 0; }
CRON="$(cat "$SECRET_FILE")"
cd "$ROOT"
pnpm supabase db query --linked "alter database postgres set app.settings.app_url = 'https://fidelitap.co'; alter database postgres set app.settings.cron_secret = '${CRON}';" >/dev/null
echo "Listo: las campañas push programadas ya pueden dispararse."
