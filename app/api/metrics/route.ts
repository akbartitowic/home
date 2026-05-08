import os from "node:os";
import { promisify } from "node:util";
import { execFile as execFileCb } from "node:child_process";
import { readFile } from "node:fs/promises";

import { NextResponse } from "next/server";

const execFile = promisify(execFileCb);
const MBPS_DIVISOR = 1024 * 1024;

let lastNetworkSample:
  | {
      rxBytes: number;
      txBytes: number;
      atMs: number;
    }
  | null = null;

type DiskStats = {
  filesystem: string;
  mountpoint: string;
  totalBytes: number;
  usedBytes: number;
  availableBytes: number;
};

type GpuStats = {
  vendor: string;
  model: string;
  usagePercent: number | null;
  memoryUsedMiB: number | null;
  memoryTotalMiB: number | null;
  temperatureC: number | null;
  available: boolean;
};

type NetworkStats = {
  downloadMbps: number;
  uploadMbps: number;
  latencyMs: number;
};

function parseDfOutput(stdout: string): DiskStats[] {
  const lines = stdout.trim().split("\n");
  if (lines.length < 2) {
    throw new Error("Unable to parse disk usage from df");
  }

  const dataLines = lines.slice(1);
  const partitions = dataLines
    .map((line) => line.trim().split(/\s+/))
    .filter((parts) => parts.length >= 6)
    .map((parts) => ({
      filesystem: parts[0],
      totalBytes: Number(parts[1]) * 1024,
      usedBytes: Number(parts[2]) * 1024,
      availableBytes: Number(parts[3]) * 1024,
      mountpoint: parts[5],
    }))
    .filter((item) => item.mountpoint && item.totalBytes > 0);

  const byMount = new Map<string, DiskStats>();
  for (const partition of partitions) {
    byMount.set(partition.mountpoint, partition);
  }

  return [...byMount.values()].sort((a, b) => a.mountpoint.localeCompare(b.mountpoint));
}

async function getDiskStats(): Promise<DiskStats[]> {
  // -a ensures all mounted filesystems are listed.
  const { stdout } = await execFile("df", ["-kPa"]);
  return parseDfOutput(stdout);
}

async function getGpuStats(): Promise<GpuStats> {
  try {
    const { stdout } = await execFile("nvidia-smi", [
      "--query-gpu=name,utilization.gpu,memory.used,memory.total,temperature.gpu",
      "--format=csv,noheader,nounits",
    ]);
    const firstLine = stdout.trim().split("\n")[0];
    if (!firstLine) throw new Error("No GPU rows");
    const [name, utilization, memoryUsed, memoryTotal, temperature] = firstLine
      .split(",")
      .map((item) => item.trim());

    return {
      vendor: "NVIDIA",
      model: name || "Unknown GPU",
      usagePercent: Number.isFinite(Number(utilization)) ? Number(utilization) : null,
      memoryUsedMiB: Number.isFinite(Number(memoryUsed)) ? Number(memoryUsed) : null,
      memoryTotalMiB: Number.isFinite(Number(memoryTotal)) ? Number(memoryTotal) : null,
      temperatureC: Number.isFinite(Number(temperature)) ? Number(temperature) : null,
      available: true,
    };
  } catch {
    return {
      vendor: "Unknown",
      model: "GPU not detected",
      usagePercent: null,
      memoryUsedMiB: null,
      memoryTotalMiB: null,
      temperatureC: null,
      available: false,
    };
  }
}

async function getCpuUsagePercent() {
  const first = os.cpus();
  await new Promise((resolve) => setTimeout(resolve, 200));
  const second = os.cpus();

  let idleDiff = 0;
  let totalDiff = 0;

  for (let i = 0; i < first.length; i += 1) {
    const t1 = first[i].times;
    const t2 = second[i].times;
    const firstTotal = t1.user + t1.nice + t1.sys + t1.idle + t1.irq;
    const secondTotal = t2.user + t2.nice + t2.sys + t2.idle + t2.irq;
    totalDiff += secondTotal - firstTotal;
    idleDiff += t2.idle - t1.idle;
  }

  if (totalDiff <= 0) return 0;
  return Number((((totalDiff - idleDiff) / totalDiff) * 100).toFixed(1));
}

async function readLinuxNetworkBytes() {
  const content = await readFile("/proc/net/dev", "utf-8");
  const lines = content
    .trim()
    .split("\n")
    .slice(2)
    .map((line) => line.trim())
    .filter(Boolean);

  let rxBytes = 0;
  let txBytes = 0;
  for (const line of lines) {
    const [namePart, dataPart] = line.split(":");
    if (!namePart || !dataPart) continue;
    const iface = namePart.trim();
    if (iface === "lo") continue;
    const fields = dataPart.trim().split(/\s+/);
    if (fields.length < 9) continue;
    rxBytes += Number(fields[0]) || 0;
    txBytes += Number(fields[8]) || 0;
  }

  return { rxBytes, txBytes };
}

async function getLatencyMs() {
  try {
    const { stdout } = await execFile("ping", ["-c", "1", "-W", "1", "1.1.1.1"]);
    const match = stdout.match(/time=([0-9.]+)/);
    if (!match) return 0;
    return Number(match[1]) || 0;
  } catch {
    return 0;
  }
}

async function getNetworkStats(): Promise<NetworkStats> {
  const latencyMs = await getLatencyMs();

  try {
    const current = await readLinuxNetworkBytes();
    const now = Date.now();

    if (!lastNetworkSample) {
      lastNetworkSample = { ...current, atMs: now };
      return { downloadMbps: 0, uploadMbps: 0, latencyMs };
    }

    const elapsedSec = Math.max((now - lastNetworkSample.atMs) / 1000, 1);
    const rxRateBps = Math.max(current.rxBytes - lastNetworkSample.rxBytes, 0) / elapsedSec;
    const txRateBps = Math.max(current.txBytes - lastNetworkSample.txBytes, 0) / elapsedSec;

    lastNetworkSample = { ...current, atMs: now };
    return {
      downloadMbps: Number((rxRateBps / MBPS_DIVISOR).toFixed(2)),
      uploadMbps: Number((txRateBps / MBPS_DIVISOR).toFixed(2)),
      latencyMs: Number(latencyMs.toFixed(2)),
    };
  } catch {
    return {
      downloadMbps: 0,
      uploadMbps: 0,
      latencyMs: Number(latencyMs.toFixed(2)),
    };
  }
}

export async function GET() {
  try {
    const [disks, cpuPercent, gpu, network] = await Promise.all([
      getDiskStats(),
      getCpuUsagePercent(),
      getGpuStats(),
      getNetworkStats(),
    ]);
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const rootDisk = disks.find((item) => item.mountpoint === "/") ?? disks[0];

    if (!rootDisk) {
      throw new Error("No disk partitions detected");
    }

    return NextResponse.json({
      hostname: os.hostname(),
      os: `${os.type()} ${os.release()}`,
      uptimeSec: Math.floor(os.uptime()),
      updatedAt: new Date().toISOString(),
      cpu: {
        usagePercent: cpuPercent,
        tempC: null,
      },
      memory: {
        usedBytes: usedMem,
        totalBytes: totalMem,
      },
      disk: rootDisk,
      disks,
      gpu,
      network,
      services: [
        { name: "Homepage", status: "healthy" },
      ],
    });
  } catch (error) {
    return NextResponse.json(
      {
        message: "Failed to collect server metrics",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
