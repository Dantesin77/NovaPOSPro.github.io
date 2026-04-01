console.log('App.js cargado correctamente');

// ============ BASE DE DATOS LOCAL ============
const DB = {
    _defaultAdminPass: '312915',
    _key: localStorage.getItem('novaKey') || (() => {
        const k = 'novaPOS_' + Math.random().toString(36).slice(2, 18);
        localStorage.setItem('novaKey', k);
        return k;
    })(),
    
    _encrypt(data) {
        try {
            const str = JSON.stringify(data);
            return btoa(encodeURIComponent(str).split('').map((c, i) => 
                String.fromCharCode(c.charCodeAt(0) ^ this._key.charCodeAt(i % this._key.length))
            ));
        } catch(e) { return btoa(JSON.stringify(data)); }
    },
    
    _decrypt(data) {
        try {
            const str = atob(data).split('').map((c, i) => 
                String.fromCharCode(c.charCodeAt(0) ^ this._key.charCodeAt(i % this._key.length))
            ).join('');
            return JSON.parse(decodeURIComponent(str));
        } catch(e) { return JSON.parse(atob(data)); }
    },
    
    getAffiliates() { 
        const data = localStorage.getItem('afiliados_enc');
        return data ? this._decrypt(data) : [];
    },
    setAffiliates(data) { 
        localStorage.setItem('afiliados_enc', this._encrypt(data));
    },
    getSales() { 
        const data = localStorage.getItem('ventas_enc');
        return data ? this._decrypt(data) : [];
    },
    setSales(data) { 
        localStorage.setItem('ventas_enc', this._encrypt(data));
    },
    getEmails() { 
        const data = localStorage.getItem('correosAutorizados_enc');
        return data ? this._decrypt(data) : [];
    },
    setEmails(data) { 
        localStorage.setItem('correosAutorizados_enc', this._encrypt(data));
    },
    getPayments() { 
        const data = localStorage.getItem('pagos_enc');
        return data ? this._decrypt(data) : [];
    },
    setPayments(data) { 
        localStorage.setItem('pagos_enc', this._encrypt(data));
    },
    getCurrentUser() { 
        const data = localStorage.getItem('currentUser_enc');
        return data ? this._decrypt(data) : null;
    },
    setCurrentUser(data) { 
        localStorage.setItem('currentUser_enc', this._encrypt(data));
    },
    logout() { 
        localStorage.removeItem('currentUser_enc');
    },
    getAdminPass: () => localStorage.getItem('adminPass_enc') || '312915',
    setAdminPass(pass) { localStorage.setItem('adminPass_enc', btoa(pass)); },
    getAdminUser: () => { const u = localStorage.getItem('adminUser_enc'); return u ? atob(u) : 'admin'; },
    setAdminUser(user) { localStorage.setItem('adminUser_enc', btoa(user)); }
};

let currentUser = null;
let pendingEmail = null;
let verificationCode = null;

// ============ FUNCIONES DE UI ============
function showToast(msg, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.className = 'fixed bottom-4 right-4 px-6 py-3 rounded-xl font-semibold transition-opacity ' + 
        (type === 'error' ? 'bg-red-600' : 'bg-green-600');
    toast.style.opacity = '1';
    toast.style.display = 'block';
    setTimeout(() => { toast.style.opacity = '0'; }, 3000);
}

function showLogin() {
    document.getElementById('loginScreen').classList.remove('hidden');
    document.getElementById('loginScreen').style.display = 'flex';
    document.getElementById('registerScreen').classList.add('hidden');
    document.getElementById('registerScreen').style.display = 'none';
    document.getElementById('adminDashboard').classList.add('hidden');
    document.getElementById('adminDashboard').style.display = 'none';
    document.getElementById('affiliateDashboard').classList.add('hidden');
    document.getElementById('affiliateDashboard').style.display = 'none';
}

function showRegister() {
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('registerScreen').classList.remove('hidden');
    document.getElementById('registerScreen').style.display = 'flex';
}

function showResetPass() {
    document.getElementById('modalResetPass').classList.remove('hidden');
}

function closeModal(id) {
    document.getElementById(id).classList.add('hidden');
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
}

function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// ============ LOGIN ============
function login() {
    console.log('Login ejecutandose...');
    const user = document.getElementById('loginUser').value.trim();
    const pass = document.getElementById('loginPass').value;

    if (!user || !pass) {
        showToast('Ingresa usuario y contraseña', 'error');
        return;
    }

    if (user === DB.getAdminUser() && pass === DB.getAdminPass()) {
        currentUser = { type: 'admin', name: 'Administrador' };
        DB.setCurrentUser(currentUser);
        showAdminDashboard();
        showToast('Bienvenido Admin!');
    } else {
        const affiliates = DB.getAffiliates();
        const affiliate = affiliates.find(a => a.user && a.user === user && a.pass === pass);
        if (affiliate) {
            currentUser = { type: 'affiliate', ...affiliate };
            DB.setCurrentUser(currentUser);
            showAffiliateDashboard();
            showToast('Bienvenido ' + affiliate.name + '!');
        } else {
            showToast('Credenciales incorrectas', 'error');
        }
    }
}

function logout() {
    DB.logout();
    currentUser = null;
    showLogin();
    document.getElementById('loginUser').value = '';
    document.getElementById('loginPass').value = '';
}

window.logout = logout;

// ============ DASHBOARD ADMIN ============
function showAdminDashboard() {
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('registerScreen').classList.add('hidden');
    document.getElementById('registerScreen').style.display = 'none';
    document.getElementById('adminDashboard').classList.remove('hidden');
    document.getElementById('adminDashboard').style.display = 'block';
    document.getElementById('affiliateDashboard').classList.add('hidden');
    document.getElementById('affiliateDashboard').style.display = 'none';
    showTab('dashboard');
    loadAdminData();
}

function showAffiliateDashboard() {
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('registerScreen').classList.add('hidden');
    document.getElementById('registerScreen').style.display = 'none';
    document.getElementById('adminDashboard').classList.add('hidden');
    document.getElementById('adminDashboard').style.display = 'none';
    document.getElementById('affiliateDashboard').classList.remove('hidden');
    document.getElementById('affiliateDashboard').style.display = 'block';
    loadAffiliateData();
}

function loadAdminData() {
    const affiliates = DB.getAffiliates();
    const sales = DB.getSales();

    document.getElementById('statAffiliates').textContent = affiliates.length;
    document.getElementById('statSales').textContent = sales.length;

    const paidCommission = sales.filter(s => s.status === 'pagado').length * 2;
    const pendingCommission = sales.filter(s => s.status === 'pendiente').length * 2;

    document.getElementById('statPaid').textContent = '$' + paidCommission;
    document.getElementById('statPending').textContent = '$' + pendingCommission;

    // Cargar tabla de afiliados
    const tbody = document.getElementById('affiliatesTable');
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
                    <button onclick="deleteAffiliate(${a.id})" class="text-red-400 hover:text-red-300">Eliminar</button>
                </td>
            </tr>
        `;
    }).join('');

    // Cargar tabla de ventas
    const salesBody = document.getElementById('salesTable');
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
                    <button onclick="deleteSale(${s.id})" class="text-red-400 hover:text-red-300">Eliminar</button>
                </td>
            </tr>
        `;
    }).join('');

    // Dashboard stats
    document.getElementById('dashTotalSales').textContent = sales.length;
    document.getElementById('dashTotalCommission').textContent = '$' + (sales.length * 2);
    document.getElementById('dashPendingCommission').textContent = '$' + pendingCommission;
}

function loadAffiliateData() {
    const sales = DB.getSales().filter(s => s.affiliateId === currentUser.id);
    const payments = DB.getPayments().filter(p => p.affiliateId === currentUser.id);

    document.getElementById('affiliateName').textContent = currentUser.name;
    document.getElementById('mySales').textContent = sales.length;
    document.getElementById('myCommission').textContent = '$' + (sales.length * 2);
    document.getElementById('myReferralCode').textContent = currentUser.referralCode || 'N/A';

    const totalEarned = sales.length * 2;
    const totalPaid = payments.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);

    document.getElementById('myTotalEarned').textContent = '$' + totalEarned;
    document.getElementById('myTotalPaid').textContent = '$' + totalPaid;
    document.getElementById('myPending').textContent = '$' + (totalEarned - totalPaid);

    const tbody = document.getElementById('mySalesTable');
    tbody.innerHTML = sales.map(s => `
        <tr class="border-b border-slate-700/50">
            <td class="py-3 font-mono">${escapeHtml(s.code || '-')}</td>
            <td class="py-3">${escapeHtml(s.rif || '-')}</td>
            <td class="py-3">${s.days || s.daysOriginal || 0} días</td>
            <td class="py-3 text-slate-400">${new Date(s.date).toLocaleDateString()}</td>
            <td class="py-3 text-amber-400">$2</td>
        </tr>
    `).join('');
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

    const affiliates = DB.getAffiliates();
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
    let affiliates = DB.getAffiliates();
    affiliates = affiliates.filter(a => a.id !== id);
    DB.setAffiliates(affiliates);
    loadAdminData();
    showToast('Afiliado eliminado');
}

// ============ CRUD VENTAS ============
function showAddSale() {
    const affiliates = DB.getAffiliates();
    const select = document.getElementById('saleAffiliate');
    select.innerHTML = '<option value="">Seleccionar Afiliado</option>' +
        affiliates.map(a => `<option value="${a.id}">${a.name} ${a.lastname || ''}</option>`).join('');
    document.getElementById('modalAddSale').classList.remove('hidden');
}

function addSale() {
    const affiliateId = parseInt(document.getElementById('saleAffiliate').value);
    const negocio = document.getElementById('saleNegocio').value;
    const rif = document.getElementById('saleRif').value;
    const code = document.getElementById('saleCode').value;
    const days = parseInt(document.getElementById('saleDays').value) || 30;
    const status = document.getElementById('saleStatus').value;

    if (!affiliateId) {
        showToast('Selecciona un afiliado', 'error');
        return;
    }

    const sales = DB.getSales();
    sales.push({
        id: Date.now(),
        affiliateId,
        negocio,
        rif,
        code,
        daysOriginal: days,
        days: days,
        status,
        date: new Date().toISOString()
    });

    DB.setSales(sales);
    closeModal('modalAddSale');
    loadAdminData();
    showToast('Venta registrada');
}

function toggleSaleStatus(id) {
    const sales = DB.getSales();
    const sale = sales.find(s => s.id === id);
    if (!sale) return;
    sale.status = sale.status === 'pagado' ? 'pendiente' : 'pagado';
    DB.setSales(sales);
    loadAdminData();
    showToast('Estado actualizado');
}

function deleteSale(id) {
    if (!confirm('¿Eliminar esta venta?')) return;
    let sales = DB.getSales();
    sales = sales.filter(s => s.id !== id);
    DB.setSales(sales);
    loadAdminData();
    showToast('Venta eliminada');
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
        lastUpdate: new Date().toISOString()
    };
    firebaseDb.ref('sistema_afiliados').set(data)
        .then(() => {
            updateCloudStatus(true);
            showToast('☁️ Datos subidos');
        })
        .catch(e => showToast('Error: ' + e.message, 'error'));
}

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
    console.log('Inicializando...');
    showLogin();
    
    const user = DB.getCurrentUser();
    if (user && user.type === 'admin') {
        showAdminDashboard();
        if (initFirebase()) {
            updateCloudStatus(true);
        }
    } else if (user && user.type === 'affiliate') {
        showAffiliateDashboard();
    }
    
    console.log('DB inicializada');
};
