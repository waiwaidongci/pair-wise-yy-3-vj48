// 耗材批次台账 · 页面（台账界面）
// 单页界面：库存、批次去向、停交付清单同源数据同步渲染；领用/登记/复核表单在此提交。

export const consumablesPage = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>耗材批次台账 · 岩芯切片室</title>
  <style>
    :root { --bg:#f1f3ef; --panel:#fff; --ink:#242822; --muted:#687062; --line:#d7ddd1; --accent:#526f43; --danger:#a03d2a; }
    * { box-sizing:border-box; }
    body { margin:0; background:var(--bg); color:var(--ink); font-family:Arial,"PingFang SC",sans-serif; }
    header { padding:22px 28px; background:#fff; border-bottom:1px solid var(--line); display:flex; justify-content:space-between; align-items:center; gap:16px; }
    h1 { margin:0; font-size:26px; } h2 { margin:0 0 12px; font-size:18px; } h3 { margin:14px 0 8px; font-size:15px; }
    main { display:grid; grid-template-columns:400px 1fr; gap:22px; padding:22px 28px; align-items:start; }
    form,.panel,.stat { background:#fff; border:1px solid var(--line); border-radius:8px; padding:16px; }
    label { display:block; margin:10px 0 5px; color:var(--muted); font-size:13px; }
    input,select,textarea { width:100%; border:1px solid var(--line); border-radius:6px; padding:9px; font:inherit; background:#fff; }
    button { border:0; border-radius:6px; background:var(--accent); color:#fff; padding:10px 13px; font-weight:700; cursor:pointer; }
    button.ghost { background:#fff; color:var(--accent); border:1px solid var(--accent); }
    button.danger { background:var(--danger); }
    .meta { color:var(--muted); font-size:13px; } .hint { margin-top:10px; color:var(--muted); font-size:12px; line-height:1.7; }
    .stats { display:grid; grid-template-columns:repeat(4,1fr); gap:10px; margin-bottom:14px; } .stat strong { display:block; font-size:24px; }
    .tabs { display:flex; gap:8px; margin-bottom:14px; flex-wrap:wrap; }
    .tabs button { background:#fff; color:var(--ink); border:1px solid var(--line); }
    .tabs button.active { background:var(--accent); color:#fff; border-color:var(--accent); }
    table { width:100%; border-collapse:collapse; font-size:13px; }
    th,td { text-align:left; padding:8px; border-bottom:1px solid var(--line); vertical-align:top; }
    th { color:var(--muted); font-weight:600; white-space:nowrap; }
    .pill { display:inline-block; border-radius:999px; padding:3px 9px; font-size:12px; border:1px solid var(--line); white-space:nowrap; }
    .pill.ok { background:#e7f0e2; color:#3c5a2e; border-color:#c4d8b8; }
    .pill.warn { background:#faf3df; color:#8a5f10; border-color:#e8d5a4; }
    .pill.bad { background:#fbe9e4; color:#8f3524; border-color:#efc4b8; }
    .pill.gray { background:#eef0ec; color:#687062; }
    .side { display:grid; gap:22px; }
    .card { border:1px solid var(--line); border-radius:8px; padding:12px; margin-bottom:10px; background:#fff; }
    .card.held { border-color:#efc4b8; background:#fff8f6; }
    .row { display:flex; gap:10px; } .row > span { flex:1; }
    a { color:var(--accent); }
    .empty { color:var(--muted); padding:14px; text-align:center; }
    @media (max-width:950px){ header{display:block;padding:18px 16px;} main{grid-template-columns:1fr;padding:16px;} .stats{grid-template-columns:1fr 1fr;} }
  </style>
</head>
<body>
  <header>
    <div><h1>耗材批次台账</h1><div class="meta">染料、研磨盘等耗材的批号、效期、去向与异常追溯</div></div>
    <div style="display:flex;gap:10px;align-items:center"><a class="pill" href="/" style="text-decoration:none">← 切片任务</a><button id="reload" class="ghost">刷新</button></div>
  </header>
  <main>
    <div class="side">
      <form id="batchForm">
        <h2>耗材批次登记</h2>
        <label>批号</label><input name="batchNo" required placeholder="如 DYE-ALZ-2610">
        <label>耗材名称</label><input name="name" required placeholder="如 茜素红S染液">
        <label>类别（对应切片步骤）</label><select name="category" required></select>
        <div class="row">
          <span><label>单位</label><input name="unit" required placeholder="瓶 / 张 / 片"></span>
          <span><label>数量</label><input name="quantity" type="number" min="1" required></span>
        </div>
        <label>有效期至</label><input name="expiryDate" type="date" required>
        <label>登记人</label><input name="operator" required>
        <button style="margin-top:12px">保存批次</button>
        <div class="hint">批号重复或有效期已过的批次不能登记入库。</div>
      </form>
      <form id="checkoutForm">
        <h2>领用登记</h2>
        <label>切片</label><select name="sliceId" required></select>
        <div id="sliceLogs" style="margin-top:6px"></div>
        <label>切片步骤</label><select name="step" required></select>
        <label>耗材批号</label><select name="batchNo" required></select>
        <div class="row">
          <span><label>数量</label><input name="quantity" type="number" min="1" required></span>
          <span><label>领用人</label><input name="operator" required></span>
        </div>
        <label>用途</label><input name="purpose" required placeholder="如 薄片粗磨至30μm">
        <button style="margin-top:12px">登记领用</button>
        <div class="hint">过期、剩余不足或批号重复（同切片同步骤）的领用<b>不会进入领用记录</b>，只在「领用与拒收」中留存拒收原因；异常批次禁止领用。</div>
      </form>
    </div>
    <section>
      <div class="stats" id="stats"></div>
      <div class="tabs" id="tabs"></div>
      <div class="panel" id="panel"></div>
    </section>
  </main>
  <script>
    var state = { data: null, tab: "inventory", traceBatch: "", keepCheckout: null };

    function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
    function pad(n) { return (n < 10 ? "0" : "") + n; }
    function fmtTime(iso) {
      if (!iso) return "-";
      var d = new Date(iso);
      return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) + " " + pad(d.getHours()) + ":" + pad(d.getMinutes());
    }
    function pill(status) {
      var cls = { "正常": "ok", "库存不足": "warn", "已过期": "bad", "异常批次": "bad", "已用完": "gray", "停交付中": "bad", "已恢复": "ok" }[status] || "gray";
      return '<span class="pill ' + cls + '">' + esc(status) + "</span>";
    }
    function batchByNo(d, no) { return d.batches.find(function (b) { return b.batchNo === no; }); }
    function sliceInfo(d, id) { return d.slices.find(function (s) { return s.sliceId === id; }); }

    async function api(path, options) {
      var res = await fetch(path, options && options.body ? Object.assign({}, options, { headers: { "Content-Type": "application/json" } }) : options);
      var data = await res.json();
      if (!res.ok) throw new Error(data.error || "请求失败");
      return data;
    }
    async function load() { state.data = await api("/api/consumables"); fillSelects(); render(); }

    function stat(label, value) { return '<div class="stat"><span>' + label + "</span><strong>" + value + "</strong></div>"; }
    function render() {
      var d = state.data;
      var active = d.holds.filter(function (h) { return h.status === "停交付中"; }).length;
      document.querySelector("#stats").innerHTML =
        stat("在册批次", d.batches.length) +
        stat("异常批次", d.batches.filter(function (b) { return b.abnormal; }).length) +
        stat("停交付切片", active) +
        stat("领用登记", d.checkouts.length + " 次");
      var tabs = [["inventory", "库存台账"], ["trace", "批次去向"], ["holds", "停交付清单" + (active ? " (" + active + ")" : "")], ["records", "领用与拒收"]];
      document.querySelector("#tabs").innerHTML = tabs.map(function (t) {
        return '<button data-tab="' + t[0] + '"' + (state.tab === t[0] ? ' class="active"' : "") + ">" + t[1] + "</button>";
      }).join("");
      var panel = document.querySelector("#panel");
      if (state.tab === "inventory") panel.innerHTML = viewInventory(d);
      else if (state.tab === "trace") panel.innerHTML = viewTrace(d);
      else if (state.tab === "holds") panel.innerHTML = viewHolds(d);
      else panel.innerHTML = viewRecords(d);
    }

    function viewInventory(d) {
      var rows = d.batches.map(function (b) {
        return "<tr><td><b>" + esc(b.batchNo) + "</b></td><td>" + esc(b.name) + "</td><td>" + esc(b.category) + " → " + esc(d.categoryStep[b.category]) + "</td>" +
          "<td>" + b.quantity + esc(b.unit) + "</td><td><b>" + b.remaining + "</b>" + esc(b.unit) + "</td><td>" + esc(b.expiryDate) + "</td>" +
          "<td>" + pill(b.status) + (b.abnormal ? '<div class="meta">' + esc(b.abnormalReason) + "（" + esc(b.flaggedBy) + " · " + fmtTime(b.flaggedAt) + "）</div>" : "") + "</td></tr>";
      }).join("");
      return "<h2>库存台账</h2><div class='meta' style='margin-bottom:10px'>剩余 = 登记数量 − 累计领用；过期、库存不足、已用完或异常批次在领用时会被拦截。今日 " + esc(d.today) + "。</div>" +
        "<table><thead><tr><th>批号</th><th>耗材</th><th>类别→步骤</th><th>登记量</th><th>剩余</th><th>有效期</th><th>状态</th></tr></thead><tbody>" + rows + "</tbody></table>";
    }

    function viewTrace(d) {
      if (!d.batches.length) return "<h2>批次去向</h2><div class='empty'>暂无批次</div>";
      var b = batchByNo(d, state.traceBatch) || d.batches[0];
      state.traceBatch = b.batchNo;
      var options = d.batches.map(function (x) {
        return '<option value="' + esc(x.batchNo) + '"' + (x.batchNo === b.batchNo ? " selected" : "") + ">" + esc(x.batchNo + " · " + x.name) + "</option>";
      }).join("");
      var list = d.checkouts.filter(function (c) { return c.batchNo === b.batchNo; });
      var rows = list.map(function (c) {
        var sl = sliceInfo(d, c.sliceId);
        return "<tr><td>" + fmtTime(c.at) + "</td><td><b>" + esc(c.sliceId) + "</b>" + (sl ? '<div class="meta">' + esc(sl.project) + "</div>" : '<div class="meta">样本未在册</div>') + "</td>" +
          "<td>" + esc(c.step) + "</td><td>" + c.quantity + esc(b.unit) + "</td><td>" + esc(c.purpose) + "</td><td>" + esc(c.operator) + "</td></tr>";
      }).join("") || '<tr><td colspan="6" class="empty">该批次暂无领用去向</td></tr>';
      var affectedIds = [];
      list.forEach(function (c) { if (affectedIds.indexOf(c.sliceId) < 0) affectedIds.push(c.sliceId); });
      var affected = affectedIds.map(function (id) {
        var hold = d.holds.find(function (h) { return h.sliceId === id && h.batchNo === b.batchNo && h.status === "停交付中"; });
        var sl = sliceInfo(d, id);
        return '<div class="card' + (hold ? " held" : "") + '"><b>' + esc(id) + "</b> " + (sl ? '<span class="meta">' + esc(sl.project) + "</span> " : "") + (hold ? pill("停交付中") : pill("正常")) +
          (hold ? '<div class="meta">因批次 ' + esc(hold.batchNo) + " 异常停交付 · 标记人 " + esc(hold.heldBy) + " · " + fmtTime(hold.heldAt) + "</div>" : "") + "</div>";
      }).join("") || '<div class="empty">无受影响切片</div>';
      var flagPart = b.abnormal
        ? '<div class="card held"><b>已标记异常</b><div class="meta">' + esc(b.abnormalReason) + " · 标记人 " + esc(b.flaggedBy) + " · " + fmtTime(b.flaggedAt) + "</div></div>"
        : '<form id="flagForm"><h3 style="margin-top:0">标记异常批次</h3><input type="hidden" name="batchNo" value="' + esc(b.batchNo) + '">' +
          '<label>异常原因</label><input name="reason" required placeholder="如 染色出现沉淀，复测不合格"><label>操作人</label><input name="operator" required>' +
          '<button class="danger" style="margin-top:10px">标记异常并停交付受影响切片</button></form>';
      return "<h2>批次去向</h2><label>选择批次</label><select id='traceBatch'>" + options + "</select>" +
        "<div class='meta' style='margin:8px 0 4px'>" + esc(b.name) + " · " + esc(b.category) + " → " + esc(d.categoryStep[b.category]) + " · 剩余 " + b.remaining + esc(b.unit) + " · 效期 " + esc(b.expiryDate) + " " + pill(b.status) + "</div>" +
        "<h3>领用去向</h3><table><thead><tr><th>时间</th><th>切片</th><th>步骤</th><th>数量</th><th>用途</th><th>领用人</th></tr></thead><tbody>" + rows + "</tbody></table>" +
        "<h3>受影响切片</h3>" + affected + flagPart;
    }

    function viewHolds(d) {
      var active = d.holds.filter(function (h) { return h.status === "停交付中"; });
      var done = d.holds.filter(function (h) { return h.status !== "停交付中"; });
      var activeHtml = active.map(function (h) {
        var b = batchByNo(d, h.batchNo);
        var sl = sliceInfo(d, h.sliceId);
        var reviews = h.reviews.map(function (r) {
          return '<div class="meta">· ' + fmtTime(r.at) + " " + esc(r.reviewer) + " 复核「" + esc(r.result) + "」" + (r.note ? "：" + esc(r.note) : "") + "</div>";
        }).join("");
        return '<div class="card held"><b>' + esc(h.sliceId) + "</b> " + pill("停交付中") +
          '<div class="meta">样本：' + esc(sl ? sl.project : "未在册") + " · 异常批次：" + esc(h.batchNo) + (b ? "（" + esc(b.name) + "）" : "") + "</div>" +
          '<div class="meta">原因：' + esc(h.reason) + " · 标记人：" + esc(h.heldBy) + " · " + fmtTime(h.heldAt) + "</div>" + reviews +
          '<form class="reviewForm" data-hold="' + esc(h.id) + '"><div class="row" style="margin-top:8px">' +
          "<span><label>复核人（须换人）</label><input name='reviewer' required></span>" +
          "<span><label>复核结果</label><select name='result'><option>通过</option><option>未通过</option></select></span>" +
          "<span><label>备注</label><input name='note' placeholder='复核说明'></span></div>" +
          '<button style="margin-top:8px">提交复核</button>' +
          '<div class="hint">复核通过即恢复交付；复核人不能是标记人或该批次领用人，复核记录全部保留。</div></form></div>';
      }).join("") || '<div class="empty">当前没有停交付的切片</div>';
      var doneRows = done.map(function (h) {
        return "<tr><td><b>" + esc(h.sliceId) + "</b></td><td>" + esc(h.batchNo) + "</td><td>" + esc(h.reason) + "</td><td>" + pill(h.status) + "</td>" +
          "<td>" + esc(h.releasedBy || "-") + " " + fmtTime(h.releasedAt) + "</td>" +
          "<td>" + h.reviews.map(function (r) { return esc(r.reviewer) + "「" + esc(r.result) + "」"; }).join("；") + "</td></tr>";
      }).join("");
      return "<h2>停交付清单</h2><div class='meta' style='margin-bottom:10px'>异常批次波及的切片先停交付，换人复核无问题后才恢复。</div>" + activeHtml +
        (done.length ? "<h3>复核历史</h3><table><thead><tr><th>切片</th><th>批次</th><th>原因</th><th>状态</th><th>恢复</th><th>复核记录</th></tr></thead><tbody>" + doneRows + "</tbody></table>" : "");
    }

    function viewRecords(d) {
      var ckRows = d.checkouts.map(function (c) {
        var b = batchByNo(d, c.batchNo);
        return "<tr><td>" + fmtTime(c.at) + "</td><td><b>" + esc(c.batchNo) + "</b></td><td>" + esc(b ? b.name : "-") + "</td><td>" + esc(c.sliceId) + "</td>" +
          "<td>" + esc(c.step) + "</td><td>" + c.quantity + esc(b ? b.unit : "") + "</td><td>" + esc(c.purpose) + "</td><td>" + esc(c.operator) + "</td></tr>";
      }).join("") || '<tr><td colspan="8" class="empty">暂无领用记录</td></tr>';
      var rjRows = d.rejected.map(function (r) {
        return "<tr><td>" + fmtTime(r.at) + "</td><td>" + esc(r.batchNo) + "</td><td>" + esc(r.sliceId) + "</td><td>" + esc(r.step) + "</td>" +
          "<td>" + esc(r.quantity) + "</td><td>" + esc(r.operator) + "</td><td>" + esc(r.reason) + "</td></tr>";
      }).join("") || '<tr><td colspan="7" class="empty">暂无拒收记录</td></tr>';
      return "<h2>领用记录</h2><table><thead><tr><th>时间</th><th>批号</th><th>耗材</th><th>切片</th><th>步骤</th><th>数量</th><th>用途</th><th>领用人</th></tr></thead><tbody>" + ckRows + "</tbody></table>" +
        "<h2 style='margin-top:18px'>拒收记录（未进领用台账，仅留原因）</h2>" +
        "<table><thead><tr><th>时间</th><th>批号</th><th>切片</th><th>步骤</th><th>申请数量</th><th>领用人</th><th>拒收原因</th></tr></thead><tbody>" + rjRows + "</tbody></table>";
    }

    function fillSelects() {
      var d = state.data;
      var keep = state.keepCheckout || {};
      var form = document.querySelector("#checkoutForm");
      var sliceSel = form.querySelector("[name=sliceId]");
      var stepSel = form.querySelector("[name=step]");
      var curSlice = keep.sliceId || sliceSel.value;
      sliceSel.innerHTML = d.slices.map(function (s) {
        return '<option value="' + esc(s.sliceId) + '">' + esc(s.sliceId + "（" + s.project + "）") + "</option>";
      }).join("");
      if (curSlice) sliceSel.value = curSlice;
      var catSel = document.querySelector("#batchForm [name=category]");
      var curCat = catSel.value;
      catSel.innerHTML = Object.keys(d.categoryStep).map(function (c) {
        return '<option value="' + esc(c) + '">' + esc(c + " → " + d.categoryStep[c]) + "</option>";
      }).join("");
      if (curCat) catSel.value = curCat;
      var steps = [];
      Object.keys(d.categoryStep).forEach(function (c) { if (steps.indexOf(d.categoryStep[c]) < 0) steps.push(d.categoryStep[c]); });
      var curStep = keep.step || stepSel.value;
      stepSel.innerHTML = steps.map(function (s) { return '<option value="' + esc(s) + '">' + esc(s) + "</option>"; }).join("");
      if (curStep) stepSel.value = curStep;
      fillBatchOptions();
      if (keep.batchNo) form.querySelector("[name=batchNo]").value = keep.batchNo;
      if (keep.quantity) form.querySelector("[name=quantity]").value = keep.quantity;
      if (keep.purpose) form.querySelector("[name=purpose]").value = keep.purpose;
      if (keep.operator) form.querySelector("[name=operator]").value = keep.operator;
      state.keepCheckout = null;
      renderSliceLogs();
    }

    function fillBatchOptions() {
      var d = state.data;
      var form = document.querySelector("#checkoutForm");
      var step = form.querySelector("[name=step]").value;
      var sel = form.querySelector("[name=batchNo]");
      var list = d.batches.filter(function (b) { return d.categoryStep[b.category] === step; });
      sel.innerHTML = list.map(function (b) {
        var disabled = b.status === "已过期" || b.status === "已用完" || b.status === "异常批次";
        var tag = disabled ? "（" + b.status + "，不可领）" : (b.status === "库存不足" ? "（库存不足）" : "");
        return '<option value="' + esc(b.batchNo) + '"' + (disabled ? " disabled" : "") + ">" + esc(b.batchNo + " · " + b.name + " · 余" + b.remaining + b.unit + " · 效期" + b.expiryDate + tag) + "</option>";
      }).join("") || '<option value="">该步骤暂无批次</option>';
    }

    function renderSliceLogs() {
      var d = state.data;
      var sel = document.querySelector("#checkoutForm [name=sliceId]");
      var sl = sliceInfo(d, sel.value);
      var box = document.querySelector("#sliceLogs");
      if (!sl) { box.innerHTML = ""; return; }
      var logs = (sl.logs || []).map(function (l) { return esc(l.step) + "·" + esc(l.note); }).join(" / ");
      box.innerHTML = '<div class="meta">步骤记录（保留）：' + (logs || "暂无") + "</div>";
    }

    document.querySelector("#tabs").addEventListener("click", function (e) {
      var btn = e.target.closest("button[data-tab]");
      if (btn) { state.tab = btn.dataset.tab; render(); }
    });
    document.querySelector("#panel").addEventListener("change", function (e) {
      if (e.target.id === "traceBatch") { state.traceBatch = e.target.value; render(); }
    });
    document.querySelector("#checkoutForm [name=step]").addEventListener("change", fillBatchOptions);
    document.querySelector("#checkoutForm [name=sliceId]").addEventListener("change", renderSliceLogs);
    document.querySelector("#reload").addEventListener("click", load);

    document.addEventListener("submit", async function (e) {
      var f = e.target;
      var known = f.id === "batchForm" || f.id === "checkoutForm" || f.id === "flagForm" || f.classList.contains("reviewForm");
      if (!known) return;
      e.preventDefault();
      try {
        if (f.id === "batchForm") {
          await api("/api/consumables/batches", { method: "POST", body: JSON.stringify(Object.fromEntries(new FormData(f).entries())) });
          f.reset();
        } else if (f.id === "checkoutForm") {
          var input = Object.fromEntries(new FormData(f).entries());
          try {
            await api("/api/consumables/checkouts", { method: "POST", body: JSON.stringify(input) });
            f.reset();
          } catch (err) {
            state.keepCheckout = input;
            alert("领用未登记：" + err.message);
          }
        } else if (f.id === "flagForm") {
          var flag = Object.fromEntries(new FormData(f).entries());
          if (!confirm("确认将批次 " + flag.batchNo + " 标记为异常？受影响切片将立即停交付。")) return;
          await api("/api/consumables/abnormal", { method: "POST", body: JSON.stringify(flag) });
        } else {
          var review = Object.fromEntries(new FormData(f).entries());
          review.holdId = f.dataset.hold;
          await api("/api/consumables/reviews", { method: "POST", body: JSON.stringify(review) });
        }
        await load();
      } catch (err) { alert(err.message); }
    });

    load();
  </script>
</body>
</html>`;
