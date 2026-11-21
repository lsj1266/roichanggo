/* =========================================================
 * 로이창고 수집기 — tz1004.js
 *  천조직구(tz1004.co.kr) 배송대행 신청서(Delivery_W1.asp)에
 *  로이창고가 만든 JSON을 채워 넣습니다.
 *
 *  ★ 안전 원칙
 *   - 접수(접수대기/접수신청)·결제·수정·삭제는 절대 누르지 않습니다.
 *   - Order_IMD.asp 같은 접수 API를 호출하지 않습니다.
 *   - 값만 넣고, 마지막 확인과 버튼은 사용자가 직접 누릅니다.
 * ========================================================= */
(function () {
  'use strict';

  if (window.__loiTzLoaded) return;
  window.__loiTzLoaded = true;
  if (window.top !== window.self) return;
  if (!/\/Front\/Acting\/Delivery_W1\.asp/i.test(location.pathname)) return;

  var ROOT = 'loi-tz-root';
  var BTN = 'loi-tz-toggle';
  var PANEL = 'loi-tz-panel';
  var STATE_KEY = 'tzFillLast';
  var pos = { left: 16, bottom: 90 };

  /* ---------------- 값 넣기 (사이트 스크립트가 알아채도록) ---------------- */
  function setVal(el, v) {
    if (!el) return false;
    var proto = el.tagName === 'SELECT' ? window.HTMLSelectElement.prototype
      : (el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype);
    try {
      var desc = Object.getOwnPropertyDescriptor(proto, 'value');
      if (desc && desc.set) desc.set.call(el, v == null ? '' : String(v));
      else el.value = v == null ? '' : String(v);
    } catch (e) {
      el.value = v == null ? '' : String(v);
    }
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }

  function form() { return document.getElementById('frmOrder'); }

  function byName(name, root) {
    var f = root || form();
    return f ? f.querySelector('[name="' + name + '"]') : null;
  }

  function setByName(name, v) {
    var el = byName(name);
    if (!el) return false;
    if (el.type === 'checkbox' || el.type === 'radio') return false;
    setVal(el, v);
    return true;
  }

  function checkBox(id, on) {
    var el = document.getElementById(id);
    if (!el) return false;
    if (el.checked === !!on) return true;
    el.checked = !!on;
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }

  function radio(id) {
    var el = document.getElementById(id);
    if (!el) return false;
    el.checked = true;
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }

  /* 상품 줄을 필요한 만큼 늘립니다 (사이트의 [+ 추가] 버튼 사용) */
  function ensureRows(n) {
    var f = form();
    if (!f) return 0;
    for (var guard = 0; guard < 30; guard++) {
      var count = f.querySelectorAll('[name="PRO_NM"]').length;
      if (count >= n) return count;
      var add = f.querySelector('a.BtnAdd');
      if (!add) return count;
      try { add.click(); } catch (e) { return count; }
    }
    return f.querySelectorAll('[name="PRO_NM"]').length;
  }

  function rowEls(i) {
    var f = form();
    if (!f) return null;
    var nm = f.querySelectorAll('[name="PRO_NM"]');
    var el = nm[i];
    if (!el) return null;
    var li = el.closest('li') || el.parentNode;
    return li;
  }

  function setInRow(i, name, v) {
    var row = rowEls(i);
    if (!row) return false;
    var el = row.querySelector('[name="' + name + '"]');
    if (!el) return false;
    if (el.tagName === 'SELECT') {
      var ok = false;
      for (var k = 0; k < el.options.length; k++) {
        if (String(el.options[k].value) === String(v)) { ok = true; break; }
      }
      if (!ok) return false;
      setVal(el, v);
      return true;
    }
    setVal(el, v);
    return true;
  }

  /* ---------------- 채우기 ---------------- */
  function fill(data) {
    var f = form();
    if (!f) return { ok: false, msg: '천조직구 배송대행 신청서 화면이 아닙니다.' };
    if (!data || data.type !== 'roi_changgo_tz') {
      return { ok: false, msg: '로이창고에서 내려받은 [확장 자동입력용 JSON] 파일이 아닙니다.' };
    }
    var r = data.recipient || {};
    var done = 0, miss = [];

    // 받는 사람
    if (setByName('CONS_NM_KR', r.consKr)) done++;
    setByName('CONS_NM_EN', r.consEn);
    setByName('PERSON_CTMS_NO', r.personNo);
    setByName('MOB_NO', String(r.phone || '').replace(/[^0-9]/g, ''));
    setByName('CONS_ZIP', r.zip);
    setByName('CONS_ADDR', r.addr);
    setByName('CONS_ADDR_DET', r.addrDet);
    if (r.addrEn) setByName('CONS_ADDR_EN', r.addrEn);
    if (r.addrDetEn) setByName('CONS_ADDR_DET_EN', r.addrDetEn);
    if (String(data.ctmsDvs) === '2') radio('CTMS_DVS_CD_2'); else radio('CTMS_DVS_CD_1');

    // 관부가세
    if (String(data.dutyPay) === '1') {
      radio('DUTY_PAYMENT_CD_1');
      setByName('DUTY_MOB_NO', String(data.dutyPhone || '').replace(/[^0-9]/g, ''));
    } else {
      radio('DUTY_PAYMENT_CD_2');
    }

    // 요청사항 / 셀러
    setByName('DLVR_REQ_CONT', data.dlvrReq);
    setByName('CENTER_REQ_CONT', data.centerReq);
    setByName('SELLER_MARKET_NM', data.sellerMarketNm);
    setByName('SELLER_BUSI_NO', data.sellerBusiNo);
    if (data.dlvrReqSel) {
      var sel = byName('REQ_SEL');
      if (sel) setVal(sel, data.dlvrReqSel);
    }

    // 상품
    var items = data.items || [];
    var rows = ensureRows(items.length);
    var badSeq = [];
    items.forEach(function (it, i) {
      if (i >= rows) return;
      setInRow(i, 'SHOP_SITE', it.shopSite || '');
      setInRow(i, 'BRAND', it.brand || '');
      setInRow(i, 'SHOP_ORDER_NO', it.orderNo || '');
      setInRow(i, 'TRK_NO', it.trkNo || '');
      setInRow(i, 'PRO_NM', it.proNm || '');
      setInRow(i, 'PRO_QTY', it.qty || 1);
      setInRow(i, 'PRO_AMT', it.amt || 0);
      setInRow(i, 'COLOR', it.color || '');
      setInRow(i, 'SIZE', it.size || '');
      setInRow(i, 'PRO_URL', it.proUrl || '');
      setInRow(i, 'IMG_URL', it.imgUrl || '');
      setInRow(i, 'MARKET_NM', it.marketNm || '');
      setInRow(i, 'MARKET_ORDER_NO', it.marketOrderNo || '');
      if (it.stockNo) setInRow(i, 'STOCK_NO', it.stockNo);
      if (it.itemSeq) {
        if (!setInRow(i, 'ITEM_SEQ', it.itemSeq)) badSeq.push((i + 1) + '번(' + it.itemSeq + ')');
      }
      done++;
    });
    if (items.length > rows) miss.push('상품 ' + (items.length - rows) + '건은 줄을 더 만들지 못했습니다');

    // 부가서비스
    var svc = data.services || [];
    svc.forEach(function (code) {
      if (!checkBox('CHARGE_DET_CD_' + code, true)) miss.push('부가서비스 ' + code);
      var q = document.getElementById('CHARGE_DET_QTY_' + code);
      if (q) { q.disabled = false; if (!q.value) q.value = '1'; }
    });
    if (String(data.care).toUpperCase() === 'Y') {
      checkBox('CHARGE_DET_CD_65', true);
      checkBox('INSURANCE_AGREE_YN', true);
    }
    // 결제 방식
    if (String(data.autoPay) === '1') radio('SVC_DVS_CD_1'); else radio('SVC_DVS_CD_2');

    if (badSeq.length) miss.push('통관품목 번호를 찾지 못함: ' + badSeq.join(', '));

    return {
      ok: true,
      filled: done,
      rows: rows,
      items: items.length,
      services: svc.length,
      miss: miss,
      msg: items.length + '개 상품 정보를 신청서에 채웠습니다.'
    };
  }

  /* ---------------- 화면 (패널) ---------------- */
  function css() {
    return '' +
      '#loi-tz-root{position:fixed;z-index:2147483000;left:16px;bottom:90px;font-family:"Malgun Gothic","맑은 고딕",system-ui,sans-serif}' +
      '#loi-tz-toggle{display:flex;align-items:center;gap:6px;height:40px;padding:0 14px;border:0;border-radius:999px;background:linear-gradient(135deg,#ff6a00,#ff3d00);color:#fff;font-size:13px;font-weight:800;cursor:pointer;box-shadow:0 8px 20px -8px rgba(255,61,0,.7)}' +
      '#loi-tz-panel{position:absolute;left:0;bottom:50px;width:360px;max-height:70vh;overflow:auto;background:#fff;color:#1b2138;border:1px solid #e5e2dd;border-radius:14px;box-shadow:0 18px 40px -18px rgba(0,0,0,.45);padding:14px}' +
      '#loi-tz-panel.hidden{display:none}' +
      '#loi-tz-panel h3{margin:0 0 4px;font-size:14px}' +
      '#loi-tz-panel .sub{font-size:11.5px;color:#6b7280;line-height:1.5;margin-bottom:9px}' +
      '#loi-tz-panel label{display:block;font-size:11.5px;font-weight:700;color:#4b5573;margin:9px 0 4px}' +
      '#loi-tz-panel textarea{width:100%;height:90px;box-sizing:border-box;border:1px solid #d6d3cd;border-radius:8px;padding:7px;font-size:11px;font-family:ui-monospace,Consolas,monospace;resize:vertical}' +
      '#loi-tz-panel input[type=file]{width:100%;font-size:11.5px}' +
      '#loi-tz-panel .row{display:flex;gap:6px;margin-top:10px}' +
      '#loi-tz-panel button.act{flex:1;height:34px;border:1px solid #d6d3cd;border-radius:9px;background:#fff;font-size:12.5px;font-weight:800;cursor:pointer}' +
      '#loi-tz-panel button.act.primary{background:linear-gradient(135deg,#ff6a00,#ff3d00);border-color:transparent;color:#fff}' +
      '#loi-tz-panel .warn{margin-top:10px;padding:8px 9px;border-radius:8px;background:#fff7ed;border:1px solid #fed7aa;color:#9a3412;font-size:11px;line-height:1.5}' +
      '#loi-tz-panel .res{margin-top:9px;font-size:11.5px;line-height:1.55;font-weight:700;color:#0f7a5c;white-space:pre-wrap}' +
      '#loi-tz-panel .res.bad{color:#b91c1c}' +
      '#loi-tz-panel .tip{font-size:10.5px;color:#9ca3af;margin-top:8px;line-height:1.5}';
  }

  function build() {
    var old = document.getElementById(ROOT);
    if (old && old.parentNode) old.parentNode.removeChild(old);

    var style = document.createElement('style');
    style.textContent = css();
    document.head.appendChild(style);

    var root = document.createElement('div');
    root.id = ROOT;
    root.innerHTML =
      '<button type="button" id="' + BTN + '">📦 로이창고 신청서</button>' +
      '<div id="' + PANEL + '" class="hidden">' +
        '<h3>천조직구 신청서 채우기</h3>' +
        '<div class="sub">로이창고 [📦 천조직구 신청서]에서 내려받은 <b>자동입력용 JSON</b>을 넣으세요. 값만 채우고 <b>접수·결제는 누르지 않습니다.</b></div>' +
        '<label>JSON 파일</label>' +
        '<input type="file" id="loi-tz-file" accept=".json,application/json">' +
        '<label>또는 여기에 붙여넣기</label>' +
        '<textarea id="loi-tz-text" placeholder="{ &quot;type&quot;: &quot;roi_changgo_tz&quot;, ... }"></textarea>' +
        '<div class="row"><button type="button" class="act primary" id="loi-tz-fill">✍️ 신청서 채우기</button>' +
        '<button type="button" class="act" id="loi-tz-clear">입력 지우기</button></div>' +
        '<div class="res" id="loi-tz-res"></div>' +
        '<div class="warn">채운 뒤 반드시 확인하세요: ① 개인통관부호 <b>[유효체크]</b> ② 상품 영문명·통관품목 ③ 부가서비스·결제 방식. 마지막에 <b>[접수대기]</b> 또는 <b>[접수신청]</b>은 직접 누르셔야 합니다.</div>' +
        '<div class="tip">개인통관번호는 이 화면에서만 쓰이고 저장되지 않습니다. JSON 파일은 채운 뒤 지우셔도 됩니다.</div>' +
      '</div>';
    document.body.appendChild(root);

    var panel = document.getElementById(PANEL);
    var res = document.getElementById('loi-tz-res');
    var text = document.getElementById('loi-tz-text');
    var file = document.getElementById('loi-tz-file');

    document.getElementById(BTN).addEventListener('click', function () {
      panel.classList.toggle('hidden');
      if (!panel.classList.contains('hidden')) {
        try {
          chrome.storage.local.get({ tzFillLast: null }, function (r) {
            if (r && r.tzFillLast && !text.value) text.value = r.tzFillLast;
          });
        } catch (e) { /* 확장 밖에서 열린 경우 */ }
      }
    });

    document.getElementById('loi-tz-clear').addEventListener('click', function () {
      text.value = '';
      file.value = '';
      res.textContent = '';
      res.className = 'res';
    });

    file.addEventListener('change', function () {
      var f = file.files && file.files[0];
      if (!f) return;
      var rd = new FileReader();
      rd.onload = function () {
        text.value = String(rd.result || '');
        res.className = 'res';
        res.textContent = '파일을 읽었습니다. [신청서 채우기]를 눌러 주세요.';
      };
      rd.readAsText(f, 'utf-8');
    });

    document.getElementById('loi-tz-fill').addEventListener('click', function () {
      var raw = String(text.value || '').trim();
      if (!raw) {
        res.className = 'res bad';
        res.textContent = 'JSON을 먼저 넣어 주세요.';
        return;
      }
      var data;
      try { data = JSON.parse(raw); }
      catch (e) {
        res.className = 'res bad';
        res.textContent = 'JSON을 읽지 못했습니다. 파일을 그대로 열어 다시 복사해 주세요.';
        return;
      }
      var out = fill(data);
      res.className = 'res' + (out.ok ? '' : ' bad');
      res.textContent = out.ok
        ? out.msg + '\n' + (out.miss && out.miss.length ? '확인 필요: ' + out.miss.join(' · ') : '모두 채웠습니다. 유효체크 후 접수 버튼을 직접 눌러 주세요.')
        : out.msg;
      try { chrome.storage.local.set({ tzFillLast: raw }); } catch (e) { /* noop */ }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build);
  else build();

  // 테스트에서 채우기 로직을 직접 확인할 수 있게 (페이지에는 영향 없음)
  window.__loiTzFill = fill;
})();
