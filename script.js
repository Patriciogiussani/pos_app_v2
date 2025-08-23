// ====== Persistencia ======
const STORAGE_KEY = 'posDataV3';

const state = {
  productos: [],
  clientes: [],
  ventas: [],
  settings: { storeName: 'Mi Almacén', cajeros: ['Caja 1'] },
  cart: []
};

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try {
      const data = JSON.parse(raw);
      Object.assign(state, data);
    } catch (e) { console.error('Error al parsear almacenamiento', e); }
  }
  // Asegurar cliente "Mostrador"
  if (!state.clientes.length || !state.clientes.find(c => c.nombre === 'Mostrador')) {
    if (!state.clientes.find(c => c.id === 'mostrador')) {
      state.clientes.unshift({ id: 'mostrador', nombre: 'Mostrador', telefono: '' });
    }
  }
}
function saveState() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }

// ====== Utilidades ======
const $ = sel => document.querySelector(sel);
const $$ = sel => document.querySelectorAll(sel);
function formatCurrency(n) { return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(n || 0); }
function uid(prefix='id') { return `${prefix}_${Math.random().toString(36).slice(2,9)}`; }
function todayISO(d=new Date()) { const pad = v => String(v).padStart(2,'0'); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; }
function startOfDay(d){ const x=new Date(d); x.setHours(0,0,0,0); return x; }
function startOfMonth(d){ const x=new Date(d); x.setDate(1); x.setHours(0,0,0,0); return x; }

// ====== Navegación ======
function showScreen(id) {
  $$('.screen').forEach(s => s.classList.remove('active'));
  $('#' + id).classList.add('active');
  if (id === 'dashboard') renderDashboard();
}
function bindNav() {
  $$('.nav-btn').forEach(btn => btn.addEventListener('click', () => showScreen(btn.dataset.target)));
}

// ====== Productos ======
let filtroProductos = '';
let sortProductos = { key: 'descripcion', dir: 'asc' };

function renderProductos() {
  const tbody = $('#tablaProductos tbody');
  tbody.innerHTML = '';

  let list = [...state.productos];
  // filtro
  if (filtroProductos) {
    const t = filtroProductos.toLowerCase();
    list = list.filter(p =>
      (p.descripcion && p.descripcion.toLowerCase().includes(t)) ||
      (p.codigo && p.codigo.toLowerCase().includes(t))
    );
  }
  // sort
  list.sort((a,b)=>{
    const {key, dir} = sortProductos;
    const va = (a[key] ?? '').toString().toLowerCase();
    const vb = (b[key] ?? '').toString().toLowerCase();
    const na = Number(a[key]); const nb = Number(b[key]);
    const val = (isFinite(na) && isFinite(nb)) ? (na - nb) : (va > vb ? 1 : va < vb ? -1 : 0);
    return dir === 'asc' ? val : -val;
  });

  list.forEach(p => {
    const tr = document.createElement('tr');
    const level = p.stock <= p.stockMin ? 'danger' : (p.stock - p.stockMin <= 2 ? 'warn' : 'ok');
    const thumb = p.imagen ? `<img class="thumb" src="${p.imagen}" alt="">` : `<span class="thumb placeholder">📦</span>`;
    tr.innerHTML = `
      <td>${thumb}</td>
      <td>${p.codigo || '-'}</td>
      <td>${p.descripcion}</td>
      <td class="num">${formatCurrency(p.precioCompra)}</td>
      <td class="num">${formatCurrency(p.precioVenta)}</td>
      <td><span class="badge ${level}">${p.stock}</span></td>
      <td class="num">${p.stockMin ?? 0}</td>
      <td>
        <button data-edit="${p.id}">✏️</button>
        <button data-del="${p.id}">🗑️</button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  // acciones
  tbody.querySelectorAll('button[data-edit]').forEach(b => b.addEventListener('click', () => openProductoModal(b.dataset.edit)));
  tbody.querySelectorAll('button[data-del]').forEach(b => b.addEventListener('click', () => deleteProducto(b.dataset.del)));
}

function openProductoModal(id=null) {
  const dlg = $('#modalProducto');
  const isEdit = Boolean(id);
  const p = isEdit ? state.productos.find(p=>p.id===id) : {};
  $('#pId').value = id || '';
  $('#pCodigo').value = isEdit ? (p?.codigo || '') : '';
  $('#pDescripcion').value = isEdit ? p?.descripcion || '' : '';
  $('#pPrecioCompra').value = isEdit ? p?.precioCompra || '' : '';
  $('#pPrecioVenta').value = isEdit ? p?.precioVenta || '' : '';
  $('#pStock').value = isEdit ? p?.stock || '' : '';
  $('#pStockMin').value = isEdit ? (p?.stockMin ?? 0) : 0;
  $('#pImagen').value = isEdit ? (p?.imagen || '') : '';
  dlg.showModal();
}

function deleteProducto(id) {
  if (!confirm('¿Eliminar producto?')) return;
  const index = state.productos.findIndex(p=>p.id===id);
  if (index >= 0) { state.productos.splice(index,1); saveState(); renderProductos(); renderDashboard(); }
}

function bindProductos() {
  $('#btnNuevoProducto').addEventListener('click', ()=> openProductoModal());
  $('#buscarProductos').addEventListener('input', (e)=> { filtroProductos = e.target.value; renderProductos(); });

  // sort headers
  $('#tablaProductos thead').addEventListener('click', (e)=>{
    const th = e.target.closest('[data-key]');
    if (!th) return;
    const key = th.dataset.key;
    if (sortProductos.key === key) { sortProductos.dir = sortProductos.dir === 'asc' ? 'desc' : 'asc'; }
    else { sortProductos.key = key; sortProductos.dir = 'asc'; }
    $('#tablaProductos').dataset.sortKey = sortProductos.key;
    $('#tablaProductos').dataset.sortDir = sortProductos.dir;
    renderProductos();
  });

  $('#formProducto').addEventListener('submit', (e)=>{
    e.preventDefault();
    const id = $('#pId').value || uid('prod');
    const producto = {
      id,
      codigo: $('#pCodigo').value.trim(),
      descripcion: $('#pDescripcion').value.trim(),
      precioCompra: parseFloat($('#pPrecioCompra').value)||0,
      precioVenta: parseFloat($('#pPrecioVenta').value)||0,
      stock: parseInt($('#pStock').value)||0,
      stockMin: parseInt($('#pStockMin').value)||0,
      imagen: $('#pImagen').value.trim()
    };
    const idx = state.productos.findIndex(p=>p.id===id);
    if (idx>=0) state.productos[idx]=producto; else state.productos.push(producto);
    saveState(); renderProductos(); renderDashboard();
    $('#modalProducto').close();
  });
}

// ====== Clientes ======
let filtroClientes = '';
let sortClientes = { key: 'nombre', dir: 'asc' };

function renderClientes() {
  const tbody = $('#tablaClientes tbody');
  tbody.innerHTML = '';

  let list = [...state.clientes];
  if (filtroClientes) {
    const t = filtroClientes.toLowerCase();
    list = list.filter(c => c.nombre.toLowerCase().includes(t) || (c.telefono||'').toLowerCase().includes(t));
  }
  list.sort((a,b)=>{
    const {key, dir} = sortClientes;
    const va = (a[key] ?? '').toString().toLowerCase();
    const vb = (b[key] ?? '').toString().toLowerCase();
    const val = va > vb ? 1 : va < vb ? -1 : 0;
    return dir === 'asc' ? val : -val;
  });

  list.forEach(c => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${c.nombre}</td>
      <td>${c.telefono || '-'}</td>
      <td><button data-hist="${c.id}">📜 Historial</button></td>
      <td>${c.id==='mostrador' ? '' : '<button data-edit="'+c.id+'">✏️</button> <button data-del="'+c.id+'">🗑️</button>'}</td>
    `;
    tbody.appendChild(tr);
  });
  tbody.querySelectorAll('button[data-edit]').forEach(b => b.addEventListener('click', () => openClienteModal(b.dataset.edit)));
  tbody.querySelectorAll('button[data-del]').forEach(b => b.addEventListener('click', () => deleteCliente(b.dataset.del)));
  tbody.querySelectorAll('button[data-hist]').forEach(b => b.addEventListener('click', () => openHistorialCliente(b.dataset.hist)));

  // select de ventas
  const sel = $('#clienteVenta');
  const rapidaSel = $('#rapidaCliente');
  sel.innerHTML = ''; rapidaSel.innerHTML='';
  state.clientes.forEach(c => {
    const op = document.createElement('option');
    op.value = c.id; op.textContent = c.nombre;
    sel.appendChild(op);
    rapidaSel.appendChild(op.cloneNode(true));
  });
}

function openClienteModal(id=null) {
  const dlg = $('#modalCliente');
  $('#cId').value = id || '';
  if (id) {
    const c = state.clientes.find(x=>x.id===id);
    $('#cNombre').value = c?.nombre || '';
    $('#cTelefono').value = c?.telefono || '';
  } else {
    $('#cNombre').value = '';
    $('#cTelefono').value = '';
  }
  dlg.showModal();
}

function deleteCliente(id) {
  if (!confirm('¿Eliminar cliente?')) return;
  const i = state.clientes.findIndex(c=>c.id===id);
  if (i>=0) { state.clientes.splice(i,1); saveState(); renderClientes(); }
}

function bindClientes() {
  $('#btnNuevoCliente').addEventListener('click', ()=> openClienteModal());
  $('#buscarClientes').addEventListener('input', (e)=> { filtroClientes = e.target.value; renderClientes(); });
  $('#tablaClientes thead').addEventListener('click', (e)=>{
    const th = e.target.closest('[data-key]');
    if (!th) return;
    const key = th.dataset.key;
    if (sortClientes.key === key) { sortClientes.dir = sortClientes.dir === 'asc' ? 'desc' : 'asc'; }
    else { sortClientes.key = key; sortClientes.dir = 'asc'; }
    renderClientes();
  });

  $('#formCliente').addEventListener('submit', (e)=>{
    e.preventDefault();
    const id = $('#cId').value || uid('cli');
    const cli = { id, nombre: $('#cNombre').value.trim(), telefono: $('#cTelefono').value.trim() };
    const i = state.clientes.findIndex(c=>c.id===id);
    if (i>=0) state.clientes[i]=cli; else state.clientes.push(cli);
    saveState(); renderClientes();
    $('#modalCliente').close();
  });
}

function openHistorialCliente(id) {
  const dlg = $('#modalHistorial');
  const tbody = $('#tablaHistorial tbody');
  tbody.innerHTML = '';
  const ventas = state.ventas.filter(v=> v.clienteId === id);
  ventas.forEach(v => {
    const tr = document.createElement('tr');
    const fecha = new Date(v.fecha).toLocaleString('es-AR');
    const detalle = v.items.map(it=> `${it.descripcion} x${it.cantidad}`).join('; ');
    tr.innerHTML = `<td>${fecha}</td><td>${detalle}</td><td>${formatCurrency(v.total)}</td>`;
    tbody.appendChild(tr);
  });
  $('#btnCerrarHistorial').onclick = ()=> dlg.close();
  dlg.showModal();
}

// ====== Ventas / Carrito ======
function renderCarrito() {
  const tbody = $('#tablaCarrito tbody');
  tbody.innerHTML = '';
  let total = 0;
  state.cart.forEach(item => {
    const subtotal = item.precio * item.cantidad;
    total += subtotal;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${item.descripcion}</td>
      <td>${formatCurrency(item.precio)}</td>
      <td>
        <input type="number" min="1" value="${item.cantidad}" data-q="${item.id}" />
      </td>
      <td>${formatCurrency(subtotal)}</td>
      <td><button data-rm="${item.id}">🗑️</button></td>
    `;
    tbody.appendChild(tr);
  });
  $('#totalVenta').textContent = formatCurrency(total);
  const entregado = parseFloat($('#montoEntregado').value)||0;
  const vuelto = Math.max(entregado - total, 0);
  $('#vuelto').textContent = formatCurrency(vuelto);

  // bind qty / remove
  tbody.querySelectorAll('input[type="number"][data-q]').forEach(inp=>{
    inp.addEventListener('change', ()=> {
      const id = inp.dataset.q;
      const it = state.cart.find(x=>x.id===id);
      const val = Math.max(parseInt(inp.value)||1, 1);
      it.cantidad = val;
      renderCarrito();
    });
  });
  tbody.querySelectorAll('button[data-rm]').forEach(btn=> btn.addEventListener('click', ()=>{
    const id = btn.dataset.rm;
    state.cart = state.cart.filter(x=>x.id!==id);
    renderCarrito();
  }));
}

function buscarProductos(term) {
  term = term.trim().toLowerCase();
  if (!term) return [];
  return state.productos.filter(p =>
    (p.descripcion && p.descripcion.toLowerCase().includes(term)) ||
    (p.codigo && p.codigo.toLowerCase().includes(term))
  ).slice(0, 20);
}

function bindVentas() {
  const buscador = $('#buscadorProducto');
  const sug = $('#sugerencias');
  const inpCant = $('#cantidadAgregar');

  function showSugs(list) {
    sug.innerHTML = '';
    if (!list.length) { sug.style.display='none'; return; }
    list.forEach(p=>{
      const b = document.createElement('button');
      b.textContent = `${p.descripcion} — ${formatCurrency(p.precioVenta)} (stock: ${p.stock})`;
      b.addEventListener('click', ()=> {
        buscador.value = p.descripcion;
        buscador.dataset.pid = p.id;
        sug.style.display='none';
      });
      sug.appendChild(b);
    });
    sug.style.display='block';
  }

  buscador.addEventListener('input', ()=> showSugs(buscarProductos(buscador.value)));
  buscador.addEventListener('focus', ()=> showSugs(buscarProductos(buscador.value)));
  document.addEventListener('click', (e)=> { if (!sug.contains(e.target) && e.target!==buscador) sug.style.display='none'; });

  $('#btnAgregarCarrito').addEventListener('click', ()=> {
    const pid = buscador.dataset.pid;
    const p = state.productos.find(x=>x.id===pid);
    const qty = Math.max(parseInt(inpCant.value)||1, 1);
    if (!p) { alert('Elegí un producto de la lista'); return; }
    if (p.stock < qty) { alert('No hay suficiente stock'); return; }
    const existing = state.cart.find(x=>x.productoId===pid);
    if (existing) existing.cantidad += qty;
    else state.cart.push({ id: uid('it'), productoId: pid, descripcion: p.descripcion, precio: p.precioVenta, cantidad: qty });
    buscador.value = ''; buscador.dataset.pid=''; inpCant.value = 1;
    renderCarrito();
  });

  $('#montoEntregado').addEventListener('input', renderCarrito);
  $('#btnConfirmarVenta').addEventListener('click', confirmarVenta);

  // cajeros en ventas
  $('#btnAddCajero').addEventListener('click', ()=> {
    const name = $('#nuevoCajero').value.trim();
    if (!name) return;
    if (!state.settings.cajeros.includes(name)) state.settings.cajeros.push(name);
    saveState(); fillCajeros();
    $('#nuevoCajero').value='';
  });
}

function confirmarVenta() {
  if (!state.cart.length) { alert('Carrito vacío'); return; }
  // verificar stock
  for (const it of state.cart) {
    const p = state.productos.find(x=>x.id===it.productoId);
    if (!p || p.stock < it.cantidad) { alert('Stock insuficiente para ' + (p?.descripcion || it.descripcion)); return; }
  }

  // quitar stock
  state.cart.forEach(it => {
    const p = state.productos.find(x=>x.id===it.productoId);
    p.stock -= it.cantidad;
  });

  // generar venta
  const total = state.cart.reduce((acc, it)=> acc + it.precio*it.cantidad, 0);
  const entregado = parseFloat($('#montoEntregado').value)||0;
  const vuelto = Math.max(entregado - total, 0);
  const clienteId = $('#clienteVenta').value;
  const cajero = $('#cajeroVenta').value || (state.settings.cajeros[0] || 'Caja 1');
  const venta = {
    id: uid('venta'),
    fecha: new Date().toISOString(),
    clienteId,
    cajero,
    items: state.cart.map(it => ({ productoId: it.productoId, descripcion: it.descripcion, precio: it.precio, cantidad: it.cantidad })),
    total, entregado, vuelto
  };
  state.ventas.unshift(venta);
  state.cart = [];
  saveState();
  renderProductos();
  renderCarrito();
  renderReportes();
  renderDashboard();
  $('#montoEntregado').value = '';
  // ticket
  openTicket(venta);
  showToast('✅ Venta registrada');
}

// ====== Toast ======
let toastTimer;
function showToast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=> t.classList.add('hidden'), 2200);
}

// ====== Ticket ======
function openTicket(venta) {
  const dlg = $('#modalTicket');
  const t = $('#ticket');
  const store = state.settings.storeName || 'Mi Almacén';
  const fecha = new Date(venta.fecha);
  const cliente = state.clientes.find(c=>c.id===venta.clienteId)?.nombre || 'Mostrador';
  const rows = venta.items.map(it => `
    <tr><td>${it.descripcion} x${it.cantidad}</td><td class="right">${formatCurrency(it.precio*it.cantidad)}</td></tr>
  `).join('');
  t.innerHTML = `
    <h4>${store}</h4>
    <small>${fecha.toLocaleString('es-AR')}</small>
    <div><strong>Cliente:</strong> ${cliente}</div>
    <div><strong>Cajero:</strong> ${venta.cajero || '-'}</div>
    <hr/>
    <table>
      <thead><tr><th>Detalle</th><th class="right">Importe</th></tr></thead>
      <tbody>${rows}</tbody>
      <tfoot>
        <tr><td><strong>Total</strong></td><td class="right"><strong>${formatCurrency(venta.total)}</strong></td></tr>
        <tr><td>Pago</td><td class="right">${formatCurrency(venta.entregado)}</td></tr>
        <tr><td>Vuelto</td><td class="right">${formatCurrency(venta.vuelto)}</td></tr>
      </tfoot>
    </table>
    <p style="text-align:center; margin-top:8px;">¡Gracias por su compra!</p>
  `;
  dlg.showModal();

  $('#btnImprimirTicket').onclick = () => {
    const w = window.open('', '_blank', 'width=360,height=600');
    w.document.write('<html><head><title>Ticket</title></head><body>'+t.outerHTML+'</body></html>');
    w.document.close();
    w.focus();
    w.print();
  };
  $('#btnCerrarTicket').onclick = () => dlg.close();
}

// ====== Reportes ======
function filtrarVentasPorFecha(desde, hasta) {
  const start = desde ? new Date(desde + 'T00:00:00') : null;
  const end = hasta ? new Date(hasta + 'T23:59:59') : null;
  return state.ventas.filter(v => {
    const d = new Date(v.fecha);
    if (start && d < start) return false;
    if (end && d > end) return false;
    return true;
  });
}
function renderReportes() {
  const tbody = $('#tablaReportes tbody');
  if (!tbody) return;
  tbody.innerHTML = '';
  const desde = $('#desdeFecha').value;
  const hasta = $('#hastaFecha').value;
  const lista = filtrarVentasPorFecha(desde, hasta);
  let total = 0;
  lista.forEach((v, i)=> {
    total += v.total;
    const tr = document.createElement('tr');
    const fecha = new Date(v.fecha).toLocaleString('es-AR');
    const cliente = state.clientes.find(c=>c.id===v.clienteId)?.nombre || 'Mostrador';
    tr.innerHTML = `
      <td>${i+1}</td>
      <td>${fecha}</td>
      <td>${cliente}</td>
      <td>${v.cajero || '-'}</td>
      <td>${formatCurrency(v.total)}</td>
      <td><button data-ticket="${v.id}">🖨️ Reimprimir</button></td>
    `;
    tbody.appendChild(tr);
  });
  $('#cantidadVentas').textContent = String(lista.length);
  $('#montoAcumulado').textContent = formatCurrency(total);

  tbody.querySelectorAll('button[data-ticket]').forEach(b => b.addEventListener('click', ()=> {
    const v = state.ventas.find(x=>x.id===b.dataset.ticket);
    openTicket(v);
  }));
}

function exportarVentasCSV() {
  let rows = [["Fecha","Cliente","Cajero","Detalle","Total"]];
  state.ventas.forEach(v => {
    const fecha = new Date(v.fecha).toLocaleString("es-AR");
    const cliente = state.clientes.find(c=>c.id===v.clienteId)?.nombre || "Mostrador";
    const detalle = v.items.map(it => `${it.descripcion} x${it.cantidad} (${formatCurrency(it.precio*it.cantidad)})`).join("; ");
    rows.push([fecha, cliente, v.cajero || '', detalle, v.total]);
  });
  const csv = rows.map(r=>r.join(",")).join("\n");
  const blob = new Blob([csv],{type:"text/csv;charset=utf-8;"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href=url; a.download="ventas_para_facturacion.csv"; a.click();
  URL.revokeObjectURL(url);
}

// Excel (XML Spreadsheet 2003 - compatible con Excel)
function exportarVentasXLS() {
  const header = ['Fecha','Cliente','Cajero','Detalle','Total'];
  const rows = state.ventas.map(v => {
    const fecha = new Date(v.fecha).toLocaleString('es-AR');
    const cliente = state.clientes.find(c=>c.id===v.clienteId)?.nombre || 'Mostrador';
    const detalle = v.items.map(it => `${it.descripcion} x${it.cantidad} (${it.precio*it.cantidad})`).join('; ');
    return [fecha, cliente, v.cajero || '', detalle, v.total];
  });
  const xml =
  `<?xml version="1.0"?>
  <Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
    xmlns:o="urn:schemas-microsoft-com:office:office"
    xmlns:x="urn:schemas-microsoft-com:office:excel"
    xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
    <Worksheet ss:Name="Ventas">
      <Table>
        ${[header, ...rows].map(r=> `<Row>${r.map(c=> `<Cell><Data ss:Type="${typeof c==='number'?'Number':'String'}">${String(c).replace(/&/g,'&amp;').replace(/</g,'&lt;')}</Data></Cell>`).join('')}</Row>`).join('')}
      </Table>
    </Worksheet>
  </Workbook>`;
  const blob = new Blob([xml], { type: 'application/vnd.ms-excel' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'ventas.xls'; a.click();
  setTimeout(()=> URL.revokeObjectURL(url), 500);
}

// PDF (vista imprimible)
function exportarVentasPDF() {
  const desde = $('#desdeFecha').value;
  const hasta = $('#hastaFecha').value;
  const lista = filtrarVentasPorFecha(desde, hasta);
  let html = `<h2>Reporte de Ventas</h2><p>Período: ${desde||'-'} a ${hasta||'-'}</p><table border="1" cellspacing="0" cellpadding="6"><tr><th>#</th><th>Fecha</th><th>Cliente</th><th>Cajero</th><th>Total</th></tr>`;
  let total = 0;
  lista.forEach((v,i)=>{
    total += v.total;
    html += `<tr><td>${i+1}</td><td>${new Date(v.fecha).toLocaleString('es-AR')}</td><td>${state.clientes.find(c=>c.id===v.clienteId)?.nombre || 'Mostrador'}</td><td>${v.cajero||''}</td><td>${formatCurrency(v.total)}</td></tr>`;
  });
  html += `<tr><td colspan="4"><strong>Total</strong></td><td><strong>${formatCurrency(total)}</strong></td></tr></table>`;
  const w = window.open('', '_blank');
  w.document.write(`<html><head><title>Reporte de Ventas</title></head><body>${html}</body></html>`);
  w.document.close(); w.focus(); w.print();
}

function bindReportes() {
  $('#btnFiltrarReportes').addEventListener('click', renderReportes);
  $('#btnExportarVentas').addEventListener('click', exportarVentasCSV);
  $('#btnExportarXLS').addEventListener('click', exportarVentasXLS);
  $('#btnExportarPDF').addEventListener('click', exportarVentasPDF);
  $('#desdeFecha').value = todayISO();
  $('#hastaFecha').value = todayISO();
  renderReportes();
}

// ====== Dashboard ======
function ventasDelDia(date = new Date()) {
  const start = startOfDay(date);
  const end = new Date(start); end.setHours(23,59,59,999);
  return state.ventas.filter(v => {
    const d = new Date(v.fecha);
    return d >= start && d <= end;
  });
}
function ventasDelMes(date = new Date()) {
  const start = startOfMonth(date);
  const end = new Date(start); end.setMonth(end.getMonth()+1); end.setMilliseconds(-1);
  return state.ventas.filter(v => {
    const d = new Date(v.fecha);
    return d >= start && d <= end;
  });
}
function productoTopDelMes() {
  const map = new Map();
  ventasDelMes().forEach(v => {
    v.items.forEach(it => {
      map.set(it.descripcion, (map.get(it.descripcion)||0) + it.cantidad);
    });
  });
  let top = null, max = 0;
  for (const [desc, q] of map.entries()) {
    if (q > max) { max = q; top = `${desc} (${q})`; }
  }
  return top || '—';
}
function renderDashboard() {
  // stats
  const hoy = ventasDelDia();
  const mes = ventasDelMes();
  const sum = arr => arr.reduce((a,v)=>a+v.total,0);
  $('#statHoy').textContent = formatCurrency(sum(hoy));
  $('#statMes').textContent = formatCurrency(sum(mes));
  $('#statTop').textContent = productoTopDelMes();
  $('#statTickets').textContent = String(mes.length);

  // stock crítico
  const crit = state.productos.filter(p => p.stock <= (p.stockMin||0));
  const tbody = $('#tablaCritico tbody');
  tbody.innerHTML = '';
  crit.forEach(p=>{
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${p.descripcion}</td><td>${p.stock}</td><td>${p.stockMin||0}</td>`;
    tbody.appendChild(tr);
  });
  $('#stockAlert').classList.toggle('hidden', crit.length === 0);

  // chart últimos 7 días
  draw7dChart();
}

function last7Days() {
  const days = [];
  const today = new Date();
  for (let i=6; i>=0; i--) {
    const d = new Date(today); d.setDate(today.getDate()-i); d.setHours(0,0,0,0);
    days.push(d);
  }
  return days;
}
function draw7dChart() {
  const canvas = $('#chart7d');
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0,0,canvas.width,canvas.height);
  const days = last7Days();
  const totals = days.map(d => ventasDelDia(d).reduce((a,v)=>a+v.total,0));
  const labels = days.map(d => d.toLocaleDateString('es-AR', { day:'2-digit', month:'2-digit' }));

  // margins
  const w = canvas.width, h = canvas.height, pad = 30;
  const chartW = w - pad*2, chartH = h - pad*2;
  const max = Math.max(...totals, 1);
  const barW = chartW / totals.length * 0.6;
  ctx.strokeStyle = 'rgba(255,255,255,.2)';
  ctx.beginPath(); ctx.moveTo(pad, pad); ctx.lineTo(pad, h-pad); ctx.lineTo(w-pad, h-pad); ctx.stroke();

 totals.forEach((val, i)=>{
  const x = pad + (i + 0.2) * (chartW / totals.length);
  const y = h - pad - (val / max) * chartH;
  const bh = (val / max) * chartH;
  ctx.fillStyle = '#3b82f6';
  ctx.fillRect(x, y, barW, bh);

  // número encima de la barra
  ctx.fillStyle = document.body.classList.contains('light') ? '#111827' : '#e2e8f0';
  ctx.font = '12px system-ui';
  ctx.textAlign = 'center';
  ctx.fillText(formatCurrency(val), x + barW/2, y - 6);

  // fecha debajo
  ctx.fillStyle = document.body.classList.contains('light') ? '#374151' : '#e2e8f0';
  ctx.fillText(labels[i], x + barW/2, h - pad + 14);
});
}

// ====== Config ======
function bindConfig() {
  $('#nombreComercio').value = state.settings.storeName || '';
  $('#storeNameHeading').textContent = state.settings.storeName || 'Mi Almacén';
  fillCajeros();
  updateCajerosList();

  $('#btnGuardarConfig').addEventListener('click', ()=> {
    state.settings.storeName = $('#nombreComercio').value.trim() || 'Mi Almacén';
    saveState();
    $('#storeNameHeading').textContent = state.settings.storeName;
    alert('Configuración guardada');
  });

  $('#btnExportar').addEventListener('click', ()=> {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'backup_pos.json'; a.click();
    setTimeout(()=> URL.revokeObjectURL(url), 500);
  });

  $('#fileImport').addEventListener('change', async (e)=> {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!confirm('Importar datos y reemplazar los actuales?')) return;
    const text = await file.text();
    try {
      const data = JSON.parse(text);
      if (!data || !Array.isArray(data.productos) || !Array.isArray(data.clientes) || !Array.isArray(data.ventas)) {
        alert('Archivo inválido');
        return;
      }
      Object.assign(state, data);
      if (!state.settings.cajeros) state.settings.cajeros = ['Caja 1'];
      saveState();
      hydrate();
      alert('Datos importados');
    } catch (err) {
      alert('Error al importar');
    }
  });

  $('#btnReset').addEventListener('click', ()=> {
    if (!confirm('¿Seguro que querés borrar todos los datos?')) return;
    localStorage.removeItem(STORAGE_KEY);
    location.reload();
  });

  // cajeros config
  $('#btnAddCajero2').addEventListener('click', ()=> {
    const name = $('#nuevoCajero2').value.trim();
    if (!name) return;
    if (!state.settings.cajeros.includes(name)) state.settings.cajeros.push(name);
    saveState(); fillCajeros(); updateCajerosList();
    $('#nuevoCajero2').value='';
  });
}

function fillCajeros() {
  const sel1 = $('#cajeroVenta');
  const sel2 = $('#rapidaCajero');
  if (!sel1 || !sel2) return;
  sel1.innerHTML = '';
  sel2.innerHTML = '';
  state.settings.cajeros.forEach(c => {
    const op1 = document.createElement('option'); op1.value = c; op1.textContent = c;
    const op2 = document.createElement('option'); op2.value = c; op2.textContent = c;
    sel1.appendChild(op1); sel2.appendChild(op2);
  });
}
function updateCajerosList() {
  const el = $('#listaCajeros');
  if (el) el.textContent = 'Cajeros: ' + (state.settings.cajeros.join(', ') || '—');
}

// ====== Venta rápida ======
function bindVentaRapida() {
  $('#btnVentaRapida').addEventListener('click', ()=> {
    const dlg = $('#modalRapida');
    $('#rapidaBuscar').value=''; $('#rapidaCant').value=1; $('#rapidaPid').value='';
    // llenar selects
    renderClientes(); fillCajeros();
    dlg.showModal();
  });

  const inp = $('#rapidaBuscar');
  const sugs = $('#rapidaSugs');
  function show(list) {
    sugs.innerHTML = '';
    if (!list.length) { sugs.style.display='none'; return; }
    list.forEach(p=>{
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = `${p.descripcion} — ${formatCurrency(p.precioVenta)} (stock: ${p.stock})`;
      b.addEventListener('click', ()=> { inp.value = p.descripcion; $('#rapidaPid').value = p.id; sugs.style.display='none'; });
      sugs.appendChild(b);
    });
    sugs.style.display='block';
  }
  inp.addEventListener('input', ()=> show(buscarProductos(inp.value)));
  inp.addEventListener('focus', ()=> show(buscarProductos(inp.value)));

  $('#formRapida').addEventListener('submit', (e)=>{
    e.preventDefault();
    const pid = $('#rapidaPid').value;
    const p = state.productos.find(x=>x.id===pid);
    const qty = Math.max(parseInt($('#rapidaCant').value)||1, 1);
    if (!p) { alert('Elegí un producto'); return; }
    if (p.stock < qty) { alert('No hay suficiente stock'); return; }
    // generar venta directa (cliente y cajero seleccionados)
    p.stock -= qty;
    const venta = {
      id: uid('venta'),
      fecha: new Date().toISOString(),
      clienteId: $('#rapidaCliente').value,
      cajero: $('#rapidaCajero').value || (state.settings.cajeros[0] || 'Caja 1'),
      items: [{ productoId: p.id, descripcion: p.descripcion, precio: p.precioVenta, cantidad: qty }],
      total: p.precioVenta * qty,
      entregado: p.precioVenta * qty,
      vuelto: 0
    };
    state.ventas.unshift(venta);
    saveState();
    renderProductos(); renderReportes(); renderDashboard();
    $('#modalRapida').close();
    openTicket(venta);
    showToast('✅ Venta registrada (rápida)');
  });
}

// ====== Inicialización ======
function hydrate() {
  renderProductos();
  renderClientes();
  renderCarrito();
  renderReportes();
  renderDashboard();
}

function bindThemeToggle() {
  const btn = document.getElementById("btnToggleTheme");
  btn.addEventListener("click",()=>{
    document.body.classList.toggle("dark");
    document.body.classList.toggle("light");
  });
}

window.addEventListener('DOMContentLoaded', ()=> {
  loadState();
  bindNav();
  bindProductos();
  bindClientes();
  bindVentas();
  bindReportes();
  bindConfig();
  bindThemeToggle();
  bindVentaRapida();
  hydrate();
});

