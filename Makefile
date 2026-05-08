PODMAN_COMPOSE ?= podman-compose

.PHONY: up down ps logs

up:
	$(PODMAN_COMPOSE) up --build -d

down:
	$(PODMAN_COMPOSE) stop

ps:
	$(PODMAN_COMPOSE) ps

logs:
	$(PODMAN_COMPOSE) logs -f