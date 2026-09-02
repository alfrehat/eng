/**
 * Contracts/Pages/unifiedContractManagementManager.js
 * مهايئ التوافق الموحد لوحدة إدارة العقود والضمانات البنكية (ECMS v5.0)
 */

(function () {
  'use strict';

  window.initContractManagementUI = function () {
    const el = document.getElementById('page-contracts');
    if (el && window.contractsManager) {
      window.contractsManager.init(el);
    }
  };

  window.fetchContractsData = function () {
    if (window.contractsManager) {
      window.contractsManager._fetchContracts();
    }
  };

  window.exportContractsExcel = function () {
    if (window.contractsManager) {
      window.contractsManager._exportCSV();
    }
  };

  window.printContractsReport = function () {
    if (window.contractsManager) {
      window.contractsManager._printRegistryReport();
    }
  };

  window.openNewContractWizard = function () {
    if (window.contractsManager) {
      window.contractsManager._openModal();
    }
  };
})();
