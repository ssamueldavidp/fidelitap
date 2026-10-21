#!/bin/sh
# Copia al portapapeles la llave de subida (en base64) para pegarla como secret de GitHub.
# Uso: sh scripts/android-secrets-helper.sh   → luego pega en el secret ANDROID_KEYSTORE_BASE64
# No imprime nada en pantalla.
KEYSTORE="${1:-$HOME/fidelitap-secrets/fidelitap-upload.p12}"
if [ ! -f "$KEYSTORE" ]; then echo "No encuentro $KEYSTORE"; exit 1; fi
base64 < "$KEYSTORE" | tr -d '\n' | pbcopy
echo "Listo: la llave en base64 está en tu portapapeles (ANDROID_KEYSTORE_BASE64)."
