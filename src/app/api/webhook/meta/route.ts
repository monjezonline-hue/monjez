import { NextRequest } from "next/server";
import { handleWebhook } from "@/lib/webhook/webhookHandler";

export const runtime = "nodejs";

// ===============================
// VERIFY WEBHOOK (GET)
// ===============================
export async function GET(req: Request) {
  const url = new URL(req.url);

  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  if (
    mode === "subscribe" &&
    token === process.env.FB_VERIFY_TOKEN
  ) {
    return new Response(challenge || "", { status: 200 });
  }

  return new Response("Forbidden", { status: 403 });
}

// ===============================
// MAIN WEBHOOK (POST)
// ===============================
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // 🔥 كل اللوجيك راح للـ handler
    await handleWebhook(body);

    return new Response("EVENT_RECEIVED", { status: 200 });
  } catch (error) {
    console.error("❌ Webhook Error:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}