#!/bin/bash

# GitFlow Branch Helper Script
# Usage: ./scripts/git-flow.sh <command> <branch-name>

set -e

COMMAND=$1
BRANCH_NAME=$2

case $COMMAND in
  feature)
    if [ -z "$BRANCH_NAME" ]; then
      echo "Usage: ./scripts/git-flow.sh feature <feature-name>"
      echo "Example: ./scripts/git-flow.sh feature/user-profile"
      exit 1
    fi
    echo "Creating feature branch: feature/$BRANCH_NAME"
    git checkout develop
    git pull origin develop
    git checkout -b "feature/$BRANCH_NAME"
    git push -u origin "feature/$BRANCH_NAME"
    echo "✅ Created and pushed feature/$BRANCH_NAME"
    echo "Create a PR at: https://github.com/Brandcentral-Pvt/RetailOps/pull/new/feature/$BRANCH_NAME"
    ;;

  hotfix)
    if [ -z "$BRANCH_NAME" ]; then
      echo "Usage: ./scripts/git-flow.sh hotfix <hotfix-name>"
      echo "Example: ./scripts/git-flow.sh hotfix/security-patch"
      exit 1
    fi
    echo "Creating hotfix branch: hotfix/$BRANCH_NAME"
    git checkout main
    git pull origin main
    git checkout -b "hotfix/$BRANCH_NAME"
    git push -u origin "hotfix/$BRANCH_NAME"
    echo "✅ Created and pushed hotfix/$BRANCH_NAME"
    echo "Create a PR at: https://github.com/Brandcentral-Pvt/RetailOps/pull/new/hotfix/$BRANCH_NAME"
    ;;

  release)
    if [ -z "$BRANCH_NAME" ]; then
      echo "Usage: ./scripts/git-flow.sh release <version>"
      echo "Example: ./scripts/git-flow.sh release v2.6.0"
      exit 1
    fi
    echo "Creating release branch: release/$BRANCH_NAME"
    git checkout develop
    git pull origin develop
    git checkout -b "release/$BRANCH_NAME"
    git push -u origin "release/$BRANCH_NAME"
    echo "✅ Created and pushed release/$BRANCH_NAME"
    echo "Create a PR at: https://github.com/Brandcentral-Pvt/RetailOps/pull/new/release/$BRANCH_NAME"
    ;;

  finish)
    if [ -z "$BRANCH_NAME" ]; then
      echo "Usage: ./scripts/git-flow.sh finish <branch-name>"
      echo "Example: ./scripts/git-flow.sh finish feature/user-profile"
      exit 1
    fi
    echo "Finishing branch: $BRANCH_NAME"
    
    if [[ "$BRANCH_NAME" == feature/* ]]; then
      git checkout develop
      git pull origin develop
      git merge --no-ff "$BRANCH_NAME"
      git push origin develop
      git branch -d "$BRANCH_NAME"
      git push origin --delete "$BRANCH_NAME"
      echo "✅ Merged $BRANCH_NAME into develop and deleted"
    elif [[ "$BRANCH_NAME" == hotfix/* ]]; then
      git checkout main
      git pull origin main
      git merge --no-ff "$BRANCH_NAME"
      git push origin main
      git checkout develop
      git pull origin develop
      git merge --no-ff "$BRANCH_NAME"
      git push origin develop
      git branch -d "$BRANCH_NAME"
      git push origin --delete "$BRANCH_NAME"
      echo "✅ Merged $BRANCH_NAME into main and develop, deleted"
    elif [[ "$BRANCH_NAME" == release/* ]]; then
      git checkout main
      git pull origin main
      git merge --no-ff "$BRANCH_NAME"
      git push origin main
      git tag -a "${BRANCH_NAME#release/}" -m "Release ${BRANCH_NAME#release/}"
      git push origin --tags
      git checkout develop
      git pull origin develop
      git merge --no-ff "$BRANCH_NAME"
      git push origin develop
      git branch -d "$BRANCH_NAME"
      git push origin --delete "$BRANCH_NAME"
      echo "✅ Merged $BRANCH_NAME into main, tagged, and deleted"
    else
      echo "Unknown branch type: $BRANCH_NAME"
      exit 1
    fi
    ;;

  list)
    echo "📋 Current branches:"
    echo ""
    echo "Main branches:"
    git branch | grep -E "^\*?  (main|develop)$" || true
    echo ""
    echo "Feature branches:"
    git branch -r | grep "origin/feature/" | sed 's/origin\//  /' || true
    echo ""
    echo "Hotfix branches:"
    git branch -r | grep "origin/hotfix/" | sed 's/origin\//  /' || true
    echo ""
    echo "Release branches:"
    git branch -r | grep "origin/release/" | sed 's/origin\//  /' || true
    ;;

  *)
    echo "GitFlow Branch Helper"
    echo ""
    echo "Commands:"
    echo "  feature <name>  - Create a feature branch from develop"
    echo "  hotfix <name>   - Create a hotfix branch from main"
    echo "  release <ver>   - Create a release branch from develop"
    echo "  finish <branch> - Merge and delete a branch"
    echo "  list            - List all branches"
    echo ""
    echo "Examples:"
    echo "  ./scripts/git-flow.sh feature user-profile"
    echo "  ./scripts/git-flow.sh hotfix security-patch"
    echo "  ./scripts/git-flow.sh release v2.6.0"
    echo "  ./scripts/git-flow.sh finish feature/user-profile"
    echo "  ./scripts/git-flow.sh list"
    ;;
esac
