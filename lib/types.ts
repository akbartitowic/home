export type MetricsResponse = {
  hostname: string;
  os: string;
  uptimeSec: number;
  updatedAt: string;
  cpu: {
    usagePercent: number;
    tempC: number | null;
  };
  memory: {
    usedBytes: number;
    totalBytes: number;
  };
  disk: {
    usedBytes: number;
    totalBytes: number;
    availableBytes: number;
    mountpoint: string;
    filesystem: string;
  };
  network: {
    downloadMbps: number;
    uploadMbps: number;
    latencyMs: number;
  };
  services: Array<{
    name: string;
    status: "healthy" | "degraded" | "down";
  }>;
};
