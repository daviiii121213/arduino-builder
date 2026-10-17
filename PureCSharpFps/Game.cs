using OpenTK.Graphics.OpenGL4;
using OpenTK.Mathematics;
using OpenTK.Windowing.Common;
using OpenTK.Windowing.Desktop;
using OpenTK.Windowing.GraphicsLibraryFramework;

namespace PureCSharpFps;

/// <summary>Owns the window, the update/render loop and the lifetime of all GPU resources.</summary>
public sealed class Game : GameWindow
{
    private static readonly Vector3 SkyColor = new(0.55f, 0.70f, 0.88f);
    private static readonly Vector3 SunDirection = Vector3.Normalize(new Vector3(-0.45f, -0.80f, -0.35f));

    private readonly Camera _camera = new();
    private CollisionWorld _collision = null!;
    private PlayerController _player = null!;
    private Shader _shader = null!;
    private Mesh _cube = null!;

    private int _locViewProjection, _locCameraPos, _locSunDirection, _locSkyColor;

    private bool _mouseCaptured;
    private bool _skipNextMouseDelta;
    private Vector2 _pendingMouseDelta;

    private double _fpsTimer;
    private int _fpsFrames;

    public Game(GameWindowSettings gameSettings, NativeWindowSettings nativeSettings)
        : base(gameSettings, nativeSettings)
    {
        VSync = VSyncMode.On;
    }

    protected override void OnLoad()
    {
        base.OnLoad();

        GL.ClearColor(SkyColor.X, SkyColor.Y, SkyColor.Z, 1f);
        GL.Enable(EnableCap.DepthTest);
        GL.Enable(EnableCap.CullFace);
        GL.CullFace(CullFaceMode.Back);
        GL.FrontFace(FrontFaceDirection.Ccw);

        string shaderDir = Path.Combine(AppContext.BaseDirectory, "shaders");
        _shader = new Shader(Path.Combine(shaderDir, "basic.vert"), Path.Combine(shaderDir, "basic.frag"));
        _locViewProjection = _shader.GetUniformLocation("uViewProjection");
        _locCameraPos = _shader.GetUniformLocation("uCameraPos");
        _locSunDirection = _shader.GetUniformLocation("uSunDirection");
        _locSkyColor = _shader.GetUniformLocation("uSkyColor");

        var environment = new EnvironmentBuilder();
        environment.Build();
        _collision = environment.Collision;

        _cube = Mesh.CreateUnitCube();
        _cube.SetInstances(environment.InstanceData, environment.InstanceCount);

        _player = new PlayerController(environment.SpawnPoint);
        _camera.Position = _player.EyePosition;
        UpdateProjection();

        SetMouseCapture(true);
    }

    private void SetMouseCapture(bool captured)
    {
        _mouseCaptured = captured;
        CursorState = captured ? CursorState.Grabbed : CursorState.Normal;
        _skipNextMouseDelta = true;
        _pendingMouseDelta = Vector2.Zero;
    }

    private void UpdateProjection()
    {
        Vector2i size = ClientSize;
        if (size.X > 0 && size.Y > 0) _camera.AspectRatio = size.X / (float)size.Y;
    }

    protected override void OnResize(ResizeEventArgs e)
    {
        base.OnResize(e);
        GL.Viewport(0, 0, Math.Max(e.Width, 1), Math.Max(e.Height, 1));
        UpdateProjection();
    }

    protected override void OnFocusedChanged(FocusedChangedEventArgs e)
    {
        base.OnFocusedChanged(e);
        _skipNextMouseDelta = true;
        _pendingMouseDelta = Vector2.Zero;
    }

    protected override void OnMouseMove(MouseMoveEventArgs e)
    {
        base.OnMouseMove(e);
        if (!_mouseCaptured || !IsFocused) return;

        // The first delta after (re)capture can be a large jump, so it is discarded.
        if (_skipNextMouseDelta)
        {
            _skipNextMouseDelta = false;
            return;
        }
        _pendingMouseDelta += e.Delta;
    }

    protected override void OnMouseDown(MouseButtonEventArgs e)
    {
        base.OnMouseDown(e);
        if (!_mouseCaptured && e.Button == MouseButton.Left) SetMouseCapture(true);
    }

    protected override void OnMouseWheel(MouseWheelEventArgs e)
    {
        base.OnMouseWheel(e);
        _camera.FovDegrees -= e.OffsetY * 2f;   // wheel adjusts the field of view
    }

    protected override void OnUpdateFrame(FrameEventArgs args)
    {
        base.OnUpdateFrame(args);
        if (!IsFocused) return;

        KeyboardState keys = KeyboardState;

        // Escape: first press releases the mouse, second press (mouse already free) closes the app.
        if (keys.IsKeyPressed(Keys.Escape))
        {
            if (_mouseCaptured) SetMouseCapture(false);
            else Close();
            return;
        }

        if (_mouseCaptured)
        {
            _camera.Rotate(_pendingMouseDelta.X, _pendingMouseDelta.Y, _player.MouseSensitivity);
        }
        _pendingMouseDelta = Vector2.Zero;

        var input = new MoveInput();
        if (_mouseCaptured)
        {
            if (keys.IsKeyDown(Keys.W)) input.Forward += 1f;
            if (keys.IsKeyDown(Keys.S)) input.Forward -= 1f;
            if (keys.IsKeyDown(Keys.D)) input.Strafe += 1f;
            if (keys.IsKeyDown(Keys.A)) input.Strafe -= 1f;
            input.Jump = keys.IsKeyDown(Keys.Space);
            input.Sprint = keys.IsKeyDown(Keys.LeftShift);
        }

        _player.Update((float)args.Time, input, _camera.Yaw, _collision);
        _camera.Position = _player.EyePosition;
    }

    protected override void OnRenderFrame(FrameEventArgs args)
    {
        base.OnRenderFrame(args);

        GL.Clear(ClearBufferMask.ColorBufferBit | ClearBufferMask.DepthBufferBit);

        Matrix4 viewProjection = _camera.GetViewMatrix() * _camera.GetProjectionMatrix();

        _shader.Use();
        _shader.SetMatrix4(_locViewProjection, ref viewProjection);
        _shader.SetVector3(_locCameraPos, _camera.Position);
        _shader.SetVector3(_locSunDirection, SunDirection);
        _shader.SetVector3(_locSkyColor, SkyColor);
        _cube.Draw();

        SwapBuffers();

        _fpsFrames++;
        _fpsTimer += args.Time;
        if (_fpsTimer >= 0.5)
        {
            Title = $"Pure C# FPS Movement - {_fpsFrames / _fpsTimer:0} FPS" +
                    (_mouseCaptured ? "" : " - click to capture mouse, Esc to quit");
            _fpsTimer = 0;
            _fpsFrames = 0;
        }
    }

    protected override void OnUnload()
    {
        _cube?.Dispose();
        _shader?.Dispose();
        base.OnUnload();
    }
}
