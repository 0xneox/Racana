"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BookOpen, Mail, ArrowRight, Loader2 } from "lucide-react";

function SignInContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/upload";

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes("@")) {
      setError("Please enter a valid email address.");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/signin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Sign in failed");

      router.push(callbackUrl);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = () => {
    window.location.href = "/api/auth/google";
  };

  return (
    <div className="py-16 px-4 sm:px-6 max-w-md mx-auto">
      <div className="text-center mb-8">
        <div className="w-12 h-12 rounded-xl bg-[#2D241E] text-[#F8F5EE] flex items-center justify-center mx-auto mb-4 shadow-sm">
          <BookOpen className="w-6 h-6" />
        </div>
        <h1 className="font-serif text-3xl font-bold text-[#1C1917] mb-2">
          Author Sign In
        </h1>
        <p className="text-xs text-[#78716C]">
          Save your book projects, re-download formatted interiors, and manage your titles.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-[#E2DDD2] p-6 sm:p-8 shadow-sm space-y-6">
        {/* Google OAuth Stub */}
        <button
          type="button"
          onClick={handleGoogleSignIn}
          className="w-full py-3 px-4 rounded-xl border border-[#D6CEBE] bg-[#FDFBF7] text-[#1C1917] text-xs font-semibold hover:bg-[#F8F5EE] transition-all flex items-center justify-center gap-2.5"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
          <span>Continue with Google</span>
        </button>

        <div className="relative flex items-center justify-center">
          <div className="w-full border-t border-[#E8E2D5]" />
          <span className="bg-white px-3 text-[11px] text-[#A8A29E] uppercase tracking-wider relative">
            Or magic link
          </span>
        </div>

        {/* Email Magic Link Form */}
        <form onSubmit={handleEmailSignIn} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#57534E] mb-1">
              Author Name (Optional)
            </label>
            <input
              type="text"
              placeholder="Jane Austen"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full p-3 rounded-xl border border-[#D6CEBE] text-xs text-[#1C1917] focus:outline-none focus:border-[#1C1917]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#57534E] mb-1">
              Email Address
            </label>
            <input
              type="email"
              required
              placeholder="author@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-3 rounded-xl border border-[#D6CEBE] text-xs text-[#1C1917] focus:outline-none focus:border-[#1C1917]"
            />
          </div>

          {error && (
            <p className="text-xs text-[#991B1B] bg-[#FEF2F2] p-2.5 rounded-lg border border-[#FCA5A5]">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3.5 rounded-xl bg-[#1C1917] text-[#F8F5EE] font-medium text-xs hover:bg-[#2E2824] transition-all flex items-center justify-center gap-2 shadow-sm"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Mail className="w-4 h-4" />
            )}
            <span>Sign In with Email</span>
          </button>
        </form>
      </div>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense
      fallback={
        <div className="py-20 text-center text-xs text-[#78716C]">
          Loading sign in...
        </div>
      }
    >
      <SignInContent />
    </Suspense>
  );
}
