// ==========================================
// ⚠️ 核心設定：請貼上您最新部署的 GAS API 網址！
const API_URL = "https://script.google.com/macros/s/AKfycbyqp0mjDTKBN0-qru1ITtgvxXKsFq96V-WmUEzK5ZxcjUyxonLX8Wd9xeXqBmWZ95yS/exec"; 
// ==========================================

// --- 全域變數宣告區 ---
let currentManager = "", pendingLocTree = [], currentModalTarget = "", baselineTime = 0;
let globalLocTree = []; 
let mgrLocTree = [];    

let audioCtx, scanner = null, queryScanner = null, locScanner = null, lastScan = 0, sysState = { mode: 'all', locations: [], total: 0, scanned: 0 }, isProc = false;
let localItemCache = {}, syncQueue = [], isSyncing = false;   
let allPrintItems = [], printCartMap = new Map(), globalCatalog = {}; 
let globalManuals = {}; 
let currentProjectItems = [];
let currentMvEventId = "";
let locScanTarget = "";

let newMvCart = new Map();
let allMvItems = [];
let parsedImportItems = [];
let parsedOverrideItems = [];

let locUpdateQueue = [];
let isLocSyncing = false;
let locAddQueue = [];
let isLocAdding = false;

let mgrPendingData = [];
let mgrConfirmedData = [];

let myUserId = localStorage.getItem('myUid') || Math.random().toString(36).substring(2);
localStorage.setItem('myUid', myUserId);

// --- XSS 防護與安全機制 ---
function escapeHTML(str) {
    if (!str) return '';
    return String(str).replace(/[&<>'"]/g, function(tag) {
        const charsToReplace = { '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' };
        return charsToReplace[tag] || tag;
    });
}

// --- UI 狀態防呆與進度條機制 ---
let miniLoadingTimeout;
function setProgress(pct, text) { 
    document.getElementById('splashProgress').style.width = pct + '%'; 
    if(text) document.getElementById('splashText').innerText = text; 
}

function showMiniLoading(msg = "處理中...") { 
    document.getElementById('miniLoadingText').innerText = msg; 
    document.getElementById('miniLoading').style.display = 'flex'; 
    clearTimeout(miniLoadingTimeout);
    miniLoadingTimeout = setTimeout(() => {
        hideMiniLoading();
        console.warn("⚠️ 系統處理逾時，自動解除防呆鎖定。");
    }, 30000); 
}

function hideMiniLoading() { 
    document.getElementById('miniLoading').style.display = 'none'; 
    clearTimeout(miniLoadingTimeout);
}

function showSyncToast(text, isSuccess = false) {
    const toast = document.getElementById('syncToast');
    const icon = document.getElementById('syncToastIcon');
    document.getElementById('syncToastText').innerText = text;

    if (isSuccess) {
        icon.className = "fas fa-check-circle text-success me-2";
        setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.style.display = 'none', 300); }, 2000);
    } else {
        icon.className = "fas fa-circle-notch fa-spin text-info me-2";
        toast.style.display = 'block';
        setTimeout(() => toast.style.opacity = '1', 10);
    }
}

// --- 離線同步佇列 (Offline Sync Queue) ---
try {
    let savedQ = localStorage.getItem('offlineSyncQueue');
    if (savedQ) syncQueue = JSON.parse(savedQ);
} catch(e) {}

function saveSyncQueue() {
    try { localStorage.setItem('offlineSyncQueue', JSON.stringify(syncQueue)); } catch(e) {}
    let qCount = document.getElementById('syncQueueCount');
    if(qCount) qCount.innerText = syncQueue.length;
}

// --- API 呼叫 ---
async function callAPI(action, payload = {}) {
    try {
        const cacheBuster = "?t=" + new Date().getTime(); 
        const response = await fetch(API_URL + cacheBuster, { 
            method: 'POST', 
            headers: { 'Content-Type': 'text/plain;charset=utf-8' }, 
            body: JSON.stringify({ action: action, payload: payload }) 
        });
        const res = await response.json();
        if (!res.success) throw new Error(res.error || res.msg);
        return res.data;
    } catch (err) { throw new Error(err.message); }
}

// --- 系統啟動與認證 ---
window.onload = function() {
    const urlParams = new URLSearchParams(window.location.search);
    const directQueryId = urlParams.get('id');

    if(directQueryId) {
        document.getElementById('btnNavHome').classList.add('d-none'); document.getElementById('btnNavHome').classList.remove('d-flex');
        document.getElementById('btnNavHelp').classList.add('d-none'); document.getElementById('btnNavHelp').classList.remove('d-flex');
        document.getElementById('queryHeaderTitle').innerText = "典藏庫房藏品資訊";
        document.getElementById('qResAdvancedArea').style.display = 'none'; document.getElementById('queryInputGrp').style.display = 'none';
        document.getElementById('btnStartQueryCam').style.display = 'none'; document.getElementById('authScreen').style.display = 'none';
        startAppLoading(directQueryId);
    } else {
        let tokenExp = localStorage.getItem('tokenExpiry');
        if(tokenExp && parseInt(tokenExp) > Date.now()) {
            document.getElementById('authScreen').style.display = 'none'; currentManager = localStorage.getItem('staffName') || "管理員"; startAppLoading(null);
        } else {
            document.getElementById('splashScreen').style.display = 'none'; document.getElementById('authScreen').style.display = 'flex';
            localStorage.removeItem('staffToken'); localStorage.removeItem('staffName'); localStorage.removeItem('tokenExpiry');
        }
    }
    
    if (syncQueue.length > 0) {
        triggerBackgroundSync();
    }
};

async function loginAtFrontDoor() {
    const pwd = document.getElementById('frontDoorPwd').value; if(!pwd) return alert("請輸入密碼！");
    let btn = document.querySelector('#authScreen button'); btn.innerText = "驗證中..."; btn.disabled = true;
    try {
        const res = await callAPI('verifyManager', { pwd: pwd }); currentManager = res.managerName;
        localStorage.setItem('staffToken', 'true'); localStorage.setItem('staffName', currentManager); localStorage.setItem('tokenExpiry', Date.now() + 604800000); 
        document.getElementById('authScreen').style.opacity = '0';
        setTimeout(() => { document.getElementById('authScreen').style.display = 'none'; document.getElementById('splashScreen').style.display = 'flex'; startAppLoading(null); }, 500);
    } catch(e) { alert("密碼錯誤：" + e.message); btn.innerText = "進入系統"; btn.disabled = false; }
}

function logoutSystem() {
    if(!confirm("確定要登出系統嗎？")) return;
    localStorage.removeItem('staffToken'); localStorage.removeItem('staffName'); localStorage.removeItem('tokenExpiry');
    location.href = window.location.pathname;
}

function updateProfileBanner() {
    let name = localStorage.getItem('staffName') || "管理員", exp = parseInt(localStorage.getItem('tokenExpiry')) || 0, daysLeft = Math.ceil((exp - Date.now()) / (1000 * 60 * 60 * 24));
    document.getElementById('welcomeName').innerText = `👋 歡迎歸隊，${name}！`; document.getElementById('tokenCountdown').innerText = `🔐 授權憑證有效期限剩餘：${daysLeft} 天`;
}

async function startAppLoading(directQueryId) {
    let fakeProgress = 10; setProgress(fakeProgress, '喚醒雲端伺服器...');
    const loadingMessages = ["正在建立安全連線...", "載入全庫房數位圖鑑...", "同步歷史異動紀錄...", "解析空間樹狀圖...", "準備系統資源中..."];
    let msgIndex = 0; const loadingInterval = setInterval(() => { fakeProgress += (85 - fakeProgress) * 0.1; msgIndex = (msgIndex + 1) % loadingMessages.length; setProgress(fakeProgress, loadingMessages[msgIndex]); }, 1000); 

    try {
        const [invData, workData] = await Promise.all([callAPI('getInventoryInitData'), callAPI('getWorkerInitData')]);
        clearInterval(loadingInterval); setProgress(90, '✅ 資料庫同步完成！建構使用者介面...');
        
        globalCatalog = invData.catalog || {}; globalManuals = invData.manuals || {}; 
        baselineTime = invData.baselineTime || 0; let d = new Date(baselineTime); if (isNaN(d.getTime())) d = new Date();
        document.getElementById('baselineInfo').innerText = `📅 本期盤點基準日：${d.toLocaleString()}`; document.getElementById('mqBaseline').innerText = `📅 本期盤點基準日：${d.toLocaleString()}`;
        
        globalLocTree = workData.locTree || []; 
        mgrLocTree = workData.mgrLocTree || [];

        renderTreeHTML(globalLocTree, 'locCheckboxes', 'inv', true); 
        // 模組化：這部分會在 app_modules.js 被處理，我們保留原本的呼叫
        if (typeof renderLocationsList === 'function') renderLocationsList(mgrLocTree); 

        populateSelect('mvEvent', workData.events || [], true); 
        populateSelect('mgrEvent', workData.events || [], true); 
        populateSelect('mvStaffInternal', workData.staffInternal || []);
        
        const actionSelect = document.getElementById('newMvActionSelect');
        actionSelect.innerHTML = '<option value="NEW">➕ 建立全新專案</option>' + (workData.events || []).map(x => `<option value="${escapeHTML(x.id)}">✏️ 編輯專案: ${escapeHTML(x.name)}</option>`).join('');

        setProgress(100, '🚀 系統啟動！');
        
        setTimeout(() => {
            document.getElementById('splashScreen').style.opacity = '0'; document.body.style.backgroundColor = '#f1f3f5';
            setTimeout(() => {
                document.getElementById('splashScreen').style.display = 'none';
                if(directQueryId) { 
                    enterSystem('query'); 
                    if (typeof execQuery === 'function') execQuery(directQueryId); 
                } else { 
                    updateProfileBanner(); document.getElementById('homeMenu').style.display = 'block'; 
                }
            }, 500);
        }, 500);
    } catch (err) { clearInterval(loadingInterval); alert("⚠️ 系統載入異常！\n錯誤細節：" + err.message); document.getElementById('splashText').innerText = "載入失敗，請重新整理"; document.getElementById('splashText').classList.add('text-danger'); }
}

// --- 通用導航與幫助功能 ---
function openHelpDrawer() {
    let activeTab = document.querySelector('.nav-link.active'); if(!activeTab) return;
    let moduleId = activeTab.getAttribute('data-bs-target').replace('#', '');
    let content = globalManuals[moduleId];
    if (!content) { document.getElementById('helpContent').innerHTML = "管理員尚未同步此模組的操作說明。<br><br>請點擊下方按鈕查看完整版《系統操作手冊》。"; } else { document.getElementById('helpContent').innerHTML = formatHelpText(escapeHTML(content)); }
    let titles = { 'query': '🔍 藏品狀態查詢', 'register': '📝 建檔與列印中心', 'inv': '📦 文物盤點系統', 'move': '🚚 文物異動搬運', 'mgr': '⚙️ 管理員後台' };
    document.getElementById('helpOffcanvasLabel').innerText = titles[moduleId] + " 指南";
    var bsOffcanvas = new bootstrap.Offcanvas(document.getElementById('helpOffcanvas')); bsOffcanvas.show();
}

function enterSystem(sysId) {
    document.getElementById('homeMenu').style.display = 'none'; document.getElementById('mainApp').style.display = 'block'; document.body.style.overflowY = 'auto'; 
    if(sysId === 'inv') { document.getElementById('step2').style.display = 'none'; document.getElementById('step3').style.display = 'none'; document.getElementById('step1').style.display = 'block'; if (typeof checkSavedSession === 'function') checkSavedSession(); }
    if(sysId === 'move') { 
        if (typeof loadAllProjects === 'function') loadAllProjects(); 
        if (typeof loadNewMvList === 'function') loadNewMvList(); 
        if (typeof checkMvDraft === 'function') checkMvDraft(); 
    } 
    const tabTrigger = new bootstrap.Tab(document.querySelector(`button[data-bs-target="#${sysId}"]`)); tabTrigger.show();
    document.getElementById('sysTitle').innerText = { 'query': '🔍 藏品狀態查詢', 'register': '📝 建檔與列印中心', 'inv': '📦 文物盤點系統', 'move': '🚚 文物異動系統', 'mgr': '⚙️ 管理員後台' }[sysId];
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)(); if (audioCtx.state === 'suspended') audioCtx.resume();
}

async function stopScannerSafe(cam) { 
    if (cam) { 
        try { 
            if (cam.getState() === 2 || cam.getState() === 3) { 
                await cam.stop(); 
            } 
        } catch(e) { console.warn("相機停止發生錯誤，強制釋放資源:", e); } 
        try { cam.clear(); } catch(e) {} 
    } 
}

async function backToHome() {
    let isStaff = localStorage.getItem('staffToken') === 'true'; if(!isStaff) return;
    showMiniLoading('正在安全關閉模組...');
    if (document.getElementById('step2').style.display === 'block') { await stopScannerSafe(scanner); scanner = null; document.getElementById('step2').style.display = 'none'; document.getElementById('step1').style.display = 'block'; }
    if (queryScanner) { await stopScannerSafe(queryScanner); queryScanner = null; document.getElementById('query-reader-container').style.display = 'none'; document.getElementById('btnStartQueryCam').style.display = 'block'; }
    if (locScanner) { if (typeof stopLocScanner === 'function') await stopLocScanner(); }
    window.scrollTo(0, 0); document.body.style.overflowY = 'auto'; document.getElementById('mainApp').style.display = 'none'; document.getElementById('homeMenu').style.display = 'block'; 
    
    try { 
        if (window.location.protocol !== 'blob:' && window.location.origin !== 'null') {
            const currentUrl = new URL(window.location.href);
            currentUrl.search = '';
            window.history.replaceState({}, document.title, currentUrl.toString()); 
        }
    } catch(e) {}
    
    hideMiniLoading();
}

async function refreshSystem(sysId) {
    showMiniLoading('正在向雲端索取最新資料...');
    try {
        if(sysId === 'inv') { 
            const res = await callAPI('getInventoryInitData'); 
            globalCatalog = res.catalog || {}; 
            globalLocTree = res.locTree || [];
            renderTreeHTML(globalLocTree, 'locCheckboxes', 'inv', true); 
        } 
        else if (sysId === 'move') { 
            const res = await callAPI('getWorkerInitData'); 
            globalLocTree = res.locTree || []; 
            mgrLocTree = res.mgrLocTree || [];
            populateSelect('mvEvent', res.events || [], true); 
            
            const actionSelect = document.getElementById('newMvActionSelect');
            actionSelect.innerHTML = '<option value="NEW">➕ 建立全新專案</option>' + (res.events || []).map(x => `<option value="${escapeHTML(x.id)}">✏️ 編輯專案: ${escapeHTML(x.name)}</option>`).join('');
            if (typeof loadWorkerLocations === 'function') loadWorkerLocations(); 
            if (typeof loadAllProjects === 'function') loadAllProjects(); 
        } 
        else if (sysId === 'mgr') { 
            const res = await callAPI('getWorkerInitData'); 
            populateSelect('mgrEvent', res.events || [], true); 
            globalLocTree = res.locTree || []; 
            mgrLocTree = res.mgrLocTree || [];
            if (typeof renderLocationsList === 'function') renderLocationsList(mgrLocTree); 
            if(document.getElementById('mgrEvent').value && typeof loadManagerData === 'function') loadManagerData(); 
        }
    } catch(e) { alert("刷新失敗：" + e.message); } finally { hideMiniLoading(); }
}

// --- 通用選單與樹狀結構渲染 ---
function populateSelect(id, arr, isObj = false) { 
    if (!arr || !Array.isArray(arr)) return; 
    document.getElementById(id).innerHTML = '<option value="">請選擇...</option>' + arr.map(x => isObj ? `<option value="${escapeHTML(x.id)}">${escapeHTML(x.name)}</option>` : `<option value="${escapeHTML(x)}">${escapeHTML(x)}</option>`).join(''); 
}

function renderTreeHTML(treeData, containerId, prefix, isMulti) {
    if(!treeData || treeData.length === 0) { document.getElementById(containerId).innerHTML = '<div class="alert alert-warning">無可用地點</div>'; return; }
    let html = `<div class="accordion" id="${prefix}Accordion">`;
    treeData.forEach((mainNode, mIdx) => {
        let totalLeaves = mainNode.subs.reduce((sum, subNode) => sum + subNode.details.length, 0); let badgeHtml = isMulti ? `<span class="badge bg-secondary ms-2 count-badge" data-total="${totalLeaves}">已選 0/${totalLeaves}</span>` : '';
        html += `<div class="accordion-item main-item"><h2 class="accordion-header"><button class="accordion-button collapsed d-flex justify-content-between py-3" type="button" data-bs-toggle="collapse" data-bs-target="#${prefix}Col${mIdx}"><div><strong class="fs-5">${escapeHTML(mainNode.main)}</strong> ${badgeHtml}</div></button></h2><div id="${prefix}Col${mIdx}" class="accordion-collapse collapse"><div class="accordion-body p-2 bg-light">`;
        mainNode.subs.forEach((subNode, sIdx) => {
            let collapseId = `${prefix}_m${mIdx}_s${sIdx}_collapse`;
            if (subNode.details.length === 1) { 
                let det = subNode.details[0]; 
                let displayLabel = det.label === "(無)" ? subNode.sub : det.label; 
                html += `<div class="sub-group mb-2 bg-white rounded shadow-sm"><div class="leaf-item">` + (isMulti ? `<input type="checkbox" class="btn-check leaf-cb" value="${escapeHTML(det.val)}" id="${prefix}_m${mIdx}_s${sIdx}_d0" onchange="updateCounts()"><label class="btn single-item-btn w-100 text-start fw-bold py-3" for="${prefix}_m${mIdx}_s${sIdx}_d0">📍 ${escapeHTML(displayLabel)}</label>` : `<button type="button" class="btn single-item-btn w-100 text-start fw-bold py-3" onclick="selectModalLoc('${escapeHTML(det.val)}')">📍 ${escapeHTML(displayLabel)}</button>`) + `</div></div>`; 
            } 
            else {
                html += `<div class="sub-group mb-3 border rounded bg-white shadow-sm"><div class="d-flex justify-content-between align-items-center p-2 border-bottom"><div class="fw-bold text-primary flex-grow-1 fs-6" style="cursor:pointer;" data-bs-toggle="collapse" data-bs-target="#${collapseId}">📂 ${escapeHTML(subNode.sub)}</div>` + (isMulti ? `<div class="btn-group"><button type="button" class="btn btn-sm btn-outline-primary" onclick="selectAllInSub(this, true, '${collapseId}')">全選</button><button type="button" class="btn btn-sm btn-outline-secondary" onclick="selectAllInSub(this, false)">清除</button></div>` : '') + `</div><div id="${collapseId}" class="collapse"><div class="row g-2 p-2 bg-light">`;
                subNode.details.forEach((det, dIdx) => { 
                    let zebraClass = dIdx % 2 !== 0 ? 'bg-zebra-even' : 'bg-white'; 
                    let dLabel = det.label === "(無)" ? subNode.sub : det.label; 
                    html += `<div class="col-6 leaf-item">` + (isMulti ? `<input type="checkbox" class="btn-check leaf-cb" value="${escapeHTML(det.val)}" id="${prefix}_m${mIdx}_s${sIdx}_d${dIdx}" onchange="updateCounts()"><label class="btn btn-outline-success w-100 text-center py-2 text-truncate ${zebraClass}" for="${prefix}_m${mIdx}_s${sIdx}_d${dIdx}">${escapeHTML(dLabel)}</label>` : `<button type="button" class="btn btn-outline-dark w-100 text-center py-2 text-truncate ${zebraClass}" onclick="selectModalLoc('${escapeHTML(det.val)}')">${escapeHTML(dLabel)}</button>`) + `</div>`; 
                });
                html += `</div></div></div>`;
            }
        });
        html += `</div></div></div>`;
    });
    document.getElementById(containerId).innerHTML = html + '</div>';
}

function selectAllInSub(btn, isSelect, collapseId) { btn.closest('.sub-group').querySelectorAll('.leaf-cb').forEach(cb => { if (cb.closest('.leaf-item').style.display !== 'none') cb.checked = isSelect; }); if(isSelect && collapseId) { const div = document.getElementById(collapseId); if(div) div.classList.add('show'); } updateCounts(); }
function updateCounts() { document.querySelectorAll('.main-item').forEach(main => { const checked = Array.from(main.querySelectorAll('.leaf-cb')).filter(cb => cb.checked).length; const badge = main.querySelector('.count-badge'); if(!badge) return; badge.innerText = `已選 ${checked}/${badge.getAttribute('data-total')}`; badge.className = checked > 0 ? 'badge bg-success ms-2 count-badge' : 'badge bg-secondary ms-2 count-badge'; }); }

function filterInvTree() { execFilter('invLocSearch', 'locCheckboxes'); }
function filterModalTree() { execFilter('modalLocSearch', 'modalLocContainer'); }
function execFilter(id, container) {
    const term = document.getElementById(id).value.toLowerCase();
    document.querySelectorAll(`#${container} .main-item`).forEach(main => {
        let mVis = false;
        main.querySelectorAll('.sub-group').forEach(sub => {
            let sVis = false; sub.querySelectorAll('.leaf-item').forEach(leaf => { const txt = leaf.innerText.toLowerCase(); if (txt.includes(term)) { leaf.style.display = ''; sVis = true; mVis = true; } else { leaf.style.display = 'none'; } });
            sub.style.display = sVis ? '' : 'none'; const coll = sub.querySelector('.collapse'); if(coll && term && sVis) coll.classList.add('show');
        });
        const mColl = main.querySelector('.accordion-collapse'); if(mColl && term && mVis) mColl.classList.add('show'); main.style.display = mVis ? '' : 'none';
    });
}

function smartConcatLoc(main, med, small) {
    main = main || ""; med = med || ""; small = small || "";
    if (!small) return main + med;
    var prefixMatch = small.match(/^([^\-]+)-/);
    if (prefixMatch && med) {
        var prefix = prefixMatch[1];
        if (med.endsWith(prefix)) { return main + med + small.substring(prefix.length); }
    }
    return main + med + small;
}

function formatHelpText(raw) {
    if (!raw) return ""; let lines = raw.split('\n'); let html = '';
    lines.forEach(line => {
        let text = line.trim(); if(!text) { html += '<div class="mb-2"></div>'; return; }
        text = text.replace(/([^：\n]{2,20}：)/g, '<strong class="text-primary">$1</strong>');
        if (/^(\d+\.|[•\-*])\s+/.test(text)) {
            text = text.replace(/^(\d+\.|[•\-*])\s+(.*)$/, '<div class="d-flex mb-2"><span class="me-2 fw-bold text-secondary">$1</span><div>$2</div></div>');
            html += text;
        } else { html += '<div class="mb-2">' + text + '</div>'; }
    });
    return html;
}

function playSound(k) { 
    if (!audioCtx) return; 
    if (audioCtx.state === 'suspended') audioCtx.resume(); 
    const o = audioCtx.createOscillator(); const g = audioCtx.createGain(); 
    o.type = k === 'success' ? 'triangle' : 'square'; 
    o.frequency.value = k === 'success' ? 1100 : 550; 
    o.connect(g); g.connect(audioCtx.destination); 
    g.gain.setValueAtTime(0.05, audioCtx.currentTime); 
    o.start(); setTimeout(() => { o.stop(); }, 150); 
}

// --- 定時任務與背景同步監聽 ---
setInterval(async () => {
    if(document.getElementById('step2').style.display === 'block' || document.getElementById('step1').style.display === 'block' || document.getElementById('mvPhase1').offsetParent !== null) {
        try { let res = await callAPI('heartbeat', {user: myUserId}); document.getElementById('onlineUsersInv').innerText = `👥 線上：${res.count} 人`; document.getElementById('onlineUsersMove').innerText = `👥 線上：${res.count} 人`; } catch(e){}
    }
    if(document.getElementById('step2').style.display === 'block') {
        try { let res = await callAPI('startInventory', sysState); if(res.total !== sysState.total || res.scanned !== sysState.scanned) { sysState.total = res.total; sysState.scanned = res.scanned; localItemCache = res.itemMap || {}; if(typeof updateProgressUI === 'function') updateProgressUI(); showSyncToast('✅ 最新盤點進度已同步', true); } } catch(e){}
    }
    if(document.getElementById('moveExecuteTab').classList.contains('active') && currentMvEventId) {
        if (typeof silentMvSync === 'function') silentMvSync();
    }
}, 60000);

document.addEventListener("visibilitychange", async () => {
    if (document.hidden) {
        if (scanner && document.getElementById('step2').style.display === 'block') { await stopScannerSafe(scanner); scanner = null; document.getElementById('step2').style.display = 'none'; document.getElementById('step1').style.display = 'block'; if (typeof checkSavedSession === 'function') checkSavedSession(); }
        if (queryScanner) { await stopScannerSafe(queryScanner); queryScanner = null; document.getElementById('query-reader-container').style.display = 'none'; document.getElementById('btnStartQueryCam').style.display = 'block'; }
        if (locScanner) { if (typeof stopLocScanner === 'function') await stopLocScanner(); }
    }
});

async function triggerBackgroundSync() {
    if (isSyncing || syncQueue.length === 0) return; 
    isSyncing = true; document.getElementById('syncStatus').style.display = 'block';
    
    while (syncQueue.length > 0) { 
        let currentMsg = syncQueue[0]; 
        try { 
            await callAPI('submitScan', { qrStr: currentMsg, mode: sysState.mode, locations: sysState.locations }); 
            syncQueue.shift(); 
            saveSyncQueue();
        } catch(e) { 
            let errStr = e.message.toLowerCase(); 
            if(errStr.includes('fetch') || errStr.includes('network') || errStr.includes('internet') || errStr.includes('failed to fetch')) { 
                break; 
            } else { 
                console.error("背景同步失敗 (非網路問題，放棄該筆):", e);
                syncQueue.shift(); 
                saveSyncQueue();
            } 
        } 
    }
    isSyncing = false; document.getElementById('syncStatus').style.display = 'none';
}
