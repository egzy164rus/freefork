using System.Text.RegularExpressions;

namespace FreeFork.Services;

/// <summary>Нормализация текста и "мягкое" сравнение слов (учёт окончаний, ru/en).</summary>
public static class Text
{
    static readonly Regex WordRx = new(@"[\p{L}]+", RegexOptions.Compiled);

    public static readonly HashSet<string> Stop = new()
    {
        "с", "со", "и", "из", "на", "в", "для", "по", "of", "with", "and", "a", "an", "the", "some"
    };

    public static string Norm(string s) => s.ToLowerInvariant().Replace('ё', 'е');

    public static List<string> Words(string s) =>
        WordRx.Matches(Norm(s)).Select(m => m.Value).ToList();

    public static List<string> Content(string s) =>
        Words(s).Where(w => !Stop.Contains(w)).ToList();

    /// <summary>
    /// Слова считаются совпавшими, если у них общий корень:
    /// яйца~яйцо, гречки~гречка, eggs~egg. В режиме prefix допускается ввод начала слова.
    /// </summary>
    public static bool Stem(string a, string b, bool prefix = false)
    {
        if (a == b) return true;
        int m = Math.Min(a.Length, b.Length);
        int l = 0;
        while (l < m && a[l] == b[l]) l++;
        if (prefix && l == a.Length && a.Length >= 2) return true;
        if (l < 3) return false;
        return l >= m - 2 && Math.Max(a.Length, b.Length) - l <= 3;
    }
}
