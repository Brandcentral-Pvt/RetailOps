using System;
using System.Collections.Generic;

namespace RetailOps.Domain.Entities;

public partial class Files
{
    public string Id { get; set; } = null!;

    public string FileName { get; set; } = null!;

    public string OriginalName { get; set; } = null!;

    public string FilePath { get; set; } = null!;

    public int? FileSize { get; set; }

    public string? MimeType { get; set; }

    public string? UploadedBy { get; set; }

    public string? RelatedTo { get; set; }

    public string? RelatedId { get; set; }

    public DateTime? CreatedAt { get; set; }

    public bool? Starred { get; set; }

    public bool? Trashed { get; set; }

    public DateTime? TrashedAt { get; set; }

    public string? Folder { get; set; }

    public string? StorageProvider { get; set; }

    public virtual Users? UploadedByNavigation { get; set; }
}
