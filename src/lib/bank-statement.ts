// Bank Statement Analyzer
// Extracts banking signals from a CSV or PDF statement and produces verification
// metrics. Per project philosophy: uploaded documents IMPROVE confidence/verification.
// They do not directly approve or reject an applicant.

export interface BankTxn {
  date: Date;
  amount: number;          // absolute value
  type: "credit" | "debit";
  balance?: number;
  description?: string;
}

export interface MonthlyAgg {
  month: string;           // YYYY-MM
  label: string;           // Mon YY
  income: number;
  expense: number;
  net: number;
  endBalance: number;
  txnCount: number;
}

export interface BankAnalysis {
  source: "csv" | "pdf";
  fileName: string;
  txnCount: number;
  monthsCovered: number;
  dateRange: { from: string; to: string };

  avgMonthlyBalance: number;
  estimatedMonthlyIncome: number;
  incomeConsistency: number;   // 0..100
  savingsBehaviour: number;    // 0..100
  cashFlowStability: number;   // 0..100
  monthlyTxnVolume: number;
  bouncedCount: number;
  overdraftCount: number;

  bankingHealthScore: number;  // 0..100
  verificationScore: number;   // 0..100

  declaredIncome: number;
  verifiedIncome: number;
  matchQuality: number;        // 0..100

  confidenceAdjustment: number; // -15..+15 to add to existing confidence
  summary: string;

  monthly: MonthlyAgg[];
}

const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));

// ---------- CSV ----------
function parseCSV(text: string): BankTxn[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length < 2) return [];
  const splitLine = (l: string) => {
    // basic CSV: handle quoted fields with commas
    const out: string[] = [];
    let cur = "", inQ = false;
    for (const ch of l) {
      if (ch === '"') { inQ = !inQ; continue; }
      if (ch === "," && !inQ) { out.push(cur); cur = ""; continue; }
      cur += ch;
    }
    out.push(cur);
    return out.map(s => s.trim());
  };
  const header = splitLine(lines[0]).map(h => h.toLowerCase().replace(/[^a-z0-9]/g, ""));
  const find = (...needles: string[]) =>
    header.findIndex(h => needles.some(n => h.includes(n)));
  const idxDate = find("date", "txndate", "transactiondate", "valuedate");
  const idxDesc = find("desc", "narration", "particulars", "details", "remark");
  const idxDebit = find("debit", "withdrawal", "dr");
  const idxCredit = find("credit", "deposit", "cr");
  const idxAmount = find("amount");
  const idxType = find("type", "drcr");
  const idxBal = find("balance");

  const parseNum = (s: string) => {
    if (!s) return 0;
    const n = parseFloat(s.replace(/[, ₹]/g, ""));
    return isFinite(n) ? n : 0;
  };
  const parseDate = (s: string): Date | null => {
    if (!s) return null;
    // try ISO
    const iso = new Date(s);
    if (!isNaN(iso.getTime()) && /\d{4}/.test(s)) return iso;
    // DD/MM/YYYY or DD-MM-YYYY
    const m = s.match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/);
    if (m) {
      let [, d, mo, y] = m;
      if (y.length === 2) y = (parseInt(y) > 50 ? "19" : "20") + y;
      const dt = new Date(parseInt(y), parseInt(mo) - 1, parseInt(d));
      if (!isNaN(dt.getTime())) return dt;
    }
    return null;
  };

  const txns: BankTxn[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = splitLine(lines[i]);
    const date = parseDate(cols[idxDate] ?? "");
    if (!date) continue;
    const debit = idxDebit >= 0 ? parseNum(cols[idxDebit]) : 0;
    const credit = idxCredit >= 0 ? parseNum(cols[idxCredit]) : 0;
    let amount = 0;
    let type: "credit" | "debit" = "credit";
    if (debit || credit) {
      if (credit > 0) { amount = credit; type = "credit"; }
      else { amount = debit; type = "debit"; }
    } else if (idxAmount >= 0) {
      const raw = cols[idxAmount] ?? "";
      const n = parseNum(raw);
      amount = Math.abs(n);
      if (idxType >= 0) {
        const t = (cols[idxType] ?? "").toLowerCase();
        type = /cr|credit|in/.test(t) ? "credit" : "debit";
      } else {
        type = n >= 0 ? "credit" : "debit";
      }
    }
    if (amount <= 0) continue;
    const balance = idxBal >= 0 ? parseNum(cols[idxBal]) : undefined;
    const description = idxDesc >= 0 ? cols[idxDesc] : undefined;
    txns.push({ date, amount, type, balance, description });
  }
  return txns;
}

// ---------- PDF ----------
async function extractPdfText(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  // Worker setup for Vite
  // @ts-expect-error vite ?url import
  const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  const buf = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buf }).promise;
  let out = "";
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const tc = await page.getTextContent();
    // group items by approximate Y to reconstruct lines
    const items = tc.items as Array<{ str: string; transform: number[] }>;
    const rows = new Map<number, { x: number; s: string }[]>();
    for (const it of items) {
      const y = Math.round(it.transform[5]);
      const x = it.transform[4];
      const arr = rows.get(y) ?? [];
      arr.push({ x, s: it.str });
      rows.set(y, arr);
    }
    const sortedY = [...rows.keys()].sort((a, b) => b - a);
    for (const y of sortedY) {
      const line = rows.get(y)!.sort((a, b) => a.x - b.x).map(r => r.s).join(" ").replace(/\s+/g, " ").trim();
      if (line) out += line + "\n";
    }
    out += "\n";
  }
  return out;
}

function parsePdfText(text: string): BankTxn[] {
  const lines = text.split(/\n/);
  const txns: BankTxn[] = [];
  const dateRe = /(\d{1,2}[\/\-.][A-Za-z0-9]{1,3}[\/\-.]\d{2,4}|\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4})/;
  const numRe = /-?\d{1,3}(?:,\d{2,3})*(?:\.\d{1,2})|-?\d+\.\d{2}/g;
  const parseDate = (s: string): Date | null => {
    const m = s.match(/(\d{1,2})[\/\-.]([A-Za-z0-9]{1,3})[\/\-.](\d{2,4})/);
    if (!m) return null;
    let [, d, mo, y] = m;
    if (y.length === 2) y = (parseInt(y) > 50 ? "19" : "20") + y;
    const months: Record<string, number> = { jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,oct:9,nov:10,dec:11 };
    let moIdx: number;
    if (/^\d+$/.test(mo)) moIdx = parseInt(mo) - 1;
    else { const k = mo.slice(0,3).toLowerCase(); if (!(k in months)) return null; moIdx = months[k]; }
    const dt = new Date(parseInt(y), moIdx, parseInt(d));
    return isNaN(dt.getTime()) ? null : dt;
  };
  const toNum = (s: string) => parseFloat(s.replace(/,/g, ""));

  for (const raw of lines) {
    const line = raw.trim();
    const dm = line.match(dateRe);
    if (!dm) continue;
    const date = parseDate(dm[0]);
    if (!date) continue;
    const nums = line.match(numRe) ?? [];
    if (nums.length === 0) continue;
    const parsed = nums.map(toNum).filter(n => isFinite(n) && Math.abs(n) > 0.01);
    if (parsed.length === 0) continue;
    // Heuristic: last number is balance, prior is amount.
    let amount: number, balance: number | undefined;
    if (parsed.length >= 2) {
      balance = parsed[parsed.length - 1];
      amount = parsed[parsed.length - 2];
    } else {
      amount = parsed[0];
    }
    // Determine credit/debit by keywords
    const lc = line.toLowerCase();
    let type: "credit" | "debit" = "debit";
    if (/\bcr\b|credit|deposit|salary|neft.?in|imps.?in|received|by\b/.test(lc)) type = "credit";
    else if (/\bdr\b|debit|withdraw|atm|pos|upi|paid|to\b|cheque/.test(lc)) type = "debit";
    else type = amount > 0 ? "debit" : "credit";

    txns.push({
      date,
      amount: Math.abs(amount),
      type,
      balance,
      description: line.replace(dateRe, "").replace(numRe, "").replace(/\s+/g, " ").trim().slice(0, 120),
    });
  }
  return txns;
}

// ---------- Analysis ----------
function aggregate(txns: BankTxn[]): MonthlyAgg[] {
  const map = new Map<string, MonthlyAgg>();
  for (const t of [...txns].sort((a, b) => a.date.getTime() - b.date.getTime())) {
    const key = `${t.date.getFullYear()}-${String(t.date.getMonth() + 1).padStart(2, "0")}`;
    const label = t.date.toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
    const m = map.get(key) ?? { month: key, label, income: 0, expense: 0, net: 0, endBalance: 0, txnCount: 0 };
    if (t.type === "credit") m.income += t.amount;
    else m.expense += t.amount;
    if (typeof t.balance === "number") m.endBalance = t.balance;
    m.txnCount += 1;
    map.set(key, m);
  }
  const arr = [...map.values()].sort((a, b) => a.month.localeCompare(b.month));
  for (const m of arr) m.net = m.income - m.expense;
  return arr;
}

function std(nums: number[]): number {
  if (nums.length < 2) return 0;
  const m = nums.reduce((a, b) => a + b, 0) / nums.length;
  return Math.sqrt(nums.map(n => (n - m) ** 2).reduce((a, b) => a + b, 0) / nums.length);
}

export function analyze(opts: { txns: BankTxn[]; declaredIncome: number; source: "csv" | "pdf"; fileName: string; rawText?: string }): BankAnalysis {
  const { txns, declaredIncome, source, fileName, rawText = "" } = opts;
  if (txns.length === 0) throw new Error("No transactions could be parsed from this file.");
  const monthly = aggregate(txns);
  const monthsCovered = monthly.length;

  const balances = txns.map(t => t.balance).filter((b): b is number => typeof b === "number");
  const avgBalance = balances.length ? balances.reduce((a, b) => a + b, 0) / balances.length : 0;

  // Estimated income: look at largest recurring monthly credit (probable salary).
  // Fallback: average monthly credits.
  const creditsByMonth = monthly.map(m => m.income);
  const avgIncome = creditsByMonth.reduce((a, b) => a + b, 0) / Math.max(1, monthsCovered);
  // Look for repeating credit ≥ 0.4 * avgIncome
  const bigCredits = txns.filter(t => t.type === "credit" && t.amount >= avgIncome * 0.4);
  let estimatedIncome = avgIncome;
  if (bigCredits.length >= monthsCovered * 0.6 && monthsCovered >= 2) {
    const sum = bigCredits.reduce((a, b) => a + b.amount, 0);
    estimatedIncome = sum / monthsCovered;
  }

  // Income consistency: 100 - coefficient of variation (%)
  const incomeStd = std(creditsByMonth);
  const incomeMean = avgIncome || 1;
  const incomeCV = (incomeStd / incomeMean) * 100;
  const incomeConsistency = clamp(100 - incomeCV);

  // Cash flow stability: std of net flow vs income
  const netStd = std(monthly.map(m => m.net));
  const cashFlowStability = clamp(100 - (netStd / Math.max(1, incomeMean)) * 100);

  // Savings behaviour: avg savings rate (net / income) and balance trend
  const savingsRate = monthly.reduce((a, m) => a + (m.income > 0 ? m.net / m.income : 0), 0) / Math.max(1, monthsCovered);
  let balanceTrend = 0;
  if (monthly.length >= 2) {
    const first = monthly[0].endBalance;
    const last = monthly[monthly.length - 1].endBalance;
    if (first > 0) balanceTrend = (last - first) / first;
  }
  const savingsBehaviour = clamp(50 + savingsRate * 100 + balanceTrend * 25);

  // Bounced / overdraft heuristics
  const lcText = rawText.toLowerCase();
  const bouncedKeywordCount =
    (lcText.match(/bounce|insufficient|return(ed)?\s+(chq|cheque|item)|chq\s*ret|ecs.?ret/g) ?? []).length +
    txns.filter(t => /bounce|return|insufficient/i.test(t.description ?? "")).length;
  const overdraftFromBalance = balances.filter(b => b < 0).length;
  const overdraftKeyword = (lcText.match(/overdraft|\bod\s*utilis/g) ?? []).length;

  // Banking Health Score
  const bankingHealthScore = clamp(
    0.35 * incomeConsistency +
    0.25 * cashFlowStability +
    0.20 * savingsBehaviour +
    0.10 * clamp(monthsCovered * 16) +                    // history depth (>=6mo => 96)
    0.10 * clamp(100 - bouncedKeywordCount * 10 - overdraftFromBalance * 8)
  );

  // Verification Score: how complete and clean the parsed dataset is
  const txnDensity = clamp((txns.length / Math.max(1, monthsCovered)) * 3.5);
  const balanceCoverage = clamp((balances.length / Math.max(1, txns.length)) * 100);
  const verificationScore = clamp(
    0.40 * txnDensity +
    0.25 * balanceCoverage +
    0.20 * clamp(monthsCovered * 18) +
    0.15 * (estimatedIncome > 0 ? 100 : 30)
  );

  // Declared vs verified
  const decl = Math.max(0, declaredIncome || 0);
  const verif = Math.round(estimatedIncome);
  let matchQuality = 100;
  if (decl > 0 && verif > 0) {
    const diff = Math.abs(decl - verif) / Math.max(decl, verif);
    matchQuality = clamp(100 - diff * 100);
  } else if (decl === 0 && verif > 0) {
    matchQuality = 75; // applicant declared none, but we found income — neutral-positive
  } else if (decl > 0 && verif === 0) {
    matchQuality = 30;
  }

  // Confidence adjustment: positive when match strong + data clean; small negative when mismatch.
  // Capped to ±15 so a bad statement never alone rejects an applicant.
  let confidenceAdjustment = 0;
  if (verificationScore >= 60) confidenceAdjustment += (verificationScore - 60) * 0.15; // up to +6
  if (matchQuality >= 80) confidenceAdjustment += (matchQuality - 80) * 0.25;            // up to +5
  else if (matchQuality < 60 && decl > 0) confidenceAdjustment -= (60 - matchQuality) * 0.2; // down to -12
  if (bankingHealthScore >= 70) confidenceAdjustment += 2;
  confidenceAdjustment = Math.max(-15, Math.min(15, Math.round(confidenceAdjustment * 10) / 10));

  // Summary
  const parts: string[] = [];
  parts.push(`${monthsCovered} month${monthsCovered === 1 ? "" : "s"} of activity parsed (${txns.length} transactions).`);
  if (verif > 0) parts.push(`Verified monthly income ≈ ₹${verif.toLocaleString("en-IN")}.`);
  if (decl > 0 && verif > 0) parts.push(`Declared vs verified match quality: ${Math.round(matchQuality)}%.`);
  if (bouncedKeywordCount > 0) parts.push(`${bouncedKeywordCount} bounced/returned item signal(s) detected.`);
  if (overdraftFromBalance > 0) parts.push(`${overdraftFromBalance} day(s) with negative balance.`);
  parts.push(confidenceAdjustment >= 0
    ? `This statement raises assessment confidence by ${confidenceAdjustment.toFixed(1)} points.`
    : `Mismatch reduces confidence by ${Math.abs(confidenceAdjustment).toFixed(1)} points — risk score is NOT changed.`);
  const summary = parts.join(" ");

  return {
    source, fileName,
    txnCount: txns.length,
    monthsCovered,
    dateRange: {
      from: txns.reduce((a, b) => a.date < b.date ? a : b).date.toLocaleDateString("en-IN"),
      to: txns.reduce((a, b) => a.date > b.date ? a : b).date.toLocaleDateString("en-IN"),
    },
    avgMonthlyBalance: Math.round(avgBalance),
    estimatedMonthlyIncome: verif,
    incomeConsistency: Math.round(incomeConsistency),
    savingsBehaviour: Math.round(savingsBehaviour),
    cashFlowStability: Math.round(cashFlowStability),
    monthlyTxnVolume: Math.round(txns.length / Math.max(1, monthsCovered)),
    bouncedCount: bouncedKeywordCount,
    overdraftCount: overdraftFromBalance + overdraftKeyword,
    bankingHealthScore: Math.round(bankingHealthScore),
    verificationScore: Math.round(verificationScore),
    declaredIncome: decl,
    verifiedIncome: verif,
    matchQuality: Math.round(matchQuality),
    confidenceAdjustment,
    summary,
    monthly,
  };
}

export async function analyzeFile(file: File, declaredIncome: number): Promise<BankAnalysis> {
  const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
  const isCsv = file.type === "text/csv" || /\.csv$/i.test(file.name);
  if (!isPdf && !isCsv) throw new Error("Unsupported file type. Upload a PDF or CSV statement.");
  if (file.size > 15 * 1024 * 1024) throw new Error("File too large (max 15 MB).");
  if (isCsv) {
    const text = await file.text();
    const txns = parseCSV(text);
    return analyze({ txns, declaredIncome, source: "csv", fileName: file.name, rawText: text });
  } else {
    const text = await extractPdfText(file);
    const txns = parsePdfText(text);
    return analyze({ txns, declaredIncome, source: "pdf", fileName: file.name, rawText: text });
  }
}
