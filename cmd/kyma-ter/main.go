package main

import (
	"fmt"
	"log"
	"os"

	"github.com/sonpiaz/kyma-ter/internal/config"
	"github.com/sonpiaz/kyma-ter/internal/db"
	"github.com/sonpiaz/kyma-ter/internal/server"
	"github.com/sonpiaz/kyma-ter/internal/tray"
	"github.com/sonpiaz/kyma-ter/internal/updater"
	"github.com/sonpiaz/kyma-ter/internal/web"
	"github.com/spf13/cobra"
)

var (
	Version    = "dev"
	flagPort   int
	flagBind   string
	flagNoTray bool
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

	if !flagNoTray {
		// HTTP server runs in background goroutine
		go func() {
			if err := srv.Run(); err != nil {
				log.Fatalf("server error: %v", err)
			}
		}()

		// Tray blocks main thread (required by macOS for native UI)
		trayApp := tray.New(cfg.GetPort(), func() {
			log.Println("Quit from tray, shutting down...")
			os.Exit(0)
		})
		trayApp.Run()
		return nil
	}

	return srv.Run()
}
