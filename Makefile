.PHONY: up down build logs test

up:
	podman-compose up -d --build

down:
	podman-compose down

build:
	podman-compose build --no-cache

logs:
	podman-compose logs -f

test:
	bash tests/api.sh
