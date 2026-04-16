//go:build !windows

package ptymanager

import (
	"os"
	"os/exec"
	"time"

	"github.com/creack/pty"
)

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
		CreatedAt:   time.Now(),
		Cols:        cols,
		Rows:        rows,
		ptyReader:   ptmx,
		ptyWriter:   ptmx,
		subscribers: make(map[string]chan []byte),
		done:        make(chan struct{}),
		closeFn:     func() error { return ptmx.Close() },
		resizeFn: func(c, r uint16) error {
			return pty.Setsize(ptmx, &pty.Winsize{Cols: c, Rows: r})
		},
	}

	// Keep reference for Close() to kill process
	s.Cmd = cmd

	go s.readLoop()
	go s.waitExit()

	return s, nil
}

// ptyFile returns the underlying *os.File for Unix PTY (used by some callers).
func (s *Session) ptyFile() *os.File {
	if f, ok := s.ptyReader.(*os.File); ok {
		return f
	}
	return nil
}
