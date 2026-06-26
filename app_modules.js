// ==========================================
// 博物館系統模組功能 (app_modules.js)
// 穩定同步版：包含完整 5 欄位匯入、虛擬鍵盤、草稿記憶與修復的下拉選單
// 最新優化：新增「藏品狀況報告表」模組 (含歷史編輯、直接列印、PDF 100% 完美排版)
// ==========================================

// ================= 💡 動態注入新增的 UI 介面 =================
document.addEventListener("DOMContentLoaded", () => {
    const dynamicModals = `
    <div class="modal fade" id="printFormatModal" tabindex="-1">
        <div class="modal-dialog modal-dialog-centered">
            <div class="modal-content border-0 shadow-lg">
                <div class="modal-header bg-light">
                    <h5 class="modal-title fw-bold text-dark"><i class="fas fa-print"></i> 選擇列印格式</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body p-4 text-center">
                    <div class="d-grid gap-3">
                        <button class="btn btn-outline-primary btn-lg fw-bold py-3 text-start px-4" onclick="executeGeneratePrintPage('basic')">
                            <div class="d-flex align-items-center">
                                <i class="fas fa-qrcode fs-2 me-3"></i>
                                <div>
                                    <div class="fs-5">純 QR Code 標籤</div>
                                    <small class="fw-normal text-muted">單純輸出條碼圖檔陣列，適合自訂標籤機</small>
                                </div>
                            </div>
                        </button>
                        <button class="btn btn-outline-success btn-lg fw-bold py-3 text-start px-4" onclick="executeGeneratePrintPage('full')">
                            <div class="d-flex align-items-center">
                                <i class="fas fa-tag fs-2 me-3"></i>
                                <div>
                                    <div class="fs-5">完整藏品吊牌 (6x3cm)</div>
                                    <small class="fw-normal text-muted">含十字裁切線、編號、名稱、財編與地點</small>
                                </div>
                            </div>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <div class="modal fade" id="importModal" tabindex="-1">
        <div class="modal-dialog modal-dialog-centered modal-xl modal-dialog-scrollable">
            <div class="modal-content border-0 shadow-lg">
                <div class="modal-header bg-light">
                    <h5 class="modal-title fw-bold text-success"><i class="fas fa-file-import"></i> 批次匯入搬運清單</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body p-4">
                    <div class="alert alert-info small py-2 mb-3">
                        💡 建議格式：[臨時編碼] (Tab空白) [藏品編號] (Tab空白) [名稱] (Tab空白) [數量] (Tab空白) [預計搬往地點]<br>
                        * 若僅貼上「藏品編號」單欄亦可支援。
                    </div>
                    <textarea id="importTextarea" class="form-control border-success mb-3" rows="6" placeholder="請在此貼上 Excel 內容..."></textarea>
                    <button class="btn btn-secondary w-100 fw-bold mb-4" onclick="parseImportData()">🔍 預覽解析結果</button>

                    <div id="importPreviewSection" style="display:none;" class="fade-in-section">
                        <div class="d-flex justify-content-between align-items-center mb-2">
                            <h6 class="fw-bold text-dark mb-0">比對預覽：</h6>
                            <span class="small fw-bold text-secondary" id="importStats">共 0 筆資料</span>
                        </div>
                        <div class="alert alert-warning small py-2 mb-2" id="importWarningMsg" style="display:none;">
                            ⚠️ 發現系統中查無此物的編號，您可以選擇直接忽略，或將它們轉換為「雜物」一併搬運。
                        </div>
                        <div class="table-responsive border rounded mb-3" style="max-height: 40vh; overflow-y: auto;">
                            <table class="table table-bordered table-sm text-center align-middle mb-0" style="font-size: 0.9rem;">
                                <thead class="table-light sticky-top">
                                    <tr>
                                        <th width="15%">狀態</th><th width="25%">藏品編號</th><th width="35%">名稱與數量</th><th width="25%">目前地點/雜物地點</th>
                                    </tr>
                                </thead>
                                <tbody id="importPreviewTableBody"></tbody>
                            </table>
                        </div>
                        <div class="d-flex gap-2">
                            <button class="btn btn-warning fw-bold text-dark flex-grow-1 shadow-sm" id="btnConvertMisc" onclick="convertUnmatchedToMisc()" style="display:none;">📦 將未知項目轉為雜物</button>
                            <button class="btn btn-success fw-bold flex-grow-1 shadow-sm" id="btnConfirmImport" onclick="confirmImport()" disabled>✅ 確認匯入</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <div class="modal fade" id="cartModal" tabindex="-1">
        <div class="modal-dialog modal-dialog-centered modal-lg modal-dialog-scrollable">
            <div class="modal-content border-0 shadow-lg">
                <div class="modal-header bg-light">
                    <h5 class="modal-title fw-bold text-primary">🛒 購物車檢視與精修</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body p-3">
                    <div class="row g-2 mb-3">
                        <div class="col-12 col-md-6"><input type="search" id="cartSearchKw" class="form-control" placeholder="🔍 搜尋..." onkeyup="filterCartList()" onsearch="filterCartList()"></div>
                        <div class="col-12 col-md-6"><select id="cartPrefixFilter" class="form-select" onchange="filterCartList()"></select></div>
                    </div>
                    <div class="d-flex justify-content-between mb-2 align-items-center">
                        <div>
                            <button class="btn btn-sm btn-outline-secondary me-1" onclick="toggleCartAll(true)">全選</button>
                            <button class="btn btn-sm btn-outline-secondary" onclick="toggleCartAll(false)">清除</button>
                        </div>
                        <div class="d-flex gap-2">
                            <button class="btn btn-sm btn-outline-info fw-bold" data-bs-toggle="collapse" data-bs-target="#cartBatchEditArea">✏️ 批次修改編碼</button>
                            <button class="btn btn-sm btn-outline-danger fw-bold" onclick="batchRemoveCartItems()">❌ 批次移除</button>
                        </div>
                    </div>
                    
                    <div class="collapse mb-3" id="cartBatchEditArea">
                        <div class="card card-body bg-light border-info">
                            <h6 class="fw-bold text-info small mb-2">針對勾選項目重新發配編碼</h6>
                            <div class="input-group input-group-sm">
                                <span class="input-group-text">前綴</span>
                                <input type="text" id="cartBatchPrefix" class="form-control" placeholder="例: M">
                                <span class="input-group-text">起始號</span>
                                <input type="number" id="cartBatchStart" class="form-control" value="1" min="1">
                                <button class="btn btn-info text-white fw-bold" onclick="applyCartBatchEdit()">套用</button>
                            </div>
                        </div>
                    </div>

                    <div id="cartItemList" class="border rounded bg-white" style="max-height: 50vh; overflow-y: auto;"></div>
                </div>
                <div class="modal-footer bg-light d-flex justify-content-between">
                    <span class="text-muted small fw-bold">已顯示項目: <span id="cartCountText">0</span></span>
                    <button class="btn btn-secondary fw-bold" data-bs-dismiss="modal">完成</button>
                </div>
            </div>
        </div>
    </div>

    <div class="modal fade" id="tempCodeModal" tabindex="-1">
        <div class="modal-dialog modal-dialog-centered modal-dialog-scrollable">
            <div class="modal-content border-0 shadow-lg">
                <div class="modal-header bg-light">
                    <h5 class="modal-title fw-bold text-info" style="color: #0dcaf0 !important;"><i class="fas fa-tags"></i> 批次自動配發臨時編碼</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body p-4">
                    <div class="alert alert-light border small py-2 mb-3 text-muted">
                        設定前綴與起始號碼，系統將依序為下方勾選的文物配發臨時編碼（例如 M1, M2...）。
                    </div>
                    <div class="row g-2 mb-3">
                        <div class="col-6">
                            <label class="form-label small fw-bold text-dark">自訂前綴字</label>
                            <input type="text" id="tcPrefix" class="form-control border-info" placeholder="例: M">
                        </div>
                        <div class="col-6">
                            <label class="form-label small fw-bold text-dark">起始數字</label>
                            <input type="number" id="tcStartNum" class="form-control border-info" value="1" min="1">
                        </div>
                    </div>
                    <hr>
                    <div class="d-flex justify-content-between mb-2">
                        <div>
                            <button class="btn btn-sm btn-outline-secondary me-1 py-0" onclick="toggleTcAll(true)">全選</button>
                            <button class="btn btn-sm btn-outline-secondary py-0" onclick="toggleTcAll(false)">清除</button>
                        </div>
                        <button class="btn btn-sm btn-outline-info text-dark py-0" onclick="toggleTcUncoded()">僅選未編碼</button>
                    </div>
                    <div id="tcItemList" class="border rounded p-2 bg-light" style="max-height: 35vh; overflow-y: auto;"></div>
                </div>
                <div class="modal-footer bg-light p-2">
                    <button class="btn btn-outline-secondary fw-bold" data-bs-dismiss="modal">取消</button>
                    <button class="btn btn-info fw-bold text-white px-4" onclick="applyTempCodes()">✅ 確認套用</button>
                </div>
            </div>
        </div>
    </div>

    <div class="modal fade" id="mvPreviewModal" tabindex="-1" data-bs-backdrop="static">
        <div class="modal-dialog modal-dialog-centered modal-lg modal-dialog-scrollable">
            <div class="modal-content border-0 shadow-lg bg-light">
                <div class="modal-header bg-white">
                    <h5 class="modal-title fw-bold text-success"><i class="fas fa-truck-loading"></i> 搬運前最終確認</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body p-2">
                    <div class="alert alert-success small py-2 mb-2">💡 點擊「實際放置」框框，跟隨層級引導選擇正確庫房地點。支援上方多選批次套用。</div>
                    <div id="mvPreviewList" class="d-flex flex-column gap-2"></div>
                </div>
                <div class="modal-footer bg-white d-flex justify-content-between p-2">
                    <button class="btn btn-outline-secondary fw-bold" data-bs-dismiss="modal">🔙 返回修改</button>
                    <button class="btn btn-success fw-bold px-4 shadow-sm flex-grow-1 ms-2" id="btnConfirmBulkMove" onclick="confirmBulkMovement()">📤 全數確認送出</button>
                </div>
            </div>
        </div>
    </div>

    <div class="modal fade" id="undoMoveModal" tabindex="-1">
        <div class="modal-dialog modal-dialog-centered modal-lg modal-dialog-scrollable">
            <div class="modal-content border-0 shadow-lg bg-light">
                <div class="modal-header bg-white">
                    <h5 class="modal-title fw-bold text-warning text-dark"><i class="fas fa-history"></i> 撤銷已送出之搬運</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body p-2">
                    <div class="alert alert-warning small py-2 mb-2">⚠️ 僅能撤銷「尚未被管理員核對」的文物。撤銷後將恢復為未搬運狀態。</div>
                    <div id="undoMoveList" class="d-flex flex-column gap-2"></div>
                </div>
            </div>
        </div>
    </div>

    <div class="modal fade" id="mgrVerifyModal" tabindex="-1" data-bs-backdrop="static">
        <div class="modal-dialog modal-dialog-centered modal-lg modal-dialog-scrollable">
            <div class="modal-content border-0 shadow-lg">
                <div class="modal-header bg-light">
                    <h5 class="modal-title fw-bold text-success"><i class="fas fa-clipboard-check"></i> 待核對清單確認</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body p-2 bg-light">
                    <div class="alert alert-info small py-2 mb-2">💡 點擊地點欄位可重新修改地點。您可以將項目核對通過，或退回前台重新搬運。</div>
                    <div id="mgrVerifyList" class="d-flex flex-column gap-2"></div>
                </div>
                <div class="modal-footer bg-white d-flex justify-content-between p-2 flex-wrap gap-2">
                    <button class="btn btn-outline-secondary fw-bold" data-bs-dismiss="modal">返回</button>
                    <div class="d-flex gap-2">
                        <button class="btn btn-danger fw-bold shadow-sm" onclick="executeMgrBatchAction('undo')">❌ 全數退回搬運</button>
                        <button class="btn btn-success fw-bold shadow-sm" onclick="executeMgrBatchAction(true)">✅ 全數核對通過</button>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <div class="modal fade" id="mgrRevertModal" tabindex="-1" data-bs-backdrop="static">
        <div class="modal-dialog modal-dialog-centered modal-lg modal-dialog-scrollable">
            <div class="modal-content border-0 shadow-lg">
                <div class="modal-header bg-light">
                    <h5 class="modal-title fw-bold text-warning text-dark"><i class="fas fa-undo"></i> 退回核對清單確認</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body p-2 bg-light">
                    <div class="alert alert-warning small py-2 mb-2">⚠️ 這些文物將退回至「待核對」狀態。</div>
                    <div id="mgrRevertList" class="d-flex flex-column gap-2"></div>
                </div>
                <div class="modal-footer bg-white d-flex justify-content-between p-2">
                    <button class="btn btn-outline-secondary fw-bold" data-bs-dismiss="modal">返回</button>
                    <button class="btn btn-warning text-dark fw-bold px-4 shadow-sm" onclick="executeMgrBatchAction(false)">↩️ 全數退回待核對</button>
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
        <div class="bs-body p-0" id="bsBody"></div>
        <div class="p-3 border-top bg-light"><button class="btn btn-outline-primary w-100 fw-bold py-2" onclick="enableManualLocInput()">⌨️ 找不到？手動輸入特殊地點</button></div>
    </div>

    <div class="position-fixed bottom-0 end-0 p-3" style="z-index: 1050; display:flex; flex-direction:column; gap:10px;">
        <button class="btn btn-warning rounded-circle shadow-lg text-dark fw-bold border border-light" id="floatingUndoBtn" style="width: 60px; height: 60px; display:none;" onclick="openUndoMoveModal()" title="撤銷搬運">
            <i class="fas fa-undo fs-4"></i>
        </button>
        <button class="btn btn-primary rounded-circle shadow-lg text-white fw-bold border border-light position-relative" id="floatingCartBtn" style="width: 60px; height: 60px; display:none;" onclick="openSubmitPreviewModal()" title="確認送出">
            <i class="fas fa-box-open fs-4"></i>
            <span class="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger" id="floatingCartCount" style="font-size: 0.85rem;">0</span>
        </button>
        <button class="btn btn-success rounded-circle shadow-lg text-white fw-bold border border-light position-relative" id="mgrFloatingCartBtn" style="width: 60px; height: 60px; display:none;" onclick="openMgrCartModal()" title="審核購物車">
            <i class="fas fa-clipboard-check fs-4" id="mgrCartIcon"></i>
            <span class="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger" id="mgrCartCount" style="font-size: 0.85rem;">0</span>
        </button>
    </div>
    `;
    document.body.insertAdjacentHTML('beforeend', dynamicModals);

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
                <input type="search" id="mvSearchKw" class="form-control border-primary fs-5 fw-bold" placeholder="點擊搜尋編號..." onclick="handleSearchClick()" oninput="searchWorkerItems()" inputmode="none" readonly>
            </div>
        </div>`;
        phase1.insertAdjacentHTML('beforeend', searchUI);
    }

    document.querySelectorAll('button[data-bs-toggle="pill"], button[data-bs-toggle="tab"]').forEach(btn => {
        btn.addEventListener('shown.bs.tab', (e) => {
            if (typeof updateMgrCartUI === 'function') updateMgrCartUI();
            if (typeof updateFloatingCartUI === 'function') updateFloatingCartUI();
            let undoBtn = document.getElementById('floatingUndoBtn');
            let cartBtn = document.getElementById('floatingCartBtn');
            if (undoBtn) {
                if (e.target.getAttribute('data-bs-target') === '#moveExecuteTab' && currentMvEventId) { undoBtn.style.display = 'block'; } 
                else { undoBtn.style.display = 'none'; if(cartBtn) cartBtn.style.display = 'none'; }
            }
        });
    });

    const moveCreateTabBtn = document.querySelector('button[data-bs-target="#moveCreateTab"]');
    if (moveCreateTabBtn) { moveCreateTabBtn.addEventListener('click', () => { loadNewMvList(); filterNewMvList(); }); }
});

// ================= 💡 核心全域變數與共用函數 =================
let workerCart = new Set();
let mgrPendingCart = new Set();
let mgrConfirmedCart = new Set();
let useVK = true;
let currentBsTargetRow = null;
let bsState = { step: 0, main: '', med: '' };

let newMvCart = new Map();
let allMvItems = [];
let parsedImportItems = [];
let parsedOverrideItems = [];
let locAddQueue = [];
let locUpdateQueue = [];
let isLocAdding = false;
let isLocSyncing = false;
let allProjectsList = [];
let currentPdItems = [];

// 🔥 狀況報告表專屬變數
let condCurrentItem = null;
let condPhotos = [];
let mainPhotoBase64 = "";
let mainPhotoMime = "";
let pendingPhotoBase64 = "";
let condMode = 1;
let condReportsCache = []; // 用於儲存歷史報告清單

function smartConcatLoc(main, med, small) {
    main = main || ""; med = med || ""; small = small || "";
    if (!small) return main + med;
    let prefixMatch = small.match(/^([^\-]+)-/);
    if (prefixMatch && med) {
        let prefix = prefixMatch[1];
        if (med.endsWith(prefix)) { return main + med + small.substring(prefix.length); }
    }
    return main + med + small;
}

function getPrefix(tc) { 
    if (!tc) return "未編碼"; 
    const match = String(tc).match(/^([A-Za-z\-_]+)/); 
    return match ? match[1].toUpperCase() : "無英文前綴"; 
}

// ================= 💡 專案草稿與下拉選單邏輯 =================
function checkMvDraft() {
    loadNewMvList(); 
    const saved = localStorage.getItem('mvProjectDraft');
    if(saved) {
        try {
            const draft = JSON.parse(saved);
            document.getElementById('newMvName').value = draft.name || '';
            document.getElementById('newMvDesc').value = draft.desc || '';
            newMvCart = new Map(draft.cart);
            document.getElementById('newMvSelectedCount').innerText = newMvCart.size;
        } catch(e) {}
    }
    filterNewMvList(); 
}

function saveMvDraft() {
    const action = document.getElementById('newMvActionSelect').value; 
    if(action !== 'NEW') return;
    const draft = { name: document.getElementById('newMvName').value, desc: document.getElementById('newMvDesc').value, cart: Array.from(newMvCart.entries()) };
    localStorage.setItem('mvProjectDraft', JSON.stringify(draft));
}

function clearMvDraft() { localStorage.removeItem('mvProjectDraft'); }

function selectModalLoc(val) {
    if (!currentModalTarget) return;
    if (currentModalTarget.startsWith('importMiscLoc_')) { 
        let id = currentModalTarget.split('importMiscLoc_')[1]; 
        let item = parsedImportItems.find(x => x.finalId === id); 
        if (item) item.loc = val; 
        renderImportPreview(); 
        bootstrap.Modal.getInstance(document.getElementById('locModal')).hide(); 
        bootstrap.Modal.getOrCreateInstance(document.getElementById('importModal')).show(); 
    } else { 
        document.getElementById(currentModalTarget).value = val; 
        let displayInput = document.getElementById(currentModalTarget + 'Display'); 
        if(displayInput) displayInput.value = val; 
        bootstrap.Modal.getInstance(document.getElementById('locModal')).hide(); 
        if (currentModalTarget === 'mvLoc') { loadWorkerItems(); } 
        else if (currentModalTarget === 'miscLoc') { bootstrap.Modal.getOrCreateInstance(document.getElementById('miscModal')).show(); } 
    } 
    currentModalTarget = '';
}

function triggerRegLoc() { currentModalTarget='regLoc'; openLocModal("選擇初始存放地點", globalLocTree); }
function triggerMiscLoc() { currentModalTarget='miscLoc'; openLocModal("選擇雜物所在地點", globalLocTree); }
function triggerMvLoc() { currentModalTarget='mvLoc'; openLocModal("選擇原地點過濾", pendingLocTree); }

function openLocModal(title, tree) {
    document.getElementById('locModalTitle').innerText = title;
    document.getElementById('modalLocSearch').value = '';
    renderTreeHTML(tree, 'modalLocContainer', 'modal', false);
    bootstrap.Modal.getOrCreateInstance(document.getElementById('locModal')).show();
}

function toggleBoxInput() { document.getElementById('boxInputContainer').style.display = document.getElementById('mvIsBox').checked ? 'block' : 'none'; }

// ================= 💡 共用虛擬鍵盤 (重構：支援搬運與狀況報告雙模組) =================
let currentVkInputId = 'mvSearchKw'; 

function toggleInputMode() {
    useVK = !useVK; currentVkInputId = 'mvSearchKw';
    let input = document.getElementById('mvSearchKw'), btn = document.getElementById('btnToggleInputMode');
    applyVkState(input, btn);
}

function toggleCondInputMode() {
    useVK = !useVK; currentVkInputId = 'condSearchKw';
    let input = document.getElementById('condSearchKw'), btn = document.getElementById('btnToggleCondInputMode');
    applyVkState(input, btn);
}

function applyVkState(input, btn) {
    if (useVK) { 
        input.setAttribute('inputmode', 'none'); input.setAttribute('readonly', 'true'); 
        input.placeholder = "點擊搜尋(虛擬鍵盤)..."; 
        btn.classList.replace('btn-outline-secondary', 'btn-secondary'); 
        input.blur(); openVK(); 
    } else { 
        input.removeAttribute('inputmode'); input.removeAttribute('readonly'); 
        input.placeholder = "輸入中文名稱或編號(原生鍵盤)..."; 
        btn.classList.replace('btn-secondary', 'btn-outline-secondary'); 
        closeVK(); input.focus(); 
    }
}

function handleSearchClick() { currentVkInputId = 'mvSearchKw'; if (useVK) openVK(); }
function handleCondSearchClick() { currentVkInputId = 'condSearchKw'; if (useVK) openVK(); }

function openVK() { 
    let input = document.getElementById(currentVkInputId);
    if(input && input.value.trim() === '') { document.getElementById('vkPrefixCol').style.display = 'grid'; document.getElementById('vkNumCol').style.display = 'none'; renderVkPrefixes(); } 
    else { document.getElementById('vkPrefixCol').style.display = 'none'; document.getElementById('vkNumCol').style.display = 'grid'; }
    document.getElementById('vkContainer').classList.add('active'); 
}
function closeVK() { document.getElementById('vkContainer').classList.remove('active'); }

function vkPressPrefix(prefix) { 
    let input = document.getElementById(currentVkInputId);
    if(input) input.value = prefix; 
    document.getElementById('vkPrefixCol').style.display = 'none'; 
    document.getElementById('vkNumCol').style.display = 'grid'; 
    dispatchVkSearch(); 
}
function vkShowNumOnly() { document.getElementById('vkPrefixCol').style.display = 'none'; document.getElementById('vkNumCol').style.display = 'grid'; }
function vkPress(val) { 
    let input = document.getElementById(currentVkInputId);
    if(input) input.value += val; 
    dispatchVkSearch(); 
}
function vkBackspace() { 
    let input = document.getElementById(currentVkInputId); 
    if(!input) return;
    input.value = input.value.slice(0, -1); 
    if(input.value === '') { document.getElementById('vkNumCol').style.display = 'none'; document.getElementById('vkPrefixCol').style.display = 'grid'; renderVkPrefixes(); } 
    dispatchVkSearch(); 
}
function vkClear() { 
    let input = document.getElementById(currentVkInputId);
    if(input) input.value = ''; 
    document.getElementById('vkNumCol').style.display = 'none'; 
    document.getElementById('vkPrefixCol').style.display = 'grid'; 
    renderVkPrefixes(); 
    dispatchVkSearch(); 
}
function dispatchVkSearch() {
    if (currentVkInputId === 'mvSearchKw') searchWorkerItems();
    else if (currentVkInputId === 'condSearchKw') searchCondItems();
}

function renderVkPrefixes() {
    let prefixes = new Set();
    if (currentVkInputId === 'mvSearchKw' && currentProjectItems) {
        currentProjectItems.forEach(item => { 
            let tcMatch = String(item.tempCode || '').match(/^([A-Za-z\-_]+)/); if (tcMatch) prefixes.add(tcMatch[1].toUpperCase()); 
            let idMatch = String(item.qrCode).match(/^([A-Za-z\-_]+)/); if (idMatch) prefixes.add(idMatch[1].toUpperCase()); 
        });
    } else {
        Object.values(globalCatalog).forEach(item => {
            let idMatch = String(item.id).match(/^([A-Za-z\-_]+)/); if (idMatch) prefixes.add(idMatch[1].toUpperCase());
        });
    }
    
    let html = ''; 
    Array.from(prefixes).sort().forEach(p => { html += `<button class="vk-btn vk-btn-prefix no-select" onclick="vkPressPrefix('${p}')">${p}</button>`; });
    html += `<button class="vk-btn vk-btn-primary no-select" style="grid-column: 1 / -1; margin-top: 5px; padding: 12px; border-radius: 8px;" onclick="vkShowNumOnly()"><i class="fas fa-keyboard"></i> 🔢 直接打數字 (無前綴)</button>`;
    document.getElementById('vkPrefixCol').innerHTML = html;
}

document.addEventListener('click', function(event) { 
    let vk = document.getElementById('vkContainer'), searchBox = document.getElementById('mvSearchKw'), condSearchBox = document.getElementById('condSearchKw');
    let toggleBtn = document.getElementById('btnToggleInputMode'), condToggleBtn = document.getElementById('btnToggleCondInputMode'); 
    if (vk && vk.classList.contains('active')) { 
        if (!vk.contains(event.target) && event.target !== searchBox && event.target !== toggleBtn && event.target !== condSearchBox && event.target !== condToggleBtn) {
            closeVK(); 
        }
    } 
});

// ================= 💡 層疊下鑽式地點選單 (前台搬運+後台修改共用) =================
function openBottomSheet(rIdx) {
    currentBsTargetRow = rIdx; 
    document.getElementById('bsOverlay').classList.add('active'); 
    document.getElementById('bsContainer').classList.add('active'); 
    renderBsMain(); 
}

function openBatchBottomSheet() {
    let cbs = document.querySelectorAll('.prev-item-cb:checked');
    if (cbs.length === 0) return alert('請先勾選要批次修改地點的項目！');
    currentBsTargetRow = 'BATCH'; 
    document.getElementById('bsOverlay').classList.add('active'); 
    document.getElementById('bsContainer').classList.add('active'); 
    renderBsMain();
}

function renderBsMain() {
    bsState.step = 0; bsState.main = ''; bsState.med = '';
    document.querySelector('.bs-header').innerHTML = '<div class="bs-drag-handle"></div>📍 選擇大區 (1/3)';
    let html = '<div class="list-group list-group-flush">';
    globalLocTree.forEach(m => {
        html += `<button class="list-group-item list-group-item-action fw-bold py-3 text-primary d-flex justify-content-between align-items-center" onclick="renderBsMedium('${escapeHTML(m.main)}')"><span>📂 ${escapeHTML(m.main)}</span><i class="fas fa-chevron-right text-muted"></i></button>`;
    });
    html += '</div>';
    document.getElementById('bsBody').innerHTML = html;
}

function renderBsMedium(main) {
    bsState.step = 1; bsState.main = main;
    document.querySelector('.bs-header').innerHTML = `<div class="bs-drag-handle"></div><div class="d-flex align-items-center"><button class="btn btn-sm btn-light py-0 me-2 shadow-sm" onclick="renderBsMain()"><i class="fas fa-arrow-left"></i></button><span class="fw-bold">📍 選擇中區 (2/3)</span></div>`;
    let targetMain = globalLocTree.find(m => m.main === main);
    if(!targetMain) return;
    let html = '<div class="list-group list-group-flush">';
    targetMain.subs.forEach(s => {
        let displaySub = s.sub === "(本區)" ? "(不指定中區，直接選層板)" : s.sub;
        html += `<button class="list-group-item list-group-item-action fw-bold py-3 text-success d-flex justify-content-between align-items-center" onclick="renderBsSmall('${escapeHTML(main)}', '${escapeHTML(s.sub)}')"><span>📁 ${escapeHTML(displaySub)}</span><i class="fas fa-chevron-right text-muted"></i></button>`;
    });
    html += '</div>';
    document.getElementById('bsBody').innerHTML = html;
}

function renderBsSmall(main, med) {
    bsState.step = 2; bsState.med = med;
    document.querySelector('.bs-header').innerHTML = `<div class="bs-drag-handle"></div><div class="d-flex align-items-center"><button class="btn btn-sm btn-light py-0 me-2 shadow-sm" onclick="renderBsMedium('${escapeHTML(main)}')"><i class="fas fa-arrow-left"></i></button><span class="fw-bold">📍 選擇小區 (3/3)</span></div>`;
    let targetMain = globalLocTree.find(m => m.main === main);
    let targetSub = targetMain ? targetMain.subs.find(s => s.sub === med) : null;
    let html = '<div class="list-group list-group-flush">';
    let validCount = 0;
    if(targetSub) {
        targetSub.details.forEach(d => {
            if(!d.isHidden) {
                validCount++;
                let displayLabel = d.label === "(無)" ? "📍 直接放置於此區" : d.label;
                html += `<button class="list-group-item list-group-item-action fw-bold py-3 text-dark" onclick="selectBsLoc('${escapeHTML(d.val)}')"><div class="d-flex align-items-center"><span class="me-2 text-info">📍</span><div><div class="fs-6">${escapeHTML(displayLabel)}</div><small class="text-muted fw-normal" style="font-size:0.75rem;">完整地點: ${escapeHTML(d.val)}</small></div></div></button>`;
            }
        });
    }
    if(validCount === 0) html += '<div class="p-4 text-center text-muted">此區目前沒有啟用的地點可供選擇</div>';
    html += '</div>';
    document.getElementById('bsBody').innerHTML = html;
}

function closeBottomSheet() { 
    document.getElementById('bsOverlay').classList.remove('active'); 
    document.getElementById('bsContainer').classList.remove('active'); 
    setTimeout(() => { document.querySelector('.bs-header').innerHTML = '<div class="bs-drag-handle"></div>選擇實際放置地點'; }, 300);
}

function selectBsLoc(loc) { 
    if (String(currentBsTargetRow).startsWith('MGR_')) {
        let rIdx = parseInt(String(currentBsTargetRow).replace('MGR_', ''));
        let input = document.getElementById(`mgrLoc_${rIdx}`);
        if (input) input.value = loc;
        closeBottomSheet();
        promptEditMgrOptimistic(rIdx, loc); 
    } else if (currentBsTargetRow === 'BATCH') {
        document.querySelectorAll('.prev-item-cb:checked').forEach(cb => {
            let rIdx = parseInt(cb.value); 
            let input = document.getElementById(`prevLoc_${rIdx}`);
            if(input) { input.value = loc; checkLocModification(rIdx); }
        });
        let sa = document.getElementById('prevSelectAll');
        if(sa) sa.checked = false;
        togglePrevSelectAll(false);
        closeBottomSheet(); 
    } else {
        let parsedIdx = parseInt(currentBsTargetRow); 
        let input = document.getElementById(`prevLoc_${parsedIdx}`); 
        input.value = loc; closeBottomSheet(); checkLocModification(parsedIdx); 
    }
}

function enableManualLocInput() { 
    closeBottomSheet(); 
    if (String(currentBsTargetRow).startsWith('MGR_')) {
        let rIdx = parseInt(String(currentBsTargetRow).replace('MGR_', ''));
        let manualLoc = prompt("請輸入手 manualLoc 特殊地點：");
        if (manualLoc !== null && manualLoc.trim() !== '') {
            let input = document.getElementById(`mgrLoc_${rIdx}`);
            if (input) input.value = manualLoc.trim();
            promptEditMgrOptimistic(rIdx, manualLoc.trim());
        }
    } else if (currentBsTargetRow === 'BATCH') {
        let manualLoc = prompt("請輸入要批次套用的特殊地點：");
        if (manualLoc !== null && manualLoc.trim() !== '') {
            document.querySelectorAll('.prev-item-cb:checked').forEach(cb => {
                let rIdx = parseInt(cb.value); 
                let input = document.getElementById(`prevLoc_${rIdx}`);
                if(input) { input.value = manualLoc.trim(); checkLocModification(rIdx); }
            });
            let sa = document.getElementById('prevSelectAll');
            if(sa) sa.checked = false;
            togglePrevSelectAll(false);
        }
    } else {
        let parsedIdx = parseInt(currentBsTargetRow); 
        let input = document.getElementById(`prevLoc_${parsedIdx}`); 
        input.removeAttribute('readonly'); input.focus(); 
    }
}

function checkLocModification(rIdx) { 
    let parsedIdx = parseInt(rIdx);
    let input = document.getElementById(`prevLoc_${parsedIdx}`), 
        card = document.getElementById(`prevCard_${parsedIdx}`), 
        item = currentProjectItems.find(x => x.rowIndex === parsedIdx); 
    if(!item) return; 
    if(input.value.trim() !== '' && input.value.trim() !== (item.expectedLoc||'待定')) { 
        card.classList.add('preview-card-modified'); 
    } else { 
        card.classList.remove('preview-card-modified'); 
    } 
}

// ================= 💡 查詢、建檔、列印、盤點 =================
function triggerManualQuery() { const val = document.getElementById('queryManualInput').value; if(!val) return alert("請輸入編號"); execQuery(val); }
async function execQuery(rawStr) { 
    let cleanId = rawStr.includes('?id=') ? new URL(rawStr).searchParams.get('id') : rawStr.trim().split('\n')[0]; 
    if(queryScanner) { await stopScannerSafe(queryScanner); queryScanner = null; document.getElementById('query-reader-container').style.display = 'none'; } 
    const res = globalCatalog[cleanId]; 
    if(res) { renderQueryUI(res); fetchFreshQueryData(cleanId); } 
    else { 
        showMiniLoading('🔍 查詢雲端最新狀態中...'); 
        try { const freshRes = await callAPI('queryItem', { qrStr: cleanId }); globalCatalog[cleanId] = freshRes; renderQueryUI(freshRes); 
        } catch(e) { alert(e.message); document.getElementById('btnStartQueryCam').style.display = 'block'; } finally { hideMiniLoading(); } 
    } 
}
async function fetchFreshQueryData(cleanId) { 
    const badge = document.getElementById('qResBadge'), locText = document.getElementById('qResLoc'); 
    badge.innerHTML = '☁️ 同步中...'; badge.className = 'badge bg-secondary position-absolute shadow-sm'; 
    try { 
        const freshRes = await callAPI('queryItem', { qrStr: cleanId }); globalCatalog[cleanId] = freshRes; 
        if(locText.innerText !== freshRes.location && freshRes.location) { locText.innerHTML = `<span class="text-danger fade-in-section">📍 ${escapeHTML(freshRes.location)} (最新)</span>`; playSound('success'); } else { locText.innerText = freshRes.location || "無地點"; } 
        if(freshRes.isScanned) { badge.className = "badge bg-success position-absolute shadow-sm"; badge.innerHTML = `✅ 已盤點`; } else { badge.className = "badge bg-danger position-absolute shadow-sm"; badge.innerHTML = `⚠️ 未盤點`; } 
    } catch(e) { badge.className = "badge bg-warning text-dark position-absolute shadow-sm"; badge.innerHTML = `⚠️ 離線快取`; } 
}
function renderQueryUI(res) { 
    document.getElementById('qResLoc').innerText = res.location || "無地點資料"; 
    document.getElementById('qResName').innerText = res.name || "未知名稱"; 
    document.getElementById('qResPropNum').innerText = res.propNum || "未建檔"; 
    document.getElementById('qResId').innerText = res.id; 
    document.getElementById('qResAccession').innerText = res.accession || "未註明"; 
    document.getElementById('qResJiang').innerText = res.jiang || "未註明"; 
    document.getElementById('qResDesc').innerText = res.desc || "無備註說明"; 
    const badge = document.getElementById('qResBadge'); 
    if(res.isScanned) { badge.className = "badge bg-success position-absolute shadow-sm"; badge.innerHTML = `✅ 已盤點 (${res.lastScanStr})`; } else { badge.className = "badge bg-danger position-absolute shadow-sm"; badge.innerHTML = `⚠️ ${res.lastScanStr}`; } 
    document.getElementById('btnStartQueryCam').style.display = 'none'; document.getElementById('queryResultBox').style.display = 'block'; playSound('success'); 
}
function startQueryScanner() { document.getElementById('queryResultBox').style.display = 'none'; document.getElementById('btnStartQueryCam').style.display = 'none'; document.getElementById('query-reader-container').style.display = 'block'; if (!queryScanner) queryScanner = new Html5Qrcode("query-reader"); if (queryScanner.getState() !== 2) { queryScanner.start({ facingMode: "environment" }, { fps: 10, qrbox: { width: 250, height: 250 } }, msg => execQuery(msg)); } }
async function stopQueryScannerAndReturn() { showMiniLoading('關閉相機...'); await stopScannerSafe(queryScanner); queryScanner = null; document.getElementById('query-reader-container').style.display = 'none'; document.getElementById('btnStartQueryCam').style.display = 'block'; hideMiniLoading(); }

async function submitRegistration() { const p = { id: document.getElementById('regId').value, name: document.getElementById('regName').value, loc: document.getElementById('regLoc').value, propNum: document.getElementById('regPropNum').value, accession: document.getElementById('regAccession').value, jiang: document.getElementById('regJiang').value, desc: document.getElementById('regDesc').value }; if(!p.id || !p.name || !p.loc) return alert("請完整填寫必填欄位 (*)！"); showMiniLoading('寫入資料庫建檔中...'); try { await callAPI('registerItem', p); alert(`✅ 藏品 [${p.id}] 已建檔成功！\nQR Code 已於雲端自動生成。`); globalCatalog[p.id] = { id: p.id, name: p.name, location: p.loc, desc: p.desc, lastScanStr: "從未盤點", isScanned: false, accession: p.accession, jiang: p.jiang, propNum: p.propNum, formatMaterial: "", size: "", author: "", note: p.desc }; if(allPrintItems.length > 0) { allPrintItems.unshift({ id: p.id, name: p.name, loc: p.loc }); filterPrintList(); } ['regId', 'regName', 'regLoc', 'regLocDisplay', 'regPropNum', 'regAccession', 'regDesc'].forEach(id => document.getElementById(id).value = ''); document.getElementById('regJiang').value = '不相關'; } catch(e) { alert("建檔失敗：" + e.message); } finally { hideMiniLoading(); } }

// 🔥 全域列印中心與多格式選擇機制
async function loadPrintList() { if(allPrintItems && allPrintItems.length > 0) return; const items = Object.values(globalCatalog); allPrintItems = items.map(i => ({ id: i.id, name: i.name, loc: i.location })).reverse(); const locs = [...new Set(allPrintItems.map(i => i.loc))].sort(); let locHtml = '<option value="">所有地點</option>'; locs.forEach(l => locHtml += `<option value="${escapeHTML(l)}">${escapeHTML(l)}</option>`); document.getElementById('printLocFilter').innerHTML = locHtml; filterPrintList(); }
function filterPrintList() { 
    const kwStr = document.getElementById('printSearch').value.toLowerCase().trim();
    const keywords = kwStr ? kwStr.split(/\s+/) : [];
    const locFilter = document.getElementById('printLocFilter').value; 
    const filtered = allPrintItems.filter(item => { 
        let locMatch = (locFilter === "" || item.loc === locFilter);
        if(!locMatch) return false;
        if(keywords.length === 0) return true;
        let targetStr = (item.id + ' ' + item.name).toLowerCase();
        return keywords.every(k => targetStr.includes(k));
    }); 
    renderPrintList(filtered); 
}
function renderPrintList(items) { const container = document.getElementById('printListContainer'); if(items.length === 0) { container.innerHTML = '<div class="p-3 text-center text-muted">查無紀錄</div>'; return; } container.innerHTML = items.map((item, idx) => `<div class="print-item p-2 d-flex align-items-center"><input class="form-check-input me-2 cb-print" type="checkbox" value="${escapeHTML(item.id)}" data-name="${escapeHTML(item.name)}" data-loc="${escapeHTML(item.loc)}" id="pr_${idx}" ${printCartMap.has(item.id) ? 'checked' : ''} onchange="updateCart(this)"><label class="form-check-label flex-grow-1 d-flex flex-column" for="pr_${idx}"><div class="fw-bold text-dark d-flex justify-content-between"><span>${escapeHTML(item.id)}</span><span class="badge bg-secondary" style="font-size:0.7rem;">${escapeHTML(item.loc)}</span></div><div class="small text-muted text-truncate" style="max-width: 250px;">${escapeHTML(item.name)}</div></label></div>`).join(''); updateCartBtn(); }
function updateCart(cb) { if(cb.checked) { printCartMap.set(cb.value, { name: cb.getAttribute('data-name'), loc: cb.getAttribute('data-loc') }); } else { printCartMap.delete(cb.value); } updateCartBtn(); }
function togglePrintAll(isCheck) { document.querySelectorAll('.cb-print').forEach(cb => { cb.checked = isCheck; updateCart(cb); }); }
function selectTop10Print() { togglePrintAll(false); const cbs = document.querySelectorAll('.cb-print'); for(let i=0; i<Math.min(10, cbs.length); i++) { cbs[i].checked = true; updateCart(cbs[i]); } }
function updateCartBtn() { document.getElementById('btnGoPreview').innerText = `🏷️ 檢視已選標籤 (共 ${printCartMap.size} 件)`; }
function showPrintPreview() { if(printCartMap.size === 0) return alert("請先勾選要列印的標籤！"); document.getElementById('printSelectSec').style.display = 'none'; document.getElementById('printPreviewSec').style.display = 'block'; let html = ''; printCartMap.forEach((data, id) => { html += `<div class="print-item p-2 d-flex align-items-center justify-content-between"><div class="d-flex flex-column" style="max-width: 80%;"><span class="fw-bold text-dark text-break">${escapeHTML(id)}</span><span class="small text-muted text-truncate">${escapeHTML(data.name)}</span><span class="badge bg-light text-secondary border mt-1 align-self-start" style="font-size:0.75rem;">📍 ${escapeHTML(data.loc)}</span></div><button class="btn btn-sm btn-outline-danger" onclick="removeFromCart('${escapeHTML(id)}')">❌ 移除</button></div>`; }); document.getElementById('printPreviewContainer').innerHTML = html; }
function removeFromCart(id) { printCartMap.delete(id); showPrintPreview(); filterPrintList(); if(printCartMap.size === 0) hidePrintPreview(); }
function hidePrintPreview() { document.getElementById('printSelectSec').style.display = 'block'; document.getElementById('printPreviewSec').style.display = 'none'; }

// 🔥 攔截舊的列印按鈕，改為呼叫選擇格式 Modal
function generatePrintPage() { 
    if(printCartMap.size === 0) return alert("請至少選擇一筆項目！"); 
    bootstrap.Modal.getOrCreateInstance(document.getElementById('printFormatModal')).show(); 
}

// 執行指定格式列印
function executeGeneratePrintPage(format) {
    bootstrap.Modal.getInstance(document.getElementById('printFormatModal')).hide();
    showMiniLoading("生成本機高品質標籤中...");
    setTimeout(() => { 
        try { 
            if (format === 'basic') { generateBasicPrintHtml(); } 
            else { generateFullPrintHtml(); }
            document.getElementById('printOverlay').style.display = 'flex'; 
            
            // 確保產生後，立即依據開關狀態套用邊框樣式
            if (typeof togglePrintBorders === 'function') togglePrintBorders();
            
            hideMiniLoading(); 
        } catch(e) { hideMiniLoading(); alert("產生列印畫面時發生錯誤：" + e.message); } 
    }, 50);
}

// 🔥 裁切線開關控制邏輯
function togglePrintBorders() {
    const checkEl = document.getElementById('toggleBorderCheck');
    const isChecked = checkEl ? checkEl.checked : true;
    const labels = document.querySelectorAll('.label-box, .fl-card');
    labels.forEach(label => {
        if (isChecked) {
            label.classList.remove('no-border');
        } else {
            label.classList.add('no-border');
        }
    });
}

// 🔥 修正：產生純粹乾淨的 QR Code 格式，拔除多餘文字與標題
function generateBasicPrintHtml() {
    const groups = {}; 
    printCartMap.forEach((data, id) => { 
        const loc = data.loc || '未分類地點'; 
        if (!groups[loc]) groups[loc] = []; 
        groups[loc].push({ id: id, name: data.name }); 
    }); 
    let printHtml = `<div class="preview-paper"><div class="grid-container" style="gap:2px; justify-content:flex-start;">`; 
    for(let loc of Object.keys(groups).sort()) { 
        for(let item of groups[loc]) { 
            const urlStr = `https://shaiwilliam.github.io/museum-inventory/?id=${encodeURIComponent(item.id)}`; 
            const qr = new QRious({ value: urlStr, size: 150, level: 'M' }); 
            const base64Img = qr.toDataURL('image/png'); 
            printHtml += `<div class="label-box" style="background: white; display: flex; justify-content: center; align-items: center; padding: 0;"><img src="${base64Img}" alt="QR" style="width: 25mm; height: 25mm; object-fit: contain;"></div>`; 
        } 
    } 
    printHtml += `</div></div>`; 
    document.getElementById('printOverlayContent').innerHTML = printHtml;
}

// 🔥 產生完整藏品吊牌 (6x3cm) - 保留十字線、取消打洞
function generateFullPrintHtml() {
    let itemsToPrint = [];
    printCartMap.forEach((data, id) => {
        let catObj = globalCatalog[id] || {};
        itemsToPrint.push({ id: id, name: data.name, loc: data.loc || '未指定地點', propNum: catObj.propNum || '無財編' });
    });
    
    // 依據地點與編號排序方便裁切後整理
    itemsToPrint.sort((a,b) => a.loc.localeCompare(b.loc) || a.id.localeCompare(b.id));

    let printHtml = `
    <style>
        .full-print-container { display: flex; flex-wrap: wrap; justify-content: flex-start; align-content: flex-start; padding: 5mm; background: white; margin: 0 auto; width: 210mm; }
        .fl-card { width: 60mm; height: 30mm; background: white; position: relative; display: flex; flex-direction: row; box-sizing: border-box; page-break-inside: avoid; margin: 0 1mm 1mm 0; border: 0.5px dashed #ccc; }
        .fl-crop-tl, .fl-crop-tr, .fl-crop-bl, .fl-crop-br { position: absolute; width: 3mm; height: 3mm; border-color: #999; border-style: solid; pointer-events: none; }
        .fl-crop-tl { top: 0; left: 0; border-width: 0.5px 0 0 0.5px; }
        .fl-crop-tr { top: 0; right: 0; border-width: 0.5px 0.5px 0 0; }
        .fl-crop-bl { bottom: 0; left: 0; border-width: 0 0 0.5px 0.5px; }
        .fl-crop-br { bottom: 0; right: 0; border-width: 0 0.5px 0.5px 0; }
        
        /* 左右排版設定 */
        .fl-qr { width: 22mm; display: flex; justify-content: center; align-items: center; padding: 1mm 0 1mm 2mm; }
        .fl-qr img { width: 20mm; height: 20mm; object-fit: contain; }
        .fl-info { flex: 1; padding: 0 2mm 0 1mm; display: flex; flex-direction: column; justify-content: center; overflow: hidden; min-width: 0; }
        .fl-text { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1.3; }
    </style>
    <div class="preview-paper full-print-container">`;

    itemsToPrint.forEach(item => {
        const urlStr = `https://shaiwilliam.github.io/museum-inventory/?id=${encodeURIComponent(item.id)}`; 
        const qr = new QRious({ value: urlStr, size: 150, level: 'M' }); 
        const base64Img = qr.toDataURL('image/png');
        let displayId = String(item.id).replace(/\n/g, ' ');

        // HTML 結構：QR 先、資訊後
        printHtml += `
        <div class="fl-card">
            <div class="fl-crop-tl"></div><div class="fl-crop-tr"></div>
            <div class="fl-crop-bl"></div><div class="fl-crop-br"></div>
            <div class="fl-qr"><img src="${base64Img}" alt="QR"></div>
            <div class="fl-info">
                <div class="fl-text" style="font-size: 8.5pt; font-weight: bold; color: #000;">${escapeHTML(displayId)}</div>
                <div class="fl-text" style="font-size: 8.5pt; font-weight: bold; color: #000; margin-bottom: 0.5mm;">${escapeHTML(item.name)}</div>
                <div class="fl-text" style="font-size: 7pt; color: #555;">${escapeHTML(item.propNum)}</div>
                <div class="fl-text" style="font-size: 7pt; color: #555;">${escapeHTML(item.loc)}</div>
            </div>
        </div>`;
    });

    printHtml += `</div>`;
    document.getElementById('printOverlayContent').innerHTML = printHtml;
}

function closePrintOverlay() { document.getElementById('printOverlay').style.display = 'none'; document.getElementById('printOverlayContent').innerHTML = ''; }
function closePrintReport() { document.getElementById('printReportOverlay').style.display = 'none'; document.getElementById('printReportContent').innerHTML = ''; }

// 🔥 新增：檢查是否有未完成的盤點進度
function checkSavedSession() {
    try {
        const saved = localStorage.getItem('invSession');
        if (saved) {
            document.getElementById('continueInvBox').style.display = 'block';
            document.getElementById('invSettingsArea').style.display = 'none';
        } else {
            document.getElementById('continueInvBox').style.display = 'none';
            document.getElementById('invSettingsArea').style.display = 'block';
        }
    } catch(e) {
        console.warn("無法存取 localStorage", e);
    }
}

function toggleLocBox() { document.getElementById('locBox').style.display = document.getElementById('modePartial').checked ? 'block' : 'none'; }
async function startInventorySession() { sysState.mode = document.getElementById('modeAll').checked ? 'all' : 'partial'; sysState.locations = Array.from(document.querySelectorAll('.leaf-cb:checked')).map(cb => cb.value); if(sysState.mode === 'partial' && sysState.locations.length === 0) return alert('請先選擇地點！'); try { localStorage.setItem('invSession', JSON.stringify({mode: sysState.mode, locations: sysState.locations})); } catch(e) {} await executeInventoryStart(); }
async function resumeInventorySession() { try { const saved = JSON.parse(localStorage.getItem('invSession')); if(!saved) return; sysState.mode = saved.mode; sysState.locations = saved.locations; } catch(e) {} await executeInventoryStart(); }
function clearInventorySession() { try { localStorage.removeItem('invSession'); } catch(e) {} document.getElementById('continueInvBox').style.display = 'none'; document.getElementById('invSettingsArea').style.display = 'block'; }

// 🔥 離線進度修復：比對 syncQueue，強制覆蓋伺服器未更新的狀態
async function executeInventoryStart() { 
    showMiniLoading('準備盤點...'); 
    try { 
        const res = await callAPI('startInventory', sysState); 
        sysState.total = res.total; 
        sysState.scanned = res.scanned; 
        localItemCache = res.itemMap || {}; 
        
        if (syncQueue && syncQueue.length > 0) {
            syncQueue.forEach(id => {
                if (localItemCache[id] && !localItemCache[id].isScanned) {
                    localItemCache[id].isScanned = true;
                    sysState.scanned++;
                }
            });
        }

        updateProgressUI(); 
        document.getElementById('step1').style.display = 'none'; 
        document.getElementById('step2').style.display = 'block'; 
        hideMiniLoading(); 
        if (!scanner) scanner = new Html5Qrcode("reader"); 
        if (scanner.getState() !== 2) { 
            scanner.start({ facingMode: "environment" }, { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 }, msg => processScanLocal(msg)); 
        } 
    } catch (e) { hideMiniLoading(); alert("錯誤：" + e.message); } 
}

function updateProgressUI() { document.getElementById('valTotal').innerText = sysState.total; document.getElementById('valScanned').innerText = sysState.scanned; document.getElementById('valUnscanned').innerText = Math.max(0, sysState.total - sysState.scanned); document.getElementById('progressBar').style.width = (sysState.total === 0 ? 0 : Math.round((sysState.scanned / sysState.total) * 100)) + '%'; }

// 🔥 新增：Dual-QR Code 地點條碼攔截 (WMS 邏輯)
async function processScanLocal(msg) { 
    if (isProc || Date.now() - lastScan < 800) return; 
    isProc = true; lastScan = Date.now(); 
    
    let cleanMsg = msg.trim();
    if (cleanMsg.startsWith("LOC:")) {
        let locName = cleanMsg.substring(4);
        playSound('success');
        const overlay = document.getElementById('resultOverlay');
        overlay.style.display = 'block';
        overlay.style.borderColor = '#0d6efd';
        document.getElementById('resStatus').innerHTML = '<span class="text-primary">📍 盤點區域切換</span>';
        document.getElementById('resName').innerText = escapeHTML(locName);
        let descEl = document.getElementById('resDesc');
        if(descEl) descEl.innerText = "接下來掃描的文物將被視為在此地點盤點";
        setTimeout(() => { overlay.style.display = 'none'; isProc = false; }, 1200);
        return;
    }

    cleanMsg = cleanMsg.includes('?id=') ? new URL(cleanMsg).searchParams.get('id') : cleanMsg.split('\n')[0]; 
    const item = localItemCache[cleanMsg]; 
    const overlay = document.getElementById('resultOverlay'); 
    overlay.style.display = 'block'; 
    if (!item) { playSound('error'); overlay.style.borderColor = '#dc3545'; document.getElementById('resStatus').innerHTML = '<span class="text-danger">❌ 不在範圍</span>'; document.getElementById('resName').innerText = cleanMsg; let descEl = document.getElementById('resDesc'); if(descEl) descEl.innerText = ""; } 
    else if (item.isScanned) { playSound('error'); overlay.style.borderColor = '#ffc107'; document.getElementById('resStatus').innerHTML = '<span class="text-warning">⚠️ 已盤點</span>'; document.getElementById('resName').innerText = item.name; let descEl = document.getElementById('resDesc'); if(descEl) descEl.innerText = ""; } 
    else { playSound('success'); item.isScanned = true; sysState.scanned++; updateProgressUI(); overlay.style.borderColor = '#198754'; document.getElementById('resStatus').innerHTML = '<span class="text-success">✅ 成功</span>'; document.getElementById('resName').innerText = item.name; let descEl = document.getElementById('resDesc'); if(descEl) descEl.innerText = ""; syncQueue.push(cleanMsg); saveSyncQueue(); triggerBackgroundSync(); } 
    setTimeout(() => { overlay.style.display = 'none'; isProc = false; }, 1200); 
}

// 🔥 解決相機資源未釋放導致的崩潰
async function pauseAndSave() { 
    document.getElementById('step2').style.display = 'none'; 
    document.getElementById('step1').style.display = 'block'; 
    checkSavedSession(); 
    if (scanner) { 
        await stopScannerSafe(scanner); 
        scanner = null; 
    } 
}

async function finishInventory() { 
    if(!confirm("確定結束進入結算？")) return; 
    document.getElementById('step2').style.display = 'none'; 
    document.getElementById('step3').style.display = 'block'; 
    if (scanner) { 
        await stopScannerSafe(scanner); 
        scanner = null; 
    } 
}
function clearAndBackToHome() { clearInventorySession(); document.getElementById('step3').style.display = 'none'; document.getElementById('step1').style.display = 'block'; backToHome(); }

// 🔥 補齊結算寄送報表功能
async function exportReport() {
    const email = document.getElementById('exportEmail').value.trim();
    const type = document.getElementById('exportType').value;
    if(!email) return alert('請輸入接收報表的 Email！');
    showMiniLoading('正在產出報表並寄送...');
    try {
        await callAPI('exportInventoryReport', { mode: sysState.mode, locations: sysState.locations, reportType: type, email: email });
        alert('✅ 結算報表寄送成功！');
        clearAndBackToHome();
    } catch(e) {
        alert('報表寄送失敗：' + e.message);
    } finally {
        hideMiniLoading();
    }
}

// ================= 💡 專案異動管理 (總覽與明細) =================
function backToOverviewTab() { document.querySelector('button[data-bs-target="#moveOverviewTab"]').click(); window.scrollTo(0, 0); }

async function loadAllProjects() { 
    showMiniLoading('載入專案總覽中...'); 
    try { 
        const res = await callAPI('getAllProjects'); allProjectsList = res || []; 
        const projNames = [...new Set(allProjectsList.map(p => p.name))].sort(); 
        let nameHtml = '<option value="">📁 所有專案名稱</option>'; 
        projNames.forEach(n => nameHtml += `<option value="${escapeHTML(n)}">${escapeHTML(n)}</option>`); 
        document.getElementById('projectSelectFilter').innerHTML = nameHtml; 
        
        let actionHtml = '<option value="NEW">➕ 建立全新專案</option>';
        allProjectsList.forEach(p => { if(p.status === '進行中') { actionHtml += `<option value="${escapeHTML(p.id)}">✏️ 編輯: ${escapeHTML(p.name)}</option>`; } });
        document.getElementById('newMvActionSelect').innerHTML = actionHtml;

        filterProjectCards(); 
    } catch(e) { alert("載入專案失敗：" + e.message); } finally { hideMiniLoading(); } 
}

function filterProjectCards() { 
    const nameFilter = document.getElementById('projectSelectFilter').value;
    const statusFilter = document.getElementById('projectStatusFilter').value; 
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
                    <div class="d-flex justify-content-between align-items-start mb-2">
                        <h6 class="fw-bold text-dark mb-0 text-truncate" style="max-width: 70%;">${escapeHTML(p.name)}</h6>
                        <span class="badge ${badgeClass}">${escapeHTML(p.status)}</span>
                    </div>
                    <small class="text-muted d-block mb-1" style="font-family: monospace;">${escapeHTML(p.id)}</small>
                    <small class="text-secondary d-block mb-3 text-truncate">${escapeHTML(p.desc || '無備註')}</small>
                    <div class="mb-3 bg-light rounded p-2 border">
                        <div class="d-flex justify-content-between small fw-bold text-secondary mb-1">
                            <span>進度</span><span>${p.moved} / ${p.total} 件 (${progressPct}%)</span>
                        </div>
                        <div class="progress" style="height: 6px;">
                            <div class="progress-bar ${p.status === '進行中' ? 'bg-success' : 'bg-secondary'}" style="width: ${progressPct}%;"></div>
                        </div>
                    </div>
                    <div class="row g-2">
                        <div class="col-12"><button class="btn btn-sm btn-light border fw-bold w-100 text-primary" onclick="viewProjectDetails('${escapeHTML(p.id)}', '${escapeHTML(p.name)}', '${escapeHTML(p.status)}', '${escapeHTML(p.desc)}')">👁️ 檢視明細</button></div>
                        <div class="col-12">${actionBtns}</div>
                    </div>
                </div>
            </div>
        </div>`; 
    }).join(''); 
}

function editProjectFromOverview(eventId) { document.querySelector('button[data-bs-target="#moveCreateTab"]').click(); document.getElementById('newMvActionSelect').value = eventId; switchMoveProjectAction(); }
function executeProjectFromOverview(eventId) { document.querySelector('button[data-bs-target="#moveExecuteTab"]').click(); document.getElementById('mvEvent').value = eventId; loadWorkerLocations(); }

async function viewProjectDetails(id, name, status, desc) { 
    showMiniLoading('讀取明細中...'); 
    try { 
        const res = await callAPI('getProjectDetails', { eventId: id }); currentPdItems = res; 
        document.getElementById('pdId').innerText = id; document.getElementById('pdModalTitle').innerText = name; 
        document.getElementById('pdStatus').innerHTML = `<span class="badge ${status === '進行中' ? 'bg-primary' : 'bg-secondary'}">${escapeHTML(status)}</span>`; 
        document.getElementById('pdDesc').innerText = desc || '無'; document.getElementById('pdSearchKw').value = ''; 
        let oldLocs = new Set(), newLocs = new Set(), prefixes = new Set(); 
        res.forEach(item => { if(item.oldLoc) oldLocs.add(item.oldLoc); if(item.newLoc) newLocs.add(item.newLoc); prefixes.add(getPrefix(item.tempCode)); }); 
        
        let oldHtml = '<option value="">📍 所有原地點</option>'; Array.from(oldLocs).sort().forEach(l => oldHtml += `<option value="${escapeHTML(l)}">${escapeHTML(l)}</option>`); document.getElementById('pdOldLocFilter').innerHTML = oldHtml; 
        let newHtml = '<option value="">📍 所有新地點</option>'; Array.from(newLocs).sort().forEach(l => newHtml += `<option value="${escapeHTML(l)}">${escapeHTML(l)}</option>`); document.getElementById('pdNewLocFilter').innerHTML = newHtml; 
        let prefHtml = '<option value="">🏷️ 所有前綴</option>'; Array.from(prefixes).sort().forEach(p => prefHtml += `<option value="${escapeHTML(p)}">${escapeHTML(p)}</option>`); document.getElementById('pdPrefixFilter').innerHTML = prefHtml; 
        
        renderPdTable(); 
        bootstrap.Modal.getOrCreateInstance(document.getElementById('projectDetailsModal')).show(); 
    } catch(e) { alert("無法讀取明細：" + e.message); } finally { hideMiniLoading(); } 
}

function renderPdTable() { 
    const kwStr = document.getElementById('pdSearchKw').value.toLowerCase().trim();
    const keywords = kwStr ? kwStr.split(/\s+/) : [];
    const oldLocFilter = document.getElementById('pdOldLocFilter').value;
    const newLocFilter = document.getElementById('pdNewLocFilter').value;
    const prefixFilter = document.getElementById('pdPrefixFilter').value; 
    
    let filtered = currentPdItems.filter(item => { 
        let prefixMatch = (!prefixFilter || getPrefix(item.tempCode) === prefixFilter);
        let oldLocMatch = (!oldLocFilter || item.oldLoc === oldLocFilter);
        let newLocMatch = (!newLocFilter || item.newLoc === newLocFilter);
        if(!(prefixMatch && oldLocMatch && newLocMatch)) return false;
        if(keywords.length === 0) return true;
        
        let safeId = String(item.id || '').replace(/\n/g, ' ');
        let safeName = String(item.name || '');
        let safeTc = String(item.tempCode || '');
        let targetStr = `${safeId} ${safeName} ${safeTc}`.toLowerCase();
        return keywords.every(k => targetStr.includes(k));
    }); 
    
    let movedCount = filtered.filter(item => item.newLoc && item.newLoc !== '').length;
    let unmovedCount = filtered.length - movedCount;
    document.getElementById('pdCount').innerHTML = `${filtered.length} 件 <span class="badge bg-success ms-2 shadow-sm">已搬運: ${movedCount}</span> <span class="badge bg-secondary shadow-sm">未搬運: ${unmovedCount}</span>`; 
    
    if(filtered.length === 0) { document.getElementById('pdTableBody').innerHTML = '<tr><td colspan="4" class="text-center text-muted py-4">查無符合條件的資料</td></tr>'; return; } 
    document.getElementById('pdTableBody').innerHTML = filtered.map(item => { 
        let tcBadge = item.tempCode ? `<br><span class="badge bg-info text-dark mt-1 shadow-sm"><i class="fas fa-tag"></i> ${escapeHTML(item.tempCode)}</span>` : ''; 
        let destHtml = item.newLoc ? `<span class="text-success fw-bold">${escapeHTML(item.newLoc)}</span>` : `<span class="text-muted">尚未搬運</span>`; 
        if(item.boxName) destHtml += `<br><small class="text-secondary border p-1 rounded mt-1 d-inline-block bg-white shadow-sm">📦 ${escapeHTML(item.boxName)}</small>`; 
        let displayId = String(item.id).replace(/\n/g, ' '); 
        return `<tr><td class="fw-bold text-start" style="font-size: 0.85rem;">${escapeHTML(displayId)}${tcBadge}</td><td class="text-start small">${escapeHTML(item.name)} <span class="badge bg-secondary">x${escapeHTML(item.qty || '1')}</span></td><td class="small text-muted">${escapeHTML(item.oldLoc)}</td><td class="small">${destHtml}</td></tr>`; 
    }).join(''); 
}

async function printProjectFromOverview(eventId, eventName) { showMiniLoading('產生清冊中...'); try { const res = await callAPI('getProjectDetails', { eventId: eventId }); if(res.length === 0) return alert("專案無資料！"); let html = `<div class="preview-paper"><h3 class="text-center fw-bold mb-4">典藏庫房 搬運清冊</h3><div class="d-flex justify-content-between mb-3 border-bottom pb-2"><span><strong>專案名稱：</strong> ${escapeHTML(eventName)}</span><span><strong>列印時間：</strong> ${new Date().toLocaleString('zh-TW')}</span></div><table class="table table-bordered table-sm" style="font-size: 10pt;"><thead class="table-light"><tr><th width="5%">項次</th><th width="20%">文物/雜物編號</th><th width="25%">名稱 (數量)</th><th width="20%">原典藏地點</th><th width="20%">移往暫存地點 (箱號)</th><th width="10%">核對簽章</th></tr></thead><tbody>`; res.forEach((item, idx) => { let dest = item.newLoc ? escapeHTML(item.newLoc) : "未搬運"; if(item.boxName) dest += `<br><small>(${escapeHTML(item.boxName)})</small>`; let tcLabel = item.tempCode ? `<br><span class="badge border border-dark text-dark mt-1" style="font-size:9pt;"><i class="fas fa-tag"></i> ${escapeHTML(item.tempCode)}</span>` : ''; let displayId = String(item.id).replace(/\n/g, ' '); html += `<tr><td class="text-center align-middle">${idx + 1}</td><td class="align-middle">${escapeHTML(displayId)} ${tcLabel}</td><td class="align-middle">${escapeHTML(item.name)} <span class="badge bg-secondary">x${escapeHTML(item.qty || '1')}</span></td><td class="align-middle">${escapeHTML(item.oldLoc)}</td><td class="align-middle">${dest}</td><td></td></tr>`; }); html += `</tbody></table><div class="mt-5 d-flex justify-content-between px-5"><div class="text-center"><div><strong>點交人簽章</strong></div><div style="border-bottom: 1px solid #000; width: 150px; margin-top: 40px;"></div></div><div class="text-center"><div><strong>搬運負責人簽章</strong></div><div style="border-bottom: 1px solid #000; width: 150px; margin-top: 40px;"></div></div><div class="text-center"><div><strong>管理員審核簽章</strong></div><div style="border-bottom: 1px solid #000; width: 150px; margin-top: 40px;"></div></div></div></div>`; document.getElementById('printReportContent').innerHTML = html; document.getElementById('printReportOverlay').style.display = 'flex'; } catch(e) { alert("無法產生清冊：" + e.message); } finally { hideMiniLoading(); } }

// ================= 💡 專案編輯與清單管理 =================
function loadNewMvList() { 
    if(allMvItems && allMvItems.length > 0) return; 
    const items = Object.values(globalCatalog); 
    allMvItems = items.map(i => ({ id: i.id, name: i.name, loc: i.location })).reverse(); 
    const locs = [...new Set(allMvItems.map(i => i.loc))].sort(); 
    let locHtml = '<option value="">所有地點</option>'; 
    locs.forEach(l => locHtml += `<option value="${escapeHTML(l)}">${escapeHTML(l)}</option>`); 
    document.getElementById('newMvLocFilter').innerHTML = locHtml; 
}

async function switchMoveProjectAction() { 
    const val = document.getElementById('newMvActionSelect').value; 
    loadNewMvList(); 
    if(val === 'NEW') { 
        document.getElementById('newMvName').value = ''; document.getElementById('newMvDesc').value = ''; 
        clearNewMvSelection(); clearMvDraft(); filterNewMvList();
    } else { 
        showMiniLoading('讀取專案資料中...'); 
        try { 
            const res = await callAPI('getProjectDataForEdit', { eventId: val }); 
            document.getElementById('newMvName').value = res.name; document.getElementById('newMvDesc').value = res.desc; 
            newMvCart.clear(); 
            res.items.forEach(item => { 
                newMvCart.set(item.id, { name: item.name, loc: item.loc, isMisc: item.id.startsWith('MISC-'), tempCode: item.tempCode, expectedLoc: item.expectedLoc || '待定', qty: item.qty || '1' }); 
                let existing = allMvItems.find(x => x.id === item.id); 
                if(!existing) { allMvItems.unshift({ id: item.id, name: item.name, loc: item.loc, isMisc: item.id.startsWith('MISC-'), tempCode: item.tempCode, expectedLoc: item.expectedLoc || '待定', qty: item.qty || '1' }); } 
                else { existing.tempCode = item.tempCode; } 
            }); 
            document.getElementById('newMvSelectedCount').innerText = newMvCart.size; 
            filterNewMvList(); clearMvDraft(); 
        } catch(e) { alert("讀取失敗: " + e.message); } finally { hideMiniLoading(); } 
    } 
}

function openMiscModal() { document.getElementById('miscName').value = ''; document.getElementById('miscLocDisplay').value = ''; document.getElementById('miscLoc').value = ''; document.getElementById('miscTempCode').value = ''; bootstrap.Modal.getOrCreateInstance(document.getElementById('miscModal')).show(); }
function addMiscItem() { const name = document.getElementById('miscName').value.trim(), loc = document.getElementById('miscLoc').value.trim(), tCode = document.getElementById('miscTempCode').value.trim(); if(!name || !loc) return alert("請完整填寫名稱與地點！"); const miscId = "MISC-" + new Date().getTime() + "-" + Math.floor(Math.random()*100); allMvItems.unshift({ id: miscId, name: name, loc: loc, isMisc: true, tempCode: tCode, expectedLoc: '待定', qty: '1' }); newMvCart.set(miscId, { name: name, loc: loc, isMisc: true, tempCode: tCode, expectedLoc: '待定', qty: '1' }); bootstrap.Modal.getInstance(document.getElementById('miscModal')).hide(); document.getElementById('newMvSelectedCount').innerText = newMvCart.size; document.getElementById('newMvSearch').value = name; saveMvDraft(); filterNewMvList(); showSyncToast("✅ 雜物已加入清單", true); }

function filterNewMvList() { 
    const kwStr = document.getElementById('newMvSearch').value.toLowerCase().trim();
    const keywords = kwStr ? kwStr.split(/\s+/) : [];
    const locFilter = document.getElementById('newMvLocFilter').value; 
    const container = document.getElementById('newMvListContainer'); 
    
    const filtered = allMvItems.filter(item => { 
        let locMatch = (locFilter === "" || item.loc === locFilter);
        if(!locMatch) return false;
        if(keywords.length === 0) return true;
        
        let cartItem = newMvCart.get(item.id);
        let tc = cartItem ? (cartItem.tempCode || '') : (item.tempCode || '');
        
        let safeId = String(item.id || '').replace(/\n/g, ' ');
        let safeName = String(item.name || '');
        let safeTc = String(tc);
        let targetStr = `${safeId} ${safeName} ${safeTc}`.toLowerCase();
        
        return keywords.every(k => targetStr.includes(k));
    }); 
    
    if(filtered.length === 0) { container.innerHTML = '<div class="p-3 text-center text-muted">查無結果</div>'; return; } 
    const displayItems = filtered.slice(0, 150); 
    let html = displayItems.map((item, idx) => { 
        let cartItem = newMvCart.get(item.id); let isChecked = cartItem ? 'checked' : ''; 
        let tcBadge = (cartItem && cartItem.tempCode) ? `<span class="badge bg-info text-dark ms-2 shadow-sm"><i class="fas fa-tag"></i> ${escapeHTML(cartItem.tempCode)}</span>` : ''; 
        let displayId = String(item.id).replace(/\n/g, ' '); 
        return `<div class="print-item p-2 d-flex align-items-center"><input class="form-check-input me-2 cb-newmv" type="checkbox" value="${escapeHTML(item.id)}" data-name="${escapeHTML(item.name)}" data-loc="${escapeHTML(item.loc)}" id="nmv_${idx}" ${isChecked} onchange="updateNewMvCart(this)"><label class="form-check-label flex-grow-1 d-flex flex-column" for="nmv_${idx}"><div class="fw-bold text-dark d-flex justify-content-between"><span>${item.isMisc ? '📦 ' + escapeHTML(displayId) : escapeHTML(displayId)} ${tcBadge}</span><span class="badge bg-secondary" style="font-size:0.7rem;">${escapeHTML(item.loc)}</span></div><div class="small ${item.isMisc ? 'text-danger' : 'text-muted'} text-truncate" style="max-width: 250px;">${escapeHTML(item.name)}</div></label></div>`; 
    }).join(''); 
    if(filtered.length > 150) { html += `<div class="text-center text-muted small mt-2">僅顯示前 150 筆，請利用搜尋縮小範圍</div>`; } 
    container.innerHTML = html; 
}

function updateNewMvCart(cb) { if(cb.checked) { let existingItem = newMvCart.get(cb.value); let tc = existingItem ? existingItem.tempCode : null; let exp = existingItem ? existingItem.expectedLoc : '待定'; let qty = existingItem ? existingItem.qty : '1'; newMvCart.set(cb.value, { name: cb.getAttribute('data-name'), loc: cb.getAttribute('data-loc'), tempCode: tc, expectedLoc: exp, qty: qty }); } else { newMvCart.delete(cb.value); } saveMvDraft(); document.getElementById('newMvSelectedCount').innerText = newMvCart.size; }
function toggleNewMvAll(isCheck) { document.querySelectorAll('.cb-newmv').forEach(cb => { cb.checked = isCheck; updateNewMvCart(cb); }); filterNewMvList(); }
function clearNewMvSelection(requireConfirm = false, modalId = null) { if (requireConfirm) { if (newMvCart.size === 0) return; if (!confirm("確定要清空目前已選擇的待搬運文物嗎？這將會清除您的勾選清單與臨時編碼！")) return; } newMvCart.clear(); saveMvDraft(); document.getElementById('newMvSelectedCount').innerText = 0; filterNewMvList(); if (modalId) { let m = bootstrap.Modal.getInstance(document.getElementById(modalId)); if (m) m.hide(); } }

function openImportModal() { 
    loadNewMvList(); 
    document.getElementById('importTextarea').value = ''; document.getElementById('importPreviewSection').style.display = 'none'; parsedImportItems = []; 
    bootstrap.Modal.getOrCreateInstance(document.getElementById('importModal')).show(); 
}
function parseImportData() { 
    const raw = document.getElementById('importTextarea').value.trim(); if(!raw) return alert("請先貼上資料！"); 
    parsedImportItems = []; const lines = raw.split('\n'); 
    lines.forEach(line => { 
        if(!line.trim()) return; let cols = line.includes('\t') ? line.split('\t') : line.split(','); cols = cols.map(c => c.trim()); if (cols.length === 0) return; 
        let parsedTempCode = '', parsedId = '', parsedName = '', parsedQty = '1', parsedExpectedLoc = ''; 
        if (cols.length === 1) { parsedId = cols[0]; } else { parsedTempCode = cols[0]; parsedId = cols[1]; parsedName = cols.length > 2 ? cols[2] : ''; parsedQty = cols.length > 3 && cols[3] !== '' ? cols[3] : '1'; parsedExpectedLoc = cols.length > 4 ? cols[4] : ''; } 
        if (!parsedId) return; 
        let existingBase = allMvItems.find(x => x.id === parsedId || x.id.split('\n')[0] === parsedId), finalId = parsedId, partDesc = []; 
        if (parsedTempCode) partDesc.push(parsedTempCode); if (parsedName && (!existingBase || parsedName !== existingBase.name)) partDesc.push(parsedName); 
        if (partDesc.length > 0) { finalId = parsedId + "\n[" + partDesc.join(' - ') + "]"; } 
        let inCart = newMvCart.has(finalId), status = 'match', loc = '未知', oldTc = ''; 
        if (existingBase) { parsedName = parsedName || existingBase.name; loc = existingBase.loc; if (inCart) { let cartItem = newMvCart.get(finalId); oldTc = cartItem.tempCode || ''; if (parsedTempCode && oldTc && oldTc !== parsedTempCode) { status = 'conflict'; } else { status = 'duplicate'; } } } else { status = 'unmatched'; } 
        parsedImportItems.push({ originalId: parsedId, finalId: finalId, name: parsedName || '未知名稱', loc: loc, tempCode: parsedTempCode, oldTc: oldTc, status: status, isMisc: false, expectedLoc: parsedExpectedLoc || '待定', qty: parsedQty }); 
    }); 
    renderImportPreview(); document.getElementById('importPreviewSection').style.display = 'block'; 
}
function renderImportPreview() { 
    let html = '', matchCount = 0, unmatchedCount = 0, dupCount = 0; 
    parsedImportItems.forEach(item => { 
        let statusBadge = '', trClass = '', tcHtml = '', locColumnHtml = escapeHTML(item.loc); 
        if (item.status === 'match') { statusBadge = '<span class="badge bg-success">✅ 成功</span>'; matchCount++; if(item.tempCode) tcHtml = `<br><span class="badge bg-info text-dark mt-1"><i class="fas fa-tag"></i> ${escapeHTML(item.tempCode)}</span>`; } 
        else if (item.status === 'duplicate') { statusBadge = '<span class="badge bg-secondary">🔄 已在清單</span>'; trClass = 'table-secondary text-muted'; dupCount++; if(item.tempCode) tcHtml = `<br><span class="badge bg-info text-dark mt-1"><i class="fas fa-tag"></i> ${escapeHTML(item.tempCode)}</span>`; } 
        else if (item.status === 'conflict') { statusBadge = '<span class="badge bg-warning text-dark">⚠️ 衝突</span>'; trClass = 'table-warning'; dupCount++; tcHtml = `<br><small class="text-danger fw-bold">原: [${escapeHTML(item.oldTc)}] ➔ 匯入: [${escapeHTML(item.tempCode)}]</small><br><input type="text" class="form-control form-control-sm mt-1 conflict-tc-input" data-id="${escapeHTML(item.finalId)}" value="${escapeHTML(item.oldTc)}" placeholder="確認編碼">`; } 
        else if (item.status === 'unmatched') { statusBadge = '<span class="badge bg-danger">❌ 查無此物</span>'; trClass = 'table-danger'; unmatchedCount++; } 
        else if (item.status === 'misc') { statusBadge = '<span class="badge bg-warning text-dark">📦 轉為雜物</span>'; trClass = 'table-warning'; matchCount++; if(item.tempCode) tcHtml = `<br><span class="badge bg-info text-dark mt-1"><i class="fas fa-tag"></i> ${escapeHTML(item.tempCode)}</span>`; locColumnHtml = `<div class="input-group input-group-sm"><input type="text" class="form-control bg-white text-danger fw-bold" readonly placeholder="點選或掃描..." value="${escapeHTML(item.loc)}" onclick="triggerImportMiscLoc('${escapeHTML(item.finalId)}')"><button class="btn btn-outline-danger" type="button" onclick="startImportLocScanner('${escapeHTML(item.finalId)}')"><i class="fas fa-qrcode"></i></button></div>`; } 
        let displayId = String(item.finalId).replace(/\n/g, ' '); 
        html += `<tr class="${trClass}"><td>${statusBadge}</td><td class="fw-bold text-start">${escapeHTML(displayId)}${tcHtml}</td><td class="text-start">${escapeHTML(item.name)} <span class="badge bg-secondary rounded-pill">x${escapeHTML(item.qty || '1')}</span><br><small class="text-primary fw-bold">預計搬往: ${escapeHTML(item.expectedLoc)}</small></td><td class="align-middle" style="min-width: 140px;">${locColumnHtml}</td></tr>`; 
    }); 
    document.getElementById('importPreviewTableBody').innerHTML = html || '<tr><td colspan="4" class="text-center">無有效資料</td></tr>'; 
    document.getElementById('importStats').innerHTML = `共 ${parsedImportItems.length} 筆資料 (✅ 可匯入: ${matchCount} | ❌ 未知: ${unmatchedCount} | 🔄 重複/衝突: ${dupCount})`; 
    const btnMisc = document.getElementById('btnConvertMisc'), warnMsg = document.getElementById('importWarningMsg'); 
    if (unmatchedCount > 0) { btnMisc.style.display = 'inline-block'; warnMsg.style.display = 'block'; } else { btnMisc.style.display = 'none'; warnMsg.style.display = 'none'; } 
    let hasMissingLoc = parsedImportItems.some(i => i.status === 'misc' && !i.loc); document.getElementById('btnConfirmImport').disabled = (matchCount === 0 && document.querySelectorAll('.conflict-tc-input').length === 0) || hasMissingLoc; 
}
function convertUnmatchedToMisc() { parsedImportItems.forEach(item => { if (item.status === 'unmatched') { item.status = 'misc'; item.isMisc = true; item.finalId = "MISC-" + new Date().getTime() + "-" + Math.floor(Math.random()*10000); item.loc = ''; } }); renderImportPreview(); }
function confirmImport() { 
    let importCount = 0, missingLoc = false; parsedImportItems.forEach(item => { if (item.status === 'misc' && !item.loc) missingLoc = true; }); if (missingLoc) { return alert("請為所有轉換的雜物選擇或掃描「所在地點」！"); } 
    document.querySelectorAll('.conflict-tc-input').forEach(input => { let id = input.getAttribute('data-id'), item = parsedImportItems.find(x => x.finalId === id); if(item) { item.tempCode = input.value; item.status = 'match'; } }); 
    parsedImportItems.forEach(item => { 
        if (item.status === 'match' || item.status === 'misc') { 
            if (item.isMisc && !allMvItems.find(x => x.id === item.finalId)) { allMvItems.unshift({ id: item.finalId, name: item.name, loc: item.loc, isMisc: true, tempCode: item.tempCode, expectedLoc: item.expectedLoc, qty: item.qty }); } 
            newMvCart.set(item.finalId, { name: item.name, loc: item.loc, isMisc: item.isMisc, tempCode: item.tempCode, expectedLoc: item.expectedLoc, qty: item.qty }); 
            if (!item.isMisc) { let existing = allMvItems.find(x => x.id === item.finalId); if(!existing) { allMvItems.unshift({ id: item.finalId, name: item.name, loc: item.loc, isMisc: false, tempCode: item.tempCode, expectedLoc: item.expectedLoc, qty: item.qty }); } else { existing.tempCode = item.tempCode; } } importCount++; 
        } 
    }); 
    saveMvDraft(); bootstrap.Modal.getInstance(document.getElementById('importModal')).hide(); document.getElementById('newMvSelectedCount').innerText = newMvCart.size; filterNewMvList(); showSyncToast(`✅ 成功匯入/更新 ${importCount} 筆項目！`, true); 
}
function triggerImportMiscLoc(id) { currentModalTarget = 'importMiscLoc_' + id; document.getElementById('locModalTitle').innerText = "選擇「雜物所在地點」"; document.getElementById('modalLocSearch').value = ''; filterModalTree(); renderTreeHTML(globalLocTree, 'modalLocContainer', 'modal', false); bootstrap.Modal.getInstance(document.getElementById('importModal')).hide(); bootstrap.Modal.getOrCreateInstance(document.getElementById('locModal')).show(); }
function startImportLocScanner(id) { locScanTarget = 'importMiscLoc_' + id; document.getElementById('locScannerTitle').innerText = "掃描「雜物所在地點」條碼"; document.getElementById('loc-reader-container').style.display = 'flex'; bootstrap.Modal.getInstance(document.getElementById('importModal')).hide(); if (!locScanner) locScanner = new Html5Qrcode("loc-reader"); if (locScanner.getState() !== 2) { locScanner.start({ facingMode: "environment" }, { fps: 10, qrbox: { width: 250, height: 250 } }, msg => handleLocScan(msg)); } }


// ================= 💡 精修清單與臨時碼 =================
function refreshCartPrefixDropdown(targetPrefix) { let prefixes = new Set(); newMvCart.forEach((val) => prefixes.add(getPrefix(val.tempCode))); let currentFilter = document.getElementById('cartPrefixFilter').value, selectHtml = '<option value="">所有前綴</option>'; Array.from(prefixes).sort().forEach(p => { selectHtml += `<option value="${escapeHTML(p)}">${escapeHTML(p)}</option>`; }); document.getElementById('cartPrefixFilter').innerHTML = selectHtml; if (targetPrefix !== undefined && prefixes.has(targetPrefix)) { document.getElementById('cartPrefixFilter').value = targetPrefix; } else if (currentFilter && prefixes.has(currentFilter)) { document.getElementById('cartPrefixFilter').value = currentFilter; } else { document.getElementById('cartPrefixFilter').value = ''; } }
function openCartModal() { refreshCartPrefixDropdown(); document.getElementById('cartSearchKw').value = ''; const bsCollapse = bootstrap.Collapse.getInstance(document.getElementById('cartBatchEditArea')); if(bsCollapse) bsCollapse.hide(); filterCartList(); bootstrap.Modal.getOrCreateInstance(document.getElementById('cartModal')).show(); }

function filterCartList() { 
    const kwStr = document.getElementById('cartSearchKw').value.toLowerCase().trim();
    const keywords = kwStr ? kwStr.split(/\s+/) : [];
    const prefixFilter = document.getElementById('cartPrefixFilter').value; 
    let html = '', count = 0; 
    
    newMvCart.forEach((val, id) => { 
        let isMisc = val.isMisc, tc = val.tempCode || '', itemPrefix = getPrefix(tc); 
        if (prefixFilter && itemPrefix !== prefixFilter) return; 
        
        if (keywords.length > 0) {
            let safeId = String(id || '').replace(/\n/g, ' ');
            let safeName = String(val.name || '');
            let safeTc = String(tc);
            let targetStr = `${safeId} ${safeName} ${safeTc}`.toLowerCase();
            if (!keywords.every(k => targetStr.includes(k))) return;
        }
        
        let displayId = String(id).replace(/\n/g, ' '); 
        html += `<div class="d-flex align-items-center p-2 border-bottom"><div class="me-2"><input class="form-check-input cart-item-cb" type="checkbox" value="${escapeHTML(id)}"></div><div style="width: 45%;"><div class="fw-bold ${isMisc ? 'text-danger' : 'text-dark'}">${isMisc ? '📦 '+escapeHTML(displayId) : escapeHTML(displayId)}</div><div class="small text-muted text-truncate" style="max-width: 150px;">${escapeHTML(val.name)} <span class="badge bg-secondary">x${escapeHTML(val.qty||'1')}</span></div></div><div style="width: 30%;" class="px-1"><input type="text" class="form-control form-control-sm border-info" placeholder="臨時編碼" value="${escapeHTML(tc)}" onchange="updateCartItemTc('${escapeHTML(id)}', this.value)"></div><div style="width: 15%; text-align: right;"><button class="btn btn-sm btn-outline-danger" onclick="removeCartItem('${escapeHTML(id)}')">❌</button></div></div>`; count++; 
    }); 
    
    if (count === 0) { html = '<div class="text-center text-muted p-4">查無符合條件的項目</div>'; } 
    document.getElementById('cartItemList').innerHTML = html; 
    document.getElementById('cartCountText').innerText = count + ' / ' + newMvCart.size; 
}
function toggleCartAll(state) { document.querySelectorAll('.cart-item-cb').forEach(cb => cb.checked = state); }
function batchRemoveCartItems() { const cbs = document.querySelectorAll('.cart-item-cb:checked'); if(cbs.length === 0) return alert('請先勾選要移除的項目！'); if(!confirm(`確定要移除這 ${cbs.length} 個項目嗎？`)) return; cbs.forEach(cb => newMvCart.delete(cb.value)); saveMvDraft(); filterNewMvList(); refreshCartPrefixDropdown(); filterCartList(); document.getElementById('newMvSelectedCount').innerText = newMvCart.size; }
function applyCartBatchEdit() { const cbs = document.querySelectorAll('.cart-item-cb:checked'); if(cbs.length === 0) return alert('請先勾選要修改編碼的項目！'); let prefix = document.getElementById('cartBatchPrefix').value.trim(), startNum = parseInt(document.getElementById('cartBatchStart').value.trim()); if(isNaN(startNum)) startNum = 1; let currentNum = startNum; cbs.forEach(cb => { let id = cb.value, item = newMvCart.get(id); if(item) { item.tempCode = prefix + currentNum; newMvCart.set(id, item); let inAllList = allMvItems.find(x => x.id === id); if(inAllList) inAllList.tempCode = item.tempCode; currentNum++; } }); saveMvDraft(); filterNewMvList(); let targetPrefix = getPrefix(prefix + "1"); refreshCartPrefixDropdown(targetPrefix); filterCartList(); showSyncToast("✅ 批次修改已套用", true); const bsCollapse = bootstrap.Collapse.getInstance(document.getElementById('cartBatchEditArea')); if(bsCollapse) bsCollapse.hide(); }
function updateCartItemTc(id, val) { let item = newMvCart.get(id); if(item) { item.tempCode = val; newMvCart.set(id, item); let inAllList = allMvItems.find(x => x.id === id); if(inAllList) inAllList.tempCode = val; saveMvDraft(); filterNewMvList(); refreshCartPrefixDropdown(); } }
function removeCartItem(id) { newMvCart.delete(id); saveMvDraft(); filterNewMvList(); refreshCartPrefixDropdown(); filterCartList(); document.getElementById('newMvSelectedCount').innerText = newMvCart.size; }

function openTempCodeModal() { if(newMvCart.size === 0) return alert("請先挑選文物加入清單！"); let html = '', idx = 0; newMvCart.forEach((val, id) => { let tcBadge = val.tempCode ? `<span class="badge bg-info text-dark ms-2"><i class="fas fa-tag"></i> ${escapeHTML(val.tempCode)}</span>` : ''; let displayId = String(id).replace(/\n/g, ' '); html += `<div class="form-check mb-2 pb-2 border-bottom"><input class="form-check-input tc-item-cb" type="checkbox" value="${escapeHTML(id)}" id="tc_${idx}" data-has-tc="${val.tempCode ? 'true' : 'false'}"><label class="form-check-label w-100 fs-6" for="tc_${idx}"><span class="fw-bold text-dark">${escapeHTML(displayId)}</span> ${tcBadge}<br><small class="text-muted">${escapeHTML(val.name)}</small></label></div>`; idx++; }); document.getElementById('tcItemList').innerHTML = html; document.getElementById('tcPrefix').value = ''; document.getElementById('tcStartNum').value = '1'; bootstrap.Modal.getOrCreateInstance(document.getElementById('tempCodeModal')).show(); }
function toggleTcAll(state) { document.querySelectorAll('.tc-item-cb').forEach(cb => cb.checked = state); }
function toggleTcUncoded() { document.querySelectorAll('.tc-item-cb').forEach(cb => { cb.checked = (cb.getAttribute('data-has-tc') === 'false'); }); }
function applyTempCodes() { let prefix = document.getElementById('tcPrefix').value.trim(), startNum = parseInt(document.getElementById('tcStartNum').value.trim()); if(isNaN(startNum)) startNum = 1; let cbs = document.querySelectorAll('.tc-item-cb:checked'); if(cbs.length === 0) return alert("請勾選要配發臨時編碼的項目！"); let currentNum = startNum; cbs.forEach(cb => { let id = cb.value, item = newMvCart.get(id); if(item) { item.tempCode = prefix + currentNum; newMvCart.set(id, item); let inAllList = allMvItems.find(x => x.id === id); if(inAllList) inAllList.tempCode = item.tempCode; currentNum++; } }); saveMvDraft(); bootstrap.Modal.getInstance(document.getElementById('tempCodeModal')).hide(); filterNewMvList(); showSyncToast("✅ 臨時編碼已成功套用", true); }

async function submitNewProject() { 
    const action = document.getElementById('newMvActionSelect').value, pName = document.getElementById('newMvName').value.trim(), pDesc = document.getElementById('newMvDesc').value.trim(); 
    if(!pName) return alert("請輸入專案名稱！"); if(newMvCart.size === 0) return alert("請至少挑選一件待搬運文物！"); showMiniLoading('正在儲存專案與清單資料...'); 
    let miscDetails = {}, tempCodes = {}, expectedLocs = {}, quantities = {}; 
    newMvCart.forEach((val, key) => { miscDetails[key] = val; if (val.tempCode) tempCodes[key] = val.tempCode; if (val.expectedLoc) expectedLocs[key] = val.expectedLoc; if (val.qty) quantities[key] = val.qty; }); 
    try { await callAPI('saveMovementProject', { eventId: action, name: pName, desc: pDesc, itemIds: Array.from(newMvCart.keys()), miscDetails: miscDetails, tempCodes: tempCodes, expectedLocs: expectedLocs, quantities: quantities, manager: currentManager }); clearMvDraft(); alert('✅ 專案資料儲存成功！'); refreshSystem('move'); } catch (e) { alert("專案儲存失敗：" + e.message); } finally { hideMiniLoading(); } 
}


// ================= 💡 執行搬運與送出 =================
async function loadWorkerLocations() {
    const eid = document.getElementById('mvEvent').value; currentMvEventId = eid; 
    let undoBtn = document.getElementById('floatingUndoBtn');
    
    if (!eid) { 
        if (undoBtn) undoBtn.style.display = 'none';
        document.getElementById('mvProgressBox').style.display = 'none'; 
        document.getElementById('mvPhase2').style.display = 'none'; 
        return; 
    }
    
    if (undoBtn) undoBtn.style.display = 'block';
    showMiniLoading('載入專案資料中...'); workerCart.clear(); updateFloatingCartUI(); 
    try {
        const res = await callAPI('getProjectPendingData', { eventId: eid }); currentProjectItems = res.items || []; 
        let flatOfficialLocs = new Set(); mgrLocTree.forEach(m => m.subs.forEach(s => s.details.forEach(d => flatOfficialLocs.add(d.val))));
        let invalidLocs = new Set(); currentProjectItems.forEach(item => { if(!flatOfficialLocs.has(item.loc)) invalidLocs.add(item.loc); });
        let customTree = res.locTree || []; if(invalidLocs.size > 0) { customTree.push({ main: "📁 未分類 / 舊有地點", subs: [{ sub: "(需注意)", details: Array.from(invalidLocs).sort().map(loc => ({ label: loc, val: loc })) }] }); }
        pendingLocTree = customTree; 
        document.getElementById('mvProgressBox').style.display = 'block';
        let total = res.total || 0, moved = res.moved || 0, pct = total > 0 ? Math.round((moved / total) * 100) : 0;
        document.getElementById('mvProgressText').innerText = `${moved} / ${total} 件 (${pct}%)`; document.getElementById('mvProgressBar').style.width = pct + '%'; 
        document.getElementById('mvPhase2').style.display = 'none';
        renderVkPrefixes(); 
        
        if(currentProjectItems.length > 0) {
            document.getElementById('mvLocSelector').style.display = 'block';
            document.getElementById('mvPhase2').style.display = 'block';
            document.getElementById('mvLoc').value = '';
            document.getElementById('mvLocDisplay').value = '';
            renderWorkerItems(currentProjectItems, false);
        } else {
            document.getElementById('mvLocSelector').style.display = 'none';
            document.getElementById('mvPhase2').style.display = 'none';
        }
    } catch (e) { alert("載入資料失敗：" + e.message); } finally { hideMiniLoading(); }
}

function loadWorkerItems() {
    const loc = document.getElementById('mvLoc').value;
    const kwStr = document.getElementById('mvSearchKw').value.toLowerCase().trim();
    const keywords = kwStr ? kwStr.split(/\s+/) : [];
    
    let filteredItems = currentProjectItems;
    if (loc) { filteredItems = filteredItems.filter(x => x.loc === loc); }
    
    if (keywords.length > 0) { 
        filteredItems = filteredItems.filter(x => {
            let safeId = String(x.qrCode || '').replace(/\n/g, ' ');
            let safeName = String(x.name || '');
            let safeTc = String(x.tempCode || '');
            let targetStr = `${safeId} ${safeName} ${safeTc}`.toLowerCase();
            return keywords.every(k => targetStr.includes(k));
        }); 
    }
    renderWorkerItems(filteredItems, keywords.length > 0);
}

function searchWorkerItems() { loadWorkerItems(); }

function renderWorkerItems(items, isSearchMode) {
    const listDiv = document.getElementById('mvItemList');
    if (items.length === 0) { listDiv.innerHTML = `<div class="text-muted text-center py-4">查無符合條件的待搬運項目！</div>`; document.getElementById('mvPhase2').style.display = 'block'; return; }
    listDiv.innerHTML = items.map((x, i) => { 
        let tcBadge = x.tempCode ? `<span class="badge bg-info text-dark me-2 shadow-sm"><i class="fas fa-tag"></i> ${escapeHTML(x.tempCode)}</span>` : ''; 
        let isMisc = String(x.qrCode).startsWith('MISC'); 
        let displayId = String(x.qrCode).replace(/\n/g, ' '); 
        let isChecked = workerCart.has(x.rowIndex) ? 'checked' : '';
        let locBadge = isSearchMode ? `<span class="badge bg-light text-dark border ms-1">📍 ${escapeHTML(x.loc)}</span>` : '';
        let qtyBadge = `<span class="badge bg-secondary rounded-pill ms-1">x${escapeHTML(x.qty || '1')}</span>`;
        
        let baseId = String(x.qrCode).split('\n')[0].trim();
        let catObj = globalCatalog ? globalCatalog[baseId] : null;
        let accBadge = '';
        if (catObj && catObj.accession && catObj.accession !== '未註明') {
            let accLevel = catObj.accession;
            let badgeClass = "bg-secondary"; 
            if (accLevel.includes('典藏')) badgeClass = "bg-danger";
            else if (accLevel.includes('館藏')) badgeClass = "bg-warning text-dark";
            else if (accLevel.includes('收藏')) badgeClass = "bg-success";
            accBadge = `<span class="badge ${badgeClass} ms-1 shadow-sm" style="font-size: 0.75rem;">🏷️ ${escapeHTML(accLevel)}</span>`;
        }

        return `<div class="form-check mb-2 pb-2 border-bottom"><input class="form-check-input mv-item-cb" type="checkbox" value="${x.rowIndex}" id="mvItem_${i}" ${isChecked} onchange="toggleWorkerCart(this, ${x.rowIndex})"><label class="form-check-label w-100" for="mvItem_${i}"><div class="d-flex align-items-center mb-1">${tcBadge}<span class="${isMisc ? 'text-danger' : 'text-primary'} fw-bold" style="font-size:0.9rem;">[${escapeHTML(displayId)}]</span>${accBadge}</div><div class="fs-6 text-dark">${escapeHTML(x.name)}${qtyBadge}${locBadge}</div></label></div>`; 
    }).join(''); 
    document.getElementById('mvPhase2').style.display = 'block';
}

function toggleWorkerCart(cb, rIdx) { if (cb.checked) workerCart.add(rIdx); else workerCart.delete(rIdx); updateFloatingCartUI(); }

function updateFloatingCartUI() { 
    const btn = document.getElementById('floatingCartBtn'), count = document.getElementById('floatingCartCount'); 
    
    if (workerCart.size > 0) { 
        btn.style.display = 'block'; 
        count.innerText = workerCart.size; 
    } else { 
        btn.style.display = 'none'; 
    } 
}

function togglePrevSelectAll(checked) { document.querySelectorAll('.prev-item-cb').forEach(cb => { if (cb.closest('.card').style.display !== 'none') { cb.checked = checked; } }); }

function openSubmitPreviewModal() {
    if(workerCart.size === 0) return alert('請先勾選要搬運的文物！');
    const staffSelect = document.getElementById('mvStaffInternal');
    if(staffSelect && !staffSelect.value) { alert('請先在上方「2. 本處人員 (操作者)」選擇您的名字！'); staffSelect.focus(); return; }

    closeVK(); 
    let html = `<div class="d-flex justify-content-between align-items-center mb-2 pb-2 border-bottom"><div><input type="checkbox" id="prevSelectAll" class="form-check-input me-1 border-primary" onchange="togglePrevSelectAll(this.checked)"><label for="prevSelectAll" class="fw-bold small text-dark">全選</label></div><button class="btn btn-sm btn-outline-primary fw-bold shadow-sm" onclick="openBatchBottomSheet()">📍 批次設定地點</button></div>`;
    
    workerCart.forEach(rIdx => {
        let item = currentProjectItems.find(x => x.rowIndex === rIdx); if(!item) return;
        let displayId = String(item.qrCode).replace(/\n/g, ' '); let prefillLoc = item.expectedLoc && item.expectedLoc !== '待定' ? item.expectedLoc : '';
        html += `<div class="card border-0 shadow-sm mb-2 preview-card" id="prevCard_${rIdx}"><div class="card-header bg-light p-2 d-flex justify-content-between align-items-center"><div class="d-flex align-items-center"><input type="checkbox" class="form-check-input prev-item-cb me-2 border-secondary" value="${rIdx}"><span class="fw-bold text-dark" style="font-size:0.9rem;">${escapeHTML(displayId)}</span></div><span class="badge bg-info text-dark">${escapeHTML(item.tempCode||'無碼')}</span></div><div class="card-body p-2"><div class="small text-muted mb-2 text-truncate fw-bold">${escapeHTML(item.name)} <span class="badge bg-secondary rounded-pill">x${escapeHTML(item.qty || '1')}</span></div><div class="input-group input-group-sm"><span class="input-group-text bg-white fw-bold text-success border-success">實際放置</span><input type="text" class="form-control border-success fw-bold prev-loc-input text-primary" id="prevLoc_${rIdx}" value="${escapeHTML(prefillLoc)}" placeholder="點擊選擇地點" readonly onclick="openBottomSheet(${rIdx})" onchange="checkLocModification(${rIdx})"><button class="btn btn-success fw-bold" onclick="submitSingleMovement(${rIdx})">單件寫入</button></div></div></div>`;
    });
    document.getElementById('mvPreviewList').innerHTML = html;
    bootstrap.Modal.getOrCreateInstance(document.getElementById('mvPreviewModal')).show();
}

async function submitSingleMovement(rIdx) {
    let locInput = document.getElementById(`prevLoc_${rIdx}`).value.trim(); if(!locInput) return alert("請選擇實際放置地點！");
    let btn = document.querySelector(`#prevCard_${rIdx} button`); btn.disabled = true; btn.innerText = "寫入中...";
    let staff = document.getElementById('mvStaffInternal').value; 
    try {
        await callAPI('submitMovement', { rowIndices: [rIdx], expectedLocs: { [rIdx]: locInput }, manager: currentManager, staffInternal: staff });
        document.getElementById(`prevCard_${rIdx}`).style.display = 'none'; currentProjectItems = currentProjectItems.filter(x => x.rowIndex !== rIdx);
        workerCart.delete(rIdx); updateFloatingCartUI(); showSyncToast(`✅ 單件送出成功`, true);
        if(Array.from(document.querySelectorAll('.prev-loc-input')).every(i => i.closest('.card').style.display === 'none')) { bootstrap.Modal.getInstance(document.getElementById('mvPreviewModal')).hide(); loadWorkerLocations(); }
    } catch(e) { alert(e.message); btn.disabled = false; btn.innerText = "單件寫入"; }
}

async function confirmBulkMovement() {
    let inputs = Array.from(document.querySelectorAll('.prev-loc-input')).filter(i => i.closest('.card').style.display !== 'none');
    let emptyCount = inputs.filter(i => !i.value.trim()).length; if(emptyCount > 0) return alert(`還有 ${emptyCount} 件未指定實際地點！`);
    let btn = document.getElementById('btnConfirmBulkMove'); btn.disabled = true; btn.innerText = "全數寫入中...";
    let payloadDict = {}, rowIndices = []; inputs.forEach(i => { let rIdx = parseInt(i.id.split('_')[1]); payloadDict[rIdx] = i.value.trim(); rowIndices.push(rIdx); });
    let staff = document.getElementById('mvStaffInternal').value; 
    try {
        await callAPI('submitMovement', { rowIndices: rowIndices, expectedLocs: payloadDict, manager: currentManager, staffInternal: staff }); alert(`✅ 成功送出 ${rowIndices.length} 件搬運紀錄！`);
        rowIndices.forEach(r => workerCart.delete(r)); updateFloatingCartUI(); bootstrap.Modal.getInstance(document.getElementById('mvPreviewModal')).hide(); loadWorkerLocations();
    } catch(e) { alert(e.message); } finally { btn.disabled = false; btn.innerText = "📤 全數確認送出"; }
}

async function openUndoMoveModal() {
    if(!currentMvEventId) return alert("請先在上方選擇 1.異動專案事件！");
    showMiniLoading('讀取可撤銷清單...');
    try {
        const res = await callAPI('getProjectDetails', { eventId: currentMvEventId });
        let undoItems = res.filter(x => x.newLoc && x.status !== '已核對'); 
        
        let html = '';
        if (undoItems.length === 0) {
            html = '<div class="text-center text-muted p-4">目前沒有可撤銷的文物。</div>';
        } else {
            undoItems.forEach(item => {
                let displayId = String(item.id).replace(/\n/g, ' ');
                html += `
                <div class="card border-0 shadow-sm mb-2" id="undoCard_${item.rowIndex}">
                    <div class="card-body p-2 d-flex justify-content-between align-items-center">
                        <div>
                            <div class="fw-bold text-dark small">${escapeHTML(displayId)} <span class="badge bg-info text-dark">${escapeHTML(item.tempCode||'無碼')}</span></div>
                            <div class="text-primary small mt-1">${escapeHTML(item.name)}</div>
                            <div class="text-success fw-bold small mt-1">📍 已移往: ${escapeHTML(item.newLoc)}</div>
                        </div>
                        <button class="btn btn-warning btn-sm text-dark fw-bold px-3 ms-2" onclick="submitUndoMovement(${item.rowIndex})">↩️ 撤銷</button>
                    </div>
                </div>`;
            });
        }
        document.getElementById('undoMoveList').innerHTML = html;
        bootstrap.Modal.getOrCreateInstance(document.getElementById('undoMoveModal')).show();
    } catch(e) { alert("讀取失敗：" + e.message); } finally { hideMiniLoading(); }
}

async function submitUndoMovement(rIdx) {
    if(!confirm("確定要撤銷這筆搬運嗎？文物將恢復為未搬運狀態。")) return;
    let btn = document.querySelector(`#undoCard_${rIdx} button`); btn.disabled = true; btn.innerText = "撤銷中...";
    try {
        await callAPI('undoMovement', { rowIndices: [rIdx], managerName: currentManager });
        document.getElementById(`undoCard_${rIdx}`).style.display = 'none';
        showSyncToast(`✅ 成功撤銷一筆搬運`, true);
        
        let remaining = Array.from(document.querySelectorAll('#undoMoveList .card')).filter(c => c.style.display !== 'none');
        if(remaining.length === 0) { bootstrap.Modal.getInstance(document.getElementById('undoMoveModal')).hide(); }
        
        loadWorkerLocations(); 
    } catch(e) { alert(e.message); btn.disabled = false; btn.innerText = "↩️ 撤銷"; }
}

// ================= 💡 交接與掃描邏輯 =================
async function generateHandoff() {
    if (workerCart.size === 0) return alert("請先勾選要交接的文物！");
    let handoffData = { eventId: document.getElementById('mvEvent').value, selectedRows: Array.from(workerCart) }; showMiniLoading('產生交接碼中...');
    try { let res = await callAPI('generateHandoff', { data: handoffData }); document.getElementById('handoffPinDisplay').innerText = res.pin; const qr = new QRious({ value: "HANDOFF:" + res.pin, size: 200, level: 'M' }); document.getElementById('handoffQrImage').src = qr.toDataURL('image/png'); bootstrap.Modal.getOrCreateInstance(document.getElementById('handoffModal')).show(); } catch(e) { alert(e.message); } finally { hideMiniLoading(); }
}

function resumeHandoffPrompt() { 
    startLocScanner('handoff'); 
    setTimeout(() => { 
        document.getElementById('locScannerTitle').innerText = "掃描交接 QR Code"; 
        if(!document.getElementById('manualHandoffBtn')) {
            let manualBtn = document.createElement('button'); 
            manualBtn.id = 'manualHandoffBtn';
            manualBtn.className = "btn btn-info w-100 mt-3 fw-bold py-3 fs-5 text-white shadow-sm"; 
            manualBtn.innerText = "改用 4 位數代碼手動輸入"; 
            manualBtn.onclick = () => { 
                cancelLocScanner(); 
                setTimeout(() => {
                    let pin = prompt("請輸入 4 位數交接碼："); 
                    if(pin && pin.trim().length === 4) processHandoff(pin.trim()); 
                }, 300); 
            }; 
            document.getElementById('loc-reader-container').querySelector('.btn-danger').before(manualBtn); 
        }
    }, 500); 
}

async function processHandoff(pin) { 
    showMiniLoading('讀取交接資料中...'); 
    try { 
        let res = await callAPI('consumeHandoff', { pin: pin }); 
        document.getElementById('mvEvent').value = res.data.eventId; 
        await loadWorkerLocations(); 
        res.data.selectedRows.forEach(r => workerCart.add(r)); 
        updateFloatingCartUI(); 
        let itemsToRender = currentProjectItems.filter(x => workerCart.has(x.rowIndex)); 
        renderWorkerItems(itemsToRender, true); 
        showSyncToast('✅ 交接進度已無縫還原', true); 
    } catch(e) { alert(e.message); } finally { hideMiniLoading(); } 
}

function startLocScanner(targetId) { 
    locScanTarget = targetId; 
    document.getElementById('locScannerTitle').innerText = "掃描條碼"; 
    document.getElementById('loc-reader-container').style.display = 'flex'; 
    if (!locScanner) locScanner = new Html5Qrcode("loc-reader"); 
    if (locScanner.getState() !== 2) { 
        locScanner.start({ facingMode: "environment" }, { fps: 10, qrbox: { width: 250, height: 250 } }, msg => handleLocScan(msg)); 
    } 
}

function stopLocScanner() { 
    document.getElementById('loc-reader-container').style.display = 'none'; 
    let hBtn = document.getElementById('manualHandoffBtn'); 
    if(hBtn) hBtn.remove();
    if(locScanner) { try { locScanner.stop().then(() => { locScanner.clear(); locScanner = null; }).catch(() => { locScanner = null; }); } catch(e) { locScanner = null; } } 
}

function cancelLocScanner() { stopLocScanner(); }

function handleLocScan(msg) { 
    let target = locScanTarget; locScanTarget = ''; 
    stopLocScanner();
    let cleanMsg = msg.trim(); 
    if (cleanMsg.startsWith("LOC:")) cleanMsg = cleanMsg.substring(4);
    if (cleanMsg.startsWith("HANDOFF:")) { 
        processHandoff(cleanMsg.substring(8)); 
    } else if (target === 'mvLoc' || target === 'regLoc' || target === 'miscLoc' || target.startsWith('importMiscLoc_')) {
        currentModalTarget = target;
        selectModalLoc(cleanMsg);
    } else if (target === 'handoff') {
        alert("無效的交接條碼：" + cleanMsg); playSound('error'); 
    } else { alert("掃描結果：" + cleanMsg); }
}

function toggleAllItems(state) { document.querySelectorAll('.mv-item-cb').forEach(cb => cb.checked = state); document.querySelectorAll('.mv-item-cb').forEach(cb => toggleWorkerCart(cb, parseInt(cb.value))); }
async function silentMvSync() { if(!currentMvEventId) return; try { const res = await callAPI('getProjectPendingData', { eventId: currentMvEventId }); currentProjectItems = res.items || []; pendingLocTree = res.locTree || []; } catch(e) {} }


// ================= 💡 管理員後台 (加入購物車與樂觀更新) =================
function parseOverrideData() { const raw = document.getElementById('importOverrideTextarea').value.trim(); if(!raw) return alert("請先貼上資料！"); const lines = raw.split('\n'); let payload = []; lines.forEach(line => { if(!line.trim()) return; let cols = line.includes('\t') ? line.split('\t') : line.split(','); cols = cols.map(c => c.trim()); if (cols.length >= 2 && cols[0]) { payload.push({ id: cols[0], newLoc: cols[1] }); } }); if(payload.length === 0) return alert("解析失敗！請確保貼上格式為「編號 + 地點」。"); showMiniLoading("正在比對雲端總表..."); callAPI('previewLocationOverride', { items: payload }).then(res => { parsedOverrideItems = res.results; renderOverridePreview(); document.getElementById('overridePreviewSection').style.display = 'block'; hideMiniLoading(); }).catch(e => { alert("預覽失敗：" + e.message); hideMiniLoading(); }); }
function renderOverridePreview() { let html = '', validCount = 0; parsedOverrideItems.forEach(item => { let statusBadge = '', trClass = ''; if (item.status === 'ok') { statusBadge = '<span class="badge bg-success">✅ 準備覆寫</span>'; validCount++; } else if (item.status === 'no_change') { statusBadge = '<span class="badge bg-secondary">⏸️ 地點相同</span>'; trClass = 'table-secondary text-muted'; } else { statusBadge = '<span class="badge bg-danger">❌ 查無此物</span>'; trClass = 'table-danger text-muted'; } html += `<tr class="${trClass}"><td>${statusBadge}</td><td class="fw-bold text-dark">${escapeHTML(item.id)}</td><td class="small">${escapeHTML(item.oldLoc || '無')}</td><td class="text-danger fw-bold small">${item.status === 'not_found' ? '--' : escapeHTML(item.newLoc)}</td></tr>`; }); document.getElementById('overridePreviewTableBody').innerHTML = html; document.getElementById('overrideStats').innerText = `✅ 可強制校正：${validCount} 筆`; document.getElementById('btnConfirmOverride').disabled = (validCount === 0); }
function confirmOverride() { let validItems = parsedOverrideItems.filter(x => x.status === 'ok'); if(validItems.length === 0) return; if (!confirm(`⚠️ 危險操作確認！\n\n系統將直接覆寫總表中這 ${validItems.length} 件文物的地點，此操作無法復原。\n\n確定要強制執行覆寫嗎？`)) { return; } showMiniLoading(`正在強制寫入 ${validItems.length} 筆地點資料...`); callAPI('executeLocationOverride', { items: validItems }).then(res => { alert(`✅ 成功強制校正了 ${res.count} 筆文物地點！`); document.getElementById('importOverrideTextarea').value = ''; document.getElementById('overridePreviewSection').style.display = 'none'; parsedOverrideItems = []; callAPI('getInventoryInitData').then(invData => { globalCatalog = invData.catalog || {}; }); hideMiniLoading(); }).catch(e => { alert("寫入失敗：" + e.message); hideMiniLoading(); }); }

async function updateBaseline() { const timeVal = document.getElementById('newBaseline').value; if(!timeVal) return alert('請選擇日期時間'); if(!confirm("確定要更新基準日嗎？")) return; showMiniLoading('更新中...'); try { await callAPI('updateBaseline', { timeString: timeVal }); alert('✅ 更新成功！'); location.reload(); } catch (e) { alert("更新失敗：" + e.message); hideMiniLoading(); } }

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

function printLocationLabels() { let activeLocs = []; mgrLocTree.forEach(m => { m.subs.forEach(s => { s.details.forEach(d => { if (!d.isHidden) activeLocs.push(d.val); }); }); }); if (activeLocs.length === 0) return alert("目前沒有啟用的地點可供列印！"); showMiniLoading("生成地點標籤中..."); setTimeout(() => { try { let printHtml = `<div class="preview-paper"><div class="grid-container" style="gap:2px; justify-content:flex-start;">`; activeLocs.sort().forEach(loc => { let qrData = "LOC:" + loc; const qr = new QRious({ value: qrData, size: 150, level: 'M' }); const base64Img = qr.toDataURL('image/png'); printHtml += `<div class="label-box" style="border: 2px solid #0d6efd; background: white;"><div style="font-size:7pt; font-weight:bold; color:#0d6efd; margin-bottom:2px;">📍 典藏地點</div><img src="${base64Img}" class="qr-img" alt="QR" style="width: 2.5cm; height: 2.5cm;"><div class="id-text" style="font-size:9pt; margin-top:5px; white-space:normal; line-height:1.2;">${escapeHTML(loc)}</div></div>`; }); printHtml += `</div></div>`; document.getElementById('printOverlayContent').innerHTML = printHtml; document.getElementById('printOverlayTitle').innerText = "地點 QR 標籤預覽"; document.getElementById('printOverlay').style.display = 'flex'; hideMiniLoading(); } catch (e) { hideMiniLoading(); alert("產生列印畫面時發生錯誤：" + e.message); } }, 50); }
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

// 控制「其他：」文字輸入框的顯示隱藏
function toggleOtherInput(chkId, txtId) {
    const chk = document.getElementById(chkId);
    const txt = document.getElementById(txtId);
    if (chk && txt) {
        txt.style.display = chk.checked ? 'inline-block' : 'none';
        if (!chk.checked) txt.value = '';
    }
}

// 控制「維護(前/後)」選項的顯示隱藏
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

// 取得多選框的文字陣列
function getCheckedValues(selector) {
    return Array.from(document.querySelectorAll(selector + ':checked')).map(cb => cb.value);
}

// 從查詢畫面直接跳轉至填寫狀況報告
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
        condReportsCache = reports; // 存入全域變數供後續編輯使用
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

            // 🔥 新增：依據報告類型顯示不同的操作按鈕 (編輯 / 列印 / 預覽連結)
            let actionBtns = '';
            if (r.reportType === '3') {
                actionBtns = `<button class="btn btn-sm btn-outline-danger fw-bold w-100 mt-2" onclick="window.open('${escapeHTML(r.formData.fileUrl)}', '_blank')">🔗 檢視外部檔案</button>`;
            } else {
                actionBtns = `
                <div class="d-flex gap-2 mt-2">
                    <button class="btn btn-sm btn-outline-primary fw-bold flex-grow-1" onclick="editCondReport('${escapeHTML(r.reportId)}')">✏️ 編輯</button>
                    <button class="btn btn-sm btn-dark fw-bold flex-grow-1" onclick="printHistoricalCondReport('${escapeHTML(r.reportId)}')">🖨️ 列印</button>
                </div>`;
            }

            return `
            <div class="card border-0 shadow-sm mb-2">
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

function backToCondDashboard() {
    document.getElementById('condScenarioSelect').style.display = 'none';
    document.getElementById('condFormArea').style.display = 'none';
    document.getElementById('condVendorUploadArea').style.display = 'none';
    document.getElementById('condDashboard').style.display = 'block';
    loadConditionReports();
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
        removeMainPhoto();
        renderCondPhotos();
        document.getElementById('btnCondPrint').style.display = 'none';
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

// 🔥 新增：重新載入與編輯歷史報告
function editCondReport(reportId) {
    const report = condReportsCache.find(r => r.reportId === reportId);
    if (!report) return alert("找不到該筆報告資料！");
    
    // 設定全域狀態
    condCurrentItem = { id: report.itemId, name: report.itemName }; // 簡單回補
    condMode = parseInt(report.reportType);
    
    document.getElementById('condDashboard').style.display = 'none';
    document.getElementById('condFormTitle').innerText = '✏️ 編輯歷史報告';
    document.getElementById('cf_reportId').value = report.reportId;
    document.getElementById('btnCondPrint').style.display = 'block'; // 編輯模式可直接預覽列印
    
    const d = report.formData;
    if(!d) return alert("報告資料遺失");

    // 還原文字欄位
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

    // 還原 Checkboxes 的 helper 函數
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

    // 檢視目的與維護前/後特殊邏輯
    restoreCheckboxes('.chk-purp', d.purpVals, 'c_purp_other_txt', d.purpOther);
    toggleMaintOpt();
    if (d.purpVals && d.purpVals.includes('維護')) {
        if (d.maintState === '修護前') document.getElementById('c_purp_maint_bf').checked = true;
        if (d.maintState === '修護後') document.getElementById('c_purp_maint_af').checked = true;
    }

    // 還原分級 Radio
    document.querySelectorAll('input[name="c_rating"]').forEach(rb => {
        rb.checked = (rb.value === d.rating);
    });

    // 還原照片 (分類 Main Photo 與 Detail Photos)
    removeMainPhoto();
    condPhotos = [];
    if (report.photos && report.photos.length > 0) {
        let pIndex = 0;
        // 第一張可能是 Main Photo
        if (report.photos[0] && report.photos[0].includes('photo')) { // 簡單判定
            // 由於 Drive URL 無法直接用 img src (需公開權限或 proxy)，這裡暫時僅保存 url 以供列印使用
            // 若為 Base64 (剛存檔)，則可直接顯示。為求穩定，我們以 URL 呈現
            // 實作上，如果需要預覽舊照片，通常依賴 Google Drive 共用連結
            // 這裡將歷史照片塞入陣列
            report.photos.forEach(url => {
                if (url) condPhotos.push({ base64: '', mimeType: '', url: url, note: '歷史照片 (列印時可見)' });
            });
            // (註：因跨域限制，Drive 圖片難以直接轉回 Canvas 預覽，故以提示文字代替，但在列印時會作為 img src 印出)
        }
    }
    renderCondPhotos();

    document.getElementById('condTransferSection').style.display = (condMode === 2) ? 'block' : 'none';
    document.getElementById('condFormArea').style.display = 'block';
}

// ================= 照片雙軌上傳壓縮邏輯 =================
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

function removeCondPhoto(idx) {
    if(confirm('確定要移除這張圖示嗎？')) { condPhotos.splice(idx, 1); renderCondPhotos(); }
}

// ================= 收集表單資料與生成完美 A4 列印排版 =================
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

async function submitConditionReport() {
    const d = getFormData();
    if(!d.date || !d.viewer) return alert("請填寫檢視紀錄的「日期」與「人員」！");
    
    let allPhotos = [...condPhotos];
    if (mainPhotoBase64) {
        allPhotos.unshift({ base64: mainPhotoBase64.split(',')[1], mimeType: mainPhotoMime, note: 'MAIN_PHOTO', url: '' });
    }
    
    // 檢查是否有歷史 reportId
    let rId = document.getElementById('cf_reportId').value;

    const payload = {
        reportId: rId || null,
        managerName: currentManager,
        itemId: condCurrentItem.id,
        itemName: condCurrentItem.name,
        reportType: condMode.toString(),
        formData: d,
        photos: allPhotos
    };

    showMiniLoading('正在儲存報告與上傳照片...');
    try {
        const res = await callAPI('saveConditionReport', payload);
        alert(`✅ 報告已安全儲存！\n系統編號：${res.reportId}\n您可以點擊下方按鈕預覽並列印 PDF 格式。`);
        document.getElementById('cf_reportId').value = res.reportId;
        document.getElementById('btnCondPrint').style.display = 'block';
    } catch(e) { alert("儲存失敗：" + e.message); } finally { hideMiniLoading(); }
}

// 產生列印用 Checkbox 字串
function buildCheckStr(options, selectedVals, otherTxt) {
    if(!selectedVals) selectedVals = [];
    return options.map(opt => {
        let isChecked = selectedVals.includes(opt) ? '☑' : '☐';
        if(opt === '其他') { return `${isChecked} 其他：<u>&nbsp;${escapeHTML(selectedVals.includes('其他') ? (otherTxt||'') : '')}&nbsp;</u>`; }
        return `${isChecked} ${escapeHTML(opt)}`;
    }).join('&nbsp;&nbsp;');
}

// 🔥 新增：從總覽直接列印歷史報告
function printHistoricalCondReport(reportId) {
    const report = condReportsCache.find(r => r.reportId === reportId);
    if (!report) return alert("找不到報告資料");
    
    let photosForPrint = [];
    if(report.photos) {
        report.photos.forEach(url => {
            if(url) photosForPrint.push({ url: url, note: '歷史照片' });
        });
    }
    
    executePrintLayout(report.formData, photosForPrint, parseInt(report.reportType));
}

// 印正在填寫的表單
function printConditionReport() {
    executePrintLayout(getFormData(), condPhotos, condMode, mainPhotoBase64);
}

function executePrintLayout(d, photosArray, mode, currentMainBase64 = null) {
    let mainPhotoImgTag = '<span class="text-muted small">無圖片</span>';
    let detailPhotos = [...photosArray];
    
    // 如果有當前上傳的 mainBase64 (代表剛填寫完還沒存入歷史)
    if (currentMainBase64) {
        mainPhotoImgTag = `<img src="${currentMainBase64}" style="max-width:100%; max-height:100%; object-fit:contain;">`;
    } 
    // 或者歷史陣列中的第一張是主圖 (假設有URL)
    else if (detailPhotos.length > 0 && detailPhotos[0].note === 'MAIN_PHOTO') {
        let mainP = detailPhotos.shift(); // 抽出來
        mainPhotoImgTag = `<img src="${mainP.url}" style="max-width:100%; max-height:100%; object-fit:contain;">`;
    }

    // 狀況描述 Checkboxes
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
    let maintOptHtml = `${isMaint?'☑':'☐'} 維護(${bfMark}/${afMark})`;
    let purpOptHtml = ['提借','返還'].map(o => `${purpVals.includes(o)?'☑':'☐'} ${o}`).join('&nbsp;&nbsp;');
    let purpOtherHtml = `${purpVals.includes('其他')?'☑':'☐'} 其他：<u>&nbsp;${escapeHTML(purpVals.includes('其他')?d.purpOther:'')}&nbsp;</u>`;
    let finalPurpStr = `${maintOptHtml}&nbsp;&nbsp;${purpOptHtml}&nbsp;&nbsp;${purpOtherHtml}`;

    let rateOpts = ['1良好(無修護需求)','2尚可(需維護處理)','3不佳(需修護處理)','4緊急(需優先處理)'];
    let rateStr = rateOpts.map(o => `${d.rating === o ? '☑' : '☐'} ${escapeHTML(o)}`).join('&nbsp;&nbsp;');

    let condPhotosHtml = detailPhotos.length === 0 ? '<div style="height:30px;"></div>' : detailPhotos.map(p => {
        let imgSrc = p.base64 ? `data:${p.mimeType};base64,${p.base64}` : p.url;
        return `
        <div style="display: flex; border: 1px solid #999; margin-bottom: 5px; page-break-inside: avoid; border-radius:4px; overflow:hidden;">
            <div style="width: 50%; border-right: 1px solid #999; padding: 5px; background:#fefefe; text-align: center;">
                <img src="${imgSrc}" style="max-width: 100%; max-height: 200px; object-fit: contain;">
            </div>
            <div style="width: 50%; padding: 8px; vertical-align: top; font-size: 10pt; white-space: pre-wrap;">
                ${escapeHTML(p.note || '')}
            </div>
        </div>`;
    }).join('');

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
                    ${tfPurpVals.includes('提借')?'☑':'☐'} 提借 &nbsp; 
                    ${tfPurpVals.includes('返還')?'☑':'☐'} 返還
                </td>
                <th width="15%">日期:</th>
                <td width="35%">${escapeHTML(tfDateSafe)}</td>
            </tr>
            <tr>
                <th>附件</th>
                <td colspan="3">${tfAttach.includes('提借清單或相關公文')?'☑':'☐'} 提借清單或相關公文</td>
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
    document.getElementById('printCondContent').innerHTML = html;
    document.getElementById('printCondOverlay').style.display = 'flex';
}

function closePrintCondOverlay() { document.getElementById('printCondOverlay').style.display = 'none'; }

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
        backToCondDashboard();
    } catch(e) {
        alert("上傳失敗：" + e.message);
    } finally {
        hideMiniLoading();
    }
}
