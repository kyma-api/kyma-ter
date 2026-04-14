package server

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"io/fs"
	"log"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"github.com/gorilla/mux"
	"github.com/sonpiaz/kyma-ter/internal/config"
	"github.com/sonpiaz/kyma-ter/internal/db"
	"github.com/sonpiaz/kyma-ter/internal/ptymanager"
	"github.com/sonpiaz/kyma-ter/internal/wsbridge"
)

type Server struct {
	cfg       *config.Config
	db        *db.DB
	pty       *ptymanager.Manager
	events    *wsbridge.EventBroadcaster
	router    *mux.Router
	frontendFS fs.FS // embedded frontend, nil in dev mode
}

func New(cfg *config.Config, database *db.DB, frontendFS ...fs.FS) *Server {
	s := &Server{
		cfg:    cfg,
		db:     database,
		pty:    ptymanager.NewManager(),
		events: wsbridge.NewEventBroadcaster(),
		router: mux.NewRouter(),
	}
	if len(frontendFS) > 0 && frontendFS[0] != nil {
		s.frontendFS = frontendFS[0]
	}

	// PTY exit callback: update DB + broadcast event
	s.pty.OnExit = func(sessionID string, exitCode int) {
		s.db.UpdateSessionExited(sessionID, exitCode)
		s.events.Broadcast(map[string]interface{}{
			"event": "session_exited",
			"data": map[string]interface{}{
				"session_id": sessionID,
				"exit_code":  exitCode,
			},
		})
	}

	s.registerRoutes()

	// Start stale lock cleanup
	go s.staleLockCleanup()

	// Start orphaned session cleanup
	go s.orphanSessionCleanup()

	return s
}

func (s *Server) registerRoutes() {
	// CORS middleware
	s.router.Use(corsMiddleware)

	// WebSocket routes (no timeout)
	s.router.HandleFunc("/ws/terminal/{sessionID}", wsbridge.HandleTerminalWS(s.pty))
	s.router.HandleFunc("/ws/events", s.events.HandleEventsWS)

	// API routes
	api := s.router.PathPrefix("/api/v1").Subrouter()

	api.HandleFunc("/health", s.handleHealth).Methods("GET")

	// Sessions
	api.HandleFunc("/sessions", s.handleCreateSession).Methods("POST")
	api.HandleFunc("/sessions", s.handleListSessions).Methods("GET")
	api.HandleFunc("/sessions/{id}", s.handleGetSession).Methods("GET")
	api.HandleFunc("/sessions/{id}", s.handleDeleteSession).Methods("DELETE")
	api.HandleFunc("/sessions/{id}/resize", s.handleResizeSession).Methods("POST")
	api.HandleFunc("/sessions/cleanup", s.handleSessionCleanup).Methods("POST")

	// Tasks
	api.HandleFunc("/tasks", s.handleCreateTask).Methods("POST")
	api.HandleFunc("/tasks", s.handleListTasks).Methods("GET")
	api.HandleFunc("/tasks/{id}", s.handleGetTask).Methods("GET")
	api.HandleFunc("/tasks/{id}", s.handleDeleteTask).Methods("DELETE")
	api.HandleFunc("/tasks/{id}", s.handleUpdateTask).Methods("PATCH")
	api.HandleFunc("/tasks/{id}/run", s.handleRunTask).Methods("POST")

	// Webhook (hidrix-affitor compatible)
	api.HandleFunc("/webhook/tasks", s.handleWebhookTask).Methods("POST")
	api.HandleFunc("/workspace/blocks", s.handleListWorkspaceBlocks).Methods("GET")

	// Locks
	api.HandleFunc("/locks", s.handleAcquireLock).Methods("POST")
	api.HandleFunc("/locks", s.handleListLocks).Methods("GET")
	api.HandleFunc("/locks", s.handleReleaseLock).Methods("DELETE")
	api.HandleFunc("/locks/{id}", s.handleForceReleaseLock).Methods("DELETE")

	// Setup (onboarding)
	api.HandleFunc("/setup/status", s.handleSetupStatus).Methods("GET")
	api.HandleFunc("/setup/save-key", s.handleSaveKey).Methods("POST")
	api.HandleFunc("/setup/install-agent", s.handleInstallAgent).Methods("POST")
	api.HandleFunc("/setup/device-code", s.handleDeviceCode).Methods("POST")
	api.HandleFunc("/setup/device-poll", s.handleDevicePoll).Methods("POST")

	// File upload (for drag-drop into terminal)
	api.HandleFunc("/upload", s.handleUpload).Methods("POST")

	// Messages
	api.HandleFunc("/messages", s.handleSendMessage).Methods("POST")
	api.HandleFunc("/messages", s.handleGetMessages).Methods("GET")
	api.HandleFunc("/messages/unread", s.handleGetUnreadCount).Methods("GET")
	api.HandleFunc("/messages/{id}", s.handleMarkMessageRead).Methods("PATCH")

	// Serve embedded frontend (SPA fallback)
	if s.frontendFS != nil {
		fileServer := http.FileServer(http.FS(s.frontendFS))
		s.router.PathPrefix("/").Handler(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Try to serve the file directly
			path := r.URL.Path
			if path == "/" {
				path = "/index.html"
			}
			// Check if file exists in embedded FS
			f, err := s.frontendFS.Open(path[1:]) // strip leading /
			if err != nil {
				// SPA fallback: serve index.html for all unknown routes
				r.URL.Path = "/"
				fileServer.ServeHTTP(w, r)
				return
			}
			f.Close()
			fileServer.ServeHTTP(w, r)
		}))
	}
}

func (s *Server) Run() error {
	addr := fmt.Sprintf("%s:%d", s.cfg.GetBindAddr(), s.cfg.GetPort())
	log.Printf("kyma-ter server starting on %s", addr)
	srv := &http.Server{
		Addr:           addr,
		Handler:        s.router,
		ReadTimeout:    5 * time.Second,
		WriteTimeout:   21 * time.Second,
		MaxHeaderBytes: 60000,
	}
	return srv.ListenAndServe()
}

func (s *Server) staleLockCleanup() {
	ticker := time.NewTicker(60 * time.Second)
	defer ticker.Stop()
	for range ticker.C {
		n, err := s.db.CleanExpiredLocks()
		if err != nil {
			log.Printf("lock cleanup error: %v", err)
		} else if n > 0 {
			log.Printf("cleaned %d expired locks", n)
		}
	}
}

// orphanSessionCleanup periodically checks for sessions with no active browser client
// and kills them after a grace period. Sessions with in-progress tasks are preserved.
func (s *Server) orphanSessionCleanup() {
	ticker := time.NewTicker(60 * time.Second)
	defer ticker.Stop()

	// Track when sessions were first seen as orphaned
	orphanedSince := make(map[string]time.Time)
	const gracePeriod = 5 * time.Minute
	const heartbeatTimeout = 90 * time.Second

	for range ticker.C {
		// Skip if there are no clients connected at all (server just started, no browser yet)
		if !s.events.HasActiveClients() {
			continue
		}

		// Get running session IDs
		sessions := s.pty.List()
		var runningIDs []string
		for _, sess := range sessions {
			if !sess.Exited {
				runningIDs = append(runningIDs, sess.ID)
			}
		}

		orphaned := s.events.GetOrphanedSessionIDs(runningIDs, heartbeatTimeout)
		now := time.Now()

		// Track newly orphaned sessions
		currentOrphaned := make(map[string]bool)
		for _, sid := range orphaned {
			currentOrphaned[sid] = true
			if _, exists := orphanedSince[sid]; !exists {
				orphanedSince[sid] = now
				log.Printf("session %s orphaned (no client heartbeat)", sid[:8])
			}
		}

		// Remove sessions that are no longer orphaned (client reconnected)
		for sid := range orphanedSince {
			if !currentOrphaned[sid] {
				log.Printf("session %s reclaimed by client", sid[:8])
				delete(orphanedSince, sid)
			}
		}

		// Kill sessions orphaned beyond grace period
		for sid, since := range orphanedSince {
			if now.Sub(since) < gracePeriod {
				continue
			}
			// Check if session has in-progress task — preserve it
			tasks, _ := s.db.ListTasks()
			hasActiveTask := false
			for _, t := range tasks {
				if t.SessionID == sid && t.Status == "in-progress" {
					hasActiveTask = true
					break
				}
			}
			if hasActiveTask {
				log.Printf("session %s orphaned but has active task, preserving", sid[:8])
				continue
			}
			log.Printf("killing orphaned session %s (orphaned for %v)", sid[:8], now.Sub(since))
			if err := s.pty.Kill(sid); err == nil {
				s.db.DeleteSession(sid)
				s.db.ReleaseSessionLocks(sid)
				s.db.ArchiveSessionMessages(sid)
			}
			delete(orphanedSince, sid)
		}
	}
}

// handleSessionCleanup handles sendBeacon from browser beforeunload.
// Kills specified sessions immediately.
func (s *Server) handleSessionCleanup(w http.ResponseWriter, r *http.Request) {
	var req struct {
		SessionIDs []string `json:"session_ids"`
	}
	if err := decodeBody(r, &req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}
	killed := 0
	for _, sid := range req.SessionIDs {
		if err := s.pty.Kill(sid); err == nil {
			s.db.DeleteSession(sid)
			s.db.ReleaseSessionLocks(sid)
			s.db.ArchiveSessionMessages(sid)
			killed++
		}
	}
	writeJSON(w, map[string]int{"killed": killed})
}

const kymaAuthAPI = "https://kymaapi.com/v1/auth"

func (s *Server) handleDeviceCode(w http.ResponseWriter, r *http.Request) {
	resp, err := http.Post(kymaAuthAPI+"/device/code", "application/json", bytes.NewBufferString("{}"))
	if err != nil {
		writeError(w, 500, "failed to request device code: "+err.Error())
		return
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)

	w.Header().Set("Content-Type", "application/json")
	w.Write(body)
}

func (s *Server) handleDevicePoll(w http.ResponseWriter, r *http.Request) {
	var req struct {
		DeviceCode string `json:"device_code"`
	}
	if err := decodeBody(r, &req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}

	payload, _ := json.Marshal(map[string]string{"device_code": req.DeviceCode})
	resp, err := http.Post(kymaAuthAPI+"/device/token", "application/json", bytes.NewBuffer(payload))
	if err != nil {
		writeError(w, 500, "poll failed: "+err.Error())
		return
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)

	// If we got a token, save it to ~/.kyma/agent/auth.json
	var tokenResp struct {
		AccessToken string `json:"access_token"`
		Email       string `json:"email"`
		UserID      string `json:"user_id"`
		Error       string `json:"error"`
	}
	if json.Unmarshal(body, &tokenResp) == nil && tokenResp.AccessToken != "" {
		saveKymaAuth(tokenResp.AccessToken, tokenResp.Email, tokenResp.UserID)
	}

	w.Header().Set("Content-Type", "application/json")
	w.Write(body)
}

func saveKymaAuth(accessToken, email, userID string) {
	home, _ := os.UserHomeDir()
	authDir := filepath.Join(home, ".kyma", "agent")
	os.MkdirAll(authDir, 0700)

	auth := map[string]interface{}{
		"kyma": map[string]interface{}{
			"type":    "oauth",
			"access":  accessToken,
			"email":   email,
			"userId":  userID,
			"expires": time.Now().Add(365 * 24 * time.Hour).UnixMilli(),
		},
	}
	data, _ := json.MarshalIndent(auth, "", "  ")
	os.WriteFile(filepath.Join(authDir, "auth.json"), data, 0600)
}

// injectKymaEnv adds KYMA_API_KEY to env vars when spawning kyma agent sessions.
// Only injects if user hasn't already logged in via ~/.kyma/agent/auth.json.
func (s *Server) injectKymaEnv(agentKey string, envVars map[string]string) map[string]string {
	if agentKey != "kyma" && agentKey != "" {
		return envVars
	}
	// Skip if already logged in via auth file
	loggedIn, _ := checkKymaAuth()
	if loggedIn {
		return envVars
	}
	// Inject API key from config if available
	if s.cfg.KymaAPIKey != "" {
		if envVars == nil {
			envVars = make(map[string]string)
		}
		envVars["KYMA_API_KEY"] = s.cfg.KymaAPIKey
	}
	return envVars
}

// ── Handlers: Setup (onboarding) ─────────────────────────────────────────

func (s *Server) handleSetupStatus(w http.ResponseWriter, r *http.Request) {
	// Check if kyma CLI is installed
	kymaPath, err := exec.LookPath("kyma")
	cliInstalled := err == nil

	// Check if logged in via ~/.kyma/agent/auth.json
	loggedIn, email := checkKymaAuth()

	// Also accept KYMA_API_KEY env or config
	hasKey := s.cfg.KymaAPIKey != "" || os.Getenv("KYMA_API_KEY") != ""

	writeJSON(w, map[string]interface{}{
		"cli_installed": cliInstalled,
		"cli_path":      kymaPath,
		"logged_in":     loggedIn,
		"email":         email,
		"has_api_key":   hasKey,
		"ready":         cliInstalled && (loggedIn || hasKey),
	})
}

func checkKymaAuth() (bool, string) {
	home, _ := os.UserHomeDir()
	authPath := filepath.Join(home, ".kyma", "agent", "auth.json")
	data, err := os.ReadFile(authPath)
	if err != nil {
		return false, ""
	}
	var auth struct {
		Kyma struct {
			Access string `json:"access"`
			Email  string `json:"email"`
		} `json:"kyma"`
	}
	if err := json.Unmarshal(data, &auth); err != nil {
		return false, ""
	}
	if auth.Kyma.Access == "" {
		return false, ""
	}
	return true, auth.Kyma.Email
}

func (s *Server) handleSaveKey(w http.ResponseWriter, r *http.Request) {
	var req struct {
		APIKey string `json:"api_key"`
	}
	if err := decodeBody(r, &req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}
	if req.APIKey == "" {
		writeError(w, 400, "api_key is required")
		return
	}

	s.cfg.KymaAPIKey = req.APIKey
	if err := config.Save(s.cfg); err != nil {
		writeError(w, 500, "failed to save config: "+err.Error())
		return
	}

	writeJSON(w, map[string]string{"status": "saved"})
}

func (s *Server) handleInstallAgent(w http.ResponseWriter, r *http.Request) {
	// Check if already installed
	if _, err := exec.LookPath("kyma"); err == nil {
		writeJSON(w, map[string]interface{}{
			"status":  "already_installed",
			"message": "Kyma Agent CLI is already installed",
		})
		return
	}

	// Try npm install
	cmd := exec.Command("npm", "install", "-g", "@kyma-api/agent")
	output, err := cmd.CombinedOutput()
	if err != nil {
		// Try bun as fallback
		cmd2 := exec.Command("bun", "add", "-g", "@kyma-api/agent")
		output2, err2 := cmd2.CombinedOutput()
		if err2 != nil {
			writeError(w, 500, fmt.Sprintf(
				"Install failed.\nnpm: %s\nbun: %s",
				strings.TrimSpace(string(output)),
				strings.TrimSpace(string(output2)),
			))
			return
		}
		output = output2
	}

	// Verify installation
	kymaPath, err := exec.LookPath("kyma")
	if err != nil {
		writeError(w, 500, "Install seemed to succeed but kyma CLI not found in PATH: "+string(output))
		return
	}

	writeJSON(w, map[string]interface{}{
		"status":   "installed",
		"cli_path": kymaPath,
		"message":  "Kyma Agent CLI installed successfully",
	})
}

// ── Task Injection ────────────────────────────────────────────────────────

// injectTaskPrompt writes the task description into a PTY session's stdin
// so the spawned agent receives the task automatically.
func (s *Server) injectTaskPrompt(sessionID, agentKey string, task *db.Task) {
	// Wait for the agent/shell to initialize
	time.Sleep(1500 * time.Millisecond)

	session := s.pty.Get(sessionID)
	if session == nil || session.IsExited() {
		return
	}

	// Build prompt based on task content
	var prompt strings.Builder
	prompt.WriteString(task.Title)
	if task.Description != "" {
		prompt.WriteString("\n\n")
		prompt.WriteString(task.Description)
	}
	if task.TaskKnowledge != "" {
		prompt.WriteString("\n\nContext:\n")
		prompt.WriteString(task.TaskKnowledge)
	}

	text := prompt.String()

	// For CLI agents (claude, codex, etc.) send the prompt + Enter
	if err := s.pty.Write(sessionID, []byte(text+"\n")); err != nil {
		log.Printf("task injection failed for session %s: %v", sessionID, err)
	} else {
		log.Printf("task injected into session %s: %s", sessionID[:8], task.Title)
	}
}

// ── Middleware ─────────────────────────────────────────────────────────────

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// ── JSON helpers ──────────────────────────────────────────────────────────

func writeJSON(w http.ResponseWriter, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"success": true, "data": data})
}

func writeError(w http.ResponseWriter, status int, msg string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(map[string]string{"error": msg})
}

func decodeBody(r *http.Request, v interface{}) error {
	defer r.Body.Close()
	return json.NewDecoder(r.Body).Decode(v)
}

// ── Handlers: Upload ─────────────────────────────────────────────────────

func (s *Server) handleUpload(w http.ResponseWriter, r *http.Request) {
	// Max 20MB
	r.ParseMultipartForm(20 << 20)

	file, header, err := r.FormFile("file")
	if err != nil {
		http.Error(w, "no file provided", http.StatusBadRequest)
		return
	}
	defer file.Close()

	// Save to uploads dir inside data dir
	uploadsDir := filepath.Join(s.cfg.DataDir(), "uploads")
	os.MkdirAll(uploadsDir, 0755)

	// Use original filename, prefix with timestamp to avoid collisions
	filename := fmt.Sprintf("%d_%s", time.Now().UnixMilli(), header.Filename)
	destPath := filepath.Join(uploadsDir, filename)

	dst, err := os.Create(destPath)
	if err != nil {
		http.Error(w, "failed to save file", http.StatusInternalServerError)
		return
	}
	defer dst.Close()

	if _, err := io.Copy(dst, file); err != nil {
		http.Error(w, "failed to write file", http.StatusInternalServerError)
		return
	}

	writeJSON(w, map[string]string{"path": destPath})
}

// ── Handlers: Health ──────────────────────────────────────────────────────

func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, map[string]string{"status": "ok"})
}

// ── Handlers: Sessions ────────────────────────────────────────────────────

func (s *Server) handleCreateSession(w http.ResponseWriter, r *http.Request) {
	var req struct {
		AgentKey string `json:"agent_key"`
		Command  string `json:"command"`
		Args     []string `json:"args"`
		Cols     uint16 `json:"cols"`
		Rows     uint16 `json:"rows"`
	}
	if err := decodeBody(r, &req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}

	// Resolve agent command
	command := req.Command
	args := req.Args
	var envVars map[string]string
	if command == "" && req.AgentKey != "" {
		if agent := s.cfg.ResolveAgent(req.AgentKey); agent != nil {
			command = agent.Command
			args = agent.Args
			envVars = agent.EnvVars
		}
	}

	// Inject Kyma API key for kyma agent
	envVars = s.injectKymaEnv(req.AgentKey, envVars)

	session, err := s.pty.Spawn(req.AgentKey, command, args, envVars, req.Cols, req.Rows)
	if err != nil {
		writeError(w, 500, "failed to spawn session: "+err.Error())
		return
	}

	// Persist to DB
	if _, err := s.db.CreateSessionWithID(session.ID, req.AgentKey); err != nil {
		log.Printf("db create session error: %v", err)
	}

	s.events.Broadcast(map[string]interface{}{
		"event": "session_created",
		"data": map[string]interface{}{
			"session_id": session.ID,
			"agent_key":  req.AgentKey,
		},
	})

	writeJSON(w, map[string]interface{}{
		"session_id": session.ID,
		"agent_key":  req.AgentKey,
		"cols":       session.Cols,
		"rows":       session.Rows,
	})
}

func (s *Server) handleListSessions(w http.ResponseWriter, r *http.Request) {
	sessions := s.pty.List()
	writeJSON(w, sessions)
}

func (s *Server) handleGetSession(w http.ResponseWriter, r *http.Request) {
	id := mux.Vars(r)["id"]
	info := s.pty.List()
	for _, si := range info {
		if si.ID == id {
			writeJSON(w, si)
			return
		}
	}
	writeError(w, 404, "session not found")
}

func (s *Server) handleDeleteSession(w http.ResponseWriter, r *http.Request) {
	id := mux.Vars(r)["id"]
	if err := s.pty.Kill(id); err != nil {
		writeError(w, 404, err.Error())
		return
	}
	s.db.DeleteSession(id)
	s.db.ReleaseSessionLocks(id)
	s.db.ArchiveSessionMessages(id)
	writeJSON(w, map[string]string{"status": "killed"})
}

func (s *Server) handleResizeSession(w http.ResponseWriter, r *http.Request) {
	id := mux.Vars(r)["id"]
	var req struct {
		Cols uint16 `json:"cols"`
		Rows uint16 `json:"rows"`
	}
	if err := decodeBody(r, &req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}
	if err := s.pty.Resize(id, req.Cols, req.Rows); err != nil {
		writeError(w, 404, err.Error())
		return
	}
	writeJSON(w, map[string]string{"status": "resized"})
}

// ── Handlers: Tasks ───────────────────────────────────────────────────────

func (s *Server) handleCreateTask(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Title         string `json:"title"`
		Description   string `json:"description"`
		TaskKnowledge string `json:"task_knowledge"`
		AgentKey      string `json:"agent_key"`
		CallbackURL   string `json:"callback_url"`
	}
	if err := decodeBody(r, &req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}
	if req.Title == "" {
		writeError(w, 400, "title is required")
		return
	}
	task, err := s.db.CreateTask(req.Title, req.Description, req.TaskKnowledge, req.AgentKey, req.CallbackURL, "{}")
	if err != nil {
		writeError(w, 500, "failed to create task: "+err.Error())
		return
	}
	s.events.Broadcast(map[string]interface{}{"event": "task_created", "data": task})
	writeJSON(w, task)
}

func (s *Server) handleListTasks(w http.ResponseWriter, r *http.Request) {
	tasks, err := s.db.ListTasks()
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	if tasks == nil {
		tasks = []*db.Task{}
	}
	writeJSON(w, tasks)
}

func (s *Server) handleGetTask(w http.ResponseWriter, r *http.Request) {
	id := mux.Vars(r)["id"]
	task, err := s.db.GetTask(id)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	if task == nil {
		writeError(w, 404, "task not found")
		return
	}
	writeJSON(w, task)
}

func (s *Server) handleDeleteTask(w http.ResponseWriter, r *http.Request) {
	id := mux.Vars(r)["id"]
	if err := s.db.DeleteTask(id); err != nil {
		writeError(w, 500, err.Error())
		return
	}
	writeJSON(w, map[string]string{"status": "deleted"})
}

func (s *Server) handleUpdateTask(w http.ResponseWriter, r *http.Request) {
	id := mux.Vars(r)["id"]
	var req struct {
		Status    string  `json:"status,omitempty"`
		SortOrder float64 `json:"sort_order,omitempty"`
	}
	if err := decodeBody(r, &req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}
	if req.Status != "" {
		if err := s.db.UpdateTaskStatus(id, req.Status); err != nil {
			writeError(w, 500, err.Error())
			return
		}
	}
	task, _ := s.db.GetTask(id)
	s.events.Broadcast(map[string]interface{}{"event": "task_update", "data": task})
	writeJSON(w, task)
}

func (s *Server) handleRunTask(w http.ResponseWriter, r *http.Request) {
	id := mux.Vars(r)["id"]
	task, err := s.db.GetTask(id)
	if err != nil || task == nil {
		writeError(w, 404, "task not found")
		return
	}
	if err := s.db.UpdateTaskStatus(id, "in-progress"); err != nil {
		writeError(w, 500, err.Error())
		return
	}
	task.Status = "in-progress"
	s.events.Broadcast(map[string]interface{}{"event": "task_update", "data": task})
	writeJSON(w, task)
}

// ── Handlers: Webhook (hidrix-affitor compatible) ─────────────────────────

func (s *Server) handleWebhookTask(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Title         string `json:"title"`
		Description   string `json:"description"`
		TaskKnowledge string `json:"taskknowledge"`
		AgentKey      string `json:"agentkey"`
		CallbackURL   string `json:"callback_url"`
		TargetBlockID string `json:"target_block_id"`
		UseActiveTab  bool   `json:"use_active_tab"`
		UseCurrentCLI bool   `json:"use_current_cli"`
		CreateNewTab  *bool  `json:"create_new_tab"`
		// Slack fields (stored in meta)
		SlackWebhookURL string `json:"slack_webhook_url"`
		SlackText       string `json:"slack_text"`
		SlackChannel    string `json:"slack_channel"`
		SlackUsername   string `json:"slack_username"`
		SlackIconEmoji  string `json:"slack_icon_emoji"`
	}
	if err := decodeBody(r, &req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}
	if req.Title == "" {
		writeError(w, 400, "title is required")
		return
	}
	if req.AgentKey == "" {
		req.AgentKey = "claude-code"
	}

	// Build meta JSON
	meta := map[string]string{}
	if req.CallbackURL != "" {
		meta["callback_url"] = req.CallbackURL
	}
	if req.SlackWebhookURL != "" {
		meta["slack_webhook_url"] = req.SlackWebhookURL
	}
	if req.SlackText != "" {
		meta["slack_text"] = req.SlackText
	}
	if req.SlackChannel != "" {
		meta["slack_channel"] = req.SlackChannel
	}
	metaJSON, _ := json.Marshal(meta)

	// Create task
	task, err := s.db.CreateTask(req.Title, req.Description, req.TaskKnowledge, req.AgentKey, req.CallbackURL, string(metaJSON))
	if err != nil {
		writeError(w, 500, "failed to create task: "+err.Error())
		return
	}
	s.db.UpdateTaskStatus(task.ID, "in-progress")
	task.Status = "in-progress"

	// If targeting an existing session, use it
	sessionID := ""
	if req.TargetBlockID != "" {
		// target_block_id maps to session_id in kyma-ter
		existing := s.pty.Get(req.TargetBlockID)
		if existing != nil {
			sessionID = req.TargetBlockID
		}
	}

	// Spawn a new session for this agent if no target
	if sessionID == "" {
		agent := s.cfg.ResolveAgent(req.AgentKey)
		command := ""
		var args []string
		var envVars map[string]string
		if agent != nil {
			command = agent.Command
			args = agent.Args
			envVars = agent.EnvVars
		}
		envVars = s.injectKymaEnv(req.AgentKey, envVars)
		session, err := s.pty.Spawn(req.AgentKey, command, args, envVars, 120, 40)
		if err != nil {
			writeError(w, 500, "failed to spawn agent: "+err.Error())
			return
		}
		sessionID = session.ID
	}

	s.db.UpdateTaskSession(task.ID, sessionID)

	// Inject task prompt into PTY stdin
	go s.injectTaskPrompt(sessionID, req.AgentKey, task)

	s.events.Broadcast(map[string]interface{}{
		"event": "task_dispatched",
		"data": map[string]interface{}{
			"taskid":     task.ID,
			"session_id": sessionID,
			"agent_key":  req.AgentKey,
			"title":      task.Title,
		},
	})

	// Response in Mandeck-compatible shape
	writeJSON(w, map[string]interface{}{
		"taskid":  task.ID,
		"tabid":   "",
		"blockid": sessionID,
		"status":  "in-progress",
		"agent":   req.AgentKey,
	})
}

func (s *Server) handleListWorkspaceBlocks(w http.ResponseWriter, r *http.Request) {
	sessions := s.pty.List()
	blocks := make([]map[string]interface{}, 0, len(sessions))
	for i, sess := range sessions {
		blocks = append(blocks, map[string]interface{}{
			"oid":        sess.ID,
			"view":       "term",
			"controller": "shell",
			"agent":      sess.AgentKey,
			"taskid":     "",
			"index":      i + 1,
		})
	}
	writeJSON(w, map[string]interface{}{
		"blocks":   blocks,
		"tab_name": "kyma-ter",
		"tab_id":   "default",
	})
}

// ── Handlers: Locks ───────────────────────────────────────────────────────

func (s *Server) handleAcquireLock(w http.ResponseWriter, r *http.Request) {
	var req struct {
		FilePath  string `json:"file_path"`
		SessionID string `json:"session_id"`
		AgentKey  string `json:"agent_key"`
		LockType  string `json:"lock_type"`
		TTLMs     int64  `json:"ttl_ms"`
	}
	if err := decodeBody(r, &req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}
	if req.FilePath == "" || req.SessionID == "" {
		writeError(w, 400, "file_path and session_id are required")
		return
	}
	if req.TTLMs == 0 {
		req.TTLMs = 30 * 60 * 1000 // 30 minutes default
	}
	lock, err := s.db.AcquireLock(req.FilePath, req.SessionID, req.AgentKey, req.LockType, req.TTLMs)
	if err != nil {
		if _, ok := err.(*db.LockConflictError); ok {
			writeError(w, 409, err.Error())
			return
		}
		writeError(w, 500, err.Error())
		return
	}
	s.events.Broadcast(map[string]interface{}{"event": "filelock", "action": "acquired", "data": lock})
	writeJSON(w, lock)
}

func (s *Server) handleReleaseLock(w http.ResponseWriter, r *http.Request) {
	var req struct {
		FilePath  string `json:"file_path"`
		SessionID string `json:"session_id"`
	}
	if err := decodeBody(r, &req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}
	if err := s.db.ReleaseLock(req.FilePath, req.SessionID); err != nil {
		writeError(w, 500, err.Error())
		return
	}
	s.events.Broadcast(map[string]interface{}{"event": "filelock", "action": "released", "data": req})
	writeJSON(w, map[string]string{"status": "released"})
}

func (s *Server) handleListLocks(w http.ResponseWriter, r *http.Request) {
	locks, err := s.db.ListLocks()
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	if locks == nil {
		locks = []*db.FileLock{}
	}
	writeJSON(w, locks)
}

func (s *Server) handleForceReleaseLock(w http.ResponseWriter, r *http.Request) {
	id := mux.Vars(r)["id"]
	if err := s.db.ForceReleaseLock(id); err != nil {
		writeError(w, 500, err.Error())
		return
	}
	writeJSON(w, map[string]string{"status": "released"})
}

// ── Handlers: Messages ────────────────────────────────────────────────────

func (s *Server) handleSendMessage(w http.ResponseWriter, r *http.Request) {
	var req struct {
		FromSession string `json:"from_session"`
		FromAgent   string `json:"from_agent"`
		ToSession   string `json:"to_session"`
		ToAgent     string `json:"to_agent"`
		MsgType     string `json:"msg_type"`
		Subject     string `json:"subject"`
		Body        string `json:"body"`
		TaskID      string `json:"task_id"`
	}
	if err := decodeBody(r, &req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}
	if req.FromSession == "" || req.Body == "" {
		writeError(w, 400, "from_session and body are required")
		return
	}
	msg, err := s.db.SendMessage(req.FromSession, req.FromAgent, req.ToSession, req.ToAgent, req.MsgType, req.Subject, req.Body, req.TaskID)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	s.events.Broadcast(map[string]interface{}{"event": "message", "data": msg})
	writeJSON(w, msg)
}

func (s *Server) handleGetMessages(w http.ResponseWriter, r *http.Request) {
	sessionID := r.URL.Query().Get("session_id")
	unread := r.URL.Query().Get("unread") == "true"
	if sessionID == "" {
		writeError(w, 400, "session_id query param required")
		return
	}
	msgs, err := s.db.GetMessages(sessionID, unread)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	if msgs == nil {
		msgs = []*db.Message{}
	}
	writeJSON(w, msgs)
}

func (s *Server) handleGetUnreadCount(w http.ResponseWriter, r *http.Request) {
	sessionID := r.URL.Query().Get("session_id")
	if sessionID == "" {
		writeError(w, 400, "session_id query param required")
		return
	}
	count, err := s.db.GetUnreadCount(sessionID)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	writeJSON(w, map[string]int{"count": count})
}

func (s *Server) handleMarkMessageRead(w http.ResponseWriter, r *http.Request) {
	id := mux.Vars(r)["id"]
	if err := s.db.MarkMessageRead(id); err != nil {
		writeError(w, 500, err.Error())
		return
	}
	writeJSON(w, map[string]string{"status": "read"})
}
