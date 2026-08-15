// ============ NAVIGATION ============
const navButtons = document.querySelectorAll('.nav-btn');
const views = document.querySelectorAll('.view');

navButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    const viewId = btn.dataset.view;
    navButtons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    views.forEach(v => v.classList.remove('active'));
    document.getElementById(`view-${viewId}`).classList.add('active');

    if (viewId === 'list') loadParticipantsList();
    if (viewId === 'stats') loadStats();
    if (viewId === 'qrcodes') loadQRCodes();
    if (viewId === 'send') loadSendList();
  });
});

// ============ QR SCANNER ============
let html5QrCode = null;
let isScanning = false;

const btnStartScan = document.getElementById('btn-start-scan');
const btnStopScan = document.getElementById('btn-stop-scan');
const scanResult = document.getElementById('scan-result');

btnStartScan.addEventListener('click', startScanner);
btnStopScan.addEventListener('click', stopScanner);

function startScanner() {
  html5QrCode = new Html5Qrcode("qr-reader");

  html5QrCode.start(
    { facingMode: "environment" },
    { fps: 10, qrbox: { width: 250, height: 250 } },
    onScanSuccess,
    () => {}
  ).then(() => {
    isScanning = true;
    btnStartScan.style.display = 'none';
    btnStopScan.style.display = 'inline-block';
  }).catch(err => {
    scanResult.classList.remove('hidden');
    scanResult.className = 'result-card error';
    scanResult.innerHTML = `
      <h3>⚠️ Error al iniciar cámara</h3>
      <p>Asegúrate de dar permiso de cámara o usa la búsqueda manual.</p>
      <p style="font-size:0.8rem;color:#64748b;margin-top:0.5rem">${err}</p>
    `;
  });
}

function stopScanner() {
  if (html5QrCode && isScanning) {
    html5QrCode.stop().then(() => {
      isScanning = false;
      btnStartScan.style.display = 'inline-block';
      btnStopScan.style.display = 'none';
      html5QrCode.clear();
    });
  }
}

async function onScanSuccess(decodedText) {
  if (html5QrCode && isScanning) {
    await html5QrCode.pause();
  }

  let dorsal = null;
  try {
    const data = JSON.parse(decodedText);
    if (data.dorsal) dorsal = data.dorsal;
  } catch (e) {
    const parsed = parseInt(decodedText);
    if (!isNaN(parsed)) dorsal = parsed;
  }

  if (dorsal) {
    showCheckinModal(dorsal);
  } else {
    scanResult.classList.remove('hidden');
    scanResult.className = 'result-card error';
    scanResult.innerHTML = `<h3>❌ QR no reconocido</h3><p>El código escaneado no corresponde a un participante.</p>`;
  }

  setTimeout(() => {
    if (html5QrCode && isScanning) {
      try { html5QrCode.resume(); } catch(e) {}
    }
  }, 3000);
}

// ============ CHECK-IN MODAL ============
const modal = document.getElementById('checkin-modal');
const modalBody = document.getElementById('modal-body');
const btnConfirmCheckin = document.getElementById('btn-confirm-checkin');
const btnUndoCheckin = document.getElementById('btn-undo-checkin');
const btnCloseModal = document.getElementById('btn-close-modal');
let currentParticipant = null;

async function showCheckinModal(dorsal) {
  try {
    const res = await fetch(`/api/participants/${dorsal}`);
    if (!res.ok) throw new Error('No encontrado');
    currentParticipant = await res.json();

    const isChecked = currentParticipant.checkedIn;
    const checkTime = currentParticipant.checkInTime
      ? new Date(currentParticipant.checkInTime).toLocaleString('es-CR')
      : '';

    modalBody.innerHTML = `
      <div class="dorsal-big">#${currentParticipant.dorsal}</div>
      <div class="nombre-big">${currentParticipant.nombre}</div>
      <div class="categoria-big">${currentParticipant.categoria}</div>
      <div class="status-badge ${isChecked ? 'checked' : 'pending'}">
        ${isChecked ? `✅ Ya registrado - ${checkTime}` : '⏳ Pendiente de check-in'}
      </div>
    `;

    if (isChecked) {
      btnConfirmCheckin.classList.add('hidden');
      btnUndoCheckin.classList.remove('hidden');
    } else {
      btnConfirmCheckin.classList.remove('hidden');
      btnUndoCheckin.classList.add('hidden');
    }

    modal.classList.remove('hidden');
  } catch (err) {
    alert('Participante no encontrado con dorsal: ' + dorsal);
  }
}

btnConfirmCheckin.addEventListener('click', async () => {
  if (!currentParticipant) return;
  try {
    const res = await fetch(`/api/checkin/${currentParticipant.dorsal}`, { method: 'POST' });
    const data = await res.json();

    if (res.ok) {
      currentParticipant = data.participant;
      modalBody.innerHTML = `
        <div style="text-align:center; font-size:4rem;">✅</div>
        <div class="nombre-big">${currentParticipant.nombre}</div>
        <div class="dorsal-big" style="font-size:2rem;">#${currentParticipant.dorsal}</div>
        <div class="status-badge checked">¡Check-in exitoso!</div>
      `;
      btnConfirmCheckin.classList.add('hidden');
      btnUndoCheckin.classList.remove('hidden');

      scanResult.classList.remove('hidden');
      scanResult.className = 'result-card success';
      scanResult.innerHTML = `
        <h3>✅ Check-in exitoso</h3>
        <p><strong>#${currentParticipant.dorsal}</strong> - ${currentParticipant.nombre}</p>
        <p style="color:#64748b">${currentParticipant.categoria}</p>
      `;
    } else {
      alert(data.message || data.error);
    }
  } catch (err) {
    alert('Error al hacer check-in');
  }
});

btnUndoCheckin.addEventListener('click', async () => {
  if (!currentParticipant) return;
  if (!confirm(`¿Revertir check-in de ${currentParticipant.nombre}?`)) return;
  try {
    const res = await fetch(`/api/undo-checkin/${currentParticipant.dorsal}`, { method: 'POST' });
    const data = await res.json();
    if (res.ok) {
      currentParticipant = data.participant;
      showCheckinModal(currentParticipant.dorsal);
    }
  } catch (err) {
    alert('Error al revertir check-in');
  }
});

btnCloseModal.addEventListener('click', () => {
  modal.classList.add('hidden');
  currentParticipant = null;
});

modal.addEventListener('click', (e) => {
  if (e.target === modal) {
    modal.classList.add('hidden');
    currentParticipant = null;
  }
});

// ============ MANUAL SEARCH ============
const searchInput = document.getElementById('search-input');
const btnSearch = document.getElementById('btn-search');
const searchResults = document.getElementById('search-results');

btnSearch.addEventListener('click', performSearch);
searchInput.addEventListener('keyup', (e) => {
  if (e.key === 'Enter') performSearch();
  if (searchInput.value.length >= 2) performSearch();
});

async function performSearch() {
  const query = searchInput.value.trim().toLowerCase();
  if (!query) { searchResults.innerHTML = ''; return; }

  try {
    const res = await fetch('/api/participants');
    const participants = await res.json();

    const filtered = participants.filter(p =>
      p.dorsal.toString().includes(query) ||
      p.nombre.toLowerCase().includes(query)
    );

    if (filtered.length === 0) {
      searchResults.innerHTML = '<p style="color:#64748b;text-align:center;padding:2rem;">No se encontraron resultados</p>';
      return;
    }

    searchResults.innerHTML = filtered.map(p => createParticipantCard(p)).join('');
    attachCardListeners();
  } catch (err) {
    searchResults.innerHTML = '<p style="color:red;">Error al buscar</p>';
  }
}

// ============ PARTICIPANTS LIST ============
const filterCategory = document.getElementById('filter-category');
const filterStatus = document.getElementById('filter-status');
const participantsList = document.getElementById('participants-list');

filterCategory.addEventListener('change', loadParticipantsList);
filterStatus.addEventListener('change', loadParticipantsList);

async function loadParticipantsList() {
  try {
    const res = await fetch('/api/participants');
    const participants = await res.json();

    // Populate categories filter (once)
    const categories = [...new Set(participants.map(p => p.categoria))].sort();
    if (filterCategory.options.length <= 1) {
      categories.forEach(cat => {
        const opt = document.createElement('option');
        opt.value = cat;
        opt.textContent = cat;
        filterCategory.appendChild(opt);
      });
    }

    let filtered = participants;
    if (filterCategory.value) {
      filtered = filtered.filter(p => p.categoria === filterCategory.value);
    }
    if (filterStatus.value === 'checked') {
      filtered = filtered.filter(p => p.checkedIn);
    } else if (filterStatus.value === 'pending') {
      filtered = filtered.filter(p => !p.checkedIn);
    }

    filtered.sort((a, b) => a.dorsal - b.dorsal);
    participantsList.innerHTML = filtered.map(p => createParticipantCard(p)).join('');
    attachCardListeners();
  } catch (err) {
    participantsList.innerHTML = '<p style="color:red;">Error al cargar lista</p>';
  }
}

function createParticipantCard(p) {
  return `
    <div class="participant-card ${p.checkedIn ? 'checked' : 'pending'}" data-dorsal="${p.dorsal}">
      <div class="participant-info">
        <span class="dorsal">#${p.dorsal}</span>
        <div class="nombre">${p.nombre}</div>
        <span class="categoria">${p.categoria}</span>
      </div>
      <div class="participant-status">${p.checkedIn ? '✅' : '⏳'}</div>
    </div>
  `;
}

function attachCardListeners() {
  document.querySelectorAll('.participant-card').forEach(card => {
    card.addEventListener('click', () => {
      showCheckinModal(parseInt(card.dataset.dorsal));
    });
  });
}

// ============ STATISTICS ============
async function loadStats() {
  try {
    const res = await fetch('/api/stats');
    const stats = await res.json();
    const percentage = stats.total > 0 ? Math.round((stats.checkedIn / stats.total) * 100) : 0;

    let categoriesHTML = '';
    for (const [cat, data] of Object.entries(stats.categories)) {
      const catPct = data.total > 0 ? Math.round((data.checkedIn / data.total) * 100) : 0;
      categoriesHTML += `
        <div class="stat-card">
          <h3>${cat}</h3>
          <p><strong>${data.checkedIn}</strong> / ${data.total}</p>
          <div class="progress-bar"><div class="progress-fill" style="width: ${catPct}%"></div></div>
        </div>
      `;
    }

    document.getElementById('stats-container').innerHTML = `
      <div class="stat-card">
        <h3>Progreso General</h3>
        <div class="stat-number">${stats.checkedIn} / ${stats.total}</div>
        <p style="color:var(--text-light)">${percentage}% registrados · ${stats.pending} pendientes</p>
        <div class="progress-bar"><div class="progress-fill" style="width: ${percentage}%"></div></div>
      </div>
      <div class="stat-grid">${categoriesHTML}</div>
    `;
  } catch (err) {
    document.getElementById('stats-container').innerHTML = '<p style="color:red;">Error al cargar estadísticas</p>';
  }
}

// ============ QR CODES (generated client-side) ============
async function loadQRCodes() {
  const qrGrid = document.getElementById('qr-grid');
  qrGrid.innerHTML = '<p style="text-align:center;color:#64748b;">Cargando participantes...</p>';

  try {
    const res = await fetch('/api/participants');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const participants = await res.json();

    if (!Array.isArray(participants)) {
      throw new Error(participants.error || 'Respuesta inválida');
    }

    qrGrid.innerHTML = participants.map(p => `
      <div class="qr-card">
        <canvas id="qr-canvas-${p.dorsal}"></canvas>
        <div class="qr-dorsal">#${p.dorsal}</div>
        <div class="qr-nombre">${p.nombre}</div>
      </div>
    `).join('');

    // Check if QRious library is loaded
    if (typeof QRious === 'undefined') {
      qrGrid.innerHTML = '<p style="color:red;">Error: librería QR no cargó.</p>';
      return;
    }

    // Generate QR codes client-side using QRious library
    for (const p of participants) {
      const canvas = document.getElementById(`qr-canvas-${p.dorsal}`);
      const qrData = JSON.stringify({ dorsal: p.dorsal, nombre: p.nombre });
      new QRious({
        element: canvas,
        value: qrData,
        size: 150,
        level: 'M'
      });
    }
  } catch (err) {
    qrGrid.innerHTML = `<p style="color:red;">Error al cargar participantes: ${err.message}</p>`;
  }
}

document.getElementById('btn-print-qr').addEventListener('click', () => {
  window.print();
});


// ============ SEND QR (WhatsApp + Email) ============
const sendSearchInput = document.getElementById('send-search-input');
const sendList = document.getElementById('send-list');
const sendStats = document.getElementById('send-stats');
const btnBulkWhatsapp = document.getElementById('btn-bulk-whatsapp');
const btnBulkEmail = document.getElementById('btn-bulk-email');

let allParticipantsCache = [];

if (sendSearchInput) {
  sendSearchInput.addEventListener('keyup', () => {
    renderSendList(sendSearchInput.value.trim().toLowerCase());
  });
}

if (btnBulkWhatsapp) {
  btnBulkWhatsapp.addEventListener('click', bulkSendWhatsApp);
}

if (btnBulkEmail) {
  btnBulkEmail.addEventListener('click', bulkSendEmail);
}

async function loadSendList() {
  try {
    const res = await fetch('/api/participants');
    allParticipantsCache = await res.json();
    updateSendStats();
    renderSendList('');
  } catch (err) {
    sendList.innerHTML = '<p style="color:red;">Error al cargar participantes</p>';
  }
}

function updateSendStats() {
  const withPhone = allParticipantsCache.filter(p => p.telefono && p.telefono.trim()).length;
  const withEmail = allParticipantsCache.filter(p => p.email && p.email.trim()).length;
  const total = allParticipantsCache.length;

  sendStats.innerHTML = `
    <div class="stat-item">📋 Total: <strong>${total}</strong></div>
    <div class="stat-item">📱 Con teléfono: <strong>${withPhone}</strong></div>
    <div class="stat-item">📧 Con email: <strong>${withEmail}</strong></div>
  `;
}

function renderSendList(query) {
  let filtered = allParticipantsCache;
  if (query) {
    filtered = filtered.filter(p =>
      p.dorsal.toString().includes(query) ||
      p.nombre.toLowerCase().includes(query)
    );
  }

  if (filtered.length === 0) {
    sendList.innerHTML = '<p style="color:#64748b;text-align:center;padding:2rem;">No se encontraron resultados</p>';
    return;
  }

  sendList.innerHTML = filtered.map(p => {
    const hasPhone = p.telefono && p.telefono.trim();
    const hasEmail = p.email && p.email.trim();

    return `
      <div class="send-card" data-dorsal="${p.dorsal}">
        <div class="send-info">
          <span class="dorsal">#${p.dorsal}</span>
          <div class="nombre">${p.nombre}</div>
          <div class="contacto">
            ${hasPhone ? `<span>📱 ${p.telefono}</span>` : ''}
            ${hasEmail ? `<span>📧 ${p.email}</span>` : ''}
            ${!hasPhone && !hasEmail ? '<span class="no-contact">⚠️ Sin datos de contacto</span>' : ''}
          </div>
        </div>
        <div class="send-buttons">
          <button class="btn btn-whatsapp ${!hasPhone ? 'btn-disabled' : ''}" 
                  onclick="sendWhatsApp(${p.dorsal})" 
                  ${!hasPhone ? 'disabled' : ''}>
            📱 WA
          </button>
          <button class="btn btn-email ${!hasEmail ? 'btn-disabled' : ''}" 
                  onclick="sendEmail(${p.dorsal})" 
                  ${!hasEmail ? 'disabled' : ''}>
            📧 Email
          </button>
        </div>
      </div>
    `;
  }).join('');
}

// Generate QR as data URL for a participant
async function generateQRDataURL(participant) {
  const qrData = JSON.stringify({ dorsal: participant.dorsal, nombre: participant.nombre });
  const canvas = document.createElement('canvas');
  new QRious({
    element: canvas,
    value: qrData,
    size: 300,
    level: 'M'
  });
  return canvas.toDataURL('image/png');
}

// Send individual WhatsApp
async function sendWhatsApp(dorsal) {
  const participant = allParticipantsCache.find(p => p.dorsal === dorsal);
  if (!participant || !participant.telefono) return;

  // Clean phone number (remove spaces, dashes, etc) and ensure country code
  let phone = participant.telefono.replace(/[\s\-\(\)\.]/g, '');
  // If starts with 0, replace with Costa Rica code
  if (phone.startsWith('0')) phone = '506' + phone.substring(1);
  // If doesn't start with +, add Costa Rica code
  if (!phone.startsWith('+') && !phone.startsWith('506') && phone.length <= 8) {
    phone = '506' + phone;
  }
  // Remove + if present
  phone = phone.replace('+', '');

  const message = encodeURIComponent(
    `🏊‍♂️🚴‍♂️🏃‍♂️ *Race Club Hub - Triatlón*\n\n` +
    `¡Hola ${participant.nombre}! 👋\n\n` +
    `Tu número de dorsal es: *#${participant.dorsal}*\n` +
    `Categoría: ${participant.categoria}\n\n` +
    `📱 Presentá tu código QR el día de la carrera para hacer check-in rápido.\n\n` +
    `🔗 Descargá tu QR aquí: ${window.location.origin}/qr.html?dorsal=${participant.dorsal}\n\n` +
    `¡Nos vemos en la meta! 🏁`
  );

  const waUrl = `https://wa.me/${phone}?text=${message}`;
  window.open(waUrl, '_blank');
}

// Send individual Email
async function sendEmail(dorsal) {
  const participant = allParticipantsCache.find(p => p.dorsal === dorsal);
  if (!participant || !participant.email) return;

  // Try server-side email first
  try {
    const res = await fetch('/api/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dorsal: participant.dorsal })
    });

    if (res.ok) {
      alert(`✅ Email enviado a ${participant.email}`);
      return;
    }
  } catch (err) {
    // Fall through to mailto
  }

  // Fallback: open mailto link
  const subject = encodeURIComponent(`🏊‍♂️ Tu código QR - Triatlón Race Club Hub - Dorsal #${participant.dorsal}`);
  const body = encodeURIComponent(
    `¡Hola ${participant.nombre}!\n\n` +
    `Tu número de dorsal es: #${participant.dorsal}\n` +
    `Categoría: ${participant.categoria}\n\n` +
    `Presentá tu código QR el día de la carrera para hacer check-in rápido.\n\n` +
    `Descargá tu QR aquí: ${window.location.origin}/qr.html?dorsal=${participant.dorsal}\n\n` +
    `¡Nos vemos en la meta! 🏁\n\n` +
    `- Equipo Race Club Hub`
  );

  window.open(`mailto:${participant.email}?subject=${subject}&body=${body}`, '_blank');
}

// Bulk send WhatsApp (opens one by one with a delay)
async function bulkSendWhatsApp() {
  const withPhone = allParticipantsCache.filter(p => p.telefono && p.telefono.trim());

  if (withPhone.length === 0) {
    alert('No hay participantes con número de teléfono registrado.');
    return;
  }

  const confirmed = confirm(
    `Se abrirán ${withPhone.length} ventanas de WhatsApp, una por cada atleta con teléfono registrado.\n\n` +
    `Cada mensaje tendrá pre-escrito el texto con la info del atleta. Solo tenés que darle "Enviar" en cada uno.\n\n` +
    `¿Continuar?`
  );

  if (!confirmed) return;

  for (let i = 0; i < withPhone.length; i++) {
    sendWhatsApp(withPhone[i].dorsal);
    // Small delay between opens to avoid browser blocking
    await new Promise(resolve => setTimeout(resolve, 1500));
  }

  alert(`✅ Se abrieron ${withPhone.length} conversaciones de WhatsApp.`);
}

// Bulk send Email
async function bulkSendEmail() {
  const withEmail = allParticipantsCache.filter(p => p.email && p.email.trim());

  if (withEmail.length === 0) {
    alert('No hay participantes con email registrado.');
    return;
  }

  // Try server-side bulk email first
  try {
    const res = await fetch('/api/send-email-bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });

    if (res.ok) {
      const data = await res.json();
      alert(`✅ Se enviaron ${data.sent} emails exitosamente.`);
      return;
    }
  } catch (err) {
    // Fall through to individual mailto
  }

  // Fallback: open individual mailto links
  const confirmed = confirm(
    `Se abrirán ${withEmail.length} ventanas de email.\n\n` +
    `¿Continuar?`
  );

  if (!confirmed) return;

  for (let i = 0; i < withEmail.length; i++) {
    sendEmail(withEmail[i].dorsal);
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}
