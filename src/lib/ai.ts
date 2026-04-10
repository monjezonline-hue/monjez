import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

const GROQ_MODEL = "llama-3.3-70b-versatile";
const GROQ_BASE = "https://api.groq.com/openai/v1";
const AI_TIMEOUT = 4000; // 4 seconds timeout

const groqKey = process.env.GROQ_API_KEY;
const groqConfigured = Boolean(groqKey && groqKey.length > 10);
console.log(
  "[ai] GROQ_API_KEY:",
  groqConfigured ? `configured (prefix ${groqKey!.slice(0, 8)}…)` : "MISSING"
);

const groq = new OpenAI({
  apiKey: groqKey ?? "missing",
  baseURL: GROQ_BASE,
});

type Message = {
  role: "user" | "assistant" | "system";
  content: string;
};

export type SmartReply = {
  intent: "BUY" | "QUESTION" | "HESITATION" | "UNKNOWN";
  reply: string;
  collect: string[];
};

// =====================================================
// 🔥 Timeout wrapper
// =====================================================
async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  const timeout = new Promise<T>((_, reject) =>
    setTimeout(() => reject(new Error(`AI Timeout after ${ms}ms`)), ms)
  );
  return Promise.race([promise, timeout]);
}

// =====================================================
// 🔥 Fallback replies
// =====================================================
const FALLBACK_REPLIES = {
  BUY: "تمام يا حبيبي 😊 اكتب 'عايز' عشان نبدأ الطلب",
  QUESTION: "أهلاً بيك 🙌 ممكن توضح سؤالك أكثر؟",
  HESITATION: "خد وقتك 😊 لو محتاج مساعدة، اسأل وأنا معاك",
  UNKNOWN: "أهلاً بيك في Monjez 🙌 إزاي أقدر أساعدك النهاردة؟",
};

function getFallbackReply(intent: SmartReply["intent"]): SmartReply {
  return {
    intent,
    reply: FALLBACK_REPLIES[intent],
    collect: [],
  };
}

function toChatMessages(messages: Message[]): ChatCompletionMessageParam[] {
  return messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));
}

function buildContext(
  messages: Message[],
  productName?: string
): ChatCompletionMessageParam[] {
  const systemMessage: Message = {
    role: "system",
    content: `أنت بائع محترف لمتجر Monjez عبر ماسنجر فيسبوك.

🎯 هدفك:
- تفهم احتياج العميل بسرعة
- ترد بأسلوب مصري ودود وواثق
- تقود المحادثة نحو الطلب أو الإجابة عن المنتجات

📦 المنتج الحالي في السياق (لو متاح): ${productName || "غير محدد"}

📌 قواعد:
- رد باللهجة المصرية العامية البسيطة
- قصير وواضح (2–4 جمل)
- اختم غالبًا بسؤال يحرك المحادثة (شراء / توضيح / عنوان)
- لا تعد وعودًا كاذبة عن التوصيل أو السعر إلا إذا وردت في السياق`,
  };

  return toChatMessages([systemMessage, ...messages.slice(-8)]);
}

async function groqChat(
  messages: ChatCompletionMessageParam[],
  context: string,
  opts: { temperature: number; max_tokens: number }
): Promise<string> {
  if (!groqConfigured) {
    console.error("[ai] Groq skipped:", context, "(no GROQ_API_KEY)");
    return "";
  }

  console.log(`[ai] Groq request: ${context}, model=${GROQ_MODEL}, msgs=${messages.length}`);
  
  try {
    const completion = await withTimeout(
      groq.chat.completions.create({
        model: GROQ_MODEL,
        temperature: opts.temperature,
        max_tokens: opts.max_tokens,
        messages,
      }),
      AI_TIMEOUT
    );

    const raw = completion.choices[0]?.message?.content ?? "";
    const preview =
      raw.length > 280 ? `${raw.slice(0, 280)}…(${raw.length} chars)` : raw;
    console.log(`[ai] Groq response [${context}]:`, preview);
    return raw;
  } catch (error) {
    console.error(`[ai] Groq timeout/error [${context}]:`, error);
    return "";
  }
}

// =====================================================
// 🤖 1. SMART SALES AI (JSON intent)
// =====================================================
export async function generateSmartReply(
  messages: Message[],
  productName?: string
): Promise<SmartReply> {
  try {
    const systemJson: ChatCompletionMessageParam = {
      role: "system",
      content: `لازم ترد بـ JSON فقط بدون markdown أو شرح:

{
  "intent": "BUY" | "QUESTION" | "HESITATION" | "UNKNOWN",
  "reply": "رسالة قصيرة للعميل بالمصري",
  "collect": ["name","phone","address"] أو [] فارغة
}

intent:
- BUY: واضح إنه عايز يشتري أو يأكد طلب
- QUESTION: سؤال عن منتج أو سعر أو توصيل
- HESITATION: متردد أو محتاج مقارنة
- UNKNOWN: غير واضح

ممنوع أي نص خارج كائن JSON واحد.`,
    };

    const text = await groqChat(
      [systemJson, ...buildContext(messages, productName)],
      "generateSmartReply",
      { temperature: 0.35, max_tokens: 350 }
    );

    if (!text || text.trim() === "") {
      console.warn("[ai] generateSmartReply: empty response, using fallback");
      return getFallbackReply("UNKNOWN");
    }

    // ✅ Fixed: changed 'let cleaned' to 'const cleaned'
    const cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();

    try {
      const parsed = JSON.parse(cleaned) as {
        intent?: string;
        reply?: string;
        collect?: unknown;
      };

      const intent =
        parsed.intent === "BUY" ||
        parsed.intent === "QUESTION" ||
        parsed.intent === "HESITATION"
          ? parsed.intent
          : "UNKNOWN";

      return {
        intent,
        reply: parsed.reply || FALLBACK_REPLIES[intent],
        collect: Array.isArray(parsed.collect) ? (parsed.collect as string[]) : [],
      };
    } catch {
      console.warn("[ai] generateSmartReply: JSON parse failed, using raw slice");
      return {
        intent: "UNKNOWN",
        reply:
          cleaned.length > 0 && cleaned.length < 400
            ? cleaned
            : FALLBACK_REPLIES.UNKNOWN,
        collect: [],
      };
    }
  } catch (error) {
    console.error("[ai] generateSmartReply error:", error);
    return getFallbackReply("UNKNOWN");
  }
}

// =====================================================
// 🧠 2. BASIC REPLY
// =====================================================
export async function generateReply(
  messages: Message[],
  productName?: string
): Promise<string> {
  try {
    const text = await groqChat(
      buildContext(messages, productName),
      "generateReply",
      { temperature: 0.55, max_tokens: 200 }
    );
    
    if (!text || text.trim() === "") {
      console.warn("[ai] generateReply: empty response, using fallback");
      return "أهلاً بيك 🙌 تحب تشوف المنتجات؟";
    }
    
    return text.trim() || "أهلاً بيك 🙌 تحب تشوف المنتجات؟";
  } catch (error) {
    console.error("[ai] generateReply error:", error);
    return "أهلاً بيك 🙌 تحب تشوف المنتجات؟";
  }
}

// =====================================================
// 🧠 3. PRODUCT DETECTION
// =====================================================
export async function detectProductFromText(
  text: string,
  products: { id: string; name: string }[]
): Promise<string | null> {
  try {
    if (!products.length) return null;

    const productList = products
      .map((p) => `- ${p.name} (ID: ${p.id})`)
      .join("\n");

    const result = await groqChat(
      toChatMessages([
        {
          role: "user",
          content: `المنتجات المتاحة:
${productList}

رسالة العميل: "${text}"

ارجع فقط UUID المنتج الأنسب من القائمة، أو كلمة NONE فقط بدون شرح.`,
        },
      ]),
      "detectProductFromText",
      { temperature: 0, max_tokens: 80 }
    );

    if (!result || result.trim() === "") {
      console.warn("[ai] detectProductFromText: timeout, returning null");
      return null;
    }

    const trimmed = result.trim();
    if (!trimmed || /^NONE$/i.test(trimmed)) return null;

    if (products.some((p) => p.id === trimmed)) return trimmed;

    const uuidMatch = trimmed.match(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i
    );
    const id = uuidMatch?.[0];
    if (id && products.some((p) => p.id === id)) return id;

    return null;
  } catch (error) {
    console.error("[ai] detectProductFromText error:", error);
    return null;
  }
}