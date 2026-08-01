using System;
using System.Collections.Generic;

namespace RetailOps.Domain.Entities;

public partial class Users
{
    public string Id { get; set; } = null!;

    public string Email { get; set; } = null!;

    public string Password { get; set; } = null!;

    public string? FirstName { get; set; }

    public string? LastName { get; set; }

    public string? Phone { get; set; }

    public string? Avatar { get; set; }

    public string? RoleId { get; set; }

    public bool? IsEmailVerified { get; set; }

    public bool? IsActive { get; set; }

    public bool? IsOnline { get; set; }

    public DateTime? LastSeen { get; set; }

    public string? Preferences { get; set; }

    public string? RefreshToken { get; set; }

    public int? LoginAttempts { get; set; }

    public DateTime? LockUntil { get; set; }

    public DateTime? CreatedAt { get; set; }

    public DateTime? UpdatedAt { get; set; }

    public string? CurrentTeam { get; set; }

    public string? CometChatUid { get; set; }

    public string? ExtraPermissions { get; set; }

    public string? ExcludedPermissions { get; set; }

    public DateTime? PasswordChangedAt { get; set; }

    public DateTime? PasswordExpiresAt { get; set; }

    public DateTime? LastOtpSentAt { get; set; }

    public int? OtpSentCountToday { get; set; }

    public DateOnly? OtpResetDate { get; set; }

    public bool? IsFirstLogin { get; set; }

    public DateTime? FirstLoginAt { get; set; }

    public DateTime? SetupCompletedAt { get; set; }

    public bool? SecurityPolicyAccepted { get; set; }

    public bool? ForcePasswordReset { get; set; }

    public virtual ICollection<ActionHistory> ActionHistory { get; set; } = new List<ActionHistory>();

    public virtual ICollection<Actions> ActionsAssignedToNavigation { get; set; } = new List<Actions>();

    public virtual ICollection<Actions> ActionsCreatedByNavigation { get; set; } = new List<Actions>();

    public virtual ICollection<AlertRules> AlertRules { get; set; } = new List<AlertRules>();

    public virtual ICollection<Alerts> Alerts { get; set; } = new List<Alerts>();

    public virtual ICollection<ApiKeys> ApiKeys { get; set; } = new List<ApiKeys>();

    public virtual ICollection<CallLogs> CallLogsCaller { get; set; } = new List<CallLogs>();

    public virtual ICollection<CallLogs> CallLogsReceiver { get; set; } = new List<CallLogs>();

    public virtual ICollection<ConversationParticipants> ConversationParticipants { get; set; } = new List<ConversationParticipants>();

    public virtual ICollection<Files> Files { get; set; } = new List<Files>();

    public virtual ICollection<GmsTargets> GmsTargets { get; set; } = new List<GmsTargets>();

    public virtual ICollection<GoalTemplates> GoalTemplates { get; set; } = new List<GoalTemplates>();

    public virtual ICollection<Goals> Goals { get; set; } = new List<Goals>();

    public virtual ICollection<KeyResults> KeyResults { get; set; } = new List<KeyResults>();

    public virtual ICollection<MessageReactions> MessageReactions { get; set; } = new List<MessageReactions>();

    public virtual ICollection<MessageStatus> MessageStatus { get; set; } = new List<MessageStatus>();

    public virtual ICollection<Messages> Messages { get; set; } = new List<Messages>();

    public virtual ICollection<Notifications> Notifications { get; set; } = new List<Notifications>();

    public virtual ICollection<Objectives> Objectives { get; set; } = new List<Objectives>();

    public virtual Roles? Role { get; set; }

    public virtual ICollection<Rulesets> Rulesets { get; set; } = new List<Rulesets>();

    public virtual ICollection<SystemLogs> SystemLogs { get; set; } = new List<SystemLogs>();

    public virtual ICollection<TeamMembers> TeamMembers { get; set; } = new List<TeamMembers>();

    public virtual ICollection<Teams> Teams { get; set; } = new List<Teams>();

    public virtual ICollection<Users> BrandManager { get; set; } = new List<Users>();

    public virtual ICollection<Sellers> Seller { get; set; } = new List<Sellers>();

    public virtual ICollection<Users> Supervisor { get; set; } = new List<Users>();

    public virtual ICollection<Users> User { get; set; } = new List<Users>();

    public virtual ICollection<Users> UserNavigation { get; set; } = new List<Users>();
}
