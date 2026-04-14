package ptymanager

import (
	"io"
	"os"
	"os/exec"
	"sync"
	"time"

	"github.com/creack/pty"
)

type Session struct {
	ID        string
	AgentKey  string
	Cmd       *exec.Cmd
	pty       *os.File
	CreatedAt time.Time
	Cols      uint16
	Rows      uint16

	mu          sync.RWMutex
	subscribers map[string]chan []byte
	done        chan struct{}
	exitCode    int
	exited      bool
}

func newSession(id, agentKey string, cmd *exec.Cmd, cols, rows uint16) (*Session, error) {
	size := &pty.Winsize{Cols: cols, Rows: rows}
	ptmx, err := pty.StartWithSize(cmd, size)
	if err != nil {
		return nil, err
	}

	s := &Session{
		ID:          id,
		AgentKey:    agentKey,
		Cmd:         cmd,
		pty:         ptmx,
		CreatedAt:   time.Now(),
		Cols:        cols,
		Rows:        rows,
		subscribers: make(map[string]chan []byte),
		done:        make(chan struct{}),
	}

	go s.readLoop()
	go s.waitExit()

	return s, nil
}

func (s *Session) readLoop() {
	buf := make([]byte, 32*1024)
	for {
		n, err := s.pty.Read(buf)
		if n > 0 {
			data := make([]byte, n)
			copy(data, buf[:n])
			s.broadcast(data)
		}
		if err != nil {
			if err != io.EOF {
				// PTY closed
			}
			return
		}
	}
}

func (s *Session) waitExit() {
	err := s.Cmd.Wait()
	s.mu.Lock()
	s.exited = true
	if err != nil {
		if exitErr, ok := err.(*exec.ExitError); ok {
			s.exitCode = exitErr.ExitCode()
		} else {
			s.exitCode = -1
		}
	}
	s.mu.Unlock()
	close(s.done)
}

func (s *Session) broadcast(data []byte) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	for _, ch := range s.subscribers {
		select {
		case ch <- data:
		default:
			// Subscriber too slow, drop data
		}
	}
}

// Subscribe adds a subscriber and returns a channel for PTY output + an unsubscribe func.
func (s *Session) Subscribe(id string) (<-chan []byte, func()) {
	ch := make(chan []byte, 256)
	s.mu.Lock()
	s.subscribers[id] = ch
	s.mu.Unlock()
	return ch, func() {
		s.mu.Lock()
		delete(s.subscribers, id)
		s.mu.Unlock()
	}
}

// Write sends input to the PTY (user keystrokes).
func (s *Session) Write(data []byte) error {
	_, err := s.pty.Write(data)
	return err
}

// Resize changes the PTY window size.
func (s *Session) Resize(cols, rows uint16) error {
	s.mu.Lock()
	s.Cols = cols
	s.Rows = rows
	s.mu.Unlock()
	return pty.Setsize(s.pty, &pty.Winsize{Cols: cols, Rows: rows})
}

// Done returns a channel that closes when the process exits.
func (s *Session) Done() <-chan struct{} {
	return s.done
}

// ExitCode returns the process exit code. Only valid after Done() closes.
func (s *Session) ExitCode() int {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.exitCode
}

// IsExited returns whether the process has exited.
func (s *Session) IsExited() bool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.exited
}

// Close kills the process and closes the PTY.
func (s *Session) Close() error {
	if s.Cmd.Process != nil {
		s.Cmd.Process.Kill()
	}
	return s.pty.Close()
}
