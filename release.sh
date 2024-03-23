#!/usr/bin/env bash

set -euo pipefail

if [[ $(git status --porcelain) ]]; then
  echo "Changes in the git repo. Exiting."
  exit 1
fi

npm version patch
NEW_VERSION=$(jq ".version" package.json)

exit 0

echo "Adding ..."
git add -A .
echo "Committing ..."
git commit -m "Update to version ${NEW_VERSION}"
echo "Tagging ..."
git tag "${NEW_VERSION}"

# echo "Pushing ..."
# git push

# echo "Pushing tags ..."
# git push origin --tags
