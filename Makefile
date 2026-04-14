.PHONY: build dev frontend backend clean

# Full production build: frontend + Go binary with embedded SPA
build: frontend backend

# Build frontend and copy to embed location
frontend:
	cd frontend && npm run build
	rm -rf internal/web/dist
	cp -r frontend/dist internal/web/dist

# Build Go binary
backend:
	go build -o kyma-ter ./cmd/kyma-ter/

# Dev mode: run Go server + Vite dev server
dev:
	@echo "Start Go server: go run ./cmd/kyma-ter/ serve --port 18800"
	@echo "Start Vite dev:  cd frontend && npm run dev"
	@echo "(Run these in separate terminals)"

# Clean build artifacts
clean:
	rm -f kyma-ter
	rm -rf frontend/dist internal/web/dist
