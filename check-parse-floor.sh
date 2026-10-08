#!/usr/bin/env bash
#
# Parse-floor gate: the files the site loads must parse as ES2019 (Chrome 78 /
# Safari 12 on hospital computers; one ?. or ?? kept the whole finder from
# starting there, Sentry ORDOTYPE-FRONTEND-1F6).
#
# The file list comes from build-search-result-bundle.sh (INDEX + FILTER, the
# files the loader serves) plus the bundle: bumping a source version there is
# enough, nothing else to keep in sync. Run by parse-floor.yml and, before
# publishing, by build-search-result-bundle.yml.
#
set -euo pipefail
cd "$(dirname "$0")"

INDEX=$(sed -n 's/^INDEX="\(.*\)"$/\1/p' build-search-result-bundle.sh)
FILTER=$(sed -n 's/^FILTER="\(.*\)"$/\1/p' build-search-result-bundle.sh)
[ -n "$INDEX" ] && [ -n "$FILTER" ] || { echo "ERROR: INDEX/FILTER not found in build-search-result-bundle.sh" >&2; exit 1; }

npx --yes eslint@10 "$INDEX" "$FILTER" search-result-bundle.js
echo "parse-floor OK: $INDEX $FILTER search-result-bundle.js"
