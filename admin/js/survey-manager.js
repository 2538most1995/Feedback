// Survey Manager JS - Full Interactive Visual Builder & API Sync

let currentSurveyId = null;
let sectionSeq = 0;
let questionSeq = 0;

document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    setupDropZone();

    const urlParams = new URLSearchParams(window.location.search);
    const id = urlParams.get('id');
    const isImport = urlParams.get('import') === '1';

    if (id) {
        currentSurveyId = parseInt(id);
        document.getElementById('pageTitle').textContent = `แก้ไขแบบประเมิน`;
        loadSurveyData(currentSurveyId);
    } else if (isImport) {
        document.getElementById('pageTitle').textContent = `สร้างแบบประเมินจากการนำเข้า`;
        const rawImport = sessionStorage.getItem('imported_survey_template');
        if (rawImport) {
            try {
                const importedData = JSON.parse(rawImport);
                loadSurveyFromObject(importedData);
                sessionStorage.removeItem('imported_survey_template');
                showToast('นำเข้าข้อมูลแบบประเมินลงในฟอร์มสำเร็จ', 'success');
            } catch (err) {
                console.error('Failed to parse imported survey:', err);
                initDefaultTemplate();
            }
        } else {
            initDefaultTemplate();
        }
    } else {
        document.getElementById('pageTitle').textContent = `สร้างแบบประเมินใหม่`;
        initDefaultTemplate();
    }

    // Setup live inline validation
    const titleInput = document.getElementById('surveyTitle');
    if (titleInput) {
        titleInput.addEventListener('input', () => {
            if (titleInput.value.trim().length > 0) {
                markFieldValid(titleInput);
            } else {
                showFieldError(titleInput, 'กรุณากรอกชื่อแบบประเมิน');
            }
        });
    }

    const catInput = document.getElementById('surveyCategory');
    if (catInput) {
        catInput.addEventListener('input', () => {
            if (catInput.value.trim().length > 0) {
                markFieldValid(catInput);
            } else {
                showFieldError(catInput, 'กรุณาระบุหมวดหมู่');
            }
        });
    }
});

function loadSurveyFromObject(survey) {
    if (!survey) return;
    document.getElementById('surveyTitle').value = survey.title || '';
    document.getElementById('surveyDesc').value = survey.description || '';
    document.getElementById('surveyCategory').value = survey.category || 'บริการทั่วไป';
    document.getElementById('surveyStatus').value = survey.status || 'draft';

    const container = document.getElementById('sectionsContainer');
    container.innerHTML = '';
    const sections = survey.sections || [];
    if (sections.length === 0) {
        addSection();
    } else {
        sections.forEach(sec => {
            addSection(sec);
        });
    }
}

function initDefaultTemplate() {
    // Default section 1: Demographics
    addSection({
        title: 'ส่วนที่ 1: ข้อมูลทั่วไปของผู้ตอบแบบประเมิน',
        section_type: 'demographic',
        questions: [
            { question_text: 'เพศ', question_type: 'radio', options: ['ชาย', 'หญิง', 'อื่นๆ / ไม่ระบุ'], is_required: 1 },
            { question_text: 'อายุ', question_type: 'radio', options: ['ต่ำกว่า 20 ปี', '20-30 ปี', '31-40 ปี', '41-50 ปี', '50 ปีขึ้นไป'], is_required: 1 }
        ]
    });

    // Default section 2: Ratings
    addSection({
        title: 'ส่วนที่ 2: ความพึงพอใจต่อการให้บริการ',
        section_type: 'rating',
        questions: [
            { question_text: 'ความสุภาพและกระตือรือร้นในการให้บริการของเจ้าหน้าที่', question_type: 'rating', is_required: 1 },
            { question_text: 'ความถูกต้อง รวดเร็ว และตรงตามกำหนดเวลา', question_type: 'rating', is_required: 1 },
            { question_text: 'ความสะดวกสบายของสถานที่และสิ่งอำนวยความสะดวก', question_type: 'rating', is_required: 1 },
            { question_text: 'ภาพรวมความพึงพอใจต่อการใช้บริการในครั้งนี้', question_type: 'rating', is_required: 1 }
        ]
    });

    // Default section 3: Comments
    addSection({
        title: 'ส่วนที่ 3: ข้อคิดเห็นและข้อเสนอแนะ',
        section_type: 'text',
        questions: [
            { question_text: 'ข้อเสนอแนะเพิ่มเติมเพื่อการปรับปรุงและพัฒนาการให้บริการ', question_type: 'text', is_required: 0 }
        ]
    });
}

async function loadSurveyData(id) {
    const container = document.getElementById('sectionsContainer');
    container.innerHTML = `
        <div style="text-align: center; padding: 3rem; color: var(--text-light);">
            <i class="fas fa-spinner fa-spin fa-2x" style="color: var(--primary); margin-bottom: 1rem; display:block;"></i>
            กำลังโหลดข้อมูลแบบประเมิน...
        </div>`;

    try {
        const res = await api(`../api/surveys.php?id=${id}`);
        if (!res || !res.success || !res.data) {
            showToast('ไม่สามารถโหลดข้อมูลแบบประเมินได้', 'error');
            return;
        }

        const survey = res.data;
        document.getElementById('surveyTitle').value = survey.title || '';
        document.getElementById('surveyDesc').value = survey.description || '';
        document.getElementById('surveyCategory').value = survey.category || 'บริการทั่วไป';
        document.getElementById('surveyStatus').value = survey.status || 'draft';

        const qrBtn = document.getElementById('qrBtn');
        if (qrBtn) qrBtn.style.display = 'inline-flex';

        container.innerHTML = '';
        const sections = survey.sections || [];
        if (sections.length === 0) {
            addSection();
        } else {
            sections.forEach(sec => {
                addSection(sec);
            });
        }
    } catch (err) {
        console.error('Error loading survey:', err);
        showToast('เกิดข้อผิดพลาดในการโหลดข้อมูลแบบประเมิน', 'error');
    }
}

function addSection(data = null) {
    sectionSeq++;
    const secId = sectionSeq;
    const container = document.getElementById('sectionsContainer');

    const title = data ? data.title : `ส่วนที่ ${container.querySelectorAll('.section-card').length + 1}: การประเมิน`;
    const secType = data ? (data.section_type || 'rating') : 'rating';

    const secHtml = `
        <div class="section-card animate-slide-up" id="section_${secId}">
            <div class="section-header">
                <div style="display: flex; gap: 10px; align-items: center; flex: 1; min-width: 280px;">
                    <i class="fas fa-layer-group" style="color: var(--primary); font-size: 1.1rem;"></i>
                    <input type="text" class="form-control section-title-input" placeholder="ชื่อส่วนประเมิน เช่น ส่วนที่ 1: ข้อมูลทั่วไป" value="${escapeHtmlAttr(title)}">
                    <select class="form-control section-type-select" style="width: 170px;" onchange="onSectionTypeChange(${secId}, this.value)">
                        <option value="rating" ${secType === 'rating' ? 'selected' : ''}>การให้คะแนน (Rating)</option>
                        <option value="demographic" ${secType === 'demographic' ? 'selected' : ''}>ข้อมูลทั่วไป (Choice/Text)</option>
                        <option value="text" ${secType === 'text' ? 'selected' : ''}>ข้อคิดเห็น (Text Only)</option>
                    </select>
                </div>
                <div class="section-action-btns">
                    <button type="button" class="btn-icon" title="ย้ายขึ้น" onclick="moveSection(${secId}, -1)"><i class="fas fa-arrow-up"></i></button>
                    <button type="button" class="btn-icon" title="ย้ายลง" onclick="moveSection(${secId}, 1)"><i class="fas fa-arrow-down"></i></button>
                    <button type="button" class="btn-icon text-error" title="ลบส่วนนี้" onclick="removeSection(${secId})"><i class="fas fa-trash-alt" style="color:var(--error);"></i></button>
                </div>
            </div>
            <div class="questions-list" id="questions_sec_${secId}">
                <!-- Questions injected here -->
            </div>
            <div style="margin-top: 14px; display: flex; gap: 8px;">
                <button type="button" class="btn btn-outline" style="font-size: 0.85rem; padding: 8px 14px;" onclick="addQuestion(${secId})">
                    <i class="fas fa-plus"></i> เพิ่มคำถามในส่วนนี้
                </button>
            </div>
        </div>
    `;

    container.insertAdjacentHTML('beforeend', secHtml);

    if (data && data.questions && data.questions.length > 0) {
        data.questions.forEach(q => addQuestion(secId, q));
    } else {
        // Add default question
        addQuestion(secId, { question_type: secType === 'text' ? 'text' : (secType === 'demographic' ? 'radio' : 'rating') });
    }
}

function removeSection(secId) {
    const totalSections = document.querySelectorAll('.section-card').length;
    if (totalSections <= 1) {
        showToast('ต้องมีอย่างน้อย 1 ส่วนประเมินในแบบประเมิน', 'warning');
        return;
    }

    const el = document.getElementById(`section_${secId}`);
    if (el) el.remove();
}

function moveSection(secId, direction) {
    const el = document.getElementById(`section_${secId}`);
    if (!el) return;

    if (direction === -1 && el.previousElementSibling) {
        el.parentNode.insertBefore(el, el.previousElementSibling);
    } else if (direction === 1 && el.nextElementSibling) {
        el.parentNode.insertBefore(el.nextElementSibling, el);
    }
}

function onSectionTypeChange(secId, newType) {
    // If section changes to text, suggest text type for new questions
}

function addQuestion(secId, qData = null) {
    questionSeq++;
    const qId = questionSeq;
    const questionsContainer = document.getElementById(`questions_sec_${secId}`);
    if (!questionsContainer) return;

    const qText = qData ? qData.question_text || '' : '';
    const qType = qData ? qData.question_type || 'rating' : 'rating';
    const isReq = qData ? (qData.is_required !== 0 && qData.is_required !== false) : true;
    const options = qData && Array.isArray(qData.options) ? qData.options : (qType === 'radio' || qType === 'checkbox' ? ['ตัวเลือกที่ 1', 'ตัวเลือกที่ 2'] : []);

    const qHtml = `
        <div class="question-card" id="q_${qId}">
            <div class="question-num">#</div>
            <div class="question-content">
                <div class="question-row">
                    <input type="text" class="form-control question-input" placeholder="ระบุข้อคำถาม เช่น ความพึงพอใจต่อ..." value="${escapeHtmlAttr(qText)}">
                    <select class="form-control question-type-select" onchange="onQuestionTypeChange(${qId}, this.value)">
                        <option value="rating" ${qType === 'rating' ? 'selected' : ''}>⭐️ คะแนน 1-5 (Rating)</option>
                        <option value="radio" ${qType === 'radio' ? 'selected' : ''}>🔘 ตัวเลือกเดี่ยว (Radio)</option>
                        <option value="checkbox" ${qType === 'checkbox' ? 'selected' : ''}>☑️ หลายตัวเลือก (Checkbox)</option>
                        <option value="text" ${qType === 'text' ? 'selected' : ''}>💬 ข้อความเสรี (Text)</option>
                    </select>
                </div>

                <!-- Rating Preview -->
                <div class="rating-preview-box" id="rating_preview_${qId}" style="${qType === 'rating' ? '' : 'display:none;'}">
                    <span>มาตราส่วน 5 ระดับ:</span>
                    <span class="rating-preview-badge">5: มากที่สุด</span>
                    <span class="rating-preview-badge">4: มาก</span>
                    <span class="rating-preview-badge">3: ปานกลาง</span>
                    <span class="rating-preview-badge">2: น้อย</span>
                    <span class="rating-preview-badge">1: น้อยที่สุด</span>
                </div>

                <!-- Choice Options Area -->
                <div class="options-container" id="options_container_${qId}" style="${(qType === 'radio' || qType === 'checkbox') ? '' : 'display:none;'}">
                    <div style="font-size: 0.85rem; font-weight: 600; color: var(--text); margin-bottom: 8px;">
                        <i class="fas fa-list-ul"></i> ตัวเลือกคำตอบ:
                    </div>
                    <div class="options-list" id="options_list_${qId}">
                        <!-- Options rendered here -->
                    </div>
                    <div style="display: flex; gap: 8px; margin-top: 8px;">
                        <button type="button" class="btn btn-outline" style="font-size: 0.75rem; padding: 4px 10px;" onclick="addOptionItem(${qId}, '')">
                            <i class="fas fa-plus"></i> เพิ่มตัวเลือก
                        </button>
                    </div>
                </div>

                <div style="display:flex; align-items:center; justify-content: space-between; margin-top: 10px;">
                    <label style="display:flex; align-items:center; gap: 6px; font-size: 0.85rem; cursor: pointer; user-select: none;">
                        <input type="checkbox" class="q-req-checkbox" ${isReq ? 'checked' : ''}>
                        <span>จำเป็นต้องตอบ (Required)</span>
                    </label>
                </div>
            </div>
            <div class="question-actions">
                <button type="button" class="btn-icon" title="ย้ายขึ้น" onclick="moveQuestion(${qId}, -1)"><i class="fas fa-chevron-up"></i></button>
                <button type="button" class="btn-icon" title="ย้ายลง" onclick="moveQuestion(${qId}, 1)"><i class="fas fa-chevron-down"></i></button>
                <button type="button" class="btn-icon text-error" title="ลบคำถาม" onclick="removeQuestion(${qId})"><i class="fas fa-times" style="color:var(--error);"></i></button>
            </div>
        </div>
    `;

    questionsContainer.insertAdjacentHTML('beforeend', qHtml);

    // Populate initial options if radio or checkbox
    if (qType === 'radio' || qType === 'checkbox') {
        if (options.length === 0) {
            addOptionItem(qId, 'ตัวเลือกที่ 1');
            addOptionItem(qId, 'ตัวเลือกที่ 2');
        } else {
            options.forEach(opt => addOptionItem(qId, opt));
        }
    }

    renumberQuestions(secId);
}

function onQuestionTypeChange(qId, newType) {
    const ratingBox = document.getElementById(`rating_preview_${qId}`);
    const optionsBox = document.getElementById(`options_container_${qId}`);
    const optionsList = document.getElementById(`options_list_${qId}`);

    if (newType === 'rating') {
        if (ratingBox) ratingBox.style.display = 'flex';
        if (optionsBox) optionsBox.style.display = 'none';
    } else if (newType === 'radio' || newType === 'checkbox') {
        if (ratingBox) ratingBox.style.display = 'none';
        if (optionsBox) optionsBox.style.display = 'block';
        if (optionsList && optionsList.children.length === 0) {
            addOptionItem(qId, 'ตัวเลือกที่ 1');
            addOptionItem(qId, 'ตัวเลือกที่ 2');
        }
    } else {
        if (ratingBox) ratingBox.style.display = 'none';
        if (optionsBox) optionsBox.style.display = 'none';
    }
}

function addOptionItem(qId, textValue = '') {
    const list = document.getElementById(`options_list_${qId}`);
    if (!list) return;

    const optIndex = list.children.length + 1;
    const optHtml = `
        <div class="option-item">
            <span class="option-bullet"><i class="far fa-circle"></i></span>
            <input type="text" class="form-control option-text-input" placeholder="ตัวเลือกที่ ${optIndex}" value="${escapeHtmlAttr(textValue)}" style="font-size: 0.875rem; padding: 6px 10px;">
            <button type="button" class="btn-icon text-error" style="width:28px; height:28px; border:none;" onclick="this.closest('.option-item').remove()" title="ลบตัวเลือก">
                <i class="fas fa-trash-alt" style="font-size: 0.75rem;"></i>
            </button>
        </div>
    `;
    list.insertAdjacentHTML('beforeend', optHtml);
}

function removeQuestion(qId) {
    const qEl = document.getElementById(`q_${qId}`);
    if (!qEl) return;
    const secEl = qEl.closest('.section-card');
    qEl.remove();
    if (secEl) {
        const secId = secEl.id.replace('section_', '');
        renumberQuestions(secId);
    }
}

function moveQuestion(qId, direction) {
    const el = document.getElementById(`q_${qId}`);
    if (!el) return;

    if (direction === -1 && el.previousElementSibling) {
        el.parentNode.insertBefore(el, el.previousElementSibling);
    } else if (direction === 1 && el.nextElementSibling) {
        el.parentNode.insertBefore(el.nextElementSibling, el);
    }

    const secEl = el.closest('.section-card');
    if (secEl) {
        const secId = secEl.id.replace('section_', '');
        renumberQuestions(secId);
    }
}

function renumberQuestions(secId) {
    const secEl = document.getElementById(`section_${secId}`);
    if (!secEl) return;
    const qCards = secEl.querySelectorAll('.question-card');
    qCards.forEach((q, idx) => {
        const numEl = q.querySelector('.question-num');
        if (numEl) numEl.textContent = `${idx + 1}`;
    });
}

function collectSurveyPayload(status) {
    const titleInput = document.getElementById('surveyTitle');
    const title = (titleInput.value || '').trim();
    if (!title) {
        showFieldError(titleInput, 'กรุณาระบุชื่อแบบประเมิน');
        titleInput.focus();
        titleInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
        showToast('กรุณาระบุชื่อแบบประเมินให้ครบถ้วน', 'warning');
        return null;
    } else {
        markFieldValid(titleInput);
    }

    const catInput = document.getElementById('surveyCategory');
    const category = (catInput.value || 'บริการทั่วไป').trim();
    if (!category) {
        showFieldError(catInput, 'กรุณาระบุหมวดหมู่');
        catInput.focus();
        showToast('กรุณาระบุหมวดหมู่แบบประเมิน', 'warning');
        return null;
    } else {
        markFieldValid(catInput);
    }

    const desc = (document.getElementById('surveyDesc').value || '').trim();
    const currentStatus = status || document.getElementById('surveyStatus').value || 'draft';

    const sectionEls = document.querySelectorAll('.section-card');
    if (sectionEls.length === 0) {
        showToast('กรุณาเพิ่มอย่างน้อย 1 ส่วนประเมิน', 'warning');
        return null;
    }

    const sections = [];

    for (let sIdx = 0; sIdx < sectionEls.length; sIdx++) {
        const secEl = sectionEls[sIdx];
        const secTitle = (secEl.querySelector('.section-title-input').value || '').trim() || `ส่วนที่ ${sIdx + 1}`;
        const secType = secEl.querySelector('.section-type-select').value || 'rating';

        const qCards = secEl.querySelectorAll('.question-card');
        const questions = [];

        for (let qIdx = 0; qIdx < qCards.length; qIdx++) {
            const qCard = qCards[qIdx];
            const qInput = qCard.querySelector('.question-input');
            const qText = (qInput.value || '').trim();
            if (!qText) {
                showFieldError(qInput, 'กรุณาระบุข้อความคำถาม');
                qInput.focus();
                showToast('กรุณาระบุข้อความคำถามในแบบประเมินให้ครบถ้วน', 'warning');
                return null;
            } else {
                markFieldValid(qInput);
            }

            const qType = qCard.querySelector('.question-type-select').value || 'rating';
            const isReq = qCard.querySelector('.q-req-checkbox').checked ? 1 : 0;

            let options = [];
            if (qType === 'radio' || qType === 'checkbox') {
                const optInputs = qCard.querySelectorAll('.option-text-input');
                optInputs.forEach(opt => {
                    const optVal = (opt.value || '').trim();
                    if (optVal) options.push(optVal);
                });
                if (options.length === 0) {
                    options = ['ใช่', 'ไม่ใช่'];
                }
            }

            questions.push({
                question_text: qText,
                question_type: qType,
                options: options,
                is_required: isReq,
                sort_order: qIdx + 1
            });
        }

        sections.push({
            title: secTitle,
            section_type: secType,
            sort_order: sIdx + 1,
            questions: questions
        });
    }

    return {
        id: currentSurveyId,
        title: title,
        description: desc,
        category: category,
        status: currentStatus,
        sections: sections
    };
}

async function saveSurvey(status) {
    const payload = collectSurveyPayload(status);
    if (!payload) return;

    const isEdit = !!currentSurveyId;
    const method = isEdit ? 'PUT' : 'POST';

    const saveDraftBtn = document.getElementById('saveDraftBtn');
    const savePublishBtn = document.getElementById('savePublishBtn');
    const mobileDraftBtn = document.getElementById('mobileSaveDraftBtn');
    const mobilePublishBtn = document.getElementById('mobileSavePublishBtn');
    
    const targetBtn = status === 'published' ? savePublishBtn : saveDraftBtn;
    const targetMobileBtn = status === 'published' ? mobilePublishBtn : mobileDraftBtn;
    const loadingText = status === 'published' ? 'กำลังเผยแพร่...' : 'กำลังบันทึกร่าง...';

    setButtonLoading(targetBtn, true, loadingText);
    setButtonLoading(targetMobileBtn, true, loadingText);

    try {
        const res = await api('../api/surveys.php', method, payload);
        
        setButtonLoading(targetBtn, false);
        setButtonLoading(targetMobileBtn, false);

        if (res && res.success) {
            const newId = res.data && res.data.id ? res.data.id : currentSurveyId;
            currentSurveyId = newId;
            
            showToast(status === 'published' ? 'บันทึกและเผยแพร่แบบประเมินสำเร็จ!' : 'บันทึกแบบร่างสำเร็จ!', 'success');
            
            setTimeout(() => {
                window.location.href = 'surveys.html';
            }, 1000);
        } else {
            showToast(res ? res.message : 'เกิดข้อผิดพลาดในการบันทึกแบบประเมิน', 'error');
        }
    } catch (err) {
        setButtonLoading(targetBtn, false);
        setButtonLoading(targetMobileBtn, false);
        console.error('Save survey error:', err);
        showToast('เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์', 'error');
    }
}

async function previewCurrentSurvey() {
    if (currentSurveyId) {
        // Open survey in preview mode
        window.open(`../survey.html?id=${currentSurveyId}&preview=1`, '_blank');
    } else {
        // Auto-save as draft first so we have an ID to preview
        const payload = collectSurveyPayload('draft');
        if (!payload) return;

        showToast('กำลังบันทึกแบบร่างเพื่อเปิดตัวอย่าง...', 'info');
        try {
            const res = await api('../api/surveys.php', 'POST', payload);
            if (res && res.success && res.data && res.data.id) {
                currentSurveyId = res.data.id;
                // Update history without reloading
                const newUrl = `${window.location.pathname}?id=${currentSurveyId}`;
                window.history.replaceState({ path: newUrl }, '', newUrl);
                document.getElementById('pageTitle').textContent = `แก้ไขแบบประเมิน`;
                window.open(`../survey.html?id=${currentSurveyId}&preview=1`, '_blank');
            } else {
                showToast(res ? res.message : 'ไม่สามารถเปิดตัวอย่างได้', 'error');
            }
        } catch (err) {
            console.error('Preview error:', err);
            showToast('เกิดข้อผิดพลาดในการเตรียมตัวอย่างแบบประเมิน', 'error');
        }
    }
}

async function openQrModalForCurrentSurvey() {
    if (!currentSurveyId) {
        // Auto-save as draft first
        const payload = collectSurveyPayload('draft');
        if (!payload) return;

        showToast('กำลังบันทึกแบบร่างเพื่อสร้าง QR Code...', 'info');
        try {
            const res = await api('../api/surveys.php', 'POST', payload);
            if (res && res.success && res.data && res.data.id) {
                currentSurveyId = res.data.id;
                const newUrl = `${window.location.pathname}?id=${currentSurveyId}`;
                window.history.replaceState({ path: newUrl }, '', newUrl);
                document.getElementById('pageTitle').textContent = `แก้ไขแบบประเมิน`;
                const qrBtn = document.getElementById('qrBtn');
                if (qrBtn) qrBtn.style.display = 'inline-flex';
            } else {
                showToast(res ? res.message : 'ไม่สามารถสร้าง QR Code ได้', 'error');
                return;
            }
        } catch (err) {
            console.error('QR error:', err);
            return;
        }
    }

    const title = (document.getElementById('surveyTitle').value || '').trim() || `แบบประเมิน #${currentSurveyId}`;
    const baseUrl = window.location.origin + window.location.pathname.replace(/\/admin\/.*$/, '');
    const surveyUrl = `${baseUrl}/survey.html?id=${currentSurveyId}`;

    document.getElementById('qrSurveyTitle').textContent = title;
    document.getElementById('qrSurveyUrl').textContent = surveyUrl;

    const qrContainer = document.getElementById('qrCodeContainer');
    qrContainer.innerHTML = '';

    if (typeof QRCode !== 'undefined') {
        new QRCode(qrContainer, {
            text: surveyUrl,
            width: 220,
            height: 220,
            colorDark: "#1E293B",
            colorLight: "#FFFFFF",
            correctLevel: QRCode.CorrectLevel.H
        });
    } else {
        const img = document.createElement('img');
        img.src = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(surveyUrl)}`;
        img.alt = 'QR Code';
        img.style.width = '220px';
        img.style.height = '220px';
        qrContainer.appendChild(img);
    }

    document.getElementById('qrModal').classList.add('active');
}

function downloadQrCode() {
    const title = (document.getElementById('surveyTitle').value || '').trim() || `survey_${currentSurveyId}`;
    const qrContainer = document.getElementById('qrCodeContainer');
    const canvas = qrContainer.querySelector('canvas');
    const img = qrContainer.querySelector('img');

    let dataUrl = '';
    if (canvas) {
        dataUrl = canvas.toDataURL('image/png');
    } else if (img && img.src.startsWith('data:')) {
        dataUrl = img.src;
    } else if (img) {
        dataUrl = img.src;
    }

    if (dataUrl) {
        const link = document.createElement('a');
        link.download = `QRCode_${title.replace(/[^a-zA-Z0-9ก-๙]/g, '_')}.png`;
        link.href = dataUrl;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast('ดาวน์โหลด QR Code สำเร็จ', 'success');
    } else {
        showToast('ไม่สามารถดาวน์โหลดภาพได้', 'error');
    }
}

function printQrCode() {
    const title = (document.getElementById('surveyTitle').value || '').trim() || `แบบประเมิน #${currentSurveyId}`;
    const baseUrl = window.location.origin + window.location.pathname.replace(/\/admin\/.*$/, '');
    const surveyUrl = `${baseUrl}/survey.html?id=${currentSurveyId}`;

    const qrContainer = document.getElementById('qrCodeContainer');
    const canvas = qrContainer.querySelector('canvas');
    const img = qrContainer.querySelector('img');
    let imgSrc = '';
    if (canvas) {
        imgSrc = canvas.toDataURL('image/png');
    } else if (img) {
        imgSrc = img.src;
    }

    const printWindow = window.open('', '_blank', 'width=620,height=750');
    printWindow.document.write(`
        <!DOCTYPE html>
        <html lang="th">
        <head>
            <meta charset="UTF-8">
            <title>พิมพ์ QR Code - ${escapeHtmlAttr(title)}</title>
            <link href="https://fonts.googleapis.com/css2?family=Prompt:wght@400;600;700&display=swap" rel="stylesheet">
            <style>
                body {
                    font-family: 'Prompt', sans-serif;
                    text-align: center;
                    padding: 40px 20px;
                    color: #1E293B;
                    background: white;
                }
                .print-card {
                    max-width: 440px;
                    margin: 0 auto;
                    border: 3px solid #4F46E5;
                    border-radius: 20px;
                    padding: 36px 28px;
                    box-shadow: 0 4px 20px rgba(0,0,0,0.06);
                }
                .badge-tag {
                    background: #EEF2FF;
                    color: #4F46E5;
                    padding: 4px 14px;
                    border-radius: 999px;
                    font-size: 13px;
                    font-weight: 600;
                    display: inline-block;
                    margin-bottom: 12px;
                }
                h1 {
                    font-size: 22px;
                    font-weight: 700;
                    color: #1E293B;
                    margin-bottom: 8px;
                    line-height: 1.3;
                }
                p.sub {
                    font-size: 14px;
                    color: #64748B;
                    margin-bottom: 24px;
                    line-height: 1.4;
                }
                .qr-box {
                    padding: 16px;
                    border: 2px dashed #CBD5E1;
                    border-radius: 16px;
                    display: inline-block;
                    margin: 0 auto 20px auto;
                    background: #F8FAFC;
                }
                img {
                    width: 230px;
                    height: 230px;
                    display: block;
                }
                .cta-text {
                    font-size: 15px;
                    font-weight: 600;
                    color: #059669;
                    margin-bottom: 10px;
                }
                .url-text {
                    font-size: 11px;
                    color: #94A3B8;
                    word-break: break-all;
                    font-family: monospace;
                }
                @media print {
                    body { padding: 0; }
                    .print-card { border: 2px solid #000; box-shadow: none; }
                }
            </style>
        </head>
        <body>
            <div class="print-card">
                <div class="badge-tag">แบบประเมินความพึงพอใจ</div>
                <h1>${escapeHtmlAttr(title)}</h1>
                <p class="sub">ขอความอนุเคราะห์ตอบแบบประเมินเพื่อนำข้อมูลไปพัฒนาการให้บริการ</p>
                <div class="qr-box">
                    <img src="${imgSrc}" alt="QR Code">
                </div>
                <div class="cta-text">📷 สแกน QR Code ด้วยกล้องมือถือเพื่อทำแบบประเมิน</div>
                <div class="url-text">${escapeHtmlAttr(surveyUrl)}</div>
            </div>
            <script>
                window.onload = function() {
                    setTimeout(function() {
                        window.print();
                    }, 300);
                };
            <\/script>
        </body>
        </html>
    `);
    printWindow.document.close();
}

function copyQrLink() {
    const baseUrl = window.location.origin + window.location.pathname.replace(/\/admin\/.*$/, '');
    const surveyUrl = `${baseUrl}/survey.html?id=${currentSurveyId}`;
    navigator.clipboard.writeText(surveyUrl).then(() => {
        showToast('คัดลอกลิงก์สำเร็จ: ' + surveyUrl, 'success');
    }).catch(() => {
        prompt('คัดลอกลิงก์แบบประเมินด้านล่างนี้:', surveyUrl);
    });
}

function closeModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.classList.remove('active');
}

// ================= IMPORT SURVEY SYSTEM FOR EDITOR ================= //
let parsedImportSurvey = null;
let activeImportTab = 'excel';

function openImportModalInEditor() {
    parsedImportSurvey = null;
    const excelFile = document.getElementById('excelFileInput');
    if (excelFile) excelFile.value = '';
    const excelName = document.getElementById('excelFileName');
    if (excelName) excelName.textContent = 'คลิกเลือกไฟล์ หรือลากไฟล์มาวางที่นี่';
    const jsonFile = document.getElementById('jsonFileInput');
    if (jsonFile) jsonFile.value = '';
    const jsonText = document.getElementById('jsonTextInput');
    if (jsonText) jsonText.value = '';
    const previewBox = document.getElementById('importPreviewBox');
    if (previewBox) previewBox.style.display = 'none';
    const confirmBtn = document.getElementById('confirmImportInEditorBtn');
    if (confirmBtn) confirmBtn.disabled = true;

    switchImportTab('excel');
    const modal = document.getElementById('importModal');
    if (modal) modal.classList.add('active');
}

function switchImportTab(tab) {
    activeImportTab = tab;
    const btnExcel = document.getElementById('tabBtnExcel');
    const btnJson = document.getElementById('tabBtnJson');
    const contentExcel = document.getElementById('tabContentExcel');
    const contentJson = document.getElementById('tabContentJson');

    if (btnExcel && btnJson && contentExcel && contentJson) {
        if (tab === 'excel') {
            btnExcel.classList.add('active');
            btnJson.classList.remove('active');
            contentExcel.style.display = 'block';
            contentJson.style.display = 'none';
        } else {
            btnJson.classList.add('active');
            btnExcel.classList.remove('active');
            contentJson.style.display = 'block';
            contentExcel.style.display = 'none';
        }
    }
    updateImportButtonState();
}

function setupDropZone() {
    const dropZone = document.getElementById('excelDropZone');
    if (!dropZone) return;

    ['dragenter', 'dragover'].forEach(name => {
        dropZone.addEventListener(name, (e) => {
            e.preventDefault();
            dropZone.classList.add('dragover');
        });
    });

    ['dragleave', 'drop'].forEach(name => {
        dropZone.addEventListener(name, (e) => {
            e.preventDefault();
            dropZone.classList.remove('dragover');
        });
    });

    dropZone.addEventListener('drop', (e) => {
        const files = e.dataTransfer.files;
        if (files && files.length > 0) {
            processExcelFile(files[0]);
        }
    });
}

function handleExcelFileSelect(e) {
    const file = e.target.files[0];
    if (file) {
        processExcelFile(file);
    }
}

function processExcelFile(file) {
    const nameEl = document.getElementById('excelFileName');
    if (nameEl) nameEl.textContent = file.name;

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            const rows = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

            if (!rows || rows.length === 0) {
                showToast('ไฟล์ Excel ไม่มีข้อมูลแถวคำถาม', 'error');
                return;
            }

            parseExcelRows(rows, file.name);
        } catch (err) {
            console.error('Excel parse error:', err);
            showToast('ไม่สามารถอ่านไฟล์ Excel ได้ ตรวจสอบรูปแบบไฟล์', 'error');
        }
    };
    reader.readAsArrayBuffer(file);
}

function parseExcelRows(rows, fileName = '') {
    const sectionsMap = new Map();
    let currentSecTitle = 'ส่วนที่ 1: การประเมิน';

    rows.forEach((row) => {
        const secTitle = (row['ส่วนประเมิน'] || row['ส่วนที่'] || row['Section'] || row['หมวด'] || '').trim();
        const secType = (row['ประเภทส่วนประเมิน'] || row['Section Type'] || '').toLowerCase().trim();
        const qText = (row['ข้อคำถาม'] || row['คำถาม'] || row['Question'] || row['รายการ'] || '').trim();
        const qType = (row['ประเภทคำถาม'] || row['Question Type'] || row['ประเภท'] || 'rating').toLowerCase().trim();
        const optionsRaw = (row['ตัวเลือกคำตอบ'] || row['ตัวเลือก'] || row['Options'] || '').toString().trim();
        const reqRaw = (row['จำเป็นต้องตอบ'] || row['Required'] || row['จำเป็น'] || '1').toString().trim();

        if (secTitle) {
            currentSecTitle = secTitle;
        }

        if (!qText) return;

        if (!sectionsMap.has(currentSecTitle)) {
            let detectedSecType = 'rating';
            if (secType) {
                detectedSecType = secType;
            } else if (currentSecTitle.includes('ข้อมูลทั่วไป') || currentSecTitle.toLowerCase().includes('demographic')) {
                detectedSecType = 'demographic';
            } else if (currentSecTitle.includes('ข้อเสนอแนะ') || currentSecTitle.includes('ความคิดเห็น')) {
                detectedSecType = 'text';
            }

            sectionsMap.set(currentSecTitle, {
                title: currentSecTitle,
                section_type: detectedSecType,
                questions: []
            });
        }

        let normalizedQType = 'rating';
        if (qType.includes('radio') || qType.includes('เลือกตอบ') || qType.includes('ตัวเลือกเดียว')) {
            normalizedQType = 'radio';
        } else if (qType.includes('check') || qType.includes('หลายตัวเลือก')) {
            normalizedQType = 'checkbox';
        } else if (qType.includes('text') || qType.includes('ข้อความ') || qType.includes('เขียนตอบ')) {
            normalizedQType = 'text';
        } else if (qType.includes('rating') || qType.includes('ระดับ') || qType.includes('คะแนน') || qType.includes('พึงพอใจ')) {
            normalizedQType = 'rating';
        }

        let options = [];
        if (optionsRaw) {
            options = optionsRaw.split(/[,;\n|]/).map(o => o.trim()).filter(o => o.length > 0);
        }
        if ((normalizedQType === 'radio' || normalizedQType === 'checkbox') && options.length === 0) {
            options = ['ตัวเลือกที่ 1', 'ตัวเลือกที่ 2'];
        }

        const isRequired = (reqRaw === '1' || reqRaw === 'ใช่' || reqRaw.toLowerCase() === 'yes' || reqRaw.toLowerCase() === 'true') ? 1 : 0;

        sectionsMap.get(currentSecTitle).questions.push({
            question_text: qText,
            question_type: normalizedQType,
            options: options,
            is_required: isRequired
        });
    });

    const sections = Array.from(sectionsMap.values()).filter(s => s.questions.length > 0);
    if (sections.length === 0) {
        showToast('ไม่พบข้อคำถามในไฟล์ Excel กรุณาตรวจสอบหัวตาราง', 'error');
        return;
    }

    const currentTitle = (document.getElementById('surveyTitle').value || '').trim();
    const fallbackTitle = fileName.replace(/\.[^/.]+$/, '').replace(/_/g, ' ') || 'แบบประเมินนำเข้าจาก Excel';

    parsedImportSurvey = {
        title: currentTitle || fallbackTitle,
        category: (document.getElementById('surveyCategory').value || 'บริการทั่วไป').trim(),
        description: (document.getElementById('surveyDesc').value || '').trim() || 'แบบประเมินนำเข้าจากไฟล์ Excel',
        status: document.getElementById('surveyStatus').value || 'draft',
        sections: sections
    };

    showImportPreview(parsedImportSurvey);
    showToast(`อ่านข้อมูลสำเร็จ: ${sections.length} ส่วน รวม ${sections.reduce((acc, s) => acc + s.questions.length, 0)} ข้อ`, 'success');
}

function handleJsonFileSelect(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
        try {
            const text = ev.target.result;
            const jsonText = document.getElementById('jsonTextInput');
            if (jsonText) jsonText.value = text;
            parseJsonText(text);
        } catch (err) {
            showToast('ไฟล์ JSON ไม่ถูกต้อง', 'error');
        }
    };
    reader.readAsText(file);
}

function handleJsonTextChange() {
    const textEl = document.getElementById('jsonTextInput');
    const text = textEl ? textEl.value.trim() : '';
    if (!text) {
        parsedImportSurvey = null;
        const previewBox = document.getElementById('importPreviewBox');
        if (previewBox) previewBox.style.display = 'none';
        updateImportButtonState();
        return;
    }
    parseJsonText(text);
}

function parseJsonText(text) {
    try {
        const obj = JSON.parse(text);
        if (!obj.title || !Array.isArray(obj.sections) || obj.sections.length === 0) {
            showToast('โครงสร้าง JSON ต้องมี title และ sections อย่างน้อย 1 ส่วน', 'warning');
            parsedImportSurvey = null;
            const previewBox = document.getElementById('importPreviewBox');
            if (previewBox) previewBox.style.display = 'none';
            updateImportButtonState();
            return;
        }

        parsedImportSurvey = {
            title: obj.title,
            category: obj.category || 'บริการทั่วไป',
            description: obj.description || '',
            status: obj.status || 'draft',
            sections: obj.sections
        };

        showImportPreview(parsedImportSurvey);
    } catch (err) {
        parsedImportSurvey = null;
        const previewBox = document.getElementById('importPreviewBox');
        if (previewBox) previewBox.style.display = 'none';
        updateImportButtonState();
    }
}

function showImportPreview(survey) {
    if (!survey) return;

    const titleEl = document.getElementById('previewSurveyTitle');
    if (titleEl) titleEl.textContent = survey.title;
    const catEl = document.getElementById('previewSurveyCategory');
    if (catEl) catEl.textContent = survey.category || 'ทั่วไป';

    const totalQuestions = survey.sections.reduce((acc, s) => acc + (s.questions ? s.questions.length : 0), 0);
    const statsEl = document.getElementById('previewSurveyStats');
    if (statsEl) {
        statsEl.innerHTML = `
            <span><i class="fas fa-layer-group" style="color:var(--primary);"></i> ${survey.sections.length} ส่วนประเมิน</span>
            <span>•</span>
            <span><i class="fas fa-list-check" style="color:var(--primary);"></i> ${totalQuestions} ข้อคำถาม</span>
        `;
    }

    let qHtml = '';
    survey.sections.forEach((sec, sIdx) => {
        qHtml += `<div style="font-weight:600; color:var(--text); margin-top:${sIdx > 0 ? '6px' : '0'};">${escapeHtml(sec.title || 'ส่วนที่ ' + (sIdx + 1))}</div>`;
        if (sec.questions) {
            sec.questions.forEach((q, qIdx) => {
                const typeBadge = q.question_type === 'rating' ? 'คะแนน 1-5' : (q.question_type === 'radio' ? 'ตัวเลือกเดียว' : (q.question_type === 'checkbox' ? 'หลายตัวเลือก' : 'ข้อความ'));
                qHtml += `<div style="margin-left: 12px; color: var(--text-light);">${qIdx + 1}. ${escapeHtml(q.question_text)} <span style="font-size:0.75rem; background:#E2E8F0; padding:1px 6px; border-radius:4px; margin-left:4px;">${typeBadge}</span></div>`;
            });
        }
    });
    const qListEl = document.getElementById('previewQuestionsList');
    if (qListEl) qListEl.innerHTML = qHtml;

    const previewBox = document.getElementById('importPreviewBox');
    if (previewBox) previewBox.style.display = 'block';
    updateImportButtonState();
}

function updateImportButtonState() {
    const btn = document.getElementById('confirmImportInEditorBtn');
    if (btn) {
        btn.disabled = !parsedImportSurvey;
    }
}

function applyImportToEditor() {
    if (!parsedImportSurvey) return;

    loadSurveyFromObject(parsedImportSurvey);
    closeModal('importModal');
    showToast('นำเข้าข้อมูลแบบประเมินลงในตัวสร้างฟอร์มเรียบร้อยแล้ว', 'success');
}

// Template Downloaders
function downloadExcelTemplate() {
    const templateData = [
        {
            'ส่วนประเมิน': 'ส่วนที่ 1: ข้อมูลทั่วไปของผู้ตอบแบบประเมิน',
            'ประเภทส่วนประเมิน': 'demographic',
            'ข้อคำถาม': 'เพศ',
            'ประเภทคำถาม': 'radio',
            'ตัวเลือกคำตอบ': 'ชาย, หญิง, อื่นๆ / ไม่ระบุ',
            'จำเป็นต้องตอบ': 1
        },
        {
            'ส่วนประเมิน': 'ส่วนที่ 1: ข้อมูลทั่วไปของผู้ตอบแบบประเมิน',
            'ประเภทส่วนประเมิน': 'demographic',
            'ข้อคำถาม': 'สถานะภาพ',
            'ประเภทคำถาม': 'radio',
            'ตัวเลือกคำตอบ': 'นักเรียน/นักศึกษา, อาจารย์/บุคลากร, บุคคลภายนอก',
            'จำเป็นต้องตอบ': 1
        },
        {
            'ส่วนประเมิน': 'ส่วนที่ 2: ความพึงพอใจต่อการให้บริการ',
            'ประเภทส่วนประเมิน': 'rating',
            'ข้อคำถาม': 'การประชาสัมพันธ์และข้อมูลข่าวสาร',
            'ประเภทคำถาม': 'rating',
            'ตัวเลือกคำตอบ': '',
            'จำเป็นต้องตอบ': 1
        },
        {
            'ส่วนประเมิน': 'ส่วนที่ 2: ความพึงพอใจต่อการให้บริการ',
            'ประเภทส่วนประเมิน': 'rating',
            'ข้อคำถาม': 'ความสะดวกและรวดเร็วในการให้บริการ',
            'ประเภทคำถาม': 'rating',
            'ตัวเลือกคำตอบ': '',
            'จำเป็นต้องตอบ': 1
        },
        {
            'ส่วนประเมิน': 'ส่วนที่ 2: ความพึงพอใจต่อการให้บริการ',
            'ประเภทส่วนประเมิน': 'rating',
            'ข้อคำถาม': 'ความสุภาพและความพร้อมในการให้บริการของเจ้าหน้าที่',
            'ประเภทคำถาม': 'rating',
            'ตัวเลือกคำตอบ': '',
            'จำเป็นต้องตอบ': 1
        },
        {
            'ส่วนประเมิน': 'ส่วนที่ 2: ความพึงพอใจต่อการให้บริการ',
            'ประเภทส่วนประเมิน': 'rating',
            'ข้อคำถาม': 'ภาพรวมความพึงพอใจในการรับบริการ',
            'ประเภทคำถาม': 'rating',
            'ตัวเลือกคำตอบ': '',
            'จำเป็นต้องตอบ': 1
        },
        {
            'ส่วนประเมิน': 'ส่วนที่ 3: ข้อเสนอแนะเพิ่มเติม',
            'ประเภทส่วนประเมิน': 'text',
            'ข้อคำถาม': 'ข้อคิดเห็นและข้อเสนอแนะเพิ่มเติมสำหรับการพัฒนาการให้บริการ',
            'ประเภทคำถาม': 'text',
            'ตัวเลือกคำตอบ': '',
            'จำเป็นต้องตอบ': 0
        }
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    ws['!cols'] = [
        { wch: 36 },
        { wch: 18 },
        { wch: 45 },
        { wch: 15 },
        { wch: 40 },
        { wch: 14 }
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'แบบประเมิน');
    XLSX.writeFile(wb, 'Survey_Template_แบบประเมินตัวอย่าง.xlsx');
    showToast('ดาวน์โหลดเทมเพลต Excel สำเร็จ', 'success');
}

function downloadJsonTemplate() {
    const template = {
        title: "แบบประเมินความพึงพอใจการให้บริการ ประจำปี 2567",
        category: "บริการทั่วไป",
        description: "ขอความอนุเคราะห์ตอบแบบประเมินเพื่อนำข้อมูลไปปรับปรุงและพัฒนาการให้บริการต่อไป",
        status: "published",
        sections: [
            {
                title: "ส่วนที่ 1: ข้อมูลทั่วไปของผู้ตอบแบบประเมิน",
                section_type: "demographic",
                questions: [
                    {
                        question_text: "เพศ",
                        question_type: "radio",
                        options: ["ชาย", "หญิง", "อื่นๆ / ไม่ระบุ"],
                        is_required: 1
                    },
                    {
                        question_text: "สถานภาพ",
                        question_type: "radio",
                        options: ["นักเรียน/นักศึกษา", "อาจารย์/บุคลากร", "บุคคลภายนอก"],
                        is_required: 1
                    }
                ]
            },
            {
                title: "ส่วนที่ 2: ความพึงพอใจต่อการให้บริการ",
                section_type: "rating",
                questions: [
                    {
                        question_text: "การประชาสัมพันธ์และข้อมูลข่าวสาร",
                        question_type: "rating",
                        is_required: 1
                    },
                    {
                        question_text: "ความสะดวกและรวดเร็วในการให้บริการ",
                        question_type: "rating",
                        is_required: 1
                    },
                    {
                        question_text: "ความสุภาพและความพร้อมในการให้บริการของเจ้าหน้าที่",
                        question_type: "rating",
                        is_required: 1
                    },
                    {
                        question_text: "ภาพรวมความพึงพอใจในการรับบริการ",
                        question_type: "rating",
                        is_required: 1
                    }
                ]
            },
            {
                title: "ส่วนที่ 3: ข้อเสนอแนะเพิ่มเติม",
                section_type: "text",
                questions: [
                    {
                        question_text: "ข้อคิดเห็นและข้อเสนอแนะเพิ่มเติมสำหรับการพัฒนาการให้บริการ",
                        question_type: "text",
                        is_required: 0
                    }
                ]
            }
        ]
    };

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(template, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", "Survey_Template_แบบประเมินตัวอย่าง.json");
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    showToast('ดาวน์โหลดเทมเพลต JSON สำเร็จ', 'success');
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

function escapeHtmlAttr(text) {
    if (!text) return '';
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}
