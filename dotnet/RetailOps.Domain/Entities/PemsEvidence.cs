using System;
using System.Collections.Generic;

namespace RetailOps.Domain.Entities;

public partial class PemsEvidence
{
    public string Id { get; set; } = null!;

    public string TaskInstanceId { get; set; } = null!;

    public string? SubTaskId { get; set; }

    public string? ActivityId { get; set; }

    public string FileName { get; set; } = null!;

    public string FileUrl { get; set; } = null!;

    public string FileType { get; set; } = null!;

    public long? FileSize { get; set; }

    public string? MimeType { get; set; }

    public string? Remarks { get; set; }

    public string UploadedBy { get; set; } = null!;

    public string? UploadedByName { get; set; }

    public DateTime UploadedAt { get; set; }

    public virtual PemsTaskInstances TaskInstance { get; set; } = null!;
}
