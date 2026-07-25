import { redirect } from "next/navigation";

/**
 * Creating a tenant is a dialog on /admin now -- a whole page navigation for one
 * short form was a needless trip away from the list you were just looking at.
 *
 * Kept as a redirect rather than deleted, so any bookmark still lands somewhere sane.
 */
export default function NewTenantRedirect() {
  redirect("/video/admin");
}
