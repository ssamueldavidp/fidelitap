#!/bin/bash
# Flutter dev launcher — wires the app to the local dev stack
# Usage:
#   ./run_dev.sh             → iOS Simulator (default)
#   ./run_dev.sh android     → Android Emulator (uses 10.0.2.2 for host)
#   ./run_dev.sh device      → Physical device (uses local IP; ensure both on same Wi-Fi)

set -e

PLATFORM=${1:-ios}

SUPABASE_URL="http://127.0.0.1:54321"
ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0"
API_BASE="http://localhost:3000"

if [[ "$PLATFORM" == "android" ]]; then
  # Android emulator reaches the Mac host via 10.0.2.2
  SUPABASE_URL="http://10.0.2.2:54321"
  API_BASE="http://10.0.2.2:3000"
elif [[ "$PLATFORM" == "device" ]]; then
  # Physical device needs the Mac's LAN IP
  MAC_IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null)
  SUPABASE_URL="http://${MAC_IP}:54321"
  API_BASE="http://${MAC_IP}:3000"
  echo "Using Mac IP: $MAC_IP (device must be on same Wi-Fi)"
fi

DART_DEFINES="--dart-define=SUPABASE_URL=${SUPABASE_URL} --dart-define=SUPABASE_ANON_KEY=${ANON_KEY} --dart-define=API_BASE_URL=${API_BASE}"

echo "Plataforma: $PLATFORM"
echo "API Base: $API_BASE"
echo ""

if [[ "$PLATFORM" == "android" ]]; then
  flutter run $DART_DEFINES -d emulator-5554 2>/dev/null || flutter run $DART_DEFINES --no-enable-impeller
else
  flutter run $DART_DEFINES
fi
