package tray

import (
	"fmt"
	"os"
	"path/filepath"
	"runtime"
)

const launchdLabel = "com.kyma-api.kyma-ter"

func isAutoStartEnabled() bool {
	path := autoStartPath()
	if path == "" {
		return false
	}
	_, err := os.Stat(path)
	return err == nil
}

func enableAutoStart() error {
	exe, err := os.Executable()
	if err != nil {
		return fmt.Errorf("resolve executable: %w", err)
	}
	exe, err = filepath.EvalSymlinks(exe)
	if err != nil {
		return fmt.Errorf("resolve symlinks: %w", err)
	}

	path := autoStartPath()
	if path == "" {
		return fmt.Errorf("auto-start not supported on %s", runtime.GOOS)
	}

	if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
		return err
	}

	switch runtime.GOOS {
	case "darwin":
		return os.WriteFile(path, []byte(launchdPlist(exe)), 0644)
	case "linux":
		return os.WriteFile(path, []byte(desktopEntry(exe)), 0644)
	}
	return nil
}

func disableAutoStart() error {
	path := autoStartPath()
	if path == "" {
		return nil
	}
	err := os.Remove(path)
	if os.IsNotExist(err) {
		return nil
	}
	return err
}

func autoStartPath() string {
	configRoot, err := os.UserConfigDir()
	if err != nil {
		return ""
	}
	switch runtime.GOOS {
	case "darwin":
		home, err := os.UserHomeDir()
		if err != nil {
			return ""
		}
		return filepath.Join(home, "Library", "LaunchAgents", launchdLabel+".plist")
	case "linux":
		return filepath.Join(configRoot, "autostart", "kyma-ter.desktop")
	}
	return ""
}

func launchdPlist(exe string) string {
	return fmt.Sprintf(`<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>Label</key>
	<string>%s</string>
	<key>ProgramArguments</key>
	<array>
		<string>%s</string>
		<string>serve</string>
	</array>
	<key>RunAtLoad</key>
	<true/>
	<key>KeepAlive</key>
	<false/>
	<key>StandardOutPath</key>
	<string>/tmp/kyma-ter.log</string>
	<key>StandardErrorPath</key>
	<string>/tmp/kyma-ter.log</string>
</dict>
</plist>
`, launchdLabel, exe)
}

func desktopEntry(exe string) string {
	return fmt.Sprintf(`[Desktop Entry]
Type=Application
Name=Kyma-ter
Exec=%s serve
Terminal=false
X-GNOME-Autostart-enabled=true
`, exe)
}
