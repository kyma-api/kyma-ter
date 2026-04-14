#!/bin/bash
set -euo pipefail

# Build and release kyma-ter binaries
# Usage: ./scripts/release.sh <version>
# Example: ./scripts/release.sh 0.2.0
#
# After running this script:
# 1. Upload dist/ binaries to kymaapi.com/ter/releases/v{version}/
# 2. Update "kymaTerminal" in kyma-api/packages/kyma-agent/package.json
# 3. Publish @kyma-api/agent

VERSION="${1:?Usage: ./scripts/release.sh <version>}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

cd "$ROOT"
echo "Building kyma-ter v$VERSION binaries..."
make release-binaries VERSION="$VERSION"

echo ""
echo "Done! Binaries in dist/:"
ls -lh dist/
echo ""
echo "Next steps:"
echo "  1. Upload dist/ to https://kymaapi.com/ter/releases/v$VERSION/"
echo "  2. In kyma-api repo: set \"kymaTerminal\": \"$VERSION\" in packages/kyma-agent/package.json"
echo "  3. npm publish @kyma-api/agent"
