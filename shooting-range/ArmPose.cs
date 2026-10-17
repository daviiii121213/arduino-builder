using System.Numerics;

namespace ShootingRange;

// Pose dos braços segurando a pistola: rotações extras (em graus, no espaço local de cada osso)
// aplicadas sobre a pose original do modelo. A mão direita segura o cabo e a esquerda apoia por baixo.
public static class ArmPose
{
    private static readonly string[] Fingers = { "point", "middle", "ring", "pink" };

    public static Dictionary<string, Quaternion> Create()
    {
        var pose = new Dictionary<string, Quaternion>
        {
            // Z no ombro aproxima a mão do centro; Y no antebraço gira a palma para o lado.
            ["armR"] = Euler(0, 0, -12),
            ["forearmR"] = Euler(0, 35, 0),
            ["armL"] = Euler(0, 0, 15),
            ["forearmL"] = Euler(0, -35, 0),
        };
        CurlFingers(pose, "R", 40, 15);
        CurlFingers(pose, "L", 25, 5);
        return pose;
    }

    // Fecha os dedos em volta do cabo. Na mão direita o eixo de fechar é -Z; na esquerda, +Z.
    private static void CurlFingers(Dictionary<string, Quaternion> pose, string side, float amount, float thumb)
    {
        float sign = side == "R" ? -1 : 1;
        foreach (var finger in Fingers)
            for (int joint = 1; joint <= 3; joint++)
                pose[$"{finger}{joint}{side}"] = Euler(0, 0, sign * amount * (joint == 1 ? 0.6f : 1f));
        for (int joint = 1; joint <= 3; joint++)
            pose[$"thumb{joint}{side}"] = Euler(0, 0, sign * thumb);
    }

    private static Quaternion Euler(float x, float y, float z)
    {
        const float deg = MathF.PI / 180f;
        // Ordem XYZ (como no three.js): cada entrada aqui usa um eixo só, então a ordem não muda nada.
        return Quaternion.CreateFromAxisAngle(Vector3.UnitX, x * deg)
               * Quaternion.CreateFromAxisAngle(Vector3.UnitY, y * deg)
               * Quaternion.CreateFromAxisAngle(Vector3.UnitZ, z * deg);
    }
}
