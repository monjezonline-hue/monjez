import { prisma } from "./prisma";

// 🔒 Types ثابتة (مهم جدًا)
export type EventType =
  | "MESSAGE"
  | "COMMENT"
  | "START_ORDER"
  | "ORDER_CREATED"
  | "ERROR";

type TrackEventInput = {
  type: EventType;
  userId?: string;
  productId?: string;
};

export async function trackEvent({
  type,
  userId,
  productId,
}: TrackEventInput): Promise<void> {
  try {
    await prisma.eventLog.create({
      data: {
        type,
        userId: userId ?? null,
        productId: productId ?? null,
      },
    });
  } catch (error) {
    // ❌ ميوقعش البوت
    console.error("❌ Tracking Error:", error);
  }
}