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
            const res = await fetch(`api/certificates.php?survey_id=${surveyId}`);
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
        if (window.html2canvas && window.jspdf) return true;

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
            if (!window.jspdf) {
                await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
            }
            return true;
        } catch (err) {
            console.error('Failed to load PDF libraries:', err);
            return false;
        }
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
        const formattedDate = `ให้ไว้ ณ วันที่ ${now.getDate()} ${thaiMonths[now.getMonth()]} พ.ศ. ${now.getFullYear() + 543}`;

        // Create an exact A4 landscape offscreen container (1123px x 794px ~ 297mm x 210mm at 96 DPI)
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
        exportDiv.className = `cert-bg-${cert.bg_preset || 'gold-luxury'}`;

        if (cert.bg_preset === 'custom' && cert.bg_image_url) {
            exportDiv.style.backgroundImage = `url(${cert.bg_image_url})`;
            exportDiv.style.backgroundSize = '100% 100%';
            exportDiv.style.backgroundPosition = 'center';
            exportDiv.style.backgroundRepeat = 'no-repeat';
        }

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
        const pos = {
            ...defaultPos,
            ...(cert.elements_config || {})
        };
        if (!cert.elements_config || !cert.elements_config.signature) {
            if (cert.elements_config && cert.elements_config.issuer) {
                pos.signature = {
                    x: cert.elements_config.issuer.x || 50,
                    y: Math.max(10, (cert.elements_config.issuer.y || 85) - 9),
                    size: 50
                };
            }
        }

        const titleText = cert.title || 'เกียรติบัตร';
        const subtitleText = cert.subtitle || 'มอบให้ไว้เพื่อแสดงว่า';
        const recipientText = (cert.recipient_name || '{name}').replace(/{name}/g, name);
        const bodyText = (cert.body_text || '').replace(/{date}/g, formattedDate).replace(/{name}/g, name);
        const dateText = (cert.issued_date || '{date}').replace(/{date}/g, formattedDate);
        const issuerName = cert.issuer_name || '';
        const issuerTitle = cert.issuer_title || '';

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

        const logoHtml = cert.logo_url 
            ? `<img src="${cert.logo_url}" style="max-width:${logoSize}px; max-height:${logoSize}px; object-fit:contain;" alt="Logo">` 
            : `<i class="fas fa-award" style="font-size: ${Math.round(logoSize * 0.75)}px; color: #D97706;"></i>`;

        const signatureHtml = cert.signature_url 
            ? `<div style="position: absolute; left: ${pos.signature ? pos.signature.x : 50}%; top: ${pos.signature ? pos.signature.y : 79}%; transform: translate(-50%, -50%); text-align:center;">
                 <img src="${cert.signature_url}" style="height: ${signatureSize}px; max-width: 320px; object-fit:contain;" alt="Signature">
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

            if (document.body.contains(exportDiv)) {
                document.body.removeChild(exportDiv);
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

            if (modalImg) modalImg.src = pngDataUrl;
            if (modalPngBtn) {
                modalPngBtn.href = pngDataUrl;
                modalPngBtn.download = `${safeFileName}.png`;
            }
            if (modalLineTip) {
                modalLineTip.style.display = isLine ? 'block' : 'none';
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
                    format: 'a4'
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
            if (document.body.contains(exportDiv)) {
                document.body.removeChild(exportDiv);
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
