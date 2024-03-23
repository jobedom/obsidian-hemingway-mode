#!/usr/bin/env bash

set -euo pipefail

if [[ $(git status --porcelain) ]]; then
  echo "Changes in the git repo. Exiting."
  exit 1
fi

npm version patch
NEW_VERSION=$(jq ".version" package.json)

git add -A .
git commit -m "Update to version ${NEW_VERSION}"
git tag "${NEW_VERSION}"
git push
git push origin --tags
