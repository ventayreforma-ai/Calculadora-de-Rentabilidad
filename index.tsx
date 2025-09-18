// Utils: parse numbers (accept dot or comma), parse % either "0.25" or "25"
const $ = (id: string) => document.getElementById(id) as HTMLInputElement;
const qsAll = (sel: string) => Array.from(document.querySelectorAll(sel));
const toNum = (v: any) => {
  if (v == null) return 0;
  if (typeof v === 'number') return v;
  v = ('' + v).trim().replace(/\s/g, '').replace(/\./g, '').replace(',', '.');
  // if user wrote "90.000" -> becomes "90000"; if "90,5" -> "90.5"
  let n = parseFloat(v);
  return isNaN(n) ? 0 : n;
};
const toPct = (v: any) => {
  let n = toNum(v);
  if (n > 1) n = n / 100; // "10" -> 0.10
  if (n < 0) n = 0;
  if (n >= 1) n = 0.999; // avoid division by zero
  return n;
};
const eur = (n: number) => {
  if (!isFinite(n)) return '—';
  return n.toLocaleString('es-ES', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0
  });
};
const eur2 = (n: number) => {
  if (!isFinite(n)) return '—';
  return n.toLocaleString('es-ES', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
};
const pct = (n: number) => !isFinite(n) ? '—' : (n * 100).toLocaleString('es-ES', {
  maximumFractionDigits: 2
}) + '%';

// Elements
const inputs = {
  pc: $('pc'),
  itp: $('itp'),
  ajd: $('ajd'),
  compfijos: $('compfijos'),
  compotros: $('compotros'),
  reforma: $('reforma'),
  ivaref: $('ivaref'),
  cemp: $('cemp'),
  fin: $('fin'),
  ventafijos: $('ventafijos'),
  k: $('k'),
  tax: $('tax'),
  roi: $('roi')
};

const out = {
  I: $('I'),
  PVpre: $('PVpre'),
  PVpost: $('PVpost'),
  PVrec: $('PVrec'),
  Bpre_pre: $('Bpre_pre'),
  Bpre_post: $('Bpre_post'),
  Bnet_pre: $('Bnet_pre'),
  Bnet_post: $('Bnet_post'),
  ROI_pre_pre: $('ROI_pre_pre'),
  ROI_net_post: $('ROI_net_post'),
  M_pre_pre: $('M_pre_pre'),
  M_pre_post: $('M_pre_post'),
  explain: $('explain')
};

let basis = 'net'; // 'net' | 'pre' | 'max'

// Load from querystring (optional share)
function loadFromQuery() {
  const p = new URLSearchParams(location.search);
  Object.keys(inputs).forEach(k => {
    if (p.has(k)) {
      (inputs as any)[k].value = p.get(k);
    }
  });
  if (p.has('basis')) {
    basis = String(p.get('basis'));
    setBasisButton();
  }
}

function setBasisButton() {
  qsAll('.seg button').forEach(b => {
    b.classList.toggle('active', (b as HTMLElement).dataset.basis === basis);
  });
}

// Core calculation (match the spreadsheet formulas)
function calc() {
  const PC = toNum(inputs.pc.value);
  const ITP = toPct(inputs.itp.value);
  const AJD = toPct(inputs.ajd.value);
  const COMPR_FIJOS = toNum(inputs.compfijos.value);
  const COMPR_OTROS = toNum(inputs.compotros.value);

  const REFORMA = toNum(inputs.reforma.value);
  const IVA_REF = toPct(inputs.ivaref.value);

  const C_EMP = toNum(inputs.cemp.value);
  const FIN = toNum(inputs.fin.value);

  const VENTA_FIJOS = toNum(inputs.ventafijos.value);
  const K = Math.min(0.99, toPct(inputs.k.value)); // comisión
  const TAX = Math.min(0.99, toPct(inputs.tax.value));
  const ROI = toPct(inputs.roi.value);

  // Inversión total
  const I = PC * (1 + ITP + AJD) + COMPR_FIJOS + COMPR_OTROS + REFORMA * (1 + IVA_REF) + C_EMP + FIN;

  // PV objetivo (pre y neto)
  const denom = (1 - K) <= 0 ? NaN : (1 - K);
  const PV_pre = denom ? ((I * (1 + ROI) + VENTA_FIJOS) / denom) : NaN;
  const PV_post = denom ? ((I + VENTA_FIJOS + ROI * I / (1 - TAX)) / denom) : NaN;

  // Beneficios y ratios con PV_pre
  const Bpre_pre = PV_pre * (1 - K) - VENTA_FIJOS - I;
  const Bnet_pre = (PV_pre * (1 - K) - VENTA_FIJOS - I) * (1 - TAX);
  const ROIpre_pre = Bpre_pre / (I || NaN);
  const Mpre_pre = Bpre_pre / (PV_pre || NaN);

  // Beneficios y ratios con PV_post
  const Bpre_post = PV_post * (1 - K) - VENTA_FIJOS - I;
  const Bnet_post = (PV_post * (1 - K) - VENTA_FIJOS - I) * (1 - TAX);
  const ROInet_post = Bnet_post / (I || NaN);
  const Mpre_post = Bpre_post / (PV_post || NaN);

  // Precio recomendado según base
  let PV_rec = PV_post; // por defecto neto
  if (basis === 'pre') PV_rec = PV_pre;
  if (basis === 'max') PV_rec = Math.max(PV_pre, PV_post);

  // Paint
  out.I.textContent = eur2(I);
  out.PVpre.textContent = eur2(PV_pre);
  out.PVpost.textContent = eur2(PV_post);
  out.PVrec.textContent = eur(PV_rec);

  out.Bpre_pre.textContent = eur2(Bpre_pre);
  out.Bpre_post.textContent = eur2(Bpre_post);
  out.Bnet_pre.textContent = eur2(Bnet_pre);
  out.Bnet_post.textContent = eur2(Bnet_post);

  out.ROI_pre_pre.textContent = `${pct(ROIpre_pre)} / ${pct(Bnet_pre/(I||NaN))}`;
  out.ROI_net_post.textContent = `${pct(Bpre_post/(I||NaN))} / ${pct(ROInet_post)}`;

  out.M_pre_pre.textContent = pct(Mpre_pre);
  out.M_pre_post.textContent = pct(Mpre_post);

  // KPI coloring (simple)
  document.querySelectorAll('.kpi').forEach(k => k.classList.remove('good', 'warn', 'bad'));
  const kpis = document.querySelectorAll('.kpi');
  // Mark PV recommended green if > inversion
  (kpis[3])?.classList.toggle('good', PV_rec > I);
  (kpis[3])?.classList.toggle('warn', PV_rec <= I);


  out.explain.textContent = `Con el PV recomendado, tu objetivo es un ROI del ${pct(ROI)} ${basis==='net'?'neto (después de impuestos)':'pre-impuestos'}.
      Ajusta % de impuestos, comisión o costes para ver sensibilidad.`;
}

// Bind inputs
Object.values(inputs).forEach(el => {
  ['input', 'change', 'blur'].forEach(ev => el.addEventListener(ev, calc));
});

// Basis buttons
qsAll('.seg button').forEach(btn => {
  btn.addEventListener('click', () => {
    basis = (btn as HTMLElement).dataset.basis as string;
    setBasisButton();
    calc();
  });
});

// Reset defaults
$('reset').addEventListener('click', () => {
  inputs.pc.value = '90000';
  inputs.itp.value = '10';
  inputs.ajd.value = '0';
  inputs.compfijos.value = '1500';
  inputs.compotros.value = '0';
  inputs.reforma.value = '40000';
  inputs.ivaref.value = '21';
  inputs.cemp.value = '6000';
  inputs.fin.value = '3000';
  inputs.ventafijos.value = '1200';
  inputs.k.value = '3';
  inputs.tax.value = '25';
  inputs.roi.value = '25';
  basis = 'net';
  setBasisButton();
  calc();
});

// Copy PV recommended
$('copyPV').addEventListener('click', () => {
  const btn = $('copyPV');
  const val = ($('PVrec') as HTMLElement).textContent?.replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.') || '0';
  const num = Number(val);
  const pretty = num.toLocaleString('es-ES', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0
  });
  navigator.clipboard.writeText(pretty).then(() => {
    const old = btn.textContent;
    btn.textContent = '¡Copiado!';
    setTimeout(() => btn.textContent = old, 1200);
  });
});

// Round PV to nearest hundreds
$('redondear').addEventListener('click', () => {
  const pvRecEl = $('PVrec') as HTMLElement;
  const txt = pvRecEl.textContent || '';
  const raw = Number(txt.replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.'));
  if (!isFinite(raw)) return;
  const rounded = Math.round(raw / 100) * 100;
  pvRecEl.textContent = rounded.toLocaleString('es-ES', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0
  });
});

// Share current scenario
$('share').addEventListener('click', () => {
  const btn = $('share');
  const p = new URLSearchParams();
  Object.entries(inputs).forEach(([k, el]) => p.set(k, (el as HTMLInputElement).value));
  p.set('basis', basis);
  const url = location.origin + location.pathname + '?' + p.toString();
  navigator.clipboard.writeText(url).then(() => {
    const old = btn.textContent;
    btn.textContent = 'Enlace copiado';
    setTimeout(() => btn.textContent = old, 1200);
  });
});

loadFromQuery();
calc(); // initial
