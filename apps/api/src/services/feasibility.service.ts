import type { FeasibilityStudy } from '@prisma/client';
import { toNum } from '../lib/auth';

export interface FeasibilityInput {
  landCost: number;
  landArea: number;
  fsi: number;
  maxFloors: number;
  constructionCost: number;
  materialCost: number;
  labourCost: number;
  machineryCost: number;
  professionalFees: number;
  marketingCost: number;
  financeCost: number;
  taxes: number;
  contingency: number;
  sellingPricePerSqFt: number;
  constructionMonths?: number;
  interestRate?: number;
}

export interface FeasibilityResult {
  buildableArea: number;
  totalInvestment: number;
  totalRevenue: number;
  grossProfit: number;
  netProfit: number;
  roi: number;
  irr: number;
  npv: number;
  breakEvenMonths: number;
  paybackMonths: number;
  profitMargin: number;
  costPerSqFt: number;
  investmentScore: number;
  riskScore: number;
  aiRecommendation: string;
  aiSummary: string;
  isRecommended: boolean;
}

export function calculateFeasibility(input: FeasibilityInput): FeasibilityResult {
  const buildableArea = input.landArea * input.fsi * input.maxFloors;
  const totalConstruction =
    input.constructionCost + input.materialCost + input.labourCost + input.machineryCost;
  const totalInvestment =
    input.landCost + totalConstruction + input.professionalFees + input.marketingCost +
    input.financeCost + input.taxes + input.contingency;
  const totalRevenue = buildableArea * input.sellingPricePerSqFt;
  const grossProfit = totalRevenue - totalInvestment;
  const netProfit = grossProfit * 0.85;
  const roi = totalInvestment > 0 ? (netProfit / totalInvestment) * 100 : 0;
  const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;
  const costPerSqFt = buildableArea > 0 ? totalInvestment / buildableArea : 0;
  const months = input.constructionMonths || 24;
  const monthlyProfit = netProfit / months;
  const breakEvenMonths = monthlyProfit > 0 ? Math.ceil(totalInvestment * 0.6 / monthlyProfit) : 0;
  const paybackMonths = monthlyProfit > 0 ? Math.ceil(totalInvestment / monthlyProfit) : 0;
  const rate = (input.interestRate || 12) / 100 / 12;
  let npv = -totalInvestment;
  for (let i = 1; i <= months; i++) {
    npv += (totalRevenue / months) / Math.pow(1 + rate, i);
  }
  npv -= totalInvestment * rate * months * 0.5;
  const irr = roi * 0.8;
  let investmentScore = Math.min(100, Math.max(0, Math.round(roi * 2 + profitMargin)));
  let riskScore = Math.min(100, Math.max(0, 100 - investmentScore + (input.contingency / totalInvestment) * 50));
  const isRecommended = roi >= 15 && profitMargin >= 20;
  const aiRecommendation = isRecommended
    ? 'RECOMMENDED: This project shows strong financial viability with acceptable ROI and profit margins.'
    : roi >= 10
      ? 'CAUTIOUS: Moderate returns. Consider cost optimization or higher selling prices.'
      : 'NOT RECOMMENDED: Returns below industry benchmarks. Re-evaluate land cost or development plan.';
  const aiSummary = `Investment: PKR ${totalInvestment.toLocaleString()} | Revenue: PKR ${totalRevenue.toLocaleString()} | ROI: ${roi.toFixed(1)}% | Payback: ${paybackMonths} months | Buildable: ${buildableArea.toLocaleString()} sq ft`;

  return {
    buildableArea, totalInvestment, totalRevenue, grossProfit, netProfit,
    roi, irr, npv, breakEvenMonths, paybackMonths, profitMargin, costPerSqFt,
    investmentScore, riskScore, aiRecommendation, aiSummary, isRecommended,
  };
}

export function mapFeasibilityToDb(input: FeasibilityInput, result: FeasibilityResult, landParcelId: string, title: string, buildingType: 'RESIDENTIAL' | 'COMMERCIAL' | 'MIXED_USE') {
  return {
    landParcelId, title, buildingType,
    landCost: input.landCost, landArea: input.landArea, fsi: input.fsi, maxFloors: input.maxFloors,
    constructionCost: input.constructionCost, materialCost: input.materialCost,
    labourCost: input.labourCost, machineryCost: input.machineryCost,
    professionalFees: input.professionalFees, marketingCost: input.marketingCost,
    financeCost: input.financeCost, taxes: input.taxes, contingency: input.contingency,
    sellingPricePerSqFt: input.sellingPricePerSqFt,
    totalInvestment: result.totalInvestment, totalRevenue: result.totalRevenue,
    grossProfit: result.grossProfit, netProfit: result.netProfit,
    roi: result.roi, irr: result.irr, npv: result.npv,
    breakEvenMonths: result.breakEvenMonths, paybackMonths: result.paybackMonths,
    profitMargin: result.profitMargin, costPerSqFt: result.costPerSqFt,
    investmentScore: result.investmentScore, riskScore: result.riskScore,
    aiRecommendation: result.aiRecommendation, aiSummary: result.aiSummary,
    isRecommended: result.isRecommended,
  };
}

export function formatFeasibility(study: FeasibilityStudy) {
  return { ...study, landCost: toNum(study.landCost), totalInvestment: toNum(study.totalInvestment), roi: toNum(study.roi) };
}
