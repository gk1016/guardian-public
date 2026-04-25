import { NextResponse } from "next/server";
import { requireMobileSession } from "@/lib/mobile-auth";

/**
 * GET /api/m/chat/sessions
 * Stub — chat sessions are not persisted yet.
 * Returns an empty list. Will be populated once chat
 * message storage is added to the schema.
 */
export async function GET(request: Request) {
  const session = await requireMobileSession(request);
  if (session instanceof NextResponse) return session;

  return NextResponse.json({ sessions: [] });
}
