import { NextResponse } from "next/server";
import { disconnectLocalDevice } from "@/lib/local-device";
import { isSameOrigin } from "@/lib/local-request";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    await disconnectLocalDevice();
    return NextResponse.json({ state: "unpaired" });
  } catch {
    return NextResponse.json({ error: "Unable to remove the local device credential." }, { status: 500 });
  }
}
