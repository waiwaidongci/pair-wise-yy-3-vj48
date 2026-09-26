// 耗材批次台账 · 保存（数据存取）
// 负责 data/consumables.json 的读取、写入与初始台账数据，不做业务判定。

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = join(__dirname, "data", "consumables.json");

// 初始台账：批号、用途、数量、有效期齐全；含过期、库存不足、异常批次的典型情形
const seed = {
  batches: [
    { batchNo: "DYE-ALZ-2603", name: "茜素红S染液", category: "染料", unit: "瓶", quantity: 20, expiryDate: "2027-03-31", registeredAt: "2026-03-12T09:00:00.000Z", registeredBy: "周谨", abnormal: false },
    { batchNo: "DYE-ALZ-2512", name: "茜素红S染液", category: "染料", unit: "瓶", quantity: 12, expiryDate: "2026-08-31", registeredAt: "2025-12-20T09:00:00.000Z", registeredBy: "周谨", abnormal: false },
    { batchNo: "DYE-HE-2606", name: "苏木精-伊红染液", category: "染料", unit: "套", quantity: 15, expiryDate: "2026-12-31", registeredAt: "2026-06-18T09:00:00.000Z", registeredBy: "周谨", abnormal: true, abnormalReason: "染色切片出现片状沉淀，批次复测不合格", flaggedBy: "周谨", flaggedAt: "2026-09-24T10:30:00.000Z" },
    { batchNo: "GRN-P600-2605", name: "P600碳化硅研磨盘", category: "研磨盘", unit: "张", quantity: 15, expiryDate: "2027-05-31", registeredAt: "2026-05-08T09:00:00.000Z", registeredBy: "周谨", abnormal: false },
    { batchNo: "GRN-P1200-2604", name: "P1200碳化硅研磨盘", category: "研磨盘", unit: "张", quantity: 40, expiryDate: "2027-04-30", registeredAt: "2026-04-15T09:00:00.000Z", registeredBy: "周谨", abnormal: false },
    { batchNo: "CUT-DIA-2601", name: "金刚石切割片", category: "切割片", unit: "片", quantity: 10, expiryDate: "2028-01-31", registeredAt: "2026-01-22T09:00:00.000Z", registeredBy: "周谨", abnormal: false }
  ],
  checkouts: [
    { id: "CK-20260902-01", batchNo: "GRN-P600-2605", sliceId: "SL-001-A", step: "研磨", purpose: "薄片粗磨至30μm", quantity: 12, operator: "陆川", at: "2026-09-02T02:10:00.000Z" },
    { id: "CK-20260904-01", batchNo: "GRN-P1200-2604", sliceId: "SL-001-A", step: "研磨", purpose: "薄片精磨抛光", quantity: 6, operator: "沈岩", at: "2026-09-04T07:25:00.000Z" },
    { id: "CK-20260910-01", batchNo: "DYE-HE-2606", sliceId: "SL-001-A", step: "染色", purpose: "HE染色对比观察", quantity: 2, operator: "陆川", at: "2026-09-10T03:05:00.000Z" },
    { id: "CK-20260912-01", batchNo: "DYE-ALZ-2603", sliceId: "SL-001-A", step: "染色", purpose: "碳酸盐岩茜素红染色", quantity: 3, operator: "沈岩", at: "2026-09-12T08:50:00.000Z" }
  ],
  rejected: [
    { id: "RJ-20260920-01", batchNo: "DYE-ALZ-2512", sliceId: "SL-001-A", step: "染色", quantity: 1, operator: "沈岩", reason: "批次已过期（有效期至2026-08-31）", at: "2026-09-20T06:15:00.000Z" },
    { id: "RJ-20260922-01", batchNo: "GRN-P600-2605", sliceId: "SL-001-A", step: "研磨", quantity: 5, operator: "陆川", reason: "剩余数量不足（现存3张，申请5张）", at: "2026-09-22T09:40:00.000Z" },
    { id: "RJ-20260923-01", batchNo: "DYE-ALZ-2603", sliceId: "SL-001-A", step: "染色", quantity: 1, operator: "沈岩", reason: "批号重复：切片 SL-001-A 在「染色」已领用过该批号", at: "2026-09-23T02:30:00.000Z" }
  ],
  holds: [
    { id: "HD-20260924-01", sliceId: "SL-001-A", batchNo: "DYE-HE-2606", reason: "染色切片出现片状沉淀，批次复测不合格", heldBy: "周谨", heldAt: "2026-09-24T10:30:00.000Z", status: "停交付中", reviews: [], releasedAt: null, releasedBy: null }
  ]
};

export async function loadConsumables() {
  if (!existsSync(dbPath)) {
    await mkdir(dirname(dbPath), { recursive: true });
    await writeFile(dbPath, JSON.stringify(seed, null, 2));
    return JSON.parse(JSON.stringify(seed));
  }
  return JSON.parse(await readFile(dbPath, "utf8"));
}

export async function saveConsumables(db) {
  await writeFile(dbPath, JSON.stringify(db, null, 2));
}
