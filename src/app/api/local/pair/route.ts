import { NextResponse } from "next/server";
import { LocalDeviceError, pairLocalDevice } from "@/lib/local-device";
import { isSameOrigin } from "@/lib/local-request";
import { TeacherLyftApiError } from "@/lib/teacherlyft-api";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  let body: { code?: unknown };
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Enter a valid six-digit code." }, { status: 400 });
  }
  const code = typeof body.code === "string" ? body.code : "";
  if (!/^\d{6}$/.test(code)) {
    return NextResponse.json({ error: "Enter all six digits before connecting." }, { status: 400 });
  }

  try {
    return NextResponse.json(await pairLocalDevice(code));
  } catch (error) {
    const diagnostic = error instanceof TeacherLyftApiError
      ? { kind: error.kind, message: error.message, ...error.details }
      : error instanceof LocalDeviceError
        ? {
            kind: error.kind,
            message: error.message,
            causeCode: error.causeCode,
            causeKind: error.cause instanceof TeacherLyftApiError ? error.cause.kind : undefined,
            causeStatus: error.cause instanceof TeacherLyftApiError ? error.cause.details.status : undefined,
          }
        : {
            kind: "unexpected",
            message: "Unhandled pairing error",
            causeCode: error && typeof error === "object" && "code" in error
              && typeof error.code === "string" ? error.code : undefined,
          };
    console.error("[local/pair] Pairing failed", diagnostic);
    if (error instanceof TeacherLyftApiError && error.kind === "invalid_code") {
      return NextResponse.json({ error: "That pairing code is invalid or has expired." }, { status: 400 });
    }
    if (error instanceof TeacherLyftApiError
        && (error.kind === "malformed_json" || error.kind === "malformed_response")) {
      return NextResponse.json({ error: "TeacherLyft could not complete pairing. Please try again." }, { status: 502 });
    }
    return NextResponse.json(
      { error: "Unable to reach TeacherLyft. Check your internet connection." },
      { status: 503 },
    );
  }
}
