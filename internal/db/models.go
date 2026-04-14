package db

// Session represents a PTY session (terminal pane).
type Session struct {
	ID        string `json:"id"`
	AgentKey  string `json:"agent_key"`
	Status    string `json:"status"` // running, exited
	ExitCode  int    `json:"exit_code,omitempty"`
	CreatedAt int64  `json:"created_at"`
	ExitedAt  int64  `json:"exited_at,omitempty"`
}

// Task represents a work item dispatched to an agent.
type Task struct {
	ID            string `json:"id"`
	Title         string `json:"title"`
	Description   string `json:"description,omitempty"`
	TaskKnowledge string `json:"task_knowledge,omitempty"`
	AgentKey      string `json:"agent_key,omitempty"`
	SessionID     string `json:"session_id,omitempty"`
	Status        string `json:"status"` // todo, in-progress, in-review, complete
	SortOrder     float64 `json:"sort_order"`
	CallbackURL   string `json:"callback_url,omitempty"`
	Meta          string `json:"meta,omitempty"` // JSON blob
	CreatedAt     int64  `json:"created_at"`
	UpdatedAt     int64  `json:"updated_at"`
}

// FileLock represents an advisory file lock held by an agent session.
type FileLock struct {
	ID         string `json:"id"`
	FilePath   string `json:"file_path"`
	SessionID  string `json:"session_id"`
	AgentKey   string `json:"agent_key,omitempty"`
	LockType   string `json:"lock_type"` // advisory
	AcquiredAt int64  `json:"acquired_at"`
	ExpiresAt  int64  `json:"expires_at,omitempty"`
}

// Message represents an inter-agent message.
type Message struct {
	ID          string `json:"id"`
	FromSession string `json:"from_session"`
	FromAgent   string `json:"from_agent,omitempty"`
	ToSession   string `json:"to_session,omitempty"` // empty = broadcast
	ToAgent     string `json:"to_agent,omitempty"`
	MsgType     string `json:"msg_type"` // info, etc.
	Subject     string `json:"subject,omitempty"`
	Body        string `json:"body"`
	TaskID      string `json:"task_id,omitempty"`
	ReadAt      int64  `json:"read_at,omitempty"`
	Archived    bool   `json:"archived,omitempty"`
	CreatedAt   int64  `json:"created_at"`
}
