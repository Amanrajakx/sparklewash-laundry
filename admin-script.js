/* ============================================================
   SparkleWash – Admin Dashboard JavaScript
   ============================================================ */
'use strict';

const API = '/api';

// ---- State ----
let currentFilter = 'all';
let currentPage   = 1;
let totalPages    = 1;
let searchTimeout = null;
let autoRefreshTimer = null;

const SERVICE_LABELS = {
  'wash-fold':   '🫧 Wash & Fold',
  'dry-clean':   '👔 Dry Cleaning',
  'ironing':     '👗 Steam Ironing',
  'bedding':     '🛏️ Bedding & Linen',
  'alterations': '🧵 Alterations',
  'express':     '⚡ Express Service'
};

const STATUS_OPTIONS = [
  { value: 'pending',   label: '⏳ Pending' },
  { value: 'confirmed', label: '✅ Confirmed' },
  { value: 'picked_up', label: '🚗 Picked Up' },
  { value: 'washing',   label: '🫧 Washing' },
  { value: 'ready',     label: '📦 Ready' },
  { value: 'delivered', label: '🎁 Delivered' },
  { value: 'cancelled', label: '❌ Cancelled' }
];

// ---- DOM References ----
const loginOverlay  = document.getElementById('login-overlay');
const dashboard     = document.getElementById('dashboard');
const loginForm     = document.getElementById('login-form');
const loginError    = document.getElementById('login-error');
const logoutBtn     = document.getElementById('logout-btn');
const adminLabel    = document.getElementById('admin-username-label');
const refreshBtn    = document.getElementById('refresh-btn');
const searchInput   = document.getElementById('search-input');
const bookingsTbody = document.getElementById('bookings-tbody');
const tableCount    = document.getElementById('table-count');
const emptyState    = document.getElementById('empty-state');
const filterBtns    = document.querySelectorAll('.filter-btn');
const prevPageBtn   = document.getElementById('prev-page');
const nextPageBtn   = document.getElementById('next-page');
const pageInfo      = document.getElementById('page-info');
const pendingCount  = document.getElementById('pending-count');
const modalOverlay  = document.getElementById('modal-overlay');
const modalBody     = document.getElementById('modal-body');
const modalClose    = document.getElementById('modal-close');
const toast         = document.getElementById('toast');

// ---- Init ----
(async function init() {
  const res = await apiFetch('/auth/me');
  if (res.loggedIn) {
    showDashboard(res.username);
    await loadStats();
    await loadBookings();
    startAutoRefresh();
  } else {
    showLogin();
  }
})();

// ---- Auth ----
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value;

  const loginBtn = document.getElementById('login-btn');
  loginBtn.disabled = true;
  loginBtn.querySelector('.btn-text').classList.add('hidden');
  loginBtn.querySelector('.btn-loading').classList.remove('hidden');
  loginError.classList.add('hidden');

  try {
    const data = await apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });

    if (data.success) {
      showDashboard(data.username);
      await loadStats();
      await loadBookings();
      startAutoRefresh();
    } else {
      loginError.textContent = data.error || 'Login failed.';
      loginError.classList.remove('hidden');
    }
  } catch {
    loginError.textContent = 'Could not connect to server.';
    loginError.classList.remove('hidden');
  } finally {
    loginBtn.disabled = false;
    loginBtn.querySelector('.btn-text').classList.remove('hidden');
    loginBtn.querySelector('.btn-loading').classList.add('hidden');
  }
});

logoutBtn.addEventListener('click', async () => {
  await apiFetch('/auth/logout', { method: 'POST' });
  stopAutoRefresh();
  showLogin();
});

function showLogin() {
  loginOverlay.classList.remove('hidden');
  dashboard.classList.add('hidden');
}

function showDashboard(username) {
  loginOverlay.classList.add('hidden');
  dashboard.classList.remove('hidden');
  adminLabel.textContent = `👤 ${username}`;
}

// ---- Stats ----
async function loadStats() {
  try {
    const data = await apiFetch('/bookings/stats');
    if (!data.success) return;
    const s = data.stats;
    document.getElementById('stat-total-num').textContent    = s.total;
    document.getElementById('stat-today-num').textContent    = s.today;
    document.getElementById('stat-pending-num').textContent  = s.pending;
    document.getElementById('stat-active-num').textContent   = s.active;
    document.getElementById('stat-delivered-num').textContent= s.delivered;
    pendingCount.textContent = s.pending;
    pendingCount.style.display = s.pending > 0 ? 'inline-block' : 'none';
  } catch {}
}

// ---- Load Bookings ----
async function loadBookings(page = 1) {
  currentPage = page;
  const search = searchInput.value.trim();

  let url = `/bookings?page=${page}&limit=15`;
  if (currentFilter !== 'all') url += `&status=${currentFilter}`;
  if (search) url += `&search=${encodeURIComponent(search)}`;

  showLoadingRow();

  try {
    const data = await apiFetch(url);
    if (!data.success) { showEmptyState(); return; }

    const { bookings, total, limit } = data;
    totalPages = Math.ceil(total / limit) || 1;

    tableCount.textContent = `${total} booking${total !== 1 ? 's' : ''}`;

    if (bookings.length === 0) {
      showEmptyState();
    } else {
      renderBookings(bookings);
    }

    updatePagination();
  } catch {
    showToast('❌ Could not load bookings.', 'error');
    showEmptyState();
  }
}

// ---- Render Bookings ----
function renderBookings(bookings) {
  emptyState.classList.add('hidden');
  document.querySelector('.table-wrapper').style.display = 'block';

  bookingsTbody.innerHTML = bookings.map(b => `
    <tr id="row-${b.id}">
      <td><span class="booking-ref">${escHtml(b.bookingRef)}</span></td>
      <td><span class="customer-name">${escHtml(b.fullName)}</span></td>
      <td><a href="tel:${escHtml(b.phone)}" class="phone-link">${escHtml(b.phone)}</a></td>
      <td>${SERVICE_LABELS[b.service] || b.service}</td>
      <td>${formatDate(b.pickupDate)}<br><small style="color:var(--text-muted)">${escHtml(b.pickupTime)}</small></td>
      <td>${formatDateTime(b.createdAt)}</td>
      <td>
        <select class="status-select" data-id="${b.id}" onchange="updateStatus('${b.id}', this.value)">
          ${STATUS_OPTIONS.map(s =>
            `<option value="${s.value}" ${s.value === b.status ? 'selected' : ''}>${s.label}</option>`
          ).join('')}
        </select>
      </td>
      <td>
        <div class="action-buttons">
          <button class="btn-action view" onclick="viewBooking(${b.id})">👁 View</button>
          <button class="btn-action delete" onclick="deleteBooking(${b.id}, '${escHtml(b.booking_ref)}')">🗑</button>
        </div>
      </td>
    </tr>
  `).join('');
}

function showLoadingRow() {
  emptyState.classList.add('hidden');
  document.querySelector('.table-wrapper').style.display = 'block';
  bookingsTbody.innerHTML = `
    <tr class="loading-row">
      <td colspan="8">
        <div class="loading-spinner">
          <div class="spinner"></div>
          <span>Loading bookings...</span>
        </div>
      </td>
    </tr>`;
}

function showEmptyState() {
  bookingsTbody.innerHTML = '';
  document.querySelector('.table-wrapper').style.display = 'none';
  emptyState.classList.remove('hidden');
}

// ---- Update Status ----
window.updateStatus = async (id, status) => {
  try {
    const data = await apiFetch(`/bookings/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status })
    });

    if (data.success) {
      showToast(`✅ Status updated to "${status.replace('_', ' ')}"`, 'success');
      await loadStats();
    } else {
      showToast('❌ ' + (data.error || 'Failed to update.'), 'error');
    }
  } catch {
    showToast('❌ Connection error.', 'error');
  }
};

// ---- View Booking ----
window.viewBooking = async (id) => {
  try {
    const data = await apiFetch(`/bookings/${id}`);
    if (!data.success) return;

    const b = data.booking;
    modalBody.innerHTML = `
      <div class="detail-row">
        <span class="detail-label">Booking Ref</span>
        <span class="detail-value" style="color: var(--primary-light); font-weight: 700;">${escHtml(b.bookingRef)}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Customer</span>
        <span class="detail-value">${escHtml(b.fullName)}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Phone</span>
        <span class="detail-value"><a href="tel:${escHtml(b.phone)}" style="color: var(--primary-light);">${escHtml(b.phone)}</a></span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Address</span>
        <span class="detail-value">${escHtml(b.address)}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Service</span>
        <span class="detail-value">${SERVICE_LABELS[b.service] || b.service}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Pickup Date</span>
        <span class="detail-value">${formatDate(b.pickupDate)} (${escHtml(b.pickupTime)})</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Estimated Total</span>
        <span class="detail-value" style="color: var(--accent-green); font-weight: 700;">₹${b.estimatedTotal || 0}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Status</span>
        <span class="detail-value">
          <span class="status-badge status-${b.status}">${b.status.replace('_', ' ').toUpperCase()}</span>
        </span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Notes</span>
        <span class="detail-value" style="color: var(--text-secondary); font-style: italic;">${escHtml(b.notes) || 'None'}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Booked At</span>
        <span class="detail-value" style="color: var(--text-muted);">${formatDateTime(b.createdAt)}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Last Updated</span>
        <span class="detail-value" style="color: var(--text-muted);">${formatDateTime(b.updatedAt)}</span>
      </div>
    `;

    modalOverlay.classList.remove('hidden');
  } catch {
    showToast('❌ Could not load booking details.', 'error');
  }
};

// ---- Delete Booking ----
window.deleteBooking = async (id, ref) => {
  const confirmed = window.confirm(`Delete booking ${ref}? This cannot be undone.`);
  if (!confirmed) return;

  try {
    const data = await apiFetch(`/bookings/${id}`, { method: 'DELETE' });
    if (data.success) {
      showToast(`🗑️ Booking ${ref} deleted.`, 'success');
      await loadStats();
      await loadBookings(currentPage);
    } else {
      showToast('❌ ' + (data.error || 'Failed to delete.'), 'error');
    }
  } catch {
    showToast('❌ Connection error.', 'error');
  }
};

// ---- Modal ----
modalClose.addEventListener('click', () => modalOverlay.classList.add('hidden'));
modalOverlay.addEventListener('click', (e) => {
  if (e.target === modalOverlay) modalOverlay.classList.add('hidden');
});

// ---- Filter Buttons ----
filterBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    filterBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentFilter = btn.dataset.status;
    currentPage = 1;
    loadBookings(1);
  });
});

// ---- Search ----
searchInput.addEventListener('input', () => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    currentPage = 1;
    loadBookings(1);
  }, 400);
});

// ---- Refresh ----
refreshBtn.addEventListener('click', async () => {
  refreshBtn.textContent = '⏳';
  await Promise.all([loadStats(), loadBookings(currentPage)]);
  refreshBtn.textContent = '↻ Refresh';
  showToast('✅ Refreshed!', 'success');
});

// ---- Pagination ----
prevPageBtn.addEventListener('click', () => { if (currentPage > 1) loadBookings(currentPage - 1); });
nextPageBtn.addEventListener('click', () => { if (currentPage < totalPages) loadBookings(currentPage + 1); });

function updatePagination() {
  prevPageBtn.disabled = currentPage <= 1;
  nextPageBtn.disabled = currentPage >= totalPages;
  pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
}

// ---- Sidebar Nav ----
document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', (e) => {
    e.preventDefault();
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    item.classList.add('active');

    const tab = item.dataset.tab;
    const tabMap = {
      bookings:  { filter: 'all',       title: 'All Bookings', subtitle: 'Manage all customer bookings' },
      pending:   { filter: 'pending',   title: 'Pending Bookings', subtitle: 'New bookings awaiting confirmation' },
      active:    { filter: 'confirmed', title: 'Active Orders', subtitle: 'Orders currently in process' },
      delivered: { filter: 'delivered', title: 'Delivered Orders', subtitle: 'Successfully completed orders' }
    };

    if (tabMap[tab]) {
      currentFilter = tabMap[tab].filter;
      document.getElementById('page-title').textContent = tabMap[tab].title;
      document.getElementById('page-subtitle').textContent = tabMap[tab].subtitle;
      filterBtns.forEach(b => {
        b.classList.remove('active');
        if (b.dataset.status === currentFilter) b.classList.add('active');
      });
      currentPage = 1;
      loadBookings(1);
    }
  });
});

// ---- Auto Refresh every 60s ----
function startAutoRefresh() {
  autoRefreshTimer = setInterval(async () => {
    await loadStats();
    await loadBookings(currentPage);
  }, 60000);
}

function stopAutoRefresh() {
  if (autoRefreshTimer) clearInterval(autoRefreshTimer);
}

// ---- Utilities ----
async function apiFetch(path, options = {}) {
  const defaults = {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options.headers }
  };
  const res = await fetch(API + path, { ...defaults, ...options });
  return res.json();
}

function showToast(message, type = 'info', duration = 3500) {
  toast.textContent = message;
  toast.className = `toast ${type}`;
  toast.classList.remove('hidden');
  setTimeout(() => toast.classList.add('hidden'), duration);
}

function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatDateTime(dateStr) {
  if (!dateStr) return '—';
  return dateStr.replace('T', ' ').slice(0, 16);
}
