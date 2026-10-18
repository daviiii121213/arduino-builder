using System.Numerics;

namespace ShootingRange;

// Um disparo já com o desvio aplicado: direção final da bala.
public readonly record struct Shot(Vector3 Origin, Vector3 Direction);

// AK-47 com a mecânica do CS2, um tiro por clique ou automático (opção do menu): imprecisão (parado, agachado, andando, no ar e por disparo,
// com recuperação exponencial), espalhamento aleatório, recuo ("aim punch") que a câmera acompanha só em parte,
// pente de 30 e recarga (mais longa com o pente vazio, porque é preciso puxar a alavanca de manejo).
// Valores do AK-47 no CS2 (csdb.gg): imprecisão parado 0.00641, agachado 0.00481, andando 0.17506,
// recuperação 0.368 s, 600 disparos/min, recuo 30 com variação de 70°, 30/90 balas.
public sealed class Weapon
{
    public const int ClipSize = 30;
    private const float CycleTime = 0.1f;            // 600 RPM: tempo mínimo entre cliques

    // Imprecisão em radianos (raio do círculo onde a bala pode cair).
    private const float InaccuracyStand = 0.00641f;
    private const float InaccuracyCrouch = 0.00481f;
    private const float InaccuracyMove = 0.17506f;
    private const float InaccuracyAir = 0.4f;          // estimativa: as fontes não trazem o valor do pulo
    private const float InaccuracyFire = 0.0078f;      // somado a cada disparo (valor do CS:GO)
    private const float Spread = 0.0006f;
    private const float RecoveryTime = 0.368f;         // tempo para a penalidade cair a 10%

    // Recuo (graus). Os decaimentos e a escala são os padrões da Source (weapon_recoil_*).
    private const float RecoilMagnitude = 30f;
    private const float RecoilAngleVariance = 70f;
    private const float RecoilScale = 2f;
    private const float RecoilDecayExp = 8f;
    private const float RecoilDecayLinear = 18f;
    private const float RecoilVelocityDecay = 4.5f;
    // A unidade da magnitude na Source não é graus/s. O fator 3 foi calibrado com a Glock (recuo 18) para o
    // primeiro tiro subir ~3°; aqui ele é 5 vezes maior (pedido): no AK o primeiro tiro sobe ~25°.
    private const float RecoilImpulseScale = 3f * 5f;
    // No CS2 a câmera mostra só 45% do recuo e a bala cai acima da mira. Aqui a câmera acompanha
    // o recuo inteiro, então a bala sai sempre no centro da mira (menos o espalhamento).
    public const float ViewRecoilTracking = 1f;

    private readonly ViewmodelRig _rig;

    // Automático: segurando o botão, atira a 600 disparos/min. Desativado: um tiro por clique.
    public bool Automatic { get; set; }
    public bool TriggerHeld { get; set; }

    public int Clip { get; private set; } = ClipSize;
    public int Reserve { get; private set; } = 90;

    // Animação em andamento (reload, reloadEmpty, inspect, draw) e há quanto tempo começou.
    public string? Animation { get; private set; }
    public float AnimationTime { get; private set; }
    public float TimeSinceShot { get; private set; } = 10f;

    public bool Reloading => Animation is "reload" or "reloadEmpty";
    public float ReloadProgress => Reloading ? AnimationTime / _rig.Duration(Animation!) : 1;

    // Recuo atual em graus: X = para cima, Y = para a direita. A bala usa AimPunch * RecoilScale.
    public Vector2 AimPunch { get; private set; }
    public Vector2 ViewPunch => AimPunch * RecoilScale * ViewRecoilTracking;
    // Animação do modelo: 1 logo após o tiro, volta a 0.
    public float Kick { get; private set; }
    public float MuzzleFlash { get; private set; }

    private Vector2 _aimPunchVelocity;
    private float _accuracyPenalty;
    private float _cooldown;
    private bool _fireQueued;
    private readonly Random _random = new();

    public Weapon(ViewmodelRig rig) => _rig = rig;

    public void Draw() => Play("draw");

    public void StartReload()
    {
        if (Reloading || Animation == "draw" || Clip == ClipSize || Reserve == 0) return;
        // Com o pente vazio o AK não trava o ferrolho aberto: depois de trocar o carregador é preciso manejar.
        Play(Clip == 0 ? "reloadEmpty" : "reload");
    }

    public void Inspect()
    {
        if (Animation == null) Play("inspect");
    }

    // Um clique = um tiro. Pente vazio: começa a recarregar, como no CS2.
    public void Trigger()
    {
        if (Reloading || Animation == "draw" || _cooldown > 0) return;
        if (Clip == 0)
        {
            StartReload();
            return;
        }
        _fireQueued = true;
    }

    private void Play(string animation)
    {
        Animation = animation;
        AnimationTime = 0;
    }

    public float Inaccuracy(Player player)
    {
        float baseInaccuracy = InaccuracyStand + (InaccuracyCrouch - InaccuracyStand) * player.Crouch;
        if (!player.OnGround) baseInaccuracy += InaccuracyAir;
        // Como no CS: até 34% da velocidade máxima a arma continua precisa ("counter-strafe").
        float moveFactor = Math.Clamp((player.HorizontalSpeed - 0.34f * Player.MaxSpeed) / (0.61f * Player.MaxSpeed), 0, 1);
        return baseInaccuracy + InaccuracyMove * moveFactor + _accuracyPenalty;
    }

    public List<Shot> Update(float dt, Player player)
    {
        var shots = new List<Shot>();
        TimeSinceShot += dt;

        if (Animation != null)
        {
            AnimationTime += dt;
            if (AnimationTime >= _rig.Duration(Animation))
            {
                if (Reloading)
                {
                    int moved = Math.Min(ClipSize - Clip, Reserve);
                    Clip += moved;
                    Reserve -= moved;
                }
                Animation = null;
            }
        }

        _cooldown = MathF.Max(_cooldown - dt, 0);
        if (Automatic && TriggerHeld && _cooldown <= 0 && Animation != "draw") _fireQueued = true;
        if (_fireQueued && !Reloading && Clip > 0)
        {
            // Atirar interrompe a inspeção, como no CS2.
            if (Animation == "inspect") Animation = null;
            shots.Add(Fire(player));
            _cooldown = CycleTime;
        }
        _fireQueued = false;

        // Penalidade de disparo: decai exponencialmente (cai a 10% em RecoveryTime).
        _accuracyPenalty *= MathF.Exp(-dt * MathF.Log(10) / RecoveryTime);

        // Recuo: integra a velocidade e decai (exponencial + linear), como na Source.
        AimPunch += _aimPunchVelocity * dt * 0.5f;
        _aimPunchVelocity *= MathF.Exp(-dt * RecoilVelocityDecay);
        AimPunch += _aimPunchVelocity * dt * 0.5f;
        AimPunch *= MathF.Exp(-dt * RecoilDecayExp);
        float length = AimPunch.Length();
        if (length > 0)
            AimPunch *= MathF.Max(length - RecoilDecayLinear * dt, 0) / length;

        Kick = MathF.Max(Kick - dt * 8f, 0);
        MuzzleFlash = MathF.Max(MuzzleFlash - dt, 0);
        return shots;
    }

    private Shot Fire(Player player)
    {
        Clip--;
        TimeSinceShot = 0;
        float inaccuracy = Inaccuracy(player);

        // Ângulos finais: visão + recuo inteiro (a câmera só mostra parte dele).
        float pitch = player.Pitch + AimPunch.X * RecoilScale * MathF.PI / 180f;
        float yaw = player.Yaw - AimPunch.Y * RecoilScale * MathF.PI / 180f;
        var forward = new Vector3(MathF.Cos(pitch) * MathF.Sin(yaw), MathF.Sin(pitch), MathF.Cos(pitch) * MathF.Cos(yaw));
        var right = Vector3.Normalize(Vector3.Cross(forward, Vector3.UnitY));
        var up = Vector3.Cross(right, forward);

        // Espalhamento do CS: dois círculos aleatórios, um da imprecisão e outro do spread fixo.
        float a0 = Rand(0, MathF.Tau), r0 = Rand(0, 1) * inaccuracy;
        float a1 = Rand(0, MathF.Tau), r1 = Rand(0, 1) * Spread;
        float x = MathF.Cos(a0) * r0 + MathF.Cos(a1) * r1;
        float y = MathF.Sin(a0) * r0 + MathF.Sin(a1) * r1;
        var direction = Vector3.Normalize(forward + right * x + up * y);

        _accuracyPenalty += InaccuracyFire;
        float angle = Rand(-RecoilAngleVariance, RecoilAngleVariance) * MathF.PI / 180f;
        _aimPunchVelocity += new Vector2(MathF.Cos(angle), MathF.Sin(angle)) * RecoilMagnitude * RecoilImpulseScale;
        Kick = 1;
        MuzzleFlash = 0.06f;

        return new Shot(player.Eye, direction);
    }

    private float Rand(float min, float max) => min + (float)_random.NextDouble() * (max - min);
}
