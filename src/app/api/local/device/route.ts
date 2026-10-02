import { NextResponse } from "next/server";
import { getLocalDeviceState } from "@/lib/local-device";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await getLocalDeviceState(), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json(
      { state: "offline", paired: false },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
