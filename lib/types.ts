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
  disks: Array<{
    usedBytes: number;
    totalBytes: number;
    availableBytes: number;
    mountpoint: string;
    filesystem: string;
  }>;
  gpu: {
    vendor: string;
    model: string;
    usagePercent: number | null;
    memoryUsedMiB: number | null;
    memoryTotalMiB: number | null;
    temperatureC: number | null;
    available: boolean;
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
