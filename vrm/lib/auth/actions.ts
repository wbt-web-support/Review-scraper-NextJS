"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod/v4";
import { createClient } from "@vrm/lib/supabase/server";
import { HOME_FOR_ROLE, parseClaims } from "@vrm/lib/auth/claims";
import { IMPERSONATION_COOKIE } from "@vrm/lib/auth/dal";

const LoginSchema = z.object({
  email: z.email({ error: "Enter a valid email address." }).trim(),
  password: z.string().min(1, { error: "Enter your password." }),
});

export type LoginState = { error: string } | undefined;

export async function signIn(
  _prevState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = LoginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: "Enter a valid email and password." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);

  // Deliberately generic: a distinct "no such user" message would let anyone
  // enumerate which emails have accounts.
  if (error || !data.session) {
    return { error: "Invalid email or password." };
  }

  // Read the role from the token we were JUST issued. Pass the access token
  // explicitly rather than relying on getClaims() picking up cookies written
  // moments ago in this same request -- that ordering isn't guaranteed.
  const { data: claimsData } = await supabase.auth.getClaims(
    data.session.access_token,
  );
  const claims = claimsData?.claims
    ? parseClaims(claimsData.claims as unknown as Record<string, unknown>)
    : null;

  if (!claims?.role) {
    // Almost always means the custom access token hook isn't enabled in the
    // Supabase dashboard. Don't leave them in a half-authenticated state.
    await supabase.auth.signOut();
    return {
      error: "Your account has no role assigned. Contact an administrator.",
    };
  }

  // redirect() throws, so it must be the last statement and outside any
  // try/catch. In a Server Action it emits a 303.
  redirect(HOME_FOR_ROLE[claims.role]);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();

  // Clear the view-as cookie too. Otherwise a super admin who signs out and back
  // in lands straight in a tenant's dashboard with no memory of why.
  const cookieStore = await cookies();
  cookieStore.delete(IMPERSONATION_COOKIE);

  redirect("/video/login");
}
