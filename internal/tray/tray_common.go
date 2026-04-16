package tray

import (
	"log"
	"os/exec"
	"runtime"
)

// App manages the optional system tray integration.
type App struct {
	port   int
	onQuit func()
}

// New creates a tray app that links to the given port.
func New(port int, onQuit func()) *App {
	return &App{port: port, onQuit: onQuit}
}

func openBrowser(url string) {
	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "darwin":
		cmd = exec.Command("open", url)
	case "linux":
		cmd = exec.Command("xdg-open", url)
	case "windows":
		cmd = exec.Command("rundll32", "url.dll,FileProtocolHandler", url)
	default:
		log.Printf("tray: unsupported platform for browser launch: %s", runtime.GOOS)
		return
	}
	if err := cmd.Start(); err != nil {
		log.Printf("tray: open browser: %v", err)
	}
}
