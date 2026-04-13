# Useful Commands — Acne Studios IMS

## Services

```bash
# Status
sudo systemctl status acne-ims
sudo systemctl status caddy

# Restart (pick up code changes)
sudo systemctl restart acne-ims

# Reload Caddy (pick up Caddyfile changes, no downtime)
sudo caddy reload --config /etc/caddy/Caddyfile
# or
sudo systemctl reload caddy

# Stop / start
sudo systemctl stop acne-ims
sudo systemctl start acne-ims

# Enable / disable autostart on boot
sudo systemctl enable acne-ims
sudo systemctl disable acne-ims
```

## Logs

```bash
# Live tail
sudo journalctl -u acne-ims -f
sudo journalctl -u caddy -f

# Last 100 lines
sudo journalctl -u acne-ims -n 100 --no-pager
sudo journalctl -u caddy -n 100 --no-pager

# Since a specific time
sudo journalctl -u acne-ims --since "10 min ago"
sudo journalctl -u acne-ims --since today

# Caddy access log (file-based)
sudo tail -f /var/log/caddy/acnehack.log
```

## Config files

```bash
/etc/systemd/system/acne-ims.service     # Node service unit
/etc/caddy/Caddyfile                     # Caddy reverse proxy config
/home/localuser/Acne/deploy/             # Source configs (edit here, then copy)
```

Edit in `/home/localuser/Acne/deploy/`, then copy + reload:

```bash
sudo cp /home/localuser/Acne/deploy/acne-ims.service /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl restart acne-ims

sudo cp /home/localuser/Acne/deploy/Caddyfile /etc/caddy/Caddyfile
sudo caddy validate --config /etc/caddy/Caddyfile && sudo systemctl reload caddy
```

## Firewall (ufw)

```bash
sudo ufw status verbose          # Show rules
sudo ufw allow 443/tcp           # Open a port
sudo ufw deny 3000/tcp           # Block a port
sudo ufw reload
```

## Ports / processes

```bash
ss -tlnp | grep -E ':80|:443|:3000'     # Who's listening where
lsof -ti:3000                            # PID on port 3000
sudo kill $(lsof -ti:3000)              # Kill whatever's on port 3000
```

## API health checks

```bash
# Local
curl -s http://127.0.0.1:3000/api/v1/admin/health | python3 -m json.tool

# Through Caddy (once DNS is live)
curl -sI https://acnehack.se
curl -s https://acnehack.se/api/v1/admin/health | python3 -m json.tool
```

## DNS

```bash
dig +short acnehack.se                   # Check what the domain resolves to
host acnehack.se                         # Same, different tool
curl -s ifconfig.me                      # This server's public IP
```

Point `acnehack.se` A record → `91.223.169.40`. Caddy auto-obtains a Let's Encrypt cert on first request once DNS is live.

## Dev loop (no systemd, local testing)

```bash
cd /home/localuser/Acne/acne-mock-api
lsof -ti:3000 | xargs kill -9 2>/dev/null
rm -f seed-cache.json        # force re-seed if code changed
npx tsx src/index.ts
```

## Simulation control (via API)

Passphrase: `acne-hackathon-simulate-2026`

```bash
# Start simulation
curl -X POST http://localhost:3000/api/v1/admin/simulation/start \
  -H 'Content-Type: application/json' \
  -d '{"passphrase":"acne-hackathon-simulate-2026","durationHours":168,"speedMultiplier":500,"autoScenarios":true}'

# Stop simulation
curl -X POST http://localhost:3000/api/v1/admin/simulation/stop \
  -H 'Content-Type: application/json' \
  -d '{"passphrase":"acne-hackathon-simulate-2026"}'

# Reset data to seed state
curl -X POST http://localhost:3000/api/v1/admin/reset

# Activate a scenario
curl -X POST http://localhost:3000/api/v1/admin/simulation/scenarios/activate \
  -H 'Content-Type: application/json' \
  -d '{"passphrase":"acne-hackathon-simulate-2026","scenarioId":"VIRAL_PRODUCT","severity":"HIGH"}'

# List active scenarios (facilitator only)
curl http://localhost:3000/api/v1/admin/simulation/scenarios/active | python3 -m json.tool
```

## Data export

```bash
# List all 22 exportable entities with row counts
curl -s https://acnehack.se/api/v1/export | python3 -m json.tool

# Download a single CSV
curl -sOJ https://acnehack.se/api/v1/export/sales-orders.csv

# Dump everything to /home/localuser/Acne/exports/
bash /home/localuser/Acne/exports/generate.sh

# Dump from production instead of localhost
BASE=https://acnehack.se bash /home/localuser/Acne/exports/generate.sh

# In a browser: just visit
https://acnehack.se/api/v1/export/sales-orders.csv
# ...the browser will download it as an attachment because we set
# Content-Disposition: attachment; filename="sales-orders.csv"
```

## Git

```bash
cd /home/localuser/Acne
git status
git pull
git push
git log --oneline -10
```

## Troubleshooting

**Service won't start:**
```bash
sudo journalctl -u acne-ims -n 50 --no-pager
```

**Port 3000 stuck after crash:**
```bash
sudo kill $(lsof -ti:3000)
sudo systemctl restart acne-ims
```

**Caddy cert not issuing:**
```bash
sudo journalctl -u caddy -n 100 --no-pager | grep -i "acme\|cert\|error"
# Verify DNS first:
dig +short acnehack.se
```

**Seed cache stale after code change:**
```bash
sudo rm /home/localuser/Acne/acne-mock-api/seed-cache.json
sudo systemctl restart acne-ims
```
