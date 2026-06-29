// ==========================================
// 博物館系統：後台管理與狀況報告模組 (app_reports_mgr.js)
// 包含：管理員異動審核、空間架構管理、狀況報告 A4 排版、相簿畫廊與雲端同步刪除
// ==========================================

// ================= 💡 管理員後台全域變數 =================
let parsedOverrideItems = [];
let locAddQueue = [];
let locUpdateQueue = [];
let isLocAdding = false;
let isLocSyncing = false;

// ================= 💡 狀況報告表全域變數 =================
let condCurrentItem = null;
let condPhotos = [];
let mainPhotoBase64 = "";
let mainPhotoMime = "";
let pendingPhotoBase64 = "";
let condMode = 1;
let condReportsCache = [];
let vendorFileData = null;

// ================= 💡 管理員後台 (加入購物車與樂觀更新) =================
function parseOverrideData() { 
    const raw = document.getElementById('importOverrideTextarea').value.trim(); 
    if(!raw) return alert("請先貼上資料！"); 
    const lines = raw.split('\n'); let payload = []; 
    lines.forEach(line => { 
        if(!line.trim()) return; 
        let cols = line.includes('\t') ? line.split('\t') : line.split(','); 
        cols = cols.map(c => c.trim()); 
        if (cols.length >= 2 && cols[0]) { payload.push({ id: cols[0], newLoc: cols[1] }); } 
    }); 
    if(payload.length === 0) return alert("解析失敗！請確保貼上格式為「編號 + 地點」。"); 
    showMiniLoading("正在比對雲端總表..."); 
    callAPI('previewLocationOverride', { items: payload }).then(res => { 
        parsedOverrideItems = res.results; 
        renderOverridePreview(); 
        document.getElementById('overridePreviewSection').style.display = 'block'; 
        hideMiniLoading(); 
    }).catch(e => { alert("預覽失敗：" + e.message); hideMiniLoading(); }); 
}

function renderOverridePreview() { 
    let html = '', validCount = 0; 
    parsedOverrideItems.forEach(item => { 
        let statusBadge = '', trClass = ''; 
        if (item.status === 'ok') { 
            statusBadge = '<span class="badge bg-success">✅ 準備覆寫</span>'; validCount++; 
        } else if (item.status === 'no_change') { 
            statusBadge = '<span class="badge bg-secondary">⏸️ 地點相同</span>'; trClass = 'table-secondary text-muted'; 
        } else { 
            statusBadge = '<span class="badge bg-danger">❌ 查無此物</span>'; trClass = 'table-danger text-muted'; 
        } 
        html += `<tr class="${trClass}"><td>${statusBadge}</td><td class="fw-bold text-dark">${escapeHTML(item.id)}</td><td class="small">${escapeHTML(item.oldLoc || '無')}</td><td class="text-danger fw-bold small">${item.status === 'not_found' ? '--' : escapeHTML(item.newLoc)}</td></tr>`; 
    }); 
    document.getElementById('overridePreviewTableBody').innerHTML = html; 
    document.getElementById('overrideStats').innerText = `✅ 可強制校正：${validCount} 筆`; 
    document.getElementById('btnConfirmOverride').disabled = (validCount === 0); 
}

function confirmOverride() { 
    let validItems = parsedOverrideItems.filter(x => x.status === 'ok'); 
    if(validItems.length === 0) return; 
    if (!confirm(`⚠️ 危險操作確認！\n\n系統將直接覆寫總表中這 ${validItems.length} 件文物的地點，此操作無法復原。\n\n確定要強制執行覆寫嗎？`)) { return; } 
    showMiniLoading(`正在強制寫入 ${validItems.length} 筆地點資料...`); 
    callAPI('executeLocationOverride', { items: validItems }).then(res => { 
        alert(`✅ 成功強制校正了 ${res.count} 筆文物地點！`); 
        document.getElementById('importOverrideTextarea').value = ''; 
        document.getElementById('overridePreviewSection').style.display = 'none'; 
        parsedOverrideItems = []; 
        callAPI('getInventoryInitData').then(invData => { globalCatalog = invData.catalog || {}; }); 
        hideMiniLoading(); 
    }).catch(e => { alert("寫入失敗：" + e.message); hideMiniLoading(); }); 
}

async function updateBaseline() { 
    const timeVal = document.getElementById('newBaseline').value; 
    if(!timeVal) return alert('請選擇日期時間'); 
    if(!confirm("確定要更新基準日嗎？")) return; 
    showMiniLoading('更新中...'); 
    try { 
        await callAPI('updateBaseline', { timeString: timeVal }); 
        alert('✅ 更新成功！'); location.reload(); 
    } catch (e) { alert("更新失敗：" + e.message); hideMiniLoading(); } 
}

async function loadManagerData() { 
    const eid = document.getElementById('mgrEvent').value; 
    
    mgrPendingCart.clear(); 
    mgrConfirmedCart.clear();
    updateMgrCartUI();

    if(!eid) { 
        document.getElementById('mgrFilterSec').style.display = 'none'; document.getElementById('btnPrintReport').disabled = true; 
        document.querySelector('#tablePending tbody').innerHTML = ''; document.querySelector('#tableConfirmed tbody').innerHTML = ''; 
        return; 
    } 
    showMiniLoading('載入表單中...'); 
    try { 
        const res = await callAPI('getManagerData', { eventId: eid }); 
        mgrPendingData = res.pending; mgrConfirmedData = res.confirmed; 
        const allData = [...mgrPendingData, ...mgrConfirmedData]; 
        const locs = [...new Set(allData.map(x => x.newLoc).filter(Boolean))].sort(), boxes = [...new Set(allData.map(x => x.boxName).filter(Boolean))].sort(), staffs = [...new Set(allData.map(x => x.staff).filter(Boolean))].sort(); 
        document.getElementById('mgrSearchLoc').innerHTML = '<option value="">📍 所有地點</option>' + locs.map(x => `<option value="${escapeHTML(x)}">${escapeHTML(x)}</option>`).join(''); 
        document.getElementById('mgrSearchBox').innerHTML = '<option value="">📦 所有箱號</option>' + boxes.map(x => `<option value="${escapeHTML(x)}">${escapeHTML(x)}</option>`).join(''); 
        document.getElementById('mgrSearchStaff').innerHTML = '<option value="">👤 所有人員</option>' + staffs.map(x => `<option value="${escapeHTML(x)}">${escapeHTML(x)}</option>`).join(''); 
        document.getElementById('mgrFilterSec').style.display = 'block'; document.getElementById('btnPrintReport').disabled = false; 
        applyMgrFilters(); 
    } catch(e) { alert("載入失敗：" + e.message); } finally { hideMiniLoading(); } 
}

function applyMgrFilters() { 
    const kwStr = document.getElementById('mgrSearchKw').value.toLowerCase().trim(), keywords = kwStr ? kwStr.split(/\s+/) : [], loc = document.getElementById('mgrSearchLoc').value, box = document.getElementById('mgrSearchBox').value, staff = document.getElementById('mgrSearchStaff').value; 
    const filterFn = (x) => { 
        let targetStr = (String(x.qrCode).replace(/\n/g, ' ') + ' ' + (x.name || '') + ' ' + (x.tempCode || '')).toLowerCase(); 
        let matchKw = keywords.length === 0 || keywords.every(k => targetStr.includes(k)); 
        let matchLoc = !loc || x.newLoc === loc; let matchBox = !box || x.boxName === box; let matchStaff = !staff || x.staff === staff; 
        return matchKw && matchLoc && matchBox && matchStaff; 
    }; 
    const filteredP = mgrPendingData.filter(filterFn), filteredC = mgrConfirmedData.filter(filterFn); 
    document.getElementById('mgrFilterCount').innerText = `篩選結果: 待核對 ${filteredP.length} 筆 / 已核對 ${filteredC.length} 筆`; 
    renderTable('tablePending', filteredP, 'pending', true); 
    renderTable('tableConfirmed', filteredC, 'confirmed', false); 
}

function renderTable(tid, data, type, edit) { 
    let cart = type === 'pending' ? mgrPendingCart : mgrConfirmedCart;
    let cls = type === 'pending' ? 'chk-pend' : 'chk-conf';

    document.querySelector(`#${tid} tbody`).innerHTML = data.map(x => { 
        let safeLoc = String(x.newLoc).replace(/'/g, "\\'").replace(/"/g, "&quot;"); let safeBox = String(x.boxName).replace(/'/g, "\\'").replace(/"/g, "&quot;"); 
        let tcBadge = x.tempCode ? `<span class="badge bg-info text-dark ms-1"><i class="fas fa-tag"></i> ${escapeHTML(x.tempCode)}</span>` : ''; 
        let displayId = String(x.qrCode).replace(/\n/g, ' '); 
        let expectedWarning = x.isExpectedChanged ? `<br><small class="text-danger fw-bold"><i class="fas fa-exclamation-circle"></i> 地點已變更</small>` : ''; 
        let isChecked = cart.has(x.rowIndex) ? 'checked' : '';

        return `<tr><td><input type="checkbox" class="${cls}" value="${x.rowIndex}" ${isChecked} onchange="toggleMgrCart(this, ${x.rowIndex}, '${type}')"></td><td><b class="${String(x.qrCode).startsWith('MISC') ? 'text-danger' : 'text-dark'}">${escapeHTML(displayId)}</b>${tcBadge}<br><span class="text-primary small fw-bold">${escapeHTML(x.name)}</span> <span class="badge bg-secondary rounded-pill">x${escapeHTML(x.qty || '1')}</span><br><small class="text-muted">原: ${escapeHTML(x.oldLoc)}</small></td><td><span class="text-success fw-bold">${escapeHTML(x.newLoc)}</span>${expectedWarning}<br><small class="badge bg-light text-dark border mt-1">${escapeHTML(x.boxName||'未裝箱')}</small></td><td>${edit ? `<small class="text-muted d-block mb-1">搬運: ${escapeHTML(x.staff)}</small>` : `<small class="text-muted d-block mb-1">搬運: ${escapeHTML(x.staff)}</small><small class="badge bg-success">核對: ${escapeHTML(x.manager)}</small>`}</td></tr>`; 
    }).join(''); 
}

function toggleMgrCart(cb, rIdx, type) {
    let cart = type === 'pending' ? mgrPendingCart : mgrConfirmedCart;
    if (cb.checked) cart.add(rIdx); else cart.delete(rIdx);
    updateMgrCartUI();
}

function toggleAllCheck(s, t) { 
    let type = t === '.chk-pend' ? 'pending' : 'confirmed';
    document.querySelectorAll(t).forEach(cb => { 
        if(cb.closest('tr').style.display !== 'none') {
            cb.checked = s.checked; 
            toggleMgrCart(cb, parseInt(cb.value), type);
        }
    }); 
}

function updateMgrCartUI() {
    let isPendingTab = document.querySelector('button[data-bs-target="#mgrPending"]')?.classList.contains('active');
    let cart = isPendingTab ? mgrPendingCart : mgrConfirmedCart;
    let btn = document.getElementById('mgrFloatingCartBtn');
    let countSpan = document.getElementById('mgrCartCount');
    let icon = document.getElementById('mgrCartIcon');
    
    let isMgrActive = document.querySelector('button[data-bs-target="#mgr"]')?.classList.contains('active');
    let isVerifyActive = document.querySelector('button[data-bs-target="#mgrTabVerify"]')?.classList.contains('active');
    
    if (isMgrActive && isVerifyActive && cart.size > 0) {
        btn.style.display = 'block';
        countSpan.innerText = cart.size;
        if (isPendingTab) {
            btn.className = 'floating-cart-btn btn-success border-0 shadow-lg';
            icon.className = 'fas fa-check-double fs-4';
        } else {
            btn.className = 'floating-cart-btn btn-warning text-dark border-0 shadow-lg';
            icon.className = 'fas fa-undo fs-4';
        }
    } else {
        if(btn) btn.style.display = 'none';
    }
}

function openMgrCartModal() {
    let isPendingTab = document.querySelector('button[data-bs-target="#mgrPending"]').classList.contains('active');
    let cart = isPendingTab ? mgrPendingCart : mgrConfirmedCart;
    let dataList = isPendingTab ? mgrPendingData : mgrConfirmedData;
    
    if (cart.size === 0) return alert('請先勾選項目！');
    
    let html = '';
    cart.forEach(rIdx => {
        let item = dataList.find(x => x.rowIndex === rIdx);
        if (!item) return;
        
        let safeLoc = escapeHTML(item.newLoc);
        let safeBox = escapeHTML(item.boxName || '未裝箱');
        let displayId = escapeHTML(String(item.qrCode).replace(/\n/g, ' '));
        
        if (isPendingTab) {
            html += `
            <div class="card border-0 shadow-sm mb-2" id="mgrCartCard_${rIdx}">
                <div class="card-body p-2 d-flex justify-content-between align-items-center">
                    <div>
                        <div class="fw-bold text-dark small">${displayId} <span class="text-primary">${escapeHTML(item.name)}</span></div>
                        <div class="input-group input-group-sm mt-1">
                            <span class="input-group-text bg-white text-success border-success px-1" style="font-size:0.75rem;">📍</span>
                            <input type="text" class="form-control form-control-sm border-success fw-bold text-success" id="mgrLoc_${rIdx}" value="${safeLoc}" readonly onclick="openBottomSheet('MGR_${rIdx}')" style="cursor:pointer; font-size:0.8rem;">
                        </div>
                    </div>
                    <div class="d-flex flex-column gap-1 ms-2">
                        <button class="btn btn-success btn-sm fw-bold px-2 py-0" onclick="executeMgrSingleAction(${rIdx}, true)">✅ 核對</button>
                        <button class="btn btn-outline-danger btn-sm fw-bold px-2 py-0" onclick="executeMgrSingleUndo(${rIdx})">❌ 退回</button>
                    </div>
                </div>
            </div>`;
        } else {
            html += `
            <div class="card border-0 shadow-sm mb-2" id="mgrCartCard_${rIdx}">
                <div class="card-body p-2 d-flex justify-content-between align-items-center">
                    <div>
                        <div class="fw-bold text-dark small">${displayId} <span class="text-primary">${escapeHTML(item.name)}</span></div>
                        <div class="text-success fw-bold small mt-1">📍 ${safeLoc} <span class="badge bg-light text-dark border">📦 ${safeBox}</span></div>
                    </div>
                    <button class="btn btn-warning btn-sm text-dark fw-bold px-3 ms-2" onclick="executeMgrSingleAction(${rIdx}, false)">↩️ 退回待核對</button>
                </div>
            </div>`;
        }
    });
    
    if (isPendingTab) {
        document.getElementById('mgrVerifyList').innerHTML = html;
        bootstrap.Modal.getOrCreateInstance(document.getElementById('mgrVerifyModal')).show();
    } else {
        document.getElementById('mgrRevertList').innerHTML = html;
        bootstrap.Modal.getOrCreateInstance(document.getElementById('mgrRevertModal')).show();
    }
}

async function promptEditMgrOptimistic(ri, newLoc) {
    let item = mgrPendingData.find(x => x.rowIndex === ri);
    if(!item) return;
    let oldLoc = item.newLoc;
    item.newLoc = newLoc;
    item.isExpectedChanged = true;
    applyMgrFilters();
    showSyncToast('修改地點同步中...', false);
    try {
        await callAPI('editItem', { rowIndex: ri, newLoc: newLoc, boxName: item.boxName, managerName: currentManager });
        showSyncToast('✅ 地點修改已同步', true);
    } catch(e) {
        item.newLoc = oldLoc; 
        applyMgrFilters();
        showSyncToast('❌ 修改失敗', true);
        alert("失敗將還原資料：" + e.message);
    }
}

async function executeMgrSingleAction(rIdx, stat) {
    let card = document.getElementById(`mgrCartCard_${rIdx}`);
    if(card) card.style.display = 'none';
    
    optimisticToggleStatus([rIdx], stat);
    updateMgrCartUI(); 
    
    let modalId = stat ? 'mgrVerifyModal' : 'mgrRevertModal';
    let listId = stat ? 'mgrVerifyList' : 'mgrRevertList';
    
    let remaining = Array.from(document.querySelectorAll(`#${listId} .card`)).filter(c => c.style.display !== 'none');
    if(remaining.length === 0) { bootstrap.Modal.getInstance(document.getElementById(modalId)).hide(); }
    
    showSyncToast('狀態更新同步中...', false);
    try { await callAPI('toggleStatus', { rowIndices: [rIdx], newStatus: stat, managerName: currentManager }); showSyncToast('✅ 單件狀態已同步', true);
    } catch(e) { showSyncToast('❌ 同步失敗', true); alert("失敗將自動還原資料：" + e.message); loadManagerData(); }
}

async function executeMgrSingleUndo(rIdx) {
    if(!confirm("確定要將此文物退回前台重新搬運嗎？")) return;
    let card = document.getElementById(`mgrCartCard_${rIdx}`);
    if(card) card.style.display = 'none';
    
    mgrPendingData = mgrPendingData.filter(x => x.rowIndex !== rIdx);
    mgrPendingCart.delete(rIdx);
    applyMgrFilters();
    updateMgrCartUI(); 
    
    let remaining = Array.from(document.querySelectorAll('#mgrVerifyList .card')).filter(c => c.style.display !== 'none');
    if(remaining.length === 0) { bootstrap.Modal.getInstance(document.getElementById('mgrVerifyModal')).hide(); }
    
    showSyncToast('退回搬運中...', false);
    try { await callAPI('undoMovement', { rowIndices: [rIdx], managerName: currentManager }); showSyncToast('✅ 已成功退回前台', true);
    } catch(e) { showSyncToast('❌ 退回失敗', true); alert("失敗將自動還原資料：" + e.message); loadManagerData(); }
}

async function executeMgrBatchAction(stat) {
    let isPendingTab = document.querySelector('button[data-bs-target="#mgrPending"]').classList.contains('active');
    let cart = isPendingTab ? mgrPendingCart : mgrConfirmedCart;
    let rows = Array.from(cart);
    if(rows.length === 0) return;

    if (stat === 'undo') {
        if(!confirm("確定要將購物車內所有文物退回前台重新搬運嗎？")) return;
        mgrPendingData = mgrPendingData.filter(x => !rows.includes(x.rowIndex));
        mgrPendingCart.clear();
        applyMgrFilters();
        bootstrap.Modal.getInstance(document.getElementById('mgrVerifyModal')).hide();
        updateMgrCartUI();
        
        showSyncToast('批次退回搬運中...', false);
        try { await callAPI('undoMovement', { rowIndices: rows, managerName: currentManager }); showSyncToast(`✅ ${rows.length} 件已成功退回前台`, true);
        } catch(e) { showSyncToast('❌ 退回失敗', true); alert("失敗將自動還原資料：" + e.message); loadManagerData(); }
        return;
    }
    
    let modalId = stat ? 'mgrVerifyModal' : 'mgrRevertModal';
    optimisticToggleStatus(rows, stat);
    bootstrap.Modal.getInstance(document.getElementById(modalId)).hide();
    updateMgrCartUI();
    
    showSyncToast('批次狀態更新同步中...', false);
    try { await callAPI('toggleStatus', { rowIndices: rows, newStatus: stat, managerName: currentManager }); showSyncToast(`✅ ${rows.length} 件狀態已同步`, true);
    } catch(e) { showSyncToast('❌ 同步失敗', true); alert("失敗將自動還原資料：" + e.message); loadManagerData(); }
}

function optimisticToggleStatus(rows, stat) {
    let movedItems = [];
    if (stat === true) {
        movedItems = mgrPendingData.filter(x => rows.includes(x.rowIndex));
        mgrPendingData = mgrPendingData.filter(x => !rows.includes(x.rowIndex));
        movedItems.forEach(x => { x.manager = currentManager; });
        mgrConfirmedData.push(...movedItems);
        rows.forEach(r => mgrPendingCart.delete(r));
    } else {
        movedItems = mgrConfirmedData.filter(x => rows.includes(x.rowIndex));
        mgrConfirmedData = mgrConfirmedData.filter(x => !rows.includes(x.rowIndex));
        movedItems.forEach(x => { x.manager = ''; });
        mgrPendingData.push(...movedItems);
        rows.forEach(r => mgrConfirmedCart.delete(r));
    }
    applyMgrFilters();
}

async function syncToMaster() { if(!confirm("確定要結案同步嗎？(系統將自動略過雜物)")) return; showMiniLoading('寫入總表中...'); try { let res = await callAPI('syncToMaster', { eventId: document.getElementById('mgrEvent').value }); if (res && typeof res.count !== 'undefined') { alert(`✅ 結案成功！共更新了 ${res.count} 筆文物地點。`); } else { alert('✅ 結案指令已送出。'); } loadManagerData(); callAPI('getInventoryInitData').then(invData => { globalCatalog = invData.catalog || {}; }); refreshSystem('mgr'); } catch(e) { alert("失敗：" + e.message); hideMiniLoading(); } }

// 🔥 完美重構：地點 QR 標籤，精準 3x3cm + 裁切線 + 中文名稱
function printLocationLabels() { 
    let activeLocs = []; 
    mgrLocTree.forEach(m => { m.subs.forEach(s => { s.details.forEach(d => { if (!d.isHidden) activeLocs.push(d.val); }); }); }); 
    if (activeLocs.length === 0) return alert("目前沒有啟用的地點可供列印！"); 
    
    showMiniLoading("生成地點標籤中..."); 
    setTimeout(() => { 
        try { 
            let printHtml = `
            <style>
                .basic-print-container { display: flex; flex-wrap: wrap; justify-content: flex-start; align-content: flex-start; padding: 5mm; background: white; margin: 0 auto; width: 210mm; }
                .fl-card-3x3 { width: 30mm; height: 30mm; background: white; position: relative; display: flex; flex-direction: column; justify-content: center; align-items: center; box-sizing: border-box; page-break-inside: avoid; margin: 0 1mm 1mm 0; border: 0.5px dashed #ccc; padding: 1mm; }
                .fl-crop-tl, .fl-crop-tr, .fl-crop-bl, .fl-crop-br { position: absolute; width: 3mm; height: 3mm; border-color: #999; border-style: solid; pointer-events: none; }
                .fl-crop-tl { top: 0; left: 0; border-width: 0.5px 0 0 0.5px; }
                .fl-crop-tr { top: 0; right: 0; border-width: 0.5px 0.5px 0 0; }
                .fl-crop-bl { bottom: 0; left: 0; border-width: 0 0 0.5px 0.5px; }
                .fl-crop-br { bottom: 0; right: 0; border-width: 0 0.5px 0.5px 0; }
            </style>
            <div class="preview-paper basic-print-container">`; 
            
            activeLocs.sort().forEach(loc => { 
                let qrData = "LOC:" + loc; 
                const qr = new QRious({ value: qrData, size: 150, level: 'M' }); 
                const base64Img = qr.toDataURL('image/png'); 
                printHtml += `
                <div class="fl-card-3x3 fl-card">
                    <div class="fl-crop-tl"></div><div class="fl-crop-tr"></div>
                    <div class="fl-crop-bl"></div><div class="fl-crop-br"></div>
                    <img src="${base64Img}" alt="QR" style="width: 22mm; height: 22mm; object-fit: contain; margin-bottom: 0.5mm;">
                    <div style="font-size: 7.5pt; font-weight: bold; color: #000; text-align: center; width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHTML(loc)}</div>
                </div>`; 
            }); 
            printHtml += `</div>`; 
            document.getElementById('printOverlayContent').innerHTML = printHtml; 
            document.getElementById('printOverlayTitle').innerText = "地點 QR 標籤預覽"; 
            document.getElementById('printOverlay').style.display = 'flex'; 
            
            if (typeof togglePrintBorders === 'function') togglePrintBorders();
            hideMiniLoading(); 
        } catch (e) { hideMiniLoading(); alert("產生列印畫面時發生錯誤：" + e.message); } 
    }, 50); 
}

function renderLocationsList(tree) { let allLocs = []; tree.forEach(m => { m.subs.forEach(s => { s.details.forEach(d => { allLocs.push({ main: m.main, med: s.sub, small: d.label, full: d.val, rowIndex: d.rowIndex, isHidden: d.isHidden, isPending: d.isPending }); }); }); }); let activeLocs = allLocs.filter(r => !r.isHidden), inactiveLocs = allLocs.filter(r => r.isHidden); const groupByMain = (arr) => { return arr.reduce((acc, curr) => { if(!acc[curr.main]) acc[curr.main] = []; acc[curr.main].push(curr); return acc; }, {}); }; const activeGrouped = groupByMain(activeLocs), inactiveGrouped = groupByMain(inactiveLocs); const buildCard = (r) => { let displaySmall = r.small === "(無)" ? r.full : r.small; let displayMedium = r.med === "(本區)" ? "" : r.med; let safeMain = String(r.main).replace(/'/g, "\\'").replace(/"/g, "&quot;"); let safeMed = String(displayMedium).replace(/'/g, "\\'").replace(/"/g, "&quot;"); let safeSmall = String(r.small==="(無)"?"":r.small).replace(/'/g, "\\'").replace(/"/g, "&quot;"); let pendingBadge = r.isPending ? `<span class="badge bg-warning text-dark ms-2">☁️ 寫入中...</span>` : ''; let actionBtns = r.isPending ? `<span class="text-muted small">背景處理中...</span>` : `<span class="badge ${!r.isHidden ? 'bg-success' : 'bg-secondary'} me-1" style="cursor:pointer;" onclick="toggleLocStatus(${r.rowIndex}, ${!r.isHidden})">${!r.isHidden ? '已啟用' : '已停用'}</span><button class="btn btn-sm btn-outline-primary py-0 px-2 me-1" onclick="openEditLocModal(${r.rowIndex}, '${safeMain}', '${safeMed}', '${safeSmall}')"><i class="fas fa-edit"></i></button><button class="btn btn-sm btn-outline-danger py-0 px-2" onclick="deleteLoc(${r.rowIndex})"><i class="fas fa-trash"></i></button>`; return `<div class="loc-card-new" id="locCard_${r.rowIndex}"><div class="loc-card-header"><div><span class="badge bg-light text-dark border me-1">${escapeHTML(r.main)}</span>${displayMedium ? `<span class="badge bg-light text-dark border">${escapeHTML(displayMedium)}</span>` : ''}${pendingBadge}</div><div>${actionBtns}</div></div><div class="loc-card-title">${escapeHTML(displaySmall)}</div></div>`; }; const buildAccordion = (groupedData, prefixId) => { let keys = Object.keys(groupedData).sort(); if(keys.length === 0) return `<div class="text-muted text-center py-3 small">無資料</div>`; return keys.map((mainKey, idx) => { let items = groupedData[mainKey], colId = `${prefixId}Col${idx}`; return `<div class="accordion-item mb-2 border-0 shadow-sm rounded overflow-hidden"><h2 class="accordion-header"><button class="accordion-button collapsed fw-bold text-dark py-3" type="button" data-bs-toggle="collapse" data-bs-target="#${colId}" style="background-color: #f8f9fa;">📂 ${escapeHTML(mainKey)} <span class="badge bg-secondary ms-2">共 ${items.length} 處</span></button></h2><div id="${colId}" class="accordion-collapse collapse" data-bs-parent="#${prefixId}"><div class="accordion-body bg-light p-2">${items.map(buildCard).join('')}</div></div></div>`; }).join(''); }; document.getElementById('activeAccordion').innerHTML = buildAccordion(activeGrouped, 'activeAcc'); document.getElementById('inactiveAccordion').innerHTML = buildAccordion(inactiveGrouped, 'inactiveAcc'); document.getElementById('activeLocCount').innerText = activeLocs.length; document.getElementById('inactiveLocCount').innerText = inactiveLocs.length; }

async function addNewLocation() { 
    try {
        const mInput = document.getElementById('locAddMain');
        const medInput = document.getElementById('locAddMedium');
        const sInput = document.getElementById('locAddSmall');
        
        const m = mInput.value.trim(), med = medInput.value.trim(), s = sInput.value.trim(); 
        if(!m) return alert("「大區」為必填欄位！"); 
        
        let fullStr = smartConcatLoc(m, med, s), flatTree = []; 
        mgrLocTree.forEach(mNode => mNode.subs.forEach(sNode => sNode.details.forEach(d => flatTree.push(d)))); 
        
        let existing = flatTree.find(d => d.val === fullStr);
        let existingInQueue = locAddQueue.find(q => smartConcatLoc(q.main, q.medium, q.small) === fullStr); 
        
        if (existing || existingInQueue) { 
            if (existing && !existing.isHidden) { return showSyncToast('⚠️ 此地點已在啟用清單中！', false); } 
            else if (existing && existing.isHidden) { 
                showSyncToast('⚠️ 偵測到歷史停用地點，將為您自動喚醒...', false); 
                sInput.value = ''; 
                return toggleLocStatus(existing.rowIndex, false); 
            } 
            else { return showSyncToast('⚠️ 此地點已在背景排隊建立中！', false); } 
        } 
        
        locAddQueue.push({ main: m, medium: med, small: s }); 
        optimisticAddLocToTree(m, med, s, fullStr); 
        showSyncToast(`✅ [${fullStr}] 已加入建立排程`, true); 
        
        sInput.value = ''; 
        sInput.focus(); 
        processLocAddQueue(); 
    } catch(e) {
        alert("新增地點發生錯誤：" + e.message);
    }
}

function optimisticAddLocToTree(m, med, s, fullStr) { let targetMain = mgrLocTree.find(x => x.main === m); if (!targetMain) { targetMain = { main: m, subs: [] }; mgrLocTree.push(targetMain); mgrLocTree.sort((a,b) => a.main.localeCompare(b.main)); } let targetSub = targetMain.subs.find(x => x.sub === (med || "(本區)")); if (!targetSub) { targetSub = { sub: (med || "(本區)"), details: [] }; targetMain.subs.push(targetSub); targetMain.subs.sort((a,b) => a.sub.localeCompare(b.sub)); } targetSub.details.push({ label: s || "(無)", val: fullStr, rowIndex: 'temp_' + Date.now() + Math.random(), isHidden: false, isPending: true }); targetSub.details.sort((a,b) => a.label.localeCompare(b.label)); renderLocationsList(mgrLocTree); }
async function processLocAddQueue() { if (isLocAdding || locAddQueue.length === 0) return; isLocAdding = true; const itemsToProcess = [...locAddQueue]; locAddQueue = []; try { const newTree = await callAPI('batchAddLocations', { items: itemsToProcess }); globalLocTree = newTree.locTree; mgrLocTree = newTree.mgrLocTree; renderLocationsList(mgrLocTree); let addedNames = itemsToProcess.map(q => smartConcatLoc(q.main, q.medium, q.small)).join('、'); if (addedNames.length > 40) { addedNames = addedNames.substring(0, 40) + '... 等 ' + itemsToProcess.length + ' 筆'; } showSyncToast(`✅ 已成功新增後台資料：${addedNames}`, true); } catch (e) { console.error("背景建立失敗", e); showSyncToast("⚠️ 部分地點建立失敗，將於下次重試", false); locAddQueue = [...itemsToProcess, ...locAddQueue]; renderLocationsList(mgrLocTree); } finally { isLocAdding = false; if (locAddQueue.length > 0) { processLocAddQueue(); } } }
function openEditLocModal(rowIndex, oldMain, oldMedium, oldSmall) { document.getElementById('editLocRowIndex').value = rowIndex; document.getElementById('editLocMain').value = oldMain; document.getElementById('editLocMedium').value = oldMedium; document.getElementById('editLocSmall').value = oldSmall; bootstrap.Modal.getOrCreateInstance(document.getElementById('editLocModal')).show(); }
function submitEditLoc() { const rowIndex = parseInt(document.getElementById('editLocRowIndex').value), m = document.getElementById('editLocMain').value.trim(), med = document.getElementById('editLocMedium').value.trim(), s = document.getElementById('editLocSmall').value.trim(); if(!m) return alert("❌「大區」不可為空！"); bootstrap.Modal.getInstance(document.getElementById('editLocModal')).hide(); const card = document.getElementById(`locCard_${rowIndex}`); if(card) { let displaySmall = s === "" ? smartConcatLoc(m, med, s) : s; card.innerHTML = `<div class="loc-card-header"><div><span class="badge bg-light text-dark border me-1">${escapeHTML(m)}</span>${med ? `<span class="badge bg-light text-dark border">${escapeHTML(med)}</span>` : ''}<span class="badge bg-warning text-dark ms-2" id="syncBadge_${rowIndex}">☁️ 同步中...</span></div><div><button class="btn btn-sm btn-outline-secondary py-0 px-2 me-1" disabled><i class="fas fa-edit"></i></button><button class="btn btn-sm btn-outline-danger py-0 px-2" onclick="deleteLoc(${rowIndex})"><i class="fas fa-trash"></i></button></div></div><div class="loc-card-title">${escapeHTML(displaySmall)}</div>`; } locUpdateQueue.push({ rowIndex: rowIndex, main: m, medium: med, small: s }); processLocQueue(); }
async function processLocQueue() { if (isLocSyncing || locUpdateQueue.length === 0) return; isLocSyncing = true; const updatesToProcess = [...locUpdateQueue]; locUpdateQueue = []; try { const newTree = await callAPI('batchUpdateLocations', { updates: updatesToProcess }); globalLocTree = newTree.locTree; mgrLocTree = newTree.mgrLocTree; renderLocationsList(mgrLocTree); showSyncToast(`✅ ${updatesToProcess.length} 筆地點已於背景更新完成`, true); } catch (e) { console.error("背景更新失敗", e); showSyncToast("⚠️ 部分地點背景更新失敗，將於下次重試", true); locUpdateQueue = [...updatesToProcess, ...locUpdateQueue]; renderLocationsList(mgrLocTree); } finally { isLocSyncing = false; if (locUpdateQueue.length > 0) { processLocQueue(); } } }
async function toggleLocStatus(rowIndex, setHidden) { showSyncToast('狀態更新同步中...'); let found = false; mgrLocTree.forEach(m => m.subs.forEach(s => s.details.forEach(d => { if(d.rowIndex === rowIndex) { d.isHidden = setHidden; found = true; } }))); if(found) renderLocationsList(mgrLocTree); try { const newTree = await callAPI('toggleLocStatus', { rowIndex: rowIndex, setHidden: setHidden }); globalLocTree = newTree.locTree; mgrLocTree = newTree.mgrLocTree; renderLocationsList(mgrLocTree); showSyncToast("✅ 狀態已同步", true); } catch(e) { alert("狀態切換失敗：" + e.message); showSyncToast("❌ 同步失敗", true); } }
async function deleteLoc(rowIndex) { if(!confirm("⚠️ 警告：確定要刪除這個地點嗎？")) return; showMiniLoading('刪除地點中...'); try { const newTree = await callAPI('deleteLocation', { rowIndex: rowIndex }); globalLocTree = newTree.locTree; mgrLocTree = newTree.mgrLocTree; renderLocationsList(mgrLocTree); } catch(e) { alert("刪除失敗：" + e.message); } finally { hideMiniLoading(); } }

// ================= 💡 藏品狀況報告表 核心邏輯 =================

function toggleOtherInput(chkId, txtId) {
    const chk = document.getElementById(chkId);
    const txt = document.getElementById(txtId);
    if (chk && txt) {
        txt.style.display = chk.checked ? 'inline-block' : 'none';
        if (!chk.checked) txt.value = '';
    }
}

function toggleMaintOpt() {
    const chk = document.getElementById('c_purp_1');
    const area = document.getElementById('c_purp_maint_opt_area');
    if (chk && area) {
        area.style.display = chk.checked ? 'inline-block' : 'none';
        if (!chk.checked) {
            document.getElementById('c_purp_maint_bf').checked = false;
            document.getElementById('c_purp_maint_af').checked = false;
        }
    }
}

function getCheckedValues(selector) {
    return Array.from(document.querySelectorAll(selector + ':checked')).map(cb => cb.value);
}

// 💡 修正問題 1：跳轉報告時無縫對接
function jumpToConditionReport() {
    const rawId = document.getElementById('qResId').innerText.trim();
    if(!rawId || rawId === '--') return alert("無法獲取藏品編號！");
    enterSystem('cond').then(() => { 
        setTimeout(() => {
            if(globalCatalog[rawId]) {
                selectCondTarget(rawId); 
            } else {
                alert("請先手動搜尋藏品。");
                openCondSearchModal();
            }
        }, 300); // 確保系統 UI 動畫完成再呼叫
    });
}

// 載入狀況報告歷史清單
async function loadConditionReports() {
    showMiniLoading('載入報告清單...');
    try {
        const reports = await callAPI('getConditionReports');
        condReportsCache = reports; 
        const container = document.getElementById('condReportListContainer');
        if(reports.length === 0) {
            container.innerHTML = '<div class="text-center text-muted py-4 small">目前尚無任何報告紀錄。</div>';
            return;
        }
        
        container.innerHTML = reports.map(r => {
            let badge = '';
            if(r.reportType === '1') badge = '<span class="badge bg-primary">例行檢視</span>';
            else if(r.reportType === '2') badge = '<span class="badge bg-warning text-dark">提借修復</span>';
            else badge = '<span class="badge bg-danger">廠商報告</span>';
            
            let photoIndicator = r.photos && r.photos.length > 0 ? `<span class="badge bg-light text-secondary border ms-1"><i class="fas fa-image"></i> ${r.photos.length}</span>` : '';

            let actionBtns = '';
            if (r.reportType === '3') {
                actionBtns = `<button class="btn btn-sm btn-outline-danger fw-bold w-100 mt-2" onclick="window.open('${escapeHTML(r.formData.fileUrl)}', '_blank')">🔗 檢視外部檔案</button>`;
            } else {
                actionBtns = `<div class="text-center mt-2 small text-primary fw-bold"><i class="fas fa-search"></i> 點擊預覽報告</div>`;
            }

            // 💡 修正問題 2：點擊卡片改為彈出預覽對話框
            return `
            <div class="card border-0 shadow-sm mb-2" ${r.reportType !== '3' ? `style="cursor:pointer;" onclick="openCondPreview('${escapeHTML(r.reportId)}')" ` : ''}>
                <div class="card-body p-3">
                    <div class="d-flex justify-content-between align-items-start mb-2">
                        <div class="fw-bold text-dark">${escapeHTML(r.itemId)}</div>
                        ${badge}
                    </div>
                    <div class="small text-primary fw-bold mb-1">${escapeHTML(r.itemName)}</div>
                    <div class="d-flex justify-content-between align-items-center mt-2 border-bottom pb-2">
                        <small class="text-muted"><i class="far fa-clock"></i> ${escapeHTML(r.timestamp)}</small>
                        <div>
                            <small class="text-muted me-2"><i class="far fa-user"></i> ${escapeHTML(r.managerName)}</small>
                            ${photoIndicator}
                        </div>
                    </div>
                    ${actionBtns}
                </div>
            </div>`;
        }).join('');
    } catch(e) {
        alert("載入報告失敗：" + e.message);
    } finally {
        hideMiniLoading();
    }
}

// 💡 修正問題 4：新增報告圖檔檢視 (Gallery) 功能
function openCondGallery() {
    bootstrap.Modal.getOrCreateInstance(document.getElementById('condGalleryModal')).show();
    renderCondGallery();
}

function renderCondGallery() {
    const container = document.getElementById('condGalleryContainer');
    let html = '';
    condReportsCache.forEach(r => {
        if (r.reportType !== '3' && r.photos && r.photos.length > 0) {
            html += `<div class="col-12"><h6 class="fw-bold text-dark border-bottom pb-2 mt-2">📄 ${escapeHTML(r.itemId)} - ${escapeHTML(r.itemName)} <br><small class="text-muted fw-normal">${escapeHTML(r.timestamp)}</small></h6></div>`;
            r.photos.forEach(url => {
                if (url) {
                    html += `
                    <div class="col-6 col-md-4 col-lg-3">
                        <div class="card border-0 shadow-sm h-100">
                            <img src="${url}" class="card-img-top" style="height: 150px; object-fit: cover; cursor:pointer;" onclick="window.open('${url}', '_blank')" alt="Photo">
                            <div class="card-body p-2 text-center">
                                <button class="btn btn-sm btn-outline-primary w-100 fw-bold" onclick="window.open('${url}', '_blank')"><i class="fas fa-external-link-alt"></i> 開啟原檔</button>
                            </div>
                        </div>
                    </div>`;
                }
            });
        }
    });
    if(html === '') html = '<div class="text-center text-muted w-100 py-4">目前沒有任何圖檔紀錄。</div>';
    container.innerHTML = html;
}

function openCondSearchModal() {
    document.getElementById('condSearchKw').value = '';
    document.getElementById('condSearchResult').innerHTML = '<div class="text-muted text-center py-3">請輸入藏品編號或名稱</div>';
    currentVkInputId = 'condSearchKw';
    closeVK();
    bootstrap.Modal.getOrCreateInstance(document.getElementById('condSearchModal')).show();
}

function searchCondItems() {
    const kwStr = document.getElementById('condSearchKw').value.toLowerCase().trim();
    const keywords = kwStr ? kwStr.split(/\s+/) : [];
    const container = document.getElementById('condSearchResult');
    
    if(keywords.length === 0) {
        container.innerHTML = '<div class="text-muted text-center py-3">請輸入藏品編號或名稱</div>';
        return;
    }
    
    let results = Object.values(globalCatalog).filter(item => {
        let targetStr = `${item.id} ${item.name}`.toLowerCase();
        return keywords.every(k => targetStr.includes(k));
    }).slice(0, 50);
    
    if(results.length === 0) {
        container.innerHTML = '<div class="text-muted text-center py-3">查無藏品</div>';
        return;
    }
    
    container.innerHTML = results.map(item => `
        <button class="list-group-item list-group-item-action p-3" onclick="selectCondTarget('${escapeHTML(item.id)}')">
            <div class="fw-bold text-primary">${escapeHTML(item.id)}</div>
            <div class="small text-dark">${escapeHTML(item.name)}</div>
            <div class="small text-muted mt-1">📍 ${escapeHTML(item.location)}</div>
        </button>
    `).join('');
}

function selectCondTarget(id) {
    const cat = globalCatalog[id];
    if(!cat) return;
    
    condCurrentItem = cat;
    let modalEl = document.getElementById('condSearchModal');
    if (modalEl) {
        let modalInstance = bootstrap.Modal.getInstance(modalEl);
        if (modalInstance) modalInstance.hide();
    }
    
    document.getElementById('condDashboard').style.display = 'none';
    document.getElementById('condFormArea').style.display = 'none';
    document.getElementById('condVendorUploadArea').style.display = 'none';
    
    document.getElementById('condTargetItemLabel').innerText = `${cat.id} - ${cat.name}`;
    document.getElementById('condScenarioSelect').style.display = 'block';
}

function backToCondDashboard(forceRefresh = false) {
    document.getElementById('condScenarioSelect').style.display = 'none';
    document.getElementById('condFormArea').style.display = 'none';
    document.getElementById('condVendorUploadArea').style.display = 'none';
    document.getElementById('condDashboard').style.display = 'block';
    if(forceRefresh) loadConditionReports();
}

function startCondReport(type) {
    condMode = type;
    document.getElementById('condScenarioSelect').style.display = 'none';
    
    if (type === 3) {
        document.getElementById('vendorReportInput').value = '';
        document.getElementById('vendorFileInfo').innerText = '';
        document.getElementById('condVendorUploadArea').style.display = 'block';
    } else {
        condPhotos = [];
        deletedCondPhotos = []; // 清空雲端刪除追蹤陣列
        removeMainPhoto();
        renderCondPhotos();
        document.getElementById('cf_reportId').value = ''; // 確保是新報告
        document.getElementById('condFormTitle').innerText = '📝 填寫新報告';
        
        // 清空表單
        let txtIds = [
            'cf_projectName', 'cf_oldId', 'cf_tf_purpose', 'cf_tf_outDate', 'cf_tf_outGiver', 
            'cf_tf_outTaker', 'cf_tf_inDate', 'cf_tf_inGiver', 'cf_tf_inTaker', 'cf_tf_note', 
            'cf_conditionDesc', 'cf_otherCond', 'cf_unit', 'cf_viewer', 'cf_tf_special',
            'c_app_other_txt', 'c_str_other_txt', 'c_med_other_txt', 'c_bio_other_txt',
            'c_pre_other_txt', 'c_tre_other_txt', 'c_loan_other_txt', 'c_purp_other_txt'
        ];
        txtIds.forEach(id => { let el = document.getElementById(id); if(el) { el.value = ''; el.style.display = el.id.includes('other_txt') ? 'none' : el.style.display; } });
        
        // 取消所有勾選
        document.querySelectorAll('.chk-appearance, .chk-structure, .chk-medium, .chk-bio, .chk-preserv, .chk-treat, .chk-loan, .chk-purp, .chk-tf-purp, .chk-tf-attach').forEach(cb => cb.checked = false);
        document.getElementById('c_purp_maint_opt_area').style.display = 'none';
        document.getElementById('c_purp_maint_bf').checked = false;
        document.getElementById('c_purp_maint_af').checked = false;
        let rate1 = document.getElementById('c_rate_1'); if(rate1) rate1.checked = false;
        let rate2 = document.getElementById('c_rate_2'); if(rate2) rate2.checked = false;
        let rate3 = document.getElementById('c_rate_3'); if(rate3) rate3.checked = false;
        let rate4 = document.getElementById('c_rate_4'); if(rate4) rate4.checked = false;
        
        // 帶入預設值
        document.getElementById('cf_newId').value = condCurrentItem.id;
        document.getElementById('cf_name').value = condCurrentItem.name;
        document.getElementById('cf_propNum').value = condCurrentItem.propNum || '';
        document.getElementById('cf_loc').value = condCurrentItem.location || '';
        document.getElementById('cf_material').value = condCurrentItem.formatMaterial || '';
        document.getElementById('cf_size').value = condCurrentItem.size || '';
        document.getElementById('cf_author').value = condCurrentItem.author || '';
        document.getElementById('cf_note').value = condCurrentItem.note || '';
        document.getElementById('cf_qty').value = '1';
        
        document.getElementById('cf_date').value = new Date().toISOString().split('T')[0];
        document.getElementById('cf_viewer').value = currentManager;
        
        document.getElementById('condTransferSection').style.display = (type === 2) ? 'block' : 'none';
        document.getElementById('condFormArea').style.display = 'block';
    }
}

// 💡 修正問題 2：新增預覽對話框機制
function openCondPreview(reportId) {
    const report = condReportsCache.find(r => r.reportId === reportId);
    if (!report) return alert("找不到報告資料");
    
    let photosForPrint = [];
    if(report.photos) {
        report.photos.forEach(url => {
            if(url) photosForPrint.push({ url: url, note: '歷史照片' });
        });
    }
    
    // 生成 A4 完美排版的 HTML
    let html = getCondPrintHtml(report.formData, photosForPrint, parseInt(report.reportType), null);
    document.getElementById('condPreviewContainer').innerHTML = html;
    
    // 更新按鈕 onclick
    document.getElementById('btnCondPreviewEdit').onclick = () => {
        bootstrap.Modal.getInstance(document.getElementById('condPreviewModal')).hide();
        editCondReport(reportId);
    };
    document.getElementById('btnCondPreviewPrint').onclick = () => {
        // 先將生成的 html 塞給正式列印用的容器，再呼叫 window.print
        document.getElementById('printCondContent').innerHTML = html;
        document.getElementById('printCondOverlay').style.display = 'flex';
        setTimeout(() => { window.print(); }, 300);
    };

    bootstrap.Modal.getOrCreateInstance(document.getElementById('condPreviewModal')).show();
}

function editCondReport(reportId) {
    const report = condReportsCache.find(r => r.reportId === reportId);
    if (!report) return alert("找不到該筆報告資料！");
    
    condCurrentItem = { id: report.itemId, name: report.itemName }; 
    condMode = parseInt(report.reportType);
    deletedCondPhotos = []; // 初始化被刪除照片追蹤陣列
    
    document.getElementById('condDashboard').style.display = 'none';
    document.getElementById('condFormTitle').innerText = '✏️ 編輯歷史報告';
    document.getElementById('cf_reportId').value = report.reportId;
    
    const d = report.formData;
    if(!d) return alert("報告資料遺失");

    const txtMapping = {
        'cf_projectName': 'projectName', 'cf_newId': 'newId', 'cf_oldId': 'oldId', 'cf_name': 'name',
        'cf_propNum': 'propNum', 'cf_loc': 'loc', 'cf_material': 'material', 'cf_size': 'size',
        'cf_author': 'author', 'cf_qty': 'qty', 'cf_note': 'note', 'cf_date': 'date', 'cf_unit': 'unit',
        'cf_viewer': 'viewer', 'cf_otherCond': 'otherCond', 'cf_conditionDesc': 'conditionDesc',
        'cf_tf_purpose': 'tf_purpose', 'cf_tf_outDate': 'tf_outDate', 'cf_tf_outGiver': 'tf_outGiver',
        'cf_tf_outTaker': 'tf_outTaker', 'cf_tf_inDate': 'tf_inDate', 'cf_tf_inGiver': 'tf_inGiver',
        'cf_tf_inTaker': 'tf_inTaker', 'cf_tf_note': 'tfNote', 'cf_tf_special': 'tfSpecial', 'cf_tf_date': 'tfDate'
    };
    for (let id in txtMapping) {
        let el = document.getElementById(id);
        if (el) el.value = d[txtMapping[id]] || '';
    }

    const restoreCheckboxes = (selector, valuesArray, otherTxtId, otherTxtValue) => {
        const arr = valuesArray || [];
        document.querySelectorAll(selector).forEach(cb => {
            cb.checked = arr.includes(cb.value);
        });
        if (otherTxtId) {
            let txtEl = document.getElementById(otherTxtId);
            if (arr.includes('其他')) {
                txtEl.style.display = 'inline-block';
                txtEl.value = otherTxtValue || '';
            } else {
                txtEl.style.display = 'none';
                txtEl.value = '';
            }
        }
    };

    restoreCheckboxes('.chk-appearance', d.appVals, 'c_app_other_txt', d.appOther);
    restoreCheckboxes('.chk-structure', d.strVals, 'c_str_other_txt', d.strOther);
    restoreCheckboxes('.chk-medium', d.medVals, 'c_med_other_txt', d.medOther);
    restoreCheckboxes('.chk-bio', d.bioVals, 'c_bio_other_txt', d.bioOther);
    restoreCheckboxes('.chk-preserv', d.preVals, 'c_pre_other_txt', d.preOther);
    restoreCheckboxes('.chk-treat', d.treVals, 'c_tre_other_txt', d.treOther);
    restoreCheckboxes('.chk-loan', d.loanVals, 'c_loan_other_txt', d.loanOther);
    restoreCheckboxes('.chk-tf-purp', d.tfPurpVals, null, null);
    restoreCheckboxes('.chk-tf-attach', d.tfAttach, null, null);

    restoreCheckboxes('.chk-purp', d.purpVals, 'c_purp_other_txt', d.purpOther);
    toggleMaintOpt();
    if (d.purpVals && d.purpVals.includes('維護')) {
        if (d.maintState === '修護前') document.getElementById('c_purp_maint_bf').checked = true;
        if (d.maintState === '修護後') document.getElementById('c_purp_maint_af').checked = true;
    }

    document.querySelectorAll('input[name="c_rating"]').forEach(rb => {
        rb.checked = (rb.value === d.rating);
    });

    removeMainPhoto();
    condPhotos = [];
    if (report.photos && report.photos.length > 0) {
        if (report.photos[0] && report.photos[0].includes('photo')) { 
            report.photos.forEach(url => {
                if (url) condPhotos.push({ base64: '', mimeType: '', url: url, note: '雲端歷史照片' });
            });
        }
    }
    renderCondPhotos();

    document.getElementById('condTransferSection').style.display = (condMode === 2) ? 'block' : 'none';
    document.getElementById('condFormArea').style.display = 'block';
}

function handleMainPhotoSelect(event) {
    const file = event.target.files[0];
    if (!file) return;
    showMiniLoading("處理全景照中...");
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (e) => {
        const img = new Image();
        img.src = e.target.result;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const MAX_WIDTH = 1200;
            let width = img.width, height = img.height;
            if (width > MAX_WIDTH) { height = Math.round((height * MAX_WIDTH) / width); width = MAX_WIDTH; }
            canvas.width = width; canvas.height = height;
            canvas.getContext('2d').drawImage(img, 0, 0, width, height);
            
            mainPhotoBase64 = canvas.toDataURL('image/jpeg', 0.7);
            mainPhotoMime = 'image/jpeg';
            
            document.getElementById('cf_mainPhotoContainer').innerHTML = `<img src="${mainPhotoBase64}" class="img-fluid rounded border shadow-sm" style="max-height: 200px;">`;
            document.getElementById('cf_mainPhotoRemove').style.display = 'inline-block';
            document.getElementById('cf_mainPhotoInput').value = ''; 
            hideMiniLoading();
        };
    };
}

// 🔥 修正：主圖移除時，如果是雲端歷史圖，必須推入刪除追蹤陣列
function removeMainPhoto() {
    mainPhotoBase64 = "";
    mainPhotoMime = "";
    document.getElementById('cf_mainPhotoContainer').innerHTML = "";
    document.getElementById('cf_mainPhotoRemove').style.display = 'none';
}

function handleCondPhotoSelect(event) {
    const file = event.target.files[0];
    if (!file) return;
    showMiniLoading("處理狀況圖示中...");
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (e) => {
        const img = new Image();
        img.src = e.target.result;
        img.onload = () => {
            const MAX_WIDTH = 1200;
            let width = img.width, height = img.height;
            if (width > MAX_WIDTH) { height = Math.round((height * MAX_WIDTH) / width); width = MAX_WIDTH; }
            const canvas = document.createElement('canvas');
            canvas.width = width; canvas.height = height;
            canvas.getContext('2d').drawImage(img, 0, 0, width, height);
            
            pendingPhotoBase64 = canvas.toDataURL('image/jpeg', 0.7);
            document.getElementById('photoAnnotationPreview').src = pendingPhotoBase64;
            document.getElementById('photoAnnotationText').value = '';
            document.getElementById('cf_photoInput').value = ''; 
            hideMiniLoading();
            bootstrap.Modal.getOrCreateInstance(document.getElementById('photoAnnotationModal')).show();
        };
    };
}

function cancelPhotoAnnotation() {
    pendingPhotoBase64 = "";
    document.getElementById('photoAnnotationPreview').src = "";
    document.getElementById('photoAnnotationText').value = '';
}

function confirmPhotoAnnotation() {
    const note = document.getElementById('photoAnnotationText').value.trim();
    if (pendingPhotoBase64) {
        condPhotos.push({
            base64: pendingPhotoBase64.split(',')[1],
            mimeType: 'image/jpeg',
            note: note,
            url: ''
        });
        renderCondPhotos();
    }
    bootstrap.Modal.getInstance(document.getElementById('photoAnnotationModal')).hide();
}

function renderCondPhotos() {
    const container = document.getElementById('cf_photoContainer');
    if (condPhotos.length === 0) {
        container.innerHTML = '<div class="text-muted small p-2">尚未新增狀況圖示。</div>';
        return;
    }
    container.innerHTML = condPhotos.map((p, idx) => {
        let imgSrc = p.base64 ? `data:${p.mimeType || 'image/jpeg'};base64,${p.base64}` : p.url;
        return `
        <div class="cond-photo-thumb" style="width: 120px;">
            <button class="btn-close" onclick="removeCondPhoto(${idx})"></button>
            <img src="${imgSrc}" alt="photo" style="height:80px; object-fit:cover;">
            <div class="cond-photo-note" title="${escapeHTML(p.note)}">${escapeHTML(p.note) || '無註記'}</div>
        </div>`;
    }).join('');
}

// 🔥 修正問題 5：移除舊照片時，紀錄 URL 以便雲端同步刪除
function removeCondPhoto(idx) {
    if(confirm('確定要移除這張圖示嗎？(若是雲端歷史照片，儲存後將同步刪除原檔)')) { 
        let targetPhoto = condPhotos[idx];
        if (targetPhoto.url) {
            deletedCondPhotos.push(targetPhoto.url); // 推入刪除追蹤陣列
        }
        condPhotos.splice(idx, 1); 
        renderCondPhotos(); 
    }
}

function getFormData() {
    return {
        projectName: document.getElementById('cf_projectName').value,
        newId: document.getElementById('cf_newId').value,
        oldId: document.getElementById('cf_oldId').value,
        name: document.getElementById('cf_name').value,
        propNum: document.getElementById('cf_propNum').value,
        loc: document.getElementById('cf_loc').value,
        material: document.getElementById('cf_material').value,
        size: document.getElementById('cf_size').value,
        author: document.getElementById('cf_author').value,
        qty: document.getElementById('cf_qty').value,
        note: document.getElementById('cf_note').value,
        
        appVals: getCheckedValues('.chk-appearance'),
        appOther: document.getElementById('c_app_other_txt').value,
        strVals: getCheckedValues('.chk-structure'),
        strOther: document.getElementById('c_str_other_txt').value,
        medVals: getCheckedValues('.chk-medium'),
        medOther: document.getElementById('c_med_other_txt').value,
        bioVals: getCheckedValues('.chk-bio'),
        bioOther: document.getElementById('c_bio_other_txt').value,
        
        otherCond: document.getElementById('cf_otherCond').value,
        
        rating: document.querySelector('input[name="c_rating"]:checked') ? document.querySelector('input[name="c_rating"]:checked').value : '',
        
        preVals: getCheckedValues('.chk-preserv'),
        preOther: document.getElementById('c_pre_other_txt').value,
        treVals: getCheckedValues('.chk-treat'),
        treOther: document.getElementById('c_tre_other_txt').value,
        loanVals: getCheckedValues('.chk-loan'),
        loanOther: document.getElementById('c_loan_other_txt').value,
        
        purpVals: getCheckedValues('.chk-purp'),
        purpOther: document.getElementById('c_purp_other_txt').value,
        maintState: document.querySelector('input[name="maint_state"]:checked') ? document.querySelector('input[name="maint_state"]:checked').value : '',
        
        date: document.getElementById('cf_date').value,
        unit: document.getElementById('cf_unit').value,
        viewer: document.getElementById('cf_viewer').value,
        
        tfPurpVals: getCheckedValues('.chk-tf-purp'),
        tfDate: document.getElementById('cf_tf_date').value,
        tfAttach: getCheckedValues('.chk-tf-attach'),
        tfSpecial: document.getElementById('cf_tf_special').value,
        tfNote: document.getElementById('cf_tf_note').value
    };
}

// 💡 修正問題 3 & 4 & 5：狀況報告儲存後導流列印，並加上雲端刪除通知
async function submitConditionReport() {
    const d = getFormData();
    if(!d.date || !d.viewer) return alert("請填寫檢視紀錄的「日期」與「人員」！");
    
    let allPhotos = [...condPhotos];
    if (mainPhotoBase64) {
        allPhotos.unshift({ base64: mainPhotoBase64.split(',')[1], mimeType: mainPhotoMime, note: 'MAIN_PHOTO', url: '' });
    }
    
    let rId = document.getElementById('cf_reportId').value;

    const payload = {
        reportId: rId || null,
        managerName: currentManager,
        itemId: condCurrentItem.id,
        itemName: condCurrentItem.name,
        reportType: condMode.toString(),
        formData: d,
        photos: allPhotos,
        deletedPhotos: deletedCondPhotos // 傳送需刪除的雲端檔案 URL 清單
    };

    showMiniLoading('正在儲存報告與雲端檔案管理中...');
    try {
        const res = await callAPI('saveConditionReport', payload);
        document.getElementById('cf_reportId').value = res.reportId;
        
        // 儲存成功後自動開啟列印預覽
        printConditionReport();
    } catch(e) { alert("儲存失敗：" + e.message); } finally { hideMiniLoading(); }
}

// 💡 修正問題 5：將 ☑ 改為 ■ / □，提供更佳的實體列印辨識度
function buildCheckStr(options, selectedVals, otherTxt) {
    if(!selectedVals) selectedVals = [];
    return options.map(opt => {
        let isChecked = selectedVals.includes(opt) ? '■' : '□';
        if(opt === '其他') { return `${isChecked} 其他：<u>&nbsp;${escapeHTML(selectedVals.includes('其他') ? (otherTxt||'') : '')}&nbsp;</u>`; }
        return `${isChecked} ${escapeHTML(opt)}`;
    }).join('&nbsp;&nbsp;');
}

function printConditionReport() {
    let html = getCondPrintHtml(getFormData(), condPhotos, condMode, mainPhotoBase64);
    document.getElementById('printCondContent').innerHTML = html;
    
    // 強制隱藏其他圖層，防止疊加
    document.getElementById('printOverlay').style.display = 'none';
    document.getElementById('printReportOverlay').style.display = 'none';
    
    document.getElementById('printCondOverlay').style.display = 'flex';
}

// 🔥 修正問題 5：抽出核心排版函數，並將照片排版改為 2欄3列 CSS Grid 網格
function getCondPrintHtml(d, photosArray, mode, currentMainBase64 = null) {
    let mainPhotoImgTag = '<span class="text-muted small">無圖片</span>';
    let detailPhotos = [...photosArray];
    
    if (currentMainBase64) {
        mainPhotoImgTag = `<img src="${currentMainBase64}" style="max-width:100%; max-height:100%; object-fit:contain;">`;
    } 
    else if (detailPhotos.length > 0 && detailPhotos[0].note === 'MAIN_PHOTO') {
        let mainP = detailPhotos.shift();
        mainPhotoImgTag = `<img src="${mainP.url}" style="max-width:100%; max-height:100%; object-fit:contain;">`;
    }

    let appOpts = ['灰塵','異物','氧化','黃化','漬痕','膠帶','標籤','前人修補','其他'];
    let strOpts = ['變形','脆化','鬆脫','缺失','刮痕','摺痕','裂痕','斷裂','其他'];
    let medOpts = ['變色','褪色','掉色','剝落','移染','霧化','硬化','其他'];
    let bioOpts = ['發霉','褐斑','蛀孔','嚙咬','排遺','卵鞘','其他'];
    let preOpts = ['修護處理','現況保存','維護包裝','溫濕度控制','光照控制','隔離存放','非文保人員檢視(不予建議)','其他'];
    let treOpts = ['除膠帶或標籤','外觀修護','結構修護','媒材修護','生物性修護','非文保人員檢視(不予建議)','其他'];
    let loanOpts = ['尚可借出展示','不建議借出展示','館方人員檢視(不予建議)','其他'];
    
    let purpVals = d.purpVals || [];
    let isMaint = purpVals.includes('維護');
    let bfMark = (isMaint && d.maintState === '修護前') ? '<span class="circle-mark">前</span>' : '前';
    let afMark = (isMaint && d.maintState === '修護後') ? '<span class="circle-mark">後</span>' : '後';
    let maintOptHtml = `${isMaint?'■':'□'} 維護(${bfMark}/${afMark})`;
    let purpOptHtml = ['提借','返還'].map(o => `${purpVals.includes(o)?'■':'□'} ${o}`).join('&nbsp;&nbsp;');
    let purpOtherHtml = `${purpVals.includes('其他')?'■':'□'} 其他：<u>&nbsp;${escapeHTML(purpVals.includes('其他')?d.purpOther:'')}&nbsp;</u>`;
    let finalPurpStr = `${maintOptHtml}&nbsp;&nbsp;${purpOptHtml}&nbsp;&nbsp;${purpOtherHtml}`;

    let rateOpts = ['1良好(無修護需求)','2尚可(需維護處理)','3不佳(需修護處理)','4緊急(需優先處理)'];
    let rateStr = rateOpts.map(o => `${d.rating === o ? '■' : '□'} ${escapeHTML(o)}`).join('&nbsp;&nbsp;');

    // 🔥 修正問題 5：重構照片排版為完美對齊的 2 欄多列網格 (Grid)
    let condPhotosHtml = detailPhotos.length === 0 ? '<div style="height:30px;"></div>' : '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">' + detailPhotos.map(p => {
        let imgSrc = p.base64 ? `data:${p.mimeType};base64,${p.base64}` : p.url;
        return `
        <div style="border: 1px solid #999; page-break-inside: avoid; border-radius:4px; overflow:hidden; display:flex; flex-direction:column;">
            <div style="border-bottom: 1px solid #999; padding: 5px; background:#fefefe; text-align: center; height: 150px;">
                <img src="${imgSrc}" style="max-width: 100%; max-height: 140px; object-fit: contain;">
            </div>
            <div style="padding: 5px; font-size: 9pt; white-space: pre-wrap; background: #fff;">
                ${escapeHTML(p.note || '')}
            </div>
        </div>`;
    }).join('') + '</div>';

    let dateSafe = d.date ? d.date.replace(/-/g, '/') : '';
    let tfDateSafe = d.tfDate ? d.tfDate.replace(/-/g, '/') : '';
    let tfAttach = d.tfAttach || [];
    let tfPurpVals = d.tfPurpVals || [];

    let html = `
    <div class="cond-print-paper">
        <div class="text-end fw-bold mb-2">附件 1</div>
        <h4 class="text-center fw-bold mb-4">國立中正紀念堂管理處藏品狀況報告表</h4>
        <div class="fw-bold mb-2">【案名: ${escapeHTML(d.projectName || '')}】</div>
        
        <h6 class="fw-bold mb-1">一、藏品基本資料</h6>
        <table class="cond-pdf-table">
            <tr><th width="15%">藏品新編號</th><td width="35%">${escapeHTML(d.newId||'')}</td><th width="50%" colspan="2" class="text-center">藏品圖片</th></tr>
            <tr><th>藏品舊編號</th><td>${escapeHTML(d.oldId||'')}</td><td colspan="2" rowspan="5" class="text-center align-middle p-2" style="height: 180px;">${mainPhotoImgTag}</td></tr>
            <tr><th>藏品名稱</th><td>${escapeHTML(d.name||'')}</td></tr>
            <tr><th>藏品儲位</th><td>${escapeHTML(d.loc||'')}</td></tr>
            <tr><th>財產編號</th><td>${escapeHTML(d.propNum||'')}</td></tr>
            <tr><th>作者/捐贈者</th><td>${escapeHTML(d.author||'')}</td></tr>
            <tr><th>型制/材質</th><td>${escapeHTML(d.material||'')}</td><th width="15%">數量</th><td width="35%">${escapeHTML(d.qty||'1')}</td></tr>
            <tr><th>尺寸</th><td colspan="3">${escapeHTML(d.size||'')}</td></tr>
            <tr><th>備註</th><td colspan="3">${escapeHTML(d.note||'')}</td></tr>
        </table>

        <h6 class="fw-bold mb-1 mt-3">二、狀況描述、位置圖示及保存建議</h6>
        <table class="cond-pdf-table">
            <tr><th width="12%">外觀</th><td colspan="3" class="small">${buildCheckStr(appOpts, d.appVals, d.appOther)}</td></tr>
            <tr><th>結構</th><td colspan="3" class="small">${buildCheckStr(strOpts, d.strVals, d.strOther)}</td></tr>
            <tr><th>媒材</th><td colspan="3" class="small">${buildCheckStr(medOpts, d.medVals, d.medOther)}</td></tr>
            <tr><th>生物性</th><td colspan="3" class="small">${buildCheckStr(bioOpts, d.bioVals, d.bioOther)}</td></tr>
            <tr><th>其他</th><td colspan="3" style="height: 50px; vertical-align:top; white-space:pre-wrap;">${escapeHTML(d.otherCond||'')}</td></tr>
            <tr>
                <th>狀況圖示<br><div class="text-start fw-normal mt-2 small">說明:</div></th>
                <td colspan="3" class="p-2 border-0" style="border-bottom: 1px solid #000 !important; border-right: 1px solid #000 !important;">
                    ${condPhotosHtml}
                </td>
            </tr>
            <tr><th>分級</th><td colspan="3" class="small">${rateStr}</td></tr>
            <tr><th>保存建議</th><td colspan="3" class="small">${buildCheckStr(preOpts, d.preVals, d.preOther)}</td></tr>
            <tr><th>修護建議</th><td colspan="3" class="small">${buildCheckStr(treOpts, d.treVals, d.treOther)}</td></tr>
            <tr><th>借展建議</th><td colspan="3" class="small">${buildCheckStr(loanOpts, d.loanVals, d.loanOther)}</td></tr>
            <tr><th>檢視目的</th><td colspan="3" class="small">${finalPurpStr}</td></tr>
            <tr>
                <th>檢視記錄</th>
                <td colspan="3">
                    <span class="me-5">單位: ${escapeHTML(d.unit||'')}</span>
                    <span class="me-5">人員: ${escapeHTML(d.viewer||'')}</span>
                    <span>日期: ${escapeHTML(dateSafe)}</span>
                </td>
            </tr>
        </table>
        <div class="text-end small text-muted">第 1 頁 / 共 2 頁</div>`;

    if (mode === 2) {
        html += `
        <div style="page-break-before: always;"></div>
        <h6 class="fw-bold mb-1 mt-4">三、提借/還藏紀錄</h6>
        <table class="cond-pdf-table">
            <tr>
                <th width="15%">檢視目的</th>
                <td width="35%">
                    ${tfPurpVals.includes('提借')?'■':'□'} 提借 &nbsp; 
                    ${tfPurpVals.includes('返還')?'■':'□'} 返還
                </td>
                <th width="15%">日期:</th>
                <td width="35%">${escapeHTML(tfDateSafe)}</td>
            </tr>
            <tr>
                <th>附件</th>
                <td colspan="3">${tfAttach.includes('提借清單或相關公文')?'■':'□'} 提借清單或相關公文</td>
            </tr>
            <tr><th>特別聲明</th><td colspan="3" style="height: 80px; vertical-align:top; white-space:pre-wrap;">${escapeHTML(d.tfSpecial||'')}</td></tr>
            <tr><th>備註</th><td colspan="3" style="height: 80px; vertical-align:top; white-space:pre-wrap;">${escapeHTML(d.tfNote||'')}</td></tr>
            <tr>
                <td colspan="2" style="height: 200px; vertical-align: top;" class="text-center">
                    <div class="fw-bold mt-2 fs-5">提借還藏單位</div>
                </td>
                <td colspan="2" style="height: 200px; vertical-align: top;" class="text-center">
                    <div class="fw-bold mt-2 fs-5">典藏單位</div>
                </td>
            </tr>
        </table>
        <div class="text-end small text-muted mt-1">第 2 頁 / 共 2 頁</div>`;
    }

    html += `</div>`;
    return html;
}

// 💡 修正問題 3：列印後導流機制
function closePrintCondOverlay() { 
    document.getElementById('printCondOverlay').style.display = 'none'; 
    bootstrap.Modal.getOrCreateInstance(document.getElementById('condPostPrintModal')).show();
}

function closePostPrintAndReturn() {
    bootstrap.Modal.getInstance(document.getElementById('condPostPrintModal')).hide();
    backToCondDashboard(true); // true 代表強制刷新
}

// ================= 廠商報告上傳邏輯 =================
let vendorFileData = null;
function handleVendorFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) return alert("檔案不可超過 10MB！"); 
    
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (e) => {
        vendorFileData = {
            fileName: file.name,
            mimeType: file.type,
            base64: e.target.result.split(',')[1]
        };
        document.getElementById('vendorFileInfo').innerText = `已選擇檔案：${file.name} (${(file.size/1024/1024).toFixed(2)} MB)`;
    };
}

async function submitVendorReport() {
    if (!vendorFileData) return alert("請先選擇要上傳的檔案！");
    
    const payload = {
        managerName: currentManager,
        itemId: condCurrentItem.id,
        itemName: condCurrentItem.name,
        fileName: vendorFileData.fileName,
        mimeType: vendorFileData.mimeType,
        fileBase64: vendorFileData.base64
    };

    showMiniLoading('正在將檔案安全上傳至 Google Drive ...');
    try {
        const res = await callAPI('uploadVendorReport', payload);
        alert(`✅ 檔案上傳成功！\n紀錄已建立完成，可於歷史清單中檢視。`);
        backToCondDashboard(true);
    } catch(e) {
        alert("上傳失敗：" + e.message);
    } finally {
        hideMiniLoading();
    }
}
