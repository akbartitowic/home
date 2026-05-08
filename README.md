# Home Server Dashboard

Dashboard web ringan untuk memantau performa home server:

- CPU usage + suhu CPU
- RAM usage
- Storage usage + sisa kapasitas
- Network throughput (download/upload) + latency
- Status service penting

## Menjalankan

Karena ini static web, jalankan server file sederhana:

```bash
python3 -m http.server 8080
```

Buka:

`http://localhost:8080`

## Sumber Data Monitoring

Secara default dashboard mengambil data dari endpoint:

`/api/metrics`

Kalau endpoint itu belum ada, dashboard otomatis fallback ke data mock supaya tampilan tetap jalan.

Kamu bisa ganti endpoint dari URL:

`http://localhost:8080/?endpoint=http://IP_SERVER:PORT/metrics&refreshMs=5000`

## Format JSON Endpoint

Endpoint perlu mengembalikan JSON seperti ini:

```json
{
  "hostname": "homeserver.local",
  "os": "Ubuntu 24.04 LTS",
  "uptimeSec": 123456,
  "updatedAt": "2026-05-08T03:00:00.000Z",
  "cpu": { "usagePercent": 37.5, "tempC": 55.2 },
  "memory": { "usedBytes": 4294967296, "totalBytes": 17179869184 },
  "disk": { "usedBytes": 214748364800, "totalBytes": 536870912000 },
  "network": { "downloadMbps": 200.5, "uploadMbps": 85.3, "latencyMs": 4.2 },
  "services": [
    { "name": "Nginx", "status": "healthy" },
    { "name": "Docker", "status": "healthy" },
    { "name": "Grafana", "status": "degraded" }
  ]
}
```

Status service yang didukung:

- `healthy`
- `degraded`
- `down`
