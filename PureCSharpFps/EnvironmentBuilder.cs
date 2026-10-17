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

    private static readonly Vector3 Concrete = new(0.62f, 0.62f, 0.60f);
    private static readonly Vector3 DarkConcrete = new(0.42f, 0.43f, 0.45f);
    private static readonly Vector3 Floor = new(0.36f, 0.38f, 0.40f);
    private static readonly Vector3 Crate = new(0.72f, 0.52f, 0.30f);
    private static readonly Vector3 Red = new(0.86f, 0.18f, 0.16f);
    private static readonly Vector3 Blue = new(0.18f, 0.42f, 0.88f);
    private static readonly Vector3 Yellow = new(0.95f, 0.78f, 0.15f);
    private static readonly Vector3 Green = new(0.20f, 0.72f, 0.34f);
    private static readonly Vector3 Orange = new(0.95f, 0.50f, 0.12f);

    private readonly List<float> _instances = new(2048);
    private int _instanceCount;

    public CollisionWorld Collision { get; } = new();
    public float[] InstanceData => _instances.ToArray();
    public int InstanceCount => _instanceCount;
    public Vector3 SpawnPoint { get; private set; }

    /// <summary>Solid box: visible and collidable. Centered on <paramref name="center"/>.</summary>
    private void Solid(Vector3 center, Vector3 size, Vector3 color, bool grid = true)
    {
        Visual(center, size, color, grid);
        Collision.AddBox(center, size);
    }

    /// <summary>Solid box described by its base-center position (y = bottom).</summary>
    private void SolidOnGround(float x, float z, float sx, float sy, float sz, float baseY, Vector3 color, bool grid = true) =>
        Solid(new Vector3(x, baseY + sy * 0.5f, z), new Vector3(sx, sy, sz), color, grid);

    /// <summary>Render-only box (landmarks, floor markings).</summary>
    private void Visual(Vector3 center, Vector3 size, Vector3 color, bool grid = false)
    {
        _instances.Add(center.X); _instances.Add(center.Y); _instances.Add(center.Z);
        _instances.Add(size.X); _instances.Add(size.Y); _instances.Add(size.Z);
        _instances.Add(color.X); _instances.Add(color.Y); _instances.Add(color.Z);
        _instances.Add(grid ? 1f : 0f);
        _instanceCount++;
    }

    /// <summary>Wall along the X axis at depth z.</summary>
    private void WallX(float z, float x0, float x1, float height, Vector3 color, float thickness = 0.5f) =>
        SolidOnGround((x0 + x1) * 0.5f, z, x1 - x0, height, thickness, 0f, color);

    /// <summary>Wall along the Z axis at position x.</summary>
    private void WallZ(float x, float z0, float z1, float height, Vector3 color, float thickness = 0.5f) =>
        SolidOnGround(x, (z0 + z1) * 0.5f, thickness, height, z1 - z0, 0f, color);

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
        Solid(new Vector3(0f, -1f, 0f), new Vector3(Half * 2f + 4f, 2f, Half * 2f + 4f), Floor);

        WallX(-Half - 0.5f, -Half - 1f, Half + 1f, WallHeight, DarkConcrete, 1f);
        WallX(Half + 0.5f, -Half - 1f, Half + 1f, WallHeight, DarkConcrete, 1f);
        WallZ(-Half - 0.5f, -Half, Half, WallHeight, DarkConcrete, 1f);
        WallZ(Half + 0.5f, -Half, Half, WallHeight, DarkConcrete, 1f);
    }

    private void BuildOpenPracticeArea()
    {
        // Start pad and lane markings; the area itself (z > 12) is intentionally empty.
        Visual(new Vector3(0f, 0.01f, 30f), new Vector3(6f, 0.02f, 6f), Blue);
        for (int i = 0; i < 6; i++)
            Visual(new Vector3(-12f + i * 4.8f, 0.01f, 18f), new Vector3(1.2f, 0.02f, 0.3f), Yellow);
    }

    private void BuildJumpCourse()
    {
        // Pads of increasing gap; sprint-jump distance is roughly 4.9 m.
        float[] gaps = { 1.5f, 2.5f, 3.5f, 4.2f };
        float x = 12f;
        SolidOnGround(x, 32f, 4f, 0.5f, 4f, 0f, Green);
        x += 2f;
        foreach (float gap in gaps)
        {
            x += gap + 2f;
            SolidOnGround(x, 32f, 4f, 0.5f, 4f, 0f, Green);
            x += 2f;
        }
    }

    private void BuildStairsAndPlatforms()
    {
        // Staircase whose steps are 0.7 m high (a jump reaches about 0.84 m).
        for (int i = 0; i < 4; i++)
        {
            float h = 0.7f * (i + 1);
            SolidOnGround(-33f + i * 2.5f, 22f, 2.5f, h, 6f, 0f, i % 2 == 0 ? Concrete : DarkConcrete);
        }

        // Raised platform at the top of the stairs, plus a second, higher one.
        SolidOnGround(-18.25f, 22f, 12f, 2.8f, 8f, 0f, Concrete);
        SolidOnGround(-24f, 12f, 4f, 0.7f, 4f, 0f, Orange);
        SolidOnGround(-27f, 12f, 4f, 1.4f, 4f, 0f, Orange);
        SolidOnGround(-18.25f, 22f, 4f, 0.7f, 4f, 2.8f, Yellow);
    }

    private void BuildCorridors()
    {
        const float H = 4f;

        // Serpentine corridors, 6 m wide, running east-west.
        WallX(-8f, -38f, 8f, H, Concrete);
        WallX(-14f, -8f, 38f, H, Concrete);
        WallX(-20f, -38f, 20f, H, Concrete);
        WallX(-26f, -20f, 38f, H, Concrete);

        // Dead-end side cell with a narrow 1.5 m entrance and a corner.
        WallZ(-30f, -38f, -26f, H, DarkConcrete);
        WallZ(-26.5f, -38f, -32f, H, DarkConcrete);

        // Very narrow passage (1.4 m) towards the north-east.
        WallZ(27f, -38f, -28f, 3.5f, Concrete);
        WallZ(28.4f, -38f, -28f, 3.5f, Concrete);

        // Short wide corner room.
        WallZ(14f, -38f, -32f, H, DarkConcrete);
        WallX(-32f, 14f, 22f, H, DarkConcrete);

        // Free-standing pillars to weave around.
        for (int i = 0; i < 4; i++)
            SolidOnGround(-30f + i * 6f, 4f, 1.2f, 3f, 1.2f, 0f, DarkConcrete);
    }

    private void BuildCrateField()
    {
        // Pseudo-random but deterministic scatter of crates of several sizes.
        var rng = new Random(12345);
        for (int i = 0; i < 18; i++)
        {
            float x = 8f + (float)rng.NextDouble() * 28f;
            float z = -4f + (float)rng.NextDouble() * 14f;
            float s = 1f + (float)rng.Next(0, 3) * 0.5f;
            SolidOnGround(x, z, s, s, s, 0f, Crate);
        }

        // Two big stacked crates.
        SolidOnGround(32f, 16f, 3f, 1.5f, 3f, 0f, Crate);
        SolidOnGround(32f, 16f, 1.5f, 1.5f, 1.5f, 1.5f, Crate);
    }

    private void BuildLandmarks()
    {
        // Colored sign panels stuck on the boundary walls (render only, thin).
        float y = 3.2f;
        Visual(new Vector3(0f, y, -Half + 0.02f), new Vector3(8f, 2.4f, 0.04f), Red);
        Visual(new Vector3(0f, y, Half - 0.02f), new Vector3(8f, 2.4f, 0.04f), Blue);
        Visual(new Vector3(-Half + 0.02f, y, 0f), new Vector3(0.04f, 2.4f, 8f), Yellow);
        Visual(new Vector3(Half - 0.02f, y, 0f), new Vector3(0.04f, 2.4f, 8f), Green);

        // Small geometric details on the panels.
        Visual(new Vector3(0f, y, -Half + 0.05f), new Vector3(2f, 2f, 0.04f), Yellow);
        Visual(new Vector3(0f, y, Half - 0.05f), new Vector3(2f, 2f, 0.04f), Orange);

        // Tall colored corner pillars (solid) visible from far away.
        float c = Half - 2f;
        SolidOnGround(-c, -c, 2f, 9f, 2f, 0f, Red, false);
        SolidOnGround(c, -c, 2f, 9f, 2f, 0f, Green, false);
        SolidOnGround(-c, c, 2f, 9f, 2f, 0f, Yellow, false);
        SolidOnGround(c, c, 2f, 9f, 2f, 0f, Blue, false);

        // Colored stripes on the corridor walls for orientation.
        Visual(new Vector3(-20f, 2f, -8f + 0.27f), new Vector3(6f, 0.5f, 0.04f), Orange);
        Visual(new Vector3(20f, 2f, -14f - 0.27f), new Vector3(6f, 0.5f, 0.04f), Blue);
    }
}
