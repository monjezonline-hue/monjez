import { OrderStatus } from "@prisma/client";
import {
  sendTextMessage,
  replyToComment,
  sendProductCarousel,
  sendQuickReplies,
} from "../../../../lib/messenger";

import { NextRequest } from "next/server";
import {
  generateReply,
  generateSmartReply,
  detectProductFromText,
  type SmartReply,
} from "../../../../lib/ai";
import { prisma } from "../../../../lib/prisma";
import { trackEvent } from "../../../../lib/tracker";
import { appendOrderToSheet } from "../../../../lib/googleSheets";
import fs from "fs";
import path from "path";

export const runtime = "nodejs";

// =====================================================
// TYPES
// =====================================================
type Product = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  image: string | null;
  userId: string;
};

type OrderState = {
  step: string;
  collected: {
    name?: string;
    phone?: string;
    address?: string;
    city?: string;
  };
  productId?: string | null;
  locked?: boolean;
  completed?: boolean;
  lastOrderId?: string | null;
};

// =====================================================
// STATE
// =====================================================
const fallbackState = new Map<string, OrderState>();
const processedMessages = new Map<string, number>();
const commentProductMemory = new Map<string, string>();
const followUpTimeouts = new Map<string, NodeJS.Timeout>();

let productsCache: Product[] = [];
let lastProductFetch = 0;
const PRODUCT_CACHE_TTL = 60_000;

const DEFAULT_SHOP_USER_ID =
  process.env.SHOP_DEFAULT_USER_ID ?? "c1a2b3c4-1111-2222-3333-abcdef123456";

const CITIES = [
  "طرابلس", "بنغازي", "مصراتة", "الزاوية", "سبها",
  "البيضاء", "زليتن", "اجدابيا", "الخمس", "درنة",
  "طبرق", "غريان", "صبراتة", "سرت", "تاجوراء",
  "القاهرة", "الإسكندرية", "الجيزة", "السادس من أكتوبر",
  "الشيخ زايد", "بورسعيد", "السويس", "المنصورة", "المحلة", "طنطا",
  "أسوان", "الأقصر", "أسيوط", "سوهاج", "قنا", "الفيوم", "بنى سويف",
  "المنيا", "الإسماعيلية", "دمياط", "الغردقة", "شرم الشيخ",
  "غير محدد",
];

// =====================================================
// HELPERS
// =====================================================
function normalizeText(text: string): string {
  return text.trim().toLowerCase();
}

function hasAnyKeyword(text: string, keywords: string[]): boolean {
  const normalized = normalizeText(text);
  return keywords.some((keyword) => normalized.includes(normalizeText(keyword)));
}

function isStartIntent(text: string): boolean {
  return hasAnyKeyword(text, ["عايز", "اطلب", "طلب", "ابدأ", "ابدأ الطلب", "عاوز"]);
}

function isConfirmMessage(text: string): boolean {
  return ["نعم", "yes", "تمام", "ايوه", "أيوه", "ok"].includes(normalizeText(text));
}

function isCancelOrEditMessage(text: string): boolean {
  return ["لا", "no", "الغاء", "إلغاء", "تعديل", "رجوع", "back"].includes(normalizeText(text));
}

function normalizePhoneNumber(phone: string): string {
  let cleaned = phone.replace(/[\s\-\(\)]/g, "");
  if (cleaned.startsWith("+")) cleaned = cleaned.slice(1);
  if (cleaned.startsWith("002")) cleaned = cleaned.slice(3);
  if (cleaned.startsWith("218") && cleaned.length === 12) cleaned = "0" + cleaned.slice(3);
  if (cleaned.startsWith("20") && cleaned.length === 11) cleaned = "0" + cleaned.slice(2);
  if (cleaned.length === 9 && !cleaned.startsWith("0")) cleaned = "0" + cleaned;
  return cleaned;
}

function isValidPhoneNumber(text: string): boolean {
  const cleaned = text.replace(/\s/g, "");
  return /^09[0-9]{8}$/.test(cleaned) || /^01[0-9]{9}$/.test(cleaned) || /^[0-9]{10,11}$/.test(cleaned);
}

function isValidName(text: string): boolean {
  const trimmed = text.trim();
  return trimmed.length >= 3 && trimmed.length <= 50;
}

function isValidAddress(text: string): boolean {
  const trimmed = text.trim();
  return trimmed.length >= 5 && trimmed.length <= 200;
}

function isPurePhoneNumber(text: string): boolean {
  const cleaned = text.replace(/[\s\-\(\)]/g, "");
  return /^[0-9]{10,15}$/.test(cleaned);
}

function findMatchingCity(text: string): string | null {
  const normalized = normalizeText(text);
  return CITIES.find((city) => normalizeText(city) === normalized) || null;
}

// =====================================================
// STATE MANAGEMENT
// =====================================================
async function getUserStateSafe(senderId: string): Promise<OrderState | null> {
  try {
    const session = await prisma.userSession.findUnique({
      where: { userId: senderId },
    });
    if (session?.state) {
      return JSON.parse(session.state) as OrderState;
    }
  } catch (dbError) {
    console.error("DB error in getUserStateSafe:", dbError);
  }
  return fallbackState.get(senderId) || null;
}

async function setUserStateSafe(senderId: string, state: OrderState | null) {
  if (state === null) {
    fallbackState.delete(senderId);
  } else {
    fallbackState.set(senderId, state);
  }
  try {
    if (state === null) {
      await prisma.userSession.deleteMany({ where: { userId: senderId } });
    } else {
      await prisma.userSession.upsert({
        where: { userId: senderId },
        update: { state: JSON.stringify(state), updatedAt: new Date() },
        create: { userId: senderId, state: JSON.stringify(state) },
      });
    }
  } catch (dbError) {
    console.error("DB error in setUserStateSafe:", dbError);
  }
}

// =====================================================
// PRODUCTS CACHE
// =====================================================
async function safeGetProducts(): Promise<Product[]> {
  if (productsCache.length && Date.now() - lastProductFetch < PRODUCT_CACHE_TTL) {
    return productsCache;
  }
  try {
    productsCache = await prisma.product.findMany();
    lastProductFetch = Date.now();
    return productsCache;
  } catch (error) {
    console.error("❌ DB products error:", error);
    return productsCache.length ? productsCache : [];
  }
}

// =====================================================
// FOLLOW-UP
// =====================================================
async function scheduleFollowUp(senderId: string, delayMinutes: number = 5) {
  if (followUpTimeouts.has(senderId)) {
    clearTimeout(followUpTimeouts.get(senderId));
  }
  const timeout = setTimeout(async () => {
    followUpTimeouts.delete(senderId);
    const state = await getUserStateSafe(senderId);
    if (state && state.step !== "confirm" && state.completed !== true) {
      await sendTextMessage(
        senderId,
        "👋 لسه معانا؟\n\nلسه حابب تكمل الطلب؟ 😊\nاكتب 'عايز' عشان نكمل من حيث وقفت"
      );
    }
  }, delayMinutes * 60 * 1000);
  followUpTimeouts.set(senderId, timeout);
}

function cancelFollowUp(senderId: string) {
  if (followUpTimeouts.has(senderId)) {
    clearTimeout(followUpTimeouts.get(senderId));
    followUpTimeouts.delete(senderId);
  }
}

// =====================================================
// LOGGING
// =====================================================
async function logInboundEvent(opts: { psid: string; body: string; source: string }) {
  try {
    await prisma.eventLog.create({
      data: { userId: opts.psid, type: opts.source, productId: null },
    });
  } catch (error) {
    console.error("❌ Failed to log event:", error);
  }
}

// =====================================================
// BACKUP
// =====================================================
async function appendBackupOrder(payload: Record<string, unknown>) {
  try {
    const backupDir = path.join(process.cwd(), "backups");
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    const backupPath = path.join(backupDir, "orders-backup.json");
    fs.appendFileSync(
      backupPath,
      JSON.stringify({
        ...payload,
        timestamp: new Date().toISOString(),
      }) + "\n"
    );
  } catch (backupError) {
    console.error("Failed to save backup:", backupError);
  }
}

// =====================================================
// SMART REPLY
// =====================================================
async function getSmartReplyWithTimeout(messageText: string): Promise<SmartReply | null> {
  try {
    const aiPromise = generateSmartReply([{ role: "user", content: messageText }]);
    const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000));
    return await Promise.race([aiPromise, timeoutPromise]);
  } catch (error) {
    console.error("AI Error:", error);
    return null;
  }
}

// =====================================================
// ORDER CREATION
// =====================================================
async function safeCreateOrder(data: {
  customerName: string;
  phone: string;
  address: string;
  city: string | null;
  userId: string;
  productId: string | null;
  source: string;
  status: OrderStatus;
}) {
  try {
    await prisma.user.upsert({
      where: { id: data.userId },
      update: {},
      create: { id: data.userId, name: "Default Shop Owner" },
    });
    let finalProductId = data.productId;
    if (finalProductId) {
      const productExists = await prisma.product.findUnique({
        where: { id: finalProductId },
        select: { id: true },
      });
      if (!productExists) finalProductId = null;
    }
    const order = await prisma.order.create({ data: { ...data, productId: finalProductId } });
    return order;
  } catch (error: unknown) {
    console.error("❌ CRITICAL DB error in safeCreateOrder:", error);
    await appendBackupOrder({ ...data, error: error instanceof Error ? error.message : String(error) });
    return null;
  }
}

// =====================================================
// MESSAGES
// =====================================================
async function sendConfirmationMessage(senderId: string, state: OrderState) {
  const product = state.productId ? productsCache.find((p) => p.id === state.productId) : null;
  const message =
    `📋 **تأكيد بيانات الطلب**\n\n` +
    `👤 **الاسم:** ${state.collected.name || "❌"}\n` +
    `📱 **رقم الموبايل:** ${state.collected.phone || "❌"}\n` +
    `🏠 **العنوان:** ${state.collected.address || "❌"}\n` +
    `🏙️ **المدينة:** ${state.collected.city || "❌"}\n` +
    (product ? `🛍️ **المنتج:** ${product.name}\n💰 **السعر:** ${product.price} ج.م\n` : "") +
    `\n✅ **لو البيانات صحيحة** اكتب "نعم"\n` +
    `✏️ **لو عايز تعدل** اكتب "تعديل"\n` +
    `❌ **لو عايز تلغي** اكتب "إلغاء"`;
  await sendTextMessage(senderId, message);
}

async function sendCitySelection(senderId: string) {
  const quickReplies = CITIES.slice(0, 13).map((city) => ({
    content_type: "text" as const,
    title: city,
    payload: `CITY_${city}`,
  }));
  // إرسال الأزرار السريعة عبر واجهة Messenger API مباشرة لأن sendQuickReplies لا تأخذ معامل ثانٍ
  await fetch(`https://graph.facebook.com/v18.0/me/messages?access_token=${process.env.FB_PAGE_ACCESS_TOKEN}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      recipient: { id: senderId },
      messaging_type: "RESPONSE",
      message: {
        text: "🏙️ اختر مدينتك من القائمة 👇",
        quick_replies: quickReplies,
      },
    }),
  });
}

// =====================================================
// WEBHOOK VERIFY
// =====================================================
export async function GET(req: Request) {
  const url = new URL(req.url);
  if (
    url.searchParams.get("hub.mode") === "subscribe" &&
    url.searchParams.get("hub.verify_token") === process.env.FB_VERIFY_TOKEN
  ) {
    return new Response(url.searchParams.get("hub.challenge") || "", { status: 200 });
  }
  return new Response("Forbidden", { status: 403 });
}

// =====================================================
// MAIN POST HANDLER
// =====================================================
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const entry = body.entry?.[0];

    // ===== COMMENTS =====
    if (entry?.changes?.length) {
      const change = entry.changes[0];
      if (change?.field === "feed" && change.value?.comment_id) {
        const comment = String(change.value.message || "");
        const commentId = String(change.value.comment_id);
        const senderId = change.value.from?.id ? String(change.value.from.id) : null;
        if (senderId && senderId !== process.env.PAGE_ID) {
          try {
            productsCache = await safeGetProducts();
            const detectedId = await detectProductFromText(
              comment,
              productsCache.map((p) => ({ id: p.id, name: p.name }))
            );
            if (detectedId) commentProductMemory.set(senderId, detectedId);
            await replyToComment(commentId, `تمام 🙌 كلمنا خاص 👇\nhttps://m.me/Monjezai`);
          } catch (error) {
            console.error("Comment handling failed:", error);
          }
        }
      }
      return new Response("EVENT_RECEIVED");
    }

    // ===== MESSENGER =====
    const messaging = entry?.messaging?.[0];
    const senderId = messaging?.sender?.id ? String(messaging.sender.id) : null;
    const messageText = messaging?.message?.text ? String(messaging.message.text) : "";
    const payload = messaging?.postback?.payload || messaging?.message?.quick_reply?.payload;
    const payloadText = payload ? String(payload) : "";

    if (!senderId || messaging?.message?.is_echo) return new Response("EVENT_RECEIVED");

    const messageId = messaging?.message?.mid || `${senderId}_${messageText || payloadText || "unknown"}`;
    if (processedMessages.has(messageId)) return new Response("EVENT_RECEIVED");
    processedMessages.set(messageId, Date.now());
    setTimeout(() => processedMessages.delete(messageId), 60_000);

    await trackEvent({ type: "MESSAGE", userId: senderId });
    if (messageText.trim()) await logInboundEvent({ psid: senderId, body: messageText, source: "messenger_inbound" });

    productsCache = await safeGetProducts();
    let state = await getUserStateSafe(senderId);

    // ===== RESTART AFTER COMPLETION =====
    if (state?.completed) {
      if (isStartIntent(messageText) || payloadText === "ORDER") {
        await setUserStateSafe(senderId, null);
        state = null;
      } else {
        await sendTextMessage(senderId, "✅ تم استلام طلبك. اكتب 'عايز' لو حبيت تبدأ طلب جديد.");
        await sendQuickReplies(senderId);
        return new Response("EVENT_RECEIVED");
      }
    }

    // ===== ORDER NOW =====
    if (payloadText.startsWith("ORDER_NOW_")) {
      const productId = payloadText.replace("ORDER_NOW_", "");
      const product = productsCache.find((p) => p.id === productId);
      if (!product) {
        await sendTextMessage(senderId, "❌ عذراً، هذا المنتج غير متوفر حالياً.");
        return new Response("EVENT_RECEIVED");
      }
      await setUserStateSafe(senderId, {
        step: "name",
        collected: {},
        productId,
        locked: false,
        completed: false,
        lastOrderId: null,
      });
      await sendTextMessage(senderId, `🛍️ **طلب المنتج: ${product.name}**\n\n🙌 تمام! هنساعدك تكمل الطلب.\n👤 **اسم حضرتك؟**`);
      await scheduleFollowUp(senderId, 5);
      return new Response("EVENT_RECEIVED");
    }

    // ===== CITY QUICK REPLY =====
    if (payloadText.startsWith("CITY_")) {
      const selectedCity = payloadText.replace("CITY_", "");
      state = await getUserStateSafe(senderId);
      if (state && (state.step === "city" || (!state.collected.city && state.productId))) {
        state.collected.city = selectedCity;
        state.step = "confirm";
        state.locked = false;
        state.completed = false;
        await setUserStateSafe(senderId, state);
        await sendConfirmationMessage(senderId, state);
      } else {
        await sendTextMessage(senderId, `🏙️ تم اختيار ${selectedCity}`);
        await sendQuickReplies(senderId);
      }
      return new Response("EVENT_RECEIVED");
    }

    // ===== PRODUCTS / CONTACT / CANCEL =====
    if (hasAnyKeyword(messageText, ["منتجات"]) || payloadText === "PRODUCTS") {
      if (productsCache.length === 0) {
        await sendTextMessage(senderId, "📦 لا توجد منتجات متاحة حالياً.");
      } else {
        await sendProductCarousel(
          senderId,
          productsCache.map((p) => ({ id: p.id, title: p.name, price: p.price, image: p.image }))
        );
      }
      await sendQuickReplies(senderId);
      return new Response("EVENT_RECEIVED");
    }

    if (hasAnyKeyword(messageText, ["تواصل"]) || payloadText === "CONTACT") {
      await sendTextMessage(senderId, "📞 **تواصل معانا:**\n\nواتساب: +218912345678");
      await sendQuickReplies(senderId);
      return new Response("EVENT_RECEIVED");
    }

    if (hasAnyKeyword(messageText, ["إلغاء", "الغاء"])) {
      await setUserStateSafe(senderId, null);
      cancelFollowUp(senderId);
      await sendTextMessage(senderId, "✅ تم إلغاء الطلب. اكتب 'عايز' لو حبيت تطلب تاني 😊");
      await sendQuickReplies(senderId);
      return new Response("EVENT_RECEIVED");
    }

    // ===== START ORDER =====
    if (!state && (isStartIntent(messageText) || payloadText === "ORDER")) {
      const productId = commentProductMemory.get(senderId) || null;
      if (productId) commentProductMemory.delete(senderId);
      state = {
        step: "name",
        collected: {},
        productId,
        locked: false,
        completed: false,
        lastOrderId: null,
      };
      await setUserStateSafe(senderId, state);
      await sendTextMessage(senderId, "🙌 **تمام! هنساعدك تكمل الطلب**\n\n👤 **اسم حضرتك؟**");
      await scheduleFollowUp(senderId, 5);
      return new Response("EVENT_RECEIVED");
    }

    // ===== ORDER FLOW =====
    if (state && messageText && state.step !== "confirm") {
      if (state.completed || state.locked) return new Response("EVENT_RECEIVED");

      if (state.step === "name") {
        if (!isValidName(messageText)) {
          await sendTextMessage(senderId, "👤 من فضلك اكتب اسم صحيح (3 أحرف على الأقل)");
          await sendTextMessage(senderId, "👤 اسم حضرتك؟");
          return new Response("EVENT_RECEIVED");
        }
        state.collected.name = messageText.trim();
        state.step = "phone";
        await setUserStateSafe(senderId, state);
        await sendTextMessage(senderId, "📱 **رقم الموبايل؟**\n(مثال: 0912345678)");
        return new Response("EVENT_RECEIVED");
      }

      if (state.step === "phone") {
        const normalizedPhone = normalizePhoneNumber(messageText);
        if (!isValidPhoneNumber(normalizedPhone)) {
          await sendTextMessage(senderId, "📱 من فضلك اكتب رقم موبايل صحيح (مثال: 0912345678)");
          await sendTextMessage(senderId, "📱 رقم الموبايل؟");
          return new Response("EVENT_RECEIVED");
        }
        state.collected.phone = normalizedPhone;
        state.step = "address";
        await setUserStateSafe(senderId, state);
        await sendTextMessage(senderId, "🏠 **العنوان بالتفصيل؟**\n(المنطقة - الشارع - رقم العمارة)");
        return new Response("EVENT_RECEIVED");
      }

      if (state.step === "address") {
        if (isPurePhoneNumber(messageText)) {
          await sendTextMessage(senderId, "🏠 من فضلك اكتب عنوان صحيح (ليس رقم موبايل)");
          await sendTextMessage(senderId, "🏠 العنوان بالتفصيل؟");
          return new Response("EVENT_RECEIVED");
        }
        if (!isValidAddress(messageText)) {
          await sendTextMessage(senderId, "🏠 من فضلك اكتب عنوان كامل (5 أحرف على الأقل)");
          await sendTextMessage(senderId, "🏠 العنوان بالتفصيل؟");
          return new Response("EVENT_RECEIVED");
        }
        state.collected.address = messageText.trim();
        state.step = "city";
        await setUserStateSafe(senderId, state);
        await sendCitySelection(senderId);
        return new Response("EVENT_RECEIVED");
      }

      if (state.step === "city") {
        const matchedCity = findMatchingCity(messageText);
        if (!matchedCity) {
          await sendTextMessage(senderId, "🏙️ من فضلك اختر المدينة من القائمة أو اكتبها بشكل صحيح.");
          await sendCitySelection(senderId);
          return new Response("EVENT_RECEIVED");
        }
        state.collected.city = matchedCity;
        state.step = "confirm";
        await setUserStateSafe(senderId, state);
        await sendConfirmationMessage(senderId, state);
        return new Response("EVENT_RECEIVED");
      }
    }

    // ===== CONFIRMATION =====
    if (state?.step === "confirm" && messageText) {
      if (state.completed || state.locked) return new Response("EVENT_RECEIVED");

      if (isCancelOrEditMessage(messageText)) {
        if (normalizeText(messageText) === "إلغاء" || normalizeText(messageText) === "الغاء" || normalizeText(messageText) === "no") {
          await setUserStateSafe(senderId, null);
          cancelFollowUp(senderId);
          await sendTextMessage(senderId, "✅ تم إلغاء الطلب. اكتب 'عايز' لو حبيت تطلب تاني 😊");
          await sendQuickReplies(senderId);
          return new Response("EVENT_RECEIVED");
        }
        await setUserStateSafe(senderId, {
          step: "name",
          collected: {},
          productId: state.productId || null,
          locked: false,
          completed: false,
          lastOrderId: null,
        });
        await sendTextMessage(senderId, "✏️ **تمام، خلينا نبدأ من جديد**\n\n👤 **اسم حضرتك؟**");
        await scheduleFollowUp(senderId, 5);
        return new Response("EVENT_RECEIVED");
      }

      if (!isConfirmMessage(messageText)) {
        await sendTextMessage(senderId, "📋 اكتب 'نعم' للتأكيد، أو 'تعديل' لتغيير البيانات، أو 'إلغاء' للإلغاء");
        return new Response("EVENT_RECEIVED");
      }

      if (!state.collected.name || !state.collected.phone || !state.collected.address || !state.collected.city) {
        await sendTextMessage(senderId, "❌ بيانات ناقصة. لنبدأ من جديد...");
        await setUserStateSafe(senderId, null);
        await sendTextMessage(senderId, "👤 اسم حضرتك؟");
        return new Response("EVENT_RECEIVED");
      }

      await setUserStateSafe(senderId, { ...state, locked: true });

      const shopUserId = process.env.SHOP_DEFAULT_USER_ID || DEFAULT_SHOP_USER_ID;
      try {
        const order = await safeCreateOrder({
          customerName: state.collected.name,
          phone: state.collected.phone,
          address: state.collected.address,
          city: state.collected.city,
          userId: shopUserId,
          productId: state.productId || null,
          source: "messenger_order_completed",
          status: OrderStatus.NEW,
        });

        const product = productsCache.find((p) => p.id === state.productId);
        // تصحيح الخطأ: تحويل null إلى undefined
        await appendOrderToSheet({
          customerName: state.collected.name,
          phone: state.collected.phone,
          address: state.collected.address,
          city: state.collected.city,
          productName: product?.name ?? undefined,
          productPrice: product?.price ?? undefined,
          source: "messenger_order_completed",
          status: "NEW",
        });

        cancelFollowUp(senderId);
        await setUserStateSafe(senderId, {
          step: "completed",
          collected: {},
          productId: null,
          locked: false,
          completed: true,
          lastOrderId: order?.id || null,
        });

        const productText = product ? `${product.name} (${product.price} ج.م)` : "الطلب";
        const orderStatus = order ? "تم تسجيله في النظام" : "تم استلام طلبك (سيتم إدخاله يدوياً)";
        await sendTextMessage(
          senderId,
          `🎉 **تم استلام طلبك بنجاح!**\n\n🛍️ المنتج: ${productText}\n📍 المدينة: ${state.collected.city}\n📞 هنكلمك على ${state.collected.phone} خلال 24 ساعة.\n\n${orderStatus}\nشكراً لتسوقك مع Monjez! 🚀`
        );
        await sendQuickReplies(senderId);
        return new Response("EVENT_RECEIVED");
      } catch (confirmError) {
        console.error("❌ Confirmation flow failed:", confirmError);
        await setUserStateSafe(senderId, { ...state, locked: false, completed: false });
        await sendTextMessage(senderId, "حصل خطأ أثناء تسجيل الطلب. حاول مرة أخرى.");
        return new Response("EVENT_RECEIVED");
      }
    }

    // ===== AI FALLBACK =====
    if (messageText) {
      const smart = await getSmartReplyWithTimeout(messageText);
      const reply = smart?.reply || (await generateReply([{ role: "user", content: messageText }]));
      await sendTextMessage(senderId, reply);
      await sendQuickReplies(senderId);
    }

    return new Response("EVENT_RECEIVED");
  } catch (error) {
    console.error("[webhook] FATAL:", error);
    return new Response("Error", { status: 500 });
  }
}