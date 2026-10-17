using System.Numerics;

namespace ShootingRange;

// Raycast contra os triângulos do cenário. Os triângulos são separados numa grade
// no plano XZ para que cada raio só teste os que estão perto dele.
public sealed class CollisionWorld
{
    private const float CellSize = 100f;

    private readonly Vector3[] _triangles;
    private readonly Dictionary<(int, int), List<int>> _cells = new();
    private readonly int[] _stamp;
    private int _query;

    public CollisionWorld(List<Vector3> triangles)
    {
        _triangles = triangles.ToArray();
        int count = _triangles.Length / 3;
        _stamp = new int[count];

        for (int t = 0; t < count; t++)
        {
            Vector3 a = _triangles[t * 3], b = _triangles[t * 3 + 1], c = _triangles[t * 3 + 2];
            Vector3 min = Vector3.Min(a, Vector3.Min(b, c));
            Vector3 max = Vector3.Max(a, Vector3.Max(b, c));
            for (int x = Cell(min.X); x <= Cell(max.X); x++)
            for (int z = Cell(min.Z); z <= Cell(max.Z); z++)
            {
                if (!_cells.TryGetValue((x, z), out var list))
                    _cells[(x, z)] = list = new List<int>();
                list.Add(t);
            }
        }
    }

    private static int Cell(float v) => (int)MathF.Floor(v / CellSize);

    // Retorna a distância até o primeiro triângulo atingido, ou null se não houver nenhum até maxDistance.
    public float? Raycast(Vector3 origin, Vector3 direction, float maxDistance)
    {
        Vector3 end = origin + direction * maxDistance;
        Vector3 min = Vector3.Min(origin, end);
        Vector3 max = Vector3.Max(origin, end);
        _query++;

        float? closest = null;
        for (int x = Cell(min.X); x <= Cell(max.X); x++)
        for (int z = Cell(min.Z); z <= Cell(max.Z); z++)
        {
            if (!_cells.TryGetValue((x, z), out var list)) continue;
            foreach (int t in list)
            {
                if (_stamp[t] == _query) continue;
                _stamp[t] = _query;
                float? hit = Intersect(origin, direction, _triangles[t * 3], _triangles[t * 3 + 1], _triangles[t * 3 + 2]);
                if (hit is float d && d <= maxDistance && (closest == null || d < closest))
                    closest = d;
            }
        }
        return closest;
    }

    // Möller–Trumbore, sem descartar a face de trás.
    private static float? Intersect(Vector3 origin, Vector3 dir, Vector3 a, Vector3 b, Vector3 c)
    {
        Vector3 e1 = b - a, e2 = c - a;
        Vector3 p = Vector3.Cross(dir, e2);
        float det = Vector3.Dot(e1, p);
        if (MathF.Abs(det) < 1e-8f) return null;
        float inv = 1f / det;
        Vector3 s = origin - a;
        float u = Vector3.Dot(s, p) * inv;
        if (u < 0 || u > 1) return null;
        Vector3 q = Vector3.Cross(s, e1);
        float v = Vector3.Dot(dir, q) * inv;
        if (v < 0 || u + v > 1) return null;
        float t = Vector3.Dot(e2, q) * inv;
        return t >= 0 ? t : null;
    }
}
