package updater

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
)

const (
	releasesRepo          = "kyma-api/kyma-ter"
	legacyVersionURL      = "https://raw.githubusercontent.com/sonpiaz/kyma-releases/main/ter-latest.txt"
	downloadFmt           = "https://github.com/kyma-api/kyma-ter/releases/download/ter-v%s/kyma-ter-%s-%s"
	legacyDownloadFmt     = "https://github.com/sonpiaz/kyma-releases/releases/download/ter-v%s/kyma-ter-%s-%s"
	githubLatestReleaseAPI = "https://api.github.com/repos/" + releasesRepo + "/releases/latest"
)

type githubLatestRelease struct {
	TagName string `json:"tag_name"`
}

func kymaDir() string {
	home, _ := os.UserHomeDir()
	return filepath.Join(home, ".kyma", "ter")
}

func binPath() string    { return filepath.Join(kymaDir(), "bin", "kyma-ter") }
func newBinPath() string { return filepath.Join(kymaDir(), "bin", "kyma-ter.new") }
func versionPath() string { return filepath.Join(kymaDir(), "version") }

// ApplyPending swaps in a previously downloaded update.
// Call this early in startup, before the server starts.
func ApplyPending() {
	newBin := newBinPath()
	if _, err := os.Stat(newBin); err != nil {
		return
	}

	bin := binPath()
	old := bin + ".old"

	// Rename current → .old, new → current
	_ = os.Remove(old)
	if err := os.Rename(bin, old); err != nil {
		_ = os.Remove(newBin)
		return
	}
	if err := os.Rename(newBin, bin); err != nil {
		// Rollback
		_ = os.Rename(old, bin)
		return
	}
	_ = os.Remove(old)
}

// CheckInBackground checks for a newer version and downloads it.
// The update is applied on next startup via ApplyPending.
func CheckInBackground(currentVersion string) {
	go func() {
		if err := check(currentVersion); err != nil {
			// Silent — don't disturb the user
			_ = err
		}
	}()
}

func check(currentVersion string) error {
	if currentVersion == "dev" {
		return nil
	}

	latest, err := fetchLatestVersion()
	if err != nil {
		return err
	}

	cmp, err := compareVersions(latest, currentVersion)
	if err != nil {
		return err
	}

	if cmp <= 0 {
		return nil
	}

	// Determine platform
	goos := runtime.GOOS
	goarch := runtime.GOARCH
	if goarch == "amd64" {
		// already correct
	} else if goarch == "arm64" {
		// already correct
	} else {
		return fmt.Errorf("unsupported arch: %s", goarch)
	}

	url := fmt.Sprintf(downloadFmt, latest, goos, goarch)
	dest := newBinPath()

	if err := downloadBinary(url, dest); err != nil {
		legacyURL := fmt.Sprintf(legacyDownloadFmt, latest, goos, goarch)
		if err := downloadBinary(legacyURL, dest); err != nil {
			_ = os.Remove(dest)
			return err
		}
	}

	// Write the new version so postinstall stays in sync
	_ = os.WriteFile(versionPath(), []byte(latest), 0644)

	return nil
}

func fetchLatestVersion() (string, error) {
	req, err := http.NewRequest(http.MethodGet, githubLatestReleaseAPI, nil)
	if err == nil {
		req.Header.Set("Accept", "application/vnd.github+json")
		req.Header.Set("User-Agent", "kyma-ter-updater")

		resp, err := http.DefaultClient.Do(req)
		if err == nil {
			defer resp.Body.Close()
			if resp.StatusCode == 200 {
				var payload githubLatestRelease
				if err := json.NewDecoder(io.LimitReader(resp.Body, 4096)).Decode(&payload); err == nil {
					tag := strings.TrimSpace(strings.TrimPrefix(payload.TagName, "ter-v"))
					if tag != "" {
						return tag, nil
					}
				}
			}
		}
	}

	return fetchLegacyLatestVersion()
}

func fetchLegacyLatestVersion() (string, error) {
	resp, err := http.Get(legacyVersionURL)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return "", fmt.Errorf("version check: HTTP %d", resp.StatusCode)
	}

	data, err := io.ReadAll(io.LimitReader(resp.Body, 64))
	if err != nil {
		return "", err
	}

	return strings.TrimSpace(string(data)), nil
}

func downloadBinary(url, dest string) error {
	resp, err := http.Get(url)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return fmt.Errorf("download: HTTP %d", resp.StatusCode)
	}

	dir := filepath.Dir(dest)
	_ = os.MkdirAll(dir, 0755)

	f, err := os.OpenFile(dest, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0755)
	if err != nil {
		return err
	}
	defer f.Close()

	_, err = io.Copy(f, resp.Body)
	return err
}

func compareVersions(a, b string) (int, error) {
	parse := func(v string) ([3]int, error) {
		var out [3]int
		v = strings.TrimSpace(strings.TrimPrefix(v, "v"))
		parts := strings.Split(v, ".")
		if len(parts) != 3 {
			return out, fmt.Errorf("invalid version %q", v)
		}
		for i, part := range parts {
			n, err := strconv.Atoi(part)
			if err != nil {
				return out, fmt.Errorf("invalid version %q", v)
			}
			out[i] = n
		}
		return out, nil
	}

	va, err := parse(a)
	if err != nil {
		return 0, err
	}
	vb, err := parse(b)
	if err != nil {
		return 0, err
	}

	for i := range va {
		if va[i] > vb[i] {
			return 1, nil
		}
		if va[i] < vb[i] {
			return -1, nil
		}
	}

	return 0, nil
}
