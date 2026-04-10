"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";

// =====================================================
// TYPES
// =====================================================
type Product = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  image: string | null;
};

// =====================================================
// MAIN COMPONENT
// =====================================================
export default function HomePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showChatModal, setShowChatModal] = useState(false);

  useEffect(() => {
    fetchProducts();
  }, []);

  async function fetchProducts() {
    try {
      const res = await fetch("/api/products");
      if (res.ok) {
        const data = await res.json();
        setProducts(data);
      }
    } catch (error) {
      console.error("Error fetching products:", error);
    } finally {
      setLoading(false);
    }
  }

  const openMessenger = () => {
    window.open("https://m.me/Monjezai", "_blank");
  };

  const openWhatsApp = () => {
    window.open("https://wa.me/218912345678", "_blank");
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-50 to-slate-100" dir="rtl">
      
      {/* HEADER */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-slate-200">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-linear-to-br from-indigo-600 to-violet-600 rounded-xl flex items-center justify-center shadow-lg">
              <span className="text-white font-bold text-xl">M</span>
            </div>
            <h1 className="text-2xl font-bold bg-linear-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">
              Monjez
            </h1>
          </div>
          
          <div className="hidden md:flex gap-6">
            <a href="#products" className="text-slate-600 hover:text-indigo-600 transition">المنتجات</a>
            <a href="#features" className="text-slate-600 hover:text-indigo-600 transition">المميزات</a>
            <a href="#contact" className="text-slate-600 hover:text-indigo-600 transition">اتصل بنا</a>
            <Link href="/dashboard" className="text-slate-600 hover:text-indigo-600 transition">لوحة التحكم</Link>
          </div>
          
          <button
            onClick={openMessenger}
            className="bg-linear-to-r from-indigo-600 to-violet-600 text-white px-6 py-2 rounded-full font-semibold hover:shadow-lg transition-all duration-300 hover:scale-105"
          >
            تواصل الآن
          </button>
        </div>
      </header>

      {/* HERO SECTION */}
      <section className="container mx-auto px-4 py-16 md:py-24">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div className="text-center md:text-right">
            <div className="inline-block px-4 py-1 bg-indigo-100 text-indigo-700 rounded-full text-sm font-semibold mb-6">
              🤖 بيع ذكي بالذكاء الاصطناعي
            </div>
            <h1 className="text-4xl md:text-6xl font-bold text-slate-900 mb-6 leading-tight">
              بوت ماسنجر <span className="text-transparent bg-clip-text bg-linear-to-r from-indigo-600 to-violet-600">يبيع نيابة عنك</span>
            </h1>
            <p className="text-xl text-slate-600 mb-8 leading-relaxed">
              حول محادثات ماسنجر إلى مبيعات تلقائية. بوت ذكي يفهم عملاءك، يرد عليهم، ويقفل الصفقات بدون تدخل منك.
            </p>
            <div className="flex gap-4 justify-center md:justify-start">
              <button
                onClick={openMessenger}
                className="bg-linear-to-r from-indigo-600 to-violet-600 text-white px-8 py-3 rounded-full font-semibold text-lg hover:shadow-xl transition-all duration-300 hover:scale-105"
              >
                جرب البوت الآن مجاناً
              </button>
              <button
                onClick={openWhatsApp}
                className="border-2 border-indigo-600 text-indigo-600 px-8 py-3 rounded-full font-semibold text-lg hover:bg-indigo-50 transition-all duration-300"
              >
                واتساب للاستفسار
              </button>
            </div>
            
            {/* Stats */}
            <div className="flex gap-8 justify-center md:justify-start mt-12">
              <div>
                <p className="text-3xl font-bold text-indigo-600">500+</p>
                <p className="text-slate-500">عميل سعيد</p>
              </div>
              <div>
                <p className="text-3xl font-bold text-indigo-600">10K+</p>
                <p className="text-slate-500">طلب منجز</p>
              </div>
              <div>
                <p className="text-3xl font-bold text-indigo-600">24/7</p>
                <p className="text-slate-500">دعم فوري</p>
              </div>
            </div>
          </div>
          
          <div className="relative">
            <div className="absolute inset-0 bg-linear-to-r from-indigo-500 to-violet-500 rounded-3xl blur-3xl opacity-20"></div>
            <div className="relative bg-white rounded-3xl shadow-2xl p-6 border border-slate-100">
              <div className="bg-slate-100 rounded-2xl p-4 mb-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-linear-to-br from-indigo-600 to-violet-600 rounded-full flex items-center justify-center">
                    <span className="text-white text-sm">M</span>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">Monjez Bot</p>
                    <p className="text-xs text-slate-500">آخر ظهور منذ لحظات</p>
                  </div>
                </div>
                <div className="bg-indigo-50 rounded-2xl p-3 mb-3">
                  <p className="text-slate-800">👋 أهلاً بيك في Monjez! تحب تشوف منتجاتنا؟</p>
                </div>
                <div className="bg-slate-100 rounded-2xl p-3">
                  <p className="text-slate-600">عايز أعرف المنتجات المتاحة</p>
                </div>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="اكتب رسالتك..."
                  className="flex-1 px-4 py-2 border border-slate-200 rounded-full focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  readOnly
                />
                <button className="bg-indigo-600 text-white px-4 py-2 rounded-full hover:bg-indigo-700 transition">
                  إرسال
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PRODUCTS SECTION */}
      <section id="products" className="bg-white py-16 md:py-24">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">🛍️ منتجاتنا</h2>
            <p className="text-xl text-slate-600">اكتشف أفضل المنتجات بأسعار مميزة</p>
          </div>
          
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-slate-500">لا توجد منتجات حالياً</p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {products.map((product) => (
                <div
                  key={product.id}
                  className="bg-white rounded-2xl shadow-lg overflow-hidden hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 border border-slate-100"
                >
                  <div className="h-56 bg-linear-to-br from-indigo-100 to-violet-100 flex items-center justify-center relative">
                    {product.image ? (
                      <Image
                        src={product.image}
                        alt={product.name}
                        fill
                        className="object-cover"
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                      />
                    ) : (
                      <div className="w-24 h-24 bg-indigo-200 rounded-2xl flex items-center justify-center">
                        <span className="text-4xl">📦</span>
                      </div>
                    )}
                  </div>
                  <div className="p-6">
                    <h3 className="text-xl font-bold text-slate-900 mb-2">{product.name}</h3>
                    <p className="text-slate-500 mb-4 line-clamp-2">{product.description || "منتج مميز بجودة عالية"}</p>
                    <div className="flex justify-between items-center">
                      <span className="text-2xl font-bold text-indigo-600">{product.price} ج.م</span>
                      <button
                        onClick={() => {
                          setSelectedProduct(product);
                          setShowChatModal(true);
                        }}
                        className="bg-indigo-600 text-white px-4 py-2 rounded-full hover:bg-indigo-700 transition text-sm"
                      >
                        اطلب الآن
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* FEATURES SECTION */}
      <section id="features" className="py-16 md:py-24">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">✨ مميزات Monjez</h2>
            <p className="text-xl text-slate-600">لماذا تختار بوت المبيعات الخاص بنا؟</p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              { icon: "🤖", title: "ذكاء اصطناعي متقدم", desc: "يفهم العملاء ويقفل البيع تلقائياً" },
              { icon: "💬", title: "رد فوري 24/7", desc: "خدمة عملاء على مدار الساعة بدون تأخير" },
              { icon: "📊", title: "لوحة تحكم", desc: "إدارة الطلبات والمبيعات من مكان واحد" },
              { icon: "📈", title: "تحليلات دقيقة", desc: "تقارير تفصيلية عن أداء البوت" },
            ].map((feature, index) => (
              <div
                key={index}
                className="bg-white rounded-2xl p-6 text-center shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 border border-slate-100"
              >
                <div className="text-5xl mb-4">{feature.icon}</div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">{feature.title}</h3>
                <p className="text-slate-500">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="bg-white py-16 md:py-24">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">🚀 كيف يعمل البوت؟</h2>
            <p className="text-xl text-slate-600">ثلاث خطوات فقط لبدء البيع التلقائي</p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { step: "01", title: "ربط البوت", desc: "اربط البوت بصفحة فيسبوك الخاصة بك في دقائق" },
              { step: "02", title: "إضافة المنتجات", desc: "أضف منتجاتك وأسعارها من لوحة التحكم" },
              { step: "03", title: "ابدأ البيع", desc: "البوت يبدأ في الرد على العملاء وإتمام الطلبات" },
            ].map((item, index) => (
              <div key={index} className="relative text-center">
                <div className="w-20 h-20 bg-linear-to-br from-indigo-600 to-violet-600 rounded-2xl flex items-center justify-center text-white text-3xl font-bold mx-auto mb-4 shadow-lg">
                  {item.step}
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">{item.title}</h3>
                <p className="text-slate-500">{item.desc}</p>
                {index < 2 && (
                  <div className="hidden md:block absolute top-10 left-[60%] w-[30%]">
                    <div className="h-0.5 bg-linear-to-r from-indigo-300 to-violet-300"></div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA SECTION */}
      <section className="bg-linear-to-r from-indigo-600 to-violet-600 py-16 md:py-24">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">جاهز تبدأ البيع التلقائي؟</h2>
          <p className="text-xl text-indigo-100 mb-8">جرب البوت الآن مجاناً وابدأ في تحقيق المبيعات</p>
          <button
            onClick={openMessenger}
            className="bg-white text-indigo-600 px-8 py-3 rounded-full font-semibold text-lg hover:shadow-xl transition-all duration-300 hover:scale-105"
          >
            ابدأ الآن مجاناً
          </button>
        </div>
      </section>

      {/* FOOTER */}
      <footer id="contact" className="bg-slate-900 text-white py-12">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-10 h-10 bg-linear-to-br from-indigo-600 to-violet-600 rounded-xl flex items-center justify-center">
                  <span className="text-white font-bold text-xl">M</span>
                </div>
                <h3 className="text-xl font-bold">Monjez</h3>
              </div>
              <p className="text-slate-400">بوت مبيعات ذكي لمتجرك على ماسنجر</p>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4">روابط سريعة</h4>
              <ul className="space-y-2 text-slate-400">
                <li><a href="#products" className="hover:text-white transition">المنتجات</a></li>
                <li><a href="#features" className="hover:text-white transition">المميزات</a></li>
                <li><Link href="/dashboard" className="hover:text-white transition">لوحة التحكم</Link></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4">تواصل معنا</h4>
              <ul className="space-y-2 text-slate-400">
                <li>
                  <button onClick={openMessenger} className="hover:text-white transition">💬 ماسنجر</button>
                </li>
                <li>
                  <button onClick={openWhatsApp} className="hover:text-white transition">📱 واتساب: +218912345678</button>
                </li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4">تابعنا</h4>
              <div className="flex gap-4">
                <a href="#" className="w-10 h-10 bg-slate-800 rounded-full flex items-center justify-center hover:bg-indigo-600 transition">
                  📘
                </a>
                <a href="#" className="w-10 h-10 bg-slate-800 rounded-full flex items-center justify-center hover:bg-indigo-600 transition">
                  📷
                </a>
              </div>
            </div>
          </div>
          
          <div className="border-t border-slate-800 mt-8 pt-8 text-center text-slate-500 text-sm">
            <p>© 2024 Monjez. جميع الحقوق محفوظة</p>
          </div>
        </div>
      </footer>

      {/* PRODUCT MODAL */}
      {showChatModal && selectedProduct && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowChatModal(false)}>
          <div className="bg-white rounded-2xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <div className="text-center mb-4">
              <div className="w-16 h-16 bg-linear-to-br from-indigo-600 to-violet-600 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <span className="text-3xl">🛍️</span>
              </div>
              <h3 className="text-xl font-bold text-slate-900">طلب منتج</h3>
              <p className="text-slate-500 mt-2">هل تريد طلب <span className="font-semibold text-indigo-600">{selectedProduct.name}</span> بسعر <span className="font-semibold">{selectedProduct.price} ج.م</span>؟</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowChatModal(false);
                  openMessenger();
                }}
                className="flex-1 bg-linear-to-r from-indigo-600 to-violet-600 text-white py-3 rounded-full font-semibold hover:shadow-lg transition"
              >
                نعم، أريد الطلب
              </button>
              <button
                onClick={() => setShowChatModal(false)}
                className="flex-1 border border-slate-200 text-slate-600 py-3 rounded-full font-semibold hover:bg-slate-50 transition"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}