import prisma from "./db";
import { deleteFromStorage } from "./storage/s3";

// Raw manuscript retention: uploads are kept for 30 days (the paid revision
// window and the privacy policy's stated retention), then the file bytes are
// deleted from storage. The asset row stays so the book's title, page count
// and history still work — `deletedAt` marks the file as gone.
const MANUSCRIPT_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

export async function runRetentionSweep(now = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - MANUSCRIPT_RETENTION_MS);
  const stale = await prisma.manuscriptAsset.findMany({
    where: {
      createdAt: { lt: cutoff },
      deletedAt: null,
    },
    select: { id: true, jobId: true, s3Key: true, s3Bucket: true },
  });

  let purged = 0;
  for (const asset of stale) {
    try {
      if (asset.s3Key) {
        await deleteFromStorage(asset.s3Key, asset.s3Bucket || "manuscripts");
      }
      await prisma.manuscriptAsset.update({
        where: { id: asset.id },
        data: { deletedAt: now },
      });
      purged++;
    } catch (err) {
      console.warn(`[Retention] purge failed for asset ${asset.id}:`, (err as Error).message);
    }
  }
  return purged;
}

// Called by the BullMQ consumer (embedded or dedicated worker): sweeps once
// shortly after boot, then once a day. Timers are unref'd so they never keep
// a dying process alive.
export function startRetentionSweepTimer() {
  if ((global as any).__retentionTimerStarted) return;
  (global as any).__retentionTimerStarted = true;
  const run = () =>
    runRetentionSweep()
      .then((n) => {
        if (n > 0) console.log(`[Retention] purged ${n} manuscript file(s) older than 30 days`);
      })
      .catch((err) => console.warn("[Retention] sweep failed:", (err as Error).message));
  const boot = setTimeout(run, 60_000);
  const daily = setInterval(run, 24 * 60 * 60 * 1000);
  boot.unref?.();
  daily.unref?.();
}
