using OpenTK.Mathematics;

namespace PureCSharpFps;

/// <summary>
/// Generates the training environment procedurally. Solid boxes feed both the render list and the
/// collision world; decorative panels only feed the render list.
/// Units are meters, +Y is up, the floor top is at y = 0.
/// </summary>
public sealed class EnvironmentBuilder
{
    private const float Half = 40f;          // half extent of the playable floor
    private const float WallHeight = 6f;

    // Flat accent colors (used only for untextured markings: no supplied texture fits these).
    private static readonly Vector3 Red = new(0.86f, 0.18f, 0.16f);
    private static readonly Vector3 Blue = new(0.18f, 0.42f, 0.88f);
    private static readonly Vector3 Yellow = new(0.95f, 0.78f, 0.15f);
    private static readonly Vector3 Green = new(0.20f, 0.72f, 0.34f);
    private static readonly Vector3 Orange = new(0.95f, 0.50f, 0.12f);

    private readonly Dictionary<Material, List<float>> _batches = new();
    private readonly EnvironmentMaterials _m;

    public EnvironmentBuilder(EnvironmentMaterials materials) => _m = materials;

    public CollisionWorld Collision { get; } = new();
    public Vector3 SpawnPoint { get; private set; }

    /// <summary>Per-material instance data (center, size, color per box) ready for upload.</summary>
    public IEnumerable<(Material Material, float[] Data, int Count)> GetBatches()
    {
        foreach (var (material, list) in _batches)
            yield return (material, list.ToArray(), list.Count / Mesh.FloatsPerInstance);
    }

    /// <summary>Solid box: visible and collidable. Centered on <paramref name="center"/>.</summary>
    private void Solid(Vector3 center, Vector3 size, Material material, Vector3? color = null)
    {
        Visual(center, size, material, color);
        Collision.AddBox(center, size);
    }

    /// <summary>Solid box described by its base-center position (y = bottom).</summary>
    private void SolidOnGround(float x, float z, float sx, float sy, float sz, float baseY, Material material, Vector3? color = null) =>
        Solid(new Vector3(x, baseY + sy * 0.5f, z), new Vector3(sx, sy, sz), material, color);

    /// <summary>Render-only box (landmarks, floor markings).</summary>
    private void Visual(Vector3 center, Vector3 size, Material material, Vector3? color = null)
    {
        if (!_batches.TryGetValue(material, out List<float>? list))
            _batches[material] = list = new List<float>(256);

        Vector3 c = color ?? Vector3.One;
        list.Add(center.X); list.Add(center.Y); list.Add(center.Z);
        list.Add(size.X); list.Add(size.Y); list.Add(size.Z);
        list.Add(c.X); list.Add(c.Y); list.Add(c.Z);
    }

    /// <summary>Wall along the X axis at depth z.</summary>
    private void WallX(float z, float x0, float x1, float height, Material material, float thickness = 0.5f) =>
        SolidOnGround((x0 + x1) * 0.5f, z, x1 - x0, height, thickness, 0f, material);

    /// <summary>Wall along the Z axis at position x.</summary>
    private void WallZ(float x, float z0, float z1, float height, Material material, float thickness = 0.5f) =>
        SolidOnGround(x, (z0 + z1) * 0.5f, thickness, height, z1 - z0, 0f, material);

    public void Build()
    {
        BuildFloorAndBoundary();
        BuildOpenPracticeArea();
        BuildJumpCourse();
        BuildStairsAndPlatforms();
        BuildCorridors();
        BuildCrateField();
        BuildLandmarks();

        SpawnPoint = new Vector3(0f, 0.01f, 30f);
    }

    private void BuildFloorAndBoundary()
    {
        // Thick floor so the player can never fall through; top surface at y = 0.
        Solid(new Vector3(0f, -1f, 0f), new Vector3(Half * 2f + 4f, 2f, Half * 2f + 4f), _m.Floor);

        WallX(-Half - 0.5f, -Half - 1f, Half + 1f, WallHeight, _m.PerimeterWall, 1f);
        WallX(Half + 0.5f, -Half - 1f, Half + 1f, WallHeight, _m.PerimeterWall, 1f);
        WallZ(-Half - 0.5f, -Half, Half, WallHeight, _m.PerimeterWall, 1f);
        WallZ(Half + 0.5f, -Half, Half, WallHeight, _m.PerimeterWall, 1f);
    }

    private void BuildOpenPracticeArea()
    {
        // Start pad and lane markings; the area itself (z > 12) is intentionally empty.
        Visual(new Vector3(0f, 0.01f, 30f), new Vector3(6f, 0.02f, 6f), _m.Flat, Blue);
        for (int i = 0; i < 6; i++)
            Visual(new Vector3(-12f + i * 4.8f, 0.01f, 18f), new Vector3(1.2f, 0.02f, 0.3f), _m.Flat, Yellow);
    }

    private void BuildJumpCourse()
    {
        // Pads of increasing gap; sprint-jump distance is roughly 4.9 m.
        float[] gaps = { 1.5f, 2.5f, 3.5f, 4.2f };
        float x = 12f;
        SolidOnGround(x, 32f, 4f, 0.5f, 4f, 0f, _m.Platform);
        x += 2f;
        foreach (float gap in gaps)
        {
            x += gap + 2f;
            SolidOnGround(x, 32f, 4f, 0.5f, 4f, 0f, _m.Platform);
            x += 2f;
        }
    }

    private void BuildStairsAndPlatforms()
    {
        // Staircase whose steps are 0.7 m high (a jump reaches about 0.84 m).
        for (int i = 0; i < 4; i++)
        {
            float h = 0.7f * (i + 1);
            SolidOnGround(-33f + i * 2.5f, 22f, 2.5f, h, 6f, 0f, _m.Platform);
        }

        // Raised platform at the top of the stairs, plus lower side steps.
        SolidOnGround(-18.25f, 22f, 12f, 2.8f, 8f, 0f, _m.Platform);
        SolidOnGround(-24f, 12f, 4f, 0.7f, 4f, 0f, _m.Platform);
        SolidOnGround(-27f, 12f, 4f, 1.4f, 4f, 0f, _m.Platform);
        SolidOnGround(-18.25f, 22f, 4f, 0.7f, 4f, 2.8f, _m.Platform);
    }

    private void BuildCorridors()
    {
        const float H = 4f;
        Material w = _m.CorridorWall;

        // Serpentine corridors, 6 m wide, running east-west.
        WallX(-8f, -38f, 8f, H, w);
        WallX(-14f, -8f, 38f, H, w);
        WallX(-20f, -38f, 20f, H, w);
        WallX(-26f, -20f, 38f, H, w);

        // Dead-end side cell with a narrow 1.5 m entrance and a corner.
        WallZ(-30f, -38f, -26f, H, w);
        WallZ(-26.5f, -38f, -32f, H, w);

        // Very narrow passage (1.4 m) towards the north-east.
        WallZ(27f, -38f, -28f, 3.5f, w);
        WallZ(28.4f, -38f, -28f, 3.5f, w);

        // Short wide corner room.
        WallZ(14f, -38f, -32f, H, w);
        WallX(-32f, 14f, 22f, H, w);

        // Free-standing pillars to weave around.
        for (int i = 0; i < 4; i++)
            SolidOnGround(-30f + i * 6f, 4f, 1.2f, 3f, 1.2f, 0f, w);
    }

    private void BuildCrateField()
    {
        // Pseudo-random but deterministic scatter of training boxes of several sizes.
        var rng = new Random(12345);
        for (int i = 0; i < 18; i++)
        {
            float x = 8f + (float)rng.NextDouble() * 28f;
            float z = -4f + (float)rng.NextDouble() * 14f;
            float s = 1f + (float)rng.Next(0, 3) * 0.5f;
            SolidOnGround(x, z, s, s, s, 0f, _m.Crate);
        }

        // Two big stacked boxes.
        SolidOnGround(32f, 16f, 3f, 1.5f, 3f, 0f, _m.Crate);
        SolidOnGround(32f, 16f, 1.5f, 1.5f, 1.5f, 1.5f, _m.Crate);
    }

    /// <summary>Thin poster on a boundary wall, facing the given direction (+Z/-Z/+X/-X wall).</summary>
    private void Poster(Material material, Vector3 wallPoint, Vector3 normal, float size)
    {
        const float thickness = 0.04f;
        Vector3 center = wallPoint + normal * (thickness * 0.5f);
        Vector3 dims = MathF.Abs(normal.Z) > 0.5f ? new Vector3(size, size, thickness) : new Vector3(thickness, size, size);
        Visual(center, dims, material);
    }

    private void BuildLandmarks()
    {
        const float y = 3.2f;

        // North wall (seen from the spawn): the supplied sign and target images.
        Poster(_m.WarningSign, new Vector3(-8f, y, -Half), Vector3.UnitZ, 3.2f);
        Poster(_m.Signage, new Vector3(8f, y, -Half), Vector3.UnitZ, 3.2f);
        Poster(_m.TargetPaper, new Vector3(-22f, y, -Half), Vector3.UnitZ, 2.6f);
        Poster(_m.TargetPaper, new Vector3(22f, y, -Half), Vector3.UnitZ, 2.6f);

        // South wall (behind the spawn).
        Poster(_m.WarningSign, new Vector3(0f, y, Half), -Vector3.UnitZ, 3.2f);
        Poster(_m.Signage, new Vector3(-16f, y, Half), -Vector3.UnitZ, 3.2f);
        Poster(_m.TargetPaper, new Vector3(16f, y, Half), -Vector3.UnitZ, 2.6f);

        // West and east walls.
        Poster(_m.Signage, new Vector3(-Half, y, 0f), Vector3.UnitX, 3.2f);
        Poster(_m.TargetPaper, new Vector3(-Half, y, -16f), Vector3.UnitX, 2.6f);
        Poster(_m.WarningSign, new Vector3(Half, y, 0f), -Vector3.UnitX, 3.2f);
        Poster(_m.TargetPaper, new Vector3(Half, y, 16f), -Vector3.UnitX, 2.6f);

        // Corner pillars visible from far away: the supplied red "button" image on two, flat accents on the others.
        float c = Half - 2f;
        SolidOnGround(-c, -c, 2f, 9f, 2f, 0f, _m.RedPanel);
        SolidOnGround(c, -c, 2f, 9f, 2f, 0f, _m.Flat, Green);
        SolidOnGround(-c, c, 2f, 9f, 2f, 0f, _m.Flat, Yellow);
        SolidOnGround(c, c, 2f, 9f, 2f, 0f, _m.Flat, Blue);

        // Colored stripes on the corridor walls for orientation.
        Visual(new Vector3(-20f, 2f, -8f + 0.27f), new Vector3(6f, 0.5f, 0.04f), _m.Flat, Orange);
        Visual(new Vector3(20f, 2f, -14f - 0.27f), new Vector3(6f, 0.5f, 0.04f), _m.Flat, Blue);
    }
}
