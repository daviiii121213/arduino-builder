using System.Numerics;
using Silk.NET.OpenGL;

namespace ShootingRange;

// Furos de bala, cápsulas ejetadas e clarão do disparo. A geometria é montada a cada quadro num buffer dinâmico
// com o mesmo formato de vértice do cenário (posição, normal, uv).
public sealed unsafe class Effects : IDisposable
{
    private const int MaxBulletHoles = 300;
    private const float PaperHoleRadius = 0.8f;
    private const float PaperRimRadius = 1.4f;
    // Na parede: furo escuro com um halo claro de reboco lascado, para aparecer até nas paredes escuras.
    private const float WallHoleRadius = 1.0f;
    private const float WallDustRadius = 2.4f;
    private const float SurfaceOffset = 0.05f;
    private const float CasingLife = 0.9f;
    private const float Gravity = 800f;

    private readonly record struct BulletHole(ShootingTarget? Target, Vector3 Point, Vector3 Normal, bool OnPaper);

    private sealed class Casing
    {
        public Vector3 Position, Velocity, SpinAxis, Size;
        public Quaternion Rotation;
        public float Spin, Age;
    }

    private readonly List<Casing> _casings = new();
    private readonly Random _random = new();

    private readonly GL _gl;
    private readonly uint _vao, _vbo, _white;
    private readonly List<BulletHole> _holes = new();
    private readonly List<float> _vertices = new();

    public Effects(GL gl)
    {
        _gl = gl;
        _white = _gl.GenTexture();
        _gl.BindTexture(TextureTarget.Texture2D, _white);
        byte[] pixel = { 255, 255, 255, 255 };
        fixed (byte* p = pixel)
            _gl.TexImage2D(TextureTarget.Texture2D, 0, InternalFormat.Rgba8, 1, 1, 0, PixelFormat.Rgba, PixelType.UnsignedByte, p);
        _gl.TexParameter(TextureTarget.Texture2D, TextureParameterName.TextureMinFilter, (int)GLEnum.Nearest);
        _gl.TexParameter(TextureTarget.Texture2D, TextureParameterName.TextureMagFilter, (int)GLEnum.Nearest);

        _vao = _gl.GenVertexArray();
        _vbo = _gl.GenBuffer();
        _gl.BindVertexArray(_vao);
        _gl.BindBuffer(BufferTargetARB.ArrayBuffer, _vbo);
        const uint stride = 8 * sizeof(float);
        _gl.EnableVertexAttribArray(0);
        _gl.VertexAttribPointer(0, 3, VertexAttribPointerType.Float, false, stride, (void*)0);
        _gl.EnableVertexAttribArray(1);
        _gl.VertexAttribPointer(1, 3, VertexAttribPointerType.Float, false, stride, (void*)(3 * sizeof(float)));
        _gl.EnableVertexAttribArray(2);
        _gl.VertexAttribPointer(2, 2, VertexAttribPointerType.Float, false, stride, (void*)(6 * sizeof(float)));
        _gl.BindVertexArray(0);
    }

    // point: no espaço do alvo (se houver alvo) ou do mundo. Furos no alvo acompanham o alvo no trilho.
    public void AddBulletHole(ShootingTarget? target, Vector3 point, Vector3 normal, bool onPaper)
    {
        _holes.Add(new BulletHole(target, point, normal, onPaper));
        if (_holes.Count > MaxBulletHoles) _holes.RemoveAt(0);
    }

    public void DrawBulletHoles(int colorLocation, int modelLocation)
    {
        if (_holes.Count == 0) return;
        _gl.Enable(EnableCap.Blend);
        _gl.DepthMask(false);
        _gl.Enable(EnableCap.PolygonOffsetFill);
        _gl.PolygonOffset(-2, -2);
        SetModel(modelLocation, Matrix4x4.Identity);
        _gl.BindTexture(TextureTarget.Texture2D, _white);

        // Borda clara de papel rasgado (aparece sobre a silhueta preta), depois o furo escuro.
        DrawDiscs(colorLocation, new Vector4(0.85f, 0.83f, 0.78f, 1f), h => h.OnPaper ? PaperRimRadius : 0);
        DrawDiscs(colorLocation, new Vector4(0.03f, 0.03f, 0.03f, 1f), h => h.OnPaper ? PaperHoleRadius : 0);
        DrawDiscs(colorLocation, new Vector4(0.55f, 0.53f, 0.5f, 0.7f), h => h.OnPaper ? 0 : WallDustRadius);
        DrawDiscs(colorLocation, new Vector4(0.03f, 0.03f, 0.03f, 0.95f), h => h.OnPaper ? 0 : WallHoleRadius);

        _gl.Disable(EnableCap.PolygonOffsetFill);
        _gl.DepthMask(true);
        _gl.Disable(EnableCap.Blend);
    }

    private void DrawDiscs(int colorLocation, Vector4 color, Func<BulletHole, float> radius)
    {
        foreach (var hole in _holes)
        {
            float r = radius(hole);
            if (r <= 0) continue;
            Vector3 center = hole.Point + (hole.Target?.Offset ?? Vector3.Zero) + hole.Normal * SurfaceOffset;
            Vector3 tangent = Vector3.Normalize(Vector3.Cross(hole.Normal,
                MathF.Abs(hole.Normal.Y) < 0.9f ? Vector3.UnitY : Vector3.UnitX));
            Vector3 bitangent = Vector3.Cross(hole.Normal, tangent);
            const int sides = 10;
            for (int i = 0; i < sides; i++)
            {
                float a0 = MathF.Tau * i / sides, a1 = MathF.Tau * (i + 1) / sides;
                AddVertex(center, hole.Normal);
                AddVertex(center + (tangent * MathF.Cos(a0) + bitangent * MathF.Sin(a0)) * r, hole.Normal);
                AddVertex(center + (tangent * MathF.Cos(a1) + bitangent * MathF.Sin(a1)) * r, hole.Normal);
            }
        }
        Flush(colorLocation, color);
    }

    // Estojo ejetado pela janela do lado direito: para a direita, um pouco para cima e para trás.
    // size: tamanho do estojo em cm (7,62x39 do AK: 1,1 x 3,9; 5,7x28 da Five-seveN: 0,8 x 2,9).
    public void EjectCasing(Vector3 position, Vector3 right, Vector3 up, Vector3 forward, Vector3 size)
    {
        float R() => (float)_random.NextDouble();
        _casings.Add(new Casing
        {
            Position = position,
            Size = size,
            Velocity = right * (180 + R() * 60) + up * (120 + R() * 60) - forward * (20 + R() * 30),
            Rotation = Quaternion.CreateFromRotationMatrix(Matrix4x4.CreateWorld(Vector3.Zero, forward, up)),
            SpinAxis = Vector3.Normalize(up + right * 0.3f),
            Spin = 20 + R() * 15,
        });
    }

    public void Update(float dt)
    {
        foreach (var c in _casings)
        {
            c.Age += dt;
            c.Velocity.Y -= Gravity * dt;
            c.Position += c.Velocity * dt;
            c.Rotation = Quaternion.Normalize(Quaternion.CreateFromAxisAngle(c.SpinAxis, c.Spin * dt) * c.Rotation);
        }
        _casings.RemoveAll(c => c.Age > CasingLife);
    }

    // Cada estojo é uma caixinha cor de latão (com luz normal da cena).
    public void DrawCasings(int colorLocation, int modelLocation)
    {
        if (_casings.Count == 0) return;
        _gl.BindTexture(TextureTarget.Texture2D, _white);
        SetModel(modelLocation, Matrix4x4.Identity);
        foreach (var c in _casings)
        {
            Vector3 h = c.Size / 2;
            var m = Matrix4x4.CreateFromQuaternion(c.Rotation) * Matrix4x4.CreateTranslation(c.Position);
            foreach (var axis in new[] { Vector3.UnitX, Vector3.UnitY, Vector3.UnitZ })
            foreach (float sign in new[] { -1f, 1f })
            {
                Vector3 n = axis * sign;
                Vector3 a = new(axis.Y, axis.Z, axis.X), b = Vector3.Cross(n, a);
                Vector3 center = n * h;
                Vector3 ea = a * h, eb = b * h;
                Vector3 p0 = center - ea - eb, p1 = center + ea - eb, p2 = center + ea + eb, p3 = center - ea + eb;
                Vector3 wn = Vector3.Normalize(Vector3.TransformNormal(n, m));
                foreach (var p in new[] { p0, p1, p2, p0, p2, p3 })
                    AddVertex(Vector3.Transform(p, m), wn);
            }
        }
        Flush(colorLocation, new Vector4(0.47f, 0.26f, 0.04f, 1f));
    }

    // Clarão em forma de estrela, sempre de frente para a câmera, com mistura aditiva.
    public void DrawMuzzleFlash(Vector3 position, Matrix4x4 cameraToWorld, int colorLocation, int modelLocation,
        int unlitLocation, Random random)
    {
        var right = Vector3.Normalize(new Vector3(cameraToWorld.M11, cameraToWorld.M12, cameraToWorld.M13));
        var up = Vector3.Normalize(new Vector3(cameraToWorld.M21, cameraToWorld.M22, cameraToWorld.M23));
        var toCamera = Vector3.Normalize(new Vector3(cameraToWorld.M31, cameraToWorld.M32, cameraToWorld.M33));
        float spin = (float)random.NextDouble() * MathF.PI;

        _gl.Disable(EnableCap.DepthTest);
        _gl.Enable(EnableCap.Blend);
        _gl.BlendFunc(BlendingFactor.SrcAlpha, BlendingFactor.One);
        _gl.Uniform1(unlitLocation, 1f);
        SetModel(modelLocation, Matrix4x4.Identity);
        _gl.BindTexture(TextureTarget.Texture2D, _white);

        void Spikes(float length, float width, int count)
        {
            for (int i = 0; i < count; i++)
            {
                float a = spin + MathF.Tau * i / count;
                Vector3 dir = right * MathF.Cos(a) + up * MathF.Sin(a);
                Vector3 side = right * -MathF.Sin(a) + up * MathF.Cos(a);
                AddVertex(position + side * width, toCamera);
                AddVertex(position - side * width, toCamera);
                AddVertex(position + dir * length, toCamera);
            }
        }
        Spikes(4.5f + (float)random.NextDouble() * 2f, 1.1f, 6);
        Flush(colorLocation, new Vector4(1f, 0.55f, 0.15f, 0.8f));
        Spikes(2.2f, 1.2f, 8);
        Flush(colorLocation, new Vector4(1f, 0.9f, 0.6f, 1f));

        _gl.Uniform1(unlitLocation, 0f);
        _gl.BlendFunc(BlendingFactor.SrcAlpha, BlendingFactor.OneMinusSrcAlpha);
        _gl.Disable(EnableCap.Blend);
        _gl.Enable(EnableCap.DepthTest);
    }

    private void SetModel(int modelLocation, Matrix4x4 model) =>
        _gl.UniformMatrix4(modelLocation, 1, false, (float*)&model);

    private void AddVertex(Vector3 p, Vector3 n)
    {
        _vertices.Add(p.X); _vertices.Add(p.Y); _vertices.Add(p.Z);
        _vertices.Add(n.X); _vertices.Add(n.Y); _vertices.Add(n.Z);
        _vertices.Add(0); _vertices.Add(0);
    }

    private void Flush(int colorLocation, Vector4 color)
    {
        if (_vertices.Count == 0) return;
        var data = _vertices.ToArray();
        _vertices.Clear();
        _gl.Uniform4(colorLocation, color);
        _gl.BindVertexArray(_vao);
        _gl.BindBuffer(BufferTargetARB.ArrayBuffer, _vbo);
        fixed (float* p = data)
            _gl.BufferData(BufferTargetARB.ArrayBuffer, (nuint)(data.Length * sizeof(float)), p, BufferUsageARB.StreamDraw);
        _gl.DrawArrays(PrimitiveType.Triangles, 0, (uint)(data.Length / 8));
    }

    public void Dispose()
    {
        _gl.DeleteBuffer(_vbo);
        _gl.DeleteVertexArray(_vao);
        _gl.DeleteTexture(_white);
    }
}
