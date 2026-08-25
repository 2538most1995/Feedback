// Public & Preview Survey Form Handler
// /Applications/MAMP/htdocs/Feedback/js/survey.js

document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const surveyId = urlParams.get('id');
    const isPreview = urlParams.get('preview') === '1';

    const loading = document.getElementById('loading');
    const surveyContainer = document.getElementById('surveyContainer');
    const formContent = document.getElementById('formContent');
    const surveyTitle = document.getElementById('surveyTitle');
    const surveyDesc = document.getElementById('surveyDesc');
    const surveyCategory = document.getElementById('surveyCategory');
    const surveyForm = document.getElementById('surveyForm');
    const thankYou = document.getElementById('thankYou');
    const previewBanner = document.getElementById('previewBanner');
    const adminReturnBtn = document.getElementById('adminReturnBtn');

    let surveyData = null;

    if (isPreview && previewBanner) {
        previewBanner.classList.remove('hidden');
        if (adminReturnBtn) adminReturnBtn.style.display = 'inline-flex';
    }

    if (!surveyId) {
        window.location.href = 'index.html';
        return;
    }

    const fetchSurvey = async () => {
        if (loading) loading.classList.remove('hidden');
        if (surveyContainer) surveyContainer.classList.add('hidden');

        try {
            const previewQuery = isPreview ? '&preview=1' : '';
            const res = await fetch(`api/surveys.php?id=${encodeURIComponent(surveyId)}&public=1${previewQuery}`, {
                credentials: 'include'
            });

            const json = await res.json();

            if (!res.ok || !json.success) {
                throw new Error(json.message || 'ไม่พบแบบประเมินที่ระบุ');
            }

            surveyData = json.data;
            renderForm(surveyData);

            if (surveyContainer) surveyContainer.classList.remove('hidden');
        } catch (error) {
            console.error('Error fetching survey:', error);
            if (surveyContainer) surveyContainer.classList.remove('hidden');
            if (surveyTitle) surveyTitle.textContent = 'ไม่สามารถเปิดแบบประเมินได้';
            if (surveyDesc) surveyDesc.textContent = '';
            if (formContent) {
                formContent.innerHTML = `
                    <div style="text-align:center; padding:3rem 1.5rem; color:#EF4444; background:white; border-radius:12px; border:1px solid #FEE2E2; margin: 2rem 0; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
                        <i class="fas fa-exclamation-triangle" style="font-size:3.5rem; margin-bottom:1rem; display:block;"></i>
                        <h3 style="font-size:1.25rem; margin-bottom:0.5rem; color:#991B1B;">${escapeHtml(error.message || 'ไม่สามารถเปิดแบบประเมินได้')}</h3>
                        <p style="color:#64748B; font-size:0.95rem; margin-bottom:1.5rem;">แบบประเมินนี้อาจยังอยู่ในสถานะร่าง หรือปิดรับความคิดเห็นแล้ว</p>
                        <div style="display:flex; gap:10px; justify-content:center; flex-wrap:wrap;">
                            <a href="index.html" class="btn btn-primary" style="display:inline-flex;">กลับสู่หน้าหลัก</a>
                            <a href="admin/surveys.html" class="btn btn-outline" style="display:inline-flex;">ไปหน้าจัดการแบบประเมิน</a>
                        </div>
                    </div>`;
                const submitBtn = surveyForm ? surveyForm.querySelector('button[type="submit"]') : null;
                if (submitBtn) submitBtn.style.display = 'none';
            }
        } finally {
            if (loading) loading.classList.add('hidden');
        }
    };

    const renderForm = (data) => {
        if (!data) return;
        if (surveyTitle) surveyTitle.textContent = data.title || 'แบบประเมินความพึงพอใจ';
        if (surveyDesc) surveyDesc.textContent = data.description || '';
        if (surveyCategory) surveyCategory.textContent = data.category || 'ทั่วไป';

        let html = '';
        const sections = data.sections || [];

        if (sections.length === 0) {
            formContent.innerHTML = '<div style="text-align:center; padding:2rem; color:#64748B;">แบบประเมินนี้ยังไม่มีคำถาม</div>';
            return;
        }

        sections.forEach((section, sIdx) => {
            const sectionType = section.section_type || 'rating';
            const sectionNum = sIdx + 1;
            const questions = section.questions || [];
            let questionIndex = 1; // Reset to 1 for every section

            html += `
                <section class="survey-section ${sectionType}" style="margin-bottom: 24px; background: white; border-radius: 12px; padding: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.04); border: 1px solid var(--border);">
                    <h3 style="margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid var(--border); color: var(--primary-dark); font-size: 1.15rem; display: flex; align-items: center; gap: 8px;">
                        <i class="fas fa-list-check" style="color: var(--primary);"></i>
                        ${escapeHtml(section.title || 'ส่วนที่ ' + sectionNum)}
                    </h3>
                    <div class="section-content">
            `;

            if (questions.length === 0) {
                html += '<p style="color: var(--text-secondary); font-size: 0.9rem;">(ไม่มีคำถามในส่วนนี้)</p>';
            }

            questions.forEach((q) => {
                const qType = q.question_type || 'rating';
                const isRequired = q.is_required ? true : false;
                const reqStar = isRequired ? '<span class="required-badge" title="จำเป็นต้องตอบ">*</span>' : '';
                
                let options = [];
                if (Array.isArray(q.options)) {
                    options = q.options;
                } else if (q.options_json) {
                    try {
                        const parsed = JSON.parse(q.options_json);
                        options = Array.isArray(parsed) ? parsed : [];
                    } catch (e) {
                        options = [];
                    }
                }

                html += `<div class="question-block" style="margin-bottom: 1.75rem;" id="qb_${q.id}">`;

                if (qType === 'rating') {
                    html += `
                        <div class="rating-question" style="margin-bottom: 0.5rem;">
                            <p style="font-weight: 600; font-size: 1rem; margin-bottom: 14px; color: var(--text);">
                                ${questionIndex}. ${escapeHtml(q.question_text)} ${reqStar}
                            </p>
                            <div class="emoji-rating">
                                <label><input type="radio" name="q_${q.id}" value="5" ${isRequired ? 'required' : ''}><span class="emoji">😍</span><span class="rating-num">5</span><span class="rating-text">มากที่สุด</span></label>
                                <label><input type="radio" name="q_${q.id}" value="4"><span class="emoji">😊</span><span class="rating-num">4</span><span class="rating-text">มาก</span></label>
                                <label><input type="radio" name="q_${q.id}" value="3"><span class="emoji">😐</span><span class="rating-num">3</span><span class="rating-text">ปานกลาง</span></label>
                                <label><input type="radio" name="q_${q.id}" value="2"><span class="emoji">🙁</span><span class="rating-num">2</span><span class="rating-text">น้อย</span></label>
                                <label><input type="radio" name="q_${q.id}" value="1"><span class="emoji">😡</span><span class="rating-num">1</span><span class="rating-text">น้อยที่สุด</span></label>
                            </div>
                        </div>
                    `;
                } else if (qType === 'radio') {
                    html += `
                        <div style="margin-bottom: 0.5rem;">
                            <p style="font-weight: 600; font-size: 1rem; margin-bottom: 10px; color: var(--text);">
                                ${questionIndex}. ${escapeHtml(q.question_text)} ${reqStar}
                            </p>
                            <div class="radio-group">
                    `;
                    options.forEach((opt) => {
                        html += `
                            <label class="radio-label">
                                <input type="radio" name="q_${q.id}" value="${escapeHtmlAttr(opt)}" ${isRequired ? 'required' : ''}>
                                <span>${escapeHtml(opt)}</span>
                            </label>
                        `;
                    });
                    html += `</div></div>`;
                } else if (qType === 'checkbox') {
                    html += `
                        <div style="margin-bottom: 0.5rem;">
                            <p style="font-weight: 600; font-size: 1rem; margin-bottom: 10px; color: var(--text);">
                                ${questionIndex}. ${escapeHtml(q.question_text)} ${reqStar} 
                                <span style="font-weight: normal; font-size: 0.8rem; color: var(--text-secondary);">(เลือกได้มากกว่า 1 ข้อ)</span>
                            </p>
                            <div class="checkbox-group">
                    `;
                    options.forEach((opt) => {
                        html += `
                            <label class="checkbox-label">
                                <input type="checkbox" name="q_${q.id}[]" value="${escapeHtmlAttr(opt)}">
                                <span>${escapeHtml(opt)}</span>
                            </label>
                        `;
                    });
                    html += `</div></div>`;
                } else if (qType === 'text') {
                    html += `
                        <div style="margin-bottom: 0.5rem;">
                            <p style="font-weight: 600; font-size: 1rem; margin-bottom: 8px; color: var(--text);">
                                <i class="fas fa-comment-dots" style="color:var(--primary); margin-right:6px;"></i>
                                ${questionIndex}. ${escapeHtml(q.question_text)} ${reqStar}
                            </p>
                            <textarea class="form-control" name="q_${q.id}" rows="3" placeholder="พิมพ์คำตอบหรือข้อเสนอแนะที่นี่..." style="width: 100%; border-radius: 8px; padding: 10px 12px;" ${isRequired ? 'required' : ''}></textarea>
                        </div>
                    `;
                }

                html += `</div>`;
                questionIndex++;
            });

            html += `</div></section>`;
        });

        formContent.innerHTML = html;

        // Auto-scroll on rating select
        const emojiInputs = document.querySelectorAll('.emoji-rating input[type="radio"]');
        emojiInputs.forEach(input => {
            input.addEventListener('change', (e) => {
                const currentBlock = e.target.closest('.question-block');
                if (currentBlock && currentBlock.nextElementSibling) {
                    setTimeout(() => {
                        currentBlock.nextElementSibling.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }, 250);
                }
            });
        });
    };

    if (surveyForm) {
        surveyForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            if (!surveyForm.checkValidity()) {
                surveyForm.classList.add('shake');
                setTimeout(() => surveyForm.classList.remove('shake'), 400);

                const firstInvalid = surveyForm.querySelector(':invalid');
                if (firstInvalid) {
                    firstInvalid.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    firstInvalid.focus();
                }
                return;
            }

            const formData = new FormData(surveyForm);
            const answers = [];
            let gender = '';
            let ageRange = '';
            let role = '';
            let respondentName = '';

            if (surveyData && surveyData.sections) {
                surveyData.sections.forEach(section => {
                    (section.questions || []).forEach(q => {
                        const qType = q.question_type || 'rating';
                        const fieldName = `q_${q.id}`;
                        const qText = (q.question_text || '').toLowerCase();

                        if (qType === 'checkbox') {
                            const values = formData.getAll(`${fieldName}[]`);
                            if (values.length > 0) {
                                answers.push({
                                    question_id: q.id,
                                    rating_value: null,
                                    text_value: values.join(', ')
                                });
                            }
                        } else if (qType === 'radio' || qType === 'rating' || qType === 'text') {
                            const val = formData.get(fieldName);
                            if (val !== null && val !== '') {
                                if (qType === 'rating') {
                                    answers.push({
                                        question_id: q.id,
                                        rating_value: parseInt(val),
                                        text_value: null
                                    });
                                } else {
                                    answers.push({
                                        question_id: q.id,
                                        rating_value: null,
                                        text_value: val
                                    });

                                    // Extract demographic name / gender / age / role
                                    if (qText.includes('ชื่อ') || qText.includes('นามสกุล') || qText.includes('ผู้ประเมิน')) {
                                        respondentName = val;
                                    }
                                    if (qText.includes('เพศ') && !gender) {
                                        gender = val;
                                    }
                                    if (qText.includes('อายุ') && !ageRange) {
                                        ageRange = val;
                                    }
                                    if ((qText.includes('สถานะ') || qText.includes('ตำแหน่ง') || qText.includes('อาชีพ')) && !role) {
                                        role = val;
                                    }
                                }
                            }
                        }
                    });
                });
            }

            const payload = {
                survey_id: parseInt(surveyId),
                respondent_name: respondentName || null,
                gender: gender,
                age_range: ageRange,
                role: role,
                answers: answers
            };

            const submitBtn = surveyForm.querySelector('button[type="submit"]');

            try {
                if (submitBtn) {
                    submitBtn.disabled = true;
                    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> กำลังส่งแบบประเมิน...';
                }

                const res = await fetch('api/responses.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify(payload)
                });

                const json = await res.json();

                if (json.success) {
                    surveyContainer.classList.add('hidden');
                    thankYou.classList.remove('hidden');
                    window.scrollTo({ top: 0, behavior: 'smooth' });

                    // Check if this survey has certificate enabled
                    checkAndSetupCertificate(parseInt(surveyId), respondentName || '');
                } else {
                    throw new Error(json.message || 'เกิดข้อผิดพลาดในการส่งข้อมูล');
                }
            } catch (error) {
                console.error('Submit error:', error);
                alert(error.message || 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');

                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> ส่งแบบประเมิน';
                }
            }
        });
    }

    // Modal helper
    window.closeCertModal = function() {
        const modal = document.getElementById('certModal');
        if (modal) modal.style.display = 'none';
    };

    function isLineBrowser() {
        const ua = (navigator.userAgent || '') + ' ' + (navigator.vendor || '');
        return /Line\//i.test(ua) || /LineApp/i.test(ua);
    }

    async function checkAndSetupCertificate(surveyId, respondentName) {
        try {
            const res = await fetch(`api/certificates.php?survey_id=${surveyId}&_t=${Date.now()}`);
            const json = await res.json();
            if (json.success && json.data && Number(json.data.is_enabled) === 1) {
                const cert = json.data;
                const awardBox = document.getElementById('certAwardBox');
                if (awardBox) awardBox.style.display = 'block';

                const isLine = isLineBrowser();
                const lineNotice = document.getElementById('lineBrowserNotice');
                const openExtBtn = document.getElementById('openExternalBrowserBtn');

                if (isLine) {
                    if (lineNotice) lineNotice.style.display = 'block';
                    if (openExtBtn) {
                        openExtBtn.style.display = 'inline-flex';
                        try {
                            const currentUrl = new URL(window.location.href);
                            currentUrl.searchParams.set('openExternalBrowser', '1');
                            openExtBtn.href = currentUrl.toString();
                        } catch (e) {
                            openExtBtn.href = window.location.href + (window.location.href.includes('?') ? '&' : '?') + 'openExternalBrowser=1';
                        }
                    }
                }

                const nameInput = document.getElementById('certRecipientInput');
                if (nameInput) {
                    if (respondentName) {
                        nameInput.value = respondentName;
                    }
                    nameInput.focus();
                }

                const downloadBtn = document.getElementById('downloadCertBtn');
                if (downloadBtn) {
                    downloadBtn.onclick = () => {
                        const finalName = nameInput ? nameInput.value.trim() : '';
                        if (!finalName) {
                            alert('กรุณากรอกชื่อ - นามสกุล สำหรับพิมพ์บนเกียรติบัตร');
                            if (nameInput) nameInput.focus();
                            return;
                        }
                        generateCertificate(cert, finalName, 'pdf');
                    };
                }

                const downloadImgBtn = document.getElementById('downloadCertImgBtn');
                if (downloadImgBtn) {
                    downloadImgBtn.onclick = () => {
                        const finalName = nameInput ? nameInput.value.trim() : '';
                        if (!finalName) {
                            alert('กรุณากรอกชื่อ - นามสกุล สำหรับพิมพ์บนเกียรติบัตร');
                            if (nameInput) nameInput.focus();
                            return;
                        }
                        generateCertificate(cert, finalName, 'image');
                    };
                }
            }
        } catch (err) {
            console.error('Cert check error:', err);
        }
    }

    // Dynamic library loader helper for html2canvas & jsPDF
    async function loadPdfLibraries() {
        if (window.html2canvas && (window.jspdf || window.jsPDF)) return true;

        const loadScript = (src) => {
            return new Promise((resolve, reject) => {
                const s = document.createElement('script');
                s.src = src;
                s.onload = resolve;
                s.onerror = reject;
                document.head.appendChild(s);
            });
        };

        try {
            if (!window.html2canvas) {
                await loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js');
            }
            if (!window.jspdf && !window.jsPDF) {
                await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
            }
            return true;
        } catch (err) {
            console.error('Failed to load PDF libraries:', err);
            return false;
        }
    }

    function normalizeCertificateColor(color, fallback) {
        return /^#[0-9A-F]{6}$/i.test(String(color || '')) ? String(color).toUpperCase() : fallback;
    }

    function renderCertificateStyledText(rawValue, styleConfig, colorKey, rangesKey, defaultColor, replacements = {}) {
        const text = String(rawValue ?? '');
        const baseColor = normalizeCertificateColor(styleConfig && styleConfig[colorKey], defaultColor);
        const rawRanges = styleConfig && Array.isArray(styleConfig[rangesKey]) ? styleConfig[rangesKey] : [];
        const ranges = rawRanges
            .map(range => ({
                start: Math.max(0, Math.min(text.length, Number(range.start) || 0)),
                end: Math.max(0, Math.min(text.length, Number(range.end) || 0)),
                color: normalizeCertificateColor(range.color, baseColor)
            }))
            .filter(range => range.end > range.start)
            .sort((a, b) => a.start - b.start || a.end - b.end);
        const boundaries = new Set([0, text.length]);
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
            let content = escapeHtml(text.slice(start, end)).replace(/\n/g, '<br>');
            content = content
                .replace(/\{name\}/g, escapeHtml(replacements.name || ''))
                .replace(/\{date\}/g, escapeHtml(replacements.date || ''));
            html += `<span style="color:${activeRange ? activeRange.color : baseColor};">${content}</span>`;
        }
        return { html, color: baseColor };
    }

    async function generateCertificate(cert, name, targetMode = 'pdf') {
        const downloadBtn = document.getElementById('downloadCertBtn');
        const downloadImgBtn = document.getElementById('downloadCertImgBtn');
        const activeBtn = (targetMode === 'image') ? downloadImgBtn : downloadBtn;

        if (activeBtn) {
            activeBtn.disabled = true;
            activeBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> กำลังโหลดระบบ...';
        }

        const loaded = await loadPdfLibraries();
        if (!loaded) {
            if (activeBtn) {
                activeBtn.disabled = false;
                activeBtn.innerHTML = (targetMode === 'image')
                    ? '<i class="fas fa-image"></i> บันทึกเป็นรูปภาพ (PNG คมชัดสูง)'
                    : '<i class="fas fa-file-pdf"></i> สร้างและดาวน์โหลดเกียรติบัตร (PDF)';
            }
            alert('ไม่สามารถโหลดไลบรารีสร้างเกียรติบัตรได้ กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ต');
            return;
        }

        if (activeBtn) {
            activeBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> กำลังสร้างเกียรติบัตร...';
        }

        const now = new Date();
        const thaiMonths = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน',
                           'กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
        const formattedDate = `${now.getDate()} ${thaiMonths[now.getMonth()]} พ.ศ. ${now.getFullYear() + 543}`;

        // Create an offscreen wrapper container with top:0, left:0, opacity:0 to avoid negative coordinate calculation bugs in html2canvas
        const renderWrapper = document.createElement('div');
        renderWrapper.style.cssText = 'position: fixed; top: 0; left: 0; width: 840px; height: 594px; z-index: -9999; opacity: 0; pointer-events: none; overflow: hidden; margin: 0; padding: 0;';

        let rawConfig = cert.elements_config;
        if (typeof rawConfig === 'string') {
            try { rawConfig = JSON.parse(rawConfig); } catch(e) {}
            if (typeof rawConfig === 'string') {
                try { rawConfig = JSON.parse(rawConfig); } catch(e) {}
            }
        }
        rawConfig = (rawConfig && typeof rawConfig === 'object') ? rawConfig : {};

        const defaultPos = {
            logo: { x: 50, y: 14, size: 70 },
            title: { x: 50, y: 26, size: 34 },
            subtitle: { x: 50, y: 35, size: 17 },
            recipient: { x: 50, y: 45, size: 28 },
            body: { x: 50, y: 58, size: 15 },
            date: { x: 50, y: 70, size: 14 },
            signature: { x: 50, y: 79, size: 50 },
            issuer: { x: 50, y: 89, size: 15 }
        };

        const pos = {};
        Object.keys(defaultPos).forEach(k => {
            pos[k] = {
                ...(rawConfig[k] || {}),
                x: (rawConfig[k] && rawConfig[k].x !== undefined) ? Number(rawConfig[k].x) : defaultPos[k].x,
                y: (rawConfig[k] && rawConfig[k].y !== undefined) ? Number(rawConfig[k].y) : defaultPos[k].y,
                size: (rawConfig[k] && rawConfig[k].size !== undefined) ? Number(rawConfig[k].size) : defaultPos[k].size
            };
        });

        const titleText = cert.title || 'เกียรติบัตร';
        const subtitleText = cert.subtitle || 'มอบให้ไว้เพื่อแสดงว่า';
        const recipientSource = (cert.recipient_name || '{name}').includes('{name}') ? (cert.recipient_name || '{name}') : '{name}';
        const bodyText = cert.body_text || '';
        const dateText = cert.issued_date || '{date}';
        const issuerName = cert.issuer_name || '';
        const issuerTitle = cert.issuer_title || '';
        const issuerTitleSize = Math.round(pos.issuer.size * 0.85);
        const replacements = { name, date: formattedDate };
        const styledTitle = renderCertificateStyledText(titleText, pos.title, 'color', 'color_ranges', '#1E293B', replacements);
        const styledSubtitle = renderCertificateStyledText(subtitleText, pos.subtitle, 'color', 'color_ranges', '#64748B', replacements);
        const styledRecipient = renderCertificateStyledText(recipientSource, pos.recipient, 'color', 'color_ranges', '#4F46E5', replacements);
        const styledBody = renderCertificateStyledText(bodyText, pos.body, 'color', 'color_ranges', '#334155', replacements);
        const styledDate = renderCertificateStyledText(dateText, pos.date, 'color', 'color_ranges', '#64748B', replacements);
        const styledIssuerName = renderCertificateStyledText(issuerName, pos.issuer, 'name_color', 'name_color_ranges', '#1E293B', replacements);
        const styledIssuerTitle = renderCertificateStyledText(issuerTitle, pos.issuer, 'title_color', 'title_color_ranges', '#64748B', replacements);

        const sheet = document.createElement('div');
        sheet.className = `cert-sheet-render cert-bg-${cert.bg_preset || 'gold-luxury'}`;
        sheet.style.cssText = 'width: 840px; height: 594px; position: relative; background-color: #FFFFFF; box-sizing: border-box; overflow: hidden; user-select: none; margin: 0; padding: 0;';

        if (cert.bg_preset === 'custom' && cert.bg_image_url) {
            sheet.style.backgroundImage = `url(${cert.bg_image_url})`;
            sheet.style.backgroundSize = 'cover';
            sheet.style.backgroundPosition = 'center';
            sheet.style.backgroundRepeat = 'no-repeat';
        }

        const logoInner = cert.logo_url 
            ? `<img src="${cert.logo_url}" style="max-width: 100%; max-height: 100%; object-fit: contain;" alt="Logo">` 
            : `<i class="fas fa-award" style="font-size: ${Math.round(pos.logo.size * 0.74)}px; color: #D97706;"></i>`;

        sheet.innerHTML = `
            <div class="cert-element el-logo" style="left: ${pos.logo.x}%; top: ${pos.logo.y}%;">
                <div id="logoWrapper" style="width: ${pos.logo.size}px; height: ${pos.logo.size}px; display: flex; align-items: center; justify-content: center;">
                    ${logoInner}
                </div>
            </div>
            <div class="cert-element el-title" style="left: ${pos.title.x}%; top: ${pos.title.y}%; font-size: ${pos.title.size}px; color: ${styledTitle.color};">
                <div class="el-text-inner" id="dispTitle">${styledTitle.html}</div>
            </div>
            <div class="cert-element el-subtitle" style="left: ${pos.subtitle.x}%; top: ${pos.subtitle.y}%; font-size: ${pos.subtitle.size}px; color: ${styledSubtitle.color};">
                <div class="el-text-inner" id="dispSubtitle">${styledSubtitle.html}</div>
            </div>
            <div class="cert-element el-recipient" style="left: ${pos.recipient.x}%; top: ${pos.recipient.y}%; font-size: ${pos.recipient.size}px; color: ${styledRecipient.color}; border-bottom: 2px solid #C7D2FE; padding-bottom: 4px; min-width: 280px;">
                <div class="el-text-inner" id="dispRecipient">${styledRecipient.html}</div>
            </div>
            <div class="cert-element el-body" style="left: ${pos.body.x}%; top: ${pos.body.y}%; font-size: ${pos.body.size}px; color: ${styledBody.color}; width: 620px;">
                <div class="el-text-inner" id="dispBody">${styledBody.html}</div>
            </div>
            <div class="cert-element el-date" style="left: ${pos.date.x}%; top: ${pos.date.y}%; font-size: ${pos.date.size}px; color: ${styledDate.color};">
                <div class="el-text-inner" id="dispDate">${styledDate.html}</div>
            </div>
            ${cert.signature_url ? `
            <div class="cert-element el-signature" style="left: ${pos.signature.x}%; top: ${pos.signature.y}%;">
                <div id="signatureImgBox" style="display: block; height: ${pos.signature.size}px;">
                    <img src="${cert.signature_url}" style="height: 100%; object-fit: contain;" alt="Signature">
                </div>
            </div>` : ''}
            <div class="cert-element el-issuer" style="left: ${pos.issuer.x}%; top: ${pos.issuer.y}%; font-size: ${pos.issuer.size}px;">
                <div class="el-text-inner el-issuer-name" id="dispIssuerName" style="color: ${styledIssuerName.color};">${styledIssuerName.html}</div>
                <div class="el-text-inner el-issuer-title" id="dispIssuerTitle" style="margin-top: 2px; font-size: ${issuerTitleSize}px; color: ${styledIssuerTitle.color};">${styledIssuerTitle.html}</div>
            </div>
        `;

        renderWrapper.appendChild(sheet);
        document.body.appendChild(renderWrapper);

        try {
            // Wait for all web fonts to load completely
            if (document.fonts && document.fonts.ready) {
                await document.fonts.ready;
            }
            try {
                if (document.fonts && document.fonts.load) {
                    await Promise.all([
                        document.fonts.load(`700 ${pos.title.size}px "Prompt"`),
                        document.fonts.load(`500 ${pos.subtitle.size}px "Sarabun"`),
                        document.fonts.load(`700 ${pos.recipient.size}px "Prompt"`),
                        document.fonts.load(`400 ${pos.body.size}px "Sarabun"`),
                        document.fonts.load(`500 ${pos.date.size}px "Sarabun"`),
                        document.fonts.load(`600 ${pos.issuer.size}px "Sarabun"`),
                        document.fonts.load(`${issuerTitleSize}px "Sarabun"`)
                    ]);
                }
            } catch (fontErr) {}

            // Wait for all images in sheet to finish loading
            const imgs = Array.from(sheet.querySelectorAll('img'));
            await Promise.all(imgs.map(img => {
                if (img.complete) return Promise.resolve();
                return new Promise(resolve => {
                    img.onload = resolve;
                    img.onerror = resolve;
                });
            }));

            const canvas = await html2canvas(sheet, {
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

            if (document.body.contains(renderWrapper)) {
                document.body.removeChild(renderWrapper);
            }

            const pngDataUrl = canvas.toDataURL('image/png', 1.0);
            const isLine = isLineBrowser();
            const safeFileName = `Certificate_${name.replace(/[^a-zA-Z0-9ก-๙]/g, '_')}`;

            // Set up Modal preview
            const modal = document.getElementById('certModal');
            const modalImg = document.getElementById('certModalImg');
            const modalPngBtn = document.getElementById('certModalDownloadPngBtn');
            const modalPdfBtn = document.getElementById('certModalDownloadPdfBtn');
            const modalLineTip = document.getElementById('certModalLineTip');
            const modalExtBtn = document.getElementById('certModalOpenExtBtn');

            if (modalImg) modalImg.src = pngDataUrl;
            if (modalPngBtn) {
                modalPngBtn.href = pngDataUrl;
                modalPngBtn.download = `${safeFileName}.png`;
            }
            if (modalLineTip) {
                modalLineTip.style.display = isLine ? 'block' : 'none';
            }
            if (modalExtBtn) {
                if (isLine) {
                    modalExtBtn.style.display = 'inline-flex';
                    try {
                        const currentUrl = new URL(window.location.href);
                        currentUrl.searchParams.set('openExternalBrowser', '1');
                        modalExtBtn.href = currentUrl.toString();
                    } catch (e) {
                        modalExtBtn.href = window.location.href + (window.location.href.includes('?') ? '&' : '?') + 'openExternalBrowser=1';
                    }
                } else {
                    modalExtBtn.style.display = 'none';
                }
            }

            const downloadPdfAction = () => {
                const jsPDFConstructor = (window.jspdf && window.jspdf.jsPDF) ? window.jspdf.jsPDF : (window.jsPDF || null);
                if (!jsPDFConstructor) {
                    alert('ไม่พบไลบรารีสร้างไฟล์ PDF ในเบราว์เซอร์');
                    return;
                }
                const pdf = new jsPDFConstructor({
                    orientation: 'landscape',
                    unit: 'mm',
                    format: 'a4',
                    compress: true
                });
                pdf.addImage(pngDataUrl, 'PNG', 0, 0, 297, 210, undefined, 'FAST');
                pdf.save(`${safeFileName}.pdf`);
            };

            if (modalPdfBtn) {
                modalPdfBtn.onclick = () => {
                    downloadPdfAction();
                };
            }

            if (targetMode === 'image') {
                if (modal) modal.style.display = 'flex';
                if (!isLine) {
                    const link = document.createElement('a');
                    link.download = `${safeFileName}.png`;
                    link.href = pngDataUrl;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                }
            } else {
                // targetMode === 'pdf'
                if (isLine) {
                    // In LINE In-App Browser, Blob/Data PDF downloads are blocked by LINE sandbox.
                    // Show modal with clear instructions and PNG/PDF options.
                    if (modal) modal.style.display = 'flex';
                    try {
                        downloadPdfAction();
                    } catch (e) {}
                } else {
                    downloadPdfAction();
                }
            }
        } catch (err) {
            console.error('PDF/Image error:', err);
            if (document.body.contains(renderWrapper)) {
                document.body.removeChild(renderWrapper);
            }
            alert('เกิดข้อผิดพลาดในการสร้างเกียรติบัตร');
        } finally {
            if (activeBtn) {
                activeBtn.disabled = false;
                activeBtn.innerHTML = (targetMode === 'image')
                    ? '<i class="fas fa-image"></i> บันทึกเป็นรูปภาพ (PNG คมชัดสูง)'
                    : '<i class="fas fa-file-pdf"></i> สร้างและดาวน์โหลดเกียรติบัตร (PDF)';
            }
        }
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

    fetchSurvey();
});
