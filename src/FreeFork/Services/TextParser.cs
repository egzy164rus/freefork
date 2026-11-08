using System.Text.RegularExpressions;
using FreeFork.Models;

namespace FreeFork.Services;

/// <summary>
/// Разбор свободного текста: «2 яйца и тост, 150 г гречки, банан, стакан молока».
/// </summary>
public sealed class TextParser(FoodIndex index)
{
    enum U { None, Gram, Kg, Ml, Liter, Glass, Tbsp, Tsp, Piece, Portion }

    static readonly Dictionary<string, U> Units = new()
    {
        ["г"] = U.Gram, ["гр"] = U.Gram, ["грамм"] = U.Gram, ["грамма"] = U.Gram, ["граммов"] = U.Gram, ["g"] = U.Gram, ["gr"] = U.Gram, ["gram"] = U.Gram, ["grams"] = U.Gram,
        ["кг"] = U.Kg, ["килограмм"] = U.Kg, ["kg"] = U.Kg,
        ["мл"] = U.Ml, ["ml"] = U.Ml, ["миллилитров"] = U.Ml,
        ["л"] = U.Liter, ["литр"] = U.Liter, ["литра"] = U.Liter, ["литров"] = U.Liter, ["l"] = U.Liter, ["liter"] = U.Liter, ["litre"] = U.Liter,
        ["стакан"] = U.Glass, ["стакана"] = U.Glass, ["стаканов"] = U.Glass, ["glass"] = U.Glass, ["glasses"] = U.Glass, ["cup"] = U.Glass, ["cups"] = U.Glass, ["кружка"] = U.Glass, ["кружки"] = U.Glass,
        ["tbsp"] = U.Tbsp, ["tsp"] = U.Tsp,
        ["шт"] = U.Piece, ["штука"] = U.Piece, ["штуки"] = U.Piece, ["штук"] = U.Piece, ["pc"] = U.Piece, ["pcs"] = U.Piece, ["piece"] = U.Piece, ["pieces"] = U.Piece,
        ["кусок"] = U.Piece, ["куска"] = U.Piece, ["кусков"] = U.Piece, ["кусочек"] = U.Piece, ["кусочка"] = U.Piece, ["ломтик"] = U.Piece, ["ломтика"] = U.Piece, ["ломтиков"] = U.Piece,
        ["slice"] = U.Piece, ["slices"] = U.Piece, ["долька"] = U.Piece, ["дольки"] = U.Piece, ["зубчик"] = U.Piece, ["зубчика"] = U.Piece, ["clove"] = U.Piece, ["cloves"] = U.Piece,
        ["порция"] = U.Portion, ["порции"] = U.Portion, ["порций"] = U.Portion, ["portion"] = U.Portion, ["portions"] = U.Portion, ["serving"] = U.Portion, ["servings"] = U.Portion,
    };

    static readonly Dictionary<string, string> NumWords = new()
    {
        ["один"] = "1", ["одна"] = "1", ["одно"] = "1", ["одну"] = "1", ["one"] = "1",
        ["два"] = "2", ["две"] = "2", ["two"] = "2", ["три"] = "3", ["three"] = "3",
        ["четыре"] = "4", ["four"] = "4", ["пять"] = "5", ["five"] = "5",
        ["шесть"] = "6", ["six"] = "6", ["семь"] = "7", ["восемь"] = "8", ["девять"] = "9", ["десять"] = "10",
        ["полтора"] = "1.5", ["полторы"] = "1.5", ["пол"] = "0.5", ["половина"] = "0.5", ["половинка"] = "0.5", ["half"] = "0.5",
    };

    static readonly Regex SplitRx = new(@"[,;\n+]|\s+и\s+|\s+and\s+|\s+&\s+", RegexOptions.IgnoreCase | RegexOptions.Compiled);
    static readonly Regex FractionRx = new(@"(\d+)\s*/\s*(\d+)", RegexOptions.Compiled);
    static readonly Regex NumRx = new(@"(?<![\p{L}\d])(\d+(?:[.,]\d+)?)\s*([\p{L}]+)?", RegexOptions.Compiled);
    static readonly Regex WithRx = new(@"\s+(?:с|со|with)\s+", RegexOptions.IgnoreCase | RegexOptions.Compiled);

    public List<ParsedItem> Parse(string text, string lang)
    {
        var result = new List<ParsedItem>();
        if (string.IsNullOrWhiteSpace(text)) return result;
        if (text.Length > 1000) text = text[..1000];
        foreach (var raw in SplitRx.Split(text))
        {
            var seg = raw.Trim();
            if (seg.Length == 0) continue;
            result.AddRange(ParseSegment(seg, lang));
        }
        return result;
    }

    IEnumerable<ParsedItem> ParseSegment(string seg, string lang)
    {
        var s = Text.Norm(seg);
        // ложки и сокращения
        s = Regex.Replace(s, @"столов\p{L}*\s+ложк\p{L}*|(?<![\p{L}])ст\.?\s*л\.?(?![\p{L}])|(?<![\p{L}])ложк\p{L}*", " tbsp ");
        s = Regex.Replace(s, @"чайн\p{L}*\s+ложк\p{L}*|(?<![\p{L}])ч\.?\s*л\.?(?![\p{L}])", " tsp ");
        s = Regex.Replace(s, @"tablespoons?", " tbsp ");
        s = Regex.Replace(s, @"teaspoons?", " tsp ");
        // дроби и словесные числа
        s = FractionRx.Replace(s, m => (double.Parse(m.Groups[1].Value) / Math.Max(1, double.Parse(m.Groups[2].Value))).ToString("0.##", System.Globalization.CultureInfo.InvariantCulture));
        s = Regex.Replace(s, @"(?<![\p{L}])\p{L}+(?![\p{L}])", m => NumWords.TryGetValue(m.Value, out var d) ? d : m.Value);

        double qty = 0; U unit = U.None; bool hasNum = false;
        var nm = NumRx.Match(s);
        if (nm.Success)
        {
            qty = double.Parse(nm.Groups[1].Value.Replace(',', '.'), System.Globalization.CultureInfo.InvariantCulture);
            hasNum = true;
            string rest = nm.Groups[2].Success ? nm.Groups[2].Value : "";
            if (rest.Length > 0 && Units.TryGetValue(rest, out var u0))
            {
                unit = u0;
                s = s.Remove(nm.Index, nm.Length).Insert(nm.Index, " ");
            }
            else
            {
                s = s.Remove(nm.Groups[1].Index, nm.Groups[1].Length).Insert(nm.Groups[1].Index, " ");
                // оставили слово после числа (оно часть названия)
            }
        }
        // единицы без числа: «стакан молока», «tbsp sugar», «порция риса»
        var words = Text.Words(s);
        if (unit == U.None)
        {
            foreach (var w in words)
            {
                if (w == "tbsp") { unit = U.Tbsp; break; }
                if (w == "tsp") { unit = U.Tsp; break; }
                if (Units.TryGetValue(w, out var u1) && u1 is U.Glass or U.Portion) { unit = u1; break; }
            }
        }
        if (!hasNum) qty = 1;
        // убрать слова-единицы из названия
        var nameWords = words.Where(w => !Text.Stop.Contains(w) && w != "tbsp" && w != "tsp"
                                         && !(Units.TryGetValue(w, out var uu) && uu is U.Glass or U.Portion or U.Gram or U.Ml)).ToList();
        if (nameWords.Count == 0) yield break;
        var name = string.Join(' ', nameWords);

        // 1) полное совпадение; 2) разбиваем «X с Y»; 3) частичное совпадение
        var found = index.Search(name, 5);
        if (found.Count == 0)
        {
            var parts = WithRx.Split(" " + Text.Norm(seg) + " ").Select(p => p.Trim()).Where(p => p.Length > 0).ToList();
            if (parts.Count > 1)
            {
                bool first = true;
                foreach (var p in parts)
                {
                    var cleaned = string.Join(' ', Text.Content(Regex.Replace(p, @"\d+([.,]\d+)?|\p{L}*ложк\p{L}*", " ")));
                    var f = index.Search(cleaned, 5);
                    if (f.Count == 0) f = index.Search(cleaned, 5, requireAll: false);
                    if (f.Count == 0) { first = false; continue; }
                    yield return Build(p, first ? qty : 1, first ? unit : U.None, first && hasNum, f, lang);
                    first = false;
                }
                yield break;
            }
            found = index.Search(name, 5, requireAll: false);
        }
        if (found.Count == 0)
        {
            yield return new ParsedItem(seg, qty, unit.ToString(), 0, null, new());
            yield break;
        }
        yield return Build(seg, qty, unit, hasNum, found, lang);
    }

    ParsedItem Build(string query, double qty, U unit, bool hasNum, List<Food> found, string lang)
    {
        var f = found[0];
        double grams = unit switch
        {
            U.Gram => qty,
            U.Kg => qty * 1000,
            U.Ml => qty,
            U.Liter => qty * 1000,
            U.Glass => qty * 250,
            U.Tbsp => qty * 15,
            U.Tsp => qty * 5,
            U.Piece => qty * (f.PieceG ?? f.PortionG),
            U.Portion => qty * f.PortionG,
            _ => hasNum
                ? (f.PieceG.HasValue && qty < 20 ? qty * f.PieceG.Value : (qty >= 20 ? qty : qty * f.PortionG))
                : (f.PieceG ?? f.PortionG)
        };
        return new ParsedItem(
            query.Trim(), qty, unit.ToString(), Math.Round(grams),
            FoodIndex.ToDto(f, lang),
            found.Skip(1).Select(x => FoodIndex.ToDto(x, lang)).ToList());
    }
}
