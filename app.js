/* =====================================================================
   ÓRBITA · radar de investimentos (Banco Inter)
   Um único arquivo JS, sem build. Funciona em GitHub Pages.
   - Modo nuvem: Supabase (auth + tabelas com RLS)  -> config.js
   - Modo local: localStorage (se o Supabase não estiver configurado)
   ===================================================================== */
'use strict';

/* ------------------------------------------------------------------ */
/* utilidades                                                          */
/* ------------------------------------------------------------------ */
const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const BRL0 = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const f$ = v => BRL.format(Number.isFinite(v) ? v : 0);
const f$0 = v => BRL0.format(Number.isFinite(v) ? v : 0);
const fN = (v, d = 2) => Number.isFinite(v) ? v.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—';
const fP = (v, d = 2) => Number.isFinite(v) ? fN(v, d) + '%' : '—';
const pad = n => String(n).padStart(2, '0');
const isoD = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseD = s => { if (!s) return null; const [y, m, d] = String(s).slice(0, 10).split('-').map(Number); return new Date(y, m - 1, d); };
const brD = s => { const d = typeof s === 'string' ? parseD(s) : s; return d ? d.toLocaleDateString('pt-BR') : '—'; };
const today = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); };
const daysBetween = (a, b) => Math.round((b - a) / 864e5);
const addMonths = (d, n) => { const x = new Date(d); x.setMonth(x.getMonth() + n); return x; };
const monthsUntil = d => Math.max(0, daysBetween(today(), d) / 30.4375);
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'id-' + Math.random().toString(36).slice(2) + Date.now());
const num = v => { if (v === '' || v == null) return null; const n = Number(String(v).replace(',', '.')); return Number.isFinite(n) ? n : null; };
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lsGet = (k, fb) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fb; } catch { return fb; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sem storage */ } };

const ICON = {
  edit: '<svg viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16v4z"/></svg>',
  del: '<svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>',
  plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
  grip: '<svg viewBox="0 0 24 24"><circle cx="9" cy="6" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="18" r="1"/></svg>',
  size: '<svg viewBox="0 0 24 24"><path d="M4 9V4h5M20 15v5h-5M4 4l6 6M20 20l-6-6"/></svg>',
  up: '<svg viewBox="0 0 24 24"><path d="M12 19V5M5 12l7-7 7 7"/></svg>',
  down: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12l7 7 7-7"/></svg>',
  dl: '<svg viewBox="0 0 24 24"><path d="M12 4v11M7 10l5 5 5-5M4 20h16"/></svg>',
  ul: '<svg viewBox="0 0 24 24"><path d="M12 20V9M7 14l5-5 5 5M4 4h16"/></svg>',
};

/* ------------------------------------------------------------------ */
/* indicadores (referência + ao vivo + ajuste manual)                  */
/* ------------------------------------------------------------------ */
// Valores de referência (24/09/2026). São substituídos automaticamente
// pelos dados ao vivo do Banco Central quando a consulta funciona.
const IND_REF = {
  selic: 13.75,   // meta Selic – Copom 16/09/2026
  cdi: 13.65,     // CDI ≈ Selic meta − 0,10
  ipca12: 4.22,   // IPCA 12 meses – IBGE (ago/2026)
  tr: 1.9,        // TR anualizada (estimativa)
  focus: { 2026: 13.75, 2027: 12.0, 2028: 10.5, 2029: 10.0 }, // Boletim Focus (mediana Selic fim de ano)
  date: '2026-09-24',
};
const IND_META = {
  selic: { nome: 'Selic meta', fonte: 'Banco Central · SGS 432', un: '% a.a.' },
  cdi: { nome: 'CDI', fonte: 'Banco Central · SGS 4389', un: '% a.a.' },
  ipca12: { nome: 'IPCA 12 meses', fonte: 'IBGE via BCB · SGS 13522', un: '%' },
  tr: { nome: 'TR (anualizada)', fonte: 'Banco Central · SGS 226', un: '% a.a.' },
};

/* ------------------------------------------------------------------ */
/* catálogo de produtos do Banco Inter                                 */
/* status: 'referencia' = taxa pública/verificada em fonte             */
/*         'estimativa' = faixa típica de mercado – confirme no app    */
/*         'confirmado' = você atualizou com a taxa do app             */
/* ------------------------------------------------------------------ */
const CATALOG_BASE = [
  { id: 'cdb_liq', nome: 'CDB Inter Liquidez Diária', cat: 'Renda fixa bancária', idx: 'cdi', taxa: 100, liqDias: 0, liqTxt: 'Diária (D+0)', carencia: 0, venc: null, isento: false, fgc: true, garantia: 'FGC até R$ 250 mil', risco: 1, min: 1, custodia: 0, custIsento: 0, marcacao: false, status: 'referencia', nota: 'Base da reserva de emergência. Também é o que roda por trás de "Meu Porquinho" na maioria dos casos.' },
  { id: 'porquinho', nome: 'Meu Porquinho', cat: 'Renda fixa bancária', idx: 'cdi', taxa: 80, liqDias: 0, liqTxt: 'Diária (D+0)', carencia: 0, venc: null, isento: false, fgc: true, garantia: 'FGC até R$ 250 mil', risco: 1, min: 1, custodia: 0, custIsento: 0, marcacao: false, status: 'estimativa', nota: 'Cofrinho por objetivo. O % do CDI mudou nos últimos anos — confira no app e atualize aqui.' },
  { id: 'cdb_1a', nome: 'CDB Inter 1 ano', cat: 'Renda fixa bancária', idx: 'cdi', taxa: 102, liqDias: 365, liqTxt: 'No vencimento', carencia: 12, venc: null, isento: false, fgc: true, garantia: 'FGC até R$ 250 mil', risco: 1, min: 100, custodia: 0, custIsento: 0, marcacao: false, status: 'estimativa', nota: 'Paga um pouco mais que o de liquidez diária em troca de travar o dinheiro.' },
  { id: 'cdb_2a', nome: 'CDB Inter 2 anos', cat: 'Renda fixa bancária', idx: 'cdi', taxa: 105, liqDias: 730, liqTxt: 'No vencimento', carencia: 24, venc: null, isento: false, fgc: true, garantia: 'FGC até R$ 250 mil', risco: 1, min: 100, custodia: 0, custIsento: 0, marcacao: false, status: 'estimativa', nota: 'Bom quando a data de uso do dinheiro coincide com o vencimento.' },
  { id: 'lci_1a', nome: 'LCI/LCA Inter ~1 ano', cat: 'Renda fixa bancária', idx: 'cdi', taxa: 90, liqDias: 365, liqTxt: 'No vencimento', carencia: 12, venc: null, isento: true, fgc: true, garantia: 'FGC até R$ 250 mil', risco: 1, min: 100, custodia: 0, custIsento: 0, marcacao: false, status: 'estimativa', nota: 'Isenta de IR para pessoa física. Prazo mínimo legal de carência (9–12 meses).' },
  { id: 'tesouro_selic', nome: 'Tesouro Selic 2031', cat: 'Tesouro Direto', idx: 'selic', taxa: 0.08, liqDias: 1, liqTxt: 'D+1 (dias úteis)', carencia: 0, venc: '2031-03-01', isento: false, fgc: false, garantia: 'Tesouro Nacional', risco: 1, min: 150, custodia: 0.2, custIsento: 10000, marcacao: false, status: 'referencia', nota: 'Título público mais seguro do país. Taxa B3 de 0,20% a.a. só sobre o que passar de R$ 10 mil.' },
  { id: 'tesouro_pre', nome: 'Tesouro Prefixado 2029', cat: 'Tesouro Direto', idx: 'pre', taxa: 13.2, liqDias: 1, liqTxt: 'D+1 · preço oscila', carencia: 0, venc: '2029-01-01', isento: false, fgc: false, garantia: 'Tesouro Nacional', risco: 2, min: 35, custodia: 0.2, custIsento: 0, marcacao: true, status: 'estimativa', nota: 'Trava a taxa até o vencimento. Se vender antes, o preço pode estar acima ou abaixo.' },
  { id: 'tesouro_ipca', nome: 'Tesouro IPCA+ 2035', cat: 'Tesouro Direto', idx: 'ipca', taxa: 7.0, liqDias: 1, liqTxt: 'D+1 · preço oscila', carencia: 0, venc: '2035-05-15', isento: false, fgc: false, garantia: 'Tesouro Nacional', risco: 3, min: 35, custodia: 0.2, custIsento: 0, marcacao: true, status: 'estimativa', nota: 'Protege da inflação no longo prazo. Oscila bastante no curto prazo.' },
  { id: 'poupanca', nome: 'Poupança', cat: 'Poupança', idx: 'poupanca', taxa: 0, liqDias: 0, liqTxt: 'Diária (rende no aniversário)', carencia: 0, venc: null, isento: true, fgc: true, garantia: 'FGC até R$ 250 mil', risco: 1, min: 1, custodia: 0, custIsento: 0, marcacao: false, status: 'referencia', nota: '0,5% ao mês + TR enquanto a Selic estiver acima de 8,5%.' },
  { id: 'rv', nome: 'Ações / ETFs (ex.: BOVA11)', cat: 'Renda variável', idx: 'manual', taxa: 0, liqDias: 2, liqTxt: 'D+2', carencia: 0, venc: null, isento: false, fgc: false, garantia: 'Sem garantia', risco: 5, min: 10, custodia: 0, custIsento: 0, marcacao: true, status: 'referencia', rank: false, nota: 'Sem rentabilidade previsível: fica fora do ranking. Registre o valor atual manualmente na carteira.' },
];
const IDX_LABEL = { cdi: 'CDI', selic: 'Selic', pre: 'Prefixado', ipca: 'IPCA+', poupanca: 'Poupança', manual: 'Manual' };
const OBJ = {
  reserva: { nome: 'Reserva de emergência', desc: 'Precisa poder sacar a qualquer momento.' },
  meta: { nome: 'Meta com data', desc: 'Vai usar o dinheiro numa data definida (ex.: intercâmbio).' },
  longo: { nome: 'Longo prazo', desc: 'Não vai mexer por anos; aceita oscilação no caminho.' },
};

/* ------------------------------------------------------------------ */
/* estado                                                              */
/* ------------------------------------------------------------------ */
const CFG = window.ORBITA_CONFIG || {};
const CLOUD_CONFIGURED = !!(CFG.SUPABASE_URL && CFG.SUPABASE_ANON_KEY && window.supabase && window.supabase.createClient);
let sb = null;

const S = {
  view: 'radar',
  user: null,
  localMode: !CLOUD_CONFIGURED,
  live: lsGet('orbita:live', null),  // {ts, values:{selic:{v,date}}, focus:{year:v}, focusDate}
  positions: [], goals: [], dashboards: [],
  settings: { catalog: {}, custom: [], indOverride: {}, profile: { valor: 0, aporte: 500, meses: 24, objetivo: 'meta' }, activeDash: null },
};

function ind() {
  const o = S.settings.indOverride || {};
  const lv = (S.live && S.live.values) || {};
  const out = { src: {}, date: {} };
  for (const k of ['selic', 'cdi', 'ipca12', 'tr']) {
    if (o[k] != null) { out[k] = o[k]; out.src[k] = 'manual'; out.date[k] = 'ajuste seu'; }
    else if (lv[k] && Number.isFinite(lv[k].v)) { out[k] = lv[k].v; out.src[k] = 'live'; out.date[k] = lv[k].date; }
    else { out[k] = IND_REF[k]; out.src[k] = 'ref'; out.date[k] = brD(IND_REF.date); }
  }
  const lf = S.live && S.live.focus && Object.keys(S.live.focus).length ? S.live.focus : null;
  out.focus = o.focus || lf || IND_REF.focus;
  out.src.focus = o.focus ? 'manual' : lf ? 'live' : 'ref';
  out.date.focus = o.focus ? 'ajuste seu' : lf ? S.live.focusDate : brD(IND_REF.date);
  return out;
}

function catalog() {
  const ov = S.settings.catalog || {};
  const base = CATALOG_BASE.map(p => ({ ...p, ...(ov[p.id] || {}) }));
  const custom = (S.settings.custom || []).map(p => ({ ...p, custom: true }));
  return [...base, ...custom];
}
const prodById = id => catalog().find(p => p.id === id);
const vencMeses = p => p.venc ? monthsUntil(parseD(p.venc)) : null;

/* ------------------------------------------------------------------ */
/* motor financeiro                                                    */
/* ------------------------------------------------------------------ */
// Trajetória da Selic: interpola entre o valor atual e as medianas do Focus
function selicAt(m) {
  const I = ind();
  const now = today();
  const pts = [{ m: 0, v: I.selic }];
  Object.keys(I.focus).map(Number).sort((a, b) => a - b).forEach(y => {
    const mm = daysBetween(now, new Date(y, 11, 31)) / 30.4375;
    if (mm > 0.5) pts.push({ m: mm, v: Number(I.focus[y]) });
  });
  if (m <= 0 || pts.length === 1) return pts[0].v;
  for (let i = 1; i < pts.length; i++) {
    if (m <= pts[i].m) { const a = pts[i - 1], b = pts[i]; return a.v + (b.v - a.v) * (m - a.m) / (b.m - a.m); }
  }
  return pts[pts.length - 1].v;
}
const cdiAt = m => { const I = ind(); return selicAt(m) - (I.selic - I.cdi); };

// Taxa anual bruta (%) de um produto no mês m a partir de hoje
function rateAt(p, m = 0) {
  const I = ind();
  const t = Number(p.taxa) || 0;
  switch (p.idx) {
    case 'cdi': return cdiAt(m) * t / 100;
    case 'selic': return cdiAt(m) + t; // Selic over ≈ CDI
    case 'pre': return t;
    case 'ipca': return ((1 + I.ipca12 / 100) * (1 + t / 100) - 1) * 100;
    case 'poupanca': {
      const s = selicAt(m);
      const base = s > 8.5 ? Math.pow(1.005, 12) - 1 : 0.7 * s / 100;
      return ((1 + base) * (1 + I.tr / 100) - 1) * 100;
    }
    default: return 0;
  }
}
function rateLabel(p) {
  const t = Number(p.taxa) || 0;
  switch (p.idx) {
    case 'cdi': return `${fN(t, t % 1 ? 1 : 0)}% do CDI`;
    case 'selic': return `Selic + ${fN(t, 2)}%`;
    case 'pre': return `${fN(t, 2)}% a.a.`;
    case 'ipca': return `IPCA + ${fN(t, 2)}%`;
    case 'poupanca': return '0,5% a.m. + TR';
    default: return 'Variável';
  }
}
const irAliq = d => d <= 180 ? 22.5 : d <= 360 ? 20 : d <= 720 ? 17.5 : 15;
const IOF_T = [96, 93, 90, 86, 83, 80, 76, 73, 70, 66, 63, 60, 56, 53, 50, 46, 43, 40, 36, 33, 30, 26, 23, 20, 16, 13, 10, 6, 3, 0];
const iofAliq = d => d >= 30 || d < 1 ? (d < 1 ? 100 : 0) : IOF_T[d - 1];

function lotNet(lot, days, p) {
  const gain = Math.max(0, lot.v - lot.inv);
  if (p.isento) return { iof: 0, ir: 0, liq: lot.v };
  const iof = gain * iofAliq(Math.round(days)) / 100;
  const ir = (gain - iof) * irAliq(days) / 100;
  return { iof, ir, liq: lot.v - iof - ir };
}

// Simulação mensal com lotes (cada aporte tem sua própria alíquota de IR)
function simulate(p, { inicial = 0, aporte = 0, meses = 12 }) {
  meses = clamp(Math.round(meses), 1, 600);
  const lots = [];
  const series = [];
  const DAYS_M = 30.4375;
  let investido = 0;
  const push = (v, t) => { if (v > 0) { lots.push({ v, inv: v, t }); investido += v; } };
  push(inicial + aporte, 0);
  const snap = t => {
    let bruto = 0, liq = 0, ir = 0, iof = 0;
    for (const l of lots) {
      const r = lotNet(l, (t - l.t) * DAYS_M, p);
      bruto += l.v; liq += r.liq; ir += r.ir; iof += r.iof;
    }
    return { m: t, bruto, liq, ir, iof, investido };
  };
  series.push(snap(0));
  for (let t = 1; t <= meses; t++) {
    const r = rateAt(p, t - 0.5);
    const f = Math.pow(1 + r / 100, 1 / 12);
    let total = 0;
    for (const l of lots) { l.v *= f; total += l.v; }
    if (p.custodia) {
      const base = Math.max(0, total - (p.custIsento || 0));
      const fee = base * p.custodia / 100 / 12;
      if (fee > 0 && total > 0) for (const l of lots) l.v -= fee * l.v / total;
    }
    if (t < meses) push(aporte, t);
    series.push(snap(t));
  }
  const fin = series[series.length - 1];
  // taxa interna de retorno (TIR) mensal -> anual líquida
  const flows = lots.map(l => ({ t: l.t, v: l.inv }));
  const aaLiq = irrAnnual(flows, fin.liq, meses);
  const I = ind();
  const real = ((1 + aaLiq / 100) / (1 + I.ipca12 / 100) - 1) * 100;
  return { series, final: fin, aaLiq, real, investido: fin.investido, rendLiq: fin.liq - fin.investido };
}
function irrAnnual(flows, fv, T) {
  if (!flows.length || fv <= 0) return 0;
  const f = r => flows.reduce((s, x) => s + x.v * Math.pow(1 + r, T - x.t), 0) - fv;
  let lo = -0.05, hi = 0.1;
  for (let i = 0; i < 80; i++) { const mid = (lo + hi) / 2; if (f(mid) > 0) hi = mid; else lo = mid; }
  return (Math.pow(1 + (lo + hi) / 2, 12) - 1) * 100;
}

// Ranking de produtos para um objetivo
function rankProducts({ valor = 0, aporte = 0, meses = 24, objetivo = 'meta' }) {
  const H = clamp(Math.round(meses), 1, 600);
  const cat = catalog().filter(p => p.rank !== false && p.idx !== 'manual');
  const inicial = valor > 0 || aporte > 0 ? valor : 1000;
  return cat.map(p => {
    const sim = simulate(p, { inicial, aporte, meses: H });
    const warns = [], goods = [];
    let ok = true, pen = 0;
    const vm = vencMeses(p);
    if (objetivo === 'reserva' && p.liqDias > 1) { ok = false; warns.push('Sem liquidez diária'); }
    if (p.carencia && p.carencia > H) { ok = false; warns.push(`Trava ${p.carencia} meses (> seu prazo)`); }
    else if (p.carencia && aporte > 0 && p.carencia > 1) { ok = false; warns.push(H - p.carencia <= 0 ? 'Só o valor inicial vence a tempo; aportes mensais ficariam travados' : `Aportes feitos após o mês ${H - p.carencia} ficam travados além do prazo`); }
    if (vm != null && vm < H - 1) warns.push('Vence antes do seu prazo');
    if (p.marcacao && vm != null && vm > H + 3) {
      pen += objetivo === 'longo' ? 0.25 : objetivo === 'reserva' ? 3 : 1.5;
      warns.push('Se vender antes do vencimento, o preço oscila');
    }
    if (objetivo !== 'longo' && p.liqDias <= 1 && !p.marcacao) { pen -= 0.15; goods.push('Saque a qualquer momento'); }
    if (p.isento) goods.push('Isento de IR');
    if (p.fgc) goods.push('FGC'); else if (p.garantia === 'Tesouro Nacional') goods.push('Tesouro Nacional');
    pen += (p.risco - 1) * 0.15;
    return { p, sim, ok, warns, goods, score: sim.aaLiq - pen };
  }).sort((a, b) => (b.ok - a.ok) || (b.score - a.score));
}

// Carteira: valor atual estimado de uma aplicação
function posValue(pos, at = today()) {
  const start = parseD(pos.data_aplicacao) || today();
  const venc = parseD(pos.vencimento);
  const end = venc && venc < at ? venc : at;
  const days = Math.max(0, daysBetween(start, end));
  const inv = Number(pos.valor) || 0;
  let bruto;
  const manual = num(pos.valor_atual_manual);
  if (at >= today() && manual != null) bruto = manual;
  else if (manual != null) { // interpolação linear para histórico
    const tot = Math.max(1, daysBetween(start, today()));
    bruto = inv + (manual - inv) * Math.min(1, days / tot);
  } else if (pos.idx === 'manual') bruto = inv;
  else bruto = inv * Math.pow(1 + rateAt(pos, 0) / 100, days / 365);
  const net = pos.isento_ir || pos.idx === 'manual' && manual == null
    ? { iof: 0, ir: 0, liq: bruto }
    : lotNet({ v: bruto, inv }, days, { isento: !!pos.isento_ir });
  if (at < start) return { inv: 0, bruto: 0, liq: 0, ir: 0, days: 0 };
  return { inv, bruto, liq: net.liq, ir: net.ir + net.iof, days };
}
function portfolio() {
  const rows = S.positions.map(p => ({ p, ...posValue(p) }));
  const t = rows.reduce((a, r) => ({ inv: a.inv + r.inv, bruto: a.bruto + r.bruto, liq: a.liq + r.liq, ir: a.ir + r.ir }), { inv: 0, bruto: 0, liq: 0, ir: 0 });
  const w = rows.filter(r => r.p.idx !== 'manual');
  const wSum = w.reduce((s, r) => s + r.bruto, 0);
  t.taxaMedia = wSum ? w.reduce((s, r) => s + rateAt(r.p, 0) * r.bruto, 0) / wSum : null;
  const liqNow = rows.filter(r => { const pr = prodById(r.p.tipo); return pr ? pr.liqDias <= 2 : !r.p.vencimento; }).reduce((s, r) => s + r.bruto, 0);
  t.liquidezPct = t.bruto ? liqNow / t.bruto * 100 : null;
  t.rows = rows;
  return t;
}
function portfolioTimeline(futureMonths = 24) {
  if (!S.positions.length) return { labels: [], hist: [], proj: [] };
  const first = S.positions.map(p => parseD(p.data_aplicacao)).filter(Boolean).sort((a, b) => a - b)[0] || today();
  const labels = [], hist = [], proj = [];
  const start = new Date(first.getFullYear(), first.getMonth(), 1);
  const tdy = today();
  let d = new Date(start);
  const pts = [];
  while (d < tdy) { pts.push(new Date(d)); d = addMonths(d, 1); }
  pts.push(tdy);
  const step = Math.ceil(pts.length / 36);
  const histPts = pts.filter((_, i) => i % step === 0 || i === pts.length - 1);
  for (const x of histPts) {
    labels.push(x.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }));
    hist.push(S.positions.reduce((s, p) => s + posValue(p, x).bruto, 0));
    proj.push(null);
  }
  proj[proj.length - 1] = hist[hist.length - 1];
  // projeção
  const cur = S.positions.map(p => ({ p, v: posValue(p).bruto }));
  for (let m = 1; m <= futureMonths; m++) {
    for (const c of cur) {
      const venc = parseD(c.p.vencimento);
      const after = venc && addMonths(tdy, m) > venc;
      const r = c.p.idx === 'manual' ? 0 : after ? cdiAt(m) : rateAt(c.p, m - 0.5);
      c.v *= Math.pow(1 + r / 100, 1 / 12);
    }
    labels.push(addMonths(tdy, m).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }));
    hist.push(null);
    proj.push(cur.reduce((s, c) => s + c.v, 0));
  }
  return { labels, hist, proj };
}

function goalCalc(g) {
  const alvo = Number(g.valor_alvo) || 0;
  const target = parseD(g.data_alvo) || addMonths(today(), 12);
  const meses = Math.max(1, Math.round(monthsUntil(target)));
  const p = prodById(g.produto) || prodById('cdb_liq');
  const inicial = g.usa_carteira ? portfolio().liq : 0;
  const aporte = Number(g.aporte_mensal) || 0;
  const sim = simulate(p, { inicial, aporte, meses });
  const proj = sim.final.liq;
  // aporte necessário (busca binária)
  let need = 0;
  if (simulate(p, { inicial, aporte: 0, meses }).final.liq < alvo) {
    let lo = 0, hi = alvo;
    for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; if (simulate(p, { inicial, aporte: mid, meses }).final.liq >= alvo) hi = mid; else lo = mid; }
    need = hi;
  }
  return { p, meses, inicial, proj, gap: alvo - proj, need, pctHoje: alvo ? inicial / alvo * 100 : 0, pctProj: alvo ? proj / alvo * 100 : 0, sim, target };
}

/* ------------------------------------------------------------------ */
/* dados ao vivo – Banco Central (SGS + Focus/Olinda)                  */
/* ------------------------------------------------------------------ */
async function fetchJSON(url, ms = 9000) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  try {
    const r = await fetch(url, { signal: c.signal, headers: { Accept: 'application/json' } });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return await r.json();
  } finally { clearTimeout(t); }
}
const sgsUrl = id => `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${id}/dados/ultimos/1?formato=json`;
const sane = (k, v) => ({ selic: [1, 40], cdi: [1, 40], ipca12: [-5, 30], tr: [0, 10] }[k] || [-1e9, 1e9]).reduce((ok, lim, i) => ok && (i ? v <= lim : v >= lim), Number.isFinite(v));

async function loadLive(force = false) {
  const fresh = S.live && S.live.ts && Date.now() - S.live.ts < 6 * 3600e3;
  if (fresh && !force) { paintIndChip(); return; }
  setIndChip('loading');
  const series = { selic: 432, cdi: 4389, ipca12: 13522, tr: 226 };
  const values = {};
  await Promise.allSettled(Object.entries(series).map(async ([k, id]) => {
    const j = await fetchJSON(sgsUrl(id));
    const row = Array.isArray(j) ? j[j.length - 1] : null;
    if (!row) return;
    let v = Number(String(row.valor).replace(',', '.'));
    if (k === 'tr') v = (Math.pow(1 + v / 100, 12) - 1) * 100;
    if (sane(k, v)) values[k] = { v, date: row.data };
  }));
  let focus = null, focusDate = null;
  try {
    const q = "https://olinda.bcb.gov.br/olinda/servico/Expectativas/versao/v1/odata/ExpectativasMercadoAnuais"
      + "?$top=60&$filter=" + encodeURIComponent("Indicador eq 'Selic'")
      + "&$orderby=" + encodeURIComponent("Data desc") + "&$format=json&$select=Indicador,Data,DataReferencia,Mediana,baseCalculo";
    const j = await fetchJSON(q, 12000);
    const rows = (j.value || []).filter(r => r.baseCalculo === 0 || r.baseCalculo == null);
    if (rows.length) {
      focusDate = rows[0].Data;
      const y0 = today().getFullYear();
      focus = {};
      rows.filter(r => r.Data === focusDate).forEach(r => {
        const y = Number(r.DataReferencia);
        if (y >= y0 && y <= y0 + 4 && sane('selic', r.Mediana)) focus[y] = r.Mediana;
      });
      if (!Object.keys(focus).length) focus = null; else focusDate = brD(focusDate);
    }
  } catch { /* segue com referência */ }
  const got = Object.keys(values).length + (focus ? 1 : 0);
  if (got) {
    S.live = { ts: Date.now(), values: { ...((S.live && S.live.values) || {}), ...values }, focus: focus || (S.live && S.live.focus) || null, focusDate: focus ? focusDate : (S.live && S.live.focusDate) };
    lsSet('orbita:live', S.live);
  }
  paintIndChip(got === 0);
  if (force) toast(got ? `Indicadores atualizados (${got}/5 fontes ao vivo)` : 'Banco Central indisponível agora — usando valores de referência', !got);
  render();
}
function setIndChip(state) {
  const c = $('#indChip');
  if (state === 'loading') { c.className = 'chip'; c.innerHTML = '<span class="bars"><i></i><i></i><i></i><i></i></span><span>consultando Banco Central…</span>'; }
}
function paintIndChip() {
  const I = ind();
  const live = Object.values(I.src).filter(s => s === 'live').length;
  const c = $('#indChip');
  c.className = 'chip ' + (live ? 'live' : 'ref');
  c.innerHTML = `<i></i><span>${live ? `dados ao vivo · ${live}/5` : 'valores de referência'} · Selic ${fP(I.selic)}</span>`;
}

/* ------------------------------------------------------------------ */
/* persistência – local ou Supabase                                    */
/* ------------------------------------------------------------------ */
const LKEY = 'orbita:data:v1';
const cloud = () => !!(sb && S.user && !S.localMode);
function persistLocal() {
  if (cloud()) return;
  lsSet(LKEY, { positions: S.positions, goals: S.goals, dashboards: S.dashboards, settings: S.settings });
}
function mergeSettings(d) {
  const base = S.settings;
  S.settings = { ...base, ...(d || {}), profile: { ...base.profile, ...((d && d.profile) || {}) } };
}
const Store = {
  async loadAll() {
    if (cloud()) {
      const [p, g, d, s] = await Promise.all([
        sb.from('positions').select('*').order('created_at'),
        sb.from('goals').select('*').order('created_at'),
        sb.from('dashboards').select('*').order('created_at'),
        sb.from('settings').select('data').maybeSingle(),
      ]);
      const err = p.error || g.error || d.error || s.error;
      if (err) throw err;
      S.positions = p.data || []; S.goals = g.data || []; S.dashboards = d.data || [];
      mergeSettings(s.data && s.data.data);
    } else {
      const L = lsGet(LKEY, {});
      S.positions = L.positions || []; S.goals = L.goals || []; S.dashboards = L.dashboards || [];
      mergeSettings(L.settings);
    }
  },
  async insert(table, obj) {
    if (cloud()) {
      const { data, error } = await sb.from(table).insert(obj).select().single();
      if (error) throw error;
      S[table].push(data); return data;
    }
    const row = { ...obj, id: uid(), created_at: new Date().toISOString() };
    S[table].push(row); persistLocal(); return row;
  },
  async update(table, id, patch) {
    if (cloud()) {
      const { data, error } = await sb.from(table).update(patch).eq('id', id).select().single();
      if (error) throw error;
      S[table] = S[table].map(r => r.id === id ? data : r); return data;
    }
    S[table] = S[table].map(r => r.id === id ? { ...r, ...patch } : r); persistLocal();
    return S[table].find(r => r.id === id);
  },
  async remove(table, id) {
    if (cloud()) { const { error } = await sb.from(table).delete().eq('id', id); if (error) throw error; }
    S[table] = S[table].filter(r => r.id !== id); persistLocal();
  },
  async saveSettings() {
    if (cloud()) {
      const { error } = await sb.from('settings').upsert({ user_id: S.user.id, data: S.settings, updated_at: new Date().toISOString() });
      if (error) throw error;
    } else persistLocal();
  },
};
async function safe(fn, okMsg) {
  try { const r = await fn(); if (okMsg) toast(okMsg); return r; }
  catch (e) { console.error(e); toast('Erro: ' + (e.message || e), true); return null; }
}

/* ------------------------------------------------------------------ */
/* UI – toast, modal                                                   */
/* ------------------------------------------------------------------ */
let toastT;
function toast(msg, err = false) {
  const t = $('#toast'); t.textContent = msg; t.className = 'toast show' + (err ? ' err' : '');
  clearTimeout(toastT); toastT = setTimeout(() => t.className = 'toast', 3200);
}
let modalCb = null;
function openModal({ title, body, ok = 'Salvar', onSubmit, onOpen, danger = false }) {
  $('#modalTitle').textContent = title;
  $('#modalBody').innerHTML = body;
  const b = $('#modalOk'); b.textContent = ok; b.className = 'btn ' + (danger ? 'danger' : 'pri'); b.hidden = !onSubmit;
  modalCb = onSubmit;
  $('#modal').classList.add('open');
  if (onOpen) onOpen($('#modalBody'));
  const f = $('#modalBody input, #modalBody select'); if (f) setTimeout(() => f.focus(), 30);
}
function closeModal() { $('#modal').classList.remove('open'); modalCb = null; }
$('#modalCancel').onclick = closeModal;
$('#modal').addEventListener('mousedown', e => { if (e.target.id === 'modal') closeModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
$('#modalForm').addEventListener('submit', async e => {
  e.preventDefault();
  if (!modalCb) return closeModal();
  const fd = Object.fromEntries(new FormData(e.target).entries());
  $$('#modalBody input[type=checkbox]').forEach(c => { if (c.name) fd[c.name] = c.checked; });
  const btn = $('#modalOk'); btn.disabled = true;
  const res = await modalCb(fd);
  btn.disabled = false;
  if (res !== false) closeModal();
});
function confirmBox(title, text, onYes) {
  openModal({ title, body: `<p class="tx2" style="margin:0">${text}</p>`, ok: 'Confirmar', danger: true, onSubmit: async () => { await onYes(); } });
}

/* ------------------------------------------------------------------ */
/* gráficos (Chart.js)                                                 */
/* ------------------------------------------------------------------ */
// Paleta categórica validada p/ superfície escura (ordem fixa, nunca cíclica)
const SERIES = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767'];
const CARD_BG = '#101722';
if (window.Chart) {
  Chart.defaults.color = '#a3b0c2';
  Chart.defaults.font.family = "'Space Grotesk', system-ui, sans-serif";
  Chart.defaults.font.size = 12;
  Chart.defaults.borderColor = '#1c2839';
  Chart.defaults.plugins.legend.labels.boxWidth = 10;
  Chart.defaults.plugins.legend.labels.boxHeight = 10;
  Chart.defaults.plugins.legend.labels.usePointStyle = true;
  Chart.defaults.plugins.tooltip.backgroundColor = '#0a0f17';
  Chart.defaults.plugins.tooltip.borderColor = '#2a3b52';
  Chart.defaults.plugins.tooltip.borderWidth = 1;
  Chart.defaults.plugins.tooltip.padding = 10;
  Chart.defaults.plugins.tooltip.titleColor = '#e9eef5';
  Chart.defaults.plugins.tooltip.bodyColor = '#e9eef5';
  Chart.defaults.animation.duration = 450;
}
function chart(canvas, cfg) {
  if (!window.Chart || !canvas) return null;
  if (canvas._c) canvas._c.destroy();
  cfg.options = cfg.options || {};
  cfg.options.responsive = true;
  cfg.options.maintainAspectRatio = false;
  canvas._c = new Chart(canvas, cfg);
  return canvas._c;
}
function destroyCharts(root) { $$('canvas', root).forEach(c => { if (c._c) { c._c.destroy(); c._c = null; } }); }
const moneyAxis = { ticks: { callback: v => f$0(v) }, grid: { color: '#1c2839' }, border: { display: false } };
const pctAxis = { ticks: { callback: v => fN(v, 1) + '%' }, grid: { color: '#1c2839' }, border: { display: false } };
const xAxis = { grid: { display: false }, border: { color: '#2a3b52' }, ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 8 } };
const tipMoney = { callbacks: { label: c => ` ${c.dataset.label}: ${f$(c.parsed.y ?? c.parsed)}` } };

let ENTERING = false;
function progressiveAnim(n) {
  if (!ENTERING || REDUCED) return {};
  const step = Math.min(40, 1100 / Math.max(1, n));
  const prevY = ctx => ctx.index === 0 ? ctx.chart.scales.y.getPixelForValue(ctx.chart.scales.y.min) : ctx.chart.getDatasetMeta(ctx.datasetIndex).data[ctx.index - 1].getProps(['y'], true).y;
  return { animations: {
    x: { type: 'number', easing: 'linear', duration: step, from: NaN, delay: ctx => { if (ctx.type !== 'data' || ctx.xStarted) return 0; ctx.xStarted = true; return ctx.index * step; } },
    y: { type: 'number', easing: 'linear', duration: step, from: prevY, delay: ctx => { if (ctx.type !== 'data' || ctx.yStarted) return 0; ctx.yStarted = true; return ctx.index * step; } },
  } };
}
function lineCfg(labels, datasets, yAxis = moneyAxis, tip = tipMoney) {
  return {
    type: 'line',
    data: { labels, datasets: datasets.map((d, i) => ({ borderWidth: 2, pointRadius: 0, pointHoverRadius: 5, pointHitRadius: 12, tension: .25, spanGaps: false, borderColor: d.color || SERIES[i], backgroundColor: d.fill || 'transparent', fill: !!d.fill, ...d })) },
    options: { ...progressiveAnim(labels.length), interaction: { mode: 'index', intersect: false }, scales: { x: xAxis, y: yAxis }, plugins: { legend: { display: datasets.length > 1, position: 'top', align: 'end' }, tooltip: tip } },
  };
}
function donutCfg(labels, values) {
  return {
    type: 'doughnut',
    data: { labels, datasets: [{ data: values, backgroundColor: labels.map((_, i) => SERIES[i]), borderColor: CARD_BG, borderWidth: 2, hoverOffset: 4 }] },
    options: {
      cutout: '68%',
      plugins: {
        legend: { position: 'bottom', labels: { generateLabels: ch => { const d = ch.data; const tot = d.datasets[0].data.reduce((a, b) => a + b, 0); return d.labels.map((l, i) => ({ text: `${l} · ${fN(d.datasets[0].data[i] / tot * 100, 0)}%`, fillStyle: SERIES[i], strokeStyle: SERIES[i], pointStyle: 'circle', fontColor: '#a3b0c2', index: i })); } } },
        tooltip: { callbacks: { label: c => ` ${c.label}: ${f$(c.parsed)}` } },
      },
    },
  };
}
function groupAllocation(by = 'tipo') {
  const pf = portfolio();
  const m = new Map();
  for (const r of pf.rows) {
    const pr = prodById(r.p.tipo);
    let k;
    if (by === 'idx') k = IDX_LABEL[r.p.idx] || r.p.idx;
    else if (by === 'liquidez') k = (pr ? pr.liqDias <= 2 : !r.p.vencimento) ? 'Liquidez imediata' : 'Travado até vencimento';
    else k = pr ? pr.nome : 'Outro';
    m.set(k, (m.get(k) || 0) + r.bruto);
  }
  let arr = [...m.entries()].sort((a, b) => b[1] - a[1]);
  if (arr.length > 8) { const rest = arr.slice(7).reduce((s, x) => s + x[1], 0); arr = [...arr.slice(0, 7), ['Outros', rest]]; }
  return arr;
}

/* ------------------------------------------------------------------ */
/* componentes reutilizados                                            */
/* ------------------------------------------------------------------ */
const srcDot = s => `<span class="dot ${s}" title="${s === 'live' ? 'ao vivo (Banco Central)' : s === 'manual' ? 'ajuste manual' : 'valor de referência'}"></span>`;
function tile(label, value, foot = '', cls = '', src = '') {
  return `<div class="card tile ${cls}"><div class="lbl"><span>${label}</span>${src ? srcDot(src) : ''}</div><div class="val">${value}</div>${foot ? `<div class="foot">${foot}</div>` : ''}</div>`;
}
const riskDots = n => `<span class="risk" title="Risco ${n}/5">${[1, 2, 3, 4, 5].map(i => `<i class="${i <= n ? 'on' : ''}"></i>`).join('')}</span>`;
const statusBadge = p => p.status === 'confirmado'
  ? `<span class="bdg ok">confirmado ${p.confirmedAt ? brD(p.confirmedAt) : ''}</span>`
  : p.status === 'estimativa' ? '<span class="bdg est">taxa estimada · confirme no app</span>' : '<span class="bdg">taxa de referência</span>';

function productOptions(sel, includeManual = true) {
  const groups = {};
  catalog().filter(p => includeManual || p.idx !== 'manual').forEach(p => { (groups[p.cat] = groups[p.cat] || []).push(p); });
  return Object.entries(groups).map(([g, ps]) => `<optgroup label="${esc(g)}">${ps.map(p => `<option value="${esc(p.id)}" ${p.id === sel ? 'selected' : ''}>${esc(p.nome)}</option>`).join('')}</optgroup>`).join('');
}

function rankRow(r, i) {
  const p = r.p, s = r.sim;
  return `<div class="rk ${i === 0 && r.ok ? 'top' : ''} ${r.ok ? '' : 'off'}">
    <div class="n">${r.ok ? String(i + 1).padStart(2, '0') : '—'}</div>
    <div>
      <div class="name">${esc(p.nome)}</div>
      <div class="meta">${esc(rateLabel(p))} · ${esc(p.liqTxt)} · ${riskDots(p.risco)}</div>
    </div>
    <div><div class="k">Líquido a.a.</div><div class="v">${fP(s.aaLiq)}</div></div>
    <div class="hide-sm"><div class="k">Valor final</div><div class="v">${f$0(s.final.liq)}</div></div>
    <div class="hide-md"><div class="k">Ganho real</div><div class="v ${s.real >= 0 ? 'pos' : 'neg'}">${fP(s.real)}</div></div>
    <div class="hide-md"><div class="k">IR + custos</div><div class="v">${f$0(s.final.ir + s.final.iof)}</div></div>
    <button class="iconbtn" data-editprod="${esc(p.id)}" title="Atualizar taxa com o valor do app">${ICON.edit}</button>
    <div class="badges rk-b">${r.goods.map(g => `<span class="bdg ok">${esc(g)}</span>`).join('')}${r.warns.map(w => `<span class="bdg ${r.ok ? 'warn' : 'bad'}">${esc(w)}</span>`).join('')}${statusBadge(p)}</div>
  </div>`;
}

/* ------------------------------------------------------------------ */
/* views                                                               */
/* ------------------------------------------------------------------ */
const VIEWS = {
  radar: { t: 'Radar', s: 'Panorama do mercado, da sua carteira e das melhores opções do Inter agora.' },
  ranking: { t: 'Ranking Inter', s: 'Os produtos do Banco Inter ordenados pelo que rende mais líquido para o seu objetivo.' },
  carteira: { t: 'Carteira', s: 'Suas aplicações, rendimento estimado, IR e valor líquido hoje.' },
  simulador: { t: 'Simulador', s: 'Compare produtos lado a lado com aportes mensais, IR regressivo e a Selic projetada pelo Focus.' },
  metas: { t: 'Metas', s: 'Quanto falta, quanto aportar por mês e se você chega lá no prazo.' },
  dashboards: { t: 'Dashboards', s: 'Monte seus próprios painéis com os widgets que quiser.' },
  ajustes: { t: 'Ajustes & fontes', s: 'Conta, indicadores, catálogo de taxas, backup e de onde vêm os dados.' },
};

function go(view) {
  if (!VIEWS[view]) view = 'radar';
  S.view = view;
  $$('.view').forEach(v => { if (v.id !== 'view-' + view) { v.hidden = true; destroyCharts(v); } });
  $('#view-' + view).hidden = false;
  $$('#nav button').forEach(b => b.classList.toggle('on', b.dataset.view === view));
  $('#viewTitle').textContent = VIEWS[view].t;
  $('#viewSub').textContent = VIEWS[view].s;
  if (location.hash !== '#' + view) history.replaceState(null, '', '#' + view);
  const el = $('#view-' + view);
  ENTERING = true;
  render();
  ENTERING = false;
  enterAnim(el);
  window.scrollTo({ top: 0 });
}
function render() {
  const el = $('#view-' + S.view);
  destroyCharts(el);
  ({ radar: vRadar, ranking: vRanking, carteira: vCarteira, simulador: vSimulador, metas: vMetas, dashboards: vDashboards, ajustes: vAjustes })[S.view](el);
  paintSideFoot();
  paintTicker();
}
function paintSideFoot() {
  const m = cloud() ? `<b>Nuvem</b> · ${esc(S.user.email || '')}` : '<b>Modo local</b> · dados só neste navegador';
  $('#sideFoot').innerHTML = m;
  const c = $('#modeChip');
  c.className = 'chip ' + (cloud() ? 'cloud' : '');
  c.innerHTML = `<i></i><span>${cloud() ? 'sincronizado' : 'modo local'}</span>`;
}

/* ---------- RADAR ---------- */
function vRadar(el) {
  const I = ind();
  const pf = portfolio();
  const fy = Object.keys(I.focus).map(Number).sort();
  const real = ((1 + I.selic / 100) / (1 + I.ipca12 / 100) - 1) * 100;
  const prof = S.settings.profile;
  const rk = rankProducts(prof).filter(r => r.ok).slice(0, 3);
  const rend = pf.liq - pf.inv;
  el.innerHTML = `
    <div class="grid g6">
      ${tile('Selic meta', fP(I.selic), 'Copom · ' + esc(I.date.selic), '', I.src.selic)}
      ${tile('CDI', fP(I.cdi), 'a.a. · ' + esc(I.date.cdi), '', I.src.cdi)}
      ${tile('IPCA 12m', fP(I.ipca12), 'inflação · ' + esc(I.date.ipca12), '', I.src.ipca12)}
      ${tile('Juro real', fP(real), 'Selic descontada a inflação', 'hl')}
      ${tile('Selic fim ' + (fy[0] || ''), fP(I.focus[fy[0]]), 'Focus · ' + esc(I.date.focus), '', I.src.focus)}
      ${tile('Selic fim ' + (fy[1] || ''), fP(I.focus[fy[1]]), 'Focus · tendência de queda', '', I.src.focus)}
    </div>

    <div class="section-t">Sua carteira</div>
    ${S.positions.length ? `
    <div class="grid g4">
      ${tile('Patrimônio líquido', f$(pf.liq), 'já descontando IR estimado', 'hl')}
      ${tile('Rendimento líquido', `<span class="${rend >= 0 ? 'pos' : 'neg'}">${f$(rend)}</span>`, `sobre ${f$(pf.inv)} aplicados`)}
      ${tile('Taxa média', fP(pf.taxaMedia), 'bruta a.a., ponderada pelo valor')}
      ${tile('Liquidez imediata', fP(pf.liquidezPct, 0), 'do patrimônio pode ser sacado já')}
    </div>
    <div class="grid g3" style="margin-top:16px">
      <div class="card span2"><h3>Evolução e projeção</h3><p class="sub">Histórico estimado + 24 meses projetados com a Selic do Focus</p><div class="chart"><canvas id="cEvo"></canvas></div></div>
      <div class="card"><h3>Alocação</h3><p class="sub">Por produto</p><div class="chart"><canvas id="cAloc"></canvas></div></div>
    </div>` : `
    <div class="card empty"><b>Nenhuma aplicação ainda</b>Registre o que você já tem no Inter para ver patrimônio, rendimento e projeções.<div style="margin-top:14px"><button class="btn pri" data-go="carteira">${ICON.plus} Adicionar aplicação</button></div></div>`}

    <div class="section-t">Melhores agora para você</div>
    <div class="grid g3">
      <div class="card span2">
        <div class="card-h"><div><h3>Top 3 · ${esc(OBJ[prof.objetivo].nome)}</h3><p class="sub">Prazo de ${prof.meses} meses · aporte de ${f$0(prof.aporte)}/mês${prof.valor ? ' · inicial ' + f$0(prof.valor) : ''}</p></div><button class="btn sm" data-go="ranking">Ver ranking completo</button></div>
        ${rk.map(rankRow).join('') || '<p class="muted">Nenhum produto atende esse perfil.</p>'}
      </div>
      <div class="card"><h3>Trajetória da Selic</h3><p class="sub">Atual → expectativas do Boletim Focus</p><div class="chart"><canvas id="cSelic"></canvas></div></div>
    </div>`;
  if (S.positions.length) {
    const tl = portfolioTimeline(24);
    chart($('#cEvo'), lineCfg(tl.labels, [
      { label: 'Histórico (estimado)', data: tl.hist, color: SERIES[0], fill: 'rgba(57,135,229,.10)' },
      { label: 'Projeção', data: tl.proj, color: SERIES[2], borderDash: [5, 4] },
    ]));
    const al = groupAllocation('tipo');
    chart($('#cAloc'), donutCfg(al.map(a => a[0]), al.map(a => a[1])));
  }
  selicChart($('#cSelic'));
}
function selicChart(cv) {
  const labels = [], data = [];
  for (let m = 0; m <= 36; m += 3) { labels.push(addMonths(today(), m).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })); data.push(selicAt(m)); }
  chart(cv, lineCfg(labels, [{ label: 'Selic projetada', data, color: SERIES[0], fill: 'rgba(57,135,229,.10)' }], pctAxis, { callbacks: { label: c => ` Selic: ${fP(c.parsed.y)}` } }));
}

/* ---------- RANKING ---------- */
function vRanking(el) {
  const prof = S.settings.profile;
  el.innerHTML = `
    <div class="card">
      <div class="fg" style="align-items:end">
        <label class="f">Valor inicial (R$)<input class="inp num" type="number" min="0" step="50" id="rkValor" value="${prof.valor}"></label>
        <label class="f">Aporte mensal (R$)<input class="inp num" type="number" min="0" step="50" id="rkAporte" value="${prof.aporte}"></label>
        <label class="f">Prazo: <b class="mono" id="rkMesesL">${prof.meses} meses</b><input type="range" min="1" max="120" id="rkMeses" value="${prof.meses}"></label>
      </div>
      <div class="row" style="margin-top:14px">
        <div class="seg" id="rkObj">${Object.entries(OBJ).map(([k, o]) => `<button type="button" data-obj="${k}" class="${prof.objetivo === k ? 'on' : ''}">${o.nome}</button>`).join('')}</div>
        <span class="hint" id="rkObjD">${OBJ[prof.objetivo].desc}</span>
      </div>
    </div>
    <div id="rkOut" style="margin-top:16px"></div>`;
  const upd = () => {
    const p = S.settings.profile;
    p.valor = num($('#rkValor').value) || 0; p.aporte = num($('#rkAporte').value) || 0; p.meses = Number($('#rkMeses').value);
    $('#rkMesesL').textContent = `${p.meses} meses (${fN(p.meses / 12, 1)} anos)`;
    paintRanking();
    clearTimeout(upd.t); upd.t = setTimeout(() => Store.saveSettings().catch(() => {}), 800);
  };
  ['#rkValor', '#rkAporte', '#rkMeses'].forEach(s => $(s).addEventListener('input', upd));
  $('#rkObj').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    S.settings.profile.objetivo = b.dataset.obj;
    $$('#rkObj button').forEach(x => x.classList.toggle('on', x === b));
    $('#rkObjD').textContent = OBJ[b.dataset.obj].desc;
    upd();
  });
  upd();
}
function paintRanking() {
  const prof = S.settings.profile;
  const rk = rankProducts(prof);
  const best = rk.find(r => r.ok);
  const cmp = rk.find(r => r.p.id === 'poupanca');
  const out = $('#rkOut');
  destroyCharts(out);
  const why = best ? buildWhy(best, rk, cmp, prof) : '';
  out.innerHTML = `
    ${best ? `<div class="card hero">
      <div class="medal">01</div>
      <div><div class="muted" style="font-size:12px;letter-spacing:.1em;text-transform:uppercase">Melhor escolha para ${esc(OBJ[prof.objetivo].nome.toLowerCase())}</div>
        <h2>${esc(best.p.nome)} <span class="muted" style="font-weight:400;font-size:15px">· ${esc(rateLabel(best.p))}</span></h2>
        <div class="why">${why}</div></div>
      <div class="big">${f$0(best.sim.final.liq)}<small>líquido em ${prof.meses} meses · ${fP(best.sim.aaLiq)} a.a.</small></div>
    </div>` : ''}
    <div class="grid g3" style="margin-top:16px">
      <div class="card span2" style="padding:6px 8px">${rk.map(rankRow).join('')}</div>
      <div class="card"><h3>Rentabilidade líquida</h3><p class="sub">% ao ano, após IR e custos</p><div class="chart" style="height:${Math.max(260, rk.length * 34)}px"><canvas id="cRk"></canvas></div></div>
    </div>
    <p class="hint" style="margin-top:12px">Cálculo: lotes mensais com IR regressivo (22,5% → 15%), IOF nos primeiros 30 dias, taxa B3 no Tesouro e CDI seguindo a mediana do Boletim Focus. Produtos com <span class="bdg est">taxa estimada</span> usam faixas típicas — clique no lápis e digite a taxa que aparece no seu app para o ranking ficar exato.</p>`;
  const ok = rk;
  chart($('#cRk'), {
    type: 'bar',
    data: { labels: ok.map(r => r.p.nome), datasets: [{ label: 'Líquido a.a.', data: ok.map(r => +r.sim.aaLiq.toFixed(2)), backgroundColor: ok.map(r => r.ok ? (r === best ? '#c6ff3d' : SERIES[0]) : '#2a3b52'), borderRadius: 4, borderSkipped: 'start', barThickness: 16 }] },
    options: { indexAxis: 'y', scales: { x: { ...pctAxis, beginAtZero: true }, y: { grid: { display: false }, border: { display: false }, ticks: { autoSkip: false, font: { size: 11 } } } }, plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => ` ${fP(c.parsed.x)} a.a. líquido` } } } },
  });
  $$('[data-editprod]', out).forEach(b => b.onclick = () => editProduct(b.dataset.editprod));
}
function buildWhy(best, rk, cmp, prof) {
  const parts = [];
  const second = rk.filter(r => r.ok)[1];
  if (second) parts.push(`Rende ${f$0(best.sim.final.liq - second.sim.final.liq)} a mais que a 2ª opção (${esc(second.p.nome)})`);
  if (cmp && cmp !== best) parts.push(`${f$0(best.sim.final.liq - cmp.sim.final.liq)} a mais que a poupança`);
  parts.push(`ganho real de ${fP(best.sim.real)} a.a. acima da inflação`);
  if (best.p.liqDias <= 1) parts.push('e você pode sacar quando precisar');
  if (prof.objetivo === 'meta' && best.p.id === 'cdb_liq') parts.push('— se tiver a data certa, um CDB com vencimento no mês da meta pode render um pouco mais');
  return parts.join(', ') + '.';
}
function editProduct(id) {
  const p = prodById(id); if (!p) return;
  const unit = { cdi: '% do CDI', selic: 'spread sobre a Selic (% a.a.)', pre: '% a.a.', ipca: 'taxa acima do IPCA (% a.a.)' }[p.idx];
  if (!unit) return toast('Esse produto não tem taxa editável.');
  openModal({
    title: 'Atualizar taxa · ' + p.nome,
    body: `<div class="form">
      <div class="infobox">Abra o app do Inter → <b>Investir</b> → encontre este produto e copie a taxa exibida. Isso deixa o ranking com números reais.</div>
      <div class="fg">
        <label class="f">Taxa (${unit})<input class="inp num" name="taxa" type="number" step="0.01" value="${p.taxa}" required></label>
        ${p.carencia || p.id.startsWith('cdb_') || p.id.startsWith('lci') ? `<label class="f">Carência / prazo (meses)<input class="inp num" name="carencia" type="number" step="1" min="0" value="${p.carencia}"></label>` : ''}
        ${p.venc ? `<label class="f">Vencimento<input class="inp" name="venc" type="date" value="${p.venc}"></label>` : ''}
      </div>
      <p class="hint">${esc(p.nota || '')}</p>
      ${!p.custom ? `<label class="check"><input type="checkbox" name="reset"> Voltar ao valor padrão</label>` : ''}
    </div>`,
    onSubmit: async fd => {
      if (p.custom) {
        S.settings.custom = S.settings.custom.map(c => c.id === id ? { ...c, taxa: num(fd.taxa), carencia: num(fd.carencia) ?? c.carencia, venc: fd.venc || c.venc, status: 'confirmado', confirmedAt: isoD(today()) } : c);
      } else if (fd.reset) delete S.settings.catalog[id];
      else {
        const o = { taxa: num(fd.taxa), status: 'confirmado', confirmedAt: isoD(today()) };
        if (fd.carencia != null && fd.carencia !== '') o.carencia = num(fd.carencia);
        if (fd.venc) o.venc = fd.venc;
        S.settings.catalog[id] = o;
      }
      await safe(() => Store.saveSettings(), 'Taxa atualizada');
      render();
    },
  });
}

/* ---------- CARTEIRA ---------- */
function vCarteira(el) {
  const pf = portfolio();
  el.innerHTML = `
    <div class="row between" style="margin-bottom:16px">
      <div class="row"><button class="btn pri" id="addPos">${ICON.plus} Nova aplicação</button><button class="btn ghost" id="csvPos">${ICON.dl} Exportar CSV</button></div>
      <span class="hint">Valores estimados pela taxa atual. Para exatidão, informe o "valor atual" do extrato do Inter.</span>
    </div>
    ${S.positions.length ? `
    <div class="grid g4">
      ${tile('Aplicado', f$(pf.inv))}
      ${tile('Valor bruto', f$(pf.bruto))}
      ${tile('IR/IOF estimado', f$(pf.ir), 'se resgatasse hoje')}
      ${tile('Líquido hoje', f$(pf.liq), `<span class="${pf.liq >= pf.inv ? 'pos' : 'neg'}">${pf.inv ? fP((pf.liq / pf.inv - 1) * 100) : '—'} no total</span>`, 'hl')}
    </div>
    <div class="card" style="margin-top:16px">
      <div class="tbl-wrap"><table class="tbl">
        <thead><tr><th>Aplicação</th><th>Rentabilidade</th><th>Data</th><th class="r">Aplicado</th><th class="r">Bruto hoje</th><th class="r">IR est.</th><th class="r">Líquido</th><th class="r">%</th><th></th></tr></thead>
        <tbody>${pf.rows.map(r => {
          const pr = prodById(r.p.tipo);
          const pct = r.inv ? (r.liq / r.inv - 1) * 100 : 0;
          return `<tr>
            <td><b>${esc(r.p.nome)}</b><div class="muted" style="font-size:12px">${esc(pr ? pr.nome : 'Outro')}${r.p.vencimento ? ' · vence ' + brD(r.p.vencimento) : ''}${num(r.p.valor_atual_manual) != null ? ' · valor do extrato' : ''}</div></td>
            <td>${esc(rateLabel(r.p))}</td>
            <td class="num">${brD(r.p.data_aplicacao)}</td>
            <td class="r">${f$(r.inv)}</td><td class="r">${f$(r.bruto)}</td><td class="r muted">${f$(r.ir)}</td><td class="r"><b>${f$(r.liq)}</b></td>
            <td class="r ${pct >= 0 ? 'pos' : 'neg'}">${fP(pct)}</td>
            <td style="white-space:nowrap"><button class="iconbtn" data-edit="${r.p.id}" title="Editar">${ICON.edit}</button><button class="iconbtn" data-del="${r.p.id}" title="Excluir">${ICON.del}</button></td>
          </tr>`;
        }).join('')}</tbody>
      </table></div>
    </div>
    <div class="grid g2" style="margin-top:16px">
      <div class="card"><h3>Rendimento líquido por aplicação</h3><p class="sub">Quanto cada uma já rendeu (R$)</p><div class="chart sm"><canvas id="cPosBar"></canvas></div></div>
      <div class="card"><div class="card-h"><div><h3>Alocação</h3><p class="sub">Agrupar por</p></div><div class="seg" id="alocBy"><button class="on" data-by="tipo">Produto</button><button data-by="idx">Indexador</button><button data-by="liquidez">Liquidez</button></div></div><div class="chart sm"><canvas id="cPosAloc"></canvas></div></div>
    </div>` : `<div class="card empty"><b>Sua carteira está vazia</b>Adicione cada aplicação do Inter (CDB, LCI, Tesouro, Porquinho…). Um aporte novo = uma nova linha, pois cada um tem seu próprio prazo de IR.</div>`}`;
  $('#addPos').onclick = () => posForm();
  $('#csvPos').onclick = exportCSV;
  $$('[data-edit]', el).forEach(b => b.onclick = () => posForm(S.positions.find(p => p.id === b.dataset.edit)));
  $$('[data-del]', el).forEach(b => b.onclick = () => confirmBox('Excluir aplicação', 'Essa ação não pode ser desfeita.', async () => { await safe(() => Store.remove('positions', b.dataset.del), 'Aplicação excluída'); render(); }));
  if (S.positions.length) {
    const rows = pf.rows.slice().sort((a, b) => (b.liq - b.inv) - (a.liq - a.inv)).slice(0, 12);
    chart($('#cPosBar'), {
      type: 'bar',
      data: { labels: rows.map(r => r.p.nome), datasets: [{ label: 'Rendimento líquido', data: rows.map(r => +(r.liq - r.inv).toFixed(2)), backgroundColor: SERIES[0], borderRadius: 4, borderSkipped: 'start', maxBarThickness: 36 }] },
      options: { scales: { x: xAxis, y: moneyAxis }, plugins: { legend: { display: false }, tooltip: tipMoney } },
    });
    const draw = by => { const al = groupAllocation(by); chart($('#cPosAloc'), donutCfg(al.map(a => a[0]), al.map(a => a[1]))); };
    draw('tipo');
    $('#alocBy').onclick = e => { const b = e.target.closest('button'); if (!b) return; $$('#alocBy button').forEach(x => x.classList.toggle('on', x === b)); draw(b.dataset.by); };
  }
}
function posForm(pos) {
  const isNew = !pos;
  pos = pos || { nome: '', tipo: 'cdb_liq', idx: 'cdi', taxa: 100, valor: '', data_aplicacao: isoD(today()), vencimento: '', isento_ir: false, valor_atual_manual: '' };
  openModal({
    title: isNew ? 'Nova aplicação' : 'Editar aplicação',
    body: `<div class="form">
      <label class="f">Produto (preenche a taxa automaticamente)<select class="inp" name="tipo" id="pfTipo">${productOptions(pos.tipo)}<optgroup label="Outro"><option value="outro" ${pos.tipo === 'outro' ? 'selected' : ''}>Outro / personalizado</option></optgroup></select></label>
      <label class="f">Nome (como você reconhece)<input class="inp" name="nome" required maxlength="80" value="${esc(pos.nome)}" placeholder="ex.: Reserva intercâmbio"></label>
      <div class="fg">
        <label class="f">Indexador<select class="inp" name="idx" id="pfIdx">${Object.entries(IDX_LABEL).map(([k, v]) => `<option value="${k}" ${pos.idx === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
        <label class="f"><span id="pfTaxaL">Taxa</span><input class="inp num" name="taxa" id="pfTaxa" type="number" step="0.01" value="${pos.taxa}"></label>
      </div>
      <div class="fg">
        <label class="f">Valor aplicado (R$)<input class="inp num" name="valor" type="number" step="0.01" min="0" required value="${pos.valor}"></label>
        <label class="f">Data da aplicação<input class="inp" name="data_aplicacao" type="date" required value="${esc(pos.data_aplicacao)}"></label>
        <label class="f">Vencimento (opcional)<input class="inp" name="vencimento" type="date" value="${esc(pos.vencimento || '')}"></label>
      </div>
      <label class="f">Valor atual do extrato (opcional — sobrepõe a estimativa)<input class="inp num" name="valor_atual_manual" type="number" step="0.01" min="0" value="${pos.valor_atual_manual ?? ''}" placeholder="obrigatório para ações/ETFs"></label>
      <label class="check"><input type="checkbox" name="isento_ir" id="pfIsento" ${pos.isento_ir ? 'checked' : ''}> Isento de IR (LCI, LCA, poupança)</label>
    </div>`,
    onOpen: body => {
      const tipo = $('#pfTipo', body), idx = $('#pfIdx', body);
      const lbl = () => { $('#pfTaxaL', body).textContent = { cdi: 'Taxa (% do CDI)', selic: 'Spread sobre Selic (% a.a.)', pre: 'Taxa (% a.a.)', ipca: 'Taxa acima do IPCA (% a.a.)', poupanca: 'Taxa (não usada)', manual: 'Taxa (não usada)' }[idx.value]; };
      tipo.onchange = () => {
        const p = prodById(tipo.value); if (!p) return;
        idx.value = p.idx; $('#pfTaxa', body).value = p.taxa; $('#pfIsento', body).checked = !!p.isento;
        const nm = $('[name=nome]', body); if (!nm.value) nm.value = p.nome;
        const vc = $('[name=vencimento]', body);
        if (p.venc) vc.value = p.venc;
        else if (p.carencia) vc.value = isoD(addMonths(parseD($('[name=data_aplicacao]', body).value) || today(), p.carencia));
        lbl();
      };
      idx.onchange = lbl; lbl();
    },
    onSubmit: async fd => {
      const row = {
        nome: String(fd.nome || '').trim().slice(0, 80), tipo: fd.tipo, idx: fd.idx, taxa: num(fd.taxa) || 0,
        valor: num(fd.valor), data_aplicacao: fd.data_aplicacao, vencimento: fd.vencimento || null,
        isento_ir: !!fd.isento_ir, valor_atual_manual: num(fd.valor_atual_manual),
      };
      if (!row.nome || row.valor == null || !row.data_aplicacao) { toast('Preencha nome, valor e data.', true); return false; }
      if (row.idx === 'manual' && row.valor_atual_manual == null) toast('Dica: informe o valor atual para acompanhar ações/ETFs.');
      const r = await safe(() => isNew ? Store.insert('positions', row) : Store.update('positions', pos.id, row), isNew ? 'Aplicação adicionada' : 'Aplicação atualizada');
      if (r === null) return false;
      render();
      if (isNew) celebrate($('#modalOk'), '+' + f$0(row.valor));
    },
  });
}
function exportCSV() {
  const pf = portfolio();
  const head = ['nome', 'produto', 'indexador', 'taxa', 'data_aplicacao', 'vencimento', 'aplicado', 'bruto_hoje', 'ir_estimado', 'liquido_hoje'];
  const lines = [head.join(';')].concat(pf.rows.map(r => [r.p.nome, (prodById(r.p.tipo) || {}).nome || r.p.tipo, r.p.idx, r.p.taxa, r.p.data_aplicacao, r.p.vencimento || '', r.inv.toFixed(2), r.bruto.toFixed(2), r.ir.toFixed(2), r.liq.toFixed(2)]
    .map(v => `"${String(v).replace(/"/g, '""')}"`).join(';')));
  download('orbita-carteira.csv', '﻿' + lines.join('\n'), 'text/csv');
}
function download(name, text, type = 'application/json') {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/* ---------- SIMULADOR ---------- */
const simState = { inicial: 0, aporte: 500, meses: 24, ids: ['cdb_liq', 'lci_1a', 'tesouro_selic', 'poupanca'] };
function vSimulador(el) {
  const cat = catalog().filter(p => p.idx !== 'manual');
  el.innerHTML = `
    <div class="card">
      <div class="fg" style="align-items:end">
        <label class="f">Valor inicial (R$)<input class="inp num" type="number" min="0" step="50" id="smIni" value="${simState.inicial}"></label>
        <label class="f">Aporte mensal (R$)<input class="inp num" type="number" min="0" step="50" id="smAp" value="${simState.aporte}"></label>
        <label class="f">Prazo: <b class="mono" id="smML">${simState.meses} meses</b><input type="range" min="1" max="240" id="smM" value="${simState.meses}"></label>
      </div>
      <div style="margin-top:14px"><div class="hint" style="margin-bottom:8px">Compare até 4 produtos</div>
        <div class="row" id="smIds">${cat.map(p => `<label class="check bdg" style="padding:6px 10px"><input type="checkbox" value="${esc(p.id)}" ${simState.ids.includes(p.id) ? 'checked' : ''}> ${esc(p.nome)}</label>`).join('')}</div>
      </div>
    </div>
    <div class="card" style="margin-top:16px"><h3>Valor líquido ao longo do tempo</h3><p class="sub">Se você resgatasse naquele mês (já com IR/IOF)</p><div class="chart"><canvas id="cSim"></canvas></div></div>
    <div class="card" style="margin-top:16px"><div class="tbl-wrap" id="smTbl"></div></div>`;
  const upd = () => {
    simState.inicial = num($('#smIni').value) || 0; simState.aporte = num($('#smAp').value) || 0; simState.meses = Number($('#smM').value);
    $('#smML').textContent = `${simState.meses} meses (${fN(simState.meses / 12, 1)} anos)`;
    const ids = $$('#smIds input:checked').map(i => i.value);
    if (ids.length > 4) { const last = ids.pop(); $$('#smIds input').find(i => i.value === last).checked = false; toast('Máximo de 4 produtos por vez'); }
    simState.ids = ids;
    const ps = ids.map(prodById).filter(Boolean);
    const sims = ps.map(p => ({ p, s: simulate(p, simState) }));
    const labels = sims[0] ? sims[0].s.series.map(x => x.m % 12 === 0 ? `${x.m / 12}a` : `m${x.m}`) : [];
    const ordered = catalog().map(p => p.id);
    chart($('#cSim'), lineCfg(labels, [
      ...sims.map(x => ({ label: x.p.nome, data: x.s.series.map(r => +r.liq.toFixed(2)), color: SERIES[ordered.indexOf(x.p.id) % SERIES.length] })),
      ...(sims[0] ? [{ label: 'Total aportado', data: sims[0].s.series.map(r => r.investido), color: '#6f7e93', borderDash: [3, 4], borderWidth: 1.5 }] : []),
    ]));
    const best = sims.slice().sort((a, b) => b.s.final.liq - a.s.final.liq)[0];
    $('#smTbl').innerHTML = sims.length ? `<table class="tbl"><thead><tr><th>Produto</th><th class="r">Aportado</th><th class="r">Bruto</th><th class="r">IR + IOF + taxas</th><th class="r">Líquido</th><th class="r">Líquido a.a.</th><th class="r">Ganho real a.a.</th></tr></thead><tbody>
      ${sims.map(x => `<tr><td><span class="dot" style="background:${SERIES[ordered.indexOf(x.p.id) % SERIES.length]}"></span> <b>${esc(x.p.nome)}</b> ${x === best ? '<span class="bdg ok">maior valor</span>' : ''}<div class="muted" style="font-size:12px">${esc(rateLabel(x.p))}</div></td>
        <td class="r">${f$(x.s.investido)}</td><td class="r">${f$(x.s.final.bruto)}</td><td class="r muted">${f$(x.s.final.ir + x.s.final.iof)}</td><td class="r"><b>${f$(x.s.final.liq)}</b></td><td class="r">${fP(x.s.aaLiq)}</td><td class="r ${x.s.real >= 0 ? 'pos' : 'neg'}">${fP(x.s.real)}</td></tr>`).join('')}
      </tbody></table>` : '<p class="muted">Selecione ao menos um produto.</p>';
  };
  ['#smIni', '#smAp', '#smM'].forEach(s => $(s).addEventListener('input', upd));
  $('#smIds').addEventListener('change', upd);
  upd();
}

/* ---------- METAS ---------- */
function vMetas(el) {
  el.innerHTML = `
    <div class="row" style="margin-bottom:16px"><button class="btn pri" id="addGoal">${ICON.plus} Nova meta</button></div>
    ${S.goals.length ? `<div class="grid g2">${S.goals.map(g => {
      const c = goalCalc(g);
      const ok = c.gap <= 0;
      return `<div class="card">
        <div class="card-h"><div><h3>${esc(g.nome)}</h3><p class="sub">${f$0(g.valor_alvo)} até ${brD(g.data_alvo)} · ${c.meses} meses · via ${esc(c.p.nome)}</p></div>
          <div><button class="iconbtn" data-gedit="${g.id}">${ICON.edit}</button><button class="iconbtn" data-gdel="${g.id}">${ICON.del}</button></div></div>
        <div class="bar" title="Hoje: ${fP(c.pctHoje, 0)} · projetado: ${fP(c.pctProj, 0)}"><span style="width:${clamp(c.pctProj, 0, 100)}%;opacity:.35"></span><span style="width:${clamp(c.pctHoje, 0, 100)}%"></span></div>
        <div class="row between" style="margin-top:6px;font-size:12px"><span class="muted">Hoje ${fP(c.pctHoje, 0)}</span><span class="muted">Projetado ${fP(c.pctProj, 0)}</span></div>
        <div class="grid g3" style="margin-top:14px;gap:10px">
          <div><div class="hint">Projeção líquida</div><div class="mono" style="font-size:17px">${f$0(c.proj)}</div></div>
          <div><div class="hint">${ok ? 'Sobra' : 'Falta'}</div><div class="mono ${ok ? 'pos' : 'neg'}" style="font-size:17px">${f$0(Math.abs(c.gap))}</div></div>
          <div><div class="hint">Aporte necessário</div><div class="mono" style="font-size:17px">${f$0(c.need)}<span class="muted" style="font-size:12px">/mês</span></div></div>
        </div>
        <div class="${ok ? 'infobox' : 'warnbox'}" style="margin-top:14px">${ok
          ? `No ritmo atual (${f$0(g.aporte_mensal)}/mês) você chega lá${c.gap < 0 ? ` com ${f$0(-c.gap)} de folga` : ''}.`
          : `Com ${f$0(g.aporte_mensal)}/mês você chega a ${fP(c.pctProj, 0)} da meta. Para bater no prazo, aporte ${f$0(c.need)}/mês — ou estenda o prazo, reduza o alvo ou busque bolsa/renda extra.`}</div>
        <div class="chart xs" style="margin-top:14px"><canvas data-gchart="${g.id}"></canvas></div>
      </div>`;
    }).join('')}</div>` : `<div class="card empty"><b>Nenhuma meta criada</b>Ex.: "Intercâmbio" · R$ 25.000 · data da viagem · aporte de R$ 500/mês. A Órbita calcula se você chega lá e quanto precisa guardar.</div>`}`;
  $('#addGoal').onclick = () => goalForm();
  $$('[data-gedit]', el).forEach(b => b.onclick = () => goalForm(S.goals.find(g => g.id === b.dataset.gedit)));
  $$('[data-gdel]', el).forEach(b => b.onclick = () => confirmBox('Excluir meta', 'Essa ação não pode ser desfeita.', async () => { await safe(() => Store.remove('goals', b.dataset.gdel), 'Meta excluída'); render(); }));
  $$('[data-gchart]', el).forEach(cv => {
    const g = S.goals.find(x => x.id === cv.dataset.gchart); const c = goalCalc(g);
    const lab = c.sim.series.map(x => addMonths(today(), x.m).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }));
    chart(cv, lineCfg(lab, [
      { label: 'Projeção líquida', data: c.sim.series.map(x => +x.liq.toFixed(2)), color: SERIES[0], fill: 'rgba(57,135,229,.10)' },
      { label: 'Meta', data: c.sim.series.map(() => Number(g.valor_alvo)), color: '#c6ff3d', borderDash: [4, 4], borderWidth: 1.5 },
    ]));
  });
}
function goalForm(g) {
  const isNew = !g;
  g = g || { nome: '', valor_alvo: '', data_alvo: isoD(addMonths(today(), 24)), aporte_mensal: 500, produto: 'cdb_liq', usa_carteira: false };
  openModal({
    title: isNew ? 'Nova meta' : 'Editar meta',
    body: `<div class="form">
      <label class="f">Nome<input class="inp" name="nome" required maxlength="60" value="${esc(g.nome)}" placeholder="ex.: Intercâmbio"></label>
      <div class="fg">
        <label class="f">Valor alvo (R$)<input class="inp num" name="valor_alvo" type="number" min="1" step="100" required value="${g.valor_alvo}"></label>
        <label class="f">Data alvo<input class="inp" name="data_alvo" type="date" required value="${esc(g.data_alvo)}"></label>
        <label class="f">Aporte mensal (R$)<input class="inp num" name="aporte_mensal" type="number" min="0" step="50" value="${g.aporte_mensal}"></label>
      </div>
      <label class="f">Onde o dinheiro vai render<select class="inp" name="produto">${productOptions(g.produto, false)}</select></label>
      <label class="check"><input type="checkbox" name="usa_carteira" ${g.usa_carteira ? 'checked' : ''}> Contar o patrimônio atual da carteira como ponto de partida</label>
    </div>`,
    onSubmit: async fd => {
      const row = { nome: String(fd.nome || '').trim().slice(0, 60), valor_alvo: num(fd.valor_alvo), data_alvo: fd.data_alvo, aporte_mensal: num(fd.aporte_mensal) || 0, produto: fd.produto, usa_carteira: !!fd.usa_carteira };
      if (!row.nome || !row.valor_alvo || !row.data_alvo) { toast('Preencha nome, valor e data.', true); return false; }
      const r = await safe(() => isNew ? Store.insert('goals', row) : Store.update('goals', g.id, row), isNew ? 'Meta criada' : 'Meta atualizada');
      if (r === null) return false;
      render();
      const c = goalCalc({ ...g, ...row });
      celebrate($('#modalOk'), c.gap <= 0 ? 'Meta no caminho ✓' : 'Meta criada');
    },
  });
}

/* ---------- DASHBOARDS ---------- */
const WTYPES = {
  kpi: { nome: 'Número-chave', desc: 'Patrimônio, rendimento, taxa média…', size: 1 },
  evolucao: { nome: 'Evolução + projeção', desc: 'Linha do patrimônio com projeção', size: 2 },
  alocacao: { nome: 'Alocação', desc: 'Rosca por produto, indexador ou liquidez', size: 1 },
  barras: { nome: 'Rendimento por aplicação', desc: 'Barras com o ganho de cada aplicação', size: 2 },
  ranking: { nome: 'Ranking Inter', desc: 'Top produtos para um prazo/objetivo', size: 2 },
  meta: { nome: 'Progresso de meta', desc: 'Barra + números de uma meta', size: 1 },
  selic: { nome: 'Trajetória da Selic', desc: 'Selic atual + Focus', size: 1 },
  simulacao: { nome: 'Simulação rápida', desc: 'Um produto, aporte e prazo fixos', size: 2 },
  indicadores: { nome: 'Indicadores', desc: 'Selic, CDI, IPCA e juro real', size: 2 },
};
const KPI = {
  patrimonio: ['Patrimônio líquido', pf => f$(pf.liq)],
  bruto: ['Patrimônio bruto', pf => f$(pf.bruto)],
  aplicado: ['Total aplicado', pf => f$(pf.inv)],
  rendimento: ['Rendimento líquido', pf => f$(pf.liq - pf.inv)],
  rentab: ['Rentabilidade total', pf => pf.inv ? fP((pf.liq / pf.inv - 1) * 100) : '—'],
  taxa: ['Taxa média bruta', pf => fP(pf.taxaMedia)],
  liquidez: ['Liquidez imediata', pf => fP(pf.liquidezPct, 0)],
  ir: ['IR estimado', pf => f$(pf.ir)],
  qtd: ['Nº de aplicações', pf => String(pf.rows.length)],
};
function defaultWidgets() {
  return [
    { id: uid(), type: 'kpi', size: 1, opts: { metric: 'patrimonio' } },
    { id: uid(), type: 'kpi', size: 1, opts: { metric: 'rendimento' } },
    { id: uid(), type: 'kpi', size: 1, opts: { metric: 'taxa' } },
    { id: uid(), type: 'kpi', size: 1, opts: { metric: 'liquidez' } },
    { id: uid(), type: 'evolucao', size: 2, opts: { meses: 24 } },
    { id: uid(), type: 'alocacao', size: 1, opts: { by: 'tipo' } },
    { id: uid(), type: 'selic', size: 1, opts: {} },
    { id: uid(), type: 'ranking', size: 2, opts: { meses: 24, objetivo: 'meta', n: 4 } },
    { id: uid(), type: 'simulacao', size: 2, opts: { produto: 'cdb_liq', aporte: 500, meses: 24 } },
  ];
}
async function ensureDash() {
  if (!S.dashboards.length) {
    await safe(() => Store.insert('dashboards', { nome: 'Meu painel', widgets: defaultWidgets() }));
  }
  if (!S.dashboards.find(d => d.id === S.settings.activeDash)) S.settings.activeDash = S.dashboards[0] && S.dashboards[0].id;
}
function vDashboards(el) {
  if (!S.dashboards.length || !S.dashboards.find(d => d.id === S.settings.activeDash)) {
    el.innerHTML = '<p class="muted"><span class="loading"></span> preparando painel…</p>';
    ensureDash().then(() => { if (S.view === 'dashboards' && S.dashboards.length) render(); });
    return;
  }
  const d = S.dashboards.find(x => x.id === S.settings.activeDash);
  el.innerHTML = `
    <div class="row between" style="margin-bottom:16px">
      <div class="row">
        <select class="inp" id="dSel" style="width:auto;min-width:200px">${S.dashboards.map(x => `<option value="${x.id}" ${x.id === d.id ? 'selected' : ''}>${esc(x.nome)}</option>`).join('')}</select>
        <button class="btn sm ghost" id="dNew">${ICON.plus} Novo</button>
        <button class="btn sm ghost" id="dRen">${ICON.edit} Renomear</button>
        <button class="btn sm danger" id="dDel">${ICON.del}</button>
      </div>
      <button class="btn pri" id="dAdd">${ICON.plus} Adicionar widget</button>
    </div>
    <div class="dash-grid" id="dGrid">
      ${(d.widgets || []).map(w => `<div class="card w s${w.size || 1}" draggable="true" data-w="${w.id}">
        <div class="card-h" style="margin-bottom:6px"><h3 style="font-size:14px">${esc(w.title || widgetTitle(w))}</h3>
          <div class="tools"><button class="iconbtn grip" title="Arraste para reordenar">${ICON.grip}</button><button class="iconbtn" data-wsize="${w.id}" title="Tamanho">${ICON.size}</button><button class="iconbtn" data-wedit="${w.id}" title="Configurar">${ICON.edit}</button><button class="iconbtn" data-wdel="${w.id}" title="Remover">${ICON.del}</button></div></div>
        <div class="wbody" data-wbody="${w.id}"></div>
      </div>`).join('')}
      <button class="addw w" id="dAdd2">${ICON.plus.replace('<svg', '<svg width="28" height="28" style="stroke:currentColor;fill:none;stroke-width:2"')}</button>
    </div>
    <p class="hint" style="margin-top:12px">Arraste os cards para reordenar · ícone de setas alterna o tamanho · tudo é salvo automaticamente${cloud() ? ' na nuvem' : ' neste navegador'}.</p>`;
  (d.widgets || []).forEach(w => renderWidget(w, $(`[data-wbody="${w.id}"]`, el)));
  const saveW = async widgets => { d.widgets = widgets; await safe(() => Store.update('dashboards', d.id, { widgets })); render(); };
  $('#dSel').onchange = e => { S.settings.activeDash = e.target.value; Store.saveSettings().catch(() => {}); render(); };
  $('#dNew').onclick = () => openModal({ title: 'Novo dashboard', body: `<label class="f">Nome<input class="inp" name="nome" required maxlength="40" placeholder="ex.: Intercâmbio"></label><label class="check" style="margin-top:12px"><input type="checkbox" name="vazio"> Começar vazio</label>`, onSubmit: async fd => {
    if (!fd.nome) return false;
    const r = await safe(() => Store.insert('dashboards', { nome: fd.nome.slice(0, 40), widgets: fd.vazio ? [] : defaultWidgets() }), 'Dashboard criado');
    if (r) { S.settings.activeDash = r.id; Store.saveSettings().catch(() => {}); render(); }
  } });
  $('#dRen').onclick = () => openModal({ title: 'Renomear', body: `<label class="f">Nome<input class="inp" name="nome" required maxlength="40" value="${esc(d.nome)}"></label>`, onSubmit: async fd => { if (!fd.nome) return false; await safe(() => Store.update('dashboards', d.id, { nome: fd.nome.slice(0, 40) })); render(); } });
  $('#dDel').onclick = () => confirmBox('Excluir dashboard', `Excluir "${esc(d.nome)}"?`, async () => { await safe(() => Store.remove('dashboards', d.id), 'Dashboard excluído'); S.settings.activeDash = null; render(); });
  $('#dAdd').onclick = $('#dAdd2').onclick = () => widgetForm(d, null, saveW);
  $$('[data-wedit]', el).forEach(b => b.onclick = () => widgetForm(d, d.widgets.find(w => w.id === b.dataset.wedit), saveW));
  $$('[data-wdel]', el).forEach(b => b.onclick = () => saveW(d.widgets.filter(w => w.id !== b.dataset.wdel)));
  $$('[data-wsize]', el).forEach(b => b.onclick = () => saveW(d.widgets.map(w => w.id === b.dataset.wsize ? { ...w, size: ({ 1: 2, 2: 4, 4: 1 })[w.size || 1] } : w)));
  // arrastar e soltar
  let dragId = null;
  $$('.w[data-w]', el).forEach(card => {
    card.addEventListener('dragstart', e => { dragId = card.dataset.w; card.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', dragId); });
    card.addEventListener('dragend', () => { card.classList.remove('dragging'); $$('.w.over', el).forEach(x => x.classList.remove('over')); });
    card.addEventListener('dragover', e => { e.preventDefault(); card.classList.add('over'); });
    card.addEventListener('dragleave', () => card.classList.remove('over'));
    card.addEventListener('drop', e => {
      e.preventDefault(); card.classList.remove('over');
      const to = card.dataset.w; if (!dragId || dragId === to) return;
      const ws = d.widgets.slice(); const from = ws.findIndex(w => w.id === dragId); const [m] = ws.splice(from, 1);
      ws.splice(ws.findIndex(w => w.id === to), 0, m); saveW(ws);
    });
  });
}
function widgetTitle(w) {
  const o = w.opts || {};
  switch (w.type) {
    case 'kpi': return (KPI[o.metric] || KPI.patrimonio)[0];
    case 'alocacao': return 'Alocação por ' + ({ tipo: 'produto', idx: 'indexador', liquidez: 'liquidez' }[o.by] || 'produto');
    case 'ranking': return `Ranking · ${o.meses || 24} meses · ${(OBJ[o.objetivo] || OBJ.meta).nome}`;
    case 'meta': { const g = S.goals.find(x => x.id === o.goal); return g ? 'Meta · ' + g.nome : 'Meta'; }
    case 'simulacao': { const p = prodById(o.produto); return `${p ? p.nome : 'Simulação'} · ${f$0(o.aporte)}/mês · ${o.meses}m`; }
    case 'evolucao': return `Evolução + projeção ${o.meses || 24} meses`;
    default: return WTYPES[w.type] ? WTYPES[w.type].nome : 'Widget';
  }
}
function renderWidget(w, body) {
  const o = w.opts || {};
  const pf = portfolio();
  const needPos = ['kpi', 'evolucao', 'alocacao', 'barras'].includes(w.type) && !S.positions.length;
  if (needPos) { body.innerHTML = `<p class="muted" style="font-size:13px">Sem aplicações ainda. <a href="#carteira">Adicionar</a></p>`; return; }
  switch (w.type) {
    case 'kpi': { const k = KPI[o.metric] || KPI.patrimonio; body.innerHTML = `<div class="mono" style="font-size:26px;font-weight:600;color:var(--acc)">${k[1](pf)}</div>`; break; }
    case 'indicadores': { const I = ind(); const real = ((1 + I.selic / 100) / (1 + I.ipca12 / 100) - 1) * 100; body.innerHTML = `<div class="grid g4" style="gap:10px">${[['Selic', I.selic, I.src.selic], ['CDI', I.cdi, I.src.cdi], ['IPCA 12m', I.ipca12, I.src.ipca12], ['Juro real', real, '']].map(([l, v, s]) => `<div><div class="hint">${l} ${s ? srcDot(s) : ''}</div><div class="mono" style="font-size:19px">${fP(v)}</div></div>`).join('')}</div>`; break; }
    case 'evolucao': { body.innerHTML = '<div class="chart sm"><canvas></canvas></div>'; const tl = portfolioTimeline(o.meses || 24); chart($('canvas', body), lineCfg(tl.labels, [{ label: 'Histórico', data: tl.hist, color: SERIES[0], fill: 'rgba(57,135,229,.10)' }, { label: 'Projeção', data: tl.proj, color: SERIES[2], borderDash: [5, 4] }])); break; }
    case 'alocacao': { body.innerHTML = '<div class="chart sm"><canvas></canvas></div>'; const al = groupAllocation(o.by || 'tipo'); chart($('canvas', body), donutCfg(al.map(a => a[0]), al.map(a => a[1]))); break; }
    case 'barras': { body.innerHTML = '<div class="chart sm"><canvas></canvas></div>'; const rows = pf.rows.slice().sort((a, b) => (b.liq - b.inv) - (a.liq - a.inv)).slice(0, 10); chart($('canvas', body), { type: 'bar', data: { labels: rows.map(r => r.p.nome), datasets: [{ label: 'Rendimento líquido', data: rows.map(r => +(r.liq - r.inv).toFixed(2)), backgroundColor: SERIES[0], borderRadius: 4, borderSkipped: 'start', maxBarThickness: 32 }] }, options: { scales: { x: xAxis, y: moneyAxis }, plugins: { legend: { display: false }, tooltip: tipMoney } } }); break; }
    case 'selic': { body.innerHTML = '<div class="chart sm"><canvas></canvas></div>'; selicChart($('canvas', body)); break; }
    case 'ranking': { const rk = rankProducts({ valor: o.valor || 0, aporte: o.aporte ?? S.settings.profile.aporte, meses: o.meses || 24, objetivo: o.objetivo || 'meta' }).filter(r => r.ok).slice(0, o.n || 4); body.innerHTML = rk.map((r, i) => `<div class="row between" style="padding:9px 0;border-bottom:1px solid var(--line)"><div class="row" style="gap:12px"><span class="mono ${i ? 'muted' : ''}" style="${i ? '' : 'color:var(--acc)'}">${String(i + 1).padStart(2, '0')}</span><div><b style="font-size:14px">${esc(r.p.nome)}</b><div class="muted" style="font-size:12px">${esc(rateLabel(r.p))} · ${esc(r.p.liqTxt)}</div></div></div><div class="mono" style="text-align:right">${fP(r.sim.aaLiq)}<div class="muted" style="font-size:11px">líq. a.a.</div></div></div>`).join(''); break; }
    case 'meta': {
      const g = S.goals.find(x => x.id === o.goal) || S.goals[0];
      if (!g) { body.innerHTML = '<p class="muted" style="font-size:13px">Crie uma meta primeiro. <a href="#metas">Ir para metas</a></p>'; break; }
      const c = goalCalc(g);
      body.innerHTML = `<div class="mono" style="font-size:24px;font-weight:600;color:var(--acc)">${fP(c.pctProj, 0)}</div><div class="hint" style="margin-bottom:10px">projetado de ${f$0(g.valor_alvo)} até ${brD(g.data_alvo)}</div><div class="bar"><span style="width:${clamp(c.pctProj, 0, 100)}%;opacity:.35"></span><span style="width:${clamp(c.pctHoje, 0, 100)}%"></span></div><div class="hint" style="margin-top:10px">${c.gap > 0 ? `Falta ${f$0(c.gap)} · precisa de ${f$0(c.need)}/mês` : 'No caminho certo ✓'}</div>`;
      break;
    }
    case 'simulacao': {
      const p = prodById(o.produto) || prodById('cdb_liq');
      const s = simulate(p, { inicial: o.inicial || 0, aporte: o.aporte || 0, meses: o.meses || 24 });
      body.innerHTML = `<div class="row" style="gap:22px;margin-bottom:8px"><div><div class="hint">Líquido final</div><div class="mono" style="font-size:20px;color:var(--acc)">${f$0(s.final.liq)}</div></div><div><div class="hint">Aportado</div><div class="mono" style="font-size:20px">${f$0(s.investido)}</div></div><div><div class="hint">Líquido a.a.</div><div class="mono" style="font-size:20px">${fP(s.aaLiq)}</div></div></div><div class="chart xs"><canvas></canvas></div>`;
      chart($('canvas', body), lineCfg(s.series.map(x => `m${x.m}`), [{ label: 'Líquido', data: s.series.map(x => +x.liq.toFixed(2)), color: SERIES[0], fill: 'rgba(57,135,229,.10)' }, { label: 'Aportado', data: s.series.map(x => x.investido), color: '#6f7e93', borderDash: [3, 4], borderWidth: 1.5 }]));
      break;
    }
  }
}
function widgetForm(d, w, saveW) {
  const isNew = !w;
  w = w || { type: 'kpi', size: 1, opts: {} };
  const o = w.opts || {};
  const goalsOpt = S.goals.map(g => `<option value="${g.id}" ${o.goal === g.id ? 'selected' : ''}>${esc(g.nome)}</option>`).join('');
  openModal({
    title: isNew ? 'Adicionar widget' : 'Configurar widget',
    body: `<div class="form">
      <div class="wtypes">${Object.entries(WTYPES).map(([k, t]) => `<label><input type="radio" name="type" value="${k}" ${w.type === k ? 'checked' : ''}><b>${t.nome}</b><span class="muted">${t.desc}</span></label>`).join('')}</div>
      <div class="fg" id="wOpts"></div>
      <label class="f">Título (opcional)<input class="inp" name="title" maxlength="60" value="${esc(w.title || '')}" placeholder="automático"></label>
    </div>`,
    onOpen: body => {
      const paint = () => {
        const t = $('input[name=type]:checked', body).value;
        const F = {
          kpi: `<label class="f">Métrica<select class="inp" name="metric">${Object.entries(KPI).map(([k, v]) => `<option value="${k}" ${o.metric === k ? 'selected' : ''}>${v[0]}</option>`).join('')}</select></label>`,
          alocacao: `<label class="f">Agrupar por<select class="inp" name="by">${[['tipo', 'Produto'], ['idx', 'Indexador'], ['liquidez', 'Liquidez']].map(([k, v]) => `<option value="${k}" ${o.by === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>`,
          evolucao: `<label class="f">Meses de projeção<input class="inp num" name="meses" type="number" min="1" max="120" value="${o.meses || 24}"></label>`,
          ranking: `<label class="f">Prazo (meses)<input class="inp num" name="meses" type="number" min="1" max="240" value="${o.meses || 24}"></label><label class="f">Objetivo<select class="inp" name="objetivo">${Object.entries(OBJ).map(([k, v]) => `<option value="${k}" ${o.objetivo === k ? 'selected' : ''}>${v.nome}</option>`).join('')}</select></label><label class="f">Quantos mostrar<input class="inp num" name="n" type="number" min="1" max="9" value="${o.n || 4}"></label>`,
          meta: S.goals.length ? `<label class="f">Meta<select class="inp" name="goal">${goalsOpt}</select></label>` : '<p class="hint">Crie uma meta na aba Metas primeiro.</p>',
          simulacao: `<label class="f">Produto<select class="inp" name="produto">${productOptions(o.produto || 'cdb_liq', false)}</select></label><label class="f">Inicial (R$)<input class="inp num" name="inicial" type="number" min="0" value="${o.inicial || 0}"></label><label class="f">Aporte (R$/mês)<input class="inp num" name="aporte" type="number" min="0" value="${o.aporte ?? 500}"></label><label class="f">Meses<input class="inp num" name="meses" type="number" min="1" max="240" value="${o.meses || 24}"></label>`,
        };
        $('#wOpts', body).innerHTML = F[t] || '<p class="hint">Sem opções.</p>';
      };
      body.addEventListener('change', e => { if (e.target.name === 'type') paint(); });
      paint();
    },
    onSubmit: async fd => {
      const t = fd.type;
      const opts = {};
      ['metric', 'by', 'objetivo', 'goal', 'produto'].forEach(k => { if (fd[k] != null) opts[k] = fd[k]; });
      ['meses', 'n', 'inicial', 'aporte'].forEach(k => { if (fd[k] != null && fd[k] !== '') opts[k] = num(fd[k]); });
      const nw = { id: w.id || uid(), type: t, size: isNew ? WTYPES[t].size : (w.type === t ? w.size : WTYPES[t].size), opts, title: (fd.title || '').trim() || undefined };
      const ws = isNew ? [...(d.widgets || []), nw] : d.widgets.map(x => x.id === w.id ? nw : x);
      await saveW(ws);
    },
  });
}

/* ---------- AJUSTES ---------- */
function vAjustes(el) {
  const I = ind();
  const o = S.settings.indOverride || {};
  const hasLocal = !!(lsGet(LKEY, {}).positions || []).length;
  el.innerHTML = `
    <div class="grid g2">
      <div class="card">
        <h3>Conta e armazenamento</h3>
        ${cloud() ? `<p class="sub">Conectado ao Supabase como <b>${esc(S.user.email)}</b>. Seus dados sincronizam entre dispositivos.</p>
          <div class="row"><button class="btn" id="aLogout">Sair</button>${hasLocal ? '<button class="btn" id="aMigrate">Enviar dados locais para a nuvem</button>' : ''}</div>`
        : CLOUD_CONFIGURED ? `<p class="sub">Você está no modo local, mas o Supabase está configurado.</p><button class="btn pri" id="aLogin">Entrar / criar conta</button>`
        : `<p class="sub">Modo local: os dados ficam só neste navegador. Para sincronizar entre celular e computador, configure o Supabase no arquivo <code>config.js</code> (veja o README).</p>`}
      </div>
      <div class="card">
        <h3>Backup</h3>
        <p class="sub">Exporte tudo (carteira, metas, dashboards e ajustes) em JSON e importe quando quiser.</p>
        <div class="row"><button class="btn" id="aExp">${ICON.dl} Exportar JSON</button><label class="btn">${ICON.ul} Importar JSON<input type="file" accept="application/json" id="aImp" hidden></label><button class="btn ghost" id="aCsv">${ICON.dl} CSV da carteira</button></div>
      </div>
    </div>

    <div class="section-t">Indicadores</div>
    <div class="card">
      <div class="card-h"><div><h3>De onde vêm os números</h3><p class="sub">${srcDot('live')} ao vivo (Banco Central) · ${srcDot('ref')} referência (24/09/2026) · ${srcDot('manual')} ajuste seu. Deixe em branco para usar o automático.</p></div><button class="btn sm" id="aLive">Consultar Banco Central</button></div>
      <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Indicador</th><th class="r">Em uso</th><th>Fonte</th><th>Data</th><th>Ajuste manual</th></tr></thead><tbody>
        ${Object.entries(IND_META).map(([k, m]) => `<tr><td>${m.nome}</td><td class="r">${fP(I[k])}</td><td>${srcDot(I.src[k])} ${esc(m.fonte)}</td><td class="num">${esc(I.date[k])}</td><td><input class="inp num" style="max-width:130px" data-ov="${k}" type="number" step="0.01" value="${o[k] ?? ''}" placeholder="${fN(I[k])}"></td></tr>`).join('')}
        <tr><td>Focus · Selic fim de ano</td><td class="r">${Object.entries(I.focus).map(([y, v]) => `${y}: ${fP(v)}`).join('<br>')}</td><td>${srcDot(I.src.focus)} Boletim Focus (BCB/Olinda)</td><td class="num">${esc(I.date.focus)}</td><td class="hint">usado para projetar o CDI</td></tr>
      </tbody></table></div>
      <div class="row" style="margin-top:12px"><button class="btn pri sm" id="aOvSave">Salvar ajustes</button><button class="btn ghost sm" id="aOvClear">Limpar ajustes</button></div>
    </div>

    <div class="section-t">Catálogo Banco Inter</div>
    <div class="card">
      <div class="card-h"><div><h3>Produtos e taxas</h3><p class="sub">As taxas dos bancos mudam toda semana e o Inter não tem API pública. Por isso: confira no app e clique no lápis — o ranking passa a usar a sua taxa e marca como "confirmado".</p></div><button class="btn sm" id="aAddProd">${ICON.plus} Produto do app</button></div>
      <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Produto</th><th>Taxa</th><th>Liquidez</th><th>IR</th><th>Garantia</th><th>Status</th><th></th></tr></thead><tbody>
        ${catalog().map(p => `<tr><td><b>${esc(p.nome)}</b><div class="muted" style="font-size:12px">${esc(p.cat)}</div></td><td>${esc(rateLabel(p))}</td><td>${esc(p.liqTxt)}</td><td>${p.isento ? 'Isento' : 'Regressivo'}</td><td>${esc(p.garantia)}</td><td>${statusBadge(p)}</td>
          <td style="white-space:nowrap">${p.idx !== 'manual' ? `<button class="iconbtn" data-editprod="${esc(p.id)}">${ICON.edit}</button>` : ''}${p.custom ? `<button class="iconbtn" data-delprod="${esc(p.id)}">${ICON.del}</button>` : ''}</td></tr>`).join('')}
      </tbody></table></div>
    </div>

    <div class="section-t">Fontes</div>
    <div class="card">
      <ul style="margin:0;padding-left:18px;line-height:1.9;font-size:14px">
        <li><a href="https://www3.bcb.gov.br/sgspub/" target="_blank" rel="noopener">Banco Central · SGS</a> — Selic (432), CDI (4389), IPCA 12m (13522), TR (226), consultados ao vivo</li>
        <li><a href="https://www.bcb.gov.br/publicacoes/focus" target="_blank" rel="noopener">Banco Central · Boletim Focus</a> — expectativas de Selic (API Olinda)</li>
        <li><a href="https://www.tesourodireto.com.br/titulos/precos-e-taxas.htm" target="_blank" rel="noopener">Tesouro Direto · preços e taxas</a> — confira as taxas do Prefixado e IPCA+</li>
        <li><a href="https://blog.inter.co/cdb-liquidez-diaria/" target="_blank" rel="noopener">Inter · CDB liquidez diária</a> e o app do Inter (aba Investir) — taxas dos CDBs, LCI/LCA e Porquinho</li>
        <li><a href="https://www.fgc.org.br/" target="_blank" rel="noopener">FGC</a> — garantia de até R$ 250 mil por CPF por instituição</li>
      </ul>
      <p class="hint" style="margin-top:10px">A Órbita é uma ferramenta de apoio à decisão, não recomendação de investimento. Rentabilidade passada ou projetada não garante resultado futuro.</p>
    </div>`;
  // conta
  if ($('#aLogout')) $('#aLogout').onclick = async () => { await sb.auth.signOut(); };
  if ($('#aLogin')) $('#aLogin').onclick = () => showAuth(true);
  if ($('#aMigrate')) $('#aMigrate').onclick = migrateLocal;
  // backup
  $('#aExp').onclick = () => download(`orbita-backup-${isoD(today())}.json`, JSON.stringify({ app: 'orbita', v: 1, exported: new Date().toISOString(), positions: S.positions, goals: S.goals, dashboards: S.dashboards, settings: S.settings }, null, 2));
  $('#aCsv').onclick = exportCSV;
  $('#aImp').onchange = e => importJSON(e.target.files[0]);
  // indicadores
  $('#aLive').onclick = () => loadLive(true);
  $('#aOvSave').onclick = async () => {
    const ov = { ...(S.settings.indOverride || {}) };
    $$('[data-ov]', el).forEach(i => { const v = num(i.value); if (v == null) delete ov[i.dataset.ov]; else ov[i.dataset.ov] = v; });
    S.settings.indOverride = ov; await safe(() => Store.saveSettings(), 'Ajustes salvos'); paintIndChip(); render();
  };
  $('#aOvClear').onclick = async () => { S.settings.indOverride = {}; await safe(() => Store.saveSettings(), 'Ajustes limpos'); paintIndChip(); render(); };
  // catálogo
  $$('[data-editprod]', el).forEach(b => b.onclick = () => editProduct(b.dataset.editprod));
  $$('[data-delprod]', el).forEach(b => b.onclick = () => confirmBox('Remover produto', 'Remover do catálogo?', async () => { S.settings.custom = S.settings.custom.filter(p => p.id !== b.dataset.delprod); await safe(() => Store.saveSettings(), 'Removido'); render(); }));
  $('#aAddProd').onclick = customProductForm;
}
function customProductForm() {
  openModal({
    title: 'Adicionar produto do app do Inter',
    body: `<div class="form">
      <div class="infobox">Viu um CDB/LCI/LCA com taxa melhor no app? Cadastre aqui e ele entra no ranking.</div>
      <label class="f">Nome<input class="inp" name="nome" required maxlength="60" placeholder="ex.: CDB Inter 18 meses"></label>
      <div class="fg">
        <label class="f">Indexador<select class="inp" name="idx"><option value="cdi">% do CDI</option><option value="pre">Prefixado</option><option value="ipca">IPCA+</option></select></label>
        <label class="f">Taxa<input class="inp num" name="taxa" type="number" step="0.01" required placeholder="ex.: 110"></label>
        <label class="f">Carência (meses, 0 = liquidez diária)<input class="inp num" name="carencia" type="number" min="0" step="1" value="0"></label>
        <label class="f">Aplicação mínima (R$)<input class="inp num" name="min" type="number" min="0" value="100"></label>
      </div>
      <label class="check"><input type="checkbox" name="isento"> Isento de IR (LCI/LCA)</label>
    </div>`,
    onSubmit: async fd => {
      const car = Math.max(0, Math.round(num(fd.carencia) || 0));
      const nome = String(fd.nome || '').trim().slice(0, 60);
      if (!nome || num(fd.taxa) == null) { toast('Preencha nome e taxa.', true); return false; }
      const p = { id: 'c_' + uid().slice(0, 8), nome, cat: 'Meus produtos', idx: fd.idx, taxa: num(fd.taxa), liqDias: car ? car * 30 : 0, liqTxt: car ? `Carência ${car} meses` : 'Diária (D+0)', carencia: car, venc: null, isento: !!fd.isento, fgc: true, garantia: 'FGC até R$ 250 mil', risco: 1, min: num(fd.min) || 0, custodia: 0, custIsento: 0, marcacao: false, status: 'confirmado', confirmedAt: isoD(today()), nota: 'Cadastrado por você a partir do app.' };
      S.settings.custom = [...(S.settings.custom || []), p];
      await safe(() => Store.saveSettings(), 'Produto adicionado ao catálogo');
      render();
    },
  });
}
async function importJSON(file) {
  if (!file) return;
  let d;
  try { d = JSON.parse(await file.text()); } catch { return toast('Arquivo inválido', true); }
  if (!d || d.app !== 'orbita') return toast('Esse arquivo não é um backup da Órbita', true);
  confirmBox('Importar backup', `Adicionar ${(d.positions || []).length} aplicações, ${(d.goals || []).length} metas e ${(d.dashboards || []).length} dashboards aos seus dados atuais?`, async () => {
    const strip = r => { const { id, user_id, created_at, ...rest } = r; return rest; };
    for (const r of d.positions || []) await Store.insert('positions', strip(r)).catch(console.error);
    for (const r of d.goals || []) await Store.insert('goals', strip(r)).catch(console.error);
    for (const r of d.dashboards || []) await Store.insert('dashboards', strip(r)).catch(console.error);
    if (d.settings) { mergeSettings({ ...d.settings, activeDash: S.settings.activeDash }); await Store.saveSettings().catch(console.error); }
    toast('Backup importado'); render();
  });
}
async function migrateLocal() {
  const L = lsGet(LKEY, {});
  const strip = r => { const { id, user_id, created_at, ...rest } = r; return rest; };
  let n = 0;
  for (const t of ['positions', 'goals', 'dashboards']) for (const r of L[t] || []) { await Store.insert(t, strip(r)).then(() => n++).catch(console.error); }
  if (L.settings) { mergeSettings({ ...L.settings, activeDash: S.settings.activeDash }); await Store.saveSettings().catch(console.error); }
  lsSet(LKEY + ':migrado', L); try { localStorage.removeItem(LKEY); } catch { }
  toast(`${n} itens enviados para a nuvem`); render();
}

/* ------------------------------------------------------------------ */
/* autenticação                                                        */
/* ------------------------------------------------------------------ */
let authSignup = false;
function showAuth(open) { $('#auth').classList.toggle('open', !!open); }
$('#authToggle').onclick = e => {
  e.preventDefault(); authSignup = !authSignup;
  $('#authTitle').textContent = authSignup ? 'Criar conta' : 'Entrar na Órbita';
  $('#authSubmit').textContent = authSignup ? 'Criar conta' : 'Entrar';
  e.target.textContent = authSignup ? 'Já tenho conta' : 'Criar conta';
  $('#authMsg').textContent = '';
};
$('#authLocal').onclick = async e => { e.preventDefault(); S.localMode = true; showAuth(false); await boot(); };
$('#authForm').addEventListener('submit', async e => {
  e.preventDefault();
  const fd = Object.fromEntries(new FormData(e.target).entries());
  const msg = $('#authMsg'); msg.textContent = 'Aguarde…';
  const fn = authSignup
    ? sb.auth.signUp({ email: fd.email, password: fd.password, options: { emailRedirectTo: location.origin + location.pathname } })
    : sb.auth.signInWithPassword({ email: fd.email, password: fd.password });
  const { data, error } = await fn;
  if (error) { msg.textContent = error.message === 'Invalid login credentials' ? 'E-mail ou senha incorretos.' : error.message; return; }
  if (authSignup && !data.session) { msg.textContent = 'Conta criada! Confirme pelo link enviado ao seu e-mail e depois entre.'; return; }
  msg.textContent = '';
});

/* ------------------------------------------------------------------ */
/* animações                                                           */
/* ------------------------------------------------------------------ */
const REDUCED = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

// entrada em cascata + números que "sobem"
function enterAnim(el) {
  if (REDUCED) return;
  let i = 0;
  $$('.card, .section-t, :scope > .row', el).forEach(c => { if (i < 24) c.style.setProperty('--i', i++); });
  el.classList.remove('enter'); void el.offsetWidth; el.classList.add('enter');
  setTimeout(() => el.classList.remove('enter'), 1800);
  $$('.tile .val, .hero .big, .w .mono', el).forEach(countUp);
}
function countUp(node) {
  // anima o primeiro número em formato pt-BR (ex.: "R$ 5.162,18", "13,75%")
  const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
  let tn; while ((tn = walker.nextNode()) && !/\d/.test(tn.nodeValue));
  if (!tn) return;
  const m = tn.nodeValue.match(/-?\d{1,3}(?:\.\d{3})*(?:,\d+)?|-?\d+(?:,\d+)?/);
  if (!m) return;
  const raw = m[0], dec = (raw.split(',')[1] || '').length;
  const target = Number(raw.replace(/\./g, '').replace(',', '.'));
  if (!Number.isFinite(target) || Math.abs(target) < 0.5 && dec === 0) return;
  const pre = tn.nodeValue.slice(0, m.index), post = tn.nodeValue.slice(m.index + raw.length);
  const fmt = v => v.toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec });
  const t0 = performance.now(), dur = 1100;
  const step = now => {
    const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3);
    tn.nodeValue = pre + fmt(target * e) + post;
    if (k < 1 && tn.isConnected) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

// chuva de moedas ao investir / criar meta
function celebrate(anchor, label) {
  if (REDUCED) return;
  const r = anchor && anchor.getBoundingClientRect ? anchor.getBoundingClientRect() : { left: innerWidth / 2, top: innerHeight / 2, width: 0, height: 0 };
  const x = r.left + r.width / 2, y = r.top + r.height / 2;
  for (let i = 0; i < 14; i++) {
    const c = document.createElement('span');
    c.className = 'coin'; c.textContent = '$';
    const ang = -Math.PI / 2 + (Math.random() - .5) * 2.2, dist = 90 + Math.random() * 140;
    c.style.left = x - 11 + 'px'; c.style.top = y - 11 + 'px';
    c.style.setProperty('--dx', Math.cos(ang) * dist + 'px');
    c.style.setProperty('--dy', Math.sin(ang) * dist + 60 + 'px');
    c.style.animationDelay = i * 25 + 'ms';
    document.body.appendChild(c); setTimeout(() => c.remove(), 1600);
  }
  if (label) {
    const f = document.createElement('span'); f.className = 'float-gain'; f.textContent = label;
    f.style.left = x - 40 + 'px'; f.style.top = y - 40 + 'px';
    document.body.appendChild(f); setTimeout(() => f.remove(), 1700);
  }
}

// letreiro de cotações (estilo home broker)
function paintTicker() {
  const tape = $('#tape'); if (!tape) return;
  const I = ind();
  const f0 = Object.keys(I.focus).map(Number).sort();
  const arrow = (a, b) => a > b + 0.001 ? '<span class="up">▲</span>' : a < b - 0.001 ? '<span class="dn">▼</span>' : '<span class="eq">■</span>';
  const items = [
    ['SELIC', fP(I.selic), I.focus[f0[1]] != null ? arrow(I.focus[f0[1]], I.selic) + ' Focus ' + f0[1] + ' ' + fP(I.focus[f0[1]]) : ''],
    ['CDI', fP(I.cdi), ''],
    ['IPCA 12M', fP(I.ipca12), ''],
    ['JURO REAL', fP(((1 + I.selic / 100) / (1 + I.ipca12 / 100) - 1) * 100), '<span class="up">▲</span>'],
    ['POUPANÇA', fP(rateAt(prodById('poupanca'), 0)), '<span class="eq">a.a.</span>'],
  ];
  const rk = rankProducts({ valor: 1000, aporte: 0, meses: 12, objetivo: 'longo' }).slice(0, 6);
  rk.forEach(r => items.push([r.p.nome.toUpperCase(), fP(r.sim.aaLiq) + ' líq.', `<span class="${r.sim.real > 0 ? 'up' : 'dn'}">${r.sim.real > 0 ? '▲' : '▼'} real ${fP(r.sim.real)}</span>`]));
  if (S.positions.length) { const pf = portfolio(); const g = pf.liq - pf.inv; items.push(['SUA CARTEIRA', f$0(pf.liq), `<span class="${g >= 0 ? 'up' : 'dn'}">${g >= 0 ? '▲' : '▼'} ${f$0(Math.abs(g))}</span>`]); }
  const html = items.map(([k, v, x]) => `<span class="it">${esc(k)} <b>${v}</b> ${x}</span>`).join('');
  if (tape.dataset.h === html) return;
  tape.dataset.h = html;
  tape.innerHTML = html + html; // duplicado p/ loop contínuo
  tape.style.animationDuration = Math.max(35, items.length * 5) + 's';
}

// fundo: gráfico de candles "ao vivo", bem sutil
function marketBg() {
  const cv = $('#market'); if (!cv || REDUCED) return;
  const ctx = cv.getContext('2d');
  let W, H, dpr, candles = [], last = 100, off = 0, prev = 0;
  const CW = 14;
  const resize = () => { dpr = Math.min(2, devicePixelRatio || 1); W = cv.width = innerWidth * dpr; H = cv.height = innerHeight * dpr; cv.style.width = innerWidth + 'px'; cv.style.height = innerHeight + 'px'; };
  const next = () => { const o = last, drift = 0.06, c = o + drift + (Math.random() - .5) * 2.4; const h = Math.max(o, c) + Math.random() * 1.2, l = Math.min(o, c) - Math.random() * 1.2; last = c; return { o, c, h, l }; };
  resize(); addEventListener('resize', resize);
  const need = () => Math.ceil(W / (CW * dpr)) + 3;
  while (candles.length < need()) candles.push(next());
  const draw = t => {
    requestAnimationFrame(draw);
    if (document.hidden || t - prev < 33) return; prev = t;
    off += 0.35 * dpr;
    if (off >= CW * dpr) { off = 0; candles.shift(); candles.push(next()); }
    while (candles.length < need()) candles.push(next());
    const vals = candles.flatMap(c => [c.h, c.l]); const mn = Math.min(...vals), mx = Math.max(...vals);
    const top = H * 0.35, bot = H * 0.92;
    const Y = v => bot - (v - mn) / (mx - mn || 1) * (bot - top);
    ctx.clearRect(0, 0, W, H);
    // área da tendência
    ctx.beginPath();
    candles.forEach((c, i) => { const x = i * CW * dpr - off; i ? ctx.lineTo(x, Y(c.c)) : ctx.moveTo(x, Y(c.c)); });
    ctx.strokeStyle = 'rgba(198,255,61,.22)'; ctx.lineWidth = 1.5 * dpr; ctx.stroke();
    ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath();
    const g = ctx.createLinearGradient(0, top, 0, H); g.addColorStop(0, 'rgba(198,255,61,.06)'); g.addColorStop(1, 'rgba(198,255,61,0)');
    ctx.fillStyle = g; ctx.fill();
    // candles
    candles.forEach((c, i) => {
      const x = i * CW * dpr - off, up = c.c >= c.o;
      ctx.strokeStyle = ctx.fillStyle = up ? 'rgba(60,207,90,.16)' : 'rgba(255,107,107,.13)';
      ctx.lineWidth = 1 * dpr;
      ctx.beginPath(); ctx.moveTo(x, Y(c.h)); ctx.lineTo(x, Y(c.l)); ctx.stroke();
      const y1 = Y(Math.max(c.o, c.c)), y2 = Y(Math.min(c.o, c.c));
      ctx.fillRect(x - 3 * dpr, y1, 6 * dpr, Math.max(1 * dpr, y2 - y1));
    });
  };
  requestAnimationFrame(draw);
}

/* ------------------------------------------------------------------ */
/* inicialização                                                       */
/* ------------------------------------------------------------------ */
async function boot() {
  try { await Store.loadAll(); }
  catch (e) { console.error(e); toast('Não consegui ler o Supabase: ' + (e.message || e) + '. Rodou o schema.sql?', true); }
  if (!S.settings.profile) S.settings.profile = { valor: 0, aporte: 500, meses: 24, objetivo: 'meta' };
  go((location.hash || '#radar').slice(1));
}

$('#nav').addEventListener('click', e => { const b = e.target.closest('button[data-view]'); if (b) go(b.dataset.view); });
document.addEventListener('click', e => { const g = e.target.closest('[data-go]'); if (g) go(g.dataset.go); });
window.addEventListener('hashchange', () => { const v = location.hash.slice(1); if (v !== S.view && VIEWS[v]) go(v); });
$('#btnRefresh').onclick = () => loadLive(true);

(async function init() {
  marketBg();
  if (!window.Chart) toast('Gráficos não carregaram (sem internet?). O resto funciona.', true);
  paintIndChip();
  if (CLOUD_CONFIGURED) {
    sb = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
    const { data } = await sb.auth.getSession();
    S.user = data.session ? data.session.user : null;
    S.localMode = !S.user;
    sb.auth.onAuthStateChange(async (ev, session) => {
      const was = S.user && S.user.id;
      S.user = session ? session.user : null;
      if (ev === 'SIGNED_IN' && was !== (S.user && S.user.id)) { S.localMode = false; showAuth(false); await boot(); }
      if (ev === 'SIGNED_OUT') { S.localMode = false; S.positions = []; S.goals = []; S.dashboards = []; showAuth(true); }
    });
    if (!S.user) showAuth(true); else await boot();
  } else {
    await boot();
  }
  loadLive(false);
})();
