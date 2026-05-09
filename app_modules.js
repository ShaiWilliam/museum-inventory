// ================= 💡 動態注入新增的 UI 介面 (不需修改 index.html) =================
document.addEventListener("DOMContentLoaded", () => {
    const dynamicModals = `
    <datalist id="officialLocDatalist"></datalist>

    <div class="modal fade" id="mvPreviewModal" tabindex="-1" data-bs-backdrop="static">
        <div class="modal-dialog modal-dialog-centered modal-lg modal-dialog-scrollable">
            <div class="modal-content border-0 shadow-lg">
                <div class="modal-header bg-light">
                    <h5 class="modal-title fw-bold text-success"><i class="fas fa-truck-loading"></i> 搬運前最終確認</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body p-3">
                    <div class="alert alert-success small py-2 mb-3">
                        下方已帶入「預計搬運地點」。若現場實際放置位置不同，可直接點擊下拉選擇或手動輸入新地點。
                    </div>
                    <div id="mvPreviewList" class="d-flex flex-column gap-3"></div>
                </div>
                <div class="modal-footer bg-light d-flex justify-content-between">
                    <button class="btn btn-outline-secondary fw-bold" data-bs-dismiss="modal">🔙 返回修改</button>
                    <button class="btn btn-success fw-bold px-4 shadow-sm" id="btnConfirmBulkMove" onclick="confirmBulkMovement()">📤 全數確認送出</button>
                </div>
            </div>
        </div>
    </div>

    <div class="modal fade" id="handoffModal" tabindex="-1">
        <div class="modal-dialog modal-dialog-centered">
            <div class="modal-content border-0 shadow-lg text-center">
                <div class="modal-header bg-light justify-content-center">
                    <h5 class="modal-title fw-bold text-primary"><i class="fas fa-exchange-alt"></i> 雲端交接碼</h5>
                </div>
                <div class="modal-body p-4">
                    <p class="text-muted small mb-3">請接手同仁掃描下方 QR Code，或輸入 4 位數交接碼</p>
                    <h1 class="display-1 fw-bold text-dark letter-spacing-2 mb-3" id="handoffPinDisplay">----</h1>
                    <div class="bg-white p-2 d-inline-block border rounded shadow-sm mb-3">
                        <img id="handoffQrImage" src="" alt="QR Code" style="width: 200px; height: 200px;">
                    </div>
                    <div class="alert alert-warning py-2 small mb-0">交接碼將於 4 小時後自動失效</div>
                </div>
                <div class="modal-footer bg-light justify-content-center">
                    <button class="btn btn-secondary fw-bold px-4" data-bs-dismiss="modal">關閉視窗</button>
                </div>
            </div>
        </div>
    </div>
    `;
    document.body.insertAdjacentHTML('beforeend', dynamicModals);

    // 在執行搬運 Phase 1 插入「模糊搜尋」與「交接碼」介面
    const phase1 = document.getElementById('mvPhase1');
    if(phase1) {
        const searchUI = `
        <div class="mb-3 pt-3 border-top fade-in-section">
            <div class="d-flex justify-content-between align-items-center mb-2">
                <label class="form-label text-primary fw-bold mb-0">🔍 快速找物 (模糊搜尋)</label>
                <div>
                    <button class="btn btn-sm btn-outline-info fw-bold me-1" onclick="generateHandoff()"><i class="fas fa-share-square"></i> 產生交接碼</button>
                    <button class="btn btn-sm btn-info fw-bold text-white" onclick="resumeHandoffPrompt()"><i class="fas fa-qrcode"></i> 接手進度</button>
                </div>
            </div>
            <input type="search" id="mvSearchKw" class="form-control border-primary" placeholder="輸入臨時編碼、藏品編號或名稱..." onkeyup="searchWorkerItems()" onsearch="searchWorkerItems()">
        </div>`;
        phase1.insertAdjacentHTML('beforeend', searchUI);
    }
});

// 建立全域 Datalist 供快速選取官方地點
function populateOfficialLocDatalist() {
    let datalist = document.getElementById('officialLocDatalist');
    if(!datalist) return;
    let html = '';
    mgrLocTree.forEach(m => m.subs.forEach(s => s.details.forEach(d => {
        if(!d.isHidden) html += `<option value="${escapeHTML(d.val)}"></option>`;
    })));
    datalist.innerHTML = html;
}

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

// ================= 💡 異動搬運模組 (專案建立與匯入) =================
// 包含 4 欄匯入序列解析：臨時編碼、藏品編號、名稱、預計搬運地點
function openImportModal() { document.getElementById('importTextarea').value = ''; document.getElementById('importPreviewSection').style.display = 'none'; parsedImportItems = []; bootstrap.Modal.getOrCreateInstance(document.getElementById('importModal')).show(); }

function parseImportData() {
    const raw = document.getElementById('importTextarea').value.trim(); if(!raw) return alert("請先貼上資料！"); parsedImportItems = []; const lines = raw.split('\n');
    lines.forEach(line => {
        if(!line.trim()) return; let cols = line.includes('\t') ? line.split('\t') : line.split(','); cols = cols.map(c => c.trim()); if (cols.length === 0) return;
        let parsedTempCode = '', parsedId = '', parsedName = '', parsedExpectedLoc = '';
        if (cols.length === 1) { parsedId = cols[0]; } else {
            parsedTempCode = cols[0]; parsedId = cols[1]; 
            parsedName = cols.length > 2 ? cols[2] : '';
            parsedExpectedLoc = cols.length > 3 ? cols[3] : ''; // 💡 解析第四欄預計地點
        }
        if (!parsedId) return;
        let existingBase = allMvItems.find(x => x.id === parsedId || x.id.split('\n')[0] === parsedId), finalId = parsedId, partDesc = [];
        if (parsedTempCode) partDesc.push(parsedTempCode); if (parsedName && (!existingBase || parsedName !== existingBase.name)) partDesc.push(parsedName);
        if (partDesc.length > 0) { finalId = parsedId + "\n[" + partDesc.join(' - ') + "]"; }
        let inCart = newMvCart.has(finalId), status = 'match', loc = '未知', oldTc = '';
        if (existingBase) { parsedName = parsedName || existingBase.name; loc = existingBase.loc; if (inCart) { let cartItem = newMvCart.get(finalId); oldTc = cartItem.tempCode || ''; if (parsedTempCode && oldTc && oldTc !== parsedTempCode) { status = 'conflict'; } else { status = 'duplicate'; } } } else { status = 'unmatched'; }
        
        parsedImportItems.push({ originalId: parsedId, finalId: finalId, name: parsedName || '未知名稱', loc: loc, tempCode: parsedTempCode, oldTc: oldTc, status: status, isMisc: false, expectedLoc: parsedExpectedLoc || '待定' });
    });
    renderImportPreview(); document.getElementById('importPreviewSection').style.display = 'block';
}

function renderImportPreview() {
    let html = '', matchCount = 0, unmatchedCount = 0, dupCount = 0;
    parsedImportItems.forEach(item => {
        let statusBadge = '', trClass = '', tcHtml = '', locColumnHtml = escapeHTML(item.loc);
        if (item.status === 'match') { statusBadge = '<span class="badge bg-success">✅ 成功</span>'; matchCount++; if(item.tempCode) tcHtml = `<br><span class="badge bg-info text-dark mt-1"><i class="fas fa-tag"></i> ${escapeHTML(item.tempCode)}</span>`; } else if (item.status === 'duplicate') { statusBadge = '<span class="badge bg-secondary">🔄 已在清單</span>'; trClass = 'table-secondary text-muted'; dupCount++; if(item.tempCode) tcHtml = `<br><span class="badge bg-info text-dark mt-1"><i class="fas fa-tag"></i> ${escapeHTML(item.tempCode)}</span>`; } else if (item.status === 'conflict') { statusBadge = '<span class="badge bg-warning text-dark">⚠️ 編碼衝突</span>'; trClass = 'table-warning'; dupCount++; tcHtml = `<br><small class="text-danger fw-bold">原: [${escapeHTML(item.oldTc)}] ➔ 匯入: [${escapeHTML(item.tempCode)}]</small><br><input type="text" class="form-control form-control-sm mt-1 conflict-tc-input" data-id="${escapeHTML(item.finalId)}" value="${escapeHTML(item.oldTc)}" placeholder="確認編碼">`; } else if (item.status === 'unmatched') { statusBadge = '<span class="badge bg-danger">❌ 查無此物</span>'; trClass = 'table-danger'; unmatchedCount++; } else if (item.status === 'misc') { statusBadge = '<span class="badge bg-warning text-dark">📦 轉為雜物</span>'; trClass = 'table-warning'; matchCount++; if(item.tempCode) tcHtml = `<br><span class="badge bg-info text-dark mt-1"><i class="fas fa-tag"></i> ${escapeHTML(item.tempCode)}</span>`; locColumnHtml = `<div class="input-group input-group-sm"><input type="text" class="form-control bg-white text-danger fw-bold" readonly placeholder="點選或掃描..." value="${escapeHTML(item.loc)}" onclick="triggerImportMiscLoc('${escapeHTML(item.finalId)}')"><button class="btn btn-outline-danger" type="button" onclick="startImportLocScanner('${escapeHTML(item.finalId)}')"><i class="fas fa-qrcode"></i></button></div>`; }
        let displayId = item.finalId.replace(/\n/g, ' '); 
        html += `<tr class="${trClass}"><td>${statusBadge}</td><td class="fw-bold text-start">${escapeHTML(displayId)}${tcHtml}</td><td class="text-start">${escapeHTML(item.name)}<br><small class="text-primary fw-bold">預計搬往: ${escapeHTML(item.expectedLoc)}</small></td><td class="align-middle" style="min-width: 140px;">${locColumnHtml}</td></tr>`;
    });
    document.getElementById('importPreviewTableBody').innerHTML = html || '<tr><td colspan="4" class="text-center">無有效資料</td></tr>'; document.getElementById('importStats').innerHTML = `共 ${parsedImportItems.length} 筆資料 (✅ 可匯入: ${matchCount} | ❌ 未知: ${unmatchedCount} | 🔄 重複/衝突: ${dupCount})`;
    const btnMisc = document.getElementById('btnConvertMisc'), warnMsg = document.getElementById('importWarningMsg');
    if (unmatchedCount > 0) { btnMisc.style.display = 'inline-block'; warnMsg.style.display = 'block'; } else { btnMisc.style.display = 'none'; warnMsg.style.display = 'none'; }
    let hasMissingLoc = parsedImportItems.some(i => i.status === 'misc' && !i.loc); document.getElementById('btnConfirmImport').disabled = (matchCount === 0 && document.querySelectorAll('.conflict-tc-input').length === 0) || hasMissingLoc;
}

function confirmImport() {
    let importCount = 0, missingLoc = false; parsedImportItems.forEach(item => { if (item.status === 'misc' && !item.loc) missingLoc = true; }); if (missingLoc) { return alert("請為所有轉換的雜物選擇或掃描「所在地點」！"); }
    document.querySelectorAll('.conflict-tc-input').forEach(input => { let id = input.getAttribute('data-id'), item = parsedImportItems.find(x => x.finalId === id); if(item) { item.tempCode = input.value; item.status = 'match'; } });
    parsedImportItems.forEach(item => { if (item.status === 'match' || item.status === 'misc') { 
        if (item.isMisc && !allMvItems.find(x => x.id === item.finalId)) { allMvItems.unshift({ id: item.finalId, name: item.name, loc: item.loc, isMisc: true, tempCode: item.tempCode, expectedLoc: item.expectedLoc }); } 
        // 💡 存入購物車時附帶 expectedLoc
        newMvCart.set(item.finalId, { name: item.name, loc: item.loc, isMisc: item.isMisc, tempCode: item.tempCode, expectedLoc: item.expectedLoc }); 
        if (!item.isMisc) { let existing = allMvItems.find(x => x.id === item.finalId); if(!existing) { allMvItems.unshift({ id: item.finalId, name: item.name, loc: item.loc, isMisc: false, tempCode: item.tempCode, expectedLoc: item.expectedLoc }); } else { existing.tempCode = item.tempCode; } } importCount++; 
    } });
    saveMvDraft(); bootstrap.Modal.getInstance(document.getElementById('importModal')).hide(); document.getElementById('newMvSelectedCount').innerText = newMvCart.size; filterNewMvList(); showSyncToast(`✅ 成功匯入/更新 ${importCount} 筆項目！`, true);
}

async function submitNewProject() {
    const action = document.getElementById('newMvActionSelect').value, pName = document.getElementById('newMvName').value.trim(), pDesc = document.getElementById('newMvDesc').value.trim();
    if(!pName) return alert("請輸入專案名稱！"); if(newMvCart.size === 0) return alert("請至少挑選一件待搬運文物！"); showMiniLoading('正在儲存專案與清單資料...');
    let miscDetails = {}, tempCodes = {}, expectedLocs = {}; 
    newMvCart.forEach((val, key) => { miscDetails[key] = val; if (val.tempCode) tempCodes[key] = val.tempCode; if (val.expectedLoc) expectedLocs[key] = val.expectedLoc; });
    try { await callAPI('saveMovementProject', { eventId: action, name: pName, desc: pDesc, itemIds: Array.from(newMvCart.keys()), miscDetails: miscDetails, tempCodes: tempCodes, expectedLocs: expectedLocs, manager: currentManager }); clearMvDraft(); alert('✅ 專案資料儲存成功！'); refreshSystem('move'); } catch (e) { alert("專案儲存失敗：" + e.message); } finally { hideMiniLoading(); }
}

// ================= 💡 執行搬運 (預覽修改地點、模糊搜尋、雲端接手) =================
async function loadWorkerLocations() {
    const eid = document.getElementById('mvEvent').value; currentMvEventId = eid; 
    if (!eid) { document.getElementById('mvLocSelector').style.display = 'none'; document.getElementById('mvProgressBox').style.display = 'none'; document.getElementById('mvPhase2').style.display = 'none'; document.getElementById('mvPhase3').style.display = 'none'; return; }
    showMiniLoading('載入專案資料中...');
    try {
        const res = await callAPI('getProjectPendingData', { eventId: eid }); 
        currentProjectItems = res.items || []; 
        
        // 💡 在前端比對官方樹狀圖，動態生成「未知舊地點」分類
        let flatOfficialLocs = new Set();
        mgrLocTree.forEach(m => m.subs.forEach(s => s.details.forEach(d => flatOfficialLocs.add(d.val))));
        let validLocs = new Set(), invalidLocs = new Set();
        currentProjectItems.forEach(item => { if(flatOfficialLocs.has(item.loc)) validLocs.add(item.loc); else invalidLocs.add(item.loc); });
        
        let customTree = res.locTree || [];
        if(invalidLocs.size > 0) {
            customTree.push({ main: "📁 未分類 / 舊有地點", subs: [{ sub: "(需注意)", details: Array.from(invalidLocs).sort().map(loc => ({ label: loc, val: loc })) }] });
        }
        pendingLocTree = customTree; 

        document.getElementById('mvProgressBox').style.display = 'block';
        let total = res.total || 0, moved = res.moved || 0, pct = total > 0 ? Math.round((moved / total) * 100) : 0;
        document.getElementById('mvProgressText').innerText = `${moved} / ${total} 件 (${pct}%)`; document.getElementById('mvProgressBar').style.width = pct + '%'; document.getElementById('mvLocSelector').style.display = 'block'; document.getElementById('mvLoc').value = ''; document.getElementById('mvLocDisplay').value = ''; document.getElementById('mvPhase2').style.display = 'none'; document.getElementById('mvPhase3').style.display = 'none';
        populateOfficialLocDatalist();
    } catch (e) { alert("載入專案資料失敗：" + e.message); } finally { hideMiniLoading(); }
}

function searchWorkerItems() {
    const kw = document.getElementById('mvSearchKw').value.toLowerCase().trim();
    if(!kw) { document.getElementById('mvPhase2').style.display = 'none'; return; }
    const filteredItems = currentProjectItems.filter(x => x.qrCode.toLowerCase().includes(kw) || x.name.toLowerCase().includes(kw) || (x.tempCode || '').toLowerCase().includes(kw));
    renderWorkerItems(filteredItems);
}

async function loadWorkerItems() {
    const eid = document.getElementById('mvEvent').value, loc = document.getElementById('mvLoc').value; if (!eid || !loc) return;
    const filteredItems = currentProjectItems.filter(x => x.loc === loc); 
    renderWorkerItems(filteredItems);
}

function renderWorkerItems(items) {
    const listDiv = document.getElementById('mvItemList');
    if (items.length === 0) { listDiv.innerHTML = '<div class="text-muted text-center py-4">查無待搬運項目！</div>'; document.getElementById('mvPhase3').style.display = 'none'; }
    else { listDiv.innerHTML = items.map((x, i) => { let tcBadge = x.tempCode ? `<span class="badge bg-info text-dark me-2 shadow-sm fs-6"><i class="fas fa-tag"></i> ${escapeHTML(x.tempCode)}</span>` : ''; let isMisc = x.qrCode.startsWith('MISC'); let displayId = x.qrCode.replace(/\n/g, ' '); return `<div class="form-check mb-2 pb-2 border-bottom"><input class="form-check-input mv-item-cb" type="checkbox" value="${x.rowIndex}" id="mvItem_${i}" onchange="checkPhase3Trigger()"><label class="form-check-label w-100" for="mvItem_${i}"><div class="d-flex align-items-center justify-content-between mb-1"><div>${tcBadge}<span class="${isMisc ? 'text-danger' : 'text-primary'} fw-bold" style="font-size:0.85rem;">[${escapeHTML(displayId)}]</span></div><span class="badge bg-light text-dark border">原: ${escapeHTML(x.loc)}</span></div><div class="fs-6 text-dark">${escapeHTML(x.name)}</div></label></div>`; }).join(''); checkPhase3Trigger(); }
    document.getElementById('mvPhase2').style.display = 'block';
}

// 💡 動態預覽視窗
function openSubmitPreviewModal() {
    const selectedItems = Array.from(document.querySelectorAll('.mv-item-cb:checked')).map(cb => parseInt(cb.value));
    if(selectedItems.length === 0) return alert('請先勾選要搬運的文物！');
    
    let html = '';
    selectedItems.forEach(rIdx => {
        let item = currentProjectItems.find(x => x.rowIndex === rIdx);
        if(!item) return;
        let displayId = item.qrCode.replace(/\n/g, ' ');
        let prefillLoc = item.expectedLoc && item.expectedLoc !== '待定' ? item.expectedLoc : '';
        html += `
        <div class="card border-success shadow-sm mb-2" id="prevCard_${rIdx}">
            <div class="card-body p-2">
                <div class="d-flex justify-content-between mb-1">
                    <span class="fw-bold text-dark" style="font-size:0.9rem;">${escapeHTML(displayId)}</span>
                    <span class="badge bg-info text-dark">${escapeHTML(item.tempCode||'無碼')}</span>
                </div>
                <div class="small text-muted mb-2 text-truncate">${escapeHTML(item.name)}</div>
                <div class="input-group input-group-sm">
                    <span class="input-group-text bg-light fw-bold text-success">實際放置</span>
                    <input type="text" class="form-control border-success fw-bold prev-loc-input" id="prevLoc_${rIdx}" list="officialLocDatalist" value="${escapeHTML(prefillLoc)}" placeholder="選擇或輸入地點">
                    <button class="btn btn-outline-success fw-bold" onclick="submitSingleMovement(${rIdx})">單件確認</button>
                </div>
            </div>
        </div>`;
    });
    document.getElementById('mvPreviewList').innerHTML = html;
    bootstrap.Modal.getOrCreateInstance(document.getElementById('mvPreviewModal')).show();
}

async function submitSingleMovement(rIdx) {
    let locInput = document.getElementById(`prevLoc_${rIdx}`).value.trim();
    if(!locInput) return alert("請選擇或輸入該件文物的實際放置地點！");
    let btn = document.querySelector(`#prevCard_${rIdx} button`); btn.disabled = true; btn.innerText = "寫入中...";
    try {
        await callAPI('submitMovement', { rowIndices: [rIdx], expectedLocs: { [rIdx]: locInput }, manager: currentManager });
        document.getElementById(`prevCard_${rIdx}`).style.display = 'none';
        currentProjectItems = currentProjectItems.filter(x => x.rowIndex !== rIdx);
        showSyncToast(`✅ ${rIdx} 號單件送出成功`, true);
        if(Array.from(document.querySelectorAll('.prev-loc-input')).every(i => i.closest('.card').style.display === 'none')) { bootstrap.Modal.getInstance(document.getElementById('mvPreviewModal')).hide(); loadWorkerLocations(); }
    } catch(e) { alert(e.message); btn.disabled = false; btn.innerText = "單件確認"; }
}

async function confirmBulkMovement() {
    let inputs = Array.from(document.querySelectorAll('.prev-loc-input')).filter(i => i.closest('.card').style.display !== 'none');
    let emptyCount = inputs.filter(i => !i.value.trim()).length;
    if(emptyCount > 0) return alert(`還有 ${emptyCount} 件未指定實際地點！`);
    
    let btn = document.getElementById('btnConfirmBulkMove'); btn.disabled = true; btn.innerText = "全數寫入中...";
    let payloadDict = {}, rowIndices = [];
    inputs.forEach(i => { let rIdx = parseInt(i.id.split('_')[1]); payloadDict[rIdx] = i.value.trim(); rowIndices.push(rIdx); });
    try {
        await callAPI('submitMovement', { rowIndices: rowIndices, expectedLocs: payloadDict, manager: currentManager });
        alert(`✅ 成功送出 ${rowIndices.length} 件文物搬運紀錄！`);
        bootstrap.Modal.getInstance(document.getElementById('mvPreviewModal')).hide();
        loadWorkerLocations();
    } catch(e) { alert(e.message); } finally { btn.disabled = false; btn.innerText = "全數確認送出"; }
}

// 💡 雲端接手碼機制
async function generateHandoff() {
    let selected = Array.from(document.querySelectorAll('.mv-item-cb:checked')).map(cb => parseInt(cb.value));
    if (selected.length === 0) return alert("請先勾選要交接的文物！");
    let handoffData = { eventId: document.getElementById('mvEvent').value, selectedRows: selected };
    showMiniLoading('產生交接碼中...');
    try {
        let res = await callAPI('generateHandoff', { data: handoffData });
        document.getElementById('handoffPinDisplay').innerText = res.pin;
        const qr = new QRious({ value: "HANDOFF:" + res.pin, size: 200, level: 'M' });
        document.getElementById('handoffQrImage').src = qr.toDataURL('image/png');
        bootstrap.Modal.getOrCreateInstance(document.getElementById('handoffModal')).show();
    } catch(e) { alert(e.message); } finally { hideMiniLoading(); }
}

function resumeHandoffPrompt() {
    let pin = prompt("請輸入 4 位數交接碼：\n(如欲使用 QR Code，請點選取消後利用系統內建相機掃描)");
    if(pin && pin.trim().length === 4) processHandoff(pin.trim());
}

async function processHandoff(pin) {
    showMiniLoading('讀取交接資料中...');
    try {
        let res = await callAPI('consumeHandoff', { pin: pin });
        document.getElementById('mvEvent').value = res.data.eventId;
        await loadWorkerLocations(); 
        let itemsToRender = currentProjectItems.filter(x => res.data.selectedRows.includes(x.rowIndex));
        renderWorkerItems(itemsToRender);
        document.querySelectorAll('.mv-item-cb').forEach(cb => cb.checked = true);
        checkPhase3Trigger();
        showSyncToast('✅ 交接進度已無縫還原', true);
    } catch(e) { alert(e.message); } finally { hideMiniLoading(); }
}

// 覆寫取代原本的 submitMovement UI 綁定，改為開啟 Modal
function checkPhase3Trigger() {
    let html = `<button class="btn btn-primary w-100 fw-bold fs-5 py-3 shadow-sm" onclick="openSubmitPreviewModal()">📦 進入搬運預覽確認</button>`;
    let phase3 = document.getElementById('mvPhase3');
    phase3.innerHTML = html;
    phase3.style.display = document.querySelectorAll('.mv-item-cb:checked').length > 0 ? 'block' : 'none'; 
}

// 保留其餘 UI 管理員邏輯不變 ... (含 updateBaseline, loadManagerData, syncToMaster 等)
// ...
