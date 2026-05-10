// ==========================================
// 博物館系統前端核心 (app_core.js)
// 包含：API通訊(Fetch跨網域)、七天免登入記憶、全域變數、權限控管 (RBAC)、離線快取、基礎工具
// ==========================================

const API_URL = "https://script.google.com/macros/s/AKfycbyqp0mjDTKBN0-qru1ITtgvxXKsFq96V-WmUEzK5ZxcjUyxonLX8Wd9xeXqBmWZ95yS/exec";
const TOKEN_KEY = "museum_auth_token";
const TOKEN_VALID_MS = 7 * 24 * 60 * 60 * 1000; // 7天

// ================= 💡 全域變數宣告 =================
let globalCatalog = {}; 
let globalLocTree = []; 
let mgrLocTree = [];
let pendingLocTree = [];
let sysState = { mode: 'all', locations: [], total: 0, scanned: 0 };
let printCartMap = new Map(); 
let allPrintItems = [];
let scanner = null, locScanner = null, queryScanner = null;
let isProc = false, lastScan = 0; 
let localItemCache = {}; 
let syncQueue = []; 
let isSyncing = false;
let currentManager = ""; 
let currentPermissions = {}; // 存放目前登入者的權限清單
let currentModalTarget = ""; 
let locScanTarget = ""; 
let currentMvEventId = "";
let mgrPendingData = [], mgrConfirmedData = [];

// ================= 💡 系統初始化與七天免登入機制 =================
document.addEventListener("DOMContentLoaded", () => {
    loadSyncQueue();
    checkSavedAuth();
});

function checkSavedAuth() {
    try {
        const tokenStr = localStorage.getItem(TOKEN_KEY);
        if (tokenStr) {
            const token = JSON.parse(tokenStr);
            if (Date.now() < token.expiry) {
                currentManager = token.managerName;
                currentPermissions = token.permissions;
                const daysLeft = Math.ceil((token.expiry - Date.now()) / (1000 * 60 * 60 * 24));
                
                document.getElementById('welcomeName').innerText = '👋 歡迎歸隊，' + currentManager + '！';
                document.getElementById('tokenCountdown').innerText = `🔐 授權憑證有效期限剩餘：${daysLeft} 天`;
                
                document.getElementById('splashScreen').style.display = 'none';
                document.getElementById('authScreen').style.display = 'none';
                
                applyPermissionsUI();
                document.getElementById('homeMenu').style.display = 'block';
                preloadBaseData();
                return;
            } else {
                localStorage.removeItem(TOKEN_KEY);
            }
        }
    } catch (e) { console.error("解析登入憑證失敗", e); }
    
    document.getElementById('splashScreen').style.display = 'none';
    document.getElementById('authScreen').style.display = 'flex';
    document.getElementById('frontDoorPwd').focus();
}

async function callAPI(action, payload = {}) {
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action: action, payload: payload })
        });
        if (!response.ok) throw new Error("網路連線異常，狀態碼：" + response.status);
        const res = await response.json();
        if (res.success) return res.data;
        else throw new Error(res.error || "後端處理發生未知錯誤");
    } catch (err) {
        console.error("API Call Error:", err);
        throw new Error("連線失敗：" + err.message);
    }
}

function preloadBaseData() {
    callAPI('getInventoryInitData').then(res => {
        globalCatalog = res.catalog || {};
        globalLocTree = res.locTree || [];
        if (res.manuals) {
            let html = '';
            for (let mod in res.manuals) { html += `<h6 class="fw-bold mt-3 text-dark border-bottom pb-1">${mod}</h6><p class="small text-muted" style="white-space: pre-wrap;">${res.manuals[mod]}</p>`; }
            document.getElementById('helpContent').innerHTML = html;
        }
    }).catch(e => console.error("背景預載基礎資料失敗", e));
}

async function loginAtFrontDoor() {
    const pwd = document.getElementById('frontDoorPwd').value.trim();
    if(!pwd) return alert('請輸入密碼！');
    showMiniLoading('驗證權限中...');
    try {
        const res = await callAPI('verifyManager', { pwd: pwd });
        currentManager = res.managerName;
        currentPermissions = res.permissions;
        
        const token = { managerName: currentManager, permissions: currentPermissions, expiry: Date.now() + TOKEN_VALID_MS };
        localStorage.setItem(TOKEN_KEY, JSON.stringify(token));
        
        document.getElementById('welcomeName').innerText = '👋 歡迎歸隊，' + currentManager + '！';
        document.getElementById('tokenCountdown').innerText = `🔐 授權憑證有效期限剩餘：7 天`;
        document.getElementById('authScreen').style.opacity = '0';
        
        setTimeout(() => {
            document.getElementById('authScreen').style.display = 'none';
            applyPermissionsUI();
            document.getElementById('homeMenu').style.display = 'block';
            preloadBaseData();
        }, 500);
    } catch(e) { alert(e.message); } finally { hideMiniLoading(); }
}

function applyPermissionsUI() {
    document.querySelector('.c-query').style.display = currentPermissions.query ? 'flex' : 'none';
    document.querySelector('.c-reg').style.display = currentPermissions.register ? 'flex' : 'none';
    document.querySelector('.c-inv').style.display = currentPermissions.inv ? 'flex' : 'none';
    
    let hasAnyMovePerm = currentPermissions.move_overview || currentPermissions.move_create || currentPermissions.move_execute;
    document.querySelector('.c-move').style.display = hasAnyMovePerm ? 'flex' : 'none';
    document.querySelector('.c-mgr').style.display = currentPermissions.mgr ? 'flex' : 'none';

    const btnOverview = document.querySelector('button[data-bs-target="#moveOverviewTab"]');
    const btnCreate = document.querySelector('button[data-bs-target="#moveCreateTab"]');
    const btnExecute = document.querySelector('button[data-bs-target="#moveExecuteTab"]');
    
    if(btnOverview) btnOverview.parentElement.style.display = currentPermissions.move_overview ? 'block' : 'none';
    if(btnCreate) btnCreate.parentElement.style.display = currentPermissions.move_create ? 'block' : 'none';
    if(btnExecute) btnExecute.parentElement.style.display = currentPermissions.move_execute ? 'block' : 'none';
}

function logoutSystem() {
    if(!confirm("確定要登出系統並清除授權憑證嗎？")) return;
    currentManager = "";
    currentPermissions = {};
    localStorage.removeItem(TOKEN_KEY);
    
    document.getElementById('homeMenu').style.display = 'none';
    document.getElementById('frontDoorPwd').value = '';
    document.getElementById('authScreen').style.opacity = '1';
    document.getElementById('authScreen').style.display = 'flex';
}

// 進入指定模組
async function enterSystem(sys) {
    const sysNames = { query: '藏品狀態查詢', register: '建檔與列印中心', inv: '文物盤點系統', move: '文物異動搬運', mgr: '管理員後台' };
    document.getElementById('sysTitle').innerText = sysNames[sys];
    
    document.querySelector(`button[data-bs-target="#${sys}"]`).click();
    
    if(sys === 'move') {
        setTimeout(() => {
            if(currentPermissions.move_overview) document.querySelector('button[data-bs-target="#moveOverviewTab"]').click();
            else if(currentPermissions.move_create) document.querySelector('button[data-bs-target="#moveCreateTab"]').click();
            else if(currentPermissions.move_execute) document.querySelector('button[data-bs-target="#moveExecuteTab"]').click();
        }, 50);
    }
    
    document.getElementById('homeMenu').style.display = 'none';
    document.getElementById('mainApp').style.display = 'block';
    window.scrollTo(0, 0);

    if (sys === 'query') { document.getElementById('queryManualInput').focus(); }
    if (sys === 'move' || sys === 'mgr') {
        showMiniLoading('載入動態資料中...');
        try {
            const initData = await callAPI('getWorkerInitData');
            globalLocTree = initData.locTree; mgrLocTree = initData.mgrLocTree;
            
            let evHtml = '<option value="">請選擇專案...</option>';
            initData.events.forEach(e => evHtml += `<option value="${escapeHTML(e.id)}">${escapeHTML(e.name)}</option>`);
            document.getElementById('mvEvent').innerHTML = evHtml;
            document.getElementById('mgrEvent').innerHTML = evHtml;
            
            let stHtml = ''; initData.staffInternal.forEach(s => stHtml += `<option value="${escapeHTML(s)}">${escapeHTML(s)}</option>`);
            document.getElementById('mvStaffInternal').innerHTML = stHtml;
            
            if (sys === 'mgr' && currentPermissions.mgr) { renderLocationsList(mgrLocTree); loadManagerData(); }
            if (sys === 'move') {
                if(currentPermissions.move_overview) loadAllProjects();
                else if(currentPermissions.move_create) checkMvDraft();
            }
        } catch(e) { alert("資料載入失敗: " + e.message); } finally { hideMiniLoading(); }
    }
}

function backToHome() {
    stopAllScanners();
    document.getElementById('mainApp').style.display = 'none';
    document.getElementById('homeMenu').style.display = 'block';
    window.scrollTo(0, 0);
}

function refreshSystem(sys) {
    if(sys === 'inv') { clearInventorySession(); enterSystem('inv'); }
    if(sys === 'move') { 
        document.getElementById('mvEvent').value = ''; 
        
        let mvLocSelector = document.getElementById('mvLocSelector'); if(mvLocSelector) mvLocSelector.style.display='none';
        let mvPhase2 = document.getElementById('mvPhase2'); if(mvPhase2) mvPhase2.style.display='none';
        let mvPhase3 = document.getElementById('mvPhase3'); if(mvPhase3) mvPhase3.style.display='none';
        let mvProgressBox = document.getElementById('mvProgressBox'); if(mvProgressBox) mvProgressBox.style.display='none';

        showMiniLoading('更新背景資料中...');
        callAPI('getWorkerInitData').then(initData => {
            globalLocTree = initData.locTree; mgrLocTree = initData.mgrLocTree;
            let evHtml = '<option value="">請選擇專案...</option>';
            initData.events.forEach(e => evHtml += `<option value="${escapeHTML(e.id)}">${escapeHTML(e.name)}</option>`);
            document.getElementById('mvEvent').innerHTML = evHtml;
            hideMiniLoading();
            
            if(currentPermissions.move_overview && typeof loadAllProjects === 'function') {
                loadAllProjects();
            }
        }).catch(e => { alert("資料載入失敗: " + e.message); hideMiniLoading(); });
    }
    if(sys === 'mgr') { enterSystem('mgr'); }
}

function openHelpDrawer() { const bsOffcanvas = new bootstrap.Offcanvas(document.getElementById('helpOffcanvas')); bsOffcanvas.show(); }

// ================= 💡 基礎工具函數 =================
function showMiniLoading(text) { document.getElementById('miniLoadingText').innerText = text; document.getElementById('miniLoading').style.display = 'flex'; }
function hideMiniLoading() { document.getElementById('miniLoading').style.display = 'none'; }
function escapeHTML(str) { return String(str).replace(/[&<>'"]/g, tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag])); }
function playSound(type) { try { const ctx = new (window.AudioContext || window.webkitAudioContext)(); const osc = ctx.createOscillator(); const gainNode = ctx.createGain(); osc.connect(gainNode); gainNode.connect(ctx.destination); if(type === 'success') { osc.type = 'sine'; osc.frequency.setValueAtTime(800, ctx.currentTime); gainNode.gain.setValueAtTime(0.1, ctx.currentTime); osc.start(); osc.stop(ctx.currentTime + 0.15); } else { osc.type = 'triangle'; osc.frequency.setValueAtTime(300, ctx.currentTime); osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.3); gainNode.gain.setValueAtTime(0.2, ctx.currentTime); osc.start(); osc.stop(ctx.currentTime + 0.3); } } catch(e){} }

function showSyncToast(msg, isSuccess = false) {
    const toast = document.getElementById('syncToast');
    const content = document.getElementById('syncToastContent');
    const icon = document.getElementById('syncToastIcon');
    document.getElementById('syncToastText').innerText = msg;
    toast.style.display = 'block'; setTimeout(() => toast.style.opacity = '1', 10);
    if(isSuccess) { icon.className = "fas fa-check-circle text-success me-2"; content.style.background = "#fff"; content.style.color = "#198754"; content.style.border = "2px solid #198754"; setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.style.display = 'none', 300); }, 3000); } 
    else { icon.className = "fas fa-circle-notch fa-spin text-info me-2"; content.style.background = "#212529"; content.style.color = "white"; content.style.border = "none"; }
}

async function stopScannerSafe(scannerObj) {
    if (scannerObj && scannerObj.getState() !== 1) {
        try { await scannerObj.stop(); } catch (e) { console.warn("相機關閉延遲", e); }
    }
}

async function stopAllScanners() {
    showMiniLoading('正在安全關閉相機...');
    if (scanner) { await stopScannerSafe(scanner); scanner = null; }
    // 🔥 這裡就是被修復的分號錯誤！
    if (locScanner) { await stopScannerSafe(locScanner); locScanner = null; document.getElementById('loc-reader-container').style.display = 'none'; }
    if (queryScanner) { await stopScannerSafe(queryScanner); queryScanner = null; document.getElementById('query-reader-container').style.display = 'none'; }
    hideMiniLoading();
}

// ================= 💡 樹狀地點渲染工具 (模組共用) =================
function renderTreeHTML(tree, containerId, prefix, isCheckbox) {
    const container = document.getElementById(containerId);
    if(tree.length === 0) { container.innerHTML = '<div class="text-center text-muted p-3">查無地點資料</div>'; return; }
    let html = '';
    tree.forEach((m, mIdx) => {
        let mainId = `${prefix}_m_${mIdx}`;
        html += `<div class="accordion-item mb-2 border-0 shadow-sm rounded overflow-hidden"><h2 class="accordion-header"><button class="accordion-button collapsed fw-bold bg-light text-dark py-3" type="button" data-bs-toggle="collapse" data-bs-target="#${mainId}">📂 ${escapeHTML(m.main)}</button></h2><div id="${mainId}" class="accordion-collapse collapse"><div class="accordion-body p-0">`;
        m.subs.forEach((s, sIdx) => {
            let subId = `${mainId}_s_${sIdx}`;
            html += `<div class="sub-group"><div class="p-2 border-bottom fw-bold text-success" data-bs-toggle="collapse" data-bs-target="#${subId}" style="cursor:pointer; background: #e8f5e9;">📁 ${escapeHTML(s.sub)} <small class="text-muted float-end">展開</small></div><div id="${subId}" class="collapse"><div class="p-2 bg-white">`;
            s.details.forEach((d, dIdx) => {
                let leafId = `${subId}_l_${dIdx}`;
                if (d.isHidden) return;
                let displayLabel = d.label === "(無)" ? d.val : d.label;
                if(isCheckbox) {
                    html += `<div class="form-check mb-2 py-1"><input class="form-check-input leaf-cb border-success" type="checkbox" value="${escapeHTML(d.val)}" id="${leafId}"><label class="form-check-label w-100 fs-6 text-dark" for="${leafId}">${escapeHTML(displayLabel)}</label></div>`;
                } else {
                    html += `<button class="btn btn-outline-success w-100 mb-2 text-start single-item-btn fw-bold" onclick="selectModalLoc('${escapeHTML(d.val)}')">📍 ${escapeHTML(displayLabel)}</button>`;
                }
            });
            html += `</div></div></div>`;
        });
        html += `</div></div></div>`;
    });
    container.innerHTML = `<div class="accordion" id="${prefix}Acc">${html}</div>`;
}

function filterInvTree() {
    const term = document.getElementById('invLocSearch').value.toLowerCase().trim();
    if(!term) { renderTreeHTML(globalLocTree, 'locCheckboxes', 'inv', true); return; }
    let filtered = [];
    globalLocTree.forEach(m => {
        let newM = { main: m.main, subs: [] };
        m.subs.forEach(s => { let matchedD = s.details.filter(d => !d.isHidden && (d.val.toLowerCase().includes(term) || d.label.toLowerCase().includes(term) || m.main.toLowerCase().includes(term))); if(matchedD.length > 0) newM.subs.push({ sub: s.sub, details: matchedD }); });
        if(newM.subs.length > 0) filtered.push(newM);
    });
    renderTreeHTML(filtered, 'locCheckboxes', 'inv', true);
    document.querySelectorAll('#locCheckboxes .collapse').forEach(el => new bootstrap.Collapse(el, {toggle: false}).show());
}

function filterModalTree() {
    const term = document.getElementById('modalLocSearch').value.toLowerCase().trim();
    let targetTree = (currentModalTarget === 'mvLoc') ? pendingLocTree : globalLocTree;
    if(!term) { renderTreeHTML(targetTree, 'modalLocContainer', 'modal', false); return; }
    let filtered = [];
    targetTree.forEach(m => {
        let newM = { main: m.main, subs: [] };
        m.subs.forEach(s => { let matchedD = s.details.filter(d => !d.isHidden && (d.val.toLowerCase().includes(term) || d.label.toLowerCase().includes(term) || m.main.toLowerCase().includes(term))); if(matchedD.length > 0) newM.subs.push({ sub: s.sub, details: matchedD }); });
        if(newM.subs.length > 0) filtered.push(newM);
    });
    renderTreeHTML(filtered, 'modalLocContainer', 'modal', false);
    document.querySelectorAll('#modalLocContainer .collapse').forEach(el => new bootstrap.Collapse(el, {toggle: false}).show());
}

// ================= 💡 背景離線快取同步邏輯 (盤點專用) =================
function saveSyncQueue() { try { localStorage.setItem('invSyncQueue', JSON.stringify(syncQueue)); } catch(e){} }
function loadSyncQueue() { try { const saved = JSON.parse(localStorage.getItem('invSyncQueue')); if(saved && Array.isArray(saved)) { syncQueue = saved; if(syncQueue.length > 0) triggerBackgroundSync(); } } catch(e){} }

async function triggerBackgroundSync() {
    if (isSyncing || syncQueue.length === 0) return; 
    isSyncing = true; 
    document.getElementById('syncStatus').style.display = 'block';
    
    while (syncQueue.length > 0) { 
        document.getElementById('syncQueueCount').innerText = syncQueue.length;
        let currentMsg = syncQueue[0]; 
        try { 
            await callAPI('submitScan', { qrStr: currentMsg, mode: sysState.mode, locations: sysState.locations }); 
            syncQueue.shift(); 
            saveSyncQueue();
        } catch(e) { 
            let errStr = e.message.toLowerCase(); 
            if(errStr.includes('fetch') || errStr.includes('network') || errStr.includes('internet') || errStr.includes('failed to fetch')) { 
                break; // 網路斷線，保留駐留列隊
            } else { 
                console.error("背景同步失敗 (非網路問題，放棄該筆):", e);
                syncQueue.shift(); 
                saveSyncQueue();
            } 
        } 
    }
    isSyncing = false; 
    document.getElementById('syncStatus').style.display = 'none';
}

window.addEventListener('online', () => { if(syncQueue.length > 0) triggerBackgroundSync(); });
