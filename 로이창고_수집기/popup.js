/* =========================================================
 * 로이창고 상품 수집기 — popup.js
 * 담은 상품 보기 / 삭제 / JSON·CSV 내보내기 / 전체 비우기
 * ========================================================= */
(function () {
  'use strict';

  var listEl = document.getElementById('list');
  var countEl = document.getElementById('count');
  var statusEl = document.getElementById('status');
  var btnJson = document.getElementById('exportJson');
  var btnCsv = document.getElementById('exportCsv');
  var btnClear = document.getElementById('clearAll');
  var confirmBox = document.getElementById('confirmBox');
  var confirmCount = document.getElementById('confirmCount');
  var confirmYes = document.getElementById('confirmYes');
  var confirmNo = document.getElementById('confirmNo');
  var bulkInfo = document.getElementById('bulkInfo');
  var bulkExport = document.getElementById('bulkExport');
  var bulkClear = document.getElementById('bulkClear');
  var bulkConfirm = document.getElementById('bulkConfirm');
  var bulkConfirmYes = document.getElementById('bulkConfirmYes');
  var bulkConfirmNo = document.getElementById('bulkConfirmNo');

  var products = [];
  var bulkItems = [];   // 퍼센티 대량 수집으로 저장된 분할 파일들

  /* ---------------- storage ---------------- */
  function load() {
    chrome.storage.local.get({ collectedProducts: [] }, function (res) {
      products = Array.isArray(res.collectedProducts) ? res.collectedProducts : [];
      products.sort(function (a, b) {
        return String((b && b.collectedAt) || '').localeCompare(String((a && a.collectedAt) || ''));
      });
      render();
    });
  }

  function save(next) {
    products = next;
    chrome.storage.local.set({ collectedProducts: products }, function () { render(); });
  }

  /* ---------------- 렌더 ---------------- */
  function render() {
    countEl.textContent = products.length + '개';
    listEl.innerHTML = '';

    if (!products.length) {
      var empty = document.createElement('div');
      empty.className = 'empty';
      empty.innerHTML =
        '<b>아직 담은 상품이 없습니다</b>' +
        '타오바오 · 티몰 · 1688 · 라쿠텐 상품 페이지에서<br />' +
        '<b style="display:inline">[🛒 로이창고로 수집]</b> 을 눌러 보세요.<br />' +
        '<span style="font-size:11px">검색 목록에서는 상품 카드의 작은 [🛒 로이창고] 버튼을 쓰면 됩니다.<br />' +
        '퍼센티는 <b style="display:inline">신규 상품 등록</b> 화면 왼쪽 아래 [🛒 퍼센티 목록 수집] 버튼을 쓰세요.<br />' +
        '온채널·오너클랜·도매매 상품 상세에서는 오른쪽 <b style="display:inline">[🏠 로이창고 담기]</b> 버튼을 쓰세요.</span>';
      listEl.appendChild(empty);
    } else {
      for (var i = 0; i < products.length; i++) {
        listEl.appendChild(renderRow(products[i], i));
      }
    }

    var has = products.length > 0;
    btnJson.disabled = !has;
    btnCsv.disabled = !has;
    btnClear.disabled = !has;
    if (!has) confirmBox.classList.add('hidden');
  }

  function renderRow(p, index) {
    var row = document.createElement('div');
    row.className = 'item';

    var thumb = document.createElement('div');
    thumb.className = 'thumb';
    if (p.imageUrl) {
      thumb.style.backgroundImage = 'url("' + String(p.imageUrl).replace(/"/g, '%22') + '")';
    } else {
      thumb.textContent = p.currency === 'JPY' ? '🗾' : '🀄';
    }
    row.appendChild(thumb);

    var body = document.createElement('div');
    body.className = 'body';

    var a = document.createElement('a');
    a.className = 'title';
    a.href = p.url || '#';
    a.target = '_blank';
    a.rel = 'noreferrer noopener';
    a.textContent = p.originalTitle || '(제목 없음)';
    body.appendChild(a);

    var meta = document.createElement('div');
    meta.className = 'meta';

    var site = document.createElement('span');
    site.className = 'site';
    site.textContent = p.sourceLabel || labelFor(p.source);
    meta.appendChild(site);

    var price = document.createElement('span');
    price.className = 'price';
    price.textContent = formatPrice(p);
    meta.appendChild(price);

    var imgN = (p.images || []).length;
    if (imgN) {
      var badge = document.createElement('span');
      badge.textContent = '사진 ' + imgN;
      meta.appendChild(badge);
    }

    body.appendChild(meta);

    if (p.options && p.options.length) {
      var opts = document.createElement('div');
      opts.className = 'opts';
      var names = p.options.map(function (o) { return typeof o === 'string' ? o : (o && o.name) || ''; }).filter(Boolean);
      var shown = names.slice(0, 3).join(' · ');
      var more = names.length > 3 ? ' 외 ' + (names.length - 3) + '개' : '';
      opts.textContent = '옵션: ' + shown + more;
      body.appendChild(opts);
    }

    row.appendChild(body);

    var del = document.createElement('button');
    del.className = 'del';
    del.type = 'button';
    del.title = '이 항목 삭제';
    del.textContent = '✕';
    del.addEventListener('click', function () {
      var target = products[index];
      var next = products.filter(function (it) { return it !== target; });
      save(next);
      flash('항목을 삭제했습니다.');
    });
    row.appendChild(del);

    return row;
  }

  function labelFor(source) {
    if (source === 'taobao') return '타오바오';
    if (source === '1688') return '1688';
    if (source === 'rakuten') return '라쿠텐';
    if (source === 'percenty') return '퍼센티';
    if (source === 'onch') return '온채널';
    if (source === 'ownerclan') return '오너클랜';
    if (source === 'domeme') return '도매매';
    return source || '-';
  }
  function isDomestic(p) {
    return !!(p && (p.source === 'onch' || p.source === 'ownerclan' || p.source === 'domeme'));
  }

  function formatPrice(p) {
    if (p.price === null || p.price === undefined || p.price === '') return '가격 미확인';
    var n = Number(p.price);
    if (!isFinite(n)) return '가격 미확인';
    var cur = p.currency || (p.source === 'rakuten' ? 'JPY' : 'CNY');
    var max = Number(p.priceMax);
    var shown = n.toLocaleString('ko-KR', { maximumFractionDigits: 2 });
    if (isFinite(max) && max > n) shown += '~' + max.toLocaleString('ko-KR', { maximumFractionDigits: 2 });
    return shown + (cur === 'KRW' ? ' 원' : ' ' + cur);
  }

  function flash(msg) {
    statusEl.textContent = msg;
    setTimeout(function () {
      if (statusEl.textContent === msg) statusEl.textContent = '';
    }, 2200);
  }

  /* ---------------- 내보내기 ---------------- */
  function stamp() {
    var d = new Date();
    var p2 = function (v) { return String(v).padStart(2, '0'); };
    return d.getFullYear() + p2(d.getMonth() + 1) + p2(d.getDate()) + '_' + p2(d.getHours()) + p2(d.getMinutes());
  }

  function download(filename, text, mime) {
    var blob = new Blob([text], { type: mime });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
      URL.revokeObjectURL(url);
      if (a.parentNode) a.parentNode.removeChild(a);
    }, 1500);
  }

  function optionNames(p) {
    return (p.options || []).map(function (o) {
      return typeof o === 'string' ? o : (o && o.name) || '';
    }).filter(Boolean);
  }

  function toExport(p) {
    var o = {
      id: p.id || '',
      source: p.source || '',
      sourceLabel: p.sourceLabel || labelFor(p.source),
      url: p.url || '',
      originalTitle: p.originalTitle || '',
      price: p.price === undefined ? null : p.price,
      currency: p.currency || (p.source === 'rakuten' ? 'JPY' : 'CNY'),
      imageUrl: p.imageUrl || '',
      images: Array.isArray(p.images) ? p.images : [],
      options: optionNames(p),
      from: p.from || 'detail',
      collectedAt: p.collectedAt || ''
    };
    if (isDomestic(p)) {
      o.name = p.name || p.originalTitle || '';
      o.cost = p.cost === undefined ? null : p.cost;
      o.shippingFee = p.shippingFee === undefined ? null : p.shippingFee;
      o.stock = p.stock === undefined ? null : p.stock;
      o.supplierName = p.supplierName || '';
      o.code = p.code || '';
      o.priceHidden = !!p.priceHidden;
    }
    if (p.source === 'percenty') {
      o.name = p.name || p.originalTitle || '';
      o.percentyId = p.percentyId || '';
      o.priceMax = p.priceMax === undefined ? null : p.priceMax;
      o.cost = p.cost === undefined ? null : p.cost;
      o.costMax = p.costMax === undefined ? null : p.costMax;
      o.costForeign = p.costForeign || '';
      o.exchangeRate = p.exchangeRate === undefined ? null : p.exchangeRate;
      o.shippingFeeRaw = p.shippingFeeRaw || '';
      o.returnFee = p.returnFee === undefined ? null : p.returnFee;
      o.exchangeFee = p.exchangeFee === undefined ? null : p.exchangeFee;
      o.groupName = p.groupName || '';
      o.registeredAt = p.registeredAt || '';
      o.page = p.page === undefined ? null : p.page;
    }
    return o;
  }

  function exportJson() {
    var out = products.map(toExport);
    download('로이창고_수집_' + stamp() + '.json', JSON.stringify(out, null, 2), 'application/json;charset=utf-8');
    flash('JSON 파일을 내보냈습니다 (' + out.length + '개) — 로이창고에서 [JSON/CSV 불러오기]로 여세요');
  }

  function csvCell(v) {
    var s = v === null || v === undefined ? '' : String(v);
    s = s.replace(/\r?\n/g, ' ').replace(/"/g, '""');
    return '"' + s + '"';
  }

  function exportCsv() {
    var header = ['수집일시', '사이트', '상품명', '가격', '통화', '옵션', '이미지URL', '상세이미지', '상품URL', '상품ID', '원가', '배송비', '재고', '상품코드'];
    var lines = [header.map(csvCell).join(',')];
    for (var i = 0; i < products.length; i++) {
      var p = products[i];
      lines.push([
        csvCell(p.collectedAt || ''),
        csvCell(p.sourceLabel || labelFor(p.source)),
        csvCell(p.originalTitle || ''),
        csvCell(p.price === null || p.price === undefined ? '' : p.price),
        csvCell(p.currency || (p.source === 'rakuten' ? 'JPY' : 'CNY')),
        csvCell(optionNames(p).join(' / ')),
        csvCell(p.imageUrl || ''),
        csvCell((p.images || []).join('|')),
        csvCell(p.url || ''),
        csvCell(p.percentyId || ''),
        csvCell(p.cost === null || p.cost === undefined ? '' : p.cost),
        csvCell(p.shippingFee === null || p.shippingFee === undefined ? '' : p.shippingFee),
        csvCell(p.stock === null || p.stock === undefined ? '' : p.stock),
        csvCell(p.code || '')
      ].join(','));
    }
    var text = '\uFEFF' + lines.join('\r\n') + '\r\n';
    download('로이창고_수집_' + stamp() + '.csv', text, 'text/csv;charset=utf-8');
    flash('CSV 파일을 내보냈습니다 (' + products.length + '개)');
  }

  /* ---------------- 이벤트 ---------------- */
  btnJson.addEventListener('click', exportJson);

  var tzOpen = document.getElementById('openTz');
  if (tzOpen) {
    tzOpen.addEventListener('click', function () {
      try {
        chrome.tabs.create({ url: 'https://www.tz1004.co.kr/Front/Acting/Delivery_W.asp' });
      } catch (e) {
        flash('천조직구 주소를 직접 열어 주세요: tz1004.co.kr');
      }
    });
  }
  btnCsv.addEventListener('click', exportCsv);

  btnClear.addEventListener('click', function () {
    if (!products.length) return;
    confirmCount.textContent = String(products.length);
    confirmBox.classList.toggle('hidden');
  });

  confirmNo.addEventListener('click', function () {
    confirmBox.classList.add('hidden');
  });

  confirmYes.addEventListener('click', function () {
    save([]);
    confirmBox.classList.add('hidden');
    flash('전체 목록을 비웠습니다.');
  });

  /* ---------------- 퍼센티 대량 수집(분할 파일) 보관분 ---------------- */
  function loadBulk() {
    chrome.storage.local.get({ percentyBulkIndex: [] }, function (res) {
      var idx = Array.isArray(res.percentyBulkIndex) ? res.percentyBulkIndex : [];
      var total = 0;
      for (var i = 0; i < idx.length; i++) total += Number(idx[i].count) || 0;
      bulkInfo.textContent = idx.length
        ? ('퍼센티 대량 수집 보관분: ' + total.toLocaleString('ko-KR') + '건 · 파일 ' + idx.length + '개')
        : '퍼센티 대량 수집 보관분: 없음';
      bulkExport.disabled = !idx.length;
      bulkClear.disabled = !idx.length;
      bulkItems = idx;
    });
  }

  function exportBulkFiles() {
    if (!bulkItems.length) return;
    var keys = bulkItems.map(function (e) { return e.key; });
    chrome.storage.local.get(keys, function (res) {
      var n = 0;
      bulkItems.forEach(function (e, i) {
        var arr = res[e.key];
        if (!Array.isArray(arr) || !arr.length) return;
        var name = e.file || ('퍼센티_목록_' + stamp() + '_' + (i + 1) + '.json');
        setTimeout(function () {
          download(name, JSON.stringify(arr, null, 2), 'application/json;charset=utf-8');
        }, i * 350);
        n++;
      });
      flash('분할 파일 ' + n + '개를 다시 내려받습니다 (다운로드 폴더)');
    });
  }

  function clearBulk() {
    var keys = bulkItems.map(function (e) { return e.key; });
    var obj = { percentyBulkIndex: [] };
    keys.forEach(function (k) { obj[k] = null; });
    chrome.storage.local.set(obj, function () {
      bulkConfirm.classList.add('hidden');
      loadBulk();
      flash('퍼센티 대량 수집 보관분을 비웠습니다.');
    });
  }

  bulkExport.addEventListener('click', exportBulkFiles);
  bulkClear.addEventListener('click', function () {
    if (!bulkItems.length) return;
    bulkConfirm.classList.toggle('hidden');
  });
  bulkConfirmYes.addEventListener('click', clearBulk);
  bulkConfirmNo.addEventListener('click', function () { bulkConfirm.classList.add('hidden'); });

  chrome.storage.onChanged.addListener(function (changes, area) {
    if (area === 'local' && changes.percentyBulkIndex) loadBulk();
    if (area === 'local' && changes.collectedProducts) {
      var v = changes.collectedProducts.newValue;
      products = Array.isArray(v) ? v : [];
      products.sort(function (a, b) {
        return String((b && b.collectedAt) || '').localeCompare(String((a && a.collectedAt) || ''));
      });
      render();
    }
  });

  load();
  loadBulk();
})();
