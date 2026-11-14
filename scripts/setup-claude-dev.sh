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
apt-get install -y git tmux jq curl uidmap dbus-user-session gh
# Rootless Docker needs this package from Docker's repository (skip if you use another setup).
apt-get install -y docker-ce-rootless-extras || echo "WARN: docker-ce-rootless-extras not installed; set up rootless Docker manually."

echo "==> 2/5 User $DEV_USER (no sudo, not in the docker group)"
if ! id "$DEV_USER" >/dev/null 2>&1; then
  adduser --disabled-password --gecos "" "$DEV_USER"
fi
# Keep user services (rootless Docker, Remote Control) running without an open login.
loginctl enable-linger "$DEV_USER"

echo "==> 3/5 Rootless Docker for $DEV_USER"
sudo -iu "$DEV_USER" bash -lc '
  export XDG_RUNTIME_DIR=/run/user/$(id -u)
  if command -v dockerd-rootless-setuptool.sh >/dev/null; then
    dockerd-rootless-setuptool.sh install || true
    grep -q DOCKER_HOST ~/.bashrc || echo "export DOCKER_HOST=unix://\$XDG_RUNTIME_DIR/docker.sock" >> ~/.bashrc
  fi
'

echo "==> 4/5 Node $NODE_MAJOR (nvm) and Claude Code (native installer) for $DEV_USER"
sudo -iu "$DEV_USER" bash -lc "
  curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
  export NVM_DIR=\$HOME/.nvm; . \$NVM_DIR/nvm.sh
  nvm install $NODE_MAJOR && nvm alias default $NODE_MAJOR
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
