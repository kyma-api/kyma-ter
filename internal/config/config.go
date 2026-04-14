package config

import (
	"encoding/json"
	"os"
	"path/filepath"
)

type AgentConfig struct {
	Name      string            `json:"name"`
	Command   string            `json:"command"`
	Args      []string          `json:"args,omitempty"`
	EnvVars   map[string]string `json:"envvars,omitempty"`
	Icon      string            `json:"icon,omitempty"`
	Color     string            `json:"color,omitempty"`
	AutoTrust bool              `json:"autotrust,omitempty"`
}

type Config struct {
	Agents     map[string]*AgentConfig `json:"agents,omitempty"`
	APIKey     string                  `json:"apikey,omitempty"`
	KymaAPIKey string                  `json:"kyma_api_key,omitempty"`
	Port       int                     `json:"port,omitempty"`
	BindAddr   string                  `json:"bindaddr,omitempty"`
}

var DefaultAgents = map[string]*AgentConfig{
	"kyma": {Name: "Kyma Agent", Command: "kyma", Icon: "robot", Color: "#eab308"},
}

func configDir() string {
	home, _ := os.UserHomeDir()
	return filepath.Join(home, ".config", "kyma-ter")
}

func configPath() string {
	return filepath.Join(configDir(), "config.json")
}

func (c *Config) DataDir() string {
	return configDir()
}

func (c *Config) GetPort() int {
	if c.Port > 0 {
		return c.Port
	}
	return 18800
}

func (c *Config) GetBindAddr() string {
	if c.BindAddr != "" {
		return c.BindAddr
	}
	return "0.0.0.0"
}

// ResolveAgent returns the agent config for the given key, merging defaults.
func (c *Config) ResolveAgent(key string) *AgentConfig {
	if c.Agents != nil {
		if a, ok := c.Agents[key]; ok {
			return a
		}
	}
	if a, ok := DefaultAgents[key]; ok {
		return a
	}
	return nil
}

func Load() (*Config, error) {
	cfg := &Config{}
	data, err := os.ReadFile(configPath())
	if err != nil {
		if os.IsNotExist(err) {
			return cfg, nil
		}
		return nil, err
	}
	if err := json.Unmarshal(data, cfg); err != nil {
		return nil, err
	}
	return cfg, nil
}

func Save(cfg *Config) error {
	dir := configDir()
	if err := os.MkdirAll(dir, 0755); err != nil {
		return err
	}
	data, err := json.MarshalIndent(cfg, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(configPath(), data, 0644)
}
