#!/usr/bin/env bash
set -euo pipefail

# Pretty git log with branch graph
# Usage: ./scripts/git/log.sh [number of commits, default 20]

LIMIT="${1:-20}"

git log --graph --pretty=format:'%Cred%h%Creset -%C(yellow)%d%Creset %s %Cgreen(%cr) %C(bold blue)<%an>%Creset' --abbrev-commit --date=relative -n "$LIMIT"
