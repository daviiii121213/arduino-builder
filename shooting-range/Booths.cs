using System.Numerics;

namespace ShootingRange;

// Baias de tiro, numeradas como as placas do estande: a 1 fica em x = +747 e a 10 em x = -747 (166 cm cada).
// Só as baias 1, 4, 6 e 9 têm sessão com pontuação própria e resumo na saída.
public static class Booths
{
    public static readonly int[] Scored = { 1, 4, 6, 9 };
    private const float LaneWidth = 166f;
    private const float FirstLaneX = 747f;
    private const float EntryZ = -500f;   // passou do portão da baia
    private const float FrontZ = -353f;   // balcão de tiro

    // Número da baia onde o jogador está, ou null fora delas.
    public static int? At(Vector3 feet)
    {
        if (feet.Z < EntryZ || feet.Z > FrontZ) return null;
        int lane = (int)MathF.Round((FirstLaneX - feet.X) / LaneWidth) + 1;
        return lane is >= 1 and <= 10 ? lane : null;
    }

    public static int? ScoredAt(Vector3 feet) => At(feet) is int lane && Scored.Contains(lane) ? lane : null;
}

// Uma passagem por uma baia: pontos, tiros e quantos pontos o jogador tinha antes de cada erro.
public sealed class BoothSession
{
    public int Booth { get; }
    public int Score { get; private set; }
    public int Shots { get; private set; }
    public int Hits { get; private set; }
    // Pontos acumulados antes do 1º erro, do 2º erro e assim por diante.
    public List<int> PointsBeforeMiss { get; } = new();

    public BoothSession(int booth) => Booth = booth;

    // points = 0 é erro (parede, papel branco ou suporte do alvo).
    public void Record(int points)
    {
        Shots++;
        if (points > 0)
        {
            Hits++;
            Score += points;
        }
        else
        {
            PointsBeforeMiss.Add(Score);
        }
    }
}
