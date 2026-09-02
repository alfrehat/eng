using Knm.Enterprise.Domain.Audit;
using Knm.Enterprise.Domain.Configuration;
using Knm.Enterprise.Domain.DynamicData;
using Knm.Enterprise.Domain.GIS;
using Knm.Enterprise.Domain.Identity;
using Knm.Enterprise.Domain.Metadata;
using Knm.Enterprise.Domain.Numbering;
using Knm.Enterprise.Domain.Organization;
using Knm.Enterprise.Domain.Projects;
using Knm.Enterprise.Domain.ReferenceData;
using Knm.Enterprise.Domain.Storage;
using Knm.Enterprise.Domain.Workflow;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;

namespace Knm.Enterprise.Application.Common.Interfaces;

public interface IApplicationDbContext
{
    DbSet<User> Users { get; }
    DbSet<Role> Roles { get; }
    DbSet<Permission> Permissions { get; }
    DbSet<UserRole> UserRoles { get; }
    DbSet<RolePermission> RolePermissions { get; }
    DbSet<AuditLog> AuditLogs { get; }
    DbSet<SystemSetting> SystemSettings { get; }
    DbSet<StoredFile> StoredFiles { get; }
    DbSet<SpatialFeature> SpatialFeatures { get; }

    // Phase 02 Zero-Code Entities
    DbSet<SystemModule> SystemModules { get; }
    DbSet<SystemSection> SystemSections { get; }
    DbSet<SystemScreen> SystemScreens { get; }
    DbSet<SystemField> SystemFields { get; }
    DbSet<SystemFieldOption> SystemFieldOptions { get; }
    DbSet<SystemAction> SystemActions { get; }
    DbSet<DynamicRecord> DynamicRecords { get; }
    DbSet<OrganizationUnit> OrganizationUnits { get; }
    DbSet<ReferenceList> ReferenceLists { get; }
    DbSet<ReferenceItem> ReferenceItems { get; }
    DbSet<NumberingDefinition> NumberingDefinitions { get; }
    DbSet<WorkflowDefinition> WorkflowDefinitions { get; }
    DbSet<WorkflowState> WorkflowStates { get; }
    DbSet<WorkflowTransition> WorkflowTransitions { get; }

    // Phase 03 Projects & Planning Entities
    DbSet<Project> Projects { get; }
    DbSet<ProjectMilestone> ProjectMilestones { get; }
    DbSet<Portfolio> Portfolios { get; }
    DbSet<PortfolioItem> PortfolioItems { get; }
    DbSet<PriorityModel> PriorityModels { get; }
    DbSet<PriorityCriterion> PriorityCriteria { get; }
    DbSet<ProjectPriorityScore> ProjectPriorityScores { get; }
    DbSet<FinancialProgram> FinancialPrograms { get; }
    DbSet<BudgetChapter> BudgetChapters { get; }
    DbSet<BudgetItem> BudgetItems { get; }
    DbSet<FundingSource> FundingSources { get; }
    DbSet<ProjectAllocation> ProjectAllocations { get; }
    DbSet<ProjectExpenditure> ProjectExpenditures { get; }
    DbSet<ProjectDependency> ProjectDependencies { get; }
    DbSet<ProjectSchedule> ProjectSchedules { get; }
    DbSet<ScheduleActivity> ScheduleActivities { get; }
    DbSet<ActivityDependency> ActivityDependencies { get; }

    // Phase 04 Tenders Entities
    DbSet<Knm.Enterprise.Domain.Tenders.Tender> Tenders { get; }
    DbSet<Knm.Enterprise.Domain.Tenders.TenderDocument> TenderDocuments { get; }
    DbSet<Knm.Enterprise.Domain.Tenders.TenderDocumentRequirement> TenderDocumentRequirements { get; }
    DbSet<Knm.Enterprise.Domain.Tenders.TenderBoq> TenderBoqs { get; }
    DbSet<Knm.Enterprise.Domain.Tenders.TenderBoqItem> TenderBoqItems { get; }
    DbSet<Knm.Enterprise.Domain.Tenders.Bidder> Bidders { get; }
    DbSet<Knm.Enterprise.Domain.Tenders.Bid> Bids { get; }
    DbSet<Knm.Enterprise.Domain.Tenders.BidItem> BidItems { get; }
    DbSet<Knm.Enterprise.Domain.Tenders.BidGuarantee> BidGuarantees { get; }
    DbSet<Knm.Enterprise.Domain.Tenders.TenderOpening> TenderOpenings { get; }
    DbSet<Knm.Enterprise.Domain.Tenders.TenderOpeningEntry> TenderOpeningEntries { get; }
    DbSet<Knm.Enterprise.Domain.Tenders.EvaluationCommittee> EvaluationCommittees { get; }
    DbSet<Knm.Enterprise.Domain.Tenders.EvaluationMember> EvaluationMembers { get; }
    DbSet<Knm.Enterprise.Domain.Tenders.EvaluationCriteria> EvaluationCriteriaList { get; }
    DbSet<Knm.Enterprise.Domain.Tenders.EvaluationResult> EvaluationResults { get; }
    DbSet<Knm.Enterprise.Domain.Tenders.AwardRecommendation> AwardRecommendations { get; }
    DbSet<Knm.Enterprise.Domain.Tenders.AwardDecision> AwardDecisions { get; }

    // Phase 05 Contracts Entities
    DbSet<Knm.Enterprise.Domain.Contracts.Contract> Contracts { get; }
    DbSet<Knm.Enterprise.Domain.Contracts.ContractParty> ContractParties { get; }
    DbSet<Knm.Enterprise.Domain.Contracts.ContractPartyRole> ContractPartyRoles { get; }
    DbSet<Knm.Enterprise.Domain.Contracts.ContractTemplate> ContractTemplates { get; }
    DbSet<Knm.Enterprise.Domain.Contracts.ContractClause> ContractClauses { get; }
    DbSet<Knm.Enterprise.Domain.Contracts.ContractTemplateClause> ContractTemplateClauses { get; }
    DbSet<Knm.Enterprise.Domain.Contracts.ContractBoq> ContractBoqs { get; }
    DbSet<Knm.Enterprise.Domain.Contracts.ContractItem> ContractItems { get; }
    DbSet<Knm.Enterprise.Domain.Contracts.ContractGuarantee> ContractGuarantees { get; }
    DbSet<Knm.Enterprise.Domain.Contracts.ContractExtension> ContractExtensions { get; }
    DbSet<Knm.Enterprise.Domain.Contracts.ContractVariation> ContractVariations { get; }
    DbSet<Knm.Enterprise.Domain.Contracts.ContractMilestone> ContractMilestones { get; }
    DbSet<Knm.Enterprise.Domain.Contracts.ContractNotice> ContractNotices { get; }
    DbSet<Knm.Enterprise.Domain.Contracts.ContractSignature> ContractSignatures { get; }
    DbSet<Knm.Enterprise.Domain.Contracts.ContractPaymentLink> ContractPaymentLinks { get; }

    DatabaseFacade Database { get; }

    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}
