using System;
using System.Collections.Generic;

namespace RetailOps.Domain.Entities;

public partial class Sellers
{
    public string Id { get; set; } = null!;

    public string Name { get; set; } = null!;

    public string? Marketplace { get; set; }

    public string? SellerId { get; set; }

    public string? OctoparseId { get; set; }

    public bool? IsActive { get; set; }

    public string? Plan { get; set; }

    public int? ScrapeLimit { get; set; }

    public int? ScrapeUsed { get; set; }

    public DateTime? LastScrapedAt { get; set; }

    public string? OctoparseConfig { get; set; }

    public string? KeepaConfig { get; set; }

    public DateTime? CreatedAt { get; set; }

    public DateTime? UpdatedAt { get; set; }

    public string? KeepaSellerId { get; set; }

    public int? KeepaDomainId { get; set; }

    public DateTime? LastKeepaSync { get; set; }

    public int? KeepaAsinCount { get; set; }

    public string? CometChatUid { get; set; }

    public bool? IsPriority { get; set; }

    public string? LiveSyncClientId { get; set; }

    public string? LiveSyncClientSecret { get; set; }

    public string? PartnerTag { get; set; }

    public bool? LiveSyncEnabled { get; set; }

    public DateTime? LastLiveSyncAt { get; set; }

    public string? Email { get; set; }

    public virtual ICollection<Actions> Actions { get; set; } = new List<Actions>();

    public virtual ICollection<Alerts> Alerts { get; set; } = new List<Alerts>();

    public virtual ICollection<Asins> Asins { get; set; } = new List<Asins>();

    public virtual ICollection<OctoTasks> OctoTasks { get; set; } = new List<OctoTasks>();

    public virtual ICollection<RevenueCalculators> RevenueCalculators { get; set; } = new List<RevenueCalculators>();

    public virtual ICollection<Users> User { get; set; } = new List<Users>();
}
