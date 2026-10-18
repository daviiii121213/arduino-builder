using System.Numerics;
using Silk.NET.OpenGL;

namespace ShootingRange;

// Texto e retângulos 2D por cima do jogo. A fonte é um bitmap 5x7 embutido no código;
// cada "pixel" da letra vira um quadradinho.
public sealed unsafe class Hud : IDisposable
{
    public enum Align { Left, Right, Center }

    private const string VertexShader = """
        #version 330 core
        layout (location = 0) in vec2 aPosition;
        layout (location = 1) in vec4 aColor;
        uniform vec2 uScreen;
        out vec4 vColor;
        void main()
        {
            vColor = aColor;
            vec2 ndc = aPosition / uScreen * 2.0 - 1.0;
            gl_Position = vec4(ndc.x, -ndc.y, 0.0, 1.0);
        }
        """;

    private const string FragmentShader = """
        #version 330 core
        in vec4 vColor;
        out vec4 FragColor;
        void main() { FragColor = vColor; }
        """;

    // Cada letra: 7 linhas de 5 colunas ('#' aceso).
    private static readonly Dictionary<char, string[]> Glyphs = new()
    {
        ['0'] = new[] { " ### ", "#   #", "#  ##", "# # #", "##  #", "#   #", " ### " },
        ['1'] = new[] { "  #  ", " ##  ", "  #  ", "  #  ", "  #  ", "  #  ", " ### " },
        ['2'] = new[] { " ### ", "#   #", "    #", "   # ", "  #  ", " #   ", "#####" },
        ['3'] = new[] { "#####", "   # ", "  #  ", "   # ", "    #", "#   #", " ### " },
        ['4'] = new[] { "   # ", "  ## ", " # # ", "#  # ", "#####", "   # ", "   # " },
        ['5'] = new[] { "#####", "#    ", "#### ", "    #", "    #", "#   #", " ### " },
        ['6'] = new[] { "  ## ", " #   ", "#    ", "#### ", "#   #", "#   #", " ### " },
        ['7'] = new[] { "#####", "    #", "   # ", "  #  ", " #   ", " #   ", " #   " },
        ['8'] = new[] { " ### ", "#   #", "#   #", " ### ", "#   #", "#   #", " ### " },
        ['9'] = new[] { " ### ", "#   #", "#   #", " ####", "    #", "   # ", " ##  " },
        ['A'] = new[] { " ### ", "#   #", "#   #", "#####", "#   #", "#   #", "#   #" },
        ['C'] = new[] { " ### ", "#   #", "#    ", "#    ", "#    ", "#   #", " ### " },
        ['D'] = new[] { "#### ", "#   #", "#   #", "#   #", "#   #", "#   #", "#### " },
        ['E'] = new[] { "#####", "#    ", "#    ", "#### ", "#    ", "#    ", "#####" },
        ['G'] = new[] { " ### ", "#   #", "#    ", "# ###", "#   #", "#   #", " ####" },
        ['I'] = new[] { " ### ", "  #  ", "  #  ", "  #  ", "  #  ", "  #  ", " ### " },
        ['J'] = new[] { "  ###", "   # ", "   # ", "   # ", "   # ", "#  # ", " ##  " },
        ['L'] = new[] { "#    ", "#    ", "#    ", "#    ", "#    ", "#    ", "#####" },
        ['M'] = new[] { "#   #", "## ##", "# # #", "# # #", "#   #", "#   #", "#   #" },
        ['N'] = new[] { "#   #", "#   #", "##  #", "# # #", "#  ##", "#   #", "#   #" },
        ['O'] = new[] { " ### ", "#   #", "#   #", "#   #", "#   #", "#   #", " ### " },
        ['P'] = new[] { "#### ", "#   #", "#   #", "#### ", "#    ", "#    ", "#    " },
        ['R'] = new[] { "#### ", "#   #", "#   #", "#### ", "# #  ", "#  # ", "#   #" },
        ['S'] = new[] { " ####", "#    ", "#    ", " ### ", "    #", "    #", "#### " },
        ['T'] = new[] { "#####", "  #  ", "  #  ", "  #  ", "  #  ", "  #  ", "  #  " },
        ['U'] = new[] { "#   #", "#   #", "#   #", "#   #", "#   #", "#   #", " ### " },
        ['X'] = new[] { "#   #", "#   #", " # # ", "  #  ", " # # ", "#   #", "#   #" },
        ['B'] = new[] { "#### ", "#   #", "#   #", "#### ", "#   #", "#   #", "#### " },
        ['F'] = new[] { "#####", "#    ", "#    ", "#### ", "#    ", "#    ", "#    " },
        ['H'] = new[] { "#   #", "#   #", "#   #", "#####", "#   #", "#   #", "#   #" },
        ['K'] = new[] { "#   #", "#  # ", "# #  ", "##   ", "# #  ", "#  # ", "#   #" },
        ['Q'] = new[] { " ### ", "#   #", "#   #", "#   #", "# # #", "#  # ", " ## #" },
        ['V'] = new[] { "#   #", "#   #", "#   #", "#   #", "#   #", " # # ", "  #  " },
        ['W'] = new[] { "#   #", "#   #", "#   #", "# # #", "# # #", "## ##", "#   #" },
        ['Y'] = new[] { "#   #", "#   #", " # # ", "  #  ", "  #  ", "  #  ", "  #  " },
        ['Z'] = new[] { "#####", "    #", "   # ", "  #  ", " #   ", "#    ", "#####" },
        ['>'] = new[] { "#    ", " #   ", "  #  ", "   # ", "  #  ", " #   ", "#    " },
        ['+'] = new[] { "     ", "  #  ", "  #  ", "#####", "  #  ", "  #  ", "     " },
        ['-'] = new[] { "     ", "     ", "     ", "#####", "     ", "     ", "     " },
        ['/'] = new[] { "    #", "    #", "   # ", "  #  ", " #   ", "#    ", "#    " },
        [':'] = new[] { "     ", "  #  ", "  #  ", "     ", "  #  ", "  #  ", "     " },
        ['%'] = new[] { "##  #", "##  #", "   # ", "  #  ", " #   ", "#  ##", "#  ##" },
        ['.'] = new[] { "     ", "     ", "     ", "     ", "     ", " ##  ", " ##  " },
        [' '] = new[] { "     ", "     ", "     ", "     ", "     ", "     ", "     " },
    };

    private readonly GL _gl;
    private readonly uint _program, _vao, _vbo;
    private readonly int _screenLocation;
    private readonly List<float> _vertices = new();

    public Hud(GL gl, Func<ShaderType, string, uint> compile)
    {
        _gl = gl;
        _program = _gl.CreateProgram();
        uint vs = compile(ShaderType.VertexShader, VertexShader);
        uint fs = compile(ShaderType.FragmentShader, FragmentShader);
        _gl.AttachShader(_program, vs);
        _gl.AttachShader(_program, fs);
        _gl.LinkProgram(_program);
        _gl.DeleteShader(vs);
        _gl.DeleteShader(fs);
        _screenLocation = _gl.GetUniformLocation(_program, "uScreen");

        _vao = _gl.GenVertexArray();
        _vbo = _gl.GenBuffer();
        _gl.BindVertexArray(_vao);
        _gl.BindBuffer(BufferTargetARB.ArrayBuffer, _vbo);
        const uint stride = 6 * sizeof(float);
        _gl.EnableVertexAttribArray(0);
        _gl.VertexAttribPointer(0, 2, VertexAttribPointerType.Float, false, stride, (void*)0);
        _gl.EnableVertexAttribArray(1);
        _gl.VertexAttribPointer(1, 4, VertexAttribPointerType.Float, false, stride, (void*)(2 * sizeof(float)));
        _gl.BindVertexArray(0);
    }

    public static float TextWidth(string text, float scale) => text.Length * 6 * scale - scale;

    public void Rect(float x, float y, float w, float h, Vector4 color)
    {
        void V(float px, float py)
        {
            _vertices.Add(px); _vertices.Add(py);
            _vertices.Add(color.X); _vertices.Add(color.Y); _vertices.Add(color.Z); _vertices.Add(color.W);
        }
        V(x, y); V(x + w, y); V(x + w, y + h);
        V(x, y); V(x + w, y + h); V(x, y + h);
    }

    // scale = tamanho de cada pixel da letra. Desenha uma sombra para ler sobre qualquer fundo.
    public void Text(string text, float x, float y, float scale, Vector4 color, Align align = Align.Left)
    {
        text = text.ToUpperInvariant();
        float width = TextWidth(text, scale);
        if (align == Align.Right) x -= width;
        else if (align == Align.Center) x -= width / 2;

        var shadow = new Vector4(0, 0, 0, color.W * 0.6f);
        foreach (var (c, offset) in new[] { (shadow, MathF.Max(1, scale * 0.4f)), (color, 0f) })
        {
            float cx = x + offset;
            foreach (char ch in text)
            {
                if (Glyphs.TryGetValue(ch, out var rows))
                    for (int r = 0; r < 7; r++)
                    for (int col = 0; col < 5; col++)
                        if (rows[r][col] == '#')
                            Rect(cx + col * scale, y + offset + r * scale, scale, scale, c);
                cx += 6 * scale;
            }
        }
    }

    public void Flush(int screenWidth, int screenHeight)
    {
        if (_vertices.Count == 0) return;
        _gl.Disable(EnableCap.DepthTest);
        _gl.Enable(EnableCap.Blend);
        _gl.UseProgram(_program);
        _gl.Uniform2(_screenLocation, (float)screenWidth, (float)screenHeight);
        _gl.BindVertexArray(_vao);
        _gl.BindBuffer(BufferTargetARB.ArrayBuffer, _vbo);
        var data = _vertices.ToArray();
        fixed (float* p = data)
            _gl.BufferData(BufferTargetARB.ArrayBuffer, (nuint)(data.Length * sizeof(float)), p, BufferUsageARB.StreamDraw);
        _gl.DrawArrays(PrimitiveType.Triangles, 0, (uint)(data.Length / 6));
        _gl.Disable(EnableCap.Blend);
        _gl.Enable(EnableCap.DepthTest);
        _vertices.Clear();
    }

    public void Dispose()
    {
        _gl.DeleteBuffer(_vbo);
        _gl.DeleteVertexArray(_vao);
        _gl.DeleteProgram(_program);
    }
}
