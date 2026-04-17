//go:build windows

package ptymanager

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"strings"
	"time"

	"github.com/UserExistsError/conpty"
)

func newSession(id, agentKey string, cmd *exec.Cmd, cols, rows uint16) (*Session, error) {
	scriptPath, err := writePowerShellWrapper(cmd)
	if err != nil {
		return nil, err
	}

	cmdLine := fmt.Sprintf(`powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%s"`, scriptPath)

	cpty, err := conpty.Start(cmdLine, conpty.ConPtyDimensions(int(cols), int(rows)))
	if err != nil {
		_ = os.Remove(scriptPath)
		return nil, err
	}

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
		closeFn: func() error {
			_ = os.Remove(scriptPath)
			return cpty.Close()
		},
		resizeFn: func(c, r uint16) error {
			return cpty.Resize(int(c), int(r))
		},
	}

	go s.readLoop()
	go s.waitExitWindows(cpty, scriptPath)

	return s, nil
}

func (s *Session) waitExitWindows(cpty *conpty.ConPty, scriptPath string) {
	defer os.Remove(scriptPath)
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

func writePowerShellWrapper(cmd *exec.Cmd) (string, error) {
	f, err := os.CreateTemp("", "kyma-ter-*.ps1")
	if err != nil {
		return "", err
	}
	defer f.Close()

	var b strings.Builder
	b.WriteString("$ErrorActionPreference = 'Stop'\n")
	b.WriteString("[Console]::OutputEncoding = [System.Text.Encoding]::UTF8\n")
	b.WriteString("[Console]::InputEncoding = [System.Text.Encoding]::UTF8\n")
	if cmd.Dir != "" {
		b.WriteString("Set-Location -LiteralPath ")
		b.WriteString(psLiteral(cmd.Dir))
		b.WriteString("\n")
	}
	for _, entry := range cmd.Env {
		key, value, ok := strings.Cut(entry, "=")
		if !ok || key == "" {
			continue
		}
		// Skip env var names with characters that PowerShell's $env:NAME
		// syntax cannot parse (e.g. "ProgramFiles(x86)"). Use the
		// [Environment]::SetEnvironmentVariable call instead for safety.
		b.WriteString("[Environment]::SetEnvironmentVariable(")
		b.WriteString(psLiteral(key))
		b.WriteString(", ")
		b.WriteString(psLiteral(value))
		b.WriteString(", 'Process')\n")
	}
	b.WriteString("& ")
	b.WriteString(psLiteral(cmd.Path))
	for _, arg := range cmd.Args[1:] {
		b.WriteString(" ")
		b.WriteString(psLiteral(arg))
	}
	b.WriteString("\nexit $LASTEXITCODE\n")

	if _, err := f.WriteString(b.String()); err != nil {
		_ = os.Remove(f.Name())
		return "", err
	}
	return f.Name(), nil
}

func psLiteral(value string) string {
	return "'" + strings.ReplaceAll(value, "'", "''") + "'"
}
