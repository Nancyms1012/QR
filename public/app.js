// ============ NAVIGATION ============
const navButtons = document.querySelectorAll('.nav-btn');
const views = document.querySelectorAll('.view');
let currentView = 'scanner';

navButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    const viewId = btn.dataset.view;
    currentView = viewId;
    navButtons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    views.forEach(v => v.classList.remove('active'));
    document.getElementById(`view-${viewId}`).classList.add('active');

    if (viewId === 'list') loadParticipantsList();
    if (viewId === 'stats') loadStats();
    if (viewId === 'qrcodes') loadQRCodes();
    if (viewId === 'send') loadSendList();
    if (viewId === 'admin') initAdmin();
  });
});

// ============ AUTO-REFRESH (every 10 seconds) ============
const btnRefresh = document.getElementById('btn-refresh');

function refreshCurrentView() {
  if (currentView === 'list') loadParticipantsList();
  else if (currentView === 'stats') loadStats();
  else if (currentView === 'send') loadSendList();
}

// Manual refresh button
if (btnRefresh) {
  btnRefresh.addEventListener('click', () => {
    refreshCurrentView();
    btnRefresh.textContent = '✅ Actualizado';
    setTimeout(() => { btnRefresh.textContent = '🔄 Actualizar'; }, 1500);
  });
}

// Auto-refresh every 10 seconds
setInterval(() => {
  // Only auto-refresh if modal is not open
  const modalOpen = !document.getElementById('checkin-modal').classList.contains('hidden') ||
                    !document.getElementById('edit-modal').classList.contains('hidden');
  if (!modalOpen) {
    refreshCurrentView();
  }
}, 10000);

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
    const isKit = currentParticipant.kitRetirado;
    const checkTime = currentParticipant.checkInTime
      ? new Date(currentParticipant.checkInTime).toLocaleString('es-CR')
      : '';
    const kitTime = currentParticipant.kitRetiroTime
      ? new Date(currentParticipant.kitRetiroTime).toLocaleString('es-CR')
      : '';

    const bgColor = getColorForParticipant(currentParticipant);
    const modalColorStyle = bgColor ? `border-left: 6px solid ${bgColor}; background: ${bgColor}15; padding: 1rem; border-radius: 8px;` : '';

    modalBody.innerHTML = `
      <div style="${modalColorStyle}">
        <div class="dorsal-big">#${currentParticipant.dorsal}</div>
        <div class="nombre-big">${getDisplayName(currentParticipant)}</div>
        <div class="categoria-big">${currentParticipant.categoria || ''}</div>
        ${currentParticipant.competencia ? `<div style="text-align:center;margin-bottom:0.3rem;"><span style="background:#fef3c7;color:#92400e;padding:0.3rem 0.8rem;border-radius:6px;font-size:0.85rem;font-weight:600;">🏅 ${currentParticipant.competencia}</span></div>` : ''}
        ${currentParticipant.talla ? `<div style="text-align:center;margin-bottom:0.3rem;"><span style="background:#eff6ff;color:#2563eb;padding:0.3rem 0.8rem;border-radius:6px;font-size:0.85rem;font-weight:600;">👕 Talla: ${currentParticipant.talla}</span></div>` : ''}
      </div>
      <div style="display:flex;flex-direction:column;gap:0.4rem;margin:1rem 0;">
        <div class="status-badge ${isChecked ? 'checked' : 'pending'}">
          ${isChecked ? `✅ Registro: ${checkTime}` : '⏳ Registro: Pendiente'}
        </div>
        <div class="status-badge ${isKit ? 'checked' : 'pending'}">
          ${isKit ? `📦 Kit retirado: ${kitTime}` : '📦 Kit: Pendiente'}
        </div>
      </div>
    `;

    const btnConfirmCheckin = document.getElementById('btn-confirm-checkin');
    const btnConfirmKit = document.getElementById('btn-confirm-kit');

    // Show/hide buttons based on status
    if (isChecked) {
      btnConfirmCheckin.classList.add('hidden');
    } else {
      btnConfirmCheckin.classList.remove('hidden');
    }

    if (isKit) {
      btnConfirmKit.classList.add('hidden');
    } else {
      btnConfirmKit.classList.remove('hidden');
    }

    if (isChecked || isKit) {
      btnUndoCheckin.classList.remove('hidden');
    } else {
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
    const res = await fetch(`/api/checkin/${currentParticipant.dorsal}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage: 'registro' })
    });
    const data = await res.json();

    if (res.ok) {
      currentParticipant = data.participant;
      showCheckinModal(currentParticipant.dorsal);

      scanResult.classList.remove('hidden');
      scanResult.className = 'result-card success';
      scanResult.innerHTML = `
        <h3>✅ Registro exitoso</h3>
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

// Kit pickup check-in
const btnConfirmKit = document.getElementById('btn-confirm-kit');
btnConfirmKit.addEventListener('click', async () => {
  if (!currentParticipant) return;
  try {
    const res = await fetch(`/api/checkin/${currentParticipant.dorsal}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage: 'kit' })
    });
    const data = await res.json();

    if (res.ok) {
      currentParticipant = data.participant;
      showCheckinModal(currentParticipant.dorsal);

      scanResult.classList.remove('hidden');
      scanResult.className = 'result-card success';
      scanResult.innerHTML = `
        <h3>📦 Kit entregado</h3>
        <p><strong>#${currentParticipant.dorsal}</strong> - ${currentParticipant.nombre}</p>
        <p style="color:#64748b">${currentParticipant.categoria}</p>
      `;
    } else {
      alert(data.message || data.error);
    }
  } catch (err) {
    alert('Error al registrar retiro de kit');
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
    <strong>#${currentParticipant.dorsal}</strong> - ${currentParticipant.nombre || ''} ${currentParticipant.apellidos || ''}
  `;
  document.getElementById('edit-nombre').value = currentParticipant.nombre || '';
  document.getElementById('edit-apellidos').value = currentParticipant.apellidos || '';
  document.getElementById('edit-genero').value = currentParticipant.genero || '';
  document.getElementById('edit-categoria').value = currentParticipant.categoria || '';
  document.getElementById('edit-competencia').value = currentParticipant.competencia || '';
  document.getElementById('edit-talla').value = currentParticipant.talla || '';
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

  const nombre = document.getElementById('edit-nombre').value.trim();
  const apellidos = document.getElementById('edit-apellidos').value.trim();
  const genero = document.getElementById('edit-genero').value.trim();
  const categoria = document.getElementById('edit-categoria').value.trim();
  const competencia = document.getElementById('edit-competencia').value.trim();
  const talla = document.getElementById('edit-talla').value.trim();
  const telefono = editTelefono.value.trim();
  const email = editEmail.value.trim();

  try {
    const res = await fetch(`/api/participants/${currentParticipant.dorsal}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre, apellidos, genero, categoria, competencia, talla, telefono, email })
    });

    const data = await res.json();

    if (res.ok) {
      alert(`✅ Datos actualizados`);
      Object.assign(currentParticipant, { nombre, apellidos, genero, categoria, competencia, talla, telefono, email });
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
      (p.nombre || '').toLowerCase().includes(query) ||
      (p.apellidos || '').toLowerCase().includes(query)
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
const filterCompetition = document.getElementById('filter-competition');
const filterCategory = document.getElementById('filter-category');
const filterStatus = document.getElementById('filter-status');
const participantsList = document.getElementById('participants-list');

filterCompetition.addEventListener('change', loadParticipantsList);
filterCategory.addEventListener('change', loadParticipantsList);
filterStatus.addEventListener('change', loadParticipantsList);

async function loadParticipantsList() {
  try {
    const res = await fetch('/api/participants');
    const participants = await res.json();

    // Populate competitions filter (once)
    const competitions = [...new Set(participants.map(p => p.competencia).filter(Boolean))].sort();
    if (filterCompetition.options.length <= 1) {
      competitions.forEach(comp => {
        const opt = document.createElement('option');
        opt.value = comp;
        opt.textContent = comp;
        filterCompetition.appendChild(opt);
      });
    }

    // Populate categories filter (once)
    const categories = [...new Set(participants.map(p => p.categoria).filter(Boolean))].sort();
    if (filterCategory.options.length <= 1) {
      categories.forEach(cat => {
        const opt = document.createElement('option');
        opt.value = cat;
        opt.textContent = cat;
        filterCategory.appendChild(opt);
      });
    }

    let filtered = participants;
    if (filterCompetition.value) {
      filtered = filtered.filter(p => p.competencia === filterCompetition.value);
    }
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

function getDisplayName(p) {
  return [p.nombre, p.apellidos].filter(Boolean).join(' ') || 'Sin nombre';
}

function getColorForParticipant(p) {
  // If color is set directly in data, use it
  if (p.color && p.color.trim()) return getColorStyle(p.color);
  // Auto-assign color based on competition name
  if (p.competencia) {
    const comp = p.competencia.toLowerCase();
    if (comp.includes('trail') && comp.includes('36')) return '#FF66CC';       // Rosado
    if (comp.includes('trail') && comp.includes('24')) return '#6699FF';       // Azul
    if (comp.includes('trail') && comp.includes('11')) return '#FFFF00';       // Amarillo
    if (comp.includes('trail') && comp.includes('5.5')) return '#CCFF33';      // Verde
    if (comp.includes('trail') && comp.includes('5 ')) return '#CCFF33';       // Verde (5 km)
    if (comp.includes('aguas')) return '#e2e8f0';                               // Blanco
    if (comp.includes('triatl') || comp.includes('sprint') || comp.includes('full') || comp.includes('relevo')) return '#e2e8f0'; // Blanco
  }
  return '';
}

function getColorStyle(color) {
  if (!color) return '';
  if (color.startsWith('#')) return color;
  const colorMap = {
    'blanco': '#e2e8f0',
    'amarillo': '#FFFF00',
    'verde': '#CCFF33',
    'azul': '#6699FF',
    'rosado': '#FF66CC', 'rosa': '#FF66CC',
    'rojo': '#dc2626',
    'naranja': '#ea580c',
    'morado': '#9333ea',
    'negro': '#1e293b',
    'celeste': '#06b6d4'
  };
  return colorMap[color.toLowerCase()] || color;
}

function createParticipantCard(p) {
  const statusClass = p.kitRetirado ? 'checked' : (p.checkedIn ? 'checked' : 'pending');
  let statusIcon = '⏳';
  if (p.checkedIn && p.kitRetirado) statusIcon = '✅📦';
  else if (p.checkedIn) statusIcon = '✅';
  
  const bgColor = getColorForParticipant(p);
  const cardStyle = bgColor ? `background: ${bgColor}20; border-left: 5px solid ${bgColor};` : '';

  return `
    <div class="participant-card ${statusClass}" data-dorsal="${p.dorsal}" style="${cardStyle}">
      <div class="participant-info">
        <span class="dorsal">#${p.dorsal}</span>
        <div class="nombre">${getDisplayName(p)}</div>
        <span class="categoria">${p.categoria || ''}</span>
        ${p.competencia ? `<span class="categoria" style="margin-left:0.3rem;">🏅 ${p.competencia}</span>` : ''}
        ${p.talla ? `<span class="categoria" style="margin-left:0.3rem;">👕 ${p.talla}</span>` : ''}
      </div>
      <div class="participant-status">${statusIcon}</div>
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
    const pctRegistro = stats.total > 0 ? Math.round((stats.checkedIn / stats.total) * 100) : 0;
    const pctKit = stats.total > 0 ? Math.round((stats.kitRetirado / stats.total) * 100) : 0;

    let categoriesHTML = '';
    for (const [cat, data] of Object.entries(stats.categories)) {
      const catPctR = data.total > 0 ? Math.round((data.checkedIn / data.total) * 100) : 0;
      const catPctK = data.total > 0 ? Math.round((data.kitRetirado / data.total) * 100) : 0;
      categoriesHTML += `
        <div class="stat-card">
          <h3>${cat}</h3>
          <p>✅ Registro: <strong>${data.checkedIn}</strong> / ${data.total}</p>
          <div class="progress-bar"><div class="progress-fill" style="width: ${catPctR}%"></div></div>
          <p style="margin-top:0.4rem;">📦 Kit: <strong>${data.kitRetirado}</strong> / ${data.total}</p>
          <div class="progress-bar"><div class="progress-fill" style="width: ${catPctK}%; background: linear-gradient(90deg, #2563eb, #60a5fa);"></div></div>
        </div>
      `;
    }

    document.getElementById('stats-container').innerHTML = `
      <div class="stat-card">
        <h3>✅ Check-in Registro</h3>
        <div class="stat-number">${stats.checkedIn} / ${stats.total}</div>
        <p style="color:var(--text-light)">${pctRegistro}% registrados · ${stats.pendingRegistro} pendientes</p>
        <div class="progress-bar"><div class="progress-fill" style="width: ${pctRegistro}%"></div></div>
      </div>
      <div class="stat-card">
        <h3>📦 Retiro de Kit</h3>
        <div class="stat-number">${stats.kitRetirado} / ${stats.total}</div>
        <p style="color:var(--text-light)">${pctKit}% retirados · ${stats.pendingKit} pendientes</p>
        <div class="progress-bar"><div class="progress-fill" style="width: ${pctKit}%; background: linear-gradient(90deg, #2563eb, #60a5fa);"></div></div>
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

// Select all / Deselect all / Send selected
const btnSelectAll = document.getElementById('btn-select-all');
const btnDeselectAll = document.getElementById('btn-deselect-all');
const btnSendSelectedEmail = document.getElementById('btn-send-selected-email');

if (btnSelectAll) {
  btnSelectAll.addEventListener('click', () => {
    document.querySelectorAll('.participant-check:not(:disabled)').forEach(cb => cb.checked = true);
    updateSelectedCount();
  });
}

if (btnDeselectAll) {
  btnDeselectAll.addEventListener('click', () => {
    document.querySelectorAll('.participant-check').forEach(cb => cb.checked = false);
    updateSelectedCount();
  });
}

if (btnSendSelectedEmail) {
  btnSendSelectedEmail.addEventListener('click', sendSelectedEmails);
}

// Listen for checkbox changes
document.addEventListener('change', (e) => {
  if (e.target.classList.contains('participant-check')) {
    updateSelectedCount();
  }
});

function updateSelectedCount() {
  const selected = document.querySelectorAll('.participant-check:checked').length;
  const countEl = document.getElementById('selected-count');
  if (countEl) {
    countEl.textContent = selected > 0 ? `✉️ ${selected} seleccionado(s) para envío por email` : '';
  }
}

async function sendSelectedEmails() {
  const checked = document.querySelectorAll('.participant-check:checked');
  const dorsals = Array.from(checked).map(cb => parseInt(cb.dataset.dorsal));

  if (dorsals.length === 0) {
    alert('Seleccioná al menos un participante con la casilla ☑️');
    return;
  }

  const confirmed = confirm(`¿Enviar email con QR a ${dorsals.length} participante(s) seleccionado(s)?`);
  if (!confirmed) return;

  let sent = 0;
  let failed = 0;

  for (const dorsal of dorsals) {
    try {
      const participant = allParticipantsCache.find(p => p.dorsal === dorsal);
      if (!participant || !participant.email) { failed++; continue; }

      // Generate QR
      const qrCanvas = document.createElement('canvas');
      const qrData = JSON.stringify({ dorsal: participant.dorsal, nombre: participant.nombre });
      new QRious({ element: qrCanvas, value: qrData, size: 250, level: 'M' });
      const qrImage = qrCanvas.toDataURL('image/png');

      const res = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dorsal, qrImage })
      });

      if (res.ok) { sent++; } else { failed++; }
    } catch (err) {
      failed++;
    }

    // Delay for rate limiting
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  alert(`✅ Envío completo:\n• Enviados: ${sent}\n• Fallidos: ${failed}`);

  // Uncheck all after sending
  document.querySelectorAll('.participant-check:checked').forEach(cb => cb.checked = false);
  updateSelectedCount();
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
        <label class="send-checkbox">
          <input type="checkbox" class="participant-check" data-dorsal="${p.dorsal}" ${hasEmail ? '' : 'disabled'} />
        </label>
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

  updateSelectedCount();
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

// Bulk send Email (replaced by sendSelectedEmails with checkboxes)



// ============ ADMIN - UPLOAD + RESET ============
function initAdmin() {
  // Already initialized via event listeners below
}

// File upload
const btnUpload = document.getElementById('btn-upload');
const fileUpload = document.getElementById('file-upload');
const uploadMode = document.getElementById('upload-mode');
const uploadResult = document.getElementById('upload-result');

if (btnUpload) {
  btnUpload.addEventListener('click', handleFileUpload);
}

async function handleFileUpload() {
  const file = fileUpload.files[0];
  if (!file) {
    alert('Seleccioná un archivo primero');
    return;
  }

  uploadResult.innerHTML = '<p style="color:#64748b;">⏳ Procesando archivo...</p>';

  try {
    let participants = [];

    if (file.name.endsWith('.json')) {
      // JSON file
      const text = await file.text();
      participants = JSON.parse(text);
    } else if (file.name.endsWith('.csv')) {
      // CSV file - try UTF-8 first, then Latin-1
      let text = await file.text();
      // Check for encoding issues (replacement chars)
      if (text.includes('�') || text.includes('Ã')) {
        // Try reading as Latin-1
        const buffer = await file.arrayBuffer();
        const decoder = new TextDecoder('latin1');
        text = decoder.decode(buffer);
      }
      participants = parseCSV(text);
    } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
      // Excel - parse as CSV (basic support)
      uploadResult.innerHTML = '<p style="color:#f59e0b;">⚠️ Para archivos Excel, exportá como CSV primero (Archivo → Guardar como → CSV). O usá formato JSON.</p>';
      return;
    } else {
      alert('Formato no soportado. Usá CSV o JSON.');
      return;
    }

    if (participants.length === 0) {
      uploadResult.innerHTML = '<p style="color:red;">❌ No se encontraron participantes en el archivo</p>';
      return;
    }

    const mode = uploadMode.value;
    const confirmed = confirm(
      mode === 'replace'
        ? `⚠️ REEMPLAZAR: Esto va a reemplazar TODOS los participantes actuales con los ${participants.length} del archivo. ¿Continuar?`
        : `Fusionar: Se van a agregar/actualizar ${participants.length} participantes. Los existentes se mantienen. ¿Continuar?`
    );

    if (!confirmed) {
      uploadResult.innerHTML = '';
      return;
    }

    const res = await fetch('/api/upload-participants', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ participants, mode })
    });

    const data = await res.json();

    if (res.ok) {
      uploadResult.innerHTML = `
        <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:1rem;">
          <p style="color:#166534;font-weight:600;margin:0;">✅ ${data.message}</p>
          <p style="color:#166534;font-size:0.85rem;margin:0.5rem 0 0;">Total participantes: ${data.total}</p>
          ${data.invalid && data.invalid.length > 0 ? `<p style="color:#92400e;font-size:0.85rem;margin:0.5rem 0 0;">⚠️ ${data.invalid.length} filas inválidas (sin dorsal o nombre)</p>` : ''}
        </div>
      `;
    } else {
      uploadResult.innerHTML = `<p style="color:red;">❌ Error: ${data.error}</p>`;
    }
  } catch (err) {
    uploadResult.innerHTML = `<p style="color:red;">❌ Error procesando archivo: ${err.message}</p>`;
  }
}

function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];

  // Parse header - normalize column names
  const header = lines[0].split(/[,;\t]/).map(h => h.trim().toUpperCase().replace(/['"]/g, ''));

  // Map common column name variations
  const colMap = {};
  header.forEach((h, i) => {
    if (h.includes('DORSAL') || h === 'NUM' || h === 'NUMERO' || h === 'BIB' || h === 'NÚMERO') colMap.dorsal = i;
    else if (h === 'NOMBRE' || h === 'NAME' || h.includes('NOMBRE_BD')) colMap.nombre = i;
    else if (h === 'APELLIDOS' || h === 'APELLIDO' || h === 'LAST_NAME' || h === 'LASTNAME') colMap.apellidos = i;
    else if (h === 'GENERO' || h === 'GÉNERO' || h === 'SEXO' || h === 'GENDER') colMap.genero = i;
    else if (h.includes('CATEG') || h.includes('CATEGORY') || h.includes('NUEVA_CATEGORIA')) colMap.categoria = i;
    else if (h === 'COMPETENCIA' || h === 'COMPETITION' || h === 'EVENTO' || h === 'EVENT') colMap.competencia = i;
    else if (h.includes('TEL') || h.includes('PHONE') || h.includes('CEL')) colMap.telefono = i;
    else if (h.includes('EMAIL') || h.includes('CORREO') || h.includes('MAIL')) colMap.email = i;
    else if (h.includes('TALLA') || h.includes('SIZE') || h.includes('JERSEY')) colMap.talla = i;
    else if (h === 'COLOR' || h === 'COLOR_DORSAL') colMap.color = i;
  });

  if (colMap.dorsal === undefined || colMap.nombre === undefined) {
    // Try to detect by position (DORSAL, NOMBRE, CATEGORIA)
    if (header.length >= 2) {
      colMap.dorsal = 0;
      colMap.nombre = 1;
      if (header.length >= 3) colMap.categoria = 2;
    }
  }

  const participants = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(/[,;\t]/).map(c => c.trim().replace(/^['"]|['"]$/g, ''));
    
    const p = {};
    if (colMap.dorsal !== undefined) p.dorsal = parseInt(cols[colMap.dorsal]);
    if (colMap.nombre !== undefined) p.nombre = cols[colMap.nombre] || '';
    if (colMap.apellidos !== undefined) p.apellidos = cols[colMap.apellidos] || '';
    if (colMap.genero !== undefined) p.genero = cols[colMap.genero] || '';
    if (colMap.categoria !== undefined) p.categoria = cols[colMap.categoria] || '';
    if (colMap.competencia !== undefined) p.competencia = cols[colMap.competencia] || '';
    if (colMap.telefono !== undefined) p.telefono = cols[colMap.telefono] || '';
    if (colMap.email !== undefined) p.email = cols[colMap.email] || '';
    if (colMap.talla !== undefined) p.talla = cols[colMap.talla] || '';
    if (colMap.color !== undefined) p.color = cols[colMap.color] || '';

    if (p.dorsal && p.nombre) {
      participants.push(p);
    }
  }

  return participants;
}

// Reset check-ins
const btnResetCheckins = document.getElementById('btn-reset-checkins');
if (btnResetCheckins) {
  btnResetCheckins.addEventListener('click', async () => {
    const confirmed = confirm('⚠️ ¿Estás seguro? Esto va a borrar TODOS los registros de check-in. Los participantes se mantienen.');
    if (!confirmed) return;

    try {
      const res = await fetch('/api/reset', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        alert('✅ ' + data.message);
      } else {
        alert('❌ Error: ' + data.error);
      }
    } catch (err) {
      alert('❌ Error de conexión');
    }
  });
}
