//go:build cgo && (darwin || linux || windows)

package tray

import (
	"fmt"
	"log"
	"runtime"

	"fyne.io/systray"
)

func init() {
	// macOS requires the tray to run on the main OS thread.
	runtime.LockOSThread()
}

// Supported reports whether native tray support is available in this build.
func Supported() bool {
	return true
}

// Run blocks the calling goroutine when native tray support is available.
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
