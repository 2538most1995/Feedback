// Stats JS - Real API Integration

let currentSurveyId = null;
let currentStatsData = null;
let surveyCombobox = null;

document.addEventListener('DOMContentLoaded', () => {
    checkAuth();

    // Check if survey ID is in URL
    const urlParams = new URLSearchParams(window.location.search);
    const urlId = urlParams.get('id');
    if (urlId) {
        currentSurveyId = urlId;
    }

    renderInitialEmptyState();
    loadSurveySelector();
});

function renderInitialEmptyState() {
    const emptyStateContainer = document.getElementById('emptyStatsState');
    if (emptyStateContainer) {
        emptyStateContainer.innerHTML = getEmptyStateHtml({
            icon: 'fas fa-chart-pie',
            title: 'เลือกแบบประเมินเพื่อดูรายงานสถิติ',
            desc: 'กรุณาเลือกแบบประเมินจากแถบด้านบน เพื่อแสดงผลวิเคราะห์คะแนน แผนภูมิ และสรุปข้อมูลสถิติ',
            actionText: 'จัดการแบบประเมิน',
            actionOnClick: "location.href='surveys.html'",
            actionIcon: 'fas fa-clipboard-list'
        });
    }
}

async function loadSurveySelector() {
    const container = document.getElementById('surveyComboboxContainer');
    if (!container) return;

    try {
        const res = await api('../api/surveys.php');
        if (res && res.success && res.data) {
            const surveyOptions = res.data.map(s => ({
                id: s.id,
                title: s.title,
                category: s.category || 'ทั่วไป',
                badge: `${s.response_count || 0} คำตอบ`
            }));

            surveyCombobox = createCombobox({
                container: '#surveyComboboxContainer',
                options: surveyOptions,
                value: currentSurveyId,
                placeholder: '-- เลือกแบบประเมินเพื่อดูรายงานผล --',
                searchPlaceholder: '🔍 พิมพ์ค้นหาชื่อแบบประเมิน...',
                onChange: (selectedId) => {
                    currentSurveyId = selectedId;
                    if (currentSurveyId) {
                        loadSurveyStats(currentSurveyId);
                    } else {
                        hideStatsAndShowEmpty();
                    }
                }
            });

            // Load initial stats if survey ID is preset
            if (currentSurveyId) {
                loadSurveyStats(currentSurveyId);
            }
        }
    } catch (err) {
        console.error('Error loading surveys:', err);
    }
}

function hideStatsAndShowEmpty() {
    const statsArea = document.getElementById('statsArea');
    const emptyState = document.getElementById('emptyStatsState');
    const skeleton = document.getElementById('statsLoadingSkeleton');
    const exportBtn = document.getElementById('exportExcelBtn');
    const exportSpssBtn = document.getElementById('exportSpssBtn');
    const mobileStickyBar = document.getElementById('statsMobileStickyBar');

    if (statsArea) statsArea.style.display = 'none';
    if (skeleton) skeleton.style.display = 'none';
    if (emptyState) {
        emptyState.style.display = 'block';
        renderInitialEmptyState();
    }
    if (exportBtn) exportBtn.disabled = true;
    if (exportSpssBtn) exportSpssBtn.disabled = true;
    if (mobileStickyBar) mobileStickyBar.classList.remove('is-visible');
}

async function loadSurveyStats(surveyId) {
    const statsArea = document.getElementById('statsArea');
    const emptyState = document.getElementById('emptyStatsState');
    const skeleton = document.getElementById('statsLoadingSkeleton');
    const exportBtn = document.getElementById('exportExcelBtn');
    const exportSpssBtn = document.getElementById('exportSpssBtn');
    const mobileStickyBar = document.getElementById('statsMobileStickyBar');

    if (!statsArea) return;

    // Show loading skeleton
    statsArea.style.display = 'none';
    if (emptyState) emptyState.style.display = 'none';
    if (skeleton) skeleton.style.display = 'block';
    if (exportBtn) exportBtn.disabled = true;
    if (exportSpssBtn) exportSpssBtn.disabled = true;
    if (mobileStickyBar) mobileStickyBar.classList.remove('is-visible');

    try {
        const res = await api(`../api/stats.php?type=survey&id=${surveyId}`);
        if (skeleton) skeleton.style.display = 'none';

        if (!res || !res.success || !res.data) {
            if (emptyState) {
                emptyState.style.display = 'block';
                emptyState.innerHTML = getEmptyStateHtml({
                    icon: 'fas fa-exclamation-triangle',
                    title: 'ไม่สามารถโหลดข้อมูลสถิติได้',
                    desc: res ? res.message : 'เกิดข้อผิดพลาดในการดึงข้อมูลจากเซิร์ฟเวอร์',
                    actionText: 'ลองใหม่อีกครั้ง',
                    actionOnClick: `loadSurveyStats(${surveyId})`,
                    actionIcon: 'fas fa-sync-alt'
                });
            }
            return;
        }

        currentStatsData = res.data;
        const data = res.data;

        // Check if 0 responses
        if (!data.total_responses || data.total_responses == 0) {
            if (emptyState) {
                emptyState.style.display = 'block';
                emptyState.innerHTML = getEmptyStateHtml({
                    icon: 'fas fa-inbox',
                    title: 'ยังไม่มีผู้ตอบแบบประเมินนี้',
                    desc: 'ยังไม่มีการบันทึกคำตอบสำหรับแบบประเมินนี้ คุณสามารถแชร์ลิงก์หรือ QR Code เพื่อเริ่มเก็บข้อมูลได้',
                    actionText: 'ดูแบบประเมิน / ทำแบบทดสอบ',
                    actionOnClick: `window.open('../survey.html?id=${surveyId}', '_blank')`,
                    actionIcon: 'fas fa-external-link-alt'
                });
            }
            return;
        }

        // Show stats content
        statsArea.style.display = 'block';
        if (exportBtn) exportBtn.disabled = false;
        if (exportSpssBtn) exportSpssBtn.disabled = false;
        if (mobileStickyBar) mobileStickyBar.classList.add('is-visible');

        // Update overview cards
        const totalEl = document.getElementById('statsTotalResponses');
        const avgEl = document.getElementById('statsAvgRating');
        if (totalEl) totalEl.textContent = (data.total_responses || 0).toLocaleString();
        if (avgEl) avgEl.innerHTML = `${parseFloat(data.avg_rating || 0).toFixed(2)} <span class="stat-unit">/ 5.00</span>`;

        // Find highest/lowest questions
        const questions = data.questions || [];
        if (questions.length > 0) {
            const sorted = [...questions].sort((a, b) => parseFloat(b.avg_rating || 0) - parseFloat(a.avg_rating || 0));
            const highEl = document.getElementById('statsHighest');
            const lowEl = document.getElementById('statsLowest');
            if (highEl) highEl.innerHTML = `${sorted[0].question_text} <strong style="color:var(--success);">(${parseFloat(sorted[0].avg_rating || 0).toFixed(2)})</strong>`;
            if (lowEl) lowEl.innerHTML = `${sorted[sorted.length - 1].question_text} <strong style="color:var(--error);">(${parseFloat(sorted[sorted.length - 1].avg_rating || 0).toFixed(2)})</strong>`;
        }

        // Render charts
        renderDonutChart(data.distribution || {});
        renderBarChart(data.questions || []);
        renderDemographicCharts(data);
        renderQuestionTable(data.questions || []);

    } catch (err) {
        if (skeleton) skeleton.style.display = 'none';
        console.error('Error loading stats:', err);
        if (emptyState) {
            emptyState.style.display = 'block';
            emptyState.innerHTML = getEmptyStateHtml({
                icon: 'fas fa-wifi',
                title: 'เกิดข้อผิดพลาดในการเชื่อมต่อ',
                desc: 'ไม่สามารถติดต่อเซิร์ฟเวอร์ได้ กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ต',
                actionText: 'ลองใหม่',
                actionOnClick: `loadSurveyStats(${surveyId})`,
                actionIcon: 'fas fa-redo'
            });
        }
    }
}

function renderDonutChart(distribution) {
    const ctx = document.getElementById('donutChart');
    if (!ctx) return;

    // Destroy existing chart
    if (ctx._chartInstance) ctx._chartInstance.destroy();

    const labels = ['5 ดาว', '4 ดาว', '3 ดาว', '2 ดาว', '1 ดาว'];
    const chartData = [
        distribution['5'] || 0,
        distribution['4'] || 0,
        distribution['3'] || 0,
        distribution['2'] || 0,
        distribution['1'] || 0
    ];

    const chart = new Chart(ctx.getContext('2d'), {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: chartData,
                backgroundColor: ['#10B981', '#34D399', '#FCD34D', '#F87171', '#EF4444'],
                borderWidth: 0,
                cutout: '70%'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom' }
            }
        }
    });
    ctx._chartInstance = chart;
}

function renderBarChart(questions) {
    const ctx = document.getElementById('barChart');
    if (!ctx || !questions || questions.length === 0) return;

    if (ctx._chartInstance) ctx._chartInstance.destroy();

    const labels = questions.map((q, i) => `ข้อ ${i + 1}`);
    const data = questions.map(q => parseFloat(q.avg_rating || 0));

    const chart = new Chart(ctx.getContext('2d'), {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'คะแนนเฉลี่ย',
                data: data,
                backgroundColor: 'rgba(79, 70, 229, 0.8)',
                borderRadius: 6,
                barThickness: 40
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true, max: 5, ticks: { stepSize: 1 } }
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        title: function(tooltipItems) {
                            const idx = tooltipItems[0].dataIndex;
                            return questions[idx].question_text;
                        }
                    }
                }
            }
        }
    });
    ctx._chartInstance = chart;
}

function renderDemographicCharts(data) {
    // Gender pie chart
    const genderCtx = document.getElementById('pieChart');
    if (genderCtx && data.gender && data.gender.length > 0) {
        if (genderCtx._chartInstance) genderCtx._chartInstance.destroy();

        const chart = new Chart(genderCtx.getContext('2d'), {
            type: 'pie',
            data: {
                labels: data.gender.map(g => g.gender || 'ไม่ระบุ'),
                datasets: [{
                    data: data.gender.map(g => g.count),
                    backgroundColor: ['#4F46E5', '#EC4899', '#9CA3AF', '#F59E0B'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: 'bottom' } }
            }
        });
        genderCtx._chartInstance = chart;
    }

    // Age bar chart
    const ageCtx = document.getElementById('ageChart');
    if (ageCtx && data.age_range && data.age_range.length > 0) {
        if (ageCtx._chartInstance) ageCtx._chartInstance.destroy();

        const chart = new Chart(ageCtx.getContext('2d'), {
            type: 'bar',
            data: {
                labels: data.age_range.map(a => a.age_range),
                datasets: [{
                    label: 'จำนวน (คน)',
                    data: data.age_range.map(a => a.count),
                    backgroundColor: 'rgba(16, 185, 129, 0.8)',
                    borderRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                indexAxis: 'y',
                plugins: { legend: { display: false } }
            }
        });
        ageCtx._chartInstance = chart;
    }

    // Role bar chart
    const roleCtx = document.getElementById('roleChart');
    if (roleCtx && data.role && data.role.length > 0) {
        if (roleCtx._chartInstance) roleCtx._chartInstance.destroy();

        const chart = new Chart(roleCtx.getContext('2d'), {
            type: 'bar',
            data: {
                labels: data.role.map(r => r.role),
                datasets: [{
                    label: 'จำนวน (คน)',
                    data: data.role.map(r => r.count),
                    backgroundColor: 'rgba(245, 158, 11, 0.8)',
                    borderRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                indexAxis: 'y',
                plugins: { legend: { display: false } }
            }
        });
        roleCtx._chartInstance = chart;
    }
}

function renderQuestionTable(questions) {
    const tbody = document.getElementById('questionStatsTable');
    if (!tbody || !questions) return;

    tbody.innerHTML = questions.map((q, i) => `
        <tr>
            <td style="text-align:center;">${i + 1}</td>
            <td>${q.question_text}</td>
            <td style="text-align:center; font-weight:600;">${parseFloat(q.avg_rating || 0).toFixed(2)}</td>
            <td style="text-align:center;">${q.min_rating || '-'}</td>
            <td style="text-align:center;">${q.max_rating || '-'}</td>
            <td style="text-align:center;">${parseFloat(q.std_dev || 0).toFixed(2)}</td>
            <td style="text-align:center;">${q.count || 0}</td>
        </tr>
    `).join('');
}

async function exportToSpss() {
    if (!currentSurveyId) {
        showToast('กรุณาเลือกแบบประเมินก่อน', 'warning');
        return;
    }

    const buttons = [
        document.getElementById('exportSpssBtn'),
        document.getElementById('mobileSpssExportBtn')
    ].filter(Boolean);
    const originalContent = buttons.map(button => button.innerHTML);

    try {
        buttons.forEach(button => {
            button.disabled = true;
            button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> <span>กำลังสร้าง...</span>';
        });
        showToast('กำลังสร้างไฟล์ SPSS พร้อมป้ายกำกับตัวแปร...', 'info');

        const response = await fetch(`../api/spss_export.php?id=${encodeURIComponent(currentSurveyId)}`, {
            credentials: 'same-origin'
        });
        if (!response.ok) {
            let message = 'ไม่สามารถสร้างไฟล์ SPSS ได้';
            try {
                const errorData = await response.json();
                message = errorData.message || message;
            } catch (_) {
                // ใช้ข้อความมาตรฐานเมื่อเซิร์ฟเวอร์ไม่ได้ตอบกลับเป็น JSON
            }
            throw new Error(message);
        }

        const blob = await response.blob();
        if (blob.size === 0) {
            throw new Error('ไฟล์ SPSS ที่สร้างไม่มีข้อมูล');
        }

        let fileName = `SPSS_Survey_${currentSurveyId}_${new Date().toISOString().slice(0, 10)}.sav`;
        const disposition = response.headers.get('Content-Disposition') || '';
        const utf8Name = disposition.match(/filename\*=UTF-8''([^;]+)/i);
        if (utf8Name) {
            fileName = decodeURIComponent(utf8Name[1]);
        }

        const objectUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = objectUrl;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
        showToast('ส่งออกไฟล์ SPSS (.sav) สำเร็จ พร้อมนำไปวิเคราะห์ต่อ', 'success');
    } catch (error) {
        console.error('SPSS export error:', error);
        showToast(error.message || 'เกิดข้อผิดพลาดในการส่งออก SPSS', 'error');
    } finally {
        buttons.forEach((button, index) => {
            button.disabled = false;
            button.innerHTML = originalContent[index];
        });
    }
}

async function exportToExcel() {
    if (!currentSurveyId) {
        showToast('กรุณาเลือกแบบประเมินก่อน', 'warning');
        return;
    }

    try {
        showToast('กำลังเตรียมข้อมูลสำหรับส่งออก...', 'info');

        const res = await api(`../api/stats.php?type=export&id=${currentSurveyId}`);
        if (!res || !res.success) {
            showToast('ไม่สามารถโหลดข้อมูลได้', 'error');
            return;
        }

        const exportData = res.data;
        const wb = XLSX.utils.book_new();

        // Sheet 1: Summary
        const summaryRows = [
            ['รายงานผลสถิติแบบประเมิน'],
            ['ชื่อแบบประเมิน', exportData.survey],
            ['จำนวนผู้ตอบ', (exportData.data || []).length + ' คน'],
            [],
            ['ลำดับ', 'หัวข้อ', 'คะแนนเฉลี่ย', 'ต่ำสุด', 'สูงสุด', 'จำนวน']
        ];
        (exportData.summary || []).forEach((s, i) => {
            summaryRows.push([i + 1, s.question, s.avg, s.min, s.max, s.count]);
        });
        const ws_summary = XLSX.utils.aoa_to_sheet(summaryRows);
        XLSX.utils.book_append_sheet(wb, ws_summary, 'สรุปผล');

        // Sheet 2: Raw Data
        if (exportData.data && exportData.data.length > 0) {
            const ws_data = XLSX.utils.json_to_sheet(exportData.data);
            XLSX.utils.book_append_sheet(wb, ws_data, 'ข้อมูลดิบ');
        }

        // Sheet 3: Statistics (from current stats data)
        if (currentStatsData && currentStatsData.questions) {
            const statsRows = [
                ['ข้อ', 'หัวข้อ', 'คะแนนเฉลี่ย', 'ต่ำสุด', 'สูงสุด', 'S.D.', 'จำนวน']
            ];
            currentStatsData.questions.forEach((q, i) => {
                statsRows.push([
                    i + 1,
                    q.question_text,
                    parseFloat(q.avg_rating || 0).toFixed(2),
                    q.min_rating || '',
                    q.max_rating || '',
                    parseFloat(q.std_dev || 0).toFixed(2),
                    q.count || 0
                ]);
            });
            const ws_stats = XLSX.utils.aoa_to_sheet(statsRows);
            XLSX.utils.book_append_sheet(wb, ws_stats, 'สถิติรายข้อ');
        }

        // Generate and download file
        const fileName = `รายงานผล_${exportData.survey || 'survey'}_${new Date().toISOString().slice(0, 10)}.xlsx`;
        XLSX.writeFile(wb, fileName);
        showToast('ส่งออกไฟล์ Excel สำเร็จ', 'success');

    } catch (error) {
        console.error('Export error:', error);
        showToast('เกิดข้อผิดพลาดในการส่งออกไฟล์', 'error');
    }
}
