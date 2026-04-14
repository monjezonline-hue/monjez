// src/lib/services/orderFlowService.ts
import {
  getState,
  updateState,
  clearState,
  createInitialState,
  OrderState,
} from "@/lib/orderState";
import { orderRepo } from "@/lib/db/repositories/orderRepo";
import { sendText, sendQuickReplies } from "@/lib/messenger";

export class OrderFlowService {
  constructor(private userId: string) {}

  async processMessage(messageText: string): Promise<boolean> {
    let state = await getState(this.userId);
    if (!state) {
      state = createInitialState();
      await updateState(this.userId, state);
    }

    if (state.step === "completed") {
      await sendText(this.userId, "✅ تم إتمام طلبك مسبقاً. شكراً لك!");
      return true;
    }

    switch (state.step) {
      case "name":
        return this.handleName(state, messageText);
      case "phone":
        return this.handlePhone(state, messageText);
      case "address":
        return this.handleAddress(state, messageText);
      case "city":
        return this.handleCity(state, messageText);
      case "confirm":
        return this.handleConfirm(state, messageText);
      default:
        await sendText(this.userId, "عذراً، حدث خطأ. ابدأ من جديد.");
        await clearState(this.userId);
        return false;
    }
  }

  private async handleName(state: OrderState, name: string) {
    if (!name || name.trim().length < 2) {
      await sendText(this.userId, "الرجاء إدخال اسم صحيح (حرفين على الأقل).");
      return false;
    }
    state.collected.name = name.trim();
    state.step = "phone";
    await updateState(this.userId, state);
    await sendText(this.userId, "📞 ما هو رقم هاتفك؟ (مثال: 0123456789)");
    return true;
  }

  private async handlePhone(state: OrderState, phone: string) {
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.length < 10) {
      await sendText(this.userId, "رقم الهاتف غير صالح. أدخل رقم مكون من 10-11 رقماً.");
      return false;
    }
    state.collected.phone = cleaned;
    state.step = "address";
    await updateState(this.userId, state);
    await sendText(this.userId, "🏠 ما هو عنوانك بالتفصيل؟");
    return true;
  }

  private async handleAddress(state: OrderState, address: string) {
    if (!address || address.length < 5) {
      await sendText(this.userId, "الرجاء إدخال عنوان صحيح (أكثر من 5 أحرف).");
      return false;
    }
    state.collected.address = address.trim();
    state.step = "city";
    await updateState(this.userId, state);
    await sendText(this.userId, "🌆 ما هي المدينة؟");
    return true;
  }

  private async handleCity(state: OrderState, city: string) {
    if (!city || city.length < 2) {
      await sendText(this.userId, "الرجاء إدخال اسم مدينة صحيح.");
      return false;
    }
    state.collected.city = city.trim();
    state.step = "confirm";
    await updateState(this.userId, state);

    const summary = `
📋 **تأكيد الطلب**
الاسم: ${state.collected.name}
الهاتف: ${state.collected.phone}
العنوان: ${state.collected.address}
المدينة: ${state.collected.city}
    `;
    await sendQuickReplies(this.userId, summary, [
      { content_type: "text", title: "✅ تأكيد", payload: "CONFIRM_ORDER" },
      { content_type: "text", title: "❌ إلغاء", payload: "CANCEL_ORDER" },
    ]);
    return true;
  }

  private async handleConfirm(state: OrderState, input: string) {
    const normalized = input.trim().toLowerCase();
    if (normalized === "confirm_order" || normalized === "تأكيد" || normalized === "✅") {
      const order = await orderRepo.create({
        customerName: state.collected.name!,
        phone: state.collected.phone!,
        address: state.collected.address!,
        city: state.collected.city,
        productId: state.productId || undefined,
        userId: this.userId,
        source: "messenger",
      });
      state.step = "completed";
      state.completed = true;
      await updateState(this.userId, state);
      await sendText(this.userId, `✅ تم استلام طلبك رقم #${order.id.slice(-6)}. سنتواصل معك قريباً. شكراً لك!`);
      return true;
    } else if (normalized === "cancel_order" || normalized === "إلغاء" || normalized === "❌") {
      await clearState(this.userId);
      await sendText(this.userId, "❌ تم إلغاء الطلب. يمكنك البدء من جديد في أي وقت.");
      return true;
    } else {
      await sendText(this.userId, "الرجاء الضغط على تأكيد أو إلغاء.");
      return false;
    }
  }
}