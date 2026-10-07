import React, { useState, useEffect, useMemo, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, onSnapshot, addDoc, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { getAuth, signInAnonymously, signInWithEmailAndPassword, sendPasswordResetEmail, onAuthStateChanged, signOut, signInWithCustomToken } from 'firebase/auth';
import { 
  LayoutDashboard, Users, Landmark, ClipboardList, Lock, Unlock, 
  ShieldHalf, Share2, CalendarDays, Wallet, Activity, TrendingUp, 
  TrendingDown, History, FileSearch, ArrowUpRight, ArrowDownRight,
  UserPlus, Search, SlidersHorizontal, Check, X, Receipt, Edit3, Trash2,
  PlusSquare, Plus, Minus, Info, Layers, MapPin, User, Calendar, 
  FileText, Download, Eye, Image as ImageIcon, MessageSquare, Terminal, Clock,
  Save, Mail, EyeOff, CheckCircle, ExternalLink, PenTool, Send, Loader2
} from 'lucide-react';

// Configuração inteligente: usa o ambiente de testes do editor para o preview funcionar sem erros.
// Quando você hospedar ou rodar fora daqui, usará EXCLUSIVAMENTE o seu banco de dados.
const firebaseConfig = typeof __firebase_config !== 'undefined' 
  ? JSON.parse(__firebase_config) 
  : {
      apiKey: "AIzaSyBs6l1WQx4ePd2IkY0RdfxR75XCJm13m08",
      authDomain: "gremiopit-3250c.firebaseapp.com",
      projectId: "gremiopit-3250c",
      storageBucket: "gremiopit-3250c.firebasestorage.app",
      messagingSenderId: "22286724105",
      appId: "1:22286724105:web:836befe594b969ccf09cd8",
      measurementId: "G-2CME0BPYLQ"
    };

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
// Mantemos o APP_ID fixo como você definiu para acessar os mesmos dados
const APP_ID = 'gremiopit-v1';

const MONTH_MAP = {
  'Jan': 'Janeiro', 'Fev': 'Fevereiro', 'Mar': 'Março', 'Abr': 'Abril',
  'Mai': 'Maio', 'Jun': 'Junho', 'Jul': 'Julho', 'Ago': 'Agosto',
  'Set': 'Setembro', 'Out': 'Outubro', 'Nov': 'Novembro', 'Dez': 'Dezembro'
};
const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const currentMonthName = MONTHS[new Date().getMonth()];

const formatCurrency = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

export default function App() {
  // Navigation & Filters State
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedMonth, setSelectedMonth] = useState(currentMonthName);
  const [membersViewMode, setMembersViewMode] = useState(window.innerWidth < 768 ? 'monthly' : 'panorama');
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const [memberPaymentFilter, setMemberPaymentFilter] = useState('all');
  
  // Data State
  const [members, setMembers] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [logs, setLogs] = useState([]);
  
  // Auth State
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [dbError, setDbError] = useState(null);

  // Modal & Form States
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  // Toast State
  const [toastMessage, setToastMessage] = useState(null);

  // Edit/Add States
  const [editingMemberId, setEditingMemberId] = useState(null);
  const [editMemberData, setEditMemberData] = useState({ rank: '', name: '', matricula: '' });
  
  const [showEditTxModal, setShowEditTxModal] = useState(false);
  const [editingTxId, setEditingTxId] = useState(null);
  const [editTxData, setEditTxData] = useState({});
  const [editExpenseImageBase64, setEditExpenseImageBase64] = useState(null);
  const [editExtraImageBase64, setEditExtraImageBase64] = useState(null);

  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [detailsTx, setDetailsTx] = useState(null);
  const [viewingPdf, setViewingPdf] = useState({ main: false, extra: false });

  // Receipt States
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [receiptTx, setReceiptTx] = useState(null);
  const [isEditingReceiptSettings, setIsEditingReceiptSettings] = useState(false);
  const [adminReceiptInfo, setAdminReceiptInfo] = useState({ name: '', matricula: '', signatureDataUrl: '' });
  const [generatedReceiptFile, setGeneratedReceiptFile] = useState(null);
  const [isGeneratingReceipt, setIsGeneratingReceipt] = useState(false);

  const signatureCanvasRef = useRef(null);
  const receiptAreaRef = useRef(null);

  // Load external script for html2canvas
  useEffect(() => {
    if (!window.html2canvas) {
      const script = document.createElement('script');
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
      script.async = true;
      document.body.appendChild(script);
    }
    
    // Load saved admin info
    const savedInfo = localStorage.getItem('gremio_admin_receipt_info');
    if (savedInfo) {
      setAdminReceiptInfo(JSON.parse(savedInfo));
    }
  }, []);

  useEffect(() => {
    const initAuth = async () => {
      try {
        await signInAnonymously(auth);
      } catch (err) {
        console.error("Auth error:", err);
        setDbError('permission');
      }
    };
    initAuth();

    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        setIsAdmin(!currentUser.isAnonymous);
      } else {
        setUser(null);
        setIsAdmin(false);
      }
    });
    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (!user) return;

    const membersRef = collection(db, 'artifacts', APP_ID, 'public', 'data', 'members');
    const unsubMembers = onSnapshot(membersRef, (snapshot) => {
      const membersData = snapshot.docs.map(doc => {
        let d = doc.data();
        if(d.payments) {
          let healedPayments = {};
          Object.keys(d.payments).forEach(k => {
            let newKey = MONTH_MAP[k] || k;
            healedPayments[newKey] = d.payments[k];
          });
          d.payments = healedPayments;
        }
        return { id: doc.id, ...d };
      }).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
      setMembers(membersData);
      setDbError(null);
    }, (error) => {
      if(error.code === 'permission-denied') setDbError('permission');
    });

    const transRef = collection(db, 'artifacts', APP_ID, 'public', 'data', 'transactions');
    const unsubTrans = onSnapshot(transRef, (snapshot) => {
      const transData = snapshot.docs.map(doc => {
        let d = doc.data();
        if(MONTH_MAP[d.month]) d.month = MONTH_MAP[d.month];
        return { id: doc.id, ...d };
      }).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
      setTransactions(transData);
      setDbError(null);
    }, (error) => {
      if(error.code === 'permission-denied') setDbError('permission');
    });

    const logsRef = collection(db, 'artifacts', APP_ID, 'public', 'data', 'logs');
    const unsubLogs = onSnapshot(logsRef, (snapshot) => {
      const logsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setLogs(logsData);
    }, (error) => {
      if(error.code === 'permission-denied') setDbError('permission');
    });

    return () => {
      unsubMembers();
      unsubTrans();
      unsubLogs();
    };
  }, [user]);

  // Custom Toast Alert to replace window.alert
  const customAlert = (message) => {
    setToastMessage(message);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  const logAction = async (actionText) => {
    try {
      await addDoc(collection(db, 'artifacts', APP_ID, 'public', 'data', 'logs'), {
        action: actionText,
        date: new Date().toLocaleString('pt-BR'),
        createdAt: Date.now()
      });
    } catch (error) { console.error("Erro ao salvar log", error); }
  };

  const matchMemberToTx = (tx) => {
    if (!tx) return null;
    if (tx.memberId) {
      const m = members.find(x => x.id === tx.memberId);
      if (m) return m;
    }
    const tDescLower = String(tx.description || '').toLowerCase();
    const normalize = (str) => {
      return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
                .replace(/[^a-z0-9 ]/g, "")
                .replace(/\b(sd|cb|sgt|3 sgt|2 sgt|1 sgt|st|ten|cap|maj|tc|cel)\b/g, "")
                .replace(/\s+/g, " ").trim();
    };
    const normDesc = normalize(tDescLower);
    return members.find(m => {
      const normName = normalize(String(m.name || '').toLowerCase());
      if(!normName || !normDesc) return false;
      return normName === normDesc || 
             (normName.length > 3 && normDesc.includes(normName)) ||
             (normDesc.length > 3 && normName.includes(normDesc));
    });
  };

  const processFile = (e, callback) => {
    const file = e.target.files[0];
    if (!file) { callback(null); return; }
    
    if (file.type === 'application/pdf') {
      const reader = new FileReader();
      reader.onload = (event) => callback(event.target.result);
      reader.readAsDataURL(file);
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const MAX_WIDTH = 800; 
        if (width > MAX_WIDTH) {
          height *= MAX_WIDTH / width;
          width = MAX_WIDTH;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        callback(canvas.toDataURL('image/jpeg', 0.7));
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    try {
      await signInWithEmailAndPassword(auth, loginEmail, loginPassword);
      setShowLoginModal(false);
      setLoginEmail('');
      setLoginPassword('');
      customAlert("Login realizado com sucesso!");
    } catch (error) {
      setLoginError('E-mail ou senha incorretos.');
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if(!loginEmail) {
      setLoginError('Digite seu e-mail para recuperar.');
      return;
    }
    try {
      await sendPasswordResetEmail(auth, loginEmail);
      setLoginError('E-mail enviado! Verifique sua caixa de entrada.');
    } catch(error) {
      setLoginError('Erro ao enviar. O e-mail está correto?');
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    customAlert("Você saiu do modo administrador.");
  };

  const handleAddMember = async (e) => {
    e.preventDefault();
    const rank = e.target.newMemberRank.value;
    const name = e.target.newMemberName.value.trim();
    const mat = e.target.newMemberMatricula.value.trim();
    if (!name || !mat || !user) return;
    
    const exists = members.find(m => m.matricula === mat || m.name.toLowerCase() === name.toLowerCase());
    if (exists) {
      customAlert(`Policial já cadastrado! Verifique: ${exists.rank || ''} ${exists.name}`);
      return;
    }

    try {
      await addDoc(collection(db, 'artifacts', APP_ID, 'public', 'data', 'members'), {
        rank: rank,
        name: name,
        matricula: mat,
        payments: {},
        createdAt: Date.now()
      });
      logAction(`Novo Policial adicionado: ${rank} ${name}`);
      e.target.reset();
      customAlert("Policial adicionado com sucesso!");
    } catch (error) { console.error(error); }
  };

  const saveEditMember = async (e) => {
    e.preventDefault();
    try {
      await updateDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'members', editingMemberId), {
        rank: editMemberData.rank,
        name: editMemberData.name,
        matricula: editMemberData.matricula
      });
      logAction(`Policial atualizado: ${editMemberData.rank} ${editMemberData.name}`);
      setEditingMemberId(null);
      customAlert("Dados atualizados com sucesso!");
    } catch(e) { console.error(e); }
  };

  const handleDeleteMember = async (id) => {
    if (!user || !isAdmin) return;
    const member = members.find(m => m.id === id);
    try { 
      await deleteDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'members', id)); 
      if(member) logAction(`Policial removido: ${member.rank || ''} ${member.name}`);
      customAlert("Policial removido do efetivo.");
    } catch(e) {}
  };

  const togglePayment = async (memberId, month) => {
    if (!user || !isAdmin) return;
    const member = members.find(m => m.id === memberId);
    if (!member) return;
    
    const existingTx = transactions.find(t => t.type === 'income' && t.month === month && (t.memberId === member.id || matchMemberToTx(t)?.id === member.id));
    const isCurrentlyPaid = (member.payments || {})[month] || !!existingTx;
    const newStatus = !isCurrentlyPaid;

    try {
      await updateDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'members', memberId), {
        [`payments.${month}`]: newStatus
      });

      if (newStatus) {
        if (!existingTx) {
          const timestamp = Date.now();
          await addDoc(collection(db, 'artifacts', APP_ID, 'public', 'data', 'transactions'), {
            type: 'income',
            description: member.name, 
            amount: 10,
            month: month,
            date: new Date(timestamp).toLocaleString('pt-BR'),
            isAuto: true,
            memberId: member.id,
            createdAt: timestamp
          });
          logAction(`Pagamento confirmado: ${member.rank || ''} ${member.name} (${month})`);
        }
      } else {
        if (existingTx) {
          await deleteDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'transactions', existingTx.id));
          logAction(`Pagamento estornado: ${member.rank || ''} ${member.name} (${month})`);
        }
      }
    } catch (error) { console.error(error); }
  };

  const [newTransType, setNewTransType] = useState('income');
  const [newTransIsInst, setNewTransIsInst] = useState(false);
  const [expenseImageBase64, setExpenseImageBase64] = useState(null);
  const [extraImageBase64, setExtraImageBase64] = useState(null);

  const handleAddTransaction = async (e) => {
    e.preventDefault();
    const type = newTransType;
    const desc = e.target.newTransDesc.value;
    const amount = e.target.newTransAmount.value;
    const dateInput = e.target.newTransDate.value;
    
    if (!desc || !amount || !user) return;
    
    let timestamp = Date.now();
    let formattedDate = new Date(timestamp).toLocaleString('pt-BR');
    
    if (dateInput) {
      const d = new Date(dateInput);
      formattedDate = d.toLocaleString('pt-BR');
      timestamp = d.getTime();
    }

    let extraData = {};
    if (type === 'expense') {
      const isInst = newTransIsInst;
      extraData = {
        purchaseLocation: e.target.newTransLocation?.value || '',
        purchaseLink: e.target.newTransLink?.value || '',
        buyerName: e.target.newTransBuyerName?.value || '',
        buyerMatricula: e.target.newTransBuyerMat?.value || '',
        observation: e.target.newTransObs?.value || '',
        receiptImage: expenseImageBase64 || null,
        extraPhoto: extraImageBase64 || null,
        isInstallment: isInst,
        totalAmount: isInst ? parseFloat(e.target.newTransTotalAmount?.value || 0) : 0,
        currentInstallment: isInst ? parseInt(e.target.newTransCurrentInst?.value || 1) : 1,
        totalInstallments: isInst ? parseInt(e.target.newTransTotalInst?.value || 1) : 1
      };
    }

    try {
      await addDoc(collection(db, 'artifacts', APP_ID, 'public', 'data', 'transactions'), {
        type,
        description: desc,
        amount: parseFloat(amount),
        month: selectedMonth,
        date: formattedDate,
        createdAt: timestamp,
        ...extraData
      });
      logAction(`Registro (${type === 'income' ? 'Receita' : 'Despesa'}): ${desc} - R$ ${amount}`);
      
      e.target.reset();
      setExpenseImageBase64(null);
      setExtraImageBase64(null);
      setNewTransIsInst(false);
      customAlert("Registro financeiro salvo com sucesso!");
    } catch(err) { console.error(err); }
  };

  const saveEditTx = async (e) => {
    e.preventDefault();
    if(!editingTxId) return;
    
    const isInst = editTxData.isInstallment;
    
    const updatedData = {
      ...editTxData,
      amount: parseFloat(editTxData.amount),
      totalAmount: isInst ? parseFloat(editTxData.totalAmount || 0) : 0,
      currentInstallment: isInst ? parseInt(editTxData.currentInstallment || 1) : 1,
      totalInstallments: isInst ? parseInt(editTxData.totalInstallments || 1) : 1
    };

    if (editExpenseImageBase64) updatedData.receiptImage = editExpenseImageBase64;
    if (editExtraImageBase64) updatedData.extraPhoto = editExtraImageBase64;

    try {
      await updateDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'transactions', editingTxId), updatedData);
      logAction(`Despesa atualizada com sucesso: ${updatedData.description}`);
      setShowEditTxModal(false);
      setEditingTxId(null);
      customAlert("Registro editado com sucesso!");
    } catch(err) { console.error(err); }
  };

  const handleDeleteTransaction = async (id) => {
    if (!user || !isAdmin) return;
    const tx = transactions.find(t => t.id === id);
    try { 
      await deleteDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'transactions', id)); 
      if(tx) logAction(`Estorno realizado: ${tx.description}`);
      customAlert("Estorno / Exclusão realizado com sucesso.");
    } catch(e) {}
  };

  const filteredTransactions = useMemo(() => transactions.filter(t => t.month === selectedMonth), [transactions, selectedMonth]);
  const income = useMemo(() => filteredTransactions.filter(t => t.type === 'income').reduce((acc, curr) => acc + curr.amount, 0), [filteredTransactions]);
  const expenses = useMemo(() => filteredTransactions.filter(t => t.type === 'expense').reduce((acc, curr) => acc + curr.amount, 0), [filteredTransactions]);
  
  const allIncome = useMemo(() => transactions.filter(t => t.type === 'income').reduce((acc, curr) => acc + curr.amount, 0), [transactions]);
  const allExpense = useMemo(() => transactions.filter(t => t.type === 'expense').reduce((acc, curr) => acc + curr.amount, 0), [transactions]);
  const totalBoxBalance = allIncome - allExpense;

  const prevBalance = useMemo(() => {
    const monthIndex = MONTHS.indexOf(selectedMonth);
    const prevMonths = MONTHS.slice(0, monthIndex);
    const prevTrans = transactions.filter(t => prevMonths.includes(t.month));
    const prevInc = prevTrans.filter(t => t.type === 'income').reduce((a, b) => a + b.amount, 0);
    const prevExp = prevTrans.filter(t => t.type === 'expense').reduce((a, b) => a + b.amount, 0);
    return prevInc - prevExp;
  }, [transactions, selectedMonth]);

  const exportReport = () => {
    const balance = income - expenses;
    const text = `*RELATÓRIO DE CAIXA - GRÊMIO PIT* 🚔\n\n` +
                 `*Mês Ref:* ${selectedMonth}\n` +
                 `*Efetivo Registrado:* ${members.length} policiais\n\n` +
                 `📊 *BALANÇO:*\n` +
                 `🟢 *Arrecadação:* ${formatCurrency(income)}\n` +
                 `🔴 *Despesas:* ${formatCurrency(expenses)}\n` +
                 `${balance >= 0 ? '🔵' : '🔴'} *SALDO DO MÊS:* ${formatCurrency(balance)}\n\n` +
                 `_Resumo gerado automaticamente pelo Sistema._`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
    logAction(`Relatório do mês de ${selectedMonth} exportado para o WhatsApp.`);
  };

  const exportMembersReport = () => {
    const paid = [];
    members.forEach(member => {
      const hasTx = transactions.some(t => t.type === 'income' && t.month === selectedMonth && (t.memberId === member.id || matchMemberToTx(t)?.id === member.id));
      if ((member.payments && member.payments[selectedMonth]) || hasTx) {
        const rankStr = member.rank ? `${member.rank} ` : '';
        if (!paid.includes(rankStr + member.name)) {
          paid.push(rankStr + member.name);
        }
      }
    });

    paid.sort();
    let text = `*PAGANTES DO MÊS - GRÊMIO PIT* 🚔\n*Mês Referência:* ${selectedMonth}\n\n✅ *POLICIAIS QUITES (${paid.length}):*\n`;
    if (paid.length === 0) text += `Nenhum pagamento registrado neste mês.\n`;
    else paid.forEach(name => text += `✓ ${name}\n`);
    text += `\n_Resumo gerado automaticamente pelo Sistema._`;

    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
    logAction(`Relatório de pagantes de ${selectedMonth} exportado para o WhatsApp.`);
  };

  const initSignatureCanvas = () => {
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.strokeStyle = '#020617'; 
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    let drawing = false;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if(adminReceiptInfo.signatureDataUrl) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0);
      img.src = adminReceiptInfo.signatureDataUrl;
    }

    const getPos = (e) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
    };

    const start = (e) => { e.preventDefault(); drawing = true; const pos = getPos(e); ctx.beginPath(); ctx.moveTo(pos.x, pos.y); };
    const draw = (e) => { e.preventDefault(); if(!drawing) return; const pos = getPos(e); ctx.lineTo(pos.x, pos.y); ctx.stroke(); };
    const stop = (e) => { e.preventDefault(); drawing = false; };

    canvas.addEventListener('mousedown', start); canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stop); canvas.addEventListener('mouseout', stop);
    canvas.addEventListener('touchstart', start, {passive: false});
    canvas.addEventListener('touchmove', draw, {passive: false});
    canvas.addEventListener('touchend', stop);
  };

  useEffect(() => {
    if (showReceiptModal && isEditingReceiptSettings) {
      setTimeout(initSignatureCanvas, 100);
    }
  }, [showReceiptModal, isEditingReceiptSettings]);

  const saveReceiptSettings = () => {
    const canvas = signatureCanvasRef.current;
    if(!adminReceiptInfo.name || !adminReceiptInfo.matricula) {
      customAlert("Preencha seu Nome e Matrícula.");
      return;
    }
    const newInfo = { ...adminReceiptInfo, signatureDataUrl: canvas ? canvas.toDataURL('image/png') : '' };
    setAdminReceiptInfo(newInfo);
    localStorage.setItem('gremio_admin_receipt_info', JSON.stringify(newInfo));
    setIsEditingReceiptSettings(false);
    customAlert("Configurações de recibo salvas!");
  };

  const shareReceiptImage = async () => {
    if (generatedReceiptFile) {
      try {
        if (navigator.share && navigator.canShare && navigator.canShare({ files: [generatedReceiptFile] })) {
          await navigator.share({ files: [generatedReceiptFile], title: 'Recibo PIT', text: 'Segue em anexo o recibo da movimentação.' });
          return;
        } else { throw new Error("Share API files not supported"); }
      } catch(e) { 
        // Correção definitiva do Download para iPhone/Safari e Firefox
        const url = URL.createObjectURL(generatedReceiptFile);
        const a = document.createElement('a');
        a.href = url;
        a.download = `recibo-pit-${new Date().getTime()}.png`;
        document.body.appendChild(a); 
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        customAlert('Recibo salvo no seu dispositivo! Agora é só anexar no WhatsApp.');
        return;
      }
    }

    if (!window.html2canvas) {
        customAlert("Ferramenta de captura ainda carregando, tente novamente em 1 segundo.");
        return;
    }

    setIsGeneratingReceipt(true);
    // Tempo aumentado para garantir que modais e a tela de recibo estejam totalmente carregados no HTML
    await new Promise(r => setTimeout(r, 500)); 
    
    try {
      const element = receiptAreaRef.current;
      if (!element) throw new Error("Área do recibo não encontrada no sistema.");

      const canvas = await window.html2canvas(element, { 
        scale: 2, 
        backgroundColor: '#ffffff', 
        useCORS: true,
        allowTaint: true 
      });
      
      canvas.toBlob(async (blob) => {
        if (!blob) throw new Error("Falha ao gerar o arquivo de imagem.");
        const file = new File([blob], 'recibo-pit.png', { type: 'image/png' });
        setGeneratedReceiptFile(file); 
        setIsGeneratingReceipt(false);
      }, 'image/png');
    } catch (err) {
      console.error(err);
      setIsGeneratingReceipt(false);
      // Mensagem mais clara se houver falha
      customAlert("Ocorreu um erro ao gerar a imagem: " + (err.message || "Tente novamente."));
    }
  };

  return (
    <div className="bg-[#020617] min-h-screen text-[#F8FAFC] flex flex-col md:flex-row md:h-screen md:overflow-hidden relative font-sans">
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-4 right-4 bg-[#0F172A] border-l-4 border-[#3B82F6] text-white p-4 rounded-xl shadow-2xl z-[9999] flex items-center gap-3 animate-[pulse_0.3s_ease-out_forwards] transition-all">
          <Info className="text-[#3B82F6]" size={24} />
          <div className="font-medium text-sm md:text-base">{toastMessage}</div>
        </div>
      )}

      {/* Background decoration */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0 flex justify-around opacity-5">
        {['🚓', '🔗', '🚨', '🚔', '🛡️'].map((emoji, i) => (
          <div key={i} className="text-6xl animate-bounce" style={{ animationDuration: `${3+i}s`, marginTop: `${10*i}vh`}}>{emoji}</div>
        ))}
      </div>

      {/* Sidebar */}
      <nav className="w-full md:w-64 bg-[#0F172A] md:p-6 shadow-2xl flex flex-row md:flex-col shrink-0 border-t md:border-t-0 md:border-r border-[#334155]/30 z-50 fixed bottom-0 md:relative md:bottom-auto order-last md:order-first overflow-x-auto md:overflow-y-auto">
        <div className="hidden md:flex items-center gap-3 mb-10">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#1E293B] to-[#0F172A] flex items-center justify-center shadow-lg border-2 border-[#EAB308]">
            <ShieldHalf className="text-[#EAB308]" size={28} />
          </div>
          <div>
            <h1 className="font-bold text-xl leading-tight text-white flex items-center gap-2">Grêmio PIT</h1>
            <p className="text-xs text-[#EAB308] font-bold tracking-widest uppercase">Controle Financeiro</p>
          </div>
        </div>

        <div className="flex flex-row md:flex-col flex-1 w-full md:space-y-2">
          {[
            { id: 'dashboard', icon: LayoutDashboard, label: 'Resumo' },
            { id: 'members', icon: Users, label: 'Tropa' },
            { id: 'transactions', icon: Landmark, label: 'Caixa' },
            { id: 'audit', icon: ClipboardList, label: 'Auditoria' }
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} 
              className={`flex-1 md:w-full flex flex-col md:flex-row items-center justify-center md:justify-start gap-1 md:gap-3 px-2 md:px-4 py-3 md:rounded-lg transition-all duration-300 
              ${activeTab === tab.id ? 'bg-[#3B82F6]/20 text-[#3B82F6] shadow-inner border-t-2 md:border-t-0 md:border-l-4 border-[#3B82F6]' : 'hover:bg-[#020617] text-[#94A3B8] border-t-2 md:border-t-0 border-transparent'}`}>
              <tab.icon size={20} />
              <span className="text-[10px] md:text-sm font-medium">{tab.label}</span>
            </button>
          ))}
        </div>

        <div className="hidden md:block mt-8 pt-6 border-t border-[#020617]">
          {!isAdmin ? (
            <button onClick={() => setShowLoginModal(true)} className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-[#94A3B8] hover:bg-[#020617] transition-colors">
              <Lock size={20} /> <span className="font-medium">Acesso Admin</span>
            </button>
          ) : (
            <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-3 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-all border border-red-500/30">
              <Unlock size={20} /> <span className="font-medium">Sair (Admin)</span>
            </button>
          )}
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 p-4 md:p-10 overflow-y-auto pb-24 md:pb-10 z-10 relative w-full">
        {/* Mobile Header */}
        <div className="flex md:hidden justify-between items-center mb-6 bg-[#0F172A]/80 p-3 rounded-xl border border-white/5 backdrop-blur-md">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#1E293B] to-[#0F172A] flex items-center justify-center shadow border border-[#EAB308]">
              <ShieldHalf className="text-[#EAB308]" size={16} />
            </div>
            <h1 className="font-bold text-white text-sm">Grêmio PIT</h1>
          </div>
          {!isAdmin ? 
            <button onClick={() => setShowLoginModal(true)} className="text-[#94A3B8] p-2 rounded-lg bg-[#020617] border border-[#334155]/50"><Lock size={16} /></button> :
            <button onClick={handleLogout} className="text-red-500 p-2 rounded-lg bg-red-500/10 border border-red-500/30"><Unlock size={16} /></button>
          }
        </div>

        {dbError === 'permission' && (
          <div className="mb-6 bg-yellow-500/10 border border-yellow-500/40 text-yellow-500 p-4 rounded-xl flex items-start gap-3">
            <Info className="w-6 h-6 flex-shrink-0 mt-1" />
            <div>
              <h4 className="font-bold text-lg">Leitura Bloqueada!</h4>
              <p className="text-sm opacity-90 mt-1">
                Para o aplicativo funcionar com as suas Regras de Segurança, você deve ativar o <b>Login Anônimo (Anonymous)</b> na aba de Autenticação do Firebase, ou fazer o <b>Acesso Admin</b>.
              </p>
            </div>
          </div>
        )}

        {/* Header Dashboard Filters */}
        <header className="flex flex-col xl:flex-row justify-between items-start xl:items-center mb-6 gap-4 bg-[#0F172A]/50 p-4 md:p-6 rounded-2xl border border-white/5 backdrop-blur-sm w-full">
          <div>
            <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
              {activeTab === 'dashboard' && <><LayoutDashboard className="text-[#EAB308]" size={32} /> Visão Geral</>}
              {activeTab === 'members' && <><Users className="text-[#EAB308]" size={32} /> Contribuintes</>}
              {activeTab === 'audit' && <><ClipboardList className="text-[#EAB308]" size={32} /> Auditoria e Transparência</>}
              {activeTab === 'transactions' && <><Landmark className="text-[#EAB308]" size={32} /> Fluxo de Caixa</>}
            </h2>
          </div>
          
          <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto justify-end">
            {activeTab === 'dashboard' && (
              <button onClick={exportReport} className="flex-1 md:flex-none justify-center bg-[#10B981]/10 text-[#10B981] hover:bg-[#10B981]/20 border border-[#10B981]/30 transition-colors px-3 md:px-4 py-2 md:py-2.5 rounded-xl flex items-center gap-2 text-sm md:text-base font-semibold shadow-sm">
                <Share2 size={16} /> Relatório
              </button>
            )}
            {activeTab === 'members' && (
              <button onClick={exportMembersReport} className="flex-1 md:flex-none justify-center bg-[#3B82F6]/10 text-[#3B82F6] hover:bg-[#3B82F6]/20 border border-[#3B82F6]/30 transition-colors px-3 md:px-4 py-2 md:py-2.5 rounded-xl flex items-center gap-2 text-sm md:text-base font-semibold shadow-sm">
                <Share2 size={16} /> Relatório Pagantes
              </button>
            )}
            
            <div className="flex-1 md:flex-none flex items-center justify-between bg-[#020617] p-1 rounded-xl shadow-sm border border-[#334155]/50 min-w-[140px]">
              <CalendarDays className="text-[#94A3B8] ml-3 mr-2" size={20} />
              <select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} className="bg-transparent border-none outline-none text-[#F8FAFC] font-semibold py-1.5 md:py-2 pr-4 pl-1 cursor-pointer appearance-none w-full text-right">
                {MONTHS.map(m => <option key={m} value={m} className="bg-[#0F172A]">{m}</option>)}
              </select>
            </div>
          </div>
        </header>

        {activeTab === 'dashboard' && (
          <>
            <div className="flex flex-col gap-4 mb-8">
                {/* Prioridade 1: Caixa Total */}
                <div className="bg-gradient-to-br from-[#0F172A] to-[#1E293B] rounded-3xl p-6 md:p-10 shadow-2xl border border-[#3B82F6]/40 relative overflow-hidden flex flex-col justify-center min-h-[160px]">
                    <div className="absolute -right-4 -bottom-4 opacity-10">
                        <Wallet size={200} />
                    </div>
                    <h3 className="text-[#94A3B8] font-bold uppercase tracking-widest text-xs md:text-sm mb-2 flex items-center gap-2 relative z-10">
                        <Activity size={18} className="text-[#3B82F6]" /> Total em Caixa
                    </h3>
                    <p className={`text-5xl md:text-6xl lg:text-7xl font-black relative z-10 tracking-tight ${totalBoxBalance >= 0 ? 'text-[#3B82F6] drop-shadow-[0_0_15px_rgba(59,130,246,0.3)]' : 'text-red-500 drop-shadow-[0_0_15px_rgba(239,68,68,0.3)]'}`}>
                        {formatCurrency(totalBoxBalance)}
                    </p>
                </div>

                {/* Prioridade 2: Receitas e Despesas */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-[#0F172A] rounded-2xl p-5 md:p-6 border-l-4 border-[#10B981] shadow-xl flex items-center justify-between group hover:bg-[#1E293B] transition-colors">
                        <div>
                            <h3 className="text-[#94A3B8] font-bold uppercase tracking-wider text-[10px] md:text-xs mb-1">Receitas ({selectedMonth})</h3>
                            <p className="text-2xl md:text-3xl font-bold text-[#10B981]">{formatCurrency(income)}</p>
                        </div>
                        <div className="bg-[#10B981]/10 p-3 rounded-full group-hover:scale-110 transition-transform">
                            <TrendingUp size={28} className="text-[#10B981]" />
                        </div>
                    </div>
                    <div className="bg-[#0F172A] rounded-2xl p-5 md:p-6 border-l-4 border-[#EF4444] shadow-xl flex items-center justify-between group hover:bg-[#1E293B] transition-colors">
                        <div>
                            <h3 className="text-[#94A3B8] font-bold uppercase tracking-wider text-[10px] md:text-xs mb-1">Despesas ({selectedMonth})</h3>
                            <p className="text-2xl md:text-3xl font-bold text-[#EF4444]">{formatCurrency(expenses)}</p>
                        </div>
                        <div className="bg-[#EF4444]/10 p-3 rounded-full group-hover:scale-110 transition-transform">
                            <TrendingDown size={28} className="text-[#EF4444]" />
                        </div>
                    </div>
                </div>

                {/* Prioridade 3: Saldo Anterior */}
                <div className="bg-[#020617] rounded-xl p-4 md:p-5 border border-[#334155]/40 flex items-center justify-between opacity-80 shadow-inner">
                    <div className="flex items-center gap-3">
                        <History className="text-[#94A3B8]" size={20} />
                        <h3 className="text-[#94A3B8] font-medium text-xs md:text-sm uppercase tracking-wider">Saldo Mês Anterior</h3>
                    </div>
                    <p className="text-lg md:text-xl font-semibold text-white">{formatCurrency(prevBalance)}</p>
                </div>
            </div>

            {/* Últimas Movimentações */}
            <div className="bg-[#0F172A] rounded-2xl p-4 md:p-6 shadow-xl border border-[#334155]/30">
              <h3 className="text-base md:text-lg font-bold mb-4 flex items-center gap-2"><Activity className="text-[#3B82F6]" size={20}/> Últimas Movimentações ({selectedMonth})</h3>
              {filteredTransactions.length === 0 ? (
                <div className="text-center py-10 text-[#94A3B8] bg-[#020617]/50 rounded-xl border border-dashed border-[#334155]/50">
                  <FileSearch size={40} className="mx-auto mb-3 opacity-50" />
                  <p className="text-sm md:text-base">Nenhuma movimentação registrada no mês.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredTransactions.slice().reverse().slice(0, 5).map(tx => {
                    let displayName = tx.description;
                    const mRef = matchMemberToTx(tx);
                    if (mRef && mRef.rank) displayName = `${mRef.rank} ${mRef.name}`;
                    else if (mRef) displayName = mRef.name;
                    
                    return (
                      <div key={tx.id} className="flex justify-between items-center p-3 md:p-4 bg-[#020617]/50 rounded-xl border border-[#334155]/30">
                        <div className="flex items-center gap-3 md:gap-4 overflow-hidden">
                          <div className={`${tx.type === 'income' ? 'bg-[#10B981]/10 text-[#10B981]' : 'bg-[#EF4444]/10 text-[#EF4444]'} p-2 md:p-3 rounded-xl shadow-inner shrink-0`}>
                            {tx.type === 'income' ? <ArrowUpRight size={20}/> : <ArrowDownRight size={20}/>}
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-white text-xs md:text-base whitespace-normal break-words leading-tight">{displayName}</p>
                            <p className="text-[10px] md:text-xs text-[#94A3B8] mt-1">{tx.date || new Date(tx.createdAt).toLocaleDateString('pt-BR')}</p>
                          </div>
                        </div>
                        <p className={`font-bold text-sm md:text-base shrink-0 ml-2 ${tx.type === 'income' ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>
                          {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount)}
                        </p>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </>
        )}

        {activeTab === 'members' && (
          <>
            {isAdmin && (
              <div className="bg-[#0F172A] p-4 md:p-6 rounded-2xl shadow-xl border border-[#334155]/30 mb-6 w-full overflow-hidden">
                <h3 className="text-base md:text-lg font-bold mb-4 flex items-center gap-2"><UserPlus className="text-[#3B82F6]" size={20}/> Alistar Policial</h3>
                <form onSubmit={handleAddMember} className="flex flex-col lg:flex-row gap-3">
                  <select name="newMemberRank" className="bg-[#020617] border border-[#334155]/50 outline-none focus:ring-1 focus:ring-[#3B82F6] rounded-xl px-4 py-3 text-white">
                    <option value="">Graduação</option>
                    <option value="CEL">Coronel</option>
                    <option value="TC">Tenente Coronel</option>
                    <option value="MAJ">Major</option>
                    <option value="CAP">Capitão</option>
                    <option value="TEN">Tenente</option>
                    <option value="ST">Subtenente</option>
                    <option value="1º SGT">1º Sargento</option>
                    <option value="2º SGT">2º Sargento</option>
                    <option value="3º SGT">3º Sargento</option>
                    <option value="SGT">Sargento (Geral)</option>
                    <option value="CB">Cabo</option>
                    <option value="SD">Soldado</option>
                    <option value="CIVIL">Civil / Outro</option>
                  </select>
                  <input type="text" name="newMemberName" placeholder="Nome Completo" className="flex-1 bg-[#020617] border border-[#334155]/50 outline-none focus:ring-1 focus:ring-[#3B82F6] rounded-xl px-4 py-3 text-white placeholder-[#94A3B8]" required/>
                  <input type="text" name="newMemberMatricula" placeholder="Matrícula" className="flex-1 bg-[#020617] border border-[#334155]/50 outline-none focus:ring-1 focus:ring-[#3B82F6] rounded-xl px-4 py-3 text-white placeholder-[#94A3B8]" required/>
                  <button type="submit" className="bg-[#3B82F6] hover:bg-blue-600 text-white font-bold py-3 px-6 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2">
                    <Plus size={20}/> Adicionar
                  </button>
                </form>
              </div>
            )}
            
            <div className="bg-[#0F172A] rounded-2xl shadow-xl border border-[#334155]/30 overflow-hidden w-full">
              <div className="p-4 bg-[#020617]/50 border-b border-[#334155]/30 flex flex-col gap-4">
                <div className="flex justify-between items-center flex-wrap gap-2">
                  <h3 className="text-base md:text-lg font-bold flex items-center"><Users className="text-[#3B82F6] mr-2" size={20}/> Efetivo</h3>
                  <button onClick={() => setMembersViewMode(prev => prev === 'panorama' ? 'monthly' : 'panorama')} className="bg-[#0F172A] border border-[#334155]/50 px-3 py-2 rounded-lg text-xs md:text-sm font-semibold hover:bg-[#020617] transition-colors flex items-center gap-2 text-white">
                    <SlidersHorizontal size={16} className="text-[#3B82F6]" /> 
                    {membersViewMode === 'panorama' ? 'Ocultar outros meses' : 'Exibir panorama completo'}
                  </button>
                </div>

                <div className="flex flex-col md:flex-row gap-3">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-3 text-[#94A3B8]" size={20}/>
                    <input 
                      type="text" 
                      value={memberSearchQuery} 
                      onChange={e => setMemberSearchQuery(e.target.value)} 
                      placeholder="Buscar Nome ou Matrícula..." 
                      className="w-full bg-[#020617] border border-[#334155]/50 outline-none focus:border-[#3B82F6] rounded-xl pl-10 pr-4 py-2 md:py-2.5 text-sm md:text-base text-white placeholder-[#94A3B8]"
                    />
                  </div>
                  <div className="flex gap-2 overflow-x-auto pb-1 md:pb-0 hide-scrollbar">
                    {['all', 'paid', 'pending'].map(filter => (
                      <button key={filter} onClick={() => setMemberPaymentFilter(filter)} 
                        className={`px-4 py-2 md:py-2.5 rounded-xl text-xs md:text-sm font-bold transition-all border whitespace-nowrap 
                        ${memberPaymentFilter === filter 
                          ? (filter==='all' ? 'bg-[#3B82F6]/20 text-[#3B82F6] border-[#3B82F6]/30' : filter==='paid' ? 'bg-[#10B981]/20 text-[#10B981] border-[#10B981]/30' : 'bg-[#EF4444]/20 text-[#EF4444] border-[#EF4444]/30') 
                          : 'bg-[#020617] text-[#94A3B8] border-[#334155]/50 hover:bg-[#334155]/20'}`}>
                        {filter === 'all' ? 'Todos' : filter === 'paid' ? 'Quites' : `Pendentes (${selectedMonth})`}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              
              <div className="overflow-x-auto w-full">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#020617] border-b border-[#334155]/30 text-xs md:text-sm">
                      <th className="p-4 font-semibold text-[#94A3B8] sticky left-0 bg-[#020617] z-20 border-r border-[#334155]/30 min-w-[200px] sm:min-w-[250px] shadow-[4px_0_8px_-2px_rgba(0,0,0,0.3)]">Policial / Matrícula</th>
                      {MONTHS.map(m => {
                        const isSelected = m === selectedMonth;
                        const isVisible = membersViewMode === 'panorama' || isSelected;
                        if(!isVisible) return null;
                        return <th key={m} className={`p-4 font-semibold text-center ${isSelected ? 'text-white bg-[#334155]/20' : 'text-[#94A3B8]'}`}>{m}</th>
                      })}
                      {isAdmin && <th className="p-4 font-semibold text-center text-[#94A3B8]">Ações</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#334155]/30">
                    {(() => {
                      const rankWeights = { 'CEL': 1, 'TC': 2, 'MAJ': 3, 'CAP': 4, 'TEN': 5, 'ST': 6, '1º SGT': 7, '2º SGT': 8, '3º SGT': 9, 'SGT': 9, 'CB': 10, 'SD': 11, 'CIVIL': 12 };
                      let filtered = members.filter(m => {
                        const q = memberSearchQuery.toLowerCase();
                        const matchesSearch = String(m.name||'').toLowerCase().includes(q) || String(m.matricula||'').toLowerCase().includes(q) || (m.rank && m.rank.toLowerCase().includes(q));
                        if (!matchesSearch) return false;
                        
                        const hasTx = transactions.some(t => t.type === 'income' && t.month === selectedMonth && (t.memberId === m.id || matchMemberToTx(t)?.id === m.id));
                        const isPaid = (m.payments || {})[selectedMonth] || hasTx;
                        
                        if (memberPaymentFilter === 'paid') return isPaid;
                        if (memberPaymentFilter === 'pending') return !isPaid;
                        return true;
                      });
                      
                      filtered.sort((a,b) => (rankWeights[a.rank]||99) - (rankWeights[b.rank]||99) || parseInt(String(a.matricula).replace(/\D/g,'')||999999) - parseInt(String(b.matricula).replace(/\D/g,'')||999999));

                      if(filtered.length === 0) return <tr><td colSpan="15" className="p-8 text-center text-[#94A3B8]">Nenhum policial encontrado.</td></tr>;
                      
                      return filtered.map(member => (
                        <tr key={member.id} className="hover:bg-[#020617]/50 transition-colors">
                          <td className="p-4 sticky left-0 bg-[#0F172A] z-10 border-r border-[#334155]/30 shadow-[4px_0_8px_-2px_rgba(0,0,0,0.3)] min-w-[200px] sm:min-w-[250px]">
                            <div className="flex flex-col gap-1 items-start w-full">
                              {member.rank && <span className="bg-[#020617] text-[#94A3B8] text-[10px] font-bold px-2 py-0.5 rounded border border-[#334155]/50 shadow-sm uppercase tracking-wider">{member.rank}</span>}
                              <p className="font-bold text-white text-sm md:text-base whitespace-normal break-words leading-tight w-full">{member.name}</p>
                              <p className="text-[10px] md:text-xs text-[#94A3B8] font-mono">{member.matricula}</p>
                            </div>
                          </td>
                          {MONTHS.map(m => {
                            const hasTx = transactions.some(t => t.type === 'income' && t.month === m && (t.memberId === member.id || matchMemberToTx(t)?.id === member.id));
                            const isPaid = (member.payments || {})[m] || hasTx;
                            const isSelected = m === selectedMonth;
                            if (membersViewMode !== 'panorama' && !isSelected) return null;
                            
                            return (
                              <td key={m} className={`p-4 text-center ${isSelected ? 'bg-[#020617]/30' : ''}`}>
                                <button 
                                  onClick={() => togglePayment(member.id, m)} disabled={!isAdmin}
                                  className={`w-8 h-8 rounded-full flex items-center justify-center mx-auto transition-all ${isPaid ? 'bg-[#10B981]/20 text-[#10B981] border border-[#10B981]/30 shadow-[0_0_10px_rgba(16,185,129,0.2)]' : 'bg-[#020617] text-[#94A3B8] border border-[#334155]/50'} ${isAdmin ? 'hover:scale-110 cursor-pointer' : 'opacity-80 cursor-default'}`}>
                                  {isPaid ? <Check size={16}/> : <X size={16}/>}
                                </button>
                                {isPaid && isAdmin && (
                                  <button onClick={() => {
                                    const tx = transactions.find(t => t.type === 'income' && t.month === m && (t.memberId === member.id || matchMemberToTx(t)?.id === member.id));
                                    if(tx) { setReceiptTx(tx); setShowReceiptModal(true); setIsEditingReceiptSettings(!adminReceiptInfo.name); setGeneratedReceiptFile(null); }
                                    else customAlert("Recibo não encontrado. Desmarque e marque novamente.");
                                  }} className="text-[10px] uppercase font-bold tracking-wider text-[#3B82F6] mt-2 flex items-center justify-center gap-1 mx-auto hover:bg-[#3B82F6]/10 px-2 py-1 rounded transition-colors">
                                    <Receipt size={12}/> Recibo
                                  </button>
                                )}
                              </td>
                            )
                          })}
                          {isAdmin && (
                            <td className="p-4 text-center whitespace-nowrap">
                              <button onClick={() => { setEditingMemberId(member.id); setEditMemberData(member); }} className="text-[#3B82F6] hover:bg-[#3B82F6]/10 p-2 rounded-lg transition-colors mr-1 md:mr-2"><Edit3 size={20}/></button>
                              <button onClick={() => handleDeleteMember(member.id)} className="text-red-500 hover:bg-red-500/10 p-2 rounded-lg transition-colors"><Trash2 size={20}/></button>
                            </td>
                          )}
                        </tr>
                      ))
                    })()}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {activeTab === 'transactions' && (
          <>
            {isAdmin && (
              <div className="bg-[#0F172A] p-4 md:p-6 rounded-2xl shadow-xl border border-[#334155]/30 mb-6">
                <h3 className="text-base md:text-lg font-bold mb-4 flex items-center gap-2"><PlusSquare className="text-[#3B82F6]" size={20}/> Registrar Fluxo ({selectedMonth})</h3>
                <form onSubmit={handleAddTransaction} className="space-y-4">
                  <div className="flex gap-2 md:gap-4">
                    <label className={`flex-1 cursor-pointer flex items-center justify-center gap-2 p-2.5 md:p-3 rounded-xl border-2 transition-all ${newTransType === 'income' ? 'border-[#10B981] bg-[#10B981]/10 text-[#10B981]' : 'border-[#020617] text-[#94A3B8] hover:border-[#334155]/50 bg-[#020617]'}`}>
                      <input type="radio" name="transType" value="income" checked={newTransType==='income'} onChange={()=>setNewTransType('income')} className="hidden"/>
                      <Plus size={20}/> Receita
                    </label>
                    <label className={`flex-1 cursor-pointer flex items-center justify-center gap-2 p-2.5 md:p-3 rounded-xl border-2 transition-all ${newTransType === 'expense' ? 'border-[#EF4444] bg-[#EF4444]/10 text-[#EF4444]' : 'border-[#020617] text-[#94A3B8] hover:border-[#334155]/50 bg-[#020617]'}`}>
                      <input type="radio" name="transType" value="expense" checked={newTransType==='expense'} onChange={()=>setNewTransType('expense')} className="hidden"/>
                      <Minus size={20}/> Despesa
                    </label>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
                    <input type="text" name="newTransDesc" placeholder="Descrição" className="bg-[#020617] border border-[#334155]/50 outline-none focus:ring-1 focus:ring-[#3B82F6] rounded-xl px-4 py-3 text-white placeholder-[#94A3B8]" required/>
                    <input type="number" name="newTransAmount" step="0.01" placeholder="Valor (R$)" className="bg-[#020617] border border-[#334155]/50 outline-none focus:ring-1 focus:ring-[#3B82F6] rounded-xl px-4 py-3 text-white placeholder-[#94A3B8]" required/>
                    <input type="datetime-local" name="newTransDate" className="bg-[#020617] border border-[#334155]/50 outline-none focus:ring-1 focus:ring-[#3B82F6] rounded-xl px-4 py-3 text-[#94A3B8]" title="Data e Hora (opcional)"/>
                  </div>

                  {newTransType === 'expense' && (
                    <div className="space-y-4 pt-4 border-t border-[#334155]/50">
                      <h4 className="text-xs md:text-sm font-bold text-yellow-500 flex items-center gap-2"><Info size={16}/> Detalhes da Compra (Transparência)</h4>
                      
                      <div className="bg-[#020617]/50 p-3 rounded-xl border border-[#334155]/50">
                        <label className="flex items-center gap-2 cursor-pointer text-sm font-bold text-[#3B82F6]">
                          <input type="checkbox" checked={newTransIsInst} onChange={e=>setNewTransIsInst(e.target.checked)} className="w-4 h-4 accent-[#3B82F6] rounded cursor-pointer"/>
                          📦 Compra Parcelada?
                        </label>
                        {newTransIsInst && (
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4 mt-3 pt-3 border-t border-[#334155]/30">
                            <div><label className="text-[10px] md:text-xs text-[#94A3B8] font-bold">Valor Total Produto</label><input type="number" step="0.01" name="newTransTotalAmount" placeholder="Ex: 1200.00" className="w-full bg-[#020617] border border-[#334155]/50 rounded-xl px-3 py-2 text-white text-sm mt-1"/></div>
                            <div><label className="text-[10px] md:text-xs text-[#94A3B8] font-bold">Parcela Atual</label><input type="number" name="newTransCurrentInst" placeholder="Ex: 1" className="w-full bg-[#020617] border border-[#334155]/50 rounded-xl px-3 py-2 text-white text-sm mt-1"/></div>
                            <div><label className="text-[10px] md:text-xs text-[#94A3B8] font-bold">Total Parcelas</label><input type="number" name="newTransTotalInst" placeholder="Ex: 10" className="w-full bg-[#020617] border border-[#334155]/50 rounded-xl px-3 py-2 text-white text-sm mt-1"/></div>
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                        <input type="text" name="newTransLocation" placeholder="Local da Compra (Ex: Supermercado X)" className="bg-[#020617] border border-[#334155]/50 rounded-xl px-4 py-3 text-white placeholder-[#94A3B8]"/>
                        <input type="url" name="newTransLink" placeholder="Link da Compra (se internet)" className="bg-[#020617] border border-[#334155]/50 rounded-xl px-4 py-3 text-white placeholder-[#94A3B8]"/>
                        <input type="text" name="newTransBuyerName" placeholder="Nome de quem comprou" className="bg-[#020617] border border-[#334155]/50 rounded-xl px-4 py-3 text-white placeholder-[#94A3B8]"/>
                        <input type="text" name="newTransBuyerMat" placeholder="Matrícula de quem comprou" className="bg-[#020617] border border-[#334155]/50 rounded-xl px-4 py-3 text-white placeholder-[#94A3B8]"/>
                      </div>
                      
                      <div className="bg-[#020617] p-3 rounded-xl border border-[#334155]/50">
                        <label className="block text-xs md:text-sm text-[#94A3B8] mb-2 font-medium">Observações sobre a despesa</label>
                        <textarea name="newTransObs" placeholder="Explique ou detalhe algo..." className="w-full bg-[#0F172A] border border-[#334155]/50 rounded-xl px-4 py-3 text-white placeholder-[#94A3B8] min-h-[80px]"></textarea>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-[#020617] p-3 rounded-xl border border-[#334155]/50">
                          <label className="block text-xs md:text-sm text-[#94A3B8] mb-2 font-medium">1. Nota Fiscal / Comprovante</label>
                          <input type="file" accept="image/*,application/pdf" onChange={e=>processFile(e, setExpenseImageBase64)} className="w-full text-xs text-[#94A3B8] file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:bg-yellow-500/10 file:text-yellow-500 hover:file:bg-yellow-500/20"/>
                        </div>
                        <div className="bg-[#020617] p-3 rounded-xl border border-[#334155]/50">
                          <label className="block text-xs md:text-sm text-[#94A3B8] mb-2 font-medium">2. Foto Adicional (Explicação)</label>
                          <input type="file" accept="image/*,application/pdf" onChange={e=>processFile(e, setExtraImageBase64)} className="w-full text-xs text-[#94A3B8] file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:bg-[#334155]/50 file:text-white hover:file:bg-[#334155]/70"/>
                        </div>
                      </div>
                    </div>
                  )}

                  <button type="submit" className="w-full bg-[#3B82F6] hover:bg-blue-600 text-white font-bold py-3 md:py-4 px-4 rounded-xl shadow-lg transition-all flex justify-center items-center gap-2 mt-2">
                    <Save size={20}/> Gravar Registro
                  </button>
                </form>
              </div>
            )}

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 md:gap-6">
              {/* Entradas */}
              <div className="bg-[#0F172A] rounded-2xl shadow-xl border border-[#10B981]/30 overflow-hidden flex flex-col">
                <div className="p-4 md:p-5 bg-[#10B981]/10 border-b border-[#10B981]/30">
                  <h3 className="text-base md:text-lg font-bold flex items-center gap-2 text-[#10B981]"><TrendingUp size={20}/> Entradas (Receitas)</h3>
                </div>
                <div className="p-0 overflow-x-auto flex-1">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="text-[#94A3B8] border-b border-[#334155]/30 text-xs md:text-sm bg-[#020617]/50">
                        <th className="py-3 px-3 md:px-4 font-medium">Data/Hora</th>
                        <th className="py-3 px-3 md:px-4 font-medium">Descrição</th>
                        <th className="py-3 px-3 md:px-4 font-medium text-right">Valor</th>
                        {isAdmin && <th className="py-3 px-3 md:px-4 font-medium text-center">Ações</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTransactions.filter(t=>t.type==='income').length === 0 ? 
                        <tr><td colSpan={isAdmin?4:3} className="py-10 text-center text-[#94A3B8]">Nenhuma receita neste mês.</td></tr> :
                        filteredTransactions.filter(t=>t.type==='income').slice().reverse().map(tx => {
                          let displayName = tx.description;
                          const mRef = matchMemberToTx(tx);
                          if (mRef && mRef.rank) displayName = <><span className="block text-[10px] text-[#94A3B8] font-bold uppercase tracking-wider mb-0.5">{mRef.rank}</span>{mRef.name}</>;
                          else if (mRef) displayName = mRef.name;
                          return (
                            <tr key={tx.id} className="border-b border-[#334155]/10 hover:bg-[#020617]/50 transition-colors">
                              <td className="py-3 px-3 md:px-4 text-xs md:text-sm text-[#94A3B8] whitespace-nowrap">{tx.date || new Date(tx.createdAt).toLocaleString('pt-BR')}</td>
                              <td className="py-3 px-3 md:px-4"><p className="font-bold text-white text-xs md:text-base leading-tight">{displayName}</p></td>
                              <td className="py-3 px-3 md:px-4 text-right font-bold text-[#10B981] text-xs md:text-base whitespace-nowrap">+{formatCurrency(tx.amount)}</td>
                              {isAdmin && (
                                <td className="py-3 px-3 md:px-4">
                                  <div className="flex items-center justify-center gap-1 md:gap-2">
                                    <button onClick={()=>{setReceiptTx(tx); setShowReceiptModal(true); setIsEditingReceiptSettings(!adminReceiptInfo.name); setGeneratedReceiptFile(null);}} className="text-[#10B981] hover:bg-[#10B981]/20 p-1.5 md:p-2 rounded-lg transition-colors"><Receipt size={20}/></button>
                                    <button onClick={()=>handleDeleteTransaction(tx.id)} className="text-red-500 hover:bg-red-500/20 p-1.5 md:p-2 rounded-lg transition-colors"><Trash2 size={20}/></button>
                                  </div>
                                </td>
                              )}
                            </tr>
                          )
                        })
                      }
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Saídas */}
              <div className="bg-[#0F172A] rounded-2xl shadow-xl border border-[#EF4444]/30 overflow-hidden flex flex-col">
                <div className="p-4 md:p-5 bg-[#EF4444]/10 border-b border-[#EF4444]/30">
                  <h3 className="text-base md:text-lg font-bold flex items-center gap-2 text-[#EF4444]"><TrendingDown size={20}/> Saídas (Despesas)</h3>
                </div>
                <div className="p-0 overflow-x-auto flex-1">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="text-[#94A3B8] border-b border-[#334155]/30 text-xs md:text-sm bg-[#020617]/50">
                        <th className="py-3 px-3 md:px-4 font-medium">Data/Hora</th>
                        <th className="py-3 px-3 md:px-4 font-medium">Descrição</th>
                        <th className="py-3 px-3 md:px-4 font-medium text-right">Valor</th>
                        {isAdmin && <th className="py-3 px-3 md:px-4 font-medium text-center">Ações</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTransactions.filter(t=>t.type==='expense').length === 0 ? 
                        <tr><td colSpan={isAdmin?4:3} className="py-10 text-center text-[#94A3B8]">Nenhuma despesa neste mês.</td></tr> :
                        filteredTransactions.filter(t=>t.type==='expense').slice().reverse().map(tx => (
                          <tr key={tx.id} className="border-b border-[#334155]/10 hover:bg-[#020617]/50 transition-colors">
                            <td className="py-3 px-3 md:px-4 text-xs md:text-sm text-[#94A3B8] whitespace-nowrap">{tx.date || new Date(tx.createdAt).toLocaleString('pt-BR')}</td>
                            <td className="py-3 px-3 md:px-4">
                              <div className="flex flex-col items-start gap-1">
                                <div className="font-bold text-white text-xs md:text-base leading-tight flex flex-wrap items-center gap-2">
                                  {tx.description}
                                  {tx.isInstallment && <span className="bg-[#3B82F6]/10 text-[#3B82F6] text-[10px] px-1.5 py-0.5 rounded border border-[#3B82F6]/30 uppercase tracking-wider font-bold"><Layers className="inline w-3 h-3 mr-0.5"/> Parc. {tx.currentInstallment}/{tx.totalInstallments}</span>}
                                </div>
                                {(tx.purchaseLocation || tx.purchaseLink || tx.buyerName || tx.receiptImage || tx.observation || tx.extraPhoto) && (
                                  <button onClick={()=>{setDetailsTx(tx); setShowDetailsModal(true); setViewingPdf({main:false, extra:false});}} className="bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20 px-2 py-1 rounded-md text-[10px] md:text-[11px] font-bold uppercase tracking-wider flex items-center gap-1 transition-colors border border-yellow-500/30 mt-1">
                                    <Search size={12}/> Transparência
                                  </button>
                                )}
                              </div>
                            </td>
                            <td className="py-3 px-3 md:px-4 text-right font-bold text-[#EF4444] text-xs md:text-base whitespace-nowrap">-{formatCurrency(tx.amount)}</td>
                            {isAdmin && (
                              <td className="py-3 px-3 md:px-4">
                                <div className="flex items-center justify-center gap-1 md:gap-2">
                                  <button onClick={()=>{setEditTxData(tx); setEditingTxId(tx.id); setShowEditTxModal(true);}} className="text-blue-400 hover:bg-blue-400/20 p-1.5 md:p-2 rounded-lg transition-colors"><Edit3 size={20}/></button>
                                  <button onClick={()=>{setReceiptTx(tx); setShowReceiptModal(true); setIsEditingReceiptSettings(!adminReceiptInfo.name); setGeneratedReceiptFile(null);}} className="text-[#10B981] hover:bg-[#10B981]/20 p-1.5 md:p-2 rounded-lg transition-colors"><Receipt size={20}/></button>
                                  <button onClick={()=>handleDeleteTransaction(tx.id)} className="text-red-500 hover:bg-red-500/20 p-1.5 md:p-2 rounded-lg transition-colors"><Trash2 size={20}/></button>
                                </div>
                              </td>
                            )}
                          </tr>
                        ))
                      }
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </>
        )}

        {activeTab === 'audit' && (
          <div className="bg-[#0F172A] rounded-2xl p-4 md:p-6 shadow-xl border border-yellow-500/30 flex flex-col min-h-[70vh]">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 shrink-0 gap-4">
              <h3 className="text-lg md:text-xl font-bold flex items-center gap-2 text-yellow-500"><Search size={24} /> Mural da Transparência</h3>
              <button className="bg-[#020617] text-[#94A3B8] border border-[#334155]/50 px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 shadow-sm pointer-events-none opacity-50">
                <History size={16}/> Histórico Registrado em Nuvem
              </button>
            </div>
            
            <div className="overflow-y-auto flex-1 pr-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
              {transactions.filter(t => t.type === 'expense' && (t.receiptImage || t.extraPhoto)).sort((a,b)=>b.createdAt - a.createdAt).length === 0 ? (
                <div className="col-span-full text-center py-12 text-[#94A3B8] bg-[#020617]/50 rounded-xl border border-dashed border-[#334155]/50">
                  <Receipt size={48} className="mx-auto mb-3 opacity-50 text-yellow-500"/>
                  <p className="text-sm">Nenhuma nota fiscal registrada nas despesas.</p>
                </div>
              ) : transactions.filter(t => t.type === 'expense' && (t.receiptImage || t.extraPhoto)).sort((a,b)=>b.createdAt - a.createdAt).map(tx => (
                <div key={tx.id} className="bg-[#020617] rounded-xl border border-[#334155]/50 p-4 flex flex-col justify-between hover:border-yellow-500/50 transition-all shadow-lg">
                  <div>
                    <div className="flex justify-between items-start mb-3 gap-2">
                      <h4 className="font-bold text-white text-base md:text-lg leading-tight break-words">
                        {tx.description}
                        {tx.isInstallment && <span className="inline-block mt-1 bg-[#3B82F6]/10 text-[#3B82F6] text-[10px] px-1.5 py-0.5 rounded border border-[#3B82F6]/30"><Layers className="inline w-3 h-3"/> Parc. {tx.currentInstallment}/{tx.totalInstallments}</span>}
                      </h4>
                      <span className="bg-red-500/10 text-red-500 font-bold text-xs px-2 py-1 rounded-md shrink-0 border border-red-500/30">-{formatCurrency(tx.amount)}</span>
                    </div>
                    {tx.observation && (
                      <div className="mb-3 bg-yellow-500/10 border-l-2 border-yellow-500 p-2 rounded-r">
                        <p className="text-xs text-[#94A3B8] italic whitespace-pre-wrap"><MessageSquare className="inline w-3 h-3 text-yellow-500 mr-1"/> {tx.observation}</p>
                      </div>
                    )}
                    <div className="text-[10px] md:text-xs text-[#94A3B8] space-y-1.5 mb-4">
                      <p className="flex items-center gap-1.5"><Calendar size={12}/> {tx.date || new Date(tx.createdAt).toLocaleString('pt-BR')}</p>
                      {tx.purchaseLocation && <p className="flex items-center gap-1.5 break-words"><MapPin size={12}/> {tx.purchaseLocation}</p>}
                      {tx.buyerName && <p className="flex items-center gap-1.5 break-words"><User size={12}/> {tx.buyerName}</p>}
                    </div>
                  </div>
                  <div className="flex gap-2 mt-auto pt-2 border-t border-[#334155]/30">
                    <button onClick={()=>{setDetailsTx(tx); setShowDetailsModal(true); setViewingPdf({main:false, extra:false});}} className="flex-1 bg-yellow-500/10 text-yellow-500 border border-yellow-500/30 font-bold py-2.5 rounded-lg flex items-center justify-center gap-2 text-xs md:text-sm hover:bg-yellow-500/20">
                      <Search size={16}/> Visualizar Anexos
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Login Modal */}
      {showLoginModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[999] flex items-center justify-center p-4">
          <div className="bg-[#0F172A] rounded-2xl p-6 md:p-8 w-full max-w-md shadow-2xl border border-[#334155]/50">
            <div className="flex items-center justify-center w-16 h-16 bg-[#020617] text-[#3B82F6] rounded-full mx-auto mb-4 border border-[#3B82F6]/40 shadow-[0_0_15px_rgba(59,130,246,0.3)]">
              {isResetting ? <Mail size={32}/> : <Lock size={32}/>}
            </div>
            <h3 className="text-2xl font-bold text-center mb-2">{isResetting ? 'Recuperar Senha' : 'Acesso Admin'}</h3>
            <form onSubmit={isResetting ? handleResetPassword : handleLogin} className="space-y-4 mt-6">
              <input type="email" placeholder="E-mail" value={loginEmail} onChange={e=>setLoginEmail(e.target.value)} className="w-full bg-[#020617] border border-[#334155]/50 rounded-xl px-4 py-3 text-white" required/>
              {!isResetting && (
                <div className="relative">
                  <input type={showPassword?'text':'password'} placeholder="Senha" value={loginPassword} onChange={e=>setLoginPassword(e.target.value)} className="w-full bg-[#020617] border border-[#334155]/50 rounded-xl px-4 py-3 text-white" required/>
                  <button type="button" onClick={()=>setShowPassword(!showPassword)} className="absolute right-3 top-3.5 text-[#94A3B8]"><Eye size={20}/></button>
                </div>
              )}
              {loginError && <p className="text-yellow-500 text-sm mt-2 text-center bg-yellow-500/10 p-2 rounded-lg">{loginError}</p>}
              <div className="flex gap-3 mt-8 pt-4">
                <button type="button" onClick={()=>{setShowLoginModal(false); setLoginError('');}} className="flex-1 px-4 py-3 rounded-xl font-bold text-[#94A3B8] bg-[#020617]">Cancelar</button>
                <button type="submit" className="flex-1 px-4 py-3 rounded-xl font-bold text-white bg-[#3B82F6]">{isResetting ? 'Enviar Link' : 'Entrar'}</button>
              </div>
              <div className="text-center mt-4">
                <button type="button" onClick={()=>setIsResetting(!isResetting)} className="text-sm text-[#3B82F6] underline">{isResetting ? 'Voltar para Login' : 'Esqueceu a senha?'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Member Modal */}
      {editingMemberId && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[999] flex items-center justify-center p-4">
          <div className="bg-[#0F172A] rounded-2xl p-6 w-full max-w-md border border-[#334155]/50">
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2"><Edit3 className="text-[#3B82F6]"/> Editar Policial</h3>
            <form onSubmit={saveEditMember} className="space-y-4">
              <select value={editMemberData.rank} onChange={e=>setEditMemberData({...editMemberData, rank: e.target.value})} className="w-full bg-[#020617] border border-[#334155]/50 rounded-xl px-4 py-3 text-white">
                <option value="">Nenhuma Graduação</option>
                <option value="CEL">Coronel</option><option value="TC">Tenente Coronel</option><option value="MAJ">Major</option><option value="CAP">Capitão</option><option value="TEN">Tenente</option><option value="ST">Subtenente</option><option value="1º SGT">1º Sargento</option><option value="2º SGT">2º Sargento</option><option value="3º SGT">3º Sargento</option><option value="SGT">Sargento (Geral)</option><option value="CB">Cabo</option><option value="SD">Soldado</option><option value="CIVIL">Civil / Outro</option>
              </select>
              <input type="text" value={editMemberData.name} onChange={e=>setEditMemberData({...editMemberData, name: e.target.value})} className="w-full bg-[#020617] border border-[#334155]/50 rounded-xl px-4 py-3 text-white" required/>
              <input type="text" value={editMemberData.matricula} onChange={e=>setEditMemberData({...editMemberData, matricula: e.target.value})} className="w-full bg-[#020617] border border-[#334155]/50 rounded-xl px-4 py-3 text-white" required/>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={()=>setEditingMemberId(null)} className="flex-1 px-4 py-3 rounded-xl font-bold bg-[#020617]">Cancelar</button>
                <button type="submit" className="flex-1 px-4 py-3 rounded-xl font-bold bg-[#3B82F6]">Salvar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Details Modal */}
      {showDetailsModal && detailsTx && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[999] flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#0F172A] rounded-2xl w-full max-w-lg shadow-2xl border border-[#334155]/50 flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-[#334155]/50 flex justify-between items-center bg-[#020617] rounded-t-2xl">
              <h3 className="font-bold text-lg flex items-center gap-2 text-yellow-500"><Search size={20}/> Detalhes da Despesa</h3>
              <button onClick={()=>setShowDetailsModal(false)}><X size={20}/></button>
            </div>
            <div className="p-4 md:p-6 overflow-y-auto space-y-4">
              <div className="bg-[#020617] p-4 rounded-xl border border-[#334155]/30">
                <p className="text-sm text-[#94A3B8]">Descrição</p>
                <p className="font-bold text-lg">{detailsTx.description}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-[#020617] p-4 rounded-xl border border-[#334155]/30"><p className="text-sm text-[#94A3B8]">Valor</p><p className="font-bold text-red-500">{formatCurrency(detailsTx.amount)}</p></div>
                <div className="bg-[#020617] p-4 rounded-xl border border-[#334155]/30"><p className="text-sm text-[#94A3B8]">Data</p><p className="font-bold">{detailsTx.date || new Date(detailsTx.createdAt).toLocaleString('pt-BR')}</p></div>
              </div>
              {detailsTx.observation && (
                <div className="bg-yellow-500/10 p-4 rounded-xl border border-yellow-500/30">
                  <p className="text-sm font-bold text-yellow-500 mb-2 flex items-center gap-2"><MessageSquare size={16}/> Observações</p>
                  <p className="text-sm italic">{detailsTx.observation}</p>
                </div>
              )}
              {detailsTx.receiptImage && (
                <div className="bg-[#020617] p-4 rounded-xl border border-[#334155]/30">
                  <p className="text-sm text-[#94A3B8] mb-3 flex items-center gap-2"><FileText size={16} className="text-[#3B82F6]"/> Nota Fiscal</p>
                  {detailsTx.receiptImage.startsWith('data:application/pdf') ? (
                    <div className="text-center p-4 border border-dashed border-[#334155]/50 rounded"><a href={detailsTx.receiptImage} download="nota.pdf" className="text-red-500 font-bold underline"><Download className="inline"/> Baixar PDF</a></div>
                  ) : <img src={detailsTx.receiptImage} className="w-full rounded-lg" alt="Nota" />}
                </div>
              )}
              {detailsTx.extraPhoto && (
                <div className="bg-[#020617] p-4 rounded-xl border border-[#334155]/30">
                  <p className="text-sm text-[#94A3B8] mb-3 flex items-center gap-2"><ImageIcon size={16} className="text-yellow-500"/> Foto Adicional</p>
                  {detailsTx.extraPhoto.startsWith('data:application/pdf') ? (
                    <div className="text-center p-4 border border-dashed border-[#334155]/50 rounded"><a href={detailsTx.extraPhoto} download="anexo.pdf" className="text-red-500 font-bold underline"><Download className="inline"/> Baixar PDF</a></div>
                  ) : <img src={detailsTx.extraPhoto} className="w-full rounded-lg" alt="Extra" />}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Edit TX Modal */}
      {showEditTxModal && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[999] flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#0F172A] rounded-2xl w-full max-w-lg border border-[#334155]/50 flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-[#334155]/50 flex justify-between items-center bg-[#020617] rounded-t-2xl">
              <h3 className="font-bold text-lg flex items-center gap-2 text-[#3B82F6]"><Edit3 size={20}/> Editar Despesa</h3>
              <button onClick={()=>setShowEditTxModal(false)}><X size={20}/></button>
            </div>
            <div className="p-4 md:p-6 overflow-y-auto">
              <form onSubmit={saveEditTx} className="space-y-4">
                <input type="text" value={editTxData.description||''} onChange={e=>setEditTxData({...editTxData, description: e.target.value})} className="w-full bg-[#020617] border border-[#334155]/50 rounded-xl px-4 py-3 text-white" required/>
                <input type="number" step="0.01" value={editTxData.amount||''} onChange={e=>setEditTxData({...editTxData, amount: e.target.value})} className="w-full bg-[#020617] border border-[#334155]/50 rounded-xl px-4 py-3 text-red-500 font-bold" required/>
                <textarea value={editTxData.observation||''} onChange={e=>setEditTxData({...editTxData, observation: e.target.value})} className="w-full bg-[#0F172A] border border-[#334155]/50 rounded-xl px-4 py-3 text-white min-h-[80px]" placeholder="Observações"></textarea>
                <div className="bg-[#020617] p-3 rounded-xl border border-[#334155]/50"><label className="block text-xs text-[#94A3B8]">Trocar Nota</label><input type="file" onChange={e=>processFile(e, setEditExpenseImageBase64)} className="text-xs text-white"/></div>
                <div className="bg-[#020617] p-3 rounded-xl border border-[#334155]/50"><label className="block text-xs text-[#94A3B8]">Trocar Anexo</label><input type="file" onChange={e=>processFile(e, setEditExtraImageBase64)} className="text-xs text-white"/></div>
                <button type="submit" className="w-full bg-[#3B82F6] text-white font-bold py-4 rounded-xl">Salvar Alterações</button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Receipt Modal */}
      {showReceiptModal && receiptTx && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[999] flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#0F172A] rounded-2xl w-full max-w-lg border border-[#334155]/50 flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-[#334155]/50 flex justify-between items-center bg-[#020617] rounded-t-2xl">
              <h3 className="font-bold text-lg flex items-center gap-2"><Receipt className="text-[#3B82F6]" size={20}/> Gerar Recibo</h3>
              <button onClick={()=>setShowReceiptModal(false)}><X size={20}/></button>
            </div>
            
            <div className="p-4 md:p-6 overflow-y-auto flex-grow flex flex-col gap-4">
              {isEditingReceiptSettings ? (
                <div className="bg-[#020617] p-4 rounded-xl border border-[#334155]/50">
                  <h4 className="font-bold mb-4 text-[#3B82F6] flex items-center gap-2"><PenTool size={16}/> Dados do Emissor</h4>
                  <input type="text" value={adminReceiptInfo.name} onChange={e=>setAdminReceiptInfo({...adminReceiptInfo, name: e.target.value})} placeholder="Nome do Adm" className="w-full bg-[#0F172A] border border-[#334155]/50 rounded-xl px-4 py-3 text-white mb-3"/>
                  <input type="text" value={adminReceiptInfo.matricula} onChange={e=>setAdminReceiptInfo({...adminReceiptInfo, matricula: e.target.value})} placeholder="Matrícula" className="w-full bg-[#0F172A] border border-[#334155]/50 rounded-xl px-4 py-3 text-white mb-3"/>
                  <div className="mb-4">
                    <div className="flex justify-between items-center mb-1"><label className="text-xs text-[#94A3B8]">Assinatura Digital</label><button onClick={initSignatureCanvas} className="text-xs text-red-500">Limpar</button></div>
                    <canvas ref={signatureCanvasRef} width="600" height="300" className="w-full bg-white rounded-xl touch-none"></canvas>
                  </div>
                  <button onClick={saveReceiptSettings} className="w-full bg-[#3B82F6] text-white font-bold py-3 rounded-xl">Salvar</button>
                </div>
              ) : (
                <>
                  <div className="flex justify-end"><button onClick={()=>setIsEditingReceiptSettings(true)} className="text-xs text-[#3B82F6]"><Edit3 className="inline w-3 h-3"/> Editar Assinatura</button></div>
                  
                  {generatedReceiptFile ? (
                    <div className="text-center">
                        <img src={URL.createObjectURL(generatedReceiptFile)} className="w-full max-w-sm mx-auto rounded-lg shadow-lg border border-[#334155]/50 mb-4" />
                        <p className="text-green-500 font-bold flex items-center justify-center gap-2"><CheckCircle size={20}/> Imagem Pronta!</p>
                    </div>
                  ) : (
                    <div ref={receiptAreaRef} className="bg-[#FFFFFF] text-[#000000] p-6 md:p-8 rounded-sm shadow-sm relative font-sans">
                        <div className="text-center border-b-2 border-[#D1D5DB] pb-4 mb-4">
                        <h2 className="text-lg md:text-xl font-black uppercase tracking-wider text-[#1F2937]">Grêmio PIT</h2>
                        <p className="text-xs md:text-sm font-bold text-[#6B7280] tracking-widest mt-1">RECIBO DE {receiptTx.type === 'income' ? 'ARRECADAÇÃO' : 'DESPESA'}</p>
                        </div>
                        <div className="space-y-3 text-xs md:text-sm font-medium">
                        <div className="flex justify-between items-end border-b border-[#F3F4F6] pb-2">
                            <span className="text-[#6B7280]">Valor:</span><span className={`font-black text-base md:text-lg ${receiptTx.type==='income'?'text-[#15803D]':'text-[#B91C1C]'}`}>{formatCurrency(receiptTx.amount)}</span>
                        </div>
                        <div className="flex justify-between items-end border-b border-[#F3F4F6] pb-2">
                            <span className="text-[#6B7280]">Ref:</span>
                            <span className="font-bold text-[#1F2937] text-right uppercase">
                              {(() => {
                                const m = matchMemberToTx(receiptTx);
                                return m ? `${m.rank ? m.rank + ' ' : ''}${m.name}`.trim() : receiptTx.description;
                              })()}
                            </span>
                        </div>
                        <div className="flex justify-between items-end border-b border-[#F3F4F6] pb-2">
                            <span className="text-[#6B7280]">Data/Hora:</span>
                            <span className="font-bold text-[#1F2937] text-right">
                              {new Date(receiptTx.createdAt || Date.now()).toLocaleString('pt-BR')}
                            </span>
                        </div>
                        <div className="flex justify-between items-end pb-2">
                            <span className="text-[#6B7280]">Competência:</span><span className="font-bold text-[#1F2937] uppercase">{receiptTx.month}</span>
                        </div>
                        </div>
                        <div className="mt-8 pt-4 border-t-2 border-[#D1D5DB] text-center flex flex-col items-center">
                        {adminReceiptInfo.signatureDataUrl ? <img src={adminReceiptInfo.signatureDataUrl} className="h-16 object-contain mb-1" /> : <div className="h-16 mb-1"></div>}
                        <div className="w-48 border-t border-[#1F2937] mb-2"></div>
                        <p className="font-bold text-[#111827] uppercase text-xs">{adminReceiptInfo.name || 'Admin'}</p>
                        <p className="text-xs text-[#6B7280] font-bold">Mat: {adminReceiptInfo.matricula}</p>
                        </div>
                    </div>
                  )}

                  <button onClick={shareReceiptImage} disabled={isGeneratingReceipt} className="w-full bg-[#10B981] hover:bg-green-600 text-white font-bold py-4 rounded-xl shadow-lg flex items-center justify-center gap-2">
                    {isGeneratingReceipt ? <Loader2 size={20} className="animate-spin"/> : (generatedReceiptFile ? <Send size={20}/> : <Share2 size={20}/>)}
                    {isGeneratingReceipt ? 'Processando...' : (generatedReceiptFile ? 'Confirmar e Enviar' : 'Gerar Imagem')}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
