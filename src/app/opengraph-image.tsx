import { ImageResponse } from "next/og";

export const runtime = "nodejs";
export const alt = "Racana — Your manuscript in. Your finished book out.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Site-wide OG card — renders when racana.pro links are posted on X.
export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          backgroundColor: "#1C1917",
          padding: "60px",
          fontFamily: "Georgia, serif",
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 22,
            letterSpacing: 6,
            color: "#D9A679",
            textTransform: "uppercase",
          }}
        >
          Book interior publisher for Indian authors
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            flex: 1,
            justifyContent: "center",
          }}
        >
          <div style={{ fontSize: 120, fontWeight: 900, letterSpacing: 10, color: "#F8F5EE", lineHeight: 1 }}>
            RACANA
          </div>
          <div style={{ display: "flex", fontSize: 52, color: "#F8F5EE", marginTop: 30, lineHeight: 1.2 }}>
            <span>Your manuscript in.&nbsp;</span>
            <span style={{ fontStyle: "italic", color: "#D9A679" }}>
              Your finished book out.
            </span>
          </div>
          <div style={{ fontSize: 28, color: "#A8A29E", marginTop: 24 }}>
            Upload. Choose a style. Get a print-ready book.
          </div>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 24,
            color: "#A8A29E",
          }}
        >
          <span>Free preview · No subscription</span>
          <span>racana.pro</span>
        </div>
      </div>
    ),
    { ...size }
  );
}
