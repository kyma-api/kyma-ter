.PHONY: build dev frontend backend clean release-binaries install

VERSION ?= dev

# Full production build: frontend + Go binary with embedded SPA
build: frontend backend

# Build frontend and copy to embed location
frontend:
	cd frontend && npm run build
	rm -rf internal/web/dist
	cp -r frontend/dist internal/web/dist

# Build Go binary
backend:
	go build -ldflags "-X main.Version=$(VERSION)" -o kyma-ter ./cmd/kyma-ter/

# Dev mode: run Go server + Vite dev server
dev:
	@echo "Start Go server: go run ./cmd/kyma-ter/ serve --port 18800"
	@echo "Start Vite dev:  cd frontend && npm run dev"
	@echo "(Run these in separate terminals)"

# Build cross-platform binaries for release
release-binaries: frontend
	@mkdir -p dist
	GOOS=darwin GOARCH=arm64 go build -ldflags "-X main.Version=$(VERSION)" -o dist/kyma-ter-darwin-arm64 ./cmd/kyma-ter/
	GOOS=darwin GOARCH=amd64 go build -ldflags "-X main.Version=$(VERSION)" -o dist/kyma-ter-darwin-amd64 ./cmd/kyma-ter/
	GOOS=linux  GOARCH=arm64 go build -ldflags "-X main.Version=$(VERSION)" -o dist/kyma-ter-linux-arm64  ./cmd/kyma-ter/
	GOOS=linux  GOARCH=amd64 go build -ldflags "-X main.Version=$(VERSION)" -o dist/kyma-ter-linux-amd64  ./cmd/kyma-ter/
	@echo "Built v$(VERSION) binaries in dist/"
	@ls -lh dist/

# Install: build and copy to global paths
install: build
	mkdir -p ~/.kyma/ter/bin
	cp kyma-ter ~/.kyma/ter/bin/kyma-ter
	@echo "Installed kyma-ter to ~/.kyma/ter/bin/kyma-ter"
	@if [ -L /opt/homebrew/bin/kyma-ter ]; then \
		echo "Skipped /opt/homebrew/bin/kyma-ter (existing npm/Homebrew shim)"; \
	elif [ -e /opt/homebrew/bin/kyma-ter ]; then \
		cp kyma-ter /opt/homebrew/bin/kyma-ter; \
		echo "Updated /opt/homebrew/bin/kyma-ter"; \
	else \
		echo "No /opt/homebrew/bin/kyma-ter found; PATH launcher unchanged"; \
	fi

# Clean build artifacts
clean:
	rm -f kyma-ter
	rm -rf frontend/dist internal/web/dist dist
