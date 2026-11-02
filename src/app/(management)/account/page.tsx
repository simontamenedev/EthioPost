"use client";

import { useState } from "react";
import { useAuthStore } from "../../../lib/auth/auth-store";
import { useChangePassword, useUpdateProfile } from "../../features/auth/hooks";
import { Field, Notice } from "../../../components/auth/auth-card";
import { Button } from "../../../components/ui/button";


const card = "space-y-4 p-4 rounded-2xl border border-slate-200 bg-white p-6 dark:border-white/10 dark:bg-[#161a5c]";

function ProfileForm() {
  const user = useAuthStore((s) => s.user);
  const [name, setName] = useState(user?.name ?? "");
  const update = useUpdateProfile();

  return (
    <form onSubmit={(e) => { e.preventDefault(); update.mutate({ name }); }} className={card}>
      <h2 className="text-sm font-bold text-slate-900 dark:text-white">Profile</h2>
      <Field label="Name" required maxLength={150} value={name} onChange={(e) => setName(e.target.value)} />
      <Field label="Email" value={user?.email ?? ""} disabled readOnly />
      {update.isSuccess && <Notice kind="success">Name updated</Notice>}
      {update.isError && <Notice kind="error">{update.error.message}</Notice>}
      <Button type="submit" variant="primary" disabled={update.isPending || name.trim() === user?.name}>
        {update.isPending ? "Saving…" : "Save name"}
      </Button>
    </form>
  );
}

function PasswordForm() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const change = useChangePassword();

  return (
    <form
      className={card}
      onSubmit={(e) => {
        e.preventDefault();
        if (next !== confirm) return setLocalError("Passwords don't match");
        setLocalError(null);
        change.mutate(
          { current_password: current, new_password: next },
          { onSuccess: () => { setCurrent(""); setNext(""); setConfirm(""); } },
        );
      }}
    >
      <h2 className="text-sm font-bold text-slate-900 dark:text-white">Change password</h2>
      <Field label="Current password" type="password" required autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
      <Field label="New password" type="password" required minLength={8} autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
      <Field label="Confirm new password" type="password" required autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      {change.isSuccess && <Notice kind="success">{change.data.message}</Notice>}
      {(localError || change.isError) && <Notice kind="error">{localError ?? change.error?.message}</Notice>}
      <Button type="submit" variant="primary" disabled={change.isPending}>
        {change.isPending ? "Saving…" : "Change password"}
      </Button>
    </form>
  );
}

export default function AccountPage() {
  return (
    <div className="mx-auto max-w-xl space-y-5 px-5 py-7 sm:px-8">
      <h1 className="text-lg font-bold text-slate-900 dark:text-white">My account</h1>
      <ProfileForm />
      <PasswordForm />
    </div>
  );
}