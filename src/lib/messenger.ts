// src/lib/messenger.ts (نسخة كاملة)
const PAGE_TOKEN = process.env.FB_PAGE_ACCESS_TOKEN!;
const FB_API = `https://graph.facebook.com/v18.0/me/messages?access_token=${PAGE_TOKEN}`;

async function sendRequest(body: unknown) {
  const res = await fetch(FB_API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) console.error("Messenger API Error:", data);
  return data;
}

export async function sendText(senderId: string, text: string) {
  return sendRequest({
    recipient: { id: senderId },
    messaging_type: "RESPONSE",
    message: { text },
  });
}

export async function sendQuickReplies(
  senderId: string,
  text: string,
  replies: { content_type: "text"; title: string; payload: string }[]
) {
  return sendRequest({
    recipient: { id: senderId },
    messaging_type: "RESPONSE",
    message: { text, quick_replies: replies },
  });
}

export async function sendMainMenu(senderId: string) {
  return sendQuickReplies(senderId, "اختار من القائمة 👇", [
    { content_type: "text", title: "🛍️ منتجات", payload: "PRODUCTS" },
    { content_type: "text", title: "📦 اطلب الآن", payload: "ORDER" },
    { content_type: "text", title: "📞 تواصل", payload: "CONTACT" },
  ]);
}

export async function replyToComment(commentId: string, text: string) {
  const url = `https://graph.facebook.com/v18.0/${commentId}/comments?access_token=${PAGE_TOKEN}`;
  const res = await fetch(url, {
    method: "POST",
    body: JSON.stringify({ message: text }),
    headers: { "Content-Type": "application/json" },
  });
  return res.json();
}