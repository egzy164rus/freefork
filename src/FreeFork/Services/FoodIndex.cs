using System.Text.Json;
using FreeFork.Models;

namespace FreeFork.Services;

/// <summary>Встроенная база продуктов и быстрый поиск по ней.</summary>
public sealed class FoodIndex
{
    readonly List<(Food Food, List<string[]> Phrases, HashSet<string> Norms)> _idx = new();
    public IReadOnlyList<Food> All { get; }
    public IReadOnlyDictionary<string, Food> ById { get; }

    public FoodIndex(IWebHostEnvironment env)
    {
        var path = Path.Combine(env.ContentRootPath, "Data", "foods.json");
        var opts = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
        var foods = JsonSerializer.Deserialize<List<Food>>(File.ReadAllText(path), opts) ?? new();
        All = foods;
        ById = foods.ToDictionary(f => f.Id);
        foreach (var f in foods)
        {
            var phrases = new List<string[]>();
            var norms = new HashSet<string>();
            foreach (var s in new[] { f.Ru, f.En }.Concat(f.Aliases))
            {
                var w = Text.Content(s).ToArray();
                if (w.Length == 0) continue;
                phrases.Add(w);
                norms.Add(string.Join(' ', w));
            }
            _idx.Add((f, phrases, norms));
        }
    }

    public static FoodDto ToDto(Food f, string lang)
    {
        var en = lang.StartsWith("en", StringComparison.OrdinalIgnoreCase);
        return new FoodDto(
            f.Id, en ? f.En : f.Ru, f.Kcal, f.P, f.F, f.C, f.Fiber,
            f.PieceG, en ? f.PieceEn : f.PieceRu, f.PortionG, "local");
    }

    /// <param name="requireAll">все слова запроса должны найтись в названии</param>
    /// <param name="typeahead">последнее слово можно вводить не до конца</param>
    public List<Food> Search(string query, int limit, bool requireAll = true, bool typeahead = false)
    {
        var qt = Text.Content(query);
        if (qt.Count == 0) return new();
        var qNorm = string.Join(' ', qt);
        var res = new List<(Food f, double score)>();
        int order = 0;
        foreach (var (food, phrases, norms) in _idx)
        {
            order++;
            double best = 0;
            foreach (var ph in phrases)
            {
                var used = new bool[ph.Length];
                int m = 0;
                for (int qi = 0; qi < qt.Count; qi++)
                {
                    bool pfx = typeahead && qi == qt.Count - 1;
                    for (int i = 0; i < ph.Length; i++)
                    {
                        if (!used[i] && Text.Stem(qt[qi], ph[i], pfx)) { used[i] = true; m++; break; }
                    }
                }
                if (m == 0 || (requireAll && m < qt.Count)) continue;
                int unmatched = ph.Length - m;
                double s = m * 10 - unmatched * 2 + (unmatched == 0 ? 5 : 0);
                if (string.Join(' ', ph) == qNorm) s += 10;
                best = Math.Max(best, s);
            }
            if (best > 0) res.Add((food, best - order * 0.001));
        }
        return res.OrderByDescending(r => r.score).Take(limit).Select(r => r.f).ToList();
    }
}
