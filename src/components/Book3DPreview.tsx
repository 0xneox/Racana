"use client";

import { useState, useRef, useEffect } from "react";
import { Download, Sparkles, Rotate3d, Layers, Share2, Check, Eye } from "lucide-react";
import { motion } from "framer-motion";

interface Book3DPreviewProps {
  jobId: string;
  bookTitle: string;
  authorName?: string;
  templateName?: string;
  pageCount: number;
  trimSize: string;
  previewPages: number;
  hasCover: boolean;
}

export function Book3DPreview({
  jobId,
  bookTitle,
  authorName = "Author",
  templateName = "Classic",
  pageCount = 184,
  trimSize = "6″ × 9″",
  previewPages = 4,
  hasCover = false,
}: Book3DPreviewProps) {
  const [viewMode, setViewMode] = useState<"3d" | "pages">("3d");
  const [rotation, setRotation] = useState({ x: 12, y: -25 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isGeneratingCard, setIsGeneratingCard] = useState(false);
  const [cardGenerated, setCardGenerated] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Approximate spine thickness in pixels based on page count
  const spineWidth = Math.max(18, Math.min(48, Math.round(pageCount * 0.16)));

  const coverImageSrc = hasCover
    ? `/api/jobs/${jobId}/cover?export=svg`
    : previewPages > 0
    ? `/api/jobs/${jobId}/preview/1`
    : null;

  // Mouse drag to rotate 3D book
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStart.x;
    const dy = e.clientY - dragStart.y;
    setRotation((prev) => ({
      x: Math.max(-30, Math.min(35, prev.x - dy * 0.3)),
      y: Math.max(-65, Math.min(45, prev.y + dx * 0.4)),
    }));
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleMouseUp = () => setIsDragging(false);

  // Generate 1080x1920 Instagram Story / WhatsApp Status Announcement Card
  const generateAnnouncementCard = async () => {
    setIsGeneratingCard(true);
    const canvas = document.createElement("canvas");
    canvas.width = 1080;
    canvas.height = 1920;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setIsGeneratingCard(false);
      return;
    }

    // 1. Editorial Background
    const bgGradient = ctx.createLinearGradient(0, 0, 0, 1920);
    bgGradient.addColorStop(0, "#141210");
    bgGradient.addColorStop(0.5, "#1C1917");
    bgGradient.addColorStop(1, "#0C0A09");
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, 1080, 1920);

    // Warm radial glow in center
    const radialGlow = ctx.createRadialGradient(540, 960, 50, 540, 960, 600);
    radialGlow.addColorStop(0, "rgba(163, 72, 37, 0.18)");
    radialGlow.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = radialGlow;
    ctx.fillRect(0, 0, 1080, 1920);

    // 2. Framing Border
    ctx.strokeStyle = "rgba(232, 226, 213, 0.15)";
    ctx.lineWidth = 2;
    ctx.strokeRect(60, 60, 960, 1800);

    // 3. Top Eyebrow Badge
    ctx.fillStyle = "#A34825";
    ctx.font = "bold 26px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("✦  OFFICIAL LAUNCH ANNOUNCEMENT  ✦", 540, 180);

    // 4. Book Title & Author
    ctx.fillStyle = "#F8F5EE";
    ctx.font = "bold 64px Georgia, serif";
    // Word wrap title
    const words = bookTitle.split(" ");
    let line = "";
    let y = 280;
    for (let n = 0; n < words.length; n++) {
      const testLine = line + words[n] + " ";
      const metrics = ctx.measureText(testLine);
      if (metrics.width > 860 && n > 0) {
        ctx.fillText(line.trim(), 540, y);
        line = words[n] + " ";
        y += 80;
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line.trim(), 540, y);

    y += 60;
    ctx.fillStyle = "#A8A29E";
    ctx.font = "32px sans-serif";
    ctx.fillText(`by ${authorName || "Author"}`, 540, y);

    // 5. Draw 3D-styled Book Plate in the Center
    const bookX = 300;
    const bookY = 620;
    const bookW = 480;
    const bookH = 720;

    // Drop shadow
    ctx.shadowColor = "rgba(0,0,0,0.7)";
    ctx.shadowBlur = 60;
    ctx.shadowOffsetX = 30;
    ctx.shadowOffsetY = 40;

    // Book cover fill
    ctx.fillStyle = "#26221F";
    ctx.beginPath();
    ctx.roundRect(bookX, bookY, bookW, bookH, [8, 16, 16, 8]);
    ctx.fill();

    // Reset shadow
    ctx.shadowColor = "transparent";

    // Try loading actual cover image onto canvas
    if (coverImageSrc) {
      try {
        const img = new Image();
        img.crossOrigin = "anonymous";
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = resolve; // Continue on fallback
          img.src = coverImageSrc;
        });
        if (img.complete && img.naturalWidth > 0) {
          ctx.save();
          ctx.beginPath();
          ctx.roundRect(bookX, bookY, bookW, bookH, [8, 16, 16, 8]);
          ctx.clip();
          ctx.drawImage(img, bookX, bookY, bookW, bookH);
          ctx.restore();
        }
      } catch (e) {
        // Fallback to elegant typographic cover plate
      }
    }

    // Spine 3D illusion border
    const spineGrad = ctx.createLinearGradient(bookX, bookY, bookX + 30, bookY);
    spineGrad.addColorStop(0, "rgba(0,0,0,0.5)");
    spineGrad.addColorStop(0.5, "rgba(255,255,255,0.1)");
    spineGrad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = spineGrad;
    ctx.fillRect(bookX, bookY, 30, bookH);

    // 6. Specs Pill
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ctx.beginPath();
    ctx.roundRect(240, 1440, 600, 100, 50);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.stroke();

    ctx.fillStyle = "#F8F5EE";
    ctx.font = "26px sans-serif";
    ctx.fillText(`${trimSize}  ·  ${pageCount} Pages  ·  Print-Ready Edition`, 540, 1500);

    // 7. Footer Branding
    ctx.fillStyle = "#78716C";
    ctx.font = "24px sans-serif";
    ctx.fillText("Formatted & Published with Racana", 540, 1680);
    ctx.font = "20px sans-serif";
    ctx.fillStyle = "#57534E";
    ctx.fillText("Amazon KDP · IngramSpark · Pothi", 540, 1720);

    // Convert to PNG and download
    const dataUrl = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.download = `${bookTitle.replace(/[^a-zA-Z0-9_-]/g, "_")}_Launch_Card.png`;
    link.href = dataUrl;
    link.click();

    setIsGeneratingCard(false);
    setCardGenerated(true);
    setTimeout(() => setCardGenerated(false), 4000);
  };

  return (
    <div className="bg-white rounded-3xl border border-[#E2DDD2] p-6 sm:p-8 mb-8 shadow-sm overflow-hidden">
      {/* Header and Mode Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-6 border-b border-[#E8E2D5]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#F4EFEA] text-[#A34825] flex items-center justify-center shrink-0">
            <Rotate3d className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="heading-h3 font-serif font-bold text-[#1C1917]">
                3D "Hold Your Book" Preview
              </h3>
              <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#F4EFEA] text-[#A34825] border border-[#E8E2D5]">
                Interactive
              </span>
            </div>
            <p className="text-xs text-[#78716C] mt-0.5">
              Inspect your finished volume in 3D space, or download an Instagram/WhatsApp Launch Card.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* View mode switcher */}
          <div className="inline-flex rounded-xl bg-[#F8F5EE] p-1 border border-[#E8E2D5]">
            <button
              type="button"
              onClick={() => setViewMode("3d")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                viewMode === "3d"
                  ? "bg-white text-[#1C1917] shadow-xs"
                  : "text-[#78716C] hover:text-[#1C1917]"
              }`}
            >
              <Rotate3d className="w-3.5 h-3.5 text-[#A34825]" />
              <span>3D Volume</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("pages")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                viewMode === "pages"
                  ? "bg-white text-[#1C1917] shadow-xs"
                  : "text-[#78716C] hover:text-[#1C1917]"
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-[#A34825]" />
              <span>Flat Pages ({previewPages})</span>
            </button>
          </div>

          {/* Download Launch Card CTA */}
          <button
            type="button"
            onClick={generateAnnouncementCard}
            disabled={isGeneratingCard}
            className="px-3.5 py-2 rounded-xl bg-[#1C1917] hover:bg-[#2E2824] text-white text-xs font-medium shadow-sm transition-all flex items-center gap-1.5 disabled:opacity-60"
          >
            {cardGenerated ? (
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Share2 className="w-3.5 h-3.5 text-[#A34825]" />
            )}
            <span>{isGeneratingCard ? "Compositing Card…" : cardGenerated ? "Downloaded!" : "Launch Card (PNG)"}</span>
          </button>
        </div>
      </div>

      {/* Main View Area */}
      {viewMode === "3d" ? (
        <div
          className="relative min-h-[420px] sm:min-h-[480px] bg-gradient-to-b from-[#FBF9F5] via-[#F4EFEA] to-[#EAE4DC] rounded-2xl flex items-center justify-center select-none overflow-hidden cursor-grab active:cursor-grabbing border border-[#E8E2D5]"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          {/* Subtle 3D floor shadow */}
          <div
            className="absolute bottom-10 w-72 h-14 bg-black/25 rounded-full blur-xl pointer-events-none transition-transform"
            style={{
              transform: `translate(${rotation.y * 1.2}px, 0) scale(${1 + rotation.x * 0.01})`,
            }}
          />

          {/* 3D Transform Stage */}
          <div
            className="transition-transform duration-75 ease-out"
            style={{
              perspective: "1200px",
              perspectiveOrigin: "50% 50%",
            }}
          >
            <div
              className="relative transition-all ease-out"
              style={{
                transformStyle: "preserve-3d",
                transform: `rotateX(${rotation.x}deg) rotateY(${rotation.y}deg)`,
                width: "240px",
                height: "350px",
              }}
            >
              {/* Front Cover Plate */}
              <div
                className="absolute inset-0 bg-[#26221F] rounded-r-md shadow-2xl overflow-hidden flex flex-col justify-between p-6 text-white border-y border-r border-[#3E3834]"
                style={{
                  transform: `translateZ(${spineWidth / 2}px)`,
                  backfaceVisibility: "hidden",
                }}
              >
                {coverImageSrc ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={coverImageSrc}
                    alt={bookTitle}
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                ) : (
                  <>
                    <div className="border-b border-[#57534E] pb-3">
                      <span className="text-[9px] uppercase tracking-widest text-[#A8A29E] block">
                        Racana Edition
                      </span>
                      <h4 className="font-serif text-lg font-bold mt-1 text-[#F8F5EE] line-clamp-3">
                        {bookTitle}
                      </h4>
                    </div>
                    <div className="flex items-end justify-between">
                      <span className="text-xs text-[#D6D3D1] font-medium">{authorName}</span>
                      <span className="text-[10px] text-[#A8A29E] font-mono">{trimSize}</span>
                    </div>
                  </>
                )}

                {/* Cover sheen & spine crease reflection */}
                <div className="absolute inset-0 pointer-events-none bg-gradient-to-r from-black/40 via-transparent to-white/10" />
                <div className="absolute left-0 top-0 bottom-0 w-3 bg-gradient-to-r from-black/60 to-transparent pointer-events-none" />
              </div>

              {/* Spine Plate */}
              <div
                className="absolute top-0 bottom-0 bg-[#1C1917] border-y border-[#3E3834] flex items-center justify-center overflow-hidden"
                style={{
                  width: `${spineWidth}px`,
                  left: `-${spineWidth / 2}px`,
                  transform: `rotateY(-90deg) translateZ(${spineWidth / 2}px)`,
                }}
              >
                <div className="transform -rotate-90 whitespace-nowrap text-[10px] font-serif text-[#E7E5E4] tracking-wider uppercase font-semibold">
                  {bookTitle.slice(0, 24)}
                </div>
              </div>

              {/* Back Cover Plate */}
              <div
                className="absolute inset-0 bg-[#1C1917] rounded-l-md p-6 flex flex-col justify-between text-[#A8A29E] border-y border-l border-[#3E3834]"
                style={{
                  transform: `rotateY(180deg) translateZ(${spineWidth / 2}px)`,
                }}
              >
                <p className="text-[10px] leading-relaxed line-clamp-6">
                  Published with Racana. Formatted to exact Amazon KDP &amp; IngramSpark print specifications.
                </p>
                <div className="flex items-center justify-between text-[9px] font-mono border-t border-[#292524] pt-2">
                  <span>{trimSize}</span>
                  <span>{pageCount} pp</span>
                </div>
              </div>

              {/* Paper Leaves / Fore-Edge Block (Thickness Texture) */}
              <div
                className="absolute top-1 bottom-1 bg-[#F5F2EB] border-r border-[#D6CEBE]"
                style={{
                  width: `${spineWidth}px`,
                  right: `-${spineWidth / 2}px`,
                  transform: `rotateY(90deg) translateZ(${120 - spineWidth / 2}px)`,
                  backgroundImage:
                    "repeating-linear-gradient(to right, #F5F2EB 0px, #EAE4D7 1px, #F5F2EB 2px)",
                }}
              />
            </div>
          </div>

          {/* Interactive Helper Overlay */}
          <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between pointer-events-none text-[11px] text-[#78716C]">
            <span className="flex items-center gap-1.5 bg-white/80 backdrop-blur-xs px-3 py-1.5 rounded-full border border-[#E8E2D5] shadow-xs">
              <Rotate3d className="w-3.5 h-3.5 text-[#A34825]" />
              Click &amp; drag to rotate volume in 3D
            </span>
            <span className="bg-white/80 backdrop-blur-xs px-3 py-1.5 rounded-full border border-[#E8E2D5] shadow-xs hidden sm:inline">
              Spine thickness: {pageCount} pages ({trimSize})
            </span>
          </div>
        </div>
      ) : (
        /* Flat 2D Pages Carousel */
        <div className="space-y-3">
          <div className="flex gap-4 overflow-x-auto pb-4 pt-1">
            {Array.from({ length: previewPages }, (_, i) => (
              <div key={i} className="flex-col shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/jobs/${jobId}/preview/${i + 1}`}
                  alt={`Preview page ${i + 1}`}
                  className="w-36 sm:w-44 rounded-lg border border-[#E8E2D5] shadow-md hover:scale-102 transition-transform bg-white"
                  loading="lazy"
                />
                <span className="text-[10px] text-center block text-[#78716C] mt-2 font-mono">
                  Page {i + 1}
                </span>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-[#78716C] italic text-center">
            Rendered with authentic Typst engine — trim margins, recto openers, and running headers embedded.
          </p>
        </div>
      )}
    </div>
  );
}
