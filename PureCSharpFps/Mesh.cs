using OpenTK.Graphics.OpenGL4;
using OpenTK.Mathematics;

namespace PureCSharpFps;

/// <summary>
/// One reusable unit-cube mesh (VAO + VBO + EBO) drawn with hardware instancing.
/// Each instance describes a box: center, size, color and a grid flag (10 floats).
/// All boxes in the world are therefore rendered with a single draw call.
/// </summary>
public sealed class Mesh : IDisposable
{
    public const int FloatsPerInstance = 10;

    private readonly int _vao;
    private readonly int _vbo;
    private readonly int _ebo;
    private readonly int _instanceVbo;
    private readonly int _indexCount;
    private int _instanceCount;
    private bool _disposed;

    private Mesh(float[] vertices, uint[] indices)
    {
        _indexCount = indices.Length;

        _vao = GL.GenVertexArray();
        GL.BindVertexArray(_vao);

        _vbo = GL.GenBuffer();
        GL.BindBuffer(BufferTarget.ArrayBuffer, _vbo);
        GL.BufferData(BufferTarget.ArrayBuffer, vertices.Length * sizeof(float), vertices, BufferUsageHint.StaticDraw);

        _ebo = GL.GenBuffer();
        GL.BindBuffer(BufferTarget.ElementArrayBuffer, _ebo);
        GL.BufferData(BufferTarget.ElementArrayBuffer, indices.Length * sizeof(uint), indices, BufferUsageHint.StaticDraw);

        int vertexStride = 6 * sizeof(float);
        GL.EnableVertexAttribArray(0);
        GL.VertexAttribPointer(0, 3, VertexAttribPointerType.Float, false, vertexStride, 0);
        GL.EnableVertexAttribArray(1);
        GL.VertexAttribPointer(1, 3, VertexAttribPointerType.Float, false, vertexStride, 3 * sizeof(float));

        _instanceVbo = GL.GenBuffer();
        GL.BindBuffer(BufferTarget.ArrayBuffer, _instanceVbo);
        int instanceStride = FloatsPerInstance * sizeof(float);
        SetupInstanceAttrib(2, 3, instanceStride, 0);                  // center
        SetupInstanceAttrib(3, 3, instanceStride, 3 * sizeof(float));  // size
        SetupInstanceAttrib(4, 3, instanceStride, 6 * sizeof(float));  // color
        SetupInstanceAttrib(5, 1, instanceStride, 9 * sizeof(float));  // grid flag

        GL.BindVertexArray(0);
    }

    private static void SetupInstanceAttrib(int location, int size, int stride, int offset)
    {
        GL.EnableVertexAttribArray(location);
        GL.VertexAttribPointer(location, size, VertexAttribPointerType.Float, false, stride, offset);
        GL.VertexAttribDivisor(location, 1);
    }

    /// <summary>Cube spanning -0.5..0.5 on every axis; 24 vertices (position + normal), CCW winding.</summary>
    public static Mesh CreateUnitCube()
    {
        // (normal, u, v) with u x v == normal so that the winding is counter-clockwise from outside.
        Vector3[,] faces =
        {
            { new(1, 0, 0), new(0, 1, 0), new(0, 0, 1) },
            { new(-1, 0, 0), new(0, 0, 1), new(0, 1, 0) },
            { new(0, 1, 0), new(0, 0, 1), new(1, 0, 0) },
            { new(0, -1, 0), new(1, 0, 0), new(0, 0, 1) },
            { new(0, 0, 1), new(1, 0, 0), new(0, 1, 0) },
            { new(0, 0, -1), new(0, 1, 0), new(1, 0, 0) },
        };
        (float su, float sv)[] corners = { (-1, -1), (1, -1), (1, 1), (-1, 1) };

        var vertices = new float[24 * 6];
        var indices = new uint[36];
        int vi = 0, ii = 0;

        for (int f = 0; f < 6; f++)
        {
            Vector3 n = faces[f, 0], u = faces[f, 1], v = faces[f, 2];
            uint baseIndex = (uint)(vi / 6);
            foreach (var (su, sv) in corners)
            {
                Vector3 p = n * 0.5f + u * (su * 0.5f) + v * (sv * 0.5f);
                vertices[vi++] = p.X; vertices[vi++] = p.Y; vertices[vi++] = p.Z;
                vertices[vi++] = n.X; vertices[vi++] = n.Y; vertices[vi++] = n.Z;
            }
            indices[ii++] = baseIndex; indices[ii++] = baseIndex + 1; indices[ii++] = baseIndex + 2;
            indices[ii++] = baseIndex; indices[ii++] = baseIndex + 2; indices[ii++] = baseIndex + 3;
        }

        return new Mesh(vertices, indices);
    }

    /// <summary>Uploads the per-box data once (the world is static).</summary>
    public void SetInstances(float[] data, int instanceCount)
    {
        _instanceCount = instanceCount;
        GL.BindBuffer(BufferTarget.ArrayBuffer, _instanceVbo);
        GL.BufferData(BufferTarget.ArrayBuffer, instanceCount * FloatsPerInstance * sizeof(float), data, BufferUsageHint.StaticDraw);
        GL.BindBuffer(BufferTarget.ArrayBuffer, 0);
    }

    public void Draw()
    {
        GL.BindVertexArray(_vao);
        GL.DrawElementsInstanced(PrimitiveType.Triangles, _indexCount, DrawElementsType.UnsignedInt, IntPtr.Zero, _instanceCount);
    }

    public void Dispose()
    {
        if (_disposed) return;
        _disposed = true;
        GL.DeleteBuffer(_vbo);
        GL.DeleteBuffer(_ebo);
        GL.DeleteBuffer(_instanceVbo);
        GL.DeleteVertexArray(_vao);
    }
}
