"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, ArrowRight, Lock, Mail } from "lucide-react";
import Image from "next/image";
import { useAuth } from "@/contexts/AuthContext";

const networkNodes = [
  { cx: 100, cy: 100, tx: 100, ty: 100, r: 2, delay: 0 },
  { cx: 300, cy: 100, tx: -100, ty: 100, r: 2, delay: -1 },
  { cx: 100, cy: 300, tx: 100, ty: -100, r: 2, delay: -2 },
  { cx: 300, cy: 300, tx: -100, ty: -100, r: 2, delay: -3 },
  { cx: 200, cy: 80, tx: 0, ty: 120, r: 1.5, delay: -1.5 },
  { cx: 200, cy: 320, tx: 0, ty: -120, r: 1.5, delay: -4.5 },
  { cx: 80, cy: 200, tx: 120, ty: 0, r: 1.5, delay: -2.5 },
  { cx: 320, cy: 200, tx: -120, ty: 0, r: 1.5, delay: -5.5 },
];

type NetworkNode = (typeof networkNodes)[number];
type PointerPoint = { x: number; y: number } | null;

const NETWORK_VIEWBOX_SIZE = 400;
const NODE_REPEL_RADIUS = 58;
const NODE_REPEL_STRENGTH = 13;

function getNodeRepelOffset(node: NetworkNode, pointer: PointerPoint) {
  if (!pointer) return { x: 0, y: 0 };

  const pathLengthSquared = node.tx * node.tx + node.ty * node.ty;
  const rawProgress =
    pathLengthSquared === 0
      ? 0
      : ((pointer.x - node.cx) * node.tx + (pointer.y - node.cy) * node.ty) /
        pathLengthSquared;
  const pathProgress = Math.min(1, Math.max(0, rawProgress));
  const nearestPathPoint = {
    x: node.cx + node.tx * pathProgress,
    y: node.cy + node.ty * pathProgress,
  };

  let awayX = nearestPathPoint.x - pointer.x;
  let awayY = nearestPathPoint.y - pointer.y;
  let distance = Math.hypot(awayX, awayY);

  if (distance > NODE_REPEL_RADIUS) return { x: 0, y: 0 };

  if (distance < 0.001) {
    const pathLength = Math.sqrt(pathLengthSquared) || 1;
    awayX = -node.ty / pathLength;
    awayY = node.tx / pathLength;
    distance = 1;
  } else {
    awayX /= distance;
    awayY /= distance;
  }

  const influence = (1 - distance / NODE_REPEL_RADIUS) ** 2;
  const offset = NODE_REPEL_STRENGTH * influence;

  return {
    x: awayX * offset,
    y: awayY * offset,
  };
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="currentColor"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="currentColor"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
        fill="currentColor"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="currentColor"
      />
    </svg>
  );
}

function NetworkSystemAnimation() {
  const [pointer, setPointer] = useState<PointerPoint>(null);

  return (
    <div
      className="relative flex aspect-square w-full max-w-[34rem] items-center justify-center opacity-80"
      onPointerMove={(event) => {
        const bounds = event.currentTarget.getBoundingClientRect();
        const size = Math.min(bounds.width, bounds.height);
        const offsetX = (bounds.width - size) / 2;
        const offsetY = (bounds.height - size) / 2;

        setPointer({
          x:
            ((event.clientX - bounds.left - offsetX) / size) *
            NETWORK_VIEWBOX_SIZE,
          y:
            ((event.clientY - bounds.top - offsetY) / size) *
            NETWORK_VIEWBOX_SIZE,
        });
      }}
      onPointerLeave={() => setPointer(null)}
      style={{
        maskImage: "radial-gradient(circle, black 40%, transparent 95%)",
        WebkitMaskImage: "radial-gradient(circle, black 40%, transparent 95%)",
      }}
    >
      <motion.svg
        className="h-full w-full"
        viewBox="0 0 400 400"
        xmlns="http://www.w3.org/2000/svg"
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
      >
        <circle cx="200" cy="200" r="1" className="fill-accent-violet opacity-25" />
        <g className="opacity-[0.06]">
          <line x1="100" y1="100" x2="300" y2="100" className="stroke-accent-violet" strokeWidth="0.5" />
          <line x1="100" y1="300" x2="300" y2="300" className="stroke-accent-violet" strokeWidth="0.5" />
          <line x1="100" y1="100" x2="100" y2="300" className="stroke-accent-violet" strokeWidth="0.5" />
          <line x1="300" y1="100" x2="300" y2="300" className="stroke-accent-violet" strokeWidth="0.5" />
          <line x1="80" y1="200" x2="320" y2="200" className="stroke-accent-violet" strokeWidth="0.5" />
          <line x1="200" y1="80" x2="200" y2="320" className="stroke-accent-violet" strokeWidth="0.5" />
        </g>
        {networkNodes.map((node) => {
          const repelOffset = getNodeRepelOffset(node, pointer);

          return (
            <motion.g
              key={`${node.cx}-${node.cy}`}
              animate={{
                x: [0, node.tx, 0],
                y: [0, node.ty, 0],
                opacity: [0.35, 1, 0.35],
              }}
              transition={{
                duration: 12,
                repeat: Infinity,
                ease: "easeInOut",
                delay: node.delay,
              }}
            >
              <motion.circle
                cx={node.cx}
                cy={node.cy}
                r={node.r}
                className="fill-accent-violet drop-shadow-[0_0_5px_var(--color-accent-violet)]"
                animate={{
                  x: repelOffset.x,
                  y: repelOffset.y,
                  scale: [1, 1.35, 1],
                }}
                transition={{
                  x: { type: "spring", stiffness: 90, damping: 22, mass: 0.35 },
                  y: { type: "spring", stiffness: 90, damping: 22, mass: 0.35 },
                  scale: {
                    duration: 12,
                    repeat: Infinity,
                    ease: "easeInOut",
                    delay: node.delay,
                  },
                }}
              />
            </motion.g>
          );
        })}
      </motion.svg>
    </div>
  );
}

export function AuthPage() {
  const { signInWithGoogle, signInWithEmail, signUpWithEmail } = useAuth();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const isLogin = mode === "login";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (isLogin) {
        await signInWithEmail(email, password);
      } else {
        await signUpWithEmail(email, password);
      }
    } catch (err: any) {
      const code = err?.code;
      if (code === "auth/invalid-credential" || code === "auth/user-not-found" || code === "auth/wrong-password") {
        setError("The email or password you entered is incorrect. Please check your credentials and try again.");
      } else if (code === "auth/invalid-email") {
        setError("Please enter a valid email address.");
      } else if (code === "auth/email-already-in-use") {
        setError("This email is already in use. Try signing in instead.");
      } else if (code === "auth/weak-password") {
        setError("Password should be at least 6 characters.");
      } else {
        setError(
          err instanceof Error
            ? err.message.replace("Firebase: ", "").replace(/\(auth\/.*\)/, "")
            : "Something went wrong"
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError("");
    try {
      await signInWithGoogle();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message.replace("Firebase: ", "").replace(/\(auth\/.*\)/, "")
          : "Something went wrong"
      );
    }
  };

  return (
    <main className="relative flex min-h-dvh flex-col overflow-hidden bg-void text-text-primary md:flex-row">
      <section className="relative hidden w-1/2 items-center justify-center overflow-hidden bg-abyss p-16 md:flex xl:p-24">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,var(--color-accent-violet-soft),transparent_38%)] opacity-35" />
        <div className="absolute left-12 top-12 z-10">
          <div className="flex items-center gap-2.5">
            <Image src="/icons/ctx_logo-512x512.png" alt="Logo" width={28} height={28} />
            <h1 className="text-2xl font-extrabold tracking-tighter text-text-primary">
              Context Window
            </h1>
          </div>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.28em] text-text-ghost">
            Capture. Review. Organize.
          </p>
        </div>
        <NetworkSystemAnimation />
        <p className="absolute bottom-12 left-12 font-mono text-[10px] uppercase tracking-[0.24em] text-text-ghost">
          Built for the nocturnal mind.
        </p>
      </section>

      <section className="relative flex min-h-dvh w-full items-center justify-center bg-surface px-6 py-10 md:min-h-0 md:w-1/2 md:px-16 xl:px-24">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute right-[-10rem] top-[-10rem] h-96 w-96 rounded-full bg-accent-violet-soft blur-[120px]" />
        </div>

        <div className="absolute left-0 top-8 w-full text-center md:hidden">
          <div className="flex items-center justify-center gap-2">
            <Image src="/icons/ctx_logo-512x512.png" alt="Logo" width={24} height={24} />
            <h1 className="text-xl font-extrabold tracking-tighter text-text-primary">
              Context Window
            </h1>
          </div>
          <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.24em] text-text-ghost">
            Capture. Triage. Organize.
          </p>
        </div>

        <motion.div
          key={mode}
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
          className="relative z-10 mt-16 w-full max-w-sm md:mt-0"
        >
          <header className="mb-10 space-y-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-accent-violet">
              {isLogin ? "Existing window" : "New window"}
            </p>
            <h2 className="text-4xl font-bold leading-tight tracking-tight text-text-primary">
              {isLogin ? "Welcome back." : "Create account."}
            </h2>
            <p className="text-sm leading-relaxed tracking-wide text-text-muted">
              {isLogin
                ? "Access your knowledge engine."
                : "Start capturing the links worth remembering."}
            </p>
          </header>

          <div className="space-y-6">
            <button
              type="button"
              onClick={handleGoogleSignIn}
              className="group flex h-12 w-full items-center justify-center gap-3 rounded-md border border-border-subtle/70 bg-transparent text-text-primary transition-all duration-300 hover:border-border-strong hover:bg-surface-raised"
            >
              <span className="transition-transform duration-300 group-hover:scale-110">
                <GoogleMark />
              </span>
              <span className="font-inter text-[10px] font-semibold uppercase tracking-[0.22em]">
                Continue with Google
              </span>
            </button>

            <div className="flex items-center gap-4">
              <div className="h-px flex-1 bg-border-subtle/50" />
              <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-text-ghost">
                or
              </span>
              <div className="h-px flex-1 bg-border-subtle/50" />
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="group space-y-1.5">
                <label
                  htmlFor="auth-email"
                  className="flex items-center gap-2 font-inter text-[10px] uppercase tracking-[0.22em] text-text-muted transition-colors group-focus-within:text-accent-violet"
                >
                  <Mail size={12} />
                  Email address
                </label>
                <input
                  id="auth-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full border-0 border-b border-border-subtle bg-transparent px-0 py-2 text-sm text-text-primary outline-none placeholder:text-text-ghost focus:border-accent-violet focus:ring-0"
                />
              </div>

              <div className="group space-y-1.5">
                <div className="flex items-end justify-between gap-4">
                  <label
                    htmlFor="auth-password"
                    className="flex items-center gap-2 font-inter text-[10px] uppercase tracking-[0.22em] text-text-muted transition-colors group-focus-within:text-accent-violet"
                  >
                    <Lock size={12} />
                    Password
                  </label>
                  {isLogin && (
                    <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-text-ghost">
                      Forgot Password
                    </span>
                  )}
                </div>
                <input
                  id="auth-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full border-0 border-b border-border-subtle bg-transparent px-0 py-2 text-sm text-text-primary outline-none placeholder:text-text-ghost focus:border-accent-violet focus:ring-0"
                />
              </div>

              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    className="flex items-start gap-2 border border-accent-rose-soft bg-accent-rose-soft px-3 py-2 text-xs text-accent-rose"
                  >
                    <AlertCircle size={14} className="mt-0.5 shrink-0" />
                    <span>{error}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              <button
                type="submit"
                disabled={loading}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-md bg-accent-violet text-xs font-bold uppercase tracking-[0.22em] text-void shadow-[0_24px_32px_-12px_rgba(14,14,14,0.65)] transition-all duration-300 hover:scale-[1.02] hover:brightness-110 active:scale-95 disabled:scale-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? (
                  <span className="h-4 w-4 rounded-full border-2 border-void/30 border-t-void animate-spin" />
                ) : (
                  <>
                    {isLogin ? "Sign in" : "Create account"}
                    <ArrowRight size={14} />
                  </>
                )}
              </button>
            </form>

            <div className="pt-3 text-center">
              <button
                type="button"
                onClick={() => {
                  setMode(isLogin ? "signup" : "login");
                  setError("");
                }}
                className="text-xs text-text-muted transition-colors hover:text-accent-violet"
              >
                {isLogin
                  ? "New to the window? Sign Up"
                  : "Already have access? Sign in"}
              </button>
            </div>
          </div>
        </motion.div>
      </section>
    </main>
  );
}
