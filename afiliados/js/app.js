console.log('App.js cargado correctamente');
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
        localStorage.removeItem('afiliados');
    },
    getSales() { 
        const data = localStorage.getItem('ventas_enc');
        return data ? this._decrypt(data) : [];
    },
    setSales(data) { 
        localStorage.setItem('ventas_enc', this._encrypt(data));
        localStorage.removeItem('ventas');
    },
    getEmails() { 
        const data = localStorage.getItem('correosAutorizados_enc');
        return data ? this._decrypt(data) : [];
    },
    setEmails(data) { 
        localStorage.setItem('correosAutorizados_enc', this._encrypt(data));
        localStorage.removeItem('correosAutorizados');
    },
    getPayments() { 
        const data = localStorage.getItem('pagos_enc');
        return data ? this._decrypt(data) : [];
    },
    setPayments(data) { 
        localStorage.setItem('pagos_enc', this._encrypt(data));
        localStorage.removeItem('pagos');
    },
    getCurrentUser() { 
        const data = localStorage.getItem('currentUser_enc');
        return data ? this._decrypt(data) : null;
    },
    setCurrentUser(data) { 
        if (data) {
            const sessionToken = btoa(Date.now() + '_' + Math.random().toString(36));
            data.sessionToken = sessionToken;
            localStorage.setItem('sessionToken', sessionToken);
        } else {
            localStorage.removeItem('sessionToken');
        }
        localStorage.setItem('currentUser_enc', this._encrypt(data));
        localStorage.removeItem('currentUser');
    },
    logout() { 
        localStorage.removeItem('currentUser_enc');
        localStorage.removeItem('sessionToken');
    },
    getAdminPass: () => localStorage.getItem('adminPass_enc') || '312915',
    setAdminPass(pass) { localStorage.setItem('adminPass_enc', btoa(pass)); localStorage.removeItem('adminPass'); },
    getAdminUser: () => { const u = localStorage.getItem('adminUser_enc'); return u ? atob(u) : 'admin'; },
    setAdminUser(user) { localStorage.setItem('adminUser_enc', btoa(user)); localStorage.removeItem('adminUser'); }
};

let currentUser = null;
let pendingEmail = null;
let pendingResetEmail = null;
let verificationCode = null;
let firebaseDb = null;
let firebaseAuth = null;

function initFirebaseClient() {
    if (firebaseDb) return true;
    try {
        if (typeof firebase !== 'undefined') {
            const config = getFirebaseConfig();
            if (!config.apiKey) return false;
            
            const app = firebase.initializeApp(config);
            firebaseDb = firebase.database();
            firebaseAuth = firebase.auth;
            
            setupFirebaseAdmin();
            return true;
        }
    } catch(e) {
        console.error('Firebase init error:', e);
    }
    return false;
}

async function setupFirebaseAdmin() {
    try {
        const snapshot = await firebaseDb.ref('sistema_afiliados/admin').get();
        if (!snapshot.exists()) {
            await firebaseDb.ref('sistema_afiliados/admin').set({
                user: 'admin',
                pass: DB._defaultAdminPass
            });
            console.log('✅ Admin creado en Firebase');
        }
    } catch(e) {
        console.error('Error setting up admin:', e);
    }
}

async function verifyLoginFirebase(user, pass) {
    if (!initFirebaseClient()) return null;
    
    try {
        const snapshot = await firebaseDb.ref('sistema_afiliados/admin').get();
        const adminData = snapshot.val();
        
        if (adminData && user === adminData.user && pass === adminData.pass) {
            return { type: 'admin', name: 'Administrador' };
        }
        
        const affSnapshot = await firebaseDb.ref('sistema_afiliados/afiliados').get();
        const affiliates = affSnapshot.val() || {};
        
        for (const key in affiliates) {
            const a = affiliates[key];
            if (a.user === user && a.pass === pass) {
                return { type: 'affiliate', id: key, ...a };
            }
        }
    } catch(e) {
        console.error('Login error:', e);
    }
    return null;
}

function generateReferralCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = 'AF';
    for (let i = 0; i < 4; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

function hashPass(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return btoa(hash.toString(16) + str);
}

function verifyPass(input, stored) {
    return hashPass(input) === stored;
}

function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

async function login() {
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
        syncToCloud();
    } else {
        const affiliates = DB.getAffiliates();
        const affiliate = affiliates.find(a => a.user && a.user === user && (a.pass === pass || a.pass === hashPass(pass)));
        if (affiliate) {
            currentUser = { type: 'affiliate', ...affiliate };
            DB.setCurrentUser(currentUser);
            showAffiliateDashboard();
        } else {
            if (initFirebaseClient()) {
                const fbUser = await verifyLoginFirebase(user, pass);
                if (fbUser) {
                    currentUser = fbUser;
                    DB.setCurrentUser(currentUser);
                    loadFromCloud();
                    if (fbUser.type === 'admin') {
                        showAdminDashboard();
                    } else {
                        showAffiliateDashboard();
                    }
                    return;
                }
            }
            showToast('Credenciales incorrectas', 'error');
        }
    }
}

function requestVerification() {
    const email = document.getElementById('regUser').value.toLowerCase().trim();
    
    if (!email) {
        showToast('Ingresa tu correo Gmail', 'error');
        return;
    }

    const gmailRegex = /^[a-zA-Z0-9._%+-]+@gmail\.com$/;
    if (!gmailRegex.test(email)) {
        showToast('Usa un correo Gmail válido', 'error');
        return;
    }

    // Permitir registro sin autorización previa - generar código automáticamente
    verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    pendingEmail = email;
    
    // Guardar el código en localStorage para verificar después
    localStorage.setItem('pendingCode_' + email, verificationCode);
    
    showToast('Código enviado a tu correo', 'success');
    
    document.getElementById('verificationSection').classList.remove('hidden');
    document.getElementById('btnRequestCode').classList.add('hidden');
    document.getElementById('btnVerifyCode').classList.remove('hidden');
    document.getElementById('regUser').disabled = true;
}
     
function verifyCode() {
    const enteredCode = document.getElementById('regCode').value;
    
    if (enteredCode !== verificationCode) {
        showToast('Código incorrecto. Solicita el código al administrador.', 'error');
        return;
    }

    document.getElementById('verificationSection').classList.add('hidden');
    document.getElementById('btnVerifyCode').classList.add('hidden');
    document.getElementById('regForm').classList.remove('hidden');
    document.getElementById('btnRegister').classList.remove('hidden');
    document.getElementById('regUser').disabled = true;
    showToast('Código verificado. Completa tu registro.', 'success');
}

function registerAffiliate() {
    const name = document.getElementById('regName').value;
    const lastname = document.getElementById('regLastname').value;
    const phone = document.getElementById('regPhone').value;
    const user = pendingEmail || document.getElementById('regUser').value.toLowerCase().trim();
    const pass = document.getElementById('regPass').value;

    if (!name || !lastname || !phone || !user || !pass) {
        showToast('Todos los campos son obligatorios', 'error');
        return;
    }

    const affiliates = DB.getAffiliates();
    if (affiliates.find(a => a.user === user)) {
        showToast('Este correo ya está registrado', 'error');
        return;
    }

    const referralCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    
    const newAffiliate = {
        id: Date.now(),
        name,
        lastname,
        phone,
        user,
        pass: hashPass(pass),
        referralCode,
        totalSales: 0,
        totalCommission: 0,
        pendingPayment: 0,
        createdAt: new Date().toISOString()
    };

    affiliates.push(newAffiliate);
    DB.setAffiliates(affiliates);

    // Auto-login after register
    currentUser = { ...newAffiliate, type: 'affiliate' };
    localStorage.setItem('currentUser', JSON.stringify(currentUser));

    showToast('¡Registro exitoso! Ya puedes iniciar sesión', 'success');
    setTimeout(() => {
        showAffiliateDashboard();
    }, 1500);
}

function showRegister() {
    document.getElementById('regUser').value = '';
    document.getElementById('regUser').disabled = false;
    document.getElementById('regCode').value = '';
    document.getElementById('regName').value = '';
    document.getElementById('regLastname').value = '';
    document.getElementById('regPhone').value = '';
    document.getElementById('regPass').value = '';
    document.getElementById('verificationSection').classList.add('hidden');
    document.getElementById('regForm').classList.add('hidden');
    document.getElementById('btnRequestCode').classList.remove('hidden');
    document.getElementById('btnVerifyCode').classList.add('hidden');
    document.getElementById('btnRegister').classList.add('hidden');
    pendingEmail = null;
    verificationCode = null;
    
    document.getElementById('loginScreen').classList.remove('visible');
    document.getElementById('registerScreen').classList.add('visible');
}

function showAdminDashboard() {
    document.getElementById('loginScreen').classList.remove('visible');
    document.getElementById('registerScreen').classList.remove('visible');
    document.getElementById('adminDashboard').classList.add('visible');
    document.getElementById('affiliateDashboard').classList.remove('visible');
    showTab('dashboard');
    loadAdminData();
}

function showAffiliateDashboard() {
    document.getElementById('loginScreen').classList.remove('visible');
    document.getElementById('registerScreen').classList.remove('visible');
    document.getElementById('adminDashboard').classList.remove('visible');
    document.getElementById('affiliateDashboard').classList.add('visible');
    loadAffiliateData();
}

function loadAdminData() {
    const affiliates = DB.getAffiliates();
    const sales = DB.getSales();
    const emails = DB.getEmails();

    document.getElementById('statAffiliates').textContent = affiliates.length;
    document.getElementById('statSales').textContent = sales.length;

    const paidCommission = sales.filter(s => s.status === 'pagado').length * 2;
    const pendingCommission = sales.filter(s => s.status === 'pendiente').length * 2;

    document.getElementById('statPaid').textContent = '$' + paidCommission;
    document.getElementById('statPending').textContent = '$' + pendingCommission;

    const emailsBody = document.getElementById('emailsTable');
    emailsBody.innerHTML = emails.map(e => `
        <tr class="border-b border-slate-700/50">
            <td class="py-3 font-mono">${escapeHtml(e.email)}</td>
            <td class="py-3">
                <span class="font-mono text-amber-400 font-bold">${escapeHtml(e.code)}</span>
                <button onclick="copyCode('${escapeHtml(e.code)}')" class="ml-2 text-blue-400 hover:text-white text-xs">📋</button>
            </td>
            <td class="py-3">
                <span class="${e.used ? 'text-green-400' : 'text-yellow-400'}">
                    ${e.used ? '✓ Usado' : '○ Pendiente'}
                </span>
            </td>
            <td class="py-3">
                <button onclick="deleteEmail('${escapeHtml(e.email)}')" class="text-red-400 hover:text-red-300">Eliminar</button>
            </td>
        </tr>
    `).join('');

    const tbody = document.getElementById('affiliatesTable');
    tbody.innerHTML = affiliates.map(a => {
        const affiliateSales = sales.filter(s => s.affiliateId === a.id);
        const commission = affiliateSales.length * 2;
        return `
            <tr class="border-b border-slate-700/50">
                <td class="py-3">${escapeHtml(a.name)} ${escapeHtml(a.lastname)}</td>
                <td class="py-3 font-mono">${escapeHtml(a.cedula || '-')}</td>
                <td class="py-3">${escapeHtml(a.phone || '-')}</td>
                <td class="py-3">${escapeHtml(a.banco || '-')}</td>
                <td class="py-3 text-blue-400 font-bold">${a.referralsCount || 0}</td>
                <td class="py-3 text-green-400 font-bold">${affiliateSales.length}</td>
                <td class="py-3 text-amber-400 font-bold">$${commission}</td>
                <td class="py-3">
                    <button onclick="editAffiliate(${a.id})" class="text-blue-400 hover:text-blue-300 mr-2">Editar</button>
                    <button onclick="deleteAffiliate(${a.id})" class="text-red-400 hover:text-red-300">Eliminar</button>
                </td>
            </tr>
        `;
    }).join('');

    const salesBody = document.getElementById('salesTable');
    salesBody.innerHTML = sales.map(s => {
        const affiliate = affiliates.find(a => a.id === s.affiliateId);
        return `
            <tr class="border-b border-slate-700/50">
                <td class="py-4 px-3 font-mono text-sm align-top whitespace-nowrap">${escapeHtml(s.code)}</td>
                <td class="py-4 px-3 align-top">
                    <div class="font-bold">${escapeHtml(s.negocio || 'Sin nombre')}</div>
                    <div class="text-xs text-slate-400">${escapeHtml(s.rif)}</div>
                </td>
                <td class="py-4 px-3 align-top whitespace-nowrap">${affiliate ? escapeHtml(affiliate.name + ' ' + affiliate.lastname) : '-'}</td>
                <td class="py-4 px-3 align-top whitespace-nowrap">${s.daysOriginal} días</td>
                <td class="py-4 px-3 align-top whitespace-nowrap text-slate-400">${new Date(s.date).toLocaleDateString()}</td>
                <td class="py-4 px-3 align-top whitespace-nowrap text-amber-400 font-bold">$2</td>
                <td class="py-4 px-3 align-top whitespace-nowrap">
                    <button onclick="toggleSaleStatus(${s.id})" class="${s.status === 'pagado' ? 'text-green-400' : 'text-yellow-400'}">
                        ${s.status === 'pagado' ? '✓ Pagado' : '○ Pendiente'}
                    </button>
                </td>
                <td class="py-4 px-3 align-top whitespace-nowrap">
                    <button onclick="editLicense(${s.id})" class="text-blue-400 hover:text-blue-300 mr-2">Editar</button>
                    <button onclick="deleteLicense(${s.id})" class="text-red-400 hover:text-red-300">Eliminar</button>
                </td>
            </tr>
        `;
    }).join('');

    const payments = DB.getPayments();
    const paymentsBody = document.getElementById('paymentsTable');
    paymentsBody.innerHTML = payments.map(p => {
        const aff = affiliates.find(a => a.id === p.affiliateId);
        return `
            <tr class="border-b border-slate-700/50">
                <td class="py-3">${new Date(p.date).toLocaleDateString()}</td>
                <td class="py-3">${aff ? escapeHtml(aff.name + ' ' + aff.lastname) : 'Desconocido'}</td>
                <td class="py-3 text-green-400 font-bold">$${p.amount}</td>
                <td class="py-3">${escapeHtml(p.method)}</td>
                <td class="py-3 font-mono text-sm">${escapeHtml(p.ref || '-')}</td>
                <td class="py-3 text-green-400">✓ Pagado</td>
            </tr>
        `;
    }).join('');

    const totalSales = sales.length;
    const totalCommission = totalSales * 2;
    const paidPayments = payments.reduce((sum, p) => sum + parseFloat(p.amount), 0);
    
    document.getElementById('dashTotalSales').textContent = totalSales;
    document.getElementById('dashTotalCommission').textContent = '$' + totalCommission;
    document.getElementById('dashPaidCommission').textContent = '$' + paidPayments;
    document.getElementById('dashPendingCommission').textContent = '$' + (totalCommission - paidPayments);

    const licensesBody = document.getElementById('licensesTable');
    licensesBody.innerHTML = sales.map(s => {
        const activationDate = new Date(s.activationDate || s.date);
        const daysUsed = Math.floor((new Date() - activationDate) / (1000 * 60 * 60 * 24));
        const daysRemaining = s.daysOriginal - daysUsed;
        const isExpired = daysRemaining <= 0;
        const expiryDate = new Date(activationDate);
        expiryDate.setDate(expiryDate.getDate() + s.daysOriginal);
        
        return `
            <tr class="border-b border-slate-700/50">
                <td class="py-3 font-mono text-sm">${escapeHtml(s.code)}</td>
                <td class="py-3">${escapeHtml(s.negocio || '-')}</td>
                <td class="py-3 font-mono">${escapeHtml(s.rif)}</td>
                <td class="py-3">${escapeHtml(s.telefono || '-')}</td>
                <td class="py-3">${s.daysOriginal} días</td>
                <td class="py-3 font-bold ${isExpired ? 'text-red-400' : daysRemaining <= 7 ? 'text-yellow-400' : 'text-green-400'}">
                    ${isExpired ? '0' : daysRemaining} días
                </td>
                <td class="py-3">
                    <span class="${isExpired ? 'bg-red-600' : 'bg-green-600'} px-2 py-1 rounded text-xs font-bold">
                        ${isExpired ? '⚠️ VENCIDA' : '✓ ACTIVA'}
                    </span>
                </td>
                <td class="py-3 text-sm ${isExpired ? 'text-red-400' : 'text-slate-400'}">
                    ${expiryDate.toLocaleDateString()}
                </td>
                <td class="py-3">
                    <button onclick="showRenewLicense(${s.id})" class="text-green-400 hover:text-green-300 mr-2">🔄 Renovar</button>
                    <button onclick="editLicense(${s.id})" class="text-blue-400 hover:text-blue-300 mr-2">Editar</button>
                    <button onclick="deleteLicense(${s.id})" class="text-red-400 hover:text-red-300">Eliminar</button>
                </td>
            </tr>
        `;
    }).join('');
}

function loadAffiliateData() {
    const sales = DB.getSales().filter(s => s.affiliateId === currentUser.id);
    const payments = DB.getPayments().filter(p => p.affiliateId === currentUser.id);

    document.getElementById('affiliateName').textContent = currentUser.name;
    document.getElementById('mySales').textContent = sales.length;
    document.getElementById('myCommission').textContent = '$' + (sales.length * 2);
    document.getElementById('myReferralCode').textContent = currentUser.referralCode || 'N/A';

    const totalEarned = sales.length * 2;
    const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
    const pending = totalEarned - totalPaid;

    document.getElementById('myTotalEarned').textContent = '$' + totalEarned;
    document.getElementById('myTotalPaid').textContent = '$' + totalPaid;
    document.getElementById('myPending').textContent = '$' + pending;

    const tbody = document.getElementById('mySalesTable');
    if (sales.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-slate-400 py-4">No tienes ventas registradas</td></tr>';
    } else {
        tbody.innerHTML = sales.map(s => `
            <tr class="border-b border-slate-700/50">
                <td class="py-3 font-mono text-sm">${escapeHtml(s.code || '-')}</td>
                <td class="py-3">${escapeHtml(s.rif || '-')}</td>
                <td class="py-3">${s.days || s.daysOriginal || 0} días</td>
                <td class="py-3 text-slate-400">${new Date(s.date).toLocaleDateString()}</td>
                <td class="py-3 text-amber-400 font-bold">$2</td>
            </tr>
        `).join('');
    }
}

function showAddEmail() {
    document.getElementById('modalAddEmail').classList.remove('hidden');
}

function addAuthorizedEmail() {
    const email = document.getElementById('addEmail').value.toLowerCase().trim();
    
    if (!email) {
        showToast('Ingresa un correo', 'error');
        return;
    }

    const gmailRegex = /^[a-zA-Z0-9._%+-]+@gmail\.com$/;
    if (!gmailRegex.test(email)) {
        showToast('Usa un correo Gmail válido', 'error');
        return;
    }

    const emails = DB.getEmails();
    if (emails.find(e => e.email === email)) {
        showToast('Este correo ya está autorizado', 'error');
        return;
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    
    emails.push({
        email: email,
        code: code,
        used: false,
        createdAt: new Date().toISOString()
    });

    DB.setEmails(emails);
    closeModal('modalAddEmail');
    document.getElementById('addEmail').value = '';
    loadAdminData();
    showToast('Correo autorizado. Código: ' + code);
}

function copyCode(code) {
    navigator.clipboard.writeText(code);
    showToast('Código copiado: ' + code);
}

function deleteEmail(email) {
    if (!confirm('¿Eliminar este correo autorizado?')) return;
    let emails = DB.getEmails();
    emails = emails.filter(e => e.email !== email);
    DB.setEmails(emails);
    loadAdminData();
    showToast('Correo eliminado');
}

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

    if (!name || !lastname || !phone || !user || !pass) {
        showToast('Todos los campos son obligatorios', 'error');
        return;
    }

    const affiliates = DB.getAffiliates();
    if (affiliates.find(a => a.user === user)) {
        showToast('El usuario ya existe', 'error');
        return;
    }

    affiliates.push({
        id: Date.now(),
        name, lastname, cedula, phone, user, pass: hashPass(pass), banco,
        referralCode: generateReferralCode(),
        createdAt: new Date().toISOString()
    });

    DB.setAffiliates(affiliados);
    closeModal('modalAddAffiliate');
    loadAdminData();
    showToast('Afiliado agregado');
}

function editAffiliate(id) {
    const affiliates = DB.getAffiliates();
    const a = affiliates.find(aff => aff.id === id);
    if (!a) return;

    document.getElementById('editId').value = id;
    document.getElementById('editName').value = a.name;
    document.getElementById('editLastname').value = a.lastname;
    document.getElementById('editCedula').value = a.cedula || '';
    document.getElementById('editPhone').value = a.phone || '';
    document.getElementById('editBanco').value = a.banco || '';
    document.getElementById('modalEditAffiliate').classList.remove('hidden');
}

function saveEditAffiliate() {
    const id = parseInt(document.getElementById('editId').value);
    const affiliates = DB.getAffiliates();
    const index = affiliates.findIndex(a => a.id === id);
    if (index === -1) return;

    affiliates[index].name = document.getElementById('editName').value;
    affiliates[index].lastname = document.getElementById('editLastname').value;
    affiliates[index].cedula = document.getElementById('editCedula').value;
    affiliates[index].phone = document.getElementById('editPhone').value;
    affiliates[index].banco = document.getElementById('editBanco').value;

    DB.setAffiliates(affiliates);
    closeModal('modalEditAffiliate');
    loadAdminData();
    showToast('Afiliado actualizado');
}

function deleteAffiliate(id) {
    if (!confirm('¿Eliminar este afiliado?')) return;
    let affiliates = DB.getAffiliates();
    affiliates = affiliates.filter(a => a.id !== id);
    DB.setAffiliates(affiliados);
    loadAdminData();
    showToast('Afiliado eliminado');
}

function showAddSale() {
    const affiliates = DB.getAffiliates();
    const select = document.getElementById('saleAffiliate');
    select.innerHTML = '<option value="">Seleccionar Afiliado</option>' +
        affiliates.map(a => `<option value="${a.id}">${a.name} ${a.lastname}</option>`).join('');
    document.getElementById('modalAddSale').classList.remove('hidden');
}

function addSale() {
    const affiliateId = parseInt(document.getElementById('saleAffiliate').value);
    const negocio = document.getElementById('saleNegocio').value;
    const rif = document.getElementById('saleRif').value;
    const telefono = document.getElementById('saleTelefono').value;
    const direccion = document.getElementById('saleDireccion').value;
    const code = document.getElementById('saleCode').value;
    const days = document.getElementById('saleDays').value;
    const status = document.getElementById('saleStatus').value;

    if (!affiliateId || !rif || !code || !days) {
        showToast('Todos los campos son obligatorios', 'error');
        return;
    }

    const sales = DB.getSales();
    const fechaVenta = new Date().toISOString();
    sales.push({
        id: Date.now(),
        affiliateId,
        negocio,
        rif,
        telefono,
        direccion,
        code,
        days: parseInt(days),
        daysOriginal: parseInt(days),
        status,
        date: fechaVenta,
        activationDate: fechaVenta
    });

    DB.setSales(sales);
    closeModal('modalAddSale');
    loadAdminData();
    showToast('Venta y licencia registradas');
}

function editLicense(id) {
    const sales = DB.getSales();
    const s = sales.find(sale => sale.id === id);
    if (!s) return;

    document.getElementById('editLicenseId').value = id;
    document.getElementById('editLicenseCode').value = s.code || '';
    document.getElementById('editLicenseNegocio').value = s.negocio || '';
    document.getElementById('editLicenseRif').value = s.rif || '';
    document.getElementById('editLicenseTelefono').value = s.telefono || '';
    document.getElementById('editLicenseDays').value = s.daysOriginal || s.days || '';
    document.getElementById('editLicenseStatus').value = s.status || 'pendiente';
    document.getElementById('modalEditLicense').classList.remove('hidden');
}

function saveEditLicense() {
    const id = parseInt(document.getElementById('editLicenseId').value);
    const sales = DB.getSales();
    const index = sales.findIndex(s => s.id === id);
    if (index === -1) return;

    sales[index].code = document.getElementById('editLicenseCode').value;
    sales[index].negocio = document.getElementById('editLicenseNegocio').value;
    sales[index].rif = document.getElementById('editLicenseRif').value;
    sales[index].telefono = document.getElementById('editLicenseTelefono').value;
    sales[index].days = parseInt(document.getElementById('editLicenseDays').value);
    sales[index].daysOriginal = parseInt(document.getElementById('editLicenseDays').value);
    sales[index].status = document.getElementById('editLicenseStatus').value;

    DB.setSales(sales);
    closeModal('modalEditLicense');
    loadAdminData();
    showToast('Licencia actualizada');
}

function deleteLicense(id) {
    if (!confirm('¿Eliminar esta licencia?')) return;
    let sales = DB.getSales();
    sales = sales.filter(s => s.id !== id);
    DB.setSales(sales);
    loadAdminData();
    showToast('Licencia eliminada');
}

function showAddPayment() {
    const affiliates = DB.getAffiliates();
    const select = document.getElementById('paymentAffiliate');
    select.innerHTML = '<option value="">Seleccionar Afiliado</option>' +
        affiliates.map(a => `<option value="${a.id}">${a.name} ${a.lastname}</option>`).join('');
    document.getElementById('paymentInfo').classList.add('hidden');
    document.getElementById('modalAddPayment').classList.remove('hidden');
}

function showAffiliatePaymentInfo() {
    const affiliateId = parseInt(document.getElementById('paymentAffiliate').value);
    if (!affiliateId) {
        document.getElementById('paymentInfo').classList.add('hidden');
        return;
    }
    
    const affiliates = DB.getAffiliates();
    const aff = affiliates.find(a => a.id === affiliateId);
    if (!aff) return;

    document.getElementById('payAffName').textContent = aff.name + ' ' + aff.lastname;
    document.getElementById('payAffCedula').textContent = aff.cedula || 'No registrado';
    document.getElementById('payAffPhone').textContent = aff.phone || 'No registrado';
    document.getElementById('payAffBanco').textContent = aff.banco || 'No registrado';
    document.getElementById('paymentInfo').classList.remove('hidden');
}

function addPayment() {
    const affiliateId = parseInt(document.getElementById('paymentAffiliate').value);
    const amount = document.getElementById('paymentAmount').value;
    const method = document.getElementById('paymentMethod').value;
    const ref = document.getElementById('paymentRef').value;

    if (!affiliateId || !amount) {
        showToast('Selecciona afiliado e ingresa monto', 'error');
        return;
    }

    const payments = DB.getPayments();
    payments.push({
        id: Date.now(),
        affiliateId,
        amount: parseFloat(amount),
        method,
        ref,
        date: new Date().toISOString()
    });

    DB.setPayments(payments);
    closeModal('modalAddPayment');
    loadAdminData();
    showToast('Pago registrado');
}

function exportData() {
    const affiliates = DB.getAffiliates();
    const sales = DB.getSales();
    const payments = DB.getPayments();

    let csv = '=== AFILIADOS ===\n';
    csv += 'Nombre,Correo,Teléfono,Banco,Ventas,Comisión\n';
    affiliates.forEach(a => {
        const affSales = sales.filter(s => s.affiliateId === a.id);
        csv += `${a.name} ${a.lastname},${a.user},${a.phone},${a.banco || ''},${affSales.length},$${affSales.length * 2}\n`;
    });

    csv += '\n=== VENTAS ===\n';
    csv += 'Código,RIF,Días,Fecha,Estado\n';
    sales.forEach(s => {
        csv += `${s.code},${s.rif},${s.daysOriginal},${new Date(s.date).toLocaleDateString()},${s.status}\n`;
    });

    csv += '\n=== PAGOS ===\n';
    csv += 'Fecha,Afiliado,Monto,Método,Referencia\n';
    payments.forEach(p => {
        const aff = affiliates.find(a => a.id === p.affiliateId);
        csv += `${new Date(p.date).toLocaleDateString()},${aff ? aff.name + ' ' + aff.lastname : ''},$${p.amount},${p.method},${p.ref || ''}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'reporte_afiliados_' + new Date().toISOString().split('T')[0] + '.csv';
    a.click();
    showToast('📥 Descargando reporte...');
}

function showResetPass() {
    document.getElementById('modalResetPass').classList.remove('hidden');
}

function requestPasswordReset() {
    const email = document.getElementById('resetEmail').value.toLowerCase().trim();
    if (!email) {
        showToast('Ingresa tu correo', 'error');
        return;
    }
    
    const affiliates = DB.getAffiliates();
    const aff = affiliates.find(a => a.user === email);
    
    if (!aff) {
        showToast('Correo no encontrado', 'error');
        return;
    }

    const newPass = Math.random().toString(36).slice(-6);
    aff.pass = hashPass(newPass);
    DB.setAffiliates(affiliados);
    
    closeModal('modalResetPass');
    showToast(`Nueva contraseña: ${newPass}. Compártela con el afiliado.`, 'success');
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

function showTab(tab) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    document.getElementById('tab-' + tab).classList.remove('hidden');
    document.querySelectorAll('.tab-btn').forEach(el => {
        el.classList.remove('bg-blue-600');
        el.classList.add('bg-slate-700');
    });
    document.querySelector(`[data-tab="${tab}"]`).classList.add('bg-blue-600');
    document.querySelector(`[data-tab="${tab}"]`).classList.remove('bg-slate-700');
}

function closeModal(id) {
    document.getElementById(id).classList.add('hidden');
}

function logout() {
    DB.logout();
    currentUser = null;
    showLogin();
    document.getElementById('loginUser').value = '';
    document.getElementById('loginPass').value = '';
    alert('Sesión cerrada');
}

function showLogin() {
    document.getElementById('loginScreen').classList.add('visible');
    document.getElementById('registerScreen').classList.remove('visible');
    document.getElementById('adminDashboard').classList.remove('visible');
    document.getElementById('affiliateDashboard').classList.remove('visible');
}

let toastTimeout = null;
function showToast(msg, type = 'success') {
    const toast = document.getElementById('toast');
    
    if (toastTimeout) clearTimeout(toastTimeout);
    
    toast.textContent = msg;
    toast.className = 'fixed bottom-4 right-4 px-6 py-3 rounded-xl font-semibold transition-opacity ' + 
        (type === 'error' ? 'bg-red-600' : 'bg-green-600');
    toast.style.opacity = '1';
    toast.style.display = 'block';
    
    toastTimeout = setTimeout(() => {
        toast.style.opacity = '0';
    }, 5000);
}

window.onload = function() {
    showLogin();
    
    const user = DB.getCurrentUser();
    if (user) {
        const storedToken = localStorage.getItem('sessionToken');
        if (user.sessionToken === storedToken) {
            if (user.type === 'admin') {
                currentUser = user;
                showAdminDashboard();
            } else if (user.type === 'affiliate' && user.id) {
                currentUser = user;
                showAffiliateDashboard();
            }
        } else {
            DB.logout();
        }
    }
    
    // Migrar datos antiguos si existen
    const oldData = localStorage.getItem('afiliados');
    if (oldData && !localStorage.getItem('afiliados_enc')) {
        try {
            const parsed = JSON.parse(oldData);
            DB.setAffiliates(parsed);
        } catch(e) {}
    }
    
    // Sync con Firebase si está configurado
    if (getFirebaseConfig().apiKey) {
        setTimeout(() => {
            if (initFirebase()) {
                updateCloudStatus(true);
            }
        }, 1000);
    }
};

// Backup
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

// Importar datos
function importData(input) {
    const file = input.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            if (!validateDataIntegrity(data)) {
                showToast('Error: formato de datos inválido', 'error');
                return;
            }
            if (data.affiliates) DB.setAffiliates(data.affiliates);
            if (data.sales) DB.setSales(data.sales);
            if (data.emails) DB.setEmails(data.emails);
            if (data.payments) DB.setPayments(data.payments);
            loadAdminData();
            showToast('📂 Datos importados correctamente');
                } catch(err) {
            showToast('Error al importar: archivo inválido', 'error');
        }
    };
    reader.readAsText(file);
    input.value = '';
}

// Filtrar tablas
function filterTable(tableName) {
    const searchId = 'search' + tableName.charAt(0).toUpperCase() + tableName.slice(1);
    const input = document.getElementById(searchId);
    const filter = input.value.toLowerCase();
    const table = document.getElementById(tableName + 'Table');
    if (!table) return;
    
    const rows = table.querySelectorAll('tbody tr');
    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(filter) ? '' : 'none';
    });
}

// Perfil del afiliado
function showAffiliateProfile() {
    if (!currentUser || currentUser.type !== 'affiliate') return;
    
    document.getElementById('profileName').value = currentUser.name || '';
    document.getElementById('profileLastname').value = currentUser.lastname || '';
    document.getElementById('profilePhone').value = currentUser.phone || '';
    document.getElementById('profileCedula').value = currentUser.cedula || '';
    document.getElementById('profileBanco').value = currentUser.banco || '';
    document.getElementById('profileNewPass').value = '';
    
    document.getElementById('modalAffiliateProfile').classList.remove('hidden');
}

function saveAffiliateProfile() {
    if (!currentUser || currentUser.type !== 'affiliate') return;
    
    const affiliates = DB.getAffiliates();
    const index = affiliates.findIndex(a => a.id === currentUser.id);
    if (index === -1) return;
    
    affiliates[index].name = document.getElementById('profileName').value;
    affiliates[index].lastname = document.getElementById('profileLastname').value;
    affiliates[index].phone = document.getElementById('profilePhone').value;
    affiliates[index].cedula = document.getElementById('profileCedula').value;
    affiliates[index].banco = document.getElementById('profileBanco').value;
    
    const newPass = document.getElementById('profileNewPass').value;
    if (newPass && newPass.length >= 4) {
        affiliates[index].pass = hashPass(newPass);
    }
    
    DB.setAffiliates(affiliates);
    
    currentUser = { type: 'affiliate', ...affiliates[index] };
    DB.setCurrentUser(currentUser);
    
    closeModal('modalAffiliateProfile');
    loadAffiliateData();
    showToast('✅ Perfil actualizado');
}

// Renovar licencia
function showRenewLicense(id) {
    const sales = DB.getSales();
    const s = sales.find(sale => sale.id === id);
    if (!s) return;
    
    const activationDate = new Date(s.activationDate || s.date);
    const daysUsed = Math.floor((new Date() - activationDate) / (1000 * 60 * 60 * 24));
    const daysRemaining = s.daysOriginal - daysUsed;
    
    document.getElementById('renewLicenseId').value = id;
    document.getElementById('renewCurrentDays').value = daysRemaining + ' días';
    document.getElementById('renewAddDays').value = '';
    document.getElementById('renewNewTotal').value = daysRemaining + ' días';
    
    document.getElementById('renewAddDays').oninput = function() {
        const add = parseInt(this.value) || 0;
        document.getElementById('renewNewTotal').value = (daysRemaining + add) + ' días';
    };
    
    document.getElementById('modalRenewLicense').classList.remove('hidden');
}

function saveRenewLicense() {
    const id = parseInt(document.getElementById('renewLicenseId').value);
    const addDays = parseInt(document.getElementById('renewAddDays').value) || 0;
    
    if (addDays <= 0) {
        showToast('Ingresa días válidos', 'error');
        return;
    }
    
    const sales = DB.getSales();
    const index = sales.findIndex(s => s.id === id);
    if (index === -1) return;
    
    sales[index].daysOriginal += addDays;
    sales[index].days += addDays;
    sales[index].renewedAt = new Date().toISOString();
    
    DB.setSales(sales);
    closeModal('modalRenewLicense');
    loadAdminData();
    showToast('✅ Licencia renovada +' + addDays + ' días');
}

// Cambiar contraseña admin
function showChangeAdminPass() {
    document.getElementById('adminCurrentUser').value = DB.getAdminUser();
    document.getElementById('adminNewUser').value = '';
    document.getElementById('adminCurrentPass').value = '';
    document.getElementById('adminNewPass').value = '';
    document.getElementById('adminConfirmPass').value = '';
    document.getElementById('modalChangeAdminPass').classList.remove('hidden');
}

function changeAdminPass() {
    const currentUser = document.getElementById('adminCurrentUser').value.trim();
    const newUser = document.getElementById('adminNewUser').value.trim();
    const currentPass = document.getElementById('adminCurrentPass').value;
    const newPass = document.getElementById('adminNewPass').value;
    const confirmPass = document.getElementById('adminConfirmPass').value;
    
    if (currentUser !== DB.getAdminUser()) {
        showToast('El usuario actual es incorrecto', 'error');
        return;
    }
    
    if (currentPass !== DB.getAdminPass()) {
        showToast('La contraseña actual es incorrecta', 'error');
        return;
    }
    
    if (newPass.length < 4) {
        showToast('La nueva contraseña debe tener al menos 4 caracteres', 'error');
        return;
    }
    
    if (newPass !== confirmPass) {
        showToast('Las contraseñas no coinciden', 'error');
        return;
    }
    
    if (newUser && newUser.length >= 3) {
        DB.setAdminUser(newUser);
    }
    
    DB.setAdminPass(newPass);
    closeModal('modalChangeAdminPass');
    showToast('✅ Contraseña del admin actualizada');
    
    if (initFirebaseClient()) {
        firebaseDb.ref('sistema_afiliados/admin').set({
            user: newUser || DB.getAdminUser(),
            pass: newPass
        }).then(() => {
            showToast('✅ Actualizado en Firebase');
        });
    }
}

// Firebase
let firebaseApp = null;
let firebaseDb = null;
let lastDataHash = '';

function validateDataIntegrity(data) {
    if (!data || typeof data !== 'object') return false;
    if (!data.affiliates || !Array.isArray(data.affiliates)) return false;
    return true;
}

function scheduleAutoBackup() {}

function getFirebaseConfig() {
    return {
        apiKey: "AIzaSyBbvoi-sByR6F7iC1AbOjs7zxbGRfzfMZ0",
        projectId: "novapos-minegocio",
        databaseURL: "https://novapos-minegocio-default-rtdb.firebaseio.com"
    };
}

function initFirebase() {
    const config = getFirebaseConfig();
    if (!config.apiKey || !config.databaseURL) {
        return false;
    }
    
    try {
        if (!firebaseApp) {
            firebaseApp = firebase.initializeApp({
                apiKey: config.apiKey,
                authDomain: config.projectId + ".firebaseapp.com",
                databaseURL: config.databaseURL,
                projectId: config.projectId
            });
            firebaseDb = firebase.database();
        }
        return true;
    } catch (e) {
        console.error("Firebase init error:", e);
        return false;
    }
}

function updateCloudStatus(connected) {
    const statusEl = document.getElementById('cloudStatus');
    if (connected) {
        statusEl.textContent = '☁️ Conectado';
        statusEl.className = 'text-xs text-green-400';
    } else {
        statusEl.textContent = '☁️ Sin conectar';
        statusEl.className = 'text-xs text-slate-400';
    }
}

function showFirebaseConfig() {
    const config = getFirebaseConfig();
    document.getElementById('firebaseApiKey').value = config.apiKey;
    document.getElementById('firebaseProjectId').value = config.projectId;
    document.getElementById('firebaseDatabaseUrl').value = config.databaseURL;
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
    
    closeModal('modalFirebaseConfig');
    showToast('✅ Configuración guardada');
    
    if (initFirebase()) {
        updateCloudStatus(true);
    }
}

function syncToCloud() {
    if (!initFirebaseClient()) {
        showToast('☁️ Configura Firebase primero', 'error');
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
            showToast('☁️ Datos subidos a la nube');
        })
        .catch((error) => {
            showToast('Error al subir: ' + error.message, 'error');
        });
}

function syncFromCloud() {
    if (!initFirebaseClient()) {
        showToast('Firebase no disponible', 'error');
        return;
    }
    
    if (!confirm('⚠️ Esto reemplazará todos los datos locales con los de la nube. ¿Continuar?')) {
        return;
    }
    
    firebaseDb.ref('sistema_afiliados').get()
        .then((snapshot) => {
            const data = snapshot.val();
            if (data && validateDataIntegrity(data)) {
                if (data.affiliates) DB.setAffiliates(data.affiliates);
                if (data.sales) DB.setSales(data.sales);
                if (data.emails) DB.setEmails(data.emails);
                if (data.payments) DB.setPayments(data.payments);
                
                loadAdminData();
                updateCloudStatus(true);
                showToast('☁️ Datos descargados de la nube');
            } else {
                showToast('No hay datos válidos en la nube', 'error');
            }
        })
        .catch((error) => {
            showToast('Error al descargar: ' + error.message, 'error');
        });
}

function autoSync() {}

function loadFromCloud() {
    if (!initFirebaseClient()) return;
    
    firebaseDb.ref('sistema_afiliados').get()
        .then((snapshot) => {
            const data = snapshot.val();
            if (data && validateDataIntegrity(data)) {
                if (data.affiliates) DB.setAffiliates(data.affiliates);
                if (data.sales) DB.setSales(data.sales);
                if (data.emails) DB.setEmails(data.emails);
                if (data.payments) DB.setPayments(data.payments);
            }
        })
        .catch(() => {});
}
