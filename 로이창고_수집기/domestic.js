/* =========================================================
 * 로이창고 수집기 — domestic.js
 *  국내 위탁 공급처 상품 담기
 *    · 온채널   onch.co.kr / onch3.co.kr
 *    · 오너클랜 ownerclan.com
 *    · 도매매   domeme.domeggook.com / domemedb.domeggook.com
 *  저장: chrome.storage.local { collectedProducts: [...] } — source/currency:'KRW'
 *  가격이 회원/사업자 전용으로 가려진 페이지는 제목·이미지·코드만 담고
 *  도매가는 앱 [🏠 국내 위탁]에서 직접 넣도록 안내합니다.
 * ========================================================= */
(function () {
  'use strict';

  if (window.__loiDomesticLoaded) return;
  window.__loiDomesticLoaded = true;
  if (window.top !== window.self) return;

  var SITE = detectSite();
  if (!SITE) return;
  if (!looksLikeProduct()) return;

  var BTN_ID = 'loi-dom-btn';
  var ROOT_ID = 'loi-dom-root';
  var TOAST_ID = 'loi-dom-toast';

  var SITE_INFO = {
    onch: { source: 'onch', label: '온채널', site: 'onch.co.kr' },
    ownerclan: { source: 'ownerclan', label: '오너클랜', site: 'ownerclan.com' },
    domeme: { source: 'domeme', label: '도매매', site: 'domeme.domeggook.com' }
  };

  function detectSite() {
    var h = (location.hostname || '').toLowerCase();
    if (/(^|\.)onch\.co\.kr$/.test(h) || /(^|\.)onch3\.co\.kr$/.test(h)) return 'onch';
    if (/(^|\.)ownerclan\.com$/.test(h)) return 'ownerclan';
    if (/(^|\.)domeggook\.com$/.test(h) && /domeme|domemedb/.test(h)) return 'domeme';
    return null;
  }

  function looksLikeProduct() {
    var path = (location.pathname || '').toLowerCase();
    if (SITE === 'ownerclan') return /\/v2\/product\/view\.php/.test(path);
    if (SITE === 'onch') return /(goods|product|item|detail)/.test(path) && !/list|search|main|index/.test(path.replace(/goods_?view/, ''));
    return /(goods|product|item|detail)/.test(path) && !/list|search|main|index/.test(path);
  }

  /* ---------------- 공통 유틸 ---------------- */
  function text(el) {
    if (!el) return '';
    var t = el.innerText || el.textContent || '';
    return String(t).replace(/\s+/g, ' ').trim();
  }
  function firstText(selectors) {
    for (var i = 0; i < selectors.length; i++) {
      var el;
      try { el = document.querySelector(selectors[i]); } catch (e) { continue; }
      var t = text(el);
      if (t) return t;
    }
    return '';
  }
  function meta(list) {
    for (var i = 0; i < list.length; i++) {
      var el = document.querySelector(list[i]);
      if (el) {
        var v = el.getAttribute('content') || '';
        if (v && String(v).trim()) return String(v).trim();
      }
    }
    return '';
  }
  function toNum(raw) {
    if (raw === null || raw === undefined) return 0;
    var m = String(raw).replace(/\s/g, '').match(/\d[\d,]*(?:\.\d+)?/);
    if (!m) return 0;
    var n = parseFloat(m[0].replace(/,/g, ''));
    return isFinite(n) && n > 0 ? n : 0;
  }
  function cleanTitle(t) {
    var s = String(t || '').replace(/\s+/g, ' ').trim();
    s = s.replace(/\s*[-|｜:]\s*(오너클랜|온채널|도매매|도매꾹|Ownerclan|ONCH).*$/i, '');
    s = s.replace(/^\s*(오너클랜|온채널|도매매|도매꾹)\s*[-|:]\s*/, '');
    return s.trim();
  }
  function uniq(arr, max) {
    var seen = {}, out = [];
    for (var i = 0; i < arr.length; i++) {
      var v = String(arr[i] || '').trim();
      if (!v || seen[v]) continue;
      seen[v] = true;
      out.push(v);
      if (out.length >= max) break;
    }
    return out;
  }
  function absUrl(u) {
    var s = String(u || '').trim();
    if (!s) return '';
    if (s.indexOf('//') === 0) return 'https:' + s;
    if (/^https?:\/\//i.test(s)) return s;
    if (s.charAt(0) === '/') return location.origin + s;
    return '';
  }
  function biggestImage() {
    var best = '', area = 0;
    var imgs = document.images || [];
    for (var i = 0; i < imgs.length && i < 400; i++) {
      var im = imgs[i];
      var w = im.naturalWidth || im.width || 0;
      var h = im.naturalHeight || im.height || 0;
      if (w * h > area && w >= 120 && h >= 120) {
        var u = absUrl(im.currentSrc || im.src);
        if (u) { area = w * h; best = u; }
      }
    }
    return best;
  }

  /* ---------------- 상품 추출 ---------------- */
  function extractCode() {
    var q = new URLSearchParams(location.search);
    var keys = ['selfcode', 'goodsNo', 'goodsno', 'itemNo', 'itemno', 'no', 'code', 'productCode'];
    for (var i = 0; i < keys.length; i++) {
      var v = q.get(keys[i]);
      if (v && String(v).trim().length >= 3) return String(v).trim();
    }
    var m = (document.body ? text(document.body) : '').match(/상품\s*코드\s*[:：]?\s*([A-Za-z0-9\-_]{4,20})/);
    if (m) return m[1];
    return '';
  }

  function extractPrice() {
    // 1) 사이트별로 확인된 자리
    if (SITE === 'ownerclan') {
      var unit = document.getElementById('purchaseUnitPrice');
      var n1 = toNum(text(unit));
      if (n1) return n1;
    }
    // 2) 화면에 보이는 "도매가/공급가" 라벨 옆 숫자
    var labels = ['도매가', '공급가', '도매금액', '공급금액', '판매가'];
    var scope = document.querySelectorAll('div,span,td,th,strong,em,p,dd,li');
    var limit = Math.min(scope.length, 6000);
    for (var l = 0; l < labels.length; l++) {
      for (var i = 0; i < limit; i++) {
        var el = scope[i];
        var t = text(el);
        if (!t || t.length > 40) continue;
        if (t.indexOf(labels[l]) < 0) continue;
        var m = t.match(/([\d,]{3,12})\s*원/);
        if (m) {
          var v = toNum(m[1]);
          if (v) return v;
        }
        var sib = el.nextElementSibling ? text(el.nextElementSibling) : '';
        var v2 = toNum(sib);
        if (v2) return v2;
      }
    }
    // 3) JSON-LD offers
    var nodes = document.querySelectorAll('script[type="application/ld+json"]');
    for (var k = 0; k < nodes.length; k++) {
      try {
        var data = JSON.parse(nodes[k].textContent || '{}');
        var list = Array.isArray(data) ? data : [data];
        for (var d = 0; d < list.length; d++) {
          var off = list[d] && list[d].offers;
          if (!off) continue;
          if (Array.isArray(off)) off = off[0];
          var pv = toNum(off && (off.price || off.lowPrice));
          if (pv) return pv;
        }
      } catch (e) { /* skip */ }
    }
    // 가격이 회원/사업자 전용으로 가려진 페이지면 숫자를 추측하지 않습니다
    if (priceHidden()) return 0;
    // 4) 본문에서 "N원" 중 상품가로 보이는 첫 값 (배송비·할인·적립 같은 금액은 제외)
    var body = text(document.body || document.documentElement).slice(0, 6000);
    var re = /([\d]{1,3}(?:,\d{3})+)\s*원/g, mm;
    while ((mm = re.exec(body)) !== null) {
      var ctx = body.slice(Math.max(0, mm.index - 14), mm.index);
      if (/배송|택배|반품|교환|할인|적립|마일리지|쿠폰|예상|무이자|개월/.test(ctx)) continue;
      var n2 = toNum(mm[1]);
      if (n2 && n2 >= 100) return n2;
    }
    return 0;
  }

  function priceHidden() {
    var t = text(document.body || document.documentElement).slice(0, 8000);
    return /회원\s*전용\s*공개|사업자\s*전용|회원전용|로그인\s*후\s*(확인|공개)/.test(t);
  }

  function extractShipping() {
    var t = text(document.body || document.documentElement).slice(0, 8000);
    var m = t.match(/(?:택배|배송)\s*(?:비)?\s*[:：]?\s*([\d,]{3,7})\s*원/);
    if (m) return toNum(m[1]);
    if (/무료\s*배송|배송비\s*무료/.test(t)) return 0;
    return 0;
  }

  function extractStock() {
    var t = text(document.body || document.documentElement).slice(0, 8000);
    var m = t.match(/재고\s*(?:수량)?\s*[:：]?\s*([\d,]{1,6})/);
    return m ? toNum(m[1]) : 0;
  }

  function extractSupplier() {
    if (SITE === 'ownerclan') {
      var cells = document.querySelectorAll('th');
      for (var i = 0; i < cells.length; i++) {
        if (text(cells[i]).indexOf('상호명') >= 0) {
          var td = cells[i].nextElementSibling;
          if (td && text(td)) return text(td);
        }
      }
      var link = document.querySelector('a[href*="vendercode"], a[href*="supplier"]');
      if (link && text(link)) return text(link);
    }
    var t = text(document.body || document.documentElement).slice(0, 8000);
    var m = t.match(/공급사\s*(?:명)?\s*[:：]?\s*([가-힣A-Za-z0-9()주식회사\s]{2,30})/);
    return m ? m[1].trim() : '';
  }

  function extractOptions() {
    var out = [];
    var selects = document.querySelectorAll('select');
    for (var i = 0; i < selects.length && out.length < 20; i++) {
      var opts = selects[i].options || [];
      for (var k = 0; k < opts.length; k++) {
        var v = String(opts[k].textContent || '').replace(/\s+/g, ' ').trim();
        if (!v || /선택|option|사이즈|색상|수량|전체/.test(v)) continue;
        if (v.length > 40) continue;
        out.push(v);
      }
    }
    return uniq(out, 20);
  }

  function extract() {
    var info = SITE_INFO[SITE];
    var title = cleanTitle(
      firstText(['p.product_information_right_title_text', 'h1', '.goods_name', '.product_name', '.item_name', 'h2'])
      || meta(['meta[property="og:title"]', 'meta[name="twitter:title"]'])
      || document.title
    );
    var price = extractPrice();
    var hidden = !price && priceHidden();
    var img = absUrl(meta(['meta[property="og:image"]'])) || biggestImage();
    return {
      id: 'd_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      source: info.source,
      sourceLabel: info.label,
      currency: 'KRW',
      url: location.href,
      originalTitle: title,
      name: title,
      price: price || null,
      cost: price || 0,
      priceHidden: !!hidden,
      shippingFee: extractShipping(),
      stock: extractStock(),
      supplierName: extractSupplier() || info.label,
      code: extractCode(),
      imageUrl: img,
      images: uniq([img], 10),
      options: extractOptions(),
      from: 'detail',
      collectedAt: new Date().toISOString()
    };
  }

  /* ---------------- 저장 ---------------- */
  function getProducts() {
    return new Promise(function (resolve) {
      try {
        chrome.storage.local.get({ collectedProducts: [] }, function (res) {
          resolve(Array.isArray(res && res.collectedProducts) ? res.collectedProducts : []);
        });
      } catch (e) { resolve([]); }
    });
  }
  function setProducts(list) {
    return new Promise(function (resolve) {
      try {
        chrome.storage.local.set({ collectedProducts: list }, function () { resolve(true); });
      } catch (e) { resolve(false); }
    });
  }
  function save(p) {
    return getProducts().then(function (list) {
      var idx = -1;
      for (var i = 0; i < list.length; i++) {
        if (list[i] && list[i].url === p.url) { idx = i; break; }
      }
      if (idx >= 0) {
        p.id = list[idx].id || p.id;
        list[idx] = p;
      } else {
        list.unshift(p);
      }
      return setProducts(list).then(function () { return list.length; });
    });
  }

  /* ---------------- 화면 ---------------- */
  function showToast(msg, kind) {
    var old = document.getElementById(TOAST_ID);
    if (old && old.parentNode) old.parentNode.removeChild(old);
    var el = document.createElement('div');
    el.id = TOAST_ID;
    el.textContent = msg;
    el.style.cssText = 'position:fixed;left:50%;bottom:26px;transform:translateX(-50%);z-index:2147483001;' +
      'max-width:min(92vw,420px);padding:10px 14px;border-radius:10px;font-size:12.5px;line-height:1.5;font-weight:700;' +
      'font-family:"Malgun Gothic","맑은 고딕",system-ui,sans-serif;color:#fff;box-shadow:0 10px 24px -10px rgba(0,0,0,.5);' +
      'background:' + (kind === 'warn' ? '#b45309' : (kind === 'bad' ? '#b91c1c' : '#0f7a5c')) + ';';
    document.body.appendChild(el);
    setTimeout(function () {
      el.style.transition = 'opacity .3s';
      el.style.opacity = '0';
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 320);
    }, 2600);
  }

  function build() {
    var old = document.getElementById(ROOT_ID);
    if (old && old.parentNode) old.parentNode.removeChild(old);
    var root = document.createElement('div');
    root.id = ROOT_ID;
    var btn = document.createElement('button');
    btn.id = BTN_ID;
    btn.type = 'button';
    btn.textContent = '🏠 로이창고 담기';
    btn.style.cssText = 'position:fixed;right:18px;bottom:120px;z-index:2147482999;height:40px;padding:0 14px;border:0;' +
      'border-radius:999px;background:linear-gradient(135deg,#1d4ed8,#3b82f6);color:#fff;font-size:13px;font-weight:800;' +
      'font-family:"Malgun Gothic","맑은 고딕",system-ui,sans-serif;cursor:pointer;box-shadow:0 8px 20px -8px rgba(29,78,216,.7);';
    root.appendChild(btn);
    document.body.appendChild(root);

    // 드래그로 위치 이동 (한 번 옮기면 기억)
    try {
      chrome.storage.local.get({ domesticBtnPos: null }, function (res) {
        var p = res && res.domesticBtnPos;
        if (p && typeof p.left === 'number') {
          btn.style.left = p.left + 'px';
          btn.style.top = p.top + 'px';
          btn.style.right = 'auto';
          btn.style.bottom = 'auto';
        }
      });
    } catch (e) { /* noop */ }

    var drag = null;
    btn.addEventListener('mousedown', function (ev) {
      drag = { x: ev.clientX, y: ev.clientY, rect: btn.getBoundingClientRect(), moved: false };
      ev.preventDefault();
    });
    window.addEventListener('mousemove', function (ev) {
      if (!drag) return;
      var dx = ev.clientX - drag.x, dy = ev.clientY - drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true;
      if (!drag.moved) return;
      btn.style.left = Math.max(4, drag.rect.left + dx) + 'px';
      btn.style.top = Math.max(4, drag.rect.top + dy) + 'px';
      btn.style.right = 'auto';
      btn.style.bottom = 'auto';
    });
    window.addEventListener('mouseup', function () {
      if (!drag) return;
      var moved = drag.moved;
      drag = null;
      if (!moved) return;
      var r = btn.getBoundingClientRect();
      try { chrome.storage.local.set({ domesticBtnPos: { left: Math.round(r.left), top: Math.round(r.top) } }); } catch (e) { /* noop */ }
    });

    btn.addEventListener('click', function () {
      if (btn.dataset.justDragged) { delete btn.dataset.justDragged; return; }
      btn.disabled = true;
      var p;
      try { p = extract(); } catch (e) { p = null; }
      if (!p || !p.originalTitle) {
        btn.disabled = false;
        showToast('상품 정보를 찾지 못했습니다. 상품 상세 페이지인지 확인해 주세요.', 'warn');
        return;
      }
      save(p).then(function (n) {
        btn.disabled = false;
        if (p.price) showToast('✅ 담았습니다 (' + n + '개) · 도매가 ' + p.price.toLocaleString('ko-KR') + '원', 'ok');
        else showToast('⚠️ 담았습니다 (' + n + '개) · 가격이 회원/사업자 전용이라 읽지 못했습니다. 앱 [🏠 국내 위탁]에서 도매가를 넣어 주세요.', 'warn');
      }, function () {
        btn.disabled = false;
        showToast('저장에 실패했습니다. 잠시 후 다시 시도해 주세요.', 'bad');
      });
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build);
  else build();

  window.__loiDomesticExtract = extract;
})();
