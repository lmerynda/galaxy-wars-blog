// Temporary: switches the UI concept for this browser. Removed once a concept is chosen.
import { NextResponse } from "next/server";
import { isConcept } from "@/lib/concepts";
export async function GET(
  _: Request,
  { params }: { params: Promise<{ name: string }> },
) {
  const name = (await params).name;
  // Relative, so the cookie and the redirect stay on the same host.
  const response = new NextResponse(null, {
    status: 303,
    headers: { Location: "/" },
  });
  if (isConcept(name))
    response.cookies.set("concept", name, { path: "/", sameSite: "lax" });
  return response;
}
