import { useState } from 'react';
import { BookOpen, ShieldCheck, Sparkles, MessageSquare, History, ArrowRight, X, ExternalLink } from 'lucide-react';

interface AuthLandingProps {
  onSignIn: () => Promise<void>;
  isLoading: boolean;
  error?: string | null;
  onDismissError?: () => void;
}

export function AuthLanding({ onSignIn, isLoading, error, onDismissError }: AuthLandingProps) {
  const [signingIn, setSigningIn] = useState(false);

  const handleSignInClick = async () => {
    try {
      setSigningIn(true);
      await onSignIn();
    } finally {
      setSigningIn(false);
    }
  };

  return (
    <div
      id="auth-landing-container"
      className="min-h-[calc(100vh-65px)] flex flex-col justify-center items-center px-4 py-12 bg-[#f8f7f2] dark:bg-[#161514]"
    >
      <div className="max-w-xl w-full mx-auto text-center space-y-8">
        {/* Emblem */}
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#2d2d2a] dark:bg-[#282521] text-[#f8f7f2] dark:text-[#deb887] shadow-sm ring-1 ring-[#dedcd5] dark:ring-[#36332e]">
          <BookOpen className="w-8 h-8 text-[#deb887]" />
        </div>

        {/* Title & Philosophy */}
        <div className="space-y-3">
          <h1 className="font-serif text-3xl sm:text-4xl text-[#2d2d2a] dark:text-[#f4efe6] font-semibold tracking-tight">
            Reflections Journal
          </h1>
          <p className="text-base sm:text-lg text-[#6f6e69] dark:text-[#c5bfb4] leading-relaxed max-w-lg mx-auto">
            A quiet, authenticated space for your deepest thoughts, guided reflections, and continuous multi-turn conversations with Gemini 3.6 Flash.
          </p>
        </div>

        {/* Core Guarantees & Features */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-left pt-2">
          <div className="p-4 rounded-xl bg-white dark:bg-[#1e1c1a] border border-[#e5e4de] dark:border-[#36332e] shadow-xs">
            <div className="flex items-center gap-2.5 text-[#2d2d2a] dark:text-[#f4efe6] font-medium text-sm mb-1.5">
              <ShieldCheck className="w-4 h-4 text-[#3b4c3a] dark:text-[#86efac]" />
              <span>Isolated Firestore Database</span>
            </div>
            <p className="text-xs text-[#6f6e69] dark:text-[#c5bfb4] leading-normal">
              Protected by owner-bound Firestore security rules. Your journal entries can only ever be read or written by you.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-white dark:bg-[#1e1c1a] border border-[#e5e4de] dark:border-[#36332e] shadow-xs">
            <div className="flex items-center gap-2.5 text-[#2d2d2a] dark:text-[#f4efe6] font-medium text-sm mb-1.5">
              <Sparkles className="w-4 h-4 text-[#c48344] dark:text-[#deb887]" />
              <span>Gemini 3.6 Flash Intelligence</span>
            </div>
            <p className="text-xs text-[#6f6e69] dark:text-[#c5bfb4] leading-normal">
              Engage in multi-turn dialogues for insightful self-discovery, thematic summaries, and constructive brainstorming.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-white dark:bg-[#1e1c1a] border border-[#e5e4de] dark:border-[#36332e] shadow-xs">
            <div className="flex items-center gap-2.5 text-[#2d2d2a] dark:text-[#f4efe6] font-medium text-sm mb-1.5">
              <MessageSquare className="w-4 h-4 text-[#78513b] dark:text-[#deb887]" />
              <span>Multi-Turn Dialogue</span>
            </div>
            <p className="text-xs text-[#6f6e69] dark:text-[#c5bfb4] leading-normal">
              Dive deeper with follow-up responses. Unpack complex emotions step-by-step rather than a one-off prompt.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-white dark:bg-[#1e1c1a] border border-[#e5e4de] dark:border-[#36332e] shadow-xs">
            <div className="flex items-center gap-2.5 text-[#2d2d2a] dark:text-[#f4efe6] font-medium text-sm mb-1.5">
              <History className="w-4 h-4 text-[#8c5b3e] dark:text-[#deb887]" />
              <span>Persistent History</span>
            </div>
            <p className="text-xs text-[#6f6e69] dark:text-[#c5bfb4] leading-normal">
              Every reflection session is stored securely so you can search, revisit, and build upon past breakthroughs anytime.
            </p>
          </div>
        </div>

        {/* Error notification if sign-in fails */}
        {error && (
          <div
            id="auth-error-banner"
            className="p-3.5 bg-[#fcf3f2] dark:bg-[#381816] border border-[#f5c6c2] dark:border-[#5a2420] text-[#9c2b23] dark:text-[#f87171] text-xs rounded-xl text-left flex items-start justify-between gap-3 shadow-xs animate-in fade-in"
          >
            <div className="space-y-1">
              <p>
                <strong>Sign-in Notice:</strong> {error}
              </p>
              {error.toLowerCase().includes('popup') && (
                <p className="text-[11px] text-[#b9382e] dark:text-[#fca5a5] flex items-center gap-1 mt-1">
                  <span>Tip: If popups are blocked in the preview, try</span>
                  <a
                    href={window.location.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-0.5 underline font-medium hover:text-[#7f1d1d] dark:hover:text-white"
                  >
                    opening in a new tab <ExternalLink className="w-3 h-3" />
                  </a>
                </p>
              )}
            </div>
            {onDismissError && (
              <button
                id="dismiss-auth-error-btn"
                type="button"
                onClick={onDismissError}
                className="p-1 hover:bg-black/5 dark:hover:bg-white/10 rounded-md text-[#9c2b23] dark:text-[#f87171] cursor-pointer shrink-0 transition-colors"
                title="Dismiss"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        )}

        {/* Action Button: Google Sign In */}
        <div className="pt-2 flex flex-col items-center gap-3">
          <button
            id="google-sign-in-btn"
            onClick={handleSignInClick}
            disabled={isLoading || signingIn}
            className="w-full sm:w-auto min-w-[280px] inline-flex items-center justify-center gap-3 px-6 py-3.5 bg-[#2d2d2a] hover:bg-[#42413d] dark:bg-[#deb887] dark:hover:bg-[#e8c799] text-[#f8f7f2] dark:text-[#161514] font-medium text-sm rounded-xl transition-all shadow-sm hover:shadow-md active:scale-98 disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
          >
            {isLoading || signingIn ? (
              <>
                <div className="w-4 h-4 border-2 border-[#deb887] dark:border-[#161514] border-t-transparent rounded-full animate-spin" />
                <span>Connecting securely...</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                  />
                </svg>
                <span>Sign In with Google</span>
                <ArrowRight className="w-4 h-4 ml-1 text-[#888780] dark:text-[#161514]" />
              </>
            )}
          </button>
          <p className="text-[11px] text-[#6f6e69] dark:text-[#958f84]">
            Sign in is handled via Google Identity. No passwords are stored on this service.
          </p>
        </div>
      </div>
    </div>
  );
}
