package ptymanager

import (
	"io"
	"os/exec"
	"sync"
	"time"
)

const scrollbackSize = 50 * 1024 // 50KB circular buffer

// Session represents a running PTY session.
type Session struct {
	ID        string
	AgentKey  string
	Cmd       *exec.Cmd
	CreatedAt time.Time
	Cols      uint16
	Rows      uint16

	// Platform-specific I/O — set by newSession in session_unix.go / session_windows.go
	ptyReader io.Reader
	ptyWriter io.Writer
	closeFn   func() error
	resizeFn  func(cols, rows uint16) error

	mu          sync.RWMutex
	subscribers map[string]chan []byte
	done        chan struct{}
	exitCode    int
	exited      bool
	scrollback  []byte
}

func (s *Session) readLoop() {
	buf := make([]byte, 32*1024)
	for {
		n, err := s.ptyReader.Read(buf)
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
	s.mu.Lock()
	defer s.mu.Unlock()
	s.scrollback = append(s.scrollback, data...)
	if len(s.scrollback) > scrollbackSize {
		s.scrollback = s.scrollback[len(s.scrollback)-scrollbackSize:]
	}
	for _, ch := range s.subscribers {
		select {
		case ch <- data:
		default:
		}
	}
}

func (s *Session) Subscribe(id string) (<-chan []byte, func(), []byte) {
	ch := make(chan []byte, 256)
	s.mu.Lock()
	s.subscribers[id] = ch
	history := make([]byte, len(s.scrollback))
	copy(history, s.scrollback)
	s.mu.Unlock()
	return ch, func() {
		s.mu.Lock()
		delete(s.subscribers, id)
		s.mu.Unlock()
	}, history
}

func (s *Session) Write(data []byte) error {
	_, err := s.ptyWriter.Write(data)
	return err
}

func (s *Session) Resize(cols, rows uint16) error {
	s.mu.Lock()
	s.Cols = cols
	s.Rows = rows
	s.mu.Unlock()
	return s.resizeFn(cols, rows)
}

func (s *Session) Done() <-chan struct{} { return s.done }

func (s *Session) ExitCode() int {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.exitCode
}

func (s *Session) IsExited() bool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.exited
}

func (s *Session) Close() error {
	if s.Cmd.Process != nil {
		s.Cmd.Process.Kill()
	}
	return s.closeFn()
}
