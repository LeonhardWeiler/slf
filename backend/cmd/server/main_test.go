package main

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
)

func TestSpaHandlerPrecompressed(t *testing.T) {
	dir := t.TempDir()
	for name, body := range map[string]string{
		"index.html":       "index",
		"index.html.gz":    "index-gz",
		"assets/a.js":      "js",
		"assets/a.js.br":   "js-br",
		"assets/a.js.gz":   "js-gz",
		"assets/plain.css": "css",
	} {
		p := filepath.Join(dir, name)
		if err := os.MkdirAll(filepath.Dir(p), 0o755); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(p, []byte(body), 0o644); err != nil {
			t.Fatal(err)
		}
	}
	h := spaHandler(dir)
	for _, tc := range []struct{ path, accept, body, enc, ctype string }{
		{"/assets/a.js", "gzip, deflate, br", "js-br", "br", "text/javascript; charset=utf-8"},
		{"/assets/a.js", "gzip", "js-gz", "gzip", "text/javascript; charset=utf-8"},
		{"/assets/a.js", "", "js", "", "text/javascript; charset=utf-8"},
		{"/assets/plain.css", "br", "css", "", "text/css; charset=utf-8"},
		{"/join/ABCD", "gzip", "index-gz", "gzip", "text/html; charset=utf-8"},
		{"/", "br", "index", "", "text/html; charset=utf-8"},
	} {
		r := httptest.NewRequest(http.MethodGet, tc.path, nil)
		r.Header.Set("Accept-Encoding", tc.accept)
		w := httptest.NewRecorder()
		h.ServeHTTP(w, r)
		res := w.Result()
		if got := w.Body.String(); got != tc.body {
			t.Errorf("%s [%s]: body %q, want %q", tc.path, tc.accept, got, tc.body)
		}
		if got := res.Header.Get("Content-Encoding"); got != tc.enc {
			t.Errorf("%s [%s]: encoding %q, want %q", tc.path, tc.accept, got, tc.enc)
		}
		if got := res.Header.Get("Content-Type"); got != tc.ctype {
			t.Errorf("%s [%s]: type %q, want %q", tc.path, tc.accept, got, tc.ctype)
		}
		if res.Header.Get("Vary") != "Accept-Encoding" {
			t.Errorf("%s: missing Vary", tc.path)
		}
	}
}

func TestSpaHandlerCaching(t *testing.T) {
	real, dir := t.TempDir(), filepath.Join(t.TempDir(), "link")
	if err := os.WriteFile(filepath.Join(real, "index.html"), []byte("index"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.Symlink(real, dir); err != nil {
		t.Fatal(err)
	}
	h := spaHandler(dir)
	get := func(path, etag string) *http.Response {
		r := httptest.NewRequest(http.MethodGet, path, nil)
		if etag != "" {
			r.Header.Set("If-None-Match", etag)
		}
		w := httptest.NewRecorder()
		h.ServeHTTP(w, r)
		return w.Result()
	}
	if res := get("/assets/gone.js", ""); res.StatusCode != http.StatusNotFound {
		t.Errorf("missing asset: status %d, want 404", res.StatusCode)
	}
	res := get("/", "")
	etag := res.Header.Get("ETag")
	if etag == "" || res.Header.Get("Last-Modified") != "" || res.Header.Get("Cache-Control") != "no-cache" {
		t.Errorf("index headers: %v", res.Header)
	}
	if res := get("/join/abc", etag); res.StatusCode != http.StatusNotModified {
		t.Errorf("same etag: status %d, want 304", res.StatusCode)
	}
	if res := get("/", `"stale"`); res.StatusCode != http.StatusOK {
		t.Errorf("stale etag: status %d, want 200", res.StatusCode)
	}
}
