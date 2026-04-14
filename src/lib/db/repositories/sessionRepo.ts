// src/lib/db/repositories/sessionRepo.ts
import { prisma } from "@/lib/prisma";  // ← تغيير: استيراد مسمى
import { OrderState } from "@/lib/orderState";

export const sessionRepo = {
  async get(userId: string) {
    const session = await prisma.userSession.findUnique({ where: { userId } });
    if (!session) return null;
    return {
      id: session.id,
      userId: session.userId,
      state: JSON.parse(session.state) as OrderState,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    };
  },
  async upsert(userId: string, state: OrderState) {
    const session = await prisma.userSession.upsert({
      where: { userId },
      update: { state: JSON.stringify(state), updatedAt: new Date() },
      create: { userId, state: JSON.stringify(state) },
    });
    return {
      id: session.id,
      userId: session.userId,
      state: JSON.parse(session.state) as OrderState,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    };
  },
  async delete(userId: string) {
    await prisma.userSession.deleteMany({ where: { userId } });
  },
  async cleanupExpired(ttlMinutes: number = 30) {
    const expiryDate = new Date(Date.now() - ttlMinutes * 60 * 1000);
    const result = await prisma.userSession.deleteMany({
      where: { updatedAt: { lt: expiryDate } },
    });
    return result.count;
  },
};