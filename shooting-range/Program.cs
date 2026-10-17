using System.Numerics;
using Silk.NET.Input;
using Silk.NET.Maths;
using Silk.NET.OpenGL;
using Silk.NET.Windowing;

namespace ShootingRange;

public static class Program
{
    // O modelo está em centímetros, então todas as medidas abaixo também estão.
    private const string ModelPath = "models/shooting_range.fbx";
    private const string TextureDir = "models/tex";
    private const string ArmsPath = "models/arms.fbx";
    private static readonly Vector3 Spawn = new(0, 0, -680);
    private const float EyeHeight = 165f;
    private const float PlayerRadius = 30f;
    private const float WalkSpeed = 250f;
    private const float RunSpeed = 450f;
    private const float Acceleration = 10f;
    private const float MouseSensitivity = 0.0025f;
    private static readonly float[] RayHeights = { 40f, 140f }; // alturas (a partir do pé) dos raios de colisão

    // Braços em primeira pessoa (estilo CS): posição em relação à câmera (x direita, y cima, -z frente).
    private static readonly Vector3 ArmsOffset = new(0f, -15f, -4f);
    private const float ArmsFov = 68f;
    private const float BobAmount = 0.8f;      // altura do balanço ao andar
    private const float BobFrequency = 11f;
    private const float SwayAmount = 0.04f;    // quanto os braços atrasam ao girar o mouse
    private const float SwayMax = 2.5f;

    private const string VertexShader = """
        #version 330 core
        layout (location = 0) in vec3 aPosition;
        layout (location = 1) in vec3 aNormal;
        layout (location = 2) in vec2 aUv;
        uniform mat4 uViewProjection;
        uniform mat4 uModel;
        out vec3 vNormal;
        out vec2 vUv;
        void main()
        {
            vNormal = mat3(uModel) * aNormal;
            vUv = aUv;
            gl_Position = uViewProjection * uModel * vec4(aPosition, 1.0);
        }
        """;

    private const string FragmentShader = """
        #version 330 core
        in vec3 vNormal;
        in vec2 vUv;
        uniform sampler2D uTexture;
        uniform vec4 uColor;
        out vec4 FragColor;
        void main()
        {
            vec3 n = normalize(vNormal);
            // Luz ambiente + luz vinda de cima + uma direcional leve para dar volume (sem acentos: GLSL so aceita ASCII).
            float sky = mix(0.35, 1.0, n.y * 0.5 + 0.5);
            float sun = max(dot(n, normalize(vec3(0.3, 1.0, 0.5))), 0.0);
            float light = 0.35 + 0.5 * sky + 0.25 * sun;
            vec4 albedo = texture(uTexture, vUv) * uColor;
            FragColor = vec4(albedo.rgb * light, albedo.a);
        }
        """;

    private static IWindow _window = null!;
    private static GL _gl = null!;
    private static IInputContext _input = null!;
    private static IKeyboard _keyboard = null!;
    private static IMouse _mouse = null!;
    private static SceneModel _scene = null!;
    private static SceneModel _arms = null!;
    private static CollisionWorld _collision = null!;
    private static uint _program;
    private static int _viewProjectionLocation, _modelLocation, _colorLocation;

    private static Vector3 _feet = Spawn;
    private static Vector3 _velocity;
    private static float _yaw, _pitch;
    private static Vector2? _lastMouse;
    private static float _bobTime;
    private static Vector2 _sway;

    public static void Main()
    {
        // Os caminhos dos modelos são relativos à pasta do executável.
        Directory.SetCurrentDirectory(AppContext.BaseDirectory);

        var options = WindowOptions.Default with
        {
            Size = new Vector2D<int>(1280, 720),
            Title = "Shooting Range - clique para jogar | WASD mover | Shift correr | Esc soltar o mouse",
            API = new GraphicsAPI(ContextAPI.OpenGL, ContextProfile.Core, ContextFlags.ForwardCompatible, new APIVersion(3, 3)),
            Samples = 4,
        };
        _window = Window.Create(options);
        _window.Load += OnLoad;
        _window.Update += OnUpdate;
        _window.Render += OnRender;
        _window.FramebufferResize += size => _gl.Viewport(size);
        _window.Closing += OnClose;
        _window.Run();
        _window.Dispose();
    }

    private static void OnLoad()
    {
        _gl = GL.GetApi(_window);
        _input = _window.CreateInput();
        _keyboard = _input.Keyboards[0];
        _mouse = _input.Mice[0];

        _mouse.Click += (_, _, _) => _mouse.Cursor.CursorMode = CursorMode.Raw;
        _mouse.MouseMove += OnMouseMove;
        _keyboard.KeyDown += (_, key, _) =>
        {
            if (key == Key.Escape) _mouse.Cursor.CursorMode = CursorMode.Normal;
        };

        Console.WriteLine("Carregando cenário...");
        _scene = new SceneModel(_gl, ModelPath, TextureDir);
        _collision = new CollisionWorld(_scene.CollisionTriangles);
        _arms = new SceneModel(_gl, ArmsPath, TextureDir);
        Console.WriteLine($"Braços: {_arms.BoundsMin} -> {_arms.BoundsMax}");
        Console.WriteLine($"Pronto! {_scene.Meshes.Count} partes, {_scene.CollisionTriangles.Count / 3} triângulos.");
        Console.WriteLine("Clique na janela para capturar o mouse. WASD mover, Shift correr, Esc soltar o mouse.");

        _program = CreateProgram(VertexShader, FragmentShader);
        _viewProjectionLocation = _gl.GetUniformLocation(_program, "uViewProjection");
        _modelLocation = _gl.GetUniformLocation(_program, "uModel");
        _colorLocation = _gl.GetUniformLocation(_program, "uColor");

        _gl.Enable(EnableCap.DepthTest);
        _gl.Enable(EnableCap.FramebufferSrgb);
        _gl.Enable(EnableCap.Multisample);
        _gl.BlendFunc(BlendingFactor.SrcAlpha, BlendingFactor.OneMinusSrcAlpha);
        _gl.ClearColor(0.07f, 0.07f, 0.07f, 1f);
    }

    private static void OnMouseMove(IMouse mouse, Vector2 position)
    {
        if (mouse.Cursor.CursorMode != CursorMode.Raw)
        {
            _lastMouse = null;
            return;
        }
        if (_lastMouse is Vector2 last)
        {
            Vector2 delta = position - last;
            _yaw -= delta.X * MouseSensitivity;
            _pitch = Math.Clamp(_pitch - delta.Y * MouseSensitivity, -1.5f, 1.5f);
            _sway -= delta * SwayAmount;
        }
        _lastMouse = position;
    }

    private static Vector3 LookDirection() =>
        new(MathF.Cos(_pitch) * MathF.Sin(_yaw), MathF.Sin(_pitch), MathF.Cos(_pitch) * MathF.Cos(_yaw));

    private static void OnUpdate(double deltaTime)
    {
        float dt = MathF.Min((float)deltaTime, 0.05f);

        var forward = new Vector3(MathF.Sin(_yaw), 0, MathF.Cos(_yaw));
        var right = Vector3.Normalize(Vector3.Cross(forward, Vector3.UnitY));

        var wish = Vector3.Zero;
        if (_mouse.Cursor.CursorMode == CursorMode.Raw)
        {
            if (_keyboard.IsKeyPressed(Key.W)) wish += forward;
            if (_keyboard.IsKeyPressed(Key.S)) wish -= forward;
            if (_keyboard.IsKeyPressed(Key.D)) wish += right;
            if (_keyboard.IsKeyPressed(Key.A)) wish -= right;
        }
        if (wish != Vector3.Zero) wish = Vector3.Normalize(wish);

        bool running = _keyboard.IsKeyPressed(Key.ShiftLeft) || _keyboard.IsKeyPressed(Key.ShiftRight);
        wish *= running ? RunSpeed : WalkSpeed;
        _velocity = Vector3.Lerp(_velocity, wish, MathF.Min(1f, Acceleration * dt));

        // Move em cada eixo separadamente para deslizar ao longo das paredes.
        MoveAxis(new Vector3(_velocity.X * dt, 0, 0));
        MoveAxis(new Vector3(0, 0, _velocity.Z * dt));
        _feet.Y = GroundHeight();

        // Balanço dos braços proporcional à velocidade; o atraso do mouse volta suavemente ao centro.
        _bobTime += dt * BobFrequency * (_velocity.Length() / WalkSpeed);
        _sway = Vector2.Clamp(_sway, new Vector2(-SwayMax), new Vector2(SwayMax));
        _sway = Vector2.Lerp(_sway, Vector2.Zero, MathF.Min(1f, 8f * dt));
    }

    private static void MoveAxis(Vector3 move)
    {
        float distance = move.Length();
        if (distance == 0) return;
        Vector3 dir = move / distance;
        foreach (float h in RayHeights)
        {
            var origin = new Vector3(_feet.X, _feet.Y + h, _feet.Z);
            if (_collision.Raycast(origin, dir, distance + PlayerRadius) != null) return;
        }
        _feet += move;
    }

    private static float GroundHeight()
    {
        var origin = new Vector3(_feet.X, _feet.Y + 60f, _feet.Z);
        float? hit = _collision.Raycast(origin, -Vector3.UnitY, 200f);
        return hit is float d ? origin.Y - d : _feet.Y;
    }

    private static void OnRender(double deltaTime)
    {
        _gl.Clear(ClearBufferMask.ColorBufferBit | ClearBufferMask.DepthBufferBit);

        var size = _window.FramebufferSize;
        float aspect = size.Y > 0 ? (float)size.X / size.Y : 1f;
        var eye = new Vector3(_feet.X, _feet.Y + EyeHeight, _feet.Z);
        var view = Matrix4x4.CreateLookAt(eye, eye + LookDirection(), Vector3.UnitY);
        var projection = Matrix4x4.CreatePerspectiveFieldOfView(75f * MathF.PI / 180f, aspect, 5f, 5000f);

        _gl.UseProgram(_program);
        _gl.ActiveTexture(TextureUnit.Texture0);
        DrawModel(_scene, Matrix4x4.Identity, view * projection);

        // Os braços são desenhados por cima de tudo, com FOV próprio, como nos jogos de tiro:
        // limpar a profundidade impede que eles atravessem paredes.
        _gl.Clear(ClearBufferMask.DepthBufferBit);
        var offset = ArmsOffset + new Vector3(
            MathF.Sin(_bobTime * 0.5f) * BobAmount + _sway.X,
            -MathF.Abs(MathF.Sin(_bobTime)) * BobAmount - _sway.Y,
            0f);
        // O modelo aponta para +Z; a câmera olha para -Z, então gira 180° em Y.
        var armsInView = Matrix4x4.CreateRotationY(MathF.PI) * Matrix4x4.CreateTranslation(offset);
        Matrix4x4.Invert(view, out var cameraToWorld);
        var armsProjection = Matrix4x4.CreatePerspectiveFieldOfView(ArmsFov * MathF.PI / 180f, aspect, 1f, 500f);
        DrawModel(_arms, armsInView * cameraToWorld, view * armsProjection);
    }

    private static unsafe void DrawModel(SceneModel model, Matrix4x4 world, Matrix4x4 viewProjection)
    {
        _gl.UniformMatrix4(_viewProjectionLocation, 1, false, (float*)&viewProjection);
        _gl.UniformMatrix4(_modelLocation, 1, false, (float*)&world);

        bool blending = false;
        foreach (var mesh in model.Meshes)
        {
            if (mesh.Transparent && !blending)
            {
                _gl.Enable(EnableCap.Blend);
                _gl.DepthMask(false);
                blending = true;
            }
            _gl.Uniform4(_colorLocation, mesh.Color);
            _gl.BindTexture(TextureTarget.Texture2D, mesh.Texture);
            _gl.BindVertexArray(mesh.Vao);
            _gl.DrawElements(PrimitiveType.Triangles, mesh.IndexCount, DrawElementsType.UnsignedInt, null);
        }
        _gl.Disable(EnableCap.Blend);
        _gl.DepthMask(true);
    }

    private static uint CreateProgram(string vertexSource, string fragmentSource)
    {
        uint vs = CompileShader(ShaderType.VertexShader, vertexSource);
        uint fs = CompileShader(ShaderType.FragmentShader, fragmentSource);
        uint program = _gl.CreateProgram();
        _gl.AttachShader(program, vs);
        _gl.AttachShader(program, fs);
        _gl.LinkProgram(program);
        _gl.GetProgram(program, ProgramPropertyARB.LinkStatus, out int status);
        if (status == 0) throw new Exception("Erro ao linkar shader: " + _gl.GetProgramInfoLog(program));
        _gl.DeleteShader(vs);
        _gl.DeleteShader(fs);
        return program;
    }

    private static uint CompileShader(ShaderType type, string source)
    {
        uint shader = _gl.CreateShader(type);
        _gl.ShaderSource(shader, source);
        _gl.CompileShader(shader);
        _gl.GetShader(shader, ShaderParameterName.CompileStatus, out int status);
        if (status == 0) throw new Exception($"Erro ao compilar {type}: " + _gl.GetShaderInfoLog(shader));
        return shader;
    }

    private static void OnClose()
    {
        _scene.Dispose();
        _arms.Dispose();
        _gl.DeleteProgram(_program);
        _input.Dispose();
    }
}
