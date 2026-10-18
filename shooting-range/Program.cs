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
    private const string GunPath = "models/akm.glb";
    private const string RigPath = "models/ak_viewmodel.json";
    private const string TargetPaperTexture = "models/tex/Target Paper_C.jpeg";
    private static readonly Vector3 Spawn = new(0, 0, -680);
    private const float MouseSensitivity = 0.0025f;
    private const float BulletRange = 10000f;

    // Arma e braços em primeira pessoa (estilo CS). Posição, poses e animações vêm de models/ak_viewmodel.json.
    private const float ViewmodelFov = 68f;
    private const float KickBack = 3f;               // cm que a arma recua no tiro
    private const float KickPitch = 4f;              // graus que o cano sobe no tiro
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
    private static ViewmodelRig _rig = null!;
    private static Weapon _weapon = null!;
    // Peças do AKM agrupadas pelo nome do nó: body, mag, bolt, magrelease, selector.
    private static Dictionary<string, List<DrawMesh>> _gunParts = null!;
    private static List<ShootingTarget> _targets = null!;
    private static CollisionWorld _collision = null!;
    private static TargetScoring _scoring = null!;
    private static Hud _hud = null!;
    private static Effects _effects = null!;
    private static uint _program;
    private static int _viewProjectionLocation, _modelLocation, _colorLocation, _unlitLocation;

    private static readonly Player _player = new(Spawn);
    private static readonly Random _random = new();
    private static Vector2? _lastMouse;
    private static float _bobTime;
    private static Vector2 _sway;
    private static bool _jumpQueued;
    private static bool _drawn;
    private static bool _armsAnimated = true;
    private static int _pendingCasings;

    private static int _score, _shotsFired, _hits;
    // Sessão na baia atual (só nas baias 1, 4, 6 e 9) e o resumo mostrado ao sair dela.
    private static BoothSession? _session;
    private static BoothSession? _summary;
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
            // Na tela de resumo da baia, o clique fecha o resumo e volta ao jogo.
            if (_summary != null)
            {
                _summary = null;
                _mouse.Cursor.CursorMode = CursorMode.Raw;
                return;
            }
            // No menu, o botão alterna o modo automático; qualquer outro clique captura o mouse, sem atirar.
            if (!MouseCaptured && AutoButtonRect(_window.FramebufferSize.X, _window.FramebufferSize.Y).Contains(new Vector2D<float>(_mouse.Position.X, _mouse.Position.Y)))
            {
                _weapon.Automatic = !_weapon.Automatic;
                return;
            }
            if (!MouseCaptured)
            {
                _mouse.Cursor.CursorMode = CursorMode.Raw;
                // Na primeira vez a arma é sacada (animação de "deploy").
                if (!_drawn) _weapon.Draw();
                _drawn = true;
                return;
            }
            if (button == MouseButton.Left) _weapon.Trigger();
        };
        _mouse.MouseMove += OnMouseMove;
        _keyboard.KeyDown += (_, key, _) =>
        {
            if (key == Key.Escape) _mouse.Cursor.CursorMode = CursorMode.Normal;
            if (!MouseCaptured) return;
            if (key == Key.R) _weapon.StartReload();
            if (key == Key.F) _weapon.Inspect();
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

        _rig = new ViewmodelRig(RigPath);
        _weapon = new Weapon(_rig);
        _arms = new SceneModel(_gl, ArmsPath, TextureDir);
        _gun = new SceneModel(_gl, GunPath, TextureDir);
        _gunParts = _gun.Meshes.GroupBy(m => m.Name.Split('_')[0]).ToDictionary(g => g.Key, g => g.ToList());

        Console.WriteLine($"Pronto! {_targets.Count} alvos, {_collision.TriangleCount} triângulos de colisão.");
        Console.WriteLine("Clique para jogar. WASD mover, mouse mirar, botão esquerdo atirar (um tiro por clique),");
        Console.WriteLine("R recarregar, F inspecionar, Espaço pular, Ctrl agachar, Shift correr, Esc soltar o mouse.");

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
        UpdateBooth();
        _weapon.TriggerHeld = MouseCaptured && _mouse.IsButtonPressed(MouseButton.Left);
        _jumpQueued = false;

        foreach (var shot in _weapon.Update(dt, _player))
        {
            ProcessShot(shot);
            _pendingCasings++;
        }
        _effects.Update(dt);
        foreach (var target in _targets)
            target.Update(dt);
        _popupTime = MathF.Max(_popupTime - dt, 0);

        // Balanço da arma proporcional à velocidade; o atraso do mouse volta suavemente ao centro.
        float speedFactor = _player.OnGround ? _player.HorizontalSpeed / Player.MaxSpeed : 0;
        _bobTime += dt * BobFrequency * speedFactor;
        _sway = Vector2.Clamp(_sway, new Vector2(-SwayMax), new Vector2(SwayMax));
        _sway = Vector2.Lerp(_sway, Vector2.Zero, MathF.Min(1f, 8f * dt));
    }

    // Entrar numa baia com pontuação zera os pontos; sair dela mostra o resumo numa tela separada.
    private static void UpdateBooth()
    {
        int? booth = Booths.ScoredAt(_player.Feet);
        if (booth == _session?.Booth) return;
        if (_session is { Shots: > 0 })
        {
            _summary = _session;
            _mouse.Cursor.CursorMode = CursorMode.Normal;
        }
        _session = booth is int b ? new BoothSession(b) : null;
        _score = _shotsFired = _hits = 0;
    }

    private static void ProcessShot(Shot shot)
    {
        int points = ShotPoints(shot);
        _session?.Record(points);
    }

    // Pontos do tiro (0 = errou).
    private static int ShotPoints(Shot shot)
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
            int points = best.OnPaper ? _scoring.Score(best.Uv) : 0;
            ShowPopup(points);
            if (points > 0)
            {
                _hits++;
                _score += points;
                hitTarget.Relocate(_random);
            }
            return points;
        }
        if (wall is RayHit w)
            _effects.AddBulletHole(null, shot.Origin + shot.Direction * w.Distance, w.Normal, onPaper: false);
        return 0;
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
        var frame = _rig.Evaluate(_weapon.Animation, _weapon.AnimationTime, _weapon.TimeSinceShot);
        var viewmodel = ViewmodelTransform(frame);
        SetViewProjection(view * Matrix4x4.CreatePerspectiveFieldOfView(ViewmodelFov * MathF.PI / 180f, aspect, 1f, 500f));

        // A pele dos braços só é recalculada quando a pose muda (durante animações).
        if (_weapon.Animation != null || _armsAnimated)
        {
            _arms.SetPose(frame.ArmPose);
            _armsAnimated = _weapon.Animation != null;
        }
        // Os modelos apontam para +Z; a câmera olha para -Z, então giram 180° em Y.
        var armsWorld = Matrix4x4.CreateRotationY(MathF.PI) * Matrix4x4.CreateTranslation(_rig.ArmsOffset) * viewmodel * cameraToWorld;
        var gunWorld = Matrix4x4.CreateRotationY(MathF.PI) * Matrix4x4.CreateTranslation(_rig.GunOffset) * viewmodel * cameraToWorld;
        SetPartTransforms(frame);
        DrawMeshes(_arms.Meshes, armsWorld);
        DrawMeshes(_gun.Meshes, gunWorld);

        for (; _pendingCasings > 0; _pendingCasings--)
        {
            var right = Vector3.Normalize(new Vector3(cameraToWorld.M11, cameraToWorld.M12, cameraToWorld.M13));
            var up = Vector3.Normalize(new Vector3(cameraToWorld.M21, cameraToWorld.M22, cameraToWorld.M23));
            _effects.EjectCasing(Vector3.Transform(_rig.EjectionPort, gunWorld), right, up, look);
        }
        _effects.DrawCasings(_colorLocation, _modelLocation);
        if (_weapon.MuzzleFlash > 0)
            _effects.DrawMuzzleFlash(Vector3.Transform(_rig.Muzzle, gunWorld), cameraToWorld,
                _colorLocation, _modelLocation, _unlitLocation, _random);

        DrawHud(size.X, size.Y);
    }

    // Balanço ao andar, atraso do mouse, coice do tiro e a animação atual (em coordenadas da câmera).
    private static Matrix4x4 ViewmodelTransform(ViewmodelFrame frame)
    {
        var offset = new Vector3(
            MathF.Sin(_bobTime * 0.5f) * BobAmount + _sway.X,
            -MathF.Abs(MathF.Sin(_bobTime)) * BobAmount - _sway.Y,
            0f) + frame.RootOffset;
        float kick = _weapon.Kick * _weapon.Kick;
        offset.Z += kick * KickBack;

        // Todas as rotações acontecem em volta do punho da arma.
        const float deg = MathF.PI / 180f;
        var angles = (_rig.Rotation + frame.RootRotation) * deg;
        var rotation = Matrix4x4.CreateRotationZ(angles.Z)
                       * Matrix4x4.CreateRotationX(angles.X + kick * KickPitch * deg)
                       * Matrix4x4.CreateRotationY(angles.Y);
        return Matrix4x4.CreateTranslation(-_rig.GunOffset) * rotation * Matrix4x4.CreateTranslation(_rig.GunOffset)
               * Matrix4x4.CreateTranslation(offset);
    }

    // Peças móveis do AKM, no espaço da arma: carregador (balança em volta da frente e desce),
    // retém do carregador, porta-ferrolho (corre para trás).
    private static void SetPartTransforms(ViewmodelFrame frame)
    {
        const float deg = MathF.PI / 180f;
        var mag = Matrix4x4.CreateTranslation(-_rig.MagPivot) * Matrix4x4.CreateRotationX(frame.MagRotation * deg)
                  * Matrix4x4.CreateTranslation(_rig.MagPivot + frame.MagOffset);
        var release = Matrix4x4.CreateTranslation(-_rig.MagReleasePivot) * Matrix4x4.CreateRotationX(frame.MagRelease * deg)
                      * Matrix4x4.CreateTranslation(_rig.MagReleasePivot);
        var bolt = Matrix4x4.CreateTranslation(0, 0, frame.Bolt);
        foreach (var (part, meshes) in _gunParts)
        {
            var transform = part switch { "mag" => mag, "magrelease" => release, "bolt" => bolt, _ => Matrix4x4.Identity };
            foreach (var mesh in meshes) mesh.Transform = transform;
        }
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

    // Mira do CS (verde, quatro traços): a abertura acompanha a imprecisão atual da arma,
    // então ela abre ao andar, pular ou atirar rápido e fecha parado.
    private static void DrawCrosshair(int width, int height)
    {
        const float length = 9, thickness = 2, outline = 1;
        float tanHalfFov = MathF.Tan(75f * MathF.PI / 360f);
        float spread = MathF.Tan(_weapon.Inaccuracy(_player)) / tanHalfFov * (height / 2f);
        float gap = MathF.Min(4 + spread, height * 0.3f);
        float cx = MathF.Round(width / 2f), cy = MathF.Round(height / 2f);
        var color = new Vector4(0.3f, 1f, 0.3f, 0.95f);
        var shadow = new Vector4(0, 0, 0, 0.8f);
        var lines = new[]
        {
            (cx - thickness / 2, cy - gap - length, thickness, length),
            (cx - thickness / 2, cy + gap, thickness, length),
            (cx - gap - length, cy - thickness / 2, length, thickness),
            (cx + gap, cy - thickness / 2, length, thickness),
        };
        foreach (var (x, y, w, h) in lines)
            _hud.Rect(x - outline, y - outline, w + outline * 2, h + outline * 2, shadow);
        foreach (var (x, y, w, h) in lines)
            _hud.Rect(x, y, w, h, color);
    }

    // Tela de resumo ao sair de uma baia: total e pontos acumulados antes de cada erro.
    private static void DrawSummary(BoothSession s, int width, int height)
    {
        var white = new Vector4(1, 1, 1, 0.95f);
        var dim = new Vector4(1, 1, 1, 0.6f);
        var accent = new Vector4(0.3f, 1f, 0.3f, 0.95f);
        _hud.Rect(0, 0, width, height, new Vector4(0.03f, 0.03f, 0.035f, 0.93f));
        float cx = width / 2f, y = height * 0.12f;
        _hud.Text($"BAIA {s.Booth}  RESULTADO", cx, y, 5, white, Hud.Align.Center);
        y += 60;
        _hud.Text("PONTOS NO TOTAL", cx, y, 3, dim, Hud.Align.Center);
        _hud.Text(s.Score.ToString(), cx, y + 28, 9, accent, Hud.Align.Center);
        y += 110;
        int accuracy = (int)MathF.Round(100f * s.Hits / s.Shots);
        _hud.Text($"TIROS {s.Shots}   ACERTOS {s.Hits}   ERROS {s.PointsBeforeMiss.Count}   {accuracy}%", cx, y, 3, white, Hud.Align.Center);
        y += 50;

        if (s.PointsBeforeMiss.Count == 0)
        {
            _hud.Text("NENHUM ERRO", cx, y, 4, accent, Hud.Align.Center);
        }
        else
        {
            // Colunas: nº do erro, pontos acumulados antes dele, pontos feitos desde o erro anterior.
            float c1 = cx - 330, c2 = cx - 20, c3 = cx + 330;
            _hud.Text("ERRO", c1, y, 3, dim);
            _hud.Text("PONTOS ANTES", c2, y, 3, dim, Hud.Align.Right);
            _hud.Text("DESDE O ANTERIOR", c3, y, 3, dim, Hud.Align.Right);
            y += 32;
            int rows = Math.Min(s.PointsBeforeMiss.Count, (int)((height * 0.86f - y) / 26));
            for (int i = 0; i < rows; i++)
            {
                int before = s.PointsBeforeMiss[i];
                int streak = before - (i > 0 ? s.PointsBeforeMiss[i - 1] : 0);
                _hud.Text($"{i + 1}", c1, y, 3, white);
                _hud.Text(before.ToString(), c2, y, 3, white, Hud.Align.Right);
                _hud.Text($"+{streak}", c3, y, 3, streak > 0 ? accent : dim, Hud.Align.Right);
                y += 26;
            }
            if (rows < s.PointsBeforeMiss.Count)
                _hud.Text($"+ {s.PointsBeforeMiss.Count - rows} ERROS", cx, y, 3, dim, Hud.Align.Center);
        }
        _hud.Text("CLIQUE PARA CONTINUAR", cx, height * 0.92f, 3, white, Hud.Align.Center);
    }

    // Botão "automático" do menu (em pixels da janela).
    private static Rectangle<float> AutoButtonRect(int width, int height) =>
        new(width / 2f - 210, height / 2f + 110, 420, 46);

    private static void DrawHud(int width, int height)
    {
        var white = new Vector4(1, 1, 1, 0.95f);
        var dim = new Vector4(1, 1, 1, 0.6f);
        float margin = 28;

        if (MouseCaptured) DrawCrosshair(width, height);

        // Pontos no canto superior direito.
        _hud.Text(_session != null ? $"BAIA {_session.Booth}  PONTOS" : "TREINO  PONTOS", width - margin, margin, 3, dim, Hud.Align.Right);
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
        _hud.Text(_weapon.Automatic ? "AK-47  AUTO" : "AK-47  SEMI", width - margin, height - margin - 72, 3, dim, Hud.Align.Right);
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

        if (_summary != null)
        {
            DrawSummary(_summary, width, height);
        }
        else if (!MouseCaptured)
        {
            _hud.Rect(0, 0, width, height, new Vector4(0, 0, 0, 0.45f));
            _hud.Text("CLIQUE PARA JOGAR", width / 2f, height / 2f - 60, 6, white, Hud.Align.Center);
            string[] help =
            {
                "WASD MOVER   MOUSE MIRAR   SHIFT CORRER",
                "CLIQUE ATIRAR   R RECARREGAR   F INSPECIONAR",
                "ESPACO PULAR   CTRL AGACHAR   ESC SOLTAR O MOUSE",
            };
            for (int i = 0; i < help.Length; i++)
                _hud.Text(help[i], width / 2f, height / 2f + 10 + i * 28, 3, dim, Hud.Align.Center);

            // Opção do menu: arma automática ativada ou desativada.
            var button = AutoButtonRect(width, height);
            var on = new Vector4(0.3f, 1f, 0.3f, 0.95f);
            _hud.Rect(button.Origin.X, button.Origin.Y, button.Size.X, button.Size.Y, new Vector4(0, 0, 0, 0.6f));
            _hud.Rect(button.Origin.X, button.Origin.Y + button.Size.Y - 3, button.Size.X, 3, _weapon.Automatic ? on : dim);
            _hud.Text(_weapon.Automatic ? "AUTOMATICO: ATIVADO" : "AUTOMATICO: DESATIVADO",
                width / 2f, button.Origin.Y + 13, 3, _weapon.Automatic ? on : white, Hud.Align.Center);
            _hud.Text("CLIQUE NO BOTAO PARA MUDAR", width / 2f, button.Origin.Y + button.Size.Y + 10, 2, dim, Hud.Align.Center);
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
