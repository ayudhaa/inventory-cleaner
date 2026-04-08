import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, Package, ArrowUpCircle, ArrowDownCircle, 
  Plus, Menu, X, History, Loader2, TrendingUp, Search, Edit3, RefreshCcw
} from 'lucide-react';
import { Notify, Report } from 'notiflix';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { db } from './firebase';
import { collection, onSnapshot, addDoc, updateDoc, doc, query, orderBy, serverTimestamp } from 'firebase/firestore';

const App = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showModalTx, setShowModalTx] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [appLoading, setAppLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  const [products, setProducts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [chartData, setChartData] = useState([]);
  const [storeConfig, setStoreConfig] = useState({ 
    name: 'STOK TERMINAL', tagline: 'Activity Log System', logoColor: 'bg-stone-900', lowStockLimit: 10
  });

  const [txData, setTxData] = useState({ productId: '', type: 'out', qty: '' });

  useEffect(() => {
    const unsubConfig = onSnapshot(doc(db, "settings", "profile"), (docSnap) => {
      if (docSnap.exists()) setStoreConfig(prev => ({ ...prev, ...docSnap.data() }));
    });

    onSnapshot(query(collection(db, "products"), orderBy("createdAt", "desc")), (snap) => {
      setProducts(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setAppLoading(false);
    });

    onSnapshot(query(collection(db, "transactions"), orderBy("timestamp", "asc")), (snap) => {
      const txs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setTransactions([...txs].reverse());
      
      const grouped = txs.reduce((acc, curr) => {
        const date = curr.dateText;
        if (!acc[date]) acc[date] = { date, Masuk: 0, Keluar: 0 };
        curr.type === 'in' ? acc[date].Masuk += curr.qty : acc[date].Keluar += curr.qty;
        return acc;
      }, {});
      setChartData(Object.values(grouped).slice(-7));
    });

    return () => unsubConfig();
  }, []);

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleTransaction = async (e) => {
    e.preventDefault();
    const qtyNum = parseInt(txData.qty);
    const product = products.find(p => p.id === txData.productId);

    if (!product) return Notify.failure('Pilih produk');
    if (txData.type === 'out' && product.stock < qtyNum) return Report.failure('Stok Kurang', 'Sisa stok tidak mencukupi.', 'Ok');
    
    setIsSyncing(true);
    try {
      await updateDoc(doc(db, "products", product.id), { 
        stock: txData.type === 'out' ? product.stock - qtyNum : product.stock + qtyNum 
      });
      
      await addDoc(collection(db, "transactions"), { 
        productId: product.id, 
        productName: product.name, 
        type: txData.type, 
        qty: qtyNum, 
        timestamp: serverTimestamp(), 
        dateText: new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) 
      });

      Notify.success('Log Tercatat');
      setShowModalTx(false);
      setTxData({ productId: '', type: 'out', qty: '' });
    } catch (err) { 
      Notify.failure('Gagal Sinkronisasi'); 
    } finally { 
      setIsSyncing(false); 
    }
  };

  const openTxModal = (productId = '', type = 'out') => {
    setTxData({ productId, type, qty: '' });
    setShowModalTx(true);
  };

  const NavItem = ({ id, icon: Icon, label }) => (
    <button onClick={() => { setActiveTab(id); setIsMenuOpen(false); }} className={`flex items-center gap-3 px-6 py-4 rounded-[1.4rem] w-full transition-all ${activeTab === id ? 'bg-stone-900 text-white shadow-xl' : 'text-stone-400 hover:bg-stone-50'}`}>
      <Icon size={18} /> <span className="font-bold text-[10px] tracking-widest">{label}</span>
    </button>
  );

  // Initial Full Page Loading
  if (appLoading) return (
    <div className="h-screen flex flex-col items-center justify-center bg-[#FDFCFB]">
      <div className="relative flex items-center justify-center">
        <div className="absolute w-16 h-16 border-4 border-stone-100 rounded-full"></div>
        <div className="absolute w-16 h-16 border-4 border-t-stone-900 rounded-full animate-spin"></div>
        <Package className="text-stone-900 animate-pulse" size={24} />
      </div>
      <p className="mt-8 text-[10px] font-black tracking-[0.3em] uppercase text-stone-400 animate-pulse">Initializing Terminal</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#FDFCFB] flex flex-col md:flex-row text-stone-700 relative">
      
      {/* GLOBAL SYNC LOADER OVERLAY */}
      {isSyncing && (
        <div className="fixed inset-0 bg-white/60 backdrop-blur-[2px] z-[200] flex items-center justify-center animate-in fade-in duration-300">
          <div className="bg-white p-8 rounded-[2.5rem] shadow-2xl border border-stone-50 flex flex-col items-center">
            <div className="w-12 h-12 bg-stone-900 rounded-2xl flex items-center justify-center text-white mb-4 shadow-lg animate-bounce">
              <RefreshCcw className="animate-spin" size={20} />
            </div>
            <p className="text-[9px] font-black tracking-widest uppercase text-stone-900">Syncing Data...</p>
          </div>
        </div>
      )}

      {/* Sidebar Navigation */}
      <aside className={`fixed inset-y-0 left-0 z-[60] w-72 bg-white border-r border-stone-50 p-10 transform transition-transform md:relative md:translate-x-0 ${isMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="mb-16">
          <div className={`w-12 h-12 ${storeConfig.logoColor} rounded-2xl flex items-center justify-center text-white mb-4 shadow-lg`}><Package size={24} /></div>
          <h1 className="text-xl font-black italic tracking-tighter leading-none">{storeConfig.name}</h1>
          <p className="text-[8px] font-bold text-stone-300 tracking-widest mt-2">{storeConfig.tagline}</p>
        </div>
        <nav className="space-y-3">
          <NavItem id="dashboard" icon={LayoutDashboard} label="Overview" />
          <NavItem id="inventory" icon={Package} label="Inventory" />
          <NavItem id="transactions" icon={History} label="Activity Log" />
        </nav>
      </aside>

      {/* Mobile Toggle */}
      <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="md:hidden fixed top-6 right-6 z-[70] bg-stone-900 text-white p-4 rounded-2xl shadow-xl">{isMenuOpen ? <X size={20}/> : <Menu size={20}/>}</button>

      <main className="flex-1 p-6 md:p-16 lg:p-20">
        {activeTab === 'dashboard' && (
          <div className="max-w-6xl mx-auto space-y-10 animate-in fade-in duration-700">
            <header className="flex justify-between items-end">
                <div>
                    <h2 className="text-4xl font-bold font-serif italic text-stone-900">Summary</h2>
                    <p className="text-stone-400 text-[10px] font-black tracking-widest">Real-time Activity Tracking</p>
                </div>
                <button onClick={() => openTxModal()} className="bg-stone-900 text-white px-10 py-5 rounded-2xl font-black text-[10px] tracking-widest uppercase shadow-2xl">Record Transaction</button>
            </header>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="bg-white p-10 rounded-[3rem] border border-stone-50 shadow-sm flex justify-between items-end">
                <div><p className="text-stone-300 text-[9px] font-black tracking-widest mb-2">Total Items</p><div className="text-5xl font-serif italic">{products.length}</div></div>
                <Package className="text-stone-50" size={60} />
              </div>
              <div className="bg-stone-900 p-10 rounded-[3rem] text-white flex justify-between items-end shadow-2xl">
                <div><p className="text-stone-500 text-[9px] font-black tracking-widest mb-2">Stock Warning</p><div className="text-5xl font-serif italic">{products.filter(p => p.stock <= storeConfig.lowStockLimit).length}</div></div>
                <TrendingUp className="text-stone-800" size={60} />
              </div>
            </div>

            <div className="bg-white p-10 rounded-[3.5rem] border border-stone-50 shadow-sm">
              <h4 className="text-[10px] font-black tracking-widest text-stone-400 mb-10">Movement Chart (7 Days)</h4>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="colorOut" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#1c1917" stopOpacity={0.1}/><stop offset="95%" stopColor="#1c1917" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f5f5f5" />
                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#d6d3d1'}} dy={10}/>
                    <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#d6d3d1'}} />
                    <Tooltip contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.05)' }} />
                    <Area type="monotone" dataKey="Keluar" stroke="#1c1917" fill="url(#colorOut)" strokeWidth={3} />
                    <Area type="monotone" dataKey="Masuk" stroke="#e5e7eb" fill="transparent" strokeWidth={2} strokeDasharray="5 5" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'inventory' && (
          <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
              <h2 className="text-3xl font-bold italic font-serif text-stone-900">Inventory List</h2>
              <div className="relative w-full md:w-80">
                <Search className="absolute left-5 top-4.5 text-stone-300" size={18} />
                <input type="text" placeholder="Search items..." className="w-full bg-white border border-stone-100 rounded-2xl py-4 pl-14 pr-6 text-xs outline-none focus:border-stone-900 transition-all shadow-sm" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
              </div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredProducts.map(p => (
                    <div key={p.id} className="bg-white p-8 rounded-[2.5rem] border border-stone-50 shadow-sm hover:shadow-xl transition-all flex flex-col justify-between group">
                        <div>
                          <div className="flex justify-between items-start">
                            <span className="text-[8px] font-black uppercase tracking-widest text-stone-400 bg-stone-50 px-3 py-1 rounded-lg">{p.category}</span>
                            <p className="text-xs font-bold text-stone-400">Rp {p.price?.toLocaleString('id-ID')}</p>
                          </div>
                          <h3 className="text-xl font-bold text-stone-800 mt-4 leading-tight">{p.name}</h3>
                        </div>
                        <div className="mt-8">
                          <div className="flex justify-between items-end border-t border-stone-50 pt-6 mb-6">
                              <span className="text-[9px] font-black uppercase text-stone-300">Stok Saat Ini</span>
                              <span className={`text-3xl font-light ${p.stock <= storeConfig.lowStockLimit ? 'text-orange-500 font-bold' : 'text-stone-900'}`}>{p.stock}</span>
                          </div>
                          <button onClick={() => openTxModal(p.id, 'out')} className="w-full bg-stone-900 text-white py-4 rounded-2xl flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all shadow-lg">
                            <ArrowDownCircle size={16} /> Update Stok
                          </button>
                        </div>
                    </div>
                ))}
            </div>
          </div>
        )}

        {activeTab === 'transactions' && (
          <div className="max-w-3xl mx-auto space-y-8 animate-in fade-in">
            <header>
                <h2 className="text-3xl font-bold italic font-serif text-stone-900">Activity Log</h2>
                <p className="text-[10px] font-black uppercase tracking-widest text-stone-300">Detailed Transaction History</p>
            </header>
            <div className="space-y-4">
              {transactions.map(t => (
                <div key={t.id} className="bg-white p-6 rounded-[2.2rem] border border-stone-50 flex items-center justify-between shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-5">
                    <div className={`p-4 rounded-2xl ${t.type === 'in' ? 'bg-stone-50 text-stone-400' : 'bg-stone-900 text-white shadow-lg'}`}>
                      {t.type === 'in' ? <ArrowUpCircle size={20}/> : <ArrowDownCircle size={20}/>}
                    </div>
                    <div>
                      <p className="font-bold text-stone-800 leading-none mb-1">{t.productName}</p>
                      <p className="text-[9px] font-black text-stone-300 tracking-widest uppercase">{t.dateText}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-2xl font-serif italic ${t.type === 'in' ? 'text-stone-300' : 'text-stone-900 font-bold'}`}>
                      {t.type === 'in' ? '+' : '-'}{t.qty}
                    </p>
                  </div>
                </div>
              ))}
              {transactions.length === 0 && (
                <div className="text-center py-20 bg-stone-50 rounded-[3rem] border border-dashed border-stone-200">
                    <History size={40} className="mx-auto text-stone-200 mb-4" />
                    <p className="text-stone-300 italic text-sm">Belum ada aktivitas transaksi.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* MODAL TRANSACTION (IN/OUT) */}
      {showModalTx && (
        <div className="fixed inset-0 bg-stone-900/10 backdrop-blur-2xl z-[100] flex items-center justify-center p-6">
          <div className="bg-white w-full max-w-md rounded-[3.5rem] p-12 shadow-2xl relative border border-stone-50">
            {!isSyncing && (
                <button onClick={() => setShowModalTx(false)} className="absolute top-10 right-10 text-stone-300 hover:text-stone-900 transition-colors">
                    <X size={24} />
                </button>
            )}
            
            <h3 className="text-2xl font-bold font-serif italic mb-10 text-center text-stone-900">Manual Entry</h3>
            
            <form onSubmit={handleTransaction} className="space-y-6">
              <div className="flex bg-stone-50 p-2 rounded-[2rem]">
                <button type="button" onClick={() => setTxData({...txData, type: 'out'})} className={`flex-1 py-4 rounded-[1.6rem] text-[10px] font-black uppercase tracking-widest transition-all ${txData.type === 'out' ? 'bg-stone-900 text-white shadow-lg' : 'text-stone-400'}`}>Keluar</button>
                <button type="button" onClick={() => setTxData({...txData, type: 'in'})} className={`flex-1 py-4 rounded-[1.6rem] text-[10px] font-black uppercase tracking-widest transition-all ${txData.type === 'in' ? 'bg-stone-900 text-white shadow-lg' : 'text-stone-400'}`}>Masuk</button>
              </div>

              <div className="space-y-2">
                  <label className="text-[9px] font-black uppercase tracking-widest text-stone-400 ml-4">Pilih Produk</label>
                  <select className="w-full bg-stone-50 rounded-2xl p-5 text-sm outline-none cursor-pointer border-none" value={txData.productId} onChange={e => setTxData({...txData, productId: e.target.value})} required disabled={isSyncing}>
                    <option value="">-- Cari Item --</option>
                    {products.map(p => <option key={p.id} value={p.id}>{p.name} (Sisa: {p.stock})</option>)}
                  </select>
              </div>

              <div className="space-y-2">
                  <label className="text-[9px] font-black uppercase tracking-widest text-stone-400 ml-4">Jumlah Kuantitas</label>
                  <input type="number" className="w-full bg-stone-50 rounded-2xl p-5 text-sm outline-none" placeholder="Masukkan angka..." value={txData.qty} onChange={e => setTxData({...txData, qty: e.target.value})} required min="1" disabled={isSyncing}/>
              </div>

              <button disabled={isSyncing} className="w-full bg-stone-900 text-white py-6 rounded-[2rem] font-bold text-[10px] tracking-widest uppercase flex items-center justify-center gap-3 hover:bg-black transition-all shadow-xl disabled:bg-stone-400">
                {isSyncing ? (
                    <>
                        <Loader2 className="animate-spin" size={18} />
                        Syncing...
                    </>
                ) : (
                    <>
                        <TrendingUp size={18} />
                        Simpan Aktivitas
                    </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;