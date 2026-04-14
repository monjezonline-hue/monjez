export const dynamic = "force-dynamic";

import type { ReactNode } from "react";
import { prisma } from "@/lib/prisma";
import type { OrderStatus } from "@prisma/client";

// =====================================================
// TYPES
// =====================================================
type OrderWithProduct = {
  id: string;
  customerName: string;
  phone: string;
  address: string;
  city: string | null;
  status: OrderStatus;
  source: string | null;
  createdAt: Date;
  product: { name: string; price: number } | null;
};

const SALES_STATUSES: OrderStatus[] = ["CONFIRMED", "SHIPPED", "DELIVERED"];

// ✅ قائمة بالطلبات الوهمية التي يجب استبعادها
const FAKE_ORDER_PATTERNS = [
  "[رسالة واردة]",
  "[تعليق]",
  "[MESSAGE]",
  "[COMMENT]",
];

function isFakeOrder(customerName: string): boolean {
  return FAKE_ORDER_PATTERNS.some(pattern => customerName === pattern);
}

function formatMoney(n: number) {
  return new Intl.NumberFormat("ar-EG", {
    maximumFractionDigits: 0,
  }).format(n);
}

function StatCard({
  title,
  value,
  subtitle,
  accent,
  icon,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  accent: "indigo" | "amber" | "emerald";
  icon: ReactNode;
}) {
  const ring =
    accent === "indigo"
      ? "from-indigo-500/10 to-violet-500/5 ring-indigo-500/10"
      : accent === "amber"
        ? "from-amber-500/10 to-orange-500/5 ring-amber-500/10"
        : "from-emerald-500/10 to-teal-500/5 ring-emerald-500/10";

  const iconBg =
    accent === "indigo"
      ? "bg-indigo-500 text-white shadow-indigo-500/25"
      : accent === "amber"
        ? "bg-amber-500 text-white shadow-amber-500/25"
        : "bg-emerald-500 text-white shadow-emerald-500/25";

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-slate-200/80 bg-linear-to-br ${ring} p-6 shadow-sm ring-1 backdrop-blur-sm`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-900 tabular-nums">
            {value}
          </p>
          {subtitle ? (
            <p className="mt-1 text-xs text-slate-400">{subtitle}</p>
          ) : null}
        </div>
        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl shadow-lg ${iconBg}`}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}

function StatusActionButtons({
  orderId,
  current,
}: {
  orderId: string;
  current: OrderStatus;
}) {
  const actions: { status: OrderStatus; label: string; className: string }[] =
    [
      {
        status: "NEW",
        label: "جديد",
        className:
          current === "NEW"
            ? "bg-amber-500 text-white ring-2 ring-amber-300 ring-offset-2"
            : "bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200/80",
      },
      {
        status: "CONFIRMED",
        label: "تأكيد",
        className:
          current === "CONFIRMED"
            ? "bg-violet-500 text-white ring-2 ring-violet-300 ring-offset-2"
            : "bg-violet-50 text-violet-800 hover:bg-violet-100 border border-violet-200/80",
      },
      {
        status: "SHIPPED",
        label: "شحن",
        className:
          current === "SHIPPED"
            ? "bg-emerald-600 text-white ring-2 ring-emerald-300 ring-offset-2"
            : "bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200/80",
      },
      {
        status: "DELIVERED",
        label: "تسليم",
        className:
          current === "DELIVERED"
            ? "bg-teal-600 text-white ring-2 ring-teal-300 ring-offset-2"
            : "bg-teal-50 text-teal-800 hover:bg-teal-100 border border-teal-200/80",
      },
      {
        status: "CANCELED",
        label: "إلغاء",
        className:
          current === "CANCELED"
            ? "bg-rose-600 text-white ring-2 ring-rose-300 ring-offset-2"
            : "bg-rose-50 text-rose-800 hover:bg-rose-100 border border-rose-200/80",
      },
    ];

  return (
    <div className="flex flex-wrap items-center gap-2 justify-end">
      {actions.map(({ status, label, className }) => (
        <form
          key={status}
          action={`/api/orders/${orderId}`}
          method="POST"
          className="inline"
        >
          <input type="hidden" name="status" value={status} />
          <button
            type="submit"
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${className}`}
          >
            {label}
          </button>
        </form>
      ))}
    </div>
  );
}

function statusBadge(status: OrderStatus) {
  const map: Record<OrderStatus, { label: string; className: string }> = {
    NEW: { label: "جديد", className: "bg-sky-100 text-sky-800 ring-sky-600/15" },
    CONFIRMED: {
      label: "تم التأكيد",
      className: "bg-violet-100 text-violet-800 ring-violet-600/15",
    },
    SHIPPED: {
      label: "تم الشحن",
      className: "bg-emerald-100 text-emerald-800 ring-emerald-600/15",
    },
    DELIVERED: {
      label: "تم التوصيل",
      className: "bg-teal-100 text-teal-800 ring-teal-600/15",
    },
    CANCELED: {
      label: "ملغي",
      className: "bg-rose-100 text-rose-800 ring-rose-600/15",
    },
  };
  const s = map[status];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${s.className}`}
    >
      {s.label}
    </span>
  );
}

export default async function DashboardPage() {
  // ✅ جلب جميع الطلبات
  const allOrders = await prisma.order.findMany({
    orderBy: { createdAt: "desc" },
    include: { product: true },
  });

  // ✅ فلترة الطلبات الحقيقية فقط
  const realOrders = allOrders.filter(
    (order) => !isFakeOrder(order.customerName)
  );

  const totalOrders = realOrders.length;
  const newOrders = realOrders.filter((o: OrderWithProduct) => o.status === "NEW").length;
  const totalSales = realOrders.reduce((sum: number, o: OrderWithProduct) => {
    if (!SALES_STATUSES.includes(o.status)) return sum;
    const p = o.product?.price;
    return sum + (typeof p === "number" ? p : 0);
  }, 0);

  // ✅ إحصائية عدد الطلبات الوهمية (للتذكير فقط)
  const fakeOrdersCount = allOrders.length - realOrders.length;

  return (
    <div className="min-h-screen bg-slate-50" dir="rtl">
      <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-linear-to-br from-indigo-600 to-violet-600 text-sm font-bold text-white shadow-md shadow-indigo-500/30">
              M
            </div>
            <div>
              <h1 className="text-base font-semibold text-slate-900">
                Monjez
              </h1>
              <p className="text-xs text-slate-500">لوحة الطلبات</p>
            </div>
          </div>
          <nav className="flex items-center gap-4 text-sm">
            <a
              href="/dashboard"
              className="font-medium text-indigo-600"
            >
              الطلبات
            </a>
            <a
              href="/dashboard/analytics"
              className="text-slate-500 transition hover:text-slate-800"
            >
              التحليلات
            </a>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">
              نظرة عامة
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              إدارة الطلبات والحالات في مكان واحد
            </p>
          </div>
          {fakeOrdersCount > 0 && (
            <div className="rounded-lg bg-amber-50 px-4 py-2 text-sm text-amber-700 border border-amber-200">
              ⚠️ {fakeOrdersCount} طلب وهمي (تم استبعادهم من الإحصائيات)
            </div>
          )}
        </div>

        <div className="mb-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard
            title="إجمالي الطلبات"
            value={totalOrders}
            subtitle="الطلبات الحقيقية فقط"
            accent="indigo"
            icon={
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
                aria-hidden
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                />
              </svg>
            }
          />
          <StatCard
            title="الطلبات الجديدة"
            value={newOrders}
            subtitle="بحالة NEW (قيد المعالجة)"
            accent="amber"
            icon={
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
                aria-hidden
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            }
          />
          <StatCard
            title="إجمالي المبيعات"
            value={`${formatMoney(totalSales)} ج.م`}
            subtitle="من الطلبات المؤكدة / المشحونة / المسلمة"
            accent="emerald"
            icon={
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
                aria-hidden
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            }
          />
        </div>

        <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm shadow-slate-200/50">
          <div className="border-b border-slate-100 px-6 py-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">الطلبات الحقيقية</h3>
                <p className="text-sm text-slate-500">
                  استخدم الأزرار لتعيين الحالة بسرعة
                </p>
              </div>
              <div className="flex gap-2">
                <a
                  href="/api/orders?export=csv"
                  download
                  className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600 transition"
                >
                  📥 تصدير Excel
                </a>
                {fakeOrdersCount > 0 && (
                  <form action="/api/orders/cleanup" method="POST">
                    <button
                      type="submit"
                      className="rounded-lg bg-rose-500 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-600 transition"
                      onClick={(e) => {
                        if (!confirm(`⚠️ هل أنت متأكد من حذف ${fakeOrdersCount} طلب وهمي؟\nهذه العملية لا يمكن التراجع عنها.`)) {
                          e.preventDefault();
                        }
                      }}
                    >
                      🗑️ حذف الطلبات الوهمية
                    </button>
                  </form>
                )}
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-215 text-right text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/80">
                  <th className="px-4 py-3 font-semibold text-slate-600">
                    الاسم
                  </th>
                  <th className="px-4 py-3 font-semibold text-slate-600">
                    الموبايل
                  </th>
                  <th className="px-4 py-3 font-semibold text-slate-600">
                    العنوان
                  </th>
                  <th className="px-4 py-3 font-semibold text-slate-600">
                    المدينة
                  </th>
                  <th className="px-4 py-3 font-semibold text-slate-600">
                    المنتج
                  </th>
                  <th className="px-4 py-3 font-semibold text-slate-600">
                    الحالة
                  </th>
                  <th className="px-4 py-3 font-semibold text-slate-600">
                    تغيير الحالة
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {realOrders.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-12 text-center text-slate-500"
                    >
                      لا توجد طلبات حقيقية بعد
                    </td>
                  </tr>
                ) : (
                  realOrders.map((order: OrderWithProduct) => (
                    <tr
                      key={order.id}
                      className="transition hover:bg-slate-50/80"
                    >
                      <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-900">
                        {order.customerName}
                      </td>
                      <td className="max-w-35 truncate px-4 py-3 text-slate-600 font-mono text-xs">
                        {order.phone}
                      </td>
                      <td className="max-w-xs px-4 py-3 text-slate-600">
                        <span className="line-clamp-2">{order.address}</span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                        {order.city || "غير محدد"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                        {order.product?.name ?? "—"}
                        {order.product != null ? (
                          <span className="mr-2 text-xs text-slate-400">
                            ({formatMoney(order.product.price)} ج.م)
                          </span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
                        {statusBadge(order.status)}
                      </td>
                      <td className="px-4 py-3">
                        <StatusActionButtons
                          orderId={order.id}
                          current={order.status}
                        />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}