using System.Numerics;
using StbImageSharp;

namespace ShootingRange;

public struct TargetHit
{
    public float Distance;
    public Vector3 Normal;
    public Vector3 LocalPoint; // ponto atingido relativo ao alvo (acompanha o alvo quando ele se move)
    public bool OnPaper;
    public Vector2 Uv;
}

// Um alvo (suporte + papel) que corre no trilho ao longo do eixo Z.
public sealed class ShootingTarget
{
    // Faixa de distância (Z do mundo) em que o alvo pode parar e velocidade do carrinho no trilho.
    public const float MinZ = -150f;
    public const float MaxZ = 760f;
    private const float TravelSpeed = 350f;
    private const float DelayBeforeMove = 0.35f;

    public string Name { get; }
    public List<DrawMesh> Meshes { get; }
    public Vector3 Offset { get; private set; }
    public float BaseZ { get; }
    public bool Moving => _waitTime > 0 || MathF.Abs(_destinationZ - Offset.Z) > 0.01f;

    private float _destinationZ;
    private float _waitTime;

    public ShootingTarget(string name, List<DrawMesh> meshes)
    {
        Name = name;
        Meshes = meshes;
        var all = meshes.SelectMany(m => m.Positions).ToList();
        BaseZ = all.Average(p => p.Z);
    }

    public float CurrentZ => BaseZ + Offset.Z;

    // Depois de um acerto, o alvo espera um instante (para ver o furo) e corre até outra distância.
    public void Relocate(Random random)
    {
        float z;
        do z = MinZ + (float)random.NextDouble() * (MaxZ - MinZ);
        while (MathF.Abs(z - CurrentZ) < 150f);
        _destinationZ = z - BaseZ;
        _waitTime = DelayBeforeMove;
    }

    public void Update(float dt)
    {
        if (_waitTime > 0)
        {
            _waitTime -= dt;
            return;
        }
        float dz = _destinationZ - Offset.Z;
        float step = TravelSpeed * dt;
        Offset = new Vector3(0, 0, MathF.Abs(dz) <= step ? _destinationZ : Offset.Z + MathF.Sign(dz) * step);
        var transform = Matrix4x4.CreateTranslation(Offset);
        foreach (var mesh in Meshes) mesh.Transform = transform;
    }

    public TargetHit? Raycast(Vector3 origin, Vector3 direction, float maxDistance)
    {
        Vector3 local = origin - Offset;
        TargetHit? best = null;
        foreach (var mesh in Meshes)
        {
            bool paper = mesh.MaterialName.Contains("Paper", StringComparison.OrdinalIgnoreCase);
            for (int i = 0; i < mesh.Indices.Length; i += 3)
            {
                uint ia = mesh.Indices[i], ib = mesh.Indices[i + 1], ic = mesh.Indices[i + 2];
                Vector3 a = mesh.Positions[ia], b = mesh.Positions[ib], c = mesh.Positions[ic];
                if (!CollisionWorld.Intersect(local, direction, a, b, c, out float t, out float u, out float v)) continue;
                if (t > maxDistance || (best != null && t >= best.Value.Distance)) continue;
                Vector3 n = Vector3.Normalize(Vector3.Cross(b - a, c - a));
                if (Vector3.Dot(n, direction) > 0) n = -n;
                best = new TargetHit
                {
                    Distance = t,
                    Normal = n,
                    LocalPoint = local + direction * t,
                    OnPaper = paper,
                    Uv = mesh.Uvs[ia] * (1 - u - v) + mesh.Uvs[ib] * u + mesh.Uvs[ic] * v,
                };
            }
        }
        return best;
    }
}

// Pontuação do papel do alvo. As medidas estão em pixels da textura "Target Paper_C" (1000x1000, y para baixo).
public sealed class TargetScoring
{
    private const float TextureSize = 1000f;

    // Anéis do tronco: formato de "pílula" vertical (retângulo com pontas redondas).
    private static readonly Vector2 BodyCenter = new(498.5f, 638.5f);
    private static readonly (float HalfWidth, float HalfHeight, int Points)[] BodyRings =
    {
        (48.5f, 75f, 10),     // X vermelho
        (101.5f, 151.5f, 9),
        (151.5f, 226.5f, 8),
        (202f, 301.5f, 7),
    };

    // Três miras redondas: cabeça e laterais.
    private static readonly Vector2[] BullseyeCenters = { new(498, 180), new(306, 236), new(692, 236) };
    private static readonly (float Radius, int Points)[] BullseyeRings = { (20f, 10), (44f, 9), (72f, 8) };

    // Qualquer outro ponto escuro (silhueta) vale isto; o papel branco vale zero.
    private const int SilhouettePoints = 5;

    private readonly ImageResult _paper;

    public TargetScoring(string paperTexturePath)
    {
        // Com o flip vertical ligado no StbImage, a linha 0 da imagem é a de baixo (v = 0).
        using var stream = File.OpenRead(paperTexturePath);
        _paper = ImageResult.FromStream(stream, ColorComponents.RedGreenBlueAlpha);
    }

    public int Score(Vector2 uv)
    {
        float u = uv.X - MathF.Floor(uv.X), v = uv.Y - MathF.Floor(uv.Y);
        var p = new Vector2(u * TextureSize, (1 - v) * TextureSize);

        foreach (var center in BullseyeCenters)
        {
            float d = Vector2.Distance(p, center);
            foreach (var (radius, points) in BullseyeRings)
                if (d <= radius) return points;
        }

        foreach (var (halfWidth, halfHeight, points) in BodyRings)
        {
            float dx = MathF.Abs(p.X - BodyCenter.X);
            float dy = MathF.Max(MathF.Abs(p.Y - BodyCenter.Y) - (halfHeight - halfWidth), 0);
            if (dx * dx + dy * dy <= halfWidth * halfWidth) return points;
        }

        int x = Math.Clamp((int)(u * _paper.Width), 0, _paper.Width - 1);
        int y = Math.Clamp((int)(v * _paper.Height), 0, _paper.Height - 1);
        int o = (y * _paper.Width + x) * 4;
        int brightness = Math.Min(_paper.Data[o], Math.Min(_paper.Data[o + 1], _paper.Data[o + 2]));
        return brightness < 160 ? SilhouettePoints : 0;
    }
}
