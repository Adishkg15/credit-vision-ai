// Pure scoring engine for Credit Vision.
// Philosophy: missing credit history = missing information, NOT risk.
// Risk score and Confidence score are independent.

import type { BankAnalysis } from "./bank-statement";

export type EmploymentType =
  | "student"
  | "fresher"
  | "salaried"
  | "freelancer"
  | "self_employed"
  | "gig_worker"
  | "unemployed";

export type PlacementStatus = "placed" | "in_process" | "not_started" | "na";

export interface AssessmentInputs {
  // Step 1 — Personal Profile
  name: string;
  age: number;
  city: string;
  education: "high_school" | "diploma" | "bachelors" | "masters" | "phd";
  institutionTier: 1 | 2 | 3;
  certifications: number;
  internships: number;
  workExperienceYears: number;
  employmentType: EmploymentType;

  // Student-specific (optional, used when employmentType === "student")
  collegeName?: string;
  graduationYear?: number;
  placementStatus?: PlacementStatus;
  offerLetter?: boolean;
  expectedSalary?: number; // monthly ₹ expected post-graduation

  // Step 2 — Financial Profile (monthly ₹)
  monthlyIncome: number;
  monthlyExpenses: number;
  savings: number;
  emergencyFundMonths: number;
  investments: number;
  assets: number;
  dependents: number;

  // Family / support indicators
  familySupport?: boolean; // student lives with / supported by family
  scholarshipAmount?: number; // monthly

  // Step 3 — Banking Behaviour
  avgBankBalance: number;
  monthlyTransactions: number;
  transactionConsistency: 1 | 2 | 3 | 4 | 5;
  digitalPaymentUsage: 1 | 2 | 3 | 4 | 5;
  failedTransactions: number;
  overdraftEvents: number;

  // Step 4 — Bill Payment
  rentPayments: -1 | 0 | 1 | 2 | 3;
  utilityPayments: -1 | 0 | 1 | 2 | 3;
  telecomPayments: -1 | 0 | 1 | 2 | 3;
  subscriptionPayments: -1 | 0 | 1 | 2 | 3;

  // Step 5 — Employment
  industry: "tech" | "finance" | "healthcare" | "education" | "government" | "retail" | "manufacturing" | "creative" | "other" | "na";
  jobTenureMonths: number;
  salaryGrowthPct: number;
  promotions: number;
  employerStability: 1 | 2 | 3 | 4 | 5;
}

export interface CategoryBreakdown {
  key: string;
  label: string;
  weight: number;
  score: number;
  confidence: number;
  notes: string[];
}

export interface LoanRecommendation {
  product: string;
  eligible: boolean;
  approvalProbability: number;
  recommendedAmount: number;
  interestRange: [number, number];
  confidence: number;
  rationale: string;
}

export interface AdvancedScores {
  futurePotential: number;        // 0..100
  financialDiscipline: number;    // 0..100
  trust: number;                  // 0..100
  futurePotentialBreakdown: { label: string; contribution: number }[];
  financialDisciplineBreakdown: { label: string; contribution: number }[];
  trustBreakdown: { label: string; contribution: number }[];
}

export interface AssessmentResult {
  overallScore: number;
  confidenceScore: number;
  riskLevel: "Low" | "Moderate" | "Elevated" | "High";
  eligibilityStatus: "Approved" | "Conditional Approval" | "Manual Review" | "Not Eligible";
  categories: CategoryBreakdown[];
  strengths: string[];
  concerns: string[];
  missingInformation: string[];
  insights: string[];
  recommendations: LoanRecommendation[];
  advanced: AdvancedScores;
}

const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));
const round = (n: number) => Math.round(n * 10) / 10;

function billScore(v: number): { score: number | null; confidence: number } {
  if (v === -1) return { score: null, confidence: 0 };
  if (v === 0) return { score: null, confidence: 0 };
  if (v === 1) return { score: 45, confidence: 80 };
  if (v === 2) return { score: 70, confidence: 85 };
  return { score: 92, confidence: 90 };
}

function avg(nums: number[]) {
  if (!nums.length) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

export function computeAssessment(i: AssessmentInputs): AssessmentResult {
  const missing: string[] = [];
  const strengths: string[] = [];
  const concerns: string[] = [];
  const insights: string[] = [];

  const isStudent = i.employmentType === "student";

  // ---------- 1. Financial Stability (25%) ----------
  const income = Math.max(0, i.monthlyIncome || 0);
  const expenses = Math.max(0, i.monthlyExpenses || 0);
  const surplus = income - expenses;
  const surplusRatio = income > 0 ? surplus / income : 0;
  const savingsMonths = expenses > 0 ? i.savings / expenses : (i.savings > 0 ? 6 : 0);

  let finScore = 0;
  let finConf = 90;
  const finNotes: string[] = [];

  if (income === 0 && !isStudent) {
    finConf = 60;
    finNotes.push("No reported income — capacity to repay cannot be established.");
    missing.push("Verified monthly income");
  } else if (isStudent && income === 0) {
    // Student with no income: evaluate on savings + family support + scholarship
    finConf = 55;
    finNotes.push("Student profile — evaluated on savings, scholarships and family support.");
    finScore += clamp(Math.log10(1 + i.savings) * 6, 0, 25);
    if (i.familySupport) { finScore += 20; strengths.push("Family financial support available."); }
    if ((i.scholarshipAmount ?? 0) > 0) { finScore += 15; strengths.push("Active scholarship income."); }
    finScore += clamp((i.expectedSalary ?? 0) / 1000, 0, 20);
    finScore = clamp(finScore);
    if (i.savings === 0 && !i.familySupport && (i.scholarshipAmount ?? 0) === 0) {
      concerns.push("No savings, scholarship or family support reported.");
    }
  } else {
    finScore += clamp(surplusRatio * 100, -20, 50) + 20;
    finScore += clamp(savingsMonths * 6, 0, 30);
    finScore += clamp(i.emergencyFundMonths * 4, 0, 15);
    finScore += clamp(Math.log10(1 + i.investments) * 3, 0, 10);
    finScore += clamp(Math.log10(1 + i.assets) * 2.5, 0, 8);
    finScore -= clamp(i.dependents * 2, 0, 10);
    finScore = clamp(finScore);
    if (surplusRatio > 0.3) strengths.push(`Healthy monthly surplus (${Math.round(surplusRatio * 100)}% of income)`);
    if (savingsMonths >= 6) strengths.push(`Strong savings cushion (~${Math.round(savingsMonths)} months of expenses)`);
    if (surplus < 0) concerns.push("Monthly expenses exceed income.");
    if (i.emergencyFundMonths < 3 && income > 0) concerns.push("Emergency fund below 3 months of expenses.");
    finNotes.push(`Surplus ratio: ${Math.round(surplusRatio * 100)}% • Savings: ~${Math.round(savingsMonths)} mo`);
  }

  // ---------- 2. Banking Behaviour (20%) ----------
  let bankScore = 0;
  let bankConf = 85;
  const bankNotes: string[] = [];
  if (i.monthlyTransactions === 0 && i.avgBankBalance === 0) {
    bankConf = 40;
    missing.push("Bank transaction history");
    bankNotes.push("No banking activity reported.");
  } else {
    bankScore += clamp(Math.log10(1 + i.avgBankBalance) * 8, 0, 30);
    bankScore += clamp(Math.min(i.monthlyTransactions, 60) * 0.4, 0, 20);
    bankScore += (i.transactionConsistency - 1) * 6;
    bankScore += (i.digitalPaymentUsage - 1) * 4;
    bankScore -= clamp(i.failedTransactions * 3, 0, 20);
    bankScore -= clamp(i.overdraftEvents * 6, 0, 30);
    bankScore = clamp(bankScore);
    if (i.transactionConsistency >= 4) strengths.push("Consistent banking behaviour.");
    if (i.overdraftEvents > 2) concerns.push(`${i.overdraftEvents} overdraft events indicate liquidity stress.`);
    if (i.failedTransactions > 5) concerns.push("Frequent failed transactions.");
    bankNotes.push(`Avg balance ₹${i.avgBankBalance.toLocaleString("en-IN")} • ${i.monthlyTransactions} tx/mo`);
  }

  // ---------- 3. Employment Quality (20%) ----------
  let empScore = 0;
  let empConf = 90;
  const empNotes: string[] = [];
  if (i.employmentType === "unemployed") {
    empScore = 15;
    empConf = 90;
    concerns.push("Currently unemployed.");
    empNotes.push("No active employment.");
  } else if (isStudent) {
    // Student: score on academic profile + offer letter + placement
    empScore = 50;
    empConf = 70;
    missing.push("Established employment history");
    if (i.offerLetter) { empScore += 20; strengths.push("Pre-placement offer letter on file."); }
    if (i.placementStatus === "placed") { empScore += 15; strengths.push("Placement confirmed."); }
    else if (i.placementStatus === "in_process") empScore += 8;
    if (i.internships > 0) { empScore += clamp(i.internships * 4, 0, 12); strengths.push(`${i.internships} internship(s) demonstrate work readiness.`); }
    empScore = clamp(empScore);
    empNotes.push("Student profile — scored on academic and employability signals.");
  } else if (i.employmentType === "fresher") {
    empScore = 55;
    empConf = 65;
    missing.push("Established employment history");
    empNotes.push("Fresher: scored on potential, not history.");
    if (i.internships > 0) { empScore += clamp(i.internships * 5, 0, 15); strengths.push(`${i.internships} internship(s) demonstrate work readiness.`); }
  } else {
    empScore += clamp(i.jobTenureMonths * 0.6, 0, 30);
    empScore += clamp(i.salaryGrowthPct * 1.2, 0, 20);
    empScore += clamp(i.promotions * 5, 0, 15);
    empScore += (i.employerStability - 1) * 5;
    const indBonus: Record<string, number> = { tech: 12, finance: 12, government: 14, healthcare: 10, education: 8, manufacturing: 6, retail: 4, creative: 4, other: 4, na: 0 };
    empScore += indBonus[i.industry] ?? 0;
    if (i.employmentType === "freelancer" || i.employmentType === "gig_worker") {
      empScore *= 0.9;
      empNotes.push("Gig/freelance income — modest adjustment for volatility.");
    }
    empScore = clamp(empScore);
    if (i.jobTenureMonths >= 24) strengths.push(`Stable tenure (${Math.round(i.jobTenureMonths)} months) at current employer.`);
    if (i.salaryGrowthPct >= 10) strengths.push("Above-average salary growth.");
    empNotes.push(`Tenure ${i.jobTenureMonths} mo • Growth ${i.salaryGrowthPct}%/yr`);
  }

  // ---------- 4. Behavioural Discipline (15%) ----------
  const billVals = [i.rentPayments, i.utilityPayments, i.telecomPayments, i.subscriptionPayments];
  const billScores = billVals.map(billScore);
  const knownBills = billScores.filter(b => b.score !== null) as { score: number; confidence: number }[];
  let behScore = 0;
  let behConf = 75;
  if (knownBills.length === 0) {
    behConf = 45;
    missing.push("Bill payment history");
    behScore = 55;
  } else {
    const bAvg = avg(knownBills.map(b => b.score));
    behScore = bAvg * 0.6
      + (i.transactionConsistency - 1) * 5
      + (i.digitalPaymentUsage - 1) * 3
      - clamp(i.overdraftEvents * 4, 0, 20);
    behScore = clamp(behScore);
    behConf = 55 + knownBills.length * 8;
  }

  // ---------- 5. Education (10%) ----------
  const eduBase: Record<string, number> = { high_school: 35, diploma: 50, bachelors: 65, masters: 78, phd: 85 };
  let eduScore = eduBase[i.education] ?? 50;
  eduScore += (4 - i.institutionTier) * 5;
  eduScore += clamp(i.certifications * 2, 0, 10);
  eduScore += clamp(i.internships * 2, 0, 8);
  eduScore += clamp(i.workExperienceYears * 1.5, 0, 12);
  eduScore = clamp(eduScore);
  const eduConf = 90;
  if (i.institutionTier === 1) strengths.push("Tier-1 institution background.");
  if (i.certifications >= 3) strengths.push(`${i.certifications} professional certifications.`);

  // ---------- 6. Bill Payment Consistency (10%) ----------
  let billConsistency = 60;
  let billConsConf = 50;
  if (knownBills.length > 0) {
    billConsistency = avg(knownBills.map(b => b.score));
    billConsConf = 50 + knownBills.length * 12;
  } else {
    missing.push("Recurring bill commitments");
  }

  const categories: CategoryBreakdown[] = [
    { key: "financial",  label: "Financial Stability",       weight: 25, score: round(finScore), confidence: finConf, notes: finNotes },
    { key: "banking",    label: "Banking Behaviour",         weight: 20, score: round(bankScore), confidence: bankConf, notes: bankNotes },
    { key: "employment", label: "Employment Quality",        weight: 20, score: round(empScore), confidence: empConf, notes: empNotes },
    { key: "behaviour",  label: "Behavioural Discipline",    weight: 15, score: round(behScore), confidence: behConf, notes: [] },
    { key: "education",  label: "Education & Human Capital", weight: 10, score: round(eduScore), confidence: eduConf, notes: [] },
    { key: "bills",      label: "Bill Payment Consistency",  weight: 10, score: round(billConsistency), confidence: billConsConf, notes: [] },
  ];

  const overallScore = round(categories.reduce((s, c) => s + c.score * (c.weight / 100), 0));
  const confidenceScore = round(categories.reduce((s, c) => s + c.confidence * (c.weight / 100), 0));

  // ---------- Risk + Eligibility ----------
  let riskLevel: AssessmentResult["riskLevel"];
  if (overallScore >= 75) riskLevel = "Low";
  else if (overallScore >= 60) riskLevel = "Moderate";
  else if (overallScore >= 45) riskLevel = "Elevated";
  else riskLevel = "High";

  // Hard eligibility — must have at least one capacity / support indicator
  const hasSupport = !!i.familySupport || (i.scholarshipAmount ?? 0) > 0;
  const hasExpectedIncome = isStudent && ((i.offerLetter && (i.expectedSalary ?? 0) > 0) || i.placementStatus === "placed");
  const noCapacity =
    income <= 0 &&
    i.savings <= 0 &&
    !hasSupport &&
    !hasExpectedIncome &&
    (i.employmentType === "unemployed" || (isStudent && !i.offerLetter));

  let eligibilityStatus: AssessmentResult["eligibilityStatus"];
  if (noCapacity) eligibilityStatus = "Not Eligible";
  else if (overallScore >= 75 && confidenceScore >= 70) eligibilityStatus = "Approved";
  else if (overallScore >= 60) eligibilityStatus = "Conditional Approval";
  else if (overallScore >= 45 || confidenceScore < 55) eligibilityStatus = "Manual Review";
  else eligibilityStatus = "Not Eligible";

  if (confidenceScore < 60) insights.push("Confidence is limited by missing data — providing more inputs (banking, bills, employment proof) can raise certainty without changing risk.");
  if (overallScore >= 70 && confidenceScore < 70) insights.push("Strong profile signals, but confidence would improve with verified documents.");
  if (isStudent || i.employmentType === "fresher") insights.push("Profile evaluated on potential indicators (education, skills, banking habits) rather than credit history.");
  if (i.digitalPaymentUsage >= 4 && i.transactionConsistency >= 4) insights.push("Strong digital and transactional discipline — a positive alternative-data signal.");
  if (income > 0 && surplusRatio < 0.1) insights.push("Tight monthly surplus — consider reducing discretionary spend before borrowing.");

  // ---------- Advanced scores ----------
  const advanced = computeAdvanced(i, { confidenceScore, isStudent, knownBills });

  // ---------- Loan Recommendations ----------
  const baseDTI = 0.4;
  const affordableEMI = Math.max(0, surplus * baseDTI);
  const scoreFactor = overallScore / 100;
  const confFactor = confidenceScore / 100;
  const effectiveIncome = income > 0 ? income : (hasExpectedIncome ? (i.expectedSalary ?? 0) * 0.4 : 0);

  function buildRec(product: string, opts: {
    minIncome?: number;
    multiplier: number;
    minTenureMonths?: number;
    baseRate: number;
    maxAmount: number;
    eligibilityNote?: string;
    allowStudent?: boolean;
  }): LoanRecommendation {
    const minIncome = opts.minIncome ?? 0;
    const tenureOk =
      (opts.minTenureMonths ?? 0) <= i.jobTenureMonths ||
      (isStudent && opts.allowStudent === true);

    const incomeForCheck = isStudent && opts.allowStudent ? (i.expectedSalary ?? 0) : income;

    if (noCapacity || incomeForCheck < minIncome || !tenureOk) {
      return {
        product,
        eligible: false,
        approvalProbability: 0,
        recommendedAmount: 0,
        interestRange: [0, 0],
        confidence: confidenceScore,
        rationale: noCapacity
          ? "No reported income, savings or support indicators — repayment capacity is zero."
          : incomeForCheck < minIncome
            ? `Requires minimum monthly income of ₹${minIncome.toLocaleString("en-IN")}.`
            : "Insufficient employment tenure for this product.",
      };
    }

    const basis = isStudent && opts.allowStudent ? (i.expectedSalary ?? 0) : effectiveIncome;
    const incomeBased = basis * opts.multiplier * scoreFactor;
    const emiBased = affordableEMI * 36;
    const raw = isStudent && opts.allowStudent
      ? incomeBased
      : Math.min(incomeBased, emiBased * (0.5 + 0.5 * scoreFactor));
    const recommendedAmount = Math.max(0, Math.min(opts.maxAmount, Math.round(raw / 1000) * 1000));

    const approvalProbability = clamp(round((scoreFactor * 0.7 + confFactor * 0.3) * 100));
    const riskPremium = (1 - scoreFactor) * 8;
    const lo = round(opts.baseRate + riskPremium);
    const hi = round(opts.baseRate + riskPremium + 3 + (1 - confFactor) * 2);

    return {
      product,
      eligible: recommendedAmount > 0,
      approvalProbability,
      recommendedAmount,
      interestRange: [lo, hi],
      confidence: confidenceScore,
      rationale: opts.eligibilityNote ?? `Derived from monthly capacity of ₹${basis.toLocaleString("en-IN")} and overall score ${overallScore}.`,
    };
  }

  const recommendations: LoanRecommendation[] = [
    buildRec("Credit Card", { minIncome: 15000, multiplier: 2, baseRate: 30, maxAmount: 500000 }),
    buildRec("Personal Loan", { minIncome: 20000, multiplier: 10, minTenureMonths: 6, baseRate: 11, maxAmount: 2000000 }),
    buildRec("Education Loan", {
      multiplier: 15, baseRate: 9, maxAmount: 4000000, allowStudent: true,
      eligibilityNote: isStudent || i.employmentType === "fresher"
        ? "Evaluated on academic profile and earning potential."
        : undefined,
    }),
    buildRec("Consumer Durable Loan", { minIncome: 12000, multiplier: 3, baseRate: 13, maxAmount: 300000 }),
  ];

  if (noCapacity) {
    for (const r of recommendations) {
      r.eligible = false;
      r.recommendedAmount = 0;
      r.approvalProbability = 0;
      r.interestRange = [0, 0];
      r.rationale = "Not eligible — no income, savings, or support indicates zero repayment capacity.";
    }
  }

  return {
    overallScore,
    confidenceScore,
    riskLevel,
    eligibilityStatus,
    categories,
    strengths: Array.from(new Set(strengths)).slice(0, 8),
    concerns: Array.from(new Set(concerns)).slice(0, 8),
    missingInformation: Array.from(new Set(missing)).slice(0, 8),
    insights: insights.slice(0, 6),
    recommendations,
    advanced,
  };
}

function computeAdvanced(i: AssessmentInputs, ctx: { confidenceScore: number; isStudent: boolean; knownBills: { score: number; confidence: number }[] }): AdvancedScores {
  // -------- Future Potential Score --------
  const eduMap: Record<string, number> = { high_school: 8, diploma: 12, bachelors: 18, masters: 24, phd: 28 };
  const fpEdu = eduMap[i.education] ?? 12;
  const fpTier = i.institutionTier === 1 ? 18 : i.institutionTier === 2 ? 12 : 6;
  const fpCerts = clamp(i.certifications * 3, 0, 15);
  const fpIntern = clamp(i.internships * 4, 0, 14);
  const fpOffer = i.offerLetter ? 12 : 0;
  const fpSalary = clamp(((i.expectedSalary ?? 0) / 100000) * 13, 0, 13);
  const futurePotential = clamp(fpEdu + fpTier + fpCerts + fpIntern + fpOffer + fpSalary);

  // -------- Financial Discipline Index --------
  const income = Math.max(0, i.monthlyIncome || 0);
  const expenses = Math.max(0, i.monthlyExpenses || 0);
  const surplusRatio = income > 0 ? Math.max(0, (income - expenses) / income) : 0;
  const fdSavingsRate = clamp(surplusRatio * 100 * 0.3, 0, 25);
  const billAvg = ctx.knownBills.length ? avg(ctx.knownBills.map(b => b.score)) : 50;
  const fdBills = clamp((billAvg / 100) * 22, 0, 22);
  const fdUpi = clamp((i.digitalPaymentUsage / 5) * 18, 0, 18);
  const fdEmergency = clamp((i.emergencyFundMonths / 6) * 18, 0, 18);
  const overdraftPenalty = clamp(i.overdraftEvents * 3, 0, 12);
  const fdSpending = clamp(17 - overdraftPenalty, 0, 17);
  const financialDiscipline = clamp(fdSavingsRate + fdBills + fdUpi + fdEmergency + fdSpending);

  // -------- Trust Score --------
  // Information completeness, data consistency, verification, banking behaviour.
  // Credit history is NOT a factor.
  const required: [string, boolean][] = [
    ["name", !!i.name?.trim()],
    ["age", i.age > 0],
    ["city", !!i.city?.trim()],
    ["education", !!i.education],
    ["employmentType", !!i.employmentType],
    ["banking", i.avgBankBalance > 0 || i.monthlyTransactions > 0],
    ["financial", income > 0 || i.savings > 0 || !!i.familySupport],
  ];
  const completeness = (required.filter(([, v]) => v).length / required.length) * 35;

  // Consistency: surplus shouldn't be wildly negative; banking activity consistent with income claim.
  let consistency = 25;
  if (income > 0 && expenses > income * 2) consistency -= 10;
  if (income > 30000 && i.avgBankBalance === 0) consistency -= 8;
  if (i.failedTransactions > 10) consistency -= 5;
  consistency = clamp(consistency, 0, 25);

  // Verification proxy: documented signals (bills tracked, banking, employment type clarified)
  const verification = clamp(
    (ctx.knownBills.length * 4) +
    (i.transactionConsistency >= 4 ? 6 : 3) +
    (i.employmentType !== "unemployed" ? 6 : 2) +
    (i.offerLetter ? 4 : 0),
    0, 20
  );

  // Banking behaviour trust
  const bankingTrust = clamp(
    (i.transactionConsistency - 1) * 3 +
    (i.digitalPaymentUsage - 1) * 2 -
    i.overdraftEvents * 2,
    0, 20
  );

  const trust = clamp(completeness + consistency + verification + bankingTrust);

  return {
    futurePotential: round(futurePotential),
    financialDiscipline: round(financialDiscipline),
    trust: round(trust),
    futurePotentialBreakdown: [
      { label: "Education level", contribution: round(fpEdu) },
      { label: "Institution tier", contribution: round(fpTier) },
      { label: "Certifications", contribution: round(fpCerts) },
      { label: "Internship experience", contribution: round(fpIntern) },
      { label: "Offer letter", contribution: round(fpOffer) },
      { label: "Expected salary", contribution: round(fpSalary) },
    ],
    financialDisciplineBreakdown: [
      { label: "Savings rate", contribution: round(fdSavingsRate) },
      { label: "Bill payments", contribution: round(fdBills) },
      { label: "UPI / digital consistency", contribution: round(fdUpi) },
      { label: "Emergency fund", contribution: round(fdEmergency) },
      { label: "Spending behaviour", contribution: round(fdSpending) },
    ],
    trustBreakdown: [
      { label: "Information completeness", contribution: round(completeness) },
      { label: "Data consistency", contribution: round(consistency) },
      { label: "Verification signals", contribution: round(verification) },
      { label: "Banking behaviour", contribution: round(bankingTrust) },
    ],
  };
}

export const EMPTY_INPUTS: AssessmentInputs = {
  name: "", age: 25, city: "", education: "bachelors", institutionTier: 2,
  certifications: 0, internships: 0, workExperienceYears: 0, employmentType: "salaried",
  collegeName: "", graduationYear: new Date().getFullYear() + 1,
  placementStatus: "not_started", offerLetter: false, expectedSalary: 0,
  monthlyIncome: 0, monthlyExpenses: 0, savings: 0, emergencyFundMonths: 0,
  investments: 0, assets: 0, dependents: 0,
  familySupport: false, scholarshipAmount: 0,
  avgBankBalance: 0, monthlyTransactions: 0, transactionConsistency: 3,
  digitalPaymentUsage: 3, failedTransactions: 0, overdraftEvents: 0,
  rentPayments: -1, utilityPayments: -1, telecomPayments: -1, subscriptionPayments: -1,
  industry: "tech", jobTenureMonths: 0, salaryGrowthPct: 0, promotions: 0, employerStability: 3,
};
