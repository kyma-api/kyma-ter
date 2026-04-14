package db

import (
	"database/sql"
	"os"
	"path/filepath"

	_ "github.com/mattn/go-sqlite3"
)

type DB struct {
	conn *sql.DB
}

func Open(dataDir string) (*DB, error) {
	if err := os.MkdirAll(dataDir, 0755); err != nil {
		return nil, err
	}
	dbPath := filepath.Join(dataDir, "kyma-ter.db")
	conn, err := sql.Open("sqlite3", dbPath+"?_journal_mode=WAL&_busy_timeout=5000")
	if err != nil {
		return nil, err
	}
	d := &DB{conn: conn}
	if err := d.migrate(); err != nil {
		conn.Close()
		return nil, err
	}
	return d, nil
}

func (d *DB) Close() error {
	return d.conn.Close()
}

func (d *DB) migrate() error {
	migrations := []string{
		`CREATE TABLE IF NOT EXISTS sessions (
			id TEXT PRIMARY KEY,
			agent_key TEXT NOT NULL DEFAULT '',
			status TEXT NOT NULL DEFAULT 'running',
			exit_code INTEGER DEFAULT 0,
			created_at INTEGER NOT NULL,
			exited_at INTEGER DEFAULT 0
		)`,
		`CREATE TABLE IF NOT EXISTS tasks (
			id TEXT PRIMARY KEY,
			title TEXT NOT NULL,
			description TEXT DEFAULT '',
			task_knowledge TEXT DEFAULT '',
			agent_key TEXT DEFAULT '',
			session_id TEXT DEFAULT '',
			status TEXT NOT NULL DEFAULT 'todo',
			sort_order REAL NOT NULL,
			callback_url TEXT DEFAULT '',
			meta TEXT DEFAULT '{}',
			created_at INTEGER NOT NULL,
			updated_at INTEGER NOT NULL
		)`,
		`CREATE TABLE IF NOT EXISTS file_locks (
			id TEXT PRIMARY KEY,
			file_path TEXT NOT NULL UNIQUE,
			session_id TEXT NOT NULL,
			agent_key TEXT DEFAULT '',
			lock_type TEXT DEFAULT 'advisory',
			acquired_at INTEGER NOT NULL,
			expires_at INTEGER DEFAULT 0
		)`,
		`CREATE TABLE IF NOT EXISTS messages (
			id TEXT PRIMARY KEY,
			from_session TEXT NOT NULL,
			from_agent TEXT DEFAULT '',
			to_session TEXT DEFAULT '',
			to_agent TEXT DEFAULT '',
			msg_type TEXT DEFAULT 'info',
			subject TEXT DEFAULT '',
			body TEXT NOT NULL,
			task_id TEXT DEFAULT '',
			read_at INTEGER DEFAULT 0,
			archived INTEGER DEFAULT 0,
			created_at INTEGER NOT NULL
		)`,
	}
	for _, m := range migrations {
		if _, err := d.conn.Exec(m); err != nil {
			return err
		}
	}
	return nil
}
