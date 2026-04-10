// src/lib/followup.ts
import { sendTextMessage } from "./messenger";

// Store follow-ups timeouts
const followUpTimeouts = new Map<string, NodeJS.Timeout>();

export async function scheduleFollowUp(
  psid: string,
  delayMinutes: number = 5
) {
  // Clear existing timeout
  if (followUpTimeouts.has(psid)) {
    clearTimeout(followUpTimeouts.get(psid));
  }

  const timeout = setTimeout(async () => {
    followUpTimeouts.delete(psid);
    
    // Simple follow-up without database check
    // (The user state is checked in the webhook)
    await sendTextMessage(
      psid,
      "👋 لسه معانا؟\n\nلسه حابب تكمل الطلب؟ 😊\nاكتب 'عايز' عشان نكمل من حيث وقفت"
    );
  }, delayMinutes * 60 * 1000);

  followUpTimeouts.set(psid, timeout);
}

export function cancelFollowUp(psid: string) {
  if (followUpTimeouts.has(psid)) {
    clearTimeout(followUpTimeouts.get(psid));
    followUpTimeouts.delete(psid);
  }
}