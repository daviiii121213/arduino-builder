using System.Numerics;

namespace ShootingRange;

public struct RayHit
{
    public float Distance;
    public Vector3 Normal;
    public bool IsGlass;
}

// Raycast contra os triângulos do cenário. Os triângulos são separados numa grade
// no plano XZ para que cada raio só teste os que estão perto dele.
public sealed class CollisionWorld
{
    private const float CellSize = 100f;

    private readonly Vector3[] _triangles;
    private readonly bool[] _glass;
    private readonly Dictionary<(int, int), List<int>> _cells = new();
    private readonly int[] _stamp;
    private int _query;

    public CollisionWorld(IEnumerable<DrawMesh> meshes)
    {
        var triangles = new List<Vector3>();
        var glass = new List<bool>();
        foreach (var mesh in meshes)
        {
            foreach (uint index in mesh.Indices)
                triangles.Add(Vector3.Transform(mesh.Positions[index], mesh.Transform));
            for (int t = 0; t < mesh.Indices.Length / 3; t++)
                glass.Add(mesh.IsGlass);
        }
        _triangles = triangles.ToArray();
        _glass = glass.ToArray();
        int count = _glass.Length;
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

    public int TriangleCount => _glass.Length;

    private static int Cell(float v) => (int)MathF.Floor(v / CellSize);

    // Primeiro triângulo atingido até maxDistance. Com ignoreGlass, o vidro é atravessado (como tiros no CS).
    public RayHit? Raycast(Vector3 origin, Vector3 direction, float maxDistance, bool ignoreGlass = false)
    {
        _query++;
        RayHit? closest = null;

        // Percorre as células ao longo do raio (DDA 2D), parando assim que achar um acerto mais próximo que a próxima célula.
        int cx = Cell(origin.X), cz = Cell(origin.Z);
        int stepX = direction.X > 0 ? 1 : -1, stepZ = direction.Z > 0 ? 1 : -1;
        float tDeltaX = direction.X != 0 ? MathF.Abs(CellSize / direction.X) : float.MaxValue;
        float tDeltaZ = direction.Z != 0 ? MathF.Abs(CellSize / direction.Z) : float.MaxValue;
        float nextX = (cx + (stepX > 0 ? 1 : 0)) * CellSize, nextZ = (cz + (stepZ > 0 ? 1 : 0)) * CellSize;
        float tMaxX = direction.X != 0 ? (nextX - origin.X) / direction.X : float.MaxValue;
        float tMaxZ = direction.Z != 0 ? (nextZ - origin.Z) / direction.Z : float.MaxValue;
        float tCellStart = 0;

        while (tCellStart <= maxDistance)
        {
            if (_cells.TryGetValue((cx, cz), out var list))
            {
                foreach (int t in list)
                {
                    if (_stamp[t] == _query) continue;
                    _stamp[t] = _query;
                    if (ignoreGlass && _glass[t]) continue;
                    Vector3 a = _triangles[t * 3], b = _triangles[t * 3 + 1], c = _triangles[t * 3 + 2];
                    if (Intersect(origin, direction, a, b, c, out float d, out _, out _) && d <= maxDistance
                        && (closest == null || d < closest.Value.Distance))
                    {
                        Vector3 n = Vector3.Normalize(Vector3.Cross(b - a, c - a));
                        if (Vector3.Dot(n, direction) > 0) n = -n;
                        closest = new RayHit { Distance = d, Normal = n, IsGlass = _glass[t] };
                    }
                }
            }

            float tCellEnd = MathF.Min(tMaxX, tMaxZ);
            if (closest != null && closest.Value.Distance <= tCellEnd) break;
            tCellStart = tCellEnd;
            if (tMaxX < tMaxZ) { cx += stepX; tMaxX += tDeltaX; }
            else { cz += stepZ; tMaxZ += tDeltaZ; }
        }
        return closest;
    }

    // Möller–Trumbore, sem descartar a face de trás. u e v são as coordenadas baricêntricas de b e c.
    public static bool Intersect(Vector3 origin, Vector3 dir, Vector3 a, Vector3 b, Vector3 c, out float t, out float u, out float v)
    {
        t = u = v = 0;
        Vector3 e1 = b - a, e2 = c - a;
        Vector3 p = Vector3.Cross(dir, e2);
        float det = Vector3.Dot(e1, p);
        if (MathF.Abs(det) < 1e-8f) return false;
        float inv = 1f / det;
        Vector3 s = origin - a;
        u = Vector3.Dot(s, p) * inv;
        if (u < 0 || u > 1) return false;
        Vector3 q = Vector3.Cross(s, e1);
        v = Vector3.Dot(dir, q) * inv;
        if (v < 0 || u + v > 1) return false;
        t = Vector3.Dot(e2, q) * inv;
        return t >= 0;
    }
}
