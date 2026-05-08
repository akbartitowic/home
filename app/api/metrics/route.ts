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

function parseDfOutput(stdout: string): DiskStats {
  const lines = stdout.trim().split("\n");
  const dataLine = lines[lines.length - 1] ?? "";
  const parts = dataLine.trim().split(/\s+/);
  if (parts.length < 6) {
    throw new Error("Unable to parse disk usage from df");
  }

  const filesystem = parts[0];
  const totalKB = Number(parts[1]);
  const usedKB = Number(parts[2]);
  const availableKB = Number(parts[3]);
  const mountpoint = parts[5];

  return {
    filesystem,
    mountpoint,
    totalBytes: totalKB * 1024,
    usedBytes: usedKB * 1024,
    availableBytes: availableKB * 1024,
  };
}

async function getDiskStats(): Promise<DiskStats> {
  const targetPath = process.env.DISK_TARGET_PATH || "/";
  const { stdout } = await execFile("df", ["-kP", targetPath]);
  return parseDfOutput(stdout);
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
    const [disk, cpuPercent] = await Promise.all([getDiskStats(), getCpuUsagePercent()]);
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;

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
      disk,
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
