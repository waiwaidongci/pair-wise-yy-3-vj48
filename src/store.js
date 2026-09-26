// 保存：台账数据加载/落库与全部写操作。所有写操作先由 rules.js 判定通过后才进入这里。
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { collectAffected, updateSampleStatus } from "./rules.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = join(__dirname, "..", "data", "core-slices.json");

function seedBatches() {
  return [
    { batchNo: "DYE-2026-031", name: "茜素红染液", step: "染色", purpose: "碳酸盐矿物染色", unit: "ml", total: 500, remaining: 500, expiry: "2027-03-01", status: "正常", createdAt: "2026-06-01T09:00:00.000Z" },
    { batchNo: "GRD-2026-112", name: "金刚石研磨盘", step: "研磨", purpose: "薄片粗磨", unit: "片", total: 40, remaining: 39, expiry: "2026-12-31", status: "正常", createdAt: "2026-06-01T09:00:00.000Z" },
    { batchNo: "GLU-2025-088", name: "冷镶嵌树脂", step: "切割", purpose: "镶样固定", unit: "ml", total: 1000, remaining: 260, expiry: "2026-06-30", status: "正常", createdAt: "2025-11-20T09:00:00.000Z" },
    { batchNo: "OIL-2026-210", name: "镜检浸油", step: "观察", purpose: "油浸镜下观察", unit: "ml", total: 250, remaining: 4, expiry: "2027-01-15", status: "正常", createdAt: "2026-05-10T09:00:00.000Z" }
  ];
}

const seed = {
  samples: [
    {
      id: "CORE-001",
      project: "东岭铜矿薄片",
      borehole: "ZK-17",
      coreBox: "BX-09",
      depth: "128.4-128.8m",
      owner: "陆川",
      status: "制片中",
      delivery: "未交付",
      slices: [
        { id: "SL-001-A", method: "茜素红染色", observation: "", status: "研磨", logs: [{ at: "2026-06-12T10:00:00.000Z", step: "取样", note: "截取含矿化条带位置" }, { at: "2026-06-13T11:20:00.000Z", step: "切割", note: "完成粗切" }] }
      ]
    }
  ],
  batches: seedBatches(),
  usages: [
    { id: "USG-SEED-1", batchNo: "GRD-2026-112", sampleId: "CORE-001", sliceId: "SL-001-A", step: "研磨", purpose: "薄片粗磨", quantity: 1, expiry: "2026-12-31", operator: "陆川", at: "2026-06-13T11:25:00.000Z" }
  ],
  holds: []
};

// 旧数据文件兼容：缺少的台账字段按种子补齐
function normalize(db) {
  if (!Array.isArray(db.samples)) db.samples = [];
  if (!Array.isArray(db.batches)) db.batches = seedBatches();
  if (!Array.isArray(db.usages)) db.usages = seed.usages.map(usage => ({ ...usage }));
  if (!Array.isArray(db.holds)) db.holds = [];
  return db;
}

export async function loadDb() {
  if (!existsSync(dbPath)) {
    await mkdir(dirname(dbPath), { recursive: true });
    await writeFile(dbPath, JSON.stringify(seed, null, 2));
  }
  return normalize(JSON.parse(await readFile(dbPath, "utf8")));
}

export async function saveDb(db) {
  await writeFile(dbPath, JSON.stringify(db, null, 2));
}

export async function addSample(db, input) {
  const sample = { id: `CORE-${Date.now()}`, project: input.project, borehole: input.borehole, coreBox: input.coreBox, depth: input.depth, owner: input.owner, status: "待切割", delivery: "未交付", slices: [{ id: input.sliceId, method: input.method, observation: "", status: "取样", logs: [{ at: new Date().toISOString(), step: "取样", note: "创建初始切片任务" }] }] };
  updateSampleStatus(sample);
  db.samples.unshift(sample);
  await saveDb(db);
  return sample;
}

export async function addSlice(db, sampleId, input) {
  const sample = db.samples.find(item => item.id === sampleId);
  if (!sample) return null;
  sample.slices.push({ id: input.id, method: input.method || "未指定", observation: "", status: "取样", logs: [{ at: new Date().toISOString(), step: "取样", note: "新增切片任务" }] });
  updateSampleStatus(sample);
  await saveDb(db);
  return sample;
}

export async function addLog(db, sampleId, sliceId, input) {
  const sample = db.samples.find(item => item.id === sampleId);
  if (!sample) return null;
  const slice = sample.slices.find(item => item.id === sliceId);
  if (!slice) return null;
  slice.status = input.step;
  if (input.step === "观察") slice.observation = input.note || slice.observation;
  slice.logs.push({ at: new Date().toISOString(), step: input.step, note: input.note || "" });
  updateSampleStatus(sample);
  await saveDb(db);
  return sample;
}

export async function deliverSample(db, sampleId) {
  const sample = db.samples.find(item => item.id === sampleId);
  if (!sample) return null;
  sample.delivery = "已交付";
  updateSampleStatus(sample);
  await saveDb(db);
  return sample;
}

export async function addBatch(db, value) {
  const batch = { ...value, status: "正常", createdAt: new Date().toISOString() };
  db.batches.push(batch);
  await saveDb(db);
  return batch;
}

// 领用进台账：扣减库存、写领用记录，并在切片步骤记录中留痕
export async function recordUsage(db, value) {
  const batch = db.batches.find(item => item.batchNo === value.batchNo);
  batch.remaining = Number((batch.remaining - value.quantity).toFixed(2));
  const usage = { id: `USG-${Date.now()}`, ...value, at: new Date().toISOString() };
  db.usages.push(usage);
  const sample = db.samples.find(item => item.id === value.sampleId);
  const slice = sample && sample.slices.find(item => item.id === value.sliceId);
  if (slice) {
    slice.logs.push({ at: usage.at, step: value.step, note: `耗材领用：${batch.name}（批号 ${value.batchNo}）${value.quantity}${batch.unit}，用途：${value.purpose}，领用人：${value.operator}` });
  }
  await saveDb(db);
  return { usage, batch };
}

// 判定异常：按批号列出受影响切片，相关样本停交付，步骤记录留痕
export async function flagBatch(db, batchNo, { reason, operator }) {
  const batch = db.batches.find(item => item.batchNo === batchNo);
  batch.status = "异常";
  const affected = collectAffected(db, batchNo);
  const at = new Date().toISOString();
  const hold = { id: `HOLD-${Date.now()}`, batchNo, reason, operator, at, affected, status: "停交付", review: null };
  db.holds.unshift(hold);
  for (const item of affected) {
    const sample = db.samples.find(s => s.id === item.sampleId);
    const slice = sample && sample.slices.find(s => s.id === item.sliceId);
    if (slice) slice.logs.push({ at, step: slice.status, note: `批次 ${batchNo} 判定异常：${reason}，样本停交付，待换人复核` });
    if (sample && sample.delivery !== "已交付") sample.delivery = "停交付";
  }
  await saveDb(db);
  return hold;
}

// 换人复核：通过则恢复交付，不通过则维持停交付；两种结果都留痕
export async function reviewHold(db, holdId, { reviewer, result, note }) {
  const hold = db.holds.find(item => item.id === holdId);
  const at = new Date().toISOString();
  hold.review = { reviewer, result, note, at };
  const batch = db.batches.find(item => item.batchNo === hold.batchNo);
  if (result === "通过") {
    hold.status = "已恢复";
    if (batch) batch.status = "正常";
    for (const item of hold.affected) {
      const sample = db.samples.find(s => s.id === item.sampleId);
      const slice = sample && sample.slices.find(s => s.id === item.sliceId);
      if (slice) slice.logs.push({ at, step: slice.status, note: `批次 ${hold.batchNo} 复核通过（${reviewer}）${note ? `：${note}` : ""}，恢复交付` });
      if (sample && sample.delivery === "停交付") {
        const stillHeld = db.holds.some(h => h.id !== hold.id && h.status === "停交付" && h.affected.some(a => a.sampleId === sample.id));
        if (!stillHeld) {
          sample.delivery = "未交付";
          updateSampleStatus(sample);
        }
      }
    }
  } else {
    for (const item of hold.affected) {
      const sample = db.samples.find(s => s.id === item.sampleId);
      const slice = sample && sample.slices.find(s => s.id === item.sliceId);
      if (slice) slice.logs.push({ at, step: slice.status, note: `批次 ${hold.batchNo} 复核不通过（${reviewer}）${note ? `：${note}` : ""}，继续停交付` });
    }
  }
  await saveDb(db);
  return hold;
}
