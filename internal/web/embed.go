package web

import (
	"embed"
	"io/fs"
)

//go:embed dist
var frontendEmbed embed.FS

// FrontendFS returns the embedded frontend filesystem, or nil if not available.
func FrontendFS() fs.FS {
	sub, err := fs.Sub(frontendEmbed, "dist")
	if err != nil {
		return nil
	}
	// Check if index.html exists (it won't if dist/ is empty/missing during dev)
	if _, err := sub.Open("index.html"); err != nil {
		return nil
	}
	return sub
}
