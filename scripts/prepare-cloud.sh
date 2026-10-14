#!/usr/bin/env bash
set -euo pipefail
cd /workspace/Free
export NPM_CONFIG_CACHE="${NPM_CONFIG_CACHE:-/workspace/.cache/topuria-npm}"
npm ci --ignore-scripts --no-audit --no-fund
python3 scripts/verify-prisma-engines.py
npm rebuild
npm run db:generate
# Do not run setup from old README versions, db:push, migrations, or seed on Neon.
