/* Tap a page chip -> opens that page of YOUR Campbell PDF (kept only on this device). */
(function () {
  var BOOKS = { tka: { id: 'knee', name: 'Knee Arthroplasty', off: 405 }, tha: { id: 'hip', name: 'Hip Arthroplasty', off: 177 } };
  var pdfjs = null, doc = null, docBook = '', cur = 0, book = null, bookPg = 1, scale = 1, task = null, ov = null;

  function idb() {
    return new Promise(function (res, rej) {
      var r = indexedDB.open('ortho-books', 1);
      r.onupgradeneeded = function () { r.result.createObjectStore('b'); };
      r.onsuccess = function () { res(r.result); }; r.onerror = function () { rej(r.error); };
    });
  }
  function getBlob(id) { return idb().then(function (d) { return new Promise(function (res, rej) { var q = d.transaction('b').objectStore('b').get(id); q.onsuccess = function () { res(q.result || null); }; q.onerror = function () { rej(q.error); }; }); }); }
  function putBlob(id, blob) { return idb().then(function (d) { return new Promise(function (res, rej) { var t = d.transaction('b', 'readwrite'); t.objectStore('b').put(blob, id); t.oncomplete = res; t.onerror = function () { rej(t.error); }; }); }); }
  function loadLib() {
    if (pdfjs) return Promise.resolve(pdfjs);
    return new Promise(function (res, rej) {
      var s = document.createElement('script'); s.src = 'vendor/pdf.min.js';
      s.onload = function () { pdfjs = window.pdfjsLib; pdfjs.GlobalWorkerOptions.workerSrc = 'vendor/pdf.worker.min.js'; res(pdfjs); };
      s.onerror = function () { rej(new Error('pdf viewer failed to load (offline?)')); }; document.head.appendChild(s);
    });
  }
  function currentBook() {
    var m = (location.hash || '').match(/^#\/t\/([^?]+)/); if (!m || !window.NOTES) return null;
    var slug = decodeURIComponent(m[1]), n = window.NOTES.filter(function (x) { return x.slug === slug; })[0];
    return n ? BOOKS[n.parent || n.slug] || null : null;
  }
  function close() { if (task) { try { task.cancel(); } catch (e) {} } if (ov) { ov.remove(); ov = null; } document.body.style.overflow = ''; }
  function msg(html) { var b = ov.querySelector('.pv-body'); b.innerHTML = html; }

  function open(pg) {
    book = currentBook(); bookPg = pg;
    close(); document.body.style.overflow = 'hidden';
    ov = document.createElement('div'); ov.className = 'pv';
    ov.innerHTML = '<div class="pv-bar"><b class="pv-t"></b><span class="pv-sp"></span><button data-pv="zo">&minus;</button><button data-pv="zi">+</button><button data-pv="x">Close</button></div>' +
      '<div class="pv-body"></div><div class="pv-nav"><button data-pv="pv">&larr; Prev</button><span class="pv-lbl"></span><button data-pv="nx">Next &rarr;</button></div>';
    document.body.appendChild(ov);
    ov.addEventListener('click', function (e) {
      var a = e.target.getAttribute && e.target.getAttribute('data-pv'); if (!a) return;
      if (a === 'x') close(); else if (a === 'zi') { scale = Math.min(3, scale + 0.25); show(); } else if (a === 'zo') { scale = Math.max(0.6, scale - 0.25); show(); }
      else if (a === 'pv') { bookPg--; show(); } else if (a === 'nx') { bookPg++; show(); }
    });
    if (!book) { ov.querySelector('.pv-t').textContent = 'Book page'; msg('<p class="pv-m">Is topic ke liye book mapped nahi hai.</p>'); return; }
    ov.querySelector('.pv-t').textContent = 'Campbell: ' + book.name;
    getBlob(book.id).then(function (b) { if (!b) return ask(); return use(b); }).catch(function (e) { msg('<p class="pv-m">' + String(e.message || e) + '</p>'); });
  }
  function ask() {
    msg('<div class="pv-m"><p><b>' + book.name + '</b> ka PDF ek baar choose karo.</p><p>Ye sirf is phone/laptop me save hota hai (repo ya internet par upload nahi hota).</p><label class="pv-file">Choose PDF<input type="file" accept="application/pdf" hidden></label></div>');
    ov.querySelector('input').addEventListener('change', function (e) {
      var f = e.target.files[0]; if (!f) return; msg('<p class="pv-m">Saving&hellip;</p>');
      putBlob(book.id, f).then(function () { doc = null; docBook = ''; return use(f); }).catch(function (er) { msg('<p class="pv-m">' + er.message + '</p>'); });
    });
  }
  function use(blob) {
    if (doc && docBook === book.id) return show();
    msg('<p class="pv-m">Opening&hellip;</p>');
    return Promise.all([loadLib(), blob.arrayBuffer()]).then(function (r) { return r[0].getDocument({ data: r[1] }).promise; }).then(function (d) { doc = d; docBook = book.id; return show(); });
  }
  function show() {
    if (!doc || !ov) return; var n = bookPg - book.off;
    if (n < 1 || n > doc.numPages) { bookPg = Math.min(Math.max(bookPg, 1 + book.off), doc.numPages + book.off); n = bookPg - book.off; }
    ov.querySelector('.pv-lbl').innerHTML = 'Book p.' + bookPg + ' <small>(PDF p.' + n + ')</small>';
    return doc.getPage(n).then(function (p) {
      var body = ov.querySelector('.pv-body'), w = body.clientWidth || 360, v0 = p.getViewport({ scale: 1 }), s = (w / v0.width) * scale, dpr = window.devicePixelRatio || 1;
      var v = p.getViewport({ scale: s * dpr }), c = document.createElement('canvas'); c.width = v.width; c.height = v.height; c.style.width = (v.width / dpr) + 'px'; c.style.height = (v.height / dpr) + 'px';
      if (task) { try { task.cancel(); } catch (e) {} }
      task = p.render({ canvasContext: c.getContext('2d'), viewport: v });
      return task.promise.then(function () { body.innerHTML = ''; body.appendChild(c); body.scrollTop = 0; }).catch(function () {});
    });
  }
  document.addEventListener('click', function (e) {
    var t = e.target.closest && e.target.closest('.pg[data-pg]'); if (!t) return;
    e.preventDefault(); e.stopPropagation(); open(parseInt(t.getAttribute('data-pg'), 10));
  }, true);
  document.addEventListener('keydown', function (e) { if (ov && e.key === 'Escape') close(); });
})();
