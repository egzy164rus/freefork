using System.Text.Json;
using FreeFork.Models;

namespace FreeFork.Services;

/// <summary>
/// «Холодильник → рецепты»: подбирает блюда из имеющихся продуктов
/// и подгоняет размер порции под оставшиеся на день калории и БЖУ.
/// </summary>
public sealed class RecipeEngine
{
    static readonly HashSet<string> StapleIds = new()
    { "sunflower_oil", "olive_oil", "sugar", "flour", "soy_sauce", "garlic", "butter" };

    readonly FoodIndex _foods;
    readonly List<Recipe> _recipes;

    public RecipeEngine(IWebHostEnvironment env, FoodIndex foods)
    {
        _foods = foods;
        var path = Path.Combine(env.ContentRootPath, "Data", "recipes.json");
        _recipes = JsonSerializer.Deserialize<List<Recipe>>(File.ReadAllText(path),
            new JsonSerializerOptions { PropertyNameCaseInsensitive = true }) ?? new();
    }

    public int Count => _recipes.Count;

    public FridgeResponse Suggest(FridgeRequest req)
    {
        var lang = req.Lang ?? "ru";
        var en = lang.StartsWith("en");
        var recognized = new List<string>();
        var unrecognized = new List<string>();
        var haveFamilies = new HashSet<string>();
        var haveIds = new HashSet<string>();

        foreach (var raw in (req.Text ?? "").Split(new[] { ',', ';', '\n' }, StringSplitOptions.RemoveEmptyEntries))
        {
            var item = raw.Trim();
            if (item.Length == 0 || item.Length > 60) continue;
            var found = _foods.Search(item, 3);
            if (found.Count == 0) found = _foods.Search(item, 3, requireAll: false);
            if (found.Count == 0) { unrecognized.Add(item); continue; }
            haveFamilies.Add(found[0].Family);
            haveIds.Add(found[0].Id);
            recognized.Add(en ? found[0].En : found[0].Ru);
        }

        var rem = req.Remaining;
        bool hasRem = rem is { Kcal: > 50 };
        var list = new List<RecipeDto>();

        foreach (var r in _recipes)
        {
            double k = 0, p = 0, f = 0, c = 0;
            int keyTotal = 0, keyHave = 0;
            var ings = new List<(Ingredient ing, Food food, bool have, bool staple)>();
            foreach (var ing in r.Ingredients)
            {
                var food = _foods.ById[ing.Food];
                k += food.Kcal * ing.G / 100; p += food.P * ing.G / 100;
                f += food.F * ing.G / 100; c += food.C * ing.G / 100;
                bool staple = StapleIds.Contains(food.Id);
                bool have = haveFamilies.Contains(food.Family) || (staple && req.AssumeStaples);
                if (!staple) { keyTotal++; if (have) keyHave++; }
                ings.Add((ing, food, have, staple));
            }
            double coverage = keyTotal == 0 ? 1 : (double)keyHave / keyTotal;
            if (haveFamilies.Count > 0 && coverage < 0.5) continue;

            double scale = 1;
            if (hasRem)
                scale = Math.Clamp(Math.Round(rem!.Kcal / Math.Max(k, 1) * 4) / 4, 0.5, 2);
            double ks = k * scale, ps = p * scale;
            double fit = hasRem ? Math.Max(0, 1 - Math.Abs(ks - rem!.Kcal) / rem.Kcal) : 0.5;
            double protFit = hasRem && rem!.P > 5 ? Math.Min(1, ps / rem.P) : 0.5;
            double mealBonus = string.IsNullOrEmpty(req.Meal) || r.Meals.Contains(req.Meal) ? 1 : 0;
            double score = (haveFamilies.Count > 0 ? coverage * 60 : 0) + fit * 20 + protFit * 10 + mealBonus * 10;

            list.Add(new RecipeDto(
                r.Id, en ? r.En : r.Ru, r.Minutes, r.Meals,
                Math.Round(k), Math.Round(p, 1), Math.Round(f, 1), Math.Round(c, 1),
                scale, Math.Round(ks), Math.Round(ps, 1), Math.Round(f * scale, 1), Math.Round(c * scale, 1),
                Math.Round(coverage, 2), Math.Round(score, 1),
                ings.Select(x => new RecipeIngredientDto(
                    x.food.Id, en ? x.food.En : x.food.Ru, Math.Round(x.ing.G * scale), x.have, x.staple)).ToList(),
                en ? r.StepsEn : r.StepsRu));
        }

        return new FridgeResponse(recognized, unrecognized,
            list.OrderByDescending(x => x.Score).Take(12).ToList());
    }
}
