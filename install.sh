#!/bin/sh
# Install create-erxes-plugin as a standalone binary (no Node.js required).
#
#   curl -fsSL https://raw.githubusercontent.com/erxes/create-erxes-plugin/main/install.sh | sh
#   curl -fsSL https://raw.githubusercontent.com/erxes/create-erxes-plugin/main/install.sh | sh -s -- --version 0.2.0 --dir ~/bin
set -eu

REPO="erxes/create-erxes-plugin"
BIN="create-erxes-plugin"

say() { printf '%s\n' "$*"; }
fail() { printf 'install.sh: %s\n' "$*" >&2; exit 1; }
need() { command -v "$1" >/dev/null 2>&1; }

usage() {
  cat <<EOF
Usage: install.sh [--version <v>] [--dir <path>]

  --version <v>   release to install (default: latest)
  --dir <path>    install directory (default: /usr/local/bin, else ~/.local/bin)

Environment overrides: CREATE_ERXES_PLUGIN_VERSION, CREATE_ERXES_PLUGIN_INSTALL_DIR
EOF
}

fetch() {
  if need curl; then
    curl -fsSL "$1" -o "$2"
  elif need wget; then
    wget -qO "$2" "$1"
  else
    fail "curl or wget is required"
  fi
}

main() {
  version="${CREATE_ERXES_PLUGIN_VERSION:-}"
  dir="${CREATE_ERXES_PLUGIN_INSTALL_DIR:-}"
  base_url="${CREATE_ERXES_PLUGIN_BASE_URL:-https://github.com/$REPO/releases}"

  while [ $# -gt 0 ]; do
    case "$1" in
      --version)
        [ $# -ge 2 ] || fail "--version requires a value"
        version="$2"; shift 2 ;;
      --version=*) version="${1#*=}"; shift ;;
      --dir)
        [ $# -ge 2 ] || fail "--dir requires a value"
        dir="$2"; shift 2 ;;
      --dir=*) dir="${1#*=}"; shift ;;
      -h | --help) usage; exit 0 ;;
      *) usage >&2; fail "unknown argument: $1" ;;
    esac
  done

  case "$(uname -s)" in
    Linux)
      os=linux
      if ldd --version 2>&1 | grep -qi musl; then libc=-musl; else libc=; fi ;;
    Darwin) os=darwin; libc= ;;
    MINGW* | MSYS* | CYGWIN*) os=windows; libc= ;;
    *) fail "unsupported OS $(uname -s) — use npx $BIN instead" ;;
  esac
  case "$(uname -m)" in
    x86_64 | amd64) arch=x64 ;;
    aarch64 | arm64) arch=arm64 ;;
    *) fail "unsupported architecture $(uname -m) — use npx $BIN instead" ;;
  esac
  if [ "$os" = windows ] && [ "$arch" != x64 ]; then
    fail "only x64 Windows builds are published — use npx $BIN instead"
  fi

  target="$os-$arch$libc"
  if [ "$os" = windows ]; then
    asset="$BIN-$target.zip"
    exe="$BIN.exe"
    need unzip || fail "unzip is required on Windows — install it or use npx $BIN"
  else
    asset="$BIN-$target.tar.gz"
    exe="$BIN"
  fi

  if [ -z "$dir" ]; then
    if [ -d /usr/local/bin ] && [ -w /usr/local/bin ]; then
      dir=/usr/local/bin
    else
      dir="$HOME/.local/bin"
    fi
  fi
  mkdir -p "$dir"

  version="${version#v}"
  if [ -n "$version" ]; then
    release="$base_url/download/v$version"
  else
    release="$base_url/latest/download"
  fi

  tmp=$(mktemp -d)
  trap 'rm -rf "$tmp"' EXIT

  say "Downloading $BIN $target..."
  fetch "$release/$asset" "$tmp/$asset" || fail "download failed: $release/$asset"

  if fetch "$release/SHA256SUMS" "$tmp/SHA256SUMS" 2>/dev/null; then
    if need sha256sum; then
      actual=$(sha256sum "$tmp/$asset" | cut -d' ' -f1)
    elif need shasum; then
      actual=$(shasum -a 256 "$tmp/$asset" | cut -d' ' -f1)
    else
      actual=
      say "warning: neither sha256sum nor shasum found; skipping checksum verification"
    fi
    if [ -n "$actual" ]; then
      expected=$(awk -v f="$asset" '$NF == f {print $1}' "$tmp/SHA256SUMS")
      [ -n "$expected" ] || fail "SHA256SUMS has no entry for $asset"
      [ "$actual" = "$expected" ] || fail "checksum mismatch for $asset"
      say "Checksum verified."
    fi
  else
    say "warning: could not download SHA256SUMS; skipping checksum verification"
  fi

  mkdir -p "$tmp/x"
  if [ "$os" = windows ]; then
    unzip -q "$tmp/$asset" -d "$tmp/x"
  else
    tar -xzf "$tmp/$asset" -C "$tmp/x"
  fi
  chmod +x "$tmp/x/$exe"
  mv -f "$tmp/x/$exe" "$dir/$exe"

  say "Installed $dir/$exe"
  say "version: $("$dir/$exe" --version)"

  case ":$PATH:" in
    *":$dir:"*) ;;
    *)
      say "Note: $dir is not in your PATH. Add it with:"
      say "  export PATH=\"$dir:\$PATH\"" ;;
  esac
}

main "$@"
