using System.Numerics;

namespace ShootingRange;

// Um disparo já com o desvio aplicado: direção final da bala.
public readonly record struct Shot(Vector3 Origin, Vector3 Direction);

// Arma com a mecânica do CS2: imprecisão (parado, agachado, andando, no ar e por disparo, com recuperação
// exponencial), espalhamento aleatório, recuo ("aim punch"), pente e recarga (mais longa com o pente vazio).
// Os números de cada arma (AK-47, Five-seveN) vêm do campo "stats" do JSON dela; ver ViewmodelRig.
public sealed class Weapon
{
    // Recuo (graus). Os decaimentos e a escala são os padrões da Source (weapon_recoil_*).
    private const float RecoilScale = 2f;
    private const float RecoilDecayExp = 8f;
    private const float RecoilDecayLinear = 18f;
    private const float RecoilVelocityDecay = 4.5f;
    // A unidade da magnitude na Source não é graus/s. O fator 3 foi calibrado com a Glock (recuo 18) para o
    // primeiro tiro subir ~3°; cada arma multiplica isso (pedido: AK-47 5x, Five-seveN 3,5x).
    private const float RecoilImpulseScale = 3f;
    // No CS2 a câmera mostra só 45% do recuo e a bala cai acima da mira. Aqui a câmera acompanha
    // o recuo inteiro, então a bala sai sempre no centro da mira (menos o espalhamento).
    public const float ViewRecoilTracking = 1f;

    private readonly ViewmodelRig _rig;
    private readonly Upgrades _upgrades;
    private WeaponStats S => _rig.Stats;

    // Automático (opção do menu): segurando o botão, atira na cadência da arma. Só vale para armas automáticas.
    public bool Automatic { get; set; }
    public bool CanBeAutomatic => S.Automatic;
    public string Name => _rig.Name;
    // Pistola com o pente vazio: o ferrolho fica travado atrás até a recarga.
    public bool SlideLocked => S.SlideLock && Clip == 0 && Animation != "reloadEmpty";
    public bool TriggerHeld { get; set; }

    public int ClipSize => S.Clip + _upgrades.ExtraRounds;
    public int Clip { get; private set; }
    public int Reserve { get; private set; }

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

    public Weapon(ViewmodelRig rig, Upgrades upgrades)
    {
        _rig = rig;
        _upgrades = upgrades;
        Refill();
    }

    // Pente cheio e reserva cheia (ao entrar numa baia com pontuação).
    public void Refill()
    {
        Clip = ClipSize;
        Reserve = S.Reserve + _upgrades.ExtraReserve;
    }

    // A melhoria de reserva dá as balas na hora da compra.
    public void AddReserve(int rounds) => Reserve += rounds;

    public void Draw() => Play("draw");

    public void StartReload()
    {
        if (Reloading || Animation == "draw" || Clip == ClipSize || Reserve == 0) return;
        // Pente vazio: no AK é preciso puxar a alavanca de manejo; na pistola, soltar o ferrolho travado atrás.
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
        float baseInaccuracy = (S.InaccuracyStand + (S.InaccuracyCrouch - S.InaccuracyStand) * player.Crouch) * _upgrades.StabilityMultiplier;
        if (!player.OnGround) baseInaccuracy += S.InaccuracyAir;
        // Como no CS: até 34% da velocidade máxima a arma continua precisa ("counter-strafe").
        float moveFactor = Math.Clamp((player.HorizontalSpeed - 0.34f * Player.MaxSpeed) / (0.61f * Player.MaxSpeed), 0, 1);
        return baseInaccuracy + S.InaccuracyMove * moveFactor * _upgrades.MovingMultiplier + _accuracyPenalty;
    }

    public List<Shot> Update(float dt, Player player)
    {
        var shots = new List<Shot>();
        TimeSinceShot += dt;

        if (Animation != null)
        {
            AnimationTime += dt * (Reloading ? _upgrades.ReloadSpeed : 1);
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
        if (Automatic && CanBeAutomatic && TriggerHeld && _cooldown <= 0 && Animation != "draw") _fireQueued = true;
        if (_fireQueued && !Reloading && Clip > 0)
        {
            // Atirar interrompe a inspeção, como no CS2.
            if (Animation == "inspect") Animation = null;
            shots.Add(Fire(player));
            _cooldown = S.CycleTime;
        }
        _fireQueued = false;

        // Penalidade de disparo: decai exponencialmente (cai a 10% em RecoveryTime).
        // A melhoria "Recuperação" acelera esse decaimento e o do recuo.
        float recovery = _upgrades.RecoveryMultiplier;
        _accuracyPenalty *= MathF.Exp(-dt * recovery * MathF.Log(10) / S.RecoveryTime);

        // Recuo: integra a velocidade e decai (exponencial + linear), como na Source.
        AimPunch += _aimPunchVelocity * dt * 0.5f;
        _aimPunchVelocity *= MathF.Exp(-dt * RecoilVelocityDecay * recovery);
        AimPunch += _aimPunchVelocity * dt * 0.5f;
        AimPunch *= MathF.Exp(-dt * RecoilDecayExp * recovery);
        float length = AimPunch.Length();
        if (length > 0)
            AimPunch *= MathF.Max(length - RecoilDecayLinear * recovery * dt, 0) / length;

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
        float a1 = Rand(0, MathF.Tau), r1 = Rand(0, 1) * S.Spread;
        float x = MathF.Cos(a0) * r0 + MathF.Cos(a1) * r1;
        float y = MathF.Sin(a0) * r0 + MathF.Sin(a1) * r1;
        var direction = Vector3.Normalize(forward + right * x + up * y);

        _accuracyPenalty += S.InaccuracyFire;
        float angle = Rand(-S.RecoilAngleVariance, S.RecoilAngleVariance) * MathF.PI / 180f;
        _aimPunchVelocity += new Vector2(MathF.Cos(angle), MathF.Sin(angle))
                             * S.RecoilMagnitude * RecoilImpulseScale * S.RecoilMultiplier * _upgrades.RecoilMultiplier;
        Kick = 1;
        MuzzleFlash = 0.06f;

        return new Shot(player.Eye, direction);
    }

    private float Rand(float min, float max) => min + (float)_random.NextDouble() * (max - min);
}
