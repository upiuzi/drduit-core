#!/usr/bin/env bash
# ==============================================================================
# Dr Duit — VPS Setup Script for Ubuntu 22.04 / 24.04 LTS
# Installs Python 3.12, Node.js 22 LTS, Build Tools, and configures Swap Memory.
# ==============================================================================

set -euo pipefail

# Ensure script is run with root / sudo privileges
if [ "$EUID" -ne 0 ]; then
  echo "[-] Harap jalankan script ini sebagai root atau dengan sudo:"
  echo "    sudo bash $0"
  exit 1
fi

echo "=================================================="
echo "      Memulai Setup VPS untuk Dr Duit             "
echo "=================================================="

# 1. Konfigurasi Swap Memory (2 GB) jika belum ada
# Penting untuk VPS RAM 1GB / 2GB agar tidak kehabisan memori saat build frontend
CURRENT_SWAP=$(free -m | awk '/^Swap:/ {print $2}')
if [ "$CURRENT_SWAP" -lt 1000 ]; then
  echo "[+] Membuat 2 GB Swap Memory..."
  fallocate -l 2G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=2048
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  if ! grep -q '/swapfile' /etc/fstab; then
    echo '/swapfile none swap sw 0 0' >> /etc/fstab
  fi
  sysctl vm.swappiness=10
  echo 'vm.swappiness=10' >> /etc/sysctl.d/99-swap.conf
  echo "[✓] Swap memory 2 GB berhasil diaktifkan."
else
  echo "[✓] Swap memory sudah aktif (${CURRENT_SWAP} MB)."
fi

# 2. Update package list & install tools dasar
echo "[+] Mengupdate sistem & menginstall build tools..."
apt-get update -y
DEBIAN_FRONTEND=noninteractive apt-get upgrade -y
DEBIAN_FRONTEND=noninteractive apt-get install -y \
  git \
  curl \
  wget \
  build-essential \
  software-properties-common \
  ca-certificates \
  gnupg \
  nginx

# 3. Install Python 3.12 & dependencies
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

# 4. Install Node.js 22 LTS & npm
echo "[+] Menginstall Node.js 22 LTS..."
mkdir -p /etc/apt/keyrings
curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg --yes
echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_22.x nodistro main" | tee /etc/apt/sources.list.d/nodesource.list
apt-get update -y
DEBIAN_FRONTEND=noninteractive apt-get install -y nodejs

# 5. Verifikasi Instalasi
echo "=================================================="
echo "               Verifikasi Versi                  "
echo "=================================================="
PYTHON_VER=$(python3.12 --version 2>&1 || echo "Gagal")
NODE_VER=$(node -v 2>&1 || echo "Gagal")
NPM_VER=$(npm -v 2>&1 || echo "Gagal")
GIT_VER=$(git --version 2>&1 || echo "Gagal")

echo "Python : $PYTHON_VER"
echo "NodeJS : $NODE_VER"
echo "NPM    : v$NPM_VER"
echo "Git    : $GIT_VER"
echo "Nginx  : $(nginx -v 2>&1 || echo 'Tersedia')"

echo "=================================================="
echo "[✓] Setup VPS Selesai! VPS Anda siap menjalankan Dr Duit."
echo ""
echo "Langkah berikutnya:"
echo "1. Clone repo: git clone https://github.com/upiuzi/drduit-core.git"
echo "2. Masuk ke folder: cd drduit-core"
echo "3. Jalankan setup: make setup"
echo "4. Jalankan aplikasi: make start (atau make autostart)"
echo "=================================================="
