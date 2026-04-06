.PHONY: deps deps-down logs catalog-health broker-health reset-catalog \
       install-typescript dev-typescript run-typescript build-typescript clean-typescript \
       dev-java run-java build-java clean-java

# ─── Dependencies ────────────────────────────────────────────────────────────

## Start all dependency services (Medication Catalog, Message Broker, Insurance Authorization)
deps:
	docker compose up --build -d
	@echo ""
	@echo "Dependencies are starting..."
	@echo "  Medication Catalog:       http://localhost:3050"
	@echo "  Message Broker:           http://localhost:3060"
	@echo "  Insurance Authorization:  http://localhost:3070"
	@echo ""
	@echo "Waiting for services to be healthy..."
	@docker compose wait medication-catalog message-broker 2>/dev/null || sleep 5
	@echo "Dependencies are ready!"

## Stop all dependency services
deps-down:
	docker compose down

## Show dependency logs
logs:
	docker compose logs -f

# ─── Prescription Service (Node.js + TypeScript) ────────────────────────────

## Install dependencies for the TypeScript prescription service
install-typescript:
	cd prescription-service-typescript && npm install

## Run the TypeScript prescription service in development mode (with auto-reload)
dev-typescript: install-typescript
	cd prescription-service-typescript && npm run dev

## Build the TypeScript prescription service
build-typescript: install-typescript
	cd prescription-service-typescript && npm run build

## Run the TypeScript prescription service (production build)
run-typescript: build-typescript
	cd prescription-service-typescript && npm start

## Remove TypeScript build artifacts
clean-typescript:
	rm -rf prescription-service-typescript/dist prescription-service-typescript/node_modules

# ─── Prescription Service (Java + Spring Boot) ─────────────────────────────

## Run the Java prescription service in development mode
dev-java:
	cd prescription-service-java && ./gradlew bootRun

## Build the Java prescription service
build-java:
	cd prescription-service-java && ./gradlew bootJar

## Run the Java prescription service (production build)
run-java: build-java
	java -jar prescription-service-java/build/libs/prescription-service-1.0.0.jar

## Remove Java build artifacts
clean-java:
	cd prescription-service-java && ./gradlew clean

# ─── Utilities ───────────────────────────────────────────────────────────────

## Check if the Medication Catalog is running
catalog-health:
	@curl -s http://localhost:3050/health | python3 -m json.tool 2>/dev/null || echo "Medication Catalog is not running"

## Check if the Message Broker is running
broker-health:
	@curl -s http://localhost:3060/health | python3 -m json.tool 2>/dev/null || echo "Message Broker is not running"

## Reset the Medication Catalog stock to initial values
reset-catalog:
	@curl -s -X POST http://localhost:3050/medications/reset | python3 -m json.tool 2>/dev/null || echo "Medication Catalog is not running"
