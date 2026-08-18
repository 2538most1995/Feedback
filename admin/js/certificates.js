// /Applications/MAMP/htdocs/Feedback/admin/js/certificates.js
// Certificate Designer Controller - Robust Double-Click Editing, Floating Toolbar & Live Multi-Way Resizing

let currentSurveyId = null;
let allSurveys = [];
let currentSelectedKey = null;

let certConfig = {
    is_enabled: 0,
    bg_preset: 'gold-luxury',
    bg_image_url: '',
    logo_url: '',
    signature_url: '',
    title: 'เกียรติบัตร',
    subtitle: 'มอบให้ไว้เพื่อแสดงว่า',
    recipient_name: '{name}',
    body_text: 'ได้ผ่านการตอบแบบประเมินความพึงพอใจและมีส่วนร่วมในการพัฒนาการให้บริการ ให้ไว้ ณ วันที่ {date} ขอให้มีความสุขความเจริญก้าวหน้ายิ่งขึ้นไป',
    issued_date: '{date}',
    issuer_name: 'ผู้ช่วยศาสตราจารย์ ดร.สมชาย ใจดี',
    issuer_title: 'ผู้อำนวยการศูนย์บริการและพัฒนา',
    elements_config: {
        logo: { x: 50, y: 14, size: 70 },
        title: { x: 50, y: 26, size: 34 },
        subtitle: { x: 50, y: 35, size: 17 },
        recipient: { x: 50, y: 45, size: 28 },
        body: { x: 50, y: 58, size: 15 },
        date: { x: 50, y: 70, size: 14 },
        signature: { x: 50, y: 79, size: 50 },
        issuer: { x: 50, y: 89, size: 15 }
    }
};

const defaultPositions = {
    logo: { x: 50, y: 14, size: 70 },
    title: { x: 50, y: 26, size: 34 },
    subtitle: { x: 50, y: 35, size: 17 },
    recipient: { x: 50, y: 45, size: 28 },
    body: { x: 50, y: 58, size: 15 },
    date: { x: 50, y: 70, size: 14 },
    signature: { x: 50, y: 79, size: 50 },
    issuer: { x: 50, y: 89, size: 15 }
};

let currentScale = 1.0;

document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    loadSurveysList();
    initDragAndDrop();
    initMouseResize();
    initInlineEditing();
});

let certSurveyCombobox = null;

// Load all surveys for selector
async function loadSurveysList() {
    const container = document.getElementById('certSurveyComboboxContainer');
    if (!container) return;

    try {
        const res = await api('../api/surveys.php');
        if (res && res.success) {
            allSurveys = res.data || [];
            if (allSurveys.length === 0) {
                container.innerHTML = `<label style="font-size: 0.8rem; font-weight: 600; color: var(--text-light); display: block; margin-bottom: 4px;">เลือกแบบประเมินที่ต้องการเปิดออกเกียรติบัตร</label><div class="form-control" style="color:var(--text-light);">-- ยังไม่มีแบบประเมินในระบบ --</div>`;
                return;
            }

            const urlParams = new URLSearchParams(window.location.search);
            const paramSurveyId = urlParams.get('survey_id');
            const initialId = paramSurveyId && allSurveys.some(s => s.id == paramSurveyId) ? paramSurveyId : allSurveys[0].id;

            const options = allSurveys.map(s => {
                const statusText = s.status === 'published' ? 'เผยแพร่' : (s.status === 'closed' ? 'ปิดรับ' : 'ร่าง');
                return {
                    id: s.id,
                    title: s.title,
                    badge: statusText
                };
            });

            container.innerHTML = `<label style="font-size: 0.8rem; font-weight: 600; color: var(--text-light); display: block; margin-bottom: 4px;">เลือกแบบประเมินที่ต้องการเปิดออกเกียรติบัตร</label><div id="certComboboxInner"></div>`;

            certSurveyCombobox = createCombobox({
                container: '#certComboboxInner',
                options: options,
                value: String(initialId),
                placeholder: '-- เลือกแบบประเมิน --',
                searchPlaceholder: '🔍 ค้นหาแบบประเมิน...',
                onChange: (selectedId) => {
                    if (selectedId) {
                        currentSurveyId = parseInt(selectedId);
                        loadCertConfigForSurvey(currentSurveyId);
                    }
                }
            });

            currentSurveyId = parseInt(initialId);
            loadCertConfigForSurvey(currentSurveyId);
        }
    } catch (err) {
        console.error('Error loading surveys:', err);
    }
}

async function loadCertConfigForSurvey(surveyId) {
    if (!surveyId) return;
    try {
        const res = await api(`../api/certificates.php?survey_id=${surveyId}`);
        if (res && res.success && res.data) {
            const data = res.data;
            const mergedElements = {
                ...defaultPositions,
                ...(data.elements_config || {})
            };
            
            // If legacy data has issuer but no signature position
            if (!data.elements_config || !data.elements_config.signature) {
                if (data.elements_config && data.elements_config.issuer) {
                    mergedElements.signature = {
                        x: data.elements_config.issuer.x || 50,
                        y: Math.max(10, (data.elements_config.issuer.y || 85) - 9),
                        size: 50
                    };
                }
            }

            certConfig = {
                ...certConfig,
                ...data,
                elements_config: mergedElements
            };
            applyConfigToUI();
        }
    } catch (err) {
        console.error('Error loading cert config:', err);
        const activeSurvey = allSurveys.find(s => s.id == currentSurveyId);
        certConfig.title = 'เกียรติบัตร';
        certConfig.body_text = `ได้ผ่านการตอบแบบประเมินความพึงพอใจและมีส่วนร่วมในกิจกรรม ${activeSurvey ? activeSurvey.title : ''}\nให้ไว้ ณ วันที่ {date} ขอให้มีความสุขความเจริญก้าวหน้ายิ่งขึ้นไป`;
        certConfig.elements_config = JSON.parse(JSON.stringify(defaultPositions));
        applyConfigToUI();
    }
}

function applyConfigToUI() {
    // Enable switch
    const toggle = document.getElementById('enableCertToggle');
    if (toggle) toggle.checked = Boolean(Number(certConfig.is_enabled));

    // Preset background
    selectBgPreset(certConfig.bg_preset || 'gold-luxury', false);

    // Custom background image
    const sheet = document.getElementById('certSheet');
    if (certConfig.bg_preset === 'custom' && certConfig.bg_image_url) {
        sheet.style.backgroundImage = `url(${certConfig.bg_image_url})`;
        sheet.style.backgroundSize = 'cover';
        sheet.style.backgroundPosition = 'center';
    } else {
        sheet.style.backgroundImage = '';
    }

    // Logo image
    if (certConfig.logo_url) {
        document.getElementById('logoImg').src = certConfig.logo_url;
        document.getElementById('logoImg').style.display = 'block';
        document.getElementById('logoFallbackIcon').style.display = 'none';
    } else {
        document.getElementById('logoImg').style.display = 'none';
        document.getElementById('logoFallbackIcon').style.display = 'block';
    }

    // Signature image
    const sigImg = document.getElementById('signatureImg');
    const sigBox = document.getElementById('signatureImgBox');
    const sigFallback = document.getElementById('signatureFallbackBox');
    if (certConfig.signature_url) {
        if (sigImg) sigImg.src = certConfig.signature_url;
        if (sigBox) sigBox.style.display = 'block';
        if (sigFallback) sigFallback.style.display = 'none';
    } else {
        if (sigBox) sigBox.style.display = 'none';
        if (sigFallback) sigFallback.style.display = 'flex';
    }

    // Inputs (Textareas)
    document.getElementById('inputTitle').value = certConfig.title || 'เกียรติบัตร';
    document.getElementById('inputSubtitle').value = certConfig.subtitle || 'มอบให้ไว้เพื่อแสดงว่า';
    document.getElementById('inputRecipient').value = certConfig.recipient_name || '{name}';
    document.getElementById('inputBody').value = certConfig.body_text || '';
    document.getElementById('inputDate').value = certConfig.issued_date || '{date}';
    document.getElementById('inputIssuerName').value = certConfig.issuer_name || '';
    document.getElementById('inputIssuerTitle').value = certConfig.issuer_title || '';

    // Render texts on sheet
    updateText('title', certConfig.title);
    updateText('subtitle', certConfig.subtitle);
    updateText('recipient', certConfig.recipient_name);
    updateText('body', certConfig.body_text);
    updateText('date', certConfig.issued_date);
    updateText('issuerName', certConfig.issuer_name);
    updateText('issuerTitle', certConfig.issuer_title);

    // Render positions & font sizes
    applyElementPositions(certConfig.elements_config || defaultPositions);
}

function applyElementPositions(positions) {
    Object.keys(positions).forEach(key => {
        const el = document.getElementById(`el_${key}`);
        if (el && positions[key]) {
            const pos = positions[key];
            el.style.left = `${pos.x}%`;
            el.style.top = `${pos.y}%`;

            if (pos.size) {
                if (key === 'logo') {
                    const wrap = document.getElementById('logoWrapper');
                    if (wrap) {
                        wrap.style.width = `${pos.size}px`;
                        wrap.style.height = `${pos.size}px`;
                    }
                    const slider = document.getElementById('logoSizeRange');
                    if (slider) slider.value = pos.size;
                    const valEl = document.getElementById('logoSizeVal');
                    if (valEl) valEl.textContent = `${pos.size}px`;
                } else if (key === 'signature') {
                    const box = document.getElementById('signatureImgBox');
                    if (box) box.style.height = `${pos.size}px`;
                    const slider = document.getElementById('signatureSizeRange');
                    if (slider) slider.value = pos.size;
                    const valEl = document.getElementById('signatureSizeVal');
                    if (valEl) valEl.textContent = `${pos.size}px`;
                } else {
                    // Text elements font-size
                    el.style.fontSize = `${pos.size}px`;
                    if (key === 'issuer') {
                        const titleEl = el.querySelector('.el-issuer-title');
                        if (titleEl) titleEl.style.fontSize = `${Math.round(pos.size * 0.85)}px`;
                    }
                    const range = document.getElementById(`sizeRange_${key}`);
                    if (range) range.value = pos.size;
                    const valEl = document.getElementById(`sizeVal_${key}`);
                    if (valEl) valEl.textContent = `${pos.size}px`;
                }
            }
        }
    });
}

function selectBgPreset(presetName, updateConfig = true) {
    if (updateConfig) certConfig.bg_preset = presetName;

    document.querySelectorAll('.bg-preset-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-preset') === presetName);
    });

    const sheet = document.getElementById('certSheet');
    sheet.className = `cert-bg-${presetName}`;
    sheet.style.backgroundImage = '';

    const customUploadBox = document.getElementById('customBgUploadBox');
    if (customUploadBox) {
        customUploadBox.style.display = (presetName === 'custom') ? 'block' : 'none';
    }

    if (presetName === 'custom' && certConfig.bg_image_url) {
        sheet.style.backgroundImage = `url(${certConfig.bg_image_url})`;
        sheet.style.backgroundSize = 'cover';
        sheet.style.backgroundPosition = 'center';
    }
}

function handleBgImageUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
        certConfig.bg_image_url = ev.target.result;
        certConfig.bg_preset = 'custom';
        selectBgPreset('custom', true);
        showToast('อัปโหลดรูปพื้นหลังสำเร็จ', 'success');
    };
    reader.readAsDataURL(file);
}

function handleLogoUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
        certConfig.logo_url = ev.target.result;
        document.getElementById('logoImg').src = certConfig.logo_url;
        document.getElementById('logoImg').style.display = 'block';
        document.getElementById('logoFallbackIcon').style.display = 'none';
        showToast('อัปโหลดโลโก้สำเร็จ', 'success');
    };
    reader.readAsDataURL(file);
}

function updateLogoSize(val) {
    const size = parseInt(val);
    const valEl = document.getElementById('logoSizeVal');
    if (valEl) valEl.textContent = `${size}px`;
    const slider = document.getElementById('logoSizeRange');
    if (slider) slider.value = size;
    const wrap = document.getElementById('logoWrapper');
    if (wrap) {
        wrap.style.width = `${size}px`;
        wrap.style.height = `${size}px`;
    }
    if (!certConfig.elements_config) certConfig.elements_config = {};
    if (!certConfig.elements_config.logo) certConfig.elements_config.logo = {};
    certConfig.elements_config.logo.size = size;

    if (currentSelectedKey === 'logo') {
        const floatLabel = document.getElementById('floatSizeLabel');
        if (floatLabel) floatLabel.textContent = `${size}px`;
        const el = document.getElementById('el_logo');
        if (el) updateFloatingToolbarPosition(el);
    }
}

function handleSignatureUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
        certConfig.signature_url = ev.target.result;
        const sigImg = document.getElementById('signatureImg');
        const sigBox = document.getElementById('signatureImgBox');
        const sigFallback = document.getElementById('signatureFallbackBox');
        if (sigImg) sigImg.src = certConfig.signature_url;
        if (sigBox) sigBox.style.display = 'block';
        if (sigFallback) sigFallback.style.display = 'none';
        showToast('อัปโหลดรูปลายเซ็นสำเร็จ', 'success');
    };
    reader.readAsDataURL(file);
}

function updateSignatureSize(val) {
    const size = parseInt(val);
    const valEl = document.getElementById('signatureSizeVal');
    if (valEl) valEl.textContent = `${size}px`;
    const slider = document.getElementById('signatureSizeRange');
    if (slider) slider.value = size;
    const box = document.getElementById('signatureImgBox');
    if (box) box.style.height = `${size}px`;
    if (!certConfig.elements_config) certConfig.elements_config = {};
    if (!certConfig.elements_config.signature) certConfig.elements_config.signature = { x: 50, y: 79 };
    certConfig.elements_config.signature.size = size;

    if (currentSelectedKey === 'signature') {
        const floatLabel = document.getElementById('floatSizeLabel');
        if (floatLabel) floatLabel.textContent = `${size}px`;
        const el = document.getElementById('el_signature');
        if (el) updateFloatingToolbarPosition(el);
    }
}

// Update font size from sidebar slider or +/- buttons
function updateFontSize(key, val) {
    const size = parseInt(val);
    if (!certConfig.elements_config) certConfig.elements_config = {};
    if (!certConfig.elements_config[key]) certConfig.elements_config[key] = { ...(defaultPositions[key] || { x: 50, y: 50, size: 20 }) };
    certConfig.elements_config[key].size = size;

    const valEl = document.getElementById(`sizeVal_${key}`);
    if (valEl) valEl.textContent = `${size}px`;
    const range = document.getElementById(`sizeRange_${key}`);
    if (range) range.value = size;

    const el = document.getElementById(`el_${key}`);
    if (el) {
        el.style.fontSize = `${size}px`;
        if (key === 'issuer') {
            const titleEl = el.querySelector('.el-issuer-title');
            if (titleEl) titleEl.style.fontSize = `${Math.round(size * 0.85)}px`;
        }
    }

    const floatLabel = document.getElementById('floatSizeLabel');
    if (floatLabel && currentSelectedKey === key) floatLabel.textContent = `${size}px`;

    if (el && currentSelectedKey === key) {
        updateFloatingToolbarPosition(el);
    }
}

function stepFontSize(key, delta) {
    if (key === 'signature') {
        const cur = (certConfig.elements_config.signature && certConfig.elements_config.signature.size) || 50;
        updateSignatureSize(Math.max(20, Math.min(140, cur + delta)));
        return;
    }
    if (key === 'logo') {
        const cur = (certConfig.elements_config.logo && certConfig.elements_config.logo.size) || 70;
        updateLogoSize(Math.max(30, Math.min(180, cur + delta)));
        return;
    }

    const current = (certConfig.elements_config && certConfig.elements_config[key] && certConfig.elements_config[key].size) 
        ? certConfig.elements_config[key].size 
        : (defaultPositions[key] ? defaultPositions[key].size : 20);
    const newSize = Math.max(10, Math.min(80, current + delta));
    updateFontSize(key, newSize);
}

// Floating toolbar actions
function adjustSelectedSize(delta) {
    if (!currentSelectedKey) return;
    if (currentSelectedKey === 'logo') {
        stepFontSize('logo', delta * 3);
    } else if (currentSelectedKey === 'signature') {
        stepFontSize('signature', delta * 3);
    } else {
        stepFontSize(currentSelectedKey, delta);
    }
}

// Position floating toolbar above selected element without modifying element's DOM tree
function updateFloatingToolbarPosition(el) {
    const bar = document.getElementById('elementFloatingBar');
    if (!bar) return;
    if (!el) {
        bar.style.display = 'none';
        return;
    }

    bar.style.display = 'flex';

    // Position relative to #certSheet
    const sheet = document.getElementById('certSheet');
    const rect = el.getBoundingClientRect();
    const sheetRect = sheet.getBoundingClientRect();

    const relLeft = (rect.left - sheetRect.left + (rect.width / 2)) / currentScale;
    let relTop = (rect.top - sheetRect.top - 48) / currentScale;

    if (relTop < 6) {
        relTop = (rect.bottom - sheetRect.top + 8) / currentScale;
        bar.classList.add('bar-below');
    } else {
        bar.classList.remove('bar-below');
    }

    bar.style.left = `${Math.round(relLeft)}px`;
    bar.style.top = `${Math.round(relTop)}px`;
    bar.style.transform = 'translateX(-50%)';
}

// Select an element on the canvas & position floating toolbar
function selectElement(el) {
    if (!el) {
        currentSelectedKey = null;
        document.querySelectorAll('.cert-element').forEach(item => item.classList.remove('selected'));
        const bar = document.getElementById('elementFloatingBar');
        if (bar) bar.style.display = 'none';
        return;
    }

    currentSelectedKey = el.getAttribute('data-key');
    document.querySelectorAll('.cert-element').forEach(item => item.classList.remove('selected'));
    el.classList.add('selected');

    // Update size label in floating toolbar
    let curSize = 20;
    if (currentSelectedKey === 'logo') {
        curSize = (certConfig.elements_config && certConfig.elements_config.logo && certConfig.elements_config.logo.size) || 70;
    } else if (currentSelectedKey === 'signature') {
        curSize = (certConfig.elements_config && certConfig.elements_config.signature && certConfig.elements_config.signature.size) || 50;
    } else {
        curSize = (certConfig.elements_config && certConfig.elements_config[currentSelectedKey] && certConfig.elements_config[currentSelectedKey].size)
            || (defaultPositions[currentSelectedKey] ? defaultPositions[currentSelectedKey].size : 20);
    }
    
    const floatLabel = document.getElementById('floatSizeLabel');
    if (floatLabel) floatLabel.textContent = `${curSize}px`;

    const floatEditBtn = document.getElementById('floatEditBtn');
    if (floatEditBtn) {
        floatEditBtn.style.display = (currentSelectedKey === 'logo' || currentSelectedKey === 'signature') ? 'none' : 'inline-flex';
    }

    updateFloatingToolbarPosition(el);
}

function onCanvasClick(e) {
    if (e.target.id === 'certSheet' || e.target.classList.contains('stage-wrapper')) {
        selectElement(null);
        stopAllInlineEditing();
    }
}

// Update text from sidebar inputs into canvas and config
function updateText(type, val) {
    const formattedThaiDate = getSampleThaiDate();

    if (type === 'title') {
        certConfig.title = val;
        const target = document.getElementById('dispTitle');
        if (target && target !== document.activeElement) target.innerText = val || 'เกียรติบัตร';
    } else if (type === 'subtitle') {
        certConfig.subtitle = val;
        const target = document.getElementById('dispSubtitle');
        if (target && target !== document.activeElement) target.innerText = val || 'มอบให้ไว้เพื่อแสดงว่า';
    } else if (type === 'recipient') {
        certConfig.recipient_name = val;
        const disp = (val || '').replace(/{name}/g, 'นายสมศักดิ์ รักการเรียน');
        const target = document.getElementById('dispRecipient');
        if (target && target !== document.activeElement) target.innerText = disp || 'นายสมศักดิ์ รักการเรียน';
    } else if (type === 'body') {
        certConfig.body_text = val;
        const disp = (val || '').replace(/{date}/g, formattedThaiDate).replace(/{name}/g, 'นายสมศักดิ์ รักการเรียน');
        const target = document.getElementById('dispBody');
        if (target && target !== document.activeElement) target.innerText = disp;
    } else if (type === 'date') {
        certConfig.issued_date = val;
        const disp = (val || '').replace(/{date}/g, formattedThaiDate);
        const target = document.getElementById('dispDate');
        if (target && target !== document.activeElement) target.innerText = disp;
    } else if (type === 'issuerName') {
        certConfig.issuer_name = val;
        const target = document.getElementById('dispIssuerName');
        if (target && target !== document.activeElement) target.innerText = val;
    } else if (type === 'issuerTitle') {
        certConfig.issuer_title = val;
        const target = document.getElementById('dispIssuerTitle');
        if (target && target !== document.activeElement) target.innerText = val;
    }
}

// ================= ROBUST INLINE DIRECT CANVAS EDITING (DOUBLE CLICK & BUTTON) ================= //
function startInlineEditing(targetTextEl) {
    if (!targetTextEl) return;
    const parentEl = targetTextEl.closest('.cert-element');
    if (!parentEl) return;

    const key = parentEl.getAttribute('data-key');
    if (key === 'logo' || key === 'signature') return;

    stopAllInlineEditing();

    parentEl.classList.add('is-editing');
    targetTextEl.setAttribute('contenteditable', 'true');
    targetTextEl.style.userSelect = 'text';
    targetTextEl.style.webkitUserSelect = 'text';

    // Hide floating toolbar while editing
    const bar = document.getElementById('elementFloatingBar');
    if (bar) bar.style.display = 'none';

    targetTextEl.focus();

    // Select text content for immediate typing
    try {
        const range = document.createRange();
        range.selectNodeContents(targetTextEl);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
    } catch (e) {}
}

function stopAllInlineEditing() {
    document.querySelectorAll('.cert-element.is-editing').forEach(el => el.classList.remove('is-editing'));
    document.querySelectorAll('[contenteditable="true"]').forEach(el => {
        el.setAttribute('contenteditable', 'false');
        el.style.userSelect = '';
        el.style.webkitUserSelect = '';
    });
}

function editSelectedElement() {
    if (!currentSelectedKey) return;
    const parentEl = document.getElementById(`el_${currentSelectedKey}`);
    if (!parentEl) return;
    const targetText = parentEl.querySelector('.el-text-inner') || parentEl;
    startInlineEditing(targetText);
}

function initInlineEditing() {
    const elements = document.querySelectorAll('.cert-element');
    let lastTapTime = 0;
    let lastTapTarget = null;

    elements.forEach(parentEl => {
        const key = parentEl.getAttribute('data-key');
        if (key === 'logo' || key === 'signature') return;

        const textTargets = parentEl.querySelectorAll('.el-text-inner');

        // Native dblclick on container
        parentEl.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            const target = (e.target && e.target.classList.contains('el-text-inner')) ? e.target : (parentEl.querySelector('.el-text-inner') || parentEl);
            startInlineEditing(target);
        });

        textTargets.forEach(innerText => {
            innerText.setAttribute('contenteditable', 'false');

            // Native dblclick on text node
            innerText.addEventListener('dblclick', (e) => {
                e.stopPropagation();
                startInlineEditing(innerText);
            });

            // Fast double tap / double click detector on pointerdown
            innerText.addEventListener('pointerdown', (e) => {
                const now = Date.now();
                if (lastTapTarget === innerText && (now - lastTapTime) < 380) {
                    e.stopPropagation();
                    startInlineEditing(innerText);
                    lastTapTime = 0;
                    lastTapTarget = null;
                    return;
                }
                lastTapTime = now;
                lastTapTarget = innerText;
            });

            // Sync text live when user types
            innerText.addEventListener('input', () => {
                const text = innerText.innerText;
                if (key === 'title') {
                    certConfig.title = text;
                    document.getElementById('inputTitle').value = text;
                } else if (key === 'subtitle') {
                    certConfig.subtitle = text;
                    document.getElementById('inputSubtitle').value = text;
                } else if (key === 'recipient') {
                    certConfig.recipient_name = text;
                    document.getElementById('inputRecipient').value = text;
                } else if (key === 'body') {
                    certConfig.body_text = text;
                    document.getElementById('inputBody').value = text;
                } else if (key === 'date') {
                    certConfig.issued_date = text;
                    document.getElementById('inputDate').value = text;
                } else if (key === 'issuer') {
                    if (innerText.id === 'dispIssuerName') {
                        certConfig.issuer_name = text;
                        document.getElementById('inputIssuerName').value = text;
                    } else if (innerText.id === 'dispIssuerTitle') {
                        certConfig.issuer_title = text;
                        document.getElementById('inputIssuerTitle').value = text;
                    }
                }
                updateFloatingToolbarPosition(parentEl);
            });

            innerText.addEventListener('blur', () => {
                innerText.setAttribute('contenteditable', 'false');
                innerText.style.userSelect = '';
                innerText.style.webkitUserSelect = '';
                parentEl.classList.remove('is-editing');
            });

            // Prevent drag from starting while typing
            innerText.addEventListener('mousedown', (e) => {
                if (innerText.getAttribute('contenteditable') === 'true') {
                    e.stopPropagation();
                }
            });
            innerText.addEventListener('touchstart', (e) => {
                if (innerText.getAttribute('contenteditable') === 'true') {
                    e.stopPropagation();
                }
            }, { passive: true });
        });
    });
}

function toggleCertEnabled() {
    const toggle = document.getElementById('enableCertToggle');
    certConfig.is_enabled = toggle.checked ? 1 : 0;
    showToast(toggle.checked ? 'เปิดใช้งานเกียรติบัตรสำหรับแบบประเมินนี้' : 'ปิดใช้งานเกียรติบัตรสำหรับแบบประเมินนี้', 'info');
}

function resetElementPositions() {
    certConfig.elements_config = JSON.parse(JSON.stringify(defaultPositions));
    applyElementPositions(certConfig.elements_config);
    showToast('รีเซ็ตตำแหน่งและขนาดเริ่มต้นเรียบร้อยแล้ว', 'info');
}

function zoomStage(scale) {
    currentScale = scale;
    const sheet = document.getElementById('certSheet');
    sheet.style.transform = `scale(${currentScale})`;
    if (currentSelectedKey) {
        const el = document.getElementById(`el_${currentSelectedKey}`);
        if (el) updateFloatingToolbarPosition(el);
    }
}

// ================= MOUSE DRAG RESIZE ENGINE (ALL 4 CORNERS) ================= //
function initMouseResize() {
    const handles = document.querySelectorAll('.resize-handle');
    const tooltip = document.getElementById('resizeTooltip');
    let resizingEl = null;
    let targetKey = '';
    let startMouseX = 0;
    let startMouseY = 0;
    let startSize = 0;
    let isResizing = false;
    let handleDir = 'br';

    handles.forEach(handle => {
        handle.addEventListener('mousedown', onResizeStart);
        handle.addEventListener('touchstart', onResizeStart, { passive: false });
    });

    function onResizeStart(e) {
        e.stopPropagation();
        if (e.cancelable) e.preventDefault();

        resizingEl = this.closest('.cert-element');
        if (!resizingEl) return;

        targetKey = resizingEl.getAttribute('data-key');
        if (!targetKey) return;

        if (this.classList.contains('handle-tl')) handleDir = 'tl';
        else if (this.classList.contains('handle-tr')) handleDir = 'tr';
        else if (this.classList.contains('handle-bl')) handleDir = 'bl';
        else handleDir = 'br';

        isResizing = true;
        selectElement(resizingEl);

        const clientX = e.type === 'touchstart' ? e.touches[0].clientX : e.clientX;
        const clientY = e.type === 'touchstart' ? e.touches[0].clientY : e.clientY;

        startMouseX = clientX;
        startMouseY = clientY;

        // Determine current size
        if (!certConfig.elements_config) certConfig.elements_config = {};
        if (!certConfig.elements_config[targetKey]) {
            certConfig.elements_config[targetKey] = { ...(defaultPositions[targetKey] || { x: 50, y: 50, size: 20 }) };
        }

        if (targetKey === 'logo') {
            startSize = certConfig.elements_config.logo.size || 70;
        } else if (targetKey === 'signature') {
            startSize = certConfig.elements_config.signature.size || 50;
        } else {
            startSize = certConfig.elements_config[targetKey].size || parseFloat(window.getComputedStyle(resizingEl).fontSize) || 20;
        }

        if (tooltip) {
            tooltip.style.display = 'block';
            tooltip.textContent = `ขนาด: ${Math.round(startSize)}px`;
            resizingEl.appendChild(tooltip);
        }

        document.addEventListener('mousemove', onResizeMove);
        document.addEventListener('mouseup', onResizeEnd);
        document.addEventListener('touchmove', onResizeMove, { passive: false });
        document.addEventListener('touchend', onResizeEnd);
    }

    function onResizeMove(e) {
        if (!isResizing || !resizingEl) return;
        if (e.cancelable) e.preventDefault();

        const clientX = e.type === 'touchmove' ? e.touches[0].clientX : e.clientX;
        const clientY = e.type === 'touchmove' ? e.touches[0].clientY : e.clientY;

        let deltaX = (clientX - startMouseX) / currentScale;
        let deltaY = (clientY - startMouseY) / currentScale;

        if (handleDir === 'tl') { deltaX = -deltaX; deltaY = -deltaY; }
        else if (handleDir === 'tr') { deltaY = -deltaY; }
        else if (handleDir === 'bl') { deltaX = -deltaX; }

        const avgDelta = (deltaX + deltaY) / 2;

        let minSize = 10;
        let maxSize = 90;

        if (targetKey === 'logo') {
            minSize = 30;
            maxSize = 180;
            let newSize = Math.max(minSize, Math.min(maxSize, Math.round(startSize + avgDelta)));
            updateLogoSize(newSize);
            if (tooltip) tooltip.textContent = `ขนาด: ${newSize}px`;
            return;
        } else if (targetKey === 'signature') {
            minSize = 20;
            maxSize = 140;
            let newSize = Math.max(minSize, Math.min(maxSize, Math.round(startSize + avgDelta)));
            updateSignatureSize(newSize);
            if (tooltip) tooltip.textContent = `ขนาด: ${newSize}px`;
            return;
        } else if (targetKey === 'title') {
            minSize = 16;
            maxSize = 72;
        } else if (targetKey === 'recipient') {
            minSize = 14;
            maxSize = 64;
        }

        let newSize = Math.round(startSize + avgDelta);
        newSize = Math.max(minSize, Math.min(maxSize, newSize));

        updateFontSize(targetKey, newSize);

        if (tooltip) {
            tooltip.textContent = `ขนาด: ${newSize}px`;
        }
    }

    function onResizeEnd() {
        if (tooltip) tooltip.style.display = 'none';
        isResizing = false;
        resizingEl = null;
        document.removeEventListener('mousemove', onResizeMove);
        document.removeEventListener('mouseup', onResizeEnd);
        document.removeEventListener('touchmove', onResizeMove);
        document.removeEventListener('touchend', onResizeEnd);
    }
}

// ================= DRAG AND DROP ENGINE ================= //
function initDragAndDrop() {
    const sheet = document.getElementById('certSheet');
    let activeElement = null;
    let startX = 0;
    let startY = 0;
    let initialLeftPct = 50;
    let initialTopPct = 50;
    let isDragging = false;

    const elements = document.querySelectorAll('.cert-element');

    elements.forEach(el => {
        el.addEventListener('mousedown', onPointerDown);
        el.addEventListener('touchstart', onPointerDown, { passive: false });
    });

    function onPointerDown(e) {
        // Do not drag if clicking resize handles or floating toolbar
        if (e.target.classList.contains('resize-handle') || e.target.closest('.resize-handle') || e.target.closest('.element-floating-bar')) {
            return;
        }

        // Do not drag if inside active text editing
        if (this.classList.contains('is-editing') || (e.target && e.target.getAttribute('contenteditable') === 'true')) {
            return;
        }

        activeElement = this;
        selectElement(activeElement);

        const clientX = e.type === 'touchstart' ? e.touches[0].clientX : e.clientX;
        const clientY = e.type === 'touchstart' ? e.touches[0].clientY : e.clientY;

        startX = clientX;
        startY = clientY;
        isDragging = false;

        initialLeftPct = parseFloat(activeElement.style.left) || 50;
        initialTopPct = parseFloat(activeElement.style.top) || 50;

        document.addEventListener('mousemove', onPointerMove);
        document.addEventListener('mouseup', onPointerUp);
        document.addEventListener('touchmove', onPointerMove, { passive: false });
        document.addEventListener('touchend', onPointerUp);
    }

    function onPointerMove(e) {
        if (!activeElement) return;
        if (activeElement.classList.contains('is-editing')) return;

        const clientX = e.type === 'touchmove' ? e.touches[0].clientX : e.clientX;
        const clientY = e.type === 'touchmove' ? e.touches[0].clientY : e.clientY;

        const deltaX = (clientX - startX) / currentScale;
        const deltaY = (clientY - startY) / currentScale;

        if (!isDragging && Math.hypot(deltaX, deltaY) > 4) {
            isDragging = true;
        }

        if (!isDragging) return;

        if (e.cancelable) e.preventDefault();

        const sheetWidth = sheet.offsetWidth;
        const sheetHeight = sheet.offsetHeight;

        const deltaLeftPct = (deltaX / sheetWidth) * 100;
        const deltaTopPct = (deltaY / sheetHeight) * 100;

        let newLeft = Math.round((initialLeftPct + deltaLeftPct) * 10) / 10;
        let newTop = Math.round((initialTopPct + deltaTopPct) * 10) / 10;

        newLeft = Math.max(4, Math.min(96, newLeft));
        newTop = Math.max(4, Math.min(96, newTop));

        activeElement.style.left = `${newLeft}%`;
        activeElement.style.top = `${newTop}%`;

        const key = activeElement.getAttribute('data-key');
        if (key) {
            if (!certConfig.elements_config) certConfig.elements_config = {};
            if (!certConfig.elements_config[key]) certConfig.elements_config[key] = {};
            certConfig.elements_config[key].x = newLeft;
            certConfig.elements_config[key].y = newTop;
        }

        updateFloatingToolbarPosition(activeElement);
    }

    function onPointerUp() {
        document.removeEventListener('mousemove', onPointerMove);
        document.removeEventListener('mouseup', onPointerUp);
        document.removeEventListener('touchmove', onPointerMove);
        document.removeEventListener('touchend', onPointerUp);
        isDragging = false;
        activeElement = null;
    }
}

// Save Certificate Configuration to Database
async function saveCertificateConfig() {
    if (!currentSurveyId) {
        showToast('กรุณาเลือกแบบประเมินก่อนบันทึก', 'error');
        return;
    }

    const payload = {
        survey_id: currentSurveyId,
        is_enabled: certConfig.is_enabled ? 1 : 0,
        title: certConfig.title,
        subtitle: certConfig.subtitle,
        recipient_name: certConfig.recipient_name,
        body_text: certConfig.body_text,
        issued_date: certConfig.issued_date,
        issuer_name: certConfig.issuer_name,
        issuer_title: certConfig.issuer_title,
        logo_url: certConfig.logo_url,
        signature_url: certConfig.signature_url,
        bg_image_url: certConfig.bg_image_url,
        bg_preset: certConfig.bg_preset,
        elements_config: certConfig.elements_config
    };

    const saveBtn = document.getElementById('saveCertBtn');
    const mobileSaveBtn = document.getElementById('mobileSaveCertBtn');
    setButtonLoading(saveBtn, true, 'กำลังบันทึก...');
    setButtonLoading(mobileSaveBtn, true, 'กำลังบันทึก...');

    try {
        const res = await api('../api/certificates.php', 'POST', payload);
        setButtonLoading(saveBtn, false);
        setButtonLoading(mobileSaveBtn, false);
        if (res && res.success) {
            showToast('บันทึกการตั้งค่าเกียรติบัตรสำเร็จ!', 'success');
        } else {
            showToast(res ? res.message : 'ไม่สามารถบันทึกข้อมูลได้', 'error');
        }
    } catch (err) {
        setButtonLoading(saveBtn, false);
        setButtonLoading(mobileSaveBtn, false);
        console.error('Save cert error:', err);
        showToast('เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์', 'error');
    }
}

// Export / Preview PDF (Exact 100% Full Bleed A4 Landscape: 297mm x 210mm)
async function previewCertificatePdf() {
    if (!currentSurveyId) {
        showToast('กรุณาเลือกแบบประเมินก่อนดาวน์โหลดตัวอย่าง', 'error');
        return;
    }

    const previewBtn = document.getElementById('previewCertBtn');
    const mobilePreviewBtn = document.getElementById('mobilePreviewCertBtn');
    setButtonLoading(previewBtn, true, 'กำลังสร้าง PDF...');
    setButtonLoading(mobilePreviewBtn, true, 'สร้าง PDF...');

    const exportDiv = document.createElement('div');
    exportDiv.style.position = 'fixed';
    exportDiv.style.left = '0';
    exportDiv.style.top = '0';
    exportDiv.style.zIndex = '-9999';
    exportDiv.style.width = '1123px';
    exportDiv.style.height = '794px';
    exportDiv.style.boxSizing = 'border-box';
    exportDiv.style.margin = '0';
    exportDiv.style.padding = '0';
    exportDiv.style.overflow = 'hidden';
    exportDiv.style.backgroundColor = '#FFFFFF';
    exportDiv.className = `cert-bg-${certConfig.bg_preset || 'gold-luxury'}`;

    if (certConfig.bg_preset === 'custom' && certConfig.bg_image_url) {
        exportDiv.style.backgroundImage = `url(${certConfig.bg_image_url})`;
        exportDiv.style.backgroundSize = '100% 100%';
        exportDiv.style.backgroundPosition = 'center';
        exportDiv.style.backgroundRepeat = 'no-repeat';
    }

    const pos = {
        ...defaultPositions,
        ...(certConfig.elements_config || {})
    };
    const formattedDate = getSampleThaiDate();
    const titleText = certConfig.title || 'เกียรติบัตร';
    const subtitleText = certConfig.subtitle || 'มอบให้ไว้เพื่อแสดงว่า';
    const recipientText = (certConfig.recipient_name || '{name}').replace(/{name}/g, 'นายสมศักดิ์ รักการเรียน');
    const bodyText = (certConfig.body_text || '').replace(/{date}/g, formattedDate).replace(/{name}/g, 'นายสมศักดิ์ รักการเรียน');
    const dateText = (certConfig.issued_date || '{date}').replace(/{date}/g, formattedDate);
    const issuerName = certConfig.issuer_name || '';
    const issuerTitle = certConfig.issuer_title || '';

    const scaleFactor = 1.337;
    const logoSize = Math.round((pos.logo && pos.logo.size ? pos.logo.size : 70) * scaleFactor);
    const titleSize = Math.round((pos.title && pos.title.size ? pos.title.size : 34) * scaleFactor);
    const subtitleSize = Math.round((pos.subtitle && pos.subtitle.size ? pos.subtitle.size : 17) * scaleFactor);
    const recipientSize = Math.round((pos.recipient && pos.recipient.size ? pos.recipient.size : 28) * scaleFactor);
    const bodySize = Math.round((pos.body && pos.body.size ? pos.body.size : 15) * scaleFactor);
    const dateSize = Math.round((pos.date && pos.date.size ? pos.date.size : 14) * scaleFactor);
    const signatureSize = Math.round((pos.signature && pos.signature.size ? pos.signature.size : 50) * scaleFactor);
    const issuerSize = Math.round((pos.issuer && pos.issuer.size ? pos.issuer.size : 15) * scaleFactor);
    const issuerTitleSize = Math.round(issuerSize * 0.85);

    const logoHtml = certConfig.logo_url 
        ? `<img src="${certConfig.logo_url}" style="max-width:${logoSize}px; max-height:${logoSize}px; object-fit:contain;" alt="Logo">` 
        : `<i class="fas fa-award" style="font-size: ${Math.round(logoSize * 0.75)}px; color: #D97706;"></i>`;

    const signatureHtml = certConfig.signature_url 
        ? `<div style="position: absolute; left: ${pos.signature ? pos.signature.x : 50}%; top: ${pos.signature ? pos.signature.y : 79}%; transform: translate(-50%, -50%); text-align:center;">
             <img src="${certConfig.signature_url}" style="height: ${signatureSize}px; max-width: 320px; object-fit:contain;" alt="Signature">
           </div>` 
        : ``;

    exportDiv.innerHTML = `
        <div style="position: absolute; left: ${pos.logo ? pos.logo.x : 50}%; top: ${pos.logo ? pos.logo.y : 14}%; transform: translate(-50%, -50%); text-align:center;">
            ${logoHtml}
        </div>
        <div style="position: absolute; left: ${pos.title ? pos.title.x : 50}%; top: ${pos.title ? pos.title.y : 26}%; transform: translate(-50%, -50%); font-family: 'Prompt', 'Sarabun', sans-serif; font-size: ${titleSize}px; font-weight: 700; color: #1E293B; text-align:center; width: 100%; letter-spacing: 0.5px; white-space: pre-line; word-break: break-word;">
            ${escapeHtml(titleText)}
        </div>
        <div style="position: absolute; left: ${pos.subtitle ? pos.subtitle.x : 50}%; top: ${pos.subtitle ? pos.subtitle.y : 35}%; transform: translate(-50%, -50%); font-family: 'Sarabun', 'Prompt', sans-serif; font-size: ${subtitleSize}px; color: #64748B; text-align:center; width: 100%; white-space: pre-line; word-break: break-word;">
            ${escapeHtml(subtitleText)}
        </div>
        <div style="position: absolute; left: ${pos.recipient ? pos.recipient.x : 50}%; top: ${pos.recipient ? pos.recipient.y : 45}%; transform: translate(-50%, -50%); font-family: 'Prompt', 'Sarabun', sans-serif; font-size: ${recipientSize}px; font-weight: 700; color: #4F46E5; border-bottom: 2px solid #C7D2FE; padding-bottom: 6px; min-width: 380px; text-align:center; white-space: pre-line; word-break: break-word;">
            ${escapeHtml(recipientText)}
        </div>
        <div style="position: absolute; left: ${pos.body ? pos.body.x : 50}%; top: ${pos.body ? pos.body.y : 58}%; transform: translate(-50%, -50%); font-family: 'Sarabun', 'Prompt', sans-serif; font-size: ${bodySize}px; color: #334155; width: 840px; line-height: 1.7; text-align:center; white-space: pre-line; word-break: break-word;">
            ${escapeHtml(bodyText)}
        </div>
        <div style="position: absolute; left: ${pos.date ? pos.date.x : 50}%; top: ${pos.date ? pos.date.y : 70}%; transform: translate(-50%, -50%); font-family: 'Sarabun', 'Prompt', sans-serif; font-size: ${dateSize}px; color: #64748B; text-align:center; width: 100%; white-space: pre-line; word-break: break-word;">
            ${escapeHtml(dateText)}
        </div>
        ${signatureHtml}
        <div style="position: absolute; left: ${pos.issuer ? pos.issuer.x : 50}%; top: ${pos.issuer ? pos.issuer.y : 89}%; transform: translate(-50%, -50%); text-align:center; white-space: pre-line; word-break: break-word;">
            <div style="font-family: 'Sarabun', 'Prompt', sans-serif; font-size: ${issuerSize}px; font-weight: 600; color: #1E293B; white-space: pre-line;">${escapeHtml(issuerName)}</div>
            <div style="font-family: 'Sarabun', 'Prompt', sans-serif; font-size: ${issuerTitleSize}px; color: #64748B; margin-top: 2px; white-space: pre-line;">${escapeHtml(issuerTitle)}</div>
        </div>
    `;

    document.body.appendChild(exportDiv);

    try {
        const canvas = await html2canvas(exportDiv, {
            scale: 2,
            useCORS: true,
            logging: false,
            width: 1123,
            height: 794,
            scrollX: 0,
            scrollY: 0,
            backgroundColor: '#FFFFFF'
        });

        const imgData = canvas.toDataURL('image/jpeg', 0.98);
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF({
            orientation: 'landscape',
            unit: 'mm',
            format: 'a4'
        });

        // Exact 100% full bleed: (x=0, y=0, width=297mm, height=210mm)
        pdf.addImage(imgData, 'JPEG', 0, 0, 297, 210, undefined, 'FAST');
        pdf.save(`Certificate_Preview_${currentSurveyId}.pdf`);

        document.body.removeChild(exportDiv);
        setButtonLoading(previewBtn, false);
        setButtonLoading(mobilePreviewBtn, false);
        showToast('ดาวน์โหลดไฟล์ PDF เต็มหน้ากระดาษ A4 สำเร็จ', 'success');
    } catch (err) {
        setButtonLoading(previewBtn, false);
        setButtonLoading(mobilePreviewBtn, false);
        console.error('PDF error:', err);
        if (document.body.contains(exportDiv)) {
            document.body.removeChild(exportDiv);
        }
        showToast('เกิดข้อผิดพลาดในการสร้างไฟล์ PDF', 'error');
    }
}

function getSampleThaiDate() {
    const now = new Date();
    const thaiMonths = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน',
                       'กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
    const date = now.getDate();
    const month = thaiMonths[now.getMonth()];
    const year = now.getFullYear() + 543;
    return `ให้ไว้ ณ วันที่ ${date} ${month} พ.ศ. ${year}`;
}

function escapeHtml(text) {
    if (!text) return '';
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}