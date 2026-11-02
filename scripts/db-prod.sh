#!/bin/sh
# Aplica las migraciones pendientes a la base de datos de producción (Supabase Cloud).
# No borra datos: solo corre las migraciones que todavía no están en el proyecto.
#
# Uso (en la terminal, desde la carpeta del proyecto):
#   sh scripts/db-prod.sh
# Te pide la contraseña de la base de datos (no se ve al escribirla ni se guarda en ningún archivo).
set -e

REF="dytajdactdafuyprhwgo"
HOST="aws-0-ca-central-1.pooler.supabase.com"

printf "Contraseña de la base de datos de Supabase (no se muestra): "
stty -echo
read -r PASS
stty echo
printf "\n"
[ -n "$PASS" ] || { echo "No escribiste la contraseña."; exit 1; }

# Codifica caracteres especiales para la URL de conexión
ENC=$(python3 -c "import sys,urllib.parse; print(urllib.parse.quote(sys.argv[1], safe=''))" "$PASS")
DB_URL="postgresql://postgres.${REF}:${ENC}@${HOST}:5432/postgres"

echo
echo "== Estado de las migraciones (Local vs Remoto) =="
pnpm supabase migration list --db-url "$DB_URL"

echo
printf "¿Aplicar las migraciones pendientes a PRODUCCIÓN? (escribe SI para continuar): "
read -r OK
[ "$OK" = "SI" ] || { echo "Cancelado. No se cambió nada."; exit 0; }

pnpm supabase db push --db-url "$DB_URL"
echo
echo "Listo. Avísale a Claude para verificar las tablas."
