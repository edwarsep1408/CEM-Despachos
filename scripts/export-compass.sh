#!/usr/bin/env bash
# Export MongoDB para importar en MongoDB Compass (colección por colección, JSON).
# Uso: ./scripts/export-compass.sh [carpeta_destino]

set -euo pipefail

DB="cem-db_distribuccion"
OUT="${1:-exports/compass-$(date +%Y%m%d)}"
CONTAINER="${MONGO_CONTAINER:-cem-logistica-mongo}"
USER="${MONGODB_USER:-cem}"
PASS="${MONGODB_PASSWORD:-cemlocal}"

mkdir -p "$OUT"

collections=$(docker exec "$CONTAINER" mongosh --quiet \
  -u "$USER" -p "$PASS" --authenticationDatabase admin "$DB" \
  --eval 'print(db.getCollectionNames().join(" "))')

echo "Exportando a $OUT ..."
for col in $collections; do
  file="${DB}.${col}.json"
  echo "  -> $file"
  docker exec "$CONTAINER" mongoexport \
    -u "$USER" -p "$PASS" --authenticationDatabase admin \
    -d "$DB" -c "$col" --jsonArray \
    -o "/tmp/$file"
  docker cp "$CONTAINER:/tmp/$file" "$OUT/$file"
  docker exec "$CONTAINER" rm -f "/tmp/$file"
done

echo "Listo: $OUT"
