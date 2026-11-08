using System.Globalization;
using System.Text.Json;
using Microsoft.Extensions.Caching.Memory;
using FreeFork.Models;

namespace FreeFork.Services;

/// <summary>Клиент бесплатного открытого API Open Food Facts (без ключей и регистрации).</summary>
public sealed class OpenFoodFacts(HttpClient http, IMemoryCache cache, ILogger<OpenFoodFacts> log)
{
    const string Fields = "code,product_name,product_name_ru,product_name_en,brands,nutriments,serving_quantity";

    public async Task<(List<FoodDto> Items, bool Ok)> SearchAsync(string query, string lang, CancellationToken ct)
    {
        query = query.Trim();
        if (query.Length < 2) return (new(), true);
        var key = $"off:s:{lang}:{query.ToLowerInvariant()}";
        if (cache.TryGetValue(key, out List<FoodDto>? hit) && hit != null) return (hit, true);
        try
        {
            var url = "https://world.openfoodfacts.org/cgi/search.pl?search_simple=1&action=process&json=1&page_size=15" +
                      $"&fields={Fields}&search_terms={Uri.EscapeDataString(query)}";
            using var resp = await GetWithRetryAsync(url, ct);
            resp.EnsureSuccessStatusCode();
            using var doc = JsonDocument.Parse(await resp.Content.ReadAsStringAsync(ct));
            var list = new List<FoodDto>();
            if (doc.RootElement.TryGetProperty("products", out var arr))
                foreach (var p in arr.EnumerateArray())
                {
                    var dto = ToDto(p, lang);
                    if (dto != null) list.Add(dto);
                }
            cache.Set(key, list, TimeSpan.FromHours(6));
            return (list, true);
        }
        catch (Exception ex) when (ex is not OperationCanceledException || !ct.IsCancellationRequested)
        {
            log.LogWarning("Open Food Facts search failed: {Msg}", ex.Message);
            return (new(), false);
        }
    }

    public async Task<FoodDto?> BarcodeAsync(string code, string lang, CancellationToken ct)
    {
        code = new string(code.Where(char.IsDigit).ToArray());
        if (code.Length is < 6 or > 14) return null;
        var key = $"off:b:{lang}:{code}";
        if (cache.TryGetValue(key, out FoodDto? hit)) return hit;
        try
        {
            var url = $"https://world.openfoodfacts.org/api/v2/product/{code}.json?fields={Fields}";
            using var resp = await GetWithRetryAsync(url, ct);
            if (!resp.IsSuccessStatusCode) return null;
            using var doc = JsonDocument.Parse(await resp.Content.ReadAsStringAsync(ct));
            if (!doc.RootElement.TryGetProperty("product", out var p)) return null;
            var dto = ToDto(p, lang);
            if (dto != null) cache.Set(key, dto, TimeSpan.FromHours(24));
            return dto;
        }
        catch (Exception ex) when (ex is not OperationCanceledException || !ct.IsCancellationRequested)
        {
            log.LogWarning("Open Food Facts barcode failed: {Msg}", ex.Message);
            return null;
        }
    }

    /// <summary>Open Food Facts иногда отвечает 5xx под нагрузкой — один повтор обычно спасает.</summary>
    async Task<HttpResponseMessage> GetWithRetryAsync(string url, CancellationToken ct)
    {
        var resp = await http.GetAsync(url, ct);
        if ((int)resp.StatusCode < 500) return resp;
        resp.Dispose();
        await Task.Delay(700, ct);
        return await http.GetAsync(url, ct);
    }

    static FoodDto? ToDto(JsonElement p, string lang)
    {
        if (!p.TryGetProperty("nutriments", out var n)) return null;
        double? kcal = Num(n, "energy-kcal_100g");
        if (kcal == null && Num(n, "energy_100g") is double kj) kcal = kj / 4.184;
        if (kcal == null) return null;
        string name = Str(p, lang.StartsWith("ru") ? "product_name_ru" : "product_name_en");
        if (name == "") name = Str(p, "product_name");
        if (name == "") return null;
        var code = Str(p, "code");
        var serving = Num(p, "serving_quantity");
        return new FoodDto(
            "off:" + code, name.Length > 80 ? name[..80] : name,
            Math.Round(kcal.Value, 1),
            Math.Round(Num(n, "proteins_100g") ?? 0, 1),
            Math.Round(Num(n, "fat_100g") ?? 0, 1),
            Math.Round(Num(n, "carbohydrates_100g") ?? 0, 1),
            Math.Round(Num(n, "fiber_100g") ?? 0, 1),
            null, null, serving is > 0 and < 2000 ? serving.Value : 100,
            "off", Str(p, "brands") is { Length: > 0 } b ? b.Split(',')[0] : null);
    }

    static string Str(JsonElement e, string name) =>
        e.TryGetProperty(name, out var v) && v.ValueKind == JsonValueKind.String ? (v.GetString() ?? "").Trim() : "";

    static double? Num(JsonElement e, string name)
    {
        if (!e.TryGetProperty(name, out var v)) return null;
        if (v.ValueKind == JsonValueKind.Number) return v.GetDouble();
        if (v.ValueKind == JsonValueKind.String &&
            double.TryParse(v.GetString(), NumberStyles.Float, CultureInfo.InvariantCulture, out var d)) return d;
        return null;
    }
}
