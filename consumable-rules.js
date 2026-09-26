// 耗材批次台账 · 判定（业务规则）
// 纯函数，不做 IO：批号/效期/剩量/重复校验，异常批次波及与停交付复核判定。

// 耗材类别 → 切片步骤（耗材对应到切片步骤）
export const CATEGORY_STEP = { "切割片": "切割", "研磨盘": "研磨", "染料": "染色", "封片材料": "观察" };
// 各类别库存不足阈值
export const LOW_STOCK = { "切割片": 2, "研磨盘": 5, "染料": 3, "封片材料": 10 };

export const today = () => new Date().toISOString().slice(0, 10);

// 剩余 = 登记数量 − 累计领用
export function remainingOf(db, batchNo) {
  const batch = db.batches.find(item => item.batchNo === batchNo);
  if (!batch) return 0;
  const used = db.checkouts.filter(item => item.batchNo === batchNo).reduce((sum, item) => sum + item.quantity, 0);
  return batch.quantity - used;
}

export function batchStatus(db, batch) {
  if (batch.abnormal) return "异常批次";
  const remaining = remainingOf(db, batch.batchNo);
  if (batch.expiryDate < today()) return "已过期";
  if (remaining <= 0) return "已用完";
  if (remaining <= (LOW_STOCK[batch.category] ?? 3)) return "库存不足";
  return "正常";
}

// 批次登记判定：批号重复、有效期已过的批次不能入库
export function validateBatch(db, input) {
  const batchNo = String(input.batchNo || "").trim();
  if (!batchNo) return { ok: false, reason: "批号不能为空" };
  if (!String(input.name || "").trim()) return { ok: false, reason: "耗材名称不能为空" };
  if (!CATEGORY_STEP[input.category]) return { ok: false, reason: `耗材类别无效，应为：${Object.keys(CATEGORY_STEP).join("、")}` };
  const quantity = Number(input.quantity);
  if (!Number.isInteger(quantity) || quantity <= 0) return { ok: false, reason: "登记数量必须为正整数" };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.expiryDate || "")) return { ok: false, reason: "有效期格式应为 YYYY-MM-DD" };
  if (input.expiryDate < today()) return { ok: false, reason: `有效期已过（${input.expiryDate}），过期耗材不能登记入库` };
  if (db.batches.some(item => item.batchNo === batchNo)) return { ok: false, reason: `批号重复：${batchNo} 已登记，不能重复入库` };
  return {
    ok: true,
    batch: {
      batchNo,
      name: String(input.name).trim(),
      category: input.category,
      unit: String(input.unit || "").trim() || "件",
      quantity,
      expiryDate: input.expiryDate,
      registeredAt: new Date().toISOString(),
      registeredBy: String(input.operator || "").trim() || "未署名",
      abnormal: false
    }
  };
}

// 领用判定：过期、剩量不足、批号重复（同切片同步骤）等情形一律不进领用记录
export function validateCheckout(db, input, validSlices) {
  const batchNo = String(input.batchNo || "").trim();
  const batch = db.batches.find(item => item.batchNo === batchNo);
  if (!batch) return { ok: false, reason: `批号 ${batchNo || "（空）"} 未登记，不能领用` };
  const quantity = Number(input.quantity);
  if (!Number.isInteger(quantity) || quantity <= 0) return { ok: false, reason: "领用数量必须为正整数" };
  const step = CATEGORY_STEP[batch.category];
  if (input.step !== step) return { ok: false, reason: `${batch.category}对应切片步骤为「${step}」，不能登记到「${input.step || "空"}」` };
  const sliceId = String(input.sliceId || "").trim();
  if (!sliceId) return { ok: false, reason: "切片编号不能为空" };
  if (validSlices && !validSlices.has(sliceId)) return { ok: false, reason: `切片 ${sliceId} 不在样本台账中` };
  if (batch.abnormal) return { ok: false, reason: `该批次已标记异常（${batch.abnormalReason}），禁止领用` };
  if (batch.expiryDate < today()) return { ok: false, reason: `批次已过期（有效期至${batch.expiryDate}）` };
  const remaining = remainingOf(db, batchNo);
  if (quantity > remaining) return { ok: false, reason: `剩余数量不足（现存${remaining}${batch.unit}，申请${quantity}${batch.unit}）` };
  if (db.checkouts.some(item => item.batchNo === batchNo && item.sliceId === sliceId && item.step === input.step)) {
    return { ok: false, reason: `批号重复：切片 ${sliceId} 在「${input.step}」已领用过该批号` };
  }
  return {
    ok: true,
    checkout: {
      id: `CK-${Date.now()}`,
      batchNo,
      sliceId,
      step: input.step,
      purpose: String(input.purpose || "").trim() || "制片领用",
      quantity,
      operator: String(input.operator || "").trim() || "未署名",
      at: new Date().toISOString()
    }
  };
}

// 拒收登记：领用不进记录，只留原因备查
export function recordRejection(db, input, reason) {
  db.rejected.unshift({
    id: `RJ-${Date.now()}`,
    batchNo: String(input.batchNo || "").trim(),
    sliceId: String(input.sliceId || "").trim(),
    step: String(input.step || "").trim(),
    quantity: Number(input.quantity) || 0,
    operator: String(input.operator || "").trim() || "未署名",
    reason,
    at: new Date().toISOString()
  });
}

// 按批号列出受影响切片（领用过该批次的切片）
export function affectedSlices(db, batchNo) {
  return [...new Set(db.checkouts.filter(item => item.batchNo === batchNo).map(item => item.sliceId))];
}

// 标记异常批次：波及切片全部停交付
export function flagAbnormal(db, batchNo, reason, operator) {
  const batch = db.batches.find(item => item.batchNo === batchNo);
  if (!batch) return { ok: false, reason: `批号 ${batchNo} 未登记` };
  if (!reason) return { ok: false, reason: "请填写异常原因" };
  if (batch.abnormal) return { ok: false, reason: "该批次已标记异常" };
  batch.abnormal = true;
  batch.abnormalReason = reason;
  batch.flaggedBy = operator;
  batch.flaggedAt = new Date().toISOString();
  const affected = affectedSlices(db, batchNo);
  for (const sliceId of affected) {
    const held = db.holds.some(item => item.sliceId === sliceId && item.batchNo === batchNo && item.status === "停交付中");
    if (!held) {
      db.holds.unshift({ id: `HD-${Date.now()}-${sliceId}`, sliceId, batchNo, reason, heldBy: operator, heldAt: new Date().toISOString(), status: "停交付中", reviews: [], releasedAt: null, releasedBy: null });
    }
  }
  return { ok: true, affected };
}

// 换人复核：复核人不能是标记人或该批次领用人；通过才恢复交付
export function reviewHold(db, holdId, input) {
  const hold = db.holds.find(item => item.id === holdId);
  if (!hold) return { ok: false, reason: "停交付记录不存在" };
  if (hold.status !== "停交付中") return { ok: false, reason: "该切片已恢复交付，无需复核" };
  const reviewer = String(input.reviewer || "").trim();
  if (!reviewer) return { ok: false, reason: "复核人不能为空" };
  if (reviewer === hold.heldBy) return { ok: false, reason: `复核人不能与标记人（${hold.heldBy}）相同，需换人复核` };
  const operators = db.checkouts.filter(item => item.batchNo === hold.batchNo && item.sliceId === hold.sliceId).map(item => item.operator);
  if (operators.includes(reviewer)) return { ok: false, reason: `复核人不能是该批次的领用人（${reviewer}），需换人复核` };
  if (!["通过", "未通过"].includes(input.result)) return { ok: false, reason: "复核结果应为「通过」或「未通过」" };
  hold.reviews.push({ reviewer, result: input.result, note: String(input.note || "").trim(), at: new Date().toISOString() });
  if (input.result === "通过") {
    hold.status = "已恢复";
    hold.releasedAt = new Date().toISOString();
    hold.releasedBy = reviewer;
  }
  return { ok: true, hold };
}

export function activeHoldForSlice(db, sliceId) {
  return db.holds.find(item => item.sliceId === sliceId && item.status === "停交付中") || null;
}
