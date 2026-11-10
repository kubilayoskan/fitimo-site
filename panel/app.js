// Fitimo admin panel — sign-in and data loading. The page holds no secret: the key in config.js is the app's public
// key. The session lives in memory only (never in localStorage), so closing or reloading the tab signs you out.
(function () {
  'use strict';
  // Never run inside another site's frame (clickjacking).
  if (window.top !== window.self) { document.documentElement.replaceChildren(); return; }

  const CFG = window.FITIMO_ADMIN || {};
  const AUTH = CFG.url + '/auth/v1', API = CFG.url + '/functions/v1/admin-api';
  const IDLE_MS = 15 * 60 * 1000;
  const $ = (id) => document.getElementById(id);
  let session = null, email = '', factorId = '', days = 30, idleTimer = 0, refreshTimer = 0;

  const msg = (t) => { $('msg').textContent = t || ''; };
  const show = (form) => { for (const f of ['fEmail', 'fCode', 'fEnroll', 'fTotp']) $(f).hidden = f !== form; $('login').hidden = false; $('panel').hidden = true; const i = $(form).querySelector('input'); if (i) { i.value = ''; i.focus(); } };

  async function call(path, body, method) {
    const headers = { apikey: CFG.key, 'Content-Type': 'application/json' };
    if (session) headers.Authorization = 'Bearer ' + session.access_token;
    const r = await fetch(AUTH + path, { method: method || 'POST', headers, body: body ? JSON.stringify(body) : undefined, cache: 'no-store', credentials: 'omit' });
    let data = null; try { data = await r.json(); } catch { /* empty answer */ }
    return { ok: r.ok, status: r.status, data: data || {} };
  }
  function keep(s) {
    session = { access_token: s.access_token, refresh_token: s.refresh_token };
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(refresh, Math.max(60, (s.expires_in || 3600) - 120) * 1000);
  }
  async function refresh() {
    if (!session) return;
    const r = await call('/token?grant_type=refresh_token', { refresh_token: session.refresh_token }).catch(() => null);
    if (r && r.ok && r.data.access_token) keep(r.data); else signOut('Oturumun süresi doldu. Yeniden gir.');
  }
  function signOut(text) {
    const s = session; session = null; clearTimeout(refreshTimer); clearTimeout(idleTimer);
    if (s) fetch(AUTH + '/logout?scope=local', { method: 'POST', headers: { apikey: CFG.key, Authorization: 'Bearer ' + s.access_token }, credentials: 'omit' }).catch(() => {});
    for (const id of ['kpis', 'revenue', 'ret', 'funnels', 'money', 'usage', 'crash', 'issues', 'services', 'servicesCards', 'accounts', 'accountsCards', 'events', 'dims', 'checks', 'audit']) $(id).replaceChildren();
    show('fEmail'); msg(text);
  }
  function touch() { clearTimeout(idleTimer); if (session) idleTimer = setTimeout(() => signOut('15 dakika işlem yapılmadığı için çıkış yapıldı.'), IDLE_MS); }

  async function api(body) {
    const r = await fetch(API, { method: 'POST', headers: { Authorization: 'Bearer ' + session.access_token, 'Content-Type': 'application/json' }, body: JSON.stringify(body), cache: 'no-store', credentials: 'omit' });
    let data = null; try { data = await r.json(); } catch { /* not json */ }
    return { status: r.status, data: data || {} };
  }

  // After the e-mail code: is this an admin account, and does it still need the second step?
  async function afterEmail() {
    const who = await api({ action: 'whoami' });
    if (who.status === 200) return load();
    if (who.status === 401 && who.data.error === 'second-step-required') return secondStep();
    if (who.status === 429) return signOut('Çok fazla deneme. Birkaç dakika sonra yeniden dene.');
    signOut(who.status === 403 ? 'Bu hesabın panele erişim yetkisi yok.' : 'Giriş yapılamadı.');
  }
  async function secondStep() {
    const u = await call('/user', null, 'GET');
    if (!u.ok) return signOut('Giriş yapılamadı.');
    const factors = (u.data.factors || []).filter((f) => f.factor_type === 'totp');
    const verified = factors.find((f) => f.status === 'verified');
    if (verified) { factorId = verified.id; msg(''); return show('fTotp'); }
    for (const f of factors) await call('/factors/' + encodeURIComponent(f.id), null, 'DELETE'); // half-finished set-ups
    const e = await call('/factors', { factor_type: 'totp', friendly_name: 'Fitimo panel ' + Date.now() });
    if (!e.ok || !e.data.totp) return signOut('İkinci adım kurulamadı. Yeniden dene.');
    factorId = e.data.id;
    const qr = String(e.data.totp.qr_code || '');
    $('qr').src = qr.startsWith('data:') ? qr : 'data:image/svg+xml;utf-8,' + encodeURIComponent(qr);
    $('secret').textContent = String(e.data.totp.secret || '');
    msg(''); show('fEnroll');
  }
  async function verifyTotp(code) {
    const c = await call('/factors/' + encodeURIComponent(factorId) + '/challenge', {});
    if (!c.ok) return false;
    const v = await call('/factors/' + encodeURIComponent(factorId) + '/verify', { challenge_id: c.data.id, code });
    if (!v.ok || !v.data.access_token) return false;
    keep(v.data); $('qr').removeAttribute('src'); $('secret').textContent = '';
    return true;
  }
  async function load() {
    touch();
    const r = await api({ action: 'overview', days });
    if (r.status === 200) { $('login').hidden = true; $('panel').hidden = false; msg(''); window.FitimoPanel.render(r.data, (d) => { days = d; load(); }); return; }
    if (r.status === 429) { $('gen').textContent = 'Çok sık yenilendi; birkaç dakika sonra yeniden dene.'; return; }
    if (r.status === 503) { $('gen').textContent = 'Veri şu an alınamadı; biraz sonra yeniden dene.'; if ($('panel').hidden) signOut('Veri şu an alınamadı.'); return; }
    signOut(r.status === 403 ? 'Bu hesabın panele erişim yetkisi yok.' : 'Oturum sona erdi. Yeniden gir.');
  }

  const busy = (form, on) => { for (const b of form.querySelectorAll('button')) b.disabled = on; };
  const submit = (id, fn) => $(id).addEventListener('submit', async (ev) => {
    ev.preventDefault(); const form = ev.currentTarget; busy(form, true); msg('');
    try { await fn(form.querySelector('input').value.trim()); } catch { msg('Bağlantı kurulamadı. Yeniden dene.'); }
    busy(form, false);
  });

  submit('fEmail', async (v) => {
    email = v.toLowerCase();
    const r = await call('/otp', { email, create_user: false });
    if (r.status === 429) return msg('Çok fazla deneme. Bir süre sonra yeniden dene.');
    // Same answer whether or not the address has an account.
    show('fCode'); $('loginHint').textContent = 'Bu adres kayıtlıysa bir kod gönderildi.';
  });
  submit('fCode', async (v) => {
    const r = await call('/verify', { type: 'email', email, token: v });
    if (!r.ok || !r.data.access_token) return msg(r.status === 429 ? 'Çok fazla deneme. Bir süre sonra yeniden dene.' : 'Kod yanlış ya da süresi dolmuş.');
    keep(r.data); $('loginHint').textContent = ''; await afterEmail();
  });
  submit('fEnroll', async (v) => { if (await verifyTotp(v)) await load(); else msg('Kod yanlış. Uygulamadaki güncel kodu yaz.'); });
  submit('fTotp', async (v) => { if (await verifyTotp(v)) await load(); else msg('Kod yanlış. Uygulamadaki güncel kodu yaz.'); });
  $('backEmail').addEventListener('click', () => { $('loginHint').textContent = ''; msg(''); show('fEmail'); });
  $('logout').addEventListener('click', () => signOut(''));
  $('reload').addEventListener('click', () => load());
  for (const e of ['click', 'keydown', 'scroll']) window.addEventListener(e, touch, { passive: true });

  if (!CFG.url || !CFG.key) { $('login').hidden = false; msg('Panel yapılandırılmamış.'); } else show('fEmail');
})();
