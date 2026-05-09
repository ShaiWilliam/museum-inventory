// ================= 💡 查詢模組 =================
function triggerManualQuery() { const val = document.getElementById('queryManualInput').value; if(!val) return alert("請輸入編號"); execQuery(val); }

async function execQuery(rawStr) {
    let cleanId = rawStr.includes('?id=') ? new URL(rawStr).searchParams.get('id') : rawStr.trim().split('\n')[0];
    if(queryScanner) { await stopScannerSafe(queryScanner); queryScanner = null; document.getElementById('query-reader-container').style.display = 'none'; }
    const res = globalCatalog[cleanId];
    if(res) {
        renderQueryUI(res);
        fetchFreshQueryData(cleanId);
    } else {
        showMiniLoading('🔍 查詢雲端最新狀態中...');
        try { const freshRes = await callAPI('queryItem', { qrStr: cleanId }); globalCatalog[cleanId] = freshRes; renderQueryUI(freshRes); } catch(e) { alert(e.message); document.getElementById('btnStartQueryCam').style.display = 'block'; } finally { hideMiniLoading(); }
    }
}

async function fetchFreshQueryData(cleanId) {
    const badge = document.getElementById('qResBadge');
    const locText = document.getElementById('qResLoc');
    badge.innerHTML = '☁️ 雲端同步核對中...';
    badge.classList.remove('bg-success', 'bg-danger');
    badge.classList.add('bg-secondary');
    try {
        const freshRes = await callAPI('queryItem', { qrStr: cleanId });
        globalCatalog[cleanId] = freshRes;
        if(locText.innerText !== freshRes.location && freshRes.location) {
            locText.innerHTML = `<span class="text-danger fade-in-section">📍 ${escapeHTML(freshRes.location)} (最新)</span>`;
            playSound('success');
        } else {
            locText.innerText = freshRes.location || "無地點資料";
        }
        if(freshRes.isScanned) { badge.className = "badge bg-success position-absolute shadow-sm"; badge.innerHTML = `✅ 已盤點 (${freshRes.lastScanStr})`; } else { badge.className = "badge bg-danger position-absolute shadow-sm"; badge.innerHTML = `⚠️ ${freshRes.lastScanStr}`; }
    } catch(e) {
        badge.className = "badge bg-warning text-dark position-absolute shadow-sm";
        badge.innerHTML = `⚠️ 離線快取資料`;
    }
}

function renderQueryUI(res) {
    document.getElementById('qResLoc').innerText = res.location || "無地點資料"; document.getElementById('qResName').innerText = res.name || "未知名稱"; document.getElementById('qResPropNum').innerText = res.propNum || "未建檔"; document.getElementById('qResId').innerText = res.id; document.getElementById('qResAccession').innerText = res.accession || "未註明"; document.getElementById('qResJiang').innerText = res.jiang || "未註明"; document.getElementById('qResDesc').innerText = res.desc || "無備註說明";
    const badge = document.getElementById('qResBadge');
    if(res.isScanned) { badge.className = "badge bg-success position-absolute shadow-sm"; badge.innerHTML = `✅ 已盤點 (${res.lastScanStr})`; } else { badge.className = "badge bg-danger position-absolute shadow-sm"; badge.innerHTML = `⚠️ ${res.lastScanStr}`; }
    document.getElementById('btnStartQueryCam').style.display = 'none'; document.getElementById('queryResultBox').style.display = 'block'; playSound('success');
}

function startQueryScanner() {
    document.getElementById('queryResultBox').style.display = 'none'; document.getElementById('btnStartQueryCam').style.display = 'none'; document.getElementById('query-reader-container').style.display = 'block';
    if (!queryScanner) queryScanner = new Html5Qrcode("query-reader");
    if (queryScanner.getState() !== 2) { queryScanner.start({ facingMode: "environment" }, { fps: 10, qrbox: { width: 250, height: 250 } }, msg => execQuery(msg)); }
}

async function stopQueryScannerAndReturn() { showMiniLoading('正在安全關閉相機...'); await stopScannerSafe(queryScanner); queryScanner = null; document.getElementById('query-reader-container').style.display = 'none'; document.getElementById('btnStartQueryCam').style.display = 'block'; hideMiniLoading(); }

// ================= 💡 建檔與列印模組 =================
function triggerRegLoc() { currentModalTarget='regLoc'; document.getElementById('locModalTitle').innerText = "選擇「初始存放地點」"; document.getElementById('modalLocSearch').value = ''; filterModalTree(); renderTreeHTML(globalLocTree, 'modalLocContainer', 'modal', false); bootstrap.Modal.getOrCreateInstance(document.getElementById('locModal')).show(); }

async function submitRegistration() {
    const p = { id: document.getElementById('regId').value, name: document.getElementById('regName').value, loc: document.getElementById('regLoc').value, propNum: document.getElementById('regPropNum').value, accession: document.getElementById('regAccession').value, jiang: document.getElementById('regJiang').value, desc: document.getElementById('regDesc').value };
    if(!p.id || !p.name || !p.loc) return alert("請完整填寫必填欄位 (*)！"); showMiniLoading('寫入資料庫建檔中...');
    try {
        await callAPI('registerItem', p); alert(`✅ 藏品 [${p.id}] 已建檔成功！\nQR Code 已於雲端自動生成。`);
        globalCatalog[p.id] = { id: p.id, name: p.name, location: p.loc, desc: p.desc, lastScanStr: "從未盤點", isScanned: false, accession: p.accession, jiang: p.jiang, propNum: p.propNum };
        if(allPrintItems.length > 0) { allPrintItems.unshift({ id: p.id, name: p.name, loc: p.loc }); filterPrintList(); }
        ['regId', 'regName', 'regLoc', 'regLocDisplay', 'regPropNum', 'regAccession', 'regDesc'].forEach(id => document.getElementById(id).value = ''); document.getElementById('regJiang').value = '不相關';
    } catch(e) { alert("建檔失敗：" + e.message); } finally { hideMiniLoading(); }
}

async function loadPrintList() {
    if(allPrintItems && allPrintItems.length > 0) return;
    const items = Object.values(globalCatalog);
    allPrintItems = items.map(i => ({ id: i.id, name: i.name, loc: i.location })).reverse();
    const locs = [...new Set(allPrintItems.map(i => i.loc))].sort();
    let locHtml = '<option value="">所有地點</option>';
    locs.forEach(l => locHtml += `<option value="${escapeHTML(l)}">${escapeHTML(l)}</option>`);
    document.getElementById('printLocFilter').innerHTML = locHtml;
    filterPrintList();
}

function renderPrintList(items) {
    const container = document.getElementById('printListContainer');
    if(items.length === 0) { container.innerHTML = '<div class="p-3 text-center text-muted">查無紀錄</div>'; return; }
    container.innerHTML = items.map((item, idx) => `
    <div class="print-item p-2 d-flex align-items-center">
        <input class="form-check-input me-2 cb-print" type="checkbox" value="${escapeHTML(item.id)}" data-name="${escapeHTML(item.name)}" data-loc="${escapeHTML(item.loc)}" id="pr_${idx}" ${printCartMap.has(item.id) ? 'checked' : ''} onchange="updateCart(this)">
        <label class="form-check-label flex-grow-1 d-flex flex-column" for="pr_${idx}"><div class="fw-bold text-dark d-flex justify-content-between"><span>${escapeHTML(item.id)}</span><span class="badge bg-secondary" style="font-size:0.7rem;">${escapeHTML(item.loc)}</span></div><div class="small text-muted text-truncate" style="max-width: 250px;">${escapeHTML(item.name)}</div></label>
    </div>`).join('');
    updateCartBtn();
}

function filterPrintList() {
    const term = document.getElementById('printSearch').value.toLowerCase(), locFilter = document.getElementById('printLocFilter').value;
    const filtered = allPrintItems.filter(item => { return (item.id.toLowerCase().includes(term) || item.name.toLowerCase().includes(term)) && (locFilter === "" || item.loc === locFilter); });
    renderPrintList(filtered);
}

function updateCart(cb) { if(cb.checked) { printCartMap.set(cb.value, { name: cb.getAttribute('data-name'), loc: cb.getAttribute('data-loc') }); } else { printCartMap.delete(cb.value); } updateCartBtn(); }
function togglePrintAll(isCheck) { document.querySelectorAll('.cb-print').forEach(cb => { cb.checked = isCheck; updateCart(cb); }); }
function selectTop10Print() { togglePrintAll(false); const cbs = document.querySelectorAll('.cb-print'); for(let i=0; i<Math.min(10, cbs.length); i++) { cbs[i].checked = true; updateCart(cbs[i]); } }
function updateCartBtn() { document.getElementById('btnGoPreview').innerText = `🏷️ 檢視已選標籤 (共 ${printCartMap.size} 件)`; }

function showPrintPreview() {
    if(printCartMap.size === 0) return alert("請先勾選要列印的標籤！");
    document.getElementById('printSelectSec').style.display = 'none'; document.getElementById('printPreviewSec').style.display = 'block'; let html = '';
    printCartMap.forEach((data, id) => { html += `<div class="print-item p-2 d-flex align-items-center justify-content-between"><div class="d-flex flex-column" style="max-width: 80%;"><span class="fw-bold text-dark text-break">${escapeHTML(id)}</span><span class="small text-muted text-truncate">${escapeHTML(data.name)}</span><span class="badge bg-light text-secondary border mt-1 align-self-start" style="font-size:0.75rem;">📍 ${escapeHTML(data.loc)}</span></div><button class="btn btn-sm btn-outline-danger" onclick="removeFromCart('${escapeHTML(id)}')">❌ 移除</button></div>`; });
    document.getElementById('printPreviewContainer').innerHTML = html;
}

function removeFromCart(id) { printCartMap.delete(id); showPrintPreview(); filterPrintList(); if(printCartMap.size === 0) hidePrintPreview(); }
function hidePrintPreview() { document.getElementById('printSelectSec').style.display = 'block'; document.getElementById('printPreviewSec').style.display = 'none'; }

function generatePrintPage() {
    if(printCartMap.size === 0) return alert("請至少選擇一筆項目！");
    showMiniLoading("生成本機高品質 QR Code 中...");
    setTimeout(() => {
        try {
            const groups = {};
            printCartMap.forEach((data, id) => { const loc = data.loc || '未分類地點'; if (!groups[loc]) groups[loc] = []; groups[loc].push({ id: id, name: data.name }); });
            let printHtml = `<div class="preview-paper"><div class="grid-container" style="gap:2px; justify-content:flex-start;">`;
            for(let loc of Object.keys(groups).sort()) {
                printHtml += `<div class="label-box title-label" style="background: white;"><div style="font-size:10pt; font-weight:bold; margin-bottom:5px;">📍 典藏地點</div><div style="font-size:11pt; font-weight:bold; color:#198754; line-height:1.2;">${escapeHTML(loc)}</div><div style="font-size:8pt; margin-top:5px; color:#555;">共 ${groups[loc].length} 張</div></div>`;
                for(let item of groups[loc]) {
                    const urlStr = `https://shaiwilliam.github.io/museum-inventory/?id=${encodeURIComponent(item.id)}`;
                    const qr = new QRious({ value: urlStr, size: 150, level: 'M' });
                    const base64Img = qr.toDataURL('image/png');
                    printHtml += `<div class="label-box" style="background: white;"><img src="${base64Img}" class="qr-img" alt="QR"><div class="id-text">${escapeHTML(item.id)}</div><div class="name-text">${escapeHTML(item.name)}</div></div>`;
                }
            }
            printHtml += `</div></div>`;
            document.getElementById('printOverlayContent').innerHTML = printHtml;
            document.getElementById('printOverlay').style.display = 'flex';
            hideMiniLoading();
        } catch(e) { hideMiniLoading(); alert("產生列印畫面時發生錯誤：" + e.message); }
    }, 50);
}

function closePrintOverlay() { document.getElementById('printOverlay').style.display = 'none'; document.getElementById('printOverlayContent').innerHTML = ''; }
function closePrintReport() { document.getElementById('printReportOverlay').style.display = 'none'; document.getElementById('printReportContent').innerHTML = ''; }

// ================= 💡 盤點模組 =================
function toggleLocBox() { document.getElementById('locBox').style.display = document.getElementById('modePartial').checked ? 'block' : 'none'; }
function checkSavedSession() { try { if(localStorage.getItem('invSession')) { document.getElementById('continueInvBox').style.display = 'block'; document.getElementById('invSettingsArea').style.display = 'none'; } else { document.getElementById('continueInvBox').style.display = 'none'; document.getElementById('invSettingsArea').style.display = 'block'; } } catch(e) { document.getElementById('continueInvBox').style.display = 'none'; document.getElementById('invSettingsArea').style.display = 'block'; } }

async function startInventorySession() {
    sysState.mode = document.getElementById('modeAll').checked ? 'all' : 'partial'; sysState.locations = Array.from(document.querySelectorAll('.leaf-cb:checked')).map(cb => cb.value);
    if(sysState.mode === 'partial' && sysState.locations.length === 0) return alert('請先選擇地點！');
    try { localStorage.setItem('invSession', JSON.stringify({mode: sysState.mode, locations: sysState.locations})); } catch(e) {} await executeInventoryStart();
}

async function resumeInventorySession() { try { const saved = JSON.parse(localStorage.getItem('invSession')); if(!saved) return; sysState.mode = saved.mode; sysState.locations = saved.locations; } catch(e) {} await executeInventoryStart(); }
function clearInventorySession() { try { localStorage.removeItem('invSession'); } catch(e) {} document.getElementById('continueInvBox').style.display = 'none'; document.getElementById('invSettingsArea').style.display = 'block'; }

async function executeInventoryStart() {
    showMiniLoading('下載名單，準備極速盤點...');
    try {
        const res = await callAPI('startInventory', sysState); sysState.total = res.total; sysState.scanned = res.scanned; localItemCache = res.itemMap || {}; updateProgressUI();
        document.getElementById('step1').style.display = 'none'; document.getElementById('step2').style.display = 'block'; hideMiniLoading();
        if (!scanner) scanner = new Html5Qrcode("reader");
        if (scanner.getState() !== 2) { scanner.start({ facingMode: "environment" }, { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 }, msg => processScanLocal(msg)); }
    } catch (e) { hideMiniLoading(); alert("錯誤：" + e.message); }
}

function updateProgressUI() { document.getElementById('valTotal').innerText = sysState.total; document.getElementById('valScanned').innerText = sysState.scanned; document.getElementById('valUnscanned').innerText = Math.max(0, sysState.total - sysState.scanned); document.getElementById('progressBar').style.width = (sysState.total === 0 ? 0 : Math.round((sysState.scanned / sysState.total) * 100)) + '%'; }

async function processScanLocal(msg) {
    if (isProc || Date.now() - lastScan < 800) return; isProc = true; lastScan = Date.now();
    let cleanMsg = msg.includes('?id=') ? new URL(msg).searchParams.get('id') : msg.trim().split('\n')[0]; const item = localItemCache[cleanMsg]; const overlay = document.getElementById('resultOverlay'); overlay.style.display = 'block';
    
    if (!item) { playSound('error'); overlay.style.borderColor = '#dc3545'; document.getElementById('resStatus').innerHTML = '<span class="text-danger">❌ 不在盤點範圍</span>'; document.getElementById('resName').innerText = cleanMsg; document.getElementById('resDesc').innerText = "請確認是否錯置或尚未建檔"; }
    else if (item.isScanned) { playSound('error'); overlay.style.borderColor = '#ffc107'; document.getElementById('resStatus').innerHTML = '<span class="text-warning">⚠️ 已盤點過</span>'; document.getElementById('resName').innerText = item.name; document.getElementById('resDesc').innerText = "此文物稍早已經完成盤點"; }
    else { playSound('success'); item.isScanned = true; sysState.scanned++; updateProgressUI(); overlay.style.borderColor = '#198754'; document.getElementById('resStatus').innerHTML = '<span class="text-success">✅ 盤點成功</span>'; document.getElementById('resName').innerText = item.name; document.getElementById('resDesc').innerText = item.desc || "";
        syncQueue.push(cleanMsg);
        saveSyncQueue();
        triggerBackgroundSync();
    }
    setTimeout(() => { overlay.style.display = 'none'; isProc = false; }, 1200);
}

async function pauseAndSave() { showMiniLoading('正在安全關閉相機...'); await stopScannerSafe(scanner); scanner = null; document.getElementById('step2').style.display = 'none'; document.getElementById('step1').style.display = 'block'; checkSavedSession(); hideMiniLoading(); }
async function finishInventory() { if(!confirm("確定要結束本次盤點任務，並進入結算匯出畫面嗎？")) return; showMiniLoading('正在安全關閉相機...'); await stopScannerSafe(scanner); scanner = null; document.getElementById('step2').style.display = 'none'; document.getElementById('step3').style.display = 'block'; hideMiniLoading(); }
function clearAndBackToHome() { clearInventorySession(); document.getElementById('step3').style.display = 'none'; document.getElementById('step1').style.display = 'block'; backToHome(); }

function exportReport() {
    const emailInput = document.getElementById('exportEmail').value.trim();
    if (!emailInput) return alert('請填寫 Email！');
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailInput)) { return alert('請輸入有效的 Email 格式！'); }
    showMiniLoading('寄送中...');
    callAPI('exportInventoryReport', { email: emailInput, reportType: document.getElementById('exportType').value, mode: sysState.mode, locations: sysState.locations }).then(()=> {
        alert('報表已寄出！'); hideMiniLoading();
    }).catch(e => { alert("失敗：" + e.message); hideMiniLoading(); });
}

// ================= 💡 異動搬運模組 (專案總覽) =================
let allProjectsList = [];
let currentPdItems = [];

function backToOverviewTab() { document.querySelector('button[data-bs-target="#moveOverviewTab"]').click(); window.scrollTo(0, 0); }

async function loadAllProjects() {
    showMiniLoading('載入專案總覽中...');
    try {
        const res = await callAPI('getAllProjects'); allProjectsList = res || [];
        const projNames = [...new Set(allProjectsList.map(p => p.name))].sort();
        let nameHtml = '<option value="">📁 所有專案名稱</option>';
        projNames.forEach(n => nameHtml += `<option value="${escapeHTML(n)}">${escapeHTML(n)}</option>`);
        document.getElementById('projectSelectFilter').innerHTML = nameHtml;
        filterProjectCards();
    } catch(e) { alert("載入專案失敗：" + e.message); } finally { hideMiniLoading(); }
}

function filterProjectCards() {
    const nameFilter = document.getElementById('projectSelectFilter').value, statusFilter = document.getElementById('projectStatusFilter').value;
    const container = document.getElementById('projectCardsContainer');
    const filtered = allProjectsList.filter(p => { return (nameFilter === "" || p.name === nameFilter) && (statusFilter === "" || p.status === statusFilter); });
    
    if(filtered.length === 0) { container.innerHTML = '<div class="col-12 text-center text-muted py-4">查無符合條件的專案</div>'; return; }
    
    container.innerHTML = filtered.map(p => {
        let badgeClass = p.status === '進行中' ? 'bg-primary' : (p.status === '已結案' ? 'bg-secondary' : 'bg-warning text-dark');
        let progressPct = p.total > 0 ? Math.round((p.moved / p.total) * 100) : 0;
        let actionBtns = p.status === '進行中' ? `<button class="btn btn-sm btn-outline-info fw-bold w-100 mb-2" onclick="editProjectFromOverview('${escapeHTML(p.id)}')">📝 編輯專案清單</button><button class="btn btn-sm btn-outline-success fw-bold w-100" onclick="executeProjectFromOverview('${escapeHTML(p.id)}')">🚚 執行搬運</button>` : `<button class="btn btn-sm btn-outline-dark fw-bold w-100" onclick="printProjectFromOverview('${escapeHTML(p.id)}', '${escapeHTML(p.name)}')">🖨️ 列印清冊</button>`;
        return `
        <div class="col-12 col-md-6">
            <div class="card shadow-sm h-100 border-0 border-start border-4 ${p.status === '進行中' ? 'border-primary' : 'border-secondary'}">
                <div class="card-body p-3">
                    <div class="d-flex justify-content-between align-items-start mb-2"><h6 class="fw-bold text-dark mb-0 text-truncate" style="max-width: 70%;">${escapeHTML(p.name)}</h6><span class="badge ${badgeClass}">${escapeHTML(p.status)}</span></div>
                    <small class="text-muted d-block mb-1" style="font-family: monospace;">${escapeHTML(p.id)}</small><small class="text-secondary d-block mb-3 text-truncate">${escapeHTML(p.desc || '無備註')}</small>
                    <div class="mb-3 bg-light rounded p-2 border"><div class="d-flex justify-content-between small fw-bold text-secondary mb-1"><span>進度</span><span>${p.moved} / ${p.total} 件 (${progressPct}%)</span></div><div class="progress" style="height: 6px;"><div class="progress-bar ${p.status === '進行中' ? 'bg-success' : 'bg-secondary'}" style="width: ${progressPct}%;"></div></div></div>
                    <div class="row g-2"><div class="col-12"><button class="btn btn-sm btn-light border fw-bold w-100 text-primary" onclick="viewProjectDetails('${escapeHTML(p.id)}', '${escapeHTML(p.name)}', '${escapeHTML(p.status)}', '${escapeHTML(p.desc)}')">👁️ 檢視明細</button></div><div class="col-12">${actionBtns}</div></div>
                </div>
            </div>
        </div>`;
    }).join('');
}

async function viewProjectDetails(id, name, status, desc) {
    showMiniLoading('讀取明細中...');
    try {
        const res = await callAPI('getProjectDetails', { eventId: id }); currentPdItems = res;
        document.getElementById('pdId').innerText = id; document.getElementById('pdModalTitle').innerText = name; document.getElementById('pdStatus').innerHTML = `<span class="badge ${status === '進行中' ? 'bg-primary' : 'bg-secondary'}">${escapeHTML(status)}</span>`; document.getElementById('pdDesc').innerText = desc || '無'; document.getElementById('pdSearchKw').value = '';
        let oldLocs = new Set(), newLocs = new Set(), prefixes = new Set();
        res.forEach(item => { if(item.oldLoc) oldLocs.add(item.oldLoc); if(item.newLoc) newLocs.add(item.newLoc); prefixes.add(getPrefix(item.tempCode)); });
        let oldHtml = '<option value="">📍 所有原地點</option>'; Array.from(oldLocs).sort().forEach(l => oldHtml += `<option value="${escapeHTML(l)}">${escapeHTML(l)}</option>`); document.getElementById('pdOldLocFilter').innerHTML = oldHtml;
        let newHtml = '<option value="">📍 所有新地點</option>'; Array.from(newLocs).sort().forEach(l => newHtml += `<option value="${escapeHTML(l)}">${escapeHTML(l)}</option>`); document.getElementById('pdNewLocFilter').innerHTML = newHtml;
        let prefHtml = '<option value="">🏷️ 所有前綴</option>'; Array.from(prefixes).sort().forEach(p => prefHtml += `<option value="${escapeHTML(p)}">${escapeHTML(p)}</option>`); document.getElementById('pdPrefixFilter').innerHTML = prefHtml;
        renderPdTable(); bootstrap.Modal.getOrCreateInstance(document.getElementById('projectDetailsModal')).show();
    } catch(e) { alert("無法讀取明細：" + e.message); } finally { hideMiniLoading(); }
}

function renderPdTable() {
    const kw = document.getElementById('pdSearchKw').value.toLowerCase().trim(), oldLocFilter = document.getElementById('pdOldLocFilter').value, newLocFilter = document.getElementById('pdNewLocFilter').value, prefixFilter = document.getElementById('pdPrefixFilter').value;
    let filtered = currentPdItems.filter(item => { return (!kw || item.id.toLowerCase().includes(kw) || item.name.toLowerCase().includes(kw) || (item.tempCode || '').toLowerCase().includes(kw)) && (!oldLocFilter || item.oldLoc === oldLocFilter) && (!newLocFilter || item.newLoc === newLocFilter) && (!prefixFilter || getPrefix(item.tempCode) === prefixFilter); });
    document.getElementById('pdCount').innerText = filtered.length;
    if(filtered.length === 0) { document.getElementById('pdTableBody').innerHTML = '<tr><td colspan="4" class="text-center text-muted py-4">查無符合條件的資料</td></tr>'; return; }
    document.getElementById('pdTableBody').innerHTML = filtered.map(item => {
        let tcBadge = item.tempCode ? `<br><span class="badge bg-info text-dark mt-1 shadow-sm"><i class="fas fa-tag"></i> ${escapeHTML(item.tempCode)}</span>` : '';
        let destHtml = item.newLoc ? `<span class="text-success fw-bold">${escapeHTML(item.newLoc)}</span>` : `<span class="text-muted">尚未搬運</span>`;
        if(item.boxName) destHtml += `<br><small class="text-secondary border p-1 rounded mt-1 d-inline-block bg-white shadow-sm">📦 ${escapeHTML(item.boxName)}</small>`;
        let displayId = item.id.replace(/\n/g, ' ');
        return `<tr><td class="fw-bold text-start" style="font-size: 0.85rem;">${escapeHTML(displayId)}${tcBadge}</td><td class="text-start small">${escapeHTML(item.name)}</td><td class="small text-muted">${escapeHTML(item.oldLoc)}</td><td class="small">${destHtml}</td></tr>`;
    }).join('');
}

function editProjectFromOverview(eventId) { document.querySelector('button[data-bs-target="#moveCreateTab"]').click(); document.getElementById('newMvActionSelect').value = eventId; switchMoveProjectAction(); }
function executeProjectFromOverview(eventId) { document.querySelector('button[data-bs-target="#moveExecuteTab"]').click(); document.getElementById('mvEvent').value = eventId; loadWorkerLocations(); }

async function printProjectFromOverview(eventId, eventName) {
    showMiniLoading('產生清冊中...');
    try {
        const res = await callAPI('getProjectDetails', { eventId: eventId });
        if(res.length === 0) return alert("專案無資料！");
        let html = `<div class="preview-paper"><h3 class="text-center fw-bold mb-4">典藏庫房 搬運清冊</h3><div class="d-flex justify-content-between mb-3 border-bottom pb-2"><span><strong>專案名稱：</strong> ${escapeHTML(eventName)}</span><span><strong>列印時間：</strong> ${new Date().toLocaleString('zh-TW')}</span></div><table class="table table-bordered table-sm" style="font-size: 10pt;"><thead class="table-light"><tr><th width="5%">項次</th><th width="20%">文物/雜物編號</th><th width="25%">名稱</th><th width="20%">原典藏地點</th><th width="20%">移往暫存地點 (箱號)</th><th width="10%">核對簽章</th></tr></thead><tbody>`;
        res.forEach((item, idx) => {
            let dest = item.newLoc ? escapeHTML(item.newLoc) : "未搬運"; if(item.boxName) dest += `<br><small>(${escapeHTML(item.boxName)})</small>`;
            let tcLabel = item.tempCode ? `<br><span class="badge border border-dark text-dark mt-1" style="font-size:9pt;"><i class="fas fa-tag"></i> ${escapeHTML(item.tempCode)}</span>` : '';
            let displayId = item.id.replace(/\n/g, ' ');
            html += `<tr><td class="text-center align-middle">${idx + 1}</td><td class="align-middle">${escapeHTML(displayId)} ${tcLabel}</td><td class="align-middle">${escapeHTML(item.name)}</td><td class="align-middle">${escapeHTML(item.oldLoc)}</td><td class="align-middle">${dest}</td><td></td></tr>`;
        });
        html += `</tbody></table><div class="mt-5 d-flex justify-content-between px-5"><div class="text-center"><div><strong>點交人簽章</strong></div><div style="border-bottom: 1px solid #000; width: 150px; margin-top: 40px;"></div></div><div class="text-center"><div><strong>搬運負責人簽章</strong></div><div style="border-bottom: 1px solid #000; width: 150px; margin-top: 40px;"></div></div><div class="text-center"><div><strong>管理員審核簽章</strong></div><div style="border-bottom: 1px solid #000; width: 150px; margin-top: 40px;"></div></div></div></div>`;
        document.getElementById('printReportContent').innerHTML = html; document.getElementById('printReportOverlay').style.display = 'flex';
    } catch(e) { alert("無法產生清冊：" + e.message); } finally { hideMiniLoading(); }
}

// ================= 💡 異動搬運模組 (專案管理) =================
function saveMvDraft() {
    const action = document.getElementById('newMvActionSelect').value; if(action !== 'NEW') return;
    const draft = { name: document.getElementById('newMvName').value, desc: document.getElementById('newMvDesc').value, cart: Array.from(newMvCart.entries()) };
    localStorage.setItem('mvProjectDraft', JSON.stringify(draft));
}

function clearMvDraft() { localStorage.removeItem('mvProjectDraft'); }

function checkMvDraft() {
    const draftStr = localStorage.getItem('mvProjectDraft');
    if(draftStr) {
        try {
            const draft = JSON.parse(draftStr);
            if((draft.cart && draft.cart.length > 0) || draft.name) {
                if(confirm('💡 系統偵測到您有尚未儲存的「建立專案草稿」，是否恢復？\n\n(按「確定」恢復進度，按「取消」捨棄草稿)')) {
                    document.getElementById('newMvName').value = draft.name || ''; document.getElementById('newMvDesc').value = draft.desc || '';
                    newMvCart = new Map(draft.cart); document.getElementById('newMvSelectedCount').innerText = newMvCart.size;
                    newMvCart.forEach((val, id) => { if(val.isMisc && !allMvItems.find(x => x.id === id)) { allMvItems.unshift({ id: id, name: val.name, loc: val.loc, isMisc: true, tempCode: val.tempCode }); } }); filterNewMvList();
                } else { clearMvDraft(); }
            }
        } catch(e) { clearMvDraft(); }
    }
}

function loadNewMvList() {
    if(allMvItems && allMvItems.length > 0) return;
    const items = Object.values(globalCatalog); allMvItems = items.map(i => ({ id: i.id, name: i.name, loc: i.location })).reverse();
    const locs = [...new Set(allMvItems.map(i => i.loc))].sort(); let locHtml = '<option value="">所有地點</option>'; locs.forEach(l => locHtml += `<option value="${escapeHTML(l)}">${escapeHTML(l)}</option>`);
    document.getElementById('newMvLocFilter').innerHTML = locHtml;
}

async function switchMoveProjectAction() {
    const val = document.getElementById('newMvActionSelect').value;
    if(val === 'NEW') { document.getElementById('newMvName').value = ''; document.getElementById('newMvDesc').value = ''; clearNewMvSelection(); clearMvDraft(); } 
    else {
        showMiniLoading('讀取專案資料中...');
        try {
            const res = await callAPI('getProjectDataForEdit', { eventId: val }); document.getElementById('newMvName').value = res.name; document.getElementById('newMvDesc').value = res.desc; newMvCart.clear();
            res.items.forEach(item => {
                newMvCart.set(item.id, { name: item.name, loc: item.loc, isMisc: item.id.startsWith('MISC-'), tempCode: item.tempCode });
                let existing = allMvItems.find(x => x.id === item.id);
                if(!existing) { allMvItems.unshift({ id: item.id, name: item.name, loc: item.loc, isMisc: item.id.startsWith('MISC-'), tempCode: item.tempCode }); } else { existing.tempCode = item.tempCode; }
            });
            document.getElementById('newMvSelectedCount').innerText = newMvCart.size; filterNewMvList(); clearMvDraft();
        } catch(e) { alert("讀取失敗: " + e.message); } finally { hideMiniLoading(); }
    }
}

function openMiscModal() { document.getElementById('miscName').value = ''; document.getElementById('miscLocDisplay').value = ''; document.getElementById('miscLoc').value = ''; document.getElementById('miscTempCode').value = ''; bootstrap.Modal.getOrCreateInstance(document.getElementById('miscModal')).show(); }

function triggerMiscLoc() { currentModalTarget='miscLoc'; document.getElementById('locModalTitle').innerText = "選擇「雜物所在地點」"; document.getElementById('modalLocSearch').value = ''; filterModalTree(); renderTreeHTML(globalLocTree, 'modalLocContainer', 'modal', false); bootstrap.Modal.getInstance(document.getElementById('miscModal')).hide(); bootstrap.Modal.getOrCreateInstance(document.getElementById('locModal')).show(); }

document.getElementById('locModal').addEventListener('hidden.bs.modal', function () { if (currentModalTarget === 'miscLoc') { bootstrap.Modal.getOrCreateInstance(document.getElementById('miscModal')).show(); currentModalTarget = ''; } else if (currentModalTarget.startsWith('importMiscLoc_')) { bootstrap.Modal.getOrCreateInstance(document.getElementById('importModal')).show(); currentModalTarget = ''; } });

function addMiscItem() {
    const name = document.getElementById('miscName').value.trim(), loc = document.getElementById('miscLoc').value.trim(), tCode = document.getElementById('miscTempCode').value.trim();
    if(!name || !loc) return alert("請完整填寫名稱與地點！");
    const miscId = "MISC-" + new Date().getTime() + "-" + Math.floor(Math.random()*100);
    allMvItems.unshift({ id: miscId, name: name, loc: loc, isMisc: true, tempCode: tCode }); newMvCart.set(miscId, { name: name, loc: loc, isMisc: true, tempCode: tCode });
    bootstrap.Modal.getInstance(document.getElementById('miscModal')).hide(); document.getElementById('newMvSelectedCount').innerText = newMvCart.size; document.getElementById('newMvSearch').value = name; saveMvDraft(); filterNewMvList(); showSyncToast("✅ 雜物已加入清單", true);
}

function filterNewMvList() {
    const term = document.getElementById('newMvSearch').value.toLowerCase(), locFilter = document.getElementById('newMvLocFilter').value;
    const container = document.getElementById('newMvListContainer');
    const filtered = allMvItems.filter(item => { return (item.id.toLowerCase().includes(term) || item.name.toLowerCase().includes(term)) && (locFilter === "" || item.loc === locFilter); });
    if(filtered.length === 0) { container.innerHTML = '<div class="p-3 text-center text-muted">查無結果</div>'; return; }
    const displayItems = filtered.slice(0, 150);
    let html = displayItems.map((item, idx) => {
        let cartItem = newMvCart.get(item.id); let isChecked = cartItem ? 'checked' : ''; let tcBadge = (cartItem && cartItem.tempCode) ? `<span class="badge bg-info text-dark ms-2 shadow-sm"><i class="fas fa-tag"></i> ${escapeHTML(cartItem.tempCode)}</span>` : '';
        let displayId = item.id.replace(/\n/g, ' ');
        return `<div class="print-item p-2 d-flex align-items-center"><input class="form-check-input me-2 cb-newmv" type="checkbox" value="${escapeHTML(item.id)}" data-name="${escapeHTML(item.name)}" data-loc="${escapeHTML(item.loc)}" id="nmv_${idx}" ${isChecked} onchange="updateNewMvCart(this)"><label class="form-check-label flex-grow-1 d-flex flex-column" for="nmv_${idx}"><div class="fw-bold text-dark d-flex justify-content-between"><span>${item.isMisc ? '📦 ' + escapeHTML(displayId) : escapeHTML(displayId)} ${tcBadge}</span><span class="badge bg-secondary" style="font-size:0.7rem;">${escapeHTML(item.loc)}</span></div><div class="small ${item.isMisc ? 'text-danger' : 'text-muted'} text-truncate" style="max-width: 250px;">${escapeHTML(item.name)}</div></label></div>`;
    }).join('');
    if(filtered.length > 150) { html += `<div class="text-center text-muted small mt-2">僅顯示前 150 筆，請利用搜尋縮小範圍</div>`; }
    container.innerHTML = html;
}

function updateNewMvCart(cb) { if(cb.checked) { let existingItem = newMvCart.get(cb.value); let tc = existingItem ? existingItem.tempCode : null; newMvCart.set(cb.value, { name: cb.getAttribute('data-name'), loc: cb.getAttribute('data-loc'), tempCode: tc }); } else { newMvCart.delete(cb.value); } saveMvDraft(); document.getElementById('newMvSelectedCount').innerText = newMvCart.size; }

function toggleNewMvAll(isCheck) { document.querySelectorAll('.cb-newmv').forEach(cb => { cb.checked = isCheck; updateNewMvCart(cb); }); filterNewMvList(); }

function clearNewMvSelection(requireConfirm = false, modalId = null) {
    if (requireConfirm) { if (newMvCart.size === 0) return; if (!confirm("確定要清空目前已選擇的待搬運文物嗎？這將會清除您的勾選清單與臨時編碼！")) return; }
    newMvCart.clear(); saveMvDraft(); document.getElementById('newMvSelectedCount').innerText = 0; filterNewMvList();
    if (modalId) { let m = bootstrap.Modal.getInstance(document.getElementById(modalId)); if (m) m.hide(); }
}

function getPrefix(tc) { if (!tc) return "未編碼"; const match = tc.match(/^([A-Za-z\-_]+)/); return match ? match[1].toUpperCase() : "無英文前綴"; }

function refreshCartPrefixDropdown(targetPrefix) {
    let prefixes = new Set(); newMvCart.forEach((val) => prefixes.add(getPrefix(val.tempCode)));
    let currentFilter = document.getElementById('cartPrefixFilter').value, selectHtml = '<option value="">所有前綴</option>';
    Array.from(prefixes).sort().forEach(p => { selectHtml += `<option value="${escapeHTML(p)}">${escapeHTML(p)}</option>`; });
    document.getElementById('cartPrefixFilter').innerHTML = selectHtml;
    if (targetPrefix !== undefined && prefixes.has(targetPrefix)) { document.getElementById('cartPrefixFilter').value = targetPrefix; } else if (currentFilter && prefixes.has(currentFilter)) { document.getElementById('cartPrefixFilter').value = currentFilter; } else { document.getElementById('cartPrefixFilter').value = ''; }
}

function openCartModal() { refreshCartPrefixDropdown(); document.getElementById('cartSearchKw').value = ''; const bsCollapse = bootstrap.Collapse.getInstance(document.getElementById('cartBatchEditArea')); if(bsCollapse) bsCollapse.hide(); filterCartList(); bootstrap.Modal.getOrCreateInstance(document.getElementById('cartModal')).show(); }

function filterCartList() {
    const kw = document.getElementById('cartSearchKw').value.toLowerCase().trim(), prefixFilter = document.getElementById('cartPrefixFilter').value; let html = '', count = 0;
    newMvCart.forEach((val, id) => {
        let isMisc = val.isMisc, tc = val.tempCode || '', itemPrefix = getPrefix(tc);
        if (prefixFilter && itemPrefix !== prefixFilter) return;
        if (kw && !(id.toLowerCase().includes(kw) || val.name.toLowerCase().includes(kw) || tc.toLowerCase().includes(kw))) return;
        let displayId = id.replace(/\n/g, ' ');
        html += `<div class="d-flex align-items-center p-2 border-bottom"><div class="me-2"><input class="form-check-input cart-item-cb" type="checkbox" value="${escapeHTML(id)}"></div><div style="width: 45%;"><div class="fw-bold ${isMisc ? 'text-danger' : 'text-dark'}">${isMisc ? '📦 '+escapeHTML(displayId) : escapeHTML(displayId)}</div><div class="small text-muted text-truncate" style="max-width: 150px;">${escapeHTML(val.name)}</div></div><div style="width: 30%;" class="px-1"><input type="text" class="form-control form-control-sm border-info" placeholder="臨時編碼" value="${escapeHTML(tc)}" onchange="updateCartItemTc('${escapeHTML(id)}', this.value)"></div><div style="width: 15%; text-align: right;"><button class="btn btn-sm btn-outline-danger" onclick="removeCartItem('${escapeHTML(id)}')">❌</button></div></div>`;
        count++;
    });
    if (count === 0) { html = '<div class="text-center text-muted p-4">查無符合條件的項目</div>'; }
    document.getElementById('cartItemList').innerHTML = html; document.getElementById('cartCountText').innerText = count + ' / ' + newMvCart.size;
}

function toggleCartAll(state) { document.querySelectorAll('.cart-item-cb').forEach(cb => cb.checked = state); }

function batchRemoveCartItems() {
    const cbs = document.querySelectorAll('.cart-item-cb:checked'); if(cbs.length === 0) return alert('請先勾選要移除的項目！'); if(!confirm(`確定要移除這 ${cbs.length} 個項目嗎？`)) return;
    cbs.forEach(cb => newMvCart.delete(cb.value)); saveMvDraft(); filterNewMvList(); refreshCartPrefixDropdown(); filterCartList(); document.getElementById('newMvSelectedCount').innerText = newMvCart.size;
}

function applyCartBatchEdit() {
    const cbs = document.querySelectorAll('.cart-item-cb:checked'); if(cbs.length === 0) return alert('請先勾選要修改編碼的項目！');
    let prefix = document.getElementById('cartBatchPrefix').value.trim(), startNum = parseInt(document.getElementById('cartBatchStart').value.trim()); if(isNaN(startNum)) startNum = 1; let currentNum = startNum;
    cbs.forEach(cb => { let id = cb.value, item = newMvCart.get(id); if(item) { item.tempCode = prefix + currentNum; newMvCart.set(id, item); let inAllList = allMvItems.find(x => x.id === id); if(inAllList) inAllList.tempCode = item.tempCode; currentNum++; } });
    saveMvDraft(); filterNewMvList(); let targetPrefix = getPrefix(prefix + "1"); refreshCartPrefixDropdown(targetPrefix); filterCartList(); showSyncToast("✅ 批次修改已套用", true);
    const bsCollapse = bootstrap.Collapse.getInstance(document.getElementById('cartBatchEditArea')); if(bsCollapse) bsCollapse.hide();
}

function updateCartItemTc(id, val) { let item = newMvCart.get(id); if(item) { item.tempCode = val; newMvCart.set(id, item); let inAllList = allMvItems.find(x => x.id === id); if(inAllList) inAllList.tempCode = val; saveMvDraft(); filterNewMvList(); refreshCartPrefixDropdown(); } }
function removeCartItem(id) { newMvCart.delete(id); saveMvDraft(); filterNewMvList(); refreshCartPrefixDropdown(); filterCartList(); document.getElementById('newMvSelectedCount').innerText = newMvCart.size; }

function openTempCodeModal() {
    if(newMvCart.size === 0) return alert("請先挑選文物加入清單！");
    let html = '', idx = 0;
    newMvCart.forEach((val, id) => {
        let tcBadge = val.tempCode ? `<span class="badge bg-info text-dark ms-2"><i class="fas fa-tag"></i> ${escapeHTML(val.tempCode)}</span>` : ''; let displayId = id.replace(/\n/g, ' ');
        html += `<div class="form-check mb-2 pb-2 border-bottom"><input class="form-check-input tc-item-cb" type="checkbox" value="${escapeHTML(id)}" id="tc_${idx}" data-has-tc="${val.tempCode ? 'true' : 'false'}"><label class="form-check-label w-100 fs-6" for="tc_${idx}"><span class="fw-bold text-dark">${escapeHTML(displayId)}</span> ${tcBadge}<br><small class="text-muted">${escapeHTML(val.name)}</small></label></div>`; idx++;
    });
    document.getElementById('tcItemList').innerHTML = html; document.getElementById('tcPrefix').value = ''; document.getElementById('tcStartNum').value = '1'; bootstrap.Modal.getOrCreateInstance(document.getElementById('tempCodeModal')).show();
}

function toggleTcAll(state) { document.querySelectorAll('.tc-item-cb').forEach(cb => cb.checked = state); }
function toggleTcUncoded() { document.querySelectorAll('.tc-item-cb').forEach(cb => { cb.checked = (cb.getAttribute('data-has-tc') === 'false'); }); }

function applyTempCodes() {
    let prefix = document.getElementById('tcPrefix').value.trim(), startNum = parseInt(document.getElementById('tcStartNum').value.trim()); if(isNaN(startNum)) startNum = 1; let cbs = document.querySelectorAll('.tc-item-cb:checked'); if(cbs.length === 0) return alert("請勾選要配發臨時編碼的項目！");
    let currentNum = startNum;
    cbs.forEach(cb => { let id = cb.value, item = newMvCart.get(id); if(item) { item.tempCode = prefix + currentNum; newMvCart.set(id, item); let inAllList = allMvItems.find(x => x.id === id); if(inAllList) inAllList.tempCode = item.tempCode; currentNum++; } });
    saveMvDraft(); bootstrap.Modal.getInstance(document.getElementById('tempCodeModal')).hide(); filterNewMvList(); showSyncToast("✅ 臨時編碼已成功套用，請記得點擊儲存專案！", true);
}

function openImportModal() { document.getElementById('importTextarea').value = ''; document.getElementById('importPreviewSection').style.display = 'none'; parsedImportItems = []; bootstrap.Modal.getOrCreateInstance(document.getElementById('importModal')).show(); }

function parseImportData() {
    const raw = document.getElementById('importTextarea').value.trim(); if(!raw) return alert("請先貼上資料！"); parsedImportItems = []; const lines = raw.split('\n');
    lines.forEach(line => {
        if(!line.trim()) return; let cols = line.includes('\t') ? line.split('\t') : line.split(','); cols = cols.map(c => c.trim()); if (cols.length === 0) return;
        let parsedTempCode = '', parsedId = '', parsedName = '';
        if (cols.length === 1) { parsedId = cols[0]; } else { parsedTempCode = cols[0]; parsedId = cols[1]; parsedName = cols.length > 2 ? cols[2] : ''; }
        if (!parsedId) return;
        let existingBase = allMvItems.find(x => x.id === parsedId || x.id.split('\n')[0] === parsedId), finalId = parsedId, partDesc = [];
        if (parsedTempCode) partDesc.push(parsedTempCode); if (parsedName && (!existingBase || parsedName !== existingBase.name)) partDesc.push(parsedName);
        if (partDesc.length > 0) { finalId = parsedId + "\n[" + partDesc.join(' - ') + "]"; }
        let inCart = newMvCart.has(finalId), status = 'match', loc = '未知', oldTc = '';
        if (existingBase) { parsedName = parsedName || existingBase.name; loc = existingBase.loc; if (inCart) { let cartItem = newMvCart.get(finalId); oldTc = cartItem.tempCode || ''; if (parsedTempCode && oldTc && oldTc !== parsedTempCode) { status = 'conflict'; } else { status = 'duplicate'; } } } else { status = 'unmatched'; }
        parsedImportItems.push({ originalId: parsedId, finalId: finalId, name: parsedName || '未知名稱', loc: loc, tempCode: parsedTempCode, oldTc: oldTc, status: status, isMisc: false });
    });
    renderImportPreview(); document.getElementById('importPreviewSection').style.display = 'block';
}

function triggerImportMiscLoc(id) { currentModalTarget = 'importMiscLoc_' + id; document.getElementById('locModalTitle').innerText = "選擇「雜物所在地點」"; document.getElementById('modalLocSearch').value = ''; filterModalTree(); renderTreeHTML(globalLocTree, 'modalLocContainer', 'modal', false); bootstrap.Modal.getInstance(document.getElementById('importModal')).hide(); bootstrap.Modal.getOrCreateInstance(document.getElementById('locModal')).show(); }

function startImportLocScanner(id) { locScanTarget = 'importMiscLoc_' + id; document.getElementById('locScannerTitle').innerText = "掃描「雜物所在地點」條碼"; document.getElementById('loc-reader-container').style.display = 'flex'; bootstrap.Modal.getInstance(document.getElementById('importModal')).hide(); if (!locScanner) locScanner = new Html5Qrcode("loc-reader"); if (locScanner.getState() !== 2) { locScanner.start({ facingMode: "environment" }, { fps: 10, qrbox: { width: 250, height: 250 } }, msg => handleLocScan(msg)); } }

function renderImportPreview() {
    let html = '', matchCount = 0, unmatchedCount = 0, dupCount = 0;
    parsedImportItems.forEach(item => {
        let statusBadge = '', trClass = '', tcHtml = '', locColumnHtml = escapeHTML(item.loc);
        if (item.status === 'match') { statusBadge = '<span class="badge bg-success">✅ 成功</span>'; matchCount++; if(item.tempCode) tcHtml = `<br><span class="badge bg-info text-dark mt-1"><i class="fas fa-tag"></i> ${escapeHTML(item.tempCode)}</span>`; } else if (item.status === 'duplicate') { statusBadge = '<span class="badge bg-secondary">🔄 已在清單</span>'; trClass = 'table-secondary text-muted'; dupCount++; if(item.tempCode) tcHtml = `<br><span class="badge bg-info text-dark mt-1"><i class="fas fa-tag"></i> ${escapeHTML(item.tempCode)}</span>`; } else if (item.status === 'conflict') { statusBadge = '<span class="badge bg-warning text-dark">⚠️ 編碼衝突</span>'; trClass = 'table-warning'; dupCount++; tcHtml = `<br><small class="text-danger fw-bold">原: [${escapeHTML(item.oldTc)}] ➔ 匯入: [${escapeHTML(item.tempCode)}]</small><br><input type="text" class="form-control form-control-sm mt-1 conflict-tc-input" data-id="${escapeHTML(item.finalId)}" value="${escapeHTML(item.oldTc)}" placeholder="確認編碼">`; } else if (item.status === 'unmatched') { statusBadge = '<span class="badge bg-danger">❌ 查無此物</span>'; trClass = 'table-danger'; unmatchedCount++; } else if (item.status === 'misc') { statusBadge = '<span class="badge bg-warning text-dark">📦 轉為雜物</span>'; trClass = 'table-warning'; matchCount++; if(item.tempCode) tcHtml = `<br><span class="badge bg-info text-dark mt-1"><i class="fas fa-tag"></i> ${escapeHTML(item.tempCode)}</span>`; locColumnHtml = `<div class="input-group input-group-sm"><input type="text" class="form-control bg-white text-danger fw-bold" readonly placeholder="點選或掃描..." value="${escapeHTML(item.loc)}" onclick="triggerImportMiscLoc('${escapeHTML(item.finalId)}')"><button class="btn btn-outline-danger" type="button" onclick="startImportLocScanner('${escapeHTML(item.finalId)}')"><i class="fas fa-qrcode"></i></button></div>`; }
        let displayId = item.finalId.replace(/\n/g, ' '); html += `<tr class="${trClass}"><td>${statusBadge}</td><td class="fw-bold text-start">${escapeHTML(displayId)}${tcHtml}</td><td class="text-start">${escapeHTML(item.name)}</td><td class="align-middle" style="min-width: 140px;">${locColumnHtml}</td></tr>`;
    });
    document.getElementById('importPreviewTableBody').innerHTML = html || '<tr><td colspan="4" class="text-center">無有效資料</td></tr>'; document.getElementById('importStats').innerHTML = `共 ${parsedImportItems.length} 筆資料 (✅ 可匯入: ${matchCount} | ❌ 未知: ${unmatchedCount} | 🔄 重複/衝突: ${dupCount})`;
    const btnMisc = document.getElementById('btnConvertMisc'), warnMsg = document.getElementById('importWarningMsg');
    if (unmatchedCount > 0) { btnMisc.style.display = 'inline-block'; warnMsg.style.display = 'block'; } else { btnMisc.style.display = 'none'; warnMsg.style.display = 'none'; }
    let hasMissingLoc = parsedImportItems.some(i => i.status === 'misc' && !i.loc); document.getElementById('btnConfirmImport').disabled = (matchCount === 0 && document.querySelectorAll('.conflict-tc-input').length === 0) || hasMissingLoc;
}

function convertUnmatchedToMisc() { parsedImportItems.forEach(item => { if (item.status === 'unmatched') { item.status = 'misc'; item.isMisc = true; item.finalId = "MISC-" + new Date().getTime() + "-" + Math.floor(Math.random()*10000); item.loc = ''; } }); renderImportPreview(); }

function confirmImport() {
    let importCount = 0, missingLoc = false; parsedImportItems.forEach(item => { if (item.status === 'misc' && !item.loc) missingLoc = true; }); if (missingLoc) { return alert("請為所有轉換的雜物選擇或掃描「所在地點」！"); }
    document.querySelectorAll('.conflict-tc-input').forEach(input => { let id = input.getAttribute('data-id'), item = parsedImportItems.find(x => x.finalId === id); if(item) { item.tempCode = input.value; item.status = 'match'; } });
    parsedImportItems.forEach(item => { if (item.status === 'match' || item.status === 'misc') { if (item.isMisc && !allMvItems.find(x => x.id === item.finalId)) { allMvItems.unshift({ id: item.finalId, name: item.name, loc: item.loc, isMisc: true, tempCode: item.tempCode }); } newMvCart.set(item.finalId, { name: item.name, loc: item.loc, isMisc: item.isMisc, tempCode: item.tempCode }); if (!item.isMisc) { let existing = allMvItems.find(x => x.id === item.finalId); if(!existing) { allMvItems.unshift({ id: item.finalId, name: item.name, loc: item.loc, isMisc: false, tempCode: item.tempCode }); } else { existing.tempCode = item.tempCode; } } importCount++; } });
    saveMvDraft(); bootstrap.Modal.getInstance(document.getElementById('importModal')).hide(); document.getElementById('newMvSelectedCount').innerText = newMvCart.size; filterNewMvList(); showSyncToast(`✅ 成功匯入/更新 ${importCount} 筆項目！`, true);
}

function parseOverrideData() {
    const raw = document.getElementById('importOverrideTextarea').value.trim(); if(!raw) return alert("請先貼上資料！"); const lines = raw.split('\n'); let payload = [];
    lines.forEach(line => { if(!line.trim()) return; let cols = line.includes('\t') ? line.split('\t') : line.split(','); cols = cols.map(c => c.trim()); if (cols.length >= 2 && cols[0]) { payload.push({ id: cols[0], newLoc: cols[1] }); } });
    if(payload.length === 0) return alert("解析失敗！請確保貼上格式為「編號 + 地點」。"); showMiniLoading("正在比對雲端總表...");
    callAPI('previewLocationOverride', { items: payload }).then(res => { parsedOverrideItems = res.results; renderOverridePreview(); document.getElementById('overridePreviewSection').style.display = 'block'; hideMiniLoading(); }).catch(e => { alert("預覽失敗：" + e.message); hideMiniLoading(); });
}

function renderOverridePreview() {
    let html = '', validCount = 0;
    parsedOverrideItems.forEach(item => {
        let statusBadge = '', trClass = ''; if (item.status === 'ok') { statusBadge = '<span class="badge bg-success">✅ 準備覆寫</span>'; validCount++; } else if (item.status === 'no_change') { statusBadge = '<span class="badge bg-secondary">⏸️ 地點相同</span>'; trClass = 'table-secondary text-muted'; } else { statusBadge = '<span class="badge bg-danger">❌ 查無此物</span>'; trClass = 'table-danger text-muted'; }
        html += `<tr class="${trClass}"><td>${statusBadge}</td><td class="fw-bold text-dark">${escapeHTML(item.id)}</td><td class="small">${escapeHTML(item.oldLoc || '無')}</td><td class="text-danger fw-bold small">${item.status === 'not_found' ? '--' : escapeHTML(item.newLoc)}</td></tr>`;
    });
    document.getElementById('overridePreviewTableBody').innerHTML = html; document.getElementById('overrideStats').innerText = `✅ 可強制校正：${validCount} 筆`; document.getElementById('btnConfirmOverride').disabled = (validCount === 0);
}

function confirmOverride() {
    let validItems = parsedOverrideItems.filter(x => x.status === 'ok'); if(validItems.length === 0) return;
    if (!confirm(`⚠️ 危險操作確認！\n\n系統將直接覆寫總表中這 ${validItems.length} 件文物的地點，此操作無法復原。\n\n確定要強制執行覆寫嗎？`)) { return; }
    showMiniLoading(`正在強制寫入 ${validItems.length} 筆地點資料...`);
    callAPI('executeLocationOverride', { items: validItems }).then(res => { alert(`✅ 成功強制校正了 ${res.count} 筆文物地點！`); document.getElementById('importOverrideTextarea').value = ''; document.getElementById('overridePreviewSection').style.display = 'none'; parsedOverrideItems = []; callAPI('getInventoryInitData').then(invData => { globalCatalog = invData.catalog || {}; }); hideMiniLoading(); }).catch(e => { alert("寫入失敗：" + e.message); hideMiniLoading(); });
}

async function submitNewProject() {
    const action = document.getElementById('newMvActionSelect').value, pName = document.getElementById('newMvName').value.trim(), pDesc = document.getElementById('newMvDesc').value.trim();
    if(!pName) return alert("請輸入專案名稱！"); if(newMvCart.size === 0) return alert("請至少挑選一件待搬運文物！"); showMiniLoading('正在儲存專案與清單資料...');
    let miscDetails = {}, tempCodes = {}; newMvCart.forEach((val, key) => { miscDetails[key] = val; if (val.tempCode) tempCodes[key] = val.tempCode; });
    try { await callAPI('saveMovementProject', { eventId: action, name: pName, desc: pDesc, itemIds: Array.from(newMvCart.keys()), miscDetails: miscDetails, tempCodes: tempCodes, manager: currentManager }); clearMvDraft(); alert('✅ 專案資料儲存成功！'); refreshSystem('move'); } catch (e) { alert("專案儲存失敗：" + e.message); } finally { hideMiniLoading(); }
}

// ================= 💡 異動搬運模組 (執行搬運與雙 QR Code) =================
async function loadWorkerLocations() {
    const eid = document.getElementById('mvEvent').value; currentMvEventId = eid; 
    if (!eid) { document.getElementById('mvLocSelector').style.display = 'none'; document.getElementById('mvProgressBox').style.display = 'none'; document.getElementById('mvPhase2').style.display = 'none'; document.getElementById('mvPhase3').style.display = 'none'; return; }
    showMiniLoading('載入專案資料中...');
    try {
        const res = await callAPI('getProjectPendingData', { eventId: eid }); currentProjectItems = res.items || []; pendingLocTree = res.locTree || []; document.getElementById('mvProgressBox').style.display = 'block';
        let total = res.total || 0, moved = res.moved || 0, pct = total > 0 ? Math.round((moved / total) * 100) : 0;
        document.getElementById('mvProgressText').innerText = `${moved} / ${total} 件 (${pct}%)`; document.getElementById('mvProgressBar').style.width = pct + '%'; document.getElementById('mvLocSelector').style.display = 'block'; document.getElementById('mvLoc').value = ''; document.getElementById('mvLocDisplay').value = ''; document.getElementById('mvPhase2').style.display = 'none'; document.getElementById('mvPhase3').style.display = 'none';
    } catch (e) { alert("載入專案資料失敗：" + e.message); } finally { hideMiniLoading(); }
}

function triggerMvLoc() { currentModalTarget = 'mvLoc'; document.getElementById('locModalTitle').innerText = "選擇「原典藏地點」"; document.getElementById('modalLocSearch').value = ''; filterModalTree(); renderTreeHTML(pendingLocTree, 'modalLocContainer', 'modal', false); bootstrap.Modal.getOrCreateInstance(document.getElementById('locModal')).show(); }
function triggerMvNewLoc() { currentModalTarget = 'mvNewLoc'; document.getElementById('locModalTitle').innerText = "選擇「暫存/新地點」"; document.getElementById('modalLocSearch').value = ''; filterModalTree(); renderTreeHTML(globalLocTree, 'modalLocContainer', 'modal', false); bootstrap.Modal.getOrCreateInstance(document.getElementById('locModal')).show(); }

function selectModalLoc(val) {
    if (!currentModalTarget) return;
    if (currentModalTarget.startsWith('importMiscLoc_')) { let id = currentModalTarget.split('importMiscLoc_')[1]; let item = parsedImportItems.find(x => x.finalId === id); if (item) item.loc = val; renderImportPreview(); bootstrap.Modal.getInstance(document.getElementById('locModal')).hide(); bootstrap.Modal.getOrCreateInstance(document.getElementById('importModal')).show(); } 
    else { document.getElementById(currentModalTarget).value = val; let displayInput = document.getElementById(currentModalTarget + 'Display'); if(displayInput) displayInput.value = val; bootstrap.Modal.getInstance(document.getElementById('locModal')).hide(); if (currentModalTarget === 'mvLoc') { loadWorkerItems(); } else if (currentModalTarget === 'miscLoc') { bootstrap.Modal.getOrCreateInstance(document.getElementById('miscModal')).show(); } } currentModalTarget = '';
}

function startLocScanner(targetId) {
    locScanTarget = targetId; document.getElementById('locScannerTitle').innerText = (targetId === 'mvLoc') ? "掃描「原典藏地點」條碼" : "掃描「暫存地點」條碼"; document.getElementById('loc-reader-container').style.display = 'flex';
    if (targetId.startsWith('importMiscLoc_')) { bootstrap.Modal.getInstance(document.getElementById('importModal')).hide(); }
    if (!locScanner) locScanner = new Html5Qrcode("loc-reader");
    if (locScanner.getState() !== 2) { locScanner.start({ facingMode: "environment" }, { fps: 10, qrbox: { width: 250, height: 250 } }, msg => handleLocScan(msg)); }
}

async function stopLocScanner() { showMiniLoading("關閉相機..."); await stopScannerSafe(locScanner); locScanner = null; document.getElementById('loc-reader-container').style.display = 'none'; if (locScanTarget && locScanTarget.startsWith('importMiscLoc_')) { bootstrap.Modal.getOrCreateInstance(document.getElementById('importModal')).show(); locScanTarget = ''; } hideMiniLoading(); }
async function cancelLocScanner() { showMiniLoading("關閉相機..."); await stopScannerSafe(locScanner); locScanner = null; document.getElementById('loc-reader-container').style.display = 'none'; hideMiniLoading(); if (locScanTarget && locScanTarget.startsWith('importMiscLoc_')) { bootstrap.Modal.getOrCreateInstance(document.getElementById('importModal')).show(); } locScanTarget = ''; }

async function handleLocScan(msg) {
    let target = locScanTarget; locScanTarget = ''; showMiniLoading("關閉相機..."); await stopScannerSafe(locScanner); locScanner = null; document.getElementById('loc-reader-container').style.display = 'none'; hideMiniLoading();
    let cleanMsg = msg.trim();
    if (cleanMsg.startsWith("LOC:")) {
        let locName = cleanMsg.substring(4);
        if (target.startsWith('importMiscLoc_')) { let id = target.split('_')[1]; let item = parsedImportItems.find(x => x.finalId === id); if (item) item.loc = locName; renderImportPreview(); bootstrap.Modal.getOrCreateInstance(document.getElementById('importModal')).show(); } 
        else { document.getElementById(target).value = locName; document.getElementById(target + 'Display').value = locName; if(target === 'mvLoc') { loadWorkerItems(); } } playSound('success');
    } else { alert("錯誤：這不是有效的地點條碼！\n掃描到的內容：" + cleanMsg); playSound('error'); if (target.startsWith('importMiscLoc_')) { bootstrap.Modal.getOrCreateInstance(document.getElementById('importModal')).show(); } }
}

async function loadWorkerItems() {
    const eid = document.getElementById('mvEvent').value, loc = document.getElementById('mvLoc').value; if (!eid || !loc) return;
    const filteredItems = currentProjectItems.filter(x => x.loc === loc); const listDiv = document.getElementById('mvItemList');
    if (filteredItems.length === 0) { listDiv.innerHTML = '<div class="text-muted text-center py-4">此地點皆已搬運完畢！</div>'; document.getElementById('mvPhase3').style.display = 'none'; }
    else { listDiv.innerHTML = filteredItems.map((x, i) => { let tcBadge = x.tempCode ? `<span class="badge bg-info text-dark me-2 shadow-sm fs-6"><i class="fas fa-tag"></i> ${escapeHTML(x.tempCode)}</span>` : ''; let isMisc = x.qrCode.startsWith('MISC'); let displayId = x.qrCode.replace(/\n/g, ' '); return `<div class="form-check mb-2 pb-2 border-bottom"><input class="form-check-input mv-item-cb" type="checkbox" value="${x.rowIndex}" id="mvItem_${i}" onchange="checkPhase3Trigger()"><label class="form-check-label w-100" for="mvItem_${i}"><div class="d-flex align-items-center mb-1">${tcBadge}<span class="${isMisc ? 'text-danger' : 'text-primary'} fw-bold" style="font-size:0.85rem;">[${escapeHTML(displayId)}]</span></div><div class="fs-6 text-dark">${escapeHTML(x.name)}</div></label></div>`; }).join(''); checkPhase3Trigger(); }
    document.getElementById('mvPhase2').style.display = 'block';
}

function toggleAllItems(state) { document.querySelectorAll('.mv-item-cb').forEach(cb => cb.checked = state); checkPhase3Trigger(); }
function checkPhase3Trigger() { document.getElementById('mvPhase3').style.display = document.querySelectorAll('.mv-item-cb:checked').length > 0 ? 'block' : 'none'; }
function toggleBoxInput() { const isBox = document.getElementById('mvIsBox').checked; document.getElementById('boxInputContainer').style.display = isBox ? 'block' : 'none'; if (!isBox) document.getElementById('mvBoxName').value = ''; }

async function submitMovement() {
    const selectedItems = Array.from(document.querySelectorAll('.mv-item-cb:checked')).map(cb => parseInt(cb.value)); const newLoc = document.getElementById('mvNewLoc').value, staffInt = document.getElementById('mvStaffInternal').value;
    if(selectedItems.length === 0 || !newLoc || !staffInt) return alert('請確認皆已完整填寫！'); showMiniLoading(`寫入 ${selectedItems.length} 件紀錄...`);
    try { await callAPI('submitMovement', { rowIndices: selectedItems, newLoc: newLoc, isBox: document.getElementById('mvIsBox').checked ? 'TRUE' : 'FALSE', boxName: document.getElementById('mvBoxName').value, staffInternal: staffInt }); alert(`✅ 成功送出 ${selectedItems.length} 件文物搬運紀錄！`); currentProjectItems = currentProjectItems.filter(x => !selectedItems.includes(x.rowIndex)); document.getElementById('mvPhase3').style.display = 'none'; loadWorkerItems(); silentMvSync(); loadWorkerLocations(); } catch(e) { alert(e.message); if(e.message.includes("慢了一步")) { loadWorkerLocations(); } } finally { hideMiniLoading(); }
}
async function silentMvSync() { if(!currentMvEventId) return; try { const res = await callAPI('getProjectPendingData', { eventId: currentMvEventId }); currentProjectItems = res.items || []; pendingLocTree = res.locTree || []; } catch(e) {} }

// ================= 💡 管理員後台模組 =================
async function updateBaseline() {
    const timeVal = document.getElementById('newBaseline').value; if(!timeVal) return alert('請選擇日期時間'); if(!confirm("確定要更新基準日嗎？")) return;
    showMiniLoading('更新中...'); try { await callAPI('updateBaseline', { timeString: timeVal }); alert('✅ 更新成功！'); location.reload(); } catch (e) { alert("更新失敗：" + e.message); hideMiniLoading(); }
}

async function loadManagerData() {
    const eid = document.getElementById('mgrEvent').value; if(!eid) { document.getElementById('mgrFilterSec').style.display = 'none'; document.getElementById('btnPrintReport').disabled = true; document.querySelector('#tablePending tbody').innerHTML = ''; document.querySelector('#tableConfirmed tbody').innerHTML = ''; return; }
    showMiniLoading('載入表單中...');
    try {
        const res = await callAPI('getManagerData', { eventId: eid }); mgrPendingData = res.pending; mgrConfirmedData = res.confirmed; const allData = [...mgrPendingData, ...mgrConfirmedData];
        const locs = [...new Set(allData.map(x => x.newLoc).filter(Boolean))].sort(), boxes = [...new Set(allData.map(x => x.boxName).filter(Boolean))].sort(), staffs = [...new Set(allData.map(x => x.staff).filter(Boolean))].sort();
        document.getElementById('mgrSearchLoc').innerHTML = '<option value="">📍 所有地點</option>' + locs.map(x => `<option value="${escapeHTML(x)}">${escapeHTML(x)}</option>`).join(''); document.getElementById('mgrSearchBox').innerHTML = '<option value="">📦 所有箱號</option>' + boxes.map(x => `<option value="${escapeHTML(x)}">${escapeHTML(x)}</option>`).join(''); document.getElementById('mgrSearchStaff').innerHTML = '<option value="">👤 所有人員</option>' + staffs.map(x => `<option value="${escapeHTML(x)}">${escapeHTML(x)}</option>`).join('');
        document.getElementById('mgrFilterSec').style.display = 'block'; document.getElementById('btnPrintReport').disabled = false; applyMgrFilters();
    } catch(e) { alert("載入失敗：" + e.message); } finally { hideMiniLoading(); }
}

function applyMgrFilters() {
    const kw = document.getElementById('mgrSearchKw').value.toLowerCase().trim(), loc = document.getElementById('mgrSearchLoc').value, box = document.getElementById('mgrSearchBox').value, staff = document.getElementById('mgrSearchStaff').value;
    const filterFn = (x) => { const matchKw = !kw || (x.qrCode.toLowerCase().includes(kw) || (x.name && x.name.toLowerCase().includes(kw))); const matchLoc = !loc || x.newLoc === loc; const matchBox = !box || x.boxName === box; const matchStaff = !staff || x.staff === staff; return matchKw && matchLoc && matchBox && matchStaff; };
    const filteredP = mgrPendingData.filter(filterFn), filteredC = mgrConfirmedData.filter(filterFn);
    document.getElementById('mgrFilterCount').innerText = `篩選結果: 待核對 ${filteredP.length} 筆 / 已核對 ${filteredC.length} 筆`; renderTable('tablePending', filteredP, 'chk-pend', true); renderTable('tableConfirmed', filteredC, 'chk-conf', false);
}

function renderTable(tid, data, cls, edit) {
    document.querySelector(`#${tid} tbody`).innerHTML = data.map(x => {
        let safeLoc = x.newLoc.replace(/'/g, "\\'").replace(/"/g, "&quot;"); let safeBox = x.boxName.replace(/'/g, "\\'").replace(/"/g, "&quot;"); let tcBadge = x.tempCode ? `<span class="badge bg-info text-dark ms-1"><i class="fas fa-tag"></i> ${escapeHTML(x.tempCode)}</span>` : ''; let displayId = x.qrCode.replace(/\n/g, ' ');
        return `<tr><td><input type="checkbox" class="${cls}" value="${x.rowIndex}"></td><td><b class="${x.qrCode.startsWith('MISC') ? 'text-danger' : 'text-dark'}">${escapeHTML(displayId)}</b>${tcBadge}<br><span class="text-primary small fw-bold">${escapeHTML(x.name)}</span><br><small class="text-muted">原: ${escapeHTML(x.oldLoc)}</small></td><td><span class="text-success fw-bold">${escapeHTML(x.newLoc)}</span><br><small class="badge bg-light text-dark border mt-1">${escapeHTML(x.boxName||'未裝箱')}</small></td><td>${edit ? `<small class="text-muted d-block mb-1">搬運: ${escapeHTML(x.staff)}</small><button class="btn btn-sm btn-outline-primary" onclick="promptEdit(${x.rowIndex},'${safeLoc}','${safeBox}')">📝修改</button>` : `<small class="text-muted d-block mb-1">搬運: ${escapeHTML(x.staff)}</small><small class="badge bg-success">核對: ${escapeHTML(x.manager)}</small>`}</td></tr>`;
    }).join('');
}

async function changeStatus(cls, stat) { const rows = Array.from(document.querySelectorAll(`${cls}:checked`)).map(cb => parseInt(cb.value)); if(rows.length === 0) return alert('請先勾選項目！'); showMiniLoading('處理中...'); try { await callAPI('toggleStatus', { rowIndices: rows, newStatus: stat, managerName: currentManager }); loadManagerData(); } catch(e) { alert("失敗：" + e.message); hideMiniLoading(); } }
async function promptEdit(ri, nl, nb) { const loc = prompt("修改暫存地點：", nl), box = prompt("修改箱名：", nb); if(loc!==null) { showMiniLoading('更新中...'); try { await callAPI('editItem', { rowIndex: ri, newLoc: loc, boxName: box, managerName: currentManager }); loadManagerData(); } catch(e) { alert("失敗：" + e.message); hideMiniLoading(); } } }

async function syncToMaster() {
    if(!confirm("確定要結案同步嗎？(注意：系統將自動略過「MISC-」開頭的雜物項目)")) return; showMiniLoading('寫入總表中...');
    try { let res = await callAPI('syncToMaster', { eventId: document.getElementById('mgrEvent').value }); if (res && typeof res.count !== 'undefined') { alert(`✅ 結案成功！共更新了 ${res.count} 筆文物地點。`); } else { alert('✅ 結案指令已送出，但無更新紀錄。'); } loadManagerData(); callAPI('getInventoryInitData').then(invData => { globalCatalog = invData.catalog || {}; }); refreshSystem('mgr'); } catch(e) { alert("失敗：" + e.message); hideMiniLoading(); }
}

function toggleAllCheck(s, t) { document.querySelectorAll(t).forEach(cb => cb.checked = s.checked); }

function printMovementList() {
    let allData = [...mgrPendingData, ...mgrConfirmedData]; if(allData.length === 0) return alert("目前無資料可列印！"); let sel = document.getElementById('mgrEvent'), eventName = sel.options[sel.selectedIndex].text.replace('✏️ 編輯專案: ', '');
    let html = `<div class="preview-paper"><h3 class="text-center fw-bold mb-4">典藏庫房 搬運清冊</h3><div class="d-flex justify-content-between mb-3 border-bottom pb-2"><span><strong>專案名稱：</strong> ${escapeHTML(eventName)}</span><span><strong>列印時間：</strong> ${new Date().toLocaleString('zh-TW')}</span></div><table class="table table-bordered table-sm" style="font-size: 10pt;"><thead class="table-light"><tr><th width="5%">項次</th><th width="20%">文物/雜物編號</th><th width="25%">名稱</th><th width="20%">原典藏地點</th><th width="20%">移往暫存地點 (箱號)</th><th width="10%">核對簽章</th></tr></thead><tbody>`;
    allData.forEach((item, idx) => { let dest = item.newLoc ? escapeHTML(item.newLoc) : "未搬運"; if(item.boxName) dest += `<br><small>(${escapeHTML(item.boxName)})</small>`; let tcLabel = item.tempCode ? `<br><span class="badge border border-dark text-dark mt-1" style="font-size:9pt;"><i class="fas fa-tag"></i> ${escapeHTML(item.tempCode)}</span>` : ''; let displayId = item.qrCode.replace(/\n/g, ' '); html += `<tr><td class="text-center align-middle">${idx + 1}</td><td class="align-middle">${escapeHTML(displayId)} ${tcLabel}</td><td class="align-middle">${escapeHTML(item.name)}</td><td class="align-middle">${escapeHTML(item.oldLoc)}</td><td class="align-middle">${dest}</td><td></td></tr>`; });
    html += `</tbody></table><div class="mt-5 d-flex justify-content-between px-5"><div class="text-center"><div><strong>點交人簽章</strong></div><div style="border-bottom: 1px solid #000; width: 150px; margin-top: 40px;"></div></div><div class="text-center"><div><strong>搬運負責人簽章</strong></div><div style="border-bottom: 1px solid #000; width: 150px; margin-top: 40px;"></div></div><div class="text-center"><div><strong>管理員審核簽章</strong></div><div style="border-bottom: 1px solid #000; width: 150px; margin-top: 40px;"></div></div></div></div>`;
    document.getElementById('printReportContent').innerHTML = html; document.getElementById('printReportOverlay').style.display = 'flex';
}

function printLocationLabels() {
    let activeLocs = []; mgrLocTree.forEach(m => { m.subs.forEach(s => { s.details.forEach(d => { if (!d.isHidden) activeLocs.push(d.val); }); }); }); if (activeLocs.length === 0) return alert("目前沒有啟用的地點可供列印！"); showMiniLoading("生成地點標籤中...");
    setTimeout(() => { try { let printHtml = `<div class="preview-paper"><div class="grid-container" style="gap:2px; justify-content:flex-start;">`; activeLocs.sort().forEach(loc => { let qrData = "LOC:" + loc; const qr = new QRious({ value: qrData, size: 150, level: 'M' }); const base64Img = qr.toDataURL('image/png'); printHtml += `<div class="label-box" style="border: 2px solid #0d6efd; background: white;"><div style="font-size:7pt; font-weight:bold; color:#0d6efd; margin-bottom:2px;">📍 典藏地點</div><img src="${base64Img}" class="qr-img" alt="QR" style="width: 2.5cm; height: 2.5cm;"><div class="id-text" style="font-size:9pt; margin-top:5px; white-space:normal; line-height:1.2;">${escapeHTML(loc)}</div></div>`; }); printHtml += `</div></div>`; document.getElementById('printOverlayContent').innerHTML = printHtml; document.getElementById('printOverlayTopBar').querySelector('h6').innerText = "地點 QR 標籤預覽"; document.getElementById('printOverlay').style.display = 'flex'; hideMiniLoading(); } catch (e) { hideMiniLoading(); alert("產生列印畫面時發生錯誤：" + e.message); } }, 50);
}

function renderLocationsList(tree) {
    let allLocs = []; tree.forEach(m => { m.subs.forEach(s => { s.details.forEach(d => { allLocs.push({ main: m.main, med: s.sub, small: d.label, full: d.val, rowIndex: d.rowIndex, isHidden: d.isHidden, isPending: d.isPending }); }); }); });
    let activeLocs = allLocs.filter(r => !r.isHidden), inactiveLocs = allLocs.filter(r => r.isHidden);
    const groupByMain = (arr) => { return arr.reduce((acc, curr) => { if(!acc[curr.main]) acc[curr.main] = []; acc[curr.main].push(curr); return acc; }, {}); };
    const activeGrouped = groupByMain(activeLocs), inactiveGrouped = groupByMain(inactiveLocs);
    const buildCard = (r) => { let displaySmall = r.small === "(無)" ? r.full : r.small; let displayMedium = r.med === "(本區)" ? "" : r.med; let safeMain = r.main.replace(/'/g, "\\'").replace(/"/g, "&quot;"); let safeMed = displayMedium.replace(/'/g, "\\'").replace(/"/g, "&quot;"); let safeSmall = (r.small==="(無)"?"":r.small).replace(/'/g, "\\'").replace(/"/g, "&quot;"); let pendingBadge = r.isPending ? `<span class="badge bg-warning text-dark ms-2">☁️ 寫入中...</span>` : ''; let actionBtns = r.isPending ? `<span class="text-muted small">背景處理中...</span>` : `<span class="badge ${!r.isHidden ? 'bg-success' : 'bg-secondary'} me-1" style="cursor:pointer;" onclick="toggleLocStatus(${r.rowIndex}, ${!r.isHidden})">${!r.isHidden ? '已啟用' : '已停用'}</span><button class="btn btn-sm btn-outline-primary py-0 px-2 me-1" onclick="openEditLocModal(${r.rowIndex}, '${safeMain}', '${safeMed}', '${safeSmall}')"><i class="fas fa-edit"></i></button><button class="btn btn-sm btn-outline-danger py-0 px-2" onclick="deleteLoc(${r.rowIndex})"><i class="fas fa-trash"></i></button>`; return `<div class="loc-card-new" id="locCard_${r.rowIndex}"><div class="loc-card-header"><div><span class="badge bg-light text-dark border me-1">${escapeHTML(r.main)}</span>${displayMedium ? `<span class="badge bg-light text-dark border">${escapeHTML(displayMedium)}</span>` : ''}${pendingBadge}</div><div>${actionBtns}</div></div><div class="loc-card-title">${escapeHTML(displaySmall)}</div></div>`; };
    const buildAccordion = (groupedData, prefixId) => { let keys = Object.keys(groupedData).sort(); if(keys.length === 0) return `<div class="text-muted text-center py-3 small">無資料</div>`; return keys.map((mainKey, idx) => { let items = groupedData[mainKey], colId = `${prefixId}Col${idx}`; return `<div class="accordion-item mb-2 border-0 shadow-sm rounded overflow-hidden"><h2 class="accordion-header"><button class="accordion-button collapsed fw-bold text-dark py-3" type="button" data-bs-toggle="collapse" data-bs-target="#${colId}" style="background-color: #f8f9fa;">📂 ${escapeHTML(mainKey)} <span class="badge bg-secondary ms-2">共 ${items.length} 處</span></button></h2><div id="${colId}" class="accordion-collapse collapse" data-bs-parent="#${prefixId}"><div class="accordion-body bg-light p-2">${items.map(buildCard).join('')}</div></div></div>`; }).join(''); };
    document.getElementById('activeAccordion').innerHTML = buildAccordion(activeGrouped, 'activeAcc'); document.getElementById('inactiveAccordion').innerHTML = buildAccordion(inactiveGrouped, 'inactiveAcc'); document.getElementById('activeLocCount').innerText = activeLocs.length; document.getElementById('inactiveLocCount').innerText = inactiveLocs.length;
}

async function addNewLocation() {
    const m = document.getElementById('locAddMain').value.trim(), med = document.getElementById('locAddMedium').value.trim(), s = document.getElementById('locAddSmall').value.trim();
    if(!m) return alert("「大區」為必填欄位！"); let fullStr = smartConcatLoc(m, med, s), flatTree = []; mgrLocTree.forEach(mNode => mNode.subs.forEach(sNode => sNode.details.forEach(d => flatTree.push(d)))); let existing = flatTree.find(d => d.val === fullStr), existingInQueue = locAddQueue.find(q => smartConcatLoc(q.main, q.medium, q.small) === fullStr);
    if (existing || existingInQueue) { if (existing && !existing.isHidden) { return showSyncToast('⚠️ 此地點已在啟用清單中！', false); } else if (existing && existing.isHidden) { showSyncToast('⚠️ 偵測到歷史停用地點，將為您自動喚醒...', false); return toggleLocStatus(existing.rowIndex, false); } else { return showSyncToast('⚠️ 此地點已在背景排隊建立中！', false); } }
    locAddQueue.push({ main: m, medium: med, small: s }); optimisticAddLocToTree(m, med, s, fullStr); showSyncToast(`✅ [${fullStr}] 已加入建立排程`, true);
    const smallInput = document.getElementById('locAddSmall'); smallInput.focus(); smallInput.select(); processLocAddQueue();
}

function optimisticAddLocToTree(m, med, s, fullStr) {
    let targetMain = mgrLocTree.find(x => x.main === m); if (!targetMain) { targetMain = { main: m, subs: [] }; mgrLocTree.push(targetMain); mgrLocTree.sort((a,b) => a.main.localeCompare(b.main)); }
    let targetSub = targetMain.subs.find(x => x.sub === (med || "(本區)")); if (!targetSub) { targetSub = { sub: (med || "(本區)"), details: [] }; targetMain.subs.push(targetSub); targetMain.subs.sort((a,b) => a.sub.localeCompare(b.sub)); }
    targetSub.details.push({ label: s || "(無)", val: fullStr, rowIndex: 'temp_' + Date.now() + Math.random(), isHidden: false, isPending: true }); targetSub.details.sort((a,b) => a.label.localeCompare(b.label)); renderLocationsList(mgrLocTree);
}

async function processLocAddQueue() {
    if (isLocAdding || locAddQueue.length === 0) return; isLocAdding = true; const itemsToProcess = [...locAddQueue]; locAddQueue = [];
    try { const newTree = await callAPI('batchAddLocations', { items: itemsToProcess }); globalLocTree = newTree.locTree; mgrLocTree = newTree.mgrLocTree; renderLocationsList(mgrLocTree); let addedNames = itemsToProcess.map(q => smartConcatLoc(q.main, q.medium, q.small)).join('、'); if (addedNames.length > 40) { addedNames = addedNames.substring(0, 40) + '... 等 ' + itemsToProcess.length + ' 筆'; } showSyncToast(`✅ 已成功新增後台資料：${addedNames}`, true); } catch (e) { console.error("背景建立失敗", e); showSyncToast("⚠️ 部分地點建立失敗，將於下次重試", false); locAddQueue = [...itemsToProcess, ...locAddQueue]; renderLocationsList(mgrLocTree); } finally { isLocAdding = false; if (locAddQueue.length > 0) { processLocAddQueue(); } }
}

function openEditLocModal(rowIndex, oldMain, oldMedium, oldSmall) { document.getElementById('editLocRowIndex').value = rowIndex; document.getElementById('editLocMain').value = oldMain; document.getElementById('editLocMedium').value = oldMedium; document.getElementById('editLocSmall').value = oldSmall; bootstrap.Modal.getOrCreateInstance(document.getElementById('editLocModal')).show(); }

function submitEditLoc() {
    const rowIndex = parseInt(document.getElementById('editLocRowIndex').value), m = document.getElementById('editLocMain').value.trim(), med = document.getElementById('editLocMedium').value.trim(), s = document.getElementById('editLocSmall').value.trim();
    if(!m) return alert("❌「大區」不可為空！"); bootstrap.Modal.getInstance(document.getElementById('editLocModal')).hide(); const card = document.getElementById(`locCard_${rowIndex}`);
    if(card) { let displaySmall = s === "" ? smartConcatLoc(m, med, s) : s; card.innerHTML = `<div class="loc-card-header"><div><span class="badge bg-light text-dark border me-1">${escapeHTML(m)}</span>${med ? `<span class="badge bg-light text-dark border">${escapeHTML(med)}</span>` : ''}<span class="badge bg-warning text-dark ms-2" id="syncBadge_${rowIndex}">☁️ 同步中...</span></div><div><button class="btn btn-sm btn-outline-secondary py-0 px-2 me-1" disabled><i class="fas fa-edit"></i></button><button class="btn btn-sm btn-outline-danger py-0 px-2" onclick="deleteLoc(${rowIndex})"><i class="fas fa-trash"></i></button></div></div><div class="loc-card-title">${escapeHTML(displaySmall)}</div>`; }
    locUpdateQueue.push({ rowIndex: rowIndex, main: m, medium: med, small: s }); processLocQueue();
}

async function processLocQueue() {
    if (isLocSyncing || locUpdateQueue.length === 0) return; isLocSyncing = true; const updatesToProcess = [...locUpdateQueue]; locUpdateQueue = [];
    try { const newTree = await callAPI('batchUpdateLocations', { updates: updatesToProcess }); globalLocTree = newTree.locTree; mgrLocTree = newTree.mgrLocTree; renderLocationsList(mgrLocTree); showSyncToast(`✅ ${updatesToProcess.length} 筆地點已於背景更新完成`, true); } catch (e) { console.error("背景更新失敗", e); showSyncToast("⚠️ 部分地點背景更新失敗，將於下次重試", true); locUpdateQueue = [...updatesToProcess, ...locUpdateQueue]; renderLocationsList(mgrLocTree); } finally { isLocSyncing = false; if (locUpdateQueue.length > 0) { processLocQueue(); } }
}

async function toggleLocStatus(rowIndex, setHidden) { showSyncToast('狀態更新同步中...'); let found = false; mgrLocTree.forEach(m => m.subs.forEach(s => s.details.forEach(d => { if(d.rowIndex === rowIndex) { d.isHidden = setHidden; found = true; } }))); if(found) renderLocationsList(mgrLocTree); try { const newTree = await callAPI('toggleLocStatus', { rowIndex: rowIndex, setHidden: setHidden }); globalLocTree = newTree.locTree; mgrLocTree = newTree.mgrLocTree; renderLocationsList(mgrLocTree); showSyncToast("✅ 狀態已同步", true); } catch(e) { alert("狀態切換失敗：" + e.message); showSyncToast("❌ 同步失敗", true); } }
async function deleteLoc(rowIndex) { if(!confirm("⚠️ 警告：確定要刪除這個地點嗎？")) return; showMiniLoading('刪除地點中...'); try { const newTree = await callAPI('deleteLocation', { rowIndex: rowIndex }); globalLocTree = newTree.locTree; mgrLocTree = newTree.mgrLocTree; renderLocationsList(mgrLocTree); } catch(e) { alert("刪除失敗：" + e.message); } finally { hideMiniLoading(); } }
