namespace FreeFork.Models;

/// <summary>Продукт во встроенной базе (значения на 100 г / 100 мл).</summary>
public sealed class Food
{
    public string Id { get; set; } = "";
    public string Ru { get; set; } = "";
    public string En { get; set; } = "";
    public double Kcal { get; set; }
    public double P { get; set; }
    public double F { get; set; }
    public double C { get; set; }
    public double Fiber { get; set; }
    public double? PieceG { get; set; }
    public string? PieceRu { get; set; }
    public string? PieceEn { get; set; }
    public double PortionG { get; set; } = 100;
    public string Family { get; set; } = "";
    public string[] Aliases { get; set; } = [];
}

/// <summary>Продукт, который уходит на клиент (локальный или из Open Food Facts).</summary>
public sealed record FoodDto(
    string Id,
    string Name,
    double Kcal,
    double P,
    double F,
    double C,
    double Fiber,
    double? PieceG,
    string? PieceName,
    double PortionG,
    string Source,
    string? Brand = null);

public sealed class Recipe
{
    public string Id { get; set; } = "";
    public string Ru { get; set; } = "";
    public string En { get; set; } = "";
    public string[] Meals { get; set; } = [];
    public int Minutes { get; set; }
    public List<Ingredient> Ingredients { get; set; } = [];
    public string[] StepsRu { get; set; } = [];
    public string[] StepsEn { get; set; } = [];
}

public sealed class Ingredient
{
    public string Food { get; set; } = "";
    public double G { get; set; }
}

// ---- Запросы / ответы API ----
public sealed record ParseRequest(string? Text, string? Lang);

public sealed record ParsedItem(
    string Query,
    double Qty,
    string Unit,
    double Grams,
    FoodDto? Food,
    List<FoodDto> Alternatives);

public sealed record MacroLeft(double Kcal, double P, double F, double C);

public sealed record FridgeRequest(
    string? Text,
    MacroLeft? Remaining,
    string? Meal,
    bool AssumeStaples = true,
    string? Lang = null);

public sealed record RecipeIngredientDto(string Food, string Name, double Grams, bool Have, bool Staple);

public sealed record RecipeDto(
    string Id,
    string Name,
    int Minutes,
    string[] Meals,
    double Kcal, double P, double F, double C,
    double Scale,
    double KcalScaled, double PScaled, double FScaled, double CScaled,
    double Coverage,
    double Score,
    List<RecipeIngredientDto> Ingredients,
    string[] Steps);

public sealed record FridgeResponse(
    List<string> Recognized,
    List<string> Unrecognized,
    List<RecipeDto> Recipes);
