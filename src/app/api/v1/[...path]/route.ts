import { handleApi } from "@/server/api";
export const runtime = "nodejs";
type Context = { params: Promise<{ path: string[] }> };
async function handle(request: Request, context: Context) {
  return handleApi(request, (await context.params).path);
}
export { handle as GET, handle as POST, handle as PUT };
