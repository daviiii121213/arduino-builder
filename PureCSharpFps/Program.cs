using OpenTK.Mathematics;
using OpenTK.Windowing.Desktop;

namespace PureCSharpFps;

internal static class Program
{
    private static void Main()
    {
        var gameSettings = new GameWindowSettings();

        var nativeSettings = new NativeWindowSettings
        {
            ClientSize = new Vector2i(1280, 720),
            Title = "Pure C# FPS Movement",
            APIVersion = new Version(3, 3),
            Profile = OpenTK.Windowing.Common.ContextProfile.Core,
            Flags = OpenTK.Windowing.Common.ContextFlags.ForwardCompatible,
        };

        using var game = new Game(gameSettings, nativeSettings);
        game.Run();
    }
}
