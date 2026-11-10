// Fitimo admin panel — sign-in and data loading (D-197: passphrase + authenticator app, no e-mail).
// The page holds no secret. The session token lives in memory only (never in localStorage or a cookie), so closing
// or reloading the tab signs you out.
(function () {
  'use strict';
  // Never run inside another site's frame (clickjacking).
  if (window.top !== window.self) { document.documentElement.replaceChildren(); return; }

  const CFG = window.FITIMO_ADMIN || {};
  const API = CFG.url + '/functions/v1/admin-api';
  const IDLE_MS = 15 * 60 * 1000;
  const $ = (id) => document.getElementById(id);
  let session = '', setupToken = '', days = 30, idleTimer = 0;

  const msg = (t) => { $('msg').textContent = t || ''; };
  const show = (form) => {
    for (const f of ['fLogin', 'fSetup']) { $(f).hidden = f !== form; $(f).reset(); }
    $('login').hidden = false; $('panel').hidden = true;
    const first = $(form).querySelector('input'); if (first) first.focus();
  };

  async function api(body) {
    const headers = { 'Content-Type': 'application/json' };
    if (session) headers.Authorization = 'Bearer ' + session;
    const r = await fetch(API, { method: 'POST', headers, body: JSON.stringify(body), cache: 'no-store', credentials: 'omit' });
    let data = null; try { data = await r.json(); } catch { /* not json */ }
    return { status: r.status, data: data || {} };
  }

  function signOut(text) {
    if (session) api({ action: 'logout' }).catch(() => {});
    session = ''; clearTimeout(idleTimer);
    for (const id of ['kpis', 'revenue', 'ret', 'funnels', 'money', 'usage', 'crash', 'issues', 'services', 'servicesCards', 'accounts', 'accountsCards', 'events', 'dims', 'checks', 'audit']) $(id).replaceChildren();
    show('fLogin'); msg(text);
  }
  function touch() { clearTimeout(idleTimer); if (session) idleTimer = setTimeout(() => signOut('15 dakika işlem yapılmadığı için çıkış yapıldı.'), IDLE_MS); }

  async function load() {
    touch();
    const r = await api({ action: 'overview', days });
    if (r.status === 200) { $('login').hidden = true; $('panel').hidden = false; msg(''); window.FitimoPanel.render(r.data, (d) => { days = d; load(); }); return; }
    if (r.status === 429) { $('gen').textContent = 'Çok sık yenilendi; birkaç dakika sonra yeniden dene.'; return; }
    if (r.status === 503) { $('gen').textContent = 'Veri şu an alınamadı; biraz sonra yeniden dene.'; if ($('panel').hidden) signOut('Veri şu an alınamadı.'); return; }
    signOut('Oturum sona erdi. Yeniden gir.');
  }

  const LOCKED = 'Çok fazla yanlış deneme. 15 dakika sonra yeniden dene.';
  const submit = (id, fn) => $(id).addEventListener('submit', async (ev) => {
    ev.preventDefault(); const form = ev.currentTarget;
    for (const b of form.querySelectorAll('button')) b.disabled = true; msg('');
    try { await fn(); } catch { msg('Bağlantı kurulamadı. Yeniden dene.'); }
    for (const b of form.querySelectorAll('button')) b.disabled = false;
  });

  submit('fLogin', async () => {
    const r = await api({ action: 'login', passphrase: $('pass').value, code: $('code').value.trim() });
    $('pass').value = ''; $('code').value = '';
    if (r.status === 200 && r.data.session) { session = r.data.session; return load(); }
    msg(r.status === 429 ? LOCKED : r.status === 401 ? 'Parola ya da kod yanlış.' : 'Giriş şu an yapılamıyor. Biraz sonra yeniden dene.');
    $('pass').focus();
  });

  submit('fSetup', async () => {
    const p1 = $('newPass').value, p2 = $('newPass2').value;
    if (p1 !== p2) return msg('İki parola aynı değil.');
    if (p1.length < 10) return msg('Parola en az 10 karakter olmalı.');
    const r = await api({ action: 'setup-finish', setupToken, passphrase: p1, code: $('setupCode').value.trim() });
    if (r.status === 200 && r.data.session) {
      session = r.data.session; setupToken = ''; $('qr').removeAttribute('src'); $('secret').textContent = ''; $('fSetup').reset();
      return load();
    }
    $('setupCode').value = '';
    msg(r.status === 429 ? LOCKED : r.data.error === 'code-wrong' ? 'Kod yanlış. Uygulamadaki güncel kodu yaz.' : r.data.error === 'setup-invalid' ? 'Kurulum bağlantısının süresi dolmuş. Yenisi gerekiyor.' : 'Kurulum tamamlanamadı. Yeniden dene.');
  });

  async function startSetup() {
    show('fSetup'); $('loginHint').textContent = '';
    const r = await api({ action: 'setup-start', setupToken });
    if (r.status !== 200 || !r.data.secret) { setupToken = ''; show('fLogin'); return msg(r.status === 429 ? LOCKED : 'Kurulum bağlantısı geçersiz ya da süresi dolmuş. Yenisi gerekiyor.'); }
    $('qr').src = 'data:image/svg+xml;utf-8,' + encodeURIComponent(String(r.data.qr));
    $('secret').textContent = String(r.data.secret).replace(/(.{4})/g, '$1 ').trim();
  }

  $('logout').addEventListener('click', () => signOut(''));
  $('reload').addEventListener('click', () => load());
  for (const e of ['click', 'keydown', 'scroll']) window.addEventListener(e, touch, { passive: true });

  if (!CFG.url) { $('login').hidden = false; msg('Panel yapılandırılmamış.'); return; }
  // A one-time set-up link carries its token in the fragment (never sent to the site's server). Take it into memory
  // and wipe it from the address bar and history at once.
  function fromAddress() {
    const m = /^#setup=([A-Za-z0-9_-]{20,100})$/.exec(location.hash);
    if (location.hash) history.replaceState(null, '', location.pathname);
    if (!m) return false;
    if (session) signOut('');
    setupToken = m[1];
    startSetup().catch(() => { show('fLogin'); msg('Bağlantı kurulamadı. Yeniden dene.'); });
    return true;
  }
  window.addEventListener('hashchange', fromAddress);
  if (!fromAddress()) show('fLogin');
})();
