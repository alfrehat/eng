/**
 * utils/localState.js
 * الذاكرة المؤقتة التخزينية الموحدة (In-Memory Fallback State)
 * نظام إدارة الأشغال والخدمات الهندسية - بلدية كفرنجة الجديدة
 */

const localContracts = [];
const localContractClauses = [];
const localBankGuarantees = [];
const localVariationOrders = [];
const localStructuralAssets = [];
const localInfrastructureNetworks = [];
const localEnergyAssets = [];
const localExcavationPermits = [];

module.exports = {
  localContracts,
  localContractClauses,
  localBankGuarantees,
  localVariationOrders,
  localStructuralAssets,
  localInfrastructureNetworks,
  localEnergyAssets,
  localExcavationPermits
};
