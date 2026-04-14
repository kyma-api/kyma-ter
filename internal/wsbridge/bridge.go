package wsbridge

import (
	"encoding/json"
	"log"
	"net/http"
	"sync"

	"github.com/google/uuid"
	"github.com/gorilla/mux"
	"github.com/gorilla/websocket"
	"github.com/sonpiaz/kyma-ter/internal/ptymanager"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  32 * 1024,
	WriteBufferSize: 32 * 1024,
	CheckOrigin:     func(r *http.Request) bool { return true },
}

type controlMessage struct {
	Type string `json:"type"`
	Cols uint16 `json:"cols,omitempty"`
	Rows uint16 `json:"rows,omitempty"`
}

// HandleTerminalWS handles WebSocket connections for a PTY session.
// Route: /ws/terminal/{sessionID}
func HandleTerminalWS(mgr *ptymanager.Manager) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		vars := mux.Vars(r)
		sessionID := vars["sessionID"]

		session := mgr.Get(sessionID)
		if session == nil {
			http.Error(w, "session not found", http.StatusNotFound)
			return
		}

		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			log.Printf("ws upgrade error: %v", err)
			return
		}
		defer conn.Close()

		subID := uuid.New().String()
		dataCh, unsub := session.Subscribe(subID)
		defer unsub()

		// Write loop: PTY output → WebSocket
		done := make(chan struct{})
		go func() {
			defer close(done)
			for {
				select {
				case data, ok := <-dataCh:
					if !ok {
						return
					}
					if err := conn.WriteMessage(websocket.BinaryMessage, data); err != nil {
						return
					}
				case <-session.Done():
					// Send exit notification
					exitMsg, _ := json.Marshal(map[string]interface{}{
						"type":      "exited",
						"exit_code": session.ExitCode(),
					})
					conn.WriteMessage(websocket.TextMessage, exitMsg)
					return
				}
			}
		}()

		// Read loop: WebSocket → PTY input
		for {
			msgType, data, err := conn.ReadMessage()
			if err != nil {
				break
			}

			switch msgType {
			case websocket.BinaryMessage:
				// Raw PTY input (keystrokes)
				if err := session.Write(data); err != nil {
					log.Printf("pty write error: %v", err)
				}
			case websocket.TextMessage:
				// JSON control message
				var msg controlMessage
				if err := json.Unmarshal(data, &msg); err != nil {
					continue
				}
				switch msg.Type {
				case "resize":
					if msg.Cols > 0 && msg.Rows > 0 {
						session.Resize(msg.Cols, msg.Rows)
					}
				case "ping":
					pong, _ := json.Marshal(map[string]string{"type": "pong"})
					conn.WriteMessage(websocket.TextMessage, pong)
				}
			}
		}

		<-done
	}
}

// HandleEventsWS handles the global event broadcast WebSocket.
// Route: /ws/events
type EventBroadcaster struct {
	mu      sync.RWMutex
	clients map[*websocket.Conn]bool
}

func NewEventBroadcaster() *EventBroadcaster {
	return &EventBroadcaster{
		clients: make(map[*websocket.Conn]bool),
	}
}

func (eb *EventBroadcaster) HandleEventsWS(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("ws events upgrade error: %v", err)
		return
	}
	defer func() {
		eb.mu.Lock()
		delete(eb.clients, conn)
		eb.mu.Unlock()
		conn.Close()
	}()

	eb.mu.Lock()
	eb.clients[conn] = true
	eb.mu.Unlock()

	// Keep connection alive, read pings
	for {
		_, _, err := conn.ReadMessage()
		if err != nil {
			break
		}
	}
}

func (eb *EventBroadcaster) Broadcast(event interface{}) {
	data, err := json.Marshal(event)
	if err != nil {
		return
	}
	eb.mu.RLock()
	clients := make([]*websocket.Conn, 0, len(eb.clients))
	for conn := range eb.clients {
		clients = append(clients, conn)
	}
	eb.mu.RUnlock()

	for _, conn := range clients {
		if err := conn.WriteMessage(websocket.TextMessage, data); err != nil {
			eb.mu.Lock()
			conn.Close()
			delete(eb.clients, conn)
			eb.mu.Unlock()
		}
	}
}
