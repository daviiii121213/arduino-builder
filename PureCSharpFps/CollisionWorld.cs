using OpenTK.Mathematics;

namespace PureCSharpFps;

/// <summary>
/// Static world collision made of axis-aligned boxes. Collision data is kept separate from the
/// render data. The player volume is a simplified "capsule": an upright AABB with a square
/// footprint of 2*radius and a given height (documented in the README).
/// </summary>
public sealed class CollisionWorld
{
    private const float Epsilon = 1e-5f;

    private readonly List<Box3> _boxes = new();

    public IReadOnlyList<Box3> Boxes => _boxes;

    public void AddBox(Vector3 center, Vector3 size)
    {
        Vector3 half = size * 0.5f;
        _boxes.Add(new Box3(center - half, center + half));
    }

    /// <summary>
    /// Resolves penetration along one axis after the position was moved by <paramref name="direction"/>
    /// (sign) along it. Returns true if the player was pushed back by a box.
    /// Position is the feet center of the player.
    /// </summary>
    public bool ResolveAxis(ref Vector3 position, int axis, float direction, float radius, float height)
    {
        bool hit = false;

        for (int i = 0; i < _boxes.Count; i++)
        {
            Box3 b = _boxes[i];

            float minX = position.X - radius, maxX = position.X + radius;
            float minY = position.Y, maxY = position.Y + height;
            float minZ = position.Z - radius, maxZ = position.Z + radius;

            if (maxX <= b.Min.X + Epsilon || minX >= b.Max.X - Epsilon) continue;
            if (maxY <= b.Min.Y + Epsilon || minY >= b.Max.Y - Epsilon) continue;
            if (maxZ <= b.Min.Z + Epsilon || minZ >= b.Max.Z - Epsilon) continue;

            // Push the player out on the side it came from.
            float extentLow = axis == 1 ? 0f : radius;
            float extentHigh = axis == 1 ? height : radius;
            position[axis] = direction > 0f ? b.Min[axis] - extentHigh : b.Max[axis] + extentLow;
            hit = true;
        }

        return hit;
    }
}
