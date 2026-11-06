import { healthResponse } from "@/server/health";
export const dynamic = "force-dynamic";
export function GET() {
  return healthResponse();
}
