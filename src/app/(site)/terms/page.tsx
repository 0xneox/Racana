export const metadata = { title: "Terms of Service — Racana" };

export default function TermsPage() {
  return (
    <div className="py-12 px-4 sm:px-6 max-w-2xl mx-auto">
      <h1 className="font-serif text-3xl font-bold text-[#1C1917] mb-2">Terms of Service</h1>
      <p className="text-xs text-[#A8A29E] mb-8">Last updated: September 2026</p>

      <div className="space-y-6 text-sm text-[#44403C] leading-relaxed">
        <section>
          <h2 className="font-serif font-bold text-lg text-[#1C1917] mb-2">The service</h2>
          <p>
            Racana converts your uploaded DOCX or PDF manuscript into a print-ready interior PDF.
            We format — we never edit, rewrite, or silently correct your content.
          </p>
        </section>

        <section>
          <h2 className="font-serif font-bold text-lg text-[#1C1917] mb-2">Your rights</h2>
          <p>
            You retain 100% ownership of your manuscript and the generated book interior. Racana
            claims no copyright, license, or distribution rights over your work.
          </p>
        </section>

        <section>
          <h2 className="font-serif font-bold text-lg text-[#1C1917] mb-2">Your responsibilities</h2>
          <ul className="list-disc pl-5 space-y-1.5 text-[#57534E]">
            <li>Only upload manuscripts you own or have rights to publish.</li>
            <li>Verify your final PDF before sending it to a printer or platform.</li>
            <li>Don't upload malware, illegal content, or files that aren't documents.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-serif font-bold text-lg text-[#1C1917] mb-2">Print refund promise</h2>
          <p>
            If Racana produces a PDF that Amazon KDP rejects for an interior formatting reason,
            forward the rejection to books@racana.pro within 30 days for a full refund.
          </p>
        </section>

        <section>
          <h2 className="font-serif font-bold text-lg text-[#1C1917] mb-2">Limits</h2>
          <p>
            The service is provided "as is." We work hard to produce bookstore-grade output, but
            the author remains responsible for final pre-publication review. Liability is limited
            to the amount you paid for the book in question.
          </p>
        </section>

        <section>
          <h2 className="font-serif font-bold text-lg text-[#1C1917] mb-2">Contact</h2>
          <p>books@racana.pro</p>
        </section>
      </div>
    </div>
  );
}
