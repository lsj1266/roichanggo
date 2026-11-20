/* =========================================================
 * 로이창고 상품 수집기 — content.js
 *  - 상품 상세 페이지: 오른쪽 아래 [🛒 로이창고로 수집] 버튼
 *      상품명·가격·옵션·썸네일·상세이미지(최대 10장)·원본URL
 *  - 검색/목록 페이지: 상품 카드마다 작은 [🛒 로이창고] 버튼
 *      카드의 상품 URL·제목·가격·썸네일을 바로 담음
 *  저장 위치: chrome.storage.local → { collectedProducts: [...] }
 * ========================================================= */
(function () {
  'use strict';

  if (window.__loiCollectorLoaded) return;
  window.__loiCollectorLoaded = true;
  if (window.top !== window.self) return;

  var SITE = detectSite();
  if (!SITE) return;
  var KIND = SITE === '1688' ? '1688' : (SITE === 'rakuten' ? 'rakuten' : 'taobao');

  // 상품 상세 주소 판별 (아래 detectPage에서 먼저 쓰이므로 여기서 정의)
  var PRODUCT_URL_RE = {
    taobao: /(item\.taobao\.com\/item\.htm|detail\.tmall\.com\/item\.htm|detail\.tmall\.com\/.*[?&]id=)/i,
    '1688': /detail\.1688\.com\/offer\/\d+\.html/i,
    rakuten: /item\.rakuten\.co\.jp\/[^\/?#]+\/[^\/?#]+/i
  };

  var PAGE = detectPage();

  var BUTTON_ID = 'loi-collector-btn';
  var ROOT_ID = 'loi-collector-root';
  var TOAST_ID = 'loi-collector-toast';
  var MINI_CLASS = 'loi-mini';

  var SITE_INFO = {
    taobao: { source: 'taobao', label: '타오바오', currency: 'CNY' },
    tmall: { source: 'taobao', label: '티몰', currency: 'CNY' },
    '1688': { source: '1688', label: '1688', currency: 'CNY' },
    rakuten: { source: 'rakuten', label: '라쿠텐', currency: 'JPY' }
  };

  /* ---------------------------------------------------------
   * 사이트 / 페이지 판별
   * ------------------------------------------------------- */
  function detectSite() {
    var host = (location.hostname || '').toLowerCase();
    if (/(^|\.)item\.taobao\.com$/.test(host)) return 'taobao';
    if (/(^|\.)detail\.tmall\.com$/.test(host)) return 'tmall';
    if (/(^|\.)detail\.1688\.com$/.test(host)) return '1688';
    if (/(^|\.)item\.rakuten\.co\.jp$/.test(host)) return 'rakuten';
    if (/(^|\.)s\.taobao\.com$/.test(host)) return 'taobao';
    if (/(^|\.)s\.1688\.com$/.test(host)) return '1688';
    if (/(^|\.)search\.rakuten\.co\.jp$/.test(host)) return 'rakuten';
    if (/(^|\.)www\.rakuten\.co\.jp$/.test(host)) return 'rakuten';
    return null;
  }

  function detectPage() {
    var host = (location.hostname || '').toLowerCase();
    var path = (location.pathname || '').toLowerCase();
    if (/^s\./.test(host) || /^search\./.test(host)) return 'list';
    if (path.indexOf('/search') === 0) return 'list';
    if (isProductUrl(location.href)) return 'detail';
    return 'list';
  }

  function isProductUrl(u) {
    var s = String(u || '');
    var re = PRODUCT_URL_RE[KIND];
    return re ? re.test(s) : false;
  }

  /* 상세 페이지와 같은 상품을 목록에서 담아도 한 건으로 합쳐지도록 주소를 정리 */
  function canonicalUrl(u) {
    var s = normalizeUrl(u);
    if (!s) return '';
    try {
      var url = new URL(s);
      if (KIND === 'taobao') {
        var id = url.searchParams.get('id');
        if (id) {
          var host = /tmall\.com$/i.test(url.hostname) ? 'detail.tmall.com' : 'item.taobao.com';
          return 'https://' + host + '/item.htm?id=' + id;
        }
      }
      if (KIND === '1688') {
        var m = url.pathname.match(/\/offer\/(\d+)\.html/);
        if (m) return 'https://detail.1688.com/offer/' + m[1] + '.html';
      }
      if (KIND === 'rakuten') return url.origin + url.pathname;
    } catch (e) { /* ignore */ }
    return s;
  }

  /* ---------------------------------------------------------
   * 공통 유틸
   * ------------------------------------------------------- */
  function firstEl(selectors) {
    for (var i = 0; i < selectors.length; i++) {
      try {
        var el = document.querySelector(selectors[i]);
        if (el) return el;
      } catch (e) { /* 잘못된 셀렉터 무시 */ }
    }
    return null;
  }

  function allEls(selectors) {
    var out = [];
    for (var i = 0; i < selectors.length; i++) {
      try {
        var list = document.querySelectorAll(selectors[i]);
        for (var j = 0; j < list.length; j++) out.push(list[j]);
      } catch (e) { /* skip */ }
    }
    return out;
  }

  function textOf(el) {
    if (!el) return '';
    var t = el.innerText || el.textContent || '';
    return String(t).replace(/\s+/g, ' ').trim();
  }

  function firstText(selectors) {
    for (var i = 0; i < selectors.length; i++) {
      var t = textOf(firstEl([selectors[i]]));
      if (t) return t;
    }
    return '';
  }

  function metaContent(list) {
    for (var i = 0; i < list.length; i++) {
      var el = document.querySelector(list[i]);
      if (el) {
        var v = el.getAttribute('content') || el.getAttribute('value') || '';
        if (v && String(v).trim()) return String(v).trim();
      }
    }
    return '';
  }

  function readJsonLd() {
    var out = { name: '', image: '', images: [], price: null };
    var nodes = document.querySelectorAll('script[type="application/ld+json"]');
    for (var i = 0; i < nodes.length; i++) {
      var raw = nodes[i].textContent;
      if (!raw || raw.length > 500000) continue;
      var data;
      try { data = JSON.parse(raw); } catch (e) { continue; }
      var list = flattenJsonLd(data);
      for (var c = 0; c < list.length; c++) {
        var obj = list[c];
        if (!obj || typeof obj !== 'object') continue;
        if (!out.name && typeof obj.name === 'string' && obj.name.trim()) out.name = obj.name.trim();
        var img = obj.image;
        if (img) {
          if (typeof img === 'string' && !out.image) out.image = img;
          else if (Array.isArray(img)) {
            for (var k = 0; k < img.length; k++) {
              var v = typeof img[k] === 'string' ? img[k] : (img[k] && img[k].url);
              if (v) out.images.push(v);
            }
            if (!out.image && out.images.length) out.image = out.images[0];
          } else if (typeof img === 'object' && img.url) {
            if (!out.image) out.image = img.url;
          }
        }
        if (out.price === null && obj.offers) {
          var offers = Array.isArray(obj.offers) ? obj.offers[0] : obj.offers;
          if (offers && typeof offers === 'object') {
            var n = toNumber(offers.price != null ? offers.price : offers.lowPrice);
            if (n !== null) out.price = n;
          }
        }
      }
    }
    return out;
  }

  function flattenJsonLd(data) {
    var list = [];
    if (!data) return list;
    if (Array.isArray(data)) {
      for (var i = 0; i < data.length; i++) list = list.concat(flattenJsonLd(data[i]));
      return list;
    }
    if (typeof data === 'object') {
      list.push(data);
      if (Array.isArray(data['@graph'])) {
        for (var g = 0; g < data['@graph'].length; g++) list = list.concat(flattenJsonLd(data['@graph'][g]));
      }
    }
    return list;
  }

  // "1,234.50" / "¥128.00" / "12,800円" / "当店通常価格1,280円 1,280円" → 앞쪽 첫 숫자
  function toNumber(raw) {
    if (raw === null || raw === undefined) return null;
    if (typeof raw === 'number') return isFinite(raw) && raw > 0 ? round2(raw) : null;
    var m = String(raw).match(/\d[\d,]*(?:\.\d+)?/);
    if (!m) return null;
    var n = parseFloat(m[0].replace(/,/g, ''));
    if (!isFinite(n) || n <= 0) return null;
    return round2(n);
  }

  function round2(n) { return Math.round(n * 100) / 100; }

  function normalizeUrl(u) {
    var s = String(u || '').trim();
    if (!s) return '';
    if (s.indexOf('//') === 0) s = 'https:' + s;
    if (!/^https?:\/\//i.test(s)) return '';
    return s;
  }

  function normalizeImage(u) {
    var s = normalizeUrl(u);
    if (!s) return '';
    s = s.replace(/(\.(?:jpe?g|png|webp|gif))_\d+x\d+[^/]*$/i, '$1');
    return s;
  }

  function imgUrlOf(img) {
    if (!img) return '';
    var attrs = ['src', 'data-src', 'data-lazy-src', 'data-ks-lazyload', 'data-original', 'data-lazyload', 'data-img'];
    for (var i = 0; i < attrs.length; i++) {
      var v = img.getAttribute(attrs[i]);
      if (v && !/^data:/i.test(v)) {
        var u = normalizeImage(v);
        if (u) return u;
      }
    }
    var srcset = img.getAttribute('srcset');
    if (srcset) {
      var first = String(srcset).split(',')[0].trim().split(' ')[0];
      var u2 = normalizeImage(first);
      if (u2) return u2;
    }
    var style = img.getAttribute('style');
    if (style) {
      var m = style.match(/url\(["']?([^"')]+)["']?\)/i);
      if (m) return normalizeImage(m[1]);
    }
    return '';
  }

  function uniqueStrings(arr, max) {
    var seen = Object.create(null);
    var out = [];
    for (var i = 0; i < arr.length; i++) {
      var v = String(arr[i] || '').replace(/\s+/g, ' ').trim();
      if (!v) continue;
      if (v.length > 60) continue;
      if (/^(请选择|選擇|选择|数量|数量选择|尺码|颜色|规格|配送|お届け|選択してください|サイズ|カラー|数量|在庫|購入数)$/.test(v)) continue;
      if (seen[v]) continue;
      seen[v] = true;
      out.push(v);
      if (out.length >= max) break;
    }
    return out;
  }

  function uniqUrls(arr, max) {
    var seen = Object.create(null);
    var out = [];
    for (var i = 0; i < (arr || []).length; i++) {
      var u = normalizeImage(arr[i]);
      if (!u || seen[u]) continue;
      if (/\/(icon|icons|logo|logos|sprite|avatar|loading)\b/i.test(u)) continue;
      seen[u] = true;
      out.push(u);
      if (out.length >= max) break;
    }
    return out;
  }

  /* ---------------------------------------------------------
   * 상세 페이지 추출기
   * ------------------------------------------------------- */
  var SELECTORS = {
    taobao: {
      title: ['h1[class*="mainTitle"]', '[class*="ItemHeader"] h1', '[class*="mainTitle"]', '.tb-main-title', '#J_Title h3', 'h1'],
      price: ['[class*="Price--priceText"]', '[class*="Price--normalText"]', '[class*="Price--"]', '[class*="priceText"]', '[class*="Price"] [class*="text"]', '.tm-price', '#J_PromoPrice .tb-rmb-num', '#J_StrPrice .tb-rmb-num', '[class*="price"] em'],
      image: ['#J_ImgBooth', '[class*="PicGallery"] img', '[class*="mainPic"] img', 'img[class*="mainImg"]'],
      options: ['[class*="SkuContent"] [class*="valueItem"]', '[class*="skuItem"] [class*="valueItem"]', '.tb-sku .tb-prop li a span', '#J_isku .tb-prop li a span']
    },
    tmall: {
      title: ['h1[class*="mainTitle"]', '[class*="ItemHeader"] h1', '[class*="mainTitle"]', '.tb-main-title', '#J_Title h1', 'h1'],
      price: ['[class*="Price--priceText"]', '[class*="Price--normalText"]', '[class*="Price--"]', '[class*="priceText"]', '.tm-price', '#J_StrPrice .tm-price', '[class*="price"] em'],
      image: ['#J_ImgBooth', '[class*="PicGallery"] img', '[class*="mainPic"] img', 'img[class*="mainImg"]'],
      options: ['[class*="SkuContent"] [class*="valueItem"]', '[class*="skuItem"] [class*="valueItem"]', '.tb-sku .tb-prop li a span', '#J_isku .tb-prop li a span']
    },
    '1688': {
      title: ['[class*="title-first-column"] h1', '[class*="title-text"]', '.mod-detail-title h1', '.d-title', '[class*="offer-title"]', 'h1'],
      price: ['[class*="price-text"]', '[class*="PriceText"]', '[class*="offer-price"] [class*="value"]', '[class*="od-pc-offer-price"] [class*="value"]', '.price .value', '[class*="price"] [class*="num"]'],
      image: ['[class*="detail-gallery"] img', '[class*="main-img"] img', '[class*="image-list"] img', '#dt-tab img', '.tab-trigger img'],
      options: ['[class*="sku-prop-item"] [class*="sku-item-name"]', '[class*="sku-filter-item"]', '[class*="prop-item"] [class*="prop-name"]', '.obj-content .obj-item']
    },
    rakuten: {
      title: ['[data-testid="item-name"]', 'h1.itemName', 'h1[class*="itemName"]', 'span[itemprop="name"]', '.item_name'],
      price: ['[data-testid="item-price"]', '[class*="price-value"]', '[class*="item-price"]', '.price2', 'span[itemprop="price"]'],
      image: ['[data-testid="item-image"] img', 'img[itemprop="image"]', '[class*="itemImage"] img', '.item-img img'],
      options: ['select[name*="option"] option', 'select[id*="sku"] option', '[class*="sku"] select option']
    }
  };

  // 상세 설명(이미지가 반복되는) 영역
  var DETAIL_BOXES = {
    taobao: ['#description', '#J_DivItemDesc', '[class*="desc-root"]', '[class*="Detail--"]', '[class*="descContent"]', '[class*="item-desc"]'],
    tmall: ['#description', '#J_DivItemDesc', '[class*="desc-root"]', '[class*="Detail--"]', '[class*="descContent"]'],
    '1688': ['#offer-detail', '[class*="detail-content"]', '[class*="desc-content"]', '[class*="detail-desc"]', '[class*="od-pc-detail"]', '#detailContent'],
    rakuten: ['[class*="itemDescription"]', '[data-testid="item-description"]', '#itemDescription', '[class*="description"]']
  };

  function extractTitle() {
    var t = firstText(SELECTORS[SITE].title);
    if (!t) t = metaContent(['meta[property="og:title"]', 'meta[name="twitter:title"]']);
    if (!t) t = readJsonLd().name;
    if (!t) t = firstText(['h1']) || document.title || '';
    return cleanTitle(t);
  }

  function cleanTitle(raw) {
    var t = String(raw || '').replace(/\s+/g, ' ').trim();
    if (/^【\s*楽天市場\s*】/.test(t)) {
      t = t.replace(/^【\s*楽天市場\s*】\s*/, '');
      t = t.replace(/\s*[：:]\s*[^：:]{1,60}$/, '');
    }
    t = t.replace(/\s*[-–—|｜:：]\s*(淘宝网|天猫|tmall\.com|taobao\.com|阿里巴巴|1688\.com|1688|楽天市場|楽天|Rakuten).*$/i, '');
    t = t.replace(/^【\s*楽天市場\s*】\s*/, '');
    return t.trim();
  }

  function extractPrice() {
    var els = allEls(SELECTORS[SITE].price);
    for (var i = 0; i < els.length; i++) {
      var n = toNumber(textOf(els[i]));
      if (n !== null && n > 0) return n;
    }
    var ld = readJsonLd();
    if (ld.price !== null && ld.price > 0) return ld.price;
    var mn = toNumber(metaContent([
      'meta[property="og:price:amount"]', 'meta[property="product:price:amount"]',
      'meta[itemprop="price"]', 'meta[name="price"]', 'meta[name="lowPrice"]'
    ]));
    if (mn !== null && mn > 0) return mn;

    // 영문/글로벌 UI 및 분할 span(¥ + 정수 + 소수) 대응 fallback
    try {
      var best = null;
      var bestScore = -1;
      var nodes = document.querySelectorAll('div, span, p, strong, em, font, b, i');
      var limit = Math.min(nodes.length, 3500);
      for (var j = 0; j < limit; j++) {
        var el = nodes[j];
        var txt = (el.innerText || '').trim();
        if (!txt || txt.length > 100) continue;
        var compact = txt.replace(/\s*\.\s*/g, '.').replace(/\s+/g, ' ');
        if (!/(?:¥|￥|RMB|CNY)\s*\d/i.test(compact)) continue;
        if (/88vip|limited time subsidy|coupon|discount\s+of|off\b|before\s+discount|krw|원/i.test(compact)) continue;
        var rect = el.getBoundingClientRect();
        if (!rect || rect.width <= 0 || rect.height <= 0 || rect.top < 0 || rect.top > 950) continue;
        var cs = window.getComputedStyle(el);
        if (cs && cs.textDecorationLine && cs.textDecorationLine.indexOf('line-through') !== -1) continue;
        var m = compact.match(/(?:¥|￥|RMB|CNY)\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/i);
        if (!m) continue;
        var val = toNumber(m[1]);
        if (val === null || val <= 0) continue;
        var fs = cs ? parseFloat(cs.fontSize) || 14 : 14;
        var score = fs + (/flash|sale|promo|현재|할인/i.test(txt) ? 10 : 0) - (txt.length * 0.1);
        if (score > bestScore) {
          bestScore = score;
          best = val;
        }
      }
      if (best !== null) return best;

      // 최후 수단: 본문 상단 텍스트 줄 단위 스캔
      var bodyText = (document.body && document.body.innerText || '').slice(0, 4000).split(/\r?\n/);
      for (var k = 0; k < bodyText.length; k++) {
        var line = bodyText[k].replace(/\s*\.\s*/g, '.').replace(/\s+/g, ' ').trim();
        if (!line || line.length > 100) continue;
        if (/88vip|limited time subsidy|coupon|discount\s+of|off\b|before\s+discount|krw|원/i.test(line)) continue;
        var lm = line.match(/(?:¥|￥|RMB|CNY)\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/i);
        if (lm) {
          var lv = toNumber(lm[1]);
          if (lv !== null && lv > 0) return lv;
        }
      }
    } catch (_) {}

    return null;
  }

  function extractImage() {
    var fromMeta = normalizeImage(metaContent([
      'meta[name="image"]', 'meta[property="og:image"]', 'meta[name="twitter:image"]', 'meta[itemprop="image"]'
    ]));
    if (fromMeta) return fromMeta;
    var els = allEls(SELECTORS[SITE].image);
    for (var i = 0; i < els.length; i++) {
      var u = imgUrlOf(els[i]);
      if (u) return u;
    }
    var ld = readJsonLd();
    if (ld.image) return normalizeImage(ld.image);
    return '';
  }

  function extractOptions() {
    var els = allEls(SELECTORS[SITE].options);
    var texts = [];
    for (var i = 0; i < els.length; i++) {
      var t = textOf(els[i]);
      if (t) texts.push(t);
    }
    if (SITE === 'rakuten') {
      var extra = rakutenVariantOptions();
      for (var k = 0; k < extra.length; k++) texts.push(extra[k]);
    }
    return uniqueStrings(texts, 80);
  }

  function rakutenVariantOptions() {
    var out = [];
    var rows = document.querySelectorAll('div, tr');
    for (var i = 0; i < rows.length; i++) {
      var el = rows[i];
      var txt = textOf(el);
      if (!txt || txt.length > 500) continue;
      if (!/^(商品詳細を選択|カラー|サイズ|タイプ|種類|色)/.test(txt)) continue;
      var btns = el.querySelectorAll('button, [role="radio"], [role="button"]');
      for (var j = 0; j < btns.length; j++) {
        var label = textOf(btns[j]);
        if (!label) continue;
        label = label.replace(/\s*[¥￥]?\s*[\d,]+(?:\.\d+)?\s*円.*$/, '').trim();
        label = label.replace(/^(カラー|サイズ|タイプ|種類|色)\s*[：:]\s*/, '').trim();
        if (label && !/^(未選択|選択してください|かごに追加|購入手続きへ)$/.test(label)) out.push(label);
      }
    }
    return out;
  }

  /* 상세 이미지 최대 10장 — 상세설명 영역의 이미지를 우선 담고, 모자라면 갤러리·구조화데이터로 보충 */
  function extractDetailImages() {
    var urls = [];
    var boxes = allEls(DETAIL_BOXES[SITE] || []);
    for (var b = 0; b < boxes.length; b++) {
      var imgs = boxes[b].querySelectorAll('img');
      for (var i = 0; i < imgs.length; i++) {
        var img = imgs[i];
        var w = img.naturalWidth || parseInt(img.getAttribute('width') || '0', 10) || 0;
        var h = img.naturalHeight || parseInt(img.getAttribute('height') || '0', 10) || 0;
        if (w && h && (w < 150 || h < 150)) continue;
        var cls = String(img.className || '') + ' ' + String(img.id || '');
        if (/icon|logo|sprite|avatar|badge/i.test(cls)) continue;
        var u = imgUrlOf(img);
        if (u) urls.push(u);
      }
    }

    var gallery = allEls(SELECTORS[SITE].image);
    for (var g = 0; g < gallery.length; g++) {
      var gu = imgUrlOf(gallery[g]);
      if (gu) urls.push(gu);
    }

    var ld = readJsonLd();
    if (ld.images && ld.images.length) urls = urls.concat(ld.images);
    else if (ld.image) urls.push(ld.image);

    var thumb = extractImage();
    var out = uniqUrls(urls, 10);
    // 썸네일이 목록에 없으면 맨 앞에 넣기
    if (thumb && out.indexOf(thumb) < 0) out.unshift(thumb);
    return out.slice(0, 10);
  }

  function extractProduct() {
    var info = SITE_INFO[SITE];
    var title = extractTitle();
    var price = extractPrice();
    var image = extractImage();
    return {
      id: 'p_' + hashString(canonicalUrl(location.href) || location.href) + '_' + Date.now().toString(36),
      source: info.source,
      sourceLabel: info.label,
      currency: info.currency,
      url: canonicalUrl(location.href) || location.href,
      pageUrl: location.href,
      originalTitle: title,
      price: price,
      imageUrl: image,
      images: extractDetailImages(),
      options: extractOptions(),
      from: 'detail',
      collectedAt: new Date().toISOString()
    };
  }

  function hashString(s) {
    var h = 5381;
    for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
    return (h >>> 0).toString(36);
  }

  function isCollectable(p) {
    var t = String(p.originalTitle || '').trim();
    if (t.length < 2) return false;
    if (/^(淘宝网|天猫|阿里巴巴|1688|1688\.com|楽天市場|楽天|Rakuten|淘宝|天猫商城|请登录|登录|购物车|ショッピングカート|購入履歴)$/i.test(t)) return false;
    if (/(登录|登陆|ログイン|验证码|页面不存在|ページが見つかりません|Access Denied|アクセスが拒否)/i.test(t) && t.length < 40) return false;
    if (!p.price && !p.imageUrl) return false;
    return true;
  }

  /* ---------------------------------------------------------
   * 목록(검색 결과) 페이지 — 카드마다 작은 수집 버튼
   * ------------------------------------------------------- */
  function productFromCard(card, url) {
    var info = SITE_INFO[SITE];
    var img = firstCardImage(card);
    var title = cardTitle(card, img);
    var price = cardPrice(card);
    return {
      id: 'p_' + hashString(url) + '_' + Date.now().toString(36),
      source: info.source,
      sourceLabel: info.label,
      currency: info.currency,
      url: url,
      pageUrl: url,
      originalTitle: title,
      price: price,
      imageUrl: img,
      images: [],
      options: [],
      from: 'list',
      collectedAt: new Date().toISOString()
    };
  }

  function firstCardImage(card) {
    var imgs = card.querySelectorAll('img');
    for (var i = 0; i < imgs.length; i++) {
      var w = imgs[i].naturalWidth || parseInt(imgs[i].getAttribute('width') || '0', 10) || 0;
      if (w && w < 60) continue;
      var u = imgUrlOf(imgs[i]);
      if (u) return u;
    }
    return '';
  }

  function cardTitle(card, img) {
    var el = card.querySelector('[class*="title"]') || card.querySelector('[class*="Title"]') || card.querySelector('h2, h3');
    var t = textOf(el);
    if (t.length < 4) t = (img && (img.getAttribute('alt') || '')) || '';
    if (t.length < 4) t = textOf(card.querySelector('a'));
    if (!t) t = card.getAttribute('title') || '';
    return cleanTitle(t).slice(0, 200);
  }

  function cardPrice(card) {
    var t = textOf(card).replace(/\s*\.\s*/g, '.');
    var m = t.match(/[¥￥]\s*(\d[\d,]*(?:\.\d+)?)/) || t.match(/(\d[\d,]*(?:\.\d+)?)\s*円/) || t.match(/[¥￥]?\s*(\d[\d,]*(?:\.\d+)?)/);
    return m ? toNumber(m[1]) : null;
  }

  // 상품 링크를 감싸는 "카드" 상자를 찾음 (링크 자체가 카드인 사이트도 있음)
  function cardFor(anchor) {
    var el = anchor.parentElement;
    for (var i = 0; i < 8 && el && el.nodeType === 1; i++) {
      var rect = el.getBoundingClientRect ? el.getBoundingClientRect() : null;
      if (rect && rect.width >= 110 && rect.height >= 70 && rect.width <= 1100 && rect.height <= 900) {
        if (el.querySelector('img')) return el;
      }
      el = el.parentElement;
    }
    var r2 = anchor.getBoundingClientRect ? anchor.getBoundingClientRect() : null;
    if (r2 && r2.width >= 110 && r2.height <= 900 && anchor.querySelector('img')) return anchor;
    return null;
  }

  function scanCards() {
    var anchors = document.querySelectorAll('a[href]');
    var found = 0;
    for (var i = 0; i < anchors.length; i++) {
      var a = anchors[i];
      if (a.dataset.loiSeen === '1') continue;
      var href = a.getAttribute('href') || '';
      if (!isProductUrl(href)) { continue; }
      if (a.closest('#loi-collector-root')) continue;
      var url = canonicalUrl(new URL(href, location.href).href);
      if (!url) continue;
      var card = cardFor(a);
      a.dataset.loiSeen = '1';
      if (!card) continue;
      if (card.dataset.loiHasButton === '1') continue;
      attachMiniButton(card, url);
      found++;
    }
    return found;
  }

  function attachMiniButton(card, url) {
    try {
      var pos = window.getComputedStyle(card).position;
      if (!pos || pos === 'static') card.style.position = 'relative';
    } catch (e) { /* ignore */ }
    card.dataset.loiHasButton = '1';
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = MINI_CLASS;
    btn.textContent = '🛒 로이창고';
    btn.title = '이 상품을 로이창고로 담습니다';
    btn.addEventListener('click', function (ev) {
      ev.preventDefault();
      ev.stopPropagation();
      var product;
      try { product = productFromCard(card, url); } catch (e) { product = null; }
      if (!product || !product.originalTitle) {
        showToast('⚠️ 상품 정보를 읽지 못했습니다', 'warn');
        return;
      }
      var old = btn.textContent;
      btn.textContent = '⏳';
      btn.disabled = true;
      saveProduct(product).then(function (n) {
        btn.textContent = '✅ 담음';
        showToast('✅ 로이창고에 담았습니다 (' + n + '개)', 'ok');
        setTimeout(function () { btn.textContent = old; btn.disabled = false; }, 1600);
      }, function () {
        btn.textContent = old;
        btn.disabled = false;
        showToast('⚠️ 저장에 실패했습니다', 'warn');
      });
    }, true);
    // 버튼 클릭이 카드 링크로 새지 않게
    ['mousedown', 'mouseup', 'pointerdown', 'pointerup'].forEach(function (type) {
      btn.addEventListener(type, function (ev) { ev.stopPropagation(); }, true);
    });
    card.appendChild(btn);
  }

  /* ---------------------------------------------------------
   * 저장
   * ------------------------------------------------------- */
  function getProducts() {
    return new Promise(function (resolve) {
      try {
        chrome.storage.local.get({ collectedProducts: [] }, function (res) {
          var list = res && res.collectedProducts;
          resolve(Array.isArray(list) ? list : []);
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

  function saveProduct(product) {
    return getProducts().then(function (list) {
      var idx = -1;
      for (var i = 0; i < list.length; i++) {
        if (list[i] && canonicalUrl(list[i].url) === canonicalUrl(product.url)) { idx = i; break; }
      }
      if (idx >= 0) {
        var old = list[idx] || {};
        product.id = old.id || product.id;
        product.collectedAt = new Date().toISOString();
        // 상세에서 담은 정보(옵션·상세이미지)는 지우지 않음
        if ((!product.images || !product.images.length) && old.images) product.images = old.images;
        if ((!product.options || !product.options.length) && old.options) product.options = old.options;
        list[idx] = product;
      } else {
        list.push(product);
      }
      return setProducts(list).then(function () { return list.length; });
    });
  }

  /* ---------------------------------------------------------
   * 상세 페이지 버튼 / 토스트
   * ------------------------------------------------------- */
  function collectDetail() {
    var btn = document.getElementById(BUTTON_ID);
    if (btn) { btn.disabled = true; btn.textContent = '⏳ 수집 중...'; }

    var product;
    try { product = extractProduct(); } catch (e) { product = null; }

    if (!product || !product.originalTitle) {
      restoreButton();
      showToast('⚠️ 상품 정보를 찾지 못했습니다. 상품 상세 페이지인지 확인해 주세요.', 'warn');
      return;
    }
    if (!isCollectable(product)) {
      restoreButton();
      showToast('⚠️ 상품 상세 페이지가 아닌 것 같습니다. 로그인·오류 화면은 수집되지 않습니다.', 'warn');
      return;
    }

    saveProduct(product).then(function (n) {
      restoreButton();
      var extra = (product.images || []).length ? ' · 상세사진 ' + product.images.length + '장' : '';
      if (product.price === null) showToast('⚠️ 담았습니다 (' + n + '개) · 가격은 확인하지 못했습니다', 'warn');
      else showToast('✅ 담았습니다 (' + n + '개)' + extra, 'ok');
    }, function () {
      restoreButton();
      showToast('⚠️ 저장에 실패했습니다. 잠시 후 다시 시도해 주세요.', 'warn');
    });
  }

  function restoreButton() {
    var btn = document.getElementById(BUTTON_ID);
    if (!btn) return;
    btn.disabled = false;
    btn.textContent = '🛒 로이창고로 수집';
  }

  function ensureDetailRoot() {
    var root = document.getElementById(ROOT_ID);
    if (root && document.documentElement.contains(root)) return root;
    root = document.createElement('div');
    root.id = ROOT_ID;
    root.style.touchAction = 'none';

    try {
      chrome.storage.local.get({ floatingBtnPos: null }, function (res) {
        if (res && res.floatingBtnPos && typeof res.floatingBtnPos.left === 'number' && typeof res.floatingBtnPos.top === 'number') {
          var maxL = Math.max(8, window.innerWidth - 190);
          var maxT = Math.max(8, window.innerHeight - 56);
          root.style.setProperty('left', Math.min(Math.max(8, res.floatingBtnPos.left), maxL) + 'px', 'important');
          root.style.setProperty('top', Math.min(Math.max(8, res.floatingBtnPos.top), maxT) + 'px', 'important');
          root.style.setProperty('right', 'auto', 'important');
          root.style.setProperty('bottom', 'auto', 'important');
        }
      });
    } catch (_) {}

    var btn = document.createElement('button');
    btn.id = BUTTON_ID;
    btn.type = 'button';
    btn.textContent = '🛒 로이창고로 수집';
    btn.title = SITE_INFO[SITE].label + ' 상품을 로이창고 목록에 담습니다 (드래그로 위치 이동 가능)';
    btn.style.cursor = 'grab';

    var dragState = { active: false, moved: false, startX: 0, startY: 0, origLeft: 0, origTop: 0 };
    btn.addEventListener('mousedown', function (ev) {
      if (ev.button !== 0) return;
      var rect = root.getBoundingClientRect();
      dragState.active = true;
      dragState.moved = false;
      dragState.startX = ev.clientX;
      dragState.startY = ev.clientY;
      dragState.origLeft = rect.left;
      dragState.origTop = rect.top;
      btn.style.cursor = 'grabbing';
      ev.preventDefault();
    });
    window.addEventListener('mousemove', function (ev) {
      if (!dragState.active) return;
      var dx = ev.clientX - dragState.startX;
      var dy = ev.clientY - dragState.startY;
      if (!dragState.moved && Math.hypot(dx, dy) > 5) dragState.moved = true;
      if (dragState.moved) {
        var maxL = Math.max(8, window.innerWidth - root.offsetWidth - 8);
        var maxT = Math.max(8, window.innerHeight - root.offsetHeight - 8);
        var nextL = Math.min(Math.max(8, dragState.origLeft + dx), maxL);
        var nextT = Math.min(Math.max(8, dragState.origTop + dy), maxT);
        root.style.setProperty('left', nextL + 'px', 'important');
        root.style.setProperty('top', nextT + 'px', 'important');
        root.style.setProperty('right', 'auto', 'important');
        root.style.setProperty('bottom', 'auto', 'important');
      }
    });
    window.addEventListener('mouseup', function () {
      if (!dragState.active) return;
      dragState.active = false;
      btn.style.cursor = 'grab';
      if (dragState.moved) {
        var rect = root.getBoundingClientRect();
        try {
          chrome.storage.local.set({ floatingBtnPos: { left: Math.round(rect.left), top: Math.round(rect.top) } });
        } catch (_) {}
        btn.dataset.justDragged = '1';
        setTimeout(function () { delete btn.dataset.justDragged; }, 80);
      }
    });

    btn.addEventListener('click', function (ev) {
      ev.preventDefault();
      ev.stopPropagation();
      if (btn.dataset.justDragged === '1') return;
      collectDetail();
    });
    root.appendChild(btn);
    (document.body || document.documentElement).appendChild(root);
    return root;
  }

  function showToast(message, kind) {
    var old = document.getElementById(TOAST_ID);
    if (old && old.parentNode) old.parentNode.removeChild(old);

    var toast = document.createElement('div');
    toast.id = TOAST_ID;
    toast.className = 'loi-collector-toast' + (kind === 'warn' ? ' loi-collector-toast--warn' : '');
    toast.textContent = message;
    (document.body || document.documentElement).appendChild(toast);

    requestAnimationFrame(function () { toast.classList.add('loi-collector-toast--show'); });
    setTimeout(function () {
      toast.classList.remove('loi-collector-toast--show');
      setTimeout(function () {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 300);
    }, 2600);
  }

  /* ---------------------------------------------------------
   * 페이지 이동(SPA) · 무한 스크롤 대응
   * ------------------------------------------------------- */
  var lastHref = location.href;
  var scanTimer = null;

  function scheduleScan() {
    if (scanTimer) return;
    scanTimer = setTimeout(function () {
      scanTimer = null;
      try { scanCards(); } catch (e) { /* ignore */ }
    }, 350);
  }

  function tick() {
    if (location.href !== lastHref) {
      lastHref = location.href;
      var old = document.getElementById(ROOT_ID);
      if (old && old.parentNode) old.parentNode.removeChild(old);
    }
    if (PAGE === 'detail') {
      ensureDetailRoot();
    } else {
      scheduleScan();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { tick(); scheduleScan(); });
  } else {
    tick();
    scheduleScan();
  }

  if (PAGE === 'list') {
    try {
      var mo = new MutationObserver(function () { scheduleScan(); });
      mo.observe(document.documentElement, { childList: true, subtree: true });
    } catch (e) { /* 구형 브라우저 */ }
    window.addEventListener('scroll', scheduleScan, { passive: true });
  }
  setInterval(tick, 1500);
})();
