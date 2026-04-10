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
  collected: Record<string, string>;
  collect: string[];
  productId?: string | null;
  city?: string | null;
};

// =====================================================
// STATE
// =====================================================
const userState = new Map<string, OrderState>();
const commentProductMemory = new Map<string, string>();
const followUpTimeouts = new Map<string, NodeJS.Timeout>();
let productsCache: Product[] = [];
let lastProductFetch = 0;
const PRODUCT_CACHE_TTL = 60000;

const DEFAULT_SHOP_USER_ID =
  process.env.SHOP_DEFAULT_USER_ID ??
  "c1a2b3c4-1111-2222-3333-abcdef123456";

// المدن الكاملة (ليبيا + مصر)
const CITIES = [
  // ليبيا
  "طرابلس", "بنغازي", "مصراتة", "الزاوية", "سبها", 
  "البيضاء", "زليتن", "اجدابيا", "الخمس", "درنة",
  "طبرق", "غريان", "صبراتة", "سرت", "تاجوراء",
  // مصر
  "القاهرة", "الإسكندرية", "الجيزة", "السادس من أكتوبر",
  "الشيخ زايد", "بورسعيد", "السويس", "المنصورة", "المحلة", "طنطا",
  "أسوان", "الأقصر", "أسيوط", "سوهاج", "قنا", "الفيوم", "بنى سويف",
  "المنيا", "الإسماعيلية", "دمياط", "الغردقة", "شرم الشيخ",
  "غير محدد"
];

// =====================================================
// FOLLOW-UP FUNCTIONS
// =====================================================
async function scheduleFollowUp(senderId: string, delayMinutes: number = 5) {
  if (followUpTimeouts.has(senderId)) {
    clearTimeout(followUpTimeouts.get(senderId));
  }

  const timeout = setTimeout(async () => {
    followUpTimeouts.delete(senderId);
    const state = userState.get(senderId);
    if (state && state.step !== "confirm" && state.step !== "done") {
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
// AI WITH TIMEOUT (3 ثواني)
// =====================================================
async function getSmartReplyWithTimeout(messageText: string): Promise<SmartReply | null> {
  try {
    const aiPromise = generateSmartReply([{ role: "user", content: messageText }]);
    const timeoutPromise = new Promise<null>((resolve) => 
      setTimeout(() => resolve(null), 3000)
    );
    return await Promise.race([aiPromise, timeoutPromise]);
  } catch (error) {
    console.error("AI Error:", error);
    return null;
  }
}

// =====================================================
// SAFE DB HELPERS
// =====================================================
async function safeGetProducts(): Promise<Product[]> {
  if (productsCache.length && Date.now() - lastProductFetch < PRODUCT_CACHE_TTL) {
    return productsCache;
  }
  try {
    productsCache = await prisma.product.findMany();
    lastProductFetch = Date.now();
    return productsCache;
  } catch (e) {
    console.error("❌ DB products error:", e);
    return productsCache.length ? productsCache : [];
  }
}

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
    return await prisma.order.create({ data });
  } catch (e) {
    console.error("❌ DB order error:", e);
    return null;
  }
}

async function logInboundAsOrder(opts: {
  psid: string;
  body: string;
  source: "messenger_inbound" | "facebook_comment";
}) {
  const trimmed = opts.body.trim();
  if (!trimmed) return;

  await safeCreateOrder({
    customerName: opts.source === "facebook_comment" ? "[تعليق]" : "[رسالة واردة]",
    phone: opts.psid,
    address: trimmed.slice(0, 2000),
    city: null,
    userId: DEFAULT_SHOP_USER_ID,
    productId: null,
    source: opts.source,
    status: OrderStatus.NEW,
  });
}

async function sendConfirmationMessage(senderId: string, state: OrderState) {
  const collected = state.collected;
  const product = state.productId 
    ? productsCache.find(p => p.id === state.productId)
    : null;
  
  const message = `📋 **تأكيد بيانات الطلب**\n\n` +
    `👤 **الاسم:** ${collected.name || "❌ missing"}\n` +
    `📱 **رقم الموبايل:** ${collected.phone || "❌ missing"}\n` +
    `🏠 **العنوان:** ${collected.address || "❌ missing"}\n` +
    (product ? `🛍️ **المنتج:** ${product.name}\n💰 **السعر:** ${product.price} ج.م\n` : "") +
    `\n✅ **لو البيانات صحيحة** اكتب "نعم"\n` +
    `✏️ **لو عايز تعدل** اكتب "تعديل"\n` +
    `❌ **لو عايز تلغي** اكتب "إلغاء"`;
  
  await sendTextMessage(senderId, message);
}

async function sendCitySelection(senderId: string) {
  const quickReplies = CITIES.map(city => ({
    content_type: "text",
    title: city,
    payload: `CITY_${city}`,
  }));
  
  await sendTextMessage(senderId, "🏙️ **من فضلك اختر مدينتك:**");
  
  const requestBody = {
    recipient: { id: senderId },
    messaging_type: "RESPONSE",
    message: {
      text: "اختر مدينتك من القائمة 👇",
      quick_replies: quickReplies,
    },
  };
  
  try {
    await fetch(`https://graph.facebook.com/v18.0/me/messages?access_token=${process.env.FB_PAGE_ACCESS_TOKEN}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });
  } catch (error) {
    console.error("❌ Error sending city quick replies:", error);
  }
}

// =====================================================
// VERIFY WEBHOOK
// =====================================================
export async function GET(req: Request) {
  const url = new URL(req.url);

  if (
    url.searchParams.get("hub.mode") === "subscribe" &&
    url.searchParams.get("hub.verify_token") === process.env.FB_VERIFY_TOKEN
  ) {
    return new Response(url.searchParams.get("hub.challenge") || "", {
      status: 200,
    });
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

    // =====================================================
    // HANDLE COMMENTS
    // =====================================================
    if (entry?.changes) {
      const change = entry.changes[0];

      if (
        change?.field === "feed" &&
        change.value?.comment_id &&
        change.value?.message
      ) {
        const comment = change.value.message;
        const commentId = change.value.comment_id;
        const senderId = change.value.from?.id;

        if (!senderId || senderId === process.env.PAGE_ID) {
          return new Response("EVENT_RECEIVED");
        }

        await trackEvent({ type: "COMMENT", userId: senderId });
        await logInboundAsOrder({
          psid: senderId,
          body: comment,
          source: "facebook_comment",
        });

        productsCache = await safeGetProducts();

        const detectedId = await detectProductFromText(
          comment,
          productsCache.map((p) => ({ id: p.id, name: p.name }))
        );

        if (detectedId) {
          commentProductMemory.set(senderId, detectedId);
        }

        await replyToComment(
          commentId,
          `تمام 🙌 كلمنا خاص 👇\nhttps://m.me/Monjezai`
        );
      }

      return new Response("EVENT_RECEIVED");
    }

    // =====================================================
    // HANDLE MESSENGER
    // =====================================================
    const messaging = entry?.messaging?.[0];
    const senderId = messaging?.sender?.id;
    const messageText = messaging?.message?.text;
    const payload = messaging?.postback?.payload || messaging?.message?.quick_reply?.payload;

    if (!senderId) return new Response("EVENT_RECEIVED");
    if (messaging?.message?.is_echo) return new Response("EVENT_RECEIVED");

    await trackEvent({ type: "MESSAGE", userId: senderId });

    if (messageText?.trim()) {
      await logInboundAsOrder({
        psid: senderId,
        body: messageText,
        source: "messenger_inbound",
      });
    }

    productsCache = await safeGetProducts();

    // Handle city selection
    if (payload && payload.startsWith("CITY_")) {
      const selectedCity = payload.replace("CITY_", "");
      const state = userState.get(senderId);
      
      if (state && state.step === "city") {
        state.collected.city = selectedCity;
        state.step = "confirm";
        userState.set(senderId, state);
        await sendConfirmationMessage(senderId, state);
      }
      return new Response("EVENT_RECEIVED");
    }

    // Handle products menu
    if (payload === "PRODUCTS" || messageText?.includes("منتجات")) {
      await sendProductCarousel(senderId, productsCache.map(p => ({ id: p.id, title: p.name, price: p.price, image: p.image })));
      return new Response("EVENT_RECEIVED");
    }

    if (payload === "CONTACT" || messageText?.includes("تواصل")) {
      await sendTextMessage(senderId, "📞 **تواصل معانا:**\nواتساب: +218XXXXXXXXX\nأو اكتب سؤالك وهنرد عليك فوراً 😊");
      await sendQuickReplies(senderId);
      return new Response("EVENT_RECEIVED");
    }

    // AI intent with timeout
    let smart: SmartReply | null = null;
    if (messageText) {
      smart = await getSmartReplyWithTimeout(messageText);
    }

    const state = userState.get(senderId);

    // Handle cancel
    if (messageText?.includes("إلغاء") || messageText?.includes("الغاء")) {
      cancelFollowUp(senderId);
      userState.delete(senderId);
      await sendTextMessage(senderId, "✅ تم إلغاء الطلب. اكتب 'عايز' لو حبيت تطلب تاني 😊");
      await sendQuickReplies(senderId);
      return new Response("EVENT_RECEIVED");
    }

    // Start new order
    if (!state && (smart?.intent === "BUY" || messageText?.includes("عايز") || messageText?.includes("طلب"))) {
      const productId = commentProductMemory.get(senderId);
      commentProductMemory.delete(senderId);
      
      userState.set(senderId, {
        step: "name",
        collected: {},
        collect: ["name", "phone", "address", "city"],
        productId: productId || null,
      });

      await sendTextMessage(senderId, "🙌 **تمام! هنساعدك تكمل الطلب**\n\n👤 **اسم حضرتك؟**");
      await scheduleFollowUp(senderId, 5);
      return new Response("EVENT_RECEIVED");
    }

    // Order flow
    if (state && messageText && state.step !== "confirm" && state.step !== "city") {
      state.collected[state.step] = messageText;
      const nextIndex = state.collect.indexOf(state.step) + 1;
      const nextStep = state.collect[nextIndex];

      if (nextStep) {
        state.step = nextStep;
        userState.set(senderId, state);
        if (nextStep === "city") {
          await sendCitySelection(senderId);
        } else {
          const questions: Record<string, string> = {
            name: "👤 **اسم حضرتك؟**",
            phone: "📱 **رقم الموبايل؟**\n(مثال: 0912345678)",
            address: "🏠 **العنوان بالتفصيل؟**\n(المنطقة - الشارع - رقم العمارة)",
          };
          await sendTextMessage(senderId, questions[nextStep]);
        }
        return new Response("EVENT_RECEIVED");
      }

      if (!state.collected.city) {
        state.step = "city";
        userState.set(senderId, state);
        await sendCitySelection(senderId);
        return new Response("EVENT_RECEIVED");
      }

      state.step = "confirm";
      userState.set(senderId, state);
      await sendConfirmationMessage(senderId, state);
      return new Response("EVENT_RECEIVED");
    }

    // Confirmation
    if (state?.step === "confirm" && messageText) {
      const lowerMsg = messageText.toLowerCase();
      
      if (lowerMsg === "نعم" || lowerMsg === "yes" || lowerMsg === "تمام") {
        if (!state.collected.name || !state.collected.phone || !state.collected.address) {
          await sendTextMessage(senderId, "❌ بيانات ناقصة. خلينا نبدأ من جديد...");
          userState.set(senderId, { step: "name", collected: {}, collect: ["name", "phone", "address", "city"], productId: state.productId });
          await sendTextMessage(senderId, "👤 اسم حضرتك؟");
          return new Response("EVENT_RECEIVED");
        }
        
        await safeCreateOrder({
          customerName: state.collected.name,
          phone: state.collected.phone,
          address: state.collected.address,
          city: state.collected.city || "غير محدد",
          userId: DEFAULT_SHOP_USER_ID,
          productId: state.productId || null,
          source: "messenger_order_completed",
          status: OrderStatus.NEW,
        });

        const product = productsCache.find(p => p.id === state.productId);
        await appendOrderToSheet({
          customerName: state.collected.name,
          phone: state.collected.phone,
          address: state.collected.address,
          city: state.collected.city || "غير محدد",
          productName: product?.name,
          productPrice: product?.price,
          source: "messenger_order_completed",
          status: "NEW",
        });

        await trackEvent({ type: "ORDER_CREATED", userId: senderId });
        cancelFollowUp(senderId);
        
        const productText = product ? `${product.name} (${product.price} ج.م)` : "الطلب";
        await sendTextMessage(senderId, `🎉 **تم استلام طلبك بنجاح!**\n\n🛍️ المنتج: ${productText}\n📍 المدينة: ${state.collected.city || "غير محدد"}\n\n📞 هنكلمك على ${state.collected.phone} خلال 24 ساعة.\n\nشكراً لتسوقك مع Monjez! 🚀`);
        await sendQuickReplies(senderId);
        userState.delete(senderId);
        return new Response("EVENT_RECEIVED");
      } 
      else if (lowerMsg === "تعديل" || lowerMsg === "edit" || lowerMsg === "عدل") {
        userState.set(senderId, { step: "name", collected: {}, collect: ["name", "phone", "address", "city"], productId: state.productId });
        await sendTextMessage(senderId, "✏️ **تمام، خلينا نبدأ من جديد**\n\n👤 اسم حضرتك؟");
        return new Response("EVENT_RECEIVED");
      }
      else {
        await sendTextMessage(senderId, "📋 **لو البيانات صحيحة** اكتب 'نعم'\n✏️ **لو عايز تعدل** اكتب 'تعديل'\n❌ **لو عايز تلغي** اكتب 'إلغاء'");
        return new Response("EVENT_RECEIVED");
      }
    }

    // Fallback
    if (messageText) {
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