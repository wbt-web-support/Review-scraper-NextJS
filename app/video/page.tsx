import { redirect } from "next/navigation";
import { getSessionClaims } from "@vrm/lib/auth/dal";
import { HOME_FOR_ROLE } from "@vrm/lib/auth/claims";

export default async function RootPage() {
  const claims = await getSessionClaims();
  redirect(claims?.role ? HOME_FOR_ROLE[claims.role] : "/video/login");
}
