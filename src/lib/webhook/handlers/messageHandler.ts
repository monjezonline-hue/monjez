// src/lib/webhook/handlers/messageHandler.ts
import { MessengerMessage } from "../types";
import { aiCloser, CloserContext } from "@/lib/ai";
import { getState, updateState, clearState, createInitialState } from "@/lib/orderState";
import { OrderFlowService } from "@/lib/services/orderFlowService";
import { sendText, sendQuickReplies, sendMainMenu } from "@/lib/messenger";

type HistoryMessage = { role: "user" | "assistant"; content: string };
const conversationMemory = new Map<string, HistoryMessage[]>();

export async function handleMessage(messaging: MessengerMessage) {
  const senderId = messaging.sender.id;
  const messageText = messaging.message?.text;
  const payload = messaging.postback?.payload;

  if (!conversationMemory.has(senderId)) {
    conversationMemory.set(senderId, []);
  }
  const history = conversationMemory.get(senderId)!;

  if (messageText) {
    history.push({ role: "user", content: messageText });
  }

  if (payload) {
    await handlePayload(senderId, payload, history);
    return;
  }

  if (!messageText) return;

  const orderState = await getState(senderId);
  if (orderState && orderState.step !== "idle" && orderState.step !== "completed") {
    const orderFlow = new OrderFlowService(senderId);
    await orderFlow.processMessage(messageText);
    history.push({ role: "assistant", content: "تم استلام بياناتك" });
    return;
  }

  const closerContext: CloserContext = {
    userId: senderId,
    lastMessage: messageText,
    conversationHistory: history,
    productName: "منتجنا الرائع",
    availableProducts: await getAvailableProducts(),
  };

  const result = await aiCloser(closerContext);

  switch (result.action) {
    case "START_ORDER_FLOW":
      await updateState(senderId, createInitialState());
      await sendText(senderId, result.replyText || "أهلاً بيك. ما اسمك؟");
      history.push({ role: "assistant", content: result.replyText || "أهلاً بيك. ما اسمك؟" });
      break;
    case "CONTINUE_ORDER":
      const flow = new OrderFlowService(senderId);
      await flow.processMessage(messageText);
      break;
    case "REPLY":
      if (result.quickReplies && result.quickReplies.length > 0) {
        await sendQuickReplies(senderId, result.replyText!, result.quickReplies);
      } else {
        await sendText(senderId, result.replyText!);
      }
      history.push({ role: "assistant", content: result.replyText! });
      break;
    default:
      await sendMainMenu(senderId);
      history.push({ role: "assistant", content: "اختر من القائمة" });
  }

  if (history.length > 20) history.splice(0, 10);
  conversationMemory.set(senderId, history);
}

async function handlePayload(senderId: string, payload: string, history: HistoryMessage[]) {
  switch (payload) {
    case "BUY_NOW":
      await updateState(senderId, createInitialState());
      await sendText(senderId, "تمام يا كبير 😎 هنجهز الطلب مع بعض. أيه اسمك؟");
      history.push({ role: "assistant", content: "تمام يا كبير 😎 هنجهز الطلب مع بعض. أيه اسمك؟" });
      break;
    case "ASK_QUESTION":
      await sendText(senderId, "اسأل وأنا هنا 🙌 اكتب سؤالك بالتفصيل.");
      break;
    case "CANCEL":
      await clearState(senderId);
      await sendMainMenu(senderId);
      history.push({ role: "assistant", content: "تم الإلغاء. اختر من القائمة." });
      break;
    default:
      await sendMainMenu(senderId);
  }
}

async function getAvailableProducts(): Promise<{ id: string; name: string }[]> {
  return []; // يمكن جلبها من قاعدة البيانات لاحقاً
}