"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, HardDrive, MemoryStick, Monitor, Moon, Network, RefreshCcw, Server, Sun } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { MetricsResponse } from "@/lib/types";

function formatBytes(bytes: number) {
  if (bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** index;
  return `${value.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function formatUptime(seconds: number) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${d}d ${h}h ${m}m`;
}

function statusClass(status: MetricsResponse["services"][number]["status"]) {
  if (status === "healthy") return "border-emerald-400/40 text-emerald-300";
  if (status === "degraded") return "border-amber-400/40 text-amber-300";
  return "border-red-400/40 text-red-300";
}

const fallbackData: MetricsResponse = {
  hostname: "homeserver.local",
  os: "Linux",
  uptimeSec: 0,
  updatedAt: new Date().toISOString(),
  cpu: { usagePercent: 0, tempC: null },
  memory: { usedBytes: 0, totalBytes: 1 },
  disk: { usedBytes: 0, totalBytes: 1, availableBytes: 0, mountpoint: "/", filesystem: "-" },
  disks: [],
  gpu: {
    vendor: "Unknown",
    model: "GPU not detected",
    usagePercent: null,
    memoryUsedMiB: null,
    memoryTotalMiB: null,
    temperatureC: null,
    available: false,
  },
  network: { downloadMbps: 0, uploadMbps: 0, latencyMs: 0 },
  services: [],
};

export function Dashboard() {
  const [metrics, setMetrics] = useState<MetricsResponse>(fallbackData);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState<"live" | "fallback">("live");
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const saved = window.localStorage.getItem("theme");
    if (saved === "light" || saved === "dark") {
      setTheme(saved);
      return;
    }

    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    setTheme(prefersDark ? "dark" : "light");
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((current) => (current === "dark" ? "light" : "dark"));
  }, []);

  useEffect(() => {
    document.documentElement.classList.remove("dark", "light");
    document.documentElement.classList.add(theme);
    window.localStorage.setItem("theme", theme);
  }, [theme]);

  const fetchMetrics = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/metrics", { cache: "no-store" });
      if (!response.ok) throw new Error("Failed to fetch metrics");
      const data = (await response.json()) as MetricsResponse;
      setMetrics(data);
      setSource("live");
    } catch {
      setSource("fallback");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 5000);
    return () => clearInterval(interval);
  }, [fetchMetrics]);

  const ramPercent = useMemo(
    () => (metrics.memory.totalBytes > 0 ? (metrics.memory.usedBytes / metrics.memory.totalBytes) * 100 : 0),
    [metrics.memory.totalBytes, metrics.memory.usedBytes],
  );
  const diskPercent = useMemo(
    () => (metrics.disk.totalBytes > 0 ? (metrics.disk.usedBytes / metrics.disk.totalBytes) * 100 : 0),
    [metrics.disk.totalBytes, metrics.disk.usedBytes],
  );

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-4 py-6 md:px-6">
      <header className="mb-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Home Server Dashboard</h1>
          <p className="text-sm text-muted-foreground">Monitoring performa server termasuk sisa SSD/HDD</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge className={source === "live" ? "border-emerald-500/40 text-emerald-300" : "border-amber-500/40 text-amber-300"}>
            {source === "live" ? "Data live" : "Fallback"}
          </Badge>
          <Button
            onClick={toggleTheme}
            type="button"
            className="border-border bg-background text-foreground"
            title="Toggle light/dark mode"
          >
            {theme === "dark" ? <Sun className="mr-2 h-4 w-4" /> : <Moon className="mr-2 h-4 w-4" />}
            Mode: {theme === "dark" ? "Light" : "Dark"}
          </Button>
          <Button onClick={fetchMetrics} disabled={loading}>
            <RefreshCcw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground"><Activity className="h-4 w-4" />CPU</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-3xl font-semibold">{metrics.cpu.usagePercent.toFixed(1)}%</p>
            <Progress value={metrics.cpu.usagePercent} />
            <p className="text-sm text-muted-foreground">Temp: {metrics.cpu.tempC ? `${metrics.cpu.tempC.toFixed(1)} C` : "-"}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground"><MemoryStick className="h-4 w-4" />RAM</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-3xl font-semibold">{ramPercent.toFixed(1)}%</p>
            <Progress value={ramPercent} />
            <p className="text-sm text-muted-foreground">{formatBytes(metrics.memory.usedBytes)} / {formatBytes(metrics.memory.totalBytes)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground"><HardDrive className="h-4 w-4" />Storage</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-3xl font-semibold">{diskPercent.toFixed(1)}%</p>
            <Progress value={diskPercent} />
            <p className="text-sm text-muted-foreground">Terpakai: {formatBytes(metrics.disk.usedBytes)} / {formatBytes(metrics.disk.totalBytes)}</p>
            <p className="text-sm text-emerald-300">Sisa: {formatBytes(metrics.disk.availableBytes)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground"><Network className="h-4 w-4" />Network</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 text-sm">
            <p>Download: <span className="text-muted-foreground">{metrics.network.downloadMbps.toFixed(1)} Mbps</span></p>
            <p>Upload: <span className="text-muted-foreground">{metrics.network.uploadMbps.toFixed(1)} Mbps</span></p>
            <p>Latency: <span className="text-muted-foreground">{metrics.network.latencyMs.toFixed(1)} ms</span></p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground"><Monitor className="h-4 w-4" />VGA / GPU</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 text-sm">
            <p className="truncate" title={metrics.gpu.model}>{metrics.gpu.model}</p>
            <p>
              Usage: <span className="text-muted-foreground">{metrics.gpu.usagePercent !== null ? `${metrics.gpu.usagePercent.toFixed(1)}%` : "-"}</span>
            </p>
            <p>
              VRAM: <span className="text-muted-foreground">
                {metrics.gpu.memoryUsedMiB !== null && metrics.gpu.memoryTotalMiB !== null
                  ? `${metrics.gpu.memoryUsedMiB} / ${metrics.gpu.memoryTotalMiB} MiB`
                  : "-"}
              </span>
            </p>
            <p>
              Temp: <span className="text-muted-foreground">{metrics.gpu.temperatureC !== null ? `${metrics.gpu.temperatureC} C` : "-"}</span>
            </p>
          </CardContent>
        </Card>
      </section>

      <section className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground"><HardDrive className="h-4 w-4" />Semua Partisi Storage</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {metrics.disks.length === 0 ? (
              <p className="text-sm text-muted-foreground">Tidak ada data partisi.</p>
            ) : (
              metrics.disks.map((partition) => {
                const usagePct = partition.totalBytes > 0 ? (partition.usedBytes / partition.totalBytes) * 100 : 0;
                return (
                  <div key={`${partition.filesystem}-${partition.mountpoint}`} className="rounded-md border border-border p-2">
                    <div className="mb-1 flex items-center justify-between gap-2 text-sm">
                      <span className="truncate font-medium">{partition.mountpoint}</span>
                      <span className="text-muted-foreground">{partition.filesystem}</span>
                    </div>
                    <Progress value={usagePct} />
                    <p className="mt-1 text-xs text-muted-foreground">
                      Used {formatBytes(partition.usedBytes)} / {formatBytes(partition.totalBytes)} | Sisa {formatBytes(partition.availableBytes)}
                    </p>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground"><Server className="h-4 w-4" />Server Info</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>Hostname: <span className="text-foreground">{metrics.hostname}</span></p>
            <p>OS: <span className="text-foreground">{metrics.os}</span></p>
            <p>Uptime: <span className="text-foreground">{formatUptime(metrics.uptimeSec)}</span></p>
            <p>Disk mount: <span className="text-foreground">{metrics.disk.mountpoint}</span></p>
            <p>Filesystem: <span className="text-foreground">{metrics.disk.filesystem}</span></p>
            <p>Updated: <span className="text-foreground">{new Date(metrics.updatedAt).toLocaleString()}</span></p>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Service Health</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-2">
            {metrics.services.length === 0 ? (
              <p className="text-sm text-muted-foreground">Belum ada service terdaftar.</p>
            ) : (
              metrics.services.map((service) => (
                <div key={service.name} className="flex items-center justify-between rounded-md border border-border p-2 text-sm">
                  <span>{service.name}</span>
                  <Badge className={statusClass(service.status)}>{service.status}</Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
