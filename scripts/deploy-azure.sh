#!/usr/bin/env bash
# Publica una nueva versión del Backend en Azure Container Apps.
# Uso: ./scripts/deploy-azure.sh v2
#
# El entorno de Container Apps es "Express": exige imágenes OCI (por eso buildx con
# oci-mediatypes) y no admite sufijos de revisión, así que se despliega por digest.
# Las variables y secretos ya están configurados en la Container App; no se tocan aquí.
set -euo pipefail

VERSION=${1:?Indica la versión, p. ej.: ./scripts/deploy-azure.sh v2}
REGISTRO=cmpcapstoneacr
IMAGEN=$REGISTRO.azurecr.io/cmp-backend
GRUPO=CMP_Capstone
APP=cmp-backend

cd "$(dirname "$0")/.."

az acr login -n "$REGISTRO" >/dev/null
docker buildx inspect cmp-builder >/dev/null 2>&1 || docker buildx create --name cmp-builder --driver docker-container >/dev/null
docker buildx build --builder cmp-builder --platform linux/amd64 --provenance=false --sbom=false \
  --output "type=registry,name=$IMAGEN:$VERSION,oci-mediatypes=true" .

DIGEST=$(az acr manifest show-metadata -r "$REGISTRO" -n "cmp-backend:$VERSION" --query digest -o tsv)
az containerapp update -g "$GRUPO" -n "$APP" --image "$IMAGEN@$DIGEST" -o none --only-show-errors

URL=$(az containerapp show -g "$GRUPO" -n "$APP" --query properties.configuration.ingress.fqdn -o tsv)
echo "Desplegado $VERSION ($DIGEST)"
echo "Verifica: https://$URL/health"
