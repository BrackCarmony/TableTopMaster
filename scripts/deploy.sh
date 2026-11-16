#!/usr/bin/env bash
# Build and upload the site to the droplet (ssh host alias "elo"), where nginx serves
# /var/www/tabletopmaster as tabletopmaster.brackcarmony.com.
set -euo pipefail
cd "$(dirname "$0")/.."
npm run build
rsync -rlz --delete dist/ elo:/var/www/tabletopmaster/
ssh elo 'cd /var/www/tabletopmaster && find . -type d -exec chmod 755 {} + && find . -type f -exec chmod 644 {} +'
echo "Deployed to https://tabletopmaster.brackcarmony.com"
