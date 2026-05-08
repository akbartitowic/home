# Home Server Dashboard (shadcn style)

Dashboard monitoring home server berbasis Next.js App Router dengan komponen style shadcn (`Card`, `Badge`, `Button`, `Progress`).

## Fitur

- Tampilan UI gaya shadcn
- CPU usage server (real-time sampling)
- RAM usage server
- Storage usage + **sisa SSD/HDD server** dari hasil `df`
- Network + service health (placeholder, bisa dihubungkan ke exporter kamu)

## Menjalankan Lokal

```bash
npm install
npm run dev
```

Lalu buka `http://localhost:3000`.

## Build Production

```bash
npm run build
npm run start
```

## Endpoint Metrics Internal

UI membaca endpoint internal: `GET /api/metrics`.

Endpoint ini menghitung storage langsung dari host server dengan:

```bash
df -kP <target-path>
```

Secara default target path adalah `/`.

Kalau storage utama kamu ada di mountpoint lain (misal `/mnt/data`), set env:

```bash
DISK_TARGET_PATH=/mnt/data
```

Lalu jalankan ulang app.
