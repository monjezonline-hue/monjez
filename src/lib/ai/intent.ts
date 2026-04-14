// src/lib/ai/intent.ts
import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

const GROQ_MODEL = "llama-3.3-70b-versatile";
const GROQ_BASE = "https://api.groq.com/openai/v1";
const AI_TIMEOUT = 4000;

const groqKey = process.env.GROQ_API_KEY;
const groqConfigured = Boolean(groqKey && groqKey.length > 10);

const groq = new OpenAI({
  apiKey: groqKey ?? "missing",
  baseURL: GROQ_BASE,
});

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  const timeout = new Promise<T>((_, reject) =>
    setTimeout(() => reject(new Error(`AI Timeout after ${ms}ms`)), ms)
  );
  return Promise.race([promise, timeout]);
}

export type Intent = "BUY" | "QUESTION" | "HESITATION" | "UNKNOWN";

export interface IntentResult {
  intent: Intent;
  confidence?: number;
  collect?: string[];  // البيانات المطلوبة (name, phone, address...)
}

const FALLBACK_INTENT: IntentResult = {
  intent: "UNKNOWN",
  collect: [],
};

/**
 * تصنيف نية المستخدم بناءً على آخر 8 رسائل
 */
export async function classifyIntent(
  messages: { role: "user" | "assistant"; content: string }[],
  productName?: string
): Promise<IntentResult> {
  if (!groqConfigured) {
    console.warn("[intent] GROQ_API_KEY missing, returning UNKNOWN");
    return FALLBACK_INTENT;
  }

  const systemPrompt = `أنت نظام تصنيف نية العميل. أخرج JSON فقط بدون أي نص إضافي.

{
  "intent": "BUY" | "QUESTION" | "HESITATION" | "UNKNOWN",
  "collect": ["name"] أو [] (إذا طلب العميل شراء يحتاج بيانات)
}

المعاني:
- BUY: العميل يريد الشراء، يطلب سعر، يقول "عايز"، "اشتري"، "طلب"، "أطلب"، "كاسك", "حجز".
- QUESTION: يسأل عن مواصفات، توصيل، سياسة، متى يوصل.
- HESITATION: متردد، يقارن، يقول "غالي"، "محتار"، "يمكن".
- UNKNOWN: غير واضح، تحية، كلام عادي.

المنتج الحالي: ${productName || "غير محدد"}

أهم قاعدة: لا تخرج أي شيء إلا JSON.`;

  const userMessages: ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
    ...messages.slice(-8).map(m => ({ role: m.role, content: m.content }))
  ];

  try {
    const completion = await withTimeout(
      groq.chat.completions.create({
        model: GROQ_MODEL,
        temperature: 0.2,
        max_tokens: 150,
        messages: userMessages,
      }),
      AI_TIMEOUT
    );

    const raw = completion.choices[0]?.message?.content ?? "";
    const cleaned = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(cleaned) as { intent?: string; collect?: string[] };
    
    const intent = (parsed.intent === "BUY" || parsed.intent === "QUESTION" || parsed.intent === "HESITATION")
      ? parsed.intent
      : "UNKNOWN";
    
    return {
      intent,
      collect: Array.isArray(parsed.collect) ? parsed.collect : [],
    };
  } catch (error) {
    console.error("[intent] Error:", error);
    return FALLBACK_INTENT;
  }
}