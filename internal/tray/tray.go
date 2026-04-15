package tray

import (
	"fmt"
	"log"
	"os/exec"
	"runtime"

	"fyne.io/systray"
)

func init() {
	// macOS requires the tray to run on the main OS thread.
	runtime.LockOSThread()
}

// App manages the system tray icon and menu.
type App struct {
	port   int
	onQuit func()
}

// New creates a tray app that links to the given port.
func New(port int, onQuit func()) *App {
	return &App{port: port, onQuit: onQuit}
}

// Run blocks the calling goroutine (must be main thread on macOS).
// It runs the system tray event loop until Quit is triggered.
func (a *App) Run() {
	systray.Run(a.onReady, a.onExit)
}

func (a *App) onReady() {
	systray.SetTemplateIcon(iconBytes, iconBytes)
	systray.SetTooltip("Kyma-ter")

	mOpen := systray.AddMenuItem("Open Dashboard", "Open Kyma-ter in browser")
	mAutoStart := systray.AddMenuItemCheckbox("Launch at Login", "Start Kyma-ter on login", isAutoStartEnabled())
	systray.AddSeparator()
	mQuit := systray.AddMenuItem("Quit", "Quit Kyma-ter")

	go func() {
		for {
			select {
			case <-mOpen.ClickedCh:
				url := fmt.Sprintf("http://127.0.0.1:%d", a.port)
				openBrowser(url)
			case <-mAutoStart.ClickedCh:
				if mAutoStart.Checked() {
					if err := disableAutoStart(); err != nil {
						log.Printf("tray: disable auto-start: %v", err)
					}
					mAutoStart.Uncheck()
				} else {
					if err := enableAutoStart(); err != nil {
						log.Printf("tray: enable auto-start: %v", err)
					}
					mAutoStart.Check()
				}
			case <-mQuit.ClickedCh:
				systray.Quit()
			}
		}
	}()
}

func (a *App) onExit() {
	if a.onQuit != nil {
		a.onQuit()
	}
}

func openBrowser(url string) {
	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "darwin":
		cmd = exec.Command("open", url)
	case "linux":
		cmd = exec.Command("xdg-open", url)
	default:
		cmd = exec.Command("open", url)
	}
	if err := cmd.Start(); err != nil {
		log.Printf("tray: open browser: %v", err)
	}
}
