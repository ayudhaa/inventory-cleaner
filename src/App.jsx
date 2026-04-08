import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, Package, ArrowUpCircle, ArrowDownCircle, 
  Plus, Menu, X, History, ShoppingCart, Loader2, TrendingUp, Check, Tag, Info
} from 'lucide-react';
import { Notify, Report } from 'notiflix';

// RECHARTS FOR VISUALIZATION
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer 
} from 'recharts';

// FIREBASE IMPORTS
import { db } from './firebase';
import { 
  collection, onSnapshot, addDoc, updateDoc, 
  doc, query, orderBy, serverTimestamp 
} from 'firebase/firestore';

const App = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showModalTx, setShowModalTx] = useState(false);
  const [showModalProduct, setShowModalProduct] = useState(false);
  
  // Loading States
  const [isSyncing, setIsSyncing] = useState(false);
  const [appLoading, setAppLoading] = useState(true);
  
  // Data States
  const [products, setProducts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [chartData, setChartData] = useState([]);
  const [categories, setCategories] = useState([]);
  
  // STORE IDENTITY STATE (Sinkron Otomatis dengan Backend dokumen 'profile')
  const [storeConfig, setStoreConfig] = useState({
    name: 'LOADING...',
    tagline: 'MENGHUBUNGKAN KE CLOUD...',
    logoColor: 'bg-stone-900',
    lowStockLimit: 10
  });

  // Form States
  const [txData, setTxData] = useState({ productId: '', type: 'out', qty: '' });
  const [newProdData, setNewProdData] = useState({ name: '', category: '', price: '', stock: '' });

  // 1. UNIVERSAL REAL-TIME SYNC
  useEffect(() => {
    // A. SYNC CONFIG / IDENTITY (Target: settings/profile sesuai backend baru)
    const unsubConfig = onSnapshot(doc(db, "settings", "profile"), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setStoreConfig({
          name: data.name || 'NAMA TOKO BELUM DISET',
          tagline: data.tagline || 'Tagline belum dikonfigurasi',
          logoColor: data.logoColor || 'bg-stone-900',
          lowStockLimit: data.lowStockLimit || 10
        });
        console.log("✅ Identitas Berhasil Disinkronkan dari dokumen 'profile'");
      } else {
        console.warn("⚠️ Dokumen settings/profile tidak ditemukan");
      }
    });

    // B. SYNC CATEGORIES
    const qCat = query(collection(db, "categories"), orderBy("name", "asc"));
    const unsubCat = onSnapshot(qCat, (snapshot) => {
      const catList = snapshot.docs.map(doc => doc.data().name);
      setCategories(catList);
      if (catList.length > 0 && !newProdData.category) {
        setNewProdData(prev => ({...prev, category: catList[0]}));
      }
    });

    // C. SYNC PRODUCTS
    const qProd = query(collection(db, "products"), orderBy("createdAt", "desc"));
    const unsubProd = onSnapshot(qProd, (snapshot) => {
      setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setAppLoading(false);
    });

    // D. SYNC TRANSACTIONS
    const qTx = query(collection(db, "transactions"), orderBy("timestamp", "asc"));
    const unsubTx = onSnapshot(qTx, (snapshot) => {
      const txs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setTransactions([...txs].reverse());
      
      const groupedData = txs.reduce((acc, curr) => {
        const date = curr.dateText;
        if (!acc[date]) acc[date] = { date, Masuk: 0, Keluar: 0 };
        if (curr.type === 'in') acc[date].Masuk += curr.qty;
        else acc[date].Keluar += curr.qty;
        return acc;
      }, {});
      setChartData(Object.values(groupedData).slice(-7));
    });

    return () => { 
      unsubConfig(); unsubCat(); unsubProd(); unsubTx(); 
    };
  }, []);

  // 2. LOGIC: TAMBAH PRODUK
  const handleAddProduct = async (e) => {
    e.preventDefault();
    setIsSyncing(true);
    try {
      await addDoc(collection(db, "products"), {
        ...newProdData,
        price: parseInt(newProdData.price),
        stock: parseInt(newProdData.stock) || 0,
        createdAt: serverTimestamp()
      });
      Notify.success('Produk Berhasil Disimpan');
      setShowModalProduct(false);
      setNewProdData({ name: '', category: categories[0] || '', price: '', stock: '' });
    } catch (err) { Notify.failure('Gagal Menyimpan Produk'); }
    finally { setIsSyncing(false); }
  };

  // 3. LOGIC: TRANSAKSI (IN/OUT)
  const handleTransaction = async (e) => {
    e.preventDefault();
    const qtyNum = parseInt(txData.qty);
    const product = products.find(p => p.id === txData.productId);

    if (txData.type === 'out' && product.stock < qtyNum) {
      return Report.failure('Stok Tidak Cukup', 'Silakan periksa ketersediaan gudang', 'Oke');
    }

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
        dateText: new Date().toLocaleDateString('id-ID')
      });

      Notify.success('Stok Diperbarui');
      setShowModalTx(false);
      setTxData({ productId: '', type: 'out', qty: '' });
    } catch (err) { Notify.failure('Gagal Memperbarui Stok'); }
    finally { setIsSyncing(false); }
  };

  const NavItem = ({ id, icon: Icon, label }) => (
    <button
      onClick={() => { setActiveTab(id); setIsMenuOpen(false); }}
      className={`flex items-center gap-3 px-6 py-4 rounded-[1.4rem] w-full transition-all duration-300 ${
        activeTab === id ? 'bg-stone-900 text-white shadow-xl shadow-stone-200' : 'text-stone-400 hover:bg-stone-50'
      }`}
    >
      <Icon size={18} />
      <span className="font-bold text-[10px] tracking-widest">{label}</span>
    </button>
  );

  if (appLoading) return (
    <div className="h-screen flex items-center justify-center bg-[#FDFCFB] flex-col gap-4">
      <Loader2 className="animate-spin text-stone-900" size={32} />
      <p className="text-[10px] font-black tracking-[0.4em] text-stone-400">Syncing Cloud Database...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#FDFCFB] flex flex-col md:flex-row text-stone-700 font-sans relative">
      
      {/* Sidebar - OTOMATIS BERUBAH JIKA BACKEND DIUPDATE */}
      <aside className={`fixed inset-y-0 left-0 z-[60] w-72 bg-white border-r border-stone-50 p-10 transform transition-transform duration-500 ease-in-out md:relative md:translate-x-0 ${isMenuOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'}`}>
        <div className="mb-16">
            <div className={`w-12 h-12 ${storeConfig.logoColor} rounded-2xl flex items-center justify-center text-white mb-4 shadow-lg transition-all duration-700`}>
                <Package size={24} />
            </div>
            <h1 className="text-xl font-black text-stone-900 tracking-tighter italic transition-all duration-500">
                {storeConfig.name}
            </h1>
            <p className="text-[8px] font-bold text-stone-300 tracking-[0.2em] mt-1 transition-all duration-500">
                {storeConfig.tagline}
            </p>
        </div>
        <nav className="space-y-3">
          <NavItem id="dashboard" icon={LayoutDashboard} label="Overview" />
          <NavItem id="inventory" icon={Package} label="Inventory" />
          <NavItem id="transactions" icon={History} label="Activity" />
        </nav>
      </aside>

      {/* Mobile Menu Toggle */}
      <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="md:hidden fixed top-6 right-6 z-[70] bg-stone-900 text-white p-4 rounded-2xl shadow-xl">
        {isMenuOpen ? <X size={20}/> : <Menu size={20}/>}
      </button>

      <main className="flex-1 p-6 md:p-16 lg:p-20 overflow-x-hidden">
        {activeTab === 'dashboard' && (
          <div className="max-w-6xl mx-auto space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-1000">
            <header className="flex justify-between items-end">
                <div className="space-y-1">
                    <h2 className="text-4xl font-bold tracking-tight text-stone-900 italic font-serif">Status</h2>
                    <p className="text-stone-400 text-[10px] font-black uppercase tracking-[0.2em]">Live Data Feed Connected</p>
                </div>
                <button onClick={() => setShowModalTx(true)} className="bg-stone-900 text-white px-10 py-5 rounded-2xl font-black text-[10px] tracking-[0.3em] uppercase shadow-2xl hover:scale-105 active:scale-95 transition-all">New Move</button>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="bg-white p-10 rounded-[3rem] border border-stone-50 shadow-sm">
                <p className="text-stone-300 text-[9px] font-black uppercase tracking-widest mb-6">Total SKU</p>
                <div className="flex items-end justify-between font-serif italic text-5xl tracking-tighter">{products.length}</div>
              </div>
              <div className="bg-stone-900 p-10 rounded-[3rem] shadow-2xl shadow-stone-200">
                <p className="text-stone-500 text-[9px] font-black uppercase tracking-widest mb-6">Low Stock Alert</p>
                <div className="flex items-end justify-between">
                    <h3 className="text-5xl font-light text-white tracking-tighter italic font-serif">
                      {products.filter(p => p.stock <= storeConfig.lowStockLimit).length}
                    </h3>
                    <div className="p-2 bg-orange-500 rounded-xl text-white"><TrendingUp size={16}/></div>
                </div>
              </div>
            </div>

            {/* Grafik Real-time */}
            <div className="bg-white p-10 rounded-[3.5rem] border border-stone-50 shadow-sm">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-10">Stock Flow (7 Days)</h4>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="colorOut" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#1c1917" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#1c1917" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f5f5f5" />
                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 'bold', fill: '#d6d3d1'}} dy={10}/>
                    <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#d6d3d1'}} />
                    <Tooltip contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.05)' }} />
                    <Area type="monotone" dataKey="Keluar" stroke="#1c1917" fillOpacity={1} fill="url(#colorOut)" strokeWidth={3} />
                    <Area type="monotone" dataKey="Masuk" stroke="#e5e7eb" fill="transparent" strokeWidth={2} strokeDasharray="5 5" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'inventory' && (
          <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
            <div className="flex justify-between items-center">
              <h2 className="text-3xl font-bold italic font-serif">Katalog</h2>
              <button onClick={() => setShowModalProduct(true)} className="bg-stone-900 text-white px-8 py-4 rounded-2xl flex items-center gap-2 text-[10px] font-black tracking-widest uppercase shadow-xl active:scale-95 transition-all">
                <Plus size={16} /> Item Baru
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {products.map(p => (
                    <div key={p.id} className="bg-white p-8 rounded-[2.5rem] border border-stone-50 shadow-sm hover:shadow-xl transition-all flex flex-col justify-between">
                        <div>
                          <div className="flex justify-between items-start">
                            <span className="text-[8px] font-black uppercase tracking-widest text-stone-400 bg-stone-50 px-3 py-1 rounded-lg">{p.category}</span>
                            <p className="text-xs font-bold text-stone-900">Rp {p.price?.toLocaleString('id-ID')}</p>
                          </div>
                          <h3 className="text-xl font-bold text-stone-800 mt-4">{p.name}</h3>
                        </div>
                        <div className="flex justify-between items-end border-t border-stone-50 mt-6 pt-6">
                            <span className="text-[9px] font-black uppercase text-stone-300">Ready Stock</span>
                            <span className={`text-3xl font-light tracking-tighter ${p.stock <= storeConfig.lowStockLimit ? 'text-orange-500 font-bold' : 'text-stone-900'}`}>{p.stock}</span>
                        </div>
                    </div>
                ))}
            </div>
          </div>
        )}

        {activeTab === 'transactions' && (
          <div className="max-w-3xl mx-auto space-y-8 animate-in fade-in duration-500">
            <h2 className="text-3xl font-bold italic font-serif text-stone-900">Activity Log</h2>
            <div className="space-y-4">
              {transactions.map(t => (
                <div key={t.id} className="bg-white p-6 rounded-[2rem] border border-stone-50 flex items-center justify-between shadow-sm">
                  <div className="flex items-center gap-5">
                    <div className={`p-4 rounded-2xl ${t.type === 'in' ? 'bg-stone-50 text-stone-300' : 'bg-stone-900 text-white'}`}>
                      {t.type === 'in' ? <ArrowUpCircle size={20}/> : <ArrowDownCircle size={20}/>}
                    </div>
                    <div>
                      <p className="font-bold text-stone-800">{t.productName}</p>
                      <p className="text-[10px] font-bold text-stone-300 tracking-widest uppercase">{t.dateText}</p>
                    </div>
                  </div>
                  <p className={`text-2xl font-light tracking-tighter ${t.type === 'in' ? 'text-stone-300 font-bold' : 'text-stone-900 font-bold'}`}>
                    {t.type === 'in' ? '+' : '-'}{t.qty}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* MODAL NEW PRODUCT */}
      {showModalProduct && (
        <div className="fixed inset-0 bg-stone-900/10 backdrop-blur-2xl z-[100] flex items-center justify-center p-6">
          <div className="bg-white w-full max-w-md rounded-[3.5rem] p-12 shadow-2xl animate-in zoom-in-95 duration-500 relative">
            <button onClick={() => setShowModalProduct(false)} className="absolute top-8 right-8 text-stone-300 hover:text-stone-900 transition-colors">
              <X size={24} />
            </button>
            <h3 className="text-2xl font-bold text-stone-900 italic font-serif mb-10 text-center">New Item</h3>
            <form onSubmit={handleAddProduct} className="space-y-6">
              <input type="text" className="w-full bg-stone-50 rounded-2xl p-5 text-sm outline-none" placeholder="Nama Produk" value={newProdData.name} onChange={e => setNewProdData({...newProdData, name: e.target.value})} required/>
              <div className="relative">
                <select className="w-full bg-stone-50 rounded-2xl p-5 text-sm outline-none appearance-none cursor-pointer" value={newProdData.category} onChange={e => setNewProdData({...newProdData, category: e.target.value})} required>
                  {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                </select>
                <Tag className="absolute right-5 top-5 text-stone-300 pointer-events-none" size={18}/>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <input type="number" className="w-full bg-stone-50 rounded-2xl p-5 text-sm outline-none" placeholder="Harga" value={newProdData.price} onChange={e => setNewProdData({...newProdData, price: e.target.value})} required/>
                <input type="number" className="w-full bg-stone-50 rounded-2xl p-5 text-sm outline-none" placeholder="Awal Stok" value={newProdData.stock} onChange={e => setNewProdData({...newProdData, stock: e.target.value})}/>
              </div>
              <button disabled={isSyncing || categories.length === 0} className="w-full bg-stone-900 text-white py-5 rounded-[2rem] font-bold text-[10px] tracking-[0.3em] uppercase flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50 transition-all">
                {isSyncing ? <Loader2 className="animate-spin" size={18} /> : <Check size={18} />}
                Kirim ke Cloud
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL TRANSACTION */}
      {showModalTx && (
        <div className="fixed inset-0 bg-stone-900/10 backdrop-blur-2xl z-[100] flex items-end sm:items-center justify-center p-0 sm:p-6">
          <div className="bg-white w-full max-w-md rounded-t-[4rem] sm:rounded-[3.5rem] p-12 shadow-2xl animate-in slide-in-from-bottom-10 duration-500 relative">
            <button onClick={() => setShowModalTx(false)} className="absolute top-8 right-8 text-stone-300 hover:text-stone-900 transition-colors">
              <X size={24} />
            </button>
            <h3 className="text-2xl font-bold text-stone-900 italic font-serif mb-10 text-center">Movement</h3>
            <form onSubmit={handleTransaction} className="space-y-6">
              <div className="flex bg-stone-50 p-2 rounded-[2rem]">
                <button type="button" onClick={() => setTxData({...txData, type: 'out'})} className={`flex-1 py-4 rounded-[1.6rem] text-[10px] font-black uppercase tracking-widest transition-all ${txData.type === 'out' ? 'bg-stone-900 text-white shadow-lg' : 'text-stone-300'}`}>Out</button>
                <button type="button" onClick={() => setTxData({...txData, type: 'in'})} className={`flex-1 py-4 rounded-[1.6rem] text-[10px] font-black uppercase tracking-widest transition-all ${txData.type === 'in' ? 'bg-stone-900 text-white shadow-lg' : 'text-stone-300'}`}>In</button>
              </div>
              <select className="w-full bg-stone-50 rounded-2xl p-5 text-sm outline-none" value={txData.productId} onChange={e => setTxData({...txData, productId: e.target.value})} required>
                <option value="">Pilih Item...</option>
                {products.map(p => <option key={p.id} value={p.id}>{p.name} (Sisa: {p.stock})</option>)}
              </select>
              <input type="number" className="w-full bg-stone-50 rounded-2xl p-5 text-sm outline-none" placeholder="Jumlah" value={txData.qty} onChange={e => setTxData({...txData, qty: e.target.value})} required/>
              <button disabled={isSyncing} className="w-full bg-stone-900 text-white py-6 rounded-[2rem] font-bold text-[10px] tracking-[0.3em] uppercase flex items-center justify-center gap-3 transition-all active:scale-95">
                {isSyncing ? <Loader2 className="animate-spin" size={18} /> : <TrendingUp size={18} />}
                Proses Transaksi
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;