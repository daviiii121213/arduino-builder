using OpenTK.Graphics.OpenGL4;
using OpenTK.Mathematics;

namespace PureCSharpFps;

/// <summary>
/// One reusable unit-cube mesh (VBO + EBO with position, normal and UV) drawn with hardware instancing.
/// Each instance describes a box: center, size, color (9 floats). Boxes are grouped into one
/// <see cref="InstanceBatch"/> per material, so the whole world costs one draw call per material.
/// </summary>
public sealed class Mesh : IDisposable
{
    public const int FloatsPerInstance = 9;

    private readonly int _vbo;
    private readonly int _ebo;
    private readonly int _indexCount;
    private readonly List<InstanceBatch> _batches = new();
    private bool _disposed;

    private Mesh(float[] vertices, uint[] indices)
    {
        _indexCount = indices.Length;

        _vbo = GL.GenBuffer();
        GL.BindBuffer(BufferTarget.ArrayBuffer, _vbo);
        GL.BufferData(BufferTarget.ArrayBuffer, vertices.Length * sizeof(float), vertices, BufferUsageHint.StaticDraw);

        _ebo = GL.GenBuffer();
        GL.BindBuffer(BufferTarget.ElementArrayBuffer, _ebo);
        GL.BufferData(BufferTarget.ElementArrayBuffer, indices.Length * sizeof(uint), indices, BufferUsageHint.StaticDraw);
        GL.BindBuffer(BufferTarget.ElementArrayBuffer, 0);
        GL.BindBuffer(BufferTarget.ArrayBuffer, 0);
    }

    /// <summary>
    /// Cube spanning -0.5..0.5 on every axis; 24 vertices (position, normal, uv), CCW winding. UVs run 0..1 on
    /// every face with U to the right and V up as seen from outside (V is vertical on the four side faces).
    /// </summary>
    public static Mesh CreateUnitCube()
    {
        // (normal, uDir, vDir) with uDir x vDir == normal so that the winding is counter-clockwise from outside.
        Vector3[,] faces =
        {
            { new(1, 0, 0), new(0, 0, -1), new(0, 1, 0) },
            { new(-1, 0, 0), new(0, 0, 1), new(0, 1, 0) },
            { new(0, 1, 0), new(1, 0, 0), new(0, 0, -1) },
            { new(0, -1, 0), new(1, 0, 0), new(0, 0, 1) },
            { new(0, 0, 1), new(1, 0, 0), new(0, 1, 0) },
            { new(0, 0, -1), new(-1, 0, 0), new(0, 1, 0) },
        };
        (float su, float sv)[] corners = { (-1, -1), (1, -1), (1, 1), (-1, 1) };

        var vertices = new float[24 * 8];
        var indices = new uint[36];
        int vi = 0, ii = 0;

        for (int f = 0; f < 6; f++)
        {
            Vector3 n = faces[f, 0], u = faces[f, 1], v = faces[f, 2];
            uint baseIndex = (uint)(vi / 8);
            foreach (var (su, sv) in corners)
            {
                Vector3 p = n * 0.5f + u * (su * 0.5f) + v * (sv * 0.5f);
                vertices[vi++] = p.X; vertices[vi++] = p.Y; vertices[vi++] = p.Z;
                vertices[vi++] = n.X; vertices[vi++] = n.Y; vertices[vi++] = n.Z;
                vertices[vi++] = (su + 1f) * 0.5f; vertices[vi++] = (sv + 1f) * 0.5f;
            }
            indices[ii++] = baseIndex; indices[ii++] = baseIndex + 1; indices[ii++] = baseIndex + 2;
            indices[ii++] = baseIndex; indices[ii++] = baseIndex + 2; indices[ii++] = baseIndex + 3;
        }

        return new Mesh(vertices, indices);
    }

    /// <summary>Uploads the per-box data of one material once (the world is static).</summary>
    public InstanceBatch CreateBatch(float[] data, int instanceCount)
    {
        var batch = new InstanceBatch(_vbo, _ebo, _indexCount, data, instanceCount);
        _batches.Add(batch);
        return batch;
    }

    public void Dispose()
    {
        if (_disposed) return;
        _disposed = true;
        foreach (InstanceBatch b in _batches) b.Dispose();
        _batches.Clear();
        GL.DeleteBuffer(_vbo);
        GL.DeleteBuffer(_ebo);
    }
}

/// <summary>A VAO sharing the cube geometry plus its own per-instance buffer.</summary>
public sealed class InstanceBatch : IDisposable
{
    private readonly int _vao;
    private readonly int _instanceVbo;
    private readonly int _indexCount;
    private readonly int _instanceCount;
    private bool _disposed;

    internal InstanceBatch(int vbo, int ebo, int indexCount, float[] data, int instanceCount)
    {
        _indexCount = indexCount;
        _instanceCount = instanceCount;

        _vao = GL.GenVertexArray();
        GL.BindVertexArray(_vao);

        GL.BindBuffer(BufferTarget.ArrayBuffer, vbo);
        GL.BindBuffer(BufferTarget.ElementArrayBuffer, ebo);
        int vertexStride = 8 * sizeof(float);
        GL.EnableVertexAttribArray(0);
        GL.VertexAttribPointer(0, 3, VertexAttribPointerType.Float, false, vertexStride, 0);
        GL.EnableVertexAttribArray(1);
        GL.VertexAttribPointer(1, 3, VertexAttribPointerType.Float, false, vertexStride, 3 * sizeof(float));
        GL.EnableVertexAttribArray(2);
        GL.VertexAttribPointer(2, 2, VertexAttribPointerType.Float, false, vertexStride, 6 * sizeof(float));

        _instanceVbo = GL.GenBuffer();
        GL.BindBuffer(BufferTarget.ArrayBuffer, _instanceVbo);
        GL.BufferData(BufferTarget.ArrayBuffer, instanceCount * Mesh.FloatsPerInstance * sizeof(float), data, BufferUsageHint.StaticDraw);
        int stride = Mesh.FloatsPerInstance * sizeof(float);
        SetupInstanceAttrib(3, stride, 0);                 // center
        SetupInstanceAttrib(4, stride, 3 * sizeof(float)); // size
        SetupInstanceAttrib(5, stride, 6 * sizeof(float)); // color

        GL.BindVertexArray(0);
        GL.BindBuffer(BufferTarget.ArrayBuffer, 0);
    }

    private static void SetupInstanceAttrib(int location, int stride, int offset)
    {
        GL.EnableVertexAttribArray(location);
        GL.VertexAttribPointer(location, 3, VertexAttribPointerType.Float, false, stride, offset);
        GL.VertexAttribDivisor(location, 1);
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
        GL.DeleteBuffer(_instanceVbo);
        GL.DeleteVertexArray(_vao);
    }
}
