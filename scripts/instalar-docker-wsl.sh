#!/usr/bin/env bash
# Ejecutar manualmente desde una terminal WSL con sudo, no dentro del sandbox.
# Fuente: https://docs.docker.com/engine/install/ubuntu/
set -euo pipefail

if [[ "$EUID" -ne 0 ]]; then
  echo 'Se requiere: sudo bash scripts/instalar-docker-wsl.sh' >&2
  exit 1
fi
if [[ "$(cat /proc/1/comm)" != systemd ]]; then
  echo 'PID 1 no es systemd. No se cambia /etc/wsl.conf ni se inicia un daemon manual.' >&2
  echo 'Revisar la sesión WSL y autorizar por separado cualquier cambio de arranque.' >&2
  exit 1
fi
. /etc/os-release
if [[ "$ID" != ubuntu || ! " jammy noble resolute stonking " =~ " $VERSION_CODENAME " ]]; then
  echo 'Distribución fuera de las versiones de Ubuntu verificadas en Docker Docs.' >&2
  exit 1
fi
if command -v docker >/dev/null && docker info >/dev/null 2>&1; then
  echo 'Docker ya está operativo; no se modifica la instalación.'
  exit 0
fi
for package in docker.io docker-compose docker-compose-v2 docker-doc docker-buildx podman-docker containerd runc; do
  if dpkg-query -W -f='${Status}' "$package" 2>/dev/null | grep -q 'install ok installed'; then
    echo "Paquete potencialmente conflictivo: $package. Revisar antes; no se elimina automáticamente." >&2
    exit 1
  fi
done
if [[ -e /etc/apt/sources.list.d/docker.sources || -e /etc/apt/keyrings/docker.asc ]]; then
  echo 'Ya existe configuración de repositorio Docker. Revisarla; no se sobrescribe.' >&2
  exit 1
fi

apt-get update
apt-get install -y ca-certificates curl
install -m 0755 -d /etc/apt/keyrings
curl --fail --silent --show-error --location --proto '=https' --tlsv1.2 \
  https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc
cat > /etc/apt/sources.list.d/docker.sources <<EOF
Types: deb
URIs: https://download.docker.com/linux/ubuntu
Suites: $VERSION_CODENAME
Components: stable
Architectures: $(dpkg --print-architecture)
Signed-By: /etc/apt/keyrings/docker.asc
EOF
apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
systemctl start docker
docker version
docker compose version
docker run --rm hello-world
echo 'No se modificaron grupos, sudoers, firewall, WSL ni se expuso el socket por TCP.'
