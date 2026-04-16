#!/bin/bash
set -euo pipefail

# Build and release kyma-ter binaries
# Usage: ./scripts/release.sh <version>
# Example: ./scripts/release.sh 0.2.0
#
# After running this script:
# 1. Create/update GitHub Release ter-v{version} in kyma-api/kyma-ter
# 2. Upload dist/ binaries as release assets
# 3. Update "kymaTerminal" in kyma-api/packages/kyma-agent/package.json
# 4. Publish @kyma-api/agent

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
echo "  1. Create GitHub release ter-v$VERSION in kyma-api/kyma-ter"
echo "  2. Upload dist/ binaries as release assets"
echo "  3. In kyma-api repo: set \"kymaTerminal\": \"$VERSION\" in packages/kyma-agent/package.json"
echo "  4. npm publish @kyma-api/agent"
