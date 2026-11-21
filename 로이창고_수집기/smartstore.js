/* =========================================================
 * 로이창고 상품 수집기 — smartstore.js   (v2.3.0 새 기능)
 *  네이버 스마트스토어센터(sell.smartstore.naver.com) 주문 수집
 *
 *  ■ 하는 일
 *    성재님이 크롬에서 스마트스토어센터의 주문·발송관리 화면을 열고
 *    오른쪽 아래 [🏪 스마트스토어 주문 수집] 을 누르면
 *    지금 화면에 보이는 주문 줄에서
 *      주문번호 · 주문일 · 상품명 · 옵션 · 수량 · 받는사람 · 결제금액 · 발송기한 · 주문상태
 *    를 읽어 로이창고용 JSON 한 파일로 저장합니다.
 *    그 파일을 로이창고 [📦 주문·배송 관리] → [📂 주문 현황 JSON 가져오기] 로 넣으면
 *    34개 마켓 주문 현황판과 주문 목록이 한 번에 채워집니다.
 *
 *  ■ 읽는 방법 (2026-11-21 설계)
 *    스마트스토어센터는 화면 구조(클래스 이름)가 자주 바뀌므로
 *    클래스 이름에 기대지 않고 "글자"를 기준으로 읽습니다.
 *      1) 표(table)의 줄 단위로 읽기 — td 칸 글자를 그대로 사용
 *      2) 표가 아니면, 주문번호가 하나 들어 있는 가장 작은 블록(div·li)을 한 줄로 보기
 *    주문번호는 20으로 시작하는 14~16자리(주문번호) 또는 10~13자리(상품주문번호)를 찾습니다.
 *    스토어명은 화면 위쪽·제목에서 운영 중인 34개 마켓 이름으로 찾고,
 *    못 찾으면 화면 위 칸에 직접 적으시면 됩니다(다음부터 기억).
 *
 *  ■ 안전
 *    · 읽기만 합니다. 주문 상태 변경·발송처리·결제를 누르지 않습니다.
 *    · 로그인 정보·비밀번호는 읽지 않습니다.
 *    · 수집한 내용은 이 크롬 브라우저 안(chrome.storage.local)과
 *      내려받은 JSON 파일에만 남고 어디로도 전송하지 않습니다.
 * ========================================================= */
(function () {
  'use strict';

  if (window.__loiSmartstoreLoaded) return;
  window.__loiSmartstoreLoaded = true;
  if (window.top !== window.self) return;

  var HOST = String(location.hostname || '').toLowerCase();
  if (!/(^|\.)sell\.smartstore\.naver\.com$/.test(HOST)) return;

  var EXT_VERSION = '2.3.0';
  var LAST_KEY = 'smartstoreLastResult';   // 마지막 수집 결과
  var NAME_KEY = 'smartstoreStoreName';    // 사용자가 적어 둔 스토어명
  var ROOT_ID = 'loi-ss-root';
  var STYLE_ID = 'loi-ss-style';
  var REORDER_KEY = 'smartstorePanelPos';

  /* 성재님이 운영하는 스마트스토어 34곳 — 이름만 (이메일·전화번호·사업자부호 없음) */
  var MARKETS = [
    { name: '유유마켓', keys: ['유유마켓'] },
    { name: '유유스토어', keys: ['유유스토어'] },
    { name: '유진상사', keys: ['유진상사', '유베스트'] },
    { name: '모던픽', keys: ['모던픽'] },
    { name: '바이유', keys: ['바이유'] },
    { name: '솔리드픽', keys: ['솔리드픽'] },
    { name: '스냅딜', keys: ['스냅딜'] },
    { name: '스타트픽', keys: ['스타트픽'] },
    { name: '슬릭딜', keys: ['슬릭딜'] },
    { name: '유글로벌', keys: ['유글로벌'] },
    { name: '유비즈', keys: ['유비즈'] },
    { name: '트렌지오', keys: ['트렌지오', 'Trenzio'] },
    { name: '웰모', keys: ['웰모', 'Quelmo'] },
    { name: '드라빅스', keys: ['드라빅스', 'Dravix'] },
    { name: '노제보', keys: ['노제보', 'Nozevo'] },
    { name: '크레피스', keys: ['크레피스', 'Krephis'] },
    { name: '보르텔릭스', keys: ['보르텔릭스', 'Vortelix'] },
    { name: '줌보라', keys: ['줌보라', 'Zumvora'] },
    { name: '플렉시보', keys: ['플렉시보', 'Plexivo'] },
    { name: '젯딜', keys: ['젯딜', 'JetDeal'] },
    { name: '넥스트로바', keys: ['넥스트로바', 'Nextrova'] },
    { name: '크레보닉스', keys: ['크레보닉스', 'Krevonix'] },
    { name: '브리벨로', keys: ['브리벨로', 'Brivel'] },
    { name: '드렉시코', keys: ['드렉시코', 'Drexico'] },
    { name: '짐보라', keys: ['짐보라', 'Zymbora'] },
    { name: '클로브릭스', keys: ['클로브릭스', 'Clovrix'] },
    { name: '웰바노', keys: ['웰바노', 'Welvano'] },
    { name: '트릭소바', keys: ['트릭소바', 'Trixova'] },
    { name: '글렌픽스', keys: ['글렌픽스', 'Glenfix'] },
    { name: '블루베노', keys: ['블루베노', 'Bluveno'] },
    { name: '젤드록스', keys: ['젤드록스', 'Zeldrox'] },
    { name: '옴니벡스', keys: ['옴니벡스', 'Omnivex'] },
    { name: '플롬벡스', keys: ['플롬벡스', 'Flomvex'] },
    { name: '루벨릭스', keys: ['루벨릭스', 'Ruvel'] }
  ];

  var STATUS_DONE = '배송완료';
  var STATUS_CANCEL = '취소·반품';
  var STATUS_MOVING = '국내집화/배송중';
  var STATUS_NEW = '신규주문';

  /* ---------------------------------------------------------
   * 공통 유틸
   * ------------------------------------------------------- */
  function clean(s) {
    return String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
  }
  function pad2(v) { return String(v).padStart(2, '0'); }
  function stamp() {
    var d = new Date();
    return d.getFullYear() + pad2(d.getMonth() + 1) + pad2(d.getDate()) + '_' + pad2(d.getHours()) + pad2(d.getMinutes());
  }
  function todayYmd() {
    var d = new Date();
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }
  function ymdToMs(s) {
    var m = String(s || '').match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (!m) return NaN;
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getTime();
  }
  function addDays(n) {
    var d = new Date();
    d.setDate(d.getDate() + Number(n || 0));
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }
  function daysLeft(ymd) {
    var a = ymdToMs(ymd), b = ymdToMs(todayYmd());
    if (!isFinite(a) || !isFinite(b)) return null;
    return Math.round((a - b) / 86400000);
  }
  function txt(el) {
    if (!el) return '';
    var v = el.innerText;
    if (v === undefined || v === null) v = el.textContent;
    return clean(v);
  }
  function qsa(sel, root) {
    try { return (root || document).querySelectorAll(sel) || []; } catch (e) { return []; }
  }
  function storeGet(keys, cb) {
    try { chrome.storage.local.get(keys, function (res) { cb(res || {}); }); }
    catch (e) { cb({}); }
  }
  function storeSet(obj, cb) {
    try { chrome.storage.local.set(obj, function () { if (cb) cb(); }); }
    catch (e) { if (cb) cb(); }
  }

  /* ---------------------------------------------------------
   * 줄 읽기 — 글자 기준
   * ------------------------------------------------------- */
  function pickOrderNo(text) {
    var s = String(text || '');
    var labeled = s.match(/(?:주문\s*번호|상품\s*주문\s*번호)\s*[:：]?\s*([0-9]{8,20})/);
    if (labeled) return labeled[1];
    var m = s.match(/\b(20\d{12,14})\b/);       // 스마트스토어 주문번호 (예: 2026112100000001)
    if (m) return m[1];
    var m2 = s.match(/\b(\d{10,13})\b/);         // 상품주문번호
    if (m2) return m2[1];
    return '';
  }

  function parseDate(text) {
    var s = String(text || '');
    var m = s.match(/(20\d{2})\s*[.\-\/년]\s*(\d{1,2})\s*[.\-\/월]\s*(\d{1,2})/);
    if (m) return m[1] + '-' + pad2(m[2]) + '-' + pad2(m[3]);
    m = s.match(/(\d{1,2})\s*[.\-\/]\s*(\d{1,2})/);
    if (m) return new Date().getFullYear() + '-' + pad2(m[1]) + '-' + pad2(m[2]);
    return '';
  }

  function valueAfter(text, labels) {
    var lines = String(text || '').split(/\n/);
    for (var i = 0; i < lines.length; i++) {
      for (var k = 0; k < labels.length; k++) {
        var idx = lines[i].indexOf(labels[k]);
        if (idx < 0) continue;
        var rest = clean(lines[i].slice(idx + labels[k].length).replace(/^[:：\s]+/, ''));
        if (rest) return rest;
        if (i + 1 < lines.length) return clean(lines[i + 1]);
      }
    }
    return '';
  }

  function moneyOf(text, labels) {
    var s = String(text || '');
    if (labels) {
      for (var i = 0; i < labels.length; i++) {
        var re = new RegExp(labels[i] + '[^\\d]{0,12}([\\d,]{3,})');
        var mm = s.match(re);
        if (mm) {
          var v0 = parseInt(mm[1].replace(/,/g, ''), 10);
          if (isFinite(v0) && v0 > 0) return v0;
        }
      }
    }
    var all = [], m;
    var re2 = /([\d,]{3,})\s*원/g;
    while ((m = re2.exec(s)) !== null) {
      var v = parseInt(m[1].replace(/,/g, ''), 10);
      if (isFinite(v) && v > 0 && v < 100000000) all.push(v);
    }
    if (!all.length) return 0;
    return Math.max.apply(null, all);   // 결제금액·합계가 가장 크게 잡힙니다
  }

  function qtyOf(text) {
    var s = String(text || '');
    var m = s.match(/(?:수량|구매\s*수량)\s*[:：]?\s*(\d{1,3})/) || s.match(/(\d{1,3})\s*개/);
    var n = m ? parseInt(m[1], 10) : 0;
    return n > 0 ? n : 1;
  }

  function stageOf(text) {
    var s = String(text || '');
    if (/(취소|반품|철회)/.test(s)) return STATUS_CANCEL;
    if (/(배송완료|구매확정)/.test(s)) return STATUS_DONE;
    if (/(배송중|집화완료|배송시작)/.test(s)) return STATUS_MOVING;
    return STATUS_NEW;
  }

  function dueFromText(text) {
    var s = String(text || '');
    var labeled = valueAfter(s, ['발송기한', '출고기한', '발송 기한', '배송기한', '발송마감']);
    var d = parseDate(labeled);
    if (d) return d;
    var m = (labeled || s).match(/D\s*([-+])\s*(\d{1,2})/);
    if (m) {
      var n = parseInt(m[2], 10) * (m[1] === '-' ? 1 : -1);
      return addDays(n);
    }
    return '';
  }

  function cleanName(s) {
    var t = clean(s);
    t = t.replace(/^(상품명|상품|판매상품)\s*[:：]\s*/, '');
    var i = t.indexOf('옵션');
    if (i > 0) t = t.slice(0, i);
    t = t.replace(/[\[(\{,·\/\-~\s]+$/, '');
    return clean(t).slice(0, 120);
  }

  function nameOf(text, orderNo) {
    var lines = String(text || '').split(/\n/).map(clean).filter(Boolean);
    var best = '';
    for (var i = 0; i < lines.length; i++) {
      var l = lines[i];
      if (l.length < 4 || l.length > 160) continue;
      if (orderNo && l.indexOf(orderNo) >= 0) continue;
      if (/^[\d,.\s원%()\-]+$/.test(l)) continue;
      if (/^\d{4}[-.\/]\d{1,2}/.test(l)) continue;
      if (/(주문번호|주문일|결제일|수취인|받는\s*사람|수령인|발송기한|배송기한|주문상태|배송상태)/.test(l) && l.length < 30) continue;
      if (l.length > best.length) best = l;
    }
    return best.slice(0, 120);
  }

  /* 표 머리글에서 칸 위치를 찾습니다 — 칸 이름이 바뀌어도 이 순서로 맞춥니다 */
  function headerMapFrom(trs) {
    for (var i = 0; i < trs.length; i++) {
      var cells = qsa('td, th', trs[i]);
      if (!cells.length || cells.length < 3) continue;
      var map = {}, found = 0;
      for (var k = 0; k < cells.length; k++) {
        var h = clean(txt(cells[k]));
        if (!h || h.length > 24) continue;
        var key = '';
        if (/상품\s*주문\s*번호/.test(h)) key = 'productOrderNo';
        else if (/주문\s*번호/.test(h)) key = 'orderNo';
        else if (/^(상품명|상품\s*정보|상품)$/.test(h)) key = 'name';
        else if (/옵션/.test(h)) key = 'option';
        else if (/수량/.test(h)) key = 'qty';
        else if (/(받는\s*사람|수취인|수령인|주문자)/.test(h)) key = 'receiver';
        else if (/(결제\s*금액|주문\s*금액|상품\s*금액|판매가|결제\s*액)/.test(h)) key = 'sale';
        else if (/(발송\s*기한|출고\s*기한|배송\s*기한|발송\s*예정)/.test(h)) key = 'due';
        else if (/(주문\s*일|결제\s*일)/.test(h)) key = 'orderDate';
        else if (/(주문\s*상태|배송\s*상태|진행\s*상태|상태)/.test(h)) key = 'stage';
        if (key && map[key] === undefined) { map[key] = k; found++; }
      }
      if (found >= 2 && (map.orderNo !== undefined || map.productOrderNo !== undefined || map.name !== undefined)) return map;
    }
    return null;
  }

  function optionFromText(t) {
    var m = t.match(/옵션\s*[:：]?\s*([^)\n]{1,40}?)(?=$|[)\n]|\s*(?:수량|[0-9]+\s*개|결제|금액|판매가|배송|발송|주문|받는|수취|수령|상품명))/);
    return m ? clean(m[1]).replace(/^[()\s]+|[()\s]+$/g, '') : '';
  }

  function parseRow(text, cells, map) {
    var t = clean(text);
    var cell = function (k) {
      return (map && cells && k !== undefined && cells[k] !== undefined) ? clean(cells[k]) : '';
    };
    var orderNo = '';
    if (map && cells) {
      orderNo = pickOrderNo(cell(map.orderNo)) || pickOrderNo(cell(map.productOrderNo));
      if (!orderNo) {
        for (var i = 0; i < cells.length; i++) {
          var cand = pickOrderNo(cells[i]);
          if (cand && /^\d{8,20}$/.test(clean(cells[i]))) { orderNo = cand; break; }
        }
      }
    }
    if (!orderNo) orderNo = pickOrderNo(t);
    if (!orderNo) return null;

    var name = '', option = '', receiver = '', sale = 0, qty = 0, orderDate = '', due = '', stageText = '';
    if (map && cells) {
      name = cleanName(cell(map.name));
      option = cell(map.option).replace(/^옵션\s*[:：]?\s*/, '');
      receiver = cell(map.receiver);
      sale = moneyOf(cell(map.sale));
      qty = qtyOf(cell(map.qty));
      orderDate = parseDate(cell(map.orderDate));
      due = parseDate(cell(map.due)) || dueFromText(cell(map.due));
      stageText = cell(map.stage);
    }

    /* 표 머리글을 못 읽었거나 칸이 비어 있으면 글자에서 다시 찾습니다 */
    if (!name) {
      var cellTexts = (cells || []).map(clean).filter(Boolean);
      var cands = cellTexts.filter(function (c) {
        if (c.length < 4) return false;
        if (c.indexOf(orderNo) >= 0) return false;
        if (/^[\d,.\s원%()\-]+$/.test(c)) return false;
        if (/^\d{4}[-.\/]\d{1,2}/.test(c)) return false;
        return true;
      });
      cands.sort(function (a, b) { return b.length - a.length; });
      if (cands.length) name = cleanName(cands[0].split(/\n/)[0]);
      if (!name) name = cleanName(nameOf(t, orderNo));
    }
    if (!option) option = optionFromText(t);
    if (option && name.indexOf(option) >= 0) name = cleanName(name.replace(option, ''));
    if (!receiver) {
      receiver = valueAfter(t, ['받는사람', '받는 사람', '수취인', '수령인', '주문자']);
    }
    if (receiver) {
      receiver = clean(receiver.split(/\n/)[0].replace(/01[016789][-\s]?\d{3,4}[-\s]?\d{4}/, '').replace(/(연락처|휴대폰|전화번호|전화).*$/, ''));
      if (receiver.length > 30) receiver = receiver.slice(0, 30);
    }
    if (!sale) sale = moneyOf(t, ['결제금액', '총\\s*결제', '결제\\s*금액', '주문금액', '상품금액', '판매가']);
    if (!qty) qty = qtyOf(t);
    if (!orderDate) orderDate = parseDate(valueAfter(t, ['주문일시', '주문일', '결제일시', '결제일'])) || parseDate(t);
    if (!due) due = dueFromText(t);

    var ph = (t.match(/01[016789][-\s]?\d{3,4}[-\s]?\d{4}/) || [''])[0];

    return {
      orderNo: orderNo,
      orderDate: orderDate,
      due: due,
      name: name,
      option: option,
      qty: qty,
      receiver: receiver,
      phone: clean(ph),
      sale: sale,
      stage: stageOf(stageText || t)
    };
  }

  function collectFromTables() {
    var out = [], seen = {};
    var trs = qsa('table tr');
    var map = headerMapFrom(trs);
    for (var i = 0; i < trs.length; i++) {
      var tr = trs[i];
      var t = txt(tr);
      if (!/\d{10,16}/.test(t)) continue;
      var cells = [];
      var tds = qsa('td, th', tr);
      for (var k = 0; k < tds.length; k++) cells.push(txt(tds[k]));
      if (!cells.length && tr.children) {
        for (var c = 0; c < tr.children.length; c++) cells.push(txt(tr.children[c]));
      }
      var r = parseRow(t, cells, map);
      if (!r || seen[r.orderNo]) continue;
      seen[r.orderNo] = 1;
      out.push(r);
    }
    return out;
  }

  function collectFromBlocks() {
    var byNo = {};
    var nodes = qsa('div, li, article, section, tr');
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      var t = txt(el);
      if (!t || t.length < 20 || t.length > 1500) continue;
      var nums = t.match(/\b(20\d{12,14})\b/g) || t.match(/\b(\d{10,16})\b/g);
      if (!nums || nums.length !== 1) continue;
      var no = nums[0];
      var kids = el.children || [];
      var deeper = false;
      for (var k = 0; k < kids.length; k++) {
        if (txt(kids[k]).indexOf(no) >= 0) { deeper = true; break; }
      }
      if (deeper) continue;
      if (!byNo[no] || byNo[no].length < t.length) byNo[no] = t;
    }
    var out = [];
    Object.keys(byNo).forEach(function (no) {
      var r = parseRow(byNo[no], []);
      if (r) out.push(r);
    });
    return out;
  }

  /* 이 화면에서 주문 줄 읽기 (표 → 블록 순서, 정보가 빈약하면 블록 결과 사용) */
  function collectOrders(opts) {
    opts = opts || {};
    var rows = collectFromTables();
    var rich = rows.filter(function (r) { return !!r.name; });
    if (!rows.length || rich.length < rows.length / 2) {
      var alt = collectFromBlocks();
      if (alt.length && alt.length >= rows.length) rows = alt;
    }
    if (opts.onlyPending) {
      rows = rows.filter(function (r) { return r.stage !== STATUS_DONE && r.stage !== STATUS_CANCEL; });
    }
    // 같은 주문번호는 한 번만
    var seen = {}, out = [];
    rows.forEach(function (r) {
      if (!r || !r.orderNo || seen[r.orderNo]) return;
      seen[r.orderNo] = 1;
      out.push(r);
    });
    return out;
  }

  /* ---------------------------------------------------------
   * 스토어명 · 스토어 번호
   * ------------------------------------------------------- */
  function matchMarket(text) {
    var s = String(text || '');
    for (var i = 0; i < MARKETS.length; i++) {
      var m = MARKETS[i];
      for (var k = 0; k < m.keys.length; k++) {
        if (m.keys[k] && s.indexOf(m.keys[k]) >= 0) return m.name;
      }
    }
    return '';
  }

  function detectStoreName() {
    var sel = ['header', '[class*="header"]', '[class*="Header"]', '[class*="gnb"]', '[class*="Gnb"]',
      '[class*="logo"]', '[class*="Logo"]', '[class*="store"]', '[class*="Store"]', '[class*="seller"]', '[class*="Seller"]'];
    var nodes = qsa(sel.join(','));
    var zones = [];
    for (var i = 0; i < nodes.length && i < 25; i++) zones.push(txt(nodes[i]).slice(0, 400));
    var hit = matchMarket(zones.join('\n'));
    if (hit) return hit;
    hit = matchMarket(String(document.title || ''));
    if (hit) return hit;
    var body = document.body ? txt(document.body) : '';
    return matchMarket(body.slice(0, 8000));
  }

  function detectStoreId() {
    var s = String(location.href || '');
    var m = s.match(/storeId=(\d+)/i) || s.match(/storeNo=(\d+)/i) || s.match(/\/stores?\/(\d+)/i);
    return m ? m[1] : '';
  }

  /* ---------------------------------------------------------
   * 결과 만들기 (로이창고 [📂 주문 현황 JSON 가져오기] 형식)
   * ------------------------------------------------------- */
  function summarize(rows) {
    var newOrders = 0, pending = 0, dueSoon = 0;
    rows.forEach(function (r) {
      if (r.stage === STATUS_NEW) newOrders++;
      if (r.stage !== STATUS_DONE && r.stage !== STATUS_CANCEL) pending++;
      var d = r.due ? daysLeft(r.due) : null;
      if (r.stage !== STATUS_DONE && r.stage !== STATUS_CANCEL && d !== null && d <= 1) dueSoon++;
    });
    return { rows: rows.length, newOrders: newOrders, pending: pending, dueSoon: dueSoon };
  }

  function buildResult(storeName, rows) {
    var now = new Date().toISOString();
    var sum = summarize(rows);
    var storeId = detectStoreId();
    var name = clean(storeName);
    return {
      app: '로이창고',
      kind: 'smartstoreOrders',
      collector: '로이창고 수집기',
      collectorVersion: EXT_VERSION,
      collectedAt: now,
      store: { name: name, storeId: storeId },
      page: { url: String(location.href || ''), title: String(document.title || '') },
      summary: sum,
      markets: [{
        market: name,
        storeId: storeId,
        newOrders: sum.newOrders,
        pending: sum.pending,
        dueSoon: sum.dueSoon,
        checkedAt: now,
        orders: rows
      }],
      orders: rows.map(function (r) {
        var o = {};
        Object.keys(r).forEach(function (k) { o[k] = r[k]; });
        o.market = name;
        return o;
      })
    };
  }

  /* ---------------------------------------------------------
   * 화면 (오른쪽 아래 패널)
   * ------------------------------------------------------- */
  var ui = { root: null, nameInput: null, onlyBox: null, sumEl: null, last: null };

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var css = '' +
      '#loi-ss-root{position:fixed;right:18px;bottom:18px;z-index:2147483000;width:288px;font-family:"Malgun Gothic","맑은 고딕",-apple-system,"Segoe UI",sans-serif;font-size:12.5px;color:#1b2138;background:#fff;border:1px solid #e5e2dd;border-radius:13px;box-shadow:0 10px 30px -10px rgba(20,25,45,.35);overflow:hidden}' +
      '#loi-ss-root.collapsed{width:auto}' +
      '#loi-ss-root .hdr{display:flex;align-items:center;gap:6px;padding:9px 11px;background:linear-gradient(135deg,#ff6a00,#ff3d00);color:#fff;font-weight:800;cursor:pointer;user-select:none}' +
      '#loi-ss-root .hdr .ver{font-size:10px;font-weight:700;opacity:.85;margin-left:auto}' +
      '#loi-ss-root .hdr .x{border:0;background:rgba(255,255,255,.2);color:#fff;width:20px;height:20px;border-radius:6px;cursor:pointer;font-size:12px;line-height:18px;padding:0}' +
      '#loi-ss-root .bd{padding:10px 11px 12px;display:grid;gap:7px}' +
      '#loi-ss-root.collapsed .bd{display:none}' +
      '#loi-ss-root .row{display:flex;align-items:center;gap:5px}' +
      '#loi-ss-root .row>span{color:#6b7280;font-weight:700;font-size:11px;flex:none}' +
      '#loi-ss-root input[type=text]{flex:1;min-width:0;height:27px;border:1px solid #d6d3cd;border-radius:7px;padding:0 7px;font-family:inherit;font-size:12px;color:#1b2138}' +
      '#loi-ss-root .mini{flex:none;height:27px;padding:0 8px;border:1px solid #d6d3cd;border-radius:7px;background:#fff;font-family:inherit;font-size:11px;font-weight:700;cursor:pointer;color:#4b5573}' +
      '#loi-ss-root .mini:hover{background:#faf9f7}' +
      '#loi-ss-root .chk{display:flex;align-items:center;gap:6px;font-size:11.5px;color:#4b5573;font-weight:700}' +
      '#loi-ss-root .go{width:100%;height:33px;border:0;border-radius:9px;background:linear-gradient(135deg,#ff6a00,#ff3d00);color:#fff;font-family:inherit;font-size:12.5px;font-weight:800;cursor:pointer}' +
      '#loi-ss-root .go:hover{filter:brightness(1.05)}' +
      '#loi-ss-root .sum{min-height:32px;padding:7px 8px;border-radius:8px;background:#f7f8fb;color:#4b5573;font-size:11.5px;line-height:1.5;word-break:keep-all}' +
      '#loi-ss-root .sum b{color:#1b2138}' +
      '#loi-ss-root .sum.bad{background:#fdecec;color:#b3261e}' +
      '#loi-ss-root .row2{display:grid;grid-template-columns:1fr 1fr;gap:5px}' +
      '#loi-ss-root .row2 button{height:29px;border:1px solid #d6d3cd;border-radius:8px;background:#fff;font-family:inherit;font-size:11.5px;font-weight:700;cursor:pointer;color:#1b2138}' +
      '#loi-ss-root .row2 button:hover{background:#faf9f7}' +
      '#loi-ss-root .tip{font-size:10.5px;color:#9ca3af;line-height:1.5;word-break:keep-all}' +
      '#loi-ss-toast{position:fixed;right:18px;bottom:16px;z-index:2147483001;padding:9px 13px;border-radius:10px;background:#1b2138;color:#fff;font-size:12px;font-family:"Malgun Gothic",sans-serif;box-shadow:0 8px 22px -8px rgba(20,25,45,.5);opacity:0;transition:opacity .18s}' +
      '#loi-ss-toast.on{opacity:1}';
    var st = document.createElement('style');
    st.id = STYLE_ID;
    st.textContent = css;
    (document.head || document.documentElement || document.body).appendChild(st);
  }

  function toast(msg) {
    var el = document.getElementById('loi-ss-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'loi-ss-toast';
      (document.body || document.documentElement).appendChild(el);
    }
    el.textContent = msg;
    el.className = 'on';
    setTimeout(function () { el.className = ''; }, 2400);
  }

  function setSum(text, bad) {
    if (!ui.sumEl) return;
    ui.sumEl.innerHTML = text;
    ui.sumEl.className = 'sum' + (bad ? ' bad' : '');
  }

  function summaryText(res) {
    if (!res) return '아직 긁지 않았습니다.';
    var s = res.summary || {};
    if (!s.rows) return '<b>' + escapeHtml(res.store && res.store.name || '스토어명 없음') + '</b> — 이 화면에서 주문을 찾지 못했습니다.';
    return '<b>' + escapeHtml(res.store && res.store.name || '') + '</b> · 주문 <b>' + s.rows + '</b>건' +
      ' · 신규 <b>' + s.newOrders + '</b> · 발송대기 <b>' + s.pending + '</b> · 기한임박 <b>' + s.dueSoon + '</b>' +
      '<br><span style="color:#9ca3af">' + escapeHtml((res.collectedAt || '').slice(0, 16).replace('T', ' ')) + ' 수집</span>';
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }

  function buildPanel() {
    if (document.getElementById(ROOT_ID)) { return; }
    injectStyle();
    var root = document.createElement('div');
    root.id = ROOT_ID;
    root.innerHTML = '' +
      '<div class="hdr" id="loi-ss-hdr">🏪 스마트스토어 주문 수집<span class="ver">v' + EXT_VERSION + '</span><button class="x" id="loi-ss-x" title="접기">–</button></div>' +
      '<div class="bd">' +
        '<div class="row"><span>스토어</span><input type="text" id="loi-ss-name" placeholder="예: 유유마켓"><button class="mini" id="loi-ss-detect" title="화면에서 스토어명을 다시 찾습니다">다시 찾기</button></div>' +
        '<label class="chk"><input type="checkbox" id="loi-ss-only" checked> 발송 전 주문만 (배송완료·취소 빼기)</label>' +
        '<button class="go" id="loi-ss-collect">📥 이 화면 주문 긁기</button>' +
        '<div class="sum" id="loi-ss-sum">아직 긁지 않았습니다.</div>' +
        '<div class="row2"><button id="loi-ss-save">⬇ JSON 저장</button><button id="loi-ss-copy">📋 복사</button></div>' +
        '<div class="tip">주문·발송관리 <b>목록</b> 화면에서 누르세요. 받는사람·결제금액은 그 주문을 펼친 상태에서 잘 읽힙니다. 이 패널은 읽기만 하고 아무것도 바꾸지 않습니다.</div>' +
      '</div>';
    (document.body || document.documentElement).appendChild(root);
    ui.root = root;
    ui.nameInput = document.getElementById('loi-ss-name');
    ui.onlyBox = document.getElementById('loi-ss-only');
    ui.sumEl = document.getElementById('loi-ss-sum');

    document.getElementById('loi-ss-collect').addEventListener('click', function () {
      runCollect(true);
    });
    document.getElementById('loi-ss-detect').addEventListener('click', function () {
      var nm = detectStoreName();
      if (nm) {
        ui.nameInput.value = nm;
        storeSet({ smartstoreStoreName: nm });
        toast('스토어명을 찾았습니다: ' + nm);
      } else {
        toast('화면에서 스토어명을 찾지 못했습니다 — 직접 적어 주세요');
      }
    });
    document.getElementById('loi-ss-save').addEventListener('click', function () {
      if (!ui.last) { toast('먼저 [📥 이 화면 주문 긁기]를 눌러 주세요'); return; }
      downloadResult(ui.last);
    });
    document.getElementById('loi-ss-copy').addEventListener('click', function () {
      if (!ui.last) { toast('먼저 [📥 이 화면 주문 긁기]를 눌러 주세요'); return; }
      copyText(JSON.stringify(ui.last, null, 2));
    });
    document.getElementById('loi-ss-x').addEventListener('click', function (ev) {
      if (ev && ev.stopPropagation) ev.stopPropagation();
      root.classList.toggle('collapsed');
    });
    document.getElementById('loi-ss-hdr').addEventListener('click', function () {
      root.classList.toggle('collapsed');
    });

    storeGet([NAME_KEY, LAST_KEY], function (res) {
      var nm = clean(res[NAME_KEY]);
      if (nm && ui.nameInput) ui.nameInput.value = nm;
      if (res[LAST_KEY] && res[LAST_KEY].summary) {
        ui.last = res[LAST_KEY];
        if (ui.nameInput && !ui.nameInput.value) ui.nameInput.value = clean((res[LAST_KEY].store || {}).name);
        setSum(summaryText(ui.last));
      }
      // 기억해 둔 이름이 없으면 화면에서 한 번 찾아 채워 둡니다 (틀리면 직접 고치면 됩니다)
      if (ui.nameInput && !clean(ui.nameInput.value)) {
        var found = detectStoreName();
        if (found) ui.nameInput.value = found;
      }
    });
  }

  function downloadResult(res) {
    var name = clean((res.store || {}).name) || '스마트스토어';
    var file = '로이창고_주문현황_' + name + '_' + stamp() + '.json';
    var blob = new Blob([JSON.stringify(res, null, 2)], { type: 'application/json;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = file;
    a.style.display = 'none';
    (document.body || document.documentElement).appendChild(a);
    a.click();
    setTimeout(function () {
      try { URL.revokeObjectURL(url); } catch (e) {}
      if (a.parentNode) a.parentNode.removeChild(a);
    }, 1500);
    toast('JSON을 저장했습니다 — 로이창고 [📦 주문·배송 관리] → [📂 주문 현황 JSON 가져오기]로 넣으세요');
  }

  function copyText(text) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () { toast('JSON을 복사했습니다'); }, function () { fallbackCopy(text); });
        return;
      }
    } catch (e) {}
    fallbackCopy(text);
  }
  function fallbackCopy(text) {
    try {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      (document.body || document.documentElement).appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
      toast('JSON을 복사했습니다');
    } catch (e) { toast('복사하지 못했습니다 — [⬇ JSON 저장]을 눌러 주세요'); }
  }

  function runCollect(showToast) {
    var name = ui.nameInput ? clean(ui.nameInput.value) : '';
    if (!name) name = detectStoreName();
    if (!name) {
      if (ui.nameInput) ui.nameInput.focus();
      setSum('스토어명을 찾지 못했습니다 — 위 칸에 스토어명(예: 유유마켓)을 직접 적어 주세요.', true);
      if (showToast) toast('스토어명을 먼저 적어 주세요');
      return null;
    }
    if (ui.nameInput && clean(ui.nameInput.value) !== name) ui.nameInput.value = name;
    storeSet({ smartstoreStoreName: name });

    var onlyPending = ui.onlyBox ? (ui.onlyBox.checked !== false) : true;
    var rows = collectOrders({ onlyPending: onlyPending });
    var res = buildResult(name, rows);
    ui.last = res;
    var obj = {};
    obj[LAST_KEY] = res;
    storeSet(obj);
    if (!rows.length) {
      setSum('<b>' + escapeHtml(name) + '</b> — 이 화면에서 주문을 찾지 못했습니다.<br><span style="color:#9ca3af">주문/발송관리 목록을 연 뒤 다시 눌러 주세요. (표가 아닌 화면은 주문을 펼친 뒤 눌러 주세요)</span>', true);
      if (showToast) toast('주문을 찾지 못했습니다 — 주문 목록 화면인지 확인해 주세요');
      return res;
    }
    setSum(summaryText(res));
    if (showToast) toast(name + ' 주문 ' + rows.length + '건을 읽었습니다 — [⬇ JSON 저장]');
    return res;
  }

  /* ---------------------------------------------------------
   * 팝업(수집함)에서 부르는 연결
   * ------------------------------------------------------- */
  try {
    chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
      if (!msg || !msg.type) return;
      if (msg.type === 'LOI_SMARTSTORE_COLLECT') {
        var res = runCollect(false);
        sendResponse({ ok: !!res, result: res });
        return true;
      }
      if (msg.type === 'LOI_SMARTSTORE_PING') {
        sendResponse({
          ok: true,
          version: EXT_VERSION,
          store: ui.nameInput ? clean(ui.nameInput.value) : '',
          last: ui.last ? ui.last.summary : null
        });
        return true;
      }
    });
  } catch (e) {}

  /* ---------------------------------------------------------
   * 시작 · 화면 이동(SPA) 대응
   * ------------------------------------------------------- */
  function start() {
    buildPanel();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(start, 1200); });
  } else {
    setTimeout(start, 1200);
  }
  // 스마트스토어센터는 화면을 다시 그리는 방식(SPA)이라, 패널이 사라지면 다시 붙입니다
  setInterval(function () {
    if (!document.getElementById(ROOT_ID)) start();
  }, 4000);

  // 점검용 (테스트·문제 확인용, 화면에는 영향 없음)
  window.__loiSmartstore = {
    version: EXT_VERSION,
    collectOrders: collectOrders,
    buildResult: buildResult,
    summarize: summarize,
    parseRow: parseRow,
    pickOrderNo: pickOrderNo,
    parseDate: parseDate,
    moneyOf: moneyOf,
    qtyOf: qtyOf,
    stageOf: stageOf,
    dueFromText: dueFromText,
    matchMarket: matchMarket,
    detectStoreName: detectStoreName,
    detectStoreId: detectStoreId,
    runCollect: runCollect,
    markets: MARKETS
  };
})();
