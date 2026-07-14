"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateProjectFeasibility = calculateProjectFeasibility;
exports.calculateFeasibility = calculateFeasibility;
exports.mapFeasibilityToDb = mapFeasibilityToDb;
exports.formatFeasibility = formatFeasibility;
const auth_1 = require("../lib/auth");
const safeDiv = (numerator, denominator) => (denominator > 0 ? numerator / denominator : 0);
function calculateProjectFeasibility(input) {
    const totalBaseRevenue = input.contractValue +
        input.variationOrders +
        input.additionalIncome +
        input.retentionRelease +
        input.otherRevenue;
    const customRevenue = input.revenues.reduce((sum, item) => sum + item.amount, 0);
    const totalEstimatedRevenue = totalBaseRevenue + customRevenue;
    const totalDirectCost = input.costs.filter((c) => c.isDirect).reduce((sum, c) => sum + c.amount, 0);
    const totalIndirectCost = input.costs.filter((c) => !c.isDirect).reduce((sum, c) => sum + c.amount, 0);
    const subtotalCost = totalDirectCost + totalIndirectCost;
    const taxAmount = (subtotalCost * input.taxPercentage) / 100;
    const contingencyAmount = (subtotalCost * input.contingencyPercentage) / 100;
    const totalEstimatedCost = subtotalCost + taxAmount + contingencyAmount;
    const grossProfit = totalEstimatedRevenue - subtotalCost;
    const netProfit = totalEstimatedRevenue - totalEstimatedCost;
    const profitPercentage = safeDiv(netProfit * 100, totalEstimatedCost);
    const profitMargin = safeDiv(netProfit * 100, totalEstimatedRevenue);
    const cashRequirement = totalEstimatedCost;
    const months = Math.max(1, input.projectDurationMonths || 1);
    const monthlyCost = totalEstimatedCost / months;
    const monthlyRevenue = totalEstimatedRevenue / months;
    const breakEvenPoint = monthlyRevenue > 0 ? totalEstimatedCost / monthlyRevenue : 0;
    const roi = safeDiv(netProfit * 100, totalEstimatedCost);
    const netCashFlow = totalEstimatedRevenue - totalEstimatedCost;
    const projectedProfit = Math.max(netCashFlow, 0);
    const projectedLoss = Math.max(-netCashFlow, 0);
    const costPerSqFt = safeDiv(totalEstimatedCost, input.areaSqFt);
    const costPerSqM = safeDiv(totalEstimatedCost, input.areaSqM);
    let overallStatus = 'LOSS';
    if (input.archivedAt)
        overallStatus = 'ARCHIVED';
    else if (profitMargin >= 30 || roi >= 35)
        overallStatus = 'HIGHLY_PROFITABLE';
    else if (profitMargin >= 12 || roi >= 15)
        overallStatus = 'PROFITABLE';
    else if (Math.abs(netProfit) <= totalEstimatedCost * 0.02)
        overallStatus = 'BREAK_EVEN';
    return {
        totalEstimatedRevenue,
        totalDirectCost,
        totalIndirectCost,
        totalEstimatedCost,
        grossProfit,
        netProfit,
        profitPercentage,
        profitMargin,
        taxAmount,
        contingencyAmount,
        cashRequirement,
        monthlyCost,
        monthlyRevenue,
        breakEvenPoint,
        roi,
        netCashFlow,
        projectedProfit,
        projectedLoss,
        costPerSqFt,
        costPerSqM,
        overallStatus,
    };
}
function calculateFeasibility(input) {
    const buildableArea = input.landArea * input.fsi * input.maxFloors;
    const totalConstruction = input.constructionCost + input.materialCost + input.labourCost + input.machineryCost;
    const totalInvestment = input.landCost +
        totalConstruction +
        input.professionalFees +
        input.marketingCost +
        input.financeCost +
        input.taxes +
        input.contingency;
    const totalRevenue = buildableArea * input.sellingPricePerSqFt;
    const grossProfit = totalRevenue - totalInvestment;
    const netProfit = grossProfit * 0.85;
    const roi = totalInvestment > 0 ? (netProfit / totalInvestment) * 100 : 0;
    const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;
    const costPerSqFt = buildableArea > 0 ? totalInvestment / buildableArea : 0;
    const months = input.constructionMonths || 24;
    const monthlyProfit = netProfit / months;
    const breakEvenMonths = monthlyProfit > 0 ? Math.ceil((totalInvestment * 0.6) / monthlyProfit) : 0;
    const paybackMonths = monthlyProfit > 0 ? Math.ceil(totalInvestment / monthlyProfit) : 0;
    const rate = (input.interestRate || 12) / 100 / 12;
    let npv = -totalInvestment;
    for (let i = 1; i <= months; i++)
        npv += (totalRevenue / months) / Math.pow(1 + rate, i);
    npv -= totalInvestment * rate * months * 0.5;
    const irr = roi * 0.8;
    const investmentScore = Math.min(100, Math.max(0, Math.round(roi * 2 + profitMargin)));
    const riskScore = Math.min(100, Math.max(0, 100 - investmentScore + (input.contingency / totalInvestment) * 50));
    const isRecommended = roi >= 15 && profitMargin >= 20;
    const aiRecommendation = isRecommended
        ? 'RECOMMENDED: This project shows strong financial viability with acceptable ROI and profit margins.'
        : roi >= 10
            ? 'CAUTIOUS: Moderate returns. Consider cost optimization or higher selling prices.'
            : 'NOT RECOMMENDED: Returns below industry benchmarks. Re-evaluate land cost or development plan.';
    const aiSummary = `Investment: PKR ${totalInvestment.toLocaleString()} | Revenue: PKR ${totalRevenue.toLocaleString()} | ROI: ${roi.toFixed(1)}% | Payback: ${paybackMonths} months | Buildable: ${buildableArea.toLocaleString()} sq ft`;
    return {
        buildableArea,
        totalInvestment,
        totalRevenue,
        grossProfit,
        netProfit,
        roi,
        irr,
        npv,
        breakEvenMonths,
        paybackMonths,
        profitMargin,
        costPerSqFt,
        investmentScore,
        riskScore,
        aiRecommendation,
        aiSummary,
        isRecommended,
    };
}
function mapFeasibilityToDb(input, result, landParcelId, title, buildingType) {
    return {
        landParcelId,
        title,
        buildingType,
        landCost: input.landCost,
        landArea: input.landArea,
        fsi: input.fsi,
        maxFloors: input.maxFloors,
        constructionCost: input.constructionCost,
        materialCost: input.materialCost,
        labourCost: input.labourCost,
        machineryCost: input.machineryCost,
        professionalFees: input.professionalFees,
        marketingCost: input.marketingCost,
        financeCost: input.financeCost,
        taxes: input.taxes,
        contingency: input.contingency,
        sellingPricePerSqFt: input.sellingPricePerSqFt,
        totalInvestment: result.totalInvestment,
        totalRevenue: result.totalRevenue,
        grossProfit: result.grossProfit,
        netProfit: result.netProfit,
        roi: result.roi,
        irr: result.irr,
        npv: result.npv,
        breakEvenMonths: result.breakEvenMonths,
        paybackMonths: result.paybackMonths,
        profitMargin: result.profitMargin,
        costPerSqFt: result.costPerSqFt,
        investmentScore: result.investmentScore,
        riskScore: result.riskScore,
        aiRecommendation: result.aiRecommendation,
        aiSummary: result.aiSummary,
        isRecommended: result.isRecommended,
    };
}
function formatFeasibility(study) {
    return { ...study, landCost: (0, auth_1.toNum)(study.landCost), totalInvestment: (0, auth_1.toNum)(study.totalInvestment), roi: (0, auth_1.toNum)(study.roi) };
}
