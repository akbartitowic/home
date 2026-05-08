const query = new URLSearchParams(window.location.search);
const endpoint = query.get("endpoint") || "/api/metrics";
const refreshMs = Number(query.get("refreshMs") || 5000);

const elements = {
  statusPill: document.getElementById("status-pill"),
  refreshBtn: document.getElementById("refresh-btn"),
  cpuValue: document.getElementById("cpu-value"),
  cpuBar: document.getElementById("cpu-bar"),
  cpuTemp: document.getElementById("cpu-temp"),
  ramValue: document.getElementById("ram-value"),
  ramBar: document.getElementById("ram-bar"),
  ramUsed: document.getElementById("ram-used"),
  diskValue: document.getElementById("disk-value"),
  diskBar: document.getElementById("disk-bar"),
  diskUsed: document.getElementById("disk-used"),
  diskRemaining: document.getElementById("disk-remaining"),
  netDown: document.getElementById("net-down"),
  netUp: document.getElementById("net-up"),
  latency: document.getElementById("latency"),
  servicesList: document.getElementById("services-list"),
  hostname: document.getElementById("hostname"),
  os: document.getElementById("os"),
  uptime: document.getElementById("uptime"),
  updatedAt: document.getElementById("updated-at"),
};

function clampPercent(value) {
  return Math.max(0, Math.min(100, Number(value) || 0));
}

function humanBytes(bytes) {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let val = Number(bytes) || 0;
  let idx = 0;
  while (val >= 1024 && idx < units.length - 1) {
    val /= 1024;
    idx += 1;
  }
  return `${val.toFixed(idx > 0 ? 1 : 0)} ${units[idx]}`;
}

function humanUptime(seconds) {
  const s = Math.max(0, Number(seconds) || 0);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${d}d ${h}h ${m}m`;
}

function statusClass(status) {
  if (status === "healthy") return "ok";
  if (status === "degraded") return "warn";
  return "danger";
}

function mockData() {
  const totalDisk = 512 * 1024 * 1024 * 1024;
  const usedDisk = (0.3 + Math.random() * 0.45) * totalDisk;
  const totalRam = 16 * 1024 * 1024 * 1024;
  const usedRam = (0.25 + Math.random() * 0.55) * totalRam;
  const cpuUsage = 20 + Math.random() * 70;
  return {
    hostname: "homeserver.local",
    os: "Ubuntu 24.04 LTS",
    uptimeSec: 1234567,
    updatedAt: new Date().toISOString(),
    cpu: {
      usagePercent: cpuUsage,
      tempC: 40 + Math.random() * 30,
    },
    memory: {
      usedBytes: usedRam,
      totalBytes: totalRam,
    },
    disk: {
      usedBytes: usedDisk,
      totalBytes: totalDisk,
    },
    network: {
      downloadMbps: 120 + Math.random() * 200,
      uploadMbps: 40 + Math.random() * 80,
      latencyMs: 2 + Math.random() * 8,
    },
    services: [
      { name: "Nginx", status: "healthy" },
      { name: "Docker", status: "healthy" },
      { name: "Plex", status: Math.random() > 0.8 ? "degraded" : "healthy" },
      { name: "Nextcloud", status: "healthy" },
      { name: "Prometheus", status: "healthy" },
      { name: "Grafana", status: Math.random() > 0.9 ? "down" : "healthy" },
    ],
  };
}

function render(data) {
  const cpu = clampPercent(data?.cpu?.usagePercent);
  const ramTotal = Number(data?.memory?.totalBytes) || 1;
  const ramUsed = Number(data?.memory?.usedBytes) || 0;
  const ramPct = clampPercent((ramUsed / ramTotal) * 100);
  const diskTotal = Number(data?.disk?.totalBytes) || 1;
  const diskUsed = Number(data?.disk?.usedBytes) || 0;
  const diskPct = clampPercent((diskUsed / diskTotal) * 100);

  elements.cpuValue.textContent = `${cpu.toFixed(1)}%`;
  elements.cpuBar.style.width = `${cpu}%`;
  elements.cpuTemp.textContent = `Temp: ${(Number(data?.cpu?.tempC) || 0).toFixed(1)} C`;

  elements.ramValue.textContent = `${ramPct.toFixed(1)}%`;
  elements.ramBar.style.width = `${ramPct}%`;
  elements.ramUsed.textContent = `Used: ${humanBytes(ramUsed)} / ${humanBytes(ramTotal)}`;

  elements.diskValue.textContent = `${diskPct.toFixed(1)}%`;
  elements.diskBar.style.width = `${diskPct}%`;
  elements.diskUsed.textContent = `Used: ${humanBytes(diskUsed)} / ${humanBytes(diskTotal)}`;
  elements.diskRemaining.textContent = `Sisa: ${humanBytes(diskTotal - diskUsed)}`;

  elements.netDown.textContent = `${(Number(data?.network?.downloadMbps) || 0).toFixed(1)} Mbps`;
  elements.netUp.textContent = `${(Number(data?.network?.uploadMbps) || 0).toFixed(1)} Mbps`;
  elements.latency.textContent = `${(Number(data?.network?.latencyMs) || 0).toFixed(1)} ms`;

  elements.servicesList.innerHTML = "";
  const services = Array.isArray(data?.services) ? data.services : [];
  for (const service of services) {
    const status = service?.status || "down";
    const item = document.createElement("div");
    item.className = "service-item";
    item.innerHTML = `
      <span>${service?.name || "Unknown"}</span>
      <span><span class="dot ${statusClass(status)}"></span> ${status}</span>
    `;
    elements.servicesList.appendChild(item);
  }

  elements.hostname.textContent = data?.hostname || "-";
  elements.os.textContent = data?.os || "-";
  elements.uptime.textContent = humanUptime(data?.uptimeSec);
  elements.updatedAt.textContent = new Date(data?.updatedAt || Date.now()).toLocaleString();
}

async function fetchMetrics() {
  const start = performance.now();
  try {
    const res = await fetch(endpoint, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    render(data);
    const elapsed = performance.now() - start;
    elements.statusPill.textContent = `Data: LIVE (${elapsed.toFixed(0)}ms)`;
  } catch (_err) {
    render(mockData());
    elements.statusPill.textContent = "Data: MOCK (endpoint unavailable)";
  }
}

elements.refreshBtn.addEventListener("click", fetchMetrics);
fetchMetrics();
setInterval(fetchMetrics, refreshMs);
