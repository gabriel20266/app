import { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import confetti from 'canvas-confetti';
import { 
  Plus, 
  Search, 
  Bell, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  Trash2, 
  Edit3, 
  Calendar, 
  Package, 
  Tag, 
  X,
  AlertCircle
} from 'lucide-react';
import { Product, Category, CATEGORY_ICONS } from './types';

// Constants
const STORAGE_KEY = "validade_products";

const STATUS_CONFIG = {
  EXPIRED: { color: "#ef4444", bg: "#fef2f2", border: "#fee2e2", priority: 0 },
  CRITICAL: { color: "#f97316", bg: "#fff7ed", border: "#ffedd5", priority: 2 },
  SOON: { color: "#f59e0b", bg: "#fffbeb", border: "#fef3c7", priority: 3 },
  SAFE: { color: "#10b981", bg: "#ecfdf5", border: "#d1fae5", priority: 5 },
};

// Utils
const getDays = (dateStr: string) => {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const exp = new Date(dateStr); exp.setHours(0, 0, 0, 0);
  return Math.round((exp.getTime() - today.getTime()) / 86400000);
};

const getStatus = (days: number) => {
  if (days < 0) return { label: `Expirado há ${Math.abs(days)}d`, ...STATUS_CONFIG.EXPIRED, progress: 0 };
  if (days === 0) return { label: "Expira HOJE!", color: "#dc2626", bg: "#fef2f2", border: "#fecaca", priority: 1, progress: 2 };
  if (days <= 3) return { label: `${days}d restantes`, ...STATUS_CONFIG.CRITICAL, progress: 15 };
  if (days <= 7) return { label: `${days}d restantes`, ...STATUS_CONFIG.SOON, progress: 30 };
  if (days <= 30) return { label: `${days}d restantes`, color: "#84cc16", bg: "#f7fee7", border: "#ecfccb", priority: 4, progress: 65 };
  return { label: `${days}d restantes`, ...STATUS_CONFIG.SAFE, progress: 100 };
};

const formatDate = (dateStr: string) => {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("pt-PT", { day: "2-digit", month: "short", year: "numeric" });
};

export default function App() {
  const [products, setProducts] = useState<Product[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  });
  
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteProduct, setDeleteProduct] = useState<Product | null>(null);
  
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("Todos");
  const [sortBy, setSortBy] = useState("expiry");
  const [toast, setToast] = useState<string | null>(null);
  const [hasNotifPermission, setHasNotifPermission] = useState<PermissionState | "unsupported">("prompt");

  // Check initial notification status
  useEffect(() => {
    if (!("Notification" in window)) {
      setHasNotifPermission("unsupported");
    } else {
      setHasNotifPermission(Notification.permission);
    }
  }, []);

  // Persistence
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(products));
  }, [products]);

  // Toast auto-hide
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const showNotification = (msg: string) => setToast(msg);

  const requestNotifPermission = async () => {
    if (!("Notification" in window)) {
      showNotification("Notificações não suportadas!");
      return;
    }
    const permission = await Notification.requestPermission();
    setHasNotifPermission(permission);
    if (permission === "granted") {
      showNotification("Notificações ativadas! 🔔");
      checkCriticalItems(products);
    }
  };

  const checkCriticalItems = (items: Product[]) => {
    if (Notification.permission !== "granted") return;
    const urgent = items.filter(p => { const d = getDays(p.expiry); return d >= 0 && d <= 3; });
    if (urgent.length > 0) {
      new Notification("ValidadeApp: Alerta de Itens", {
        body: `Tens ${urgent.length} item(s) com validade crítica a terminar em breve!`,
        icon: "/favicon.ico"
      });
    }
  };

  // Stats
  const stats = useMemo(() => {
    const expired = products.filter(p => getDays(p.expiry) < 0).length;
    const soon = products.filter(p => { const d = getDays(p.expiry); return d >= 0 && d <= 7; }).length;
    const safe = products.filter(p => getDays(p.expiry) > 7).length;
    return { expired, soon, safe };
  }, [products]);

  const criticalProducts = products.filter(p => { const d = getDays(p.expiry); return d >= 0 && d <= 3; });
  const expiredProducts = products.filter(p => getDays(p.expiry) < 0);

  // Filtering and Sorting
  const filteredProducts = useMemo(() => {
    return products
      .filter(p => p.name.toLowerCase().includes(search.toLowerCase()) && (filterCat === "Todos" || p.category === filterCat))
      .sort((a, b) => {
        if (sortBy === "name") return a.name.localeCompare(b.name);
        if (sortBy === "status") return getStatus(getDays(a.expiry)).priority - getStatus(getDays(b.expiry)).priority;
        return new Date(a.expiry).getTime() - new Date(b.expiry).getTime();
      });
  }, [products, search, filterCat, sortBy]);

  const groupedProducts = useMemo(() => {
    return [
      { id: "urgent", label: "🚨 Atenção Imediata", items: filteredProducts.filter(p => getDays(p.expiry) <= 3) },
      { id: "soon", label: "⚠️ A Expirar em Breve", items: filteredProducts.filter(p => { const d = getDays(p.expiry); return d > 3 && d <= 30; }) },
      { id: "safe", label: "✅ Em Segurança", items: filteredProducts.filter(p => getDays(p.expiry) > 30) },
    ];
  }, [filteredProducts]);

  const handleSave = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get("name") as string,
      expiry: formData.get("expiry") as string,
      category: formData.get("category") as string,
      quantity: formData.get("quantity") as string,
      unit: formData.get("unit") as string,
    };

    if (editId) {
      setProducts(prev => prev.map(p => p.id === editId ? { ...p, ...data } : p));
      showNotification("Produto atualizado! ✅");
    } else {
      setProducts(prev => [...prev, { ...data, id: Date.now().toString() }]);
      showNotification("Produto adicionado! ✅");
      
      // Joyful feedback
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#0ea5e9', '#38bdf8', '#0284c7']
      });
    }
    setShowForm(false);
    setEditId(null);
  };

  const handleDelete = () => {
    if (deleteProduct) {
      setProducts(prev => prev.filter(p => p.id !== deleteProduct.id));
      setDeleteProduct(null);
      showNotification("Produto eliminado! 🗑️");
    }
  };

  const openEdit = (p: Product) => {
    setEditId(p.id);
    setShowForm(true);
  };

  return (
    <div className="flex min-h-screen">
      {/* Sidebar - Desktop Only for now based on theme */}
      <aside className="hidden lg:flex w-[260px] bg-sidebar text-slate-100 flex-col py-8 px-6 border-r border-slate-800">
        <div className="flex items-center gap-3 mb-12 text-primary font-extrabold text-xl tracking-tight">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-sidebar shadow-md shadow-primary/20">📅</div>
          VALIDADES
        </div>
        
        <nav className="space-y-1">
          <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-slate-800/60 text-white font-semibold cursor-pointer">
            Overview
          </div>
          <div className="flex items-center gap-3 px-4 py-3 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white transition-all cursor-pointer">
            Projetos <span className="ml-auto text-[11px] font-bold bg-primary/20 text-primary px-2 py-0.5 rounded-full">{products.length}</span>
          </div>
        </nav>

        <div className="mt-auto pt-6 border-t border-slate-800">
          <button className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white transition-all">
            Definições
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-h-0 bg-bg">
        {/* Header / Top Bar */}
        <header className="sticky top-0 z-50 bg-bg/80 backdrop-blur-md border-b border-border py-6 px-8">
          <div className="max-w-[1024px] mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-black tracking-tight m-0 text-text bg-linear-to-r from-primary to-primary-dark bg-clip-text text-transparent">ValidadeApp</h1>
              <p className="text-muted m-0 mt-1 text-sm font-medium">Bem-vindo. Aqui estão as suas validades para hoje.</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="relative hidden md:block">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" size={14} />
                <input 
                  type="text" 
                  placeholder="Pesquisar..." 
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-11 pr-4 py-2.5 rounded-full border border-border text-sm w-[200px] focus:ring-2 focus:ring-primary/20 focus:border-primary outline-hidden transition-all bg-white"
                />
              </div>
              {hasNotifPermission === "granted" ? (
                <div className="flex items-center gap-2 px-4 py-2.5 rounded-full text-green-600 font-bold text-xs bg-green-50 border border-green-100">
                  <Bell size={14} className="animate-pulse" /> Alertas ON
                </div>
              ) : (
                <button 
                  onClick={requestNotifPermission}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-full text-primary font-bold text-xs bg-primary/10 border border-primary/20 hover:bg-primary/20 transition-all shrink-0"
                  title="Ativar alertas de validade"
                >
                  <Bell size={14} /> Ativar Alertas
                </button>
              )}
              <button 
                onClick={() => { setEditId(null); setShowForm(true); }}
                className="flex items-center gap-2 px-5 py-2.5 rounded-full text-white font-bold text-sm bg-primary hover:bg-primary-dark transition-all shadow-md shadow-primary/20 shrink-0"
              >
                <Plus size={18} /> Novo
              </button>
            </div>
          </div>
        </header>

        <main className="max-w-[1024px] mx-auto w-full px-8 py-8 flex flex-col gap-6">
          {/* Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <button 
              onClick={() => { setSearch(""); setFilterCat("Todos"); setSortBy("status"); }}
              className="text-left outline-hidden"
            >
              <StatCard value={stats.expired} label="Expirados" accent="text-red-500" meta={`${products.length ? Math.round((stats.expired / products.length) * 100) : 0}% do total`} />
            </button>
            <button 
              onClick={() => { setSearch(""); setFilterCat("Todos"); setSortBy("expiry"); }}
              className="text-left outline-hidden"
            >
              <StatCard value={stats.soon} label="Críticos" accent="text-primary" meta="A expirar em breve" />
            </button>
            <button 
              onClick={() => { setSearch(""); setFilterCat("Todos"); setSortBy("expiry"); }}
              className="text-left outline-hidden"
            >
              <StatCard value={stats.safe} label="Em Segurança" accent="text-green-500" meta="Sem preocupações" />
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1.8fr_1fr] gap-6 flex-grow">
            {/* Main List Column */}
            <div className="bg-surface rounded-2xl shadow-card border border-border p-6 flex flex-col overflow-hidden">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-base font-bold text-text">Lista de Produtos</h3>
                <div className="flex gap-2">
                  <select 
                    value={filterCat}
                    onChange={(e) => setFilterCat(e.target.value)}
                    className="text-xs bg-slate-50 border border-border px-3 py-1.5 rounded-lg outline-hidden focus:border-primary"
                  >
                    <option value="Todos">Todas Categ.</option>
                    {Object.keys(CATEGORY_ICONS).map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <select 
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="text-xs bg-slate-50 border border-border px-3 py-1.5 rounded-lg outline-hidden focus:border-primary"
                  >
                    <option value="expiry">Validade</option>
                    <option value="name">Nome</option>
                  </select>
                </div>
              </div>

              {/* Alert Banner inside main list */}
              {(criticalProducts.length > 0 || expiredProducts.length > 0) && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 flex items-center gap-3 animate-pulse-border"
                >
                  <AlertCircle className="text-red-500 shrink-0" size={18} />
                  <p className="text-xs text-red-700 leading-tight">
                    <strong>Atenção:</strong> {expiredProducts.length > 0 && <span>{expiredProducts.length} itens expirados</span>} 
                    {expiredProducts.length > 0 && criticalProducts.length > 0 && " e "}
                    {criticalProducts.length > 0 && <span>{criticalProducts.length} críticos</span>}. Providencie o descarte ou uso imediato.
                  </p>
                </motion.div>
              )}

              <motion.div 
                layout
                className="space-y-1 flex-1 overflow-auto pr-2 custom-scrollbar"
              >
                <AnimatePresence mode="popLayout">
                  {products.length === 0 ? (
                    <motion.div 
                      key="empty-no-products"
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="text-center py-20 text-muted"
                    >
                      <motion.div
                        animate={{ rotate: [0, 10, -10, 0] }}
                        transition={{ repeat: Infinity, duration: 4 }}
                      >
                        <Package size={48} className="mx-auto mb-4 opacity-20" />
                      </motion.div>
                      <p className="text-sm font-medium">Nenhum produto registado no seu inventário.</p>
                    </motion.div>
                  ) : filteredProducts.length === 0 ? (
                    <motion.div 
                      key="empty-no-results"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-center py-20 text-muted"
                    >
                      <Search size={48} className="mx-auto mb-4 opacity-20" />
                      <p className="text-sm">Nenhum resultado para os filtros atuais.</p>
                    </motion.div>
                  ) : (
                    filteredProducts.map((p, idx) => (
                      <ProductItem 
                        key={p.id} 
                        product={p} 
                        index={idx}
                        onEdit={() => openEdit(p)} 
                        onDelete={() => setDeleteProduct(p)} 
                      />
                    ))
                  )}
                </AnimatePresence>
              </motion.div>
            </div>

            {/* Sidebar Column within Dashboard */}
            <div className="bg-surface rounded-2xl shadow-card border border-border p-6 flex flex-col">
              <h3 className="text-base font-bold text-text mb-6">Estado Global</h3>
              <div className="space-y-6">
                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-bold mb-1">
                    <span className="text-muted">Capacidade Utilizada</span>
                    <span>{products.length}%</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width: `${Math.min(products.length, 100)}%` }} />
                  </div>
                </div>

                <div className="p-4 bg-slate-50 rounded-xl border border-dashed border-slate-300 text-center">
                  <p className="text-xs text-muted m-0">Arraste fotos de talões ou produtos para upload (Beta)</p>
                </div>

                <div className="pt-2">
                  <h4 className="text-[11px] font-bold text-muted uppercase tracking-wider mb-4">Próximos Vencimentos</h4>
                  <div className="space-y-4">
                    {products.filter(p => getDays(p.expiry) >= 0).sort((a,b) => new Date(a.expiry).getTime() - new Date(b.expiry).getTime()).slice(0, 5).map(p => (
                      <div key={p.id} className="flex gap-3 items-center group cursor-pointer" onClick={() => openEdit(p)}>
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs bg-slate-100 text-slate-500 font-bold border border-border group-hover:border-primary/50 transition-colors">
                          {CATEGORY_ICONS[p.category]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-text truncate m-0 group-hover:text-primary">{p.name}</p>
                          <p className="text-[10px] text-muted m-0">{formatDate(p.expiry)}</p>
                        </div>
                        <div className={`text-[10px] font-bold ${getDays(p.expiry) <= 7 ? 'text-orange-500' : 'text-green-500'}`}>
                          {getDays(p.expiry)}d
                        </div>
                      </div>
                    ))}
                    {products.length === 0 && <p className="text-[11px] text-muted text-center italic">Inventário vazio</p>}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Form Modal */}
      <AnimatePresence>
        {showForm && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowForm(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              className="relative w-full max-w-[480px] bg-white rounded-2xl p-8 shadow-2xl overflow-hidden border border-border"
            >
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h2 className="text-xl font-bold tracking-tight text-text">
                    {editId ? "Editar Produto" : "Novo Produto"}
                  </h2>
                  <p className="text-sm text-muted">Mantenha o seu inventário atualizado.</p>
                </div>
                <button onClick={() => setShowForm(false)} className="p-2 hover:bg-slate-100 rounded-full text-muted transition-colors">
                  <X size={20} />
                </button>
              </div>
              
              <form onSubmit={handleSave} className="space-y-5">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-muted uppercase tracking-wider block">Identificação do Produto</label>
                  <input 
                    name="name"
                    required
                    defaultValue={editId ? products.find(p => p.id === editId)?.name : ""}
                    placeholder="Nome do Item"
                    autoFocus
                    className="w-full px-4 py-3 bg-white border border-border rounded-xl text-text text-sm focus:ring-4 focus:ring-primary/10 focus:border-primary outline-hidden transition-all"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-muted uppercase tracking-wider block">Validade</label>
                    <input 
                      name="expiry"
                      type="date"
                      required
                      defaultValue={editId ? products.find(p => p.id === editId)?.expiry : ""}
                      className="w-full px-4 py-3 bg-white border border-border rounded-xl text-text text-sm focus:ring-4 focus:ring-primary/10 focus:border-primary outline-hidden transition-all"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-muted uppercase tracking-wider block">Categoria</label>
                    <select 
                      name="category"
                      defaultValue={editId ? products.find(p => p.id === editId)?.category : "Alimentação"}
                      className="w-full px-4 py-3 bg-white border border-border rounded-xl text-text text-sm focus:ring-4 focus:ring-primary/10 focus:border-primary outline-hidden cursor-pointer"
                    >
                      {Object.keys(CATEGORY_ICONS).map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-muted uppercase tracking-wider block">Quantidade</label>
                    <input 
                      name="quantity"
                      type="number"
                      min="1"
                      defaultValue={editId ? products.find(p => p.id === editId)?.quantity : "1"}
                      className="w-full px-4 py-3 bg-white border border-border rounded-xl text-text text-sm focus:ring-4 focus:ring-primary/10 focus:border-primary outline-hidden transition-all"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-muted uppercase tracking-wider block">Unidade</label>
                    <select 
                      name="unit"
                      defaultValue={editId ? products.find(p => p.id === editId)?.unit : "un"}
                      className="w-full px-4 py-3 bg-white border border-border rounded-xl text-text text-sm focus:ring-4 focus:ring-primary/10 focus:border-primary outline-hidden cursor-pointer"
                    >
                      <option value="un">un</option>
                      <option value="kg">kg</option>
                      <option value="g">g</option>
                      <option value="L">l</option>
                      <option value="ml">ml</option>
                      <option value="cx">cx</option>
                    </select>
                  </div>
                </div>

                <div className="flex gap-3 pt-6">
                  <button 
                    type="button" 
                    onClick={() => setShowForm(false)}
                    className="flex-1 px-5 py-3 rounded-xl bg-slate-50 border border-border text-muted font-bold text-sm hover:text-text hover:bg-slate-100 transition-all"
                  >
                    Descartar
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 px-5 py-3 rounded-xl text-white font-bold text-sm bg-primary hover:bg-primary-dark shadow-lg shadow-primary/20 transition-all"
                  >
                    Confirmar
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Modal */}
      <AnimatePresence>
        {deleteProduct && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDeleteProduct(null)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              className="relative w-full max-w-[360px] bg-white rounded-2xl p-8 text-center shadow-2xl border border-border"
            >
              <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6 text-2xl border border-red-100">
                <Trash2 size={28} />
              </div>
              <h2 className="text-xl font-bold tracking-tight text-text mb-2">Eliminar Produto</h2>
              <p className="text-sm text-muted mb-8 px-2">
                Tem a certeza que deseja eliminar <strong>"{deleteProduct.name}"</strong>? Este item será removido permanentemente.
              </p>
              <div className="flex gap-3">
                <button 
                  onClick={() => setDeleteProduct(null)}
                  className="flex-1 px-5 py-3 rounded-xl bg-slate-50 border border-border text-muted font-bold text-xs hover:text-text hover:bg-slate-100 transition-all"
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleDelete}
                  className="flex-1 px-5 py-3 rounded-xl text-white font-bold text-xs bg-red-500 hover:bg-red-600 transition-all shadow-md shadow-red-200"
                >
                  Sim, Eliminar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div 
            initial={{ opacity: 0, y: 50, x: "-50%" }}
            animate={{ opacity: 1, y: 0, x: "-50%" }}
            exit={{ opacity: 0, y: 20, x: "-50%" }}
            className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[300] bg-sidebar text-white px-8 py-3.5 rounded-full text-sm font-bold shadow-2xl border border-white/10"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function StatCard({ value, label, accent, meta }: { value: number, label: string, accent: string, meta: string }) {
  return (
    <div className="bg-surface border border-border rounded-2xl p-6 shadow-card flex flex-col gap-2">
      <div className="text-[11px] font-bold text-muted uppercase tracking-widest">{label}</div>
      <div className={`text-3xl font-bold tracking-tight ${accent}`}>{value}</div>
      <div className="text-[11px] text-muted">{meta}</div>
    </div>
  );
}

function ProductItem({ product, index, onEdit, onDelete }: { product: Product, index: number, onEdit: () => void, onDelete: () => void }) {
  const days = getDays(product.expiry);
  const status = getStatus(days);

  return (
    <motion.div 
      layout
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ delay: Math.min(index * 0.05, 0.3) }}
      className="group flex items-center p-4 border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-all duration-300 rounded-xl"
    >
      <div className="flex items-center gap-4 flex-1 min-w-0">
        <motion.div 
          initial={false}
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ repeat: Infinity, duration: 3, delay: index * 0.5 }}
          className="w-2.5 h-2.5 rounded-full shrink-0 shadow-[0_0_8px_rgba(0,0,0,0.1)]" 
          style={{ backgroundColor: status.color, boxShadow: `0 0 10px ${status.color}30` }} 
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm text-text truncate group-hover:text-primary transition-colors">{product.name}</span>
            <span className="text-[10px] text-muted font-bold px-2 py-0.5 bg-slate-100 rounded-md shrink-0 uppercase tracking-tight">{product.category}</span>
          </div>
          <div className="flex items-center gap-3 mt-1 text-[11px] text-muted font-medium">
            <span className="flex items-center gap-1"><Package size={10} /> {product.quantity} {product.unit}</span>
            <span className="text-slate-300">•</span>
            <span className="flex items-center gap-1"><Calendar size={10} /> Vence {formatDate(product.expiry)}</span>
          </div>
        </div>
      </div>
      
      <div className="flex items-center gap-6">
        <div className="text-right hidden sm:block">
          <motion.div 
            whileHover={{ scale: 1.05 }}
            className="text-[11px] font-black uppercase px-2.5 py-1 rounded-full border border-current/10"
            style={{ color: status.color, backgroundColor: `${status.color}10` }}
          >
            {status.label}
          </motion.div>
        </div>
        <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-all translate-x-2 group-hover:translate-x-0">
          <button 
            onClick={onEdit} 
            className="p-2 hover:bg-white hover:text-primary hover:shadow-sm rounded-lg text-muted transition-all bg-transparent"
            title="Editar produto"
          >
            <Edit3 size={14} />
          </button>
          <button 
            onClick={onDelete} 
            className="p-2 hover:bg-white hover:text-red-500 hover:shadow-sm rounded-lg text-muted transition-all bg-transparent"
            title="Eliminar produto"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
