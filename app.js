/* ============================================================
   DOORPRIZE FAMGATH — app.js
   Spin wheel logic, state management, canvas rendering
   ============================================================ */

'use strict';

// ── State ──────────────────────────────────────────────────
const State = {
  prizes: [],         // [{ id, emoji, name, slots }]
  participants: [],   // ['Name1', 'Name2', ...]
  winners: {},        // { prizeId: ['Name1', ...] }
  disqualified: [],   // ['Name1', ...] — gugur/tidak hadir
  activePrizeId: null,
  isSpinning: false,
  editingPrizeId: null,
};

// ── Wheel Colors (vibrant segments) ────────────────────────
const WHEEL_COLORS = [
  ['#7C3AED', '#A855F7'],
  ['#0EA5E9', '#38BDF8'],
  ['#10B981', '#34D399'],
  ['#F59E0B', '#FCD34D'],
  ['#EC4899', '#F472B6'],
  ['#F97316', '#FB923C'],
  ['#8B5CF6', '#C4B5FD'],
  ['#06B6D4', '#67E8F9'],
  ['#84CC16', '#BEF264'],
  ['#E11D48', '#FB7185'],
];

// ── Canvas & Animation ─────────────────────────────────────
const canvas  = document.getElementById('wheel-canvas');
const ctx     = canvas.getContext('2d');
let   rotation    = 0;
let   animFrame   = null;
let   spinVelocity = 0;
let   targetRotation = 0;

// Audio context for sound effects
let audioCtx = null;

function getAudioCtx() {
  if (!audioCtx) {
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    } catch(e) {}
  }
  return audioCtx;
}

function playTick() {
  if (!document.getElementById('setting-sound').checked) return;
  try {
    const ctx = getAudioCtx();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(1200, ctx.currentTime);
    gain.gain.setValueAtTime(0.05, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.04);
  } catch(e) {}
}

function playWinSound() {
  if (!document.getElementById('setting-sound').checked) return;
  try {
    const ctx = getAudioCtx();
    if (!ctx) return;
    const notes = [523, 659, 784, 1047];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.12);
      gain.gain.setValueAtTime(0.15, ctx.currentTime + i * 0.12);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.12 + 0.25);
      osc.start(ctx.currentTime + i * 0.12);
      osc.stop(ctx.currentTime + i * 0.12 + 0.3);
    });
  } catch(e) {}
}

// ── Draw Wheel ─────────────────────────────────────────────
function drawWheel(segments, currentRotation) {
  const W = canvas.width;
  const H = canvas.height;
  const cx = W / 2;
  const cy = H / 2;
  const R = Math.min(cx, cy) - 10;

  ctx.clearRect(0, 0, W, H);

  if (!segments || segments.length === 0) {
    // Empty wheel placeholder
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.fillStyle = '#1E1E3A';
    ctx.fill();
    ctx.strokeStyle = 'rgba(139,92,246,0.3)';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();

    // Text in center
    ctx.save();
    ctx.fillStyle = 'rgba(139,92,246,0.5)';
    ctx.font = `bold ${R * 0.12}px Outfit, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Tambah peserta', cx, cy - 16);
    ctx.fillText('untuk memulai', cx, cy + 16);
    ctx.restore();
    return;
  }

  const n = segments.length;
  const sliceAngle = (Math.PI * 2) / n;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(currentRotation - Math.PI / 2);

  segments.forEach((seg, i) => {
    const startAngle = i * sliceAngle;
    const endAngle   = startAngle + sliceAngle;
    const colorPair  = WHEEL_COLORS[i % WHEEL_COLORS.length];

    // Gradient fill
    const gx = Math.cos(startAngle + sliceAngle / 2) * R * 0.5;
    const gy = Math.sin(startAngle + sliceAngle / 2) * R * 0.5;
    const grad = ctx.createRadialGradient(gx * 0.3, gy * 0.3, 0, gx, gy, R);
    grad.addColorStop(0, colorPair[1]);
    grad.addColorStop(1, colorPair[0]);

    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, R, startAngle, endAngle);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // Segment border
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Segment text
    ctx.save();
    ctx.rotate(startAngle + sliceAngle / 2);
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';

    const maxTextWidth = R * 0.7;
    const fontSize = n <= 8 ? 14 : n <= 16 ? 11 : 9;
    ctx.font = `600 ${fontSize}px Outfit, sans-serif`;

    // Text shadow
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillText(truncateText(seg, maxTextWidth, ctx), R - 16 + 1, 1);

    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(truncateText(seg, maxTextWidth, ctx), R - 16, 0);

    ctx.restore();
  });

  // Outer ring
  ctx.beginPath();
  ctx.arc(0, 0, R, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(245,158,11,0.6)';
  ctx.lineWidth = 4;
  ctx.stroke();

  // Inner ring decoration
  ctx.beginPath();
  ctx.arc(0, 0, R - 6, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.restore();
}

function truncateText(text, maxWidth, ctx) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let truncated = text;
  while (ctx.measureText(truncated + '…').width > maxWidth && truncated.length > 0) {
    truncated = truncated.slice(0, -1);
  }
  return truncated + '…';
}

// ── Get Current Segments (non-winners or all) ──────────────
function getAvailableParticipants() {
  const noRepeat = document.getElementById('setting-no-repeat').checked;

  // Selalu kecualikan peserta gugur dari roda
  const disqualifiedSet = new Set(State.disqualified);

  if (!noRepeat) return State.participants.filter(p => !disqualifiedSet.has(p));

  // Kumpulkan SEMUA pemenang dari SEMUA hadiah ke dalam satu Set
  const allWinners = new Set();
  Object.values(State.winners).forEach(list => list.forEach(name => allWinners.add(name)));

  // Saring: belum menang DAN belum gugur
  return State.participants.filter(p => !allWinners.has(p) && !disqualifiedSet.has(p));
}

// ── Spin Logic ─────────────────────────────────────────────
function spin() {
  const available = getAvailableParticipants();
  if (!available.length) {
    showToast('Semua peserta sudah menang untuk hadiah ini!', 'error');
    return;
  }

  const prize = State.prizes.find(p => p.id === State.activePrizeId);
  const wonCount = (State.winners[State.activePrizeId] || []).length;
  if (wonCount >= prize.slots) {
    showToast(`Semua ${prize.slots} slot pemenang sudah terisi!`, 'error');
    return;
  }

  State.isSpinning = true;
  updateSpinButton();

  // Pick random winner
  const winnerIdx = cryptoRandom(available.length);
  const winner = available[winnerIdx];

  // Calculate target rotation
  const n = available.length;
  const sliceAngle = (Math.PI * 2) / n;
  const winnerAngle = winnerIdx * sliceAngle;

  // We want winner segment to be at the top (pointer = top = -PI/2 offset in draw)
  // Pointer is at top. We draw with offset -PI/2.
  // Segment i starts at i*sliceAngle - PI/2 (after rotation offset in drawWheel)
  // To land winner at top (angle = 0 in rotated frame):
  // winnerMidAngle + currentRotation = -PI/2 + k*2PI  (where pointer is)
  // So targetRotation = -PI/2 - winnerMidAngle + k*2PI + randomOffset

  const winnerMidAngle = winnerIdx * sliceAngle + sliceAngle / 2;
  const extraSpins = (Math.floor(Math.random() * 4) + 5) * Math.PI * 2;
  const offset = (Math.random() - 0.5) * sliceAngle * 0.4; // slight randomness
  targetRotation = rotation + extraSpins + ((-rotation - winnerMidAngle + offset) % (Math.PI * 2));
  if (targetRotation < rotation + extraSpins * 0.8) {
    targetRotation += Math.PI * 2;
  }

  const startRotation = rotation;
  const totalDelta = targetRotation - startRotation;
  const duration = 4000 + Math.random() * 2000; // 4-6 seconds
  const startTime = performance.now();
  let lastTickAngle = rotation;

  function animate(now) {
    const elapsed = now - startTime;
    const t = Math.min(elapsed / duration, 1);
    const eased = easeOutCubic(t);
    rotation = startRotation + totalDelta * eased;

    // Tick sound when crossing a segment boundary
    const segments = getAvailableParticipants();
    const seg = (Math.PI * 2) / (segments.length || 1);
    if (Math.floor(rotation / seg) !== Math.floor(lastTickAngle / seg)) {
      playTick();
      lastTickAngle = rotation;
    }

    drawWheel(getAvailableParticipants(), rotation);

    if (t < 1) {
      animFrame = requestAnimationFrame(animate);
    } else {
      rotation = targetRotation;
      drawWheel(getAvailableParticipants(), rotation);
      onSpinComplete(winner);
    }
  }

  animFrame = requestAnimationFrame(animate);
}

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 4);
}

function cryptoRandom(max) {
  const array = new Uint32Array(1);
  window.crypto.getRandomValues(array);
  return array[0] % max;
}

function onSpinComplete(winner) {
  State.isSpinning = false;

  // Record winner
  const pid = State.activePrizeId;
  if (!State.winners[pid]) State.winners[pid] = [];
  State.winners[pid].push(winner);

  saveToLocalStorage();
  playWinSound();
  fireConfetti();
  renderWinners();
  updateSpinButton();
  updatePrizeTabs();
  drawWheel(getAvailableParticipants(), rotation);

  // Cek apakah ini pemenang terakhir slot hadiah ini
  const prize = State.prizes.find(p => p.id === pid);
  const wonCount = (State.winners[pid] || []).length;
  const isLastSlot = wonCount >= prize.slots;

  showWinnerModal(winner, isLastSlot);
}

// ── Confetti ────────────────────────────────────────────────
function fireConfetti() {
  if (typeof confetti === 'undefined') return;
  const colors = ['#7C3AED', '#F59E0B', '#EC4899', '#10B981', '#0EA5E9'];
  confetti({
    particleCount: 150,
    spread: 80,
    origin: { x: 0.5, y: 0.4 },
    colors,
    ticks: 200,
    gravity: 0.8,
  });
  setTimeout(() => {
    confetti({
      particleCount: 80,
      spread: 120,
      origin: { x: 0.2, y: 0.5 },
      colors,
      angle: 60,
    });
    confetti({
      particleCount: 80,
      spread: 120,
      origin: { x: 0.8, y: 0.5 },
      colors,
      angle: 120,
    });
  }, 300);
}

// ── UI Helpers ─────────────────────────────────────────────
let autoSpinTimer = null;
let autoSpinCountdown = null;

function showWinnerModal(name, isLastSlot) {
  const pid    = State.activePrizeId;
  const prize  = State.prizes.find(p => p.id === pid);
  const wonCount = (State.winners[pid] || []).length;

  document.getElementById('winner-name-display').textContent = name;
  document.getElementById('winner-prize-badge').textContent  = `${prize.emoji} ${prize.name}`;

  // Slot counter
  document.getElementById('winner-slot-counter').textContent =
    `Pemenang ke-${wonCount} dari ${prize.slots} slot`;

  const countdownWrap = document.getElementById('winner-countdown-wrap');
  const countdownFill = document.getElementById('winner-countdown-fill');
  const countdownText = document.getElementById('winner-countdown-text');
  const btnNext       = document.getElementById('btn-winner-next');
  const btnStop       = document.getElementById('btn-winner-stop');
  const btnNextPrize  = document.getElementById('btn-winner-next-prize');
  const nextPrizeLabel = document.getElementById('btn-next-prize-label');

  // Cari hadiah berikutnya: urutan dari BAWAH ke ATAS (reverse array)
  const nextPrize = [...State.prizes].reverse().find(p => {
    const wc = (State.winners[p.id] || []).length;
    return wc < p.slots && p.id !== pid;
  });

  // Reset summary panel
  document.getElementById('winner-summary-panel').style.display = 'none';

  clearAutoSpinTimers();

  if (!isLastSlot) {
    // Masih ada slot tersisa — auto countdown
    countdownWrap.style.display = 'block';
    btnNext.style.display       = 'inline-flex';
    btnNext.textContent         = 'Lanjut Sekarang ⏩';
    btnStop.style.display       = 'inline-flex';
    btnNextPrize.style.display  = 'none';

    let secs = 3;
    countdownText.textContent = `Spin otomatis dalam ${secs}...`;
    countdownFill.style.animation = 'none';
    void countdownFill.offsetWidth;
    countdownFill.style.animation = 'countdownBar 3s linear forwards';

    autoSpinCountdown = setInterval(() => {
      secs--;
      if (secs > 0) {
        countdownText.textContent = `Spin otomatis dalam ${secs}...`;
      } else {
        clearAutoSpinTimers();
        hideWinnerModal(true);
      }
    }, 1000);
  } else {
    // Slot hadiah ini penuh
    countdownWrap.style.display = 'none';
    btnStop.style.display       = 'none';
    btnNext.style.display       = 'inline-flex';
    btnNext.textContent         = 'Selesai ✓';

    // Tampilkan tombol Next Prize jika ada hadiah berikutnya
    if (nextPrize) {
      btnNextPrize.style.display = 'inline-flex';
      nextPrizeLabel.textContent = `${nextPrize.emoji} ${nextPrize.name}`;
    } else {
      btnNextPrize.style.display = 'none';
    }
  }

  // Render winners summary (untuk tombol 📋)
  renderWinnersSummaryInModal();

  document.getElementById('winner-overlay').classList.add('active');
}

function renderWinnersSummaryInModal() {
  const container = document.getElementById('winner-summary-content');
  if (!container) return;

  // Hanya tampilkan pemenang dari hadiah yang sedang aktif
  const prize   = State.prizes.find(p => p.id === State.activePrizeId);
  const winners = prize ? (State.winners[prize.id] || []) : [];

  if (!prize || winners.length === 0) {
    container.innerHTML = '<p style="color:var(--text-muted);font-size:0.8rem;text-align:center;">Belum ada pemenang.</p>';
    return;
  }

  const rows = winners.map((n, i) =>
    `<div class="ws-row"><span class="ws-rank">#${i+1}</span><span class="ws-name">${escapeHtml(n)}</span></div>`
  ).join('');

  container.innerHTML = `
    <div class="ws-group">
      <div class="ws-group-header">${prize.emoji} ${escapeHtml(prize.name)} <span class="ws-count">${winners.length}/${prize.slots}</span></div>
      ${rows}
    </div>`;
}

function clearAutoSpinTimers() {
  if (autoSpinTimer)    { clearTimeout(autoSpinTimer);  autoSpinTimer = null;    }
  if (autoSpinCountdown){ clearInterval(autoSpinCountdown); autoSpinCountdown = null; }
}

function hideWinnerModal(autoNext = false) {
  clearAutoSpinTimers();
  document.getElementById('winner-overlay').classList.remove('active');

  const pid      = State.activePrizeId;
  const prize    = State.prizes.find(p => p.id === pid);
  const wonCount = (State.winners[pid] || []).length;
  const slotsFull = prize && wonCount >= prize.slots;

  if (autoNext) {
    if (!slotsFull) {
      // Masih ada slot di hadiah ini — langsung spin lagi
      autoSpinTimer = setTimeout(() => spin(), 400);
    } else {
      // Hadiah ini selesai, pindah ke hadiah berikutnya
      const nextPrize = State.prizes.find(p => {
        const wc = (State.winners[p.id] || []).length;
        return wc < p.slots;
      });
      if (nextPrize) {
        setActivePrize(nextPrize.id);
        showToast(`Pindah ke: ${nextPrize.emoji} ${nextPrize.name}`, 'info');
      }
    }
  } else {
    // Manual close — hanya update UI, user pilih sendiri hadiah berikutnya
    updateSpinButton();
    drawWheel(getAvailableParticipants(), rotation);
  }
}

function showToast(msg, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.animation = 'toastOut 0.3s ease forwards';
    setTimeout(() => toast.remove(), 300);
  }, 2800);
}

function updateSpinButton() {
  const btn = document.getElementById('btn-spin');
  const sub = btn.querySelector('.spin-btn-sub');
  const prize = State.prizes.find(p => p.id === State.activePrizeId);
  const available = getAvailableParticipants();

  if (State.isSpinning) {
    btn.disabled = true;
    btn.classList.add('spinning');
    sub.textContent = 'Sedang berputar...';
    return;
  }

  btn.classList.remove('spinning');

  if (!State.activePrizeId) {
    btn.disabled = true;
    sub.textContent = 'Pilih hadiah dulu';
    return;
  }

  if (State.participants.length === 0) {
    btn.disabled = true;
    sub.textContent = 'Tambah peserta dulu';
    return;
  }

  const wonCount = (State.winners[State.activePrizeId] || []).length;
  if (wonCount >= prize.slots) {
    btn.disabled = true;
    sub.textContent = `Semua ${prize.slots} slot sudah terisi`;
    return;
  }

  if (available.length === 0) {
    btn.disabled = true;
    sub.textContent = 'Semua peserta sudah menang hadiah lain';
    return;
  }

  btn.disabled = false;
  const remaining = prize.slots - wonCount;
  sub.textContent = `${available.length} peserta belum menang, sisa ${remaining} slot`;
}

function updateStatusBar() {
  const el = document.getElementById('status-text');
  if (State.participants.length === 0) {
    el.textContent = 'Tambah peserta dan pilih hadiah untuk mulai';
    return;
  }
  if (!State.activePrizeId) {
    el.textContent = `${State.participants.length} peserta siap — pilih hadiah yang akan diundi`;
    return;
  }
  const prize = State.prizes.find(p => p.id === State.activePrizeId);
  const available = getAvailableParticipants();
  const wonCount = (State.winners[State.activePrizeId] || []).length;
  el.textContent = `🎁 ${prize.name} | ${available.length} peserta tersedia | Pemenang: ${wonCount}/${prize.slots}`;
}

// ── Render: Prizes List (sidebar) ──────────────────────────
function renderPrizesList() {
  const container = document.getElementById('prizes-list');
  if (State.prizes.length === 0) {
    container.innerHTML = `<p style="font-size:0.78rem;color:var(--text-muted);text-align:center;padding:12px 0;">
      Belum ada hadiah. Klik + untuk tambah.
    </p>`;
    return;
  }
  container.innerHTML = State.prizes.map(prize => {
    const wonCount = (State.winners[prize.id] || []).length;
    const isActive = State.activePrizeId === prize.id;
    const isFull   = wonCount >= prize.slots;
    return `
      <div class="prize-item ${isActive ? 'active' : ''}" data-prize-id="${prize.id}" id="prize-item-${prize.id}">
        <div class="prize-item-emoji">${prize.emoji}</div>
        <div class="prize-item-info">
          <div class="prize-item-name">${escapeHtml(prize.name)}</div>
          <div class="prize-item-meta">
            ${isFull ? '✅ Selesai' : `Pemenang: ${wonCount}/${prize.slots}`}
          </div>
        </div>
        <div class="prize-item-actions">
          <button class="btn-icon-sm" onclick="event.stopPropagation(); openEditPrize('${prize.id}')" title="Edit">✏️</button>
          <button class="btn-icon-sm danger" onclick="event.stopPropagation(); deletePrize('${prize.id}')" title="Hapus">🗑️</button>
        </div>
      </div>
    `;
  }).join('');

  // Click to select active prize
  container.querySelectorAll('.prize-item').forEach(el => {
    el.addEventListener('click', () => {
      setActivePrize(el.dataset.prizeId);
    });
  });
}

// ── Render: Prize Tabs (main area) ─────────────────────────
function renderPrizeTabs() {
  const container = document.getElementById('prize-tabs');
  if (State.prizes.length === 0) {
    container.innerHTML = `<p style="font-size:0.8rem;color:var(--text-muted);">Belum ada hadiah</p>`;
    return;
  }
  container.innerHTML = State.prizes.map(prize => {
    const wonCount = (State.winners[prize.id] || []).length;
    const isActive = State.activePrizeId === prize.id;
    const isFull   = wonCount >= prize.slots;
    return `
      <button class="prize-tab-pill ${isActive ? 'active' : ''} ${isFull ? 'done' : ''}"
              data-prize-id="${prize.id}"
              style="${isFull && !isActive ? 'opacity:0.6;' : ''}">
        ${prize.emoji} ${escapeHtml(prize.name)}
        <span class="pill-slots">${wonCount}/${prize.slots}</span>
      </button>
    `;
  }).join('');

  container.querySelectorAll('.prize-tab-pill').forEach(btn => {
    btn.addEventListener('click', () => setActivePrize(btn.dataset.prizeId));
  });
}

function updatePrizeTabs() {
  renderPrizeTabs();
  renderPrizesList();
  updateCurrentPrizeDisplay();
}

function updateCurrentPrizeDisplay() {
  const prize = State.prizes.find(p => p.id === State.activePrizeId);
  const emojiEl = document.getElementById('current-prize-emoji');
  const nameEl  = document.getElementById('current-prize-name');
  const slotsEl = document.getElementById('current-prize-slots');

  if (!prize) {
    emojiEl.textContent = '🎁';
    nameEl.textContent  = 'Pilih hadiah';
    slotsEl.textContent = '—';
    return;
  }
  const wonCount = (State.winners[prize.id] || []).length;
  emojiEl.textContent = prize.emoji;
  nameEl.textContent  = prize.name;
  slotsEl.textContent = `${wonCount} dari ${prize.slots} pemenang terpilih`;
}

// ── Render: Winners Panel ───────────────────────────────────
function renderWinners() {
  const listEl  = document.getElementById('winners-list');
  const emptyEl = document.getElementById('winners-empty');

  const hasAny = Object.values(State.winners).some(arr => arr.length > 0);

  if (!hasAny) {
    emptyEl.style.display = 'block';
    listEl.innerHTML = '';
    return;
  }

  emptyEl.style.display = 'none';
  listEl.innerHTML = State.prizes.map(prize => {
    const winners = State.winners[prize.id] || [];
    if (winners.length === 0) return '';
    return `
      <div class="winners-group" id="winners-group-${prize.id}">
        <div class="winners-group-header">
          <span class="winners-group-emoji">${prize.emoji}</span>
          <span class="winners-group-name">${escapeHtml(prize.name)}</span>
          <span class="winners-group-count">${winners.length}/${prize.slots}</span>
        </div>
        <div class="winners-items">
          ${winners.map((name, idx) => `
            <div class="winner-chip">
              <span class="winner-rank">#${idx + 1}</span>
              <div class="winner-chip-avatar">${getInitials(name)}</div>
              <span class="winner-chip-name">${escapeHtml(name)}</span>
              <button
                class="btn-remove-winner"
                onclick="removeWinner('${prize.id}', ${idx})"
                title="Hapus dari daftar pemenang (tidak hadir / pulang duluan)"
              >✕</button>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }).join('');
}

function getInitials(name) {
  return name.trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

// ── Remove Individual Winner ────────────────────────────────
function removeWinner(prizeId, idx) {
  if (!State.winners[prizeId]) return;
  const name = State.winners[prizeId][idx];

  // Hapus dari daftar pemenang
  State.winners[prizeId].splice(idx, 1);

  // Masukkan ke daftar gugur (jika belum ada)
  if (!State.disqualified.includes(name)) {
    State.disqualified.push(name);
  }

  saveToLocalStorage();
  renderWinners();
  renderDisqualified();
  renderPrizeTabs();
  renderPrizesList();
  updateCurrentPrizeDisplay();
  updateSpinButton();
  updateStatusBar();
  updateParticipantCount();
  drawWheel(getAvailableParticipants(), rotation);
  showToast(`${name} dipindahkan ke daftar gugur`, 'warning');
}

// ── Restore Disqualified ──────────────────────────────
function restoreDisqualified(name) {
  State.disqualified = State.disqualified.filter(n => n !== name);
  saveToLocalStorage();
  renderDisqualified();
  updateSpinButton();
  updateStatusBar();
  updateParticipantCount();
  drawWheel(getAvailableParticipants(), rotation);
  showToast(`${name} dikembalikan ke pool peserta`, 'success');
}

// ── Render: Disqualified List ──────────────────────────
function renderDisqualified() {
  const section = document.getElementById('disqualified-section');
  const list    = document.getElementById('disqualified-list');
  const badge   = document.getElementById('disqualified-count');
  if (!section || !list) return;

  const dq = State.disqualified;
  badge.textContent = dq.length;
  section.style.display = dq.length > 0 ? 'block' : 'none';

  list.innerHTML = dq.map(name => `
    <div class="disq-chip">
      <span class="disq-icon">❌</span>
      <span class="disq-name">${escapeHtml(name)}</span>
      <button
        class="btn-restore-disq"
        onclick="restoreDisqualified('${escapeHtml(name)}')"
        title="Kembalikan ke pool peserta"
      >↺ Pulihkan</button>
    </div>
  `).join('');
}

// ── Render: Participant Count ───────────────────────────────
function updateParticipantCount() {
  const total  = State.participants.length;
  const active = total - State.disqualified.filter(n => State.participants.includes(n)).length;
  document.getElementById('participant-count').textContent = active;
}

// ── Set Active Prize ────────────────────────────────────────
function setActivePrize(id) {
  State.activePrizeId = id;
  renderPrizeTabs();
  renderPrizesList();
  updateCurrentPrizeDisplay();
  updateSpinButton();
  updateStatusBar();
  drawWheel(getAvailableParticipants(), rotation);
}

// ── Prize CRUD ──────────────────────────────────────────────
function openAddPrize() {
  State.editingPrizeId = null;
  document.getElementById('prize-modal-title').textContent = 'Tambah Hadiah';
  document.getElementById('prize-emoji-input').value = '🎁';
  document.getElementById('prize-name-input').value = '';
  document.getElementById('prize-slots-input').value = 1;
  openModal('prize-modal-overlay');
}

function openEditPrize(id) {
  const prize = State.prizes.find(p => p.id === id);
  if (!prize) return;
  State.editingPrizeId = id;
  document.getElementById('prize-modal-title').textContent = 'Edit Hadiah';
  document.getElementById('prize-emoji-input').value = prize.emoji;
  document.getElementById('prize-name-input').value = prize.name;
  document.getElementById('prize-slots-input').value = prize.slots;
  openModal('prize-modal-overlay');
}

function savePrize() {
  const emoji = document.getElementById('prize-emoji-input').value.trim() || '🎁';
  const name  = document.getElementById('prize-name-input').value.trim();
  const slots = parseInt(document.getElementById('prize-slots-input').value) || 1;

  if (!name) { showToast('Nama hadiah tidak boleh kosong', 'error'); return; }

  if (State.editingPrizeId) {
    const idx = State.prizes.findIndex(p => p.id === State.editingPrizeId);
    if (idx !== -1) {
      State.prizes[idx] = { ...State.prizes[idx], emoji, name, slots };
    }
  } else {
    State.prizes.push({ id: genId(), emoji, name, slots });
  }

  closeModal('prize-modal-overlay');
  renderPrizeTabs();
  renderPrizesList();
  updateCurrentPrizeDisplay();
  updateSpinButton();
  updateStatusBar();
  drawWheel(getAvailableParticipants(), rotation);
  saveToLocalStorage();
  showToast(State.editingPrizeId ? 'Hadiah diperbarui' : 'Hadiah ditambahkan', 'success');
}

async function deletePrize(id) {
  const ok = await showConfirm('Hapus hadiah ini beserta data pemenangnya?', 'Hapus Hadiah');
  if (!ok) return;
  State.prizes = State.prizes.filter(p => p.id !== id);
  delete State.winners[id];
  if (State.activePrizeId === id) {
    State.activePrizeId = State.prizes[0]?.id || null;
  }
  renderPrizeTabs();
  renderPrizesList();
  renderWinners();
  updateCurrentPrizeDisplay();
  updateSpinButton();
  updateStatusBar();
  drawWheel(getAvailableParticipants(), rotation);
  saveToLocalStorage();
  showToast('Hadiah dihapus', 'info');
}

// ── Load Participants ───────────────────────────────────────
function loadParticipants() {
  const raw = document.getElementById('participants-textarea').value;
  const names = raw.split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0);

  if (names.length === 0) {
    showToast('Tidak ada nama yang dimasukkan', 'error');
    return;
  }

  // Remove duplicates
  State.participants = [...new Set(names)];
  updateParticipantCount();
  updateSpinButton();
  updateStatusBar();
  drawWheel(getAvailableParticipants(), rotation);
  saveToLocalStorage();
  showToast(`${State.participants.length} peserta dimuat!`, 'success');
}

function handleFileUpload(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    const content = ev.target.result;
    // Handle CSV: take first column
    let lines;
    if (file.name.endsWith('.csv')) {
      lines = content.split('\n').map(l => l.split(',')[0].trim().replace(/^"|"$/g, ''));
    } else {
      lines = content.split('\n').map(l => l.trim());
    }
    lines = lines.filter(l => l.length > 0);
    document.getElementById('participants-textarea').value = lines.join('\n');
    loadParticipants();
  };
  reader.readAsText(file);
  e.target.value = '';
}

// ── Reset ───────────────────────────────────────────────────
async function resetCurrentPrize() {
  if (!State.activePrizeId) return;
  const prize = State.prizes.find(p => p.id === State.activePrizeId);
  const ok = await showConfirm(`Reset pemenang untuk "${prize.name}"? Peserta yang menang akan kembali ke daftar.`, 'Reset Hadiah');
  if (!ok) return;
  State.winners[State.activePrizeId] = [];
  renderWinners();
  renderPrizeTabs();
  renderPrizesList();
  updateCurrentPrizeDisplay();
  updateSpinButton();
  updateStatusBar();
  drawWheel(getAvailableParticipants(), rotation);
  saveToLocalStorage();
  showToast('Reset berhasil', 'info');
}

async function resetAll() {
  const ok = await showConfirm('Reset semua pemenang? Data tidak bisa dikembalikan.', 'Reset Semua Pemenang');
  if (!ok) return;
  State.winners = {};
  State.disqualified = [];
  renderWinners();
  renderDisqualified();
  renderPrizeTabs();
  renderPrizesList();
  updateCurrentPrizeDisplay();
  updateSpinButton();
  updateStatusBar();
  updateParticipantCount();
  drawWheel(getAvailableParticipants(), rotation);
  saveToLocalStorage();
  showToast('Semua pemenang direset', 'info');
}

// ── Export CSV ──────────────────────────────────────────────
function exportCSV() {
  const hasAny = Object.values(State.winners).some(arr => arr.length > 0);
  if (!hasAny) { showToast('Belum ada pemenang untuk diexport', 'error'); return; }

  const rows = ['No,Hadiah,Nama Pemenang'];
  let no = 1;
  State.prizes.forEach(prize => {
    const winners = State.winners[prize.id] || [];
    winners.forEach(name => {
      rows.push(`${no++},"${prize.emoji} ${prize.name}","${name}"`);
    });
  });

  const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = `doorprize-famgath-${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Export berhasil!', 'success');
}

// ── Modal helpers ───────────────────────────────────────────
function openModal(id) {
  document.getElementById(id).classList.add('active');
}

function closeModal(id) {
  document.getElementById(id).classList.remove('active');
}

// Custom confirm — mengganti native confirm() yang diblokir di file://
function showConfirm(message, title = 'Konfirmasi') {
  return new Promise(resolve => {
    document.getElementById('confirm-modal-title').textContent = title;
    document.getElementById('confirm-modal-message').textContent = message;
    openModal('confirm-modal-overlay');

    const btnOk     = document.getElementById('btn-confirm-ok');
    const btnCancel = document.getElementById('btn-confirm-cancel');

    function cleanup(result) {
      closeModal('confirm-modal-overlay');
      btnOk.removeEventListener('click', handleOk);
      btnCancel.removeEventListener('click', handleCancel);
      resolve(result);
    }
    function handleOk()     { cleanup(true);  }
    function handleCancel() { cleanup(false); }

    btnOk.addEventListener('click', handleOk);
    btnCancel.addEventListener('click', handleCancel);
  });
}

// ── LocalStorage ────────────────────────────────────────────
function saveToLocalStorage() {
  try {
    localStorage.setItem('famgath-state', JSON.stringify({
      prizes:        State.prizes,
      participants:  State.participants,
      winners:       State.winners,
      disqualified:  State.disqualified,
      activePrizeId: State.activePrizeId,
    }));
  } catch(e) {}
}

function loadFromLocalStorage() {
  try {
    const raw = localStorage.getItem('famgath-state');
    if (!raw) return;
    const saved = JSON.parse(raw);
    if (saved.prizes)        State.prizes        = saved.prizes;
    if (saved.participants)  State.participants   = saved.participants;
    if (saved.winners)       State.winners        = saved.winners;
    if (saved.disqualified)  State.disqualified   = saved.disqualified;
    if (saved.activePrizeId) State.activePrizeId  = saved.activePrizeId;

    // Restore textarea
    document.getElementById('participants-textarea').value = State.participants.join('\n');
  } catch(e) {}
}

// ── Utility ─────────────────────────────────────────────────
function genId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ── Mobile Tabs ─────────────────────────────────────────────
function initMobileTabs() {
  const tabs = document.querySelectorAll('.tab-btn');
  tabs.forEach(btn => {
    btn.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      btn.classList.add('active');

      const tab = btn.dataset.tab;
      const setupPanel   = document.getElementById('setup-panel');
      const winnersPanel = document.getElementById('winners-panel');

      setupPanel.classList.remove('mobile-visible');
      winnersPanel.classList.remove('mobile-visible');

      if (tab === 'setup')   setupPanel.classList.add('mobile-visible');
      if (tab === 'winners') winnersPanel.classList.add('mobile-visible');
    });
  });
}

// ── Init ────────────────────────────────────────────────────
function init() {
  loadFromLocalStorage();

  // Render initial state
  renderPrizesList();
  renderPrizeTabs();
  renderWinners();
  renderDisqualified();
  updateParticipantCount();
  updateCurrentPrizeDisplay();
  updateSpinButton();
  updateStatusBar();
  drawWheel(getAvailableParticipants(), rotation);

  // ── Event Listeners ──

  // Add prize button
  document.getElementById('btn-add-prize').addEventListener('click', openAddPrize);

  // Prize modal
  document.getElementById('btn-save-prize').addEventListener('click', savePrize);
  document.getElementById('btn-cancel-prize').addEventListener('click', () => closeModal('prize-modal-overlay'));
  document.getElementById('btn-close-prize-modal').addEventListener('click', () => closeModal('prize-modal-overlay'));
  document.getElementById('prize-modal-overlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeModal('prize-modal-overlay');
  });

  // Prize name input: press Enter to save
  document.getElementById('prize-name-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') savePrize();
  });

  // Load participants
  document.getElementById('btn-load-participants').addEventListener('click', loadParticipants);
  document.getElementById('file-upload').addEventListener('change', handleFileUpload);

  // Spin button
  document.getElementById('btn-spin').addEventListener('click', () => {
    if (!State.isSpinning) spin();
  });

  // Reset current
  document.getElementById('btn-reset-draw').addEventListener('click', resetCurrentPrize);

  // Reset all
  document.getElementById('btn-reset-all').addEventListener('click', resetAll);

  // Confirm modal backdrop close
  document.getElementById('confirm-modal-overlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) {
      document.getElementById('btn-confirm-cancel').click();
    }
  });

  // Export
  document.getElementById('btn-export-csv').addEventListener('click', exportCSV);

  // Winner modal buttons
  document.getElementById('btn-winner-next').addEventListener('click', () => {
    hideWinnerModal(false); // manual next (tidak auto-spin, tapi pindah hadiah jika perlu)
    // Jika slot masih ada, tetap spin sekali lagi manual jika user klik next dari "last slot"
    const pid      = State.activePrizeId;
    const prize    = State.prizes.find(p => p.id === pid);
    const wonCount = (State.winners[pid] || []).length;
    if (prize && wonCount < prize.slots) {
      autoSpinTimer = setTimeout(() => spin(), 400);
    }
  });

  document.getElementById('btn-winner-stop').addEventListener('click', () => {
    hideWinnerModal(false); // stop auto-spin
    updateSpinButton();
    drawWheel(getAvailableParticipants(), rotation);
    showToast('Auto-spin dihentikan', 'info');
  });

  // Next Prize button (bottom-to-top order)
  document.getElementById('btn-winner-next-prize').addEventListener('click', () => {
    const currentPid = State.activePrizeId;
    // Cari hadiah berikutnya dari bawah ke atas
    const nextPrize = [...State.prizes].reverse().find(p => {
      const wc = (State.winners[p.id] || []).length;
      return wc < p.slots && p.id !== currentPid;
    });
    if (!nextPrize) return;

    hideWinnerModal(false);
    setActivePrize(nextPrize.id);
    showToast(`Pindah ke: ${nextPrize.emoji} ${nextPrize.name}`, 'info');
    // Auto spin di hadiah baru
    autoSpinTimer = setTimeout(() => spin(), 600);
  });

  // Show/hide winners summary toggle
  document.getElementById('btn-winner-show-winners').addEventListener('click', () => {
    const panel = document.getElementById('winner-summary-panel');
    const btn   = document.getElementById('btn-winner-show-winners');
    const isVisible = panel.style.display !== 'none';
    panel.style.display = isVisible ? 'none' : 'block';
    btn.textContent = isVisible ? '📋 Lihat Pemenang' : '🔼 Sembunyikan';
  });

  // Close winner overlay on backdrop click
  document.getElementById('winner-overlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) hideWinnerModal();
  });

  // Mobile tabs
  initMobileTabs();

  // Resize canvas on window resize
  function resizeCanvas() {
    const wrapper = document.getElementById('wheel-wrapper');
    const size = Math.min(wrapper.offsetWidth, wrapper.offsetHeight, 500);
    canvas.style.width  = size + 'px';
    canvas.style.height = size + 'px';
  }
  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  // Seed default prizes if none saved
  if (State.prizes.length === 0) {
    State.prizes = [
      { id: genId(), emoji: '🥇', name: 'Hadiah Utama',   slots: 1 },
      { id: genId(), emoji: '🥈', name: 'Hadiah Kedua',   slots: 2 },
      { id: genId(), emoji: '🥉', name: 'Hadiah Ketiga',  slots: 3 },
    ];
    renderPrizesList();
    renderPrizeTabs();
    saveToLocalStorage();
  }
  // ── Sidebar Toggles ──
  function initSidebarToggles() {
    const FULL_W      = 300;
    const COLLAPSED_W = 48;

    const btnLeft  = document.getElementById('toggle-left-sidebar');
    const btnRight = document.getElementById('toggle-right-sidebar');

    // Posisi awal tombol
    if (btnLeft)  btnLeft.style.left   = FULL_W + 'px';
    if (btnRight) btnRight.style.right = FULL_W + 'px';

    function setupToggle(btn, sidebarId, iconId, collapseIcon, expandIcon, side) {
      const sidebar = document.getElementById(sidebarId);
      const iconEl  = document.getElementById(iconId);
      if (!btn || !sidebar) return;

      btn.addEventListener('click', () => {
        const isCollapsed = sidebar.classList.toggle('collapsed');
        iconEl.textContent = isCollapsed ? expandIcon : collapseIcon;

        // Geser tombol ikuti sidebar
        const newPos = isCollapsed ? COLLAPSED_W : FULL_W;
        if (side === 'left')  btn.style.left  = newPos + 'px';
        if (side === 'right') btn.style.right = newPos + 'px';

        // Resize canvas setelah animasi selesai
        setTimeout(() => {
          const wrapper = document.getElementById('wheel-wrapper');
          if (!wrapper) return;
          const size = Math.min(wrapper.offsetWidth, wrapper.offsetHeight, 500);
          canvas.style.width  = size + 'px';
          canvas.style.height = size + 'px';
          drawWheel(getAvailableParticipants(), rotation);
        }, 320);
      });
    }

    setupToggle(btnLeft,  'setup-panel',   'toggle-left-icon',  '◀', '▶', 'left');
    setupToggle(btnRight, 'winners-panel', 'toggle-right-icon', '▶', '◀', 'right');
  }

  initSidebarToggles();
}

// Fire when DOM ready
document.addEventListener('DOMContentLoaded', init);
