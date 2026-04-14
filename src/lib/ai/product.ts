// src/lib/ai/product.ts
import OpenAI from "openai";

const GROQ_MODEL = "llama-3.3-70b-versatile";
const GROQ_BASE = "https://api.groq.com/openai/v1";
const AI_TIMEOUT = 3000;

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
 * إرجاع ID المنتج الأنسب من قائمة المنتجات بناءً على نص العميل.
 */
export async function detectProduct(
  userText: string,
  products: { id: string; name: string }[]
): Promise<string | null> {
  if (!groqConfigured || products.length === 0) return null;

  const productList = products.map(p => `- ${p.name} (ID: ${p.id})`).join("\n");

  const prompt = `المنتجات المتاحة:
${productList}

رسالة العميل: "${userText}"

أخرج فقط UUID المنتج الأنسب من القائمة، أو كلمة NONE. لا تخرج أي شرح.`;

  try {
    const completion = await withTimeout(
      groq.chat.completions.create({
        model: GROQ_MODEL,
        temperature: 0,
        max_tokens: 80,
        messages: [{ role: "user", content: prompt }],
      }),
      AI_TIMEOUT
    );

    const result = completion.choices[0]?.message?.content?.trim() ?? "";
    if (!result || /^NONE$/i.test(result)) return null;
    // تحقق من وجود الـ UUID في القائمة
    const matched = products.find(p => p.id === result);
    return matched ? matched.id : null;
  } catch (error) {
    console.error("[product] detect error:", error);
    return null;
  }
}