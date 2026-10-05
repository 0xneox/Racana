export const metadata = { title: "Privacy Policy — Racana" };

export default function PrivacyPage() {
  return (
    <div className="py-12 px-4 sm:px-6 max-w-2xl mx-auto">
      <h1 className="font-serif text-3xl font-bold text-[#1C1917] mb-2">Privacy Policy</h1>
      <p className="text-xs text-[#A8A29E] mb-8">Last updated: September 2026</p>

      <div className="space-y-6 text-sm text-[#44403C] leading-relaxed">
        <section>
          <h2 className="font-serif font-bold text-lg text-[#1C1917] mb-2">Your manuscripts are yours</h2>
          <p>
            Racana exists to format your manuscript into a print-ready book interior. We never read,
            rewrite, edit, or use your manuscript content for any other purpose — including AI training.
            Your words remain entirely yours.
          </p>
        </section>

        <section>
          <h2 className="font-serif font-bold text-lg text-[#1C1917] mb-2">What we collect</h2>
          <ul className="list-disc pl-5 space-y-1.5 text-[#57534E]">
            <li>Your email address — used to sign you in and deliver your finished book.</li>
            <li>Your manuscript file — stored securely so we can typeset it.</li>
            <li>Book settings — your chosen style, trim size, and formatting preferences.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-serif font-bold text-lg text-[#1C1917] mb-2">Storage & retention</h2>
          <p>
            Manuscripts and generated book interiors are stored on encrypted S3-compatible storage.
            Raw manuscript files are retained for 30 days — the same window in which paid books can be
            re-generated for free — then automatically deleted. You never have to wait for that: delete
            any book yourself from My Books, or delete your account entirely, and your manuscript files
            and generated artifacts are removed immediately. You may also request deletion at any time
            by emailing books@racana.pro.
          </p>
        </section>

        <section>
          <h2 className="font-serif font-bold text-lg text-[#1C1917] mb-2">Third-party processing</h2>
          <p>
            When AI-assisted structure detection is enabled on our servers, a short opening excerpt of
            your manuscript (up to about 8,000 characters — a few pages, never the whole book) is sent
            to a third-party language-model endpoint to help detect your title, author name, and chapter
            boundaries. This is processing on our behalf to build your book — the excerpt is not used to
            train models and is not retained by us beyond the analysis. If the feature is disabled or the
            provider is unreachable, your book is typeset entirely on our own systems. To opt out for
            your account, email books@racana.pro.
          </p>
        </section>

        <section>
          <h2 className="font-serif font-bold text-lg text-[#1C1917] mb-2">What we never do</h2>
          <ul className="list-disc pl-5 space-y-1.5 text-[#57534E]">
            <li>We never sell your data.</li>
            <li>We never modify your manuscript content — formatting only.</li>
            <li>We never use your work to train models.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-serif font-bold text-lg text-[#1C1917] mb-2">Contact</h2>
          <p>
            Questions about your data? Email books@racana.pro — a human answers.
          </p>
        </section>
      </div>
    </div>
  );
}
