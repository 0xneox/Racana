import { BookMarked, ShieldCheck, Printer } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-[#E8E2D5] bg-[#F8F5EE] py-12 mt-20 text-[#57534E]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-10 pb-10 border-b border-[#E8E2D5]/70 text-sm">
          <div className="flex items-start gap-3">
            <BookMarked className="w-5 h-5 text-[#A34825] shrink-0 mt-0.5" />
            <div>
              <h4 className="font-serif font-bold text-[#1C1917] mb-1">Bookstore Standards</h4>
              <p className="text-xs text-[#78716C] leading-relaxed">
                Typeset to professional publishing standards with true recto chapter openings, running heads, and balanced folios.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Printer className="w-5 h-5 text-[#A34825] shrink-0 mt-0.5" />
            <div>
              <h4 className="font-serif font-bold text-[#1C1917] mb-1">Guaranteed Print-Ready</h4>
              <p className="text-xs text-[#78716C] leading-relaxed">
                Automated gutter compensation, precise trim bounds (5x8, 5.5x8.5, 6x9, 8.5x11), and PDF/X-compliant interiors.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-[#A34825] shrink-0 mt-0.5" />
            <div>
              <h4 className="font-serif font-bold text-[#1C1917] mb-1">Zero Technical Knowledge</h4>
              <p className="text-xs text-[#78716C] leading-relaxed">
                No typesetting software, no margin calculators, no widow/orphan fixing. Upload your manuscript, get your finished book.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#78716C]">
          <p>© {new Date().getFullYear()} Manuscript In, Book Out. All rights reserved.</p>
          <p className="italic font-serif">
            “Upload your manuscript. Choose a style. We make the book.”
          </p>
        </div>
      </div>
    </footer>
  );
}
