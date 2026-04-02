/* =========================================================
   script.js — Interactivity
   1) Mobile nav toggle
   2) Thank-you reveal 
   3) Footer year
   4) Carousel: arrows + keyboard + swipe + dots
   5) Theme toggle (light/dark) with localStorage
   6) Active section highlighting in nav via IntersectionObserver
   ========================================================= */

/* 1) MOBILE NAV TOGGLE */
const toggle = document.querySelector('.nav_toggle');
const menu = document.querySelector('#navmenu');
if (toggle && menu) {
  toggle.addEventListener('click', () => {
    const open = menu.getAttribute('data-open') === 'true';
    menu.setAttribute('data-open', String(!open));
    toggle.setAttribute('aria-expanded', String(!open));
  });
}

/* 2) THANK-YOU (PayPal) */
function showThankYouMessage(){
  const box = document.getElementById('thank-you-message');
  if (box) box.hidden = false;
}
window.showThankYouMessage = showThankYouMessage;

/* 3) FOOTER YEAR */
const yearEl = document.getElementById('year');
if (yearEl) yearEl.textContent = new Date().getFullYear();

/* 4) CAROUSEL (with dots) */
(function initCarousel(){
  const track = document.getElementById('carousel-track');
  if (!track) return;

  const slides  = Array.from(track.querySelectorAll('.slide'));
  const prevBtn = document.querySelector('.carousel_btn.prev');
  const nextBtn = document.querySelector('.carousel_btn.next');
  const status  = document.querySelector('.carousel_status');

  // Create dots container
  const dotsWrap = document.createElement('div');
  dotsWrap.className = 'carousel_dots';
  const carousel = track.closest('.carousel');
  carousel.appendChild(dotsWrap);

  // Build dots (one per slide)
  const dots = slides.map((_, i) => {
    const dot = document.createElement('button');
    dot.className = 'carousel_dot';
    dot.type = 'button';
    dot.setAttribute('aria-label', `Go to slide ${i+1}`);
    dot.addEventListener('click', () => goTo(i));
    dotsWrap.appendChild(dot);
    return dot;
  });

    let index = slides.findIndex(s => s.classList.contains('is-current'));
    if (index < 0) index = 0;

  function updateAriaLabels() {
    const total = slides.length;
    slides.forEach((slide, i) => {
      slide.setAttribute('aria-roledescription','slide');
      slide.setAttribute('role','group');
      slide.setAttribute('aria-label', `${i+1} of ${total}`);
    });
  }

  function renderDots(){
    dots.forEach((d, i) => d.setAttribute('aria-current', String(i === index)));
  }

  function goTo(i){
    const total = slides.length;
    index = Math.max(0, Math.min(i, total - 1));
    const offset = -index * 100;
    track.style.transform = `translateX(${offset}%)`;

    slides.forEach(s => s.classList.remove('is-current'));
    slides[index].classList.add('is-current');

    if (prevBtn) prevBtn.disabled = (index === 0);
    if (nextBtn) nextBtn.disabled = (index === total - 1);
    if (status) status.textContent = `Slide ${index+1} of ${total}`;

    renderDots();
  }

  function next(){ goTo(index + 1); }
  function prev(){ goTo(index - 1); }

  if (nextBtn) nextBtn.addEventListener('click', next);
  if (prevBtn) prevBtn.addEventListener('click', prev);

  // Keyboard
  if (carousel) {
    if (!carousel.hasAttribute('tabindex')) carousel.setAttribute('tabindex','0');
    carousel.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') { e.preventDefault(); next(); }
      if (e.key === 'ArrowLeft')  { e.preventDefault(); prev(); }
    });
  }

  // Swipe (pointer)
  let startX = null;
  track.addEventListener('pointerdown', (e) => { startX = e.clientX; });
  track.addEventListener('pointerup', (e) => {
    if (startX === null) return;
    const dx = e.clientX - startX;
    const threshold = 40;
    if (dx < -threshold) next();
    if (dx >  threshold) prev();
    startX = null;
  });

  updateAriaLabels();
  goTo(index);
})();

/* 5) THEME TOGGLE (light/dark) */
(function initThemeToggle(){
  const root = document.documentElement;

  // Initialize from saved preference, else prefer light
  const saved = localStorage.getItem('theme');
  if (saved === 'dark') root.setAttribute('data-theme','dark');

  // Inject a small toggle button into the header (right side)
  const hdr = document.querySelector('.header-inner');
  if (!hdr) return;
  const btn = document.createElement('button');
  btn.className = 'theme-toggle';
  btn.type = 'button';
  btn.title = 'Toggle theme';
  btn.setAttribute('aria-label','Toggle light/dark theme');
  btn.textContent = root.getAttribute('data-theme') === 'dark' ? '🌙 Dark' : '☀️ Light';
  hdr.appendChild(btn);

  btn.addEventListener('click', () => {
    const dark = root.getAttribute('data-theme') === 'dark';
    if (dark) {
      root.removeAttribute('data-theme');
      localStorage.setItem('theme','light');
      btn.textContent = '☀️ Light';
    } else {
      root.setAttribute('data-theme','dark');
      localStorage.setItem('theme','dark');
      btn.textContent = '🌙 Dark';
    }
  });
})();

/* 6) ACTIVE SECTION HIGHLIGHT IN NAV
   - As you scroll, the matching nav link gets .is-active
*/
(function initActiveLinks(){
  const links = Array.from(document.querySelectorAll('.nav_list a[href^="#"]'));
  if (!links.length) return;

  const map = new Map(); // sectionId -> linkEl
  links.forEach(a => {
    const id = a.getAttribute('href').slice(1);
    const el = document.getElementById(id);
    if (el) map.set(id, a);
  });

  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      const id = entry.target.id;
      const link = map.get(id);
      if (!link) return;
      if (entry.isIntersecting) {
        links.forEach(l => l.classList.remove('is-active'));
        link.classList.add('is-active');
      }
    });
  }, { rootMargin: '-40% 0px -55% 0px', threshold: 0.0 });

  map.forEach((_, id) => {
    const section = document.getElementById(id);
    if (section) io.observe(section);
  });
})();

let selectedAmount = 0;
const amountButtons = document.querySelectorAll('.donation-btn');
const customAmountInput = document.getElementById('custom-amount');
const donateBtn = document.getElementById('custom-donate-btn');
const donationStatus = document.getElementById('donation-status');

function setDonationStatus(message, state = 'info') {
  if (!donationStatus) {
    return;
  }

  donationStatus.textContent = message;
  donationStatus.dataset.state = state;
}

function clearDonationStatus() {
  if (!donationStatus) {
    return;
  }

  donationStatus.textContent = '';
  delete donationStatus.dataset.state;
}

function updateDonateButtonState() {
  if (!donateBtn) {
    return;
  }

  donateBtn.disabled = !Number.isInteger(selectedAmount) || selectedAmount < 100;
}

function showSelectedAmount() {
  if (!selectedAmount) {
    clearDonationStatus();
    return;
  }

  setDonationStatus(`Selected donation: $${(selectedAmount / 100).toFixed(2)}`, 'info');
}

function usePresetAmount(amountInCents, button) {
  selectedAmount = amountInCents;

  if (customAmountInput) {
    customAmountInput.value = '';
    customAmountInput.removeAttribute('aria-invalid');
  }

  amountButtons.forEach(item => item.classList.remove('is-selected'));
  button.classList.add('is-selected');

  showSelectedAmount();
  updateDonateButtonState();
}

function useCustomAmount(rawValue) {
  const dollars = Number(rawValue);

  amountButtons.forEach(item => item.classList.remove('is-selected'));

  if (!rawValue) {
    selectedAmount = 0;
    customAmountInput.removeAttribute('aria-invalid');
    clearDonationStatus();
    updateDonateButtonState();
    return;
  }

  if (!Number.isFinite(dollars) || dollars <= 0) {
    selectedAmount = 0;
    customAmountInput.setAttribute('aria-invalid', 'true');
    setDonationStatus('Enter a valid dollar amount greater than $0.00.', 'error');
    updateDonateButtonState();
    return;
  }

  selectedAmount = Math.round(dollars * 100);

  if (selectedAmount < 100) {
    customAmountInput.setAttribute('aria-invalid', 'true');
    setDonationStatus('The minimum donation is $1.00.', 'error');
    updateDonateButtonState();
    return;
  }

  customAmountInput.removeAttribute('aria-invalid');
  showSelectedAmount();
  updateDonateButtonState();
}

amountButtons.forEach(button => {
  button.addEventListener('click', () => {
    usePresetAmount(Number(button.dataset.amount), button);
  });
});

if (customAmountInput) {
  customAmountInput.addEventListener('input', () => {
    useCustomAmount(customAmountInput.value);
  });
}

if (donateBtn) {
  donateBtn.addEventListener('click', async () => {
    if (!selectedAmount || selectedAmount < 100) {
      setDonationStatus('Please choose at least $1.00 before donating.', 'error');
      return;
    }

    setDonationStatus('Creating secure checkout...', 'loading');
    donateBtn.disabled = true;

    try {
      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ amount: selectedAmount }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Unable to start Stripe checkout.');
      }

      window.location.href = data.url;
    } catch (error) {
      setDonationStatus(error.message, 'error');
    } finally {
      updateDonateButtonState();
    }
  });
}

(function showDonationResult() {
  const params = new URLSearchParams(window.location.search);
  const result = params.get('donation');

  if (!result || !donationStatus) {
    return;
  }

  if (result === 'success') {
    setDonationStatus('Thank you. Your donation was completed successfully.', 'success');
    donationStatus.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  if (result === 'cancelled') {
    setDonationStatus('Donation cancelled. You can try again whenever you are ready.', 'error');
    donationStatus.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
})();

updateDonateButtonState();

