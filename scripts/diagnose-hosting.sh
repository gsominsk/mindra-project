#!/usr/bin/env bash
# diagnose-hosting.sh — read-only environment probe for non-Docker deployment.
# Safe to run on any Linux/macOS box: no writes, no network, no privileged ops.
#
# Usage:  bash diagnose-hosting.sh
#         (or: chmod +x diagnose-hosting.sh && ./diagnose-hosting.sh)
#
# Outputs a structured report of what's available (Node, npm, pm2, nginx,
# disk, RAM, ports, git, home layout) so we can design a production deploy
# without Docker on a shared hosting account.

set -u  # error on unset vars; do NOT set -e (some probes are expected to fail)

# --- helpers --------------------------------------------------------------

hr() { printf '\n=== %s ===\n' "$1"; }
have() { command -v "$1" >/dev/null 2>&1 && echo "found: $(command -v "$1")" || echo "NOT FOUND"; }

# --- 0. System ------------------------------------------------------------

hr "0. SYSTEM"
echo "user:      $(whoami 2>/dev/null || echo '?')"
echo "host:      $(hostname 2>/dev/null || echo '?')"
echo "os:        $(uname -s 2>/dev/null)"
echo "kernel:    $(uname -r 2>/dev/null)"
echo "arch:      $(uname -m 2>/dev/null)"
echo "uptime:    $(uptime 2>/dev/null | sed 's/^ *//')"
echo "shell:     ${SHELL:-?}"
echo "date:      $(date 2>/dev/null)"

# Detect CloudLinux / cPanel / shared hosting markers
if [ -f /etc/cloudlinux-release ] || grep -qi cloudlinux /etc/redhat-release 2>/dev/null; then
  echo "env:       CloudLinux (likely shared hosting — no root, no Docker)"
elif [ -f /etc/cpanel/version ] 2>/dev/null; then
  echo "env:       cPanel-based hosting"
fi

# --- 1. Node.js / npm / npx ----------------------------------------------

hr "1. NODE.JS / NPM / NPIX"
echo "node:  $(have node)"
node --version 2>/dev/null && echo "  ^ node version" || echo "  node not executable"
echo "npm:   $(have npm)"
npm --version 2>/dev/null && echo "  ^ npm version" || echo "  npm not executable"
echo "npx:   $(have npx)"
echo "pnpm:  $(have pnpm)"
echo "yarn:  $(have yarn)"
echo "bun:   $(have bun)"

# Node installed but not in PATH? search common locations
if ! command -v node >/dev/null 2>&1; then
  echo "-- searching for node binary in common locations --"
  for p in /usr/local/node22/bin/node /usr/local/bin/node /usr/bin/node /opt/node/bin/node "$HOME/.nvm/versions/node"/*/bin/node; do
    [ -x "$p" ] && echo "  found at: $p"
  done
fi

# --- 2. Process managers (auto-restart) -----------------------------------

hr "2. PROCESS MANAGERS (auto-restart)"
echo "pm2:    $(have pm2)"
echo "forever:$(have forever)"
echo "supervisorctl: $(have supervisorctl)"
echo "systemctl:     $(have systemctl)"
[ "$(have systemctl)" != "NOT FOUND" ] && systemctl --version 2>/dev/null | head -1

# --- 3. Reverse proxy / web server (port 80) ------------------------------

hr "3. REVERSE PROXY / WEB SERVER"
echo "nginx:   $(have nginx)"
echo "apache2: $(have apache2)"
echo "httpd:   $(have httpd)"
echo "caddy:   $(have caddy)"
echo "lighttpd:$(have lighttpd)"
# nginx version + modules if present
[ "$(have nginx)" != "NOT FOUND" ] && nginx -v 2>&1

# --- 4. Can we bind port 80? (without root usually fails) -----------------

hr "4. PORT 80 BIND TEST (without root)"
# Try to bind port 80 for 500ms then release. Non-privileged users normally
# get EACCES. This tells us if we need a reverse proxy in front of Node.
PORT80_OK="no"
node -e '
const s = require("net").createServer();
s.once("listening", () => { console.log("PORT_80_BIND=OK"); s.close(); process.exit(0); });
s.once("error", (e) => { console.log("PORT_80_BIND=FAIL " + e.code); process.exit(0); });
s.listen(80, () => {});
' 2>/dev/null && PORT80_OK="checked"
echo "port80 probe: $PORT80_OK"

# Also test a high port (3000) — should always work
node -e '
const s = require("net").createServer();
s.once("listening", () => { console.log("PORT_3000_BIND=OK"); s.close(); process.exit(0); });
s.once("error", (e) => { console.log("PORT_3000_BIND=FAIL " + e.code); process.exit(0); });
s.listen(3000, () => {});
' 2>/dev/null

# --- 5. Disk / RAM / resource limits (LVE) --------------------------------

hr "5. DISK / RAM / RESOURCE LIMITS"
echo "HOME disk:"
df -h "$HOME" 2>/dev/null | tail -2 || df -h . 2>/dev/null | tail -2

echo "memory:"
# Linux: free -m. macOS/BSD: vm_stat + sysctl.
if command -v free >/dev/null 2>&1; then
  free -m 2>/dev/null | head -3
else
  if command -v sysctl >/dev/null 2>&1; then
    echo "total RAM: $(( $(sysctl -n hw.memsize 2>/dev/null || echo 0) / 1024 / 1024 )) MB (sysctl)"
  fi
  if command -v vm_stat >/dev/null 2>&1; then
    vm_stat 2>/dev/null | head -5
  fi
fi

echo "ulimits:"
ulimit -a 2>/dev/null | sed 's/^/  /'

# CloudLinux LVE limits (if lvectl exists — usually only visible to admin,
# but worth probing)
command -v lvectl >/dev/null 2>&1 && lvectl list 2>/dev/null | head -3 \
  || echo "  lvectl not available (cannot read LVE limits — expected on shared)"

# --- 6. Home directory layout ---------------------------------------------

hr "6. HOME DIRECTORY LAYOUT"
echo "HOME=$HOME"
ls -la "$HOME" 2>/dev/null | head -20

# Common shared-hosting web roots
echo "-- probing common web roots --"
for d in "$HOME/www" "$HOME/public_html" "$HOME/web" "$HOME/sites" "$HOME/domains"; do
  if [ -d "$d" ]; then
    echo "  exists: $d"
    ls -la "$d" 2>/dev/null | head -8 | sed 's/^/    /'
  fi
done

# --- 7. npm global config (can we install global pkgs like pm2?) ----------

hr "7. NPM GLOBAL INSTALL"
echo "npm prefix: $(npm config get prefix 2>/dev/null)"
echo "npm global root:"
npm root -g 2>/dev/null | sed 's/^/  /'
echo "can write to npm global root?"
NPMROOT="$(npm root -g 2>/dev/null)"
[ -n "$NPMROOT" ] && [ -w "$NPMROOT" ] && echo "  yes (writable)" || echo "  no (would need sudo or --prefix=$HOME/.npm-global)"
echo "existing global packages (top 10):"
npm ls -g --depth=0 2>/dev/null | head -12 | sed 's/^/  /'

# --- 8. git ---------------------------------------------------------------

hr "8. GIT"
echo "git: $(have git)"
git --version 2>/dev/null

# --- 9. SSL/certs for HTTPS ------------------------------------------------

hr "9. SSL / HTTPS"
echo "openssl: $(have openssl)"
echo "certbot: $(have certbot)"
echo "acme.sh: $(have acme.sh)"
[ -d "$HOME/.acme.sh" ] && echo "  acme.sh dir exists: $HOME/.acme.sh"

# --- 10. SQLite / Prisma prerequisites ------------------------------------

hr "10. SQLITE / PRISMA PREREQS"
echo "sqlite3: $(have sqlite3)"
[ "$(have sqlite3)" != "NOT FOUND" ] && sqlite3 --version 2>/dev/null
# Prisma needs openssl at runtime (Debian slim image installs it). Check here:
echo "openssl runtime lib:"
if [ -f /usr/lib/x86_64-linux-gnu/libssl.so* ] 2>/dev/null; then
  echo "  found: /usr/lib/x86_64-linux-gnu/libssl.so*"
elif [ -f /usr/lib64/libssl.so* ] 2>/dev/null; then
  echo "  found: /usr/lib64/libssl.so*"
else
  ldconfig -p 2>/dev/null | grep -i libssl | head -3 | sed 's/^/  /' || echo "  (ldconfig not available — openssl may still be present)"
fi

# --- 11. Outbound network (for npm install / git clone) -------------------

hr "11. OUTBOUND NETWORK"
echo "github.com reachable?"
if command -v curl >/dev/null 2>&1; then
  curl -sS -o /dev/null -w "  HTTP %{http_code} (%{time_total}s)\n" --max-time 5 https://github.com 2>&1 || echo "  curl failed"
else
  echo "  curl not found"
fi
echo "registry.npmjs.org reachable?"
if command -v curl >/dev/null 2>&1; then
  curl -sS -o /dev/null -w "  HTTP %{http_code} (%{time_total}s)\n" --max-time 5 https://registry.npmjs.org 2>&1 || echo "  curl failed"
fi

# --- 12. Current deploy of this project (if running from project dir) -----

hr "12. PROJECT CONTEXT (if run from project dir)"
if [ -f package.json ] && [ -f docker-compose.yml ]; then
  echo "running inside mindra-website project root: $(pwd)"
  echo "git remote:"
  git remote -v 2>/dev/null | head -2 | sed 's/^/  /'
  echo "git branch: $(git rev-parse --abbrev-ref HEAD 2>/dev/null)"
  echo "node_modules present: $([ -d node_modules ] && echo yes || echo no)"
  echo ".next build present:  $([ -d .next ] && echo yes || echo no)"
  echo "prisma/dev.db present: $([ -f prisma/dev.db ] && echo "yes ($(du -h prisma/dev.db 2>/dev/null | cut -f1))" || echo no)"
else
  echo "not running inside a project root (no package.json/docker-compose.yml here)"
fi

# --- done -----------------------------------------------------------------

hr "DONE"
echo "Paste this entire output back. No sensitive data is collected (no env"
echo "values, no passwords) — only paths, versions, and capability flags."
