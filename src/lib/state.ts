// src/lib/state.ts
// تخزين الحالة في ملف منفصل لمنع فقدانها

type OrderState = {
  step: string;
  collected: {
    name?: string;
    phone?: string;
    address?: string;
    city?: string;
  };
  productId?: string | null;
};

// استخدام global object لمنع فقدان الحالة
const globalForState = globalThis as unknown as {
  userState: Map<string, OrderState>;
};

if (!globalForState.userState) {
  globalForState.userState = new Map<string, OrderState>();
}

export const userState = globalForState.userState;

export function getUserState(senderId: string): OrderState | null {
  return userState.get(senderId) || null;
}

export function setUserState(senderId: string, state: OrderState | null) {
  if (state === null) {
    userState.delete(senderId);
  } else {
    userState.set(senderId, state);
  }
}

export function clearUserState(senderId: string) {
  userState.delete(senderId);
}