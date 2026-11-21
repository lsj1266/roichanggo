/* =========================================================
 * 로이창고 상품 수집기 — percenty.js
 *  퍼센티(www.percenty.co.kr) '신규 상품 등록' 목록(/product-register) 전용 수집기
 *
 *  ■ 실제 화면에서 확인한 구조 (2026-11-21 검증)
 *    - 행 컨테이너 : div.ant-row-no-wrap.ant-row-stretch  (텍스트에 '상품 ID' 포함)
 *    - 행 텍스트   : 상품명 / 판매가 / 배송비 / 해외 배송비 / 상품원가 / 환율 / 상품 ID / 그룹 / 등록일
 *    - 대표이미지  : img[src*="/products/<상품ID>/"]
 *    - 페이지 이동 : .ant-pagination-item-active  (현재 페이지, title 속성)
 *                    .ant-pagination-next         (다음 페이지)
 *                    .ant-pagination-options-quick-jumper input  (번호 입력 후 Enter)
 *    - 보기 개수   : 20개씩 / 50개씩  (50개씩 = 38,534건 → 771페이지)
 *    - 목록은 스크롤할 때마다 아래 행이 붙는 방식 → 페이지마다 끝까지 스크롤하며 모음
 *    - 목록에는 원문(타오바오 등) 링크가 노출되지 않음 → 상품 ID 로 식별
 *
 *  ■ 기능
 *    1) 현재 페이지 담기 / 선택한 행만 담기  → 수집함(collectedProducts)
 *    2) 범위(시작~끝 페이지) 자동 수집 / 전체 자동 수집
 *       - 500건 단위로 JSON 파일 자동 저장 + chrome.storage.local 에 분할 보관
 *       - 일시정지 / 이어서 / 중단, 진행률·남은 시간 표시, 중단 후 이어서 수집
 * ========================================================= */
(function () {
  'use strict';

  if (window.__loiPercentyLoaded) return;
  window.__loiPercentyLoaded = true;
  if (window.top !== window.self) return;

  var HOST = String(location.hostname || '').toLowerCase();
  if (!/(^|\.)percenty\.co\.kr$/.test(HOST)) return;

  var LIST_PATH = '/product-register';
  var CHUNK_SIZE = 500;          // 분할 저장 단위 (건)
  var ROOT_ID = 'loi-pct-root';
  var TOAST_ID = 'loi-pct-toast';
  var PRODUCTS_KEY = 'collectedProducts';
  var IDX_KEY = 'percentyBulkIndex';      // [{key, session, seq, count, at, file}]
  var STATE_KEY = 'percentyBulkState';    // 진행 상태(중단 후 이어서 수집용)

  var SRC = 'percenty';
  var SRC_LABEL = '퍼센티';

  /* ---------------------------------------------------------
   * 공통 유틸
   * ------------------------------------------------------- */
  function sleep(ms) {
    return new Promise(function (r) { setTimeout(r, ms); });
  }

  function clean(s) {
    return String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
  }

  function num(raw) {
    var m = String(raw == null ? '' : raw).replace(/\s/g, '').match(/-?\d[\d,]*(?:\.\d+)?/);
    if (!m) return null;
    var n = parseFloat(m[0].replace(/,/g, ''));
    return isFinite(n) ? n : null;
  }

  function numsAll(raw) {
    var out = [];
    var re = /(\d[\d,]*(?:\.\d+)?)/g;
    var m;
    var s = String(raw == null ? '' : raw);
    while ((m = re.exec(s)) !== null) {
      var n = parseFloat(m[1].replace(/,/g, ''));
      if (isFinite(n)) out.push(n);
    }
    return out;
  }

  function pad2(v) { return String(v).padStart(2, '0'); }

  function stamp() {
    var d = new Date();
    return d.getFullYear() + pad2(d.getMonth() + 1) + pad2(d.getDate()) + '_' + pad2(d.getHours()) + pad2(d.getMinutes());
  }

  function hashString(s) {
    var h = 5381;
    for (var i = 0; i < String(s).length; i++) h = ((h << 5) + h + String(s).charCodeAt(i)) | 0;
    return (h >>> 0).toString(36);
  }

  function isListPage() {
    return String(location.pathname || '').indexOf(LIST_PATH) === 0;
  }

  function alive() {
    return typeof document !== 'undefined' && document && typeof document.getElementById === 'function';
  }

  /* ---------------------------------------------------------
   * storage
   * ------------------------------------------------------- */
  function storageGet(defaults) {
    return new Promise(function (resolve) {
      try {
        chrome.storage.local.get(defaults, function (res) { resolve(res || {}); });
      } catch (e) { resolve(defaults || {}); }
    });
  }

  function storageSet(obj) {
    return new Promise(function (resolve) {
      try {
        chrome.storage.local.set(obj, function () { resolve(true); });
      } catch (e) { resolve(false); }
    });
  }

  /* ---------------------------------------------------------
   * 목록 페이지 정보 읽기
   * ------------------------------------------------------- */
  function pagEl() {
    return document.querySelector('.ant-pagination');
  }

  function currentPage() {
    var pag = pagEl();
    if (!pag) return 0;
    var a = pag.querySelector('.ant-pagination-item-active');
    if (!a) return 0;
    var n = parseInt(a.getAttribute('title') || a.textContent, 10);
    return isFinite(n) ? n : 0;
  }

  function lastPage() {
    var pag = pagEl();
    if (!pag) return 0;
    var items = pag.querySelectorAll('.ant-pagination-item');
    var max = 0;
    for (var i = 0; i < items.length; i++) {
      var t = parseInt(items[i].getAttribute('title') || items[i].textContent, 10);
      if (isFinite(t) && t > max) max = t;
    }
    return max;
  }

  function pageSize() {
    var items = document.querySelectorAll('.ant-select-selection-item');
    for (var i = 0; i < items.length; i++) {
      var m = clean(items[i].textContent).match(/(\d+)\s*개씩/);
      if (m) return parseInt(m[1], 10);
    }
    return 20;
  }

  function totalCount() {
    var m = document.body ? String(document.body.innerText).match(/총\s*([\d,]+)\s*개\s*상품/) : null;
    return m ? parseInt(String(m[1]).replace(/,/g, ''), 10) : 0;
  }

  function isLoading() {
    var btn = document.querySelector('button.ant-btn');
    // '새로고침' 버튼이 로딩 중이면 disabled + loading 아이콘
    var btns = document.querySelectorAll('button');
    for (var i = 0; i < btns.length; i++) {
      var t = clean(btns[i].textContent);
      if (t.indexOf('새로고침') >= 0) {
        return btns[i].disabled === true || btns[i].querySelector('.anticon-loading') !== null;
      }
    }
    return false;
  }

  /* ---------------------------------------------------------
   * 행(row) 파싱 — 실제 화면 텍스트 구조 기준
   * ------------------------------------------------------- */
  var LABELS = ['상품명', '판매가', '배송비', '해외 배송비', '상품원가', '환율', '상품 ID'];

  function rowEls() {
    var out = [];
    var nodes = document.querySelectorAll('div.ant-row-no-wrap.ant-row-stretch');
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      if (el.closest('#' + ROOT_ID)) continue;
      if (el.querySelectorAll('div.ant-row-no-wrap.ant-row-stretch').length) continue; // 상위 래퍼 제외
      var txt = el.innerText || '';
      if (txt.indexOf('상품 ID') < 0) continue;
      out.push(el);
    }
    return out;
  }

  function valueAfter(lines, label) {
    for (var i = 0; i < lines.length; i++) {
      if (lines[i] === label) {
        for (var j = i + 1; j < lines.length && j <= i + 3; j++) {
          if (lines[j] && LABELS.indexOf(lines[j]) < 0) return lines[j];
        }
        return '';
      }
    }
    return '';
  }

  /* 상품 ID → 대표이미지 URL.
   * 실제 화면에서는 텍스트 행과 썸네일이 서로 다른 래퍼에 있어서,
   * 페이지 안의 이미지들을 상품 ID 기준으로 한 번에 모아 두고 붙인다. */
  function imageMap() {
    var map = Object.create(null);
    var imgs = document.querySelectorAll('img[src*="/products/"]');
    for (var i = 0; i < imgs.length; i++) {
      var src = imgs[i].getAttribute('src') || '';
      var m = src.match(/\/products\/([0-9a-f]{24})\//i);
      if (!m) continue;
      var url = src;
      if (url.indexOf('//') === 0) url = 'https:' + url;
      if (!/^https?:\/\//i.test(url)) continue;
      if (!map[m[1]]) map[m[1]] = url;
    }
    return map;
  }

  function imageOf(el, pid) {
    var img = el.querySelector('img[src*="/products/"]') || el.querySelector('img[src*="file.percenty.co.kr"]');
    if (img) {
      var src = img.getAttribute('src') || '';
      if (/^https?:\/\//i.test(src)) return src;
      if (src.indexOf('//') === 0) return 'https:' + src;
    }
    return '';
  }

  function parseRow(el, iMap) {
    var raw = el.innerText || '';
    var lines = raw.split('\n').map(clean).filter(Boolean);
    if (!lines.length) return null;

    var pid = clean(valueAfter(lines, '상품 ID'));
    if (!/^[0-9a-f]{24}$/i.test(pid)) {
      var m = raw.match(/([0-9a-f]{24})/i);
      pid = m ? m[1] : '';
    }
    if (!pid) return null;

    var name = valueAfter(lines, '상품명');
    var saleRaw = valueAfter(lines, '판매가');
    var shipRaw = valueAfter(lines, '배송비');
    var intlRaw = valueAfter(lines, '해외 배송비');
    var costRaw = valueAfter(lines, '상품원가');
    var rateRaw = valueAfter(lines, '환율');

    // 판매가: "402,900원" / "2,246,600~2,586,200원"
    var saleNums = numsAll(String(saleRaw).replace(/반품|교환/g, ''));
    var sale = saleNums.length ? saleNums[0] : null;
    var saleMax = saleNums.length > 1 ? Math.max.apply(null, saleNums) : sale;

    // 상품원가: "320,577원 (¥1,599)"  → 원화 값들만
    var costKrwRaw = String(costRaw).split('(')[0];
    var costNums = numsAll(costKrwRaw);
    var cost = costNums.length ? costNums[0] : null;
    var costMax = costNums.length > 1 ? Math.max.apply(null, costNums) : cost;

    // 외화 원가: (¥1,599) / (¥9,199~10,599)
    var fx = '';
    var fxm = String(costRaw).match(/\(([^)]*¥[^)]*)\)/);
    if (fxm) fx = clean(fxm[1]);

    var rateM = String(rateRaw).match(/=\s*([\d.]+)/);
    var rate = rateM ? parseFloat(rateM[1]) : null;

    var retM = String(shipRaw).match(/반품\s*([\d,]+)\s*,\s*교환\s*([\d,]+)/);
    var returnFee = retM ? num(retM[1]) : null;
    var exchangeFee = retM ? num(retM[2]) : null;

    // 마지막 줄 = 등록일(yyyy/mm/dd), 그 앞 줄 = 그룹명
    var regDate = '';
    var groupName = '';
    for (var k = lines.length - 1; k >= 0; k--) {
      if (/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(lines[k])) {
        regDate = lines[k];
        if (k - 1 >= 0) groupName = lines[k - 1];
        break;
      }
    }
    if (/그룹\s*없음/.test(groupName)) groupName = '';

    var img = (iMap && iMap[pid]) || imageOf(el, pid);

    return {
      id: 'p_pct_' + hashString(pid),
      source: SRC,
      sourceLabel: SRC_LABEL,
      currency: 'KRW',
      url: '',
      pageUrl: location.href,
      percentyId: pid,
      originalTitle: name,
      name: name,
      price: sale,
      priceMax: saleMax,
      cost: cost,
      costMax: costMax,
      costForeign: fx,
      exchangeRate: rate,
      currencyEN: 'KRW',
      shippingFee: null,
      returnFee: returnFee,
      exchangeFee: exchangeFee,
      shippingFeeRaw: clean(intlRaw),
      groupName: groupName,
      registeredAt: regDate,
      imageUrl: img,
      images: img ? [img] : [],
      options: [],
      from: 'list',
      collectedAt: new Date().toISOString()
    };
  }

  function collectRowsFromDom() {
    var els = rowEls();
    var iMap = imageMap();
    var list = [];
    var seen = Object.create(null);
    for (var i = 0; i < els.length; i++) {
      var it = null;
      try { it = parseRow(els[i], iMap); } catch (e) { it = null; }
      if (!it || !it.percentyId || seen[it.percentyId]) continue;
      seen[it.percentyId] = 1;
      list.push(it);
    }
    return list;
  }

  /* ---------------------------------------------------------
   * 수집함(collectedProducts) 저장 — 상품 ID 로 중복 병합
   * ------------------------------------------------------- */
  function getSaved() {
    return new Promise(function (resolve) {
      try {
        chrome.storage.local.get({ collectedProducts: [] }, function (res) {
          var list = res && res.collectedProducts;
          resolve(Array.isArray(list) ? list : []);
        });
      } catch (e) { resolve([]); }
    });
  }

  function saveToBasket(items) {
    return getSaved().then(function (list) {
      var idx = Object.create(null);
      for (var i = 0; i < list.length; i++) {
        var it = list[i];
        if (!it) continue;
        if (it.percentyId) idx['p:' + it.percentyId] = i;
        else if (it.url) idx['u:' + it.url] = i;
      }
      var added = 0;
      var updated = 0;
      for (var k = 0; k < items.length; k++) {
        var p = items[k];
        var key = p.percentyId ? 'p:' + p.percentyId : 'u:' + p.url;
        var at = idx[key];
        if (at === undefined) {
          list.push(p);
          idx[key] = list.length - 1;
          added++;
        } else {
          var old = list[at] || {};
          p.id = old.id || p.id;
          p.collectedAt = new Date().toISOString();
          if ((!p.images || !p.images.length) && old.images) p.images = old.images;
          if (p.price === null && old.price) p.price = old.price;
          list[at] = p;
          updated++;
        }
      }
      return new Promise(function (resolve) {
        try {
          chrome.storage.local.set({ collectedProducts: list }, function () {
            resolve({ total: list.length, added: added, updated: updated });
          });
        } catch (e) { resolve({ total: list.length, added: added, updated: updated }); }
      });
    });
  }

  /* ---------------------------------------------------------
   * 파일 저장
   * ------------------------------------------------------- */
  function exportItems(items) {
    return items.map(function (p) {
      return {
        id: p.id || '',
        source: p.source || SRC,
        sourceLabel: p.sourceLabel || SRC_LABEL,
        url: p.url || '',
        originalTitle: p.originalTitle || '',
        name: p.name || p.originalTitle || '',
        price: p.price === undefined ? null : p.price,
        priceMax: p.priceMax === undefined ? null : p.priceMax,
        currency: p.currency || 'KRW',
        cost: p.cost === undefined ? null : p.cost,
        costMax: p.costMax === undefined ? null : p.costMax,
        costForeign: p.costForeign || '',
        exchangeRate: p.exchangeRate === undefined ? null : p.exchangeRate,
        shippingFeeRaw: p.shippingFeeRaw || '',
        returnFee: p.returnFee === undefined ? null : p.returnFee,
        exchangeFee: p.exchangeFee === undefined ? null : p.exchangeFee,
        percentyId: p.percentyId || '',
        groupName: p.groupName || '',
        registeredAt: p.registeredAt || '',
        imageUrl: p.imageUrl || '',
        images: Array.isArray(p.images) ? p.images : [],
        options: [],
        from: p.from || 'list',
        collectedAt: p.collectedAt || ''
      };
    });
  }

  function downloadText(filename, text, mime) {
    try {
      var blob = new Blob([text], { type: mime || 'application/json;charset=utf-8' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.style.display = 'none';
      (document.body || document.documentElement).appendChild(a);
      a.click();
      setTimeout(function () {
        URL.revokeObjectURL(url);
        if (a.parentNode) a.parentNode.removeChild(a);
      }, 5000);
      return true;
    } catch (e) {
      return false;
    }
  }

  /* ---------------------------------------------------------
   * 대량 수집 엔진
   * ------------------------------------------------------- */
  var bulk = {
    running: false,
    paused: false,
    stop: false,
    session: '',
    start: 1,
    end: 1,
    page: 0,
    pageSize: 50,
    seen: Object.create(null),
    buf: [],
    chunkNo: 0,
    count: 0,
    files: [],
    startedAt: 0,
    failPages: []
  };

  function bulkBusy() { return bulk.running; }

  function setProgress(text, pct) {
    var el = document.getElementById('loi-pct-progress');
    if (el) el.textContent = text;
    var bar = document.getElementById('loi-pct-bar');
    if (bar) {
      bar.style.width = Math.max(0, Math.min(100, pct || 0)) + '%';
    }
  }

  function logLine(text) {
    var el = document.getElementById('loi-pct-log');
    if (!el) return;
    var d = document.createElement('div');
    d.textContent = text;
    el.appendChild(d);
    while (el.childNodes.length > 6) el.removeChild(el.firstChild);
  }

  async function waitPage(target, timeout) {
    var t0 = Date.now();
    while (Date.now() - t0 < (timeout || 15000)) {
      if (currentPage() === target && rowEls().length > 0 && !isLoading()) return true;
      await sleep(250);
    }
    return currentPage() === target && rowEls().length > 0;
  }

  function nextBtn() {
    var pag = pagEl();
    if (!pag) return null;
    var li = pag.querySelector('.ant-pagination-next');
    if (!li || li.getAttribute('aria-disabled') === 'true') return null;
    return li.querySelector('button') || li;
  }

  function setInputValue(input, value) {
    var setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(input, String(value));
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function pressEnter(input) {
    var kb = {
      key: 'Enter', code: 'Enter', keyCode: 13, which: 13,
      bubbles: true, cancelable: true, composed: true
    };
    input.dispatchEvent(new KeyboardEvent('keydown', kb));
    input.dispatchEvent(new KeyboardEvent('keyup', kb));
  }

  /* 페이지 번호 입력칸으로 이동. Enter → 안 되면 blur 순서로 두 번 시도한다. */
  async function jumpByInput(target) {
    var pag = pagEl();
    if (!pag) return false;
    var input = pag.querySelector('.ant-pagination-options-quick-jumper input');
    if (!input) return false;
    try {
      input.focus();
      setInputValue(input, target);
      pressEnter(input);
      if (await waitPage(target, 4000)) return true;
      // 두 번째 시도: 포커스를 뺄 때 이동하는 구현도 있다
      input.focus();
      setInputValue(input, target);
      input.blur();
      if (await waitPage(target, 4000)) return true;
      return false;
    } catch (e) {
      return false;
    }
  }

  async function goToPage(target) {
    if (currentPage() === target) return true;
    if (currentPage() === 0) return false;   // 페이지 표시를 못 읽으면 이동 판단 불가

    // 1) 다음 페이지 (한 칸 이동)
    if (target === currentPage() + 1) {
      var nb = nextBtn();
      if (nb) {
        nb.click();
        if (await waitPage(target, 15000)) return true;
      }
    }

    // 2) 페이지 번호 입력 점프 (함수 안에서 성공 여부까지 확인)
    if (await jumpByInput(target)) return true;

    // 3) 다음 페이지 반복
    var guard = 0;
    var t0 = Date.now();
    while (currentPage() < target && guard++ < 120) {
      if (Date.now() - t0 > 120000) break;                     // 2분 넘으면 포기
      var b = nextBtn();
      if (!b) break;
      var want = currentPage() + 1;
      if (!want) break;
      b.click();
      if (!(await waitPage(want, 9000))) break;
    }
    return currentPage() === target;
  }

  async function collectThisPage(size) {
    var list = [];
    var map = Object.create(null);

    function harvest() {
      var els = rowEls();
      var iMap = imageMap();
      for (var i = 0; i < els.length; i++) {
        var it = null;
        try { it = parseRow(els[i], iMap); } catch (e) { it = null; }
        if (!it || !it.percentyId || map[it.percentyId]) continue;
        map[it.percentyId] = 1;
        list.push(it);
      }
      return list.length;
    }

    try { window.scrollTo(0, 0); } catch (e) { /* ignore */ }
    await sleep(180);
    harvest();

    var stale = 0;
    for (var step = 0; step < 80; step++) {
      if (bulk.stop) break;
      while (bulk.paused) {
        await sleep(300);
        if (bulk.stop) break;
      }
      if (bulk.stop) break;
      if (list.length >= size) break;

      var before = list.length;
      var y = window.scrollY || window.pageYOffset || 0;
      var vh = window.innerHeight || 800;
      var docH = Math.max(
        (document.body && document.body.scrollHeight) || 0,
        (document.documentElement && document.documentElement.scrollHeight) || 0
      );
      if (y + vh >= docH - 8) {
        await sleep(420);
        harvest();
        if (list.length === before) { if (++stale >= 3) break; } else { stale = 0; }
        continue;
      }
      try { window.scrollTo(0, Math.min(docH, y + Math.round(vh * 1.15))); } catch (e) { /* ignore */ }
      await sleep(260);
      harvest();
      if (list.length === before) stale++; else stale = 0;
      if (stale >= 4) break;
    }
    harvest();
    return list;
  }

  function chunkFileName(seq) {
    return '퍼센티_목록_' + stamp() + '_' + String(seq).padStart(2, '0') + '.json';
  }

  async function flushChunk(force) {
    if (!bulk.buf.length) return;
    if (!force && bulk.buf.length < CHUNK_SIZE) return;

    var items = bulk.buf.slice(0, CHUNK_SIZE);
    bulk.buf = bulk.buf.slice(items.length);
    bulk.chunkNo += 1;

    var out = exportItems(items);
    var text = JSON.stringify(out, null, 2);
    var file = chunkFileName(bulk.chunkNo);
    var key = 'percentyBulk:' + bulk.session + ':' + bulk.chunkNo;

    var store = {};
    store[key] = out;
    await storageSet(store);

    var res = await storageGet({ percentyBulkIndex: [] });
    var idx = Array.isArray(res.percentyBulkIndex) ? res.percentyBulkIndex : [];
    idx.push({
      key: key, session: bulk.session, seq: bulk.chunkNo,
      count: out.length, at: new Date().toISOString(), file: file
    });
    var o2 = {}; o2[IDX_KEY] = idx;
    await storageSet(o2);

    var ok = downloadText(file, text);
    bulk.files.push({ file: file, count: out.length, downloaded: ok });
    logLine((ok ? '💾 ' : '⚠️ ') + file + ' · ' + out.length + '건' + (ok ? '' : ' (파일 저장 실패 — 팝업에서 다시 저장)'));
  }

  async function addBatch(items, pageNo) {
    var added = 0;
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      if (bulk.seen[it.percentyId]) continue;
      bulk.seen[it.percentyId] = 1;
      it.page = pageNo;
      bulk.buf.push(it);
      bulk.count++;
      added++;
      while (bulk.buf.length >= CHUNK_SIZE) await flushChunk(false);
    }
    return added;
  }

  async function saveState(lastPage, finished) {
    var o = {
      session: bulk.session,
      start: bulk.start,
      end: bulk.end,
      lastPage: lastPage,
      chunkNo: bulk.chunkNo,
      count: bulk.count,
      files: bulk.files.length,
      finished: !!finished,
      updatedAt: new Date().toISOString()
    };
    var s = {}; s[STATE_KEY] = o;
    await storageSet(s);
  }

  function etaText(done, total) {
    if (!bulk.startedAt || done <= 0) return '';
    var per = (Date.now() - bulk.startedAt) / done;
    var left = Math.max(0, total - done) * per;
    if (left <= 0) return '';
    var min = Math.round(left / 60000);
    if (min < 1) return ' · 1분 이내';
    return ' · 약 ' + min + '분 남음';
  }

  async function runRange(startPage, endPage) {
    if (bulk.running) return;
    var total = Math.max(0, lastPage());
    if (!total) {
      showToast('⚠️ 목록을 읽지 못했습니다. 신규 상품 등록 화면에서 새로고침(F5) 후 다시 시도해 주세요', 'warn');
      setProgress('목록을 읽지 못했습니다', 0);
      return;
    }
    if (endPage > total) endPage = total;

    bulk.running = true;
    bulk.paused = false;
    bulk.stop = false;
    bulk.start = startPage;
    bulk.end = endPage;
    bulk.page = 0;
    bulk.seen = Object.create(null);
    bulk.buf = [];
    bulk.chunkNo = 0;
    bulk.count = 0;
    bulk.files = [];
    bulk.failPages = [];
    bulk.session = 's' + Date.now().toString(36);
    bulk.startedAt = Date.now();
    bulk.pageSize = pageSize();

    setButtonsForRun(true);
    logLine('▶ ' + startPage + '~' + endPage + '페이지 수집 시작');

    var pages = endPage - startPage + 1;
    var done = 0;

    for (var p = startPage; p <= endPage; p++) {
      if (bulk.stop) break;
      while (bulk.paused) {
        await sleep(300);
        if (bulk.stop) break;
      }
      if (bulk.stop) break;

      setProgress('페이지 ' + p + ' / ' + endPage + ' 이동 중…', (done / pages) * 100);
      var ok = await goToPage(p);
      if (!ok) {
        bulk.failPages.push(p);
        logLine('⚠️ ' + p + '페이지로 이동하지 못했습니다 (건너뜀)');
        done++;
        continue;
      }

      setProgress('페이지 ' + p + ' / ' + endPage + ' 읽는 중… ' + bulk.count + '건', (done / pages) * 100);
      var size = pageSize() || bulk.pageSize || 20;
      var items = await collectThisPage(size);
      var added = await addBatch(items, p);

      done++;
      bulk.page = p;
      await saveState(p, false);

      setProgress(
        '페이지 ' + p + ' / ' + endPage + ' · ' + bulk.count + '건 수집' + etaText(done, pages),
        (done / pages) * 100
      );

      if (added === 0) logLine('ℹ️ ' + p + '페이지에서 새 상품이 없습니다');
    }

    await finishRun();
  }

  async function finishRun() {
    await flushChunk(true);
    await saveState(bulk.page, true);
    var msg = bulk.stop
      ? '⏹ 중단 — ' + bulk.count + '건 저장 (' + bulk.files.length + '개 파일)'
      : '✅ 완료 — ' + bulk.count + '건 저장 (' + bulk.files.length + '개 파일)';
    logLine(msg);
    setProgress(msg, 100);
    showToast(msg, bulk.stop ? 'warn' : 'ok');
    bulk.running = false;
    setButtonsForRun(false);
    try { window.scrollTo(0, 0); } catch (e) { /* ignore */ }
  }

  /* ---------------------------------------------------------
   * UI
   * ------------------------------------------------------- */
  function setButtonsForRun(running) {
    var ids = ['loi-pct-page', 'loi-pct-selected', 'loi-pct-range', 'loi-pct-all', 'loi-pct-resume'];
    for (var i = 0; i < ids.length; i++) {
      var el = document.getElementById(ids[i]);
      if (el) el.disabled = !!running;
    }
    var pause = document.getElementById('loi-pct-pause');
    var stop = document.getElementById('loi-pct-stop');
    if (pause) { pause.disabled = !running; pause.textContent = bulk.paused ? '▶ 이어서' : '⏸ 일시정지'; }
    if (stop) stop.disabled = !running;
  }

  function showToast(message, kind) {
    var old = document.getElementById(TOAST_ID);
    if (old && old.parentNode) old.parentNode.removeChild(old);
    var toast = document.createElement('div');
    toast.id = TOAST_ID;
    toast.className = 'loi-pct-toast' + (kind === 'warn' ? ' loi-pct-toast--warn' : '');
    toast.textContent = message;
    (document.body || document.documentElement).appendChild(toast);
    requestAnimationFrame(function () { toast.classList.add('loi-pct-toast--show'); });
    setTimeout(function () {
      toast.classList.remove('loi-pct-toast--show');
      setTimeout(function () {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 320);
    }, 3000);
  }

  function el(tag, attrs, text) {
    var n = document.createElement(tag);
    if (attrs) {
      for (var k in attrs) {
        if (!Object.prototype.hasOwnProperty.call(attrs, k)) continue;
        if (k === 'class') n.className = attrs[k];
        else if (k === 'id') n.id = attrs[k];
        else if (k === 'type') n.type = attrs[k];
        else if (k === 'value') n.value = attrs[k];
        else if (k === 'min' || k === 'max') n.setAttribute(k, attrs[k]);
        else if (k === 'placeholder') n.setAttribute(k, attrs[k]);
        else if (k === 'title') n.setAttribute(k, attrs[k]);
        else n.setAttribute(k, attrs[k]);
      }
    }
    if (text != null) n.textContent = text;
    return n;
  }

  function buildPanel() {
    if (document.getElementById(ROOT_ID)) return;

    var root = el('div', { id: ROOT_ID });
    root.style.touchAction = 'none';

    var toggle = el('button', { id: 'loi-pct-toggle', type: 'button', title: '퍼센티 수집기 (드래그로 위치 이동)' }, '🛒 퍼센티 목록 수집');
    var panel = el('div', { id: 'loi-pct-panel', class: 'loi-pct-panel hidden' });

    var head = el('div', { class: 'loi-pct-head' });
    head.appendChild(el('span', { class: 'loi-pct-title' }, '퍼센티 신규 상품 등록'));
    var total = el('span', { class: 'loi-pct-total', id: 'loi-pct-total' }, '총 -');
    head.appendChild(total);
    panel.appendChild(head);

    var row1 = el('div', { class: 'loi-pct-row' });
    row1.appendChild(el('button', { id: 'loi-pct-page', class: 'loi-pct-btn primary', type: 'button' }, '이 페이지 담기'));
    row1.appendChild(el('button', { id: 'loi-pct-selected', class: 'loi-pct-btn', type: 'button', title: '체크한 행만 담습니다' }, '선택만'));
    panel.appendChild(row1);

    var row2 = el('div', { class: 'loi-pct-row loi-pct-range' });
    row2.appendChild(el('span', { class: 'loi-pct-label' }, '범위'));
    var st = el('input', { id: 'loi-pct-start', class: 'loi-pct-input', type: 'number', min: '1', value: '1' });
    var en = el('input', { id: 'loi-pct-end', class: 'loi-pct-input', type: 'number', min: '1', value: '' });
    row2.appendChild(st);
    row2.appendChild(el('span', { class: 'loi-pct-label' }, '~'));
    row2.appendChild(en);
    row2.appendChild(el('span', { class: 'loi-pct-label', id: 'loi-pct-pages' }, ''));
    panel.appendChild(row2);

    var row3 = el('div', { class: 'loi-pct-row' });
    row3.appendChild(el('button', { id: 'loi-pct-range', class: 'loi-pct-btn primary', type: 'button' }, '범위 자동 수집'));
    row3.appendChild(el('button', { id: 'loi-pct-all', class: 'loi-pct-btn primary', type: 'button' }, '전체 자동 수집'));
    panel.appendChild(row3);

    var row4 = el('div', { class: 'loi-pct-row' });
    row4.appendChild(el('button', { id: 'loi-pct-pause', class: 'loi-pct-btn', type: 'button', disabled: 'disabled' }, '⏸ 일시정지'));
    row4.appendChild(el('button', { id: 'loi-pct-stop', class: 'loi-pct-btn danger', type: 'button', disabled: 'disabled' }, '⏹ 중단'));
    row4.appendChild(el('button', { id: 'loi-pct-resume', class: 'loi-pct-btn', type: 'button', title: '중단한 지점부터 이어서' }, '↻ 이어서'));
    panel.appendChild(row4);

    var barWrap = el('div', { class: 'loi-pct-bar-wrap' });
    barWrap.appendChild(el('div', { class: 'loi-pct-bar', id: 'loi-pct-bar' }));
    panel.appendChild(barWrap);

    panel.appendChild(el('div', { id: 'loi-pct-progress' }, '대기 중'));
    var log = el('div', { id: 'loi-pct-log' });
    panel.appendChild(log);
    panel.appendChild(el('div', { class: 'loi-pct-note' },
      '500건마다 JSON 파일이 자동으로 저장됩니다(다운로드 폴더). 브라우저가 여러 파일 저장을 막으면 주소창 오른쪽 아이콘에서 [허용]을 눌러 주세요. 저장분은 확장 아이콘(팝업)에서 다시 내려받을 수 있습니다.'));

    root.appendChild(panel);
    root.appendChild(toggle);
    (document.body || document.documentElement).appendChild(root);

    // 위치 복원
    storageGet({ percentyBtnPos: null }).then(function (res) {
      if (!alive()) return;
      var pos = res && res.percentyBtnPos;
      if (pos && typeof pos.left === 'number' && typeof pos.top === 'number') {
        var maxL = Math.max(8, window.innerWidth - 120);
        var maxT = Math.max(8, window.innerHeight - 48);
        root.style.setProperty('left', Math.min(Math.max(8, pos.left), maxL) + 'px', 'important');
        root.style.setProperty('top', Math.min(Math.max(8, pos.top), maxT) + 'px', 'important');
        root.style.setProperty('right', 'auto', 'important');
        root.style.setProperty('bottom', 'auto', 'important');
      }
    });

    // 드래그
    var drag = { active: false, moved: false, x: 0, y: 0, l: 0, t: 0 };
    toggle.addEventListener('mousedown', function (ev) {
      if (ev.button !== 0) return;
      var r = root.getBoundingClientRect();
      drag.active = true; drag.moved = false;
      drag.x = ev.clientX; drag.y = ev.clientY;
      drag.l = r.left; drag.t = r.top;
      ev.preventDefault();
    });
    window.addEventListener('mousemove', function (ev) {
      if (!drag.active) return;
      var dx = ev.clientX - drag.x;
      var dy = ev.clientY - drag.y;
      if (!drag.moved && Math.hypot(dx, dy) > 5) drag.moved = true;
      if (!drag.moved) return;
      var maxL = Math.max(8, window.innerWidth - root.offsetWidth - 8);
      var maxT = Math.max(8, window.innerHeight - root.offsetHeight - 8);
      root.style.setProperty('left', Math.min(Math.max(8, drag.l + dx), maxL) + 'px', 'important');
      root.style.setProperty('top', Math.min(Math.max(8, drag.t + dy), maxT) + 'px', 'important');
      root.style.setProperty('right', 'auto', 'important');
      root.style.setProperty('bottom', 'auto', 'important');
    });
    window.addEventListener('mouseup', function () {
      if (!drag.active) return;
      drag.active = false;
      if (drag.moved) {
        var r = root.getBoundingClientRect();
        var o = { percentyBtnPos: { left: Math.round(r.left), top: Math.round(r.top) } };
        storageSet(o);
        toggle.dataset.justDragged = '1';
        setTimeout(function () { delete toggle.dataset.justDragged; }, 80);
      }
    });

    toggle.addEventListener('click', function (ev) {
      ev.preventDefault();
      ev.stopPropagation();
      if (toggle.dataset.justDragged === '1') return;
      panel.classList.toggle('hidden');
      if (!panel.classList.contains('hidden')) refreshPanel();
    });
    ['mousedown', 'mouseup', 'pointerdown', 'pointerup'].forEach(function (t) {
      toggle.addEventListener(t, function (ev) { ev.stopPropagation(); }, true);
    });

    // 버튼 동작
    document.getElementById('loi-pct-page').addEventListener('click', onClickPage);
    document.getElementById('loi-pct-selected').addEventListener('click', onClickSelected);
    document.getElementById('loi-pct-range').addEventListener('click', onClickRange);
    document.getElementById('loi-pct-all').addEventListener('click', onClickAll);
    document.getElementById('loi-pct-pause').addEventListener('click', function () {
      bulk.paused = !bulk.paused;
      this.textContent = bulk.paused ? '▶ 이어서' : '⏸ 일시정지';
      setProgress(bulk.paused ? '일시정지 — [이어서]를 누르면 계속합니다' : '다시 진행 중…', 0);
    });
    document.getElementById('loi-pct-stop').addEventListener('click', function () {
      bulk.stop = true;
      setProgress('중단 요청 — 현재 페이지를 마치고 멈춥니다', 0);
    });
    document.getElementById('loi-pct-resume').addEventListener('click', onClickResume);
  }

  function refreshPanel() {
    if (!alive()) return;
    var totalEl = document.getElementById('loi-pct-total');
    if (totalEl) {
      var t = totalCount();
      totalEl.textContent = t ? '총 ' + t.toLocaleString('ko-KR') + '개' : '총 -';
    }
    var lpg = lastPage();
    var pagesEl = document.getElementById('loi-pct-pages');
    if (pagesEl) pagesEl.textContent = lpg ? '/' + lpg + 'p' : '';
    var en = document.getElementById('loi-pct-end');
    if (en && lpg && (!en.value || Number(en.value) < 1 || Number(en.value) > lpg)) en.value = String(lpg);
    var st = document.getElementById('loi-pct-start');
    if (st && !st.value) st.value = String(currentPage() || 1);

    storageGet({ percentyBulkState: null }).then(function (res) {
      if (!alive()) return;
      var s = res && res.percentyBulkState;
      var btn = document.getElementById('loi-pct-resume');
      if (!btn) return;
      if (s && !s.finished && s.lastPage && s.end && s.lastPage < s.end) {
        btn.style.display = '';
        btn.textContent = '↻ 이어서 (' + (s.lastPage + 1) + 'p~)';
      } else {
        btn.style.display = 'none';
      }
    });
  }

  async function onClickPage() {
    if (bulkBusy()) return;
    setProgress('현재 페이지 읽는 중…', 0);
    var size = pageSize();
    var items = await collectThisPage(size);
    if (!items.length) {
      setProgress('이 페이지에서 상품을 찾지 못했습니다', 0);
      showToast('⚠️ 상품을 찾지 못했습니다. 목록이 열려 있는지 확인해 주세요', 'warn');
      return;
    }
    var res = await saveToBasket(items);
    var msg = '✅ ' + items.length + '건 담음 (수집함 ' + res.total + '개)';
    setProgress(msg, 100);
    showToast(msg, 'ok');
  }

  async function onClickSelected() {
    if (bulkBusy()) return;
    var els = rowEls();
    var picked = [];
    for (var i = 0; i < els.length; i++) {
      var cb = els[i].querySelector('input[type="checkbox"]');
      if (cb && cb.checked) picked.push(els[i]);
    }
    if (!picked.length) {
      showToast('체크한 상품이 없습니다 — 행 왼쪽 체크박스를 먼저 눌러 주세요', 'warn');
      return;
    }
    var items = [];
    var iMap = imageMap();
    for (var k = 0; k < picked.length; k++) {
      var it = null;
      try { it = parseRow(picked[k], iMap); } catch (e) { it = null; }
      if (it) items.push(it);
    }
    var res = await saveToBasket(items);
    var msg = '✅ 선택 ' + items.length + '건 담음 (수집함 ' + res.total + '개)';
    setProgress(msg, 100);
    showToast(msg, 'ok');
  }

  async function onClickRange() {
    if (bulkBusy()) return;
    var s = parseInt((document.getElementById('loi-pct-start') || {}).value, 10);
    var e = parseInt((document.getElementById('loi-pct-end') || {}).value, 10);
    var lpg = lastPage();
    if (!isFinite(s) || s < 1) s = 1;
    if (!isFinite(e) || e < s) e = lpg || s;
    if (lpg && e > lpg) e = lpg;
    await runRange(s, e);
  }

  async function onClickAll() {
    if (bulkBusy()) return;
    var lpg = lastPage();
    if (!lpg) {
      showToast('⚠️ 페이지 정보를 읽지 못했습니다', 'warn');
      return;
    }
    var st = document.getElementById('loi-pct-start');
    if (st) st.value = '1';
    var en = document.getElementById('loi-pct-end');
    if (en) en.value = String(lpg);
    await runRange(1, lpg);
  }

  async function onClickResume() {
    if (bulkBusy()) return;
    var res = await storageGet({ percentyBulkState: null });
    var s = res && res.percentyBulkState;
    if (!s || !s.end) {
      showToast('이어서 할 수집 기록이 없습니다', 'warn');
      return;
    }
    var from = Math.max(s.start || 1, (s.lastPage || 0) + 1);
    if (from > s.end) {
      showToast('이미 마지막 페이지까지 수집했습니다', 'warn');
      return;
    }
    await runRange(from, s.end);
  }

  /* ---------------------------------------------------------
   * 마운트 / SPA 대응
   * ------------------------------------------------------- */
  var lastHref = location.href;

  function tick() {
    if (location.href !== lastHref) {
      lastHref = location.href;
      if (!isListPage()) {
        var old = document.getElementById(ROOT_ID);
        if (old && old.parentNode) old.parentNode.removeChild(old);
        return;
      }
    }
    if (!isListPage()) return;
    buildPanel();
    var panel = document.getElementById('loi-pct-panel');
    if (panel && !panel.classList.contains('hidden') && !bulkBusy()) refreshPanel();
  }

  function boot() {
    if (isListPage()) {
      buildPanel();
      // 목록이 처음에 '총 0개'로 뜨는 경우가 있어 새로고침을 한 번 눌러 준다
      setTimeout(function () {
        if (totalCount() > 0) return;
        var btns = document.querySelectorAll('button');
        for (var i = 0; i < btns.length; i++) {
          if (clean(btns[i].textContent).indexOf('새로고침') >= 0 && !btns[i].disabled) {
            btns[i].click();
            break;
          }
        }
      }, 2500);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
  setInterval(tick, 1500);
})();
