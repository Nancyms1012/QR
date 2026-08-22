// ============ NAVIGATION ============
const navButtons = document.querySelectorAll('.nav-btn');
const views = document.querySelectorAll('.view');
let currentView = 'registro';

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
    if (viewId === 'kit') loadKitList();
    if (viewId === 'completados') loadCompletadosList();
    if (viewId === 'registro') loadRegistroList();
    if (viewId === 'kids') loadKidsView();
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

// Auto-refresh every 30 seconds (only when toggle is ON)
const toggleAutorefresh = document.getElementById('toggle-autorefresh');

setInterval(() => {
  if (!toggleAutorefresh || !toggleAutorefresh.checked) return;
  // Only auto-refresh if modal is not open
  const modalOpen = !document.getElementById('checkin-modal').classList.contains('hidden') ||
                    !document.getElementById('edit-modal').classList.contains('hidden');
  if (!modalOpen) {
    refreshCurrentView();
  }
}, 30000);

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

async function showCheckinModal(uid) {
  try {
    const res = await fetch(`/api/participants/${uid}`);
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
        ${currentParticipant.licencia ? `<div style="text-align:center;color:var(--text-light);font-size:0.9rem;">📜 Licencia: <span style="color:${currentParticipant.licencia.toLowerCase() === 'si' ? '#16a34a' : '#dc2626'};font-weight:700;">${currentParticipant.licencia}</span></div>` : ''}
        ${currentParticipant.socio && currentParticipant.socio.toLowerCase() === 'si' ? `<div style="text-align:center;margin:0.4rem 0;"><span style="background:#FFBA31;color:#1e3a5f;padding:0.3rem 0.8rem;border-radius:6px;font-weight:700;font-size:1rem;">✓ SOCIO: SÍ</span></div>` : '<div style="text-align:center;margin:0.4rem 0;">Socio: NO</div>'}
        <div class="categoria-big">${currentParticipant.categoria || ''}</div>
        ${currentParticipant.competencia ? `<div style="text-align:center;margin-bottom:0.3rem;font-size:0.9rem;color:var(--text-light);">${currentParticipant.competencia}</div>` : ''}
        ${currentParticipant.equipo ? `<div style="text-align:center;margin-bottom:0.3rem;"><span style="background:#fef3c7;color:#92400e;padding:0.3rem 0.8rem;border-radius:6px;font-size:0.95rem;font-weight:700;">🏆 Equipo: ${currentParticipant.equipo}</span></div>` : ''}
        ${currentParticipant.talla ? `<div style="text-align:center;margin-bottom:0.5rem;"><span style="background:#eff6ff;color:#2563eb;padding:0.3rem 0.8rem;border-radius:6px;font-size:0.85rem;font-weight:600;">👕 Talla: ${currentParticipant.talla}</span></div>` : ''}
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

    // Registro button: show if not checked in
    if (!isChecked) {
      btnConfirmCheckin.classList.remove('hidden');
    } else {
      btnConfirmCheckin.classList.add('hidden');
    }

    if (isChecked || isKit) {
      btnUndoCheckin.classList.remove('hidden');
    } else {
      btnUndoCheckin.classList.add('hidden');
    }

    modal.classList.remove('hidden');
  } catch (err) {
    alert('Participante no encontrado');
  }
}

btnConfirmCheckin.addEventListener('click', async () => {
  if (!currentParticipant) return;
  try {
    const res = await fetch(`/api/checkin/${currentParticipant.uid}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage: 'registro' })
    });
    const data = await res.json();

    if (res.ok) {
      currentParticipant = data.participant;
      showCheckinModal(currentParticipant.uid);

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


btnUndoCheckin.addEventListener('click', async () => {
  if (!currentParticipant) return;
  if (!confirm(`¿Revertir check-in de ${currentParticipant.nombre}?`)) return;
  try {
    const res = await fetch(`/api/undo-checkin/${currentParticipant.uid}`, { method: 'POST' });
    const data = await res.json();
    if (res.ok) {
      currentParticipant = data.participant;
      showCheckinModal(currentParticipant.uid);
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
  document.getElementById('edit-talla').value = currentParticipant.talla || '';
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

  const talla = document.getElementById('edit-talla').value.trim();

  try {
    const res = await fetch(`/api/participants/${currentParticipant.uid}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ talla })
    });

    const data = await res.json();

    if (res.ok) {
      alert(`✅ Talla actualizada`);
      currentParticipant.talla = talla;
      editModal.classList.add('hidden');
      showCheckinModal(currentParticipant.uid);
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

    const filtered = participants.filter(p => {
      const dorsalStr = p.dorsal.toString();
      const nombre = (p.nombre || '').toLowerCase();
      const apellidos = (p.apellidos || '').toLowerCase();
      // If query looks like a number, match exact dorsal
      if (/^\d+$/.test(query)) {
        return dorsalStr === query;
      }
      // Otherwise search by name/apellidos
      return nombre.includes(query) || apellidos.includes(query);
    });

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

filterCompetition.addEventListener('change', () => {
  // Reset category filter when competition changes
  filterCategory.innerHTML = '<option value="">Todas las categorías</option>';
  loadParticipantsList();
});
filterCategory.addEventListener('change', loadParticipantsList);
filterStatus.addEventListener('change', loadParticipantsList);

async function loadParticipantsList() {
  try {
    // If no competition AND no status filter, show message
    if (!filterCompetition.value && !filterStatus.value) {
      if (filterCompetition.options.length <= 1) {
        await loadFilterOptions();
      }
      participantsList.innerHTML = '<p style="color:#64748b;text-align:center;padding:2rem;">⬆️ Seleccioná una competencia o un estado para ver los participantes</p>';
      return;
    }

    const res = await fetch('/api/participants');
    const participants = await res.json();

    if (!Array.isArray(participants)) {
      participantsList.innerHTML = '<p style="color:red;">Error al cargar datos</p>';
      return;
    }

    // Populate competitions filter (once)
    if (filterCompetition.options.length <= 1) {
      const competitions = [...new Set(participants.map(p => p.competencia).filter(Boolean))].sort();
      competitions.forEach(comp => {
        const opt = document.createElement('option');
        opt.value = comp;
        opt.textContent = comp;
        filterCompetition.appendChild(opt);
      });
    }

    // Filter by selected competition first
    let filtered = participants;
    if (filterCompetition.value) {
      filtered = filtered.filter(p => p.competencia === filterCompetition.value);
    }

    // Populate categories based on filtered results
    const compFiltered = filtered;
    if (filterCategory.options.length <= 1) {
      const categories = [...new Set(compFiltered.map(p => p.categoria).filter(Boolean))].sort();
      categories.forEach(cat => {
        const opt = document.createElement('option');
        opt.value = cat;
        opt.textContent = cat;
        filterCategory.appendChild(opt);
      });
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
    participantsList.innerHTML = filtered.length > 0
      ? `<p style="font-weight:600;color:var(--text-light);margin-bottom:0.5rem;">📋 ${filtered.length} participante(s)</p>` + filtered.map(p => createParticipantCard(p)).join('')
      : '<p style="color:#64748b;text-align:center;padding:2rem;">No se encontraron participantes</p>';
    attachCardListeners();
  } catch (err) {
    participantsList.innerHTML = '<p style="color:red;">Error al cargar lista</p>';
  }
}

async function loadFilterOptions() {
  try {
    const res = await fetch('/api/participants');
    const participants = await res.json();
    if (!Array.isArray(participants)) return;

    const competitions = [...new Set(participants.map(p => p.competencia).filter(Boolean))].sort();
    competitions.forEach(comp => {
      const opt = document.createElement('option');
      opt.value = comp;
      opt.textContent = comp;
      filterCompetition.appendChild(opt);
    });

    const categories = [...new Set(participants.map(p => p.categoria).filter(Boolean))].sort();
    categories.forEach(cat => {
      const opt = document.createElement('option');
      opt.value = cat;
      opt.textContent = cat;
      filterCategory.appendChild(opt);
    });
  } catch (e) {
    // Silently fail - filters just won't populate
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
    if (comp.includes('trail') && (comp.includes('36') || comp.includes('35'))) return '#FF66CC';  // Rosado
    if (comp.includes('trail') && (comp.includes('24') || comp.includes('21'))) return '#6699FF';  // Azul
    if (comp.includes('trail') && (comp.includes('11') || comp.includes('12'))) return '#FFFF00';  // Amarillo
    if (comp.includes('trail') && comp.includes('5.5')) return '#92D050';                           // Verde
    if (comp.includes('trail') && comp.match(/\b5\b/)) return '#92D050';                            // Verde (5 km exacto)
    if (comp.includes('aguas')) return '#e2e8f0';
    if (comp.includes('triatl') || comp.includes('sprint') || comp.includes('full') || comp.includes('relevo')) return '#e2e8f0';
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
  
  const bgColor = getColorForParticipant(p);
  const cardStyle = bgColor ? `border-left: 5px solid ${bgColor}; background: ${bgColor}25;` : '';

  return `
    <div class="participant-card ${statusClass}" data-uid="${p.uid}" style="${cardStyle}">
      <div class="participant-info">
        <span class="dorsal">#${p.dorsal}</span>
        <div class="nombre">${getDisplayName(p)}</div>
        <div class="participant-details">
          ${p.categoria ? `<span>🏷️ ${p.categoria}</span>` : ''}
          ${p.competencia ? `<span>🏅 ${p.competencia}</span>` : ''}
          ${p.genero ? `<span>⚧️ ${p.genero === 'M' ? 'Masculino' : p.genero === 'W' ? 'Femenino' : p.genero}</span>` : ''}
          ${p.talla ? `<span>👕 ${p.talla}</span>` : ''}
          ${p.licencia ? `<span style="background:#e2e8f0;font-weight:700;font-size:0.95rem;">📜 ${p.licencia}</span>` : ''}
          ${p.socio && p.socio.toLowerCase() === 'si' ? `<span style="background:#FFBA31;color:#1e3a5f;font-weight:700;">✓ SOCIO: SÍ</span>` : `<span>Socio: NO</span>`}
          ${p.equipo ? `<span style="background:#C5D9F1;color:#1e293b;font-weight:700;">🏆 ${p.equipo}</span>` : ''}
        </div>
      </div>
    </div>
  `;
}

function attachCardListeners() {
  document.querySelectorAll('.participant-card').forEach(card => {
    card.addEventListener('click', () => {
      showCheckinModal(parseInt(card.dataset.uid));
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

    let competenciasHTML = '';
    for (const [comp, data] of Object.entries(stats.competencias || {})) {
      const catPctR = data.total > 0 ? Math.round((data.checkedIn / data.total) * 100) : 0;
      const catPctK = data.total > 0 ? Math.round((data.kitRetirado / data.total) * 100) : 0;
      competenciasHTML += `
        <div class="stat-card">
          <h3>${comp}</h3>
          <p style="font-size:0.85rem;color:var(--text-light);">Total: <strong>${data.total}</strong></p>
          <p>✅ Registro: <strong>${data.checkedIn}</strong> / ${data.total}</p>
          <div class="progress-bar"><div class="progress-fill" style="width: ${catPctR}%"></div></div>
          <p style="margin-top:0.4rem;">📦 Kit: <strong>${data.kitRetirado}</strong> / ${data.total}</p>
          <div class="progress-bar"><div class="progress-fill" style="width: ${catPctK}%; background: linear-gradient(90deg, #2563eb, #60a5fa);"></div></div>
        </div>
      `;
    }

    document.getElementById('stats-container').innerHTML = `
      <div class="stat-card">
        <h3>✅ Registro</h3>
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
      <h3 style="margin-top:1rem;">Por Competencia</h3>
      <div class="stat-grid">${competenciasHTML}</div>
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
      <div class="send-card" data-uid="${p.uid}">
        <label class="send-checkbox">
          <input type="checkbox" class="participant-check" data-uid="${p.uid}" ${hasEmail ? '' : 'disabled'} />
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



// ============ ADMIN - MODULES + UPLOAD + RESET ============
function initAdmin() {
  loadModuleSettings();
}

// Module visibility
const moduleScanner = document.getElementById('module-scanner');
const moduleRegistro = document.getElementById('module-registro');
const moduleQrcodes = document.getElementById('module-qrcodes');
const moduleSend = document.getElementById('module-send');
const moduleKit = document.getElementById('module-kit');
const moduleCompletados = document.getElementById('module-completados');
const moduleKids = document.getElementById('module-kids');

function loadModuleSettings() {
  const defaults = { scanner: true, registro: true, qrcodes: true, send: true, kit: false, completados: true, kids: true };
  const saved = JSON.parse(localStorage.getItem('xterra-modules') || '{}');
  const settings = { ...defaults, ...saved };
  if (moduleScanner) moduleScanner.checked = settings.scanner !== false;
  if (moduleRegistro) moduleRegistro.checked = settings.registro !== false;
  if (moduleQrcodes) moduleQrcodes.checked = settings.qrcodes !== false;
  if (moduleSend) moduleSend.checked = settings.send !== false;
  if (moduleKit) moduleKit.checked = settings.kit !== false;
  if (moduleCompletados) moduleCompletados.checked = settings.completados !== false;
  if (moduleKids) moduleKids.checked = settings.kids !== false;
  applyModuleVisibility(settings);
}

function applyModuleVisibility(settings) {
  const scannerTab = document.querySelector('[data-view="scanner"]');
  const registroTab = document.querySelector('[data-view="registro"]');
  const qrcodesTab = document.querySelector('[data-view="qrcodes"]');
  const sendTab = document.querySelector('[data-view="send"]');
  const kitTab = document.querySelector('[data-view="kit"]');
  const completadosTab = document.querySelector('[data-view="completados"]');
  const kidsTab = document.querySelector('[data-view="kids"]');

  if (scannerTab) scannerTab.style.display = settings.scanner !== false ? '' : 'none';
  if (registroTab) registroTab.style.display = settings.registro !== false ? '' : 'none';
  if (qrcodesTab) qrcodesTab.style.display = settings.qrcodes !== false ? '' : 'none';
  if (sendTab) sendTab.style.display = settings.send !== false ? '' : 'none';
  if (kitTab) kitTab.style.display = settings.kit !== false ? '' : 'none';
  if (completadosTab) completadosTab.style.display = settings.completados !== false ? '' : 'none';
  if (kidsTab) kidsTab.style.display = settings.kids !== false ? '' : 'none';
}

function saveModuleSettings() {
  const settings = {
    scanner: moduleScanner ? moduleScanner.checked : true,
    registro: moduleRegistro ? moduleRegistro.checked : true,
    qrcodes: moduleQrcodes ? moduleQrcodes.checked : true,
    send: moduleSend ? moduleSend.checked : true,
    kit: moduleKit ? moduleKit.checked : true,
    completados: moduleCompletados ? moduleCompletados.checked : true,
    kids: moduleKids ? moduleKids.checked : true
  };
  localStorage.setItem('xterra-modules', JSON.stringify(settings));
  applyModuleVisibility(settings);
}

if (moduleScanner) moduleScanner.addEventListener('change', saveModuleSettings);
if (moduleRegistro) moduleRegistro.addEventListener('change', saveModuleSettings);
if (moduleQrcodes) moduleQrcodes.addEventListener('change', saveModuleSettings);
if (moduleSend) moduleSend.addEventListener('change', saveModuleSettings);
if (moduleKit) moduleKit.addEventListener('change', saveModuleSettings);
if (moduleCompletados) moduleCompletados.addEventListener('change', saveModuleSettings);
if (moduleKids) moduleKids.addEventListener('change', saveModuleSettings);

// Load module settings on page load
loadModuleSettings();

// Load default view (Registro) on page load
// No list to load - just search

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
  // Remove BOM character if present (anywhere in the text)
  text = text.replace(/\uFEFF/g, '').replace(/\xEF\xBB\xBF/g, '');
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];

  // Parse header - normalize column names, remove BOM and any non-printable chars
  const rawHeaderLine = lines[0].replace(/^[^\x20-\x7E]+/, '').replace(/[\uFEFF\xEF\xBB\xBF]/g, '');
  const header = rawHeaderLine.split(/[,;\t]/).map(h => h.trim().toUpperCase().replace(/['"]/g, '').replace(/[^\x20-\x7E]/g, ''));

  // Map column names - use exact matches to avoid ambiguity
  const colMap = {};
  header.forEach((h, i) => {
    if (!h) return;
    if (h === 'NUMERO' || h === 'NMERO' || h === 'DORSAL' || h === 'NUM' || h === 'BIB' || h === 'NO') colMap.dorsal = i;
    else if (h === 'NOMBRE' || h === 'NAME' || h === 'NOMBRE_BD' || h === 'FIRST_NAME') colMap.nombre = i;
    else if (h === 'APELLIDOS' || h === 'APELLIDO' || h === 'LAST_NAME' || h === 'LASTNAME') colMap.apellidos = i;
    else if (h === 'GENERO' || h === 'GNERO' || h === 'SEXO' || h === 'GENDER' || h === 'GEN') colMap.genero = i;
    else if (h === 'CATEGORIA' || h === 'CATEGORA' || h === 'NUEVA_CATEGORIA') colMap.categoria = i;
    else if (h === 'COMPETENCIA' || h === 'COMPETITION' || h === 'EVENTO' || h === 'EVENT' || h === 'PRUEBA') colMap.competencia = i;
    else if (h === 'TELEFONO' || h === 'TELFONO' || h === 'CELULAR' || h === 'PHONE' || h === 'CEL') colMap.telefono = i;
    else if (h === 'EMAIL' || h === 'CORREO' || h === 'MAIL') colMap.email = i;
    else if (h === 'TALLA' || h === 'SIZE' || h === 'JERSEY') colMap.talla = i;
    else if (h === 'COLOR' || h === 'COLOR_DORSAL') colMap.color = i;
    else if (h === 'ID' || h === 'ID_PARTICIPANTE') colMap.id_participante = i;
    else if (h === 'SOCIO') colMap.socio = i;
    else if (h === 'LICENCIA' || h === 'LICENSE') colMap.licencia = i;
    else if (h === 'EQUIPO' || h === 'TEAM') colMap.equipo = i;
  });

  // Debug alert - remove after confirming it works
  console.log('Columnas: ' + JSON.stringify(header) + ' Mapeo: ' + JSON.stringify(colMap));

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
    if (colMap.id_participante !== undefined) p.id_participante = cols[colMap.id_participante] || '';
    if (colMap.socio !== undefined) p.socio = cols[colMap.socio] || '';
    if (colMap.licencia !== undefined) p.licencia = cols[colMap.licencia] || '';
    if (colMap.equipo !== undefined) p.equipo = cols[colMap.equipo] || '';

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



// ============ KIT DELIVERY VIEW ============
const kitFilterCompetition = document.getElementById('kit-filter-competition');
const kitSearchInput = document.getElementById('kit-search-input');
const kitList = document.getElementById('kit-list');

if (kitFilterCompetition) kitFilterCompetition.addEventListener('change', loadKitList);
if (kitSearchInput) kitSearchInput.addEventListener('keyup', loadKitList);

async function loadKitList() {
  try {
    const res = await fetch('/api/kit-pending');
    const participants = await res.json();
    if (!Array.isArray(participants)) {
      kitList.innerHTML = '<p style="color:red;">Error al cargar</p>';
      return;
    }

    // Populate filter (once)
    if (kitFilterCompetition && kitFilterCompetition.options.length <= 1) {
      const comps = [...new Set(participants.map(p => p.competencia).filter(Boolean))].sort();
      comps.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c;
        opt.textContent = c;
        kitFilterCompetition.appendChild(opt);
      });
    }

    let filtered = participants;

    // Apply competition filter
    if (kitFilterCompetition && kitFilterCompetition.value) {
      filtered = filtered.filter(p => p.competencia === kitFilterCompetition.value);
    }

    // Apply search
    if (kitSearchInput && kitSearchInput.value.trim()) {
      const query = kitSearchInput.value.trim().toLowerCase();
      filtered = filtered.filter(p => {
        if (/^\d+$/.test(query)) return p.dorsal.toString() === query;
        return (p.nombre || '').toLowerCase().includes(query) || (p.apellidos || '').toLowerCase().includes(query);
      });
    }

    filtered.sort((a, b) => {
      // Sort by check-in time (oldest first = first to arrive, first to get kit)
      const timeA = a.checkInTime ? new Date(a.checkInTime).getTime() : 0;
      const timeB = b.checkInTime ? new Date(b.checkInTime).getTime() : 0;
      return timeA - timeB;
    });

    if (filtered.length === 0) {
      kitList.innerHTML = '<p style="color:#64748b;text-align:center;padding:2rem;">No hay participantes pendientes de kit</p>';
      return;
    }

    kitList.innerHTML = filtered.map(p => {
      const bgColor = getColorForParticipant(p);
      const cardStyle = bgColor ? `border-left: 5px solid ${bgColor}; background: ${bgColor}25;` : '';
      const generoLabel = p.genero === 'M' ? 'Masculino' : p.genero === 'W' ? 'Femenino' : p.genero || '';
      return `
        <div class="send-card" style="${cardStyle}">
          <div class="send-info">
            <span class="dorsal" style="font-size:1.8rem;">#${p.dorsal}</span>
            <div class="nombre">${getDisplayName(p)}</div>
            <div class="contacto">
              <span>🏷️ ${p.categoria || ''}</span>
              <span>🏅 ${p.competencia || ''}</span>
            </div>
            <div style="margin-top:0.4rem;display:flex;gap:0.5rem;flex-wrap:wrap;">
              ${p.talla ? `<span style="background:#2563eb;color:white;padding:0.3rem 0.8rem;border-radius:6px;font-size:1.1rem;font-weight:700;">👕 ${p.talla}</span>` : ''}
              ${generoLabel ? `<span style="background:#9333ea;color:white;padding:0.3rem 0.8rem;border-radius:6px;font-size:1.1rem;font-weight:700;">⚧️ ${generoLabel}</span>` : ''}
            </div>
          </div>
          <button class="btn btn-primary" onclick="entregarKit(${p.uid})" style="white-space:nowrap;">
            📦 Entregar Kit
          </button>
        </div>
      `;
    }).join('');
  } catch (err) {
    kitList.innerHTML = '<p style="color:red;">Error al cargar</p>';
  }
}

async function entregarKit(uid) {
  try {
    const res = await fetch(`/api/checkin/${uid}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage: 'kit' })
    });
    const data = await res.json();

    if (res.ok) {
      // Reload the kit list (participant moves to completados)
      loadKitList();
    } else {
      alert(data.message || data.error);
    }
  } catch (err) {
    alert('Error al registrar entrega de kit');
  }
}

// ============ COMPLETADOS VIEW ============
const completadosFilterCompetition = document.getElementById('completados-filter-competition');
const completadosList = document.getElementById('completados-list');
const completadosCount = document.getElementById('completados-count');

if (completadosFilterCompetition) completadosFilterCompetition.addEventListener('change', loadCompletadosList);
const completadosSearch = document.getElementById('completados-search');
if (completadosSearch) completadosSearch.addEventListener('keyup', loadCompletadosList);

async function loadCompletadosList() {
  try {
    const res = await fetch('/api/completados');
    const participants = await res.json();
    if (!Array.isArray(participants)) {
      completadosList.innerHTML = '<p style="color:red;">Error al cargar</p>';
      return;
    }

    // Populate filter (once)
    if (completadosFilterCompetition && completadosFilterCompetition.options.length <= 1) {
      const comps = [...new Set(participants.map(p => p.competencia).filter(Boolean))].sort();
      comps.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c;
        opt.textContent = c;
        completadosFilterCompetition.appendChild(opt);
      });
    }

    let filtered = participants;

    // Apply competition filter
    if (completadosFilterCompetition && completadosFilterCompetition.value) {
      filtered = filtered.filter(p => p.competencia === completadosFilterCompetition.value);
    }

    // Apply search
    if (completadosSearch && completadosSearch.value.trim()) {
      const query = completadosSearch.value.trim().toLowerCase();
      filtered = filtered.filter(p => {
        if (/^\d+$/.test(query)) return p.dorsal.toString() === query;
        return (p.nombre || '').toLowerCase().includes(query) || (p.apellidos || '').toLowerCase().includes(query);
      });
    }

    filtered.sort((a, b) => a.dorsal - b.dorsal);

    if (completadosCount) {
      completadosCount.textContent = `✅ ${filtered.length} participante(s) completado(s)`;
    }

    if (filtered.length === 0) {
      completadosList.innerHTML = '<p style="color:#64748b;text-align:center;padding:2rem;">Aún no hay participantes completados</p>';
      return;
    }

    completadosList.innerHTML = filtered.map(p => {
      const bgColor = getColorForParticipant(p);
      const cardStyle = bgColor ? `border-left: 5px solid ${bgColor}; background: ${bgColor}25;` : '';
      const kitTime = p.kitRetiroTime ? new Date(p.kitRetiroTime).toLocaleString('es-CR') : '';
      return `
        <div class="send-card" style="${cardStyle}">
          <div class="send-info">
            <span class="dorsal">#${p.dorsal}</span>
            <div class="nombre">${getDisplayName(p)}</div>
            <div class="contacto">
              <span>🏅 ${p.competencia || ''}</span>
              ${p.talla ? `<span>👕 ${p.talla}</span>` : ''}
              <span>✅ ${kitTime}</span>
            </div>
          </div>
          <button class="btn btn-danger" onclick="revertirCheckin(${p.uid})" style="padding:0.3rem 0.6rem;font-size:0.8rem;white-space:nowrap;">
            ↩️ Revertir
          </button>
        </div>
      `;
    }).join('');
  } catch (err) {
    completadosList.innerHTML = '<p style="color:red;">Error al cargar</p>';
  }
}



// ============ REGISTRO VIEW ============
const regSearchInput = document.getElementById('reg-search-input');
const regSearchResults = document.getElementById('reg-search-results');
const regList = document.getElementById('reg-list');

if (regSearchInput) regSearchInput.addEventListener('keyup', searchForRegistro);

async function loadRegistroList() {
  // No list needed - only search
}

async function searchForRegistro() {
  const query = regSearchInput.value.trim().toLowerCase();
  if (!query || query.length < 1) {
    regSearchResults.innerHTML = '';
    return;
  }

  try {
    const res = await fetch('/api/participants');
    const participants = await res.json();
    if (!Array.isArray(participants)) return;

    // Show those NOT yet registered that match the search
    let filtered = participants.filter(p => !p.checkedIn);
    filtered = filtered.filter(p => {
      if (/^\d+$/.test(query)) return p.dorsal.toString() === query;
      return (p.nombre || '').toLowerCase().includes(query) || (p.apellidos || '').toLowerCase().includes(query);
    });

    if (filtered.length === 0) {
      regSearchResults.innerHTML = '<p style="color:#64748b;padding:0.5rem;">No se encontraron pendientes</p>';
      return;
    }

    regSearchResults.innerHTML = filtered.slice(0, 10).map(p => {
      const bgColor = getColorForParticipant(p);
      const cardStyle = bgColor ? `border-left: 5px solid ${bgColor}; background: ${bgColor}25;` : '';
      return `
        <div class="send-card" style="${cardStyle}">
          <div class="send-info" onclick="showCheckinModal(${p.uid})" style="cursor:pointer;">
            <span class="dorsal" style="font-size:1.6rem;">#${p.dorsal}</span>
            <div class="nombre">${getDisplayName(p)}</div>
            <div class="contacto">
              <span>🏅 ${p.competencia || ''}</span>
              <span>🏷️ ${p.categoria || ''}</span>
              ${p.talla ? `<span>👕 ${p.talla}</span>` : ''}
              ${p.licencia ? `<span style="background:#e2e8f0;font-weight:700;font-size:0.95rem;">📜 ${p.licencia}</span>` : ''}
              ${p.equipo ? `<span style="background:#C5D9F1;color:#1e293b;font-weight:700;padding:0.15rem 0.4rem;border-radius:4px;">🏆 ${p.equipo}</span>` : ''}
              ${p.socio && p.socio.toLowerCase() === 'si' ? `<span style="background:#FFBA31;color:#1e3a5f;font-weight:700;padding:0.15rem 0.4rem;border-radius:4px;">✓ SOCIO</span>` : `<span>Socio: NO</span>`}
            </div>
          </div>
          <button class="btn btn-success" onclick="event.stopPropagation(); marcarRegistro(${p.uid})" style="white-space:nowrap;">
            ✅ Registrar
          </button>
        </div>
      `;
    }).join('');
  } catch (err) {
    regSearchResults.innerHTML = '';
  }
}

async function marcarRegistro(uid) {
  try {
    const res = await fetch(`/api/checkin/${uid}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage: 'registro' })
    });
    const data = await res.json();

    if (res.ok) {
      regSearchInput.value = '';
      regSearchResults.innerHTML = '';
    } else {
      alert(data.message || data.error);
    }
  } catch (err) {
    alert('Error al marcar registro');
  }
}



// ============ KIDS REGISTRATION ============
const KIDS_CATEGORIES = [
  { name: '2-3 años', minAge: 2, maxAge: 3, capacity: 6 },
  { name: '4-5 años', minAge: 4, maxAge: 5, capacity: 18 },
  { name: '6-7 años', minAge: 6, maxAge: 7, capacity: 20 },
  { name: '8-9 años', minAge: 8, maxAge: 9, capacity: 12 },
  { name: '10-11 años', minAge: 10, maxAge: 11, capacity: 9 },
  { name: '12-13 años', minAge: 12, maxAge: 13, capacity: 9 }
];

const kidsFechaInput = document.getElementById('kids-fecha');
const kidsCategoriaDisplay = document.getElementById('kids-categoria-display');

if (kidsFechaInput) {
  kidsFechaInput.addEventListener('change', () => {
    const cat = calculateKidsCategory(kidsFechaInput.value);
    if (cat) {
      kidsCategoriaDisplay.textContent = `🏷️ Categoría: ${cat.name}`;
      kidsCategoriaDisplay.style.color = '#16a34a';
    } else if (kidsFechaInput.value) {
      kidsCategoriaDisplay.textContent = '❌ Edad no califica (debe ser entre 2 y 11 años al 31/dic/2026)';
      kidsCategoriaDisplay.style.color = '#dc2626';
    } else {
      kidsCategoriaDisplay.textContent = '';
    }
  });
}

function calculateKidsCategory(dateStr) {
  if (!dateStr) return null;
  const birthDate = new Date(dateStr);
  // Age at December 31, 2026
  const refDate = new Date(2026, 11, 31);
  let age = refDate.getFullYear() - birthDate.getFullYear();
  const monthDiff = refDate.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && refDate.getDate() < birthDate.getDate())) {
    age--;
  }
  return KIDS_CATEGORIES.find(c => age >= c.minAge && age <= c.maxAge) || null;
}

const btnKidsRegister = document.getElementById('btn-kids-register');
const btnKidsExport = document.getElementById('btn-kids-export');

if (btnKidsRegister) btnKidsRegister.addEventListener('click', registerKid);
if (btnKidsExport) btnKidsExport.addEventListener('click', exportKids);

const btnKidsClear = document.getElementById('btn-kids-clear');
if (btnKidsClear) btnKidsClear.addEventListener('click', async () => {
  if (!confirm('⚠️ ¿Borrar TODOS los registros de Kids? Esta acción no se puede deshacer.')) return;
  try {
    const res = await fetch('/api/kids/clear', { method: 'POST' });
    if (res.ok) {
      alert('✅ Todos los registros de Kids eliminados');
      loadKidsView();
    }
  } catch (err) {
    alert('Error al borrar');
  }
});

async function loadKidsView() {
  await loadKidsCapacity();
  await loadKidsList();
}

async function loadKidsCapacity() {
  const grid = document.getElementById('kids-capacity-grid');
  if (!grid) return;

  try {
    const res = await fetch('/api/kids');
    const kids = await res.json();
    if (!Array.isArray(kids)) { grid.innerHTML = ''; return; }

    grid.innerHTML = KIDS_CATEGORIES.map(cat => {
      const count = kids.filter(k => k.categoria === cat.name).length;
      const full = count >= cat.capacity;
      const pct = Math.round((count / cat.capacity) * 100);
      return `
        <div style="background:${full ? '#fef2f2' : '#f0fdf4'};border:1px solid ${full ? '#fecaca' : '#bbf7d0'};border-radius:8px;padding:0.6rem;text-align:center;">
          <div style="font-weight:700;font-size:0.9rem;">${cat.name}</div>
          <div style="font-size:1.2rem;font-weight:800;color:${full ? '#dc2626' : '#16a34a'};">${count}/${cat.capacity}</div>
          <div class="progress-bar" style="height:8px;margin-top:0.3rem;"><div class="progress-fill" style="width:${pct}%;${full ? 'background:#dc2626;' : ''}"></div></div>
          ${full ? '<div style="font-size:0.7rem;color:#dc2626;font-weight:600;">COMPLETO</div>' : ''}
        </div>
      `;
    }).join('');
  } catch (err) {
    grid.innerHTML = '';
  }
}

async function registerKid() {
  const dorsal = document.getElementById('kids-dorsal').value.trim();
  const nombre = document.getElementById('kids-nombre').value.trim();
  const fecha = document.getElementById('kids-fecha').value;
  const responsable = document.getElementById('kids-responsable').value.trim();
  const msgEl = document.getElementById('kids-message');

  if (!dorsal || !nombre || !fecha || !responsable) {
    msgEl.innerHTML = '<p style="color:#dc2626;">❌ Todos los campos son obligatorios</p>';
    return;
  }

  const cat = calculateKidsCategory(fecha);
  if (!cat) {
    msgEl.innerHTML = '<p style="color:#dc2626;">❌ La edad no califica (2-11 años al 31/dic/2026)</p>';
    return;
  }

  try {
    const res = await fetch('/api/kids', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dorsal, nombre, apellidos: '', fechaNacimiento: fecha, categoria: cat.name, responsable })
    });
    const data = await res.json();

    if (res.ok) {
      msgEl.innerHTML = `<p style="color:#16a34a;">✅ ${nombre} inscrito en ${cat.name}</p>`;
      document.getElementById('kids-dorsal').value = '';
      document.getElementById('kids-nombre').value = '';
      document.getElementById('kids-fecha').value = '';
      document.getElementById('kids-responsable').value = '';
      kidsCategoriaDisplay.textContent = '';
      loadKidsView();
    } else {
      msgEl.innerHTML = `<p style="color:#dc2626;">❌ ${data.error}</p>`;
    }
  } catch (err) {
    msgEl.innerHTML = '<p style="color:#dc2626;">❌ Error de conexión</p>';
  }
}

async function loadKidsList() {
  const listEl = document.getElementById('kids-list');
  if (!listEl) return;

  try {
    const res = await fetch('/api/kids');
    const kids = await res.json();
    if (!Array.isArray(kids) || kids.length === 0) {
      listEl.innerHTML = '<p style="color:#64748b;text-align:center;padding:1rem;">No hay inscritos aún</p>';
      return;
    }

    listEl.innerHTML = kids.map((k, i) => `
      <div class="send-card" style="border-left:4px solid var(--primary);">
        <div class="send-info">
          <span class="dorsal">#${k.dorsal}</span>
          <div class="nombre">${k.nombre}${k.apellidos ? ' ' + k.apellidos : ''}</div>
          <div class="contacto">
            <span>🏷️ ${k.categoria}</span>
            <span>🎂 ${k.fechaNacimiento}</span>
            <span>👤 ${k.responsable}</span>
          </div>
        </div>
        <div style="display:flex;gap:0.3rem;">
          <button class="btn btn-primary" onclick="editKid(${i})" style="padding:0.3rem 0.5rem;font-size:0.75rem;">✏️</button>
          <button class="btn btn-danger" onclick="deleteKid(${i})" style="padding:0.3rem 0.5rem;font-size:0.75rem;">🗑️</button>
        </div>
      </div>
    `).join('');
  } catch (err) {
    listEl.innerHTML = '';
  }
}

async function deleteKid(index) {
  if (!confirm('¿Eliminar este registro?')) return;
  try {
    const res = await fetch(`/api/kids/${index}`, { method: 'DELETE' });
    if (res.ok) {
      loadKidsView();
    } else {
      const data = await res.json();
      alert(data.error || 'Error al eliminar');
    }
  } catch (err) {
    alert('Error de conexión');
  }
}

async function editKid(index) {
  try {
    const res = await fetch('/api/kids');
    const kids = await res.json();
    if (!Array.isArray(kids) || !kids[index]) return;

    const k = kids[index];
    const newNombre = prompt('Nombre completo:', k.nombre + (k.apellidos ? ' ' + k.apellidos : ''));
    if (newNombre === null) return;

    const newDorsal = prompt('Dorsal:', k.dorsal);
    if (newDorsal === null) return;

    const newResponsable = prompt('Responsable:', k.responsable);
    if (newResponsable === null) return;

    const updateRes = await fetch(`/api/kids/${index}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre: newNombre, dorsal: newDorsal, responsable: newResponsable })
    });

    if (updateRes.ok) {
      loadKidsView();
    } else {
      const data = await updateRes.json();
      alert(data.error || 'Error al actualizar');
    }
  } catch (err) {
    alert('Error de conexión');
  }
}

async function exportKids() {
  try {
    const res = await fetch('/api/kids');
    const kids = await res.json();
    if (!Array.isArray(kids) || kids.length === 0) {
      alert('No hay inscritos para exportar');
      return;
    }

    // Generate CSV
    const header = 'DORSAL;NOMBRE;APELLIDOS;FECHA_NACIMIENTO;CATEGORIA;RESPONSABLE';
    const rows = kids.map(k => `${k.dorsal};${k.nombre};${k.apellidos};${k.fechaNacimiento};${k.categoria};${k.responsable}`);
    const csv = [header, ...rows].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'kids_inscritos.csv';
    link.click();
  } catch (err) {
    alert('Error al exportar');
  }
}



// Revert check-in from completados
async function revertirCheckin(uid) {
  if (!confirm('¿Revertir el check-in de esta persona?')) return;
  try {
    const res = await fetch(`/api/undo-checkin/${uid}`, { method: 'POST' });
    const data = await res.json();
    if (res.ok) {
      loadCompletadosList();
    } else {
      alert(data.error || 'Error al revertir');
    }
  } catch (err) {
    alert('Error de conexión');
  }
}



// Export completados
const btnExportCompletados = document.getElementById('btn-export-completados');
if (btnExportCompletados) {
  btnExportCompletados.addEventListener('click', async () => {
    try {
      const res = await fetch('/api/completados');
      const participants = await res.json();
      if (!Array.isArray(participants) || participants.length === 0) {
        alert('No hay datos para exportar');
        return;
      }

      const header = 'DORSAL;NOMBRE;APELLIDOS;COMPETENCIA;CATEGORIA;TALLA;HORA_REGISTRO';
      const rows = participants.map(p => 
        `${p.dorsal};${p.nombre || ''};${p.apellidos || ''};${p.competencia || ''};${p.categoria || ''};${p.talla || ''};${p.checkInTime ? new Date(p.checkInTime).toLocaleString('es-CR') : ''}`
      );
      const csv = [header, ...rows].join('\n');

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = 'completados.csv';
      link.click();
    } catch (err) {
      alert('Error al exportar');
    }
  });
}
