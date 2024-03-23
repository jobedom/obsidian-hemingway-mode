#!/usr/bin/env bash

MINIMUM_OBSIDIAN_VERSION="0.15.0"

set -euo pipefail

if [[ $(git status --porcelain) ]]; then
  echo "Changes in the git repo. Exiting."
  exit 1
fi

npm version patch
NEW_VERSION=$(jq ".version" package.json)

echo "Updating to version ${NEW_VERSION}"
echo "with minimum Obsidian version ${MINIMUM_OBSIDIAN_VERSION}"

echo "Updating manifest.json"
TEMP_FILE=$(mktemp)
jq ".version |= \"${NEW_VERSION}\" | .minAppVersion |= \"${MINIMUM_OBSIDIAN_VERSION}\"" manifest.json > "$TEMP_FILE" || exit 1
mv "$TEMP_FILE" manifest.json

echo "Updating versions.json"
TEMP_FILE=$(mktemp)
jq ". += {\"${NEW_VERSION}\": \"${MINIMUM_OBSIDIAN_VERSION}\"}" versions.json > "$TEMP_FILE" || exit 1
mv "$TEMP_FILE" versions.json

echo "Creating git commit, tag, and pushing"
git add -A .
git commit -m"Update to version ${NEW_VERSION}"
git tag "${NEW_VERSION}"
git push
LEFTHOOK=0 git push --tags
