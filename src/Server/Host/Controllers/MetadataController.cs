using Knm.Enterprise.Application.Common.Interfaces;
using Knm.Enterprise.Domain.Metadata;
using Knm.Enterprise.Shared;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Knm.Enterprise.Host.Controllers;

[ApiController]
[Route("api/system/[controller]")]
public class MetadataController : ControllerBase
{
    private readonly IApplicationDbContext _context;
    private readonly CorrelationContext _correlationContext;
    private readonly ILogger<MetadataController> _logger;

    public MetadataController(
        IApplicationDbContext context,
        CorrelationContext correlationContext,
        ILogger<MetadataController> logger)
    {
        _context = context;
        _correlationContext = correlationContext;
        _logger = logger;
    }

    [HttpGet("modules")]
    public async Task<IActionResult> GetModules()
    {
        var modules = await _context.SystemModules
            .Include(m => m.Sections)
                .ThenInclude(s => s.Screens)
            .OrderBy(m => m.DisplayOrder)
            .AsNoTracking()
            .ToListAsync();

        return Ok(ApiResponse<IEnumerable<SystemModule>>.Ok(modules, _correlationContext.CorrelationId));
    }

    [HttpPost("modules")]
    public async Task<IActionResult> CreateModule([FromBody] CreateModuleDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Code) || string.IsNullOrWhiteSpace(dto.Name))
            return BadRequest(ApiResponse<object>.Fail("VALIDATION_ERROR", "رمز الموديول واسمه مطلوبان", _correlationContext.CorrelationId));

        var module = new SystemModule
        {
            Code = dto.Code.Trim().ToUpperInvariant(),
            Name = dto.Name.Trim(),
            Icon = dto.Icon ?? "Layers",
            Description = dto.Description,
            DisplayOrder = dto.DisplayOrder
        };

        _context.SystemModules.Add(module);
        await _context.SaveChangesAsync();

        return Ok(ApiResponse<SystemModule>.Ok(module, _correlationContext.CorrelationId));
    }

    [HttpPost("sections")]
    public async Task<IActionResult> CreateSection([FromBody] CreateSectionDto dto)
    {
        var module = await _context.SystemModules.FindAsync(dto.ModuleId);
        if (module == null)
            return NotFound(ApiResponse<object>.Fail("NOT_FOUND", "الموديول المحدد غير موجود", _correlationContext.CorrelationId));

        var section = new SystemSection
        {
            ModuleId = dto.ModuleId,
            Code = dto.Code.Trim().ToUpperInvariant(),
            Name = dto.Name.Trim(),
            Icon = dto.Icon,
            DisplayOrder = dto.DisplayOrder
        };

        _context.SystemSections.Add(section);
        await _context.SaveChangesAsync();

        return Ok(ApiResponse<SystemSection>.Ok(section, _correlationContext.CorrelationId));
    }

    [HttpGet("screens/{code}")]
    public async Task<IActionResult> GetScreen(string code)
    {
        var screen = await _context.SystemScreens
            .Include(s => s.Fields.OrderBy(f => f.DisplayOrder))
                .ThenInclude(f => f.Options.OrderBy(o => o.DisplayOrder))
            .Include(s => s.Actions.OrderBy(a => a.DisplayOrder))
            .AsNoTracking()
            .FirstOrDefaultAsync(s => s.Code == code.ToUpperInvariant());

        if (screen == null)
            return NotFound(ApiResponse<object>.Fail("NOT_FOUND", $"الشاشة بالرمز '{code}' غير موجودة", _correlationContext.CorrelationId));

        return Ok(ApiResponse<SystemScreen>.Ok(screen, _correlationContext.CorrelationId));
    }

    [HttpPost("screens")]
    public async Task<IActionResult> CreateScreen([FromBody] CreateScreenDto dto)
    {
        var section = await _context.SystemSections.FindAsync(dto.SectionId);
        if (section == null)
            return NotFound(ApiResponse<object>.Fail("NOT_FOUND", "القسم المحدد غير موجود", _correlationContext.CorrelationId));

        var screen = new SystemScreen
        {
            SectionId = dto.SectionId,
            Code = dto.Code.Trim().ToUpperInvariant(),
            Title = dto.Title.Trim(),
            Icon = dto.Icon ?? "FileText",
            Description = dto.Description,
            RoutePath = $"/dynamic/{dto.Code.Trim().ToLowerInvariant()}",
            DisplayOrder = dto.DisplayOrder,
            Status = ScreenStatus.Draft,
            NumberingDefinitionCode = dto.NumberingDefinitionCode
        };

        _context.SystemScreens.Add(screen);
        await _context.SaveChangesAsync();

        return Ok(ApiResponse<SystemScreen>.Ok(screen, _correlationContext.CorrelationId));
    }

    [HttpPost("screens/{screenId}/fields")]
    public async Task<IActionResult> AddField(Guid screenId, [FromBody] CreateFieldDto dto)
    {
        var screen = await _context.SystemScreens.FindAsync(screenId);
        if (screen == null)
            return NotFound(ApiResponse<object>.Fail("NOT_FOUND", "الشاشة المحددة غير موجودة", _correlationContext.CorrelationId));

        var field = new SystemField
        {
            ScreenId = screenId,
            FieldName = dto.FieldName.Trim(),
            Label = dto.Label.Trim(),
            FieldType = dto.FieldType ?? "Text",
            DisplayOrder = dto.DisplayOrder,
            IsRequired = dto.IsRequired,
            IsReadonly = dto.IsReadonly,
            Placeholder = dto.Placeholder,
            ReferenceListCode = dto.ReferenceListCode
        };

        if (dto.Options != null && dto.Options.Count > 0)
        {
            int optOrder = 1;
            foreach (var opt in dto.Options)
            {
                field.Options.Add(new SystemFieldOption
                {
                    Value = opt.Value,
                    Label = opt.Label,
                    DisplayOrder = optOrder++
                });
            }
        }

        _context.SystemFields.Add(field);
        await _context.SaveChangesAsync();

        return Ok(ApiResponse<SystemField>.Ok(field, _correlationContext.CorrelationId));
    }

    [HttpPost("screens/{screenId}/actions")]
    public async Task<IActionResult> AddAction(Guid screenId, [FromBody] CreateActionDto dto)
    {
        var screen = await _context.SystemScreens.FindAsync(screenId);
        if (screen == null)
            return NotFound(ApiResponse<object>.Fail("NOT_FOUND", "الشاشة المحددة غير موجودة", _correlationContext.CorrelationId));

        var action = new SystemAction
        {
            ScreenId = screenId,
            ActionType = dto.ActionType,
            Label = dto.Label,
            Icon = dto.Icon,
            PermissionCode = dto.PermissionCode ?? $"{screen.Code}.{dto.ActionType.ToUpperInvariant()}",
            IsEnabled = dto.IsEnabled,
            DisplayOrder = dto.DisplayOrder
        };

        _context.SystemActions.Add(action);
        await _context.SaveChangesAsync();

        return Ok(ApiResponse<SystemAction>.Ok(action, _correlationContext.CorrelationId));
    }

    [HttpPost("screens/{screenId}/publish")]
    public async Task<IActionResult> PublishScreen(Guid screenId)
    {
        var screen = await _context.SystemScreens
            .Include(s => s.Fields)
            .Include(s => s.Actions)
            .FirstOrDefaultAsync(s => s.Id == screenId);

        if (screen == null)
            return NotFound(ApiResponse<object>.Fail("NOT_FOUND", "الشاشة المحددة غير موجودة", _correlationContext.CorrelationId));

        if (!screen.Fields.Any())
            return BadRequest(ApiResponse<object>.Fail("VALIDATION_ERROR", "لا يمكن نشر شاشة لا تحتوي على حقول على الأقل", _correlationContext.CorrelationId));

        screen.Status = ScreenStatus.Published;
        await _context.SaveChangesAsync();

        _logger.LogInformation("Screen {ScreenCode} has been PUBLISHED successfully by system admin.", screen.Code);

        return Ok(ApiResponse<string>.Ok($"تم نشر الشاشة '{screen.Title}' بنجاح وتفعيل ظهورها في النظام.", _correlationContext.CorrelationId));
    }

    [HttpGet("menus")]
    public async Task<IActionResult> GetDynamicMenus()
    {
        var modules = await _context.SystemModules
            .Include(m => m.Sections)
                .ThenInclude(s => s.Screens.Where(sc => sc.Status == ScreenStatus.Published && sc.ShowInMenu))
            .OrderBy(m => m.DisplayOrder)
            .AsNoTracking()
            .ToListAsync();

        return Ok(ApiResponse<IEnumerable<SystemModule>>.Ok(modules, _correlationContext.CorrelationId));
    }
}

public class CreateModuleDto
{
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? Icon { get; set; }
    public string? Description { get; set; }
    public int DisplayOrder { get; set; }
}

public class CreateSectionDto
{
    public Guid ModuleId { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? Icon { get; set; }
    public int DisplayOrder { get; set; }
}

public class CreateScreenDto
{
    public Guid SectionId { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string? Icon { get; set; }
    public string? Description { get; set; }
    public int DisplayOrder { get; set; }
    public string? NumberingDefinitionCode { get; set; }
}

public class CreateFieldDto
{
    public string FieldName { get; set; } = string.Empty;
    public string Label { get; set; } = string.Empty;
    public string? FieldType { get; set; }
    public int DisplayOrder { get; set; }
    public bool IsRequired { get; set; }
    public bool IsReadonly { get; set; }
    public string? Placeholder { get; set; }
    public string? ReferenceListCode { get; set; }
    public List<CreateFieldOptionDto>? Options { get; set; }
}

public class CreateFieldOptionDto
{
    public string Value { get; set; } = string.Empty;
    public string Label { get; set; } = string.Empty;
}

public class CreateActionDto
{
    public string ActionType { get; set; } = "View";
    public string Label { get; set; } = string.Empty;
    public string? Icon { get; set; }
    public string? PermissionCode { get; set; }
    public bool IsEnabled { get; set; } = true;
    public int DisplayOrder { get; set; }
}
