using OpenTK.Mathematics;

namespace PureCSharpFps;

/// <summary>Movement intent for one frame; keeps the controller independent from the input API.</summary>
public struct MoveInput
{
    public float Forward;   // -1..1
    public float Strafe;    // -1 (left) .. 1 (right)
    public bool Jump;
    public bool Sprint;
}

/// <summary>Custom kinematic controller: walk/sprint, jump, gravity and AABB collision, no physics engine.</summary>
public sealed class PlayerController
{
    public float WalkSpeed = 5.0f;
    public float SprintSpeed = 8.0f;
    public float JumpVelocity = 5.5f;
    public float Gravity = -18.0f;
    public float Height = 1.8f;
    public float Radius = 0.35f;
    public float EyeHeight = 1.65f;
    public float MouseSensitivity = 0.12f;

    /// <summary>Largest distance moved per collision step, smaller than any wall thickness (no tunneling).</summary>
    private const float MaxStep = 0.1f;
    private const float MaxDeltaTime = 0.05f;
    private const float KillPlaneY = -30f;

    private readonly Vector3 _spawn;
    private Vector3 _velocity;

    /// <summary>Feet center of the player.</summary>
    public Vector3 Position { get; private set; }
    public Vector3 Velocity => _velocity;
    public bool IsGrounded { get; private set; }
    public Vector3 EyePosition => Position + new Vector3(0f, EyeHeight, 0f);

    public PlayerController(Vector3 spawn)
    {
        _spawn = spawn;
        Position = spawn;
    }

    public void Update(float deltaTime, in MoveInput input, float yawDegrees, CollisionWorld world)
    {
        float dt = Math.Min(deltaTime, MaxDeltaTime);
        if (dt <= 0f) return;

        // Horizontal wish direction depends on yaw only, so looking up never lifts the player.
        float yaw = MathHelper.DegreesToRadians(yawDegrees);
        var forward = new Vector3(MathF.Cos(yaw), 0f, MathF.Sin(yaw));
        var right = new Vector3(-MathF.Sin(yaw), 0f, MathF.Cos(yaw));
        Vector3 wish = forward * input.Forward + right * input.Strafe;
        if (wish.LengthSquared > 1e-6f) wish.Normalize();   // diagonals are not faster

        float speed = input.Sprint ? SprintSpeed : WalkSpeed;
        _velocity.X = wish.X * speed;
        _velocity.Z = wish.Z * speed;

        if (input.Jump && IsGrounded)
        {
            _velocity.Y = JumpVelocity;
            IsGrounded = false;
        }

        _velocity.Y += Gravity * dt;

        Vector3 delta = _velocity * dt;
        float longest = Math.Max(Math.Abs(delta.X), Math.Max(Math.Abs(delta.Y), Math.Abs(delta.Z)));
        int steps = Math.Max(1, (int)MathF.Ceiling(longest / MaxStep));
        Vector3 stepDelta = delta / steps;

        Vector3 pos = Position;
        bool grounded = false;

        for (int i = 0; i < steps; i++)
        {
            // Axes are resolved one at a time so the player slides along walls.
            pos.X += stepDelta.X;
            if (world.ResolveAxis(ref pos, 0, stepDelta.X, Radius, Height)) _velocity.X = 0f;

            pos.Z += stepDelta.Z;
            if (world.ResolveAxis(ref pos, 2, stepDelta.Z, Radius, Height)) _velocity.Z = 0f;

            pos.Y += stepDelta.Y;
            if (world.ResolveAxis(ref pos, 1, stepDelta.Y, Radius, Height))
            {
                if (stepDelta.Y < 0f) grounded = true;
                _velocity.Y = 0f;
                stepDelta.Y = 0f;   // stop vertical motion for the remaining steps of this frame
            }
        }

        IsGrounded = grounded;
        Position = pos;

        if (Position.Y < KillPlaneY)
        {
            Position = _spawn;
            _velocity = Vector3.Zero;
        }
    }
}
