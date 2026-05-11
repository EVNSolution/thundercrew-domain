import { redirect } from "next/navigation";

/**
 * Minimal-shell redirect — there is no standalone landing page in this
 * iteration; `/` immediately bounces to the operator's overview screen.
 */
export default function RootPage() {
  redirect("/overview");
}
