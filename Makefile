.PHONY: build up down restart logs logs-server logs-client ps clean db-migrate db-push push push-client push-server push-admin

# 建置所有 image
build:
	docker compose build

# 建置並啟動所有服務
up:
	docker compose up -d

# 建置後啟動（強制重新 build）
up-build:
	docker compose up -d --build

# 停止所有服務
down:
	docker compose down

# 停止並清除 volume
down-clean:
	docker compose down -v

# 重啟所有服務
restart:
	docker compose restart

# 查看所有服務 log
logs:
	docker compose logs -f

# 查看 server log
logs-server:
	docker compose logs -f server

# 查看 client log
logs-client:
	docker compose logs -f client

# 查看服務狀態
ps:
	docker compose ps

# 執行 prisma migrate
db-migrate:
	docker compose exec server npx prisma migrate dev

# 執行 prisma db push
db-push:
	docker compose exec server npx prisma db push

# 只建置 client
build-client:
	docker compose build client

# 只建置 server
build-server:
	docker compose build server

# 只建置 admin
build-admin:
	docker compose build admin

# === Push images ===

# docker compose builds images tagged clocdot/<svc>:local, so publishing means
# retagging them for the target registry first.
# Override when publishing: make push REGISTRY=ghcr.io/example/clocdot TAG=v1.0.0
REGISTRY ?= ghcr.io/your-org/clocdot
TAG ?= latest

# Build (linux/amd64) + push client, server 和 admin
push: push-server push-client push-admin

# 只 push server
push-server:
	DOCKER_DEFAULT_PLATFORM=linux/amd64 docker compose build server
	docker tag clocdot/server:local $(REGISTRY)/server:$(TAG)
	docker push $(REGISTRY)/server:$(TAG)

# 只 push client
push-client:
	DOCKER_DEFAULT_PLATFORM=linux/amd64 docker compose build client
	docker tag clocdot/client:local $(REGISTRY)/client:$(TAG)
	docker push $(REGISTRY)/client:$(TAG)

# 只 push admin
push-admin:
	DOCKER_DEFAULT_PLATFORM=linux/amd64 docker compose build admin
	docker tag clocdot/admin:local $(REGISTRY)/admin:$(TAG)
	docker push $(REGISTRY)/admin:$(TAG)
