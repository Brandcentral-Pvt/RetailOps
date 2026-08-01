using System;
using System.Collections.Generic;

namespace RetailOps.Domain.Entities;

public partial class Downloads
{
    public string Id { get; set; } = null!;

    public string UserId { get; set; } = null!;

    public string FileName { get; set; } = null!;

    public string? FilePath { get; set; }

    public long? FileSize { get; set; }

    public string? Format { get; set; }

    public string? Status { get; set; }

    public string? Params { get; set; }

    public int? Progress { get; set; }

    public int? RowCount { get; set; }

    public string? ErrorMessage { get; set; }

    public DateTime? CreatedAt { get; set; }

    public DateTime? CompletedAt { get; set; }

    public DateTime? ExpiresAt { get; set; }

    public DateTime? DownloadedAt { get; set; }

    public int? DownloadCount { get; set; }
}
