// src/lib/db/repositories/orderRepo.ts
import { prisma } from "@/lib/prisma";
import { OrderStatus } from "@prisma/client"; // يُستخدم في updateStatus

export interface CreateOrderInput {
  customerName: string;
  phone: string;
  address: string;
  city?: string;
  productId?: string;
  userId: string;
  source?: string;
}

export const orderRepo = {
  async create(data: CreateOrderInput) {
    return prisma.order.create({
      data: {
        customerName: data.customerName,
        phone: data.phone,
        address: data.address,
        city: data.city,
        productId: data.productId,
        userId: data.userId,
        source: data.source || "messenger",
        status: "NEW",
      },
      include: { product: true },
    });
  },

  async findById(orderId: string) {
    return prisma.order.findUnique({
      where: { id: orderId },
      include: { product: true },
    });
  },

  async findByUser(userId: string) {
    return prisma.order.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: { product: true },
    });
  },

  async updateStatus(orderId: string, status: OrderStatus) {
    return prisma.order.update({
      where: { id: orderId },
      data: { status },
    });
  },
};