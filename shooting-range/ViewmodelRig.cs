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
}

// Lê models/ak_viewmodel.json (o mesmo arquivo usado pela versão web): onde ficam arma e braços,
// as poses dos braços (feitas com IK) e as trilhas de cada animação.
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
    }

    public Vector3 ArmsOffset { get; }
    public Vector3 GunOffset { get; }
    public Vector3 Rotation { get; }
    public Vector3 MagPivot { get; }
    public Vector3 MagReleasePivot { get; }
    public Vector3 EjectionPort { get; }
    public Vector3 Muzzle { get; }

    private readonly Dictionary<string, Dictionary<string, Quaternion>> _poses = new();
    private readonly Dictionary<string, Animation> _animations = new();

    public ViewmodelRig(string path)
    {
        using var doc = JsonDocument.Parse(File.ReadAllText(path));
        var root = doc.RootElement;
        ArmsOffset = Vec(root.GetProperty("armsOffset"));
        GunOffset = Vec(root.GetProperty("gunOffset"));
        Rotation = Vec(root.GetProperty("rotation"));
        MagPivot = Vec(root.GetProperty("magPivot"));
        MagReleasePivot = Vec(root.GetProperty("magReleasePivot"));
        EjectionPort = Vec(root.GetProperty("ejectionPort"));
        Muzzle = Vec(root.GetProperty("muzzle"));

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
            _animations[entry.Name] = a;
        }
    }

    public float Duration(string animation) => _animations[animation].Duration;

    // animation: reload, reloadEmpty, inspect, draw ou null (parado). fireTime: segundos desde o último tiro.
    public ViewmodelFrame Evaluate(string? animation, float time, float fireTime)
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
            if (a.Bolt.Count > 0) frame.Bolt = Evaluate(a.Bolt, time)[0];
        }
        // O ferrolho também corre a cada tiro (o gás empurra o porta-ferrolho para trás e a mola o devolve).
        var fire = _animations["fire"];
        if (fireTime < fire.Duration) frame.Bolt = Math.Min(frame.Bolt, Evaluate(fire.Bolt, fireTime)[0]);
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
