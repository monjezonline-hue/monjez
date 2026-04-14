// src/lib/webhook/webhookHandler.ts
import { WebhookBody } from "./types";
import { handleComment } from "./handlers/commentHandler";
import { handleMessage } from "./handlers/messageHandler";

export async function handleWebhook(body: WebhookBody) {
  const entry = body.entry?.[0];
  if (!entry) return;

  if (entry.changes && entry.changes.length > 0) {
    const change = entry.changes[0];
    if (change.field === "feed") {
      await handleComment(change);
      return;
    }
  }

  if (entry.messaging && entry.messaging.length > 0) {
    const messaging = entry.messaging[0];
    await handleMessage(messaging);
    return;
  }
}