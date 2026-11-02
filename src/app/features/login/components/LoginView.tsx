"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, LockKeyhole, Mail } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Logo } from "./brand-logo";
import { ThemeToggle } from "./theme-toggle";
import { item, stagger } from "../styles/login-motion";
import { Showcase } from "./login-showcase";
import { ImportDemo } from "./ImportDemo";
import { field, input, link } from "../styles/login-styles";
import { loginSchema, type LoginValues } from "../../auth/schema";
import { HOME_PATH } from "../../../../lib/auth/constants";
import { Spinner } from "../../../../components/ui/spinner";
import { useLogin } from "../../auth/hooks";


/** Only allow same-site relative redirects (blocks "//evil.com" style open redirects). */
function getRedirectTarget(): string {
  const next = new URLSearchParams(window.location.search).get("next");
  return next && next.startsWith("/") && !next.startsWith("//") ? next : HOME_PATH;
}

export default function LoginView() {
  const router = useRouter();
  const login = useLogin();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { identifier: "", password: "", remember: false },
  });

  const onSubmit = (values: LoginValues) =>
    login.mutate(values, { onSuccess: () => router.replace(getRedirectTarget()) });

  return (
    <main style={{ fontFamily: '"Archivo", "Noto Sans Ethiopic", system-ui, sans-serif' }} className="grid min-h-screen bg-white transition-colors dark:bg-[#0d1040] lg:grid-cols-[1.1fr_0.9fr]">
      {/* brand panel — Post Finance Blue, white logo, gold for emphasis */}
      <section className="relative hidden overflow-hidden bg-[#2c317b] px-10 pt-8 text-white dark:bg-[#161a5c] lg:flex lg:flex-col lg:justify-between xl:px-14">
        <Link href="/" aria-label="Post Finance home" className="relative z-10 inline-flex w-fit">
          <Logo variant="white" priority className="h-14" />
        </Link>

        <motion.div variants={stagger} initial="hidden" animate="show" className="relative z-10 max-w-[620px] py-6">
          <motion.h1 variants={item} className="archivo-headline text-3xl leading-[1.1] tracking-tight xl:text-4xl">
            Clear commissions.<br /><span className="text-[#f3ad1c]">Confident reporting</span><br />at every level.
          </motion.h1>
          <motion.p variants={item} className="mt-3 max-w-md text-sm leading-6 text-white/80">
            Drop in an Excel file and review commission data by agent, branch, and district.
          </motion.p>
          {/* ImportDemo is the first scene of the Showcase (Import → Dashboard → Reports) */}
          <motion.div variants={item} className="mt-6"><Showcase importDemo={<ImportDemo />} /></motion.div>
        </motion.div>

        {/* footer + motif band (official pattern, two-row variant, aspect ratio preserved) */}
        <div className="relative z-10 -mx-10 xl:-mx-14">
          <p className="px-10 pb-4 text-xs text-white/70 xl:px-14">© 2026 Post Finance. Serving every corner of Ethiopia.</p>
          <Image src="/brand/pattern-band-white.svg" alt="" aria-hidden width={1386} height={135} unoptimized draggable={false} className="block h-auto w-full opacity-[0.14]" />
        </div>
      </section>

      {/* form panel */}
      <section className="flex min-h-screen flex-col px-6 py-7 sm:px-12 lg:px-14 xl:px-20">
        <div className="flex items-center justify-between">
          {/* shown on small screens only; the brand panel carries the logo on lg+ */}
          <Link href="/" aria-label="Post Finance home" className="inline-flex lg:invisible">
            <span className="block dark:hidden"><Logo variant="primary" className="h-10" /></span>
            <span className="hidden dark:block"><Logo variant="white" className="h-10" /></span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/" className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 transition hover:text-[#2c317b] dark:text-white/70 dark:hover:text-[#f3ad1c]">
              <ArrowLeft size={15} /> <span className="hidden sm:inline">Back to home</span><span className="sm:hidden">Home</span>
            </Link>
            <ThemeToggle />
          </div>
        </div>

        <motion.div variants={stagger} initial="hidden" animate="show" className="mx-auto flex w-full max-w-[390px] flex-1 flex-col justify-center py-12">
          <motion.div variants={item} className="mb-8 flex size-12 items-center justify-center rounded-2xl bg-[#2c317b]/10 text-[#2c317b] dark:bg-[#f3ad1c]/15 dark:text-[#f3ad1c]">
            <LockKeyhole size={22} />
          </motion.div>
          <motion.p variants={item} className="text-sm font-semibold text-[#2c317b] dark:text-[#f3ad1c]">Welcome back</motion.p>
          <motion.h2 variants={item} className="mt-2 text-3xl font-bold tracking-tight text-[#2c317b] dark:text-white">Sign in to your account</motion.h2>
          <motion.p variants={item} className="mt-2 text-sm leading-6 text-slate-600 dark:text-white/70">Enter your details below to access your dashboard.</motion.p>

          <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-8 space-y-5">
            <motion.div variants={item}>
              <label htmlFor="identifier" className="mb-2 block text-sm font-semibold text-slate-800 dark:text-white">Email or username</label>
              <div className={field}>
                <Mail size={17} className="text-slate-500 dark:text-white/60" />
                <input
                  id="identifier"
                  type="text"
                  autoComplete="username"
                  placeholder="Enter your email or username"
                  aria-invalid={errors.identifier ? true : undefined}
                  aria-describedby={errors.identifier ? "identifier-error" : undefined}
                  className={input}
                  {...register("identifier")}
                />
              </div>
              {errors.identifier && <p id="identifier-error" role="alert" className="mt-1.5 text-xs font-medium text-red-600 dark:text-red-300">{errors.identifier.message}</p>}
            </motion.div>
            <motion.div variants={item}>
              <div className="mb-2 flex items-center justify-between gap-3">
                <label htmlFor="password" className="text-sm font-semibold text-slate-800 dark:text-white">Password</label>
                <Link href="/forgot-password" className="text-xs font-semibold text-[#2c317b] hover:underline dark:text-[#f3ad1c]">
  Forgot password?
</Link>
              </div>
              <div className={field}>
                <LockKeyhole size={17} className="text-slate-500 dark:text-white/60" />
                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  aria-invalid={errors.password ? true : undefined}
                  aria-describedby={errors.password ? "password-error" : undefined}
                  className={input}
                  {...register("password")}
                />
              </div>
              {errors.password && <p id="password-error" role="alert" className="mt-1.5 text-xs font-medium text-red-600 dark:text-red-300">{errors.password.message}</p>}
            </motion.div>
            <motion.label variants={item} className="flex items-center gap-2.5 text-sm text-slate-700 dark:text-white/80">
              <input type="checkbox" className="size-4 rounded border-slate-300 accent-[#2c317b] dark:accent-[#f3ad1c]" {...register("remember")} />
              Keep me signed in
            </motion.label>

            {login.isError && (
              <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-400/30 dark:bg-red-500/10 dark:text-red-200">
                {login.error.message}
              </p>
            )}

            {/* Gold = the one important action; blue text on gold keeps contrast (≈5.7:1) */}
            <motion.button
              variants={item}
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={login.isPending || login.isSuccess}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#f3ad1c] text-sm font-bold text-[#2c317b] shadow-sm transition hover:brightness-95 focus:outline-none focus-visible:ring-4 focus-visible:ring-[#2c317b]/30 disabled:cursor-not-allowed disabled:opacity-70 dark:focus-visible:ring-white/40"
            >
              {login.isPending || login.isSuccess ? <><Spinner size={16} /> Signing in…</> : <>Sign in <ArrowRight size={16} /></>}
            </motion.button>
          </form>

          <motion.div variants={item} className="mt-7 flex items-center gap-3 text-xs text-slate-500 dark:text-white/60">
            <span className="h-px flex-1 bg-slate-200 dark:bg-white/15" />Secure access<span className="h-px flex-1 bg-slate-200 dark:bg-white/15" />
          </motion.div>
          <motion.p variants={item} className="mt-5 text-center text-xs leading-5 text-slate-600 dark:text-white/70">
            Need help accessing your account? <button type="button" className={link}>Contact support</button>
          </motion.p>
        </motion.div>

        <p className="text-center text-[11px] text-slate-500 dark:text-white/60">By continuing, you agree to Post Finance&apos;s terms of service and privacy policy.</p>
      </section>
    </main>
  );
}
