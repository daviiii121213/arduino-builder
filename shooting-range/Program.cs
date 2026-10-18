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
    // Decorações (caixas de munição, armas expostas, estantes...) já posicionadas; ver tools/decor-build.py.
    private const string DecorPath = "models/decor.glb";
    // Armas do jogo. Cada JSON traz modelo, números, poses e animações. A primeira começa na mão;
    // as outras ficam na bancada do fundo do saguão e são trocadas com a da mão (tecla E).
    private static readonly string[] WeaponRigs =
    {
        "models/ak_viewmodel.json", "models/fiveseven_viewmodel.json", "models/p38_viewmodel.json",
        "models/m1911_viewmodel.json", "models/mosin_viewmodel.json", "models/shotgun_viewmodel.json",
    };
    // Bancada (balcão da parede do fundo): tampo em y = 93, de z = -828 a -791. Cada lugar guarda uma arma
    // (índice em WeaponRigs), deitada sobre o lado direito, com o cano para a esquerda de quem olha.
    private const float BenchTop = 93f, BenchZ = -809f;
    // Lugares a 125 cm um do outro: cabe qualquer arma em qualquer lugar (a maior é o Mosin, 123 cm).
    private static readonly (float X, int Slot)[] BenchStart = { (-760, 4), (-635, 5), (-510, 2), (-385, 1), (-260, 3) };
    private const float InteractRange = 170f;
    private const string UpgradesPath = "models/upgrades.json";
    private const float Fov = 75f;
    private const float ScopeFov = 37.5f;           // zoom 2x da mira ótica
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
    private static SceneModel _decor = null!;
    private sealed record WeaponSlot(ViewmodelRig Rig, Weapon Weapon, SceneModel Model, Dictionary<string, List<DrawMesh>> Parts);
    private sealed class BenchSpot
    {
        public float X;
        public int Slot;
        public Matrix4x4 World;   // modelo da arma -> mundo, deitada na bancada
    }
    private static readonly List<BenchSpot> _bench = new();
    private static BenchSpot? _benchTarget;
    private static readonly List<WeaponSlot> _slots = new();
    private static int _slot;
    // Atalhos para a arma na mão (cada arma guarda a própria munição).
    private static SceneModel _gun = null!;
    private static ViewmodelRig _rig = null!;
    private static Weapon _weapon = null!;
    private static bool _automatic;
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
    private static Upgrades _upgrades = null!;
    private static float _fov = Fov;
    private static double _resetArmedUntil;
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
            // No menu, clicar num cartão compra a melhoria.
            if (!MouseCaptured && ClickUpgradePanel(new Vector2(_mouse.Position.X, _mouse.Position.Y)))
                return;
            // No menu, o botão alterna o modo automático; qualquer outro clique captura o mouse, sem atirar.
            if (!MouseCaptured && AutoButtonRect(_window.FramebufferSize.X, _window.FramebufferSize.Y).Contains(new Vector2D<float>(_mouse.Position.X, _mouse.Position.Y)))
            {
                _automatic = !_automatic;
                _weapon.Automatic = _automatic;
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
            // Tab pausa e mostra as melhorias; de novo, volta ao jogo.
            if (key == Key.Tab && _summary == null)
            {
                _mouse.Cursor.CursorMode = MouseCaptured ? CursorMode.Normal : CursorMode.Raw;
                return;
            }
            if (!MouseCaptured) return;
            if (key == Key.R) _weapon.StartReload();
            if (key == Key.F) _weapon.Inspect();
            if (key == Key.E && _benchTarget != null) SwapWithBench(_benchTarget);
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
        _decor = new SceneModel(_gl, DecorPath, TextureDir);
        // As decorações também têm colisão: o jogador esbarra nelas e os tiros deixam marca.
        _collision = new CollisionWorld(_scene.Meshes.Where(m => !targetMeshes.Contains(m)).Concat(_decor.Meshes));
        _scoring = new TargetScoring(TargetPaperTexture);

        _upgrades = new Upgrades(UpgradesPath);
        _arms = new SceneModel(_gl, ArmsPath, TextureDir);
        foreach (var path in WeaponRigs)
        {
            var rig = new ViewmodelRig(path);
            var model = new SceneModel(_gl, rig.ModelPath, TextureDir);
            // Peças agrupadas pelo nome do nó: body, mag, bolt/slide, magrelease, trigger...
            var parts = model.Meshes.GroupBy(m => m.Name.Split('_')[0]).ToDictionary(g => g.Key, g => g.ToList());
            _slots.Add(new WeaponSlot(rig, new Weapon(rig, _upgrades), model, parts));
        }
        SelectWeapon(0);
        foreach (var (x, slot) in BenchStart)
            _bench.Add(new BenchSpot { X = x, Slot = slot, World = BenchTransform(x, slot) });

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
            // Com zoom, a sensibilidade cai na mesma proporção do campo de visão.
            float sensitivity = MouseSensitivity * _fov / Fov;
            _player.Yaw -= delta.X * sensitivity;
            _player.Pitch = Math.Clamp(_player.Pitch - delta.Y * sensitivity, -1.5f, 1.5f);
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
        // Botão direito: zoom 2x da melhoria "Mira ótica", ou a luneta da própria arma (Mosin PU, 3,5x).
        float scopeFov = _rig.Stats.ScopeFov > 0 ? _rig.Stats.ScopeFov : _upgrades.HasScope ? ScopeFov : 0;
        bool scoped = scopeFov > 0 && MouseCaptured && _mouse.IsButtonPressed(MouseButton.Right)
                      && !_weapon.Reloading && _weapon.Animation != "cycle";
        _fov += ((scoped ? scopeFov : Fov) - _fov) * MathF.Min(1, 14 * dt);
        _weapon.Scoped = scoped && _rig.Stats.ScopeFov > 0 && _fov < _rig.Stats.ScopeFov + 4;
        _jumpQueued = false;

        var shots = _weapon.Update(dt, _player);
        if (shots.Count > 0) ProcessShots(shots);
        _pendingCasings += _weapon.TakeEjects();
        _benchTarget = FindBenchTarget();
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

    // Bancada: a arma fica deitada sobre o lado direito (lado esquerdo para cima), cano para -X do mundo,
    // o topo virado para a parede, apoiada no tampo e centrada no lugar.
    private static Matrix4x4 BenchTransform(float x, int slot)
    {
        var model = _slots[slot].Model;
        Vector3 lo = model.BoundsMin, hi = model.BoundsMax;
        // Linhas = para onde vão os eixos da arma: X (esquerda) -> cima, Y (cima) -> parede, Z (cano) -> -X.
        var rotation = new Matrix4x4(0, 1, 0, 0, 0, 0, -1, 0, -1, 0, 0, 0, 0, 0, 0, 1);
        return rotation * Matrix4x4.CreateTranslation(x + (lo.Z + hi.Z) / 2, BenchTop - lo.X, BenchZ + (lo.Y + hi.Y) / 2);
    }

    // Arma da bancada para onde o jogador está olhando (perto o bastante para pegar).
    private static BenchSpot? FindBenchTarget()
    {
        if (!MouseCaptured) return null;
        var eye = _player.Eye;
        var look = new Vector3(MathF.Cos(_player.Pitch) * MathF.Sin(_player.Yaw), MathF.Sin(_player.Pitch),
            MathF.Cos(_player.Pitch) * MathF.Cos(_player.Yaw));
        BenchSpot? best = null;
        float bestT = InteractRange;
        foreach (var spot in _bench)
        {
            // Pontos ao longo da arma, do cano à coronha: vale se a mira passar a menos de 9 cm de um deles.
            var model = _slots[spot.Slot].Model;
            Vector3 lo = model.BoundsMin, hi = model.BoundsMax;
            var mid = (lo + hi) / 2;
            for (float z = lo.Z; z <= hi.Z; z += 4)
            {
                var p = Vector3.Transform(new Vector3(mid.X, mid.Y, z), spot.World);
                float t = Vector3.Dot(p - eye, look);
                if (t <= 0 || t >= bestT) continue;
                if (Vector3.Distance(eye + look * t, p) < 9f) { best = spot; bestT = t; }
            }
        }
        return best;
    }

    // A arma da mão vai para o lugar da bancada e a de lá vem para a mão.
    private static void SwapWithBench(BenchSpot spot)
    {
        int fromHand = _slot;
        _weapon.Holster();
        SelectWeapon(spot.Slot);
        spot.Slot = fromHand;
        spot.World = BenchTransform(spot.X, fromHand);
        _benchTarget = null;
    }

    // Troca a arma na mão e saca (animação de "deploy").
    private static void SelectWeapon(int index)
    {
        _slot = index;
        (_rig, _weapon, _gun, _gunParts) = (_slots[index].Rig, _slots[index].Weapon, _slots[index].Model, _slots[index].Parts);
        _weapon.Automatic = _automatic;
        Player.MaxSpeed = _rig.Stats.MaxSpeed;
        _armsAnimated = true;
        if (_drawn) _weapon.Draw();
    }

    // Entrar numa baia com pontuação zera os pontos; sair dela mostra o resumo numa tela separada.
    private static void UpdateBooth()
    {
        int? booth = Booths.ScoredAt(_player.Feet);
        if (booth == _session?.Booth) return;
        if (_session is { Shots: > 0 })
        {
            // Os pontos da baia viram créditos para as melhorias.
            _upgrades.AddCredits(_session.Score);
            _summary = _session;
            _mouse.Cursor.CursorMode = CursorMode.Normal;
        }
        _session = booth is int b ? new BoothSession(b) : null;
        _score = _shotsFired = _hits = 0;
        // Entrar numa baia com pontuação enche o pente e a reserva.
        if (_session != null)
            foreach (var slot in _slots) slot.Weapon.Refill();
    }

    // Um disparo: uma bala, ou os chumbos da espingarda. Os pontos de todos os chumbos somam num tiro só.
    private static void ProcessShots(List<Shot> shots)
    {
        _shotsFired++;
        int points = 0;
        var hitTargets = new HashSet<ShootingTarget>();
        foreach (var shot in shots) points += ShotPoints(shot, hitTargets);
        ShowPopup(points);
        if (points > 0)
        {
            _hits++;
            _score += points;
        }
        foreach (var target in hitTargets) target.Relocate(_random);
        _session?.Record(points);
    }

    // Pontos de uma bala/chumbo (0 = errou). Alvos acertados entram em hitTargets (mudam de lugar depois).
    private static int ShotPoints(Shot shot, HashSet<ShootingTarget> hitTargets)
    {
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
            if (points > 0) hitTargets.Add(hitTarget);
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
        var projection = Matrix4x4.CreatePerspectiveFieldOfView(_fov * MathF.PI / 180f, aspect, 5f, 5000f);

        _gl.UseProgram(_program);
        _gl.ActiveTexture(TextureUnit.Texture0);
        _gl.Uniform1(_unlitLocation, 0f);
        SetViewProjection(view * projection);
        DrawMeshes(_scene.Meshes, Matrix4x4.Identity);
        DrawMeshes(_decor.Meshes, Matrix4x4.Identity);
        // Armas na bancada (peças na posição de descanso).
        foreach (var spot in _bench)
        {
            foreach (var mesh in _slots[spot.Slot].Model.Meshes) mesh.Transform = Matrix4x4.Identity;
            DrawMeshes(_slots[spot.Slot].Model.Meshes, spot.World);
        }
        _effects.DrawBulletHoles(_colorLocation, _modelLocation);

        // A arma e os braços são desenhados por cima de tudo, com FOV próprio, como nos jogos de tiro:
        // limpar a profundidade impede que eles atravessem paredes.
        _gl.Clear(ClearBufferMask.DepthBufferBit);
        Matrix4x4.Invert(view, out var cameraToWorld);
        var frame = _rig.Evaluate(_weapon.Animation, _weapon.AnimationTime, _weapon.TimeSinceShot, _weapon.SlideLocked);
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
        // Olhando pela luneta, a arma sai da tela (a luneta é desenhada no HUD).
        if (!_weapon.Scoped)
        {
            DrawMeshes(_arms.Meshes, armsWorld);
            DrawMeshes(_gun.Meshes, gunWorld);
        }

        for (; _pendingCasings > 0; _pendingCasings--)
        {
            var right = Vector3.Normalize(new Vector3(cameraToWorld.M11, cameraToWorld.M12, cameraToWorld.M13));
            var up = Vector3.Normalize(new Vector3(cameraToWorld.M21, cameraToWorld.M22, cameraToWorld.M23));
            // A P38 joga o estojo para cima e para a esquerda; as outras, para a direita.
            _effects.EjectCasing(Vector3.Transform(_rig.EjectionPort, gunWorld), _rig.Stats.EjectLeft ? -right : right, up, look, _rig.Stats.Casing);
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
        // O ferrolho do Mosin gira em volta do eixo do cano (alavanca para cima) antes de correr para trás.
        var pivot = new Vector3(_rig.BoltPivot, 0);
        var bolt = Matrix4x4.CreateTranslation(-pivot) * Matrix4x4.CreateRotationZ(frame.BoltRotation * deg)
                   * Matrix4x4.CreateTranslation(pivot) * Matrix4x4.CreateTranslation(0, 0, frame.Bolt);
        foreach (var (part, meshes) in _gunParts)
        {
            // "bolt": porta-ferrolho do AK / ferrolho do Mosin; "slide": ferrolho da pistola; "pump": telha da
            // espingarda. Todos correm para trás com a trilha "bolt".
            var transform = part switch { "mag" => mag, "magrelease" => release, "bolt" or "slide" or "pump" => bolt, _ => Matrix4x4.Identity };
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
        float tanHalfFov = MathF.Tan(_fov * MathF.PI / 360f);
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
        _hud.Text($"+{s.Score} CREDITOS PARA MELHORIAS", cx, y + 40, 2, accent, Hud.Align.Center);
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

    // Cartões de melhoria no canto superior esquerdo (aparecem com o jogo pausado).
    private const float CardX = 20, CardTop = 74, CardWidth = 300, CardHeight = 60, CardGap = 6;

    private static (float X, float Y, float W, float H) CardRect(int index) =>
        (CardX, CardTop + index * (CardHeight + CardGap), CardWidth, CardHeight);

    private static (float X, float Y, float W, float H) ResetRect() =>
        (CardX, CardTop + _upgrades.All.Count * (CardHeight + CardGap) + 4, CardWidth, 28);

    private static bool Inside((float X, float Y, float W, float H) r, Vector2 p) =>
        p.X >= r.X && p.X <= r.X + r.W && p.Y >= r.Y && p.Y <= r.Y + r.H;

    private static bool ClickUpgradePanel(Vector2 mouse)
    {
        for (int i = 0; i < _upgrades.All.Count; i++)
        {
            if (!Inside(CardRect(i), mouse)) continue;
            var upgrade = _upgrades.All[i];
            // A reserva extra já entra na compra; o pente maior enche na próxima recarga.
            if (_upgrades.Buy(upgrade) && upgrade.Id == "reserve")
                foreach (var slot in _slots) slot.Weapon.AddReserve(30);
            return true;
        }
        if (Inside(ResetRect(), mouse))
        {
            // Zerar pede um segundo clique em até 3 segundos.
            if (_window.Time < _resetArmedUntil)
            {
                _upgrades.Reset();
                foreach (var slot in _slots) slot.Weapon.Refill();
                _resetArmedUntil = 0;
            }
            else
            {
                _resetArmedUntil = _window.Time + 3;
            }
            return true;
        }
        return false;
    }

    private static void DrawUpgradePanel()
    {
        var white = new Vector4(1, 1, 1, 0.95f);
        var dim = new Vector4(1, 1, 1, 0.55f);
        var green = new Vector4(0.3f, 1f, 0.3f, 0.95f);
        var red = new Vector4(1f, 0.45f, 0.4f, 0.9f);
        var mouse = new Vector2(_mouse.Position.X, _mouse.Position.Y);

        _hud.Text("MELHORIAS", CardX, 20, 3, white);
        _hud.Text($"CREDITOS {_upgrades.Credits}", CardX, 46, 2, green);

        for (int i = 0; i < _upgrades.All.Count; i++)
        {
            var u = _upgrades.All[i];
            var r = CardRect(i);
            bool hover = Inside(r, mouse);
            int level = _upgrades.Level(u.Id);
            _hud.Rect(r.X, r.Y, r.W, r.H, new Vector4(0.08f, 0.085f, 0.09f, hover ? 0.98f : 0.88f));
            // Faixa à esquerda: verde se dá para comprar.
            _hud.Rect(r.X, r.Y, 3, r.H, _upgrades.IsMax(u) ? white : _upgrades.CanBuy(u) ? green : dim);

            _hud.Text(Upgrades.Plain(u.Name), r.X + 12, r.Y + 8, 2, white);
            for (int p = 0; p < u.Max; p++)
                _hud.Rect(r.X + r.W - 12 - (u.Max - p) * 12, r.Y + 9, 8, 8, p < level ? green : new Vector4(1, 1, 1, 0.18f));
            _hud.Text(_upgrades.EffectText(u), r.X + 12, r.Y + 26, 2, dim);
            _hud.Text($"NIVEL {level}/{u.Max}", r.X + 12, r.Y + 42, 2, dim);
            string price = _upgrades.IsMax(u) ? "MAXIMO" : $"{_upgrades.Cost(u)} CR";
            _hud.Text(price, r.X + r.W - 12, r.Y + 42, 2, _upgrades.IsMax(u) ? white : _upgrades.CanBuy(u) ? green : red, Hud.Align.Right);
        }

        var reset = ResetRect();
        bool armed = _window.Time < _resetArmedUntil;
        _hud.Rect(reset.X, reset.Y, reset.W, reset.H, new Vector4(0.08f, 0.085f, 0.09f, Inside(reset, mouse) ? 0.98f : 0.7f));
        _hud.Text(armed ? "CLIQUE DE NOVO PARA ZERAR" : "ZERAR PROGRESSO", reset.X + reset.W / 2, reset.Y + 8, 2,
            armed ? red : dim, Hud.Align.Center);
    }

    // Luneta PU (Mosin): campo circular com o resto escuro e a retícula russa de três postes
    // (poste central vindo de baixo, até o centro, e dois horizontais nas laterais).
    private static void DrawScope(int width, int height)
    {
        var black = new Vector4(0, 0, 0, 1);
        float cx = width / 2f, cy = height / 2f, r = height * 0.46f;
        const float band = 3;
        for (float y = 0; y < height; y += band)
        {
            float dy = MathF.Abs(y + band / 2 - cy);
            float half = dy < r ? MathF.Sqrt(r * r - dy * dy) : 0;
            _hud.Rect(0, y, cx - half, band, black);
            _hud.Rect(cx + half, y, width - cx - half, band, black);
        }
        // Poste central: grosso embaixo, afinando até a ponta no centro.
        _hud.Rect(cx - 4, cy + r * 0.25f, 8, r * 0.75f, black);
        _hud.Rect(cx - 2, cy + r * 0.08f, 4, r * 0.17f, black);
        _hud.Rect(cx - 1, cy, 2, r * 0.08f, black);
        // Postes laterais, com um vão no meio.
        _hud.Rect(cx - r, cy - 2, r * 0.82f, 4, black);
        _hud.Rect(cx + r * 0.18f, cy - 2, r * 0.82f, 4, black);
    }

    // Botão "automático" do menu (em pixels da janela).
    private static Rectangle<float> AutoButtonRect(int width, int height) =>
        new(width / 2f - 210, height / 2f + 110, 420, 46);

    private static void DrawHud(int width, int height)
    {
        var white = new Vector4(1, 1, 1, 0.95f);
        var dim = new Vector4(1, 1, 1, 0.6f);
        float margin = 28;

        if (MouseCaptured)
        {
            if (_weapon.Scoped) DrawScope(width, height);
            else DrawCrosshair(width, height);
            _hud.Text($"CREDITOS {_upgrades.Credits}   TAB MELHORIAS", margin, margin, 2, dim);
            // Olhando para uma arma da bancada: E troca pela da mão.
            if (_benchTarget != null)
            {
                string name = Upgrades.Plain(_slots[_benchTarget.Slot].Rig.Name);
                _hud.Text($"E  PEGAR {name}", width / 2f, height / 2f + 40, 3, white, Hud.Align.Center);
                _hud.Text($"DEIXA A {Upgrades.Plain(_weapon.Name)} NA BANCADA", width / 2f, height / 2f + 68, 2, dim, Hud.Align.Center);
            }
        }

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
        string mode = _weapon.Automatic && _weapon.CanBeAutomatic ? "AUTO" : "SEMI";
        _hud.Text($"{Upgrades.Plain(_weapon.Name)}  {mode}", width - margin, height - margin - 72, 3, dim, Hud.Align.Right);
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
                "ESPACO PULAR   CTRL AGACHAR   TAB OU ESC PAUSAR",
                "E TROCAR PELA ARMA DA BANCADA (FUNDO DO SAGUAO)",
            };
            for (int i = 0; i < help.Length; i++)
                _hud.Text(help[i], width / 2f, height / 2f + 10 + i * 24, 2, dim, Hud.Align.Center);
            DrawUpgradePanel();

            // Opção do menu: arma automática ativada ou desativada.
            var button = AutoButtonRect(width, height);
            var on = new Vector4(0.3f, 1f, 0.3f, 0.95f);
            _hud.Rect(button.Origin.X, button.Origin.Y, button.Size.X, button.Size.Y, new Vector4(0, 0, 0, 0.6f));
            _hud.Rect(button.Origin.X, button.Origin.Y + button.Size.Y - 3, button.Size.X, 3, _weapon.Automatic ? on : dim);
            _hud.Text(_weapon.Automatic ? "AUTOMATICO: ATIVADO" : "AUTOMATICO: DESATIVADO",
                width / 2f, button.Origin.Y + 13, 3, _weapon.Automatic ? on : white, Hud.Align.Center);
            _hud.Text(_weapon.CanBeAutomatic ? "CLIQUE NO BOTAO PARA MUDAR" : $"A {Upgrades.Plain(_weapon.Name)} SO ATIRA UM POR CLIQUE",
                width / 2f, button.Origin.Y + button.Size.Y + 10, 2, dim, Hud.Align.Center);
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
        _decor.Dispose();
        _arms.Dispose();
        foreach (var slot in _slots) slot.Model.Dispose();
        _hud.Dispose();
        _effects.Dispose();
        _gl.DeleteProgram(_program);
        _input.Dispose();
    }
}
