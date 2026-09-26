// 页面：台账与样本一屏展示。库存、批次去向、停交付清单同步刷新，步骤记录保留在切片卡片中。
import { statuses, taskSteps } from "./rules.js";

export const page = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>岩芯样本切片实验室</title>
  <style>
    :root { --bg:#f1f3ef; --panel:#fff; --ink:#242822; --muted:#687062; --line:#d7ddd1; --accent:#526f43; --bad:#a03d3d; }
    * { box-sizing:border-box; } body { margin:0; background:var(--bg); color:var(--ink); font-family:Arial,"PingFang SC",sans-serif; }
    header { padding:22px 28px; background:#fff; border-bottom:1px solid var(--line); display:flex; justify-content:space-between; align-items:center; gap:16px; }
    h1 { margin:0; font-size:26px; } main { display:grid; grid-template-columns:390px 1fr; gap:22px; padding:22px 28px; align-items:start; }
    form,.panel,.card,.stat { background:#fff; border:1px solid var(--line); border-radius:8px; padding:16px; } h2 { margin:0 0 12px; font-size:18px; }
    form { margin-bottom:14px; } .panel { margin-bottom:14px; }
    label { display:block; margin:10px 0 5px; color:var(--muted); font-size:13px; } input,select,textarea { width:100%; border:1px solid var(--line); border-radius:6px; padding:9px; font:inherit; background:#fff; } textarea { min-height:68px; }
    input[readonly] { background:#f4f6f1; color:var(--muted); }
    button { border:0; border-radius:6px; background:var(--accent); color:#fff; padding:10px 13px; font-weight:700; cursor:pointer; }
    button.ghost { background:#fff; color:var(--accent); border:1px solid var(--accent); padding:6px 10px; }
    button.warn { background:var(--bad); }
    button[disabled] { background:#b9bdb4; cursor:not-allowed; }
    .stats { display:grid; grid-template-columns:repeat(6,1fr); gap:10px; margin-bottom:14px; } .stat strong { display:block; font-size:24px; }
    .grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(310px,1fr)); gap:12px; } .card { display:grid; gap:8px; }
    .meta { color:var(--muted); font-size:13px; } .pill { display:inline-block; border:1px solid var(--line); border-radius:999px; padding:3px 8px; font-size:12px; }
    .pill.bad { border-color:#e5c1c1; background:#fbeaea; color:var(--bad); }
    .slice { border-top:1px solid var(--line); padding-top:10px; }
    table { width:100%; border-collapse:collapse; font-size:13px; } th,td { text-align:left; padding:7px 8px; border-bottom:1px solid var(--line); vertical-align:top; }
    th { color:var(--muted); font-weight:600; white-space:nowrap; }
    .msg { display:none; padding:10px 14px; border-radius:6px; margin-bottom:14px; font-size:14px; }
    .msg.err { display:block; background:#fbeaea; color:var(--bad); border:1px solid #e5c1c1; }
    .msg.ok { display:block; background:#eaf4e5; color:#3c5a2e; border:1px solid #c4dcb4; }
    .hold { border:1px solid #e5c1c1; background:#fff7f7; border-radius:8px; padding:12px; margin-bottom:10px; display:grid; gap:6px; }
    .hold.done { border-color:var(--line); background:#fff; }
    .row { display:flex; gap:8px; } .row > * { flex:1; }
    .where { border-top:1px solid var(--line); padding:8px 0; } .where:first-child { border-top:0; }
    .where ul { margin:6px 0 0; padding-left:18px; } .where li { font-size:13px; color:var(--muted); margin:2px 0; }
    @media (max-width:950px){ header{display:block;padding:18px 16px;} main{grid-template-columns:1fr;padding:16px;} .stats{grid-template-columns:1fr 1fr;} }
  </style>
</head>
<body>
  <header><div><h1>岩芯样本切片实验室</h1><div class="meta">样本、切片任务、制片步骤、耗材批次台账与交付</div></div><button id="reload">刷新</button></header>
  <main>
    <div class="side">
      <div id="msg" class="msg"></div>
      <form id="sample-form">
        <h2>创建岩芯样本</h2>
        <label>项目</label><input name="project" required>
        <label>钻孔编号</label><input name="borehole" required>
        <label>岩芯箱号</label><input name="coreBox" required>
        <label>取样深度</label><input name="depth" required>
        <label>负责人</label><input name="owner" required>
        <label>初始切片编号</label><input name="sliceId" required>
        <label>染色方法</label><input name="method" required>
        <button>保存样本</button>
      </form>
      <form id="intake-form">
        <h2>耗材批次入库</h2>
        <label>批号</label><input name="batchNo" required>
        <label>耗材名称</label><input name="name" required>
        <label>对应切片步骤</label><select id="intake-step" name="step"></select>
        <label>用途</label><input name="purpose" required>
        <div class="row"><div><label>数量</label><input name="quantity" type="number" min="0.01" step="0.01" required></div><div><label>单位</label><input name="unit" placeholder="ml / 片 / 瓶"></div></div>
        <label>有效期</label><input name="expiry" type="date" required>
        <button>保存批次</button>
      </form>
      <form id="usage-form">
        <h2>耗材领用登记</h2>
        <label>批号</label><select id="u-batch" name="batchNo" required></select>
        <label>样本</label><select id="u-sample" name="sampleId" required></select>
        <label>切片</label><select id="u-slice" name="sliceId" required></select>
        <label>对应切片步骤</label><input id="u-step" readonly placeholder="由批号自动对应">
        <label>用途</label><input name="purpose" required>
        <label>数量</label><input name="quantity" type="number" min="0.01" step="0.01" required>
        <label>有效期</label><input id="u-expiry" name="expiry" type="date" required>
        <label>领用人</label><input name="operator" required>
        <button>登记领用</button>
      </form>
      <form id="flag-form">
        <h2>异常批次登记</h2>
        <label>批号</label><select id="f-batch" name="batchNo" required></select>
        <label>异常原因</label><input name="reason" required>
        <label>登记人</label><input name="operator" required>
        <button class="warn">判定异常并停交付</button>
      </form>
    </div>
    <section>
      <div class="stats" id="stats"></div>
      <div class="panel"><h2>耗材库存</h2><div id="inventory"></div></div>
      <div class="panel"><h2>批次去向</h2><div id="whereabouts"></div></div>
      <div class="panel"><h2>停交付清单</h2><div id="holds"></div></div>
      <div class="panel"><h2>样本与切片</h2><div class="grid" id="samples"></div></div>
    </section>
  </main>
  <script>
    const statuses = ${JSON.stringify(statuses)};
    const steps = ${JSON.stringify(taskSteps)};
    let state = { samples: [], batches: [], usages: [], holds: [] };
    const $ = sel => document.querySelector(sel);
    async function api(path, options) {
      const res = await fetch(path, options && options.body ? { ...options, headers: { "Content-Type": "application/json" } } : options);
      const data = await res.json();
      if (!res.ok) throw new Error(data.reason || data.error || "请求失败");
      return data;
    }
    function esc(s) { return String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }
    function showMsg(text, ok) { const el = $("#msg"); el.textContent = text; el.className = "msg " + (ok ? "ok" : "err"); }
    async function run(fn) { try { await fn(); } catch (error) { showMsg(error.message, false); } }
    function batchState(b) {
      const today = new Date().toISOString().slice(0, 10);
      if (b.status === "异常") return "异常";
      if (b.expiry < today) return "已过期";
      return "正常";
    }
    function renderStats() {
      const holds = state.samples.filter(s => s.delivery === "停交付").length;
      const abnormal = state.batches.filter(b => b.status === "异常").length;
      const cells = statuses.map(s => [s, state.samples.filter(item => item.status === s).length]);
      cells.push(["停交付", holds], ["异常批次", abnormal]);
      $("#stats").innerHTML = cells.map(c => '<div class="stat"><span>' + c[0] + '</span><strong>' + c[1] + '</strong></div>').join("");
    }
    function renderInventory() {
      $("#inventory").innerHTML = '<table><thead><tr><th>批号</th><th>耗材</th><th>对应步骤</th><th>剩余/总量</th><th>有效期</th><th>状态</th><th></th></tr></thead><tbody>'
        + state.batches.map(b => {
          const st = batchState(b);
          return '<tr><td>' + esc(b.batchNo) + '</td><td>' + esc(b.name) + '</td><td>' + esc(b.step) + '</td><td>' + b.remaining + ' / ' + b.total + esc(b.unit) + '</td><td>' + esc(b.expiry) + '</td><td><span class="pill' + (st === "正常" ? "" : " bad") + '">' + st + '</span></td><td>'
            + (b.status === "异常" ? "" : '<button class="ghost" data-flag="' + esc(b.batchNo) + '">标记异常</button>') + '</td></tr>';
        }).join("") + '</tbody></table>';
    }
    function renderWhereabouts() {
      const html = state.batches.map(b => {
        const list = state.usages.filter(u => u.batchNo === b.batchNo);
        if (!list.length) return "";
        return '<div class="where"><b>' + esc(b.batchNo) + '</b> <span class="meta">' + esc(b.name) + ' · 对应步骤 ' + esc(b.step) + '</span><ul>'
          + list.map(u => '<li>' + esc(u.sampleId) + ' / ' + esc(u.sliceId) + ' · ' + esc(u.step) + ' · ' + u.quantity + esc(b.unit) + ' · ' + esc(u.operator) + ' · ' + esc((u.at || "").slice(0, 10)) + '</li>').join("") + '</ul></div>';
      }).join("");
      $("#whereabouts").innerHTML = html || '<div class="meta">暂无领用记录</div>';
    }
    function renderHolds() {
      $("#holds").innerHTML = state.holds.length ? state.holds.map(h => {
        const open = h.status === "停交付";
        return '<div class="hold' + (open ? "" : " done") + '"><div><b>' + esc(h.batchNo) + '</b> <span class="pill' + (open ? " bad" : "") + '">' + esc(h.status) + '</span></div>'
          + '<div class="meta">原因：' + esc(h.reason) + ' · 登记人：' + esc(h.operator) + ' · ' + esc((h.at || "").slice(0, 10)) + '</div>'
          + '<div class="meta">受影响切片：' + (h.affected.length ? h.affected.map(a => esc(a.sampleId) + ' / ' + esc(a.sliceId)).join('；') : '该批号暂无领用记录') + '</div>'
          + (h.review ? '<div class="meta">最近复核：' + esc(h.review.result) + ' · ' + esc(h.review.reviewer) + (h.review.note ? ' · ' + esc(h.review.note) : '') + '</div>' : '')
          + (open ? '<div class="row"><input data-reviewer="' + esc(h.id) + '" placeholder="复核人（须换人）"><input data-revnote="' + esc(h.id) + '" placeholder="复核说明"><button data-pass="' + esc(h.id) + '">复核通过</button><button class="warn" data-fail="' + esc(h.id) + '">复核不通过</button></div>' : '')
          + '</div>';
      }).join("") : '<div class="meta">暂无停交付样本</div>';
    }
    function renderSamples() {
      $("#samples").innerHTML = state.samples.map(sample => '<article class="card"><h3>' + esc(sample.project) + '</h3><div><span class="pill">' + esc(sample.status) + '</span> <span class="pill' + (sample.delivery === "停交付" ? " bad" : "") + '">' + esc(sample.delivery) + '</span></div><div class="meta">' + esc(sample.borehole) + ' · ' + esc(sample.coreBox) + ' · ' + esc(sample.depth) + ' · ' + esc(sample.owner) + '</div><label>新增切片</label><input data-new-slice="' + esc(sample.id) + '" placeholder="切片编号"><input data-method="' + esc(sample.id) + '" placeholder="染色方法"><button data-add="' + esc(sample.id) + '">添加切片</button>'
        + sample.slices.map(slice => '<div class="slice"><b>' + esc(slice.id) + '</b><div class="meta">' + esc(slice.method) + ' · 当前步骤 ' + esc(slice.status) + '</div><select data-step="' + esc(sample.id) + '|' + esc(slice.id) + '">' + steps.map(step => '<option>' + step + '</option>').join("") + '</select><textarea data-note="' + esc(sample.id) + '|' + esc(slice.id) + '" placeholder="步骤备注或观察结果"></textarea><button data-log="' + esc(sample.id) + '|' + esc(slice.id) + '">记录步骤</button><div class="meta">' + slice.logs.map(log => esc(log.step) + '：' + esc(log.note)).join(' / ') + '</div></div>').join("")
        + (sample.delivery === "停交付" ? '<button disabled>停交付中，待复核</button>' : '<button data-deliver="' + esc(sample.id) + '">标记交付</button>')
        + '</article>').join("");
      document.querySelectorAll("[data-step]").forEach(sel => {
        const [sampleId, sliceId] = sel.dataset.step.split("|");
        const slice = state.samples.find(s => s.id === sampleId).slices.find(s => s.id === sliceId);
        sel.value = slice.status;
      });
    }
    function setOptions(sel, html) { const v = sel.value; sel.innerHTML = html; if (v) sel.value = v; }
    function fillFormSelects() {
      setOptions($("#u-batch"), '<option value="">选择批号</option>' + state.batches.map(b => '<option value="' + esc(b.batchNo) + '">' + esc(b.batchNo) + '｜' + esc(b.name) + '｜剩 ' + b.remaining + esc(b.unit) + '｜效期 ' + esc(b.expiry) + '</option>').join(""));
      setOptions($("#f-batch"), '<option value="">选择批号</option>' + state.batches.filter(b => b.status !== "异常").map(b => '<option value="' + esc(b.batchNo) + '">' + esc(b.batchNo) + '｜' + esc(b.name) + '</option>').join(""));
      setOptions($("#u-sample"), '<option value="">选择样本</option>' + state.samples.map(s => '<option value="' + esc(s.id) + '">' + esc(s.id) + '｜' + esc(s.project) + '</option>').join(""));
      fillSlices();
      syncUsageBatch();
    }
    function fillSlices() {
      const sample = state.samples.find(s => s.id === $("#u-sample").value);
      setOptions($("#u-slice"), '<option value="">选择切片</option>' + (sample ? sample.slices.map(s => '<option value="' + esc(s.id) + '">' + esc(s.id) + '（' + esc(s.status) + '）</option>').join("") : ""));
    }
    function syncUsageBatch() {
      const batch = state.batches.find(b => b.batchNo === $("#u-batch").value);
      $("#u-step").value = batch ? batch.step : "";
      if (batch && !$("#u-expiry").value) $("#u-expiry").value = batch.expiry;
    }
    function bind() {
      document.querySelectorAll("[data-add]").forEach(btn => btn.onclick = () => run(async () => {
        const id = btn.dataset.add;
        await api('/api/samples/' + id + '/slices', { method: 'POST', body: JSON.stringify({ id: document.querySelector('[data-new-slice="' + id + '"]').value, method: document.querySelector('[data-method="' + id + '"]').value || "未指定" }) });
        showMsg("切片已添加", true); await load();
      }));
      document.querySelectorAll("[data-log]").forEach(btn => btn.onclick = () => run(async () => {
        const [sampleId, sliceId] = btn.dataset.log.split("|");
        await api('/api/samples/' + sampleId + '/slices/' + sliceId + '/logs', { method: 'POST', body: JSON.stringify({ step: document.querySelector('[data-step="' + sampleId + '|' + sliceId + '"]').value, note: document.querySelector('[data-note="' + sampleId + '|' + sliceId + '"]').value || "步骤完成" }) });
        showMsg("步骤已记录", true); await load();
      }));
      document.querySelectorAll("[data-deliver]").forEach(btn => btn.onclick = () => run(async () => {
        await api('/api/samples/' + btn.dataset.deliver + '/deliver', { method: 'POST', body: JSON.stringify({}) });
        showMsg("样本已交付", true); await load();
      }));
      document.querySelectorAll("[data-flag]").forEach(btn => btn.onclick = () => {
        $("#f-batch").value = btn.dataset.flag;
        $("#flag-form").scrollIntoView({ behavior: "smooth" });
        document.querySelector('#flag-form [name="reason"]').focus();
      });
      document.querySelectorAll("[data-pass],[data-fail]").forEach(btn => btn.onclick = () => run(async () => {
        const id = btn.dataset.pass || btn.dataset.fail;
        const reviewer = document.querySelector('[data-reviewer="' + id + '"]').value;
        const note = document.querySelector('[data-revnote="' + id + '"]').value;
        const result = btn.dataset.pass ? "通过" : "不通过";
        await api('/api/holds/' + id + '/review', { method: 'POST', body: JSON.stringify({ reviewer, result, note }) });
        showMsg(result === "通过" ? "复核通过，样本恢复交付" : "复核不通过，样本继续停交付", true);
        await load();
      }));
    }
    function render() { renderStats(); renderInventory(); renderWhereabouts(); renderHolds(); renderSamples(); fillFormSelects(); bind(); }
    async function load() { state = await api("/api/state"); render(); }
    $("#intake-step").innerHTML = steps.map(s => '<option>' + s + '</option>').join("");
    $("#u-batch").onchange = syncUsageBatch;
    $("#u-sample").onchange = fillSlices;
    $("#reload").onclick = load;
    $("#sample-form").onsubmit = event => { event.preventDefault(); run(async () => {
      await api("/api/samples", { method: "POST", body: JSON.stringify(Object.fromEntries(new FormData(event.target).entries())) });
      event.target.reset(); showMsg("样本已保存", true); await load();
    }); };
    $("#intake-form").onsubmit = event => { event.preventDefault(); run(async () => {
      const batch = await api("/api/batches", { method: "POST", body: JSON.stringify(Object.fromEntries(new FormData(event.target).entries())) });
      event.target.reset(); showMsg("批次 " + batch.batchNo + " 已入库", true); await load();
    }); };
    $("#usage-form").onsubmit = event => { event.preventDefault(); run(async () => {
      const data = await api("/api/usages", { method: "POST", body: JSON.stringify(Object.fromEntries(new FormData(event.target).entries())) });
      event.target.reset(); showMsg("领用已记录，批号 " + data.batch.batchNo + " 剩余 " + data.batch.remaining + data.batch.unit, true); await load();
    }); };
    $("#flag-form").onsubmit = event => { event.preventDefault(); run(async () => {
      const input = Object.fromEntries(new FormData(event.target).entries());
      const hold = await api('/api/batches/' + encodeURIComponent(input.batchNo) + '/flag', { method: "POST", body: JSON.stringify(input) });
      event.target.reset(); showMsg("批次 " + hold.batchNo + " 已判定异常，" + hold.affected.length + " 个切片受影响，相关样本已停交付", true); await load();
    }); };
    load();
  </script>
</body>
</html>`;
