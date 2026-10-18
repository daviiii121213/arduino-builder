using System.Numerics;

namespace ShootingRange;

// Um disparo já com o desvio aplicado: direção final da bala.
public readonly record struct Shot(Vector3 Origin, Vector3 Direction);

// Arma com a mecânica do CS2: imprecisão (parado, agachado, andando, no ar e por disparo, com recuperação
// exponencial), espalhamento aleatório, recuo ("aim punch"), pente e recarga (mais longa com o pente vazio).
// Os números de cada arma vêm do campo "stats" do JSON dela; ver ViewmodelRig. Também cuida das armas de
// ação manual (ferrolho do Mosin, bombeamento da espingarda), dos chumbos da espingarda e da recarga
// cartucho por cartucho.
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
    // Mirando pela luneta própria da arma (Mosin PU): usa a imprecisão com zoom.
    public bool Scoped { get; set; }

    public int ClipSize => S.Clip + _upgrades.ExtraRounds;
    public int Clip { get; private set; }
    public int Reserve { get; private set; }

    // Animação em andamento (reload, reloadEmpty, inspect, draw) e há quanto tempo começou.
    public string? Animation { get; private set; }
    public float AnimationTime { get; private set; }
    public float TimeSinceShot { get; private set; } = 10f;

    public bool Reloading => Animation?.StartsWith("reload") == true;
    // Na recarga cartucho por cartucho, a barra mostra quanto o tubo/depósito já tem.
    public float ReloadProgress => !Reloading ? 1
        : S.ReloadPerRound ? (float)Clip / ClipSize
        : AnimationTime / _rig.Duration(Animation!);

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
    private bool _spentCase;      // estojo disparado ainda na câmara (ação manual: sai no "cycle")
    private bool _stopReload;     // atirar durante a recarga cartucho por cartucho termina depois do cartucho atual
    private bool _reloadFromEmpty;
    private bool _reloadQueued;   // R apertado durante o ferrolho/bombeamento: recarrega logo depois
    private int _ejects;
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

    // Ao deixar a arma na bancada: interrompe o que estiver fazendo.
    public void Holster()
    {
        Animation = null;
        TriggerHeld = false;
        _stopReload = false;
        _reloadQueued = false;
    }

    // Estojos que saíram desde a última chamada (no tiro, ou no "cycle" das armas de ação manual).
    public int TakeEjects()
    {
        int n = _ejects;
        _ejects = 0;
        return n;
    }

    public void StartReload()
    {
        if (Animation == "cycle")
        {
            _reloadQueued = true;
            return;
        }
        if (Reloading || Animation == "draw" || Clip == ClipSize || Reserve == 0) return;
        if (S.ReloadPerRound)
        {
            // Espingarda e Mosin: um cartucho de cada vez (abre a ação, coloca, fecha).
            _reloadFromEmpty = Clip == 0;
            _stopReload = false;
            Play("reloadStart");
            return;
        }
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
        // Na recarga cartucho por cartucho, atirar termina a recarga (como no CS2) se já houver munição.
        if (S.ReloadPerRound && Reloading && Clip > 0)
        {
            _stopReload = true;
            return;
        }
        if (Reloading || Animation is "draw" or "cycle" || _cooldown > 0) return;
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
        float stand = Scoped && S.ScopeFov > 0 ? S.InaccuracyScoped : S.InaccuracyStand;
        float crouch = Scoped && S.ScopeFov > 0 ? S.InaccuracyScoped * 0.75f : S.InaccuracyCrouch;
        float baseInaccuracy = (stand + (crouch - stand) * player.Crouch) * _upgrades.StabilityMultiplier;
        if (!player.OnGround) baseInaccuracy += S.InaccuracyAir;
        // Como no CS: até 34% da velocidade máxima a arma continua precisa ("counter-strafe").
        float moveFactor = Math.Clamp((player.HorizontalSpeed - 0.34f * Player.MaxSpeed) / (0.61f * Player.MaxSpeed), 0, 1);
        return baseInaccuracy + S.InaccuracyMove * moveFactor * _upgrades.MovingMultiplier + _accuracyPenalty;
    }

    // Os tiros deste quadro (vários chumbos no caso da espingarda).
    public List<Shot> Update(float dt, Player player)
    {
        var shots = new List<Shot>();
        TimeSinceShot += dt;

        if (Animation != null)
        {
            float before = AnimationTime;
            AnimationTime += dt * (Reloading ? _upgrades.ReloadSpeed : 1);
            // Ação manual: o estojo sai quando o ferrolho/a telha chega atrás.
            if (_spentCase && _rig.EjectTime(Animation) is float eject && before < eject && AnimationTime >= eject)
            {
                _ejects++;
                _spentCase = false;
            }
            if (AnimationTime >= _rig.Duration(Animation)) FinishAnimation();
        }

        _cooldown = MathF.Max(_cooldown - dt, 0);
        if (Automatic && CanBeAutomatic && TriggerHeld && _cooldown <= 0 && Animation != "draw") _fireQueued = true;
        if (_fireQueued && !Reloading && Animation != "cycle" && Clip > 0)
        {
            // Atirar interrompe a inspeção, como no CS2.
            if (Animation == "inspect") Animation = null;
            shots.AddRange(Fire(player));
            _cooldown = S.CycleTime;
            // Ferrolho/telha: depois de cada tiro é preciso tirar o estojo e colocar outro cartucho na câmara.
            if (S.ManualAction)
            {
                _spentCase = true;
                Play("cycle");
            }
            else
            {
                _ejects++;
            }
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

    private void FinishAnimation()
    {
        switch (Animation)
        {
            case "reload" or "reloadEmpty":
                int moved = Math.Min(ClipSize - Clip, Reserve);
                Clip += moved;
                Reserve -= moved;
                Animation = null;
                break;
            case "reloadStart":
                Play(Clip < ClipSize && Reserve > 0 && !_stopReload ? "reloadRound" : "reloadEnd");
                break;
            case "reloadRound":
                Clip++;
                Reserve--;
                Play(Clip < ClipSize && Reserve > 0 && !_stopReload ? "reloadRound" : "reloadEnd");
                break;
            case "reloadEnd":
                // Espingarda vazia: depois de encher o tubo, bombeia para pôr um cartucho na câmara.
                if (S.ChamberAfterReload && _reloadFromEmpty) Play("cycle");
                else Animation = null;
                break;
            default:
                bool reload = Animation == "cycle" && _reloadQueued;
                Animation = null;
                _reloadQueued = false;
                if (reload) StartReload();
                break;
        }
    }

    private List<Shot> Fire(Player player)
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
        // A imprecisão desloca o tiro inteiro; na espingarda cada chumbo recebe o seu spread.
        float a0 = Rand(0, MathF.Tau), r0 = Rand(0, 1) * inaccuracy;
        var shots = new List<Shot>(S.Pellets);
        for (int i = 0; i < S.Pellets; i++)
        {
            float a1 = Rand(0, MathF.Tau), r1 = Rand(0, 1) * S.Spread;
            float x = MathF.Cos(a0) * r0 + MathF.Cos(a1) * r1;
            float y = MathF.Sin(a0) * r0 + MathF.Sin(a1) * r1;
            shots.Add(new Shot(player.Eye, Vector3.Normalize(forward + right * x + up * y)));
        }

        _accuracyPenalty += S.InaccuracyFire;
        float angle = Rand(-S.RecoilAngleVariance, S.RecoilAngleVariance) * MathF.PI / 180f;
        _aimPunchVelocity += new Vector2(MathF.Cos(angle), MathF.Sin(angle))
                             * S.RecoilMagnitude * RecoilImpulseScale * S.RecoilMultiplier * _upgrades.RecoilMultiplier;
        Kick = 1;
        MuzzleFlash = 0.06f;
        return shots;
    }

    private float Rand(float min, float max) => min + (float)_random.NextDouble() * (max - min);
}
