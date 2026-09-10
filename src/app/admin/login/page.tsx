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
    <section className="login-panel panel">
      <span className="brand-icon">✳</span>
      <p className="eyebrow">Behind the scenes</p>
      <h1>Owner studio.</h1>
      <p className="lede">A quiet space to document the next change.</p>
      <LoginForm next={safeAdminPath((await searchParams).next ?? "")} />
      <Link href="/" className="back-link">
        ← Back to the public log
      </Link>
    </section>
  );
}
