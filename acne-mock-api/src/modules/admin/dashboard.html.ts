// Inline HTML for the lightweight API dashboard
export function getDashboardHtml(baseUrl: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Acne Studios IMS — Mock API Dashboard</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/ol@10.5.0/ol.css">
<script src="https://cdn.jsdelivr.net/npm/ol@10.5.0/dist/ol.js"></script>
<style>
  :root { --bg: #fafafa; --card: #fff; --border: #e5e5e5; --text: #111; --muted: #666; --accent: #000; --green: #16a34a; --amber: #d97706; --red: #dc2626; --blue: #2563eb; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, 'Helvetica Neue', sans-serif; background: var(--bg); color: var(--text); line-height: 1.5; }
  .container { max-width: 1200px; margin: 0 auto; padding: 24px; }
  header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 32px; border-bottom: 2px solid var(--accent); padding-bottom: 16px; }
  header h1 { font-size: 20px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; }
  header .links { display: flex; gap: 12px; }
  header a { font-size: 13px; color: var(--muted); text-decoration: none; border: 1px solid var(--border); padding: 4px 12px; border-radius: 4px; }
  header a:hover { background: var(--accent); color: #fff; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 16px; margin-bottom: 32px; }
  .card { background: var(--card); border: 1px solid var(--border); border-radius: 8px; padding: 20px; }
  .card h3 { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: var(--muted); margin-bottom: 4px; }
  .card .value { font-size: 28px; font-weight: 700; }
  .card .sub { font-size: 12px; color: var(--muted); margin-top: 2px; }
  .section { margin-bottom: 32px; }
  .section h2 { font-size: 14px; text-transform: uppercase; letter-spacing: 1.5px; color: var(--muted); margin-bottom: 12px; }
  table { width: 100%; border-collapse: collapse; background: var(--card); border: 1px solid var(--border); border-radius: 8px; overflow: hidden; font-size: 13px; }
  th { text-align: left; padding: 10px 14px; background: #f5f5f5; font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: var(--muted); border-bottom: 1px solid var(--border); }
  td { padding: 8px 14px; border-bottom: 1px solid #f0f0f0; }
  tr:last-child td { border-bottom: none; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; }
  .badge-green { background: #dcfce7; color: var(--green); }
  .badge-amber { background: #fef3c7; color: var(--amber); }
  .badge-red { background: #fee2e2; color: var(--red); }
  .badge-blue { background: #dbeafe; color: var(--blue); }
  .badge-gray { background: #f3f4f6; color: var(--muted); }
  #loading { text-align: center; padding: 40px; color: var(--muted); }
  .endpoint-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 8px; }
  .endpoint { font-family: 'SF Mono', 'Consolas', monospace; font-size: 12px; padding: 6px 10px; background: var(--card); border: 1px solid var(--border); border-radius: 4px; display: flex; gap: 8px; align-items: center; }
  .endpoint .method { font-weight: 700; min-width: 48px; }
  .method-GET { color: var(--green); }
  .method-POST { color: var(--blue); }
  .method-PATCH { color: var(--amber); }
  .method-DELETE { color: var(--red); }
  .refresh-btn { background: var(--accent); color: #fff; border: none; padding: 6px 14px; border-radius: 4px; cursor: pointer; font-size: 12px; }
  .refresh-btn:hover { opacity: 0.8; }
  .alert-row { display: flex; gap: 8px; align-items: center; padding: 8px 12px; background: var(--card); border: 1px solid var(--border); border-radius: 6px; margin-bottom: 6px; font-size: 13px; }
  .alert-row .desc { flex: 1; }

  /* Scenarios */
  .scenario-toolbar { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; margin-bottom: 14px; padding: 14px; background: var(--card); border: 1px solid var(--border); border-radius: 8px; }
  .scenario-toolbar select, .scenario-toolbar input { padding: 5px 8px; font-size: 12px; border: 1px solid #ddd; border-radius: 4px; }
  .scenario-toolbar select { max-width: 260px; }
  .scenario-desc { font-size: 12px; color: var(--muted); margin-top: 8px; line-height: 1.6; padding: 0 2px; }
  .scenario-desc strong { color: var(--text); }
  .active-scenarios { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 10px; margin-bottom: 16px; }
  .active-scenario-card { background: var(--card); border: 1px solid var(--border); border-radius: 8px; padding: 14px 16px; border-left: 4px solid var(--amber); }
  .active-scenario-card.sev-CRITICAL { border-left-color: var(--red); }
  .active-scenario-card.sev-HIGH { border-left-color: #e11d48; }
  .active-scenario-card.sev-MEDIUM { border-left-color: var(--amber); }
  .active-scenario-card.sev-LOW { border-left-color: var(--muted); }
  .active-scenario-card .sc-name { font-weight: 700; font-size: 13px; margin-bottom: 4px; }
  .active-scenario-card .sc-meta { font-size: 11px; color: var(--muted); display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
  .active-scenario-card .sc-context { font-size: 11px; color: var(--muted); margin-top: 4px; font-style: italic; }
  .deactivate-btn { background: none; border: 1px solid #ddd; padding: 2px 10px; border-radius: 3px; cursor: pointer; font-size: 11px; color: var(--red); }
  .deactivate-btn:hover { background: #fee2e2; }
  .scenario-catalog { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 10px; }
  .scenario-cat-card { background: var(--card); border: 1px solid var(--border); border-radius: 8px; padding: 14px 16px; cursor: pointer; transition: border-color 0.15s, box-shadow 0.15s; }
  .scenario-cat-card:hover { border-color: var(--accent); box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
  .scenario-cat-card.selected { border-color: var(--accent); background: #f8f8f8; }
  .scenario-cat-card .cat-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 4px; }
  .scenario-cat-card .cat-name { font-weight: 700; font-size: 13px; margin-bottom: 4px; }
  .scenario-cat-card .cat-desc { font-size: 11px; color: var(--muted); line-height: 1.5; }
  .cat-DEMAND { color: var(--red); }
  .cat-MARKET { color: var(--amber); }
  .cat-SUPPLY { color: var(--blue); }
  .cat-QUALITY { color: #7c3aed; }
  .cat-OPERATIONAL { color: #dc2626; }
  .cat-EXTERNAL { color: #0d9488; }
  .scenario-toggle { display: flex; gap: 6px; align-items: center; font-size: 12px; cursor: pointer; color: var(--muted); user-select: none; }
  .scenario-toggle:hover { color: var(--text); }
  .checkbox-wrap { display: flex; align-items: center; gap: 6px; font-size: 12px; }
  .checkbox-wrap input[type="checkbox"] { margin: 0; }

  /* World map */
  .world-map-wrap { position: relative; margin-bottom: 28px; border: 1px solid var(--border); border-radius: 8px; overflow: hidden; }
  #ol-map { width: 100%; height: 420px; background: #f7f2ee; }
  #ol-map .ol-zoom, #ol-map .ol-attribution, #ol-map .ol-rotate { display: none; }
</style>
</head>
<body>
<div class="container">
  <header>
    <h1>Acne Studios IMS — Mock API</h1>
    <div class="links">
      <a href="/docs">Swagger UI</a>
      <a href="/docs/json" target="_blank">OpenAPI JSON</a>
      <a href="/api/v1/admin/seed-info" target="_blank">Seed Info</a>
      <button class="refresh-btn" onclick="loadAll()">Refresh</button>
    </div>
  </header>

  <div id="loading">Loading data...</div>
  <div id="content" style="display:none">

    <div class="world-map-wrap">
      <div id="ol-map"></div>
    </div>

    <div class="grid" id="stats-grid"></div>

    <div class="section" id="sim-section">
      <h2>Business Day Simulation</h2>
      <div style="display:flex; gap:12px; align-items:center; flex-wrap:wrap; margin-bottom:12px">
        <span id="sim-status" class="badge badge-gray">Not running</span>
        <span id="sim-clock" style="font-size:12px;color:#666;font-family:monospace"></span>
        <span id="sim-events" style="font-size:13px;color:#666"></span>
        <div style="flex:1"></div>
        <select id="sim-speed" style="padding:4px 8px; font-size:12px; border:1px solid #ddd; border-radius:4px" onchange="updateSpeedLabel()">
          <option value="1">1x real-time</option>
          <option value="10">10x</option>
          <option value="60">60x</option>
          <option value="100">100x</option>
          <option value="500" selected>500x</option>
          <option value="1000">1000x max</option>
        </select>
        <span id="speed-estimate" style="font-size:11px;color:#999"></span>
        <select id="sim-duration" style="padding:4px 8px; font-size:12px; border:1px solid #ddd; border-radius:4px">
          <option value="24">1 day</option>
          <option value="72">3 days</option>
          <option value="168" selected>1 week</option>
          <option value="336">2 weeks</option>
          <option value="720">1 month</option>
          <option value="2160">3 months (quarter)</option>
          <option value="4320">6 months (season)</option>
          <option value="0">∞ continuous</option>
        </select>
        <label class="checkbox-wrap"><input type="checkbox" id="sim-auto-scenarios"> Auto Scenarios</label>
        <input id="sim-phrase" type="password" placeholder="Passphrase" style="padding:4px 8px; font-size:12px; border:1px solid #ddd; border-radius:4px; width:200px">
        <button class="refresh-btn" onclick="toggleSim()" id="sim-btn">Start Simulation</button>
        <button class="refresh-btn" onclick="resetDatabase()" id="reset-btn" style="background:#dc2626;display:none">Reset Database</button>
      </div>
      <div id="sim-log" style="max-height:250px; overflow-y:auto; font-size:12px; font-family:monospace; background:#f9f9f9; border:1px solid #eee; border-radius:6px; padding:8px"></div>
    </div>

    <div class="section" id="scenario-section">
      <h2>Scenarios <span id="scenario-count-badge" style="font-size:11px;font-weight:400;color:#666;text-transform:none;letter-spacing:0"></span></h2>

      <div id="active-scenarios-wrap" style="display:none">
        <h3 style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#666;margin-bottom:8px">Active Scenarios</h3>
        <div id="active-scenarios" class="active-scenarios"></div>
      </div>

      <div class="scenario-toolbar" id="scenario-toolbar">
        <select id="scenario-select" onchange="onScenarioSelect()">
          <option value="">Select a scenario to activate...</option>
        </select>
        <select id="scenario-severity">
          <option value="LOW">LOW</option>
          <option value="MEDIUM">MEDIUM</option>
          <option value="HIGH" selected>HIGH</option>
          <option value="CRITICAL">CRITICAL</option>
        </select>
        <select id="scenario-duration">
          <option value="">Default duration</option>
          <option value="720">12 hours</option>
          <option value="1440">1 day</option>
          <option value="4320">3 days</option>
          <option value="10080">1 week</option>
          <option value="20160">2 weeks</option>
          <option value="43200">1 month</option>
          <option value="129600">3 months</option>
          <option value="259200">6 months</option>
          <option value="0">Forever</option>
        </select>
        <button class="refresh-btn" onclick="activateScenario()" id="activate-btn" disabled>Activate</button>
        <div id="scenario-info" class="scenario-desc" style="width:100%"></div>
      </div>

      <div style="margin-bottom:10px">
        <span class="scenario-toggle" onclick="toggleCatalog()">
          <span id="catalog-arrow">&#9654;</span> Browse full catalog (16 scenarios)
        </span>
      </div>
      <div id="scenario-catalog-wrap" style="display:none">
        <div id="scenario-catalog" class="scenario-catalog"></div>
      </div>
    </div>

    <div class="section">
      <h2>Purchase Orders</h2>
      <table id="po-table"><thead><tr><th>PO Number</th><th>Supplier</th><th>Season</th><th>Status</th><th>Total</th><th>Lines</th></tr></thead><tbody></tbody></table>
    </div>

    <div class="section">
      <h2>Sales Orders (Recent 15)</h2>
      <table id="so-table"><thead><tr><th>SO Number</th><th>Channel</th><th>Customer</th><th>Status</th><th>Total</th><th>Priority</th></tr></thead><tbody></tbody></table>
    </div>

    <div class="section">
      <h2>API Endpoints</h2>
      <div class="endpoint-list" id="endpoint-list"></div>
    </div>
  </div>
</div>

<script>
const BASE = '';

async function api(path) {
  const res = await fetch(BASE + '/api/v1/' + path);
  return res.json();
}

function badge(text, color) {
  return '<span class="badge badge-' + color + '">' + text + '</span>';
}

function statusBadge(status) {
  const colors = {
    DRAFT: 'gray', PENDING_APPROVAL: 'amber', APPROVED: 'blue', SENT_TO_SUPPLIER: 'blue',
    CONFIRMED_BY_SUPPLIER: 'blue', IN_PRODUCTION: 'amber', SHIPPED: 'blue',
    PARTIALLY_RECEIVED: 'amber', RECEIVED: 'green', CLOSED: 'green', CANCELLED: 'red',
    CONFIRMED: 'blue', ALLOCATED: 'blue', PICKING: 'amber', PACKED: 'amber',
    DELIVERED: 'green', RETURNED: 'red', ON_HOLD: 'amber',
    PROPOSED: 'amber', AUTO_CONFIRMED: 'green', REJECTED: 'red', FULFILLED: 'green',
    PENDING: 'amber', ACCEPTED: 'green', DISMISSED: 'gray',
    CRITICAL: 'red', HIGH: 'red', MEDIUM: 'amber', LOW: 'gray',
  };
  return badge(status, colors[status] || 'gray');
}

function money(n, curr) { return (curr || 'SEK') + ' ' + Math.round(n).toLocaleString(); }

async function loadAll() {
  try {
    const [health, pos, sos, spec] = await Promise.all([
      api('admin/health'),
      api('purchase-orders?limit=20'),
      api('sales-orders?limit=15&sort=createdAt&order=desc'),
      fetch('/docs/json').then(r => r.json()),
    ]);

    // Stats grid
    const s = health.stats;
    const statsHtml = [
      { label: 'Products', value: s.products, sub: s.skus + ' SKUs' },
      { label: 'Purchase Orders', value: s.purchaseOrders, sub: s.poLines + ' lines' },
      { label: 'Sales Orders', value: s.salesOrders, sub: s.soLines + ' lines' },
      { label: 'Stock Levels', value: s.stockLevels.toLocaleString(), sub: s.locations + ' locations' },
      { label: 'Suppliers', value: s.suppliers, sub: 'active partners' },
      { label: 'SO↔PO Matches', value: s.sopoMatches, sub: 'across ' + s.purchaseOrders + ' POs' },
    ].map(c => '<div class="card"><h3>' + c.label + '</h3><div class="value">' + c.value + '</div><div class="sub">' + c.sub + '</div></div>').join('');
    document.getElementById('stats-grid').innerHTML = statsHtml;

    // PO table
    const suppliersRes = await api('stakeholders/suppliers');
    const supMap = {};
    (suppliersRes.data || suppliersRes || []).forEach(s => supMap[s.id] = s.name);

    const poBody = (pos.data || []).map(po => '<tr>' +
      '<td><strong>' + po.poNumber + '</strong></td>' +
      '<td>' + (supMap[po.supplierId] || po.supplierId.slice(0,8)) + '</td>' +
      '<td>' + po.season + ' ' + po.seasonYear + '</td>' +
      '<td>' + statusBadge(po.status) + '</td>' +
      '<td>' + money(po.totalAmount, po.currency) + '</td>' +
      '<td>' + (po.lines ? po.lines.length : '—') + '</td>' +
    '</tr>').join('');
    document.querySelector('#po-table tbody').innerHTML = poBody || '<tr><td colspan="6">No POs</td></tr>';

    // SO table
    const soBody = (sos.data || []).map(so => '<tr>' +
      '<td><strong>' + so.soNumber + '</strong></td>' +
      '<td>' + badge(so.channel, so.channel === 'WHOLESALE' ? 'blue' : so.channel === 'ECOMMERCE' ? 'green' : so.channel === 'CLIENTELING' ? 'amber' : 'gray') + '</td>' +
      '<td>' + (so.customerName || '—') + '</td>' +
      '<td>' + statusBadge(so.status) + '</td>' +
      '<td>' + money(so.totalAmount, so.currency) + '</td>' +
      '<td>' + (so.priority >= 2 ? badge('VIC', 'red') : so.priority === 1 ? badge('HIGH', 'amber') : '—') + '</td>' +
    '</tr>').join('');
    document.querySelector('#so-table tbody').innerHTML = soBody || '<tr><td colspan="6">No SOs</td></tr>';

    // Endpoints from OpenAPI spec
    const paths = spec.paths || {};
    let epHtml = '';
    for (const [path, methods] of Object.entries(paths)) {
      for (const [method, detail] of Object.entries(methods)) {
        if (typeof detail !== 'object') continue;
        epHtml += '<div class="endpoint"><span class="method method-' + method.toUpperCase() + '">' + method.toUpperCase() + '</span><span>' + path + '</span></div>';
      }
    }
    document.getElementById('endpoint-list').innerHTML = epHtml;

    document.getElementById('loading').style.display = 'none';
    document.getElementById('content').style.display = 'block';
  } catch (err) {
    document.getElementById('loading').textContent = 'Error loading data: ' + err.message;
    console.error(err);
  }
}

loadAll();
setInterval(loadAll, 30000);

// ─── Simulation Controls ─────────────────────────────

let simPolling = null;

function updateSpeedLabel() {
  const speed = parseInt(document.getElementById('sim-speed').value);
  const hours = parseInt(document.getElementById('sim-duration').value);
  const el = document.getElementById('speed-estimate');
  if (!hours || !speed || speed <= 1) { el.textContent = ''; return; }
  const realSeconds = (hours * 3600) / speed;
  let label;
  if (realSeconds < 60) label = Math.round(realSeconds) + 's real time';
  else if (realSeconds < 3600) label = Math.round(realSeconds / 60) + 'min real time';
  else label = (realSeconds / 3600).toFixed(1) + 'h real time';
  el.textContent = '(' + label + ')';
}
document.getElementById('sim-duration').addEventListener('change', updateSpeedLabel);
updateSpeedLabel();

async function toggleSim() {
  const phrase = document.getElementById('sim-phrase').value;
  if (!phrase) { alert('Enter the simulation passphrase'); return; }

  const simState = await api('admin/simulation');
  if (simState.running) {
    // Stop
    const res = await fetch(BASE + '/api/v1/admin/simulation/stop', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ passphrase: phrase }),
    });
    const data = await res.json();
    if (!res.ok) { alert(data.error || 'Failed to stop'); return; }
    if (simPolling) { clearInterval(simPolling); simPolling = null; }
    updateSimUI(data);
  } else {
    // Start
    const speed = parseInt(document.getElementById('sim-speed').value);
    const duration = parseInt(document.getElementById('sim-duration').value);
    const autoScenarios = document.getElementById('sim-auto-scenarios').checked;
    const res = await fetch(BASE + '/api/v1/admin/simulation/start', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ passphrase: phrase, durationHours: duration, speedMultiplier: speed, autoScenarios }),
    });
    const data = await res.json();
    if (!res.ok) { alert(data.error || 'Failed to start'); return; }
    updateSimUI(data);
    // Poll for updates
    simPolling = setInterval(pollSim, 3000);
  }
}

async function resetDatabase() {
  if (!confirm('Reset all data to seed state? This will undo all simulation changes.')) return;
  try {
    const res = await fetch(BASE + '/api/v1/admin/reset', { method: 'POST' });
    const data = await res.json();
    if (!res.ok) { alert(data.error || 'Failed to reset'); return; }
    loadAll();
    loadMapLocations();
    const state = await api('admin/simulation');
    updateSimUI(state);
  } catch (e) { alert('Error: ' + e.message); }
}

let lastTableRefresh = 0;
async function pollSim() {
  try {
    const state = await api('admin/simulation');
    updateSimUI(state);
    loadActiveScenarios();
    // Refresh PO/SO tables every ~10 seconds while sim is running
    if (state.running && Date.now() - lastTableRefresh > 10000) {
      lastTableRefresh = Date.now();
      loadAll();
    }
    if (!state.running && simPolling) {
      clearInterval(simPolling);
      simPolling = null;
      loadAll(); // final refresh when sim stops
    }
  } catch (e) {}
}

function updateSimUI(state) {
  const statusEl = document.getElementById('sim-status');
  const eventsEl = document.getElementById('sim-events');
  const btnEl = document.getElementById('sim-btn');
  const logEl = document.getElementById('sim-log');

  const resetBtn = document.getElementById('reset-btn');
  if (state.running) {
    statusEl.className = 'badge badge-green';
    let label = 'Running (' + state.speedMultiplier + 'x)';
    if (state.autoScenarios) label += ' + Auto Scenarios';
    statusEl.textContent = label;
    btnEl.textContent = 'Stop Simulation';
    btnEl.style.background = '#dc2626';
    resetBtn.style.display = 'none';
  } else {
    statusEl.className = 'badge badge-gray';
    statusEl.textContent = state.eventsGenerated > 0 ? 'Stopped' : 'Not running';
    btnEl.textContent = 'Start Simulation';
    btnEl.style.background = '#000';
    resetBtn.style.display = state.eventsGenerated > 0 ? 'inline-block' : 'none';
  }

  const scenarioLabel = state.activeScenarios > 0 ? ' | ' + state.activeScenarios + ' scenario(s) active' : '';
  eventsEl.textContent = state.eventsGenerated > 0 ? state.eventsGenerated + ' events generated' + scenarioLabel : '';

  // Show simulated clock
  const clockEl = document.getElementById('sim-clock');
  if (state.simClock && state.running) {
    const d = new Date(state.simClock);
    clockEl.textContent = 'Sim time: ' + d.toLocaleString('sv-SE', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  } else {
    clockEl.textContent = '';
  }

  // Render recent events
  const events = state.recentEvents || [];
  if (events.length > 0) {
    const systemColors = {
      'SFCC': 'green', 'Teamwork POS': 'blue', 'Blue Yonder WMS': 'amber',
      'Nedap iD Cloud': 'blue', 'NuORDER': 'amber', 'Adyen': 'green',
      'Klarna': 'amber', 'Temera DPP': 'blue', 'Medius AP': 'gray',
      'AI Intelligence': 'red', 'Inventory': 'gray',
    };
    logEl.innerHTML = events.slice().reverse().map(e => {
      const time = new Date(e.timestamp).toLocaleString('sv-SE', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
      const color = systemColors[e.system] || 'gray';
      const isChained = e.details?._chained;
      const chainMark = isChained ? '<span style="color:#c8937a;margin-right:3px" title="Chained event">↳</span>' : '';
      const bgStyle = isChained ? 'background:rgba(200,147,122,0.04);' : '';
      return '<div style="margin-bottom:4px;border-bottom:1px solid #f0f0f0;padding-bottom:4px;' + bgStyle + '">' +
        '<span style="color:#999">' + time + '</span> ' +
        chainMark +
        badge(e.system, color) + ' ' +
        '<span>' + e.summary + '</span></div>';
    }).join('');
  } else {
    logEl.innerHTML = '<span style="color:#999">No events yet. Start the simulation to see live activity.</span>';
  }
}

// Check sim state on load
api('admin/simulation').then(state => {
  updateSimUI(state);
  if (state.running) {
    simPolling = setInterval(pollSim, 3000);
  }
});

// ─── Scenario Controls ──────────────────────────────

let scenarioCatalog = [];
let catalogVisible = false;

function getPassphrase() {
  return document.getElementById('sim-phrase').value;
}

function humanDuration(minutes) {
  if (minutes < 60) return minutes + ' min';
  if (minutes < 1440) return Math.round(minutes / 60) + ' hours';
  if (minutes < 10080) return Math.round(minutes / 1440) + ' days';
  if (minutes < 43200) return Math.round(minutes / 10080) + ' weeks';
  return Math.round(minutes / 43200) + ' months';
}

async function loadScenarioCatalog() {
  try {
    const res = await api('admin/simulation/scenarios');
    scenarioCatalog = res.scenarios || [];
    const select = document.getElementById('scenario-select');
    select.innerHTML = '<option value="">Select a scenario to activate...</option>';
    const cats = {};
    scenarioCatalog.forEach(s => {
      if (!cats[s.category]) cats[s.category] = [];
      cats[s.category].push(s);
    });
    for (const [cat, items] of Object.entries(cats)) {
      const group = document.createElement('optgroup');
      group.label = cat;
      items.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s.id;
        opt.textContent = s.name;
        group.appendChild(opt);
      });
      select.appendChild(group);
    }
    renderCatalogGrid();
    loadActiveScenarios();
  } catch (e) { console.error('Failed to load scenarios', e); }
}

function onScenarioSelect() {
  const id = document.getElementById('scenario-select').value;
  const btn = document.getElementById('activate-btn');
  const info = document.getElementById('scenario-info');
  if (!id) {
    btn.disabled = true;
    info.innerHTML = '';
    document.querySelectorAll('.scenario-cat-card').forEach(c => c.classList.remove('selected'));
    return;
  }
  btn.disabled = false;
  const s = scenarioCatalog.find(x => x.id === id);
  if (s) {
    info.innerHTML = '<strong>' + s.name + '</strong> — ' + s.description +
      '<br><strong>Affects:</strong> ' + s.affects +
      '<br><strong>Example:</strong> <em>' + s.exampleTrigger + '</em>' +
      '<br><strong>Default:</strong> ' + s.defaultSeverity + ' severity, ' + humanDuration(s.defaultDurationMinutes);
    // highlight in catalog
    document.querySelectorAll('.scenario-cat-card').forEach(c => {
      c.classList.toggle('selected', c.dataset.id === id);
    });
  }
}

async function activateScenario() {
  const scenarioId = document.getElementById('scenario-select').value;
  if (!scenarioId) return;
  const phrase = getPassphrase();
  if (!phrase) { alert('Enter the simulation passphrase first (in the simulation controls above)'); return; }

  const severity = document.getElementById('scenario-severity').value;
  const durVal = document.getElementById('scenario-duration').value;
  const body = { passphrase: phrase, scenarioId, severity };
  if (durVal === '0') body.durationMinutes = 5256000; // ~10 years = forever
  else if (durVal) body.durationMinutes = parseInt(durVal);

  try {
    const res = await fetch(BASE + '/api/v1/admin/simulation/scenarios/activate', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || 'Failed to activate scenario');
      return;
    }
    loadActiveScenarios();
    // Start polling if not already
    if (!simPolling) {
      simPolling = setInterval(pollSim, 3000);
    }
  } catch (e) {
    alert('Error: ' + e.message);
  }
}

async function deactivateScenario(instanceId) {
  const phrase = getPassphrase();
  if (!phrase) { alert('Enter the simulation passphrase first'); return; }
  try {
    const res = await fetch(BASE + '/api/v1/admin/simulation/scenarios/' + instanceId + '/deactivate', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ passphrase: phrase }),
    });
    const data = await res.json();
    if (!res.ok) { alert(data.error || 'Failed to deactivate'); return; }
    loadActiveScenarios();
  } catch (e) { alert('Error: ' + e.message); }
}

async function loadActiveScenarios() {
  try {
    const res = await api('admin/simulation/scenarios/active');
    const active = (res.active || []);
    const countBadge = document.getElementById('scenario-count-badge');
    const wrap = document.getElementById('active-scenarios-wrap');
    const container = document.getElementById('active-scenarios');

    const running = active.filter(s => s.status === 'ACTIVE');
    const resolved = active.filter(s => s.status === 'RESOLVED').slice(-10);

    if (running.length === 0 && resolved.length === 0) {
      wrap.style.display = 'none';
      countBadge.textContent = '';
      return;
    }

    wrap.style.display = 'block';
    countBadge.textContent = running.length > 0 ? '(' + running.length + ' active)' : '';

    const cards = [...running, ...resolved].map(s => {
      const isActive = s.status === 'ACTIVE';
      const remainingMin = isActive ? Math.max(0, Math.round((new Date(s.expiresAt) - new Date()) / 60000)) : 0;
      const remaining = humanDuration(remainingMin);
      const ctx = s.context || {};
      const contextParts = [];
      if (ctx.productName) contextParts.push(ctx.productName);
      if (ctx.market) contextParts.push(ctx.market);
      if (ctx.supplierName) contextParts.push(ctx.supplierName);
      if (ctx.locationName) contextParts.push(ctx.locationName);
      if (ctx.celebrity) contextParts.push(ctx.celebrity);
      if (ctx.category) contextParts.push(ctx.category);
      if (ctx.material) contextParts.push(ctx.material);
      if (ctx.provider) contextParts.push(ctx.provider);
      if (ctx.cause) contextParts.push(ctx.cause);
      if (ctx.weatherType) contextParts.push(ctx.weatherType.replace(/_/g, ' '));
      if (ctx.defect) contextParts.push(ctx.defect);
      if (ctx.promoCode) contextParts.push(ctx.promoCode);

      const catDef = scenarioCatalog.find(c => c.id === s.scenarioId);
      const desc = catDef ? catDef.description : '';
      const affects = catDef ? catDef.affects : '';

      return '<div class="active-scenario-card sev-' + s.severity + '" style="' + (!isActive ? 'opacity:0.6' : '') + '">' +
        '<div class="sc-name">' + s.name + '</div>' +
        '<div class="sc-meta">' +
          badge(s.severity, s.severity === 'CRITICAL' ? 'red' : s.severity === 'HIGH' ? 'red' : s.severity === 'MEDIUM' ? 'amber' : 'gray') +
          ' ' + badge(isActive ? 'ACTIVE' : 'RESOLVED', isActive ? 'green' : 'gray') +
          '<span>' + s.eventsGenerated + ' events</span>' +
          (isActive ? '<span>' + remaining + ' remaining</span>' : '<span>Resolved</span>') +
          (isActive ? ' <button class="deactivate-btn" onclick="deactivateScenario(\\'' + s.instanceId + '\\')">Deactivate</button>' : '') +
        '</div>' +
        (desc ? '<div style="font-size:11px;color:#555;margin-top:6px;line-height:1.5">' + desc + '</div>' : '') +
        (affects ? '<div style="font-size:10px;color:#999;margin-top:3px"><strong>Affects:</strong> ' + affects + '</div>' : '') +
        (contextParts.length > 0 ? '<div class="sc-context">' + contextParts.join(' &middot; ') + '</div>' : '') +
      '</div>';
    }).join('');

    container.innerHTML = cards;
  } catch (e) { console.error('Failed to load active scenarios', e); }
}

function renderCatalogGrid() {
  const container = document.getElementById('scenario-catalog');
  const catColors = { DEMAND: 'red', MARKET: 'amber', SUPPLY: 'blue', QUALITY: 'purple', OPERATIONAL: 'red', EXTERNAL: 'teal' };
  container.innerHTML = scenarioCatalog.map(s => {
    const catClass = 'cat-' + s.category;
    return '<div class="scenario-cat-card" data-id="' + s.id + '" onclick="selectCatalogCard(\\'' + s.id + '\\')">' +
      '<div class="cat-label ' + catClass + '">' + s.category + '</div>' +
      '<div class="cat-name">' + s.name + '</div>' +
      '<div class="cat-desc">' + s.description.slice(0, 120) + (s.description.length > 120 ? '...' : '') + '</div>' +
      '<div style="margin-top:6px;font-size:10px;color:#999"><strong>Affects:</strong> ' + s.affects + '</div>' +
    '</div>';
  }).join('');
}

function selectCatalogCard(id) {
  document.getElementById('scenario-select').value = id;
  onScenarioSelect();
}

function toggleCatalog() {
  catalogVisible = !catalogVisible;
  document.getElementById('scenario-catalog-wrap').style.display = catalogVisible ? 'block' : 'none';
  document.getElementById('catalog-arrow').innerHTML = catalogVisible ? '&#9660;' : '&#9654;';
}

// Load scenario catalog on page load
loadScenarioCatalog();

// ─── World Map (OpenLayers) ──────────────────────────

const CITY_LONLAT = {
  'Stockholm': [18.07, 59.33], 'Paris': [2.35, 48.86], 'London': [-0.12, 51.51],
  'New York': [-74.0, 40.71], 'Los Angeles': [-118.24, 34.05], 'Miami': [-80.19, 25.76],
  'San Francisco': [-122.42, 37.77],
  'Tokyo': [139.69, 35.69], 'Osaka': [135.50, 34.69],
  'Seoul': [126.98, 37.57], 'Shanghai': [121.47, 31.23], 'Beijing': [116.40, 39.90],
  'Hong Kong': [114.17, 22.32], 'Singapore': [103.85, 1.29], 'Bangkok': [100.50, 13.76],
  'Milan': [9.19, 45.46], 'Berlin': [13.40, 52.52], 'Munich': [11.58, 48.14],
  'Copenhagen': [12.57, 55.68], 'Oslo': [10.75, 59.91], 'Antwerp': [4.40, 51.22],
  'Hamburg': [9.99, 53.55], 'Melbourne': [144.96, -37.81], 'Sydney': [151.21, -33.87],
};

let olMap = null;
let eventSource = null;
let locationSource = null;

function initOLMap() {
  // Country borders from TopoJSON
  const worldLayer = new ol.layer.Vector({
    source: new ol.source.Vector({
      url: 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json',
      format: new ol.format.TopoJSON({ layers: ['countries'] }),
    }),
    style: new ol.style.Style({
      fill: new ol.style.Fill({ color: 'rgba(0,0,0,0)' }),
      stroke: new ol.style.Stroke({ color: '#c8b8a8', width: 0.6 }),
    }),
  });

  // Store/warehouse location markers with pie-chart stock levels
  locationSource = new ol.source.Vector();

  // Render a pie chart as a canvas image for each location
  function makeStockPie(fillRatio, allocRatio, radius, isWh) {
    const size = radius * 2 + 4;
    const canvas = document.createElement('canvas');
    canvas.width = size * 2; // retina
    canvas.height = size * 2;
    const ctx = canvas.getContext('2d');
    ctx.scale(2, 2);
    const cx = size / 2, cy = size / 2;
    const r = radius;

    // Background circle (empty/capacity)
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = isWh ? 'rgba(232,213,196,0.5)' : 'rgba(242,236,232,0.6)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(184,168,156,0.4)';
    ctx.lineWidth = 0.8;
    ctx.stroke();

    // On-hand stock pie (terracotta) — starts from top (-PI/2)
    if (fillRatio > 0.005) {
      const stockAngle = fillRatio * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + stockAngle);
      ctx.closePath();
      ctx.fillStyle = fillRatio > 0.6 ? 'rgba(200,147,122,0.7)' : fillRatio > 0.3 ? 'rgba(200,147,122,0.55)' : 'rgba(210,100,80,0.6)';
      ctx.fill();
    }

    // Allocated portion overlay (darker slice within stock)
    if (allocRatio > 0.01 && fillRatio > 0.01) {
      const allocAngle = allocRatio * fillRatio * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + allocAngle);
      ctx.closePath();
      ctx.fillStyle = 'rgba(140,100,78,0.35)';
      ctx.fill();
    }

    // Center dot
    ctx.beginPath();
    ctx.arc(cx, cy, isWh ? 3 : 2, 0, Math.PI * 2);
    ctx.fillStyle = isWh ? '#c8937a' : '#b8a89c';
    ctx.fill();

    return canvas;
  }

  const locationLayer = new ol.layer.Vector({
    source: locationSource,
    style: function(feature) {
      const isWh = feature.get('type') === 'WAREHOUSE';
      const onHand = feature.get('onHand') || 0;
      const allocated = feature.get('allocated') || 0;
      const skuCount = feature.get('skuCount') || 1;

      const avgPerSku = onHand / Math.max(1, skuCount);
      const maxExpected = isWh ? 60 : 8;
      const fillRatio = Math.min(1, avgPerSku / maxExpected);
      const allocRatio = Math.min(1, allocated / Math.max(1, onHand));
      const radius = isWh ? 14 : 8;

      const canvas = makeStockPie(fillRatio, allocRatio, radius, isWh);
      return new ol.style.Style({
        image: new ol.style.Icon({
          img: canvas,
          imgSize: [canvas.width, canvas.height],
          scale: 0.5, // retina downscale
        }),
      });
    },
  });

  // Event pulse dots
  eventSource = new ol.source.Vector();
  const eventLayer = new ol.layer.Vector({
    source: eventSource,
    style: function(feature) {
      return new ol.style.Style({
        image: new ol.style.Circle({
          radius: feature.get('radius') || 4,
          fill: new ol.style.Fill({ color: feature.get('color') || 'rgba(200,147,122,0.7)' }),
        }),
      });
    },
  });

  olMap = new ol.Map({
    target: 'ol-map',
    layers: [worldLayer, locationLayer, eventLayer],
    view: new ol.View({
      center: ol.proj.fromLonLat([20, 15]),
      zoom: 1.4,
      maxZoom: 6,
      minZoom: 1,
    }),
    controls: [],
    interactions: ol.interaction.defaults.defaults({ mouseWheelZoom: false }),
  });

  // Tooltip overlay for location hover
  const tooltipEl = document.createElement('div');
  tooltipEl.style.cssText = 'background:rgba(0,0,0,0.8);color:#fff;padding:6px 10px;border-radius:4px;font-size:11px;font-family:-apple-system,sans-serif;pointer-events:none;white-space:nowrap;';
  const tooltip = new ol.Overlay({ element: tooltipEl, positioning: 'bottom-center', offset: [0, -20] });
  olMap.addOverlay(tooltip);

  olMap.on('pointermove', function(e) {
    const feat = olMap.forEachFeatureAtPixel(e.pixel, f => f, { layerFilter: l => l === locationLayer });
    if (feat && feat.get('name')) {
      const name = feat.get('name');
      const type = feat.get('type');
      const onHand = feat.get('onHand') || 0;
      const allocated = feat.get('allocated') || 0;
      const inTransit = feat.get('inTransit') || 0;
      tooltipEl.innerHTML = '<strong>' + name + '</strong> (' + type.toLowerCase() + ')' +
        '<br>On hand: ' + onHand.toLocaleString() +
        ' | Allocated: ' + allocated.toLocaleString() +
        ' | In transit: ' + inTransit.toLocaleString();
      tooltip.setPosition(e.coordinate);
    } else {
      tooltip.setPosition(undefined);
    }
  });
}

function getLonLat(name) {
  for (const [city, coords] of Object.entries(CITY_LONLAT)) {
    if (name && (name.includes(city) || name.includes(city.split(' ')[0]))) return coords;
  }
  return null;
}

// Stock level data per location
let stockByLocation = {};

async function loadMapLocations() {
  if (!locationSource) return;
  try {
    const [seedRes, stockRes] = await Promise.all([
      fetch(BASE + '/api/v1/admin/seed-info').then(r => r.json()),
      fetch(BASE + '/api/v1/inventory/levels?limit=5000').then(r => r.json()),
    ]);
    const locs = seedRes.sampleIds?.locations || [];
    const stocks = stockRes.data || [];

    // Aggregate stock per location
    stockByLocation = {};
    for (const sl of stocks) {
      if (!stockByLocation[sl.locationId]) stockByLocation[sl.locationId] = { onHand: 0, allocated: 0, inTransit: 0, skuCount: 0 };
      stockByLocation[sl.locationId].onHand += sl.quantityOnHand || 0;
      stockByLocation[sl.locationId].allocated += sl.quantityAllocated || 0;
      stockByLocation[sl.locationId].inTransit += sl.quantityInTransit || 0;
      stockByLocation[sl.locationId].skuCount++;
    }

    locationSource.clear();
    for (const loc of locs) {
      const lonlat = getLonLat(loc.name);
      if (!lonlat) continue;
      const inv = stockByLocation[loc.id] || { onHand: 0, allocated: 0, inTransit: 0, skuCount: 0 };
      const f = new ol.Feature({
        geometry: new ol.geom.Point(ol.proj.fromLonLat(lonlat)),
        name: loc.name,
        type: loc.type,
        onHand: inv.onHand,
        allocated: inv.allocated,
        inTransit: inv.inTransit,
        skuCount: inv.skuCount,
      });
      locationSource.addFeature(f);
    }
  } catch(e) {}
}

setInterval(loadMapLocations, 30000); // refresh stock every 30s

function eventMagnitude(details) {
  // Extract a value amount from event details to size the dot
  const v = details?.total || details?.amount || details?.price || details?.lineTotal || 0;
  const val = typeof v === 'string' ? parseFloat(v.replace(/[^0-9.]/g, '')) : v;
  if (!val || val <= 0) return 3;
  // Log scale: €10 → ~3px, €100 → ~5px, €1000 → ~7px, €10000 → ~9px, €100000 → ~11px
  return Math.min(14, Math.max(2.5, 1.5 + Math.log10(val) * 2));
}

function addMapEventDot(system, locationName, details) {
  if (!eventSource) return;
  let lonlat = getLonLat(locationName);
  if (!lonlat) {
    const all = Object.values(CITY_LONLAT);
    lonlat = all[Math.floor(Math.random() * all.length)];
  }
  const jitter = [(Math.random()-0.5)*2, (Math.random()-0.5)*2];
  const isScenario = system === 'SCENARIO';
  const color = isScenario ? 'rgba(224,80,80,0.8)'
    : (system.includes('POS') || system.includes('Teamwork')) ? 'rgba(200,147,122,0.8)'
    : system.includes('SFCC') ? 'rgba(160,120,94,0.8)'
    : system.includes('Blue Yonder') || system.includes('Carrier') ? 'rgba(212,196,184,0.8)'
    : 'rgba(200,147,122,0.7)';

  const baseR = eventMagnitude(details);
  const f = new ol.Feature({
    geometry: new ol.geom.Point(ol.proj.fromLonLat([lonlat[0]+jitter[0], lonlat[1]+jitter[1]])),
    color: color,
    radius: baseR,
  });
  eventSource.addFeature(f);

  // Animate: expand and fade
  let r = baseR;
  const maxR = baseR + 10;
  const anim = setInterval(() => {
    r += 0.8;
    f.set('radius', r);
    if (r > maxR) {
      clearInterval(anim);
      eventSource.removeFeature(f);
    }
  }, 80);
}

// Feed events to map from simulation polling
let lastMapEventCount = 0;
function feedMapEvents(recentEvents) {
  if (!recentEvents || recentEvents.length === 0) return;
  for (const e of recentEvents.slice(0, 5)) {
    const locName = e.details?.locationName || e.details?.warehouseName || null;
    const isScenario = e.summary?.startsWith('[SCENARIO]');
    addMapEventDot(isScenario ? 'SCENARIO' : e.system, locName, e.details);
  }
}

// Hook into sim polling
const _origUpdateSimUI = updateSimUI;
updateSimUI = function(state) {
  _origUpdateSimUI(state);
  if (state.recentEvents && state.eventsGenerated > lastMapEventCount) {
    feedMapEvents(state.recentEvents);
    lastMapEventCount = state.eventsGenerated;
  }
};

// Init map
initOLMap();
loadMapLocations();
</script>
</body>
</html>`;
}
