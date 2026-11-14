(function () {
'use strict';
var NOTES = window.NOTES || [];
var KEY = 'ortho-notes-v1';
var $app = document.getElementById('app');

/* ---------- storage ---------- */
var S = { progress: {}, ui: { q: '', filter: 'All', mode: 'full', hideA2HS: false } };
try {
  var raw = localStorage.getItem(KEY);
  if (raw) { var p = JSON.parse(raw); S.progress = p.progress || {}; S.ui = Object.assign(S.ui, p.ui || {}); }
} catch (e) {}
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }
function prog(slug) {
  if (!S.progress[slug]) S.progress[slug] = { revised: null, weak: false, note: '', opened: null, count: 0 };
  return S.progress[slug];
}

/* ---------- helpers ---------- */
function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function inline(s) {
  s = esc(s);
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(^|[^*\w])\*([^*\s][^*]*?)\*(?![*\w])/g, '$1<em>$2</em>');
  return s;
}
function slugify(s) { return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }
function tagClass(t) { return 'tag tg-' + t.toLowerCase().replace(/[^a-z]/g, ''); }
function daysAgo(ts) {
  if (!ts) return '';
  var d = Math.floor((Date.now() - ts) / 86400000);
  return d <= 0 ? 'today' : d === 1 ? 'yesterday' : d + ' days ago';
}

/* ---------- markdown subset ---------- */
function splitRow(l) { return l.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(function (c) { return c.trim(); }); }

function renderList(lines) {
  var html = '', stack = [];
  lines.forEach(function (l) {
    var m = l.match(/^(\s*)([-*]|\d+\.)\s+(.*)$/);
    var ind = Math.floor(m[1].length / 2), tag = /\d/.test(m[2]) ? 'ol' : 'ul';
    while (stack.length > ind + 1) { html += '</li></' + stack.pop() + '>'; }
    if (stack.length === ind + 1) { html += '</li>'; }
    else { while (stack.length < ind + 1) { html += '<' + tag + '>'; stack.push(tag); } }
    html += '<li>' + inline(m[3]);
  });
  while (stack.length) html += '</li></' + stack.pop() + '>';
  return html;
}

function renderFlow(lines) {
  var html = '<div class="flow">';
  lines.forEach(function (l) {
    l = l.trim();
    if (!l) return;
    if (l === 'v') { html += '<div class="flow-arrow">&darr;</div>'; return; }
    html += '<div class="flow-row">';
    l.split(';;').forEach(function (b) {
      b = b.trim();
      var c = '', m = b.match(/^\[(teal|red|amber)\]\s*(.*)$/);
      if (m) { c = m[1]; b = m[2]; }
      var parts = b.split('|');
      html += '<div class="fb ' + c + '"><b>' + inline(parts[0].trim()) + '</b>' + (parts[1] ? '<span>' + inline(parts.slice(1).join('|').trim()) + '</span>' : '') + '</div>';
    });
    html += '</div>';
  });
  return html + '</div>';
}

function blocks(lines) {
  var out = '', i = 0;
  while (i < lines.length) {
    var l = lines[i];
    if (!l.trim()) { i++; continue; }
    var m;
    if ((m = l.match(/^```(\w*)\s*(.*)$/))) {
      var lang = m[1], cap = m[2], buf = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) buf.push(lines[i++]);
      i++;
      if (lang === 'svg') out += '<figure class="diagram">' + buf.join('\n') + (cap ? '<figcaption>' + inline(cap) + '</figcaption>' : '') + '</figure>';
      else out += '<pre><code>' + esc(buf.join('\n')) + '</code></pre>';
      continue;
    }
    if ((m = l.match(/^:::(\w+)\s*(.*)$/))) {
      var kind = m[1], arg = m[2], inner = [];
      i++;
      while (i < lines.length && lines[i].trim() !== ':::') inner.push(lines[i++]);
      i++;
      if (kind === 'qa') out += '<details class="qa"><summary>' + inline(arg) + '</summary><div class="ans">' + blocks(inner) + '</div></details>';
      else if (kind === 'flow') out += renderFlow(inner);
      continue;
    }
    if (/^>/.test(l)) {
      var q = [];
      while (i < lines.length && /^>/.test(lines[i])) q.push(lines[i++].replace(/^>\s?/, ''));
      var cm = q[0].match(/^\[!(\w+)\]\s*(.*)$/);
      if (cm) {
        var labels = { samajh: 'Samajh', verify: 'Verify in book', flag: 'Red flag', tip: 'Pearl' };
        q[0] = cm[2];
        out += '<div class="co ' + cm[1] + '"><span class="lab">' + labels[cm[1]] + '</span>' + blocks(q) + '</div>';
      } else out += '<div class="co tip">' + blocks(q) + '</div>';
      continue;
    }
    if (/^\s*\|/.test(l)) {
      var t = [];
      while (i < lines.length && /^\s*\|/.test(lines[i])) t.push(lines[i++]);
      var head = splitRow(t[0]), body = t.slice(2).map(splitRow);
      out += '<div class="tw"><table class="' + (head.length > 3 ? 'wide' : '') + '"><thead><tr>' + head.map(function (h) { return '<th>' + inline(h) + '</th>'; }).join('') + '</tr></thead><tbody>' +
        body.map(function (r) { return '<tr>' + r.map(function (c) { return '<td>' + inline(c) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div>';
      continue;
    }
    if ((m = l.match(/^(#{3,4})\s+(.*)$/))) { out += '<h3>' + inline(m[2]) + '</h3>'; i++; continue; }
    if (/^---+\s*$/.test(l)) { out += '<hr>'; i++; continue; }
    if (/^\s*([-*]|\d+\.)\s+/.test(l)) {
      var li = [];
      while (i < lines.length && /^\s*([-*]|\d+\.)\s+/.test(lines[i])) li.push(lines[i++]);
      out += renderList(li);
      continue;
    }
    var para = [];
    while (i < lines.length && lines[i].trim() && !/^(```|:::|>|\s*\||#{3,4}\s|---+\s*$|\s*([-*]|\d+\.)\s+)/.test(lines[i])) para.push(lines[i++]);
    out += '<p>' + para.map(inline).join('<br>') + '</p>';
  }
  return out;
}

function renderBody(body) {
  var lines = body.split('\n'), secs = [], cur = { title: '', kind: '', lines: [] };
  var inFence = false;
  lines.forEach(function (l) {
    if (/^```/.test(l)) inFence = !inFence;
    var m = !inFence && l.match(/^##\s+(.*?)\s*(\{(revise|viva)\})?\s*$/);
    if (m) {
      if (cur.title || cur.lines.join('').trim()) secs.push(cur);
      cur = { title: m[1], kind: m[3] || '', lines: [] };
    } else cur.lines.push(l);
  });
  if (cur.title || cur.lines.join('').trim()) secs.push(cur);
  var toc = secs.filter(function (s) { return s.title; }).map(function (s) {
    return '<a href="#" data-jump="' + slugify(s.title) + '">' + esc(s.title.length > 26 ? s.title.slice(0, 24) + '…' : s.title) + '</a>';
  }).join('');
  var html = secs.map(function (s) {
    return '<section class="sec" data-kind="' + s.kind + '">' + (s.title ? '<h2 id="s-' + slugify(s.title) + '">' + inline(s.title) + '</h2>' : '') + blocks(s.lines) + '</section>';
  }).join('');
  return { toc: toc, html: html, hasRevise: secs.some(function (s) { return s.kind === 'revise'; }), hasViva: secs.some(function (s) { return s.kind === 'viva'; }) };
}

/* ---------- views ---------- */
function allTags() {
  var set = {};
  NOTES.forEach(function (n) { n.tags.forEach(function (t) { set[t] = 1; }); });
  return ['All'].concat(Object.keys(set).sort());
}

function snippet(n, q) {
  var terms = q.toLowerCase().split(/\s+/).filter(Boolean);
  var plain = n.body.replace(/[#>*|`:\[\]!]/g, ' ').replace(/\s+/g, ' ');
  var low = plain.toLowerCase(), idx = -1;
  for (var k = 0; k < terms.length; k++) { idx = low.indexOf(terms[k]); if (idx >= 0) break; }
  if (idx < 0) return '';
  var s = plain.slice(Math.max(0, idx - 40), idx + 90);
  s = esc(s);
  terms.forEach(function (t) { s = s.replace(new RegExp('(' + t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'ig'), '<mark>$1</mark>'); });
  return '…' + s + '…';
}

function matches(n, q) {
  var terms = q.toLowerCase().split(/\s+/).filter(Boolean);
  var hay = (n.title + ' ' + n.tags.join(' ') + ' ' + n.summary + ' ' + n.body).toLowerCase();
  return terms.every(function (t) { return hay.indexOf(t) >= 0; });
}

function homeView() {
  var list = NOTES.filter(function (n) {
    return (S.ui.filter === 'All' || n.tags.indexOf(S.ui.filter) >= 0) && (!S.ui.q || matches(n, S.ui.q));
  });
  var revised = NOTES.filter(function (n) { return prog(n.slug).revised; }).length;
  var weak = NOTES.filter(function (n) { return prog(n.slug).weak; }).length;
  var due = NOTES.filter(function (n) { return !prog(n.slug).revised; })
    .concat(NOTES.filter(function (n) { return prog(n.slug).revised; }).sort(function (a, b) { return prog(a.slug).revised - prog(b.slug).revised; }));
  var weakFirst = NOTES.filter(function (n) { return prog(n.slug).weak; })[0];
  var next = weakFirst || due[0];
  var h = '<div class="top"><div class="brand"><h1>Ortho Notes</h1><p>' + NOTES.length + ' topics &middot; OPD to OT</p></div>' +
    '<a class="btn sm" href="#/backup">Backup</a></div>';
  var standalone = window.navigator.standalone || (window.matchMedia && matchMedia('(display-mode: standalone)').matches);
  if (!standalone && !S.ui.hideA2HS && /iphone|ipad/i.test(navigator.userAgent)) {
    h += '<div class="a2hs"><b>Install:</b> tap Share &rarr; <b>Add to Home Screen</b>.<br><button class="btn sm" data-act="hideA2HS">Got it</button></div>';
  }
  h += '<input class="search" id="q" type="search" placeholder="Search anything: ATFL, drop sign, Maigne…" value="' + esc(S.ui.q) + '" autocomplete="off">';
  h += '<div class="chips">' + allTags().map(function (t) { return '<button class="chip' + (t === S.ui.filter ? ' on' : '') + '" data-filter="' + esc(t) + '">' + esc(t) + '</button>'; }).join('') + '</div>';
  h += '<div class="stats"><div class="stat"><b>' + revised + '/' + NOTES.length + '</b><span>Revised</span></div><div class="stat"><b>' + weak + '</b><span>Weak, revisit</span></div></div>';
  if (next && !S.ui.q) h += '<a class="next" href="#/t/' + next.slug + '"><small>' + (weakFirst ? 'Revisit (marked weak)' : prog(next.slug).revised ? 'Oldest revision' : 'Not revised yet') + '</small><b>' + esc(next.title) + '</b></a>';
  h += '<div class="list">';
  if (!list.length) h += '<div class="empty">Nothing matches. Try a shorter word.</div>';
  list.forEach(function (n) {
    var p = prog(n.slug);
    var badge = p.weak ? '<span class="badge weak">Weak</span>' : p.revised ? '<span class="badge ok">Revised</span>' : '';
    h += '<a class="card" href="#/t/' + n.slug + '"><div class="card-top"><h3>' + esc(n.title) + '</h3>' + badge + '</div>' +
      '<p class="sum">' + esc(n.summary) + '</p><div class="tags">' + n.tags.map(function (t) { return '<span class="' + tagClass(t) + '">' + esc(t) + '</span>'; }).join('') + '</div>' +
      (S.ui.q ? '<div class="snip">' + snippet(n, S.ui.q) + '</div>' : '') +
      (p.revised ? '<div class="meta">Revised ' + daysAgo(p.revised) + '</div>' : '') + '</a>';
  });
  h += '</div><div class="foot"><span>v ' + esc(window.NOTES_VERSION || '') + '</span><span>Study aid, verify doses against your book</span></div>';
  return h;
}

function topicView(slug) {
  var idx = NOTES.findIndex(function (n) { return n.slug === slug; });
  if (idx < 0) return '<div class="empty">Topic not found.<br><a href="#/">Back</a></div>';
  var n = NOTES[idx], p = prog(slug), r = renderBody(n.body), mode = S.ui.mode;
  if (mode === 'revise' && !r.hasRevise) mode = 'full';
  if (mode === 'viva' && !r.hasViva) mode = 'full';
  p.opened = Date.now(); p.count = (p.count || 0) + 1; save();
  var prev = NOTES[idx - 1], nextN = NOTES[idx + 1];
  var h = '<div class="bar"><a class="back" href="#/">&larr; Topics</a><div class="barbtns">' +
    '<button class="mini weak' + (p.weak ? ' on' : '') + '" data-act="weak" data-slug="' + slug + '">' + (p.weak ? 'Weak' : 'Mark weak') + '</button>' +
    '<button class="mini ok' + (p.revised ? ' on' : '') + '" data-act="revised" data-slug="' + slug + '">' + (p.revised ? 'Revised' : 'Mark revised') + '</button></div></div>';
  h += '<div class="tags">' + n.tags.map(function (t) { return '<span class="' + tagClass(t) + '">' + esc(t) + '</span>'; }).join('') + '</div>';
  h += '<h1 class="title">' + esc(n.title) + '</h1>';
  h += '<div class="seg"><button data-mode="full" class="' + (mode === 'full' ? 'on' : '') + '">Full</button><button data-mode="revise" class="' + (mode === 'revise' ? 'on' : '') + '">Revise</button><button data-mode="viva" class="' + (mode === 'viva' ? 'on' : '') + '">Viva</button></div>';
  h += '<p class="hint">' + (mode === 'full' ? 'Full notes. Jump with the chips below.' : mode === 'revise' ? 'Quick rules only, for last-minute revision.' : 'Tap a question, answer aloud first, then open.') + '</p>';
  if (mode === 'full') h += '<div class="toc">' + r.toc + '</div>';
  h += '<article class="art mode-' + mode + '">' + r.html + '</article>';
  h += '<div class="notes"><h2>My notes</h2><textarea id="note" placeholder="Pearls from ward rounds, OT, consultant…">' + esc(p.note || '') + '</textarea></div>';
  h += '<div class="actions"><button class="btn primary block" data-act="revised" data-slug="' + slug + '">' + (p.revised ? 'Revised ' + daysAgo(p.revised) + ', mark again' : 'Mark as revised') + '</button></div>';
  h += '<div class="pn">' + (prev ? '<a href="#/t/' + prev.slug + '"><small>&larr; Previous</small><b>' + esc(prev.title) + '</b></a>' : '<span></span>') +
    (nextN ? '<a class="next-r" href="#/t/' + nextN.slug + '"><small>Next &rarr;</small><b>' + esc(nextN.title) + '</b></a>' : '<span></span>') + '</div>';
  return h;
}

function backupView(msg, err) {
  return '<div class="bar"><a class="back" href="#/">&larr; Topics</a></div><h1 class="title">Backup</h1>' +
    '<p>The Home Screen app and Safari keep separate progress. Copy this text from one, paste into the other, tap Restore. Your notes and revised marks travel with it.</p>' +
    '<div class="backup"><textarea id="bk" readonly>' + esc(JSON.stringify({ progress: S.progress })) + '</textarea>' +
    '<div class="actions"><button class="btn block" data-act="copybk">Copy backup</button>' +
    '<button class="btn primary block" data-act="restore">Restore from pasted text</button></div>' +
    (msg ? '<p class="msg' + (err ? ' err' : '') + '">' + esc(msg) + '</p>' : '') + '</div>' +
    '<p class="hint">To restore, clear the box, paste the backup there, then tap Restore.</p>';
}

/* ---------- router ---------- */
function render() {
  var hash = location.hash || '#/', m;
  var scroll = 0;
  if ((m = hash.match(/^#\/t\/(.+)$/))) $app.innerHTML = topicView(decodeURIComponent(m[1]));
  else if (hash === '#/backup') $app.innerHTML = backupView();
  else $app.innerHTML = homeView();
  window.scrollTo(0, scroll);
}
function rerenderKeepScroll() { var y = window.scrollY; var h = location.hash || '#/'; var m; if ((m = h.match(/^#\/t\/(.+)$/))) { var p = prog(m[1]); var o = p.count; $app.innerHTML = topicView(decodeURIComponent(m[1])); prog(m[1]).count = o; save(); } else $app.innerHTML = homeView(); window.scrollTo(0, y); }
window.addEventListener('hashchange', render);

document.addEventListener('click', function (e) {
  var t = e.target.closest('[data-filter],[data-mode],[data-act],[data-jump]');
  if (!t) return;
  if (t.dataset.jump) {
    e.preventDefault();
    var el = document.getElementById('s-' + t.dataset.jump);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }
  if (t.dataset.filter) { S.ui.filter = t.dataset.filter; save(); rerenderKeepScroll(); return; }
  if (t.dataset.mode) { S.ui.mode = t.dataset.mode; save(); rerenderKeepScroll(); return; }
  var act = t.dataset.act, slug = t.dataset.slug;
  if (act === 'weak') { var p = prog(slug); p.weak = !p.weak; save(); rerenderKeepScroll(); }
  else if (act === 'revised') { var q = prog(slug); q.revised = q.revised && t.classList.contains('mini') ? null : Date.now(); if (q.revised) q.weak = false; save(); rerenderKeepScroll(); }
  else if (act === 'hideA2HS') { S.ui.hideA2HS = true; save(); rerenderKeepScroll(); }
  else if (act === 'copybk') {
    var ta = document.getElementById('bk'); ta.select();
    var done = function () { $app.innerHTML = backupView('Copied.'); };
    if (navigator.clipboard) navigator.clipboard.writeText(ta.value).then(done, function () { document.execCommand('copy'); done(); });
    else { document.execCommand('copy'); done(); }
  } else if (act === 'restore') {
    var ta2 = document.getElementById('bk');
    try {
      var d = JSON.parse(ta2.value);
      if (!d.progress || typeof d.progress !== 'object') throw new Error('bad');
      Object.keys(d.progress).forEach(function (k) {
        var inc = d.progress[k], cur = prog(k);
        if ((inc.revised || 0) > (cur.revised || 0)) cur.revised = inc.revised;
        cur.weak = inc.weak != null ? !!inc.weak : cur.weak;
        if (inc.note && inc.note !== cur.note) cur.note = cur.note && cur.note.indexOf(inc.note) < 0 ? cur.note + '\n' + inc.note : inc.note;
      });
      save(); $app.innerHTML = backupView('Restored and merged.');
    } catch (err) { $app.innerHTML = backupView('That is not a valid backup. Paste the full copied text.', true); }
  }
});

document.addEventListener('input', function (e) {
  if (e.target.id === 'q') {
    S.ui.q = e.target.value; save();
    var pos = e.target.selectionStart;
    $app.innerHTML = homeView();
    var q = document.getElementById('q'); q.focus(); q.setSelectionRange(pos, pos);
  } else if (e.target.id === 'note') {
    var m = (location.hash || '').match(/^#\/t\/(.+)$/);
    if (m) { prog(decodeURIComponent(m[1])).note = e.target.value; save(); }
  }
});

render();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('sw.js').then(function (reg) {
      reg.addEventListener('updatefound', function () {
        var w = reg.installing;
        if (w) w.addEventListener('statechange', function () { if (w.state === 'activated' && navigator.serviceWorker.controller) { /* new version ready: applies on next open */ } });
      });
    }).catch(function () {});
  });
}
})();
