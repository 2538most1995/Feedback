// Common Admin JS - Real API Integration

// Auth check using PHP sessions
async function checkAuth() {
    if (window.location.href.includes('login.html')) return;

    try {
        const res = await fetch('../api/auth.php', { credentials: 'include' });
        const json = await res.json();

        if (!json.success) {
            window.location.href = 'login.html';
            return;
        }

        // Update UI with admin name
        const adminData = json.data;
        const userNameEl = document.querySelector('.user-name');
        if (userNameEl && adminData.fullname) {
            userNameEl.textContent = adminData.fullname;
        }
        const avatarEl = document.querySelector('.user-avatar');
        if (avatarEl && adminData.fullname) {
            avatarEl.textContent = adminData.fullname.substring(0, 2).toUpperCase();
        }
    } catch (err) {
        console.error('Auth check failed:', err);
        window.location.href = 'login.html';
    }
}

// Logout using PHP session
async function logout() {
    try {
        await fetch('../api/auth.php', { method: 'DELETE', credentials: 'include' });
    } catch (e) {
        console.error('Logout error:', e);
    }
    window.location.href = 'login.html';
}

// Sidebar toggle for Mobile & iPad
document.addEventListener('DOMContentLoaded', () => {
    const sidebar = document.getElementById('sidebar');
    const mobileToggle = document.getElementById('mobileToggle');

    let backdrop = document.querySelector('.sidebar-backdrop');
    if (!backdrop) {
        backdrop = document.createElement('div');
        backdrop.className = 'sidebar-backdrop';
        document.body.appendChild(backdrop);
    }

    // Add close button inside sidebar header if not present
    if (sidebar) {
        const logo = sidebar.querySelector('.sidebar-logo');
        if (logo && !logo.querySelector('.sidebar-close-btn')) {
            const logoText = logo.innerHTML;
            logo.innerHTML = `
                <div class="sidebar-logo-brand">${logoText}</div>
                <button type="button" class="sidebar-close-btn" id="sidebarCloseBtn" title="ปิดเมนู">
                    <i class="fas fa-times"></i>
                </button>
            `;
            const closeBtn = logo.querySelector('#sidebarCloseBtn');
            if (closeBtn) {
                closeBtn.addEventListener('click', closeSidebar);
            }
        }
    }

    function openSidebar() {
        if (sidebar) sidebar.classList.add('open');
        if (backdrop) backdrop.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    function closeSidebar() {
        if (sidebar) sidebar.classList.remove('open');
        if (backdrop) backdrop.classList.remove('active');
        document.body.style.overflow = '';
    }

    if (mobileToggle && sidebar) {
        mobileToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            if (sidebar.classList.contains('open')) {
                closeSidebar();
            } else {
                openSidebar();
            }
        });

        if (backdrop) {
            backdrop.addEventListener('click', closeSidebar);
        }

        // Close when clicking nav items on mobile
        document.querySelectorAll('.sidebar-nav .nav-item').forEach(item => {
            item.addEventListener('click', () => {
                if (window.innerWidth <= 1024) {
                    closeSidebar();
                }
            });
        });

        // Close on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && sidebar.classList.contains('open')) {
                closeSidebar();
            }
        });
    }

    // Date formatting - Thai Buddhist year
    const dateDisplay = document.getElementById('currentDate');
    if (dateDisplay) {
        const now = new Date();
        const thaiMonths = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน',
                           'กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
        const thaiDays = ['อาทิตย์','จันทร์','อังคาร','พุธ','พฤหัสบดี','ศุกร์','เสาร์'];
        const day = thaiDays[now.getDay()];
        const date = now.getDate();
        const month = thaiMonths[now.getMonth()];
        const year = now.getFullYear() + 543;
        dateDisplay.textContent = `วัน${day}ที่ ${date} ${month} ${year}`;
    }

    // Set active nav item based on current page
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('.nav-item').forEach(item => {
        const href = item.getAttribute('href');
        if (href === currentPage) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });
});

// Toast notification
function showToast(message, type = 'success') {
    let container = document.getElementById('toastContainer');
    if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container';
        container.id = 'toastContainer';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = 'toast';

    const iconMap = {
        success: 'fas fa-check-circle',
        error: 'fas fa-exclamation-circle',
        warning: 'fas fa-exclamation-triangle',
        info: 'fas fa-info-circle'
    };

    toast.innerHTML = `
        <div class="toast-icon ${type}"><i class="${iconMap[type] || iconMap.info}"></i></div>
        <div class="toast-message">${message}</div>
    `;

    container.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Confirmation modal
function showConfirm(message, onConfirm) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
        <div class="modal-dialog" style="animation: slideUp 0.3s ease;">
            <div style="padding: 2rem; text-align: center;">
                <i class="fas fa-exclamation-triangle" style="font-size: 3rem; color: #F59E0B; margin-bottom: 1rem;"></i>
                <h3 style="margin-bottom: 0.5rem; color: #1E293B;">ยืนยันการดำเนินการ</h3>
                <p style="color: #64748B; margin-bottom: 1.5rem;">${message}</p>
                <div style="display: flex; gap: 1rem; justify-content: center;">
                    <button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">ยกเลิก</button>
                    <button class="btn btn-danger" id="confirmBtn">ยืนยัน</button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);

    overlay.querySelector('#confirmBtn').addEventListener('click', () => {
        overlay.remove();
        if (onConfirm) onConfirm();
    });

    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.remove();
    });
}

// API helper with session credentials
async function api(endpoint, method = 'GET', body = null) {
    try {
        const options = {
            method,
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include'
        };
        if (body) options.body = JSON.stringify(body);

        const response = await fetch(endpoint, options);
        const json = await response.json();

        if (!response.ok && response.status === 401) {
            window.location.href = 'login.html';
            return null;
        }

        return json;
    } catch (error) {
        console.error('API Error:', error);
        showToast('เกิดข้อผิดพลาดในการเชื่อมต่อ', 'error');
        throw error;
    }
}

// Format Thai date
function formatThaiDate(dateStr) {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    if (isNaN(d)) return dateStr;
    const thaiMonthsShort = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
    return `${d.getDate()} ${thaiMonthsShort[d.getMonth()]} ${d.getFullYear() + 543}`;
}

function formatThaiDateTime(dateStr) {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    if (isNaN(d)) return dateStr;
    const thaiMonthsShort = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
    const hours = String(d.getHours()).padStart(2, '0');
    const mins = String(d.getMinutes()).padStart(2, '0');
    return `${d.getDate()} ${thaiMonthsShort[d.getMonth()]} ${d.getFullYear() + 543} ${hours}:${mins}`;
}

// Status badge helper
function statusBadge(status) {
    const map = {
        'published': { label: 'เผยแพร่', cls: 'success' },
        'draft': { label: 'ร่าง', cls: 'draft' },
        'closed': { label: 'ปิด', cls: 'danger' }
    };
    const s = map[status] || { label: status, cls: 'draft' };
    return `<span class="badge ${s.cls}">${s.label}</span>`;
}

// Star rating HTML
function starRating(rating) {
    const full = Math.floor(rating);
    const half = rating - full >= 0.5 ? 1 : 0;
    const empty = 5 - full - half;
    let html = '';
    for (let i = 0; i < full; i++) html += '<i class="fas fa-star" style="color:#F59E0B;"></i>';
    if (half) html += '<i class="fas fa-star-half-alt" style="color:#F59E0B;"></i>';
    for (let i = 0; i < empty; i++) html += '<i class="far fa-star" style="color:#E2E8F0;"></i>';
    return html;
}

// Button loading state helper
function setButtonLoading(btn, isLoading, loadingText = 'กำลังดำเนินการ...') {
    if (!btn) return;
    if (isLoading) {
        btn.dataset.originalHtml = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> <span>${loadingText}</span>`;
    } else {
        btn.disabled = false;
        if (btn.dataset.originalHtml) {
            btn.innerHTML = btn.dataset.originalHtml;
        }
    }
}

// Inline Validation helpers
function showFieldError(inputEl, message) {
    if (!inputEl) return;
    inputEl.classList.remove('is-valid');
    inputEl.classList.add('is-invalid');
    
    let feedback = inputEl.parentNode.querySelector('.invalid-feedback');
    if (!feedback) {
        feedback = document.createElement('div');
        feedback.className = 'invalid-feedback';
        inputEl.parentNode.appendChild(feedback);
    }
    feedback.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${message}`;
    feedback.style.display = 'flex';
}

function clearFieldError(inputEl) {
    if (!inputEl) return;
    inputEl.classList.remove('is-invalid');
    const feedback = inputEl.parentNode.querySelector('.invalid-feedback');
    if (feedback) feedback.style.display = 'none';
}

function markFieldValid(inputEl) {
    if (!inputEl) return;
    inputEl.classList.remove('is-invalid');
    inputEl.classList.add('is-valid');
    const feedback = inputEl.parentNode.querySelector('.invalid-feedback');
    if (feedback) feedback.style.display = 'none';
}

// Empty State HTML renderer
function getEmptyStateHtml({
    icon = 'fas fa-inbox',
    title = 'ไม่พบข้อมูล',
    desc = 'ยังไม่มีข้อมูลที่จะแสดงในขณะนี้',
    actionText = '',
    actionOnClick = '',
    actionIcon = 'fas fa-plus'
} = {}) {
    return `
        <div class="empty-state-card animate-fade">
            <div class="empty-state-icon">
                <i class="${icon}"></i>
            </div>
            <h3 class="empty-state-title">${title}</h3>
            <p class="empty-state-desc">${desc}</p>
            ${actionText ? `
                <div class="empty-state-action">
                    <button type="button" class="btn btn-primary" onclick="${actionOnClick}">
                        <i class="${actionIcon}"></i> ${actionText}
                    </button>
                </div>
            ` : ''}
        </div>
    `;
}

// Responsive Searchable Combobox Component
function createCombobox({
    container,
    options = [],
    value = null,
    placeholder = '-- เลือกรายการ --',
    searchPlaceholder = 'ค้นหา...',
    onChange = null
}) {
    if (typeof container === 'string') {
        container = document.querySelector(container);
    }
    if (!container) return null;

    let selectedValue = value;
    let filteredOptions = [...options];

    const wrapper = document.createElement('div');
    wrapper.className = 'combobox';
    wrapper.innerHTML = `
        <button type="button" class="combobox-btn" aria-haspopup="listbox" aria-expanded="false">
            <span class="combobox-selected-text placeholder">${placeholder}</span>
            <span class="combobox-badge" style="display:none;"></span>
            <i class="fas fa-chevron-down combobox-arrow"></i>
        </button>
        <div class="combobox-dropdown">
            <div class="combobox-search-box">
                <i class="fas fa-search"></i>
                <input type="text" class="combobox-search-input" placeholder="${searchPlaceholder}" autocomplete="off">
            </div>
            <div class="combobox-options" role="listbox"></div>
        </div>
    `;

    container.innerHTML = '';
    container.appendChild(wrapper);

    const btn = wrapper.querySelector('.combobox-btn');
    const selectedText = wrapper.querySelector('.combobox-selected-text');
    const badgeEl = wrapper.querySelector('.combobox-badge');
    const searchInput = wrapper.querySelector('.combobox-search-input');
    const optionsContainer = wrapper.querySelector('.combobox-options');

    function renderOptionsList() {
        if (filteredOptions.length === 0) {
            optionsContainer.innerHTML = '<div class="combobox-empty"><i class="fas fa-search" style="margin-right:6px;"></i> ไม่พบรายการที่ค้นหา</div>';
            return;
        }

        optionsContainer.innerHTML = filteredOptions.map(opt => {
            const isSelected = String(opt.id) === String(selectedValue);
            const badgeHtml = opt.badge !== undefined && opt.badge !== null ? `<span class="combobox-badge">${opt.badge}</span>` : '';
            return `
                <div class="combobox-item ${isSelected ? 'selected' : ''}" data-id="${opt.id}" role="option" aria-selected="${isSelected}">
                    <span class="combobox-item-title">${opt.title}</span>
                    ${badgeHtml}
                </div>
            `;
        }).join('');

        optionsContainer.querySelectorAll('.combobox-item').forEach(itemEl => {
            itemEl.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = itemEl.getAttribute('data-id');
                selectItem(id);
                closeDropdown();
            });
        });
    }

    function selectItem(id, triggerChange = true) {
        selectedValue = id;
        const selectedOpt = options.find(o => String(o.id) === String(id));

        if (selectedOpt) {
            selectedText.textContent = selectedOpt.title;
            selectedText.classList.remove('placeholder');
            if (selectedOpt.badge !== undefined && selectedOpt.badge !== null) {
                badgeEl.textContent = selectedOpt.badge;
                badgeEl.style.display = 'inline-block';
            } else {
                badgeEl.style.display = 'none';
            }
        } else {
            selectedText.textContent = placeholder;
            selectedText.classList.add('placeholder');
            badgeEl.style.display = 'none';
        }

        renderOptionsList();
        if (triggerChange && onChange) {
            onChange(selectedValue, selectedOpt);
        }
    }

    function openDropdown() {
        // Close other open comboboxes
        document.querySelectorAll('.combobox.open').forEach(c => {
            if (c !== wrapper) c.classList.remove('open');
        });

        wrapper.classList.add('open');
        btn.setAttribute('aria-expanded', 'true');
        searchInput.value = '';
        filteredOptions = [...options];
        renderOptionsList();
        setTimeout(() => searchInput.focus(), 50);
    }

    function closeDropdown() {
        wrapper.classList.remove('open');
        btn.setAttribute('aria-expanded', 'false');
    }

    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (wrapper.classList.contains('open')) {
            closeDropdown();
        } else {
            openDropdown();
        }
    });

    searchInput.addEventListener('input', () => {
        const query = searchInput.value.toLowerCase().trim();
        if (!query) {
            filteredOptions = [...options];
        } else {
            filteredOptions = options.filter(o => {
                const matchTitle = (o.title || '').toLowerCase().includes(query);
                const matchCategory = (o.category || '').toLowerCase().includes(query);
                return matchTitle || matchCategory;
            });
        }
        renderOptionsList();
    });

    searchInput.addEventListener('click', (e) => e.stopPropagation());

    document.addEventListener('click', (e) => {
        if (!wrapper.contains(e.target)) {
            closeDropdown();
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && wrapper.classList.contains('open')) {
            closeDropdown();
        }
    });

    // Initial render
    if (selectedValue) {
        selectItem(selectedValue, false);
    } else {
        renderOptionsList();
    }

    return {
        getValue: () => selectedValue,
        setValue: (id, trigger = true) => selectItem(id, trigger),
        updateOptions: (newOptions, newSelectedId = null) => {
            options = newOptions;
            filteredOptions = [...options];
            if (newSelectedId !== null) {
                selectItem(newSelectedId, false);
            } else if (selectedValue) {
                selectItem(selectedValue, false);
            } else {
                selectedText.textContent = placeholder;
                selectedText.classList.add('placeholder');
                badgeEl.style.display = 'none';
                renderOptionsList();
            }
        }
    };
}

