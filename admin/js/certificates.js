// /Applications/MAMP/htdocs/Feedback/admin/js/certificates.js
// Certificate Designer Controller - Robust Double-Click Editing, Floating Toolbar & Live Multi-Way Resizing

let currentSurveyId = null;
let allSurveys = [];
let currentSelectedKey = null;
let currentEditingStyleType = null;
let lastTextSelectionRange = null;
let suppressCanvasClickUntil = 0;

const textStyleDefinitions = {
    title: { elementId: 'dispTitle', configKey: 'title', colorKey: 'color', rangesKey: 'color_ranges', defaultColor: '#1E293B' },
    subtitle: { elementId: 'dispSubtitle', configKey: 'subtitle', colorKey: 'color', rangesKey: 'color_ranges', defaultColor: '#64748B' },
    recipient: { elementId: 'dispRecipient', configKey: 'recipient', colorKey: 'color', rangesKey: 'color_ranges', defaultColor: '#4F46E5' },
    body: { elementId: 'dispBody', configKey: 'body', colorKey: 'color', rangesKey: 'color_ranges', defaultColor: '#334155' },
    date: { elementId: 'dispDate', configKey: 'date', colorKey: 'color', rangesKey: 'color_ranges', defaultColor: '#64748B' },
    issuerName: { elementId: 'dispIssuerName', configKey: 'issuer', colorKey: 'name_color', rangesKey: 'name_color_ranges', defaultColor: '#1E293B' },
    issuerTitle: { elementId: 'dispIssuerTitle', configKey: 'issuer', colorKey: 'title_color', rangesKey: 'title_color_ranges', defaultColor: '#64748B' }
};

const mediaSizeLimits = {
    logo: { min: 30, max: 320, stepMultiplier: 3 },
    signature: { min: 20, max: 260, stepMultiplier: 3 }
};

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
    loadCertificateTemplates();
    initDragAndDrop();
    initMouseResize();
    initInlineEditing();
    document.addEventListener('selectionchange', rememberCertificateTextSelection);
});

let certSurveyCombobox = null;
let certificateTemplates = [];

function setCertificateTemplateActionsEnabled(enabled) {
    ['applyCertificateTemplateBtn', 'updateCertificateTemplateBtn', 'deleteCertificateTemplateBtn'].forEach(id => {
        const button = document.getElementById(id);
        if (button) button.disabled = !enabled;
    });
}

async function loadCertificateTemplates(selectedId = null) {
    const select = document.getElementById('certificateTemplateSelect');
    if (!select) return;

    try {
        const res = await api('../api/certificate_templates.php');
        if (!res || !res.success) {
            throw new Error(res ? res.message : 'ไม่สามารถโหลดรายการเทมเพลตได้');
        }

        certificateTemplates = Array.isArray(res.data) ? res.data : [];
        select.innerHTML = '<option value="">-- ยังไม่เลือกเทมเพลต --</option>';

        certificateTemplates.forEach(template => {
            const option = document.createElement('option');
            option.value = String(template.id);
            option.textContent = template.name;
            select.appendChild(option);
        });

        if (selectedId && certificateTemplates.some(template => Number(template.id) === Number(selectedId))) {
            select.value = String(selectedId);
        } else {
            select.value = '';
        }
        onCertificateTemplateSelectionChange(select.value);
    } catch (err) {
        console.error('Load certificate templates error:', err);
        select.innerHTML = '<option value="">-- โหลดเทมเพลตไม่สำเร็จ --</option>';
        setCertificateTemplateActionsEnabled(false);
        showToast(err.message || 'ไม่สามารถโหลดรายการเทมเพลตได้', 'error');
    }
}

function onCertificateTemplateSelectionChange(value) {
    const selectedId = Number(value) || 0;
    const selected = certificateTemplates.find(template => Number(template.id) === selectedId);
    const nameInput = document.getElementById('certificateTemplateName');
    if (nameInput) nameInput.value = selected ? selected.name : '';
    setCertificateTemplateActionsEnabled(Boolean(selected));
}

function getCertificateTemplatePayload() {
    syncAllUIInputsToConfig();
    const nameInput = document.getElementById('certificateTemplateName');

    return {
        name: nameInput ? nameInput.value.trim() : '',
        title: certConfig.title || 'เกียรติบัตร',
        subtitle: certConfig.subtitle || 'มอบให้ไว้เพื่อแสดงว่า',
        recipient_name: certConfig.recipient_name || '{name}',
        body_text: certConfig.body_text || '',
        issued_date: certConfig.issued_date || '{date}',
        issuer_name: certConfig.issuer_name || '',
        issuer_title: certConfig.issuer_title || '',
        logo_url: certConfig.logo_url || '',
        signature_url: certConfig.signature_url || '',
        bg_image_url: certConfig.bg_image_url || '',
        bg_preset: certConfig.bg_preset || 'gold-luxury',
        elements_config: certConfig.elements_config || defaultPositions
    };
}

async function createCertificateTemplate() {
    const payload = getCertificateTemplatePayload();
    if (!payload.name) {
        showToast('กรุณาระบุชื่อเทมเพลตก่อนบันทึก', 'warning');
        const nameInput = document.getElementById('certificateTemplateName');
        if (nameInput) nameInput.focus();
        return;
    }

    const button = document.getElementById('createCertificateTemplateBtn');
    setButtonLoading(button, true, 'กำลังบันทึก...');
    try {
        const res = await api('../api/certificate_templates.php', 'POST', payload);
        if (!res || !res.success) {
            throw new Error(res ? res.message : 'ไม่สามารถบันทึกเทมเพลตได้');
        }

        await loadCertificateTemplates(res.data.id);
        showToast('บันทึกเทมเพลตเกียรติบัตรใหม่สำเร็จ', 'success');
    } catch (err) {
        console.error('Create certificate template error:', err);
        showToast(err.message || 'ไม่สามารถบันทึกเทมเพลตได้', 'error');
    } finally {
        setButtonLoading(button, false);
    }
}

async function updateSelectedCertificateTemplate() {
    const select = document.getElementById('certificateTemplateSelect');
    const id = select ? Number(select.value) : 0;
    if (!id) {
        showToast('กรุณาเลือกเทมเพลตที่ต้องการอัปเดต', 'warning');
        return;
    }

    const payload = { id, ...getCertificateTemplatePayload() };
    if (!payload.name) {
        showToast('กรุณาระบุชื่อเทมเพลต', 'warning');
        return;
    }

    const button = document.getElementById('updateCertificateTemplateBtn');
    setButtonLoading(button, true, 'กำลังอัปเดต...');
    try {
        const res = await api('../api/certificate_templates.php', 'PUT', payload);
        if (!res || !res.success) {
            throw new Error(res ? res.message : 'ไม่สามารถอัปเดตเทมเพลตได้');
        }

        await loadCertificateTemplates(id);
        showToast('อัปเดตชื่อและรายละเอียดเทมเพลตสำเร็จ', 'success');
    } catch (err) {
        console.error('Update certificate template error:', err);
        showToast(err.message || 'ไม่สามารถอัปเดตเทมเพลตได้', 'error');
    } finally {
        setButtonLoading(button, false);
    }
}

async function applySelectedCertificateTemplate() {
    const select = document.getElementById('certificateTemplateSelect');
    const id = select ? Number(select.value) : 0;
    if (!id) {
        showToast('กรุณาเลือกเทมเพลตที่ต้องการใช้', 'warning');
        return;
    }

    const button = document.getElementById('applyCertificateTemplateBtn');
    setButtonLoading(button, true, 'กำลังโหลด...');
    try {
        const res = await api(`../api/certificate_templates.php?id=${id}`);
        if (!res || !res.success || !res.data) {
            throw new Error(res ? res.message : 'ไม่สามารถโหลดเทมเพลตได้');
        }

        const template = res.data;
        const templatePositions = template.elements_config && typeof template.elements_config === 'object'
            ? template.elements_config
            : {};
        const currentEnabled = certConfig.is_enabled;
        const currentBodyText = certConfig.body_text ?? '';
        const currentBodyRanges = Array.isArray(certConfig.elements_config?.body?.color_ranges)
            ? certConfig.elements_config.body.color_ranges.map(range => ({ ...range }))
            : [];

        const mergedTemplatePositions = Object.fromEntries(
            Object.keys(defaultPositions).map(key => [
                key,
                { ...defaultPositions[key], ...(templatePositions[key] || {}) }
            ])
        );
        // Partial text colors are tied to character offsets. Keep the current
        // survey body's ranges because its content intentionally does not change.
        mergedTemplatePositions.body.color_ranges = currentBodyRanges;

        certConfig = {
            ...certConfig,
            title: template.title ?? 'เกียรติบัตร',
            subtitle: template.subtitle ?? 'มอบให้ไว้เพื่อแสดงว่า',
            recipient_name: template.recipient_name ?? '{name}',
            body_text: currentBodyText,
            issued_date: template.issued_date ?? '{date}',
            issuer_name: template.issuer_name ?? '',
            issuer_title: template.issuer_title ?? '',
            logo_url: template.logo_url ?? '',
            signature_url: template.signature_url ?? '',
            bg_image_url: template.bg_image_url ?? '',
            bg_preset: template.bg_preset || 'gold-luxury',
            elements_config: mergedTemplatePositions,
            is_enabled: currentEnabled
        };

        selectElement(null);
        stopAllInlineEditing();
        applyConfigToUI();
        showToast('นำเทมเพลตมาใช้แล้ว (คงข้อความ Body ของแบบประเมินนี้ไว้) กรุณากดบันทึกเพื่อยืนยัน', 'success');
    } catch (err) {
        console.error('Apply certificate template error:', err);
        showToast(err.message || 'ไม่สามารถนำเทมเพลตมาใช้ได้', 'error');
    } finally {
        setButtonLoading(button, false);
    }
}

function deleteSelectedCertificateTemplate() {
    const select = document.getElementById('certificateTemplateSelect');
    const id = select ? Number(select.value) : 0;
    const selected = certificateTemplates.find(template => Number(template.id) === id);
    if (!id || !selected) {
        showToast('กรุณาเลือกเทมเพลตที่ต้องการลบ', 'warning');
        return;
    }

    showConfirm(`ต้องการลบเทมเพลต “${escapeHtml(selected.name)}” ใช่หรือไม่?`, async () => {
        const button = document.getElementById('deleteCertificateTemplateBtn');
        setButtonLoading(button, true, 'กำลังลบ...');
        try {
            const res = await api(`../api/certificate_templates.php?id=${id}`, 'DELETE');
            if (!res || !res.success) {
                throw new Error(res ? res.message : 'ไม่สามารถลบเทมเพลตได้');
            }

            await loadCertificateTemplates();
            showToast('ลบเทมเพลตเกียรติบัตรสำเร็จ', 'success');
        } catch (err) {
            console.error('Delete certificate template error:', err);
            showToast(err.message || 'ไม่สามารถลบเทมเพลตได้', 'error');
        } finally {
            setButtonLoading(button, false);
            const currentSelect = document.getElementById('certificateTemplateSelect');
            setCertificateTemplateActionsEnabled(Boolean(currentSelect && currentSelect.value));
        }
    });
}

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
        if (sigBox) sigBox.style.display = 'flex';
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
    updateText('title', certConfig.title, true);
    updateText('subtitle', certConfig.subtitle, true);
    updateText('recipient', certConfig.recipient_name, true);
    updateText('body', certConfig.body_text, true);
    updateText('date', certConfig.issued_date, true);
    updateText('issuerName', certConfig.issuer_name, true);
    updateText('issuerTitle', certConfig.issuer_title, true);
    renderAllStyledText();

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
                    const fallbackIcon = document.getElementById('logoFallbackIcon');
                    if (fallbackIcon) fallbackIcon.style.fontSize = `${Math.round(pos.size * 0.72)}px`;
                    const slider = document.getElementById('logoSizeRange');
                    if (slider) slider.value = pos.size;
                    const valEl = document.getElementById('logoSizeVal');
                    if (valEl) valEl.textContent = `${pos.size}px`;
                } else if (key === 'signature') {
                    const box = document.getElementById('signatureImgBox');
                    if (box) box.style.height = `${pos.size}px`;
                    updateSignatureFallbackSize(pos.size);
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

// Client-side Image Compression Helper (< 50KB, preserves transparency for PNG)
function compressImageFile(file, maxWidth, maxHeight, quality = 0.85, isPng = false) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                let w = img.width;
                let h = img.height;
                if (w > maxWidth || h > maxHeight) {
                    if (w / h > maxWidth / maxHeight) {
                        h = Math.round((h * maxWidth) / w);
                        w = maxWidth;
                    } else {
                        w = Math.round((w * maxHeight) / h);
                        h = maxHeight;
                    }
                }
                const canvas = document.createElement('canvas');
                canvas.width = w;
                canvas.height = h;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, w, h);
                const format = isPng ? 'image/png' : 'image/jpeg';
                resolve(canvas.toDataURL(format, quality));
            };
            img.onerror = () => reject(new Error('ไม่สามารถอ่านไฟล์รูปภาพได้'));
            img.src = e.target.result;
        };
        reader.onerror = (err) => reject(err);
        reader.readAsDataURL(file);
    });
}

async function handleBgImageUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    try {
        const compressed = await compressImageFile(file, 1680, 1188, 0.82, false);
        certConfig.bg_image_url = compressed;
        certConfig.bg_preset = 'custom';
        selectBgPreset('custom', true);
        showToast('อัปโหลดรูปพื้นหลังสำเร็จ (พร้อมบันทึก)', 'success');
    } catch (err) {
        console.error('Upload bg error:', err);
        showToast('ไม่สามารถประมวลผลรูปภาพได้', 'error');
    }
}

async function handleLogoUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    try {
        const compressed = await compressImageFile(file, 400, 400, 0.9, true);
        certConfig.logo_url = compressed;
        const logoImg = document.getElementById('logoImg');
        const logoIcon = document.getElementById('logoFallbackIcon');
        if (logoImg) {
            logoImg.src = certConfig.logo_url;
            logoImg.style.display = 'block';
        }
        if (logoIcon) logoIcon.style.display = 'none';
        showToast('อัปโหลดโลโก้สำเร็จ (พร้อมบันทึก)', 'success');
    } catch (err) {
        console.error('Upload logo error:', err);
        showToast('ไม่สามารถประมวลผลโลโก้ได้', 'error');
    }
}

function updateLogoSize(val) {
    const limits = mediaSizeLimits.logo;
    const size = Math.max(limits.min, Math.min(limits.max, parseInt(val) || 70));
    const valEl = document.getElementById('logoSizeVal');
    if (valEl) valEl.textContent = `${size}px`;
    const slider = document.getElementById('logoSizeRange');
    if (slider) slider.value = size;
    const wrap = document.getElementById('logoWrapper');
    if (wrap) {
        wrap.style.width = `${size}px`;
        wrap.style.height = `${size}px`;
    }
    const fallbackIcon = document.getElementById('logoFallbackIcon');
    if (fallbackIcon) fallbackIcon.style.fontSize = `${Math.round(size * 0.72)}px`;
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

async function handleSignatureUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    try {
        const compressed = await compressImageFile(file, 600, 300, 0.9, true);
        certConfig.signature_url = compressed;
        const sigImg = document.getElementById('signatureImg');
        const sigBox = document.getElementById('signatureImgBox');
        const sigFallback = document.getElementById('signatureFallbackBox');
        if (sigImg) sigImg.src = certConfig.signature_url;
        if (sigBox) sigBox.style.display = 'flex';
        if (sigFallback) sigFallback.style.display = 'none';
        showToast('อัปโหลดรูปลายเซ็นสำเร็จ (พร้อมบันทึก)', 'success');
    } catch (err) {
        console.error('Upload signature error:', err);
        showToast('ไม่สามารถประมวลผลลายเซ็นได้', 'error');
    }
}

function updateSignatureSize(val) {
    const limits = mediaSizeLimits.signature;
    const size = Math.max(limits.min, Math.min(limits.max, parseInt(val) || 50));
    const valEl = document.getElementById('signatureSizeVal');
    if (valEl) valEl.textContent = `${size}px`;
    const slider = document.getElementById('signatureSizeRange');
    if (slider) slider.value = size;
    const box = document.getElementById('signatureImgBox');
    if (box) box.style.height = `${size}px`;
    updateSignatureFallbackSize(size);
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

function updateSignatureFallbackSize(size) {
    const fallback = document.getElementById('signatureFallbackBox');
    if (!fallback) return;
    const safeSize = Math.max(mediaSizeLimits.signature.min, Math.min(mediaSizeLimits.signature.max, parseInt(size) || 50));
    fallback.style.minHeight = `${Math.max(38, safeSize)}px`;
    fallback.style.minWidth = `${Math.max(160, Math.round(safeSize * 2.4))}px`;
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
        const limits = mediaSizeLimits.signature;
        const cur = (certConfig.elements_config.signature && certConfig.elements_config.signature.size) || 50;
        updateSignatureSize(Math.max(limits.min, Math.min(limits.max, cur + delta)));
        return;
    }
    if (key === 'logo') {
        const limits = mediaSizeLimits.logo;
        const cur = (certConfig.elements_config.logo && certConfig.elements_config.logo.size) || 70;
        updateLogoSize(Math.max(limits.min, Math.min(limits.max, cur + delta)));
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
        stepFontSize('logo', delta * mediaSizeLimits.logo.stepMultiplier);
    } else if (currentSelectedKey === 'signature') {
        stepFontSize('signature', delta * mediaSizeLimits.signature.stepMultiplier);
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
        currentEditingStyleType = null;
        lastTextSelectionRange = null;
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
    const floatingColorControl = document.getElementById('floatingColorControl');
    if (floatingColorControl) {
        floatingColorControl.style.display = (currentSelectedKey === 'logo' || currentSelectedKey === 'signature') ? 'none' : 'inline-flex';
    }

    const selectedStyleType = currentSelectedKey === 'issuer' ? 'issuerName' : currentSelectedKey;
    currentEditingStyleType = getTextStyleDefinition(selectedStyleType) ? selectedStyleType : null;
    lastTextSelectionRange = null;
    if (currentEditingStyleType) syncCertificateColorControls(currentEditingStyleType);

    updateFloatingToolbarPosition(el);
}

function onCanvasClick(e) {
    if (Date.now() < suppressCanvasClickUntil) return;
    if (e.target.id === 'certSheet' || e.target.classList.contains('stage-wrapper')) {
        selectElement(null);
        stopAllInlineEditing();
    }
}

function normalizeCertificateTextColor(color, fallback = '#1E293B') {
    return /^#[0-9A-F]{6}$/i.test(String(color || '')) ? String(color).toUpperCase() : fallback;
}

function getTextStyleDefinition(type) {
    return textStyleDefinitions[type] || null;
}

function getTextStyleConfig(type, create = false) {
    const definition = getTextStyleDefinition(type);
    if (!definition) return null;
    if (!certConfig.elements_config) {
        if (!create) return null;
        certConfig.elements_config = {};
    }
    if (!certConfig.elements_config[definition.configKey]) {
        if (!create) return null;
        certConfig.elements_config[definition.configKey] = { ...(defaultPositions[definition.configKey] || {}) };
    }
    return certConfig.elements_config[definition.configKey];
}

function getRawTextForStyle(type) {
    const defaults = {
        title: 'เกียรติบัตร',
        subtitle: 'มอบให้ไว้เพื่อแสดงว่า',
        recipient: '{name}',
        body: '',
        date: '{date}',
        issuerName: '',
        issuerTitle: ''
    };
    const values = {
        title: certConfig.title,
        subtitle: certConfig.subtitle,
        recipient: certConfig.recipient_name,
        body: certConfig.body_text,
        date: certConfig.issued_date,
        issuerName: certConfig.issuer_name,
        issuerTitle: certConfig.issuer_title
    };
    return String(values[type] ?? defaults[type] ?? '');
}

function getStyleTypeFromTextElement(element) {
    if (!element) return null;
    return Object.keys(textStyleDefinitions).find(type => textStyleDefinitions[type].elementId === element.id) || null;
}

function getSafeColorRanges(type, textLength) {
    const definition = getTextStyleDefinition(type);
    const config = getTextStyleConfig(type, false);
    const ranges = config && Array.isArray(config[definition.rangesKey]) ? config[definition.rangesKey] : [];
    return ranges
        .map(range => ({
            start: Math.max(0, Math.min(textLength, Number(range.start) || 0)),
            end: Math.max(0, Math.min(textLength, Number(range.end) || 0)),
            color: normalizeCertificateTextColor(range.color, definition.defaultColor)
        }))
        .filter(range => range.end > range.start)
        .sort((a, b) => a.start - b.start || a.end - b.end);
}

function renderMappedPlainText(text, sourceStart, color) {
    if (!text) return '';
    let html = '';
    let lineStart = 0;
    const lines = text.split('\n');
    lines.forEach((line, index) => {
        if (line) {
            const start = sourceStart + lineStart;
            const end = start + line.length;
            html += `<span data-source-start="${start}" data-source-end="${end}" style="color:${color};">${escapeHtml(line)}</span>`;
        }
        if (index < lines.length - 1) html += '<br>';
        lineStart += line.length + 1;
    });
    return html;
}

function renderMappedTextSegment(text, sourceStart, color) {
    const tokenPattern = /\{(name|date)\}/g;
    let html = '';
    let cursor = 0;
    let match;
    while ((match = tokenPattern.exec(text)) !== null) {
        html += renderMappedPlainText(text.slice(cursor, match.index), sourceStart + cursor, color);
        const tokenStart = sourceStart + match.index;
        const tokenEnd = tokenStart + match[0].length;
        const displayValue = match[1] === 'name' ? 'นายสมศักดิ์ รักการเรียน' : getSampleThaiDate();
        html += `<span data-cert-token="${match[1]}" data-source-start="${tokenStart}" data-source-end="${tokenEnd}" style="color:${color};">${escapeHtml(displayValue)}</span>`;
        cursor = match.index + match[0].length;
    }
    html += renderMappedPlainText(text.slice(cursor), sourceStart + cursor, color);
    return html;
}

function renderStyledText(type) {
    const definition = getTextStyleDefinition(type);
    if (!definition) return;
    const target = document.getElementById(definition.elementId);
    if (!target) return;

    const rawText = getRawTextForStyle(type);
    const config = getTextStyleConfig(type, false) || {};
    const baseColor = normalizeCertificateTextColor(config[definition.colorKey], definition.defaultColor);
    const ranges = getSafeColorRanges(type, rawText.length);
    const boundaries = new Set([0, rawText.length]);
    ranges.forEach(range => {
        boundaries.add(range.start);
        boundaries.add(range.end);
    });

    const points = Array.from(boundaries).sort((a, b) => a - b);
    let html = '';
    for (let index = 0; index < points.length - 1; index++) {
        const start = points[index];
        const end = points[index + 1];
        const activeRange = ranges.find(range => range.start <= start && range.end >= end);
        html += renderMappedTextSegment(rawText.slice(start, end), start, activeRange ? activeRange.color : baseColor);
    }

    target.style.color = baseColor;
    target.innerHTML = html;
}

function renderAllStyledText() {
    Object.keys(textStyleDefinitions).forEach(renderStyledText);
    syncCertificateColorControls();
}

function syncCertificateColorControls(type = null) {
    const types = type ? [type] : Object.keys(textStyleDefinitions);
    types.forEach(styleType => {
        const definition = getTextStyleDefinition(styleType);
        if (!definition) return;
        const config = getTextStyleConfig(styleType, false) || {};
        const color = normalizeCertificateTextColor(config[definition.colorKey], definition.defaultColor);
        const input = document.getElementById(`textColor_${styleType}`);
        if (input) input.value = color;
        if (styleType === (currentEditingStyleType || currentSelectedKey)) {
            const floatingInput = document.getElementById('floatingTextColor');
            if (floatingInput) floatingInput.value = color;
        }
    });
}

function clearTextColorRanges(type) {
    const definition = getTextStyleDefinition(type);
    const config = getTextStyleConfig(type, true);
    if (definition && config) config[definition.rangesKey] = [];
}

function setWholeTextColor(type, color) {
    const definition = getTextStyleDefinition(type);
    if (!definition) return;
    const config = getTextStyleConfig(type, true);
    config[definition.colorKey] = normalizeCertificateTextColor(color, definition.defaultColor);
    config[definition.rangesKey] = [];
    renderStyledText(type);
    syncCertificateColorControls(type);
}

function rememberCertificateTextSelection() {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return;
    const range = selection.getRangeAt(0);
    const target = range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE
        ? range.commonAncestorContainer.closest('.el-text-inner')
        : range.commonAncestorContainer.parentElement?.closest('.el-text-inner');
    if (!target || target.getAttribute('contenteditable') !== 'true') return;
    currentEditingStyleType = getStyleTypeFromTextElement(target);
    lastTextSelectionRange = range.cloneRange();
}

function findMappedSpan(node, direction = 'first') {
    if (!node) return null;
    if (node.nodeType === Node.TEXT_NODE) return node.parentElement?.closest('[data-source-start]') || null;
    if (node.nodeType !== Node.ELEMENT_NODE) return null;
    if (node.hasAttribute('data-source-start')) return node;
    const mapped = node.querySelectorAll('[data-source-start]');
    return mapped.length ? mapped[direction === 'last' ? mapped.length - 1 : 0] : null;
}

function selectionBoundaryToSourceOffset(container, offset, isEnd, target, rawLength) {
    if (container.nodeType === Node.TEXT_NODE) {
        const span = container.parentElement?.closest('[data-source-start]');
        if (span && target.contains(span)) {
            const start = Number(span.dataset.sourceStart) || 0;
            const end = Number(span.dataset.sourceEnd) || start;
            if (span.dataset.certToken) return isEnd ? end : start;
            return Math.max(start, Math.min(end, start + offset));
        }
    }

    if (container.nodeType === Node.ELEMENT_NODE) {
        const children = Array.from(container.childNodes);
        const candidate = isEnd ? children[Math.max(0, offset - 1)] : children[Math.min(offset, children.length - 1)];
        const mapped = findMappedSpan(candidate, isEnd ? 'last' : 'first');
        if (mapped && target.contains(mapped)) {
            return Number(mapped.dataset[isEnd ? 'sourceEnd' : 'sourceStart']) || 0;
        }
    }
    return isEnd ? rawLength : 0;
}

function addTextColorRange(type, start, end, color) {
    const definition = getTextStyleDefinition(type);
    const config = getTextStyleConfig(type, true);
    if (!definition || !config || end <= start) return;
    const existing = getSafeColorRanges(type, getRawTextForStyle(type).length);
    const next = [];
    existing.forEach(range => {
        if (range.end <= start || range.start >= end) {
            next.push(range);
            return;
        }
        if (range.start < start) next.push({ ...range, end: start });
        if (range.end > end) next.push({ ...range, start: end });
    });
    next.push({ start, end, color: normalizeCertificateTextColor(color, definition.defaultColor) });
    config[definition.rangesKey] = next.sort((a, b) => a.start - b.start);
}

function applySelectedTextColor(color) {
    const styleType = currentEditingStyleType;
    const definition = getTextStyleDefinition(styleType);
    const target = definition ? document.getElementById(definition.elementId) : null;
    if (styleType && target && lastTextSelectionRange) {
        const rawLength = getRawTextForStyle(styleType).length;
        const start = selectionBoundaryToSourceOffset(lastTextSelectionRange.startContainer, lastTextSelectionRange.startOffset, false, target, rawLength);
        const end = selectionBoundaryToSourceOffset(lastTextSelectionRange.endContainer, lastTextSelectionRange.endOffset, true, target, rawLength);
        if (end > start) {
            addTextColorRange(styleType, start, end, color);
            renderStyledText(styleType);
            syncCertificateColorControls(styleType);
            lastTextSelectionRange = null;
            showToast('เปลี่ยนสีเฉพาะข้อความที่เลือกแล้ว', 'success');
            return;
        }
    }

    if (currentSelectedKey === 'issuer') {
        setWholeTextColor('issuerName', color);
        setWholeTextColor('issuerTitle', color);
    } else if (getTextStyleDefinition(currentSelectedKey)) {
        setWholeTextColor(currentSelectedKey, color);
    } else {
        showToast('กรุณาเลือกข้อความ หรือดับเบิลคลิกแล้วลากคลุมข้อความก่อนเปลี่ยนสี', 'warning');
    }
}

// Update text from sidebar inputs into canvas and config
function updateText(type, val, preserveFormatting = false) {
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

    if (!preserveFormatting && getTextStyleDefinition(type)) clearTextColorRanges(type);
    const definition = getTextStyleDefinition(type);
    const styledTarget = definition ? document.getElementById(definition.elementId) : null;
    if (styledTarget && styledTarget !== document.activeElement) renderStyledText(type);
    syncCertificateColorControls(type);
}

// ================= ROBUST INLINE DIRECT CANVAS EDITING (DOUBLE CLICK & BUTTON) ================= //
function startInlineEditing(targetTextEl) {
    if (!targetTextEl) return;
    const parentEl = targetTextEl.closest('.cert-element');
    if (!parentEl) return;

    const key = parentEl.getAttribute('data-key');
    if (key === 'logo' || key === 'signature') return;

    stopAllInlineEditing();
    selectElement(parentEl);
    currentEditingStyleType = getStyleTypeFromTextElement(targetTextEl);
    lastTextSelectionRange = null;

    parentEl.classList.add('is-editing');
    targetTextEl.setAttribute('contenteditable', 'true');
    targetTextEl.style.userSelect = 'text';
    targetTextEl.style.webkitUserSelect = 'text';

    updateFloatingToolbarPosition(parentEl);
    syncCertificateColorControls(currentEditingStyleType);

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
    currentEditingStyleType = null;
    lastTextSelectionRange = null;
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
                const styleType = getStyleTypeFromTextElement(innerText);
                if (styleType) clearTextColorRanges(styleType);
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
                const styleType = getStyleTypeFromTextElement(innerText);
                innerText.setAttribute('contenteditable', 'false');
                innerText.style.userSelect = '';
                innerText.style.webkitUserSelect = '';
                parentEl.classList.remove('is-editing');
                if (styleType) renderStyledText(styleType);
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
    const currentConfig = certConfig.elements_config || {};
    certConfig.elements_config = Object.fromEntries(
        Object.keys(defaultPositions).map(key => [key, { ...(currentConfig[key] || {}), ...defaultPositions[key] }])
    );
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
        suppressCanvasClickUntil = Date.now() + 250;

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
            minSize = mediaSizeLimits.logo.min;
            maxSize = mediaSizeLimits.logo.max;
            let newSize = Math.max(minSize, Math.min(maxSize, Math.round(startSize + avgDelta)));
            updateLogoSize(newSize);
            if (tooltip) tooltip.textContent = `ขนาด: ${newSize}px`;
            return;
        } else if (targetKey === 'signature') {
            minSize = mediaSizeLimits.signature.min;
            maxSize = mediaSizeLimits.signature.max;
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

function syncAllUIInputsToConfig() {
    const titleIn = document.getElementById('inputTitle');
    if (titleIn) certConfig.title = titleIn.value;
    const subIn = document.getElementById('inputSubtitle');
    if (subIn) certConfig.subtitle = subIn.value;
    const recIn = document.getElementById('inputRecipient');
    if (recIn) certConfig.recipient_name = recIn.value;
    const bodyIn = document.getElementById('inputBody');
    if (bodyIn) certConfig.body_text = bodyIn.value;
    const dateIn = document.getElementById('inputDate');
    if (dateIn) certConfig.issued_date = dateIn.value;
    const issuerNameIn = document.getElementById('inputIssuerName');
    if (issuerNameIn) certConfig.issuer_name = issuerNameIn.value;
    const issuerTitleIn = document.getElementById('inputIssuerTitle');
    if (issuerTitleIn) certConfig.issuer_title = issuerTitleIn.value;
    const enableToggle = document.getElementById('enableCertToggle');
    if (enableToggle) certConfig.is_enabled = enableToggle.checked ? 1 : 0;

    syncElementsConfigFromDOM();
}

function syncElementsConfigFromDOM() {
    if (!certConfig.elements_config) certConfig.elements_config = {};
    const keys = ['logo', 'title', 'subtitle', 'recipient', 'body', 'date', 'signature', 'issuer'];
    keys.forEach(key => {
        const el = document.getElementById(`el_${key}`);
        if (el) {
            const left = parseFloat(el.style.left) || (defaultPositions[key] ? defaultPositions[key].x : 50);
            const top = parseFloat(el.style.top) || (defaultPositions[key] ? defaultPositions[key].y : 50);
            let size = defaultPositions[key] ? defaultPositions[key].size : 20;

            if (key === 'logo') {
                const wrap = document.getElementById('logoWrapper');
                size = wrap ? (parseInt(wrap.style.width) || size) : size;
            } else if (key === 'signature') {
                const box = document.getElementById('signatureImgBox');
                size = box ? (parseInt(box.style.height) || size) : size;
            } else {
                size = parseInt(el.style.fontSize) || size;
            }

            certConfig.elements_config[key] = {
                ...(certConfig.elements_config[key] || {}),
                x: Math.round(left * 10) / 10,
                y: Math.round(top * 10) / 10,
                size: size
            };
        }
    });
}

// Save Certificate Configuration to Database
async function saveCertificateConfig() {
    if (!currentSurveyId) {
        showToast('กรุณาเลือกแบบประเมินก่อนบันทึก', 'error');
        return;
    }

    syncAllUIInputsToConfig();

    const payload = {
        survey_id: currentSurveyId,
        is_enabled: certConfig.is_enabled ? 1 : 0,
        title: certConfig.title || 'เกียรติบัตร',
        subtitle: certConfig.subtitle || 'มอบให้ไว้เพื่อแสดงว่า',
        recipient_name: certConfig.recipient_name || '{name}',
        body_text: certConfig.body_text || '',
        issued_date: certConfig.issued_date || '{date}',
        issuer_name: certConfig.issuer_name || '',
        issuer_title: certConfig.issuer_title || '',
        logo_url: certConfig.logo_url || '',
        signature_url: certConfig.signature_url || '',
        bg_image_url: certConfig.bg_image_url || '',
        bg_preset: certConfig.bg_preset || 'gold-luxury',
        elements_config: certConfig.elements_config || defaultPositions
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

// Export / Preview PDF (100% WYSIWYG Pixel-Perfect Match with on-screen editor)
async function previewCertificatePdf() {
    if (!currentSurveyId) {
        showToast('กรุณาเลือกแบบประเมินก่อนดาวน์โหลดตัวอย่าง', 'error');
        return;
    }

    syncAllUIInputsToConfig();
    selectElement(null);
    stopAllInlineEditing();

    const previewBtn = document.getElementById('previewCertBtn');
    const mobilePreviewBtn = document.getElementById('mobilePreviewCertBtn');
    setButtonLoading(previewBtn, true, 'กำลังสร้าง PDF...');
    setButtonLoading(mobilePreviewBtn, true, 'สร้าง PDF...');

    const certSheet = document.getElementById('certSheet');
    if (!certSheet) {
        setButtonLoading(previewBtn, false);
        setButtonLoading(mobilePreviewBtn, false);
        return;
    }

    // Create an offscreen wrapper container with top:0, left:0, opacity:0 to avoid negative coordinate calculation bugs in html2canvas
    const renderWrapper = document.createElement('div');
    renderWrapper.style.cssText = 'position: fixed; top: 0; left: 0; width: 840px; height: 594px; z-index: -9999; opacity: 0; pointer-events: none; overflow: hidden; margin: 0; padding: 0;';

    // Clone the exact visual certificate sheet currently on screen
    const clone = certSheet.cloneNode(true);
    clone.id = 'certSheetPdfClone';

    // Remove editor-only UI tools from clone
    const floatingBar = clone.querySelector('#elementFloatingBar');
    if (floatingBar) floatingBar.remove();
    const tooltip = clone.querySelector('#resizeTooltip');
    if (tooltip) tooltip.remove();

    clone.querySelectorAll('.resize-handle').forEach(h => h.remove());
    clone.querySelectorAll('.cert-element').forEach(el => {
        el.classList.remove('selected', 'is-editing');
        el.style.outline = 'none';
        el.style.boxShadow = 'none';
        el.style.cursor = 'default';
    });

    // Remove signature fallback placeholder if no signature uploaded
    const sigFallback = clone.querySelector('#signatureFallbackBox');
    const sigImg = clone.querySelector('#signatureImg');
    if (sigFallback && (!sigImg || !sigImg.src || sigImg.src.trim() === '' || sigImg.style.display === 'none')) {
        sigFallback.remove();
    }

    // Remove empty/hidden image tags so html2canvas doesn't fail on empty sources
    clone.querySelectorAll('img').forEach(img => {
        const s = img.getAttribute('src');
        if (!s || s.trim() === '' || s === '#' || img.style.display === 'none') {
            img.remove();
        }
    });

    // Reset zoom transform and enforce pristine unscaled 840x594 A4 Landscape aspect ratio
    clone.style.position = 'relative';
    clone.style.left = '0';
    clone.style.top = '0';
    clone.style.width = '840px';
    clone.style.height = '594px';
    clone.style.transform = 'none';
    clone.style.margin = '0';
    clone.style.boxShadow = 'none';
    clone.style.borderRadius = '0';

    renderWrapper.appendChild(clone);
    document.body.appendChild(renderWrapper);

    try {
        if (typeof html2canvas === 'undefined') {
            throw new Error('ไม่พบไลบรารี html2canvas ในระบบ');
        }

        // Wait for all web fonts to load completely
        if (document.fonts && document.fonts.ready) {
            await document.fonts.ready;
        }
        try {
            if (document.fonts && document.fonts.load) {
                await Promise.all([
                    document.fonts.load('700 34px "Prompt"'),
                    document.fonts.load('500 17px "Sarabun"'),
                    document.fonts.load('700 28px "Prompt"'),
                    document.fonts.load('400 15px "Sarabun"'),
                    document.fonts.load('600 15px "Sarabun"')
                ]);
            }
        } catch (fontErr) {
            console.warn('Font preload notice:', fontErr);
        }

        // Wait for all images in clone to finish loading
        const imgs = Array.from(clone.querySelectorAll('img'));
        await Promise.all(imgs.map(img => {
            if (img.complete) return Promise.resolve();
            return new Promise(resolve => {
                img.onload = resolve;
                img.onerror = resolve;
            });
        }));

        // Render at 300 DPI high-definition scale (840 * 3 = 2520px x 1782px)
        const canvas = await html2canvas(clone, {
            scale: 3,
            useCORS: true,
            allowTaint: true,
            logging: false,
            width: 840,
            height: 594,
            x: 0,
            y: 0,
            scrollX: 0,
            scrollY: 0,
            backgroundColor: '#FFFFFF',
            windowWidth: 840,
            windowHeight: 594
        });

        const imgData = canvas.toDataURL('image/png', 1.0);
        const jsPDFConstructor = (window.jspdf && window.jspdf.jsPDF) ? window.jspdf.jsPDF : (window.jsPDF || null);
        
        if (!jsPDFConstructor) {
            throw new Error('ไม่พบไลบรารี jsPDF ในระบบ');
        }

        const pdf = new jsPDFConstructor({
            orientation: 'landscape',
            unit: 'mm',
            format: 'a4',
            compress: true
        });

        // Exact 100% full bleed A4: 297mm x 210mm
        pdf.addImage(imgData, 'PNG', 0, 0, 297, 210, undefined, 'FAST');
        pdf.save(`Certificate_Preview_${currentSurveyId || 'survey'}.pdf`);

        if (document.body.contains(renderWrapper)) {
            document.body.removeChild(renderWrapper);
        }
        setButtonLoading(previewBtn, false);
        setButtonLoading(mobilePreviewBtn, false);
        showToast('ดาวน์โหลดไฟล์ PDF ตรงกับที่พรีวิว 100% สำเร็จ', 'success');
    } catch (err) {
        setButtonLoading(previewBtn, false);
        setButtonLoading(mobilePreviewBtn, false);
        console.error('PDF error:', err);
        if (document.body.contains(renderWrapper)) {
            document.body.removeChild(renderWrapper);
        }
        showToast('เกิดข้อผิดพลาดในการสร้างไฟล์ PDF: ' + (err.message || ''), 'error');
    }
}

function getSampleThaiDate() {
    const now = new Date();
    const thaiMonths = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน',
                       'กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
    const date = now.getDate();
    const month = thaiMonths[now.getMonth()];
    const year = now.getFullYear() + 543;
    return `${date} ${month} พ.ศ. ${year}`;
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
