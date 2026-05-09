// ================= 💡 動態注入新增的 UI 介面 (Bottom Sheet, Virtual Keyboard, Cart) =================
document.addEventListener("DOMContentLoaded", () => {
    const dynamicModals = `
    <div class="modal fade" id="mvPreviewModal" tabindex="-1" data-bs-backdrop="static">
        <div class="modal-dialog modal-dialog-centered modal-lg modal-dialog-scrollable">
            <div class="modal-content border-0 shadow-lg bg-light">
                <div class="modal-header bg-white">
                    <h5 class="modal-title fw-bold text-success"><i class="fas fa-truck-loading"></i> 搬運前最終確認</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body p-2">
                    <div class="alert alert-success small py-2 mb-2">
                        💡 點擊「實際放置」框框可滑出專屬地點選單。若與預設不同，系統會自動標示。
                    </div>
                    <div id="mvPreviewList" class="d-flex flex-column gap-2"></div>
                </div>
                <div class="modal-footer bg-white d-flex justify-content-between p-2">
                    <button class="btn btn-outline-secondary fw-bold" data-bs-dismiss="modal">🔙 返回</button>
                    <button class="btn btn-success fw-bold px-4 shadow-sm flex-grow-1 ms-2" id="btnConfirmBulkMove" onclick="confirmBulkMovement()">📤 全數確認送出</button>
                </div>
            </div>
        </div>
    </div>

    <div class="modal fade" id="handoffModal" tabindex="-1">
        <div class="modal-dialog modal-dialog-centered">
            <div class="modal-content border-0 shadow-lg text-center">
                <div class="modal-header bg-light justify-content-center"><h5 class="modal-title fw-bold text-primary"><i class="fas fa-exchange-alt"></i> 雲端交接碼</h5></div>
                <div class="modal-body p-4">
                    <p class="text-muted small mb-3">請接手同仁掃描下方 QR Code，或輸入 4 位數交接碼</p>
                    <h1 class="display-1 fw-bold text-dark letter-spacing-2 mb-3" id="handoffPinDisplay">----</h1>
                    <div class="bg-white p-2 d-inline-block border rounded shadow-sm mb-3"><img id="handoffQrImage" src="" alt="QR Code" style="width: 200px; height: 200px;"></div>
                    <div class="alert alert-warning py-2 small mb-0">交接碼將於 4 小時後自動失效</div>
                </div>
                <div class="modal-footer bg-light justify-content-center"><button class="btn btn-secondary fw-bold px-4" data-bs-dismiss="modal">關閉</button></div>
            </div>
        </div>
    </div>

    <div class="bottom-sheet-overlay" id="bsOverlay" onclick="closeBottomSheet()"></div>
    <div class="bottom-sheet-container" id="bsContainer">
        <div class="bs-header"><div class="bs-drag-handle"></div>選擇實際放置地點</div>
        <div class="bs-body" id="bsBody"></div>
        <div class="p-3 border-top bg-light">
            <button class="btn btn-outline-primary w-100 fw-bold py-2" onclick="enableManualLocInput()">⌨️ 找不到？手動輸入特殊地點</button>
        </div>
    </div>

    <div class="vk-container" id="vkContainer">
        <div class="vk-prefix-col" id="vkPrefixCol"></div>
        <div class="vk-num-col">
            <button class="vk-btn no-select" onclick="vkPress('1')">1</button><button class="vk-btn no-select" onclick="vkPress('2')">2</button><button class="vk-btn no-select" onclick="vkPress('3')">3</button>
            <button class="vk-btn no-select" onclick="vkPress('4')">4</button><button class="vk-btn no-select" onclick="vkPress('5')">5</button><button class="vk-btn no-select" onclick="vkPress('6')">6</button>
            <button class="vk-btn no-select" onclick="vkPress('7')">7</button><button class="vk-btn no-select" onclick="vkPress('8')">8</button><button class="vk-btn no-select" onclick="vkPress('9')">9</button>
            <button class="vk-btn vk-btn-action no-select" onclick="vkBackspace()">⌫</button><button class="vk-btn no-select" onclick="vkPress('0')">0</button><button class="vk-btn vk-btn-action no-select" onclick="vkClear()">C</button>
            <button class="vk-btn vk-btn-primary no-select" onclick="closeVK(); searchWorkerItems();">🔍 搜尋</button>
        </div>
    </div>

    <button class="floating-cart-btn btn-primary border-0" id="floatingCartBtn" onclick="openSubmitPreviewModal()">
        <i class="fas fa-box-open fs-4"></i>
        <span class="cart-badge-count" id="floatingCartCount">0</span>
    </button>
    `;
    document.body.insertAdjacentHTML('beforeend', dynamicModals);

    // 插入搜尋框與雙切按鈕
    const phase1 = document.getElementById('mvPhase1');
    if(phase1) {
        const searchUI = `
        <div class="mb-3 pt-3 border-top fade-in-section">
            <div class="d-flex justify-content-between align-items-center mb-2">
                <label class="form-label text-primary fw-bold mb-0">🔍 快速找物 (模糊搜尋)</label>
                <div>
                    <button class="btn btn-sm btn-outline-info fw-bold me-1" onclick="generateHandoff()"><i class="fas fa-share-square"></i> 交接</button>
                    <button class="btn btn-sm btn-info fw-bold text-white" onclick="resumeHandoffPrompt()"><i class="fas fa-qrcode"></i> 接手</button>
                </div>
            </div>
            <div class="input-group">
                <button class="btn btn-secondary text-white fw-bold px-2" type="button" onclick="toggleInputMode()" id="btnToggleInputMode" title="切換輸入法">⌨️ 切換</button>
                <input type="search" id="mvSearchKw" class="form-control border-primary fs-5 fw-bold" placeholder="點擊搜尋編號..." onclick="handleSearchClick()" inputmode="none" readonly>
            </div>
        </div>`;
        phase1.insertAdjacentHTML('beforeend', searchUI);
    }
});

let workerCart = new Set(); // 核心：隱形購物車 (跨域多選)
let useVK = true;
let currentBsTargetRow = null;

// ================= 💡 虛擬鍵盤 (VK) 與 Bottom Sheet 控制 =================
function toggleInputMode() {
    useVK = !useVK;
    let input = document.getElementById('mvSearchKw');
    let btn = document.getElementById('btnToggleInputMode');
    if (useVK) {
        input.setAttribute('inputmode', 'none'); input.setAttribute('readonly', 'true');
        input.placeholder = "點擊搜尋編號(虛擬鍵盤)..."; btn.classList.replace('btn-outline-secondary', 'btn-secondary');
        input.blur(); openVK();
    } else {
        input.removeAttribute('inputmode'); input.removeAttribute('readonly');
        input.placeholder = "輸入中文名稱或編號(原生鍵盤)..."; btn.classList.replace('btn-secondary', 'btn-outline-secondary');
        closeVK(); input.focus();
    }
}

function handleSearchClick() { if (useVK) { openVK(); } }
function openVK() { renderVkPrefixes(); document.getElementById('vkContainer').classList.add('active'); }
function closeVK() { document.getElementById('vkContainer').classList.remove('active'); }
function vkPress(val) { let input = document.getElementById('mvSearchKw'); input.value += val; searchWorkerItems(); }
function vkBackspace() { let input = document.getElementById('mvSearchKw'); input.value = input.value.slice(0, -1); searchWorkerItems(); }
function vkClear() { document.getElementById('mvSearchKw').value = ''; searchWorkerItems(); }

function renderVkPrefixes() {
    let prefixes = new Set();
    currentProjectItems.forEach(item => {
        let tcMatch = (item.tempCode || '').match(/^([A-Za-z\-_]+)/); if (tcMatch) prefixes.add(tcMatch[1].toUpperCase());
        let idMatch = item.qrCode.match(/^([A-Za-z\-_]+)/); if (idMatch) prefixes.add(idMatch[1].toUpperCase());
    });
    let html = '';
    Array.from(prefixes).sort().forEach(p => { html += `<button class="vk-btn vk-btn-prefix no-select" onclick="vkPress('${p}')">${p}</button>`; });
    document.getElementById('vkPrefixCol').innerHTML = html;
}

function openBottomSheet(rIdx) {
    currentBsTargetRow = rIdx;
    document.getElementById('bsOverlay').classList.add('active');
    document.getElementById('bsContainer').classList.add('active');
    let html = '';
    mgrLocTree.forEach(m => {
        let mSafe = escapeHTML(m.main);
        html += `<div class="bs-loc-main">📂 ${mSafe}</div>`;
        m.subs.forEach(s => s.details.forEach(d => {
            if(!d.isHidden) html += `<div class="bs-loc-item" onclick="selectBsLoc('${escapeHTML(d.val)}')">📍 ${escapeHTML(d.val)}</div>`;
        }));
    });
    document.getElementById('bsBody').innerHTML = html;
}

function closeBottomSheet() { document.getElementById('bsOverlay').classList.remove('active'); document.getElementById('bsContainer').classList.remove('active'); }
function selectBsLoc(loc) {
    let input = document.getElementById(`prevLoc_${currentBsTargetRow}`);
    input.value = loc; closeBottomSheet(); checkLocModification(currentBsTargetRow);
}
function enableManualLocInput() {
    closeBottomSheet();
    let input = document.getElementById(`prevLoc_${currentBsTargetRow}`);
    input.focus();
}

// ================= 💡 查詢、建檔、列印、盤點 (保留原有功能) =================
// 查詢
function triggerManualQuery() { const val = document.getElementById('queryManualInput').value; if(!val) return alert("請輸入編號"); execQuery(val); }
async function execQuery(rawStr) {
    let cleanId = rawStr.includes('?id=') ? new URL(rawStr).searchParams.get('id') : rawStr.trim().split('\n')[0];
    if(queryScanner) { await stopScannerSafe(queryScanner); queryScanner = null; document.getElementById('query-reader-container').style.display = 'none'; }
    const res = globalCatalog[cleanId];
    if(res) { renderQueryUI(res); fetchFreshQueryData(cleanId); } else { showMiniLoading('🔍 查詢雲端最新狀態中...'); try { const freshRes = await callAPI('queryItem', { qrStr: cleanId }); globalCatalog[cleanId] = freshRes; renderQueryUI(freshRes); } catch(e) { alert(e.message); document.getElementById('btnStartQueryCam').style.display = 'block'; } finally { hideMiniLoading(); } }
}
async function fetchFreshQueryData(cleanId) {
    const badge = document.getElementById('qResBadge'), locText = document.getElementById('qResLoc');
    badge.innerHTML = '☁️ 同步中...'; badge.className = 'badge bg-secondary position-absolute shadow-sm';
    try { const freshRes = await callAPI('queryItem', { qrStr: cleanId }); globalCatalog[cleanId] = freshRes; if(locText.innerText !== freshRes.location && freshRes.location) { locText.innerHTML = `<span class="text-danger fade-in-section">📍 ${escapeHTML(freshRes.location)} (最新)</span>`; playSound('success'); } else { locText.innerText = freshRes.location || "無地點"; } if(freshRes.isScanned) { badge.className = "badge bg-success position-absolute shadow-sm"; badge.innerHTML = `✅ 已盤點`; } else { badge.className = "badge bg-danger position-absolute shadow-sm"; badge.innerHTML = `⚠️ 未盤點`; } } catch(e) { badge.className = "badge bg-warning text-dark position-absolute shadow-sm"; badge.innerHTML = `⚠️ 離線快取`; }
}
function renderQueryUI(res) { document.getElementById('qResLoc').innerText = res.location || "無地點資料"; document.getElementById('qResName').innerText = res.name || "未知名稱"; document.getElementById('qResPropNum').innerText = res.propNum || "未建檔"; document.getElementById('qResId').innerText = res.id; document.getElementById('qResAccession').innerText = res.accession || "未註明"; document.getElementById('qResJiang').innerText = res.jiang || "未註明"; document.getElementById('qResDesc').innerText = res.desc || "無備註說明"; const badge = document.getElementById('qResBadge'); if(res.isScanned) { badge.className = "badge bg-success position-absolute shadow-sm"; badge.innerHTML = `✅ 已盤點 (${res.lastScanStr})`; } else { badge.className = "badge bg-danger position-absolute shadow-sm"; badge.innerHTML = `⚠️ ${res.lastScanStr}`; } document.getElementById('btnStartQueryCam').style.display = 'none'; document.getElementById('queryResultBox').style.display = 'block'; playSound('success'); }
function startQueryScanner() { document.getElementById('queryResultBox').style.display = 'none'; document.getElementById('btnStartQueryCam').style.display = 'none'; document.getElementById('query-reader-container').style.display = 'block'; if (!queryScanner) queryScanner = new Html5Qrcode("query-reader"); if (queryScanner.getState() !== 2) { queryScanner.start({ facingMode: "environment" }, { fps: 10, qrbox: { width: 250, height: 250 } }, msg => execQuery(msg)); } }
async function stopQueryScannerAndReturn() { showMiniLoading('關閉相機...'); await stopScannerSafe(queryScanner); queryScanner = null; document.getElementById('query-reader-container').style.display = 'none'; document.getElementById('btnStartQueryCam').style.display = 'block'; hideMiniLoading(); }

// 盤點
function toggleLocBox() { document.getElementById('locBox').style.display = document.getElementById('modePartial').checked ? 'block' : 'none'; }
async function startInventorySession() { sysState.mode = document.getElementById('modeAll').checked ? 'all' : 'partial'; sysState.locations = Array.from(document.querySelectorAll('.leaf-cb:checked')).map(cb => cb.value); if(sysState.mode === 'partial' && sysState.locations.length === 0) return alert('請先選擇地點！'); try { localStorage.setItem('invSession', JSON.stringify({mode: sysState.mode, locations: sysState.locations})); } catch(e) {} await executeInventoryStart(); }
async function resumeInventorySession() { try { const saved = JSON.parse(localStorage.getItem('invSession')); if(!saved) return; sysState.mode = saved.mode; sysState.locations = saved.locations; } catch(e) {} await executeInventoryStart(); }
function clearInventorySession() { try { localStorage.removeItem('invSession'); } catch(e) {} document.getElementById('continueInvBox').style.display = 'none'; document.getElementById('invSettingsArea').style.display = 'block'; }
async function executeInventoryStart() { showMiniLoading('準備盤點...'); try { const res = await callAPI('startInventory', sysState); sysState.total = res.total; sysState.scanned = res.scanned; localItemCache = res.itemMap || {}; updateProgressUI(); document.getElementById('step1').style.display = 'none'; document.getElementById('step2').style.display = 'block'; hideMiniLoading(); if (!scanner) scanner = new Html5Qrcode("reader"); if (scanner.getState() !== 2) { scanner.start({ facingMode: "environment" }, { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 }, msg => processScanLocal(msg)); } } catch (e) { hideMiniLoading(); alert("錯誤：" + e.message); } }
function updateProgressUI() { document.getElementById('valTotal').innerText = sysState.total; document.getElementById('valScanned').innerText = sysState.scanned; document.getElementById('valUnscanned').innerText = Math.max(0, sysState.total - sysState.scanned); document.getElementById('progressBar').style.width = (sysState.total === 0 ? 0 : Math.round((sysState.scanned / sysState.total) * 100)) + '%'; }
async function processScanLocal(msg) { if (isProc || Date.now() - lastScan < 800) return; isProc = true; lastScan = Date.now(); let cleanMsg = msg.includes('?id=') ? new URL(msg).searchParams.get('id') : msg.trim().split('\n')[0]; const item = localItemCache[cleanMsg]; const overlay = document.getElementById('resultOverlay'); overlay.style.display = 'block'; if (!item) { playSound('error'); overlay.style.borderColor = '#dc3545'; document.getElementById('resStatus').innerHTML = '<span class="text-danger">❌ 不在範圍</span>'; document.getElementById('resName').innerText = cleanMsg; } else if (item.isScanned) { playSound('error'); overlay.style.borderColor = '#ffc107'; document.getElementById('resStatus').innerHTML = '<span class="text-warning">⚠️ 已盤點</span>'; document.getElementById('resName').innerText = item.name; } else { playSound('success'); item.isScanned = true; sysState.scanned++; updateProgressUI(); overlay.style.borderColor = '#198754'; document.getElementById('resStatus').innerHTML = '<span class="text-success">✅ 成功</span>'; document.getElementById('resName').innerText = item.name; syncQueue.push(cleanMsg); saveSyncQueue(); triggerBackgroundSync(); } setTimeout(() => { overlay.style.display = 'none'; isProc = false; }, 1200); }
async function pauseAndSave() { showMiniLoading('關閉相機...'); await stopScannerSafe(scanner); scanner = null; document.getElementById('step2').style.display = 'none'; document.getElementById('step1').style.display = 'block'; checkSavedSession(); hideMiniLoading(); }
async function finishInventory() { if(!confirm("確定結束進入結算？")) return; showMiniLoading('關閉相機...'); await stopScannerSafe(scanner); scanner = null; document.getElementById('step2').style.display = 'none'; document.getElementById('step3').style.display = 'block'; hideMiniLoading(); }
function clearAndBackToHome() { clearInventorySession(); document.getElementById('step3').style.display = 'none'; document.getElementById('step1').style.display = 'block'; backToHome(); }

// ================= 💡 異動搬運模組 (執行搬運、跨域多選、接手) =================
let allProjectsList = [], currentPdItems = [];
function backToOverviewTab() { document.querySelector('button[data-bs-target="#moveOverviewTab"]').click(); window.scrollTo(0, 0); }

async function loadWorkerLocations() {
    const eid = document.getElementById('mvEvent').value; currentMvEventId = eid; 
    if (!eid) { document.getElementById('mvLocSelector').style.display = 'none'; document.getElementById('mvProgressBox').style.display = 'none'; document.getElementById('mvPhase2').style.display = 'none'; document.getElementById('mvPhase3').style.display = 'none'; return; }
    showMiniLoading('載入專案資料中...');
    workerCart.clear(); updateFloatingCartUI(); // 切換專案清空購物車
    try {
        const res = await callAPI('getProjectPendingData', { eventId: eid }); 
        currentProjectItems = res.items || []; 
        let flatOfficialLocs = new Set(); mgrLocTree.forEach(m => m.subs.forEach(s => s.details.forEach(d => flatOfficialLocs.add(d.val))));
        let invalidLocs = new Set(); currentProjectItems.forEach(item => { if(!flatOfficialLocs.has(item.loc)) invalidLocs.add(item.loc); });
        let customTree = res.locTree || []; if(invalidLocs.size > 0) { customTree.push({ main: "📁 未分類 / 舊有地點", subs: [{ sub: "(需注意)", details: Array.from(invalidLocs).sort().map(loc => ({ label: loc, val: loc })) }] }); }
        pendingLocTree = customTree; 

        document.getElementById('mvProgressBox').style.display = 'block';
        let total = res.total || 0, moved = res.moved || 0, pct = total > 0 ? Math.round((moved / total) * 100) : 0;
        document.getElementById('mvProgressText').innerText = `${moved} / ${total} 件 (${pct}%)`; document.getElementById('mvProgressBar').style.width = pct + '%'; document.getElementById('mvLocSelector').style.display = 'block'; document.getElementById('mvLoc').value = ''; document.getElementById('mvLocDisplay').value = ''; document.getElementById('mvPhase2').style.display = 'none';
        renderVkPrefixes(); // 載入完成刷新鍵盤前綴
    } catch (e) { alert("載入資料失敗：" + e.message); } finally { hideMiniLoading(); }
}

function searchWorkerItems() {
    const kw = document.getElementById('mvSearchKw').value.toLowerCase().trim();
    if(!kw) { document.getElementById('mvPhase2').style.display = 'none'; return; }
    const filteredItems = currentProjectItems.filter(x => x.qrCode.toLowerCase().includes(kw) || x.name.toLowerCase().includes(kw) || (x.tempCode || '').toLowerCase().includes(kw));
    renderWorkerItems(filteredItems, true);
}

async function loadWorkerItems() {
    const loc = document.getElementById('mvLoc').value; if (!loc) return;
    document.getElementById('mvSearchKw').value = ''; // 切換地點清空搜尋
    const filteredItems = currentProjectItems.filter(x => x.loc === loc); 
    renderWorkerItems(filteredItems, false);
}

function renderWorkerItems(items, isSearchMode) {
    const listDiv = document.getElementById('mvItemList');
    if (items.length === 0) { listDiv.innerHTML = `<div class="text-muted text-center py-4">此處查無待搬運項目！</div>`; return; }
    listDiv.innerHTML = items.map((x, i) => { 
        let tcBadge = x.tempCode ? `<span class="badge bg-info text-dark me-2 shadow-sm"><i class="fas fa-tag"></i> ${escapeHTML(x.tempCode)}</span>` : ''; 
        let isMisc = x.qrCode.startsWith('MISC'); let displayId = x.qrCode.replace(/\n/g, ' '); 
        let isChecked = workerCart.has(x.rowIndex) ? 'checked' : '';
        let locBadge = isSearchMode ? `<span class="badge bg-light text-dark border ms-1">📍 ${escapeHTML(x.loc)}</span>` : '';
        return `<div class="form-check mb-2 pb-2 border-bottom"><input class="form-check-input mv-item-cb" type="checkbox" value="${x.rowIndex}" id="mvItem_${i}" ${isChecked} onchange="toggleWorkerCart(this, ${x.rowIndex})"><label class="form-check-label w-100" for="mvItem_${i}"><div class="d-flex align-items-center mb-1">${tcBadge}<span class="${isMisc ? 'text-danger' : 'text-primary'} fw-bold" style="font-size:0.9rem;">[${escapeHTML(displayId)}]</span></div><div class="fs-6 text-dark">${escapeHTML(x.name)}${locBadge}</div></label></div>`; 
    }).join(''); 
    document.getElementById('mvPhase2').style.display = 'block';
}

// 跨域多選邏輯
function toggleWorkerCart(cb, rIdx) {
    if (cb.checked) workerCart.add(rIdx); else workerCart.delete(rIdx);
    updateFloatingCartUI();
}

function updateFloatingCartUI() {
    const btn = document.getElementById('floatingCartBtn');
    const count = document.getElementById('floatingCartCount');
    if (workerCart.size > 0) {
        btn.style.display = 'block'; count.innerText = workerCart.size;
        document.getElementById('mvPhase3').style.display = 'block';
        document.getElementById('mvPhase3').innerHTML = `<button class="btn btn-primary w-100 fw-bold fs-5 py-3 shadow-sm" onclick="openSubmitPreviewModal()">📦 進入搬運預覽 (${workerCart.size}件)</button>`;
    } else {
        btn.style.display = 'none'; document.getElementById('mvPhase3').style.display = 'none';
    }
}

// 預覽修改地點
function openSubmitPreviewModal() {
    if(workerCart.size === 0) return alert('請先勾選要搬運的文物！');
    closeVK(); // 確保虛擬鍵盤關閉
    let html = '';
    workerCart.forEach(rIdx => {
        let item = currentProjectItems.find(x => x.rowIndex === rIdx); if(!item) return;
        let displayId = item.qrCode.replace(/\n/g, ' '); let prefillLoc = item.expectedLoc && item.expectedLoc !== '待定' ? item.expectedLoc : '';
        html += `
        <div class="card border-0 shadow-sm mb-2 preview-card" id="prevCard_${rIdx}">
            <div class="card-header bg-light p-2 d-flex justify-content-between align-items-center">
                <span class="fw-bold text-dark" style="font-size:0.9rem;">${escapeHTML(displayId)}</span>
                <span class="badge bg-info text-dark">${escapeHTML(item.tempCode||'無碼')}</span>
            </div>
            <div class="card-body p-2">
                <div class="small text-muted mb-2 text-truncate fw-bold">${escapeHTML(item.name)}</div>
                <div class="input-group input-group-sm">
                    <span class="input-group-text bg-white fw-bold text-success border-success">實際放置</span>
                    <input type="text" class="form-control border-success fw-bold prev-loc-input text-primary" id="prevLoc_${rIdx}" value="${escapeHTML(prefillLoc)}" placeholder="點擊選擇地點" readonly onclick="openBottomSheet(${rIdx})" onchange="checkLocModification(${rIdx})">
                    <button class="btn btn-success fw-bold" onclick="submitSingleMovement(${rIdx})">單件寫入</button>
                </div>
            </div>
        </div>`;
    });
    document.getElementById('mvPreviewList').innerHTML = html;
    bootstrap.Modal.getOrCreateInstance(document.getElementById('mvPreviewModal')).show();
}

function checkLocModification(rIdx) {
    let input = document.getElementById(`prevLoc_${rIdx}`);
    let card = document.getElementById(`prevCard_${rIdx}`);
    let item = currentProjectItems.find(x => x.rowIndex === rIdx);
    if(input.value.trim() !== '' && input.value.trim() !== (item.expectedLoc||'待定')) {
        card.classList.add('preview-card-modified');
    } else { card.classList.remove('preview-card-modified'); }
}

async function submitSingleMovement(rIdx) {
    let locInput = document.getElementById(`prevLoc_${rIdx}`).value.trim();
    if(!locInput) return alert("請選擇實際放置地點！");
    let btn = document.querySelector(`#prevCard_${rIdx} button`); btn.disabled = true; btn.innerText = "寫入中...";
    try {
        await callAPI('submitMovement', { rowIndices: [rIdx], expectedLocs: { [rIdx]: locInput }, manager: currentManager });
        document.getElementById(`prevCard_${rIdx}`).style.display = 'none';
        currentProjectItems = currentProjectItems.filter(x => x.rowIndex !== rIdx);
        workerCart.delete(rIdx); updateFloatingCartUI();
        showSyncToast(`✅ 單件送出成功`, true);
        if(Array.from(document.querySelectorAll('.prev-loc-input')).every(i => i.closest('.card').style.display === 'none')) { bootstrap.Modal.getInstance(document.getElementById('mvPreviewModal')).hide(); loadWorkerLocations(); }
    } catch(e) { alert(e.message); btn.disabled = false; btn.innerText = "單件寫入"; }
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
        alert(`✅ 成功送出 ${rowIndices.length} 件搬運紀錄！`);
        rowIndices.forEach(r => workerCart.delete(r)); updateFloatingCartUI();
        bootstrap.Modal.getInstance(document.getElementById('mvPreviewModal')).hide();
        loadWorkerLocations();
    } catch(e) { alert(e.message); } finally { btn.disabled = false; btn.innerText = "全數確認送出"; }
}

// 雲端交接碼 (保存 workerCart)
async function generateHandoff() {
    if (workerCart.size === 0) return alert("請先勾選要交接的文物！");
    let handoffData = { eventId: document.getElementById('mvEvent').value, selectedRows: Array.from(workerCart) };
    showMiniLoading('產生交接碼中...');
    try {
        let res = await callAPI('generateHandoff', { data: handoffData });
        document.getElementById('handoffPinDisplay').innerText = res.pin;
        const qr = new QRious({ value: "HANDOFF:" + res.pin, size: 200, level: 'M' }); document.getElementById('handoffQrImage').src = qr.toDataURL('image/png');
        bootstrap.Modal.getOrCreateInstance(document.getElementById('handoffModal')).show();
    } catch(e) { alert(e.message); } finally { hideMiniLoading(); }
}

function resumeHandoffPrompt() {
    startLocScanner('mvLoc');
    setTimeout(() => {
        document.getElementById('locScannerTitle').innerText = "掃描交接 QR Code";
        let manualBtn = document.createElement('button'); manualBtn.className = "btn btn-info w-100 mt-2 fw-bold py-3 fs-5 text-white"; manualBtn.innerText = "改用 4 位數代碼手動輸入";
        manualBtn.onclick = () => { cancelLocScanner(); let pin = prompt("請輸入 4 位數交接碼："); if(pin && pin.trim().length === 4) processHandoff(pin.trim()); };
        document.getElementById('loc-reader-container').querySelector('.btn-danger').before(manualBtn);
    }, 100);
}

async function processHandoff(pin) {
    showMiniLoading('讀取交接資料中...');
    try {
        let res = await callAPI('consumeHandoff', { pin: pin });
        document.getElementById('mvEvent').value = res.data.eventId;
        await loadWorkerLocations(); 
        res.data.selectedRows.forEach(r => workerCart.add(r)); // 還原購物車
        updateFloatingCartUI();
        // 將這些已選項目過濾出來顯示
        let itemsToRender = currentProjectItems.filter(x => workerCart.has(x.rowIndex));
        renderWorkerItems(itemsToRender, true);
        showSyncToast('✅ 交接進度已無縫還原', true);
    } catch(e) { alert(e.message); } finally { hideMiniLoading(); }
}

function triggerMvLoc() { currentModalTarget = 'mvLoc'; document.getElementById('locModalTitle').innerText = "選擇「原典藏地點」"; document.getElementById('modalLocSearch').value = ''; filterModalTree(); renderTreeHTML(pendingLocTree, 'modalLocContainer', 'modal', false); bootstrap.Modal.getOrCreateInstance(document.getElementById('locModal')).show(); }

function startLocScanner(targetId) {
    locScanTarget = targetId; document.getElementById('locScannerTitle').innerText = (targetId === 'mvLoc') ? "掃描「原典藏地點」條碼" : "掃描條碼"; document.getElementById('loc-reader-container').style.display = 'flex';
    if (!locScanner) locScanner = new Html5Qrcode("loc-reader"); if (locScanner.getState() !== 2) { locScanner.start({ facingMode: "environment" }, { fps: 10, qrbox: { width: 250, height: 250 } }, msg => handleLocScan(msg)); }
}

async function stopLocScanner() { showMiniLoading("關閉相機..."); await stopScannerSafe(locScanner); locScanner = null; document.getElementById('loc-reader-container').style.display = 'none'; hideMiniLoading(); }
async function cancelLocScanner() { showMiniLoading("關閉相機..."); await stopScannerSafe(locScanner); locScanner = null; document.getElementById('loc-reader-container').style.display = 'none'; hideMiniLoading(); }

async function handleLocScan(msg) {
    let target = locScanTarget; locScanTarget = ''; showMiniLoading("關閉相機..."); await stopScannerSafe(locScanner); locScanner = null; document.getElementById('loc-reader-container').style.display = 'none'; hideMiniLoading();
    let cleanMsg = msg.trim();
    if (cleanMsg.startsWith("HANDOFF:")) { return processHandoff(cleanMsg.substring(8)); }
    if (cleanMsg.startsWith("LOC:")) { let locName = cleanMsg.substring(4); document.getElementById(target).value = locName; document.getElementById(target + 'Display').value = locName; if(target === 'mvLoc') { loadWorkerItems(); } playSound('success'); } else { alert("這不是有效的條碼：" + cleanMsg); playSound('error'); }
}

// ================= 💡 其他剩餘專案匯入、後台管理功能 (與前一版完全相同，省去多餘註解) =================
// (專案匯入、管理者審核、列印標籤等皆保留原樣，在此壓縮以便完整提供)

function openImportModal() { document.getElementById('importTextarea').value = ''; document.getElementById('importPreviewSection').style.display = 'none'; parsedImportItems = []; bootstrap.Modal.getOrCreateInstance(document.getElementById('importModal')).show(); }
function parseImportData() { const raw = document.getElementById('importTextarea').value.trim(); if(!raw) return alert("請先貼上資料！"); parsedImportItems = []; const lines = raw.split('\n'); lines.forEach(line => { if(!line.trim()) return; let cols = line.includes('\t') ? line.split('\t') : line.split(','); cols = cols.map(c => c.trim()); if (cols.length === 0) return; let parsedTempCode = '', parsedId = '', parsedName = '', parsedExpectedLoc = ''; if (cols.length === 1) { parsedId = cols[0]; } else { parsedTempCode = cols[0]; parsedId = cols[1]; parsedName = cols.length > 2 ? cols[2] : ''; parsedExpectedLoc = cols.length > 3 ? cols[3] : ''; } if (!parsedId) return; let existingBase = allMvItems.find(x => x.id === parsedId || x.id.split('\n')[0] === parsedId), finalId = parsedId, partDesc = []; if (parsedTempCode) partDesc.push(parsedTempCode); if (parsedName && (!existingBase || parsedName !== existingBase.name)) partDesc.push(parsedName); if (partDesc.length > 0) { finalId = parsedId + "\n[" + partDesc.join(' - ') + "]"; } let inCart = newMvCart.has(finalId), status = 'match', loc = '未知', oldTc = ''; if (existingBase) { parsedName = parsedName || existingBase.name; loc = existingBase.loc; if (inCart) { let cartItem = newMvCart.get(finalId); oldTc = cartItem.tempCode || ''; if (parsedTempCode && oldTc && oldTc !== parsedTempCode) { status = 'conflict'; } else { status = 'duplicate'; } } } else { status = 'unmatched'; } parsedImportItems.push({ originalId: parsedId, finalId: finalId, name: parsedName || '未知名稱', loc: loc, tempCode: parsedTempCode, oldTc: oldTc, status: status, isMisc: false, expectedLoc: parsedExpectedLoc || '待定' }); }); renderImportPreview(); document.getElementById('importPreviewSection').style.display = 'block'; }
function triggerImportMiscLoc(id) { currentModalTarget = 'importMiscLoc_' + id; document.getElementById('locModalTitle').innerText = "選擇「雜物所在地點」"; document.getElementById('modalLocSearch').value = ''; filterModalTree(); renderTreeHTML(globalLocTree, 'modalLocContainer', 'modal', false); bootstrap.Modal.getInstance(document.getElementById('importModal')).hide(); bootstrap.Modal.getOrCreateInstance(document.getElementById('locModal')).show(); }
function startImportLocScanner(id) { locScanTarget = 'importMiscLoc_' + id; document.getElementById('locScannerTitle').innerText = "掃描「雜物所在地點」條碼"; document.getElementById('loc-reader-container').style.display = 'flex'; bootstrap.Modal.getInstance(document.getElementById('importModal')).hide(); if (!locScanner) locScanner = new Html5Qrcode("loc-reader"); if (locScanner.getState() !== 2) { locScanner.start({ facingMode: "environment" }, { fps: 10, qrbox: { width: 250, height: 250 } }, msg => handleLocScan(msg)); } }
function renderImportPreview() { let html = '', matchCount = 0, unmatchedCount = 0, dupCount = 0; parsedImportItems.forEach(item => { let statusBadge = '', trClass = '', tcHtml = '', locColumnHtml = escapeHTML(item.loc); if (item.status === 'match') { statusBadge = '<span class="badge bg-success">✅ 成功</span>'; matchCount++; if(item.tempCode) tcHtml = `<br><span class="badge bg-info text-dark mt-1"><i class="fas fa-tag"></i> ${escapeHTML(item.tempCode)}</span>`; } else if (item.status === 'duplicate') { statusBadge = '<span class="badge bg-secondary">🔄 已在清單</span>'; trClass = 'table-secondary text-muted'; dupCount++; if(item.tempCode) tcHtml = `<br><span class="badge bg-info text-dark mt-1"><i class="fas fa-tag"></i> ${escapeHTML(item.tempCode)}</span>`; } else if (item.status === 'conflict') { statusBadge = '<span class="badge bg-warning text-dark">⚠️ 衝突</span>'; trClass = 'table-warning'; dupCount++; tcHtml = `<br><small class="text-danger fw-bold">原: [${escapeHTML(item.oldTc)}] ➔ 匯入: [${escapeHTML(item.tempCode)}]</small><br><input type="text" class="form-control form-control-sm mt-1 conflict-tc-input" data-id="${escapeHTML(item.finalId)}" value="${escapeHTML(item.oldTc)}" placeholder="確認編碼">`; } else if (item.status === 'unmatched') { statusBadge = '<span class="badge bg-danger">❌ 查無此物</span>'; trClass = 'table-danger'; unmatchedCount++; } else if (item.status === 'misc') { statusBadge = '<span class="badge bg-warning text-dark">📦 轉為雜物</span>'; trClass = 'table-warning'; matchCount++; if(item.tempCode) tcHtml = `<br><span class="badge bg-info text-dark mt-1"><i class="fas fa-tag"></i> ${escapeHTML(item.tempCode)}</span>`; locColumnHtml = `<div class="input-group input-group-sm"><input type="text" class="form-control bg-white text-danger fw-bold" readonly placeholder="點選或掃描..." value="${escapeHTML(item.loc)}" onclick="triggerImportMiscLoc('${escapeHTML(item.finalId)}')"><button class="btn btn-outline-danger" type="button" onclick="startImportLocScanner('${escapeHTML(item.finalId)}')"><i class="fas fa-qrcode"></i></button></div>`; } let displayId = item.finalId.replace(/\n/g, ' '); html += `<tr class="${trClass}"><td>${statusBadge}</td><td class="fw-bold text-start">${escapeHTML(displayId)}${tcHtml}</td><td class="text-start">${escapeHTML(item.name)}<br><small class="text-primary fw-bold">預計搬往: ${escapeHTML(item.expectedLoc)}</small></td><td class="align-middle" style="min-width: 140px;">${locColumnHtml}</td></tr>`; }); document.getElementById('importPreviewTableBody').innerHTML = html || '<tr><td colspan="4" class="text-center">無有效資料</td></tr>'; document.getElementById('importStats').innerHTML = `共 ${parsedImportItems.length} 筆資料 (✅ 可匯入: ${matchCount} | ❌ 未知: ${unmatchedCount} | 🔄 重複/衝突: ${dupCount})`; const btnMisc = document.getElementById('btnConvertMisc'), warnMsg = document.getElementById('importWarningMsg'); if (unmatchedCount > 0) { btnMisc.style.display = 'inline-block'; warnMsg.style.display = 'block'; } else { btnMisc.style.display = 'none'; warnMsg.style.display = 'none'; } let hasMissingLoc = parsedImportItems.some(i => i.status === 'misc' && !i.loc); document.getElementById('btnConfirmImport').disabled = (matchCount === 0 && document.querySelectorAll('.conflict-tc-input').length === 0) || hasMissingLoc; }
function convertUnmatchedToMisc() { parsedImportItems.forEach(item => { if (item.status === 'unmatched') { item.status = 'misc'; item.isMisc = true; item.finalId = "MISC-" + new Date().getTime() + "-" + Math.floor(Math.random()*10000); item.loc = ''; } }); renderImportPreview(); }
function confirmImport() { let importCount = 0, missingLoc = false; parsedImportItems.forEach(item => { if (item.status === 'misc' && !item.loc) missingLoc = true; }); if (missingLoc) { return alert("請為所有轉換的雜物選擇或掃描「所在地點」！"); } document.querySelectorAll('.conflict-tc-input').forEach(input => { let id = input.getAttribute('data-id'), item = parsedImportItems.find(x => x.finalId === id); if(item) { item.tempCode = input.value; item.status = 'match'; } }); parsedImportItems.forEach(item => { if (item.status === 'match' || item.status === 'misc') { if (item.isMisc && !allMvItems.find(x => x.id === item.finalId)) { allMvItems.unshift({ id: item.finalId, name: item.name, loc: item.loc, isMisc: true, tempCode: item.tempCode, expectedLoc: item.expectedLoc }); } newMvCart.set(item.finalId, { name: item.name, loc: item.loc, isMisc: item.isMisc, tempCode: item.tempCode, expectedLoc: item.expectedLoc }); if (!item.isMisc) { let existing = allMvItems.find(x => x.id === item.finalId); if(!existing) { allMvItems.unshift({ id: item.finalId, name: item.name, loc: item.loc, isMisc: false, tempCode: item.tempCode, expectedLoc: item.expectedLoc }); } else { existing.tempCode = item.tempCode; } } importCount++; } }); saveMvDraft(); bootstrap.Modal.getInstance(document.getElementById('importModal')).hide(); document.getElementById('newMvSelectedCount').innerText = newMvCart.size; filterNewMvList(); showSyncToast(`✅ 成功匯入/更新 ${importCount} 筆項目！`, true); }

async function submitNewProject() { const action = document.getElementById('newMvActionSelect').value, pName = document.getElementById('newMvName').value.trim(), pDesc = document.getElementById('newMvDesc').value.trim(); if(!pName) return alert("請輸入專案名稱！"); if(newMvCart.size === 0) return alert("請至少挑選一件待搬運文物！"); showMiniLoading('正在儲存專案與清單資料...'); let miscDetails = {}, tempCodes = {}, expectedLocs = {}; newMvCart.forEach((val, key) => { miscDetails[key] = val; if (val.tempCode) tempCodes[key] = val.tempCode; if (val.expectedLoc) expectedLocs[key] = val.expectedLoc; }); try { await callAPI('saveMovementProject', { eventId: action, name: pName, desc: pDesc, itemIds: Array.from(newMvCart.keys()), miscDetails: miscDetails, tempCodes: tempCodes, expectedLocs: expectedLocs, manager: currentManager }); clearMvDraft(); alert('✅ 專案資料儲存成功！'); refreshSystem('move'); } catch (e) { alert("專案儲存失敗：" + e.message); } finally { hideMiniLoading(); } }

async function updateBaseline() { const timeVal = document.getElementById('newBaseline').value; if(!timeVal) return alert('請選擇日期時間'); if(!confirm("確定要更新基準日嗎？")) return; showMiniLoading('更新中...'); try { await callAPI('updateBaseline', { timeString: timeVal }); alert('✅ 更新成功！'); location.reload(); } catch (e) { alert("更新失敗：" + e.message); hideMiniLoading(); } }
async function loadManagerData() { const eid = document.getElementById('mgrEvent').value; if(!eid) { document.getElementById('mgrFilterSec').style.display = 'none'; document.getElementById('btnPrintReport').disabled = true; document.querySelector('#tablePending tbody').innerHTML = ''; document.querySelector('#tableConfirmed tbody').innerHTML = ''; return; } showMiniLoading('載入表單中...'); try { const res = await callAPI('getManagerData', { eventId: eid }); mgrPendingData = res.pending; mgrConfirmedData = res.confirmed; const allData = [...mgrPendingData, ...mgrConfirmedData]; const locs = [...new Set(allData.map(x => x.newLoc).filter(Boolean))].sort(), boxes = [...new Set(allData.map(x => x.boxName).filter(Boolean))].sort(), staffs = [...new Set(allData.map(x => x.staff).filter(Boolean))].sort(); document.getElementById('mgrSearchLoc').innerHTML = '<option value="">📍 所有地點</option>' + locs.map(x => `<option value="${escapeHTML(x)}">${escapeHTML(x)}</option>`).join(''); document.getElementById('mgrSearchBox').innerHTML = '<option value="">📦 所有箱號</option>' + boxes.map(x => `<option value="${escapeHTML(x)}">${escapeHTML(x)}</option>`).join(''); document.getElementById('mgrSearchStaff').innerHTML = '<option value="">👤 所有人員</option>' + staffs.map(x => `<option value="${escapeHTML(x)}">${escapeHTML(x)}</option>`).join(''); document.getElementById('mgrFilterSec').style.display = 'block'; document.getElementById('btnPrintReport').disabled = false; applyMgrFilters(); } catch(e) { alert("載入失敗：" + e.message); } finally { hideMiniLoading(); } }
function applyMgrFilters() { const kw = document.getElementById('mgrSearchKw').value.toLowerCase().trim(), loc = document.getElementById('mgrSearchLoc').value, box = document.getElementById('mgrSearchBox').value, staff = document.getElementById('mgrSearchStaff').value; const filterFn = (x) => { const matchKw = !kw || (x.qrCode.toLowerCase().includes(kw) || (x.name && x.name.toLowerCase().includes(kw))); const matchLoc = !loc || x.newLoc === loc; const matchBox = !box || x.boxName === box; const matchStaff = !staff || x.staff === staff; return matchKw && matchLoc && matchBox && matchStaff; }; const filteredP = mgrPendingData.filter(filterFn), filteredC = mgrConfirmedData.filter(filterFn); document.getElementById('mgrFilterCount').innerText = `篩選結果: 待核對 ${filteredP.length} 筆 / 已核對 ${filteredC.length} 筆`; renderTable('tablePending', filteredP, 'chk-pend', true); renderTable('tableConfirmed', filteredC, 'chk-conf', false); }
function renderTable(tid, data, cls, edit) { document.querySelector(`#${tid} tbody`).innerHTML = data.map(x => { let safeLoc = x.newLoc.replace(/'/g, "\\'").replace(/"/g, "&quot;"); let safeBox = x.boxName.replace(/'/g, "\\'").replace(/"/g, "&quot;"); let tcBadge = x.tempCode ? `<span class="badge bg-info text-dark ms-1"><i class="fas fa-tag"></i> ${escapeHTML(x.tempCode)}</span>` : ''; let displayId = x.qrCode.replace(/\n/g, ' '); let expectedWarning = x.isExpectedChanged ? `<br><small class="text-danger fw-bold"><i class="fas fa-exclamation-circle"></i> 地點已變更</small>` : ''; return `<tr><td><input type="checkbox" class="${cls}" value="${x.rowIndex}"></td><td><b class="${x.qrCode.startsWith('MISC') ? 'text-danger' : 'text-dark'}">${escapeHTML(displayId)}</b>${tcBadge}<br><span class="text-primary small fw-bold">${escapeHTML(x.name)}</span><br><small class="text-muted">原: ${escapeHTML(x.oldLoc)}</small></td><td><span class="text-success fw-bold">${escapeHTML(x.newLoc)}</span>${expectedWarning}<br><small class="badge bg-light text-dark border mt-1">${escapeHTML(x.boxName||'未裝箱')}</small></td><td>${edit ? `<small class="text-muted d-block mb-1">搬運: ${escapeHTML(x.staff)}</small><button class="btn btn-sm btn-outline-primary" onclick="promptEdit(${x.rowIndex},'${safeLoc}','${safeBox}')">📝修改</button>` : `<small class="text-muted d-block mb-1">搬運: ${escapeHTML(x.staff)}</small><small class="badge bg-success">核對: ${escapeHTML(x.manager)}</small>`}</td></tr>`; }).join(''); }
async function changeStatus(cls, stat) { const rows = Array.from(document.querySelectorAll(`${cls}:checked`)).map(cb => parseInt(cb.value)); if(rows.length === 0) return alert('請先勾選項目！'); showMiniLoading('處理中...'); try { await callAPI('toggleStatus', { rowIndices: rows, newStatus: stat, managerName: currentManager }); loadManagerData(); } catch(e) { alert("失敗：" + e.message); hideMiniLoading(); } }
async function promptEdit(ri, nl, nb) { const loc = prompt("修改暫存地點：", nl), box = prompt("修改箱名：", nb); if(loc!==null) { showMiniLoading('更新中...'); try { await callAPI('editItem', { rowIndex: ri, newLoc: loc, boxName: box, managerName: currentManager }); loadManagerData(); } catch(e) { alert("失敗：" + e.message); hideMiniLoading(); } } }
async function syncToMaster() { if(!confirm("確定要結案同步嗎？(系統將自動略過雜物)")) return; showMiniLoading('寫入總表中...'); try { let res = await callAPI('syncToMaster', { eventId: document.getElementById('mgrEvent').value }); if (res && typeof res.count !== 'undefined') { alert(`✅ 結案成功！共更新了 ${res.count} 筆文物地點。`); } else { alert('✅ 結案指令已送出。'); } loadManagerData(); callAPI('getInventoryInitData').then(invData => { globalCatalog = invData.catalog || {}; }); refreshSystem('mgr'); } catch(e) { alert("失敗：" + e.message); hideMiniLoading(); } }

function selectModalLoc(val) {
    if (!currentModalTarget) return;
    if (currentModalTarget.startsWith('importMiscLoc_')) { let id = currentModalTarget.split('importMiscLoc_')[1]; let item = parsedImportItems.find(x => x.finalId === id); if (item) item.loc = val; renderImportPreview(); bootstrap.Modal.getInstance(document.getElementById('locModal')).hide(); bootstrap.Modal.getOrCreateInstance(document.getElementById('importModal')).show(); } 
    else { document.getElementById(currentModalTarget).value = val; let displayInput = document.getElementById(currentModalTarget + 'Display'); if(displayInput) displayInput.value = val; bootstrap.Modal.getInstance(document.getElementById('locModal')).hide(); if (currentModalTarget === 'mvLoc') { loadWorkerItems(); } else if (currentModalTarget === 'miscLoc') { bootstrap.Modal.getOrCreateInstance(document.getElementById('miscModal')).show(); } } currentModalTarget = '';
}
function toggleAllCheck(s, t) { document.querySelectorAll(t).forEach(cb => cb.checked = s.checked); }
