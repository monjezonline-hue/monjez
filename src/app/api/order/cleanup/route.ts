import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const FAKE_ORDER_PATTERNS = [
  "[رسالة واردة]",
  "[تعليق]",
  "[MESSAGE]",
  "[COMMENT]",
];

export async function POST(req: NextRequest) {
  try {
    // حذف جميع الطلبات الوهمية
    const deleted = await prisma.order.deleteMany({
      where: {
        customerName: {
          in: FAKE_ORDER_PATTERNS,
        },
      },
    });

    return NextResponse.json({
      success: true,
      deletedCount: deleted.count,
      message: `تم حذف ${deleted.count} طلب وهمي`,
    });
  } catch (error) {
    console.error("Error deleting fake orders:", error);
    return NextResponse.json(
      { success: false, error: "فشل حذف الطلبات الوهمية" },
      { status: 500 }
    );
  }
}