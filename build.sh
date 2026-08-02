#!/usr/bin/env bash
#
# Writes js/credentials.js from environment variables at deploy time.
#
# The file is git-ignored, so a host that builds from the repository will
# not find it there. Rather than committing the values, they are kept as
# environment variables in the hosting dashboard and written here, during
# the build, into the copy that gets published.
#
# Cloudflare Pages: set the build command to "bash build.sh" and leave the
# output directory as "/". Netlify and Vercel take the same command.
#
# Required variables:
#   MIRRA_CLIENT_ID
#   MIRRA_API_KEY
#   MIRRA_APP_ID

set -euo pipefail

missing=()
[ -z "${MIRRA_CLIENT_ID:-}" ] && missing+=("MIRRA_CLIENT_ID")
[ -z "${MIRRA_API_KEY:-}" ]   && missing+=("MIRRA_API_KEY")
[ -z "${MIRRA_APP_ID:-}" ]    && missing+=("MIRRA_APP_ID")

if [ ${#missing[@]} -gt 0 ]; then
  echo "Build failed: missing environment variables: ${missing[*]}" >&2
  echo "Set them in your hosting dashboard, then deploy again." >&2
  exit 1
fi

cat > js/credentials.js <<EOF
/* Written during the build. Not committed, not editable here. */
export const credentials = {
  CLIENT_ID: "${MIRRA_CLIENT_ID}",
  API_KEY:   "${MIRRA_API_KEY}",
  APP_ID:    "${MIRRA_APP_ID}",
};
EOF

echo "js/credentials.js written"
