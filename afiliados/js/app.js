function login() {
    const userEl = document.getElementById('loginUser');
    const passEl = document.getElementById('loginPass');
    
    if (!userEl || !passEl) return;
    
    const user = userEl.value.trim();
    const pass = passEl.value;

    if (!user || !pass) {
        showToast('Ingresa usuario y contraseña', 'error');
        return;
    }

    const adminUser = DB.getAdminUser();
    const adminPass = DB.getAdminPass();

    if (user.toLowerCase() === adminUser.toLowerCase() && pass === adminPass) {
        currentUser = { type: 'admin', name: 'Administrador' };
        DB.setCurrentUser(currentUser);
        
        // PRIORIDAD 1: Mostrar el panel inmediatamente
        showAdminDashboard();
        showToast('Bienvenido Administrador!');

        // PRIORIDAD 2: Firebase en segundo plano
        setTimeout(() => {
            if (typeof initFirebase === 'function') initFirebase();
        }, 100);
    } else {
        const affiliates = DB.getAffiliates() || [];
        const affiliate = affiliates.find(a => a.user && a.user.toLowerCase() === user.toLowerCase());
        
        if (affiliate && affiliate.pass === pass) {
            currentUser = { type: 'affiliate', ...affiliate };
            DB.setCurrentUser(currentUser);
            
            // Cambio de pantalla inmediato
            showAffiliateDashboard();
            
            showToast('¡Bienvenido ' + affiliate.name + '!');
        } else {
            showToast('Credenciales incorrectas', 'error');
        }
    }
}
window.login = login;

function showResetPass() {
    const modal = document.getElementById('modalResetPass');
    if (modal) {
        modal.classList.remove('hidden');
        modal.style.display = 'flex';
    } else {
        console.error('No se encontró el elemento modalResetPass');
    }
}
window.showResetPass = showResetPass;

// ============ BASE DE DATOS LOCAL (SIN ENCRIPTACION) ============
const DB = {
    _defaultAdminPass: '312915',
    
    getAffiliates() { 
        const data = localStorage.getItem('afiliados');
        return data ? JSON.parse(data) : [];
    },
    setAffiliates(data) { 
        localStorage.setItem('afiliados', JSON.stringify(data));
        localStorage.setItem('needsCloudSync', 'true');
    },
    getSales() { 
        const data = localStorage.getItem('ventas');
        return data ? JSON.parse(data) : [];
    },
    setSales(data) { 
        localStorage.setItem('ventas', JSON.stringify(data));
        localStorage.setItem('needsCloudSync', 'true');
    },
    getEmails() { 
        const data = localStorage.getItem('correosAutorizados');
        return data ? JSON.parse(data) : [];
    },
    setEmails(data) { 
        localStorage.setItem('correosAutorizados', JSON.stringify(data));
        localStorage.setItem('needsCloudSync', 'true');
    },
    getPayments() { 
        const data = localStorage.getItem('pagos');
        return data ? JSON.parse(data) : [];
    },
    setPayments(data) { 
        localStorage.setItem('pagos', JSON.stringify(data));
        localStorage.setItem('needsCloudSync', 'true');
    },
    getMessages() {
        const data = localStorage.getItem('mensajes');
        return data ? JSON.parse(data) : [];
    },
    setMessages(data) {
        localStorage.setItem('mensajes', JSON.stringify(data));
        localStorage.setItem('needsCloudSync', 'true');
    },
    getSettings() {
        const data = localStorage.getItem('settings');
        return data ? JSON.parse(data) : { marketingText: "¡Hola! Quería compartirte este excelente sistema para que manejes tu negocio. Es súper profesional para gestionar clientes, ventas y facturas fácilmente.\n\nDime si te interesa probarlo y yo te guío en todo el proceso de instalación con mi código." };
    },
    setSettings(data) {
        localStorage.setItem('settings', JSON.stringify(data));
        localStorage.setItem('needsCloudSync', 'true');
    },
    getCurrentUser() { 
        const data = localStorage.getItem('currentUser');
        return data ? JSON.parse(data) : null;
    },
    setCurrentUser(data) { 
        if (data) {
            localStorage.setItem('currentUser', JSON.stringify(data));
        } else {
            localStorage.removeItem('currentUser');
        }
    },
    logout() { 
        localStorage.removeItem('currentUser');
    },
    getAdminPass() { 
        return localStorage.getItem('adminPass') || this._defaultAdminPass; 
    },
    setAdminPass(pass) { 
        localStorage.setItem('adminPass', pass);
        localStorage.setItem('needsCloudSync', 'true');
    },
    getAdminUser() { 
        return localStorage.getItem('adminUser') || 'admin'; 
    },
    setAdminUser(user) {
        localStorage.setItem('adminUser', user);
        localStorage.setItem('needsCloudSync', 'true');
    }
};

let currentUser = null;
let pendingEmail = null;
let verificationCode = null;

// ============ FUNCIONES DE UI ============
function showToast(msg, type = 'success') {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = msg;
    toast.style.display = 'block';
    toast.className = 'fixed bottom-4 right-4 px-6 py-3 rounded-xl font-semibold transition-opacity z-[100] ' + 
        (type === 'error' ? 'bg-red-600' : 'bg-green-600');
    toast.style.opacity = '1';
    
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => { toast.style.display = 'none'; }, 500);
    }, 3000);
}


function showScreen(screenId) {
    const screens = ['loginScreen', 'registerScreen', 'adminDashboard', 'affiliateDashboard'];
    screens.forEach(s => {
        const el = document.getElementById(s);
        if (el) {
            el.classList.add('hidden', 'force-hidden');
            el.classList.remove('force-block', 'force-flex', 'visible');
            el.style.display = 'none';
        }
    });
    
    const active = document.getElementById(screenId);
    if (active) {
        active.classList.remove('hidden', 'force-hidden');
        if (screenId === 'loginScreen' || screenId === 'registerScreen') {
            active.classList.add('force-flex');
            active.style.display = 'flex';
        } else {
            active.classList.add('force-block');
            active.style.display = 'block';
        }
        active.style.opacity = '1';
        active.style.visibility = 'visible';
    }
}

function showLogin() {
    showScreen('loginScreen');
}

function showRegister() {
    showScreen('registerScreen');
}

function showAdminDashboard() {
    // 1. Mostrar la pantalla inmediatamente
    showScreen('adminDashboard');
    showTab('dashboard');
    
    // 2. Cargar los datos pesados en segundo plano
    setTimeout(() => {
        try {
            loadAdminData();
        } catch (e) {
            console.error('Error al cargar datos pesados:', e);
        }
    }, 100); 
}

function showAffiliateDashboard() {
    const user = DB.getCurrentUser();
    if (!user) {
        showLogin();
        return;
    }
    currentUser = user;
    showScreen('affiliateDashboard');
    loadAffiliateData();
}


function showTab(tab) {
    document.querySelectorAll('.tab-content').forEach(el => {
        el.classList.add('hidden');
        el.style.display = 'none';
    });
    const tabContent = document.getElementById('tab-' + tab);
    if (tabContent) {
        tabContent.classList.remove('hidden');
        tabContent.style.display = 'block';
    }
    document.querySelectorAll('.tab-btn').forEach(el => {
        el.classList.remove('bg-blue-600');
        el.classList.add('bg-slate-700');
    });
    const activeTab = document.querySelector(`[data-tab="${tab}"]`);
    if (activeTab) {
        activeTab.classList.add('bg-blue-600');
        activeTab.classList.remove('bg-slate-700');
    }
    
    // Cargar tablas según la pestaña
    if (tab === 'emails') {
        loadEmailsTable();
    } else if (tab === 'payments') {
        loadPaymentsTable();
    } else if (tab === 'announcements') {
        loadAdminData(); // Refrescar anuncios y settings
    } else if (tab === 'tickets') {
        loadAdminTickets();
    }
}

function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function logout() {
    DB.logout();
    currentUser = null;
    showLogin();
    document.getElementById('loginUser').value = '';
    document.getElementById('loginPass').value = '';
}
window.logout = logout;

function loadAdminData() {
    try {
        const affiliates = DB.getAffiliates() || [];
        const sales = DB.getSales() || [];

        const elStatAff = document.getElementById('statAffiliates');
        if (elStatAff) elStatAff.textContent = affiliates.length;
        
        const elStatSal = document.getElementById('statSales');
        if (elStatSal) elStatSal.textContent = sales.length;

        const paidCommission = sales.filter(s => s.status === 'pagado').length * 2;
        const pendingCommission = sales.filter(s => s.status === 'pendiente').length * 2;

        if (document.getElementById('statPaid')) document.getElementById('statPaid').textContent = '$' + paidCommission;
        if (document.getElementById('statPending')) document.getElementById('statPending').textContent = '$' + pendingCommission;

        // --- SECCIÓN ANUNCIOS (PRIORIDAD) ---
        const settings = DB.getSettings();
        const adminMkt = document.getElementById('adminMarketingText');
        if (adminMkt) adminMkt.value = settings.marketingText || '';

        const msgTarget = document.getElementById('msgTarget');
        if (msgTarget) {
            msgTarget.innerHTML = '<option value="all">A todos los afiliados</option>' +
                affiliates.map(a => `<option value="${a.id}">${a.name} ${a.lastname || ''}</option>`).join('');
        }
        loadAdminMessagesHistory();

        // --- TABLAS PRINCIPALES ---
        // Cargar tabla de afiliados
        const tbody = document.getElementById('affiliatesTable');
        if (tbody) {
            tbody.innerHTML = affiliates.map(a => {
                const affiliateSales = sales.filter(s => s.affiliateId === a.id);
                return `
                    <tr class="border-b border-slate-700/50">
                        <td class="py-3">${escapeHtml(a.name)} ${escapeHtml(a.lastname || '')}</td>
                        <td class="py-3 font-mono">${escapeHtml(a.cedula || '-')}</td>
                        <td class="py-3">${escapeHtml(a.phone || '-')}</td>
                        <td class="py-3">${escapeHtml(a.banco || '-')}</td>
                        <td class="py-3 text-blue-400 font-bold">${a.referralsCount || 0}</td>
                        <td class="py-3 text-green-400 font-bold">${affiliateSales.length}</td>
                        <td class="py-3 text-amber-400 font-bold">$${affiliateSales.length * 2}</td>
                        <td class="py-3">
                            <button onclick="showEditAffiliate(${a.id})" class="text-blue-400 hover:text-blue-300 mr-2 text-sm">Editar</button>
                            <button onclick="deleteAffiliate(${a.id})" class="text-red-400 hover:text-red-300 text-sm">Eliminar</button>
                        </td>
                    </tr>
                `;
            }).join('');
        }

        // Cargar tabla de ventas (reemplaza loadSalesTable inline para estabilidad)
        const salesBody = document.getElementById('salesTable');
        if (salesBody) {
            salesBody.innerHTML = sales.map(s => {
                const affiliate = affiliates.find(a => a.id === s.affiliateId);
                return `
                    <tr class="border-b border-slate-700/50">
                        <td class="py-3 font-mono">${escapeHtml(s.code || '-')}</td>
                        <td class="py-3">
                            <div class="font-bold">${escapeHtml(s.negocio || 'Sin nombre')}</div>
                            <div class="text-xs text-slate-400">${escapeHtml(s.rif || '-')}</div>
                        </td>
                        <td class="py-3">${affiliate ? escapeHtml(affiliate.name + ' ' + (affiliate.lastname || '')) : '-'}</td>
                        <td class="py-3">${s.daysOriginal || 0} días</td>
                        <td class="py-3 text-slate-400">${new Date(s.date).toLocaleDateString()}</td>
                        <td class="py-3 text-amber-400 font-bold">$2</td>
                        <td class="py-3">
                            <button onclick="toggleSaleStatus(${s.id})" class="${s.status === 'pagado' ? 'text-green-400' : 'text-yellow-400'}">
                                ${s.status === 'pagado' ? '✓ Pagado' : '○ Pendiente'}
                            </button>
                        </td>
                        <td class="py-3">
                            <button onclick="showClientHistory(${s.id})" class="text-indigo-400 hover:text-indigo-300 mr-2 text-sm">Historial</button>
                            <button onclick="showEditLicense(${s.id})" class="text-blue-400 hover:text-blue-300 mr-2 text-sm">Editar</button>
                            <button onclick="deleteSale(${s.id})" class="text-red-400 hover:text-red-300 text-sm">Eliminar</button>
                        </td>
                    </tr>
                `;
            }).join('');
        }

        // Dashboard stats adicionales
        if (document.getElementById('dashTotalCommission')) document.getElementById('dashTotalCommission').textContent = '$' + (sales.length * 2);
        if (document.getElementById('dashPendingCommission')) document.getElementById('dashPendingCommission').textContent = '$' + pendingCommission;
        
        // Dashboard: Top Affiliates
        const tBodyTop = document.getElementById('topAffiliates');
        if (tBodyTop) {
            let topStats = affiliates.map(a => {
                const affSales = sales.filter(s => s.affiliateId === a.id);
                return { name: a.name + ' ' + (a.lastname || ''), salesCount: affSales.length, comm: affSales.length * 2 };
            });
            topStats.sort((a,b) => b.salesCount - a.salesCount);
            if (topStats.length === 0) {
                tBodyTop.innerHTML = '<div class="text-sm text-slate-400">Sin datos</div>';
            } else {
                tBodyTop.innerHTML = topStats.slice(0, 5).map(t => `
                    <div class="flex justify-between items-center py-2 border-b border-slate-700/50">
                        <span class="text-sm font-semibold">${t.name}</span>
                        <span class="text-sm text-green-400 font-bold">${t.salesCount} ventas ($${t.comm})</span>
                    </div>
                `).join('');
            }
        }

        // Dashboard: Actividad Reciente
        const rBody = document.getElementById('recentActivity');
        if (rBody) {
            let recent = [...sales].sort((a,b) => new Date(b.date) - new Date(a.date)).slice(0, 5);
            if (recent.length === 0) {
                rBody.innerHTML = '<div class="text-sm text-slate-400 py-2">Sin actividad reciente</div>';
            } else {
                rBody.innerHTML = recent.map(s => {
                    const aff = affiliates.find(a => a.id === s.affiliateId);
                    const affName = aff ? (aff.name + ' ' + (aff.lastname || '')) : 'Desconocido';
                    return `
                        <div class="flex justify-between items-center py-2 border-b border-slate-700/50">
                            <div>
                                <div class="text-sm font-semibold">Venta: ${escapeHtml(s.negocio || '-')}</div>
                                <div class="text-xs text-slate-400">Afiliado: ${escapeHtml(affName)}</div>
                            </div>
                            <div class="text-sm text-amber-400 font-bold">+$2</div>
                        </div>
                    `;
                }).join('');
            }
        }

        // Dashboard: Monthly Sales Chart
        const chart = document.getElementById('monthlySalesChart');
        if (chart) {
            const last6Mos = [0,0,0,0,0,0];
            const now = new Date();
            sales.forEach(s => {
                const d = new Date(s.date);
                const diff = (now.getFullYear() - d.getFullYear()) * 12 + now.getMonth() - d.getMonth();
                if (diff >= 0 && diff < 6) last6Mos[5-diff]++;
            });
            const max = Math.max(...last6Mos, 1);
            chart.innerHTML = last6Mos.map((count) => {
                const h = Math.max((count / max * 100), 5); // min 5% height
                return `<div class="w-full flex flex-col items-center justify-end h-full">
                            <div class="text-[10px] text-slate-400 mb-1">${count}</div>
                            <div class="bg-blue-600 w-full rounded-t transition-all" style="height: ${h}%"></div>
                        </div>`;
            }).join('');
        }

        // Cargar tablas adicionales
        if (typeof loadEmailsTable === 'function') loadEmailsTable();
        if (typeof loadPaymentsTable === 'function') loadPaymentsTable();
        if (typeof loadAdminMessagesHistory === 'function') loadAdminMessagesHistory();
        if (typeof loadAdminTickets === 'function') loadAdminTickets();
    } catch (err) {
        console.error('Error en loadAdminData:', err);
    }
}

// ============ SISTEMA DE TICKETS (NUEVO) ============
function sendTicket() {
    const subject = document.getElementById('ticketSubject').value.trim();
    const message = document.getElementById('ticketMessage').value.trim();
    
    if (!subject || !message) {
        showToast('Asunto y mensaje obligatorios', 'error');
        return;
    }
    
    const tickets = DB.getTickets();
    const newTicket = {
        id: Date.now(),
        affiliateId: currentUser.id,
        affiliateName: currentUser.name + ' ' + (currentUser.lastname || ''),
        subject: subject,
        message: message,
        date: new Date().toISOString(),
        status: 'Abierto'
    };
    
    tickets.push(newTicket);
    DB.setTickets(tickets);
    
    document.getElementById('ticketSubject').value = '';
    document.getElementById('ticketMessage').value = '';
    
    showToast('¡Ticket enviado correctamente!');
    loadAffiliateTickets();
}

function loadAdminTickets() {
    const tickets = DB.getTickets();
    const table = document.getElementById('ticketsTableAdmin');
    if (!table) return;
    
    if (tickets.length === 0) {
        table.innerHTML = '<tr><td colspan="5" class="py-4 text-center text-slate-400">No hay tickets de soporte</td></tr>';
        return;
    }
    
    // Ver los más recientes primero
    const reversed = [...tickets].sort((a,b) => b.id - a.id);
    
    table.innerHTML = reversed.map(t => `
        <tr class="border-b border-slate-700/50 hover:bg-slate-800/30">
            <td class="py-3 text-xs text-slate-400">${new Date(t.date).toLocaleDateString()}</td>
            <td class="py-3 font-semibold text-blue-400">${escapeHtml(t.affiliateName)}</td>
            <td class="py-3 font-bold text-xs">${escapeHtml(t.subject)}</td>
            <td class="py-3">
                <button onclick="viewTicket(${t.id})" class="bg-blue-600/20 text-blue-400 px-3 py-1 rounded-lg text-xs font-bold hover:bg-blue-600/40 transition-all">
                    👁️ Leer Ticket
                </button>
            </td>
            <td class="py-3 text-right">
                <button onclick="deleteTicket(${t.id})" class="text-red-400 hover:text-red-300 ml-2 text-xs">Eliminar</button>
            </td>
        </tr>
    `).join('');
}

function viewTicket(id) {
    const all = DB.getMessages();
    const t = all.find(x => x.id === id);
    if (!t) return;
    
    document.getElementById('viewTicketSender').textContent = t.senderName || t.senderId || "Afiliado";
    document.getElementById('viewTicketDate').textContent = new Date(t.date).toLocaleString();
    document.getElementById('viewTicketSubject').textContent = t.title || t.subject || "Sin Asunto";
    document.getElementById('viewTicketMessage').textContent = t.content || t.message || "";
    
    const modal = document.getElementById('modalTicketDetail');
    if (modal) {
        modal.classList.remove('hidden');
        modal.style.display = 'flex';
    }
}

function loadAffiliateTickets() {
    const all = DB.getMessages();
    const user = DB.getCurrentUser();
    if (!user) return;
    const myTickets = all.filter(t => t.senderId === user.id && (t.type === 'ticket' || t.status));
    const container = document.getElementById('myTicketsHistory');
    if (!container) return;
    
    if (myTickets.length === 0) {
        container.innerHTML = '<p class="text-xs text-slate-400 p-4 text-center">Aún no has enviado mensajes.</p>';
        return;
    }
    
    const reversed = [...myTickets].sort((a,b) => b.id - a.id);
    
    container.innerHTML = reversed.map(t => `
        <div class="border-b border-slate-700 p-3">
            <div class="flex justify-between text-[10px] text-slate-500 mb-1">
                <span>${new Date(t.date).toLocaleDateString()}</span>
                <span class="font-bold text-green-500 uppercase">${t.status}</span>
            </div>
            <div class="text-xs font-bold text-white">${escapeHtml(t.subject)}</div>
            <div class="text-xs text-slate-400 mt-1">${escapeHtml(t.message)}</div>
        </div>
    `).join('');
}

function deleteTicket(id) {
    if (!confirm('¿Eliminar este ticket?')) return;
    let all = DB.getMessages();
    all = all.filter(t => t.id !== id);
    DB.setMessages(all);
    loadAdminTickets();
    showToast('Ticket eliminado');
}

function saveMarketingText() {
    const text = document.getElementById('adminMarketingText').value;
    const settings = DB.getSettings();
    settings.marketingText = text;
    DB.setSettings(settings);
    showToast('Plantilla guardada y actualizada para todos');
}

function sendAdminMessage() {
    const target = document.getElementById('msgTarget').value;
    const title = document.getElementById('msgTitle').value.trim();
    const content = document.getElementById('msgContent').value.trim();
    
    if (!content) {
        showToast('Escribe un mensaje', 'error');
        return;
    }
    
    const messages = DB.getMessages() || [];
    messages.push({
        id: Date.now(),
        targetId: target === 'all' ? null : parseInt(target),
        title,
        content,
        date: new Date().toISOString(),
        readBy: [] // array de affiliateIds que ya lo leyeron
    });
    
    DB.setMessages(messages);
    document.getElementById('msgTitle').value = '';
    document.getElementById('msgContent').value = '';
    showToast('¡Mensaje enviado exitosamente!');
    loadAdminMessagesHistory();
}

function loadAdminMessagesHistory() {
    const messages = DB.getMessages() || [];
    const affiliates = DB.getAffiliates() || [];
    const container = document.getElementById('adminMessagesHistory');
    if (!container) return;
    
    // Reverse para ver más recientes primero
    const reversed = [...messages].sort((a,b) => b.id - a.id);
    
    if (reversed.length === 0) {
        container.innerHTML = '<p class="text-sm text-slate-400 p-2 text-center">No has enviado notificaciones aún.</p>';
        return;
    }
    
    container.innerHTML = reversed.map(m => {
        let dest = "Global (A todos)";
        if (m.targetId !== null) {
            const af = affiliates.find(a => a.id === m.targetId);
            dest = af ? `Directo: ${af.name} ${af.lastname || ''}` : 'Directo (eliminado)';
        }
        return `
            <div class="border-b border-slate-700 p-3 hover:bg-slate-700/50 transition-colors">
                <div class="flex justify-between items-start mb-1">
                    <span class="text-[10px] font-bold text-slate-400 uppercase tracking-widest">${dest}</span>
                    <span class="text-[10px] text-slate-500">${new Date(m.date).toLocaleDateString()} ${new Date(m.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                </div>
                <div class="text-sm font-semibold text-white">${escapeHtml(m.title || 'Sin Título')}</div>
                <div class="text-xs text-slate-300 whitespace-pre-wrap mt-1">${escapeHtml(m.content)}</div>
            </div>
        `;
    }).join('');
}

function loadLicensesTable() {
    const sales = DB.getSales() || [];
    const tbody = document.getElementById('licensesTable');
    if (!tbody) return;
    
    tbody.innerHTML = sales.map(s => {
        const createdDate = new Date(s.date);
        const expDate = new Date(createdDate.getTime() + (s.days || s.daysOriginal || 0) * 24 * 60 * 60 * 1000);
        
        return `
            <tr class="border-b border-slate-700/50">
                <td class="py-3 font-mono">${escapeHtml(s.code || '-')}</td>
                <td class="py-3 font-bold">${escapeHtml(s.negocio || '-')}</td>
                <td class="py-3">${escapeHtml(s.rif || '-')}</td>
                <td class="py-3">${escapeHtml(s.telefono || '-')}</td>
                <td class="py-3 text-center">${s.daysOriginal || 0}</td>
                <td class="py-3 text-center text-blue-400 font-bold">${s.days || s.daysOriginal || 0}</td>
                <td class="py-3"><span class="px-2 py-1 text-xs rounded ${s.status === 'pagado' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}">${s.status || 'pendiente'}</span></td>
                <td class="py-3 text-slate-400">${expDate.toLocaleDateString()}</td>
                <td class="py-3">
                    <button onclick="showEditLicense(${s.id})" class="text-blue-400 hover:text-blue-300 mr-2 text-sm">Editar</button>
                    <button onclick="showRenewLicense(${s.id})" class="text-green-400 hover:text-green-300 mr-2 text-sm">Renovar</button>
                    <button onclick="showClientHistory(${s.id})" class="text-indigo-400 hover:text-indigo-300 text-sm">Historial</button>
                </td>
            </tr>
        `;
    }).join('');
}

function loadAffiliateData() {
    try {
        const sales = DB.getSales().filter(s => s.affiliateId === currentUser.id);
        const payments = DB.getPayments().filter(p => p.affiliateId === currentUser.id);
        
        if (document.getElementById('affiliateName')) {
            document.getElementById('affiliateName').textContent = currentUser.name;
        }
    if (document.getElementById('mySales')) {
        document.getElementById('mySales').textContent = sales.length;
    }
    if (document.getElementById('myCommission')) {
        document.getElementById('myCommission').textContent = '$' + (sales.length * 2);
    }
    if (document.getElementById('myReferralCode')) {
        document.getElementById('myReferralCode').textContent = currentUser.referralCode || 'N/A';
    }
    if (document.getElementById('myTotalEarned')) {
        document.getElementById('myTotalEarned').textContent = '$' + (sales.length * 2);
    }
    if (document.getElementById('myTotalPaid')) {
        const totalPaid = payments.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
        document.getElementById('myTotalPaid').textContent = '$' + totalPaid;
    }
    if (document.getElementById('myPending')) {
        const totalEarned = sales.length * 2;
        const totalPaid = payments.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
        document.getElementById('myPending').textContent = '$' + (totalEarned - totalPaid);
    }
    
    const tbody = document.getElementById('mySalesTable');
    if (tbody) {
        if (sales.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="py-4 text-center text-slate-400">No tienes ventas registradas</td></tr>';
        } else {
            tbody.innerHTML = sales.map(s => `
                <tr class="border-b border-slate-700/50">
                    <td class="py-3 font-mono">${s.code || '-'}</td>
                    <td class="py-3">${s.rif || '-'}</td>
                    <td class="py-3">${s.days || s.daysOriginal || 0} días</td>
                    <td class="py-3 text-slate-400">${new Date(s.date).toLocaleDateString()}</td>
                    <td class="py-3 text-amber-400">$2</td>
                </tr>
            `).join('');
        }
    }
    
    // Cargar material de marketing global
    const settings = DB.getSettings();
    if (document.getElementById('marketingText')) {
        document.getElementById('marketingText').textContent = settings.marketingText || 'Solicita a tu administrador que configure el material de venta.';
    }
    
    updateAffiliateUnreadBadge();
    } catch (err) {
        console.error('Error en loadAffiliateData:', err);
    }
}

function updateAffiliateUnreadBadge() {
    if (!currentUser) return;
    const messages = DB.getMessages() || [];
    
    // Filtrar los que son para este afiliado (targetId null o targetId == currentUser.id)
    const myMessages = messages.filter(m => m.targetId === null || m.targetId === currentUser.id);
    
    // Buscar los NO leídos (donde mi user.id no esta en readBy)
    const unread = myMessages.filter(m => !m.readBy || !m.readBy.includes(currentUser.id));
    
    const badge = document.getElementById('unreadBadge');
    if (badge) {
        if (unread.length > 0) {
            badge.textContent = unread.length;
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }
    }
}

function showAffiliateMessages() {
    if (!currentUser) return;
    const messages = DB.getMessages() || [];
    const myMessages = messages.filter(m => m.targetId === null || m.targetId === currentUser.id);
    const container = document.getElementById('affiliateMessagesList');
    
    if (container) {
        if (myMessages.length === 0) {
            container.innerHTML = '<p class="text-slate-400 text-sm text-center py-4">No tienes mensajes nuevos.</p>';
        } else {
            // Recientes primero
            const reversed = [...myMessages].sort((a,b) => b.id - a.id);
            container.innerHTML = reversed.map(m => {
                const isUnread = !m.readBy || !m.readBy.includes(currentUser.id);
                return `
                    <div class="border-b ${isUnread ? 'bg-indigo-600/10 border-indigo-500/50' : 'border-slate-700/50'} p-3 rounded-lg mb-2">
                        <div class="flex justify-between items-start mb-1">
                            <span class="text-xs font-bold ${isUnread ? 'text-indigo-400' : 'text-slate-400'}">${isUnread ? '🔵 Nuevo' : 'Leído'}</span>
                            <span class="text-[10px] text-slate-500">${new Date(m.date).toLocaleDateString()} ${new Date(m.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                        </div>
                        <h3 class="text-sm font-bold text-white mb-1">${escapeHtml(m.title || 'Aviso de Administración')}</h3>
                        <p class="text-xs text-slate-300 whitespace-pre-wrap">${escapeHtml(m.content)}</p>
                    </div>
                `;
            }).join('');
        }
    }
    
    document.getElementById('modalAffiliateMessages').classList.remove('hidden');
    
    // Marcar como leídos todos
    let needsUpdate = false;
    myMessages.forEach(m => {
        if (!m.readBy) m.readBy = [];
        if (!m.readBy.includes(currentUser.id)) {
            m.readBy.push(currentUser.id);
            needsUpdate = true;
        }
    });
    
    if (needsUpdate) {
        DB.setMessages(messages);
        updateAffiliateUnreadBadge();
    }
}

function showAffiliateProfile() {
    if (!currentUser) return;
    document.getElementById('profileName').value = currentUser.name || '';
    document.getElementById('profileLastname').value = currentUser.lastname || '';
    document.getElementById('profilePhone').value = currentUser.phone || '';
    document.getElementById('profileCedula').value = currentUser.cedula || '';
    document.getElementById('profileBanco').value = currentUser.banco || '';
    document.getElementById('profileNewPass').value = '';
    
    if (document.getElementById('modalAffiliateProfile')) {
        document.getElementById('modalAffiliateProfile').classList.remove('hidden');
    }
}

function saveAffiliateProfile() {
    if (!currentUser) return;
    const name = document.getElementById('profileName').value;
    const lastname = document.getElementById('profileLastname').value;
    const phone = document.getElementById('profilePhone').value;
    const cedula = document.getElementById('profileCedula').value;
    const banco = document.getElementById('profileBanco').value;
    const newPass = document.getElementById('profileNewPass').value;
    
    let affiliates = DB.getAffiliates() || [];
    const index = affiliates.findIndex(a => a.id === currentUser.id);
    if (index !== -1) {
        affiliates[index] = { ...affiliates[index], name, lastname, phone, cedula, banco };
        if (newPass) {
            affiliates[index].pass = newPass;
        }
        DB.setAffiliates(affiliates);
        currentUser = affiliates[index];
        DB.setCurrentUser(currentUser);
        closeModal('modalAffiliateProfile');
        showToast('Perfil actualizado');
        loadAffiliateData();
    }
}

// ============ HERRAMIENTAS AFILIADO ============
function getAdminPhone() {
    // Número real del administrador (Venezuela) - Nova POS Pro Official
    return "584146098724";
}

function requestPaymentWpp() {
    if (!currentUser) return;
    const phoneAdmin = getAdminPhone();
    if (!phoneAdmin) {
        showToast('El administrador aún no ha configurado su WhatsApp.', 'error');
        return;
    }
    
    const pendingAmountEl = document.getElementById('myPending');
    const pendingAmount = pendingAmountEl ? pendingAmountEl.textContent : '$0';
    
    if(pendingAmount === '$0' || pendingAmount === '$0.00' || pendingAmount === '$0.0' || pendingAmount === '$') {
        showToast('No tienes comisiones pendientes por cobrar', 'error');
        return;
    }
    
    const txt = `¡Hola! Quiero solicitar el pago de mis comisiones. Mi saldo pendiente es de ${pendingAmount}. Mi usuario afiliado es: ${currentUser.user}`;
    window.open(`https://wa.me/${phoneAdmin}?text=${encodeURIComponent(txt)}`, '_blank');
}

function supportWpp() {
    if (!currentUser) return;
    const phoneAdmin = getAdminPhone();
    if (!phoneAdmin) {
        showToast('El administrador aún no ha configurado su WhatsApp.', 'error');
        return;
    }
    
    const txt = `¡Hola! Necesito soporte técnico con mi panel de afiliado. Mi usuario es: ${currentUser.user}`;
    window.open(`https://wa.me/${phoneAdmin}?text=${encodeURIComponent(txt)}`, '_blank');
}

function copyMarketingText() {
    const txtEl = document.getElementById('marketingText');
    if(txtEl) {
        navigator.clipboard.writeText(txtEl.innerText).then(() => {
            showToast('¡Plantilla de ventas copiada!');
        });
    }
}

// ============ CRUD AFILIADOS ============
function showAddAffiliate() {
    document.getElementById('modalAddAffiliate').classList.remove('hidden');
}

function addAffiliate() {
    const name = document.getElementById('addName').value;
    const lastname = document.getElementById('addLastname').value;
    const cedula = document.getElementById('addCedula').value;
    const phone = document.getElementById('addPhone').value;
    const user = document.getElementById('addUser').value;
    const pass = document.getElementById('addPass').value;
    const banco = document.getElementById('addBanco').value;

    if (!name || !user || !pass) {
        showToast('Completa los campos obligatorios', 'error');
        return;
    }

    const affiliates = DB.getAffiliates() || [];
    if (affiliates.find(a => a.user === user)) {
        showToast('El usuario ya existe', 'error');
        return;
    }

    affiliates.push({
        id: Date.now(),
        name, lastname, cedula, phone, user, pass, banco,
        referralCode: 'AF' + Math.random().toString(36).substring(2, 6).toUpperCase(),
        createdAt: new Date().toISOString()
    });

    DB.setAffiliates(affiliates);
    closeModal('modalAddAffiliate');
    loadAdminData();
    showToast('Afiliado agregado');
}

function deleteAffiliate(id) {
    if (!confirm('¿Eliminar este afiliado?')) return;
    let affiliates = DB.getAffiliates() || [];
    affiliates = affiliates.filter(a => a.id !== id);
    DB.setAffiliates(affiliates);
    loadAdminData();
    showToast('Afiliado eliminado');
}

function showEditAffiliate(id) {
    const affiliates = DB.getAffiliates() || [];
    const a = affiliates.find(x => x.id === id);
    if (!a) return;
    document.getElementById('editId').value = a.id;
    document.getElementById('editName').value = a.name || '';
    document.getElementById('editLastname').value = a.lastname || '';
    document.getElementById('editCedula').value = a.cedula || '';
    document.getElementById('editPhone').value = a.phone || '';
    document.getElementById('editBanco').value = a.banco || '';
    const passEl = document.getElementById('editPass');
    if (passEl) passEl.value = '';
    document.getElementById('modalEditAffiliate').classList.remove('hidden');
}

function saveEditAffiliate() {
    const id = parseInt(document.getElementById('editId').value);
    const name = document.getElementById('editName').value;
    const lastname = document.getElementById('editLastname').value;
    const cedula = document.getElementById('editCedula').value;
    const phone = document.getElementById('editPhone').value;
    const banco = document.getElementById('editBanco').value;
    const newPass = document.getElementById('editPass') ? document.getElementById('editPass').value.trim() : '';
    
    let affiliates = DB.getAffiliates() || [];
    const index = affiliates.findIndex(a => a.id === id);
    if (index !== -1) {
        affiliates[index] = { ...affiliates[index], name, lastname, cedula, phone, banco };
        if (newPass) {
            affiliates[index].pass = newPass;
        }
        DB.setAffiliates(affiliates);
        loadAdminData();
        closeModal('modalEditAffiliate');
        showToast('Afiliado actualizado');
    }
}

// ============ CRUD VENTAS ============
function showAddSale() {
    const affiliates = DB.getAffiliates() || [];
    const select = document.getElementById('saleAffiliate');
    select.innerHTML = '<option value="">Seleccionar Afiliado</option>' +
        affiliates.map(a => `<option value="${a.id}">${a.name} ${a.lastname || ''}</option>`).join('');
    document.getElementById('modalAddSale').classList.remove('hidden');
}

function addSale() {
    const affiliateId = parseInt(document.getElementById('saleAffiliate').value);
    const negocio = document.getElementById('saleNegocio').value;
    const rif = document.getElementById('saleRif').value;
    const telefono = document.getElementById('saleTelefono').value || '';
    const direccion = document.getElementById('saleDireccion').value || '';
    const code = document.getElementById('saleCode').value;
    const days = parseInt(document.getElementById('saleDays').value) || 30;
    const status = document.getElementById('saleStatus').value;

    if (!affiliateId) {
        showToast('Selecciona un afiliado', 'error');
        return;
    }

    const sales = DB.getSales() || [];
    sales.push({
        id: Date.now(),
        affiliateId,
        negocio,
        rif,
        telefono,
        direccion,
        code,
        daysOriginal: days,
        days: days,
        status,
        date: new Date().toISOString(),
        renewals: []
    });

    DB.setSales(sales);
    closeModal('modalAddSale');
    loadAdminData();
    showToast('Venta registrada');
}

function toggleSaleStatus(id) {
    const sales = DB.getSales() || [];
    const sale = sales.find(s => s.id === id);
    if (!sale) return;
    sale.status = sale.status === 'pagado' ? 'pendiente' : 'pagado';
    DB.setSales(sales);
    loadAdminData();
    showToast('Estado actualizado');
}

function deleteSale(id) {
    if (!confirm('¿Eliminar esta venta?')) return;
    let sales = DB.getSales() || [];
    sales = sales.filter(s => s.id !== id);
    DB.setSales(sales);
    loadAdminData();
    showToast('Venta eliminada');
}

function showEditLicense(id) {
    const sales = DB.getSales() || [];
    const sale = sales.find(s => s.id === id);
    if (!sale) return;
    document.getElementById('editLicenseId').value = sale.id;
    document.getElementById('editLicenseCode').value = sale.code || '';
    document.getElementById('editLicenseNegocio').value = sale.negocio || '';
    document.getElementById('editLicenseRif').value = sale.rif || '';
    document.getElementById('editLicenseTelefono').value = sale.telefono || '';
    const dirEl = document.getElementById('editLicenseDireccion');
    if (dirEl) dirEl.value = sale.direccion || '';
    document.getElementById('editLicenseDays').value = sale.daysOriginal || '';
    document.getElementById('editLicenseStatus').value = sale.status || 'pendiente';
    document.getElementById('modalEditLicense').classList.remove('hidden');
}

function saveEditLicense() {
    const id = parseInt(document.getElementById('editLicenseId').value);
    const code = document.getElementById('editLicenseCode').value;
    const negocio = document.getElementById('editLicenseNegocio').value;
    const rif = document.getElementById('editLicenseRif').value;
    const telefono = document.getElementById('editLicenseTelefono').value;
    const dirEl = document.getElementById('editLicenseDireccion');
    const direccion = dirEl ? dirEl.value : '';
    const daysOriginal = parseInt(document.getElementById('editLicenseDays').value) || 0;
    const status = document.getElementById('editLicenseStatus').value;
    
    let sales = DB.getSales() || [];
    const index = sales.findIndex(s => s.id === id);
    if (index !== -1) {
        sales[index] = { ...sales[index], code, negocio, rif, telefono, direccion, daysOriginal, days: daysOriginal, status };
        DB.setSales(sales);
        loadAdminData();
        closeModal('modalEditLicense');
        showToast('Datos actualizados');
    }
}

function showRenewLicense(id) {
    const sales = DB.getSales() || [];
    const sale = sales.find(s => s.id === id);
    if (!sale) return;
    document.getElementById('renewLicenseId').value = sale.id;
    document.getElementById('renewCurrentDays').value = sale.days || sale.daysOriginal || 0;
    document.getElementById('renewAddDays').value = '';
    
    const newCodeEl = document.getElementById('renewNewCode');
    if (newCodeEl) newCodeEl.value = '';
    
    document.getElementById('renewAddDays').oninput = function() {
        const current = parseInt(sale.days || sale.daysOriginal || 0);
        const add = parseInt(this.value) || 0;
        document.getElementById('renewNewTotal').value = current + add;
    };
    document.getElementById('renewNewTotal').value = sale.days || sale.daysOriginal || 0;
    document.getElementById('modalRenewLicense').classList.remove('hidden');
}

function saveRenewLicense() {
    const id = parseInt(document.getElementById('renewLicenseId').value);
    const addDays = parseInt(document.getElementById('renewAddDays').value);
    const newCode = document.getElementById('renewNewCode') ? document.getElementById('renewNewCode').value.trim() : '';

    if (!addDays || addDays <= 0) {
        showToast('Ingresa días válidos', 'error');
        return;
    }
    if (!newCode) {
        showToast('Ingresa el nuevo código de licencia', 'error');
        return;
    }
    let sales = DB.getSales() || [];
    const index = sales.findIndex(s => s.id === id);
    if (index !== -1) {
        const current = parseInt(sales[index].days || sales[index].daysOriginal || 0);
        sales[index].days = current + addDays;
        sales[index].daysOriginal = current + addDays; 
        
        if (!sales[index].originalCode) sales[index].originalCode = sales[index].code;
        sales[index].code = newCode;
        
        if (!sales[index].renewals) sales[index].renewals = [];
        sales[index].renewals.push({
            id: Date.now(),
            daysAdded: addDays,
            newCode: newCode,
            date: new Date().toISOString()
        });

        DB.setSales(sales);
        loadAdminData();
        closeModal('modalRenewLicense');
        showToast('Renovación y nuevo código guardados');
    }
}

function showClientHistory(id) {
    const sales = DB.getSales() || [];
    const sale = sales.find(s => s.id === id);
    if (!sale) return;

    const nameEl = document.getElementById('historyClientName');
    if (nameEl) nameEl.textContent = sale.negocio || 'Cliente Desconocido';
    
    // Calculo de dias originales (restando todas las renovaciones)
    const baseDays = sale.daysOriginal - (sale.renewals ? sale.renewals.reduce((a,r) => a + r.daysAdded, 0) : 0);
    
    let html = `
        <tr class="border-b border-slate-700/50">
            <td class="py-3 text-slate-400">${new Date(sale.date).toLocaleDateString()}</td>
            <td class="py-3 text-white">Adquisición Original<br><span class="text-xs text-slate-400 font-mono">${escapeHtml(sale.originalCode || sale.code)}</span></td>
            <td class="py-3 text-blue-400 font-bold">+${baseDays} días</td>
            <td class="py-3 text-green-400 font-bold">$2.00 (Comisión)</td>
        </tr>
    `;

    if (sale.renewals && sale.renewals.length > 0) {
        html += sale.renewals.map(r => `
            <tr class="border-b border-slate-700/50">
                <td class="py-3 text-slate-400">${new Date(r.date).toLocaleDateString()}</td>
                <td class="py-3 text-amber-400">Renovación de Licencia<br><span class="text-xs text-slate-400 font-mono">${r.newCode ? escapeHtml(r.newCode) : 'Sin código guardado'}</span></td>
                <td class="py-3 text-blue-400 font-bold">+${r.daysAdded} días</td>
                <td class="py-3 text-slate-500">- (Modelo A)</td>
            </tr>
        `).join('');
    }

    const tableEl = document.getElementById('clientHistoryTable');
    if (tableEl) tableEl.innerHTML = html;
    document.getElementById('modalClientHistory').classList.remove('hidden');
}

// ============ FIREBASE ============
let firebaseDb = null;
let firebaseApp = null;

function getFirebaseConfig() {
    const saved = {
        apiKey: localStorage.getItem('firebaseApiKey'),
        projectId: localStorage.getItem('firebaseProjectId'),
        databaseURL: localStorage.getItem('firebaseDatabaseUrl')
    };
    if (saved.apiKey && saved.databaseURL) {
        return saved;
    }
    return {
        apiKey: "AIzaSyBbvoi-sByR6F7iC1AbOjs7zxbGRfzfMZ0",
        projectId: "novapos-minegocio",
        databaseURL: "https://novapos-minegocio-default-rtdb.firebaseio.com"
    };
}

function initFirebase() {
    const config = getFirebaseConfig();
    if (!config.apiKey || !config.databaseURL) return false;
    try {
        if (!firebaseApp) {
            firebaseApp = firebase.initializeApp({
                apiKey: config.apiKey,
                authDomain: config.projectId + ".firebaseapp.com",
                databaseURL: config.databaseURL,
                projectId: config.projectId
            }, 'afiliados');
            firebaseDb = firebaseApp.database();
        }
        return true;
    } catch (e) {
        console.error('Firebase error:', e);
        return false;
    }
}

function updateCloudStatus(connected) {
    const statusEl = document.getElementById('cloudStatus');
    if (statusEl) {
        if (connected) {
            statusEl.textContent = '☁️ Conectado';
            statusEl.className = 'text-xs text-green-400';
        } else {
            statusEl.textContent = '☁️ Sin conectar';
            statusEl.className = 'text-xs text-slate-400';
        }
    }
}

function syncToCloud() {
    if (!initFirebase()) {
        showToast('Configura Firebase primero', 'error');
        return;
    }
    const data = {
        affiliates: DB.getAffiliates(),
        sales: DB.getSales(),
        emails: DB.getEmails(),
        payments: DB.getPayments(),
        messages: DB.getMessages(),
        settings: DB.getSettings(),
        lastUpdate: new Date().toISOString()
    };
    firebaseDb.ref('sistema_afiliados').set(data)
        .then(() => {
            updateCloudStatus(true);
            showToast('☁️ Datos subidos al momento');
            localStorage.setItem('needsCloudSync', 'false'); // Ya se subieron
        })
        .catch(e => showToast('Error: ' + e.message, 'error'));
}

// AutoSync nocturno a las 12:00 AM si hay cambios nuevos
setInterval(() => {
    const now = new Date();
    if (now.getHours() === 0 && now.getMinutes() < 5) {
        if (localStorage.getItem('needsCloudSync') === 'true') {
            const data = {
                affiliates: DB.getAffiliates(),
                sales: DB.getSales(),
                emails: DB.getEmails(),
                payments: DB.getPayments(),
                messages: DB.getMessages(),
                settings: DB.getSettings(),
                lastUpdate: new Date().toISOString(),
                autoSync: true
            };
            if (initFirebase()) {
                firebaseDb.ref('sistema_afiliados').set(data)
                    .then(() => {
                        updateCloudStatus(true);
                        localStorage.setItem('needsCloudSync', 'false');
                        console.log('Autosync de medianoche exitoso.');
                    })
                    .catch(e => console.error('Error Autosync:', e));
            }
        }
    }
}, 60000); // Check every minute

function syncFromCloud() {
    if (!initFirebase()) {
        showToast('Firebase no disponible', 'error');
        return;
    }
    if (!confirm('Esto reemplazará datos locales. ¿Continuar?')) return;
    firebaseDb.ref('sistema_afiliados').get()
        .then(snapshot => {
            const data = snapshot.val();
            if (data) {
                if (data.affiliates) DB.setAffiliates(data.affiliates);
                if (data.sales) DB.setSales(data.sales);
                if (data.emails) DB.setEmails(data.emails);
                if (data.payments) DB.setPayments(data.payments);
                if (data.messages) DB.setMessages(data.messages);
                if (data.settings) DB.setSettings(data.settings);
                loadAdminData();
                updateCloudStatus(true);
                showToast('☁️ Datos descargados');
            } else {
                showToast('No hay datos en la nube', 'error');
            }
        })
        .catch(e => showToast('Error: ' + e.message, 'error'));
}

function showFirebaseConfig() {
    const config = getFirebaseConfig();
    document.getElementById('firebaseApiKey').value = config.apiKey || '';
    document.getElementById('firebaseProjectId').value = config.projectId || '';
    document.getElementById('firebaseDatabaseUrl').value = config.databaseURL || '';
    document.getElementById('modalFirebaseConfig').classList.remove('hidden');
}

function saveFirebaseConfig() {
    const apiKey = document.getElementById('firebaseApiKey').value.trim();
    const projectId = document.getElementById('firebaseProjectId').value.trim();
    const databaseUrl = document.getElementById('firebaseDatabaseUrl').value.trim();
    if (!apiKey || !projectId || !databaseUrl) {
        showToast('Completa todos los campos', 'error');
        return;
    }
    localStorage.setItem('firebaseApiKey', apiKey);
    localStorage.setItem('firebaseProjectId', projectId);
    localStorage.setItem('firebaseDatabaseUrl', databaseUrl);
    firebaseApp = null;
    firebaseDb = null;
    closeModal('modalFirebaseConfig');
    showToast('✅ Config guardada');
    updateCloudStatus(true);
}

// ============ BACKUP ============
function backupData() {
    const data = {
        affiliates: DB.getAffiliates(),
        sales: DB.getSales(),
        emails: DB.getEmails(),
        payments: DB.getPayments(),
        backupDate: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'backup_afiliados_' + new Date().toISOString().split('T')[0] + '.json';
    a.click();
    showToast('💾 Backup descargado');
}

function importData(input) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            if (data.affiliates) DB.setAffiliates(data.affiliates);
            if (data.sales) DB.setSales(data.sales);
            if (data.emails) DB.setEmails(data.emails);
            if (data.payments) DB.setPayments(data.payments);
            loadAdminData();
            showToast('📂 Datos importados');
        } catch(err) {
            showToast('Error al importar', 'error');
        }
    };
    reader.readAsText(file);
    input.value = '';
}

// ============ CAMBIAR PASS ============
function showChangeAdminPass() {
    document.getElementById('adminCurrentUser').value = DB.getAdminUser();
    document.getElementById('adminCurrentPass').value = '';
    document.getElementById('adminNewPass').value = '';
    document.getElementById('modalChangeAdminPass').classList.remove('hidden');
}

function changeAdminPass() {
    const currentUser = document.getElementById('adminCurrentUser').value.trim();
    const currentPass = document.getElementById('adminCurrentPass').value;
    const newPass = document.getElementById('adminNewPass').value;
    
    if (currentUser !== DB.getAdminUser()) {
        showToast('Usuario incorrecto', 'error');
        return;
    }
    if (currentPass !== DB.getAdminPass()) {
        showToast('Contraseña incorrecta', 'error');
        return;
    }
    if (newPass.length < 4) {
        showToast('Mínimo 4 caracteres', 'error');
        return;
    }
    
    DB.setAdminPass(newPass);
    closeModal('modalChangeAdminPass');
    showToast('✅ Contraseña cambiada');
}

// ============ INICIALIZACION ============
window.onload = function() {
    try {
        console.log('=== INICIALIZANDO ===');
        
        const user = DB.getCurrentUser();
        console.log('Usuario guardado:', user);
        
        // Ocultar todo primero de forma segura
        const screens = ['loginScreen', 'registerScreen', 'adminDashboard', 'affiliateDashboard'];
        screens.forEach(s => {
            const el = document.getElementById(s);
            if (el) {
                el.classList.add('hidden');
                el.style.display = 'none';
            }
        });
        
        if (user && user.type === 'admin') {
            currentUser = user;
            showAdminDashboard();
            if (initFirebase()) updateCloudStatus(true);
        } else if (user && user.type === 'affiliate') {
            currentUser = user;
            showAffiliateDashboard();
        } else {
            showLogin();
        }
        
    } catch (err) {
        console.error('Error durante la inicialización:', err);
    }
};

// ============ CORREOS AUTORIZADOS ============
function showAddEmail() {
    console.log('showAddEmail llamado');
    const emailInput = document.getElementById('addEmail');
    const modal = document.getElementById('modalAddEmail');
    console.log('addEmail element:', emailInput);
    console.log('modalAddEmail element:', modal);
    if (emailInput) emailInput.value = '';
    if (modal) modal.classList.remove('hidden');
}

function addAuthorizedEmail() {
    console.log('addAuthorizedEmail llamado');
    const emailInput = document.getElementById('addEmail');
    if (!emailInput) {
        console.error('No se encontró addEmail');
        showToast('Error: campo no encontrado', 'error');
        return;
    }
    const email = emailInput.value.toLowerCase().trim();
    if (!email) {
        showToast('Ingresa un correo', 'error');
        return;
    }
    const gmailRegex = /^[a-zA-Z0-9._%+-]+@gmail\.com$/;
    if (!gmailRegex.test(email)) {
        showToast('Solo correos Gmail', 'error');
        return;
    }
    const emails = DB.getEmails() || [];
    if (emails.find(e => e.email === email)) {
        showToast('Este correo ya existe', 'error');
        return;
    }
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    emails.push({ email, code, createdAt: new Date().toISOString() });
    DB.setEmails(emails);
    closeModal('modalAddEmail');
    loadEmailsTable();
    showToast('Correo agregado');
}

function loadEmailsTable() {
    console.log('loadEmailsTable ejecutandose');
    const emails = DB.getEmails() || [];
    console.log('Emails cargados:', emails);
    const tbody = document.getElementById('emailsTable');
    console.log('tbody element:', tbody);
    if (!tbody) {
        console.log('No se encontro emailsTable');
        return;
    }
    if (emails.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="py-4 text-center text-slate-400">No hay correos autorizados</td></tr>';
        return;
    }
    tbody.innerHTML = emails.map((e, i) => `
        <tr class="border-b border-slate-700/50">
            <td class="py-3">${escapeHtml(e.email)}</td>
            <td class="py-3 font-mono text-yellow-400">${e.code}</td>
            <td class="py-3"><span class="bg-green-500/20 text-green-400 px-2 py-1 rounded text-xs">Activo</span></td>
            <td class="py-3">
                <button onclick="deleteEmail(${i})" class="text-red-400 hover:text-red-300 text-sm">Eliminar</button>
            </td>
        </tr>
    `).join('');
    console.log('Tabla actualizada con', emails.length, 'emails');
}

function deleteEmail(index) {
    if (!confirm('¿Eliminar este correo?')) return;
    let emails = DB.getEmails() || [];
    emails.splice(index, 1);
    DB.setEmails(emails);
    loadEmailsTable();
    showToast('Correo eliminado');
}

// ============ PAGOS ============
function showAddPayment() {
    const affiliates = DB.getAffiliates() || [];
    const select = document.getElementById('paymentAffiliate');
    select.innerHTML = '<option value="">Seleccionar</option>' +
        affiliates.map(a => `<option value="${a.id}">${a.name} ${a.lastname || ''}</option>`).join('');
    document.getElementById('modalAddPayment').classList.remove('hidden');
}

function showAffiliatePaymentInfo() {
    const affiliateId = parseInt(document.getElementById('paymentAffiliate').value);
    const infoDiv = document.getElementById('paymentInfo');
    if (!affiliateId) {
        infoDiv.classList.add('hidden');
        return;
    }
    const affiliates = DB.getAffiliates() || [];
    const aff = affiliates.find(a => a.id === affiliateId);
    if (aff) {
        document.getElementById('payAffName').textContent = `${aff.name} ${aff.lastname || ''}`;
        document.getElementById('payAffCedula').textContent = aff.cedula || 'N/A';
        document.getElementById('payAffPhone').textContent = aff.phone || 'N/A';
        document.getElementById('payAffBanco').textContent = aff.banco || 'N/A';
        infoDiv.classList.remove('hidden');
    }
}

function addPayment() {
    const affiliateId = parseInt(document.getElementById('paymentAffiliate').value);
    const amount = parseFloat(document.getElementById('paymentAmount').value);
    const method = document.getElementById('paymentMethod').value;
    const ref = document.getElementById('paymentRef').value || '';
    
    if (!affiliateId || !amount) {
        showToast('Completa los campos', 'error');
        return;
    }
    
    const payments = DB.getPayments() || [];
    payments.push({
        id: Date.now(),
        affiliateId,
        amount,
        method,
        ref,
        date: new Date().toISOString()
    });
    
    DB.setPayments(payments);
    
    // Limpiar campos comunes
    document.getElementById('paymentAmount').value = '';
    document.getElementById('paymentRef').value = '';
    
    loadAdminData(); // Refresca las tablas y el dashboard
    closeModal('modalAddPayment');
    showToast('Pago registrado');
}

function loadPaymentsTable() {
    const payments = DB.getPayments() || [];
    const affiliates = DB.getAffiliates() || [];
    const tbody = document.getElementById('paymentsTable');
    if (!tbody) return;
    tbody.innerHTML = payments.map(p => {
        const aff = affiliates.find(a => a.id === p.affiliateId);
        return `
            <tr class="border-b border-slate-700/50">
                <td class="py-3 text-slate-400">${new Date(p.date).toLocaleDateString()}</td>
                <td class="py-3">${aff ? escapeHtml(aff.name + ' ' + (aff.lastname || '')) : '-'}</td>
                <td class="py-3 text-green-400 font-bold">$${p.amount}</td>
                <td class="py-3">${escapeHtml(p.method || 'N/A')}</td>
                <td class="py-3 font-mono">${escapeHtml(p.ref || '-')}</td>
                <td class="py-3 text-green-400">Completado</td>
            </tr>
        `;
    }).join('');
}

// ============ REPORTES ============
function generateReport() {
    const affiliates = DB.getAffiliates() || [];
    const sales = DB.getSales() || [];
    
    let csv = 'REPORTE DE AFILIADOS\n\n';
    csv += 'Nombre,Usuario,Cedula,Telefono,Banco,Total Ventas,Comision Total\n';
    
    affiliates.forEach(a => {
        const totalSales = sales.filter(s => s.affiliateId === a.id).length;
        const commission = totalSales * 2;
        csv += `"${a.name} ${a.lastname || ''}","${a.user || ''}","${a.cedula || ''}","${a.phone || ''}","${a.banco || ''}",${totalSales},$${commission}\n`;
    });
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'reporte_afiliados_' + new Date().toISOString().split('T')[0] + '.csv';
    a.click();
    showToast('Reporte descargado');
}

function exportData() {
    const sales = DB.getSales() || [];
    let csv = 'REPORTE DE VENTAS (DASHBOARD)\n\n';
    csv += 'Codigo,Negocio,RIF,Telefono,Afiliado ID,Dias,Fecha,Comision,Estado\n';
    sales.forEach(s => {
        csv += `"${s.code || ''}","${s.negocio || ''}","${s.rif || ''}","${s.telefono || ''}","${s.affiliateId || ''}",${s.daysOriginal || 0},"${new Date(s.date).toLocaleDateString()}","$2","${s.status || ''}"\n`;
    });
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'dashboard_ventas_' + new Date().toISOString().split('T')[0] + '.csv';
    a.click();
    showToast('Dashboard Exportado');
}

function filterTable(tabName) {
    const inputId = `search${tabName.charAt(0).toUpperCase() + tabName.slice(1)}`;
    const input = document.getElementById(inputId);
    if (!input) return;
    const filter = input.value.toLowerCase();
    
    const tbody = document.getElementById(`${tabName}Table`);
    if (!tbody) return;
    
    const trs = tbody.getElementsByTagName('tr');
    for (let i = 0; i < trs.length; i++) {
        const text = trs[i].textContent || trs[i].innerText;
        trs[i].style.display = text.toLowerCase().indexOf(filter) > -1 ? "" : "none";
    }
}

// ============ REGISTRO AFILIADO ============
function requestVerification() {
    const email = document.getElementById('regUser').value.toLowerCase().trim();
    
    if (!email) {
        showToast('Ingresa tu correo', 'error');
        return;
    }
    
    const gmailRegex = /^[a-zA-Z0-9._%+-]+@gmail\.com$/;
    if (!gmailRegex.test(email)) {
        showToast('Usa un correo Gmail válido', 'error');
        return;
    }
    
    const emails = DB.getEmails() || [];
    const authorizedEmail = emails.find(e => e.email === email);
    
    if (!authorizedEmail) {
        showToast('Este correo no está autorizado por el administrador', 'error');
        return;
    }
    
    verificationCode = authorizedEmail.code;
    pendingEmail = email;
    
    showToast('Correo encontrado. Ingresa el código provisto por tu administrador', 'success');
    
    document.getElementById('verificationSection').classList.remove('hidden');
    document.getElementById('btnRequestCode').classList.add('hidden');
    document.getElementById('btnVerifyCode').classList.remove('hidden');
    // NO se muestran los demas campos hasta que no se valide el codigo
}

function verifyCode() {
    const enteredCode = document.getElementById('regCode').value.trim();
    
    if (!enteredCode) {
        showToast('Ingresa el código', 'error');
        return;
    }
    
    if (enteredCode === verificationCode) {
        showToast('Código verificado exitosamente', 'success');
        document.getElementById('regCode').disabled = true;
        document.getElementById('btnVerifyCode').classList.add('hidden');
        
        // Ahora sí se permite llenar el resto del formulario
        document.getElementById('regForm').classList.remove('hidden');
        document.getElementById('btnRegister').classList.remove('hidden');
    } else {
        showToast('Código incorrecto', 'error');
    }
}

function registerAffiliate() {
    const nameEl = document.getElementById('regName');
    const phoneEl = document.getElementById('regPhone');
    const passEl = document.getElementById('regPass');
    
    if (!nameEl || !phoneEl || !passEl) {
        showToast('Error: campos no encontrados', 'error');
        return;
    }
    
    const name = nameEl.value.trim();
    const lastname = document.getElementById('regLastname')?.value.trim() || '';
    const phone = phoneEl.value.trim();
    const pass = passEl.value;
    
    if (!name || !phone || !pass) {
        showToast('Completa los campos obligatorios', 'error');
        return;
    }
    
    const affiliates = DB.getAffiliates();
    const user = pendingEmail;
    
    if (!user) {
        showToast('Primero verifica tu correo', 'error');
        return;
    }
    
    if (affiliates.find(a => a.user === user)) {
        showToast('Este correo ya está registrado', 'error');
        return;
    }
    
    affiliates.push({
        id: Date.now(),
        name, lastname, phone, user, pass,
        referralCode: 'AF' + Math.random().toString(36).substring(2, 6).toUpperCase(),
        createdAt: new Date().toISOString()
    });
    
    DB.setAffiliates(affiliates);

    // Remover el correo autorizado para evitar que el mismo código se reutilice
    let emails = DB.getEmails() || [];
    emails = emails.filter(e => e.email !== user);
    DB.setEmails(emails);
    showToast('Registro exitoso!');
    
    setTimeout(() => {
        showLogin();
        document.getElementById('loginUser').value = user;
    }, 1500);
}

function contactAdminForReset() {
    const phoneAdmin = getAdminPhone();
    if (!phoneAdmin) {
        showToast('El administrador no tiene configurado su WhatsApp', 'error');
        return;
    }
    const txt = `¡Hola! He olvidado la contraseña de mi cuenta de Afiliado y solicito un reseteo de claves preventivo.`;
    window.open(`https://wa.me/${phoneAdmin}?text=${encodeURIComponent(txt)}`, '_blank');
}

function loadAffiliateData() {
    try {
        const user = DB.getCurrentUser();
        if (!user || user.type !== 'affiliate') return;
        
        // 1. Datos Básicos
        const nameEl = document.getElementById('affiliateName');
        if (nameEl) nameEl.textContent = user.name + ' ' + (user.lastname || '');
        
        const refEl = document.getElementById('myReferralCode');
        if (refEl) refEl.textContent = user.referralCode || 'N/A';

        // 2. Estadísticas
        const sales = DB.getSales() || [];
        const mySales = sales.filter(s => s.affiliateId === user.id);
        const payments = DB.getPayments() || [];
        const myPayments = payments.filter(p => p.affiliateId === user.id);
        
        const totalEarned = mySales.length * 2;
        const totalPaid = myPayments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
        const pending = totalEarned - totalPaid;

        if (document.getElementById('mySales')) document.getElementById('mySales').textContent = mySales.length;
        if (document.getElementById('myCommission')) document.getElementById('myCommission').textContent = '$' + totalEarned;
        if (document.getElementById('myTotalEarned')) document.getElementById('myTotalEarned').textContent = '$' + totalEarned;
        if (document.getElementById('myTotalPaid')) document.getElementById('myTotalPaid').textContent = '$' + totalPaid;
        if (document.getElementById('myPending')) document.getElementById('myPending').textContent = '$' + pending;

        // 3. Material de Marketing
        const settings = DB.getSettings();
        const mktEl = document.getElementById('marketingText');
        if (mktEl) mktEl.textContent = settings.marketingText || '';

        // 4. Tabla de Ventas
        const tbody = document.getElementById('mySalesTable');
        if (tbody) {
            if (mySales.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" class="py-4 text-center text-slate-400">Aún no tienes ventas registradas</td></tr>';
            } else {
                tbody.innerHTML = mySales.map(s => `
                    <tr class="border-b border-slate-700/50">
                        <td class="py-3 font-mono">${escapeHtml(s.code || '-')}</td>
                        <td class="py-3">
                            <div class="font-bold">${escapeHtml(s.negocio || '-')}</div>
                            <div class="text-[10px] text-slate-400">${escapeHtml(s.rif || '-')}</div>
                        </td>
                        <td class="py-3">${s.daysOriginal || 0}</td>
                        <td class="py-3 text-slate-400 text-xs">${new Date(s.date).toLocaleDateString()}</td>
                        <td class="py-3 text-green-400 font-bold">$2</td>
                    </tr>
                `).join('');
            }
        }

        // 5. Cargar Tickets
        loadAffiliateTickets();

    } catch (err) {
        console.error('Error en loadAffiliateData:', err);
    }
}

function copyMarketingText() {
    const text = document.getElementById('marketingText').textContent;
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
        showToast('Texto copiado al portapapeles');
    });
}

function getAdminPhone() {
    // Por defecto, o puedes guardarlo en settings
    return "584120000000"; // Cambiar por tu número real
}

function requestPaymentWpp() {
    const user = DB.getCurrentUser();
    const phone = getAdminPhone();
    const msg = `Hola, soy ${user.name}. Solicito el pago de mis comisiones acumuladas.`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
}

function supportWpp() {
    const phone = getAdminPhone();
    const msg = `Hola Administrador, necesito soporte técnico con mi panel de afiliado.`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
}

function showAffiliateMessages() {
    const messages = DB.getMessages();
    const user = DB.getCurrentUser();
    
    // Filtrar mensajes dirigidos a este afiliado o a todos
    const myMessages = messages.filter(m => m.targetId === null || m.targetId === user.id);
    
    // Podemos reusar un modal o inyectar en uno existente. 
    // Por ahora, crearemos una lista en un modal genérico o usaremos el sistema de tickets.
    // Vamos a usar un modal de mensajes (notificaciones) que debemos asegurar que existe.
    const modal = document.getElementById('modalAffiliateMessages');
    if (!modal) {
        showToast('Implementando buzón de entrada...', 'info');
        return;
    }

    const container = document.getElementById('affiliateMessagesList');
    if (!container) return;

    if (myMessages.length === 0) {
        container.innerHTML = '<p class="text-xs text-slate-400 p-4 text-center">No tienes notificaciones nuevas.</p>';
    } else {
        const reversed = [...myMessages].sort((a,b) => b.id - a.id);
        container.innerHTML = reversed.map(m => `
            <div class="border-b border-slate-700 p-3 hover:bg-slate-700/30 transition-all">
                <div class="flex justify-between text-[10px] text-slate-500 mb-1">
                    <span>${new Date(m.date).toLocaleDateString()}</span>
                    <span class="font-bold text-blue-400">ANUNCIO</span>
                </div>
                <div class="text-xs font-bold text-white">${escapeHtml(m.title || 'Comunicado')}</div>
                <div class="flex justify-between items-center mt-2">
                    <div class="text-[10px] text-slate-400 truncate max-w-[150px]">${escapeHtml(m.content)}</div>
                    <button onclick="viewAffiliateMessage(${m.id})" class="text-blue-400 text-[10px] font-bold hover:underline">👁️ Leer mensaje</button>
                </div>
            </div>
        `).join('');
    }

    modal.classList.remove('hidden');
    modal.style.display = 'flex';
    
    // Ocultar el badge de no leídos al abrir
    const badge = document.getElementById('unreadBadge');
    if (badge) badge.classList.add('hidden');
}

function viewAffiliateMessage(id) {
    const messages = DB.getMessages();
    const m = messages.find(x => x.id === id);
    if (!m) return;

    // Reutilizamos el modal de detalle de ticket para los afiliados también
    document.getElementById('viewTicketSender').textContent = "Administración Nova POS";
    document.getElementById('viewTicketDate').textContent = new Date(m.date).toLocaleString();
    document.getElementById('viewTicketSubject').textContent = m.title || "Anuncio Importante";
    document.getElementById('viewTicketMessage').textContent = m.content;

    const modal = document.getElementById('modalTicketDetail');
    modal.classList.remove('hidden');
    modal.style.display = 'flex';
}

// ============ SISTEMA DE TICKETS (SOPORTE) ============
function sendTicket() {
    const subject = document.getElementById('ticketSubject').value.trim();
    const message = document.getElementById('ticketMessage').value.trim();
    const user = DB.getCurrentUser();

    if (!subject || !message) {
        showToast('Por favor, completa asunto y mensaje', 'error');
        return;
    }

    const tickets = DB.getMessages() || [];
    tickets.push({
        id: Date.now(),
        senderId: user.id,
        senderName: user.name + ' ' + (user.lastname || ''),
        title: subject,
        content: message,
        date: new Date().toISOString(),
        type: 'ticket'
    });

    DB.setMessages(tickets);
    showToast('Ticket enviado correctamente!');
    
    document.getElementById('ticketSubject').value = '';
    document.getElementById('ticketMessage').value = '';
    loadAffiliateTickets();
}

function loadAffiliateTickets() {
    const tickets = DB.getMessages() || [];
    const user = DB.getCurrentUser();
    const myTickets = tickets.filter(t => t.senderId === user.id);
    const container = document.getElementById('myTicketsHistory');

    if (!container) return;

    if (myTickets.length === 0) {
        container.innerHTML = '<p class="text-xs text-slate-400 p-4 text-center">No has enviado tickets aún.</p>';
    } else {
        const reversed = [...myTickets].sort((a,b) => b.id - a.id);
        container.innerHTML = reversed.map(t => `
            <div class="border-b border-slate-700/50 p-3 hover:bg-slate-700/30 transition-all">
                <div class="flex justify-between text-[10px] text-slate-500 mb-1">
                    <span>${new Date(t.date).toLocaleDateString()}</span>
                    <span class="font-bold text-amber-500 uppercase">SOPORTE</span>
                </div>
                <div class="text-xs font-bold text-white truncate">${escapeHtml(t.title)}</div>
            </div>
        `).join('');
    }
}

function loadAdminTickets() {
    const tickets = DB.getMessages() || [];
    const onlyTickets = tickets.filter(t => t.type === 'ticket');
    const tbody = document.getElementById('ticketsTableAdmin');

    if (!tbody) return;

    if (onlyTickets.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="py-10 text-center text-slate-400">No hay tickets de soporte recibidos</td></tr>';
    } else {
        const sorted = [...onlyTickets].sort((a,b) => b.id - a.id);
        tbody.innerHTML = sorted.map(t => `
            <tr class="border-b border-slate-700/50 hover:bg-slate-800/30 transition-all">
                <td class="py-3 text-xs text-slate-400">${new Date(t.date).toLocaleDateString()}</td>
                <td class="py-3">
                    <div class="text-xs font-bold text-white">${escapeHtml(t.senderName || 'Afiliado')}</div>
                </td>
                <td class="py-3 text-xs text-blue-400 font-bold">${escapeHtml(t.title)}</td>
                <td class="py-3 text-[11px] text-slate-400 truncate max-w-[200px]">${escapeHtml(t.content)}</td>
                <td class="py-3 text-right">
                    <button onclick="viewTicket(${t.id})" class="bg-blue-600/20 text-blue-400 px-3 py-1 rounded-lg text-[10px] font-bold hover:bg-blue-600/40 transition-all">👁️ Leer</button>
                </td>
            </tr>
        `).join('');
    }
}

function viewTicket(id) {
    const tickets = DB.getMessages() || [];
    const t = tickets.find(x => x.id === id);
    if (!t) return;

    document.getElementById('viewTicketSender').textContent = t.senderName || "Afiliado";
    document.getElementById('viewTicketDate').textContent = new Date(t.date).toLocaleString();
    document.getElementById('viewTicketSubject').textContent = t.title;
    document.getElementById('viewTicketMessage').textContent = t.content;

    const modal = document.getElementById('modalTicketDetail');
    if (modal) {
        modal.classList.remove('hidden');
        modal.style.display = 'flex';
    }
}

// ============ CENTRO DE AYUDA ============
function showAffiliateFAQ() {
    const modal = document.getElementById('modalAffiliateFAQ');
    if (modal) {
        modal.classList.remove('hidden');
        modal.style.display = 'flex';
    }
}

function showAffiliateTerms() {
    const modal = document.getElementById('modalAffiliateTerms');
    if (modal) {
        modal.classList.remove('hidden');
        modal.style.display = 'flex';
    }
}

// Fin del archivo app.js
