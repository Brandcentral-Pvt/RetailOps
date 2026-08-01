using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using RetailOps.Api.Middleware;
using RetailOps.Infrastructure;
using RetailOps.Infrastructure.Security;
using Serilog;

var builder = WebApplication.CreateBuilder(args);

Log.Logger = new LoggerConfiguration()
    .ReadFrom.Configuration(builder.Configuration)
    .Enrich.FromLogContext()
    .WriteTo.Console()
    .WriteTo.File("Logs/retailops-.log", rollingInterval: RollingInterval.Day)
    .CreateLogger();
builder.Host.UseSerilog();

builder.Services.AddControllers()
    .ConfigureApiBehaviorOptions(options => options.SuppressModelStateInvalidFilter = true);

builder.Services.AddOpenApi();
builder.Services.AddInfrastructure(builder.Configuration);

var jwt = builder.Configuration.GetSection(JwtSettings.SectionName).Get<JwtSettings>();
if (jwt is null || string.IsNullOrEmpty(jwt.AccessSecret) || string.IsNullOrEmpty(jwt.RefreshSecret))
{
    Log.Logger.Fatal("JWT secrets are not configured. Set Jwt__AccessSecret and Jwt__RefreshSecret.");
    throw new InvalidOperationException("JWT secrets are not configured.");
}

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.RequireHttpsMetadata = false;
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = false,
            ValidateAudience = false,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwt.AccessSecret)),
            ClockSkew = TimeSpan.Zero
        };
        JwtBearerEventsFactory.Configure(options);
    });

builder.Services.AddAuthorization();

builder.Services.AddCors(options => options.AddPolicy("Default", policy =>
{
    var origins = new[]
    {
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:5175",
        "http://localhost:3000",
        "http://localhost:3001",
        "http://127.0.0.1:5173",
        "http://10.0.2.2:3001",
        "http://10.0.2.2:8081",
        builder.Configuration["FRONTEND_URL"] ?? string.Empty
    }.Where(o => !string.IsNullOrEmpty(o)).ToArray();

    policy.WithOrigins(origins)
        .AllowCredentials()
        .AllowAnyHeader()
        .AllowAnyMethod();
}));

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseMiddleware<ErrorHandlingMiddleware>();
app.UseSerilogRequestLogging();
app.UseHttpsRedirection();
app.UseCors("Default");
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

app.Run();
