import { signOut } from "@vrm/lib/auth/actions";
import { Button } from "@vrm/components/ui/button";

/**
 * Server component. A plain <form action={serverAction}> needs no client JS, and
 * a mutation must never be triggered by rendering (e.g. a ?logout=1 searchParam).
 */
export function SignOutButton() {
  return (
    <form action={signOut}>
      <Button type="submit" variant="ghost" className="px-3 py-1.5">
        Sign out
      </Button>
    </form>
  );
}
