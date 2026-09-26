// 路由层：解析请求 → rules.js 判定 → store.js 保存 → 响应。业务规则与页面不放在这里。
import http from "node:http";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadDb, addSample, addSlice, addLog, deliverSample, addBatch, recordUsage, flagBatch, reviewHold } from "./src/store.js";
import { statuses, taskSteps, checkBatchIntake, checkUsage, checkDeliver, checkFlag, checkReview } from "./src/rules.js";
import { page } from "./src/page.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 3025);

async function body(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {};
}
function sendJson(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(data, null, 2));
}
// 判定不通过：领用/交付/复核不进记录，只回原因
function reject(res, check) {
  return sendJson(res, check.status || 400, { error: "rejected", reason: check.reason });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const db = await loadDb();

    if (req.method === "GET" && url.pathname === "/") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      return res.end(page);
    }
    // 库存、批次去向、停交付清单与样本一屏同步
    if (req.method === "GET" && url.pathname === "/api/state") {
      return sendJson(res, 200, { statuses, steps: taskSteps, samples: db.samples, batches: db.batches, usages: db.usages, holds: db.holds });
    }
    if (req.method === "GET" && url.pathname === "/api/samples") return sendJson(res, 200, db.samples);

    if (req.method === "POST" && url.pathname === "/api/samples") {
      return sendJson(res, 201, await addSample(db, await body(req)));
    }
    const addSliceMatch = url.pathname.match(/^\/api\/samples\/([^/]+)\/slices$/);
    if (addSliceMatch && req.method === "POST") {
      const sample = await addSlice(db, addSliceMatch[1], await body(req));
      if (!sample) return sendJson(res, 404, { error: "sample_not_found" });
      return sendJson(res, 201, sample);
    }
    const logMatch = url.pathname.match(/^\/api\/samples\/([^/]+)\/slices\/([^/]+)\/logs$/);
    if (logMatch && req.method === "POST") {
      const sample = await addLog(db, logMatch[1], logMatch[2], await body(req));
      if (!sample) return sendJson(res, 404, { error: "not_found" });
      return sendJson(res, 200, sample);
    }
    const deliverMatch = url.pathname.match(/^\/api\/samples\/([^/]+)\/deliver$/);
    if (deliverMatch && req.method === "POST") {
      const check = checkDeliver(db, deliverMatch[1]);
      if (!check.ok) return reject(res, check);
      return sendJson(res, 200, await deliverSample(db, deliverMatch[1]));
    }

    // 耗材批次入库：批号重复不进记录
    if (req.method === "POST" && url.pathname === "/api/batches") {
      const check = checkBatchIntake(db, await body(req));
      if (!check.ok) return reject(res, check);
      return sendJson(res, 201, await addBatch(db, check.value));
    }
    // 耗材领用登记：过期、剩量不足、批号重复不进记录
    if (req.method === "POST" && url.pathname === "/api/usages") {
      const check = checkUsage(db, await body(req));
      if (!check.ok) return reject(res, check);
      return sendJson(res, 201, await recordUsage(db, check.value));
    }
    // 异常批次判定：按批号列出受影响切片并停交付
    const flagMatch = url.pathname.match(/^\/api\/batches\/([^/]+)\/flag$/);
    if (flagMatch && req.method === "POST") {
      const check = checkFlag(db, decodeURIComponent(flagMatch[1]), await body(req));
      if (!check.ok) return reject(res, check);
      return sendJson(res, 200, await flagBatch(db, check.value.batch.batchNo, check.value));
    }
    // 换人复核：通过才恢复交付
    const reviewMatch = url.pathname.match(/^\/api\/holds\/([^/]+)\/review$/);
    if (reviewMatch && req.method === "POST") {
      const check = checkReview(db, reviewMatch[1], await body(req));
      if (!check.ok) return reject(res, check);
      return sendJson(res, 200, await reviewHold(db, reviewMatch[1], check.value));
    }

    sendJson(res, 404, { error: "not_found" });
  } catch (error) {
    sendJson(res, 500, { error: error.message });
  }
});

server.listen(port, () => console.log(`Core slice lab app listening on http://localhost:${port}`));
