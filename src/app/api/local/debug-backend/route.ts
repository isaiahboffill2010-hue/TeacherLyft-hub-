import { NextResponse } from "next/server";
import { isSameOrigin } from "@/lib/local-request";
import { probeTeacherLyft } from "@/lib/teacherlyft-api";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return NextResponse.json(await probeTeacherLyft(), {
    headers: { "Cache-Control": "no-store" },
  });
}
