//go:build !cgo || !(darwin || linux || windows)

package tray

import "log"

// Supported reports whether native tray support is available in this build.
func Supported() bool {
	return false
}

// Run is a no-op fallback used for cross-builds and environments without tray support.
func (a *App) Run() {
	log.Printf("tray: native tray support unavailable in this build")
}
