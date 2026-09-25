import { ImageResponse } from "next/og";
import prisma from "@/lib/db";

export const runtime = "nodejs";
export const alt = "Typeset with Racana";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Dynamic OG card for a shared book — this is what renders when the author
// posts their /s/ link on X.
export default async function OgImage({ params }: { params: { token: string } }) {
  let title = "Your manuscript in. Your finished book out.";
  let author = "";
  let pages = "";

  if (/^[a-f0-9]{24}$/.test(params.token)) {
    const job = await prisma.bookJob.findFirst({
      where: { shareToken: params.token },
      include: { structureJson: true, manuscriptAsset: true },
    }).catch(() => null);
    if (job) {
      title =
        job.structureJson?.detectedTitle ||
        job.manuscriptAsset?.fileName?.replace(/\.[^/.]+$/, "") ||
        title;
      author = job.structureJson?.detectedAuthor || "";
    }
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          backgroundColor: "#FDFBF7",
          padding: "60px",
          fontFamily: "Georgia, serif",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 22,
            letterSpacing: 6,
            color: "#A34825",
            textTransform: "uppercase",
          }}
        >
          <span>Typeset with Racana</span>
          <span style={{ color: "#A8A29E" }}>{pages}</span>
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontSize: title.length > 60 ? 56 : 72,
              fontWeight: 700,
              color: "#1C1917",
              lineHeight: 1.15,
              maxWidth: 1000,
            }}
          >
            {title}
          </div>
          {author && (
            <div style={{ fontSize: 30, fontStyle: "italic", color: "#78716C", marginTop: 24 }}>
              by {author}
            </div>
          )}
          <div style={{ width: 80, height: 3, backgroundColor: "#A34825", marginTop: 40 }} />
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 24,
            color: "#78716C",
          }}
        >
          <span style={{ fontWeight: 900, letterSpacing: 8, color: "#1C1917" }}>RACANA</span>
          <span>manuscript in — finished book out</span>
        </div>
      </div>
    ),
    { ...size }
  );
}
