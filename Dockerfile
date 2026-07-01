# syntax=docker/dockerfile:1

# ---- Stage 1: build the frontend ----
FROM oven/bun:1 AS frontend
WORKDIR /app
# Install deps first for better layer caching.
COPY frontend/package.json frontend/bun.lock ./
RUN bun install --frozen-lockfile
COPY frontend/ ./
RUN bun run build

# ---- Stage 2: build the Go server ----
FROM golang:1.26-alpine AS backend
WORKDIR /src
COPY backend/go.mod backend/go.sum ./
RUN go mod download
COPY backend/ ./
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/slf ./cmd/server

# ---- Stage 3: minimal runtime image ----
FROM alpine:3.20
RUN apk add --no-cache wget && adduser -D -u 10001 app
WORKDIR /app
COPY --from=backend /out/slf /app/slf
COPY --from=frontend /app/dist /app/web
# /data is the mount point for the logs volume. Create it owned by the non-root
# user *in the image* so the named volume inherits that ownership on first use
# and the server can actually write LOG_FILE there.
RUN mkdir -p /data && chown app:app /data
ENV STATIC_DIR=/app/web
USER app
EXPOSE 8080
CMD ["/app/slf"]
