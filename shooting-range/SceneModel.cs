using System.Numerics;
using Silk.NET.Assimp;
using Silk.NET.OpenGL;
using StbImageSharp;
using AssimpMesh = Silk.NET.Assimp.Mesh;

namespace ShootingRange;

// Uma parte do cenário pronta para desenhar: um VAO com um material.
public sealed class DrawMesh
{
    public uint Vao;
    public uint IndexCount;
    public uint Texture;
    public Vector4 Color = Vector4.One;
    public bool Transparent => Color.W < 0.99f;
}

// Carrega o FBX com o Assimp, envia para a GPU e devolve os triângulos para a colisão.
public sealed unsafe class SceneModel : IDisposable
{
    private readonly GL _gl;
    private readonly List<uint> _buffers = new();
    private readonly Dictionary<string, uint> _textureCache = new();
    private uint _whiteTexture;

    public List<DrawMesh> Meshes { get; } = new();
    public List<Vector3> CollisionTriangles { get; } = new();
    public Vector3 BoundsMin { get; private set; } = new(float.MaxValue);
    public Vector3 BoundsMax { get; private set; } = new(float.MinValue);

    public SceneModel(GL gl, string path, string textureDir)
    {
        _gl = gl;
        _whiteTexture = CreateTexture(new byte[] { 255, 255, 255, 255 }, 1, 1);
        // O OpenGL espera a primeira linha da imagem embaixo.
        StbImage.stbi_set_flip_vertically_on_load(1);

        var assimp = Assimp.GetApi();
        // PreTransformVertices aplica as transformações dos nós, então tudo fica em coordenadas de mundo.
        var flags = PostProcessSteps.Triangulate
                    | PostProcessSteps.GenerateNormals
                    | PostProcessSteps.JoinIdenticalVertices
                    | PostProcessSteps.PreTransformVertices;
        Scene* scene = assimp.ImportFile(path, (uint)flags);
        if (scene == null || scene->MRootNode == null)
            throw new Exception("Erro ao carregar o modelo: " + assimp.GetErrorStringS());

        try
        {
            for (uint i = 0; i < scene->MNumMeshes; i++)
                LoadMesh(assimp, scene, scene->MMeshes[i], textureDir);
        }
        finally
        {
            assimp.ReleaseImport(scene);
        }

        // Transparentes por último para a mistura de cores funcionar.
        Meshes.Sort((a, b) => a.Transparent.CompareTo(b.Transparent));
    }

    private void LoadMesh(Assimp assimp, Scene* scene, AssimpMesh* mesh, string textureDir)
    {
        // Vértice: posição (3) + normal (3) + uv (2).
        var vertices = new float[mesh->MNumVertices * 8];
        for (uint v = 0; v < mesh->MNumVertices; v++)
        {
            Vector3 p = mesh->MVertices[v];
            Vector3 n = mesh->MNormals != null ? mesh->MNormals[v] : Vector3.UnitY;
            Vector3 uv = mesh->MTextureCoords[0] != null ? mesh->MTextureCoords[0][v] : Vector3.Zero;
            int o = (int)v * 8;
            vertices[o + 0] = p.X; vertices[o + 1] = p.Y; vertices[o + 2] = p.Z;
            vertices[o + 3] = n.X; vertices[o + 4] = n.Y; vertices[o + 5] = n.Z;
            vertices[o + 6] = uv.X; vertices[o + 7] = uv.Y;
            BoundsMin = Vector3.Min(BoundsMin, p);
            BoundsMax = Vector3.Max(BoundsMax, p);
        }

        var indices = new List<uint>((int)mesh->MNumFaces * 3);
        for (uint f = 0; f < mesh->MNumFaces; f++)
        {
            Face face = mesh->MFaces[f];
            if (face.MNumIndices != 3) continue;
            for (int k = 0; k < 3; k++)
            {
                uint idx = face.MIndices[k];
                indices.Add(idx);
                CollisionTriangles.Add(mesh->MVertices[idx]);
            }
        }

        var draw = new DrawMesh { IndexCount = (uint)indices.Count };
        Material* material = scene->MMaterials[mesh->MMaterialIndex];

        Vector4 color;
        if (assimp.GetMaterialColor(material, Assimp.MaterialColorDiffuseBase, 0, 0, &color) == Return.Success)
            draw.Color = new Vector4(color.X, color.Y, color.Z, 1f);
        float opacity = 1f;
        uint max = 1;
        if (assimp.GetMaterialFloatArray(material, Assimp.MaterialOpacityBase, 0, 0, &opacity, &max) == Return.Success)
            draw.Color.W = opacity;

        AssimpString name;
        assimp.GetMaterialString(material, Assimp.MaterialNameBase, 0, 0, &name);
        string materialName = name.AsString;
        if (materialName.Contains("Glass", StringComparison.OrdinalIgnoreCase))
            draw.Color.W = materialName.Contains("Frosted", StringComparison.OrdinalIgnoreCase) ? 0.6f : 0.25f;

        AssimpString texPath;
        draw.Texture = _whiteTexture;
        if (assimp.GetMaterialTexture(material, TextureType.Diffuse, 0, &texPath, null, null, null, null, null, null) == Return.Success)
        {
            // Com textura, a cor do material não deve escurecer a imagem.
            draw.Texture = LoadTexture(scene, texPath.AsString, textureDir);
            if (draw.Texture != _whiteTexture) draw.Color = new Vector4(1, 1, 1, draw.Color.W);
        }

        draw.Vao = _gl.GenVertexArray();
        _gl.BindVertexArray(draw.Vao);

        uint vbo = _gl.GenBuffer();
        _buffers.Add(vbo);
        _gl.BindBuffer(BufferTargetARB.ArrayBuffer, vbo);
        fixed (float* data = vertices)
            _gl.BufferData(BufferTargetARB.ArrayBuffer, (nuint)(vertices.Length * sizeof(float)), data, BufferUsageARB.StaticDraw);

        uint ebo = _gl.GenBuffer();
        _buffers.Add(ebo);
        _gl.BindBuffer(BufferTargetARB.ElementArrayBuffer, ebo);
        var indexArray = indices.ToArray();
        fixed (uint* data = indexArray)
            _gl.BufferData(BufferTargetARB.ElementArrayBuffer, (nuint)(indexArray.Length * sizeof(uint)), data, BufferUsageARB.StaticDraw);

        const uint stride = 8 * sizeof(float);
        _gl.EnableVertexAttribArray(0);
        _gl.VertexAttribPointer(0, 3, VertexAttribPointerType.Float, false, stride, (void*)0);
        _gl.EnableVertexAttribArray(1);
        _gl.VertexAttribPointer(1, 3, VertexAttribPointerType.Float, false, stride, (void*)(3 * sizeof(float)));
        _gl.EnableVertexAttribArray(2);
        _gl.VertexAttribPointer(2, 2, VertexAttribPointerType.Float, false, stride, (void*)(6 * sizeof(float)));
        _gl.BindVertexArray(0);

        Meshes.Add(draw);
    }

    private static readonly string[] TextureExtensions = { ".jpg", ".jpeg", ".png" };

    // Procura primeiro em models/tex/ pelo nome do arquivo (em qualquer extensão), para que
    // as texturas possam ser trocadas sem mexer no FBX; se não achar, usa a embutida no FBX.
    private uint LoadTexture(Scene* scene, string path, string textureDir)
    {
        if (_textureCache.TryGetValue(path, out uint cached)) return cached;

        string fileName = Path.GetFileName(path.Replace('\\', '/'));
        string baseName = Path.GetFileNameWithoutExtension(fileName);
        ImageResult? image = null;

        string? file = TextureExtensions
            .Select(ext => Path.Combine(textureDir, baseName + ext))
            .FirstOrDefault(System.IO.File.Exists);
        if (file != null)
        {
            using var stream = System.IO.File.OpenRead(file);
            image = ImageResult.FromStream(stream, ColorComponents.RedGreenBlueAlpha);
        }
        else
        {
            Silk.NET.Assimp.Texture* embedded = FindEmbeddedTexture(scene, path, fileName);
            // MHeight == 0 indica um arquivo comprimido (jpg/png) dentro do FBX; MWidth é o tamanho em bytes.
            if (embedded != null && embedded->MHeight == 0)
            {
                var bytes = new ReadOnlySpan<byte>(embedded->PcData, (int)embedded->MWidth).ToArray();
                image = ImageResult.FromMemory(bytes, ColorComponents.RedGreenBlueAlpha);
            }
            else
            {
                Console.WriteLine($"Textura não encontrada: {fileName}");
            }
        }

        uint id = image != null ? CreateTexture(image.Data, image.Width, image.Height) : _whiteTexture;
        _textureCache[path] = id;
        return id;
    }

    private static Silk.NET.Assimp.Texture* FindEmbeddedTexture(Scene* scene, string path, string fileName)
    {
        if (path.StartsWith('*') && int.TryParse(path.AsSpan(1), out int index) && index < scene->MNumTextures)
            return scene->MTextures[index];

        for (uint i = 0; i < scene->MNumTextures; i++)
        {
            string embeddedName = Path.GetFileName(scene->MTextures[i]->MFilename.AsString.Replace('\\', '/'));
            if (string.Equals(embeddedName, fileName, StringComparison.OrdinalIgnoreCase))
                return scene->MTextures[i];
        }
        return null;
    }

    private uint CreateTexture(byte[] rgba, int width, int height)
    {
        uint id = _gl.GenTexture();
        _gl.BindTexture(TextureTarget.Texture2D, id);
        fixed (byte* data = rgba)
            _gl.TexImage2D(TextureTarget.Texture2D, 0, InternalFormat.Srgb8Alpha8, (uint)width, (uint)height, 0,
                PixelFormat.Rgba, PixelType.UnsignedByte, data);
        _gl.TexParameter(TextureTarget.Texture2D, TextureParameterName.TextureWrapS, (int)GLEnum.Repeat);
        _gl.TexParameter(TextureTarget.Texture2D, TextureParameterName.TextureWrapT, (int)GLEnum.Repeat);
        _gl.TexParameter(TextureTarget.Texture2D, TextureParameterName.TextureMinFilter, (int)GLEnum.LinearMipmapLinear);
        _gl.TexParameter(TextureTarget.Texture2D, TextureParameterName.TextureMagFilter, (int)GLEnum.Linear);
        _gl.GenerateMipmap(TextureTarget.Texture2D);
        return id;
    }

    public void Dispose()
    {
        foreach (var mesh in Meshes) _gl.DeleteVertexArray(mesh.Vao);
        foreach (var buffer in _buffers) _gl.DeleteBuffer(buffer);
        foreach (var texture in _textureCache.Values.Distinct()) _gl.DeleteTexture(texture);
        _gl.DeleteTexture(_whiteTexture);
    }
}
