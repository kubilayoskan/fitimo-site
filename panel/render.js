// Fitimo admin panel — drawing only. No network, no secrets. Every value from the server is written with textContent
// (event names and props can be sent by anyone holding the app's public key, so nothing here is ever parsed as HTML).
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = String(text).slice(0, 200); return e; };
  const nf = new Intl.NumberFormat('tr-TR');
  const pct = (a, b) => (b ? '%' + nf.format(Math.round((a / b) * 100)) : '–');
  const mb = (bytes) => (bytes >= 1048576 ? nf.format(Math.round(bytes / 104857.6) / 10) + ' MB' : nf.format(Math.round(bytes / 1024)) + ' kB');
  const when = (iso) => { const d = new Date(iso); return isNaN(d) ? '–' : d.toLocaleString('tr-TR'); };
  const EV = {
    app_opened: 'Uygulama açıldı', onboarding_started: 'Tanışma başladı', onboarding_step_viewed: 'Tanışma adımı görüldü', onboarding_step_answered: 'Tanışma adımı cevaplandı',
    onboarding_abandoned: 'Tanışma yarıda kaldı', onboarding_completed: 'Tanışma tamamlandı', plan_generated: 'Plan oluşturuldu', plan_result_viewed: 'Plan sonucu görüldü',
    consent_changed: 'Onay değişti', checkin_completed: 'Haftalık kontrol yapıldı', apple_health_prompt_viewed: 'Apple Sağlık teklifi görüldü', health_connected: 'Sağlık bağlandı',
    paywall_viewed: 'Abonelik ekranı görüldü', paywall_abandoned: 'Abonelik ekranı seçmeden kapatıldı', paywall_plan_selected: 'Paket seçildi', paywall_free_chosen: 'Ücretsiz devam edildi',
    purchase_started: 'Satın alma başlatıldı', trial_started: 'Deneme başladı', purchase_completed: 'Satın alma tamamlandı', purchase_failed: 'Satın alma başarısız', restore_result: 'Geri yükleme',
    pro_gate_viewed: 'PRO kilidine dokunuldu', meal_gate_shown: 'Reklam sorusu gösterildi', meal_gate_choice: 'Reklam sorusunda seçim', ad_result: 'Reklam sonucu',
    att_result: 'Takip izni cevabı', notif_permission: 'Bildirim izni cevabı', review_requested: 'Puan isteği gösterildi',
    food_logged: 'Öğün kaydedildi', water_logged: 'Su eklendi', weight_logged: 'Kilo girildi', barcode_scan_success: 'Barkod bulundu', barcode_scan_miss: 'Barkod bulunamadı',
    photo_analysis_started: 'Fotoğraf analizi başladı', photo_analysis_completed: 'Fotoğraf analizi bitti', photo_analysis_corrected: 'Fotoğraf sonucu düzeltildi',
    tour_step: 'Tur adımı', tour_skipped: 'Tur atlandı', tour_done: 'Tur bitti',
  };
  const VAL = { true: 'Evet', false: 'Hayır', annual: 'Yıllık', monthly: 'Aylık', weekly: 'Haftalık', free: 'Ücretsiz', earned: 'İzlendi', closed: 'Kapatıldı', unavailable: 'Reklam gelmedi', google: 'Google', apple: 'Apple', email: 'E-posta kodu' };
  const METRICS = { active: 'Aktif kurulum', new: 'Yeni kurulum', events: 'Olay' };
  const RC = { active_trials: 'Süren deneme', active_subscriptions: 'Süren abonelik', mrr: 'Aylık yinelenen gelir', revenue: 'Gelir (son 28 gün)', new_customers: 'Yeni müşteri (son 28 gün)', active_users: 'Aktif kullanıcı (son 28 gün)' };
  const CONNECT = { 'not-connected': 'Bağlı değil: anahtar henüz girilmedi.', 'key-refused': 'Anahtar kabul edilmedi; yenisi gerekiyor.', unreachable: 'Servise şu an ulaşılamadı.', error: 'Servis hata döndürdü.' };
  let metric = 'active';

  function seg(host, opts, cur, on) {
    host.replaceChildren(...Object.entries(opts).map(([k, label]) => { const b = el('button', null, label); b.type = 'button'; b.setAttribute('aria-pressed', String(k === String(cur))); b.onclick = () => on(k); return b; }));
  }
  function kpi(host, label, value, note) { const c = el('div', 'card kpi'); c.append(el('div', 'v', value), el('div', 'l', label)); if (note) c.append(el('div', 'n', note)); host.append(c); }
  function rows(card, items, total, unit) {
    if (!items.length) { card.append(el('div', 'empty', 'Bu dönemde veri yok.')); return; }
    const max = Math.max(...items.map((i) => i.v), 1);
    for (const i of items.slice(0, 14)) {
      const r = el('div', 'row'); const n = el('div', 'name', i.label); n.title = String(i.label).slice(0, 200);
      const b = el('div', 'bar'); const f = el('i'); f.style.width = (i.v / max) * 100 + '%'; b.append(f);
      r.append(n, b, el('div', 'num', (i.text || nf.format(i.v)) + (total ? ' · ' + pct(i.v, total) : '') + (unit ? ' ' + unit : ''))); card.append(r);
    }
  }
  function card(host, title) { const c = el('div', 'card'); c.append(el('h3', null, title)); host.append(c); return c; }
  function table(t, heads, lines, empty) {
    t.replaceChildren(); const hr = el('tr'); for (const h of heads) hr.append(el('th', h.r ? 'r' : null, h.t)); t.append(hr);
    for (const cells of lines) { const tr = el('tr'); cells.forEach((c, i) => { const td = el('td', heads[i].r ? 'r' : null); if (c instanceof Node) td.append(c); else td.textContent = String(c).slice(0, 200); tr.append(td); }); t.append(tr); }
    if (!lines.length) { const tr = el('tr'); const td = el('td', 'empty', empty); td.colSpan = heads.length; tr.append(td); t.append(tr); }
  }

  function render(D, onWin) {
    const W = D.stats, A = D.accounts, S = D.services, days = D.days;
    const inst = Object.fromEntries(W.events.map((e) => [e.name, e.installs]));
    const cnt = Object.fromEntries(W.events.map((e) => [e.name, e.n]));
    const prop = (name, key) => W.props.filter((p) => p.name === name && p.key === key).map((p) => ({ label: VAL[p.value] || p.value, v: p.n })).sort((a, b) => b.v - a.v);
    const sum = (it) => it.reduce((s, i) => s + i.v, 0);
    $('gen').textContent = 'Veri: ' + when(D.generated) + ' · son ' + days + ' gün' + (D.excluded ? ' · ' + nf.format(D.excluded) + ' test kurulumu hariç' : '');
    seg($('win'), { 7: '7 gün', 30: '30 gün', 90: '90 gün' }, days, (k) => onWin(Number(k)));
    seg($('metric'), METRICS, metric, (k) => { metric = k; render(D, onWin); });

    const k = $('kpis'); k.replaceChildren();
    kpi(k, 'Aktif kurulum', nf.format(W.kpi.active), 'bu dönemde en az bir olay gönderen');
    kpi(k, 'Yeni kurulum', nf.format(W.new), 'ilk kez görülen');
    kpi(k, 'Öğün kaydeden', nf.format(W.kpi.loggers), 'aktiflere oranı ' + pct(W.kpi.loggers, W.kpi.active));
    kpi(k, 'Abonelik ekranını gören', nf.format(W.kpi.paywall), 'aktiflere oranı ' + pct(W.kpi.paywall, W.kpi.active));
    kpi(k, 'Deneme / satın alma', nf.format(W.kpi.paid), 'ekranı görenlere oranı ' + pct(W.kpi.paid, W.kpi.paywall));
    kpi(k, 'Toplam olay', nf.format(W.kpi.events), nf.format(W.kpi.opens) + ' açılış');

    drawDaily(W.daily || []);

    const rv = $('revenue'); rv.replaceChildren(); const R = D.revenue || { status: 'not-connected' };
    if (R.status === 'ok') {
      for (const m of R.metrics) kpi(rv, RC[m.id] || m.name, (m.unit === '$' ? '$' : '') + nf.format(Math.round(m.value * 100) / 100), m.unit === '$' ? 'ABD doları, RevenueCat' : 'RevenueCat');
      $('revenueNote').textContent = 'Sayılar RevenueCat\'in kendi özetidir; kişi ya da hesap bilgisi içermez.';
    } else $('revenueNote').textContent = 'Gelir bölümü — ' + (CONNECT[R.status] || CONNECT.error);

    const r = $('ret'); r.replaceChildren();
    for (const x of D.retention) kpi(r, x.n + '. gün', x.base ? pct(x.back, x.base) : '–', x.base ? nf.format(x.back) + ' / ' + nf.format(x.base) + ' kurulum' : 'henüz yeterli veri yok');

    const fu = $('funnels'); fu.replaceChildren();
    const funnel = (title, steps, note) => { const c = card(fu, title); rows(c, steps, steps[0].v, 'kurulum'); if (note) c.append(el('div', 'note', note)); };
    funnel('İlk kullanım', [
      { label: 'Tanışma başladı', v: inst.onboarding_started || 0 }, { label: 'Plan oluşturuldu', v: inst.plan_generated || 0 },
      { label: 'Plan sonucu görüldü', v: inst.plan_result_viewed || 0 }, { label: 'Abonelik ekranı görüldü', v: inst.paywall_viewed || 0 },
      { label: 'Tanışma tamamlandı', v: inst.onboarding_completed || 0 }, { label: 'Öğün kaydedildi', v: inst.food_logged || 0 },
    ], 'Yüzdeler ilk adıma göredir.');
    funnel('Abonelik', [
      { label: 'Abonelik ekranı görüldü', v: inst.paywall_viewed || 0 }, { label: 'Paket seçildi', v: inst.paywall_plan_selected || 0 },
      { label: 'Satın alma başlatıldı', v: inst.purchase_started || 0 }, { label: 'Deneme / satın alma', v: W.kpi.paid || 0 },
    ], 'Ücretsiz devam eden: ' + nf.format(inst.paywall_free_chosen || 0) + ' · seçmeden kapatan: ' + nf.format(inst.paywall_abandoned || 0) + ' · başarısız satın alma: ' + nf.format(inst.purchase_failed || 0) + ' kurulum');
    funnel('Uygulama turu', [{ label: 'Tur başladı', v: inst.tour_step || 0 }, { label: 'Tur bitti', v: inst.tour_done || 0 }, { label: 'Tur atlandı', v: inst.tour_skipped || 0 }]);

    const brk = (host, title, name, key, note) => { const c = card(host, title); const it = prop(name, key); rows(c, it, sum(it)); if (note) c.append(el('div', 'note', note)); };
    const mo = $('money'); mo.replaceChildren();
    brk(mo, 'Hangi PRO kilidine dokunuluyor', 'pro_gate_viewed', 'feature', 'En çok istenen ücretli özellikler.');
    brk(mo, 'Seçilen paket', 'paywall_plan_selected', 'plan');
    brk(mo, 'Abonelik ekranı nereden açıldı', 'paywall_viewed', 'placement');
    brk(mo, 'Deneme hangi paketle başladı', 'trial_started', 'plan');
    brk(mo, 'Satın alma neden başarısız', 'purchase_failed', 'reason');
    brk(mo, 'Öğün reklamı sonucu', 'ad_result', 'result');
    brk(mo, 'Reklam sorusunda seçim', 'meal_gate_choice', 'choice');
    brk(mo, 'Bildirim izni verildi mi', 'notif_permission', 'granted');
    brk(mo, 'Reklam takibi izni verildi mi', 'att_result', 'granted');

    const us = $('usage'); us.replaceChildren();
    brk(us, 'Öğün nasıl ekleniyor', 'food_logged', 'method');
    brk(us, 'Hangi öğün', 'food_logged', 'meal');
    brk(us, 'Tanışma: görülen adımlar', 'onboarding_step_viewed', 'stepId', 'Sayılar yukarıdan aşağı düşüyorsa kayıp o adımdadır.');
    brk(us, 'Tanışma: bırakılan adım', 'onboarding_abandoned', 'lastStepId');
    brk(us, 'Tur: görülen adımlar', 'tour_step', 'step');
    brk(us, 'Tur: atlanan adım', 'tour_skipped', 'step');
    brk(us, 'Kilo nereden girildi', 'weight_logged', 'source');
    { const c = card(us, 'Barkod'); const ok = cnt.barcode_scan_success || 0, miss = cnt.barcode_scan_miss || 0; rows(c, ok + miss ? [{ label: 'Bulundu', v: ok }, { label: 'Bulunamadı', v: miss }] : [], ok + miss); }

    const cr = $('crash'); cr.replaceChildren(); const E = D.sentry || { status: 'not-connected' };
    $('issuesCard').hidden = E.status !== 'ok';
    if (E.status === 'ok') {
      kpi(cr, 'Çökmesiz oturum', E.crashFree == null ? '–' : '%' + nf.format(Math.round(E.crashFree * 1000) / 10), E.sessions ? nf.format(E.sessions) + ' oturum' : 'oturum verisi yok');
      kpi(cr, 'Açık hata türü', nf.format(E.issues.length) + (E.issues.length === 10 ? '+' : ''), 'en sık görülenler aşağıda');
      table($('issues'), [{ t: 'Hata' }, { t: 'Kaç kez', r: 1 }, { t: 'Kullanıcı', r: 1 }, { t: 'Son görülme', r: 1 }],
        E.issues.map((i) => { const d = el('div'); d.append(el('div', null, i.title), el('code', null, i.culprit)); return [d, nf.format(i.count), nf.format(i.users), when(i.lastSeen)]; }), 'Açık hata yok.');
    } else kpi(cr, 'Hata takibi (Sentry)', '–', CONNECT[E.status] || CONNECT.error);

    const sv = $('services'); sv.replaceChildren();
    const cost = D.visionCostPerCallUsd ? '≈ $' + nf.format(Math.round(S.visionCalls * D.visionCostPerCallUsd * 100) / 100) + ' tahmini' : 'birim fiyat girilmedi';
    kpi(sv, 'Yapay zekâ analizi çağrısı', nf.format(S.visionCalls), nf.format(S.visionUsers) + ' hesap · ' + cost);
    kpi(sv, 'Önbellekteki analiz', nf.format(S.visionCache), 'aynı fotoğraf yeniden ücretlenmez');
    kpi(sv, 'Bulunamayan barkod', nf.format(S.barcodeMisses), 'bu dönemde');
    kpi(sv, 'Paylaşılan ürün', nf.format(S.sharedProducts), nf.format(S.reportedProducts) + ' tanesi hatalı diye bildirildi');
    kpi(sv, 'Tarif puanı', nf.format(S.recipeRatings), 'toplam');
    kpi(sv, 'Veritabanı', mb(S.dbBytes), 'ücretsiz sınır 500 MB');
    const sc = $('servicesCards'); sc.replaceChildren();
    { const c = card(sc, 'En büyük tablolar'); rows(c, S.tables.map((t) => ({ label: t.value, v: t.bytes, text: mb(t.bytes) }))); }
    { const c = card(sc, 'Günlük analiz çağrısı'); const it = (S.visionDaily || []).filter((d) => d.n > 0).slice(-14).map((d) => ({ label: new Date(d.day + 'T00:00:00').toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' }), v: d.n })); rows(c, it); }

    const ac = $('accounts'); ac.replaceChildren();
    kpi(ac, 'Kayıtlı hesap', nf.format(A.total), 'toplam');
    kpi(ac, 'Yeni hesap', nf.format(A.new), 'bu dönemde');
    kpi(ac, 'Giriş yapan hesap', nf.format(A.active), 'bu dönemde');
    kpi(ac, 'Silinen hesap', nf.format(A.deleted), 'bu dönemde · toplam ' + nf.format(A.deletedAll));
    const acc = $('accountsCards'); acc.replaceChildren();
    { const c = card(acc, 'Giriş yöntemi'); const it = A.providers.map((p) => ({ label: VAL[p.value] || p.value, v: p.n })); rows(c, it, sum(it), 'hesap'); }
    { const c = card(acc, 'Onaylar'); const it = A.consents.map((p) => ({ label: p.value, v: p.accepted, text: nf.format(p.accepted) + ' açık · ' + nf.format(p.withdrawn) + ' geri çekildi' })); rows(c, it); }
    { const c = card(acc, 'Günlük yeni hesap'); const it = (A.daily || []).filter((d) => d.n > 0).slice(-14).map((d) => ({ label: new Date(d.day + 'T00:00:00').toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' }), v: d.n })); rows(c, it); }

    table($('events'), [{ t: 'Olay' }, { t: 'Kaç kez', r: 1 }, { t: 'Kurulum', r: 1 }, { t: 'Aktiflerin', r: 1 }],
      W.events.map((e) => { const d = el('span'); d.append(document.createTextNode((EV[e.name] || e.name) + ' '), el('code', null, e.name)); return [d, nf.format(e.n), nf.format(e.installs), pct(e.installs, W.kpi.active)]; }), 'Bu dönemde olay yok.');

    const dm = $('dims'); dm.replaceChildren();
    for (const dim of ['Sürüm', 'Dil', 'Platform']) { const c = card(dm, dim); const it = W.dims.filter((x) => x.dim === dim).map((x) => ({ label: x.value, v: x.installs })); rows(c, it, sum(it), 'kurulum'); }

    const ch = $('checks'); ch.replaceChildren();
    const check = (state, label, text) => { const c = el('div', 'chk ' + state); c.append(el('b', null, { ok: '✓ Yolunda', wa: '! Dikkat', ba: '✕ Sorun' }[state]), el('div', null, label + ': ' + text)); ch.append(c); };
    const h = D.health, now = new Date(D.generated);
    if (!h.rows) check('wa', 'Veri akışı', 'tabloda hiç kayıt yok.');
    else {
      const hrs = (now - new Date(h.last)) / 36e5;
      check(hrs < 24 ? 'ok' : hrs < 72 ? 'wa' : 'ba', 'Son kayıt', when(h.last) + ' (' + (hrs < 1 ? 'bir saatten az' : Math.round(hrs) + ' saat') + ' önce)');
      check(h.last24h > 0 ? 'ok' : 'wa', 'Son 24 saat', nf.format(h.last24h) + ' olay');
      const months = (now - new Date(h.oldest)) / (30.44 * 864e5);
      check(months <= 13.5 ? 'ok' : 'ba', 'Saklama süresi (en çok 13 ay)', 'en eski kayıt ' + new Date(h.oldest).toLocaleDateString('tr-TR'));
    }
    const share = S.dbBytes / (500 * 1048576);
    check(share < 0.6 ? 'ok' : share < 0.85 ? 'wa' : 'ba', 'Veritabanı doluluğu', mb(S.dbBytes) + ' / 500 MB');
    check(S.reportedProducts ? 'wa' : 'ok', 'Hatalı diye bildirilen ürün', nf.format(S.reportedProducts));
    check(E.status === 'ok' ? (E.crashFree == null || E.crashFree >= 0.99 ? 'ok' : E.crashFree >= 0.97 ? 'wa' : 'ba') : 'wa', 'Çökme', E.status === 'ok' ? (E.crashFree == null ? 'oturum verisi yok' : 'çökmesiz oturum %' + nf.format(Math.round(E.crashFree * 1000) / 10)) : CONNECT[E.status] || CONNECT.error);
    check(D.refused24h ? 'wa' : 'ok', 'Reddedilen panel girişi (24 saat)', nf.format(D.refused24h || 0));

    table($('audit'), [{ t: 'Zaman' }, { t: 'İşlem' }, { t: 'Sonuç' }],
      (D.audit || []).map((a) => [when(a.at), a.action === 'overview' ? 'Panel açıldı' : a.action === 'whoami' ? 'Giriş denemesi' : a.action === 'feedback-reply' ? 'Mesaj yanıtlandı' : a.action === 'feedback-done' ? 'Mesaj kapatıldı / açıldı' : a.action, a.ok ? 'İzin verildi' : 'Reddedildi' + (a.reason === 'not-admin' ? ' (yetkisiz hesap)' : '')]), 'Kayıt yok.');
    $('foot').textContent = 'Panel, istek ve önerilere verdiğin yanıtlar dışında hiçbir veriyi değiştirmez. Sayılar toplamdır: kişi, kilo, yemek ya da sağlık bilgisi gösterilmez.';
  }

  function drawDaily(daily) {
    const svg = $('daily'), NS = 'http://www.w3.org/2000/svg', tip = $('tip');
    const mk = (tag, attrs, text) => { const e = document.createElementNS(NS, tag); for (const a in attrs) e.setAttribute(a, attrs[a]); if (text != null) e.textContent = text; return e; };
    svg.replaceChildren(); $('dailyTitle').textContent = 'Günlük ' + METRICS[metric].toLowerCase();
    if (!daily.length) return;
    const W = 1000, H = 240, L = 44, R = 8, T = 12, B = 28, pw = W - L - R, ph = H - T - B;
    const rawMax = Math.max(...daily.map((d) => d[metric]), 1);
    const step = Math.max(1, Math.ceil(rawMax / 4)); const max = step * Math.ceil(rawMax / step);
    const css = getComputedStyle(document.documentElement); const line = css.getPropertyValue('--line'), muted = css.getPropertyValue('--muted'), series = css.getPropertyValue('--series');
    for (let v = 0; v <= max; v += step) { const y = T + ph - (v / max) * ph; svg.append(mk('line', { x1: L, x2: W - R, y1: y, y2: y, stroke: line, 'stroke-width': 1 }), mk('text', { x: L - 8, y: y + 4, 'text-anchor': 'end', 'font-size': 12, fill: muted }, nf.format(v))); }
    const slot = pw / daily.length, bw = Math.max(2, Math.min(28, slot - 2)); const every = Math.ceil(daily.length / 8);
    daily.forEach((d, i) => {
      const v = d[metric], h = (v / max) * ph, x = L + i * slot + (slot - bw) / 2, y = T + ph - h, r = Math.min(4, bw / 2, h);
      if (v > 0) svg.append(mk('path', { d: `M${x} ${T + ph}V${y + r}Q${x} ${y} ${x + r} ${y}H${x + bw - r}Q${x + bw} ${y} ${x + bw} ${y + r}V${T + ph}Z`, fill: series }));
      const dt = new Date(d.day + 'T00:00:00');
      if (i % every === 0) svg.append(mk('text', { x: x + bw / 2, y: H - 8, 'text-anchor': 'middle', 'font-size': 12, fill: muted }, dt.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })));
      const hit = mk('rect', { x: L + i * slot, y: T, width: slot, height: ph, fill: 'transparent' });
      hit.addEventListener('mousemove', () => { const b = svg.getBoundingClientRect(); tip.textContent = dt.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' }) + ' · ' + nf.format(v) + ' ' + METRICS[metric].toLowerCase(); tip.style.left = ((x + bw / 2) / W) * b.width + 'px'; tip.style.top = (y / H) * b.height + 'px'; tip.style.display = 'block'; });
      hit.addEventListener('mouseleave', () => { tip.style.display = 'none'; });
      svg.append(hit);
    });
    svg.setAttribute('aria-label', 'Günlük ' + METRICS[metric].toLowerCase() + ', son ' + daily.length + ' gün');
  }

  // ── İstek ve öneriler (D-207) ── every text is written with textContent; drafts survive the 30-second refresh.
  const KIND = { idea: 'Öneri', bug: 'Hata', other: 'Diğer' };
  const drafts = {};
  let fbFilter = 'open', fbLast = '';
  function renderFeedback(F, on, force) {
    const key = JSON.stringify(F) + fbFilter;
    if (!force && key === fbLast) return;
    fbLast = key;
    const items = F.items || [], open = items.filter((i) => !i.done);
    const pill = $('fbOpen'); pill.hidden = !open.length; pill.textContent = nf.format(F.open != null ? F.open : open.length) + ' yeni';
    seg($('fbFilter'), { open: 'Bekleyenler', all: 'Hepsi' }, fbFilter, (k) => { fbFilter = k; renderFeedback(F, on, true); });
    $('fbInfo').textContent = 'Liste 30 saniyede bir kendiliğinden yenilenir · ' + when(new Date().toISOString());
    const focused = document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.fb : null;
    const host = $('fbList'); host.replaceChildren();
    const shown = fbFilter === 'open' ? open : items;
    if (!shown.length) { const c = el('div', 'card fb'); c.append(el('div', 'empty', fbFilter === 'open' ? 'Bekleyen mesaj yok.' : 'Henüz mesaj yok.')); host.append(c); return; }
    for (const i of shown) {
      const c = el('div', 'card fb'), meta = el('div', 'meta');
      meta.append(el('span', 'tag' + (i.done ? '' : ' new'), i.done ? (i.reply ? 'Yanıtlandı' : 'Kapatıldı') : 'Yeni'), el('span', 'tag', KIND[i.kind] || i.kind), el('span', null, when(i.created_at)),
        el('span', null, [i.pro == null ? null : i.pro ? 'PRO' : 'Ücretsiz', i.locale, i.platform === 'ios' ? 'iOS' : i.platform === 'android' ? 'Android' : null, i.app_version ? 'sürüm ' + i.app_version : null].filter(Boolean).join(' · ')));
      const body = el('div', 'text'); body.textContent = String(i.message); // full text, not the 200-character cut of el()
      c.append(meta, body);
      if (i.reply) { const a = el('div', 'answer'); a.append(el('small', null, 'Yanıtın · ' + when(i.replied_at) + (i.seen_at ? ' · kullanıcı gördü' : ' · henüz görülmedi'))); a.append(document.createTextNode(String(i.reply))); c.append(a); }
      const ta = document.createElement('textarea'); ta.maxLength = 2000; ta.dataset.fb = i.id; ta.placeholder = i.reply ? 'Yanıtı değiştir…' : 'Yanıt yaz… (kullanıcı uygulamada görür)'; ta.value = drafts[i.id] || '';
      ta.addEventListener('input', () => { drafts[i.id] = ta.value; });
      const acts = el('div', 'acts'), send = el('button', 'send', 'Yanıtla'), done = el('button', 'ghost', i.done ? 'Yeniden aç' : 'Yanıtsız kapat');
      send.type = done.type = 'button';
      send.onclick = () => { const v = ta.value.trim(); if (!v) { ta.focus(); return; } send.disabled = true; delete drafts[i.id]; on.reply(i.id, v); };
      done.onclick = () => { done.disabled = true; on.done(i.id, !i.done); };
      acts.append(send, done); c.append(ta, acts); host.append(c);
      if (focused === i.id) ta.focus();
    }
  }

  window.FitimoPanel = { render, renderFeedback };
})();
