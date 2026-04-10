import { prisma } from "@/lib/prisma";
import { OrderStatus } from "@prisma/client";
import { appendOrderToSheet } from "@/lib/googleSheets";
import { NextRequest, NextResponse } from "next/server";

// =====================================================
// GET: Fetch single order
// =====================================================
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        product: true,
        user: true,
      },
    });

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    return NextResponse.json(order);
  } catch (error) {
    console.error("❌ GET Order Error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// =====================================================
// PATCH: Update order status
// =====================================================
export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await req.json();
    const { status } = body;

    if (!status || typeof status !== "string") {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    if (!Object.values(OrderStatus).includes(status as OrderStatus)) {
      return NextResponse.json({ error: "Invalid status value" }, { status: 400 });
    }

    const order = await prisma.order.update({
      where: { id },
      data: {
        status: status as OrderStatus,
      },
      include: {
        product: true,
      },
    });

    // Send to Google Sheets
    try {
      await appendOrderToSheet({
        customerName: order.customerName,
        phone: order.phone,
        address: order.address,
        city: order.city || "غير محدد",
        productName: order.product?.name || "منتج",
        productPrice: order.product?.price,
        source: "dashboard_update",
        status: order.status,
      });
    } catch (err) {
      console.error("❌ Sheets Error (ignored):", err);
    }

    return NextResponse.json({ success: true, order });
  } catch (error) {
    console.error("❌ Update Order Error:", error);
    return NextResponse.json({ error: "Error updating order" }, { status: 500 });
  }
}

// =====================================================
// POST: Legacy support (form data from dashboard)
// =====================================================
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    const formData = await req.formData();
    const status = formData.get("status");

    if (!status || typeof status !== "string") {
      return new NextResponse("Invalid status", { status: 400 });
    }

    if (!Object.values(OrderStatus).includes(status as OrderStatus)) {
      return new NextResponse("Invalid status", { status: 400 });
    }

    const order = await prisma.order.update({
      where: { id },
      data: {
        status: status as OrderStatus,
      },
      include: {
        product: true,
      },
    });

    // Send to Google Sheets
    try {
      await appendOrderToSheet({
        customerName: order.customerName,
        phone: order.phone,
        address: order.address,
        city: order.city || "غير محدد",
        productName: order.product?.name || "منتج",
        productPrice: order.product?.price,
        source: "dashboard_update",
        status: order.status,
      });
    } catch (err) {
      console.error("❌ Sheets Error (ignored):", err);
    }

    return NextResponse.redirect(new URL("/dashboard", req.url));
  } catch (error) {
    console.error("❌ Update Order Error:", error);
    return new NextResponse("Error updating order", { status: 500 });
  }
}