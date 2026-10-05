import prisma from "../db";
import { deleteFromStorage } from "../storage/s3";

// Deletes a book job completely: every stored object (manuscript, rendered
// PDFs, preview PNGs, cover files, saved cover config) and the DB row.
// Child rows (asset, structure, settings, template choice, artifacts, QA
// reports) cascade; payments and email logs keep a SetNull audit trail.
export async function deleteJobEverywhere(jobId: string): Promise<void> {
  const job = await prisma.bookJob.findUnique({
    where: { id: jobId },
    include: { manuscriptAsset: true, artifacts: true },
  });
  if (!job) return;

  const objects: { key: string; bucket: string }[] = [];
  if (job.manuscriptAsset?.s3Key && !(job.manuscriptAsset as any).deletedAt) {
    objects.push({ key: job.manuscriptAsset.s3Key, bucket: job.manuscriptAsset.s3Bucket || "manuscripts" });
  }
  for (const a of job.artifacts || []) {
    if (a.s3Key) objects.push({ key: a.s3Key, bucket: a.s3Bucket || "artifacts" });
  }
  // The Cover Studio saves its design config beside the artifacts without an
  // artifact row, so it needs an explicit delete.
  objects.push({ key: `artifacts/${jobId}/cover_config.json`, bucket: "artifacts" });

  for (const o of objects) {
    try {
      await deleteFromStorage(o.key, o.bucket);
    } catch {
      // best-effort — the DB row is deleted regardless
    }
  }

  await prisma.bookJob.delete({ where: { id: jobId } });
}
