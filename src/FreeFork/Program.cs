using System.Threading.RateLimiting;
using Microsoft.AspNetCore.HttpOverrides;
using FreeFork.Models;
using FreeFork.Services;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddMemoryCache();
// За Render/Vercel настоящий IP клиента приходит в X-Forwarded-For (нужно для лимитера).
builder.Services.Configure<ForwardedHeadersOptions>(o =>
{
    o.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    o.KnownNetworks.Clear();
    o.KnownProxies.Clear();
});
builder.Services.AddSingleton<FoodIndex>();
builder.Services.AddSingleton<TextParser>();
builder.Services.AddSingleton<RecipeEngine>();
builder.Services.AddHttpClient<OpenFoodFacts>(c =>
{
    c.Timeout = TimeSpan.FromSeconds(12);
    c.DefaultRequestHeaders.UserAgent.ParseAdd("FreeFork/1.0 (open-source calorie tracker)");
});
// Мягкая защита бесплатного сервиса от злоупотреблений (на пользователей не влияет).
builder.Services.AddRateLimiter(o =>
{
    o.RejectionStatusCode = 429;
    o.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(ctx =>
        RateLimitPartition.GetFixedWindowLimiter(
            ctx.Connection.RemoteIpAddress?.ToString() ?? "anon",
            _ => new FixedWindowRateLimiterOptions { PermitLimit = 300, Window = TimeSpan.FromMinutes(1) }));
});

var app = builder.Build();

app.UseForwardedHeaders();
app.UseRateLimiter();
app.UseDefaultFiles();
app.UseStaticFiles(new StaticFileOptions
{
    OnPrepareResponse = ctx =>
    {
        // Service worker и html всегда свежие, остальное кэшируем недолго.
        var name = ctx.File.Name;
        ctx.Context.Response.Headers.CacheControl =
            name is "sw.js" or "index.html" ? "no-cache" : "public,max-age=3600";
    }
});

var api = app.MapGroup("/api");

api.MapGet("/health", () => Results.Ok(new { ok = true, free = true }));

// Поиск по встроенной базе (мгновенно, работает без внешних сервисов).
api.MapGet("/foods/search", (string q, string? lang, FoodIndex idx) =>
{
    if (string.IsNullOrWhiteSpace(q) || q.Length > 80) return Results.Ok(Array.Empty<FoodDto>());
    var l = lang ?? "ru";
    return Results.Ok(idx.Search(q, 12, requireAll: true, typeahead: true).Select(f => FoodIndex.ToDto(f, l)));
});

// Поиск по Open Food Facts (миллионы продуктов, бесплатный API).
api.MapGet("/foods/online", async (string q, string? lang, OpenFoodFacts off, CancellationToken ct) =>
{
    if (string.IsNullOrWhiteSpace(q) || q.Length > 80) return Results.Ok(new { items = Array.Empty<FoodDto>(), ok = true });
    var (items, ok) = await off.SearchAsync(q, lang ?? "ru", ct);
    return Results.Ok(new { items, ok });
});

api.MapGet("/foods/barcode/{code}", async (string code, string? lang, OpenFoodFacts off, CancellationToken ct) =>
{
    var dto = await off.BarcodeAsync(code, lang ?? "ru", ct);
    return dto is null ? Results.NotFound() : Results.Ok(dto);
});

// «2 яйца и тост, 150 г гречки» -> список продуктов с граммовкой.
api.MapPost("/parse", (ParseRequest req, TextParser parser) =>
    Results.Ok(parser.Parse(req.Text ?? "", req.Lang ?? "ru")));

// Холодильник -> рецепты, подогнанные под остаток калорий и БЖУ.
api.MapPost("/fridge", (FridgeRequest req, RecipeEngine engine) =>
    Results.Ok(engine.Suggest(req)));

app.MapFallbackToFile("index.html");

app.Run();
