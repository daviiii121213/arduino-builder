using System.Numerics;
using Silk.NET.Input;
using Silk.NET.Maths;
using Silk.NET.OpenGL;
using Silk.NET.Windowing;

namespace ShootingRange;

public static class Program
{
    // O cenário está em centímetros, então todas as medidas abaixo também estão.
    private const string ModelPath = "models/shooting_range.fbx";
    private const string TextureDir = "models/tex";
    private const string ArmsPath = "models/arms.fbx";
    private const string GunPath = "models/glock.glb";
    private const string TargetPaperTexture = "models/tex/Target Paper_C.jpeg";
    private static readonly Vector3 Spawn = new(0, 0, -680);
    private const float MouseSensitivity = 0.0025f;
    private const float BulletRange = 10000f;

    // Arma e braços em primeira pessoa (estilo CS), em coordenadas da câmera (x direita, y cima, -z frente).
    // A arma fica na mão direita; o conjunto todo é girado em volta do cabo para mostrar a lateral da pistola.
    private static readonly Vector3 ArmsOffset = new(0f, -17f, -4f);
    private static readonly Vector3 GunOffset = new(6.5f, -15f, -44f);
    private static readonly Vector3 ViewmodelPosition = new(9f, -1f, 14f);
    private static readonly Vector3 ViewmodelRotation = new(0f, 15f, -6f); // graus: inclinação, giro, rolagem
    private const float ViewmodelFov = 68f;
    private const float BobAmount = 0.8f;            // altura do balanço ao andar
    private const float BobFrequency = 11f;
    private const float SwayAmount = 0.04f;          // quanto a arma atrasa ao girar o mouse
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
        uniform float uUnlit;
        out vec4 FragColor;
        void main()
        {
            vec3 n = normalize(vNormal);
            // Luz ambiente + luz vinda de cima + uma direcional leve para dar volume (sem acentos: GLSL so aceita ASCII).
            float sky = mix(0.35, 1.0, n.y * 0.5 + 0.5);
            float sun = max(dot(n, normalize(vec3(0.3, 1.0, 0.5))), 0.0);
            float light = mix(0.35 + 0.5 * sky + 0.25 * sun, 1.0, uUnlit);
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
    private static SceneModel _gun = null!;
    private static List<ShootingTarget> _targets = null!;
    private static CollisionWorld _collision = null!;
    private static TargetScoring _scoring = null!;
    private static Hud _hud = null!;
    private static Effects _effects = null!;
    private static uint _program;
    private static int _viewProjectionLocation, _modelLocation, _colorLocation, _unlitLocation;

    private static readonly Player _player = new(Spawn);
    private static readonly Weapon _weapon = new();
    private static readonly Random _random = new();
    private static Vector2? _lastMouse;
    private static float _bobTime;
    private static Vector2 _sway;
    private static bool _jumpQueued;
    private static Vector3 _muzzleLocal;

    private static int _score, _shotsFired, _hits;
    private static string _popupText = "";
    private static Vector4 _popupColor;
    private static float _popupTime;

    public static void Main()
    {
        // Os caminhos dos modelos são relativos à pasta do executável.
        Directory.SetCurrentDirectory(AppContext.BaseDirectory);

        var options = WindowOptions.Default with
        {
            Size = new Vector2D<int>(1280, 720),
            Title = "Shooting Range",
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

    private static bool MouseCaptured => _mouse.Cursor.CursorMode == CursorMode.Raw;

    private static void OnLoad()
    {
        _gl = GL.GetApi(_window);
        _input = _window.CreateInput();
        _keyboard = _input.Keyboards[0];
        _mouse = _input.Mice[0];

        _mouse.MouseDown += (_, button) =>
        {
            // O primeiro clique só captura o mouse, sem atirar.
            if (!MouseCaptured)
            {
                _mouse.Cursor.CursorMode = CursorMode.Raw;
                return;
            }
            if (button == MouseButton.Left) _weapon.Trigger();
            if (button == MouseButton.Right) _weapon.ToggleMode();
        };
        _mouse.MouseMove += OnMouseMove;
        _keyboard.KeyDown += (_, key, _) =>
        {
            if (key == Key.Escape) _mouse.Cursor.CursorMode = CursorMode.Normal;
            if (!MouseCaptured) return;
            if (key == Key.R) _weapon.StartReload();
            if (key == Key.Space) _jumpQueued = true;
        };

        Console.WriteLine("Carregando cenário...");
        _scene = new SceneModel(_gl, ModelPath, TextureDir);
        // Os alvos (suporte + papel) viram objetos móveis; o resto do cenário é fixo e tem colisão.
        _targets = _scene.Meshes
            .Where(m => m.Name.Contains("Target", StringComparison.OrdinalIgnoreCase))
            .GroupBy(m => m.Name)
            .Select(g => new ShootingTarget(g.Key, g.ToList()))
            .ToList();
        var targetMeshes = _targets.SelectMany(t => t.Meshes).ToHashSet();
        _collision = new CollisionWorld(_scene.Meshes.Where(m => !targetMeshes.Contains(m)));
        _scoring = new TargetScoring(TargetPaperTexture);

        _arms = new SceneModel(_gl, ArmsPath, TextureDir, ArmPose.Create());
        _gun = new SceneModel(_gl, GunPath, TextureDir);
        foreach (var mesh in _gun.Meshes) mesh.Color = new Vector4(0.035f, 0.035f, 0.04f, 1f);
        // Boca do cano: o ponto mais à frente do modelo, na altura do cano.
        _muzzleLocal = new Vector3(0, _gun.BoundsMax.Y - 2.3f, _gun.BoundsMax.Z + 0.5f);

        Console.WriteLine($"Pronto! {_targets.Count} alvos, {_collision.TriangleCount} triângulos de colisão.");
        Console.WriteLine("Clique para jogar. WASD mover, mouse mirar, botão esquerdo atirar, botão direito semi/rajada,");
        Console.WriteLine("R recarregar, Espaço pular, Ctrl agachar, Shift correr, Esc soltar o mouse.");

        _program = CreateProgram(VertexShader, FragmentShader);
        _viewProjectionLocation = _gl.GetUniformLocation(_program, "uViewProjection");
        _modelLocation = _gl.GetUniformLocation(_program, "uModel");
        _colorLocation = _gl.GetUniformLocation(_program, "uColor");
        _unlitLocation = _gl.GetUniformLocation(_program, "uUnlit");
        _hud = new Hud(_gl, CompileShader);
        _effects = new Effects(_gl);

        _gl.Enable(EnableCap.DepthTest);
        _gl.Enable(EnableCap.FramebufferSrgb);
        _gl.Enable(EnableCap.Multisample);
        _gl.BlendFunc(BlendingFactor.SrcAlpha, BlendingFactor.OneMinusSrcAlpha);
        _gl.ClearColor(0.07f, 0.07f, 0.07f, 1f);
    }

    private static void OnMouseMove(IMouse mouse, Vector2 position)
    {
        if (!MouseCaptured)
        {
            _lastMouse = null;
            return;
        }
        if (_lastMouse is Vector2 last)
        {
            Vector2 delta = position - last;
            _player.Yaw -= delta.X * MouseSensitivity;
            _player.Pitch = Math.Clamp(_player.Pitch - delta.Y * MouseSensitivity, -1.5f, 1.5f);
            _sway -= delta * SwayAmount;
        }
        _lastMouse = position;
    }

    private static void OnUpdate(double deltaTime)
    {
        float dt = MathF.Min((float)deltaTime, 0.05f);

        var move = Vector2.Zero;
        bool crouch = false, run = false;
        if (MouseCaptured)
        {
            if (_keyboard.IsKeyPressed(Key.W)) move.Y += 1;
            if (_keyboard.IsKeyPressed(Key.S)) move.Y -= 1;
            if (_keyboard.IsKeyPressed(Key.D)) move.X += 1;
            if (_keyboard.IsKeyPressed(Key.A)) move.X -= 1;
            crouch = _keyboard.IsKeyPressed(Key.ControlLeft) || _keyboard.IsKeyPressed(Key.ControlRight);
            run = _keyboard.IsKeyPressed(Key.ShiftLeft) || _keyboard.IsKeyPressed(Key.ShiftRight);
        }
        _player.Update(dt, move, _jumpQueued, crouch, run, _collision);
        _jumpQueued = false;

        foreach (var shot in _weapon.Update(dt, _player))
            ProcessShot(shot);
        foreach (var target in _targets)
            target.Update(dt);
        _popupTime = MathF.Max(_popupTime - dt, 0);

        // Balanço da arma proporcional à velocidade; o atraso do mouse volta suavemente ao centro.
        float speedFactor = _player.OnGround ? _player.HorizontalSpeed / Player.MaxSpeed : 0;
        _bobTime += dt * BobFrequency * speedFactor;
        _sway = Vector2.Clamp(_sway, new Vector2(-SwayMax), new Vector2(SwayMax));
        _sway = Vector2.Lerp(_sway, Vector2.Zero, MathF.Min(1f, 8f * dt));
    }

    private static void ProcessShot(Shot shot)
    {
        _shotsFired++;
        // As balas atravessam vidro, como no CS.
        RayHit? wall = _collision.Raycast(shot.Origin, shot.Direction, BulletRange, ignoreGlass: true);
        float wallDistance = wall?.Distance ?? BulletRange;

        ShootingTarget? hitTarget = null;
        TargetHit best = default;
        foreach (var target in _targets)
        {
            if (target.Raycast(shot.Origin, shot.Direction, wallDistance) is TargetHit hit
                && (hitTarget == null || hit.Distance < best.Distance))
            {
                hitTarget = target;
                best = hit;
            }
        }

        if (hitTarget != null)
        {
            _effects.AddBulletHole(hitTarget, best.LocalPoint, best.Normal, onPaper: best.OnPaper);
            if (!best.OnPaper) return;
            int points = _scoring.Score(best.Uv);
            ShowPopup(points);
            if (points > 0)
            {
                _hits++;
                _score += points;
                hitTarget.Relocate(_random);
            }
        }
        else if (wall is RayHit w)
        {
            _effects.AddBulletHole(null, shot.Origin + shot.Direction * w.Distance, w.Normal, onPaper: false);
        }
    }

    private static void ShowPopup(int points)
    {
        _popupTime = 1.2f;
        _popupText = points > 0 ? "+" + points : "ERROU";
        _popupColor = points switch
        {
            10 => new Vector4(1f, 0.8f, 0.2f, 1f),
            >= 7 => new Vector4(0.4f, 1f, 0.4f, 1f),
            > 0 => new Vector4(1f, 1f, 1f, 1f),
            _ => new Vector4(1f, 0.35f, 0.35f, 1f),
        };
    }

    private static void OnRender(double deltaTime)
    {
        _gl.Clear(ClearBufferMask.ColorBufferBit | ClearBufferMask.DepthBufferBit);

        var size = _window.FramebufferSize;
        float aspect = size.Y > 0 ? (float)size.X / size.Y : 1f;

        // A câmera mostra só parte do recuo (ViewPunch); a bala usa o recuo inteiro.
        var punch = _weapon.ViewPunch * (MathF.PI / 180f);
        float pitch = _player.Pitch + punch.X, yaw = _player.Yaw - punch.Y;
        var look = new Vector3(MathF.Cos(pitch) * MathF.Sin(yaw), MathF.Sin(pitch), MathF.Cos(pitch) * MathF.Cos(yaw));
        var eye = _player.Eye;
        var view = Matrix4x4.CreateLookAt(eye, eye + look, Vector3.UnitY);
        var projection = Matrix4x4.CreatePerspectiveFieldOfView(75f * MathF.PI / 180f, aspect, 5f, 5000f);

        _gl.UseProgram(_program);
        _gl.ActiveTexture(TextureUnit.Texture0);
        _gl.Uniform1(_unlitLocation, 0f);
        SetViewProjection(view * projection);
        DrawMeshes(_scene.Meshes, Matrix4x4.Identity);
        _effects.DrawBulletHoles(_colorLocation, _modelLocation);

        // A arma e os braços são desenhados por cima de tudo, com FOV próprio, como nos jogos de tiro:
        // limpar a profundidade impede que eles atravessem paredes.
        _gl.Clear(ClearBufferMask.DepthBufferBit);
        Matrix4x4.Invert(view, out var cameraToWorld);
        var viewmodel = ViewmodelTransform();
        SetViewProjection(view * Matrix4x4.CreatePerspectiveFieldOfView(ViewmodelFov * MathF.PI / 180f, aspect, 1f, 500f));
        // Os modelos apontam para +Z; a câmera olha para -Z, então giram 180° em Y.
        var armsLocal = Matrix4x4.CreateRotationY(MathF.PI) * Matrix4x4.CreateTranslation(ArmsOffset) * viewmodel;
        var gunLocal = Matrix4x4.CreateRotationY(MathF.PI) * Matrix4x4.CreateTranslation(GunOffset) * viewmodel;
        DrawMeshes(_arms.Meshes, armsLocal * cameraToWorld);
        DrawMeshes(_gun.Meshes, gunLocal * cameraToWorld);
        if (_weapon.MuzzleFlash > 0)
            _effects.DrawMuzzleFlash(Vector3.Transform(_muzzleLocal, gunLocal * cameraToWorld), cameraToWorld,
                _colorLocation, _modelLocation, _unlitLocation, _random);

        DrawHud(size.X, size.Y);
    }

    // Balanço ao andar, atraso do mouse, coice do tiro e animação de recarga (em coordenadas da câmera).
    private static Matrix4x4 ViewmodelTransform()
    {
        var offset = new Vector3(
            MathF.Sin(_bobTime * 0.5f) * BobAmount + _sway.X,
            -MathF.Abs(MathF.Sin(_bobTime)) * BobAmount - _sway.Y,
            0f);
        float kick = _weapon.Kick * _weapon.Kick;
        offset.Z += kick * 2.5f;
        float pitchUp = kick * 7f * MathF.PI / 180f;

        float reload = _weapon.Reloading ? MathF.Sin(_weapon.ReloadProgress * MathF.PI) : 0;
        offset.Y -= reload * 12f;
        float roll = reload * 25f * MathF.PI / 180f;

        // Todas as rotações acontecem em volta do cabo da arma.
        const float deg = MathF.PI / 180f;
        var rotation = Matrix4x4.CreateRotationZ(ViewmodelRotation.Z * deg + roll)
                       * Matrix4x4.CreateRotationX(ViewmodelRotation.X * deg + pitchUp)
                       * Matrix4x4.CreateRotationY(ViewmodelRotation.Y * deg);
        return Matrix4x4.CreateTranslation(-GunOffset) * rotation * Matrix4x4.CreateTranslation(GunOffset)
               * Matrix4x4.CreateTranslation(ViewmodelPosition + offset);
    }

    private static unsafe void SetViewProjection(Matrix4x4 viewProjection)
    {
        _gl.UniformMatrix4(_viewProjectionLocation, 1, false, (float*)&viewProjection);
    }

    private static unsafe void DrawMeshes(IEnumerable<DrawMesh> meshes, Matrix4x4 world)
    {
        bool blending = false;
        foreach (var mesh in meshes)
        {
            if (mesh.Transparent && !blending)
            {
                _gl.Enable(EnableCap.Blend);
                _gl.DepthMask(false);
                blending = true;
            }
            var model = mesh.Transform * world;
            _gl.UniformMatrix4(_modelLocation, 1, false, (float*)&model);
            _gl.Uniform4(_colorLocation, mesh.Color);
            _gl.BindTexture(TextureTarget.Texture2D, mesh.Texture);
            _gl.BindVertexArray(mesh.Vao);
            _gl.DrawElements(PrimitiveType.Triangles, mesh.IndexCount, DrawElementsType.UnsignedInt, null);
        }
        _gl.Disable(EnableCap.Blend);
        _gl.DepthMask(true);
    }

    private static void DrawHud(int width, int height)
    {
        var white = new Vector4(1, 1, 1, 0.95f);
        var dim = new Vector4(1, 1, 1, 0.6f);
        float margin = 28;

        // Pontos no canto superior direito.
        _hud.Text("PONTOS", width - margin, margin, 3, dim, Hud.Align.Right);
        _hud.Text(_score.ToString(), width - margin, margin + 30, 8, white, Hud.Align.Right);
        if (_popupTime > 0)
        {
            var c = _popupColor with { W = MathF.Min(1, _popupTime / 0.4f) };
            float rise = (1.2f - _popupTime) * 25;
            _hud.Text(_popupText, width - margin, margin + 105 - rise, 5, c, Hud.Align.Right);
        }

        // Precisão no canto inferior esquerdo.
        int accuracy = _shotsFired > 0 ? (int)MathF.Round(100f * _hits / _shotsFired) : 0;
        _hud.Text($"ACERTOS {_hits}/{_shotsFired}  {accuracy}%", margin, height - margin - 21, 3, dim);

        // Munição no canto inferior direito.
        _hud.Text($"{_weapon.Clip} / {_weapon.Reserve}", width - margin, height - margin - 42, 6, white, Hud.Align.Right);
        _hud.Text(_weapon.BurstMode ? "RAJADA" : "SEMI", width - margin, height - margin - 72, 3, dim, Hud.Align.Right);
        if (_weapon.Reloading)
        {
            float barWidth = 220;
            _hud.Text("RECARREGANDO", width / 2f, height * 0.62f, 3, white, Hud.Align.Center);
            _hud.Rect(width / 2f - barWidth / 2, height * 0.62f + 30, barWidth, 6, new Vector4(0, 0, 0, 0.5f));
            _hud.Rect(width / 2f - barWidth / 2, height * 0.62f + 30, barWidth * _weapon.ReloadProgress, 6, white);
        }
        else if (_weapon.Clip == 0 && _weapon.Reserve == 0)
        {
            _hud.Text("SEM MUNICAO", width / 2f, height * 0.62f, 3, new Vector4(1, 0.4f, 0.4f, 1), Hud.Align.Center);
        }

        if (!MouseCaptured)
        {
            _hud.Rect(0, 0, width, height, new Vector4(0, 0, 0, 0.45f));
            _hud.Text("CLIQUE PARA JOGAR", width / 2f, height / 2f - 60, 6, white, Hud.Align.Center);
            string[] help =
            {
                "WASD MOVER   MOUSE MIRAR   SHIFT CORRER",
                "BOTAO ESQUERDO ATIRAR   BOTAO DIREITO SEMI/RAJADA",
                "R RECARREGAR   ESPACO PULAR   CTRL AGACHAR   ESC SOLTAR O MOUSE",
            };
            for (int i = 0; i < help.Length; i++)
                _hud.Text(help[i], width / 2f, height / 2f + 10 + i * 28, 3, dim, Hud.Align.Center);
        }

        _hud.Flush(width, height);
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
        _gun.Dispose();
        _hud.Dispose();
        _effects.Dispose();
        _gl.DeleteProgram(_program);
        _input.Dispose();
    }
}
