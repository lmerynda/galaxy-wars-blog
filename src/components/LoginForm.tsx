"use client";
import { useActionState } from "react";
import { signIn } from "@/app/admin/actions";
export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(signIn, { error: "" });
  return (
    <form action={action} className="login-form">
      <input type="hidden" name="next" value={next} />
      <label htmlFor="password">Owner password</label>
      <input
        type="password"
        id="password"
        name="password"
        autoComplete="current-password"
        required
        maxLength={256}
        autoFocus
      />
      <p role="alert" className="form-error">
        {state.error}
      </p>
      <button className="button button-primary" disabled={pending}>
        {pending ? "Signing in…" : "Enter the studio →"}
      </button>
    </form>
  );
}
