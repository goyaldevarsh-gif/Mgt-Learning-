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
var IC = {
  book: '<svg viewBox="0 0 24 24"><path d="M4 5.5C6.5 4.5 9.5 4.5 12 6c2.5-1.5 5.5-1.5 8-.5V19c-2.5-1-5.5-1-8 .5-2.5-1.5-5.5-1.5-8-.5z"/><path d="M12 6v13.5"/></svg>',
  warn: '<svg viewBox="0 0 24 24"><path d="M12 3.5l9.5 16.5h-19z"/><path d="M12 10v5M12 17.5v.5"/></svg>',
  star: '<svg viewBox="0 0 24 24"><path d="M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.5 6.6 19.5l1.2-6L3.3 9.3l6.1-.7z"/></svg>',
  bone: '<svg viewBox="0 0 24 24"><path d="M8 16L16 8"/><circle cx="6.5" cy="15" r="2.2"/><circle cx="9" cy="17.5" r="2.2"/><circle cx="15" cy="6.5" r="2.2"/><circle cx="17.5" cy="9" r="2.2"/></svg>',
  check: '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  home: '<svg viewBox="0 0 24 24"><path d="M3.5 11L12 3.5 20.5 11V20h-5.5v-5.5h-6V20H3.5z"/></svg>',
  mark: '<svg viewBox="0 0 24 24"><path d="M6 3.5h12V21l-6-4.5L6 21z"/></svg>',
  more: '<svg viewBox="0 0 24 24"><circle cx="12" cy="6" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="12" cy="18" r="1.4"/></svg>',
  arrow: '<svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg>',
  save: '<svg viewBox="0 0 24 24"><path d="M12 15V4M7.5 9.5L12 4l4.5 5.5"/><path d="M4.5 14v5.5h15V14"/></svg>',
  book2: '<svg viewBox="0 0 24 24"><path d="M5 4.5h11a3 3 0 0 1 3 3V20H8a3 3 0 0 1-3-3z"/><path d="M5 17a3 3 0 0 1 3-3h11"/></svg>'
};

function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function inline(s) {
  s = esc(s);
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(^|[^*\w])\*([^*\s][^*]*?)\*(?![*\w])/g, '$1<em>$2</em>');
  return s;
}
function slugify(s) { return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }
function tagLabel(t) { return ({ FootAnkle: 'Foot and Ankle', WristHand: 'Wrist and Hand' })[t] || t; }
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
        var cic = { samajh: IC.book, verify: IC.book, flag: IC.warn, tip: IC.star };
        q[0] = cm[2];
        out += '<div class="co ' + cm[1] + '"><span class="lab"><span class="ic">' + cic[cm[1]] + '</span>' + labels[cm[1]] + '</span>' + blocks(q) + '</div>';
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
  var s = esc(plain.slice(Math.max(0, idx - 40), idx + 90));
  terms.forEach(function (t) { s = s.replace(new RegExp('(' + t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'ig'), '<mark>$1</mark>'); });
  return '…' + s + '…';
}
function matches(n, q) {
  var terms = q.toLowerCase().split(/\s+/).filter(Boolean);
  var hay = (n.title + ' ' + n.tags.join(' ') + ' ' + n.summary + ' ' + n.body).toLowerCase();
  return terms.every(function (t) { return hay.indexOf(t) >= 0; });
}
function tile(n) { return '<span class="tile ' + tagClass(n.tags[0] || '') + '"><span class="ic">' + IC.bone + '</span></span>'; }
function cardHtml(n, q) {
  var p = prog(n.slug);
  var badge = p.weak ? '<span class="badge weak">Weak</span>' : p.revised ? '<span class="badge ok">Revised</span>' : '<span class="badge">Not revised</span>';
  return '<a class="card" href="#/t/' + n.slug + '">' + tile(n) + '<div class="cbody"><div class="card-top"><h3>' + esc(n.title) + '</h3>' + badge + '</div>' +
    '<p class="sum">' + esc(n.summary) + '</p><div class="tags">' + n.tags.map(function (t) { return '<span class="' + tagClass(t) + '">' + esc(tagLabel(t)) + '</span>'; }).join('') + '</div>' +
    (q ? '<div class="snip">' + snippet(n, q) + '</div>' : '') +
    (p.revised ? '<div class="meta">Revised ' + daysAgo(p.revised) + '</div>' : '') + '</div></a>';
}
function tabbar(active) {
  function t(href, key, icon, label) { return '<a class="tab' + (active === key ? ' on' : '') + '" href="' + href + '"><span class="ic">' + icon + '</span>' + label + '</a>'; }
  return '<nav class="tabbar">' + t('#/', 'home', IC.home, 'Home') + t('#/mine', 'mine', IC.mark, 'My Notes') + t('#/backup', 'more', IC.more, 'More') + '</nav>';
}

function homeView() {
  var list = NOTES.filter(function (n) {
    return (S.ui.filter === 'All' || n.tags.indexOf(S.ui.filter) >= 0) && (!S.ui.q || matches(n, S.ui.q));
  });
  var revised = NOTES.filter(function (n) { return prog(n.slug).revised; }).length;
  var weak = NOTES.filter(function (n) { return prog(n.slug).weak; }).length;
  var order = NOTES.filter(function (n) { return !prog(n.slug).revised; })
    .concat(NOTES.filter(function (n) { return prog(n.slug).revised; }).sort(function (a, b) { return prog(a.slug).revised - prog(b.slug).revised; }));
  var weakFirst = NOTES.filter(function (n) { return prog(n.slug).weak; })[0];
  var next = weakFirst || order[0];
  var h = '<div class="top"><div class="brandrow"><img class="logo" src="icons/icon-192.png" alt=""><div class="brand"><h1>Ortho<br>Notes</h1><p>' + NOTES.length + ' topics, OPD to OT</p></div></div>' +
    '<a class="btn sm" href="#/backup"><span class="ic">' + IC.save + '</span>Backup</a></div>';
  var standalone = window.navigator.standalone || (window.matchMedia && matchMedia('(display-mode: standalone)').matches);
  if (!standalone && !S.ui.hideA2HS && /iphone|ipad/i.test(navigator.userAgent)) {
    h += '<div class="a2hs"><b>Install:</b> tap Share, then <b>Add to Home Screen</b>.<br><button class="btn sm" data-act="hideA2HS">Got it</button></div>';
  }
  h += '<input class="search" id="q" type="search" placeholder="Search anything: ATFL, drop sign, Maigne" value="' + esc(S.ui.q) + '" autocomplete="off">';
  h += '<div class="chips">' + allTags().map(function (t) { return '<button class="chip ' + (t === 'All' ? '' : tagClass(t)) + (t === S.ui.filter ? ' on' : '') + '" data-filter="' + esc(t) + '">' + esc(tagLabel(t)) + '</button>'; }).join('') + '</div>';
  h += '<div class="stats"><div class="stat ok"><span class="ic">' + IC.book2 + '</span><div><b>' + revised + '/' + NOTES.length + '</b><span>Revised</span></div></div><div class="stat bad"><span class="ic">' + IC.warn + '</span><div><b>' + weak + '</b><span>Weak, revisit</span></div></div></div>';
  if (next && !S.ui.q) h += '<a class="next" href="#/t/' + next.slug + '"><span class="ic big">' + IC.bone + '</span><div><small>' + (weakFirst ? 'Marked weak' : prog(next.slug).revised ? 'Oldest revision' : 'Not revised yet') + '</small><b>' + esc(next.title) + '</b><em>Next topic for quick revision</em></div><span class="go ic">' + IC.arrow + '</span></a>';
  h += '<div class="list">';
  if (!list.length) h += '<div class="empty">Nothing matches. Try a shorter word.</div>';
  list.forEach(function (n) { h += cardHtml(n, S.ui.q); });
  h += '</div><div class="foot"><span>v ' + esc(window.NOTES_VERSION || '') + '</span><span>Study aid. Verify doses against your book.</span></div>';
  return h + tabbar('home');
}

function mineView() {
  var list = NOTES.filter(function (n) { var p = prog(n.slug); return p.weak || (p.note && p.note.trim()); });
  var h = '<div class="top"><div class="brand"><h1>My Notes</h1><p>Weak topics and topics where you wrote notes</p></div></div><div class="list">';
  if (!list.length) h += '<div class="empty">Nothing yet. Mark a topic weak or write a note inside a topic.</div>';
  list.forEach(function (n) {
    var p = prog(n.slug);
    h += cardHtml(n, '') .replace('<div class="meta">', '<div class="meta">') + (p.note && p.note.trim() ? '<div class="mynote">' + esc(p.note.trim().slice(0, 160)) + '</div>' : '');
  });
  return h + '</div>' + tabbar('mine');
}

function topicView(slug) {
  var idx = NOTES.findIndex(function (n) { return n.slug === slug; });
  if (idx < 0) return '<div class="empty">Topic not found.<br><a href="#/">Back</a></div>';
  var n = NOTES[idx], p = prog(slug), r = renderBody(n.body), mode = S.ui.mode;
  if (mode === 'revise' && !r.hasRevise) mode = 'full';
  if (mode === 'viva' && !r.hasViva) mode = 'full';
  p.opened = Date.now(); p.count = (p.count || 0) + 1; save();
  var prev = NOTES[idx - 1], nextN = NOTES[idx + 1];
  var h = '<div class="bar"><a class="back" href="#/"><span class="ic">' + IC.arrow + '</span>Topics</a><div class="barbtns">' +
    '<button class="pillbtn weak' + (p.weak ? ' on' : '') + '" data-act="weak" data-slug="' + slug + '">' + (p.weak ? 'Weak' : 'Mark weak') + '</button>' +
    '<button class="pillbtn ok' + (p.revised ? ' on' : '') + '" data-act="revised" data-slug="' + slug + '" data-top="1">' + (p.revised ? 'Revised' : 'Mark revised') + '</button></div></div>';
  h += '<div class="tags">' + n.tags.map(function (t) { return '<span class="' + tagClass(t) + '">' + esc(tagLabel(t)) + '</span>'; }).join('') + '</div>';
  h += '<h1 class="title">' + esc(n.title) + '</h1>';
  h += '<div class="seg"><button data-mode="full" class="' + (mode === 'full' ? 'on' : '') + '">Full</button><button data-mode="revise" class="' + (mode === 'revise' ? 'on' : '') + '">Revise</button><button data-mode="viva" class="' + (mode === 'viva' ? 'on' : '') + '">Viva</button></div>';
  if (mode === 'full') h += '<div class="toc">' + r.toc + '</div>';
  else h += '<p class="hint">' + (mode === 'revise' ? 'Quick rules only, for last-minute revision.' : 'Tap a question, answer aloud first, then open.') + '</p>';
  h += '<article class="art mode-' + mode + '">' + r.html + '</article>';
  h += '<div class="notes"><h2>My notes</h2><textarea id="note" placeholder="Pearls from ward rounds, OT, consultant…">' + esc(p.note || '') + '</textarea></div>';
  h += '<div class="actions"><button class="btn primary block" data-act="revised" data-slug="' + slug + '"><span class="ic">' + IC.check + '</span>' + (p.revised ? 'Revised ' + daysAgo(p.revised) + ', mark again' : 'Mark as revised') + '</button></div>';
  h += '<div class="pn">' + (prev ? '<a href="#/t/' + prev.slug + '"><small>&larr; Previous topic</small><b>' + esc(prev.title) + '</b></a>' : '<span></span>') +
    (nextN ? '<a class="next-r" href="#/t/' + nextN.slug + '"><small>Next topic &rarr;</small><b>' + esc(nextN.title) + '</b></a>' : '<span></span>') + '</div>';
  return h;
}

function backupView(msg, err) {
  return '<div class="top"><div class="brand"><h1>Backup</h1></div></div>' +
    '<p>The Home Screen app and Safari keep separate progress. Copy this text from one, paste into the other, tap Restore. Your notes and revised marks travel with it.</p>' +
    '<div class="backup"><textarea id="bk">' + esc(JSON.stringify({ progress: S.progress })) + '</textarea>' +
    '<div class="actions"><button class="btn block" data-act="copybk">Copy backup</button>' +
    '<button class="btn primary block" data-act="restore">Restore from pasted text</button></div>' +
    (msg ? '<p class="msg' + (err ? ' err' : '') + '">' + esc(msg) + '</p>' : '') + '</div>' +
    '<p class="hint">To restore, clear the box, paste the backup there, then tap Restore.</p>' + tabbar('more');
}

/* ---------- router ---------- */
function render() {
  var hash = location.hash || '#/', m;
  var scroll = 0;
  if ((m = hash.match(/^#\/t\/(.+)$/))) $app.innerHTML = topicView(decodeURIComponent(m[1]));
  else if (hash === '#/backup') $app.innerHTML = backupView();
  else if (hash === '#/mine') $app.innerHTML = mineView();
  else $app.innerHTML = homeView();
  window.scrollTo(0, scroll);
}
function rerenderKeepScroll() { var y = window.scrollY; var h = location.hash || '#/'; var m; if ((m = h.match(/^#\/t\/(.+)$/))) { var p = prog(m[1]); var o = p.count; $app.innerHTML = topicView(decodeURIComponent(m[1])); prog(m[1]).count = o; save(); } else if (h === '#/mine') $app.innerHTML = mineView(); else if (h === '#/backup') $app.innerHTML = backupView(); else $app.innerHTML = homeView(); window.scrollTo(0, y); }
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
  else if (act === 'revised') { var q = prog(slug); q.revised = q.revised && t.dataset.top ? null : Date.now(); if (q.revised) q.weak = false; save(); rerenderKeepScroll(); }
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
