using OpenTK.Graphics.OpenGL4;
using OpenTK.Mathematics;

namespace PureCSharpFps;

/// <summary>Loads, compiles and links a GLSL program once; uniforms are looked up by cached location.</summary>
public sealed class Shader : IDisposable
{
    private readonly Dictionary<string, int> _uniforms = new();
    private bool _disposed;

    public int Handle { get; }

    public Shader(string vertexPath, string fragmentPath)
    {
        int vs = Compile(ShaderType.VertexShader, File.ReadAllText(vertexPath), vertexPath);
        int fs = Compile(ShaderType.FragmentShader, File.ReadAllText(fragmentPath), fragmentPath);

        Handle = GL.CreateProgram();
        GL.AttachShader(Handle, vs);
        GL.AttachShader(Handle, fs);
        GL.LinkProgram(Handle);
        GL.GetProgram(Handle, GetProgramParameterName.LinkStatus, out int ok);
        string log = GL.GetProgramInfoLog(Handle);

        GL.DetachShader(Handle, vs);
        GL.DetachShader(Handle, fs);
        GL.DeleteShader(vs);
        GL.DeleteShader(fs);

        if (ok == 0)
        {
            GL.DeleteProgram(Handle);
            throw new InvalidOperationException($"Shader link failed:\n{log}");
        }

        GL.GetProgram(Handle, GetProgramParameterName.ActiveUniforms, out int count);
        for (int i = 0; i < count; i++)
        {
            string name = GL.GetActiveUniform(Handle, i, out _, out _);
            _uniforms[name] = GL.GetUniformLocation(Handle, name);
        }
    }

    private static int Compile(ShaderType type, string source, string path)
    {
        int shader = GL.CreateShader(type);
        GL.ShaderSource(shader, source);
        GL.CompileShader(shader);
        GL.GetShader(shader, ShaderParameter.CompileStatus, out int ok);
        if (ok == 0)
        {
            string log = GL.GetShaderInfoLog(shader);
            GL.DeleteShader(shader);
            throw new InvalidOperationException($"Shader compile failed ({path}):\n{log}");
        }
        return shader;
    }

    public void Use() => GL.UseProgram(Handle);

    public int GetUniformLocation(string name) =>
        _uniforms.TryGetValue(name, out int loc) ? loc : throw new KeyNotFoundException($"Uniform '{name}' not found.");

    public void SetMatrix4(int location, ref Matrix4 value) => GL.UniformMatrix4(location, false, ref value);

    public void SetVector3(int location, Vector3 value) => GL.Uniform3(location, value.X, value.Y, value.Z);

    public void Dispose()
    {
        if (_disposed) return;
        _disposed = true;
        GL.DeleteProgram(Handle);
    }
}
