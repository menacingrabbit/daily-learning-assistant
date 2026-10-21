#!/bin/sh
# Seeds config/topics.yaml on first run, then hands over to the app.
# Uses only files baked into the image, so it works before any credentials
# exist. Never overwrites an existing topics.yaml.
set -eu

CONFIG_DIR=/app/config
CONFIG_FILE="$CONFIG_DIR/topics.yaml"
DEFAULT_FILE=/opt/dla/topics.example.yaml

if [ ! -f "$CONFIG_FILE" ]; then
  if [ ! -f "$DEFAULT_FILE" ]; then
    echo "[docker-entrypoint] ERROR: $DEFAULT_FILE is missing from the image." >&2
    exit 1
  fi

  echo "[docker-entrypoint] No $CONFIG_FILE yet - creating it from the shipped example."
  if cp "$DEFAULT_FILE" "$CONFIG_FILE" 2>/dev/null; then
    echo "[docker-entrypoint] Created $CONFIG_FILE. Edit config/topics.yaml on your"
    echo "[docker-entrypoint] computer to change what you study, then restart."
    # On Linux bind mounts the container runs as root, so the new file would
    # otherwise belong to root on the host. Match the directory's owner instead.
    # Harmless (and usually a no-op) on Docker Desktop.
    if [ "$(id -u)" = "0" ]; then
      owner="$(stat -c '%u:%g' "$CONFIG_DIR" 2>/dev/null || true)"
      if [ -n "${owner:-}" ]; then
        chown "$owner" "$CONFIG_FILE" 2>/dev/null || true
      fi
    fi
  else
    echo "[docker-entrypoint] ERROR: could not write $CONFIG_FILE." >&2
    echo "[docker-entrypoint] If ./config is mounted read-only, create the file on" >&2
    echo "[docker-entrypoint] your computer instead:" >&2
    echo "    cp config/topics.example.yaml config/topics.yaml" >&2
    exit 1
  fi
fi

mkdir -p /app/data 2>/dev/null || true

exec "$@"
