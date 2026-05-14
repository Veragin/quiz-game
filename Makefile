DOCKER_FILES := docker-compose.yml $(shell find docker/ -type f 2>/dev/null)
DOCKER_CHECKSUM_FILE := .docker-build-checksum
DOCKER_CHECKSUM := $(shell cat $(DOCKER_FILES) 2>/dev/null | md5sum | cut -d' ' -f1)
DOCKER_PREV_CHECKSUM := $(shell cat $(DOCKER_CHECKSUM_FILE) 2>/dev/null)

start: stop
	$(if $(filter $(DOCKER_CHECKSUM),$(DOCKER_PREV_CHECKSUM)), \
		docker compose up -d --remove-orphans, \
		docker compose up -d --build --remove-orphans && echo $(DOCKER_CHECKSUM) > $(DOCKER_CHECKSUM_FILE))

rebuild: stop
	docker compose up -d --build --remove-orphans
	echo $(DOCKER_CHECKSUM) > $(DOCKER_CHECKSUM_FILE)

stop:
	docker compose down

bash:
	docker compose exec quiz-game bash

.SILENT:
.check-ai-params:
ifndef COPILOT_GITHUB_TOKEN
	$(error COPILOT_GITHUB_TOKEN is not set. Export it in your shell (e.g. ~/.bashrc))
endif


build:
	cd client && yarn build
	@echo "Client built. Start server with: cd server && yarn start"

ai: .check-ai-params
	echo "Starting Copilot CLI for TypeScript..."
	docker compose exec -e COPILOT_GITHUB_TOKEN=$(COPILOT_GITHUB_TOKEN) quiz-game bash -c '\
		mkdir -p $$HOME/.copilot && \
		export PATH="$$HOME/.local/bin:$$PATH" && \
		copilot --disable-mcp-server github-mcp-server --allow-all-tools'