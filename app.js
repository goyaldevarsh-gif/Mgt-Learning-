(function () {
'use strict';
var NOTES = window.NOTES || [];
var KEY = 'ortho-notes-v1';
var $app = document.getElementById('main');
function isDesk() { return !!(window.matchMedia && matchMedia('(min-width: 960px)').matches); }

/* ---------- storage ---------- */
var S = { progress: {}, ui: { q: '', filter: 'All', mode: 'full', hideA2HS: false } };
try {
  var raw = localStorage.getItem(KEY);
  if (raw) { var p = JSON.parse(raw); S.progress = p.progress || {}; S.ui = Object.assign(S.ui, p.ui || {}); }
} catch (e) {}
S.ui.q = '';
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
  search: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/></svg>',
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
  s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
  s = s.replace(/\[\[(p\.(\d+)[^\]]*)\]\]/g, '<span class="pg" role="button" tabindex="0" data-pg="$2">$1</span>');
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
    if ((m = l.match(/^!\[(.*?)\]\((.+?)\)\s*$/))) { out += '<figure class="fig"><img loading="lazy" src="' + m[2] + '" alt="' + esc(m[1]) + '"><figcaption>' + inline(m[1]) + '</figcaption></figure>'; i++; continue; }
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

/* ---------- search engine ---------- */
var LEAF = 'h2,h3,p,li,tr,summary,.fb';
var IDX = null, expanded = {};
function ownText(el) {
  var c = el.cloneNode(true);
  var nested = c.querySelectorAll('ul,ol');
  for (var i = 0; i < nested.length; i++) nested[i].remove();
  return c.textContent.replace(/\s+/g, ' ').trim();
}
function buildIndex() {
  if (IDX) return IDX;
  IDX = [];
  var holder = document.createElement('div');
  NOTES.forEach(function (n) {
    holder.innerHTML = renderBody(n.body).html;
    var sec = '';
    var els = holder.querySelectorAll(LEAF);
    for (var i = 0; i < els.length; i++) {
      var el = els[i], tag = el.tagName;
      if (tag === 'H2') sec = el.textContent.trim();
      var t = ownText(el);
      if (!t) continue;
      IDX.push({ slug: n.slug, topic: n.title, tags: n.tags.join(' '), sec: sec, idx: i, text: t, head: tag === 'H2' || tag === 'H3' });
    }
  });
  return IDX;
}
function qTerms(q) {
  var seen = {}, out = [];
  q.toLowerCase().split(/\s+/).forEach(function (t) {
    t = t.replace(/[^a-z0-9]/g, '');
    if (t && !seen[t]) { seen[t] = 1; out.push(t); }
  });
  return out;
}
function termRe(t) { return new RegExp(t.split('').join("['’\\-\\s]?"), 'i'); }
function scoreChunk(c, res, q) {
  var sc = 0, textHits = 0;
  for (var i = 0; i < res.length; i++) {
    if (res[i].test(c.text)) { sc += 3; textHits++; }
    else if (res[i].test(c.sec)) sc += 2;
    else if (res[i].test(c.topic + ' ' + c.tags)) sc += 1;
    else return 0;
  }
  if (!textHits) return 0;
  if (c.head) sc += 2;
  if (res.length > 1 && c.text.toLowerCase().indexOf(q.trim().toLowerCase()) >= 0) sc += 4;
  return sc;
}
function hlHtml(raw, res) {
  var src = res.map(function (r) { return r.source; }).join('|');
  var re = new RegExp(src, 'gi'), out = '', last = 0, m;
  while ((m = re.exec(raw))) {
    if (!m[0]) { re.lastIndex++; continue; }
    out += esc(raw.slice(last, m.index)) + '<mark>' + esc(m[0]) + '</mark>';
    last = re.lastIndex;
  }
  return out + esc(raw.slice(last));
}
function snipOf(c, res) {
  var pos = -1;
  for (var i = 0; i < res.length; i++) { var m = c.text.match(res[i]); if (m && (pos < 0 || m.index < pos)) pos = m.index; }
  var from = Math.max(0, pos - 50), raw = c.text.slice(from, from + 170);
  return (from > 0 ? '…' : '') + hlHtml(raw, res) + (from + 170 < c.text.length ? '…' : '');
}
function runSearch(q) {
  var terms = qTerms(q);
  if (!terms.length) return null;
  var res = terms.map(termRe), groups = {}, order = [], total = 0;
  buildIndex().forEach(function (c) {
    var sc = scoreChunk(c, res, q);
    if (!sc) return;
    if (!groups[c.slug]) { groups[c.slug] = { slug: c.slug, topic: c.topic, hits: [], best: 0 }; order.push(groups[c.slug]); }
    var g = groups[c.slug];
    g.hits.push({ c: c, sc: sc });
    if (sc > g.best) g.best = sc;
    total++;
  });
  order.forEach(function (g) { g.hits.sort(function (a, b) { return b.sc - a.sc || a.c.idx - b.c.idx; }); });
  order.sort(function (a, b) { return b.best - a.best || b.hits.length - a.hits.length; });
  return { groups: order, total: total, res: res };
}
function resultsHtml(q) {
  var r = runSearch(q);
  if (!r) return '';
  if (!r.total) return '<div class="empty">Kuch nahi mila for “' + esc(q) + '”.<br>Chhota ya alag word try karo.</div>';
  var h = '<p class="rcount">' + r.total + ' match' + (r.total > 1 ? 'es' : '') + ' in ' + r.groups.length + ' topic' + (r.groups.length > 1 ? 's' : '') + '</p>';
  r.groups.forEach(function (g) {
    var n = NOTES.filter(function (x) { return x.slug === g.slug; })[0], open = expanded[g.slug];
    var show = open ? g.hits : g.hits.slice(0, 4);
    h += '<div class="group"><a class="ghead" href="#/t/' + g.slug + '">' + tile(n) + '<div><b>' + esc(g.topic) + '</b><small>' + g.hits.length + ' match' + (g.hits.length > 1 ? 'es' : '') + '</small></div></a>';
    show.forEach(function (x) {
      h += '<a class="hit" data-hit="1" href="#/t/' + g.slug + '?q=' + encodeURIComponent(q.trim()) + '&i=' + x.c.idx + '"><span class="sec">' + esc(x.c.sec || 'Intro') + '</span><span class="snip">' + snipOf(x.c, r.res) + '</span></a>';
    });
    if (g.hits.length > 4) h += '<button class="more" data-more="' + g.slug + '">' + (open ? 'Show less' : 'Show ' + (g.hits.length - 4) + ' more') + '</button>';
    h += '</div>';
  });
  return h;
}
var SUGGEST = ['x-ray', 'Ottawa', 'Jahss', 'Horii', 'Maigne', 'West Point', 'Palmer', 'Broström', 'drop sign', 'Tendocare'];
function emptySearchHtml() {
  var h = '';
  if (S.ui.recent && S.ui.recent.length) h += '<p class="rcount">Recent</p><div class="sugg">' + S.ui.recent.map(function (t) { return '<button class="chip" data-q="' + esc(t) + '">' + esc(t) + '</button>'; }).join('') + '</div>';
  h += '<p class="rcount">Try</p><div class="sugg">' + SUGGEST.map(function (t) { return '<button class="chip" data-q="' + esc(t) + '">' + esc(t) + '</button>'; }).join('') + '</div>';
  return h;
}

/* ---------- find inside topic ---------- */
var FIND = { els: [], cur: 0 };
function clearFind() {
  var art = document.querySelector('.art');
  if (art) {
    var ms = art.querySelectorAll('mark.hl');
    for (var i = 0; i < ms.length; i++) ms[i].replaceWith(document.createTextNode(ms[i].textContent));
    art.normalize();
    var cs = art.querySelectorAll('.cur');
    for (var j = 0; j < cs.length; j++) cs[j].classList.remove('cur');
  }
  var fb = document.getElementById('findbar'); if (fb) fb.remove();
  FIND = { els: [], cur: 0 };
}
function wrapMarks(el, res) {
  var src = res.map(function (r) { return r.source; }).join('|');
  var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null), nodes = [], n;
  while ((n = walker.nextNode())) {
    if (n.parentElement.closest('mark.hl')) continue;
    if (n.parentElement.closest(LEAF) !== el) continue;
    nodes.push(n);
  }
  nodes.forEach(function (node) {
    var s = node.nodeValue, re = new RegExp(src, 'gi'), last = 0, m, frag = document.createDocumentFragment(), any = false;
    while ((m = re.exec(s))) {
      if (!m[0]) { re.lastIndex++; continue; }
      any = true;
      if (m.index > last) frag.appendChild(document.createTextNode(s.slice(last, m.index)));
      var mk = document.createElement('mark'); mk.className = 'hl'; mk.textContent = m[0]; frag.appendChild(mk);
      last = re.lastIndex;
    }
    if (!any) return;
    if (last < s.length) frag.appendChild(document.createTextNode(s.slice(last)));
    node.replaceWith(frag);
  });
}
function gotoFind(k) {
  if (!FIND.els.length) return;
  FIND.cur = (k + FIND.els.length) % FIND.els.length;
  FIND.els.forEach(function (e) { e.classList.remove('cur'); });
  var el = FIND.els[FIND.cur];
  el.classList.add('cur');
  var d = el.closest('details'); if (d) d.open = true;
  el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  var lab = document.getElementById('findcount');
  if (lab) lab.textContent = (FIND.cur + 1) + ' / ' + FIND.els.length;
}
function applyFind(q, startIdx) {
  var art = document.querySelector('.art');
  var terms = qTerms(q);
  if (!art || !terms.length) return;
  var res = terms.map(termRe), els = art.querySelectorAll(LEAF), sec = '', n = NOTES.filter(function (x) { return x.slug === parseHash().slug; })[0];
  var hits = [], startPos = 0;
  for (var i = 0; i < els.length; i++) {
    var el = els[i];
    if (el.tagName === 'H2') sec = el.textContent.trim();
    var c = { text: ownText(el), sec: sec, topic: n ? n.title : '', tags: n ? n.tags.join(' ') : '', head: el.tagName === 'H2' || el.tagName === 'H3' };
    if (c.text && scoreChunk(c, res, q) > 0) { if (i === startIdx) startPos = hits.length; hits.push(el); }
  }
  if (!hits.length) return;
  hits.forEach(function (el) { wrapMarks(el, res); });
  FIND.els = hits;
  var bar = document.createElement('div');
  bar.id = 'findbar'; bar.className = 'findbar';
  bar.innerHTML = '<button data-find="close" aria-label="Close">✕</button><span class="fq">' + esc(q) + '</span><span id="findcount"></span><button data-find="prev" aria-label="Previous">▲</button><button data-find="next" aria-label="Next">▼</button>';
  document.body.appendChild(bar);
  setTimeout(function () { gotoFind(startPos); }, 60);
}
function parseHash() {
  var h = location.hash || '#/';
  var m = h.match(/^#\/t\/([^?]+)(?:\?(.*))?$/);
  if (m) {
    var o = { view: 'topic', slug: decodeURIComponent(m[1]), q: '', i: -1 };
    (m[2] || '').split('&').forEach(function (kv) {
      var a = kv.split('=');
      if (a[0] === 'q') o.q = decodeURIComponent(a[1] || '');
      if (a[0] === 'i') o.i = parseInt(a[1], 10);
    });
    return o;
  }
  if (h === '#/backup') return { view: 'backup' };
  if (h === '#/mine') return { view: 'mine' };
  return { view: 'home' };
}

function tile(n) { return '<span class="tile ' + tagClass(n.tags[0] || '') + '"><span class="ic">' + IC.bone + '</span></span>'; }
function cardHtml(n, q) {
  var p = prog(n.slug);
  var badge = p.weak ? '<span class="badge weak">Weak</span>' : p.revised ? '<span class="badge ok">Revised</span>' : '<span class="badge">Not revised</span>';
  var kc = NOTES.filter(function (x) { return x.parent === n.slug; }).length;
  if (kc) badge = '<span class="badge">' + kc + ' topics</span>';
  return '<a class="card" href="#/t/' + n.slug + '">' + tile(n) + '<div class="cbody"><div class="card-top"><h3>' + esc(n.title) + '</h3>' + badge + '</div>' +
    '<p class="sum">' + esc(n.summary) + '</p><div class="tags">' + n.tags.map(function (t) { return '<span class="' + tagClass(t) + '">' + esc(tagLabel(t)) + '</span>'; }).join('') + '</div>' +
    (p.revised ? '<div class="meta">Revised ' + daysAgo(p.revised) + '</div>' : '') + '</div></a>';
}
function tabbar(active) {
  function t(href, key, icon, label) { return '<a class="tab' + (active === key ? ' on' : '') + '" href="' + href + '"><span class="ic">' + icon + '</span>' + label + '</a>'; }
  return '<nav class="tabbar">' + t('#/', 'home', IC.home, 'Home') + '<a class="tab" href="#/" data-searchtab="1"><span class="ic">' + IC.search + '</span>Search</a>' + t('#/mine', 'mine', IC.mark, 'My Notes') + t('#/backup', 'more', IC.more, 'More') + '</nav>';
}

function homeView() {
  var searching = !!S.ui.q.trim() && !isDesk();
  var list = NOTES.filter(function (n) { return !n.parent && (S.ui.filter === 'All' || n.tags.indexOf(S.ui.filter) >= 0); });
  var revised = NOTES.filter(function (n) { return prog(n.slug).revised; }).length;
  var weak = NOTES.filter(function (n) { return prog(n.slug).weak; }).length;
  var order = NOTES.filter(function (n) { return !prog(n.slug).revised; })
    .concat(NOTES.filter(function (n) { return prog(n.slug).revised; }).sort(function (a, b) { return prog(a.slug).revised - prog(b.slug).revised; }));
  var weakFirst = NOTES.filter(function (n) { return prog(n.slug).weak; })[0];
  var next = weakFirst || order[0];
  var h = '<div class="top home-top"><div class="brandrow"><img class="logo" src="icons/icon-192.png" alt=""><div class="brand"><h1>Ortho<br>Notes</h1><p>' + NOTES.length + ' topics, OPD to OT</p></div></div>' +
    '<a class="btn sm" href="#/backup"><span class="ic">' + IC.save + '</span>Backup</a></div>';
  var standalone = window.navigator.standalone || (window.matchMedia && matchMedia('(display-mode: standalone)').matches);
  if (!standalone && !S.ui.hideA2HS && /iphone|ipad/i.test(navigator.userAgent)) {
    h += '<div class="a2hs"><b>Install:</b> tap Share, then <b>Add to Home Screen</b>.<br><button class="btn sm" data-act="hideA2HS">Got it</button></div>';
  }
  h += '<div class="searchwrap"><span class="ic sic">' + IC.search + '</span><input class="search" id="q" type="text" inputmode="search" enterkeyhint="search" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="Search anything: boxers xray, Ottawa, drop sign" value="' + esc(S.ui.q) + '" autocomplete="off">' +
    (searching ? '<button class="clear" data-clear="1" aria-label="Clear">\u2715</button>' : '') + '</div>';
  if (searching) return h + '<div id="results">' + resultsHtml(S.ui.q) + '</div>' + tabbar('home');
  h += '<div class="chips">' + allTags().map(function (t) { return '<button class="chip ' + (t === 'All' ? '' : tagClass(t)) + (t === S.ui.filter ? ' on' : '') + '" data-filter="' + esc(t) + '">' + esc(tagLabel(t)) + '</button>'; }).join('') + '</div>';
  h += '<div class="stats"><div class="stat ok"><span class="ic">' + IC.book2 + '</span><div><b>' + revised + '/' + NOTES.length + '</b><span>Revised</span></div></div><div class="stat bad"><span class="ic">' + IC.warn + '</span><div><b>' + weak + '</b><span>Weak, revisit</span></div></div></div>';
  if (next) h += '<a class="next" href="#/t/' + next.slug + '"><span class="ic big">' + IC.bone + '</span><div><small>' + (weakFirst ? 'Marked weak' : prog(next.slug).revised ? 'Oldest revision' : 'Not revised yet') + '</small><b>' + esc(next.title) + '</b><em>Next topic for quick revision</em></div><span class="go ic">' + IC.arrow + '</span></a>';
  h += '<div class="list">';
  list.forEach(function (n) { h += cardHtml(n); });
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

function topicView(slug, quiet) {
  var idx = NOTES.findIndex(function (n) { return n.slug === slug; });
  if (idx < 0) return '<div class="empty">Topic not found.<br><a href="#/">Back</a></div>';
  var n = NOTES[idx], p = prog(slug), r = renderBody(n.body), mode = S.ui.mode;
  if (mode === 'revise' && !r.hasRevise) mode = 'full';
  if (mode === 'viva' && !r.hasViva) mode = 'full';
  if (!quiet) { p.opened = Date.now(); p.count = (p.count || 0) + 1; save(); }
  var sib = NOTES.filter(function (x) { return (x.parent || '') === (n.parent || ''); }), si = sib.indexOf(n);
  var prev = sib[si - 1], nextN = sib[si + 1], par = n.parent ? NOTES.filter(function (x) { return x.slug === n.parent; })[0] : null;
  var kids = NOTES.filter(function (x) { return x.parent === n.slug; });
  var h = '<div class="bar"><a class="back" href="' + (par ? '#/t/' + par.slug : '#/') + '"><span class="ic">' + IC.arrow + '</span>' + (par ? esc(par.title) : 'Topics') + '</a><div class="barbtns">' +
    '<button class="pillbtn weak' + (p.weak ? ' on' : '') + '" data-act="weak" data-slug="' + slug + '">' + (p.weak ? 'Weak' : 'Mark weak') + '</button>' +
    '<button class="pillbtn ok' + (p.revised ? ' on' : '') + '" data-act="revised" data-slug="' + slug + '" data-top="1">' + (p.revised ? 'Revised' : 'Mark revised') + '</button></div></div>';
  h += '<div class="tags">' + n.tags.map(function (t) { return '<span class="' + tagClass(t) + '">' + esc(tagLabel(t)) + '</span>'; }).join('') + '</div>';
  h += '<h1 class="title">' + esc(n.title) + '</h1>';
  h += '<div class="seg"><button data-mode="full" class="' + (mode === 'full' ? 'on' : '') + '">Full</button><button data-mode="revise" class="' + (mode === 'revise' ? 'on' : '') + '">Revise</button><button data-mode="viva" class="' + (mode === 'viva' ? 'on' : '') + '">Viva</button></div>';
  if (mode === 'full') h += '<div class="toc">' + r.toc + '</div>';
  else h += '<p class="hint">' + (mode === 'revise' ? 'Quick rules only, for last-minute revision.' : 'Tap a question, answer aloud first, then open.') + '</p>';
  h += '<article class="art mode-' + mode + '">' + r.html + '</article>';
  if (kids.length) h += '<h2 class="subhead">Sub-topics</h2><div class="list">' + kids.map(function (k) { return cardHtml(k); }).join('') + '</div>';
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

/* ---------- desktop sidebar ---------- */
function sideBodyHtml() {
  var q = S.ui.q.trim();
  if (q) return resultsHtml(S.ui.q);
  var cur = parseHash().slug;
  var h = '<div class="chips">' + allTags().map(function (t) { return '<button class="chip ' + (t === 'All' ? '' : tagClass(t)) + (t === S.ui.filter ? ' on' : '') + '" data-filter="' + esc(t) + '">' + esc(tagLabel(t)) + '</button>'; }).join('') + '</div><div class="slist">';
  var curN = NOTES.filter(function (x) { return x.slug === cur; })[0], fam = curN ? (curN.parent || curN.slug) : '';
  NOTES.filter(function (n) { return (S.ui.filter === 'All' || n.tags.indexOf(S.ui.filter) >= 0) && (!n.parent || n.parent === fam); }).forEach(function (n) {
    var pr = prog(n.slug);
    h += '<a class="sitem' + (n.parent ? ' sub' : '') + (n.slug === cur ? ' on' : '') + '" href="#/t/' + n.slug + '">' + tile(n) + '<span class="st"><b>' + esc(n.title) + '</b><small>' + n.tags.map(tagLabel).join(' · ') + '</small></span>' + (pr.weak ? '<i class="dot weak" title="Weak"></i>' : pr.revised ? '<i class="dot ok" title="Revised"></i>' : '') + '</a>';
  });
  return h + '</div>';
}
function renderSide() {
  var side = document.getElementById('side');
  if (!side || !isDesk()) return;
  var st = side.scrollTop, hasQ = !!S.ui.q.trim();
  side.innerHTML = '<a class="sbrand" href="#/"><img class="logo" src="icons/icon-192.png" alt=""><span><b>Ortho Notes</b><small>' + NOTES.length + ' topics · OPD to OT</small></span></a>' +
    '<div class="searchwrap"><span class="ic sic">' + IC.search + '</span><input class="search" id="sq" type="text" inputmode="search" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="Search anything   ( / )" value="' + esc(S.ui.q) + '" autocomplete="off"><button class="clear" data-clear="1" aria-label="Clear"' + (hasQ ? '' : ' hidden') + '>✕</button></div>' +
    '<div id="sresults" class="sresults">' + sideBodyHtml() + '</div>' +
    '<nav class="snav"><a href="#/">Home</a><a href="#/mine">My Notes</a><a href="#/backup">Backup</a><span>v ' + esc(window.NOTES_VERSION || '') + '</span></nav>';
  side.scrollTop = st;
}

/* ---------- router ---------- */
function draw(quiet) {
  clearFind();
  var h = parseHash();
  if (h.view === 'topic') $app.innerHTML = topicView(h.slug, quiet);
  else if (h.view === 'backup') $app.innerHTML = backupView();
  else if (h.view === 'mine') $app.innerHTML = mineView();
  else $app.innerHTML = homeView();
  renderSide();
  return h;
}
function render() {
  var h = draw(false);
  window.scrollTo(0, 0);
  if (h.view === 'topic' && h.q) applyFind(h.q, h.i);
}
function rerenderKeepScroll() {
  var y = window.scrollY, h = draw(true);
  window.scrollTo(0, y);
  if (h.view === 'topic' && h.q) applyFind(h.q, -1);
}
window.addEventListener('hashchange', render);

document.addEventListener('click', function (e) {
  var hit = e.target.closest('[data-hit]');
  if (hit) { S.ui.mode = 'full'; var rq = S.ui.q.trim(); if (rq) { S.ui.recent = [rq].concat((S.ui.recent || []).filter(function (x) { return x !== rq; })).slice(0, 6); } save(); return; }
  var t = e.target.closest('[data-filter],[data-mode],[data-act],[data-jump],[data-more],[data-q],[data-clear],[data-find],[data-searchtab]');
  if (!t) return;
  if (t.dataset.searchtab) {
    e.preventDefault();
    if (location.hash !== '' && location.hash !== '#/') location.hash = '#/';
    S.ui.filter = 'All'; draw(true); window.scrollTo(0, 0);
    var qi = document.getElementById(isDesk() ? 'sq' : 'q'); if (qi) { qi.focus(); qi.select(); }
    return;
  }
  if (t.dataset.more) {
    expanded[t.dataset.more] = !expanded[t.dataset.more];
    if (isDesk()) { var sr0 = document.getElementById('sresults'); if (sr0) sr0.innerHTML = sideBodyHtml(); return; }
    var y0 = window.scrollY; $app.innerHTML = homeView(); window.scrollTo(0, y0); return;
  }
  if (t.dataset.q) { S.ui.q = t.dataset.q; save(); if (isDesk()) renderSide(); else { $app.innerHTML = homeView(); window.scrollTo(0, 0); } return; }
  if (t.dataset.clear) {
    S.ui.q = ''; save();
    if (isDesk()) { renderSide(); var sq0 = document.getElementById('sq'); if (sq0) sq0.focus(); return; }
    $app.innerHTML = homeView(); var q2 = document.getElementById('q'); if (q2) q2.focus(); return;
  }
  if (t.dataset.find) {
    if (t.dataset.find === 'next') gotoFind(FIND.cur + 1);
    else if (t.dataset.find === 'prev') gotoFind(FIND.cur - 1);
    else { clearFind(); history.replaceState(null, '', '#/t/' + parseHash().slug); }
    return;
  }
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

var typingTimer = null;
document.addEventListener('input', function (e) {
  if (e.target.id === 'sq') {
    S.ui.q = e.target.value; save();
    clearTimeout(typingTimer);
    typingTimer = setTimeout(function () {
      var sr = document.getElementById('sresults'); if (sr) sr.innerHTML = sideBodyHtml();
      var cb = document.querySelector('#side .clear'); if (cb) cb.hidden = !S.ui.q.trim();
    }, 90);
  } else if (e.target.id === 'q') {
    S.ui.q = e.target.value; save();
    clearTimeout(typingTimer);
    var pos = e.target.selectionStart;
    typingTimer = setTimeout(function () {
      var was = !!document.getElementById('results'), now = !!S.ui.q.trim();
      if (was && now) { document.getElementById('results').innerHTML = resultsHtml(S.ui.q); }
      else {
        $app.innerHTML = homeView();
        var q = document.getElementById('q'); if (q) { q.focus(); q.setSelectionRange(pos, pos); }
      }
    }, 90);
  } else if (e.target.id === 'note') {
    var h = parseHash();
    if (h.view === 'topic') { prog(h.slug).note = e.target.value; save(); }
  }
});

document.addEventListener('keydown', function (e) {
  var tag = (e.target.tagName || '').toLowerCase(), typing = tag === 'input' || tag === 'textarea';
  if (e.key === '/' && !typing && !e.metaKey && !e.ctrlKey) {
    var si = document.getElementById(isDesk() ? 'sq' : 'q');
    if (si) { e.preventDefault(); si.focus(); si.select(); }
  } else if (e.key === 'Escape') {
    if (typing && (e.target.id === 'sq' || e.target.id === 'q')) {
      S.ui.q = ''; save(); e.target.blur();
      if (isDesk()) renderSide(); else $app.innerHTML = homeView();
    } else if (FIND.els.length) { clearFind(); history.replaceState(null, '', '#/t/' + parseHash().slug); }
  } else if (!typing && FIND.els.length && (e.key === 'n' || e.key === 'N' || e.key === 'Enter')) {
    e.preventDefault();
    gotoFind(FIND.cur + (e.shiftKey || e.key === 'N' ? -1 : 1));
  }
});
if (window.matchMedia) {
  var mq = matchMedia('(min-width: 960px)');
  if (mq.addEventListener) mq.addEventListener('change', function () { render(); });
  else if (mq.addListener) mq.addListener(function () { render(); });
}

render();

if ('serviceWorker' in navigator) {
  var hadCtl = !!navigator.serviceWorker.controller, reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', function () {
    if (!hadCtl) { hadCtl = true; return; }
    if (reloaded) return; reloaded = true;
    var el = document.activeElement, typing = el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA');
    if (typing) return;
    location.reload();
  });
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then(function (reg) {
      reg.update();
      document.addEventListener('visibilitychange', function () { if (!document.hidden) reg.update(); });
      setInterval(function () { reg.update(); }, 5 * 60 * 1000);
    }).catch(function () {});
  });
}
})();
