"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ProgressBar } from "@/components/ProgressBar";
import { Upload, FileText, CheckCircle2, AlertCircle, ArrowRight, Loader2 } from "lucide-react";
import { formatBytes } from "@/lib/utils";
import { track } from "@/lib/analytics";

const BOOK_TYPES = [
  { id: "novel", key: "typeNovel" },
  { id: "philosophy", key: "typePhilosophy" },
  { id: "academic", key: "typeAcademic" },
  { id: "business", key: "typeBusiness" },
  { id: "memoir", key: "typeMemoir" },
  { id: "spiritual", key: "typeSpiritual" },
  { id: "other", key: "typeOther" },
] as const;

export default function UploadPage() {
  const t = useTranslations("Upload");
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [bookType, setBookType] = useState<string>("novel");
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = (selectedFile: File) => {
    setError(null);
    const name = selectedFile.name.toLowerCase();
    if (!name.endsWith(".docx") && !name.endsWith(".pdf")) {
      setError(t("errType"));
      return;
    }
    if (selectedFile.size === 0) {
      setError(t("errEmpty"));
      return;
    }
    if (selectedFile.size > 50 * 1024 * 1024) {
      setError(t("errSize"));
      return;
    }
    setFile(selectedFile);
    track("upload_started", { fileName: selectedFile.name, size: selectedFile.size, bookType });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError(t("errNoFile"));
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("bookType", bookType);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || t("errFailed"));
      }

      track("upload_success", { fileName: file.name }, data.jobId);
      // Seamless transition to Step 2: Templates
      router.push(`/templates?jobId=${data.jobId}`);
    } catch (err) {
      setError((err as Error).message);
      setIsUploading(false);
    }
  };

  return (
    <div className="py-10 px-4 sm:px-6 max-w-3xl mx-auto">
      <ProgressBar currentStep={1} />

      <div className="text-center mb-8">
        <h1 className="font-serif text-3xl font-bold text-[#1C1917] mb-2">
          {t("title")}
        </h1>
        <p className="text-sm text-[#78716C]">
          {t("subtitle")}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Book Type Selection Chips */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-[#57534E] mb-3">
            {t("step1")}
          </label>
          <div className="flex flex-wrap gap-2">
            {BOOK_TYPES.map((type) => {
              const isSelected = bookType === type.id;
              return (
                <button
                  key={type.id}
                  type="button"
                  onClick={() => setBookType(type.id)}
                  className={`px-4 py-2 rounded-full text-xs font-medium transition-all ${
                    isSelected
                      ? "bg-[#1C1917] text-[#F8F5EE] shadow-sm font-semibold"
                      : "bg-[#F8F5EE] border border-[#D6CEBE] text-[#57534E] hover:border-[#1C1917] hover:text-[#1C1917]"
                  }`}
                >
                  {t(type.key)}
                </button>
              );
            })}
          </div>
        </div>

        {/* Drag & Drop Upload Zone */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-[#57534E] mb-3">
            {t("step2")}
          </label>

          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                fileInputRef.current?.click();
              }
            }}
            role="button"
            tabIndex={0}
            aria-label={t("ariaUpload")}
            className={`border-2 border-dashed rounded-2xl p-8 sm:p-12 text-center cursor-pointer transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#A34825] focus-visible:ring-offset-2 ${
              isDragging
                ? "border-[#A34825] bg-[#A34825]/5 scale-[0.99]"
                : file
                ? "border-[#1C1917] bg-[#F8F5EE]"
                : "border-[#D6CEBE] bg-[#FDFBF7] hover:border-[#78716C] hover:bg-[#F8F5EE]"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".docx,.pdf"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleFile(e.target.files[0]);
                }
              }}
            />

            {file ? (
              <div className="flex flex-col items-center gap-2">
                <div className="w-12 h-12 rounded-full bg-[#1C1917] text-[#F8F5EE] flex items-center justify-center">
                  <FileText className="w-6 h-6" />
                </div>
                <div className="font-serif font-bold text-base text-[#1C1917]">
                  {file.name}
                </div>
                <div className="text-xs text-[#78716C]">
                  {formatBytes(file.size)} • {t("fileReplace")}
                </div>
                <span className="inline-flex items-center gap-1 text-xs text-[#A34825] font-medium mt-2">
                  <CheckCircle2 className="w-4 h-4" /> {t("fileReady")}
                </span>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-[#F4EFEA] text-[#78716C] flex items-center justify-center">
                  <Upload className="w-6 h-6" />
                </div>
                <div>
                  <span className="font-semibold text-sm text-[#1C1917]">
                    {t("dropTitle")}
                  </span>{" "}
                  <span className="text-sm text-[#78716C]">{t("dropOr")}</span>
                </div>
                <p className="text-xs text-[#A8A29E]">
                  {t("dropHint")}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="p-4 rounded-xl bg-[#FEF2F2] border border-[#FCA5A5] text-[#991B1B] text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Submit Action */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={!file || isUploading}
            className={`w-full py-4 rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition-all ${
              !file || isUploading
                ? "bg-[#E5DFD3] text-[#A8A29E] cursor-not-allowed"
                : "bg-[#1C1917] text-[#F8F5EE] hover:bg-[#2E2824] shadow-md hover:shadow-lg"
            }`}
          >
            {isUploading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{t("uploading")}</span>
              </>
            ) : (
              <>
                <span>{t("submit")}</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
