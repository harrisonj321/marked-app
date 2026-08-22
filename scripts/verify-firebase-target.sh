#!/usr/bin/env bash
# Refuses to let a Firebase deploy proceed unless .firebaserc's default
# project resolves to the one this branch is meant to target. Run
# automatically before any deploy:* npm script (see package.json) --
# deploying Firestore Rules to the wrong Firebase project is exactly the
# kind of mistake that's cheap to guard against and expensive to undo.
set -euo pipefail

REQUIRED_PROJECT="marked-app-733c0"
RESOLVED_PROJECT="$(node -e "console.log(JSON.parse(require('fs').readFileSync('.firebaserc', 'utf8')).projects.default)")"

if [ "$RESOLVED_PROJECT" != "$REQUIRED_PROJECT" ]; then
  echo "Refusing to deploy: .firebaserc resolves to '$RESOLVED_PROJECT', not the required '$REQUIRED_PROJECT'." >&2
  exit 1
fi

echo "Firebase target verified: $RESOLVED_PROJECT"
