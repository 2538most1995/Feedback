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
