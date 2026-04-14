package db

import (
	"database/sql"
	"time"

	"github.com/google/uuid"
)

func nowMs() int64 {
	return time.Now().UnixMilli()
}

func newID() string {
	return uuid.New().String()
}

// ── Sessions ──────────────────────────────────────────────────────────────

func (d *DB) CreateSession(agentKey string) (*Session, error) {
	return d.CreateSessionWithID(newID(), agentKey)
}

func (d *DB) CreateSessionWithID(id, agentKey string) (*Session, error) {
	s := &Session{
		ID:        id,
		AgentKey:  agentKey,
		Status:    "running",
		CreatedAt: nowMs(),
	}
	_, err := d.conn.Exec(
		`INSERT OR REPLACE INTO sessions (id, agent_key, status, created_at) VALUES (?, ?, ?, ?)`,
		s.ID, s.AgentKey, s.Status, s.CreatedAt,
	)
	return s, err
}

func (d *DB) GetSession(id string) (*Session, error) {
	s := &Session{}
	err := d.conn.QueryRow(
		`SELECT id, agent_key, status, exit_code, created_at, exited_at FROM sessions WHERE id = ?`, id,
	).Scan(&s.ID, &s.AgentKey, &s.Status, &s.ExitCode, &s.CreatedAt, &s.ExitedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return s, err
}

func (d *DB) ListSessions() ([]*Session, error) {
	rows, err := d.conn.Query(
		`SELECT id, agent_key, status, exit_code, created_at, exited_at FROM sessions ORDER BY created_at DESC`,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []*Session
	for rows.Next() {
		s := &Session{}
		if err := rows.Scan(&s.ID, &s.AgentKey, &s.Status, &s.ExitCode, &s.CreatedAt, &s.ExitedAt); err != nil {
			return nil, err
		}
		out = append(out, s)
	}
	return out, rows.Err()
}

func (d *DB) ListActiveSessions() ([]*Session, error) {
	rows, err := d.conn.Query(
		`SELECT id, agent_key, status, exit_code, created_at, exited_at FROM sessions WHERE status = 'running' ORDER BY created_at DESC`,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []*Session
	for rows.Next() {
		s := &Session{}
		if err := rows.Scan(&s.ID, &s.AgentKey, &s.Status, &s.ExitCode, &s.CreatedAt, &s.ExitedAt); err != nil {
			return nil, err
		}
		out = append(out, s)
	}
	return out, rows.Err()
}

func (d *DB) UpdateSessionExited(id string, exitCode int) error {
	_, err := d.conn.Exec(
		`UPDATE sessions SET status = 'exited', exit_code = ?, exited_at = ? WHERE id = ?`,
		exitCode, nowMs(), id,
	)
	return err
}

func (d *DB) DeleteSession(id string) error {
	_, err := d.conn.Exec(`DELETE FROM sessions WHERE id = ?`, id)
	return err
}

// ── Tasks ─────────────────────────────────────────────────────────────────

func (d *DB) CreateTask(title, description, taskKnowledge, agentKey, callbackURL, meta string) (*Task, error) {
	now := nowMs()
	t := &Task{
		ID:            newID(),
		Title:         title,
		Description:   description,
		TaskKnowledge: taskKnowledge,
		AgentKey:      agentKey,
		Status:        "todo",
		SortOrder:     float64(now),
		CallbackURL:   callbackURL,
		Meta:          meta,
		CreatedAt:     now,
		UpdatedAt:     now,
	}
	if t.Meta == "" {
		t.Meta = "{}"
	}
	_, err := d.conn.Exec(
		`INSERT INTO tasks (id, title, description, task_knowledge, agent_key, status, sort_order, callback_url, meta, created_at, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		t.ID, t.Title, t.Description, t.TaskKnowledge, t.AgentKey, t.Status, t.SortOrder, t.CallbackURL, t.Meta, t.CreatedAt, t.UpdatedAt,
	)
	return t, err
}

func (d *DB) GetTask(id string) (*Task, error) {
	t := &Task{}
	err := d.conn.QueryRow(
		`SELECT id, title, description, task_knowledge, agent_key, session_id, status, sort_order, callback_url, meta, created_at, updated_at
		 FROM tasks WHERE id = ?`, id,
	).Scan(&t.ID, &t.Title, &t.Description, &t.TaskKnowledge, &t.AgentKey, &t.SessionID, &t.Status, &t.SortOrder, &t.CallbackURL, &t.Meta, &t.CreatedAt, &t.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return t, err
}

func (d *DB) ListTasks() ([]*Task, error) {
	rows, err := d.conn.Query(
		`SELECT id, title, description, task_knowledge, agent_key, session_id, status, sort_order, callback_url, meta, created_at, updated_at
		 FROM tasks ORDER BY sort_order ASC`,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []*Task
	for rows.Next() {
		t := &Task{}
		if err := rows.Scan(&t.ID, &t.Title, &t.Description, &t.TaskKnowledge, &t.AgentKey, &t.SessionID, &t.Status, &t.SortOrder, &t.CallbackURL, &t.Meta, &t.CreatedAt, &t.UpdatedAt); err != nil {
			return nil, err
		}
		out = append(out, t)
	}
	return out, rows.Err()
}

func (d *DB) UpdateTaskStatus(id, status string) error {
	_, err := d.conn.Exec(
		`UPDATE tasks SET status = ?, updated_at = ? WHERE id = ?`,
		status, nowMs(), id,
	)
	return err
}

func (d *DB) UpdateTaskSession(id, sessionID string) error {
	_, err := d.conn.Exec(
		`UPDATE tasks SET session_id = ?, updated_at = ? WHERE id = ?`,
		sessionID, nowMs(), id,
	)
	return err
}

func (d *DB) DeleteTask(id string) error {
	_, err := d.conn.Exec(`DELETE FROM tasks WHERE id = ?`, id)
	return err
}

// ── File Locks ────────────────────────────────────────────────────────────

func (d *DB) AcquireLock(filePath, sessionID, agentKey, lockType string, ttlMs int64) (*FileLock, error) {
	now := nowMs()
	var expiresAt int64
	if ttlMs > 0 {
		expiresAt = now + ttlMs
	}

	// Check existing lock
	existing := &FileLock{}
	err := d.conn.QueryRow(
		`SELECT id, file_path, session_id, agent_key, lock_type, acquired_at, expires_at FROM file_locks WHERE file_path = ?`,
		filePath,
	).Scan(&existing.ID, &existing.FilePath, &existing.SessionID, &existing.AgentKey, &existing.LockType, &existing.AcquiredAt, &existing.ExpiresAt)

	if err == nil {
		// Lock exists
		if existing.ExpiresAt > 0 && existing.ExpiresAt < now {
			// Expired — delete and acquire
			d.conn.Exec(`DELETE FROM file_locks WHERE id = ?`, existing.ID)
		} else if existing.SessionID == sessionID {
			// Same owner — extend TTL
			d.conn.Exec(`UPDATE file_locks SET expires_at = ? WHERE id = ?`, expiresAt, existing.ID)
			existing.ExpiresAt = expiresAt
			return existing, nil
		} else {
			return nil, &LockConflictError{
				FilePath:  filePath,
				HeldBy:    existing.SessionID,
				AgentKey:  existing.AgentKey,
				ExpiresAt: existing.ExpiresAt,
			}
		}
	}

	lock := &FileLock{
		ID:         newID(),
		FilePath:   filePath,
		SessionID:  sessionID,
		AgentKey:   agentKey,
		LockType:   lockType,
		AcquiredAt: now,
		ExpiresAt:  expiresAt,
	}
	if lock.LockType == "" {
		lock.LockType = "advisory"
	}
	_, err = d.conn.Exec(
		`INSERT INTO file_locks (id, file_path, session_id, agent_key, lock_type, acquired_at, expires_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?)`,
		lock.ID, lock.FilePath, lock.SessionID, lock.AgentKey, lock.LockType, lock.AcquiredAt, lock.ExpiresAt,
	)
	return lock, err
}

func (d *DB) ReleaseLock(filePath, sessionID string) error {
	_, err := d.conn.Exec(`DELETE FROM file_locks WHERE file_path = ? AND session_id = ?`, filePath, sessionID)
	return err
}

func (d *DB) ForceReleaseLock(lockID string) error {
	_, err := d.conn.Exec(`DELETE FROM file_locks WHERE id = ?`, lockID)
	return err
}

func (d *DB) ReleaseSessionLocks(sessionID string) error {
	_, err := d.conn.Exec(`DELETE FROM file_locks WHERE session_id = ?`, sessionID)
	return err
}

func (d *DB) ListLocks() ([]*FileLock, error) {
	rows, err := d.conn.Query(
		`SELECT id, file_path, session_id, agent_key, lock_type, acquired_at, expires_at FROM file_locks ORDER BY acquired_at DESC`,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []*FileLock
	for rows.Next() {
		l := &FileLock{}
		if err := rows.Scan(&l.ID, &l.FilePath, &l.SessionID, &l.AgentKey, &l.LockType, &l.AcquiredAt, &l.ExpiresAt); err != nil {
			return nil, err
		}
		out = append(out, l)
	}
	return out, rows.Err()
}

func (d *DB) CleanExpiredLocks() (int, error) {
	result, err := d.conn.Exec(`DELETE FROM file_locks WHERE expires_at > 0 AND expires_at < ?`, nowMs())
	if err != nil {
		return 0, err
	}
	n, _ := result.RowsAffected()
	return int(n), nil
}

// ── Messages ──────────────────────────────────────────────────────────────

func (d *DB) SendMessage(fromSession, fromAgent, toSession, toAgent, msgType, subject, body, taskID string) (*Message, error) {
	if msgType == "" {
		msgType = "info"
	}
	m := &Message{
		ID:          newID(),
		FromSession: fromSession,
		FromAgent:   fromAgent,
		ToSession:   toSession,
		ToAgent:     toAgent,
		MsgType:     msgType,
		Subject:     subject,
		Body:        body,
		TaskID:      taskID,
		CreatedAt:   nowMs(),
	}
	_, err := d.conn.Exec(
		`INSERT INTO messages (id, from_session, from_agent, to_session, to_agent, msg_type, subject, body, task_id, created_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		m.ID, m.FromSession, m.FromAgent, m.ToSession, m.ToAgent, m.MsgType, m.Subject, m.Body, m.TaskID, m.CreatedAt,
	)
	return m, err
}

func (d *DB) GetMessages(sessionID string, unreadOnly bool) ([]*Message, error) {
	query := `SELECT id, from_session, from_agent, to_session, to_agent, msg_type, subject, body, task_id, read_at, archived, created_at
		FROM messages WHERE (to_session = ? OR (to_session = '' AND from_session != ?)) AND archived = 0`
	if unreadOnly {
		query += ` AND read_at = 0`
	}
	query += ` ORDER BY created_at DESC`

	rows, err := d.conn.Query(query, sessionID, sessionID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []*Message
	for rows.Next() {
		m := &Message{}
		if err := rows.Scan(&m.ID, &m.FromSession, &m.FromAgent, &m.ToSession, &m.ToAgent, &m.MsgType, &m.Subject, &m.Body, &m.TaskID, &m.ReadAt, &m.Archived, &m.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, m)
	}
	return out, rows.Err()
}

func (d *DB) GetUnreadCount(sessionID string) (int, error) {
	var count int
	err := d.conn.QueryRow(
		`SELECT COUNT(*) FROM messages WHERE (to_session = ? OR (to_session = '' AND from_session != ?)) AND read_at = 0 AND archived = 0`,
		sessionID, sessionID,
	).Scan(&count)
	return count, err
}

func (d *DB) MarkMessageRead(id string) error {
	_, err := d.conn.Exec(`UPDATE messages SET read_at = ? WHERE id = ?`, nowMs(), id)
	return err
}

func (d *DB) ArchiveSessionMessages(sessionID string) error {
	_, err := d.conn.Exec(`UPDATE messages SET archived = 1 WHERE to_session = ?`, sessionID)
	return err
}

// ── Errors ────────────────────────────────────────────────────────────────

type LockConflictError struct {
	FilePath  string
	HeldBy    string
	AgentKey  string
	ExpiresAt int64
}

func (e *LockConflictError) Error() string {
	return "lock conflict: " + e.FilePath + " held by session " + e.HeldBy
}
