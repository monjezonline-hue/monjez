const PAGE_TOKEN = process.env.FB_PAGE_ACCESS_TOKEN;
/** Prefer numeric Page ID in path (some tokens fail with `me/messages`) */
const PAGE_ID = process.env.PAGE_ID?.trim();
const GRAPH_VER = process.env.FB_GRAPH_VERSION?.trim() || "v18.0";

const MESSAGES_PATH = PAGE_ID ? `${PAGE_ID}/messages` : "me/messages";

// =====================================================
// 🧠 Types
// =====================================================
type MessengerBody = Record<string, unknown>;

type CarouselProduct = {
  id: string;
  title: string;
  price: number;
  image?: string | null;
};

const tokenConfigured = Boolean(PAGE_TOKEN && PAGE_TOKEN.length > 20);
const tokenPrefix = PAGE_TOKEN ? `${PAGE_TOKEN.slice(0, 8)}…` : "(missing)";
console.log(
  "[messenger] FB_PAGE_ACCESS_TOKEN:",
  tokenConfigured ? "configured" : "MISSING",
  tokenConfigured ? `prefix=${tokenPrefix}` : "",
  "| messages path:",
  MESSAGES_PATH,
  "| graph:",
  GRAPH_VER
);

// =====================================================
// 🧠 Helper
// =====================================================
async function handleFacebookResponse(
  res: Response,
  context: string
): Promise<unknown> {
  const rawText = await res.text();
  let data: unknown = null;
  try {
    data = rawText ? JSON.parse(rawText) : null;
  } catch {
    console.error(
      `[messenger] ${context}: non-JSON body`,
      rawText?.slice(0, 500)
    );
    throw new Error(`Facebook API: invalid JSON (${res.status})`);
  }

  const obj = data as { error?: { message?: string; code?: number } } | null;
  if (!res.ok || obj?.error) {
    console.error(`[messenger] ${context}: HTTP ${res.status}`, data);
    throw new Error(
      obj?.error?.message || `Facebook API failed (${res.status})`
    );
  }

  return data;
}

/**
 * access_token via URLSearchParams (same as Meta curl examples; reliable for Page tokens).
 */
async function callMessengerAPI(body: MessengerBody, context: string) {
  if (!PAGE_TOKEN) {
    throw new Error("FB_PAGE_ACCESS_TOKEN is missing");
  }

  const u = new URL(
    `https://graph.facebook.com/${GRAPH_VER}/${MESSAGES_PATH}`
  );
  u.searchParams.set("access_token", PAGE_TOKEN);

  const isTyping = Boolean((body as { sender_action?: string }).sender_action);

  console.log(
    `[messenger] ${context}: POST ${MESSAGES_PATH} typing=${isTyping}`
  );

  const res = await fetch(u.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await handleFacebookResponse(res, context);
  console.log(`[messenger] ${context}: ok`, JSON.stringify(data));
  return data;
}

// =====================================================
// ⌨️ Typing (optional — avoid early typing_on: leaves UI stuck if send fails)
// =====================================================
export async function sendTyping(recipientId: string) {
  try {
    await callMessengerAPI(
      {
        recipient: { id: recipientId },
        sender_action: "typing_on",
      },
      "typing_on"
    );
  } catch (err) {
    console.error("[messenger] sendTyping error:", err);
  }
}

export async function sendTypingOff(recipientId: string) {
  try {
    await callMessengerAPI(
      {
        recipient: { id: recipientId },
        sender_action: "typing_off",
      },
      "typing_off"
    );
  } catch (err) {
    console.error("[messenger] sendTypingOff error:", err);
  }
}

/** Call before each real message so Messenger clears “typing…” if a previous step failed. */
async function beforeOutboundMessage(recipientId: string) {
  await sendTypingOff(recipientId);
}

const MAX_TEXT = 1999;

// =====================================================
// ✅ Text Message
// =====================================================
export async function sendTextMessage(recipientId: string, text: string) {
  const trimmed = text?.trim();
  if (!trimmed) {
    console.warn("[messenger] sendTextMessage: empty text, skip");
    return;
  }
  const safe = trimmed.length > MAX_TEXT ? trimmed.slice(0, MAX_TEXT) : trimmed;
  try {
    await beforeOutboundMessage(recipientId);
    await callMessengerAPI(
      {
        recipient: { id: recipientId },
        messaging_type: "RESPONSE",
        message: { text: safe },
      },
      "sendTextMessage"
    );
  } catch (err) {
    console.error("[messenger] sendTextMessage error:", err);
    await sendTypingOff(recipientId);
  }
}

// =====================================================
// ✅ Quick Replies
// =====================================================
export async function sendQuickReplies(recipientId: string) {
  try {
    await beforeOutboundMessage(recipientId);
    await callMessengerAPI(
      {
        recipient: { id: recipientId },
        messaging_type: "RESPONSE",
        message: {
          text: "تحب تعمل إيه؟ 👇",
          quick_replies: [
            {
              content_type: "text",
              title: "🛍️ اطلب الآن",
              payload: "ORDER",
            },
            {
              content_type: "text",
              title: "📦 المنتجات",
              payload: "PRODUCTS",
            },
            {
              content_type: "text",
              title: "📞 تواصل",
              payload: "CONTACT",
            },
          ],
        },
      },
      "sendQuickReplies"
    );
  } catch (err) {
    console.error("[messenger] sendQuickReplies error:", err);
    await sendTypingOff(recipientId);
  }
}

// =====================================================
// 🛍️ Product Carousel (FIXED payload for "Order Now")
// =====================================================
export async function sendProductCarousel(
  recipientId: string,
  products: CarouselProduct[]
) {
  try {
    if (!products.length) {
      await sendTextMessage(recipientId, "مفيش منتجات حالياً 😅");
      return;
    }

    const elements = products.slice(0, 10).map((p) => ({
      title: p.title,
      subtitle: `${p.price} جنيه`,
      image_url:
        p.image || "https://via.placeholder.com/300x300?text=Product",
      buttons: [
        {
          type: "postback",
          title: "🛍️ اطلب الآن",
          payload: `ORDER_NOW_${p.id}`,   // ✅ التصحيح: الآن يبدأ بـ ORDER_NOW_
        },
      ],
    }));

    await beforeOutboundMessage(recipientId);
    await callMessengerAPI(
      {
        recipient: { id: recipientId },
        messaging_type: "RESPONSE",
        message: {
          attachment: {
            type: "template",
            payload: {
              template_type: "generic",
              elements,
            },
          },
        },
      },
      "sendProductCarousel"
    );
  } catch (err) {
    console.error("[messenger] sendProductCarousel error:", err);
    await sendTypingOff(recipientId);
  }
}

// =====================================================
// 💬 Reply to Comment
// =====================================================
export async function replyToComment(commentId: string, message: string) {
  try {
    if (!PAGE_TOKEN) {
      throw new Error("FB_PAGE_ACCESS_TOKEN is missing");
    }

    const u = new URL(
      `https://graph.facebook.com/${GRAPH_VER}/${commentId}/comments`
    );
    u.searchParams.set("access_token", PAGE_TOKEN);
    console.log("[messenger] replyToComment: POST");

    const res = await fetch(u.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });

    await handleFacebookResponse(res, "replyToComment");
  } catch (err) {
    console.error("[messenger] replyToComment error:", err);
  }
}