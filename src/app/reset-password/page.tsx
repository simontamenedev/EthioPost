"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthCard, Field, Notice } from "../../components/auth/auth-card";
import { Button } from "../../components/ui/button";
import { useResetPassword } from "../features/auth/hooks";

function ResetForm() {
  const router = useRouter();
  const token = useSearchParams().get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const reset = useResetPassword();

  if (!token) return <Notice kind="error">This reset link is missing its token. Request a new one.</Notice>;

  if (reset.isSuccess) {
    return (
      <>
        <Notice kind="success">{reset.data.message}</Notice>
        <Button variant="primary" className="w-full" onClick={() => router.replace("/login")}>Go to sign in</Button>
      </>
    );
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (password.length < 8) return setLocalError("Password must be at least 8 characters");
        if (password !== confirm) return setLocalError("Passwords don't match");
        setLocalError(null);
        reset.mutate({ token, new_password: password });
      }}
    >
      <Field label="New password" type="password" required minLength={8} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
      <Field label="Confirm new password" type="password" required autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      {(localError || reset.isError) && <Notice kind="error">{localError ?? reset.error?.message}</Notice>}
      <Button type="submit" variant="primary" className="w-full" disabled={reset.isPending}>
        {reset.isPending ? "Saving…" : "Reset password"}
      </Button>
      {reset.isError && (
        <Link href="/forgot-password" className="block text-center text-xs font-semibold text-[#2c317b] hover:underline dark:text-[#f3ad1c]">
          Request a new link
        </Link>
      )}
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <AuthCard title="Choose a new password" subtitle="Use at least 8 characters.">
      <Suspense fallback={null}>
        <ResetForm />
      </Suspense>
    </AuthCard>
  );
}