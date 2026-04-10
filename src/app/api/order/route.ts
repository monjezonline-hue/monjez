import { prisma } from "@/lib/prisma";
import { OrderStatus, Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

// =====================================================
// TYPES
// =====================================================
type OrderWhereInput = {
  status?: OrderStatus;
  city?: { contains: string; mode: "insensitive" };
  OR?: Array<{
    customerName?: { contains: string; mode: "insensitive" };
    phone?: { contains: string; mode: "insensitive" };
    address?: { contains: string; mode: "insensitive" };
  }>;
  createdAt?: {
    gte?: Date;
    lte?: Date;
  };
};

type StatusGroup = {
  status: OrderStatus;
  count: number;
};

type CityGroup = {
  city: string;
  count: number;
};

type OrderStats = {
  total: number;
  today: number;
  thisWeek: number;
  thisMonth: number;
  byStatus: StatusGroup[];
  byCity: CityGroup[];
};

// =====================================================
// GET: Fetch all orders with filtering
// =====================================================
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    
    // Filter parameters
    const status = searchParams.get("status");
    const city = searchParams.get("city");
    const search = searchParams.get("search");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const sortBy = searchParams.get("sortBy") || "createdAt";
    const sortOrder = searchParams.get("sortOrder") || "desc";
    
    // Date range
    const fromDate = searchParams.get("fromDate");
    const toDate = searchParams.get("toDate");
    
    // Check for export
    const exportFormat = searchParams.get("export");
    if (exportFormat === "csv") {
      return await handleExport(req);
    }
    
    // Pagination
    const skip = (page - 1) * limit;
    
    // Build where clause
    const where: OrderWhereInput = {};
    
    if (status && Object.values(OrderStatus).includes(status as OrderStatus)) {
      where.status = status as OrderStatus;
    }
    
    if (city) {
      where.city = { contains: city, mode: "insensitive" };
    }
    
    if (search) {
      where.OR = [
        { customerName: { contains: search, mode: "insensitive" } },
        { phone: { contains: search, mode: "insensitive" } },
        { address: { contains: search, mode: "insensitive" } },
      ];
    }
    
    if (fromDate || toDate) {
      where.createdAt = {};
      if (fromDate) where.createdAt.gte = new Date(fromDate);
      if (toDate) where.createdAt.lte = new Date(toDate + "T23:59:59");
    }
    
    // Execute queries in parallel
    const [orders, totalCount, stats] = await Promise.all([
      prisma.order.findMany({
        where: where as Prisma.OrderWhereInput,
        include: {
          product: {
            select: {
              name: true,
              price: true,
              image: true,
            },
          },
          user: {
            select: {
              name: true,
              email: true,
            },
          },
        },
        orderBy: {
          [sortBy]: sortOrder,
        },
        skip,
        take: limit,
      }),
      prisma.order.count({ where: where as Prisma.OrderWhereInput }),
      getOrderStats(where as Prisma.OrderWhereInput),
    ]);
    
    return NextResponse.json({
      success: true,
      data: orders,
      pagination: {
        page,
        limit,
        total: totalCount,
        pages: Math.ceil(totalCount / limit),
      },
      stats,
    });
  } catch (error) {
    console.error("❌ GET Orders Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch orders" },
      { status: 500 }
    );
  }
}

// =====================================================
// POST: Create new order (manual from dashboard)
// =====================================================
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    const {
      customerName,
      phone,
      address,
      city,
      productId,
      userId,
      source = "dashboard_manual",
    } = body;
    
    // Validation
    if (!customerName || !phone || !address) {
      return NextResponse.json(
        { success: false, error: "Missing required fields: customerName, phone, address" },
        { status: 400 }
      );
    }
    
    // Check if product exists (if provided)
    if (productId) {
      const product = await prisma.product.findUnique({
        where: { id: productId },
      });
      
      if (!product) {
        return NextResponse.json(
          { success: false, error: "Product not found" },
          { status: 404 }
        );
      }
    }
    
    // Create order
    const order = await prisma.order.create({
      data: {
        customerName,
        phone,
        address,
        city: city || "غير محدد",
        productId: productId || null,
        userId: userId || process.env.SHOP_DEFAULT_USER_ID || "",
        source,
        status: OrderStatus.NEW,
      },
      include: {
        product: true,
      },
    });
    
    // Track event
    await prisma.eventLog.create({
      data: {
        type: "ORDER_CREATED_MANUAL",
        userId: userId || process.env.SHOP_DEFAULT_USER_ID,
        productId: productId || null,
      },
    });
    
    return NextResponse.json({
      success: true,
      data: order,
    }, { status: 201 });
  } catch (error) {
    console.error("❌ POST Order Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create order" },
      { status: 500 }
    );
  }
}

// =====================================================
// DELETE: Bulk delete orders
// =====================================================
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const ids = searchParams.get("ids");
    
    if (!ids) {
      return NextResponse.json(
        { success: false, error: "Missing ids parameter" },
        { status: 400 }
      );
    }
    
    const orderIds = ids.split(",");
    
    const deleted = await prisma.order.deleteMany({
      where: {
        id: { in: orderIds },
      },
    });
    
    return NextResponse.json({
      success: true,
      deletedCount: deleted.count,
    });
  } catch (error) {
    console.error("❌ DELETE Orders Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete orders" },
      { status: 500 }
    );
  }
}

// =====================================================
// PATCH: Bulk update orders status
// =====================================================
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { ids, status } = body;
    
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { success: false, error: "Missing ids array" },
        { status: 400 }
      );
    }
    
    if (!status || !Object.values(OrderStatus).includes(status as OrderStatus)) {
      return NextResponse.json(
        { success: false, error: "Invalid status" },
        { status: 400 }
      );
    }
    
    const updated = await prisma.order.updateMany({
      where: {
        id: { in: ids },
      },
      data: {
        status: status as OrderStatus,
      },
    });
    
    return NextResponse.json({
      success: true,
      updatedCount: updated.count,
    });
  } catch (error) {
    console.error("❌ PATCH Orders Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update orders" },
      { status: 500 }
    );
  }
}

// =====================================================
// HELPER: Get order statistics
// =====================================================
async function getOrderStats(where: Prisma.OrderWhereInput): Promise<OrderStats> {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
  
  const [total, todayCount, weekCount, monthCount, byStatus, byCity] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.count({ where: { ...where, createdAt: { gte: today } } }),
    prisma.order.count({ where: { ...where, createdAt: { gte: weekAgo } } }),
    prisma.order.count({ where: { ...where, createdAt: { gte: monthAgo } } }),
    prisma.order.groupBy({
      by: ["status"],
      where,
      _count: { status: true },
    }),
    prisma.order.groupBy({
      by: ["city"],
      where: { ...where, city: { not: null } },
      _count: { city: true },
      orderBy: { _count: { city: "desc" } },
      take: 10,
    }),
  ]);
  
  return {
    total,
    today: todayCount,
    thisWeek: weekCount,
    thisMonth: monthCount,
    byStatus: byStatus.map((item: { status: OrderStatus; _count: { status: number } }) => ({
      status: item.status,
      count: item._count.status,
    })),
    byCity: byCity.map((item: { city: string | null; _count: { city: number } }) => ({
      city: item.city || "غير محدد",
      count: item._count.city,
    })),
  };
}

// =====================================================
// HELPER: Handle CSV export
// =====================================================
export async function handleExport(req: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const fromDate = searchParams.get("fromDate");
    const toDate = searchParams.get("toDate");
    
    const where: Prisma.OrderWhereInput = {};
    
    if (status && Object.values(OrderStatus).includes(status as OrderStatus)) {
      where.status = status as OrderStatus;
    }
    
    if (fromDate || toDate) {
      where.createdAt = {};
      if (fromDate) where.createdAt.gte = new Date(fromDate);
      if (toDate) where.createdAt.lte = new Date(toDate + "T23:59:59");
    }
    
    const orders = await prisma.order.findMany({
      where,
      include: {
        product: { select: { name: true, price: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    
    // CSV headers
    const headers = [
      "ID",
      "اسم العميل",
      "رقم الموبايل",
      "العنوان",
      "المدينة",
      "المنتج",
      "السعر",
      "الحالة",
      "المصدر",
      "تاريخ الإنشاء",
    ];
    
    const rows = orders.map((order: {
      id: string;
      customerName: string;
      phone: string;
      address: string;
      city: string | null;
      product: { name: string; price: number } | null;
      status: OrderStatus;
      source: string | null;
      createdAt: Date;
    }) => [
      order.id,
      order.customerName,
      order.phone,
      order.address,
      order.city || "",
      order.product?.name || "",
      order.product?.price?.toString() || "",
      order.status,
      order.source || "",
      new Date(order.createdAt).toLocaleString("ar-EG"),
    ]);
    
    const csvContent = [
      headers.join(","),
      ...rows.map((row: string[]) => row.map((cell: string) => `"${String(cell).replace(/"/g, '""')}"`).join(",")),
    ].join("\n");
    
    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="orders_${new Date().toISOString().split("T")[0]}.csv"`,
      },
    });
  } catch (error) {
    console.error("❌ Export Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to export orders" },
      { status: 500 }
    );
  }
}