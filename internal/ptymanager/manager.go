package ptymanager

import (
	"fmt"
	"os"
	"os/exec"
	"sync"

	"github.com/google/uuid"
)

type SessionInfo struct {
	ID        string `json:"id"`
	AgentKey  string `json:"agent_key"`
	Cols      uint16 `json:"cols"`
	Rows      uint16 `json:"rows"`
	CreatedAt int64  `json:"created_at"`
	Exited    bool   `json:"exited"`
	ExitCode  int    `json:"exit_code,omitempty"`
}

type Manager struct {
	mu       sync.RWMutex
	sessions map[string]*Session

	// OnExit is called when a session's process exits.
	OnExit func(sessionID string, exitCode int)
}

func NewManager() *Manager {
	return &Manager{
		sessions: make(map[string]*Session),
	}
}

// Spawn creates a new PTY session. If command is empty, spawns the user's default shell.
func (m *Manager) Spawn(agentKey string, command string, args []string, envVars map[string]string, cols, rows uint16) (*Session, error) {
	if cols == 0 {
		cols = 120
	}
	if rows == 0 {
		rows = 40
	}

	var cmd *exec.Cmd
	if command == "" {
		shell := os.Getenv("SHELL")
		if shell == "" {
			shell = "/bin/bash"
		}
		cmd = exec.Command(shell, "-l")
	} else {
		cmd = exec.Command(command, args...)
	}

	// Set up environment
	cmd.Env = os.Environ()
	id := uuid.New().String()
	cmd.Env = append(cmd.Env, "KYMA_SESSION_ID="+id)
	if agentKey != "" {
		cmd.Env = append(cmd.Env, "KYMA_AGENT_KEY="+agentKey)
	}
	for k, v := range envVars {
		cmd.Env = append(cmd.Env, k+"="+v)
	}

	// Working directory
	home, _ := os.UserHomeDir()
	cmd.Dir = home

	session, err := newSession(id, agentKey, cmd, cols, rows)
	if err != nil {
		return nil, fmt.Errorf("spawn pty: %w", err)
	}

	m.mu.Lock()
	m.sessions[id] = session
	m.mu.Unlock()

	// Watch for exit
	go func() {
		<-session.Done()
		if m.OnExit != nil {
			m.OnExit(id, session.ExitCode())
		}
	}()

	return session, nil
}

func (m *Manager) Get(id string) *Session {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.sessions[id]
}

func (m *Manager) List() []*SessionInfo {
	m.mu.RLock()
	defer m.mu.RUnlock()
	out := make([]*SessionInfo, 0, len(m.sessions))
	for _, s := range m.sessions {
		out = append(out, &SessionInfo{
			ID:        s.ID,
			AgentKey:  s.AgentKey,
			Cols:      s.Cols,
			Rows:      s.Rows,
			CreatedAt: s.CreatedAt.UnixMilli(),
			Exited:    s.IsExited(),
			ExitCode:  s.ExitCode(),
		})
	}
	return out
}

func (m *Manager) Kill(id string) error {
	m.mu.Lock()
	s, ok := m.sessions[id]
	if !ok {
		m.mu.Unlock()
		return fmt.Errorf("session not found: %s", id)
	}
	delete(m.sessions, id)
	m.mu.Unlock()
	return s.Close()
}

func (m *Manager) Resize(id string, cols, rows uint16) error {
	s := m.Get(id)
	if s == nil {
		return fmt.Errorf("session not found: %s", id)
	}
	return s.Resize(cols, rows)
}

func (m *Manager) Write(id string, data []byte) error {
	s := m.Get(id)
	if s == nil {
		return fmt.Errorf("session not found: %s", id)
	}
	return s.Write(data)
}

// CloseAll kills all active sessions.
func (m *Manager) CloseAll() {
	m.mu.Lock()
	defer m.mu.Unlock()
	for id, s := range m.sessions {
		s.Close()
		delete(m.sessions, id)
	}
}
