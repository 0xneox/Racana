import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getFromStorage } from "@/lib/storage/s3";
import { GENERIC_INTERNAL_ERROR, logServerError, requireIdentity, requireJobOwner } from "@/lib/auth-utils";
import { addWatermarkOverlayToPdf } from "@/lib/watermark";

function isWatermarkFree(
  payments: { id: string; status: string; amountCents: number; currency: string; createdAt?: Date }[]
): boolean {
  return payments?.some((p) => p.status === "paid");
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const identity = await requireIdentity();

    const ownerRes = await requireJobOwner(params.id, {
      userId: identity.user?.id,
      guestId: identity.guestId,
    });
    if (ownerRes.error) return ownerRes.error;

    const job = await prisma.bookJob.findUnique({
      where: { id: params.id },
      include: {
        artifacts: true,
        manuscriptAsset: true,
        payments: {
          orderBy: { createdAt: "desc" },
          select: { id: true, status: true, amountCents: true, currency: true, createdAt: true },
        },
      },
    });

    if (!job) {
      return NextResponse.json({ error: "Job not found." }, { status: 404 });
    }

    const interiorArtifact = (job.artifacts as any[])?.find(
      (a: any) => a.artifactType === "interior_pdf"
    );

    if (!interiorArtifact && job.status !== "ready") {
      return NextResponse.json(
        { error: "Print-ready PDF artifact not yet available for this job." },
        { status: 400 }
      );
    }

    const s3Key = interiorArtifact?.s3Key || `artifacts/${params.id}/interior_print_ready.pdf`;
    const s3Bucket = interiorArtifact?.s3Bucket || "artifacts";

    let pdfBuffer: Buffer;
    try {
      pdfBuffer = await getFromStorage(s3Key, s3Bucket);
    } catch (storageErr) {
      logServerError("Jobs Download Storage", storageErr);
      return NextResponse.json(
        { error: "Print-ready PDF artifact not yet available for this job." },
        { status: 400 }
      );
    }

    const fullPaid = isWatermarkFree(job.payments as any[]);
    if (!fullPaid) {
      try {
        pdfBuffer = await addWatermarkOverlayToPdf(pdfBuffer, "RACANA · FREE PREVIEW");
      } catch (watermarkErr) {
        logServerError("Jobs Download Watermark", watermarkErr);
        return NextResponse.json(
          { error: "Could not prepare the preview PDF. Please try again." },
          { status: 500 }
        );
      }
    }

    const baseName = (job.manuscriptAsset?.fileName || "manuscript")
      .replace(/\.[^/.]+$/, "")
      .replace(/[^a-zA-Z0-9_-]/g, "_");
    const filename = fullPaid
      ? `${baseName}_interior_print_ready.pdf`
      : `${baseName}_interior_preview.pdf`;

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": pdfBuffer.length.toString(),
        "X-Payment-Required": fullPaid ? "false" : "true",
      },
    });
  } catch (err) {
    logServerError("Jobs Download API", err);
    return NextResponse.json(
      { error: GENERIC_INTERNAL_ERROR },
      { status: 500 }
    );
  }
}
