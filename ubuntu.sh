#!/usr/bin/env bash
# ==============================================================================
# Dr Duit — Complete VPS Setup & Fix Script for Ubuntu 22.04 / 24.04 LTS
# Solves: Python 3.12, Node.js 22 LTS, Swap Memory (OOM fix), Systemd User/Root Bus,
#         Build Tools, Docker, and Nginx.
# ==============================================================================

set -euo pipefail

# 1. Pastikan script dijalankan sebagai root / sudo
if [ "$EUID" -ne 0 ]; then
  echo "[-] Harap jalankan script ini sebagai root atau dengan sudo:"
  echo "    sudo bash $0"
  exit 1
fi

echo "=================================================="
echo "      Memulai Setup & Perbaikan VPS Dr Duit       "
echo "=================================================="

# 2. Konfigurasi Swap Memory (2 GB)
# Sangat penting untuk mencegah error 'Killed' (OOM) saat build frontend React
CURRENT_SWAP=$(free -m | awk '/^Swap:/ {print $2}')
if [ -z "$CURRENT_SWAP" ] || [ "$CURRENT_SWAP" -lt 1000 ]; then
  echo "[+] Menyiapkan 2 GB Swap Memory..."
  swapoff /swapfile 2>/dev/null || true
  rm -f /swapfile
  fallocate -l 2G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=2048
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  if ! grep -q '/swapfile' /etc/fstab; then
    echo '/swapfile none swap sw 0 0' >> /etc/fstab
  fi
  sysctl vm.swappiness=10
  echo 'vm.swappiness=10' > /etc/sysctl.d/99-swap.conf
  echo "[✓] Swap memory 2 GB berhasil diaktifkan."
else
  echo "[✓] Swap memory sudah aktif (${CURRENT_SWAP} MB)."
fi

# 3. Update sistem & install tools build + D-Bus / Systemd packages
echo "[+] Mengupdate sistem & menginstall build tools & D-Bus..."
apt-get update -y
DEBIAN_FRONTEND=noninteractive apt-get install -y \
  git \
  curl \
  wget \
  make \
  build-essential \
  software-properties-common \
  ca-certificates \
  gnupg \
  nginx \
  dbus-user-session \
  systemd \
  libpam-systemd

# 4. Setup Python 3.12 & dependencies (termasuk venv & dev)
echo "[+] Menyiapkan Python 3.12..."
UBUNTU_CODENAME=$(lsb_release -cs 2>/dev/null || echo "jammy")
if [ "$UBUNTU_CODENAME" != "noble" ]; then
  # Di Ubuntu 22.04 (jammy) tambahkan PPA deadsnakes untuk Python 3.12
  add-apt-repository ppa:deadsnakes/ppa -y
  apt-get update -y
fi

DEBIAN_FRONTEND=noninteractive apt-get install -y \
  python3.12 \
  python3.12-venv \
  python3.12-dev

# Pastikan pip terinstall untuk Python 3.12
curl -sS https://bootstrap.pypa.io/get-pip.py | python3.12 || true

# 5. Install Node.js 22 LTS & npm (NodeSource resmi)
echo "[+] Menginstall Node.js 22 LTS..."
mkdir -p /etc/apt/keyrings
curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg --yes
echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_22.x nodistro main" | tee /etc/apt/sources.list.d/nodesource.list
apt-get update -y
DEBIAN_FRONTEND=noninteractive apt-get install -y nodejs

# 6. Fix Systemd Environment untuk User & Root (Mencegah error 'Failed to connect to bus')
echo "[+] Mengkonfigurasi Systemd & D-Bus environment..."
CURRENT_USER="${SUDO_USER:-root}"
loginctl enable-linger "$CURRENT_USER" 2>/dev/null || true
loginctl enable-linger root 2>/dev/null || true

# Pastikan direktori runtime user tersedia
mkdir -p /run/user/0
chmod 700 /run/user/0
if [ "$CURRENT_USER" != "root" ]; then
  USER_UID=$(id -u "$CURRENT_USER" 2>/dev/null || echo 1000)
  mkdir -p "/run/user/$USER_UID"
  chown -R "$CURRENT_USER:$CURRENT_USER" "/run/user/$USER_UID"
  chmod 700 "/run/user/$USER_UID"
fi

# Set XDG_RUNTIME_DIR dan NODE_OPTIONS permanen di profile
cat <<'EOF' > /etc/profile.d/drduit-env.sh
if [ -z "$XDG_RUNTIME_DIR" ]; then
  export XDG_RUNTIME_DIR="/run/user/$(id -u)"
fi
export NODE_OPTIONS="--max-old-space-size=2048"
EOF
chmod +x /etc/profile.d/drduit-env.sh
export XDG_RUNTIME_DIR="/run/user/$(id -u)"
export NODE_OPTIONS="--max-old-space-size=2048"

# 7. Install Docker & Compose plugin (Alternatif mudah jika ingin deploy via Docker)
echo "[+] Menyiapkan Docker & Docker Compose..."
if ! command -v docker >/dev/null 2>&1; then
  DEBIAN_FRONTEND=noninteractive apt-get install -y docker.io docker-compose-v2 || true
  systemctl enable --now docker 2>/dev/null || true
fi

# 8. Otomatis jalankan setup jika script ini dijalankan di dalam folder repo
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -f "$SCRIPT_DIR/Makefile" ] && [ -f "$SCRIPT_DIR/scripts/setup.sh" ]; then
  echo ""
  echo "=================================================="
  echo "[+] Terdeteksi dijalankan di dalam folder repo Dr Duit!"
  echo "[+] Menjalankan 'make setup' sekarang..."
  echo "=================================================="
  cd "$SCRIPT_DIR"
  make setup || {
    echo "[-] Warning: make setup menemui kendala, silakan periksa log di atas."
  }
fi

# 9. Verifikasi Hasil Instalasi
echo ""
echo "=================================================="
echo "               Verifikasi Sistem                 "
echo "=================================================="
PYTHON_VER=$(python3.12 --version 2>&1 || echo "Gagal")
NODE_VER=$(node -v 2>&1 || echo "Gagal")
NPM_VER=$(npm -v 2>&1 || echo "Gagal")
MAKE_VER=$(make --version 2>&1 | head -n 1 || echo "Gagal")
DOCKER_VER=$(docker --version 2>&1 || echo "Tidak terinstall")

echo "Python   : $PYTHON_VER"
echo "NodeJS   : $NODE_VER"
echo "NPM      : v$NPM_VER"
echo "Make     : $MAKE_VER"
echo "Docker   : $DOCKER_VER"
echo "XDG Bus  : $XDG_RUNTIME_DIR"
echo "Swap     : $(free -h | awk '/^Swap:/ {print $2}')"
echo "=================================================="
echo "[✓] Setup VPS Selesai! Semua konfigurasi telah siap."
echo ""
echo "Pilihan Menjalankan Dr Duit di VPS:"
echo "--------------------------------------------------"
echo "Opsi 1 (Native - System Service Autostart):"
echo "  make autostart"
echo ""
echo "Opsi 2 (Native - Foreground):"
echo "  make start"
echo ""
echo "Opsi 3 (Docker - Paling Cepat & Praktis):"
echo "  docker compose up -d"
echo "=================================================="
