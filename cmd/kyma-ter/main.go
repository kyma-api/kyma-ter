package main

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"os"
	"os/exec"
	"runtime"
	"time"

	"github.com/kyma-api/kyma-ter/internal/config"
	"github.com/kyma-api/kyma-ter/internal/db"
	"github.com/kyma-api/kyma-ter/internal/server"
	"github.com/kyma-api/kyma-ter/internal/tray"
	"github.com/kyma-api/kyma-ter/internal/updater"
	"github.com/kyma-api/kyma-ter/internal/web"
	"github.com/spf13/cobra"
)

var (
	Version       = "dev"
	flagPort      int
	flagBind      string
	flagNoTray    bool
	flagNoBrowser bool
)

func main() {
	rootCmd := &cobra.Command{
		Use:     "kyma-ter",
		Short:   "Multi-agent terminal workspace",
		Version: Version,
	}

	serveCmd := &cobra.Command{
		Use:   "serve",
		Short: "Start the kyma-ter server",
		RunE:  runServe,
	}
	serveCmd.Flags().IntVarP(&flagPort, "port", "p", 0, "Port to listen on (default from config or 18800)")
	serveCmd.Flags().StringVarP(&flagBind, "bind", "b", "", "Bind address (default from config or 0.0.0.0)")
	serveCmd.Flags().BoolVar(&flagNoTray, "no-tray", false, "Disable system tray icon")
	serveCmd.Flags().BoolVar(&flagNoBrowser, "no-browser", false, "Don't open the dashboard in a browser on start")

	rootCmd.AddCommand(serveCmd)
	rootCmd.RunE = runServe

	if err := rootCmd.Execute(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func runServe(cmd *cobra.Command, args []string) error {
	updater.ApplyPending()
	updater.CheckInBackground(Version)

	cfg, err := config.Load()
	if err != nil {
		return fmt.Errorf("loading config: %w", err)
	}

	if flagPort > 0 {
		cfg.Port = flagPort
	}
	if flagBind != "" {
		cfg.BindAddr = flagBind
	}

	database, err := db.Open(cfg.DataDir())
	if err != nil {
		return fmt.Errorf("opening database: %w", err)
	}
	defer database.Close()

	srv := server.New(cfg, database, web.FrontendFS())
	srv.Version = Version
	dashboardURL := fmt.Sprintf("http://127.0.0.1:%d", cfg.GetPort())

	// If another kyma-ter is already running on this port, just open the
	// dashboard and exit cleanly. Users running `kyma-ter` twice (or launching
	// it while autostart is active) should land on the UI, not a port-bind error.
	if handled, err := handleExistingInstance(cfg.GetPort(), dashboardURL); err != nil {
		return err
	} else if handled {
		return nil
	}

	if !flagNoBrowser {
		go openDashboardWhenReady(cfg.GetPort(), dashboardURL)
	}

	if !flagNoTray && tray.Supported() {
		// HTTP server runs in background goroutine
		go func() {
			if err := srv.Run(); err != nil {
				log.Fatalf("server error: %v", err)
			}
		}()

		log.Printf("kyma-ter ready · tray icon active · dashboard: %s", dashboardURL)

		// Tray blocks main thread (required by macOS for native UI)
		trayApp := tray.New(cfg.GetPort(), func() {
			log.Println("Quit from tray, shutting down...")
			os.Exit(0)
		})
		trayApp.Run()
		return nil
	}

	if !flagNoTray && !tray.Supported() {
		log.Printf("tray unavailable in this build; starting without tray")
	}
	log.Printf("kyma-ter ready · dashboard: %s", dashboardURL)

	return srv.Run()
}

// openDashboardWhenReady waits for the HTTP server to accept connections, then
// opens the dashboard URL in the user's default browser. Most users don't
// notice the system tray icon, so this gives them an immediate landing page.
func openDashboardWhenReady(port int, url string) {
	addr := fmt.Sprintf("127.0.0.1:%d", port)
	deadline := time.Now().Add(10 * time.Second)
	for time.Now().Before(deadline) {
		conn, err := net.DialTimeout("tcp", addr, 300*time.Millisecond)
		if err == nil {
			conn.Close()
			openBrowser(url)
			return
		}
		time.Sleep(200 * time.Millisecond)
	}
	log.Printf("kyma-ter: server did not become ready in time; skipping browser launch")
}

// handleExistingInstance checks whether another kyma-ter is already bound to
// the target port. If yes, we open the dashboard in the browser and return
// handled=true so the caller exits cleanly — starting a second server would
// just fail with "address already in use" and confuse non-technical users.
// If the port is held by a non-kyma-ter process, we return a clear error.
func handleExistingInstance(port int, url string) (bool, error) {
	addr := fmt.Sprintf("127.0.0.1:%d", port)
	conn, err := net.DialTimeout("tcp", addr, 500*time.Millisecond)
	if err != nil {
		return false, nil
	}
	conn.Close()

	client := &http.Client{Timeout: 2 * time.Second}
	resp, err := client.Get(fmt.Sprintf("http://127.0.0.1:%d/api/v1/health", port))
	if err != nil || resp.StatusCode != 200 {
		if resp != nil {
			resp.Body.Close()
		}
		return false, fmt.Errorf("port %d is in use by another process. Quit it first, or start kyma-ter on a different port with --port", port)
	}
	defer resp.Body.Close()

	// Any 200 on /api/v1/health is assumed to be kyma-ter — the path is
	// unique enough that a collision is extremely unlikely. Older versions
	// (<=0.1.9) don't advertise "service" in the body, so we can't rely on it.
	body, _ := io.ReadAll(io.LimitReader(resp.Body, 1024))
	var envelope struct {
		Success bool `json:"success"`
		Data    struct {
			Service string `json:"service"`
			Version string `json:"version"`
			Status  string `json:"status"`
		} `json:"data"`
	}
	_ = json.Unmarshal(body, &envelope)

	existing := envelope.Data.Version
	if existing == "" {
		existing = "unknown"
	}
	log.Printf("kyma-ter already running (v%s) · opening dashboard: %s", existing, url)
	if !flagNoBrowser {
		openBrowser(url)
	}
	return true, nil
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
		log.Printf("kyma-ter: unsupported platform for browser launch: %s", runtime.GOOS)
		return
	}
	if err := cmd.Start(); err != nil {
		log.Printf("kyma-ter: open browser: %v", err)
	}
}
