import { LoginForm } from "@/components/LoginForm";
import Link from "next/link";
import { safeAdminPath } from "@/server/http";
export const dynamic = "force-dynamic";
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  return (
    <section className="hud-panel login-panel">
      <p className="panel-title">Owner studio</p>
      <h1>Sign in</h1>
      <p className="lede">Write, edit and moderate development updates.</p>
      <LoginForm next={safeAdminPath((await searchParams).next ?? "")} />
      <Link href="/" className="back-link">
        Back to the public log
      </Link>
    </section>
  );
}
