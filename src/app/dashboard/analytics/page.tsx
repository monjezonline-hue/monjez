// src/app/dashboard/analytics/page.tsx
export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";

// =====================================================
// TYPES
// =====================================================
type CityStat = {
  city: string;
  count: number;
};

type ProductStat = {
  productId: string | null;
  count: number;
};

type AnalyticsData = {
  totalOrders: number;
  todayOrders: number;
  weekOrders: number;
  monthOrders: number;
  byCity: CityStat[];
  byProduct: ProductStat[];
};

// =====================================================
// GET ANALYTICS DATA
// =====================================================
async function getAnalytics(): Promise<AnalyticsData> {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [totalOrders, todayOrders, weekOrders, monthOrders, byCity, byProduct] = await Promise.all([
    prisma.order.count(),
    prisma.order.count({ where: { createdAt: { gte: today } } }),
    prisma.order.count({ where: { createdAt: { gte: weekAgo } } }),
    prisma.order.count({ where: { createdAt: { gte: monthAgo } } }),
    prisma.order.groupBy({
      by: ["city"],
      _count: { city: true },
      orderBy: { _count: { city: "desc" } },
      take: 10,
    }),
    prisma.order.groupBy({
      by: ["productId"],
      _count: { productId: true },
      orderBy: { _count: { productId: "desc" } },
      take: 10,
    }),
  ]);

  return {
    totalOrders,
    todayOrders,
    weekOrders,
    monthOrders,
    byCity: byCity.map((item: { city: string | null; _count: { city: number } }) => ({ 
      city: item.city || "غير محدد", 
      count: item._count.city 
    })),
    byProduct: byProduct.map((item: { productId: string | null; _count: { productId: number } }) => ({ 
      productId: item.productId, 
      count: item._count.productId 
    })),
  };
}

// =====================================================
// PAGE COMPONENT
// =====================================================
export default async function AnalyticsPage() {
  const analytics = await getAnalytics();

  return (
    <div className="min-h-screen bg-slate-50" dir="rtl">
      <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-linear-to-br from-indigo-600 to-violet-600 text-sm font-bold text-white">
              M
            </div>
            <h1 className="text-base font-semibold text-slate-900">Monjez - التحليلات</h1>
          </div>
          <nav className="flex items-center gap-4 text-sm">
            <a href="/dashboard" className="text-slate-500 transition hover:text-slate-800">
              الطلبات
            </a>
            <a href="/dashboard/analytics" className="font-medium text-indigo-600">
              التحليلات
            </a>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <h2 className="text-2xl font-bold tracking-tight text-slate-900 mb-6">📊 إحصائيات الطلبات</h2>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
          <div className="rounded-2xl border bg-white p-6 shadow-sm">
            <p className="text-sm text-slate-500">إجمالي الطلبات</p>
            <p className="mt-2 text-3xl font-semibold">{analytics.totalOrders}</p>
          </div>
          <div className="rounded-2xl border bg-white p-6 shadow-sm">
            <p className="text-sm text-slate-500">اليوم</p>
            <p className="mt-2 text-3xl font-semibold text-amber-600">{analytics.todayOrders}</p>
          </div>
          <div className="rounded-2xl border bg-white p-6 shadow-sm">
            <p className="text-sm text-slate-500">آخر 7 أيام</p>
            <p className="mt-2 text-3xl font-semibold text-indigo-600">{analytics.weekOrders}</p>
          </div>
          <div className="rounded-2xl border bg-white p-6 shadow-sm">
            <p className="text-sm text-slate-500">آخر 30 يوم</p>
            <p className="mt-2 text-3xl font-semibold text-emerald-600">{analytics.monthOrders}</p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold mb-4">🏙️ الطلبات حسب المدينة</h3>
            <div className="space-y-3">
              {analytics.byCity.map((city: CityStat) => (
                <div key={city.city} className="flex justify-between items-center">
                  <span className="text-slate-700">{city.city}</span>
                  <span className="font-semibold text-indigo-600">{city.count} طلب</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold mb-4">🛍️ أكثر المنتجات مبيعاً</h3>
            <div className="space-y-3">
              {analytics.byProduct.map((product: ProductStat) => (
                <div key={product.productId || "unknown"} className="flex justify-between items-center">
                  <span className="text-slate-700">منتج {product.productId?.slice(-6) || "غير معروف"}</span>
                  <span className="font-semibold text-emerald-600">{product.count} مرة</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}