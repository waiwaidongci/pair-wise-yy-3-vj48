// 判定：耗材入库、领用、交付、复核的校验规则，以及受影响切片推导。
// 所有 check* 函数只读数据、返回 { ok, reason?, value? }，不做任何写操作。

export const statuses = ["待切割", "制片中", "待观察", "已交付"];
export const taskSteps = ["取样", "切割", "研磨", "染色", "观察"];

export function today() {
  return new Date().toISOString().slice(0, 10);
}

export function updateSampleStatus(sample) {
  const sliceStatuses = sample.slices.map(slice => slice.status);
  if (sliceStatuses.length && sliceStatuses.every(step => step === "观察")) sample.status = "待观察";
  if (sample.delivery === "已交付") sample.status = "已交付";
  else if (sliceStatuses.some(step => ["取样", "切割", "研磨", "染色"].includes(step))) sample.status = "制片中";
  else sample.status = "待切割";
}

// 耗材批次入库判定：批号重复直接拒收
export function checkBatchIntake(db, input) {
  const batchNo = String(input.batchNo || "").trim();
  if (!batchNo) return { ok: false, reason: "批号不能为空" };
  if (!String(input.name || "").trim()) return { ok: false, reason: "耗材名称不能为空" };
  if (!taskSteps.includes(input.step)) return { ok: false, reason: `对应切片步骤必须是：${taskSteps.join("、")}` };
  const quantity = Number(input.quantity);
  if (!Number.isFinite(quantity) || quantity <= 0) return { ok: false, reason: "入库数量必须大于 0" };
  if (!input.expiry) return { ok: false, reason: "有效期不能为空" };
  if (db.batches.some(batch => batch.batchNo === batchNo)) {
    return { ok: false, reason: `批号 ${batchNo} 已在台账中，判定为批号重复，本次入库未记录` };
  }
  return {
    ok: true,
    value: {
      batchNo,
      name: String(input.name).trim(),
      step: input.step,
      purpose: String(input.purpose || "").trim(),
      unit: String(input.unit || "").trim() || "份",
      total: quantity,
      remaining: quantity,
      expiry: input.expiry
    }
  };
}

// 耗材领用判定：过期、剩量不足、批号重复（同一切片重复登记同一批号）时不进记录。
// 耗材对应到切片步骤：领用步骤由批号台账中的对应步骤决定，不允许手工改。
export function checkUsage(db, input) {
  const batchNo = String(input.batchNo || "").trim();
  const batch = db.batches.find(item => item.batchNo === batchNo);
  if (!batch) return { ok: false, reason: `批号 ${batchNo || "（空）"} 未入库，领用未记录` };
  const sample = db.samples.find(item => item.id === input.sampleId);
  if (!sample) return { ok: false, reason: `样本 ${input.sampleId || "（空）"} 不存在，领用未记录` };
  const slice = sample.slices.find(item => item.id === input.sliceId);
  if (!slice) return { ok: false, reason: `切片 ${input.sliceId || "（空）"} 不存在，领用未记录` };
  const quantity = Number(input.quantity);
  if (!Number.isFinite(quantity) || quantity <= 0) return { ok: false, reason: "领用数量必须大于 0，领用未记录" };
  const expiry = input.expiry || batch.expiry;
  if (expiry < today()) {
    return { ok: false, reason: `批号 ${batchNo} 有效期 ${expiry} 已过期，领用未记录` };
  }
  if (batch.status === "异常") {
    return { ok: false, reason: `批号 ${batchNo} 为异常批次，换人复核通过前禁止领用` };
  }
  if (quantity > batch.remaining) {
    return { ok: false, reason: `批号 ${batchNo} 剩余 ${batch.remaining}${batch.unit}，不足 ${quantity}${batch.unit}，领用未记录` };
  }
  if (db.usages.some(usage => usage.batchNo === batchNo && usage.sampleId === sample.id && usage.sliceId === slice.id)) {
    return { ok: false, reason: `批号 ${batchNo} 在切片 ${slice.id} 上已有领用记录，判定为批号重复，领用未记录` };
  }
  return {
    ok: true,
    value: {
      batchNo,
      sampleId: sample.id,
      sliceId: slice.id,
      step: batch.step,
      purpose: String(input.purpose || "").trim() || batch.purpose || batch.name,
      quantity,
      expiry,
      operator: String(input.operator || "").trim() || "未登记"
    }
  };
}

// 交付判定：停交付清单中的样本必须等复核通过
export function checkDeliver(db, sampleId) {
  const sample = db.samples.find(item => item.id === sampleId);
  if (!sample) return { ok: false, status: 404, reason: "样本不存在" };
  if (sample.delivery === "停交付") {
    const hold = db.holds.find(item => item.status === "停交付" && item.affected.some(a => a.sampleId === sampleId));
    return { ok: false, reason: `样本 ${sampleId} 因批次 ${hold ? hold.batchNo : "未知"} 异常处于停交付，复核通过前不能交付` };
  }
  return { ok: true, value: sample };
}

// 异常登记判定
export function checkFlag(db, batchNo, input) {
  const batch = db.batches.find(item => item.batchNo === batchNo);
  if (!batch) return { ok: false, status: 404, reason: `批号 ${batchNo} 不存在` };
  if (batch.status === "异常") return { ok: false, reason: `批号 ${batchNo} 已处于异常状态，请勿重复登记` };
  if (!String(input.reason || "").trim()) return { ok: false, reason: "异常原因不能为空" };
  if (!String(input.operator || "").trim()) return { ok: false, reason: "登记人不能为空" };
  return { ok: true, value: { batch, reason: String(input.reason).trim(), operator: String(input.operator).trim() } };
}

// 复核判定：必须换人（复核人 ≠ 异常登记人）
export function checkReview(db, holdId, input) {
  const hold = db.holds.find(item => item.id === holdId);
  if (!hold) return { ok: false, status: 404, reason: "停交付记录不存在" };
  if (hold.status !== "停交付") return { ok: false, reason: `批次 ${hold.batchNo} 已复核恢复，请勿重复复核` };
  const reviewer = String(input.reviewer || "").trim();
  if (!reviewer) return { ok: false, reason: "复核人不能为空" };
  if (reviewer === hold.operator) return { ok: false, reason: `复核人与登记人同为 ${reviewer}，须换人复核` };
  if (!["通过", "不通过"].includes(input.result)) return { ok: false, reason: "复核结果必须是 通过 或 不通过" };
  return { ok: true, value: { hold, reviewer, result: input.result, note: String(input.note || "").trim() } };
}

// 按批号列出受影响切片（来自领用记录，去重）
export function collectAffected(db, batchNo) {
  const seen = new Set();
  const affected = [];
  for (const usage of db.usages.filter(item => item.batchNo === batchNo)) {
    const key = `${usage.sampleId}|${usage.sliceId}`;
    if (!seen.has(key)) {
      seen.add(key);
      affected.push({ sampleId: usage.sampleId, sliceId: usage.sliceId });
    }
  }
  return affected;
}
