#!/bin/bash
set -euo pipefail

# Build and release kyma-ter binaries
# Usage: ./scripts/release.sh <version>
# Example: ./scripts/release.sh 0.2.0
#
# After running this script:
# 1. Upload dist/ binaries to kymaapi.com/ter/releases/v{version}/
# 2. Update ter-latest.txt in kyma-releases
# 3. Update "kymaTerminal" in kyma-api/packages/kyma-agent/package.json
# 4. Publish @kyma-api/agent

VERSION="${1:?Usage: ./scripts/release.sh <version>}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

update_latest_file() {
  if [[ -z "${KYMA_RELEASES_DIR:-}" ]]; then
    echo "  2. Update ter-latest.txt in kyma-releases"
    echo "     Tip: re-run with KYMA_RELEASES_DIR=/path/to/kyma-releases to update it automatically"
    return
  fi

  local latest_file="$KYMA_RELEASES_DIR/ter-latest.txt"
  if [[ ! -d "$KYMA_RELEASES_DIR" ]]; then
    echo "ERROR: KYMA_RELEASES_DIR does not exist: $KYMA_RELEASES_DIR"
    exit 1
  fi

  printf '%s\n' "$VERSION" > "$latest_file"
  echo "Updated $latest_file"
}

cd "$ROOT"
echo "Building kyma-ter v$VERSION binaries..."
make release-binaries VERSION="$VERSION"

echo ""
update_latest_file

echo ""
echo "Done! Binaries in dist/:"
ls -lh dist/
echo ""
echo "Next steps:"
echo "  1. Upload dist/ to https://kymaapi.com/ter/releases/v$VERSION/"
echo "  3. In kyma-api repo: set \"kymaTerminal\": \"$VERSION\" in packages/kyma-agent/package.json"
echo "  4. npm publish @kyma-api/agent"
