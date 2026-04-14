// src/lib/ai/response.ts
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

/**
 * توليد رد عام (دون تحليل النية) – يُستخدم كـ fallback أو محادثة عادية.
 */
export async function generateGeneralReply(
  messages: { role: "user" | "assistant"; content: string }[],
  productName?: string
): Promise<string> {
  if (!groqConfigured) {
    return "أهلاً بيك 🙌 تحب تشوف المنتجات؟";
  }

  const systemPrompt = `أنت مساعد مبيعات ودود لمتجر Monjez. رد باللهجة المصرية، مختصر (جملتين كحد أقصى)، واسأل سؤال يفتح المحادثة.
المنتج: ${productName || "غير محدد"}`;

  const userMessages: ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
    ...messages.slice(-6).map(m => ({ role: m.role, content: m.content }))
  ];

  try {
    const completion = await withTimeout(
      groq.chat.completions.create({
        model: GROQ_MODEL,
        temperature: 0.6,
        max_tokens: 200,
        messages: userMessages,
      }),
      AI_TIMEOUT
    );
    const reply = completion.choices[0]?.message?.content?.trim();
    return reply || "أهلاً بيك 🙌 تحب تشوف المنتجات؟";
  } catch (error) {
    console.error("[response] Error:", error);
    return "عذراً، حصل تأتأة. ممكن تكرر سؤالك؟";
  }
}