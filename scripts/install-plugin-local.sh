#!/usr/bin/env bash
# Operator helper: rebuild and copy the App Plugin into a running Grafana container.
# Not part of the product runtime — for local BYO Grafana testing.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
GRAFANA_CONTAINER="${GRAFANA_CONTAINER:-grafana}"
GRAFANA_VOLUME="${GRAFANA_VOLUME:-monitoring_grafana_data}"
PLUGIN_ID="amp-agent-manager-app"
PLUGIN_UID="${PLUGIN_UID:-472}"

cd "$ROOT/plugin"
rm -rf dist
npm run build

# Wipe + install via a root helper container so ownership doesn't block updates.
docker run --rm \
  -v "${GRAFANA_VOLUME}:/data" \
  -v "$ROOT/plugin/dist:/dist:ro" \
  alpine sh -c "
    rm -rf /data/plugins/${PLUGIN_ID}
    mkdir -p /data/plugins/${PLUGIN_ID}
    cp -a /dist/. /data/plugins/${PLUGIN_ID}/
    chown -R ${PLUGIN_UID}:0 /data/plugins/${PLUGIN_ID}
  "

docker restart "$GRAFANA_CONTAINER"

echo "Installed ${PLUGIN_ID} into ${GRAFANA_CONTAINER} (volume ${GRAFANA_VOLUME})."
echo "Hard-refresh the browser (Ctrl+Shift+R), then open:"
echo "  http://<grafana-host>:3000/a/${PLUGIN_ID}/overview"
