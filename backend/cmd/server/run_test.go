package main

import (
	"io"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"syscall"
	"testing"
	"time"
)

func freeAddr(t *testing.T) string {
	l, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	defer l.Close()
	return l.Addr().String()
}

func get(url string) (int, string, error) {
	resp, err := http.Get(url)
	if err != nil {
		return 0, "", err
	}
	defer resp.Body.Close()
	b, err := io.ReadAll(resp.Body)
	return resp.StatusCode, string(b), err
}

func TestMainServesAndSavesOnHangup(t *testing.T) {
	state, static := t.TempDir(), t.TempDir()
	if err := os.WriteFile(filepath.Join(static, "index.html"), []byte("spa"), 0o644); err != nil {
		t.Fatal(err)
	}
	addr, statsAddr := freeAddr(t), freeAddr(t)
	logFile := filepath.Join(state, "server.log")
	for k, v := range map[string]string{
		"STATE_DIRECTORY": state,
		"STATIC_DIR":      static,
		"LISTEN_ADDR":     addr,
		"STATS_ADDR":      statsAddr,
		"LOG_LEVEL":       "debug",
		"LOG_FORMAT":      "json",
		"LOG_FILE":        logFile,
	} {
		t.Setenv(k, v)
	}

	done := make(chan struct{})
	go func() { main(); close(done) }()

	var body string
	for deadline := time.Now().Add(5 * time.Second); ; {
		_, b, err := get("http://" + addr + "/healthz")
		if err == nil {
			body = b
			break
		}
		if time.Now().After(deadline) {
			t.Fatalf("server not up: %v", err)
		}
		time.Sleep(20 * time.Millisecond)
	}
	if body != "ok" {
		t.Fatalf("healthz = %q", body)
	}
	if code, b, err := get("http://" + addr + "/lobby/ABC123"); err != nil || code != 200 || b != "spa" {
		t.Fatalf("spa = %d %q %v", code, b, err)
	}
	for deadline := time.Now().Add(5 * time.Second); ; {
		code, _, err := get("http://" + statsAddr + "/")
		if err == nil && code == 200 {
			break
		}
		if time.Now().After(deadline) {
			t.Fatalf("stats = %d %v", code, err)
		}
		time.Sleep(20 * time.Millisecond)
	}

	if err := syscall.Kill(os.Getpid(), syscall.SIGHUP); err != nil {
		t.Fatal(err)
	}
	select {
	case <-done:
	case <-time.After(10 * time.Second):
		t.Fatal("main did not return after SIGHUP")
	}
	if _, err := os.Stat(filepath.Join(state, "lobbies.json")); err != nil {
		t.Fatal(err)
	}
	if b, err := os.ReadFile(logFile); err != nil || !strings.Contains(string(b), "Server stopped") {
		t.Fatalf("log file: %v %q", err, b)
	}
}
