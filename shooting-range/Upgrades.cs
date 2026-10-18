using System.Globalization;
using System.Text;
using System.Text.Json;

namespace ShootingRange;

// Melhorias da arma compradas com créditos (os pontos feitos nas baias 1, 4, 6 e 9).
// Nomes e preços vêm de models/upgrades.json (o mesmo da versão web); os efeitos ficam aqui.
// O progresso é salvo em ~/.config/ShootingRange/progress.json (ou o equivalente no Windows).
public sealed class Upgrades
{
    public sealed record Definition(string Id, string Name, string Description, int Max, int BaseCost);

    public IReadOnlyList<Definition> All { get; }
    public int Credits { get; private set; }
    private readonly Dictionary<string, int> _levels = new();
    private readonly string _savePath;

    public Upgrades(string definitionsPath)
    {
        using var doc = JsonDocument.Parse(File.ReadAllText(definitionsPath));
        All = doc.RootElement.GetProperty("upgrades").EnumerateArray().Select(u => new Definition(
            u.GetProperty("id").GetString()!, u.GetProperty("name").GetString()!,
            u.GetProperty("description").GetString()!, u.GetProperty("max").GetInt32(),
            u.GetProperty("baseCost").GetInt32())).ToList();

        string folder = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "ShootingRange");
        _savePath = Path.Combine(folder, "progress.json");
        Load();
    }

    public int Level(string id) => _levels.GetValueOrDefault(id);
    public bool IsMax(Definition u) => Level(u.Id) >= u.Max;
    public int Cost(Definition u) => u.BaseCost * (Level(u.Id) + 1);
    public bool CanBuy(Definition u) => !IsMax(u) && Credits >= Cost(u);

    public bool Buy(Definition u)
    {
        if (!CanBuy(u)) return false;
        Credits -= Cost(u);
        _levels[u.Id] = Level(u.Id) + 1;
        Save();
        return true;
    }

    public void AddCredits(int amount)
    {
        if (amount <= 0) return;
        Credits += amount;
        Save();
    }

    public void Reset()
    {
        Credits = 0;
        _levels.Clear();
        Save();
    }

    // Efeitos (multiplicadores e acréscimos aplicados pela arma).
    public float RecoilMultiplier => 1 - 0.15f * Level("recoil");
    public float StabilityMultiplier => 1 - 0.10f * Level("stability");
    public float MovingMultiplier => 1 - 0.15f * Level("moving");
    public float ReloadSpeed => 1 / (1 - 0.10f * Level("reload"));
    public int ExtraRounds => 5 * Level("magazine");
    public int ExtraReserve => 30 * Level("reserve");
    public float RecoveryMultiplier => 1 + 0.25f * Level("recovery");
    public bool HasScope => Level("scope") > 0;

    // Texto do efeito no cartão: valor atual e o do próximo nível.
    public string EffectText(Definition u)
    {
        int l = Level(u.Id);
        string Pct(float v) => $"{MathF.Round(v * 100)}%";
        string Step(string now, string next) => IsMax(u) ? now : $"{now} > {next}";
        return u.Id switch
        {
            "recoil" => "RECUO " + Step(Pct(1 - 0.15f * l), Pct(1 - 0.15f * (l + 1))),
            "stability" => "IMPRECISAO " + Step(Pct(1 - 0.10f * l), Pct(1 - 0.10f * (l + 1))),
            "moving" => "ANDANDO " + Step(Pct(1 - 0.15f * l), Pct(1 - 0.15f * (l + 1))),
            "reload" => "TEMPO " + Step(Pct(1 - 0.10f * l), Pct(1 - 0.10f * (l + 1))),
            "magazine" => "PENTE " + Step($"{30 + 5 * l}", $"{30 + 5 * (l + 1)}"),
            "reserve" => "RESERVA " + Step($"{90 + 30 * l}", $"{90 + 30 * (l + 1)}"),
            "recovery" => "VELOCIDADE " + Step(Pct(1 + 0.25f * l), Pct(1 + 0.25f * (l + 1))),
            "scope" => "BOTAO DIREITO: ZOOM 2X",
            _ => u.Description,
        };
    }

    // A fonte bitmap do HUD só tem letras sem acento.
    public static string Plain(string text) => new string(text.Normalize(NormalizationForm.FormD)
        .Where(c => CharUnicodeInfo.GetUnicodeCategory(c) != UnicodeCategory.NonSpacingMark).ToArray()).ToUpperInvariant();

    private void Load()
    {
        try
        {
            if (!File.Exists(_savePath)) return;
            using var doc = JsonDocument.Parse(File.ReadAllText(_savePath));
            Credits = doc.RootElement.GetProperty("credits").GetInt32();
            foreach (var level in doc.RootElement.GetProperty("levels").EnumerateObject())
                if (All.FirstOrDefault(u => u.Id == level.Name) is { } u)
                    _levels[u.Id] = Math.Clamp(level.Value.GetInt32(), 0, u.Max);
        }
        catch (Exception e) when (e is IOException or JsonException or KeyNotFoundException or InvalidOperationException)
        {
            Console.WriteLine($"Não foi possível ler o progresso salvo ({e.Message}); começando do zero.");
        }
    }

    private void Save()
    {
        try
        {
            Directory.CreateDirectory(Path.GetDirectoryName(_savePath)!);
            File.WriteAllText(_savePath, JsonSerializer.Serialize(new { credits = Credits, levels = _levels }));
        }
        catch (IOException e)
        {
            Console.WriteLine($"Não foi possível salvar o progresso: {e.Message}");
        }
    }
}
