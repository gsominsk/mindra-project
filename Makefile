# Mindra Website Makefile
# Central console logic for running the frontend, database, and Instagram Sync scripts.

-include .env
PROFILE ?= $(IG_TARGET_PROFILE)

.PHONY: help dev build install lint studio 
.PHONY: sync-healthcheck sync-daily sync-initial sync-retry-dlq sync-test sync-load-test check-profile

help: ## Show this help menu
	@echo "==========================================="
	@echo "           MINDRA WEBSITE CONTROLS         "
	@echo "==========================================="
	@echo "Frontend Commands:"
	@echo "  make dev          Start the Next.js development server"
	@echo "  make build        Build the Next.js app for production"
	@echo "  make install      Install both Node.js AND Python dependencies"
	@echo "  make lint         Run eslint and types check"
	@echo "  make studio       Open Prisma Studio to browse database"
	@echo ""
	@echo "Instagram Sync Commands:"
	@echo "  make sync-login       LOGIN=<name>    Extract session cookie from Chrome for your account"
	@echo "  make sync-healthcheck [PROFILE=<name>]  Safe 'dry-run' test (downloads only the newest 3 posts, skips CMS)"
	@echo "  make sync-daily       [PROFILE=<name>]  Normal sync (downloads new posts and uploads them)"
	@echo "  make sync-initial     [PROFILE=<name>]  Full history sync (downloads everything starting from the newest)"
	@echo "  make sync-retry-dlq   [PROFILE=<name>]  Retry failed posts stuck in the DLQ"
	@echo "  make sync-single      SHORTCODE=<id>  Sync exactly one specific post"
	@echo ""
	@echo "Testing Commands:"
	@echo "  make sync-tests       Run the automated pytest suite for the python pipeline"
	@echo "  make sync-load-test   Run the local 500-post load test"
	@echo "==========================================="

# -----------------
# FRONTEND COMMANDS
# -----------------

dev: ## Start the Next.js dev server
	npm run dev

build: ## Build the app for production
	npm run build

install: ## Install web and python dependencies
	npm install
	cd scripts/instagram_sync && pip install -r requirements.txt
	cd scripts/instagram_sync && pip install -r requirements-dev.txt

lint: ## Run Linter
	npm run lint

studio: ## Open Prisma Studio
	npx prisma studio

# -----------------
# PYTHON SYNC COMMANDS
# -----------------

check-profile:
	@if [ -z "$(PROFILE)" ]; then echo "\n❌ Error: PROFILE or IG_TARGET_PROFILE in .env is required.\n💡 Usage: make sync-healthcheck PROFILE=username\n"; exit 1; fi

sync-login: ## Extract session cookie from Chrome
	@if [ -z "$(LOGIN)" ]; then echo "\n❌ Error: LOGIN is required.\n💡 Usage: make sync-login LOGIN=your_instagram_username\n"; exit 1; fi
	python3 -m instaloader --load-cookies Chrome --login $(LOGIN)
	cp ~/.config/instaloader/session-$(LOGIN) scripts/instagram_sync/session.cookie
	@echo "\n✅ Successfully saved cookie for $(LOGIN) to scripts/instagram_sync/session.cookie!"

sync-healthcheck: check-profile ## Safely test the pipeline without affecting CMS
	python3 -m scripts.instagram_sync.entrypoint --mode fetch --profile $(PROFILE) --limit 3 --dry-run

sync-fetch: check-profile ## Step 1: Download new posts and enqueue to DB
	python3 -m scripts.instagram_sync.entrypoint --mode fetch --profile $(PROFILE)

sync-process: ## Step 2: Process posts from Queue via LLM
	python3 -m scripts.instagram_sync.entrypoint --mode process-queue

sync-tests: ## Run Pytest suite
	python3 -m pytest scripts/instagram_sync/tests/ -v --tb=short

sync-load-test: ## Run the load test
	python3 -m scripts.instagram_sync.load_test --posts 500
