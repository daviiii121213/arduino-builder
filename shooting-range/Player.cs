using System.Numerics;

namespace ShootingRange;

// Movimento no estilo da Source (CS2): aceleração e atrito no chão, controle limitado no ar,
// pulo com gravidade e agachar. Unidades em centímetros (1 unidade do CS ≈ 1 cm aqui).
public sealed class Player
{
    public const float MaxSpeed = 240f;         // velocidade máxima andando com a Glock no CS2
    public const float RunMultiplier = 1.6f;    // Shift (não existe no CS, mas foi pedido)
    public const float CrouchMultiplier = 0.34f;
    private const float Friction = 5.2f;
    private const float Accelerate = 5.5f;
    private const float AirAccelerate = 12f;
    private const float AirWishCap = 30f;
    private const float StopSpeed = 80f;
    private const float Gravity = 800f;
    private const float JumpSpeed = 301.993f;
    private const float StandEyeHeight = 165f;
    private const float CrouchEyeHeight = 118f;
    private const float CrouchSpeed = 8f;       // rapidez da transição de agachar
    private const float Radius = 30f;
    private static readonly float[] RayHeights = { 35f, 100f }; // alturas (a partir do pé) dos raios de colisão

    public Vector3 Feet;
    public Vector3 Velocity;
    public float Yaw, Pitch;
    public bool OnGround = true;
    public float Crouch; // 0 em pé, 1 agachado

    public Player(Vector3 spawn) => Feet = spawn;

    public float EyeHeight => StandEyeHeight + (CrouchEyeHeight - StandEyeHeight) * Crouch;
    public Vector3 Eye => Feet + new Vector3(0, EyeHeight, 0);
    public float HorizontalSpeed => new Vector2(Velocity.X, Velocity.Z).Length();

    public Vector3 Forward => new(MathF.Cos(Pitch) * MathF.Sin(Yaw), MathF.Sin(Pitch), MathF.Cos(Pitch) * MathF.Cos(Yaw));
    public Vector3 FlatForward => new(MathF.Sin(Yaw), 0, MathF.Cos(Yaw));
    public Vector3 FlatRight => Vector3.Normalize(Vector3.Cross(FlatForward, Vector3.UnitY));

    // move: x = direita, y = frente, cada um em -1..1.
    public void Update(float dt, Vector2 move, bool jump, bool crouch, bool run, CollisionWorld world)
    {
        Crouch = Math.Clamp(Crouch + (crouch ? 1 : -1) * CrouchSpeed * dt, 0, 1);

        Vector3 wishDir = FlatRight * move.X + FlatForward * move.Y;
        float wishSpeed = 0;
        if (wishDir.LengthSquared() > 0)
        {
            wishDir = Vector3.Normalize(wishDir);
            wishSpeed = MaxSpeed * (crouch ? CrouchMultiplier : run ? RunMultiplier : 1f);
        }

        if (OnGround)
        {
            ApplyFriction(dt);
            ApplyAcceleration(wishDir, wishSpeed, wishSpeed, Accelerate, dt);
            if (jump)
            {
                Velocity.Y = JumpSpeed;
                OnGround = false;
            }
        }
        else
        {
            // No ar a velocidade desejada é limitada, mas a aceleração usa a velocidade cheia (permite "strafe").
            ApplyAcceleration(wishDir, MathF.Min(wishSpeed, AirWishCap), wishSpeed, AirAccelerate, dt);
            Velocity.Y -= Gravity * dt;
        }

        // Move em cada eixo separadamente para deslizar ao longo das paredes.
        if (!MoveAxis(new Vector3(Velocity.X * dt, 0, 0), world)) Velocity.X = 0;
        if (!MoveAxis(new Vector3(0, 0, Velocity.Z * dt), world)) Velocity.Z = 0;

        Feet.Y += Velocity.Y * dt;
        float ground = GroundHeight(world);
        if (Feet.Y <= ground + (OnGround ? 20f : 0f) && Velocity.Y <= 0)
        {
            Feet.Y = ground;
            Velocity.Y = 0;
            OnGround = true;
        }
        else
        {
            OnGround = false;
        }
    }

    private void ApplyFriction(float dt)
    {
        float speed = HorizontalSpeed;
        if (speed < 0.1f)
        {
            Velocity.X = Velocity.Z = 0;
            return;
        }
        float drop = MathF.Max(speed, StopSpeed) * Friction * dt;
        float scale = MathF.Max(speed - drop, 0) / speed;
        Velocity.X *= scale;
        Velocity.Z *= scale;
    }

    private void ApplyAcceleration(Vector3 wishDir, float wishSpeed, float accelBase, float accel, float dt)
    {
        if (accelBase <= 0) return;
        float current = Vector3.Dot(new Vector3(Velocity.X, 0, Velocity.Z), wishDir);
        float add = wishSpeed - current;
        if (add <= 0) return;
        float speed = MathF.Min(accel * accelBase * dt, add);
        Velocity += wishDir * speed;
    }

    private bool MoveAxis(Vector3 move, CollisionWorld world)
    {
        float distance = move.Length();
        if (distance == 0) return true;
        Vector3 dir = move / distance;
        foreach (float h in RayHeights)
        {
            var origin = new Vector3(Feet.X, Feet.Y + h, Feet.Z);
            if (world.Raycast(origin, dir, distance + Radius) != null) return false;
        }
        Feet += move;
        return true;
    }

    private float GroundHeight(CollisionWorld world)
    {
        var origin = new Vector3(Feet.X, Feet.Y + 60f, Feet.Z);
        var hit = world.Raycast(origin, -Vector3.UnitY, 400f);
        return hit is RayHit h ? origin.Y - h.Distance : float.MinValue;
    }
}
