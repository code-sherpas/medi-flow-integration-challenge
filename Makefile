.PHONY: deps deps-down install dev run build clean logs catalog-health broker-health reset-catalog

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

# ─── Prescription Service ────────────────────────────────────────────────────

## Install dependencies for the prescription service
install:
	cd prescription-service && npm install

## Run the prescription service in development mode (with auto-reload)
dev: install
	cd prescription-service && npm run dev

## Build the prescription service
build: install
	cd prescription-service && npm run build

## Run the prescription service (production build)
run: build
	cd prescription-service && npm start

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

## Remove build artifacts
clean:
	rm -rf prescription-service/dist prescription-service/node_modules
