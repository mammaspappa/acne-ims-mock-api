#!/bin/bash
# Dumps all Acne Studios IMS data to CSV files in this directory.
# Usage: bash /home/localuser/Acne/exports/generate.sh

set -e

BASE="${BASE:-http://127.0.0.1:3000}"
OUT="$(dirname "$0")"
cd "$OUT"

echo "Exporting from $BASE to $OUT"
echo ""

ENTITIES=(
  "products"
  "skus"
  "locations"
  "suppliers"
  "users"
  "customers"
  "purchase-orders"
  "po-lines"
  "po-receipts"
  "po-status-history"
  "sales-orders"
  "so-lines"
  "so-status-history"
  "shipments"
  "stock-levels"
  "stock-movements"
  "matches"
  "matching-runs"
  "forecasts"
  "recommendations"
  "anomalies"
  "audit-logs"
  "season-drops"
)

for entity in "${ENTITIES[@]}"; do
  file="${entity}.csv"
  rows=$(curl -sf "$BASE/api/v1/export/${entity}.csv" -o "$file" -w "%{size_download}")
  if [ -s "$file" ]; then
    lines=$(wc -l < "$file")
    printf "  %-22s %8d rows (%8s bytes)\n" "$entity" $((lines - 1)) "$rows"
  else
    printf "  %-22s  failed or empty\n" "$entity"
  fi
done

echo ""
echo "Done. Files in $OUT"
ls -lh *.csv 2>/dev/null | awk '{print "  " $9 ": " $5}'
