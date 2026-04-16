//go:build windows

package ptymanager

import (
	"context"
	"os"
	"os/exec"
	"time"

	"github.com/UserExistsError/conpty"
)

func newSession(id, agentKey string, cmd *exec.Cmd, cols, rows uint16) (*Session, error) {
	// Build command line string for ConPTY
	cmdLine := cmd.Path
	for _, arg := range cmd.Args[1:] {
		cmdLine += " " + arg
	}

	cpty, err := conpty.Start(cmdLine, conpty.ConPtyDimensions(int(cols), int(rows)))
	if err != nil {
		return nil, err
	}

	// ConPTY manages the process internally, but we need cmd.Process for Wait()
	// We'll track exit via ConPTY's Wait() instead
	s := &Session{
		ID:          id,
		AgentKey:    agentKey,
		Cmd:         cmd,
		CreatedAt:   time.Now(),
		Cols:        cols,
		Rows:        rows,
		ptyReader:   cpty,
		ptyWriter:   cpty,
		subscribers: make(map[string]chan []byte),
		done:        make(chan struct{}),
		closeFn:     func() error { return cpty.Close() },
		resizeFn: func(c, r uint16) error {
			return cpty.Resize(int(c), int(r))
		},
	}

	go s.readLoop()
	go s.waitExitWindows(cpty)

	return s, nil
}

func (s *Session) waitExitWindows(cpty *conpty.ConPty) {
	exitCode, _ := cpty.Wait(context.Background())
	s.mu.Lock()
	s.exited = true
	s.exitCode = int(exitCode)
	s.mu.Unlock()
	close(s.done)
}

// ptyFile returns nil on Windows (ConPTY doesn't expose *os.File).
func (s *Session) ptyFile() *os.File {
	return nil
}
