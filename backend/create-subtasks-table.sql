IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[TaskSubTasks]') AND type in (N'U'))
BEGIN
CREATE TABLE [dbo].[TaskSubTasks](
	[Id] [varchar](50) NOT NULL,
	[Code] [varchar](200) NOT NULL,
	[Title] [varchar](500) NOT NULL,
	[Description] [varchar](max) NULL,
	[Status] [varchar](50) NOT NULL,
	[AssigneeId] [varchar](50) NULL,
	[Priority] [varchar](50) NULL,
	[DueDate] [datetime] NULL,
	[CreatedBy] [varchar](50) NOT NULL,
	[CreatedAt] [datetime] NOT NULL,
	[UpdatedAt] [datetime] NULL,
 CONSTRAINT [PK_TaskSubTasks] PRIMARY KEY CLUSTERED 
 (
	[Id] ASC
 )WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
 ) ON [PRIMARY]
END