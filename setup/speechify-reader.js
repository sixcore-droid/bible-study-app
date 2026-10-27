/*! speechify-reader.js — one button: copy, highlight, speak.
 *
 *  Drop it on any page:
 *      <script src="speechify-reader.js"></script>
 *  Mark anything you want readable:
 *      <div data-speechify>...text...</div>
 *
 *  That is all. A settings bar (key, voice, speed) is injected once at the top of the page and a
 *  Read button is injected next to every marked block. Key, voice and speed persist per browser.
 *
 *  Options, set before the script tag:
 *      window.SPEECHIFY_OPTS = { selector:'[data-speechify]', model:'simba-3.2',
 *                                voice:'geffen_32', speed:0, bar:true, mount:'#somewhere' }
 *  API:
 *      Speechify.read(el)   Speechify.stop()   Speechify.setVoice(id)   Speechify.setSpeed(pct)
 *
 *  Needs to be served over http(s). Opened as a file the origin is null and the API refuses it.
 */
(function (w, d) {
  'use strict';
  var O = Object.assign({
    selector: '[data-speechify]', model: 'simba-3.2', voice: 'geffen_32',
    speed: 0, bar: true, mount: null, api: 'https://api.speechify.ai'
  }, w.SPEECHIFY_OPTS || {});

  var LS = { key: 'spf_key', voice: 'spf_voice', speed: 'spf_speed' };
  function get(k, dflt) { try { var v = localStorage.getItem(k); return v === null ? dflt : v; } catch (e) { return dflt; } }
  function set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

  // A key in SPEECHIFY_OPTS wins and the key box is hidden, so it is typed once in a config file
  // and never again. Anything in localStorage is the fallback for pages without that config.
  var state = {
    key: O.key || get(LS.key, ''),
    voice: get(LS.voice, O.voice),
    speed: parseInt(get(LS.speed, String(O.speed)), 10) || 0,
    audio: null, current: null
  };

  var CSS = '' +
'.spf-bar{display:flex;flex-wrap:wrap;gap:10px;align-items:center;padding:12px 14px;margin:0 0 16px;' +
'  border:1px solid currentColor;border-radius:6px;font:500 12px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace;' +
'  letter-spacing:.04em;text-transform:uppercase;opacity:.92}' +
'.spf-bar label{opacity:.6;flex:0 0 auto}' +
'.spf-bar input,.spf-bar select{font:inherit;text-transform:none;letter-spacing:0;padding:6px 8px;' +
'  border:1px solid currentColor;border-radius:4px;background:transparent;color:inherit;min-width:0}' +
'.spf-bar input[type=password]{flex:1 1 180px}.spf-bar select{flex:1 1 170px}' +
'.spf-bar input[type=range]{flex:1 1 130px;padding:0}' +
'.spf-bar button{font:inherit;padding:6px 10px;border:1px solid currentColor;border-radius:4px;' +
'  background:transparent;color:inherit;cursor:pointer}' +
'.spf-bar output{opacity:.7;min-width:5em;font-variant-numeric:tabular-nums}' +
'.spf-btn{font:500 12px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.05em;' +
'  text-transform:uppercase;padding:9px 14px;margin:0 0 8px;border-radius:4px;border:1px solid currentColor;' +
'  background:transparent;color:inherit;cursor:pointer;display:inline-flex;gap:8px;align-items:center}' +
'.spf-btn:hover{opacity:.75}.spf-btn[data-on="1"]{background:currentColor}' +
'.spf-btn[data-on="1"] .spf-lab,.spf-btn[data-on="1"] .spf-ico{mix-blend-mode:difference;filter:invert(1)}' +
'.spf-toast{position:fixed;left:50%;bottom:22px;transform:translateX(-50%);padding:9px 16px;' +
'  border-radius:4px;background:#111;color:#fff;font:12px ui-monospace,monospace;z-index:99999;' +
'  opacity:0;transition:opacity .2s;pointer-events:none;max-width:90vw;text-align:center}' +
'.spf-toast.on{opacity:1}' +
'@media (prefers-reduced-motion:reduce){.spf-toast{transition:none}}';

  function style() {
    if (d.getElementById('spf-css')) return;
    var s = d.createElement('style'); s.id = 'spf-css'; s.textContent = CSS;
    d.head.appendChild(s);
  }

  var toastEl;
  function toast(m) {
    if (!toastEl) { toastEl = d.createElement('div'); toastEl.className = 'spf-toast'; d.body.appendChild(toastEl); }
    toastEl.textContent = m; toastEl.classList.add('on');
    clearTimeout(toast._t); toast._t = setTimeout(function () { toastEl.classList.remove('on'); }, 3200);
  }

  // SSML, so an ampersand in the text cannot break the request.
  function ssml(text, pct) {
    if (!pct) return text;
    var e = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return '<speak><prosody rate="' + (pct > 0 ? '+' : '') + pct + '%">' + e + '</prosody></speak>';
  }

  // Play while it downloads: Speechify sends the first audio in about a quarter of a second, but a whole chapter takes
  // ten seconds or more to finish. MediaSource starts on the first chunk; without it (or for another format) wait for all.
  async function playStream(res) {
    var type = 'audio/mpeg', MS = w.MediaSource || w.ManagedMediaSource;
    if (!MS || !MS.isTypeSupported || !MS.isTypeSupported(type) || !res.body || !/mpeg|mp3/i.test(res.headers.get('content-type') || type)) {
      var a0 = new Audio(URL.createObjectURL(await res.blob())); a0.onended = stop; state.audio = a0; await a0.play(); return a0;
    }
    var ms = new MS(), a = new Audio(); a.disableRemotePlayback = true; a.onended = stop; a.src = URL.createObjectURL(ms); state.audio = a;
    await new Promise(function (ok) { ms.addEventListener('sourceopen', ok, { once: true }); });
    var sb = ms.addSourceBuffer(type), rd = res.body.getReader(), started = false;
    var append = function (chunk) { return new Promise(function (ok, no) { sb.addEventListener('updateend', ok, { once: true }); sb.addEventListener('error', no, { once: true }); sb.appendBuffer(chunk); }); };
    while (true) {
      var r = await rd.read();
      if (state.audio !== a) { try { rd.cancel(); } catch (e) {} return null; }   // stopped
      if (r.done) break;
      await append(r.value);
      if (!started) { started = true; a.play().catch(function (e) { toast(String(e.message || e)); }); }
    }
    if (ms.readyState === 'open') ms.endOfStream();
    return a;
  }

  function stop() {
    if (state.ctl) { try { state.ctl.abort(); } catch (e) {} state.ctl = null; }
    if (state.audio) { try { state.audio.pause(); } catch (e) {} state.audio = null; }
    d.querySelectorAll('.spf-btn[data-on="1"]').forEach(function (b) { mark(b, false); });
    state.current = null;
  }

  function mark(btn, on) {
    btn.dataset.on = on ? '1' : '';
    btn.querySelector('.spf-ico').textContent = on ? '■' : '▶';
    btn.querySelector('.spf-lab').textContent = on ? 'Reading' : 'Read';
  }

  // opts.text: speak this instead of the element's own text; opts.highlight(): mark the page yourself instead of selecting el
  async function read(el, btn, opts) {
    if (!el) return;
    opts = opts || {};
    btn = btn || el.__spfBtn;
    var text = (opts.text || el.innerText || el.textContent || '').trim();
    if (!text) return;
    if (state.current === el) { stop(); return; }
    stop();
    state.current = el;

    // Copy first: writeText leaves the selection alone, the old fallback would wipe it.
    try { await navigator.clipboard.writeText(text); } catch (e) {}

    var sel = w.getSelection();
    if (opts.highlight) opts.highlight();
    else if (sel) { sel.removeAllRanges(); var r = d.createRange(); r.selectNodeContents(el); sel.addRange(r); }
    if (btn) mark(btn, true);

    if (!state.key) { toast('Paste your Speechify API key in the bar at the top'); if (btn) mark(btn, false); state.current = null; return; }

    try {
      var res = await fetch(O.api + '/v1/audio/stream', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + state.key, 'Content-Type': 'application/json', 'Accept': 'audio/mpeg' },
        signal: (state.ctl = new AbortController()).signal,
        body: JSON.stringify({ input: ssml(text, state.speed), voice_id: state.voice, model: O.model })
      });
      if (!res.ok) {
        var msg = '';
        try { var j = await res.json(); msg = (j.error && j.error.message) || ''; } catch (e) {}
        throw new Error('Speechify ' + res.status + (msg ? ': ' + msg : ''));
      }
      if (state.current !== el) return;                       // stopped while waiting
      await playStream(res);
    } catch (e) {
      if (e && e.name === 'AbortError') return;              // Stop, or another Read, cancelled this one
      if (state.current !== el) return;
      if (btn) mark(btn, false);
      state.current = null;
      var m = String(e.message || e);
      if (/Failed to fetch|NetworkError|Load failed/i.test(m))
        m = 'Could not reach Speechify. Serve this page over http, not as a file.';
      toast(m);
    }
  }

  async function voices(sel, btn) {
    if (!state.key) { toast('Paste your key first'); return; }
    if (btn) btn.textContent = '...';
    try {
      var r = await fetch(O.api + '/v1/voices?model=' + encodeURIComponent(O.model) + '&limit=100',
        { headers: { 'Authorization': 'Bearer ' + state.key } });
      if (!r.ok) throw new Error('Speechify ' + r.status);
      var data = await r.json();
      var list = data.voices || data.data || (Array.isArray(data) ? data : []);
      sel.innerHTML = '';
      list.forEach(function (v) {
        var o = d.createElement('option');
        o.value = v.id;
        o.textContent = (v.display_name || v.id) + (v.locale ? '  ' + v.locale : '');
        sel.appendChild(o);
      });
      if (list.some(function (v) { return v.id === state.voice; })) sel.value = state.voice;
      if (btn) btn.textContent = list.length + ' voices';
    } catch (e) {
      if (btn) btn.textContent = 'Load voices';
      toast(String(e.message || e));
    }
  }

  function bar() {
    var el = d.createElement('div');
    el.className = 'spf-bar';
    el.innerHTML =
      (O.key ? '' :
        '<label for="spf-key">Speechify</label>' +
        '<input id="spf-key" type="password" placeholder="API key" autocomplete="off">') +
      '<label for="spf-voice">Voice</label>' +
      '<select id="spf-voice"></select>' +
      '<button type="button" id="spf-load">Load voices</button>' +
      '<label for="spf-speed">Speed</label>' +
      '<input id="spf-speed" type="range" min="-50" max="100" step="10">' +
      '<output id="spf-speedout"></output>';
    var host = O.mount ? (typeof O.mount === 'string' ? d.querySelector(O.mount) : O.mount) : d.body;
    (host || d.body).insertBefore(el, (host || d.body).firstChild);

    var k = el.querySelector('#spf-key'), v = el.querySelector('#spf-voice'),
        sp = el.querySelector('#spf-speed'), out = el.querySelector('#spf-speedout');
    if (k) {
      k.value = state.key;
      k.addEventListener('input', function () { state.key = k.value.trim(); set(LS.key, state.key); });
    }
    var o = d.createElement('option'); o.value = state.voice; o.textContent = state.voice; v.appendChild(o);
    v.value = state.voice;
    v.addEventListener('change', function () { state.voice = v.value; set(LS.voice, state.voice); });
    el.querySelector('#spf-load').addEventListener('click', function () { voices(v, this); });
    sp.value = String(state.speed);
    function shown() { /* 1x, 1.2x, 2x: the stored value stays a percent change */ out.textContent = (Math.round((100 + state.speed) / 10) / 10) + 'x'; }
    sp.addEventListener('input', function () { state.speed = parseInt(sp.value, 10) || 0; set(LS.speed, String(state.speed)); shown(); });
    shown();
  }

  function attach(el) {
    if (el.__spfBtn) return;
    var b = d.createElement('button');
    b.type = 'button';
    b.className = 'spf-btn';
    b.innerHTML = '<span class="spf-ico">▶</span><span class="spf-lab">Read</span>';
    b.addEventListener('click', function () { read(el, b); });
    el.__spfBtn = b;
    el.parentNode.insertBefore(b, el);
  }

  function scan() { d.querySelectorAll(O.selector).forEach(attach); }

  function init() {
    style();
    if (O.bar) bar();
    scan();
    new MutationObserver(scan).observe(d.body, { childList: true, subtree: true });
    d.addEventListener('keydown', function (e) { if (e.key === 'Escape') stop(); });
  }

  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', init); else init();

  w.Speechify = {
    read: function (el, opts) { read(typeof el === 'string' ? d.querySelector(el) : el, null, opts); },
    // the bar can live anywhere: mount it into a host element on demand (bar:false in the options)
    bar: function (host) { if (!d.querySelector('.spf-bar')) { var m = O.mount; O.mount = host; bar(); O.mount = m; } return d.querySelector('.spf-bar'); },
    stop: stop,
    setVoice: function (id) { state.voice = id; set(LS.voice, id); var s = d.getElementById('spf-voice'); if (s) s.value = id; },
    setSpeed: function (p) { state.speed = p | 0; set(LS.speed, String(state.speed)); var s = d.getElementById('spf-speed'); if (s) { s.value = String(state.speed); s.dispatchEvent(new Event('input')); } },
    scan: scan
  };
})(window, document);
