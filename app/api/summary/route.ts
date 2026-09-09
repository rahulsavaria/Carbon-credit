import { NextResponse } from "next/server";
import { getSummary } from "@/lib/cache";
import { readOptions } from "@/lib/params";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const raw: Record<string, string> = {};
  url.searchParams.forEach((v, k) => {
    raw[k] = v;
  });
  const opts = readOptions(raw);
  const data = await getSummary(opts);
  const failed = "error" in data;
  return NextResponse.json(data, {
    status: failed ? 404 : 200,
    headers: { "Cache-Control": "no-store" },
  });
}
