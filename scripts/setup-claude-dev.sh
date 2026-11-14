#!/usr/bin/env bash
# Prepares the home server for agentic development of Abaqo.
# Run as a sudo-capable user:  sudo bash scripts/setup-claude-dev.sh
# Tested target: Ubuntu 22.04+/Debian 12 with Docker installed from Docker's apt repository.
set -euo pipefail

DEV_USER="${DEV_USER:-claude-dev}"
NODE_MAJOR="${NODE_MAJOR:-24}"

if [ "$(id -u)" -ne 0 ]; then
  echo "Run with sudo." >&2
  exit 1
fi

echo "==> 1/5 Packages"
apt-get update -y
apt-get install -y git tmux jq curl xz-utils uidmap dbus-user-session gh
# Rootless Docker needs this package from Docker's repository (skip if you use another setup).
apt-get install -y docker-ce-rootless-extras || echo "WARN: docker-ce-rootless-extras not installed; set up rootless Docker manually."

echo "==> 2/5 User $DEV_USER (no sudo, not in the docker group)"
if ! id "$DEV_USER" >/dev/null 2>&1; then
  adduser --disabled-password --gecos "" "$DEV_USER"
fi
# Keep user services (rootless Docker, Remote Control) running without an open login.
loginctl enable-linger "$DEV_USER"

echo "==> 3/5 Rootless Docker for $DEV_USER"
# The rootless daemon listens on $XDG_RUNTIME_DIR/docker.sock. The docker context is pointed
# there so non-interactive shells (Claude Code, systemd units) work without ~/.bashrc.
sudo -iu "$DEV_USER" bash -lc '
  export XDG_RUNTIME_DIR=/run/user/$(id -u)
  if command -v dockerd-rootless-setuptool.sh >/dev/null; then
    dockerd-rootless-setuptool.sh install || true
    sock="unix://$XDG_RUNTIME_DIR/docker.sock"
    docker context inspect rootless >/dev/null 2>&1 || docker context create rootless --docker "host=$sock"
    docker context update rootless --docker "host=$sock"
    docker context use rootless
    grep -q DOCKER_HOST ~/.bashrc || echo "export DOCKER_HOST=$sock" >> ~/.bashrc
  fi
'

echo "==> 4/5 Node $NODE_MAJOR (official binary in ~/.local) and Claude Code for $DEV_USER"
# No nvm: it only loads in interactive shells, so Claude Code and MCP servers would not find
# node. The binary goes to ~/.local/node with links in ~/.local/bin, which is already on PATH.
sudo -iu "$DEV_USER" bash -lc "
  set -euo pipefail
  case \$(uname -m) in x86_64) arch=x64 ;; aarch64) arch=arm64 ;; *) echo 'Unsupported CPU' >&2; exit 1 ;; esac
  base=https://nodejs.org/dist/latest-v$NODE_MAJOR.x
  tmp=\$(mktemp -d); cd \$tmp
  curl -fsSLO \$base/SHASUMS256.txt
  file=\$(grep -o \"node-v[0-9.]*-linux-\$arch.tar.xz\" SHASUMS256.txt | head -1)
  curl -fsSLO \$base/\$file
  grep \" \$file\\$\" SHASUMS256.txt | sha256sum -c -
  rm -rf ~/.local/node && mkdir -p ~/.local/node ~/.local/bin
  tar -xJf \$file -C ~/.local/node --strip-components=1
  for b in node npm npx corepack; do ln -sf ~/.local/node/bin/\$b ~/.local/bin/\$b; done
  cd; rm -rf \$tmp
  curl -fsSL https://claude.ai/install.sh | bash
"

echo "==> 5/5 systemd user unit for Remote Control (not enabled yet)"
UNIT_DIR="/home/$DEV_USER/.config/systemd/user"
mkdir -p "$UNIT_DIR"
cat > "$UNIT_DIR/claude-rc.service" <<'EOF'
[Unit]
Description=Claude Code Remote Control for Abaqo (tmux session "abaqo")

[Service]
Type=forking
WorkingDirectory=%h/abaqo
Environment=DOCKER_HOST=unix://%t/docker.sock
ExecStart=/usr/bin/tmux new-session -d -s abaqo -c %h/abaqo "bash -lc '%h/.local/bin/claude remote-control --name Abaqo --spawn worktree'"
ExecStop=/usr/bin/tmux kill-session -t abaqo
Restart=on-failure
RestartSec=30

[Install]
WantedBy=default.target
EOF
chown -R "$DEV_USER:$DEV_USER" "/home/$DEV_USER/.config"

cat <<EOF

Done. Next steps (as $DEV_USER):
  sudo -iu $DEV_USER
  git clone git@github.com:<you>/abaqo.git ~/abaqo   # or: mkdir ~/abaqo && cd ~/abaqo && git init
  gh auth login
  cd ~/abaqo && claude                               # log in with your claude.ai account, trust the folder
  claude remote-control --name Abaqo                 # answer 'y' once, check it appears in the app, Ctrl+C
  systemctl --user enable --now claude-rc            # from now on it starts with the server
  tmux attach -t abaqo                               # to look at it locally (detach: Ctrl+b d)
EOF
