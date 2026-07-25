"use client";

import { useActionState } from "react";
import { signIn, type LoginState } from "@vrm/lib/auth/actions";
import { Button } from "@vrm/components/ui/button";
import { Input } from "@vrm/components/ui/input";

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(
    signIn,
    undefined,
  );

  return (
    <form action={action} className="space-y-5">
      <Input
        id="email"
        name="email"
        type="email"
        label="Email"
        autoComplete="email"
        required
      />
      <Input
        id="password"
        name="password"
        type="password"
        label="Password"
        autoComplete="current-password"
        required
      />

      {state?.error && (
        <p
          role="alert"
          className="rounded-field bg-red-50 px-3.5 py-2.5 text-sm text-red-800"
        >
          {state.error}
        </p>
      )}

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
