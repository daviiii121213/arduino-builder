using System.Numerics;

namespace ShootingRange;

// Um disparo já com o desvio aplicado: direção final da bala.
public readonly record struct Shot(Vector3 Origin, Vector3 Direction);

// Glock com a mecânica do CS2: imprecisão (parado, agachado, andando, no ar e por disparo, com recuperação
// exponencial), espalhamento aleatório, recuo ("aim punch") que a câmera acompanha só em parte,
// modo semiautomático ou rajada de 3 (botão direito), pente de 20 e recarga.
// Valores da Glock-18 no CS2 (csdb.gg): imprecisão parado 0.0056, agachado 0.0042, andando 0.010,
// recuo 18 com variação de 20°, recuperação 0.20 s, 400 disparos/min, recarga 2.17 s, 20/120 balas.
public sealed class Weapon
{
    public const int ClipSize = 20;
    private const float CycleTime = 0.15f;          // 400 RPM
    private const float BurstShotInterval = 0.05f;
    private const float BurstCooldown = 0.5f;
    private const float ReloadTime = 2.17f;

    // Imprecisão em radianos (raio do círculo onde a bala pode cair).
    private const float InaccuracyStand = 0.0056f;
    private const float InaccuracyCrouch = 0.0042f;
    private const float InaccuracyMove = 0.010f;
    private const float InaccuracyAir = 0.15f;
    private const float InaccuracyFire = 0.056f;     // somado a cada disparo
    private const float InaccuracyBurstExtra = 0.012f;
    private const float Spread = 0.002f;
    private const float RecoveryTime = 0.20f;        // tempo para a penalidade cair a 10%

    // Recuo (graus). Os decaimentos e a escala são os padrões da Source (weapon_recoil_*).
    private const float RecoilMagnitude = 18f;
    private const float RecoilAngleVariance = 20f;
    private const float RecoilScale = 2f;
    private const float RecoilDecayExp = 8f;
    private const float RecoilDecayLinear = 18f;
    private const float RecoilVelocityDecay = 4.5f;
    // A unidade da magnitude na Source não é graus/s; este fator foi calibrado para o primeiro tiro
    // subir ~3° (a câmera mostra ~1.4°) e voltar ao centro em ~0.4 s, como a Glock no CS2.
    private const float RecoilImpulseScale = 3f;
    public const float ViewRecoilTracking = 0.45f;   // a câmera mostra 45% do recuo; a bala segue 100%

    public int Clip { get; private set; } = ClipSize;
    public int Reserve { get; private set; } = 120;
    public bool BurstMode { get; private set; }
    public bool Reloading => _reloadLeft > 0;
    public float ReloadProgress => Reloading ? 1 - _reloadLeft / ReloadTime : 1;

    // Recuo atual em graus: X = para cima, Y = para a direita. A bala usa AimPunch * RecoilScale.
    public Vector2 AimPunch { get; private set; }
    public Vector2 ViewPunch => AimPunch * RecoilScale * ViewRecoilTracking;
    // Animação do modelo: 1 logo após o tiro, volta a 0.
    public float Kick { get; private set; }
    public float MuzzleFlash { get; private set; }

    private Vector2 _aimPunchVelocity;
    private float _accuracyPenalty;
    private float _cooldown;
    private float _reloadLeft;
    private int _burstLeft;
    private readonly Random _random = new();

    public void ToggleMode()
    {
        if (_burstLeft == 0) BurstMode = !BurstMode;
    }

    public void StartReload()
    {
        if (Reloading || Clip == ClipSize || Reserve == 0) return;
        _reloadLeft = ReloadTime;
        _burstLeft = 0;
    }

    // Um clique dispara 1 bala (semi) ou 3 (rajada). Pente vazio: começa a recarregar, como no CS2.
    public void Trigger()
    {
        if (Reloading || _cooldown > 0 || _burstLeft > 0) return;
        if (Clip == 0)
        {
            StartReload();
            return;
        }
        _burstLeft = BurstMode ? 3 : 1;
    }

    public float Inaccuracy(Player player)
    {
        float baseInaccuracy = InaccuracyStand + (InaccuracyCrouch - InaccuracyStand) * player.Crouch;
        if (!player.OnGround) baseInaccuracy += InaccuracyAir;
        // Como no CS: até 34% da velocidade máxima a arma continua precisa ("counter-strafe").
        float moveFactor = Math.Clamp((player.HorizontalSpeed - 0.34f * Player.MaxSpeed) / (0.61f * Player.MaxSpeed), 0, 1);
        return baseInaccuracy + InaccuracyMove * moveFactor + _accuracyPenalty + (BurstMode ? InaccuracyBurstExtra : 0);
    }

    public List<Shot> Update(float dt, Player player)
    {
        var shots = new List<Shot>();

        if (_reloadLeft > 0)
        {
            _reloadLeft -= dt;
            if (_reloadLeft <= 0)
            {
                _reloadLeft = 0;
                int moved = Math.Min(ClipSize - Clip, Reserve);
                Clip += moved;
                Reserve -= moved;
            }
        }

        _cooldown -= dt;
        while (_burstLeft > 0 && _cooldown <= 0 && Clip > 0 && !Reloading)
        {
            shots.Add(Fire(player));
            _burstLeft--;
            _cooldown += _burstLeft > 0 ? BurstShotInterval : (BurstMode ? BurstCooldown : CycleTime);
        }
        if (Clip == 0) _burstLeft = 0;
        if (_cooldown < 0) _cooldown = 0;

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
