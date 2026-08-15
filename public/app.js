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

// ============ EDIT CONTACT ============
const editModal = document.getElementById('edit-modal');
const editTelefono = document.getElementById('edit-telefono');
const editEmail = document.getElementById('edit-email');
const btnEditContact = document.getElementById('btn-edit-contact');
const btnSaveContact = document.getElementById('btn-save-contact');
const btnCancelEdit = document.getElementById('btn-cancel-edit');

btnEditContact.addEventListener('click', () => {
  if (!currentParticipant) return;
  document.getElementById('edit-participant-info').innerHTML = `
    <strong>#${currentParticipant.dorsal}</strong> - ${currentParticipant.nombre}
  `;
  editTelefono.value = currentParticipant.telefono || '';
  editEmail.value = currentParticipant.email || '';
  modal.classList.add('hidden');
  editModal.classList.remove('hidden');
});

btnCancelEdit.addEventListener('click', () => {
  editModal.classList.add('hidden');
  if (currentParticipant) {
    modal.classList.remove('hidden');
  }
});

editModal.addEventListener('click', (e) => {
  if (e.target === editModal) {
    editModal.classList.add('hidden');
  }
});

btnSaveContact.addEventListener('click', async () => {
  if (!currentParticipant) return;

  const telefono = editTelefono.value.trim();
  const email = editEmail.value.trim();

  try {
    const res = await fetch(`/api/participants/${currentParticipant.dorsal}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ telefono, email })
    });

    const data = await res.json();

    if (res.ok) {
      alert(`✅ Datos actualizados para ${currentParticipant.nombre}`);
      currentParticipant.telefono = telefono;
      currentParticipant.email = email;
      editModal.classList.add('hidden');
      showCheckinModal(currentParticipant.dorsal);
    } else {
      alert('❌ Error: ' + (data.error || 'No se pudo guardar'));
    }
  } catch (err) {
    alert('❌ Error de conexión');
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

  // Generate QR image and trigger share/download
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = 600;
  canvas.height = 750;

  // White background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 600, 750);

  // Header
  ctx.fillStyle = '#1e40af';
  ctx.fillRect(0, 0, 600, 80);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 22px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('🏊‍♂️🚴‍♂️🏃‍♂️ Race Club Hub - Triatlón', 300, 50);

  // Dorsal
  ctx.fillStyle = '#2563eb';
  ctx.font = 'bold 60px Arial, sans-serif';
  ctx.fillText(`#${participant.dorsal}`, 300, 150);

  // Name
  ctx.fillStyle = '#1e293b';
  ctx.font = 'bold 24px Arial, sans-serif';
  ctx.fillText(participant.nombre, 300, 190);

  // Category
  ctx.fillStyle = '#64748b';
  ctx.font = '18px Arial, sans-serif';
  ctx.fillText(participant.categoria, 300, 220);

  // QR Code - generate on a temporary canvas
  const qrCanvas = document.createElement('canvas');
  const qrData = JSON.stringify({ dorsal: participant.dorsal, nombre: participant.nombre });
  new QRious({
    element: qrCanvas,
    value: qrData,
    size: 300,
    level: 'M'
  });

  // Draw QR on main canvas
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 2;
  ctx.strokeRect(148, 240, 304, 304);
  ctx.drawImage(qrCanvas, 150, 242, 300, 300);

  // Footer info
  ctx.fillStyle = '#334155';
  ctx.font = '16px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('📱 Presentá este QR el día de la carrera', 300, 580);
  ctx.fillText('para hacer check-in rápido', 300, 605);

  // Info table
  ctx.textAlign = 'left';
  ctx.fillStyle = '#64748b';
  ctx.font = '14px Arial, sans-serif';
  ctx.fillText('👤 Nombre:', 100, 650);
  ctx.fillText('🔢 Dorsal:', 100, 675);
  ctx.fillText('🏷️ Categoría:', 100, 700);

  ctx.fillStyle = '#1e293b';
  ctx.font = 'bold 14px Arial, sans-serif';
  ctx.fillText(participant.nombre, 220, 650);
  ctx.fillText(`#${participant.dorsal}`, 220, 675);
  ctx.fillText(participant.categoria, 220, 700);

  // Footer brand
  ctx.fillStyle = '#94a3b8';
  ctx.font = '12px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('raceclubhub.com · ¡Nos vemos en la meta! 🏁', 300, 735);

  // Try Web Share API (works great on mobile)
  canvas.toBlob(async (blob) => {
    const file = new File([blob], `qr-${participant.dorsal}-${participant.nombre.replace(/\s/g, '_')}.png`, { type: 'image/png' });

    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          text: `🏊‍♂️ Race Club Hub - Triatlón\n¡Hola ${participant.nombre}! Tu dorsal es #${participant.dorsal} (${participant.categoria}).\nPresentá este QR para check-in rápido. ¡Nos vemos en la meta! 🏁`,
          files: [file]
        });
        return;
      } catch (e) {
        // User cancelled or error, fall through to download + WhatsApp
      }
    }

    // Fallback: download image + open WhatsApp with text
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = file.name;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);

    // Then open WhatsApp with text message
    let phone = participant.telefono.replace(/[\s\-\(\)\.]/g, '');
    if (phone.startsWith('0')) phone = '506' + phone.substring(1);
    if (!phone.startsWith('+') && !phone.startsWith('506') && phone.length <= 8) {
      phone = '506' + phone;
    }
    phone = phone.replace('+', '');

    const message = encodeURIComponent(
      `🏊‍♂️🚴‍♂️🏃‍♂️ *Race Club Hub - Triatlón*\n\n` +
      `¡Hola ${participant.nombre}! 👋\n\n` +
      `Tu dorsal: *#${participant.dorsal}*\n` +
      `Categoría: ${participant.categoria}\n\n` +
      `📱 Te envío tu código QR como imagen. Presentalo el día de la carrera para check-in rápido.\n\n` +
      `¡Nos vemos en la meta! 🏁`
    );

    setTimeout(() => {
      window.open(`https://wa.me/${phone}?text=${message}`, '_blank');
      alert('💡 La imagen del QR se descargó. Adjuntala en el chat de WhatsApp que se acaba de abrir.');
    }, 500);
  }, 'image/png');
}

// Send individual Email
async function sendEmail(dorsal) {
  const participant = allParticipantsCache.find(p => p.dorsal === dorsal);
  if (!participant || !participant.email) return;

  // Generate QR image as base64 to embed in email
  const qrCanvas = document.createElement('canvas');
  const qrData = JSON.stringify({ dorsal: participant.dorsal, nombre: participant.nombre });
  new QRious({
    element: qrCanvas,
    value: qrData,
    size: 250,
    level: 'M'
  });
  const qrImage = qrCanvas.toDataURL('image/png');

  // Try server-side email with embedded QR
  try {
    const res = await fetch('/api/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dorsal: participant.dorsal, qrImage })
    });

    if (res.ok) {
      alert(`✅ Email enviado a ${participant.email} con el QR incluido`);
      return;
    }
  } catch (err) {
    // Fall through to mailto
  }

  // Fallback: open mailto link
  const subject = encodeURIComponent(`🏊‍♂️ Tu código QR - Triatlón Race Club Hub - Dorsal #${participant.dorsal}`);
  const body = encodeURIComponent(
    `¡Hola ${participant.nombre}!\n\n` +
    `Tu información para la carrera:\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `👤 Nombre: ${participant.nombre}\n` +
    `🔢 Dorsal: #${participant.dorsal}\n` +
    `🏷️ Categoría: ${participant.categoria}\n` +
    `━━━━━━━━━━━━━━━━━━━━\n\n` +
    `📱 Descargá tu QR aquí: ${window.location.origin}/qr.html?dorsal=${participant.dorsal}\n\n` +
    `Presentá tu código QR el día de la carrera para hacer check-in rápido.\n\n` +
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
