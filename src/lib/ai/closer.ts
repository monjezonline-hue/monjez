// src/lib/ai/closer.ts
import { classifyIntent } from "./intent";
import { generateGeneralReply } from "./response";
import { detectProduct } from "./product";
import { getState, updateState, createInitialState } from "@/lib/orderState";

export interface CloserContext {
  userId: string;
  lastMessage: string;
  conversationHistory: { role: "user" | "assistant"; content: string }[];
  productName?: string;
  availableProducts?: { id: string; name: string }[];
}

export interface CloserResult {
  action: "REPLY" | "START_ORDER_FLOW" | "CONTINUE_ORDER" | "RECOVER" | "END";
  replyText?: string;
  quickReplies?: { content_type: "text"; title: string; payload: string }[];
  shouldSaveState: boolean;
}

export async function aiCloser(context: CloserContext): Promise<CloserResult> {
  const { userId, lastMessage, conversationHistory, productName, availableProducts } = context;

  let orderState = await getState(userId);
  if (!orderState) {
    orderState = createInitialState();
    await updateState(userId, orderState);
  }

  if (orderState.step !== "idle" && orderState.step !== "completed") {
    return { action: "CONTINUE_ORDER", shouldSaveState: true };
  }

  const intentResult = await classifyIntent(conversationHistory, productName);
  const intent = intentResult.intent;

  let detectedProductId: string | null = null;
  if (availableProducts && availableProducts.length > 0) {
    detectedProductId = await detectProduct(lastMessage, availableProducts);
    if (detectedProductId && orderState.productId !== detectedProductId) {
      orderState.productId = detectedProductId;
      await updateState(userId, orderState);
    }
  }

  switch (intent) {
    case "BUY":
      return {
        action: "START_ORDER_FLOW",
        replyText: "تمام يا كبير 😎 هنجهز الطلب مع بعض. أيه اسمك؟",
        shouldSaveState: true,
      };
    case "QUESTION":
      const reply = await generateGeneralReply(conversationHistory, productName);
      return {
        action: "REPLY",
        replyText: reply + "\n\nهل تحب تطلب المنتج دلوقتي؟",
        quickReplies: [
          { content_type: "text", title: "✅ نعم أريد الشراء", payload: "BUY_NOW" },
          { content_type: "text", title: "❌ لا شكراً", payload: "CANCEL" },
        ],
        shouldSaveState: false,
      };
    case "HESITATION":
      return {
        action: "REPLY",
        replyText: "أنا فاهم تماماً 😊 لو عندك أي سؤال أو محتار، أنا هنا أساعدك. تقدر تطلب المنتج وتجربه، وفي حالة عدم الرضا نرجعلك الفلوس.",
        quickReplies: [
          { content_type: "text", title: "🛒 اشتري", payload: "BUY_NOW" },
          { content_type: "text", title: "💬 اسأل أكثر", payload: "ASK_MORE" },
        ],
        shouldSaveState: false,
      };
    default:
      return {
        action: "REPLY",
        replyText: "أهلاً بيك في Monjez 🙌 إزاي أقدر أساعدك النهاردة؟",
        quickReplies: [
          { content_type: "text", title: "🛍️ عايز أشتري", payload: "BUY_NOW" },
          { content_type: "text", title: "📦 استفسار", payload: "ASK_QUESTION" },
        ],
        shouldSaveState: false,
      };
  }
}