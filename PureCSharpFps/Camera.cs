using OpenTK.Mathematics;

namespace PureCSharpFps;

/// <summary>First-person camera: yaw/pitch mouse look, view and perspective matrices.</summary>
public sealed class Camera
{
    public const float MinFov = 50f;
    public const float MaxFov = 110f;
    private const float MaxPitch = 89f;

    private float _fov = 80f;

    public Vector3 Position { get; set; }
    public float Yaw { get; private set; } = -90f;   // degrees; -90 looks towards -Z
    public float Pitch { get; private set; }         // degrees, clamped to +-89
    public float AspectRatio { get; set; } = 16f / 9f;
    public float NearPlane { get; set; } = 0.05f;
    public float FarPlane { get; set; } = 300f;

    public float FovDegrees
    {
        get => _fov;
        set => _fov = Math.Clamp(value, MinFov, MaxFov);
    }

    public Vector3 Front
    {
        get
        {
            float yaw = MathHelper.DegreesToRadians(Yaw);
            float pitch = MathHelper.DegreesToRadians(Pitch);
            float cp = MathF.Cos(pitch);
            return new Vector3(MathF.Cos(yaw) * cp, MathF.Sin(pitch), MathF.Sin(yaw) * cp);
        }
    }

    /// <summary>Applies mouse deltas in pixels. Moving the mouse right turns right, up looks up.</summary>
    public void Rotate(float deltaX, float deltaY, float sensitivity)
    {
        Yaw += deltaX * sensitivity;
        Yaw %= 360f;
        Pitch = Math.Clamp(Pitch - deltaY * sensitivity, -MaxPitch, MaxPitch);
    }

    public Matrix4 GetViewMatrix() => Matrix4.LookAt(Position, Position + Front, Vector3.UnitY);

    public Matrix4 GetProjectionMatrix() =>
        Matrix4.CreatePerspectiveFieldOfView(MathHelper.DegreesToRadians(_fov), AspectRatio, NearPlane, FarPlane);
}
