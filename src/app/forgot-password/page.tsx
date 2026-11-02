"use client";

import { useState } from "react";
import Link from "next/link";
import { AuthCard, Field, Notice } from "../../components/auth/auth-card";
import { Button } from "../../components/ui/button";
import { useForgotPassword } from "../features/auth/hooks";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const forgot = useForgotPassword();

  return (
    <AuthCard title="Forgot your password?" subtitle="Enter your email and we'll send you a reset link.">
      {forgot.isSuccess ? (
        <Notice kind="success">{forgot.data.message} Check your inbox (and spam folder).</Notice>
      ) : (
        <form
          onSubmit={(e) => { e.preventDefault(); forgot.mutate({ email: email.trim() }); }}
          className="space-y-4"
        >
          <Field label="Email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          {forgot.isError && <Notice kind="error">{forgot.error.message}</Notice>}
          <Button type="submit" variant="primary" className="w-full" disabled={forgot.isPending}>
            {forgot.isPending ? "Sending…" : "Send reset link"}
          </Button>
        </form>
      )}
      <Link href="/login" className="block text-center text-xs font-semibold text-[#2c317b] hover:underline dark:text-[#f3ad1c]">
        ← Back to sign in
      </Link>
    </AuthCard>
  );
}