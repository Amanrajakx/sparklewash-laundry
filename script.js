/* ============================================================
   SparkleWash – Interactive JavaScript
   ============================================================ */

'use strict';

// ---- Utility ----
const $ = (sel, scope = document) => scope.querySelector(sel);
const $$ = (sel, scope = document) => [...scope.querySelectorAll(sel)];

// ---- Navbar scroll behavior ----
(function initNavbar() {
  const navbar = $('#navbar');
  const navLinks = $$('.nav-link');

  window.addEventListener('scroll', () => {
    if (window.scrollY > 40) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }
    updateActiveNavLink();
  }, { passive: true });

  function updateActiveNavLink() {
    const sections = $$('section[id]');
    const scrollY = window.scrollY + 100;

    sections.forEach(section => {
      const sectionTop = section.offsetTop;
      const sectionHeight = section.offsetHeight;

      if (scrollY >= sectionTop && scrollY < sectionTop + sectionHeight) {
        const id = section.getAttribute('id');
        navLinks.forEach(link => {
          link.classList.remove('active');
          if (link.getAttribute('href') === `#${id}`) {
            link.classList.add('active');
          }
        });
      }
    });
  }
})();

// ---- Mobile Hamburger Menu ----
(function initMobileMenu() {
  const hamburger = $('#hamburger');
  const navLinks = $('#nav-links');

  hamburger.addEventListener('click', () => {
    const isOpen = navLinks.classList.toggle('open');
    hamburger.setAttribute('aria-expanded', isOpen.toString());
  });

  // Close menu when a link is clicked
  $$('.nav-link').forEach(link => {
    link.addEventListener('click', () => {
      navLinks.classList.remove('open');
      hamburger.setAttribute('aria-expanded', 'false');
    });
  });
})();

// ---- Pricing Toggle ----
(function initPricingToggle() {
  const perItemBtn = $('#toggle-per-item');
  const bundleBtn = $('#toggle-bundle');
  const perItemGrid = $('#per-item-pricing');
  const bundleGrid = $('#bundle-pricing');

  perItemBtn.addEventListener('click', () => {
    perItemBtn.classList.add('active');
    perItemBtn.setAttribute('aria-pressed', 'true');
    bundleBtn.classList.remove('active');
    bundleBtn.setAttribute('aria-pressed', 'false');
    perItemGrid.classList.remove('hidden');
    bundleGrid.classList.add('hidden');
  });

  bundleBtn.addEventListener('click', () => {
    bundleBtn.classList.add('active');
    bundleBtn.setAttribute('aria-pressed', 'true');
    perItemBtn.classList.remove('active');
    perItemBtn.setAttribute('aria-pressed', 'false');
    bundleGrid.classList.remove('hidden');
    perItemGrid.classList.add('hidden');
  });
})();

// ---- Booking Form ----
(function initBookingForm() {
  const form = $('#booking-form');
  const submitBtn = $('#submit-booking');
  const btnText = submitBtn.querySelector('.btn-text');
  const btnLoading = submitBtn.querySelector('.btn-loading');

  // Set minimum date to today
  const pickupDateInput = $('#pickup-date');
  if (pickupDateInput) {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    pickupDateInput.setAttribute('min', `${yyyy}-${mm}-${dd}`);
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!validateForm(form)) return;

    // Show loading state
    btnText.classList.add('hidden');
    btnLoading.classList.remove('hidden');
    btnLoading.classList.add('visible');
    submitBtn.disabled = true;

    try {
      // Send booking to the backend API
      const payload = {
        fullName: $('#full-name').value.trim(),
        phone: $('#phone').value.trim(),
        address: $('#address').value.trim(),
        service: $('#service').value,
        pickupDate: $('#pickup-date').value,
        pickupTime: $('#pickup-time').value,
        notes: ($('#notes').value || '').trim(),
        estimatedTotal: parseInt($('#calc-total').textContent.replace('₹', '')) || 0,
        customerEmail: ($('#customer-email') ? $('#customer-email').value.trim() : '')
      };

      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (data.success) {
        showToast(`🎉 Booking ${data.booking.bookingRef} confirmed! We'll contact you shortly.`, 'success', 15000);
        form.reset();
        resetCalculator();
      } else {
        const errMsg = data.errors ? data.errors.join(' ') : (data.error || 'Booking failed. Please try again.');
        showToast('❌ ' + errMsg, 'error');
      }
    } catch (err) {
      // Fallback if running as a static file without the backend
      showToast('⚠️ Could not connect to server. Please call us directly!', 'error');
      console.error('Booking API error:', err);
    } finally {
      // Reset loading state
      btnText.classList.remove('hidden');
      btnLoading.classList.remove('visible');
      btnLoading.classList.add('hidden');
      submitBtn.disabled = false;
    }
  });

  // ---- Pricing Calculator Logic ----
  const CALC_ITEMS = [
    { id: 'shirt', name: 'Shirt / T-Shirt', price: 15, icon: '👕' },
    { id: 'pant', name: 'Pants / Jeans', price: 20, icon: '👖' },
    { id: 'suit', name: 'Suit (2pc)', price: 150, icon: '🤵' },
    { id: 'saree', name: 'Saree', price: 80, icon: '🥻' },
    { id: 'bedsheet', name: 'Bedsheet', price: 50, icon: '🛏️' },
    { id: 'curtain', name: 'Curtain (per panel)', price: 100, icon: '🏠' },
    { id: 'jacket', name: 'Jacket / Coat', price: 120, icon: '🧥' },
    { id: 'blanket', name: 'Blanket / Duvet', price: 250, icon: '☁️' }
  ];

  let selectedItems = {};

  function initCalculator() {
    const container = $('#calc-items-container');
    if (!container) return;

    container.innerHTML = CALC_ITEMS.map(item => `
      <div class="calc-item" data-id="${item.id}">
        <span class="item-icon">${item.icon}</span>
        <span class="item-name">${item.name}</span>
        <span class="item-price">₹${item.price} / piece</span>
        <div class="item-controls">
          <button class="qty-btn minus" onclick="updateQty('${item.id}', -1)">-</button>
          <span class="item-qty" id="qty-${item.id}">0</span>
          <button class="qty-btn plus" onclick="updateQty('${item.id}', 1)">+</button>
        </div>
      </div>
    `).join('');
  }

  window.updateQty = (id, delta) => {
    if (!selectedItems[id]) selectedItems[id] = 0;
    selectedItems[id] = Math.max(0, selectedItems[id] + delta);
    $(`#qty-${id}`).textContent = selectedItems[id];
    updateSummary();
  };

  function updateSummary() {
    const summaryList = $('#summary-items');
    const totalEl = $('#calc-total');
    let total = 0;
    let html = '';

    CALC_ITEMS.forEach(item => {
      const qty = selectedItems[item.id] || 0;
      if (qty > 0) {
        const itemTotal = qty * item.price;
        total += itemTotal;
        html += `
          <div class="summary-item">
            <span>${item.name} x ${qty}</span>
            <span>₹${itemTotal}</span>
          </div>
        `;
      }
    });

    if (total === 0) {
      summaryList.innerHTML = '<p class="empty-msg">No items selected</p>';
    } else {
      summaryList.innerHTML = html;
    }
    totalEl.textContent = `₹${total}`;
  }

  function resetCalculator() {
    selectedItems = {};
    CALC_ITEMS.forEach(item => {
      const qtyEl = $(`#qty-${item.id}`);
      if (qtyEl) qtyEl.textContent = '0';
    });
    updateSummary();
  }

  initCalculator();

  const STATUS_STEPS = ['pending', 'confirmed', 'picked_up', 'washing', 'ready', 'delivered'];
  const STEP_LABELS = ['Pending', 'Confirmed', 'Picked Up', 'Washing', 'Ready', 'Delivered'];
  const STEP_ICONS = ['📋', '✅', '🚗', '🫧', '📦', '🎁'];

  window.publicTrackOrder = async () => {
    const refInput = $('#public-track-ref');
    const resultDiv = $('#public-track-result');
    const ref = refInput.value.trim().toUpperCase();

    if (!ref) {
      showToast('Please enter a booking reference.', 'error');
      return;
    }

    resultDiv.classList.add('hidden');

    try {
      const res = await fetch(`/api/orders/track/${ref}`);
      const data = await res.json();

      if (data.success) {
        const order = data.order;
        const statusIndex = STATUS_STEPS.indexOf(order.status);

        let html = `
          <span class="result-status-text">Order Status: ${order.status.replace('_', ' ').toUpperCase()}</span>
          <div class="tracking-visual">
            <div class="progress-wrap">
              <div class="progress-steps">
                ${STATUS_STEPS.map((s, i) => {
          const isDone = i < statusIndex;
          const isCurrent = i === statusIndex;
          const stepClass = isDone ? 'done' : isCurrent ? 'current' : '';
          return `
                    <div class="progress-step ${stepClass}">
                      <div class="step-line ${isDone ? 'done' : ''}"></div>
                      <div class="step-icon-wrap">
                        <i>${STEP_ICONS[i]}</i>
                      </div>
                      <div class="step-label">${STEP_LABELS[i]}</div>
                    </div>`;
        }).join('')}
              </div>
            </div>
          </div>
          <p style="color:var(--text-secondary); font-size:13px;">Customer: ${order.full_name} | Service: ${order.service}</p>
        `;

        resultDiv.innerHTML = html;
        resultDiv.classList.remove('hidden');
        resultDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } else {
        showToast(data.error || 'Booking not found.', 'error');
      }
    } catch (err) {
      showToast('Could not connect to server.', 'error');
    }
  };

  function validateForm(form) {
    let isValid = true;
    const requiredFields = $$('[required]', form);

    requiredFields.forEach(field => {
      removeError(field);
      if (!field.value.trim()) {
        showError(field, 'This field is required.');
        isValid = false;
      }
    });

    // Phone validation
    const phone = $('#phone');
    if (phone && phone.value.trim()) {
      const cleaned = phone.value.replace(/\s/g, '');
      if (!/^[\+]?[0-9]{10,13}$/.test(cleaned)) {
        showError(phone, 'Please enter a valid phone number.');
        isValid = false;
      }
    }

    return isValid;
  }

  function showError(field, message) {
    field.style.borderColor = 'hsl(0, 70%, 55%)';
    field.style.boxShadow = '0 0 0 3px hsla(0, 70%, 55%, 0.2)';

    const existingError = field.parentElement.querySelector('.field-error');
    if (!existingError) {
      const errorEl = document.createElement('span');
      errorEl.className = 'field-error';
      errorEl.style.cssText = 'font-size: 12px; color: hsl(0, 70%, 60%); margin-top: -4px; font-weight: 500;';
      errorEl.textContent = message;
      field.parentElement.appendChild(errorEl);
    }
  }

  function removeError(field) {
    field.style.borderColor = '';
    field.style.boxShadow = '';
    const errorEl = field.parentElement.querySelector('.field-error');
    if (errorEl) errorEl.remove();
  }
})();

// ---- Toast Notification ----
function showToast(message, type = 'info', duration = 4000) {
  const toast = $('#toast');
  toast.textContent = message;
  toast.className = `toast ${type}`;
  toast.classList.remove('hidden');

  setTimeout(() => {
    toast.classList.add('hidden');
  }, duration);
}

// ---- Scroll to Top Button ----
(function initScrollTop() {
  const scrollTopBtn = $('#scroll-top-btn');

  window.addEventListener('scroll', () => {
    if (window.scrollY > 400) {
      scrollTopBtn.classList.remove('hidden');
    } else {
      scrollTopBtn.classList.add('hidden');
    }
  }, { passive: true });

  scrollTopBtn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
})();

// ---- Scroll Reveal Animations ----
(function initScrollReveal() {
  // Add reveal class to relevant elements
  const revealTargets = [
    { selector: '.service-card', delayBase: 0 },
    { selector: '.step', delayBase: 0 },
    { selector: '.price-card', delayBase: 0 },
    { selector: '.testimonial-card', delayBase: 0 },
    { selector: '.contact-card', delayBase: 0 },
    { selector: '.section-header', delayBase: 0 },
    { selector: '.booking-info', delayBase: 0 },
    { selector: '.booking-form', delayBase: 0 },
  ];

  revealTargets.forEach(({ selector }) => {
    $$(selector).forEach((el, i) => {
      el.classList.add('reveal');
      if (i < 4) el.classList.add(`reveal-delay-${i + 1}`);
    });
  });

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -60px 0px' });

  $$('.reveal').forEach(el => observer.observe(el));
})();

// ---- Smooth scroll for all anchor links ----
(function initSmoothScroll() {
  $$('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', (e) => {
      const href = anchor.getAttribute('href');
      if (href === '#') return;

      const target = $(href);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });
})();

// ---- Counter Animation ----
(function initCounters() {
  const statNumbers = $$('.stat-number');
  let animated = false;

  const observer = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting && !animated) {
      animated = true;
      statNumbers.forEach(el => {
        const text = el.textContent;
        const num = parseFloat(text.replace(/[^0-9.]/g, ''));
        const suffix = text.replace(/[0-9.]/g, '');
        animateCounter(el, 0, num, suffix, 1500);
      });
    }
  }, { threshold: 0.5 });

  const heroSection = $('.hero-stats');
  if (heroSection) observer.observe(heroSection);

  function animateCounter(el, start, end, suffix, duration) {
    const startTime = performance.now();

    function update(currentTime) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = start + (end - start) * eased;

      if (suffix.includes('K')) {
        el.textContent = Math.round(current) + 'K+';
      } else if (suffix.includes('%')) {
        el.textContent = Math.round(current) + '%';
      } else if (suffix.includes('hr')) {
        el.textContent = Math.round(current) + 'hr';
      } else {
        el.textContent = Math.round(current) + suffix;
      }

      if (progress < 1) requestAnimationFrame(update);
    }

    requestAnimationFrame(update);
  }
})();

// ---- Utility: Delay ----
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ---- Service card hover ripple ----
(function initRipple() {
  $$('.service-card, .price-card, .contact-card').forEach(card => {
    card.addEventListener('click', function (e) {
      const ripple = document.createElement('span');
      const rect = this.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height);

      ripple.style.cssText = `
        position: absolute;
        width: ${size}px;
        height: ${size}px;
        border-radius: 50%;
        background: radial-gradient(circle, rgba(0, 120, 255, 0.15), transparent);
        left: ${e.clientX - rect.left - size / 2}px;
        top: ${e.clientY - rect.top - size / 2}px;
        transform: scale(0);
        animation: rippleEffect 0.6s ease-out forwards;
        pointer-events: none;
        z-index: 0;
      `;

      this.style.position = 'relative';
      this.appendChild(ripple);

      setTimeout(() => ripple.remove(), 700);
    });
  });

  // Add ripple keyframe
  const style = document.createElement('style');
  style.textContent = `
    @keyframes rippleEffect {
      to { transform: scale(2); opacity: 0; }
    }
  `;
  document.head.appendChild(style);
})();

// ---- Page Load Animation ----
document.addEventListener('DOMContentLoaded', () => {
  document.body.style.opacity = '0';
  document.body.style.transition = 'opacity 0.5s ease';

  requestAnimationFrame(() => {
    document.body.style.opacity = '1';
  });
});