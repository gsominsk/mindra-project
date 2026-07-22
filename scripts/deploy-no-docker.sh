#!/usr/bin/env bash
# deploy-no-docker.sh — production deploy of mindra-website on a shared
# hosting account WITHOUT Docker (Beget / CloudLinux / no root).
#
# What this script does:
#   1. git pull origin main
#   2. Ensure ~/mindra-data/ exists (SQLite OUTSIDE the git clone)
#   3. Ensure .env exists (from env.example), prompt for missing values
#   4. npm ci
#   5. npx prisma generate
#   6. npx prisma migrate deploy (applies migrations to ~/mindra-data/dev.db)
#   7. npm run build
#   8. Print next-step instructions (panel config / pm2 / nohup)
#
# What this script does NOT do:
#   - Start the app (you choose: Node.js Selector panel, pm2, or nohup)
#   - Configure reverse proxy (done in Beget panel)
#   - Install pm2 globally (no root — use local install if needed)
#
# Usage:
#   cd ~/mindra-project
#   bash scripts/deploy-no-docker.sh
#
# Safe to re-run — each step is idempotent.

set -euo pipefail

# --- config ---------------------------------------------------------------

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DATA_DIR="$HOME/mindra-data"
ENV_FILE="$PROJECT_DIR/.env"
ENV_EXAMPLE="$PROJECT_DIR/env.example"
DB_PATH="$DATA_DIR/dev.db"

# Colors (if terminal supports them)
if [ -t 1 ]; then
  RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'
  BOLD='\033[1m'; NC='\033[0m'
else
  RED=''; GREEN=''; YELLOW=''; BLUE=''; BOLD=''; NC=''
fi

# --- helpers --------------------------------------------------------------

hr() { printf "\n${BOLD}${BLUE}=== %s ===${NC}\n" "$1"; }
ok()  { printf "${GREEN}✅ %s${NC}\n" "$1"; }
warn(){ printf "${YELLOW}⚠️  %s${NC}\n" "$1"; }
err() { printf "${RED}🔴 %s${NC}\n" "$1"; }
die() { err "$1"; exit 1; }
ask() { printf "${YELLOW}%s${NC}" "$1"; read -r "$2"; }

# --- step 0: hosting detect (auto-detect Beget/CloudLinux capabilities) ---

hr "STEP 0: HOSTING DETECT"

# Detect CloudLinux Node.js Selector (auto-restart + nginx proxy via panel)
SELECTOR_AVAILABLE=false
if [ -d "$HOME/.cl.selector" ]; then
  SELECTOR_AVAILABLE=true
  ok "CloudLinux Node.js Selector: available (auto-restart + nginx proxy via panel)"
else
  warn "CloudLinux Node.js Selector: NOT detected — will need pm2/nohup + manual reverse proxy"
fi

# Detect domains bound to account (~/www/<domain>/ is Beget convention)
DOMAINS_FOUND=""
if [ -d "$HOME/www" ]; then
  DOMAINS_FOUND="$(ls "$HOME/www" 2>/dev/null)"
fi
if [ -n "$DOMAINS_FOUND" ]; then
  ok "Domains bound: $(echo "$DOMAINS_FOUND" | tr '\n' ' ')"
else
  warn "No domains in ~/www/ — bind a domain in Beget panel before going live"
  warn "  (the app will still run on http://localhost:3000 for testing)"
fi

# Detect .htaccess in ~/public (for Apache reverse proxy :3000)
HTACCESS_EXISTS=false
[ -f "$HOME/public/.htaccess" ] && HTACCESS_EXISTS=true
if [ "$HTACCESS_EXISTS" = "true" ]; then
  ok ".htaccess exists in ~/public/ (Apache reverse proxy possible)"
else
  warn "No .htaccess in ~/public/ — reverse proxy rules needed for port 80"
  echo "  The script will generate one at the end if you choose Option B/C."
fi

# LVE RAM limit is NOT readable on this hosting (memory cgroup not exposed).
# We mitigate by limiting Node heap during build and catching OOM.
warn "LVE RAM limit not readable (cgroup memory not exposed)."
echo "  Build will use --max-old-space-size=512 to avoid OOM-kill."
echo "  If build still fails with OOM, see rsync fallback instructions."

ok "hosting detect complete"

# --- preflight ------------------------------------------------------------

hr "PREFLIGHT"

# Check we're in the project dir
[ -f "$PROJECT_DIR/package.json" ] || die "Not in project root (no package.json at $PROJECT_DIR)"
[ -f "$PROJECT_DIR/docker-compose.yml" ] || die "Not in mindra-website project (no docker-compose.yml)"

# Check Node/npm
command -v node >/dev/null 2>&1 || die "node not found in PATH"
command -v npm  >/dev/null 2>&1 || die "npm not found in PATH"
NODE_VER="$(node --version)"
NPM_VER="$(npm --version)"
echo "Node: $NODE_VER at $(command -v node)"
echo "npm:  $NPM_VER at $(command -v npm)"
echo "Project: $PROJECT_DIR"
echo "Data dir: $DATA_DIR"
echo "DB path:  $DB_PATH"

# Check git
command -v git >/dev/null 2>&1 || die "git not found"
ok "preflight passed"

# --- step 1: git pull -----------------------------------------------------

hr "STEP 1/7: git pull"

cd "$PROJECT_DIR"
echo "Current branch: $(git rev-parse --abbrev-ref HEAD)"
echo "Current commit: $(git rev-parse --short HEAD)"
echo "Pulling..."
if git pull origin main; then
  ok "git pull complete → $(git rev-parse --short HEAD)"
else
  warn "git pull had issues (maybe no remote or network). Continuing with current state."
fi

# --- step 2: data dir (SQLite outside clone) ------------------------------

hr "STEP 2/7: data dir (SQLite outside clone)"

if [ -d "$DATA_DIR" ]; then
  ok "data dir exists: $DATA_DIR"
else
  echo "Creating $DATA_DIR (SQLite will live here, outside the git clone)"
  mkdir -p "$DATA_DIR"
  chmod 700 "$DATA_DIR"
  ok "data dir created"
fi

# If a dev.db already exists in the clone, offer to move it
if [ -f "$PROJECT_DIR/prisma/dev.db" ] && [ ! -f "$DB_PATH" ]; then
  warn "Found prisma/dev.db in the clone ($(du -h "$PROJECT_DIR/prisma/dev.db" 2>/dev/null | cut -f1))"
  ask "Move it to $DB_PATH? (y/N): " MOVE_DB
  if [ "${MOVE_DB:-N}" = "y" ] || [ "${MOVE_DB:-N}" = "Y" ]; then
    mv "$PROJECT_DIR/prisma/dev.db" "$DB_PATH"
    ok "moved prisma/dev.db → $DB_PATH"
  else
    warn "Keeping prisma/dev.db in clone. DATABASE_URL should point there."
    DB_PATH="$PROJECT_DIR/prisma/dev.db"
  fi
fi

# --- step 3: .env ---------------------------------------------------------

hr "STEP 3/7: .env configuration"

need_to_create_env=false
if [ -f "$ENV_FILE" ]; then
  ok ".env exists at $ENV_FILE"
  # Check for critical vars
  MISSING=""
  grep -q "JWT_SECRET" "$ENV_FILE" 2>/dev/null || MISSING="$MISSING JWT_SECRET"
  grep -q "DATABASE_URL" "$ENV_FILE" 2>/dev/null || MISSING="$MISSING DATABASE_URL"
  grep -q "ADMIN_PASSWORD" "$ENV_FILE" 2>/dev/null || MISSING="$MISSING ADMIN_PASSWORD"
  if [ -n "$MISSING" ]; then
    warn ".env is missing:$MISSING"
    ask "Regenerate .env from env.example? (y/N): " REGEN
    if [ "${REGEN:-N}" = "y" ] || [ "${REGEN:-N}" = "Y" ]; then
      need_to_create_env=true
    fi
  fi
else
  warn ".env does NOT exist"
  need_to_create_env=true
fi

if [ "$need_to_create_env" = "true" ]; then
  [ -f "$ENV_EXAMPLE" ] || die "env.example not found at $ENV_EXAMPLE — git pull may have failed"
  echo "Creating .env from env.example..."
  cp "$ENV_EXAMPLE" "$ENV_FILE"

  # Generate JWT_SECRET
  JWT_SECRET="$(openssl rand -hex 32 2>/dev/null || echo 'CHANGE_ME_'$(date +%s))"
  echo "Generated JWT_SECRET (openssl rand -hex 32)"

  # Set DATABASE_URL to the external DB path
  echo "Setting DATABASE_URL=file:$DB_PATH"

  # Use sed to replace values in .env
  # JWT_SECRET
  if grep -q "^JWT_SECRET=" "$ENV_FILE"; then
    sed -i "s|^JWT_SECRET=.*|JWT_SECRET=\"$JWT_SECRET\"|" "$ENV_FILE" 2>/dev/null || \
    sed -i.bak "s|^JWT_SECRET=.*|JWT_SECRET=\"$JWT_SECRET\"|" "$ENV_FILE" && rm -f "$ENV_FILE.bak"
  else
    echo "JWT_SECRET=\"$JWT_SECRET\"" >> "$ENV_FILE"
  fi

  # DATABASE_URL
  if grep -q "^DATABASE_URL=" "$ENV_FILE"; then
    sed -i "s|^DATABASE_URL=.*|DATABASE_URL=\"file:$DB_PATH\"|" "$ENV_FILE" 2>/dev/null || \
    sed -i.bak "s|^DATABASE_URL=.*|DATABASE_URL=\"file:$DB_PATH\"|" "$ENV_FILE" && rm -f "$ENV_FILE.bak"
  else
    echo "DATABASE_URL=\"file:$DB_PATH\"" >> "$ENV_FILE"
  fi

  chmod 600 "$ENV_FILE"
  ok ".env created with JWT_SECRET and DATABASE_URL"
  warn "⚠️  EDIT .env NOW — set these before continuing:"
  echo "    ADMIN_PASSWORD   (currently 'change-me' — set a strong password)"
  echo "    PARTY_PROMPTS_PASS (currently 'change-me' — set a strong password)"
  echo "    SMTP_HOST/PORT/USER/PASS/RECIPIENT_EMAIL"
  echo "    OPENROUTER_API_KEY (rotate if used in dev — see memory-bank 19.5)"
  echo "    NVIDIA_API_KEY (if using nvidia provider)"
  echo "    LLM_PROVIDER (openrouter or nvidia)"
  echo "    IG_TARGET_PROFILE"
  echo ""
  ask "Have you edited .env with real values? (y/N): " ENV_DONE
  [ "${ENV_DONE:-N}" = "y" ] || [ "${ENV_DONE:-N}" = "Y" ] || die "Please edit .env first, then re-run this script."
fi

# Show .env keys (values hidden)
echo ".env keys (values hidden):"
grep -E "^[A-Z_]+=" "$ENV_FILE" | sed 's/=.*/=<set>/' | sed 's/^/  /'
ok ".env ready"

# --- step 4: npm ci -------------------------------------------------------

hr "STEP 4/7: npm ci (install dependencies)"

cd "$PROJECT_DIR"
echo "Installing dependencies (this may take a few minutes)..."
if npm ci; then
  ok "npm ci complete"
else
  # npm ci requires package-lock.json — fallback to npm install
  warn "npm ci failed (maybe no package-lock.json) — trying npm install..."
  npm install || die "npm install failed"
  ok "npm install complete"
fi

# --- step 5: prisma generate ----------------------------------------------

hr "STEP 5/7: prisma generate"

cd "$PROJECT_DIR"
echo "Generating Prisma client..."
npx prisma generate || die "prisma generate failed"
ok "prisma client generated"

# --- step 6: prisma migrate deploy ----------------------------------------

hr "STEP 6/7: prisma migrate deploy"

cd "$PROJECT_DIR"
echo "Applying migrations to $DB_PATH ..."
# Load DATABASE_URL from .env for the migrate command
export DATABASE_URL="file:$DB_PATH"
npx prisma migrate deploy || die "prisma migrate deploy failed"
ok "migrations applied to $DB_PATH"

# --- step 7: build --------------------------------------------------------

hr "STEP 7/7: npm run build"

cd "$PROJECT_DIR"

# If .next already exists (e.g. uploaded via rsync after local build), skip
if [ -d "$PROJECT_DIR/.next" ] && [ -f "$PROJECT_DIR/.next/BUILD_ID" ]; then
  ok ".next/ already present (BUILD_ID: $(cat "$PROJECT_DIR/.next/BUILD_ID")) — skipping build"
  echo "  (If you want to rebuild, remove .next/ and re-run this script.)"
else
  echo "Building Next.js (this may take a few minutes)..."
  echo "Using --max-old-space-size=512 to respect shared-hosting RAM limits."
  echo "If this fails with OOM, build locally and rsync .next/ (see below)."
  echo ""

  # Limit Node heap to avoid LVE OOM-kill (cgroup memory limit not readable)
  if NODE_OPTIONS="--max-old-space-size=512" NODE_ENV=production npm run build 2>&1 | tee /tmp/mindra-build.log; then
    ok "build complete"
  else
    BUILD_EXIT=${PIPESTATUS[0]}
    err "BUILD FAILED (exit $BUILD_EXIT)"
    # Detect OOM specifically
    if grep -qiE "heap out of memory|Cannot allocate memory|ENOMEM|Out of memory" /tmp/mindra-build.log; then
      warn "Detected: Out of Memory (OOM) — LVE RAM limit too low for build."
      echo ""
      echo "${BOLD}FALLBACK — build locally and upload:${NC}"
      echo "  1. On your Mac (in project root):"
      echo "       npm run build"
      echo "  2. Upload .next/ and node_modules/ to server:"
      echo "       rsync -avz --exclude='.env' .next/ ct603752@hosting-3.default-host.net:~/mindra-project/.next/"
      echo "       rsync -avz --exclude='.env' node_modules/ ct603752@hosting-3.default-host.net:~/mindra-project/node_modules/"
      echo "  3. Re-run this script — it will detect .next/ and skip build."
    else
      echo "Build log saved to /tmp/mindra-build.log — inspect for details."
    fi
    die "build failed — see instructions above"
  fi
fi

# --- done: print next steps (auto-tailored to detected hosting) -----------

hr "DEPLOY COMPLETE — NEXT STEPS"

echo ""
echo "The app is built and ready. Based on hosting detection:"
echo ""

# Recommend run option based on auto-detect
if [ "$SELECTOR_AVAILABLE" = "true" ]; then
  echo "${BOLD}▶ RECOMMENDED: OPTION A — CloudLinux Node.js Selector${NC} (auto-detected: ~/.cl.selector/ exists)"
  echo "  1. Open Beget panel → 'Node.js' (or 'CloudLinux Selector')"
  echo "  2. Create app:"
  echo "       App root:  $PROJECT_DIR"
  echo "       Node.js:   22"
  echo "       Entry:     npm start"
  echo "       Port:      3000"
  echo "  3. Set environment: NODE_ENV=production"
  echo "  4. Start the app from the panel"
  echo "  5. Panel auto-configures nginx proxy to port 80 + auto-restart"
  echo ""
  echo "${BOLD}FALLBACK: OPTION B — pm2 (local install, no root needed)${NC}"
  echo "  cd $PROJECT_DIR"
  echo "  npm install pm2   # local install in node_modules"
  echo "  npx pm2 start 'npm start -- -p 3000' --name mindra"
  echo "  npx pm2 save"
  echo "  # Then configure reverse proxy (.htaccess below)"
  echo ""
else
  echo "${BOLD}▶ RECOMMENDED: OPTION B — pm2${NC} (Selector not detected)"
  echo "  cd $PROJECT_DIR"
  echo "  npm install pm2"
  echo "  npx pm2 start 'npm start -- -p 3000' --name mindra"
  echo "  npx pm2 save"
  echo ""
  echo "${BOLD}FALLBACK: OPTION C — nohup (quick test, NOT production)${NC}"
  echo "  cd $PROJECT_DIR"
  echo "  NODE_ENV=production nohup npm start -- -p 3000 > ~/mindra-app.log 2>&1 &"
  echo ""
fi

# Reverse proxy guidance
echo "${BOLD}REVERSE PROXY (port 80 → 3000)${NC}"
if [ "$SELECTOR_AVAILABLE" = "true" ]; then
  echo "  Option A handles this automatically (panel nginx proxy)."
else
  echo "  No Selector — you need .htaccess with proxy rules."
fi

# Auto-generate .htaccess if missing and ~/public exists
if [ "$HTACCESS_EXISTS" = "false" ] && [ -d "$HOME/public" ]; then
  echo ""
  echo "${BOLD}GENERATING .htaccess${NC} at ~/public/.htaccess"
  cat > "$HOME/public/.htaccess" <<'HTACCESS'
# Auto-generated by deploy-no-docker.sh — proxy to Node.js app on port 3000
RewriteEngine On
RewriteRule ^(.*)$ http://127.0.0.1:3000/$1 [P,L]
HTACCESS
  ok ".htaccess created at $HOME/public/.htaccess"
  warn "If using Option A (Selector), you may not need this — remove if it conflicts."
elif [ "$HTACCESS_EXISTS" = "true" ]; then
  ok ".htaccess already exists — review it manually for proxy rules."
else
  echo "  Add to ~/public/.htaccess:"
  echo "    RewriteEngine On"
  echo "    RewriteRule ^(.*)$ http://127.0.0.1:3000/\$1 [P,L]"
fi
echo ""

# Domain-aware verification
echo "${BOLD}VERIFY${NC}"
echo "  curl http://localhost:3000/login        → should be HTTP 200"
if [ -n "$DOMAINS_FOUND" ]; then
  FIRST_DOMAIN="$(echo "$DOMAINS_FOUND" | head -1)"
  echo "  curl http://$FIRST_DOMAIN/login          → should be HTTP 200 (after proxy setup)"
  echo "  curl https://$FIRST_DOMAIN/login         → should be HTTP 200 (after SSL setup in panel)"
else
  echo "  curl http://<your-domain>/login         → after you bind a domain in Beget panel"
fi
echo ""

ok "deploy script finished"
