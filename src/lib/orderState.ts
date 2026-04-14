// src/lib/orderState.ts
import { sessionRepo } from "@/lib/db/repositories/sessionRepo";

export type OrderStep =
  | "idle"
  | "name"
  | "phone"
  | "address"
  | "city"
  | "confirm"
  | "completed";

export interface OrderState {
  step: OrderStep;
  collected: {
    name?: string;
    phone?: string;
    address?: string;
    city?: string;
  };
  productId?: string | null;
  completed?: boolean;
  updatedAt?: number;
}

const STATE_TTL_MS = 30 * 60 * 1000;

function isExpired(state: OrderState): boolean {
  if (!state.updatedAt) return true;
  return Date.now() - state.updatedAt > STATE_TTL_MS;
}

function withTimestamp(state: OrderState): OrderState {
  return {
    ...state,
    updatedAt: Date.now(),
  };
}

export async function getState(userId: string): Promise<OrderState | null> {
  const session = await sessionRepo.get(userId);
  if (!session) return null;
  if (isExpired(session.state)) {
    await sessionRepo.delete(userId);
    return null;
  }
  return session.state;
}

export async function setState(userId: string, state: OrderState) {
  await sessionRepo.upsert(userId, withTimestamp(state));
}

export async function updateState(userId: string, partial: Partial<OrderState>) {
  const current = await getState(userId);
  if (!current) return;
  const updated: OrderState = {
    ...current,
    ...partial,
    collected: {
      ...current.collected,
      ...partial.collected,
    },
  };
  await setState(userId, updated);
}

export async function clearState(userId: string) {
  await sessionRepo.delete(userId);
}

export function createInitialState(productId?: string | null): OrderState {
  return {
    step: "name",
    collected: {},
    productId: productId || null,
    completed: false,
    updatedAt: Date.now(),
  };
}