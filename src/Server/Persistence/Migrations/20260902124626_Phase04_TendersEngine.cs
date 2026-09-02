using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Knm.Enterprise.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class Phase04_TendersEngine : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "bidders",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    CommercialRegisterNumber = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    ContactPerson = table.Column<string>(type: "text", nullable: true),
                    Phone = table.Column<string>(type: "text", nullable: true),
                    Email = table.Column<string>(type: "text", nullable: true),
                    Address = table.Column<string>(type: "text", nullable: true),
                    ClassificationGrade = table.Column<string>(type: "text", nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    Version = table.Column<long>(type: "bigint", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DeletedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_bidders", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "tender_document_requirements",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenderTypeCode = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    DocumentTypeCode = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    Title = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Description = table.Column<string>(type: "text", nullable: true),
                    IsMandatory = table.Column<bool>(type: "boolean", nullable: false),
                    DisplayOrder = table.Column<int>(type: "integer", nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    Version = table.Column<long>(type: "bigint", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DeletedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_tender_document_requirements", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "tenders",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenderNumber = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    Title = table.Column<string>(type: "character varying(250)", maxLength: 250, nullable: false),
                    Description = table.Column<string>(type: "text", nullable: true),
                    ProjectId = table.Column<Guid>(type: "uuid", nullable: false),
                    TenderTypeCode = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    TenderMethodCode = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    CategoryCode = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    OrganizationUnitId = table.Column<Guid>(type: "uuid", nullable: true),
                    ResponsibleEngineer = table.Column<string>(type: "text", nullable: true),
                    EstimatedValue = table.Column<decimal>(type: "numeric(18,3)", precision: 18, scale: 3, nullable: false),
                    Currency = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    FinancialProgramId = table.Column<Guid>(type: "uuid", nullable: true),
                    BudgetItemId = table.Column<Guid>(type: "uuid", nullable: true),
                    FundingSourceId = table.Column<Guid>(type: "uuid", nullable: true),
                    PublicationDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ClosingDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    OpeningDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    Notes = table.Column<string>(type: "text", nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    Version = table.Column<long>(type: "bigint", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DeletedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_tenders", x => x.Id);
                    table.ForeignKey(
                        name: "FK_tenders_organization_units_OrganizationUnitId",
                        column: x => x.OrganizationUnitId,
                        principalTable: "organization_units",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_tenders_projects_ProjectId",
                        column: x => x.ProjectId,
                        principalTable: "projects",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "bids",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenderId = table.Column<Guid>(type: "uuid", nullable: false),
                    BidderId = table.Column<Guid>(type: "uuid", nullable: false),
                    SubmissionDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    OfferedAmount = table.Column<decimal>(type: "numeric(18,3)", precision: 18, scale: 3, nullable: false),
                    Status = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    Notes = table.Column<string>(type: "text", nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    Version = table.Column<long>(type: "bigint", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DeletedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_bids", x => x.Id);
                    table.ForeignKey(
                        name: "FK_bids_bidders_BidderId",
                        column: x => x.BidderId,
                        principalTable: "bidders",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_bids_tenders_TenderId",
                        column: x => x.TenderId,
                        principalTable: "tenders",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "evaluation_committees",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenderId = table.Column<Guid>(type: "uuid", nullable: false),
                    CommitteeName = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    FormationDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    HeadOfCommittee = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    Version = table.Column<long>(type: "bigint", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DeletedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_evaluation_committees", x => x.Id);
                    table.ForeignKey(
                        name: "FK_evaluation_committees_tenders_TenderId",
                        column: x => x.TenderId,
                        principalTable: "tenders",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "tender_boqs",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenderId = table.Column<Guid>(type: "uuid", nullable: false),
                    Title = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    SubTotal = table.Column<decimal>(type: "numeric(18,3)", precision: 18, scale: 3, nullable: false),
                    TaxRatePercent = table.Column<decimal>(type: "numeric(5,2)", precision: 5, scale: 2, nullable: false),
                    TaxAmount = table.Column<decimal>(type: "numeric(18,3)", precision: 18, scale: 3, nullable: false),
                    GrandTotal = table.Column<decimal>(type: "numeric(18,3)", precision: 18, scale: 3, nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    Version = table.Column<long>(type: "bigint", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DeletedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_tender_boqs", x => x.Id);
                    table.ForeignKey(
                        name: "FK_tender_boqs_tenders_TenderId",
                        column: x => x.TenderId,
                        principalTable: "tenders",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "tender_documents",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenderId = table.Column<Guid>(type: "uuid", nullable: false),
                    StoredFileId = table.Column<Guid>(type: "uuid", nullable: true),
                    DocumentTypeCode = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    Title = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Description = table.Column<string>(type: "text", nullable: true),
                    DocumentVersion = table.Column<string>(type: "text", nullable: false),
                    IsMandatory = table.Column<bool>(type: "boolean", nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    Version = table.Column<long>(type: "bigint", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DeletedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_tender_documents", x => x.Id);
                    table.ForeignKey(
                        name: "FK_tender_documents_stored_files_StoredFileId",
                        column: x => x.StoredFileId,
                        principalTable: "stored_files",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_tender_documents_tenders_TenderId",
                        column: x => x.TenderId,
                        principalTable: "tenders",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "tender_openings",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenderId = table.Column<Guid>(type: "uuid", nullable: false),
                    OpeningDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ConductedBy = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    Notes = table.Column<string>(type: "text", nullable: true),
                    IsLocked = table.Column<bool>(type: "boolean", nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    Version = table.Column<long>(type: "bigint", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DeletedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_tender_openings", x => x.Id);
                    table.ForeignKey(
                        name: "FK_tender_openings_tenders_TenderId",
                        column: x => x.TenderId,
                        principalTable: "tenders",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "award_recommendations",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenderId = table.Column<Guid>(type: "uuid", nullable: false),
                    SelectedBidId = table.Column<Guid>(type: "uuid", nullable: false),
                    RecommendedAmount = table.Column<decimal>(type: "numeric(18,3)", precision: 18, scale: 3, nullable: false),
                    RecommendationDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Justification = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    Status = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    Version = table.Column<long>(type: "bigint", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DeletedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_award_recommendations", x => x.Id);
                    table.ForeignKey(
                        name: "FK_award_recommendations_bids_SelectedBidId",
                        column: x => x.SelectedBidId,
                        principalTable: "bids",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_award_recommendations_tenders_TenderId",
                        column: x => x.TenderId,
                        principalTable: "tenders",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "bid_guarantees",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    BidId = table.Column<Guid>(type: "uuid", nullable: false),
                    GuaranteeTypeCode = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    GuaranteeNumber = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    BankName = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    Amount = table.Column<decimal>(type: "numeric(18,3)", precision: 18, scale: 3, nullable: false),
                    Currency = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    IssueDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ExpiryDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Status = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    Version = table.Column<long>(type: "bigint", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DeletedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_bid_guarantees", x => x.Id);
                    table.ForeignKey(
                        name: "FK_bid_guarantees_bids_BidId",
                        column: x => x.BidId,
                        principalTable: "bids",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "evaluation_criteria",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    EvaluationCommitteeId = table.Column<Guid>(type: "uuid", nullable: false),
                    CriterionName = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    MaxScore = table.Column<decimal>(type: "numeric(5,2)", precision: 5, scale: 2, nullable: false),
                    WeightPercentage = table.Column<decimal>(type: "numeric(5,2)", precision: 5, scale: 2, nullable: false),
                    DisplayOrder = table.Column<int>(type: "integer", nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    Version = table.Column<long>(type: "bigint", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DeletedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_evaluation_criteria", x => x.Id);
                    table.ForeignKey(
                        name: "FK_evaluation_criteria_evaluation_committees_EvaluationCommitt~",
                        column: x => x.EvaluationCommitteeId,
                        principalTable: "evaluation_committees",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "evaluation_members",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    EvaluationCommitteeId = table.Column<Guid>(type: "uuid", nullable: false),
                    FullName = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    RoleOrTitle = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    Version = table.Column<long>(type: "bigint", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DeletedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_evaluation_members", x => x.Id);
                    table.ForeignKey(
                        name: "FK_evaluation_members_evaluation_committees_EvaluationCommitte~",
                        column: x => x.EvaluationCommitteeId,
                        principalTable: "evaluation_committees",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "tender_boq_items",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenderBoqId = table.Column<Guid>(type: "uuid", nullable: false),
                    ItemNumber = table.Column<int>(type: "integer", nullable: false),
                    Description = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    Unit = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    Quantity = table.Column<decimal>(type: "numeric(18,3)", precision: 18, scale: 3, nullable: false),
                    EstimatedUnitPrice = table.Column<decimal>(type: "numeric(18,3)", precision: 18, scale: 3, nullable: false),
                    EstimatedTotal = table.Column<decimal>(type: "numeric(18,3)", precision: 18, scale: 3, nullable: false),
                    Notes = table.Column<string>(type: "text", nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    Version = table.Column<long>(type: "bigint", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DeletedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_tender_boq_items", x => x.Id);
                    table.ForeignKey(
                        name: "FK_tender_boq_items_tender_boqs_TenderBoqId",
                        column: x => x.TenderBoqId,
                        principalTable: "tender_boqs",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "tender_opening_entries",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenderOpeningId = table.Column<Guid>(type: "uuid", nullable: false),
                    BidId = table.Column<Guid>(type: "uuid", nullable: false),
                    ReadOutAmount = table.Column<decimal>(type: "numeric(18,3)", precision: 18, scale: 3, nullable: false),
                    GuaranteeReceived = table.Column<bool>(type: "boolean", nullable: false),
                    ChecklistPassed = table.Column<bool>(type: "boolean", nullable: false),
                    Remarks = table.Column<string>(type: "text", nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    Version = table.Column<long>(type: "bigint", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DeletedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_tender_opening_entries", x => x.Id);
                    table.ForeignKey(
                        name: "FK_tender_opening_entries_bids_BidId",
                        column: x => x.BidId,
                        principalTable: "bids",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_tender_opening_entries_tender_openings_TenderOpeningId",
                        column: x => x.TenderOpeningId,
                        principalTable: "tender_openings",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "award_decisions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenderId = table.Column<Guid>(type: "uuid", nullable: false),
                    AwardRecommendationId = table.Column<Guid>(type: "uuid", nullable: false),
                    CouncilDecisionNumber = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    DecisionDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    DecisionStatus = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    FinalAwardedAmount = table.Column<decimal>(type: "numeric(18,3)", precision: 18, scale: 3, nullable: false),
                    Notes = table.Column<string>(type: "text", nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    Version = table.Column<long>(type: "bigint", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DeletedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_award_decisions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_award_decisions_award_recommendations_AwardRecommendationId",
                        column: x => x.AwardRecommendationId,
                        principalTable: "award_recommendations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_award_decisions_tenders_TenderId",
                        column: x => x.TenderId,
                        principalTable: "tenders",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "evaluation_results",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    EvaluationCriteriaId = table.Column<Guid>(type: "uuid", nullable: false),
                    BidId = table.Column<Guid>(type: "uuid", nullable: false),
                    ScoreGiven = table.Column<decimal>(type: "numeric(5,2)", precision: 5, scale: 2, nullable: false),
                    EvaluatorNotes = table.Column<string>(type: "text", nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    Version = table.Column<long>(type: "bigint", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DeletedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_evaluation_results", x => x.Id);
                    table.ForeignKey(
                        name: "FK_evaluation_results_bids_BidId",
                        column: x => x.BidId,
                        principalTable: "bids",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_evaluation_results_evaluation_criteria_EvaluationCriteriaId",
                        column: x => x.EvaluationCriteriaId,
                        principalTable: "evaluation_criteria",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "bid_items",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    BidId = table.Column<Guid>(type: "uuid", nullable: false),
                    TenderBoqItemId = table.Column<Guid>(type: "uuid", nullable: false),
                    OfferedUnitPrice = table.Column<decimal>(type: "numeric(18,3)", precision: 18, scale: 3, nullable: false),
                    OfferedTotal = table.Column<decimal>(type: "numeric(18,3)", precision: 18, scale: 3, nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    Version = table.Column<long>(type: "bigint", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DeletedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_bid_items", x => x.Id);
                    table.ForeignKey(
                        name: "FK_bid_items_bids_BidId",
                        column: x => x.BidId,
                        principalTable: "bids",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_bid_items_tender_boq_items_TenderBoqItemId",
                        column: x => x.TenderBoqItemId,
                        principalTable: "tender_boq_items",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_award_decisions_AwardRecommendationId",
                table: "award_decisions",
                column: "AwardRecommendationId");

            migrationBuilder.CreateIndex(
                name: "IX_award_decisions_TenderId",
                table: "award_decisions",
                column: "TenderId");

            migrationBuilder.CreateIndex(
                name: "IX_award_recommendations_SelectedBidId",
                table: "award_recommendations",
                column: "SelectedBidId");

            migrationBuilder.CreateIndex(
                name: "IX_award_recommendations_TenderId",
                table: "award_recommendations",
                column: "TenderId");

            migrationBuilder.CreateIndex(
                name: "IX_bid_guarantees_BidId",
                table: "bid_guarantees",
                column: "BidId");

            migrationBuilder.CreateIndex(
                name: "IX_bid_guarantees_GuaranteeNumber",
                table: "bid_guarantees",
                column: "GuaranteeNumber");

            migrationBuilder.CreateIndex(
                name: "IX_bid_items_BidId",
                table: "bid_items",
                column: "BidId");

            migrationBuilder.CreateIndex(
                name: "IX_bid_items_TenderBoqItemId",
                table: "bid_items",
                column: "TenderBoqItemId");

            migrationBuilder.CreateIndex(
                name: "IX_bidders_CommercialRegisterNumber",
                table: "bidders",
                column: "CommercialRegisterNumber",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_bids_BidderId",
                table: "bids",
                column: "BidderId");

            migrationBuilder.CreateIndex(
                name: "IX_bids_TenderId_BidderId",
                table: "bids",
                columns: new[] { "TenderId", "BidderId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_evaluation_committees_TenderId",
                table: "evaluation_committees",
                column: "TenderId");

            migrationBuilder.CreateIndex(
                name: "IX_evaluation_criteria_EvaluationCommitteeId",
                table: "evaluation_criteria",
                column: "EvaluationCommitteeId");

            migrationBuilder.CreateIndex(
                name: "IX_evaluation_members_EvaluationCommitteeId",
                table: "evaluation_members",
                column: "EvaluationCommitteeId");

            migrationBuilder.CreateIndex(
                name: "IX_evaluation_results_BidId",
                table: "evaluation_results",
                column: "BidId");

            migrationBuilder.CreateIndex(
                name: "IX_evaluation_results_EvaluationCriteriaId_BidId",
                table: "evaluation_results",
                columns: new[] { "EvaluationCriteriaId", "BidId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_tender_boq_items_TenderBoqId_ItemNumber",
                table: "tender_boq_items",
                columns: new[] { "TenderBoqId", "ItemNumber" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_tender_boqs_TenderId",
                table: "tender_boqs",
                column: "TenderId");

            migrationBuilder.CreateIndex(
                name: "IX_tender_document_requirements_TenderTypeCode_DocumentTypeCode",
                table: "tender_document_requirements",
                columns: new[] { "TenderTypeCode", "DocumentTypeCode" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_tender_documents_StoredFileId",
                table: "tender_documents",
                column: "StoredFileId");

            migrationBuilder.CreateIndex(
                name: "IX_tender_documents_TenderId",
                table: "tender_documents",
                column: "TenderId");

            migrationBuilder.CreateIndex(
                name: "IX_tender_opening_entries_BidId",
                table: "tender_opening_entries",
                column: "BidId");

            migrationBuilder.CreateIndex(
                name: "IX_tender_opening_entries_TenderOpeningId",
                table: "tender_opening_entries",
                column: "TenderOpeningId");

            migrationBuilder.CreateIndex(
                name: "IX_tender_openings_TenderId",
                table: "tender_openings",
                column: "TenderId");

            migrationBuilder.CreateIndex(
                name: "IX_tenders_OrganizationUnitId",
                table: "tenders",
                column: "OrganizationUnitId");

            migrationBuilder.CreateIndex(
                name: "IX_tenders_ProjectId",
                table: "tenders",
                column: "ProjectId");

            migrationBuilder.CreateIndex(
                name: "IX_tenders_Status",
                table: "tenders",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_tenders_TenderNumber",
                table: "tenders",
                column: "TenderNumber",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "award_decisions");

            migrationBuilder.DropTable(
                name: "bid_guarantees");

            migrationBuilder.DropTable(
                name: "bid_items");

            migrationBuilder.DropTable(
                name: "evaluation_members");

            migrationBuilder.DropTable(
                name: "evaluation_results");

            migrationBuilder.DropTable(
                name: "tender_document_requirements");

            migrationBuilder.DropTable(
                name: "tender_documents");

            migrationBuilder.DropTable(
                name: "tender_opening_entries");

            migrationBuilder.DropTable(
                name: "award_recommendations");

            migrationBuilder.DropTable(
                name: "tender_boq_items");

            migrationBuilder.DropTable(
                name: "evaluation_criteria");

            migrationBuilder.DropTable(
                name: "tender_openings");

            migrationBuilder.DropTable(
                name: "bids");

            migrationBuilder.DropTable(
                name: "tender_boqs");

            migrationBuilder.DropTable(
                name: "evaluation_committees");

            migrationBuilder.DropTable(
                name: "bidders");

            migrationBuilder.DropTable(
                name: "tenders");
        }
    }
}
