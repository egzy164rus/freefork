// FreeFork — статический сайт. Вся логика (подсчёт, поиск, рецепты) работает в браузере (wwwroot/js/engine.js),
// а облако (по желанию) — это Supabase. Этот проект нужен, чтобы запускать сайт локально из Visual Studio.
var builder = WebApplication.CreateBuilder(args);
var app = builder.Build();

app.UseDefaultFiles();
app.UseStaticFiles(new StaticFileOptions
{
    OnPrepareResponse = ctx =>
    {
        // Чтобы при разработке всегда видеть свежие файлы.
        ctx.Context.Response.Headers.CacheControl = "no-cache";
    }
});

app.Run();
