using System.Numerics;
using System.Text.Json;

namespace ShootingRange;

// O que a arma e os braços devem mostrar num instante: pose dos braços, giro/deslocamento do conjunto
// e a posição das peças móveis do AKM.
public sealed class ViewmodelFrame
{
    public Dictionary<string, Quaternion> ArmPose = new();
    public Vector3 RootRotation;  // graus, em volta do punho
    public Vector3 RootOffset;    // cm, no espaço da câmera
    public float MagRotation;     // graus em volta da frente do carregador (negativo = fundo para a frente)
    public Vector3 MagOffset;     // cm, no espaço da arma
    public float MagRelease;      // graus do retém do carregador
    public float Bolt;            // cm do porta-ferrolho (negativo = para trás)
    public float BoltRotation;    // graus do ferrolho em volta do cano (Mosin: alavanca para cima)
}

// Números da arma (vêm do campo "stats" do JSON de cada arma).
public sealed record WeaponStats(
    int Clip, int Reserve, float CycleTime, bool Automatic,
    float InaccuracyStand, float InaccuracyCrouch, float InaccuracyMove, float InaccuracyAir,
    float InaccuracyFire, float Spread, float RecoveryTime,
    float RecoilMagnitude, float RecoilAngleVariance, float RecoilMultiplier,
    float MaxSpeed, bool SlideLock, float SlideTravel, Vector3 Casing,
    // Opcionais: chumbos por tiro (espingarda), ação manual (ferrolho/bombeamento depois de cada tiro, animação
    // "cycle"), recarga cartucho por cartucho (reloadStart, reloadRound, reloadEnd), bombear depois de recarregar
    // vazia, luneta própria (campo de visão e imprecisão com zoom) e estojo saindo pela esquerda (P38).
    int Pellets = 1, bool ManualAction = false, bool ReloadPerRound = false, bool ChamberAfterReload = false,
    float ScopeFov = 0, float InaccuracyScoped = 0, bool EjectLeft = false);

// Lê o JSON de uma arma (models/ak_viewmodel.json, models/fiveseven_viewmodel.json; os mesmos da versão web):
// modelo, números, onde ficam arma e braços, as poses dos braços (feitas com IK) e as trilhas de cada animação.
public sealed class ViewmodelRig
{
    private sealed class Animation
    {
        public float Duration;
        public List<(float T, string Pose)> Arms = new();
        public List<(float T, float[] Values)> Root = new();
        public List<(float T, float[] Values)> Mag = new();
        public List<(float T, float[] Values)> MagRelease = new();
        public List<(float T, float[] Values)> Bolt = new();
        public float? Eject;  // instante em que o estojo sai (ação manual)
    }

    public string Name { get; }
    public string ModelPath { get; }
    public WeaponStats Stats { get; }
    public Vector3 ArmsOffset { get; }
    public Vector3 GunOffset { get; }
    public Vector3 Rotation { get; }
    public Vector3 MagPivot { get; }
    public Vector3 MagReleasePivot { get; }
    public Vector3 EjectionPort { get; }
    public Vector3 Muzzle { get; }
    public Vector2 BoltPivot { get; }   // eixo (x, y) em volta do qual o ferrolho gira

    private readonly Dictionary<string, Dictionary<string, Quaternion>> _poses = new();
    private readonly Dictionary<string, Animation> _animations = new();

    public ViewmodelRig(string path)
    {
        using var doc = JsonDocument.Parse(File.ReadAllText(path));
        var root = doc.RootElement;
        Name = root.GetProperty("name").GetString()!;
        ModelPath = root.GetProperty("model").GetString()!;
        var st = root.GetProperty("stats");
        float F(string key) => st.GetProperty(key).GetSingle();
        float Opt(string key, float fallback) => st.TryGetProperty(key, out var v) ? v.GetSingle() : fallback;
        bool OptBool(string key) => st.TryGetProperty(key, out var v) && v.GetBoolean();
        Stats = new WeaponStats(
            st.GetProperty("clip").GetInt32(), st.GetProperty("reserve").GetInt32(), F("cycleTime"), st.GetProperty("automatic").GetBoolean(),
            F("inaccuracyStand"), F("inaccuracyCrouch"), F("inaccuracyMove"), F("inaccuracyAir"),
            F("inaccuracyFire"), F("spread"), F("recoveryTime"),
            F("recoilMagnitude"), F("recoilAngleVariance"), F("recoilMultiplier"),
            F("maxSpeed"), st.GetProperty("slideLock").GetBoolean(), F("slideTravel"), Vec(st.GetProperty("casing")),
            (int)Opt("pellets", 1), OptBool("manualAction"), OptBool("reloadPerRound"), OptBool("chamberAfterReload"),
            Opt("scopeFov", 0), Opt("inaccuracyScoped", 0), OptBool("ejectLeft"));
        Vector3 OptVec(string key) => root.TryGetProperty(key, out var v) ? Vec(v) : Vector3.Zero;
        ArmsOffset = Vec(root.GetProperty("armsOffset"));
        GunOffset = Vec(root.GetProperty("gunOffset"));
        Rotation = Vec(root.GetProperty("rotation"));
        MagPivot = OptVec("magPivot");
        MagReleasePivot = OptVec("magReleasePivot");
        EjectionPort = Vec(root.GetProperty("ejectionPort"));
        Muzzle = Vec(root.GetProperty("muzzle"));
        if (root.TryGetProperty("boltPivot", out var pivot)) { var f = Floats(pivot); BoltPivot = new Vector2(f[0], f[1]); }

        foreach (var pose in root.GetProperty("poses").EnumerateObject())
            _poses[pose.Name] = pose.Value.EnumerateObject().ToDictionary(
                b => b.Name, b => { var q = Floats(b.Value); return new Quaternion(q[0], q[1], q[2], q[3]); });

        foreach (var entry in root.GetProperty("animations").EnumerateObject())
        {
            var a = new Animation { Duration = entry.Value.GetProperty("duration").GetSingle() };
            if (entry.Value.TryGetProperty("arms", out var arms))
                foreach (var key in arms.EnumerateArray())
                    a.Arms.Add((key[0].GetSingle(), key[1].GetString()!));
            if (entry.Value.TryGetProperty("root", out var rootTrack))
                foreach (var key in rootTrack.EnumerateArray())
                    a.Root.Add((key[0].GetSingle(), Floats(key[1]).Concat(Floats(key[2])).ToArray()));
            ReadTrack(entry.Value, "mag", a.Mag);
            ReadTrack(entry.Value, "magRelease", a.MagRelease);
            ReadTrack(entry.Value, "bolt", a.Bolt);
            if (entry.Value.TryGetProperty("eject", out var eject)) a.Eject = eject.GetSingle();
            _animations[entry.Name] = a;
        }
    }

    public float Duration(string animation) => _animations[animation].Duration;
    public float? EjectTime(string animation) => _animations.TryGetValue(animation, out var a) ? a.Eject : null;

    // animation: reload, reloadEmpty, inspect, draw ou null (parado). fireTime: segundos desde o último tiro.
    // slideLocked: pistola vazia, com o ferrolho travado atrás até a recarga.
    public ViewmodelFrame Evaluate(string? animation, float time, float fireTime, bool slideLocked = false)
    {
        var frame = new ViewmodelFrame { ArmPose = _poses["hold"] };
        if (animation != null && _animations.TryGetValue(animation, out var a))
        {
            if (a.Arms.Count > 0) frame.ArmPose = EvaluatePose(a.Arms, time);
            if (a.Root.Count > 0)
            {
                var r = Evaluate(a.Root, time);
                frame.RootRotation = new Vector3(r[0], r[1], r[2]);
                frame.RootOffset = new Vector3(r[3], r[4], r[5]);
            }
            if (a.Mag.Count > 0)
            {
                var m = Evaluate(a.Mag, time);
                frame.MagRotation = m[0];
                frame.MagOffset = new Vector3(m[1], m[2], m[3]);
            }
            if (a.MagRelease.Count > 0) frame.MagRelease = Evaluate(a.MagRelease, time)[0];
            if (a.Bolt.Count > 0)
            {
                var b = Evaluate(a.Bolt, time);
                frame.Bolt = b[0];
                if (b.Length > 1) frame.BoltRotation = b[1];
            }
        }
        // O ferrolho também corre a cada tiro (o gás empurra o porta-ferrolho para trás e a mola o devolve).
        // Nas armas de ação manual ele só se move na animação "cycle".
        var fire = _animations["fire"];
        if (fireTime < fire.Duration && fire.Bolt.Count > 0) frame.Bolt = Math.Min(frame.Bolt, Evaluate(fire.Bolt, fireTime)[0]);
        if (slideLocked && animation != "reloadEmpty" && fireTime >= fire.Duration * 0.3f)
            frame.Bolt = Math.Min(frame.Bolt, -Stats.SlideTravel);
        return frame;
    }

    private Dictionary<string, Quaternion> EvaluatePose(List<(float T, string Pose)> keys, float t)
    {
        int i = Segment(keys.Select(k => k.T).ToList(), t, out float u);
        var a = _poses[keys[i].Pose];
        var b = _poses[keys[Math.Min(i + 1, keys.Count - 1)].Pose];
        var result = new Dictionary<string, Quaternion>();
        foreach (var bone in a.Keys.Union(b.Keys))
        {
            var qa = a.TryGetValue(bone, out var x) ? x : Quaternion.Identity;
            var qb = b.TryGetValue(bone, out var y) ? y : Quaternion.Identity;
            result[bone] = Quaternion.Slerp(qa, qb, u);
        }
        return result;
    }

    private static float[] Evaluate(List<(float T, float[] Values)> keys, float t)
    {
        int i = Segment(keys.Select(k => k.T).ToList(), t, out float u);
        var a = keys[i].Values;
        var b = keys[Math.Min(i + 1, keys.Count - 1)].Values;
        return a.Select((v, k) => v + (b[k] - v) * u).ToArray();
    }

    // Índice da chave anterior a t e o avanço (0..1, suavizado) até a próxima.
    private static int Segment(List<float> times, float t, out float u)
    {
        u = 0;
        if (t <= times[0]) return 0;
        for (int i = 0; i < times.Count - 1; i++)
        {
            if (t < times[i + 1])
            {
                float x = (t - times[i]) / (times[i + 1] - times[i]);
                u = x * x * (3 - 2 * x);
                return i;
            }
        }
        return times.Count - 1;
    }

    private static void ReadTrack(JsonElement animation, string name, List<(float T, float[] Values)> track)
    {
        if (!animation.TryGetProperty(name, out var keys)) return;
        foreach (var key in keys.EnumerateArray())
        {
            var values = key.EnumerateArray().Select(v => v.GetSingle()).ToArray();
            track.Add((values[0], values[1..]));
        }
    }

    private static float[] Floats(JsonElement e) => e.EnumerateArray().Select(v => v.GetSingle()).ToArray();
    private static Vector3 Vec(JsonElement e) { var f = Floats(e); return new Vector3(f[0], f[1], f[2]); }
}
