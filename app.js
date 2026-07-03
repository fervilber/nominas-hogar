(() => {
  'use strict';

  const MONTHS = [
    { name: 'Enero', days: 31 },
    { name: 'Febrero', days: null },
    { name: 'Marzo', days: 31 },
    { name: 'Abril', days: 30 },
    { name: 'Mayo', days: 31 },
    { name: 'Junio', days: 30 },
    { name: 'Julio', days: 31 },
    { name: 'Agosto', days: 31 },
    { name: 'Septiembre', days: 30 },
    { name: 'Octubre', days: 31 },
    { name: 'Noviembre', days: 30 },
    { name: 'Diciembre', days: 31 }
  ];

  const STORAGE_KEYS = {
    defaults: 'nominas_hogar_defaults_v1',
    history: 'nominas_hogar_history_v1'
  };

  const ids = [
    'emp_nombre','emp_dni','emp_ccc','emp_domicilio','trab_nombre','trab_dni','trab_nss','trab_iban',
    'nom_ano','nom_mes','dias_trabajados','dias_mes','salario_base','pagas_extra','otros_devengos','irpf_pct',
    'tipo_cc','tipo_desempleo','tipo_formacion','tipo_mei'
  ];

  const money = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' });
  const number = new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  function $(id) { return document.getElementById(id); }
  function value(id) { return ($(id)?.value || '').trim(); }
  function numeric(id) { return parseFloat(String(value(id)).replace(',', '.')) || 0; }
  function setText(id, text) { const el = $(id); if (el) el.textContent = text; }
  function setValue(id, val) { const el = $(id); if (el) el.value = val; }

  function isLeapYear(year) {
    year = Number(year);
    return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  }

  function daysInMonth(year, monthIndex) {
    if (monthIndex === 1) return isLeapYear(year) ? 29 : 28;
    return MONTHS[monthIndex]?.days || 30;
  }

  function round2(num) {
    return Math.round((Number(num) + Number.EPSILON) * 100) / 100;
  }

  function prorate(amount, workedDays, monthDays) {
    if (monthDays <= 0) return 0;
    return round2(Number(amount) * Number(workedDays) / Number(monthDays));
  }

  function currentMonthIndex() {
    return Number(value('nom_mes')) || 0;
  }

  function syncDays() {
    const year = Number(value('nom_ano')) || new Date().getFullYear();
    const idx = currentMonthIndex();
    const days = daysInMonth(year, idx);
    const rawWorked = value('dias_trabajados');
    const worked = Number(rawWorked);
    setValue('dias_mes', days);
    if (rawWorked === '' || worked > days) setValue('dias_trabajados', days);
    if (worked < 0) setValue('dias_trabajados', 0);
    setText('resumen-periodo', `${MONTHS[idx].name} ${year} · ${days} dias`);
  }

  function buildOptions() {
    const select = $('nom_mes');
    select.innerHTML = '';
    MONTHS.forEach((m, idx) => {
      const opt = document.createElement('option');
      opt.value = String(idx);
      opt.textContent = m.name;
      select.appendChild(opt);
    });
    select.value = String(new Date().getMonth());
  }

  function collectForm() {
    syncDays();
    const year = Number(value('nom_ano')) || new Date().getFullYear();
    const monthIndex = currentMonthIndex();
    const monthDays = daysInMonth(year, monthIndex);
    const workedRaw = value('dias_trabajados');
    const workedDays = Math.min(Math.max(workedRaw === '' ? monthDays : Number(workedRaw), 0), monthDays);
    return {
      emp_nombre: value('emp_nombre'), emp_dni: value('emp_dni'), emp_ccc: value('emp_ccc'), emp_domicilio: value('emp_domicilio'),
      trab_nombre: value('trab_nombre'), trab_dni: value('trab_dni'), trab_nss: value('trab_nss'), trab_iban: value('trab_iban'),
      year, monthIndex, monthName: MONTHS[monthIndex].name, monthDays, workedDays,
      salario_base: numeric('salario_base'), pagas_extra: numeric('pagas_extra'), otros_devengos: numeric('otros_devengos'), irpf_pct: numeric('irpf_pct'),
      tipo_cc: numeric('tipo_cc'), tipo_desempleo: numeric('tipo_desempleo'), tipo_formacion: numeric('tipo_formacion'), tipo_mei: numeric('tipo_mei')
    };
  }

  function calculatePayroll(data) {
    const salarioBase = prorate(data.salario_base, data.workedDays, data.monthDays);
    const pagasExtra = prorate(data.pagas_extra, data.workedDays, data.monthDays);
    const otros = round2(data.otros_devengos);
    const totalDevengado = round2(salarioBase + pagasExtra + otros);
    const deductions = [
      { label: 'Contingencias comunes', pct: data.tipo_cc, amount: round2(totalDevengado * data.tipo_cc / 100) },
      { label: 'Desempleo', pct: data.tipo_desempleo, amount: round2(totalDevengado * data.tipo_desempleo / 100) },
      { label: 'Formacion profesional', pct: data.tipo_formacion, amount: round2(totalDevengado * data.tipo_formacion / 100) },
      { label: 'Mecanismo Equidad Intergeneracional (MEI)', pct: data.tipo_mei, amount: round2(totalDevengado * data.tipo_mei / 100) }
    ];
    if (data.irpf_pct > 0) deductions.push({ label: 'IRPF', pct: data.irpf_pct, amount: round2(totalDevengado * data.irpf_pct / 100) });
    const totalDeductions = round2(deductions.reduce((sum, d) => sum + d.amount, 0));
    return {
      devengos: [
        { label: 'Salario base', detail: `${data.workedDays} de ${data.monthDays} dias`, amount: salarioBase },
        { label: 'Prorrateo pagas extraordinarias', detail: `${data.workedDays} de ${data.monthDays} dias`, amount: pagasExtra },
        { label: 'Otros devengos', detail: 'Importe manual', amount: otros }
      ],
      deductions,
      totalDevengado,
      totalDeductions,
      neto: round2(totalDevengado - totalDeductions)
    };
  }

  function renderRows(tbodyId, rows, totalLabel, totalAmount) {
    const tbody = $(tbodyId);
    tbody.innerHTML = '';
    rows.filter(row => row.amount !== 0 || row.label !== 'Otros devengos').forEach(row => {
      const tr = document.createElement('tr');
      const pctOrDetail = row.pct !== undefined ? `${number.format(row.pct)} %` : row.detail;
      tr.innerHTML = `<td>${row.label}</td><td class="right">${pctOrDetail}</td><td class="right">${money.format(row.amount)}</td>`;
      tbody.appendChild(tr);
    });
    const total = document.createElement('tr');
    total.className = 'total-row';
    total.innerHTML = `<td>${totalLabel}</td><td></td><td class="right">${money.format(totalAmount)}</td>`;
    tbody.appendChild(total);
  }

  function saveDefaults(data) {
    const defaults = { ...data };
    localStorage.setItem(STORAGE_KEYS.defaults, JSON.stringify(defaults));
  }

  function getHistory() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEYS.history)) || []; }
    catch { return []; }
  }

  function saveHistory(data, payroll) {
    const id = `${data.trab_nombre || 'trabajadora'}-${data.year}-${String(data.monthIndex + 1).padStart(2, '0')}`.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9-]+/g, '-');
    const entry = { id, createdAt: new Date().toISOString(), data, payroll };
    const next = getHistory().filter(item => item.id !== id);
    next.unshift(entry);
    localStorage.setItem(STORAGE_KEYS.history, JSON.stringify(next.slice(0, 80)));
    renderHistory();
  }

  function renderPayroll(data, payroll) {
    setText('lbl_emp_nombre', data.emp_nombre || '-');
    setText('lbl_emp_dni', data.emp_dni || '-');
    setText('lbl_emp_ccc', data.emp_ccc || 'No especificado');
    setText('lbl_emp_domicilio', data.emp_domicilio || 'No especificado');
    setText('lbl_trab_nombre', data.trab_nombre || '-');
    setText('lbl_trab_dni', data.trab_dni || '-');
    setText('lbl_trab_nss', data.trab_nss || '-');
    setText('lbl_trab_iban', data.trab_iban || 'No especificada');
    setText('lbl_periodo', `1 al ${data.monthDays} de ${data.monthName} de ${data.year}`);
    setText('lbl_dias_mes', data.monthDays);
    setText('lbl_dias_trabajados', data.workedDays);
    renderRows('tabla_devengos', payroll.devengos, 'Total devengado', payroll.totalDevengado);
    renderRows('tabla_deducciones', payroll.deductions, 'Total deducciones', payroll.totalDeductions);
    setText('lbl_total_devengado', money.format(payroll.totalDevengado));
    setText('lbl_total_deducciones', money.format(payroll.totalDeductions));
    setText('lbl_neto', money.format(payroll.neto));
    setText('lbl_base_cotizacion', money.format(payroll.totalDevengado));
    $('nomina-print').classList.add('visible');
    $('btn-imprimir').disabled = false;
  }

  function generateAndSave() {
    const data = collectForm();
    if (!data.emp_nombre || !data.trab_nombre) {
      alert('Rellena al menos el nombre del empleador/a y de la trabajadora.');
      return;
    }
    const payroll = calculatePayroll(data);
    saveDefaults(data);
    saveHistory(data, payroll);
    renderPayroll(data, payroll);
    $('nomina-print').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function loadDefaults() {
    try {
      const defaults = JSON.parse(localStorage.getItem(STORAGE_KEYS.defaults));
      if (!defaults) return;
      Object.entries(defaults).forEach(([key, val]) => {
        if ($(key) && key !== 'monthName' && key !== 'monthDays' && key !== 'workedDays') setValue(key, val);
      });
      if (defaults.monthIndex !== undefined) setValue('nom_mes', defaults.monthIndex);
      if (defaults.workedDays !== undefined) setValue('dias_trabajados', defaults.workedDays);
    } catch {}
  }

  function loadEntry(id) {
    const entry = getHistory().find(item => item.id === id);
    if (!entry) return;
    const data = entry.data;
    Object.entries(data).forEach(([key, val]) => { if ($(key)) setValue(key, val); });
    setValue('nom_ano', data.year);
    setValue('nom_mes', data.monthIndex);
    setValue('dias_trabajados', data.workedDays);
    syncDays();
    renderPayroll(data, calculatePayroll(data));
  }

  function deleteEntry(id) {
    if (!confirm('¿Borrar esta nomina del historial local?')) return;
    localStorage.setItem(STORAGE_KEYS.history, JSON.stringify(getHistory().filter(item => item.id !== id)));
    renderHistory();
  }

  function renderHistory() {
    const list = $('lista-historico');
    const history = getHistory();
    list.innerHTML = '';
    if (!history.length) {
      list.innerHTML = '<li>No hay nominas guardadas todavia.</li>';
      return;
    }
    history.forEach(item => {
      const li = document.createElement('li');
      li.innerHTML = `<div><strong>${item.data.monthName} ${item.data.year}</strong> - ${item.data.trab_nombre}<small>Neto: ${money.format(item.payroll.neto)} · Dias: ${item.data.workedDays}/${item.data.monthDays}</small></div><div class="mini-actions"><button type="button" data-load="${item.id}">Ver</button><button type="button" class="ghost danger" data-delete="${item.id}">Eliminar</button></div>`;
      list.appendChild(li);
    });
  }

  function clearForm() {
    if (!confirm('¿Limpiar los datos visibles del formulario? No borra el historial.')) return;
    ids.forEach(id => { if ($(id) && !['nom_ano','nom_mes','dias_mes'].includes(id)) setValue(id, ''); });
    setValue('nom_ano', new Date().getFullYear());
    setValue('nom_mes', new Date().getMonth());
    setValue('salario_base', '1221.00');
    setValue('pagas_extra', '203.50');
    setValue('otros_devengos', '0');
    setValue('irpf_pct', '0');
    setValue('tipo_cc', '4.70');
    setValue('tipo_desempleo', '1.60');
    setValue('tipo_formacion', '0.10');
    setValue('tipo_mei', '0.20');
    syncDays();
  }

  function bindEvents() {
    ['nom_ano','nom_mes'].forEach(id => $(id).addEventListener('change', syncDays));
    $('dias_trabajados').addEventListener('input', syncDays);
    $('btn-generar').addEventListener('click', generateAndSave);
    $('btn-imprimir').addEventListener('click', () => window.print());
    $('btn-limpiar-form').addEventListener('click', clearForm);
    $('btn-borrar-historico').addEventListener('click', () => {
      if (confirm('¿Borrar todo el historial local de nominas?')) {
        localStorage.removeItem(STORAGE_KEYS.history);
        renderHistory();
      }
    });
    $('lista-historico').addEventListener('click', event => {
      const loadId = event.target.dataset.load;
      const deleteId = event.target.dataset.delete;
      if (loadId) loadEntry(loadId);
      if (deleteId) deleteEntry(deleteId);
    });
  }

  function init() {
    buildOptions();
    setValue('nom_ano', new Date().getFullYear());
    loadDefaults();
    syncDays();
    bindEvents();
    renderHistory();
  }

  if (typeof window !== 'undefined') {
    window.NominasHogar = { isLeapYear, daysInMonth, round2, prorate, calculatePayroll, MONTHS };
    window.addEventListener('DOMContentLoaded', init);
  }
})();
