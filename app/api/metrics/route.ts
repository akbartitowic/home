import os from "node:os";
import { promisify } from "node:util";
import { execFile as execFileCb } from "node:child_process";

import { NextResponse } from "next/server";

const execFile = promisify(execFileCb);

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

function parseDfOutput(stdout: string): DiskStats[] {
  const lines = stdout.trim().split("\n");
  if (lines.length < 2) {
    throw new Error("Unable to parse disk usage from df");
  }

  const dataLines = lines.slice(1);
  return dataLines
    .map((line) => line.trim().split(/\s+/))
    .filter((parts) => parts.length >= 6)
    .map((parts) => ({
      filesystem: parts[0],
      totalBytes: Number(parts[1]) * 1024,
      usedBytes: Number(parts[2]) * 1024,
      availableBytes: Number(parts[3]) * 1024,
      mountpoint: parts[5],
    }));
}

async function getDiskStats(): Promise<DiskStats[]> {
  const { stdout } = await execFile("df", ["-kP"]);
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

export async function GET() {
  try {
    const [disks, cpuPercent, gpu] = await Promise.all([getDiskStats(), getCpuUsagePercent(), getGpuStats()]);
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
      network: {
        downloadMbps: 0,
        uploadMbps: 0,
        latencyMs: 0,
      },
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
