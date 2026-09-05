# RetailOps V2.1 - Technical Specification for ASP.NET Core Migration

**Version:** 2.1.0  
**Date:** September 3, 2026  
**Target Framework:** .NET 8 / ASP.NET Core 8  
**Architecture:** Clean Architecture + Vertical Slice

---

## 1. Architecture Overview

### 1.1 Current Stack (Node.js)
```
Frontend:     Next.js 16 + React 19 + Tailwind v4 + TanStack Query
Backend:      Express 5 + Socket.IO + Bull Queues (Redis) + SQL Server
Real-time:    Socket.IO (in-memory adapter)
Auth:         JWT + In-Memory Token Blacklist
Cache:        In-Memory Map
Jobs:         node-cron (scheduler)
```

### 1.2 Target Stack (ASP.NET Core)
```
Frontend:     Next.js 16 (unchanged) → API calls to ASP.NET Core
Backend:      ASP.NET Core 8 Web API
Real-time:    SignalR (Redis backplane for scale)
Auth:         JWT + Redis Token Blacklist + ASP.NET Core Identity
Cache:        IDistributedCache (Redis)
Jobs:         Hangfire (Redis/SQL) + BackgroundService
ORM:          Entity Framework Core 8 (SQL Server)
DI:           Built-in Microsoft.Extensions.DependencyInjection
```

### 1.3 Project Structure (Clean Architecture)

```
RetailOps.sln
├── src/
│   ├── RetailOps.Api/                    # ASP.NET Core Web API
│   │   ├── Controllers/
│   │   ├── Hubs/                         # SignalR Hubs
│   │   ├── Middleware/
│   │   ├── Filters/
│   │   ├── Program.cs
│   │   └── RetailOps.Api.csproj
│   │
│   ├── RetailOps.Application/            # Use Cases / CQRS
│   │   ├── Commands/
│   │   ├── Queries/
│   │   ├── DTOs/
│   │   ├── Interfaces/
│   │   ├── Services/
│   │   ├── Validators/
│   │   └── RetailOps.Application.csproj
│   │
│   ├── RetailOps.Domain/                 # Enterprise Business Logic
│   │   ├── Entities/
│   │   ├── ValueObjects/
│   │   ├── Events/
│   │   ├── Services/
│   │   ├── Specifications/
│   │   ├── Exceptions/
│   │   └── RetailOps.Domain.csproj
│   │
│   ├── RetailOps.Infrastructure/         # External Concerns
│   │   ├── Persistence/
│   │   │   ├── Configurations/           # EF Core Fluent API
│   │   │   ├── Migrations/
│   │   │   ├── Repositories/
│   │   │   └── RetailOpsDbContext.cs
│   │   ├── Services/
│   │   │   ├── EmailService.cs
│   │   │   ├── OctoparseService.cs
│   │   │   ├── KeepaService.cs
│   │   │   ├── AmazonPAAPIService.cs
│   │   │   ├── CometChatService.cs
│   │   │   ├── CacheService.cs
│   │   │   ├── TokenBlacklistService.cs
│   │   │   └── HangfireJobService.cs
│   │   ├── Identity/
│   │   └── RetailOps.Infrastructure.csproj
│   │
│   └── RetailOps.Shared/                 # Shared Kernel
│       ├── Constants/
│       ├── Enums/
│       ├── Extensions/
│       └── RetailOps.Shared.csproj
│
├── tests/
│   ├── RetailOps.UnitTests/
│   ├── RetailOps.IntegrationTests/
│   └── RetailOps.ArchitectureTests/
│
├── docker-compose.yml
├── Directory.Build.props
├── global.json
└── README.md
```

---

## 2. Domain Model (EF Core Entities)

### 2.1 Core Entities

```csharp
// RetailOps.Domain/Entities/Seller.cs
public class Seller : BaseEntity, IAggregateRoot
{
    public string Name { get; private set; }
    public string Email { get; private set; }
    public string Phone { get; private set; }
    public Marketplace Marketplace { get; private set; }
    public string OctoparseId { get; private set; }
    public string OctoparseMarketplace { get; private set; }
    public bool IsActive { get; private set; }
    public DateTime? LastScrapedAt { get; private set; }
    public string CometChatUid { get; private set; }
    
    // Navigation
    public ICollection<Asin> Asins { get; private set; } = new List<Asin>();
    public ICollection<UserSeller> UserSellers { get; private set; } = new List<UserSeller>();
    public ICollection<ScheduledRunDetail> ScheduledRunDetails { get; private set; }
    
    // Domain Methods
    public void UpdateOctoparseConfig(string octoparseId, string marketplace) { ... }
    public void MarkScraped() { LastScrapedAt = DateTime.UtcNow; }
    public void Activate() { IsActive = true; }
    public void Deactivate() { IsActive = false; }
}

// RetailOps.Domain/Entities/Asin.cs
public class Asin : BaseEntity, IAggregateRoot
{
    public string SellerId { get; private set; }
    public string AsinCode { get; private set; }
    public string Title { get; private set; }
    public string Description { get; private set; }
    public decimal Price { get; private set; }
    public decimal Mrp { get; private set; }
    public int Bsr { get; private set; }
    public int SubBsr { get; private set; }
    public decimal Rating { get; private set; }
    public int ReviewCount { get; private set; }
    public bool IsBuyBoxWinner { get; private set; }
    public string Availability { get; private set; }
    public string Category { get; private set; }
    public int ImagesCount { get; private set; }
    public string MainImageUrl { get; private set; }
    public int BulletPointCount { get; private set; }
    public int TitleLength { get; private set; }
    
    // LQS Scores
    public decimal LqsScore { get; private set; }
    public string LqsGrade { get; private set; }
    public decimal LqsTitle { get; private set; }
    public decimal LqsBullets { get; private set; }
    public decimal LqsImages { get; private set; }
    public string LqsIssues { get; private set; }
    public string LqsSource { get; private set; }
    
    // Status
    public AsinStatus Status { get; private set; }
    public DateTime? LastSyncedAt { get; private set; }
    
    // Navigation
    public Seller Seller { get; private set; }
    public ICollection<AsinWeekHistory> WeekHistory { get; private set; }
    public ICollection<AsinHistory> History { get; private set; }
    public ICollection<CalculatorAsin> CalculatorAsins { get; private set; }
    
    // Domain Methods
    public void UpdateMarketData(MarketDataDto data) { ... }
    public void CalculateLQS(ILQSService lqsService) { ... }
    public void UpdateStatus(AsinStatus status) { Status = status; }
}

// RetailOps.Domain/Entities/User.cs
public class User : BaseEntity, IAggregateRoot
{
    public string Email { get; private set; }
    public string FirstName { get; private set; }
    public string LastName { get; private set; }
    public string PasswordHash { get; private set; }
    public string RefreshToken { get; private set; }
    public DateTime RefreshTokenExpiry { get; private set; }
    public bool IsActive { get; private set; }
    public bool IsOnline { get; private set; }
    public DateTime LastSeen { get; private set; }
    public string Avatar { get; private set; }
    public string RoleId { get; private set; }
    public string CometChatUid { get; private set; }
    
    // Navigation
    public Role Role { get; private set; }
    public ICollection<UserSeller> UserSellers { get; private set; }
    public ICollection<RefreshToken> RefreshTokens { get; private set; }
    public ICollection<OtpVerification> OtpVerifications { get; private set; }
    public ICollection<Notification> Notifications { get; private set; }
    public ICollection<PemsTaskInstance> AssignedTasks { get; private set; }
    public ICollection<PemsTaskInstance> CreatedTasks { get; private set; }
    
    // Domain Methods
    public void SetRefreshToken(string token, DateTime expiry) { ... }
    public void RevokeRefreshToken() { RefreshToken = null; }
    public void UpdateLastSeen() { LastSeen = DateTime.UtcNow; IsOnline = true; }
    public void GoOffline() { IsOnline = false; }
}

// RetailOps.Domain/Entities/PemsTaskInstance.cs
public class PemsTaskInstance : BaseEntity, IAggregateRoot
{
    public string TemplateId { get; private set; }
    public string Title { get; private set; }
    public string Description { get; private set; }
    public TaskStatus Status { get; private set; }
    public TaskPriority Priority { get; private set; }
    public string AssigneeId { get; private set; }
    public string ReviewerId { get; private set; }
    public DateTime DueDate { get; private set; }
    public DateTime? StartedAt { get; private set; }
    public DateTime? CompletedAt { get; private set; }
    public int SlaHours { get; private set; }
    public DateTime? EscalatedAt { get; private set; }
    public bool IsEscalated { get; private set; }
    public string ParentInstanceId { get; private set; }
    public int OccurrenceNumber { get; private set; }
    
    // Navigation
    public PemsTaskTemplate Template { get; private set; }
    public User Assignee { get; private set; }
    public User Reviewer { get; private set; }
    public ICollection<PemsSubTask> SubTasks { get; private set; }
    public ICollection<PemsTaskEvent> Events { get; private set; }
    public ICollection<PemsTaskReview> Reviews { get; private set; }
    public ICollection<PemsEvidence> Evidences { get; private set; }
    public ICollection<PemsNotification> Notifications { get; private set; }
    
    // Domain Methods
    public void Assign(string assigneeId, string reviewerId) { ... }
    public void Start() { Status = TaskStatus.InProgress; StartedAt = DateTime.UtcNow; }
    public void Submit() { Status = TaskStatus.Submitted; }
    public void Approve(string reviewerId, string feedback) { ... }
    public void Reject(string reviewerId, string feedback) { ... }
    public void Escalate() { IsEscalated = true; EscalatedAt = DateTime.UtcNow; }
    public void AddSubTask(PemsSubTask subTask) { ... }
}

// RetailOps.Domain/Entities/ScheduledRun.cs
public class ScheduledRun : BaseEntity, IAggregateRoot
{
    public DateTime StartTime { get; private set; }
    public DateTime? EndTime { get; private set; }
    public RunStatus Status { get; private set; }
    public string Marketplace { get; private set; }
    public string DetailsJson { get; private set; } // JSON serialized details
    public int TotalSellers { get; private set; }
    public int SuccessfulSellers { get; private set; }
    public int FailedSellers { get; private set; }
    public string ErrorMessage { get; private set; }
    public string ResumeRunId { get; private set; }
    
    // Navigation
    public ICollection<ScheduledRunDetail> Details { get; private set; }
    
    // Domain Methods
    public void Start() { Status = RunStatus.Running; StartTime = DateTime.UtcNow; }
    public void Complete(int successful, int failed) { ... }
    public void Fail(string error) { Status = RunStatus.Failed; ErrorMessage = error; EndTime = DateTime.UtcNow; }
    public void AddDetail(ScheduledRunDetail detail) { ... }
}
```

### 2.2 Value Objects

```csharp
// RetailOps.Domain/ValueObjects/Marketplace.cs
public class Marketplace : ValueObject
{
    public static readonly Marketplace Amazon = new("amazon");
    public static readonly Marketplace Ajio = new("ajio");
    public static readonly Marketplace Both = new("both");
    
    public string Value { get; }
    private Marketplace(string value) => Value = value.ToLowerInvariant();
    public static Marketplace FromString(string value) => new(value);
    protected override IEnumerable<object> GetEqualityComponents() { yield return Value; }
}

// RetailOps.Domain/ValueObjects/AsinStatus.cs
public class AsinStatus : ValueObject
{
    public static readonly AsinStatus Active = new("active");
    public static readonly AsinStatus Inactive = new("inactive");
    public static readonly AsinStatus Pending = new("pending");
    public static readonly AsinStatus Error = new("error");
    
    public string Value { get; }
    private AsinStatus(string value) => Value = value.ToLowerInvariant();
    protected override IEnumerable<object> GetEqualityComponents() { yield return Value; }
}
```

---

## 3. Application Layer (CQRS)

### 3.1 Commands

```csharp
// RetailOps.Application/Commands/Sellers/CreateSellerCommand.cs
public record CreateSellerCommand(
    string Name,
    string Email,
    string Phone,
    Marketplace Marketplace,
    string OctoparseId,
    string OctoparseMarketplace
) : IRequest<Result<SellerDto>>;

public class CreateSellerCommandHandler : IRequestHandler<CreateSellerCommand, Result<SellerDto>>
{
    private readonly ISellerRepository _sellerRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IMapper _mapper;
    
    public async Task<Result<SellerDto>> Handle(CreateSellerCommand request, CancellationToken ct)
    {
        var seller = Seller.Create(request.Name, request.Email, request.Phone, 
            request.Marketplace, request.OctoparseId, request.OctoparseMarketplace);
        
        await _sellerRepository.AddAsync(seller, ct);
        await _unitOfWork.SaveChangesAsync(ct);
        
        return Result.Success(_mapper.Map<SellerDto>(seller));
    }
}

// RetailOps.Application/Commands/Asins/SyncAsinCommand.cs
public record SyncAsinCommand(string SellerId, string AsinCode, bool ForceRefresh) 
    : IRequest<Result<AsinDto>>;

public class SyncAsinCommandHandler : IRequestHandler<SyncAsinCommand, Result<AsinDto>>
{
    private readonly IAsinRepository _asinRepository;
    private readonly IAmazonPAAPIService _paapiService;
    private readonly ILQSService _lqsService;
    private readonly IUnitOfWork _unitOfWork;
    
    public async Task<Result<AsinDto>> Handle(SyncAsinCommand request, CancellationToken ct)
    {
        var asin = await _asinRepository.GetBySellerAndCodeAsync(request.SellerId, request.AsinCode, ct);
        if (asin == null) return Result.NotFound<AsinDto>("ASIN not found");
        
        var marketData = await _paapiService.GetItemAsync(request.AsinCode, ct);
        asin.UpdateMarketData(marketData);
        asin.CalculateLQS(_lqsService);
        
        await _unitOfWork.SaveChangesAsync(ct);
        return Result.Success(_mapper.Map<AsinDto>(asin));
    }
}
```

### 3.2 Queries

```csharp
// RetailOps.Application/Queries/Dashboard/GetDashboardOverviewQuery.cs
public record GetDashboardOverviewQuery(
    string? SellerId,
    string Period = "30d"
) : IRequest<Result<DashboardOverviewDto>>;

public class GetDashboardOverviewQueryHandler 
    : IRequestHandler<GetDashboardOverviewQuery, Result<DashboardOverviewDto>>
{
    private readonly IDashboardRepository _dashboardRepository;
    
    public async Task<Result<DashboardOverviewDto>> Handle(
        GetDashboardOverviewQuery request, CancellationToken ct)
    {
        var overview = await _dashboardRepository.GetOverviewAsync(
            request.SellerId, request.Period, ct);
        return Result.Success(overview);
    }
}
```

---

## 4. API Contracts (OpenAPI 3.0)

### 4.1 Authentication

```yaml
# POST /api/auth/login
requestBody:
  content:
    application/json:
      schema:
        type: object
        required: [email, password]
        properties:
          email:
            type: string
            format: email
          password:
            type: string
            format: password
responses:
  '200':
    description: Login successful
    content:
      application/json:
        schema:
          $ref: '#/components/schemas/AuthResponse'
  '401':
    $ref: '#/components/responses/Unauthorized'

components:
  schemas:
    AuthResponse:
      type: object
      properties:
        user:
          $ref: '#/components/schemas/UserDto'
        accessToken:
          type: string
        refreshToken:
          type: string
    UserDto:
      type: object
      properties:
        id:
          type: string
        email:
          type: string
        firstName:
          type: string
        lastName:
          type: string
        role:
          $ref: '#/components/schemas/RoleDto'
        permissions:
          type: array
          items:
            type: string
```

### 4.2 Sellers API

```yaml
# GET /api/sellers
parameters:
  - name: page
    in: query
    schema:
      type: integer
      default: 1
  - name: limit
    in: query
    schema:
      type: integer
      default: 20
      maximum: 100
  - name: search
    in: query
    schema:
      type: string
  - name: marketplace
    in: query
    schema:
      type: string
      enum: [amazon, ajio, both]
  - name: isActive
    in: query
    schema:
      type: boolean
responses:
  '200':
    description: Paginated sellers
    content:
      application/json:
        schema:
          $ref: '#/components/schemas/PaginatedResponse'
          properties:
            data:
              type: array
              items:
                $ref: '#/components/schemas/SellerDto'

# POST /api/sellers
requestBody:
  content:
    application/json:
      schema:
        $ref: '#/components/schemas/CreateSellerRequest'

# GET /api/sellers/{id}
# PUT /api/sellers/{id}
# DELETE /api/sellers/{id}
```

### 4.3 Marketplace Sync API

```yaml
# POST /api/market-sync/trigger
requestBody:
  content:
    application/json:
      schema:
        type: object
        properties:
          sellerId:
            type: string
          type:
            type: string
            enum: [octoparse, live, keepa]
          options:
            type: object
            properties:
              concurrency:
                type: integer
              maxRetries:
                type: integer
              fullSync:
                type: boolean
responses:
  '202':
    description: Sync job accepted
    content:
      application/json:
        schema:
          type: object
          properties:
            jobId:
              type: string
            status:
              type: string
              enum: [accepted]

# GET /api/market-sync/status/{jobId}
responses:
  '200':
    description: Job status
    content:
      application/json:
        schema:
          $ref: '#/components/schemas/SyncJobStatusDto'

# POST /api/market-sync/pipeline/run
requestBody:
  content:
    application/json:
      schema:
        type: object
        required: [marketplace]
        properties:
          marketplace:
            type: string
            enum: [amazon, ajio]
          options:
            type: object
            properties:
              resumeRunId:
                type: string
              existingDetails:
                type: array
```

### 4.4 PEMS API

```yaml
# GET /api/pems/tasks
parameters:
  - name: status
    in: query
    schema:
      type: string
      enum: [created, assigned, submitted, approved, rejected, completed, escalated]
  - name: assigneeId
    in: query
    schema:
      type: string
  - name: page
    in: query
    schema:
      type: integer
      default: 1
  - name: limit
    in: query
    schema:
      type: integer
      default: 20

# POST /api/pems/tasks
requestBody:
  content:
    application/json:
      schema:
        $ref: '#/components/schemas/CreateTaskRequest'

# PUT /api/pems/tasks/{id}/transition
requestBody:
  content:
    application/json:
      schema:
        type: object
        required: [toStatus]
        properties:
          toStatus:
            type: string
            enum: [assigned, submitted, approved, rejected, escalated]
          feedback:
            type: string

# GET /api/pems/templates
# POST /api/pems/templates
# PUT /api/pems/templates/{id}

# GET /api/pems/dashboard
responses:
  '200':
    content:
      application/json:
        schema:
          $ref: '#/components/schemas/PemsDashboardDto'
```

### 4.5 Live Data Sync API

```yaml
# POST /api/live-data/sync
requestBody:
  content:
    application/json:
      schema:
        type: object
        properties:
          sellerId:
            type: string
          asins:
            type: array
            items:
              type: string
          options:
            type: object
            properties:
              triggerScrape:
                type: boolean
              fullSync:
                type: boolean
              onlyMissing:
                type: boolean

# GET /api/live-data/jobs/{jobId}/progress
responses:
  '200':
    content:
      application/json:
        schema:
          $ref: '#/components/schemas/LiveSyncJobProgressDto'

# GET /api/live-data/jobs/{jobId}/results
# GET /api/live-data/jobs/{jobId}/download
```

### 4.6 Real-time (SignalR)

```csharp
// Hubs/PemsHub.cs
public class PemsHub : Hub<IPemsClient>
{
    public async Task JoinTaskGroup(string taskInstanceId)
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, $"task:{taskInstanceId}");
    }
    
    public async Task LeaveTaskGroup(string taskInstanceId)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"task:{taskInstanceId}");
    }
}

public interface IPemsClient
{
    Task TaskStatusChanged(TaskStatusChangedDto dto);
    Task TaskAssigned(TaskAssignedDto dto);
    Task TaskEscalated(TaskEscalatedDto dto);
    Task NotificationCreated(NotificationDto dto);
}

// Hubs/ChatHub.cs
public class ChatHub : Hub<IChatClient>
{
    public async Task SendMessage(SendMessageDto dto) { ... }
    public async Task JoinConversation(string conversationId) { ... }
    public async Task LeaveConversation(string conversationId) { ... }
    public async Task Typing(string conversationId, bool isTyping) { ... }
}
```

---

## 5. Infrastructure Layer

### 5.1 EF Core Configuration

```csharp
// RetailOps.Infrastructure/Persistence/Configurations/SellerConfiguration.cs
public class SellerConfiguration : IEntityTypeConfiguration<Seller>
{
    public void Configure(EntityTypeBuilder<Seller> builder)
    {
        builder.ToTable("Sellers");
        builder.HasKey(s => s.Id);
        builder.Property(s => s.Id).HasMaxLength(50);
        builder.Property(s => s.Name).HasMaxLength(255).IsRequired();
        builder.Property(s => s.Email).HasMaxLength(255).IsRequired();
        builder.Property(s => s.Phone).HasMaxLength(50);
        builder.Property(s => s.Marketplace).HasConversion<string>().HasMaxLength(20);
        builder.Property(s => s.OctoparseId).HasMaxLength(100);
        builder.Property(s => s.OctoparseMarketplace).HasMaxLength(50);
        builder.Property(s => s.CometChatUid).HasMaxLength(100);
        
        builder.HasIndex(s => s.Email).IsUnique();
        builder.HasIndex(s => s.OctoparseId);
        builder.HasIndex(s => s.Marketplace);
        
        builder.HasMany(s => s.Asin)
            .WithOne(a => a.Seller)
            .HasForeignKey(a => a.SellerId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

// RetailOps.Infrastructure/Persistence/RetailOpsDbContext.cs
public class RetailOpsDbContext : DbContext
{
    public RetailOpsDbContext(DbContextOptions<RetailOpsDbContext> options) : base(options) { }
    
    // Core
    public DbSet<Seller> Sellers => Set<Seller>();
    public DbSet<Asin> Asins => Set<Asin>();
    public DbSet<User> Users => Set<User>();
    public DbSet<Role> Roles => Set<Role>();
    public DbSet<Permission> Permissions => Set<Permission>();
    
    // PEMS
    public DbSet<PemsTaskTemplate> TaskTemplates => Set<PemsTaskTemplate>();
    public DbSet<PemsTaskInstance> TaskInstances => Set<PemsTaskInstance>();
    public DbSet<PemsSubTask> SubTasks => Set<PemsSubTask>();
    public DbSet<PemsTaskEvent> TaskEvents => Set<PemsTaskEvent>();
    public DbSet<PemsTaskReview> TaskReviews => Set<PemsTaskReview>();
    public DbSet<PemsNotification> Notifications => Set<PemsNotification>();
    public DbSet<PemsEvidence> Evidences => Set<PemsEvidence>();
    public DbSet<PemsAssignmentRule> AssignmentRules => Set<PemsAssignmentRule>();
    public DbSet<PemsEscalationRule> EscalationRules => Set<PemsEscalationRule>();
    public DbSet<PemsTaskAuditLog> TaskAuditLogs => Set<PemsTaskAuditLog>();
    
    // Scheduling
    public DbSet<ScheduledRun> ScheduledRuns => Set<ScheduledRun>();
    public DbSet<ScheduledRunDetail> ScheduledRunDetails => Set<ScheduledRunDetail>();
    public DbSet<TaskTemplate> TaskTemplates => Set<TaskTemplate>();
    public DbSet<GoalTemplate> GoalTemplates => Set<GoalTemplate>();
    
    // Auth
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();
    public DbSet<OtpVerification> OtpVerifications => Set<OtpVerification>();
    public DbSet<TrustedDevice> TrustedDevices => Set<TrustedDevice>();
    
    // Communication
    public DbSet<Conversation> Conversations => Set<Conversation>();
    public DbSet<Message> Messages => Set<Message>();
    public DbSet<MessageReaction> MessageReactions => Set<MessageReaction>();
    public DbSet<MessageStatus> MessageStatuses => Set<MessageStatus>();
    public DbSet<CallLog> CallLogs => Set<CallLog>();
    
    // System
    public DbSet<SystemLog> SystemLogs => Set<SystemLog>();
    public DbSet<SystemSetting> SystemSettings => Set<SystemSetting>();
    public DbSet<Webhook> Webhooks => Set<Webhook>();
    public DbSet<WebhookLog> WebhookLogs => Set<WebhookLog>();
    public DbSet<ApiKey> ApiKeys => Set<ApiKey>();
    
    // Analytics
    public DbSet<AsinWeekHistory> AsinWeekHistory => Set<AsinWeekHistory>();
    public DbSet<AsinHistory> AsinHistory => Set<AsinHistory>();
    public DbSet<GmsDailyPerformance> GmsDailyPerformance => Set<GmsDailyPerformance>();
    public DbSet<GmsTarget> GmsTargets => Set<GmsTarget>();
    public DbSet<GmsTargetBreakdown> GmsTargetBreakdowns => Set<GmsTargetBreakdown>();
    public DbSet<RevenueCalculator> RevenueCalculators => Set<RevenueCalculator>();
    
    // AI/LQS
    public DbSet<Alert> Alerts => Set<Alert>();
    public DbSet<AlertRule> AlertRules => Set<AlertRule>();
    
    // Files
    public DbSet<Download> Downloads => Set<Download>();
    public DbSet<FileEntity> Files => Set<FileEntity>();
    
    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(RetailOpsDbContext).Assembly);
        base.OnModelCreating(modelBuilder);
    }
}
```

### 5.2 Repository Pattern

```csharp
// RetailOps.Application/Interfaces/ISellerRepository.cs
public interface ISellerRepository : IRepository<Seller>
{
    Task<Seller?> GetByEmailAsync(string email, CancellationToken ct = default);
    Task<Seller?> GetByOctoparseIdAsync(string octoparseId, CancellationToken ct = default);
    Task<IReadOnlyList<Seller>> GetActiveByMarketplaceAsync(Marketplace marketplace, CancellationToken ct = default);
    Task<(IReadOnlyList<Seller> Items, int TotalCount)> GetPagedAsync(
        int page, int limit, string? search, Marketplace? marketplace, bool? isActive, CancellationToken ct = default);
}

// RetailOps.Infrastructure/Persistence/Repositories/SellerRepository.cs
public class SellerRepository : Repository<Seller>, ISellerRepository
{
    public SellerRepository(RetailOpsDbContext context) : base(context) { }
    
    public async Task<Seller?> GetByEmailAsync(string email, CancellationToken ct = default)
        => await _dbSet.FirstOrDefaultAsync(s => s.Email == email, ct);
    
    public async Task<Seller?> GetByOctoparseIdAsync(string octoparseId, CancellationToken ct = default)
        => await _dbSet.FirstOrDefaultAsync(s => s.OctoparseId == octoparseId, ct);
    
    public async Task<IReadOnlyList<Seller>> GetActiveByMarketplaceAsync(
        Marketplace marketplace, CancellationToken ct = default)
        => await _dbSet.Where(s => s.IsActive && s.Marketplace == marketplace).ToListAsync(ct);
    
    public async Task<(IReadOnlyList<Seller> Items, int TotalCount)> GetPagedAsync(
        int page, int limit, string? search, Marketplace? marketplace, bool? isActive, CancellationToken ct = default)
    {
        var query = _dbSet.AsQueryable();
        
        if (!string.IsNullOrWhiteSpace(search))
            query = query.Where(s => s.Name.Contains(search) || s.Email.Contains(search));
        
        if (marketplace.HasValue)
            query = query.Where(s => s.Marketplace == marketplace.Value);
        
        if (isActive.HasValue)
            query = query.Where(s => s.IsActive == isActive.Value);
        
        var total = await query.CountAsync(ct);
        var items = await query
            .OrderBy(s => s.Name)
            .Skip((page - 1) * limit)
            .Take(limit)
            .ToListAsync(ct);
        
        return (items, total);
    }
}
```

### 5.3 External Services

```csharp
// RetailOps.Infrastructure/Services/OctoparseService.cs
public interface IOctoparseService
{
    Task<OctoparseTaskStatus?> GetTaskStatusAsync(string taskId, CancellationToken ct = default);
    Task<OctoparseTaskData?> GetTaskDataAsync(string taskId, CancellationToken ct = default);
    Task<bool> TriggerTaskAsync(string taskId, CancellationToken ct = default);
    Task<bool> StopTaskAsync(string taskId, CancellationToken ct = default);
    Task<bool> ClearTaskDataAsync(string taskId, CancellationToken ct = default);
    Task<IReadOnlyList<OctoparseTaskGroup>> GetTaskGroupsAsync(CancellationToken ct = default);
}

public class OctoparseService : IOctoparseService
{
    private readonly HttpClient _httpClient;
    private readonly IOptions<OctoparseOptions> _options;
    private readonly ILogger<OctoparseService> _logger;
    private readonly ICacheService _cache;
    
    public async Task<OctoparseTaskStatus?> GetTaskStatusAsync(string taskId, CancellationToken ct)
    {
        var cacheKey = $"octoparse:status:{taskId}";
        return await _cache.GetOrCreateAsync(cacheKey, async () => 
        {
            var response = await _httpClient.GetAsync($"task/{taskId}/status", ct);
            response.EnsureSuccessStatusCode();
            return await response.Content.ReadFromJsonAsync<OctoparseTaskStatus>(cancellationToken: ct);
        }, TimeSpan.FromMinutes(5), ct);
    }
    
    // ... other methods with Polly retry policies
}

// RetailOps.Infrastructure/Services/AmazonPAAPIService.cs
public interface IAmazonPAAPIService
{
    Task<PAAPIGetItemsResponse?> GetItemsAsync(IEnumerable<string> asins, CancellationToken ct = default);
    Task<PAAPIGetItemsResponse?> GetVariationsAsync(string parentAsin, CancellationToken ct = default);
    Task<string> GetAccessTokenAsync(CancellationToken ct = default);
}

public class AmazonPAAPIService : IAmazonPAAPIService
{
    private readonly HttpClient _httpClient;
    private readonly IOptions<AmazonPAAPIOptions> _options;
    private readonly ICacheService _cache;
    private readonly ILogger<AmazonPAAPIService> _logger;
    
    private const string TokenCacheKey = "amazon:paapi:token";
    
    public async Task<string> GetAccessTokenAsync(CancellationToken ct)
    {
        return await _cache.GetOrCreateAsync(TokenCacheKey, async () =>
        {
            var request = new HttpRequestMessage(HttpMethod.Post, "https://api.amazon.co.uk/auth/o2/token")
            {
                Content = new FormUrlEncodedContent(new Dictionary<string, string>
                {
                    ["grant_type"] = "client_credentials",
                    ["client_id"] = _options.Value.ClientId,
                    ["client_secret"] = _options.Value.ClientSecret,
                    ["scope"] = "creatorsapi::default"
                })
            };
            
            var response = await _httpClient.SendAsync(request, ct);
            response.EnsureSuccessStatusCode();
            var tokenResponse = await response.Content.ReadFromJsonAsync<TokenResponse>(cancellationToken: ct);
            return tokenResponse!.AccessToken;
        }, TimeSpan.FromMinutes(55), ct); // Cache for 55 min (token expires in 60)
    }
}
```

---

## 6. Background Jobs (Hangfire)

```csharp
// RetailOps.Infrastructure/Services/HangfireJobService.cs
public interface IHangfireJobService
{
    void ScheduleRecurringJobs();
    void TriggerPipeline(string marketplace);
    void TriggerLiveSync();
    void TriggerAutoTags(string type);
    void TriggerKeepaSync();
    void ScheduleOtpCleanup();
}

public class HangfireJobService : IHangfireJobService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<HangfireJobService> _logger;
    
    public void ScheduleRecurringJobs()
    {
        // Load from SystemSettings table
        var settings = GetSettingsFromDb();
        
        // Amazon Pipeline
        if (settings.AmazonEnabled)
        {
            RecurringJob.AddOrUpdate<IPipelineJobService>(
                "amazon-pipeline",
                x => x.RunAsync("amazon", CancellationToken.None),
                Cron.Daily(settings.AmazonScheduleTime.Hour, settings.AmazonScheduleTime.Minute),
                TimeZoneInfo.FindSystemTimeZoneById(settings.Timezone));
        }
        
        // Ajio Pipeline
        if (settings.AjioEnabled)
        {
            RecurringJob.AddOrUpdate<IPipelineJobService>(
                "ajio-pipeline",
                x => x.RunAsync("ajio", CancellationToken.None),
                Cron.Daily(settings.AjioScheduleTime.Hour, settings.AjioScheduleTime.Minute),
                TimeZoneInfo.FindSystemTimeZoneById(settings.Timezone));
        }
        
        // Live Data Sync
        if (settings.LiveSyncEnabled)
        {
            RecurringJob.AddOrUpdate<ILiveSyncJobService>(
                "live-data-sync",
                x => x.SyncAllAsync(CancellationToken.None),
                Cron.Daily(settings.LiveSyncTime.Hour, settings.LiveSyncTime.Minute),
                TimeZoneInfo.FindSystemTimeZoneById(settings.Timezone));
        }
        
        // Auto Tags
        RecurringJob.AddOrUpdate<IAutoTagJobService>(
            "auto-tags-age",
            x => x.RunAgeTagsAsync(CancellationToken.None),
            Cron.Daily(2, 0)); // 2 AM
        
        RecurringJob.AddOrUpdate<IAutoTagJobService>(
            "auto-tags-full",
            x => x.RunFullAsync(CancellationToken.None),
            Cron.Daily(3, 0)); // 3 AM
        
        // PEMS Recurrence (hourly)
        RecurringJob.AddOrUpdate<IPemsRecurrenceJobService>(
            "pems-recurrence",
            x => x.GenerateDueOccurrencesAsync(CancellationToken.None),
            Cron.Hourly());
        
        // PEMS SLA Escalation (every 30 min)
        RecurringJob.AddOrUpdate<IPemsSlaJobService>(
            "pems-sla-escalation",
            x => x.CheckEscalationsAsync(CancellationToken.None),
            "*/30 * * * *");
        
        // OTP Cleanup (daily 3 AM)
        RecurringJob.AddOrUpdate<IOtpCleanupJobService>(
            "otp-cleanup",
            x => x.CleanupAsync(CancellationToken.None),
            Cron.Daily(3, 0));
    }
    
    public void TriggerPipeline(string marketplace)
        => BackgroundJob.Enqueue<IPipelineJobService>(x => x.RunAsync(marketplace, CancellationToken.None));
    
    // ... other trigger methods
}
```

### 6.1 Job Interfaces & Implementations

```csharp
// RetailOps.Application/Jobs/IPipelineJobService.cs
public interface IPipelineJobService
{
    Task RunAsync(string marketplace, CancellationToken ct);
}

public class PipelineJobService : IPipelineJobService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<PipelineJobService> _logger;
    
    public async Task RunAsync(string marketplace, CancellationToken ct)
    {
        using var scope = _scopeFactory.CreateScope();
        var pipelineService = scope.ServiceProvider.GetRequiredService<IPipelineService>();
        var logger = scope.ServiceProvider.GetRequiredService<ILogger<PipelineJobService>>();
        
        var runId = await pipelineService.StartRunAsync(marketplace, ct);
        
        try
        {
            await pipelineService.ExecutePipelineAsync(runId, marketplace, ct);
            await pipelineService.CompleteRunAsync(runId, ct);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Pipeline failed for {Marketplace}", marketplace);
            await pipelineService.FailRunAsync(runId, ex.Message, ct);
            throw;
        }
    }
}
```

---

## 7. Configuration

### 7.1 appsettings.json

```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Server=...;Database=RetailOps;User=...;Password=...;Encrypt=True;TrustServerCertificate=False;",
    "ReadOnlyConnection": "Server=...;Database=RetailOps;User=...;Password=...;Encrypt=True;TrustServerCertificate=False;"
  },
  "Redis": {
    "ConnectionString": "localhost:6379",
    "InstanceName": "RetailOps:"
  },
  "Jwt": {
    "Secret": "...",
    "RefreshSecret": "...",
    "AccessTokenExpiryMinutes": 120,
    "RefreshTokenExpiryDays": 7,
    "Issuer": "RetailOps",
    "Audience": "RetailOps.Client"
  },
  "Octoparse": {
    "ApiKey": "...",
    "BaseUrl": "https://api.octoparse.com/v2",
    "TimeoutSeconds": 60
  },
  "Keepa": {
    "ApiKey": "...",
    "BaseUrl": "https://api.keepa.com",
    "TimeoutSeconds": 30
  },
  "AmazonPAAPI": {
    "ClientId": "...",
    "ClientSecret": "...",
    "PartnerTag": "...",
    "Marketplace": "www.amazon.in",
    "BaseUrl": "https://creatorsapi.amazon",
    "AuthUrl": "https://api.amazon.co.uk/auth/o2/token",
    "Scope": "creatorsapi::default"
  },
  "Keepa": {
    "ApiKey": "...",
    "BaseUrl": "https://api.keepa.com"
  },
  "CometChat": {
    "AppId": "...",
    "Region": "...",
    "AuthKey": "...",
    "BaseUrl": "https://api-us.cometchat.io/v3"
  },
  "Email": {
    "Host": "smtp.example.com",
    "Port": 587,
    "Username": "...",
    "Password": "...",
    "FromEmail": "noreply@retailops.com",
    "FromName": "RetailOps"
  },
  "Hangfire": {
    "ConnectionString": "Server=...;Database=RetailOps_Hangfire;...",
    "DashboardPath": "/hangfire",
    "Username": "admin",
    "Password": "..."
  },
  "Cors": {
    "AllowedOrigins": [
      "http://localhost:5173",
      "https://app.retailops.com"
    ]
  },
  "RateLimiting": {
    "Global": {
      "PermitLimit": 1000,
      "WindowSeconds": 60
    },
    "Auth": {
      "PermitLimit": 5,
      "WindowSeconds": 900
    },
    "Api": {
      "PermitLimit": 100,
      "WindowSeconds": 60
    }
  },
  "Serilog": {
    "MinimumLevel": "Information",
    "WriteTo": [
      { "Name": "Console" },
      { "Name": "File", "Args": { "path": "logs/retailops-.log", "rollingInterval": "Day" } },
      { "Name": "Seq", "Args": { "serverUrl": "http://seq:5341" } }
    ]
  }
}
```

### 7.2 Program.cs (Startup)

```csharp
// RetailOps.Api/Program.cs
var builder = WebApplication.CreateBuilder(args);

// Add services
builder.Services.AddControllers(options =>
{
    options.Filters.Add<ApiExceptionFilter>();
    options.Filters.Add<ValidateModelFilter>();
});

// Swagger/OpenAPI
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo { Title = "RetailOps API", Version = "v1" });
    c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Type = SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT"
    });
    c.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        [new OpenApiSecurityScheme { Reference = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = "Bearer" }}] = Array.Empty<string>()
    });
});

// Database
builder.Services.AddDbContext<RetailOpsDbContext>(options =>
{
    options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection"), sql =>
    {
        sql.CommandTimeout(120);
        sql.EnableRetryOnFailure(3, TimeSpan.FromSeconds(10), null);
    });
});

// Redis
builder.Services.AddStackExchangeRedisCache(options =>
{
    options.Configuration = builder.Configuration.GetConnectionString("Redis");
    options.InstanceName = "RetailOps:";
});

// Hangfire
builder.Services.AddHangfire(config =>
{
    config.UseSqlServerStorage(builder.Configuration.GetConnectionString("Hangfire"))
          .UseFilter(new AutomaticRetryAttribute { Attempts = 3 })
          .UseConsole();
});

builder.Services.AddHangfireServer(options =>
{
    options.WorkerCount = Environment.ProcessorCount;
    options.Queues = new[] { "critical", "default", "low" };
});

// Authentication
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = builder.Configuration["Jwt:Issuer"],
            ValidAudience = builder.Configuration["Jwt:Audience"],
            IssuerSigningKey = new SymmetricSecurityKey(
                Encoding.UTF8.GetBytes(builder.Configuration["Jwt:Secret"]!)),
            ClockSkew = TimeSpan.Zero
        };
        options.Events = new JwtBearerEvents
        {
            OnMessageReceived = context =>
            {
                var accessToken = context.Request.Query["access_token"];
                var path = context.HttpContext.Request.Path;
                if (!string.IsNullOrEmpty(accessToken) && path.StartsWithSegments("/hubs"))
                    context.Token = accessToken;
                return Task.CompletedTask;
            },
            OnTokenValidated = async context =>
            {
                var tokenBlacklist = context.HttpContext.RequestServices.GetRequiredService<ITokenBlacklistService>();
                var token = context.SecurityToken as JwtSecurityToken;
                if (token != null && await tokenBlacklist.IsBlacklistedAsync(token.RawData))
                    context.Fail("Token has been revoked");
            }
        };
    });

// Authorization
builder.Services.AddAuthorizationBuilder()
    .AddPolicy("RequireAdmin", p => p.RequireRole("admin", "super_admin"))
    .AddPolicy("RequireManager", p => p.RequireRole("admin", "super_admin", "manager"))
    .AddPolicy("RequireAnalyst", p => p.RequireRole("admin", "super_admin", "manager", "analyst"));

// CORS
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.WithOrigins(builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>()!)
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

// Rate Limiting
builder.Services.AddRateLimiter(options =>
{
    options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(ctx =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: ctx.User.Identity?.Name ?? ctx.Connection.RemoteIpAddress?.ToString() ?? "anonymous",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 1000,
                Window = TimeSpan.FromMinutes(1)
            }));
    
    options.AddPolicy("Auth", context =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: context.Connection.RemoteIpAddress?.ToString() ?? "anonymous",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 5,
                Window = TimeSpan.FromMinutes(15)
            }));
    
    options.AddPolicy("Api", context =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: context.User.Identity?.Name ?? context.Connection.RemoteIpAddress?.ToString() ?? "anonymous",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 100,
                Window = TimeSpan.FromMinutes(1)
            }));
});

// SignalR
builder.Services.AddSignalR(options =>
{
    options.EnableDetailedErrors = builder.Environment.IsDevelopment();
    options.MaximumReceiveMessageSize = 102400; // 100KB
})
.AddRedis(builder.Configuration.GetConnectionString("Redis")!);

// MediatR
builder.Services.AddMediatR(cfg => cfg.RegisterServicesFromAssembly(typeof(Program).Assembly));

// AutoMapper
builder.Services.AddAutoMapper(typeof(Program).Assembly);

// FluentValidation
builder.Services.AddValidatorsFromAssembly(typeof(Program).Assembly);

// Custom Services
builder.Services.AddScoped<ISellerRepository, SellerRepository>();
builder.Services.AddScoped<IAsinRepository, AsinRepository>();
builder.Services.AddScoped<IUserRepository, UserRepository>();
builder.Services.AddScoped<IPemsTaskRepository, PemsTaskRepository>();
builder.Services.AddScoped<IDashboardRepository, DashboardRepository>();
builder.Services.AddScoped<IScheduledRunRepository, ScheduledRunRepository>();

builder.Services.AddScoped<IOctoparseService, OctoparseService>();
builder.Services.AddScoped<IAmazonPAAPIService, AmazonPAAPIService>();
builder.Services.AddScoped<IKeepaService, KeepaService>();
builder.Services.AddScoped<ICometChatService, CometChatService>();
builder.Services.AddScoped<ICacheService, RedisCacheService>();
builder.Services.AddScoped<ITokenBlacklistService, RedisTokenBlacklistService>();
builder.Services.AddScoped<IEmailService, SmtpEmailService>();
builder.Services.AddScoped<ILQSService, LQSService>();
builder.Services.AddScoped<IPipelineService, PipelineService>();
builder.Services.AddScoped<ILiveSyncService, LiveSyncService>();
builder.Services.AddScoped<IAutoTagService, AutoTagService>();
builder.Services.AddScoped<IPemsService, PemsService>();
builder.Services.AddScoped<ISchedulerService, SchedulerService>();

builder.Services.AddScoped<IUnitOfWork, UnitOfWork>();
builder.Services.AddSingleton<IDateTimeProvider, UtcDateTimeProvider>();

// Health Checks
builder.Services.AddHealthChecks()
    .AddDbContextCheck<RetailOpsDbContext>()
    .AddRedis(builder.Configuration.GetConnectionString("Redis")!)
    .AddHangfire();

var app = builder.Build();

// Pipeline
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI(c => c.SwaggerEndpoint("/swagger/v1/swagger.json", "RetailOps API v1"));
}

app.UseSerilogRequestLogging();
app.UseHttpsRedirection();
app.UseCors();
app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();
app.MapHub<PemsHub>("/hubs/pems");
app.MapHub<ChatHub>("/hubs/chat");
app.MapHub<LiveSyncHub>("/hubs/live-sync");
app.MapHealthChecks("/api/health");
app.MapHealthChecks("/api/health/liveness", new HealthCheckOptions { Predicate = _ => false });
app.MapHealthChecks("/api/health/readiness", new HealthCheckOptions { Predicate = check => check.Tags.Contains("ready") });

if (app.Environment.IsDevelopment())
{
    app.UseHangfireDashboard("/hangfire", new DashboardOptions
    {
        Authorization = new[] { new HangfireLocalhostAuthorizationFilter() }
    });
}

// Initialize Hangfire Jobs
using (var scope = app.Services.CreateScope())
{
    var jobService = scope.ServiceProvider.GetRequiredService<IHangfireJobService>();
    jobService.ScheduleRecurringJobs();
}

app.Run();
```

---

## 8. Database Migration Strategy

### 8.1 Migration Approach

```sql
-- The existing SQL Server schema is largely compatible
-- Key changes needed:

-- 1. Add EF Core migration history table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = '__EFMigrationsHistory')
BEGIN
    CREATE TABLE __EFMigrationsHistory (
        MigrationId NVARCHAR(150) NOT NULL,
        ProductVersion NVARCHAR(32) NOT NULL,
        CONSTRAINT PK___EFMigrationsHistory PRIMARY KEY (MigrationId)
    );
END

-- 2. Ensure all tables have proper indexes for EF Core
-- (Most already exist from current schema)

-- 3. Add computed columns for LQS where needed
ALTER TABLE Asins ADD LqsScore AS (
    (ISNULL(LqsTitle,0) * 0.30 + ISNULL(LqsBullets,0) * 0.25 + ISNULL(LqsImages,0) * 0.25) / 0.80
) PERSISTED;
```

### 8.2 Migration Commands

```bash
# Create initial migration
dotnet ef migrations add InitialCreate --project src/RetailOps.Infrastructure --startup-project src/RetailOps.Api --output-dir Persistence/Migrations

# Apply migrations
dotnet ef database update --project src/RetailOps.Infrastructure --startup-project src/RetailOps.Api

# Generate SQL script for production
dotnet ef migrations script --project src/RetailOps.Infrastructure --startup-project src/RetailOps.Api --output migrations.sql --idempotent
```

---

## 9. Testing Strategy

### 9.1 Unit Tests (xUnit + Moq)

```csharp
// tests/RetailOps.UnitTests/Commands/CreateSellerCommandHandlerTests.cs
public class CreateSellerCommandHandlerTests
{
    private readonly Mock<ISellerRepository> _sellerRepositoryMock;
    private readonly Mock<IUnitOfWork> _unitOfWorkMock;
    private readonly CreateSellerCommandHandler _handler;
    
    public CreateSellerCommandHandlerTests()
    {
        _sellerRepositoryMock = new Mock<ISellerRepository>();
        _unitOfWorkMock = new Mock<IUnitOfWork>();
        var mapper = new MapperConfiguration(cfg => cfg.AddProfile<MappingProfile>()).CreateMapper();
        _handler = new CreateSellerCommandHandler(_sellerRepositoryMock.Object, _unitOfWorkMock.Object, mapper);
    }
    
    [Fact]
    public async Task Handle_ValidCommand_ReturnsSellerDto()
    {
        // Arrange
        var command = new CreateSellerCommand("Test Seller", "test@example.com", "1234567890", 
            Marketplace.Amazon, "octo-123", "amazon");
        
        _sellerRepositoryMock.Setup(r => r.AddAsync(It.IsAny<Seller>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);
        _unitOfWorkMock.Setup(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(1);
        
        // Act
        var result = await _handler.Handle(command, CancellationToken.None);
        
        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Name.Should().Be("Test Seller");
        _sellerRepositoryMock.Verify(r => r.AddAsync(It.IsAny<Seller>(), It.IsAny<CancellationToken>()), Times.Once);
        _unitOfWorkMock.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }
}
```

### 9.2 Integration Tests (TestContainers)

```csharp
// tests/RetailOps.IntegrationTests/SellersApiTests.cs
public class SellersApiTests : IClassFixture<CustomWebApplicationFactory>
{
    private readonly HttpClient _client;
    private readonly CustomWebApplicationFactory _factory;
    
    public SellersApiTests(CustomWebApplicationFactory factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
    }
    
    [Fact]
    public async Task GetSellers_ReturnsPagedResults()
    {
        // Arrange
        var token = await GetAuthTokenAsync();
        _client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        
        // Act
        var response = await _client.GetAsync("/api/sellers?page=1&limit=10");
        
        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var result = await response.Content.ReadFromJsonAsync<PagedResponse<SellerDto>>();
        result.Should().NotBeNull();
        result!.Data.Should().NotBeEmpty();
    }
}

public class CustomWebApplicationFactory : WebApplicationFactory<Program>
{
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.ConfigureTestServices(services =>
        {
            // Replace SQL Server with TestContainers
            var descriptor = services.SingleOrDefault(d => d.ServiceType == typeof(DbContextOptions<RetailOpsDbContext>));
            if (descriptor != null) services.Remove(descriptor);
            
            services.AddDbContext<RetailOpsDbContext>(options =>
            {
                options.UseSqlServer(_container.GetConnectionString());
            });
        });
    }
}
```

---

## 10. Deployment

### 10.1 Docker

```dockerfile
# Dockerfile
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS base
WORKDIR /app
EXPOSE 8080
EXPOSE 8081

FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY ["RetailOps.sln", "."]
COPY ["src/RetailOps.Api/RetailOps.Api.csproj", "src/RetailOps.Api/"]
COPY ["src/RetailOps.Application/RetailOps.Application.csproj", "src/RetailOps.Application/"]
COPY ["src/RetailOps.Domain/RetailOps.Domain.csproj", "src/RetailOps.Domain/"]
COPY ["src/RetailOps.Infrastructure/RetailOps.Infrastructure.csproj", "src/RetailOps.Infrastructure/"]
COPY ["src/RetailOps.Shared/RetailOps.Shared.csproj", "src/RetailOps.Shared/"]
RUN dotnet restore "RetailOps.sln"

COPY . .
WORKDIR "/src/src/RetailOps.Api"
RUN dotnet build "RetailOps.Api.csproj" -c Release -o /app/build

FROM build AS publish
RUN dotnet publish "RetailOps.Api.csproj" -c Release -o /app/publish /p:UseAppHost=false

FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "RetailOps.Api.dll"]
```

### 10.2 docker-compose.yml

```yaml
version: '3.8'

services:
  api:
    build: .
    ports:
      - "8080:8080"
    environment:
      - ASPNETCORE_ENVIRONMENT=Production
      - ConnectionStrings__DefaultConnection=Server=sqlserver;Database=RetailOps;User=sa;Password=${SA_PASSWORD};Encrypt=True;TrustServerCertificate=True;
      - Redis__ConnectionString=redis:6379
      - Jwt__Secret=${JWT_SECRET}
      - Hangfire__ConnectionString=Server=sqlserver;Database=RetailOps_Hangfire;User=sa;Password=${SA_PASSWORD};
    depends_on:
      - sqlserver
      - redis
    deploy:
      resources:
        limits:
          memory: 2G
        reservations:
          memory: 1G

  sqlserver:
    image: mcr.microsoft.com/mssql/server:2022-latest
    environment:
      - ACCEPT_EULA=Y
      - SA_PASSWORD=${SA_PASSWORD}
      - MSSQL_PID=Developer
    ports:
      - "1433:1433"
    volumes:
      - sqlserver_data:/var/opt/mssql
    healthcheck:
      test: /opt/mssql-tools18/bin/sqlcmd -C -S localhost -U sa -P "${SA_PASSWORD}" -Q "SELECT 1"
      interval: 10s
      timeout: 5s
      retries: 10

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    command: redis-server --appendonly yes --maxmemory 512mb --maxmemory-policy allkeys-lru
    healthcheck:
      test: redis-cli ping
      interval: 10s
      timeout: 5s
      retries: 5

  hangfire:
    build: .
    command: dotnet RetailOps.Api.dll --hangfire-only
    environment:
      - ASPNETCORE_ENVIRONMENT=Production
      - ConnectionStrings__DefaultConnection=Server=sqlserver;Database=RetailOps;User=sa;Password=${SA_PASSWORD};Encrypt=True;TrustServerCertificate=True;
      - Redis__ConnectionString=redis:6379
      - Hangfire__ConnectionString=Server=sqlserver;Database=RetailOps_Hangfire;User=sa;Password=${SA_PASSWORD};
    depends_on:
      - sqlserver
      - redis
    deploy:
      replicas: 1

volumes:
  sqlserver_data:
  redis_data:
```

---

## 11. Migration Checklist

| Phase | Task | Status | Owner |
|-------|------|--------|-------|
| **Preparation** | Set up .NET 8 SDK & tooling | ⬜ | DevOps |
| **Preparation** | Create solution structure | ⬜ | Team Lead |
| **Domain** | Port Entities & Value Objects | ⬜ | Backend Team |
| **Domain** | Port Domain Events & Services | ⬜ | Backend Team |
| **Application** | Port Commands/Queries/Handlers | ⬜ | Backend Team |
| **Application** | Port DTOs & Validators | ⬜ | Backend Team |
| **Infrastructure** | EF Core Configurations | ⬜ | Backend Team |
| **Infrastructure** | Repository Implementations | ⬜ | Backend Team |
| **Infrastructure** | External Service Adapters | ⬜ | Backend Team |
| **Infrastructure** | Hangfire Job Setup | ⬜ | Backend Team |
| **API** | Controllers & Endpoints | ⬜ | Backend Team |
| **API** | SignalR Hubs | ⬜ | Backend Team |
| **API** | Middleware & Filters | ⬜ | Backend Team |
| **Auth** | JWT + Identity Setup | ⬜ | Security |
| **Auth** | Redis Token Blacklist | ⬜ | Backend Team |
| **Real-time** | SignalR Migration from Socket.IO | ⬜ | Backend Team |
| **Frontend** | Update API Client | ⬜ | Frontend Team |
| **Testing** | Unit Tests | ⬜ | QA |
| **Testing** | Integration Tests | ⬜ | QA |
| **Deployment** | Docker & CI/CD | ⬜ | DevOps |
| **Deployment** | Database Migration Scripts | ⬜ | DBA |
| **Go-Live** | Blue-Green Deployment | ⬜ | DevOps |
| **Go-Live** | Monitoring & Alerts | ⬜ | DevOps |

---

## 12. Estimated Effort

| Component | Story Points | Weeks (2 devs) |
|-----------|--------------|----------------|
| Domain Layer | 21 | 2 |
| Application Layer (CQRS) | 34 | 3 |
| Infrastructure (EF Core, Repos) | 28 | 2.5 |
| External Services | 13 | 1.5 |
| API Controllers | 21 | 2 |
| SignalR Hubs | 8 | 1 |
| Auth & Security | 13 | 1.5 |
| Hangfire Jobs | 13 | 1.5 |
| Testing | 21 | 2 |
| DevOps & Deployment | 13 | 1.5 |
| **Total** | **185** | **~18 weeks** |

---

## 13. Risk Mitigation

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| EF Core migration issues | High | High | Run migration scripts in staging first; keep rollback plan |
| SignalR vs Socket.IO parity | Medium | High | Implement feature flags for gradual migration |
| Hangfire job scheduling | Medium | Medium | Test all cron expressions in staging |
| Redis connection handling | Low | High | Implement circuit breaker + fallback |
| Team learning curve | High | Medium | Pair programming, code reviews, docs |

---

*Document Owner: Architecture Team*  
*Review Cycle: Per Sprint*  
*Next Review: Sprint Planning*