#!/bin/bash
# Setup script for acnehack.se — run with sudo
# Usage: sudo bash /home/localuser/Acne/deploy/setup.sh

set -e

echo "═══ Step 1: Install Caddy ═══"
if ! command -v caddy &> /dev/null; then
    apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
    apt update
    apt install -y caddy
else
    echo "Caddy already installed: $(caddy version)"
fi

echo ""
echo "═══ Step 2: Install and configure ufw ═══"
if ! command -v ufw &> /dev/null; then
    apt install -y ufw
fi
ufw --force enable
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
# Block port 3000 from external access (Caddy proxies it internally)
ufw deny 3000/tcp
ufw status verbose

echo ""
echo "═══ Step 3: Create log directory ═══"
mkdir -p /var/log/caddy
chown -R caddy:caddy /var/log/caddy

echo ""
echo "═══ Step 4: Install Caddyfile ═══"
cp /home/localuser/Acne/deploy/Caddyfile /etc/caddy/Caddyfile
caddy validate --config /etc/caddy/Caddyfile
systemctl reload caddy || systemctl restart caddy
systemctl enable caddy

echo ""
echo "═══ Step 5: Install systemd service for Node server ═══"
cp /home/localuser/Acne/deploy/acne-ims.service /etc/systemd/system/acne-ims.service
systemctl daemon-reload
systemctl enable acne-ims

# Stop any existing dev server on port 3000
if lsof -ti:3000 &> /dev/null; then
    echo "Stopping existing process on port 3000..."
    kill $(lsof -ti:3000) 2>/dev/null || true
    sleep 2
fi

systemctl start acne-ims
sleep 3
systemctl status acne-ims --no-pager | head -15

echo ""
echo "═══ Step 6: Verify ═══"
echo "Testing local Node server:"
curl -s -o /dev/null -w "  HTTP %{http_code}\n" http://127.0.0.1:3000/api/v1/admin/health || echo "  FAILED"
echo ""
echo "═══ Setup complete! ═══"
echo ""
echo "Next steps:"
echo "  1. Point DNS A record for acnehack.se → 91.223.169.40 (and www)"
echo "  2. Wait for DNS propagation (a few minutes)"
echo "  3. Visit https://acnehack.se — Caddy will auto-obtain the cert"
echo ""
echo "Useful commands:"
echo "  systemctl status acne-ims caddy"
echo "  journalctl -u acne-ims -f"
echo "  journalctl -u caddy -f"
echo "  tail -f /var/log/caddy/acnehack.log"
