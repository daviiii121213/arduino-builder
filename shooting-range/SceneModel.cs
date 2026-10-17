using System.Numerics;
using Silk.NET.Assimp;
using Silk.NET.OpenGL;
using StbImageSharp;
using AssimpMesh = Silk.NET.Assimp.Mesh;

namespace ShootingRange;

// Uma parte do cenário pronta para desenhar: um VAO com um material.
// Os vértices também ficam guardados na CPU (em coordenadas de mundo) para colisão e tiros.
public sealed class DrawMesh
{
    public string Name = "";
    public string MaterialName = "";
    public uint Vao;
    public uint IndexCount;
    public uint Texture;
    public Vector4 Color = Vector4.One;
    public bool Unlit;
    public Matrix4x4 Transform = Matrix4x4.Identity;
    public Vector3[] Positions = Array.Empty<Vector3>();
    public Vector2[] Uvs = Array.Empty<Vector2>();
    public uint[] Indices = Array.Empty<uint>();
    public bool Transparent => Color.W < 0.99f;
    public bool IsGlass => MaterialName.Contains("Glass", StringComparison.OrdinalIgnoreCase);
}

// Carrega um modelo (FBX, GLB...) com o Assimp e envia para a GPU. Cada malha mantém o nome do seu nó,
// para que partes como os alvos possam ser tratadas separadamente.
// Malhas com ossos podem ser deformadas de novo a qualquer momento com SetPose (pele calculada na CPU).
public sealed unsafe class SceneModel : IDisposable
{
    private sealed class SkinData
    {
        public Vector3[] BindPositions = Array.Empty<Vector3>();
        public Vector3[] BindNormals = Array.Empty<Vector3>();
        public List<(string Bone, Matrix4x4 Offset, uint[] Ids, float[] Weights)> Bones = new();
        public float[] Vertices = Array.Empty<float>();
        public uint Vbo;
    }

    private static readonly IReadOnlyDictionary<string, Quaternion> NoPose = new Dictionary<string, Quaternion>();

    private readonly GL _gl;
    private readonly List<uint> _buffers = new();
    private readonly Dictionary<string, uint> _textureCache = new();
    // Nós em ordem de profundidade (pai antes dos filhos), para recalcular as matrizes globais com outra pose.
    private readonly List<(string Name, Matrix4x4 Local, int Parent)> _nodes = new();
    private readonly Dictionary<string, Matrix4x4> _nodeGlobals = new();
    private readonly List<(DrawMesh Mesh, SkinData Skin)> _skinned = new();
    private uint _whiteTexture;

    public List<DrawMesh> Meshes { get; } = new();
    public Vector3 BoundsMin { get; private set; } = new(float.MaxValue);
    public Vector3 BoundsMax { get; private set; } = new(float.MinValue);

    public SceneModel(GL gl, string path, string textureDir)
    {
        _gl = gl;
        _whiteTexture = CreateTexture(new byte[] { 255, 255, 255, 255 }, 1, 1);
        // O OpenGL espera a primeira linha da imagem embaixo.
        StbImage.stbi_set_flip_vertically_on_load(1);

        var assimp = Assimp.GetApi();
        var flags = PostProcessSteps.Triangulate
                    | PostProcessSteps.GenerateNormals
                    | PostProcessSteps.JoinIdenticalVertices
                    | PostProcessSteps.LimitBoneWeights;
        Scene* scene = assimp.ImportFile(path, (uint)flags);
        if (scene == null || scene->MRootNode == null)
            throw new Exception("Erro ao carregar o modelo: " + assimp.GetErrorStringS());

        try
        {
            CollectNodes(scene->MRootNode, -1);
            ComputeGlobals(NoPose);
            LoadNode(assimp, scene, scene->MRootNode, textureDir);
        }
        finally
        {
            assimp.ReleaseImport(scene);
        }

        // Transparentes por último para a mistura de cores funcionar.
        Meshes.Sort((a, b) => a.Transparent.CompareTo(b.Transparent));
    }

    // O Assimp guarda as matrizes com a translação na última coluna; o System.Numerics, na última linha.
    private static Matrix4x4 ToNumerics(Matrix4x4 m) => Matrix4x4.Transpose(m);

    private void CollectNodes(Node* node, int parent)
    {
        int index = _nodes.Count;
        _nodes.Add((node->MName.AsString, ToNumerics(node->MTransformation), parent));
        for (uint i = 0; i < node->MNumChildren; i++)
            CollectNodes(node->MChildren[i], index);
    }

    // pose: rotação extra no espaço local de cada osso. Usa os nomes sem ponto ("arm.R" vira "armR"), como o three.js.
    private void ComputeGlobals(IReadOnlyDictionary<string, Quaternion> pose)
    {
        var globals = new Matrix4x4[_nodes.Count];
        for (int i = 0; i < _nodes.Count; i++)
        {
            var (name, local, parent) = _nodes[i];
            if (pose.TryGetValue(name.Replace(".", ""), out var extra))
                local = Matrix4x4.CreateFromQuaternion(extra) * local;
            globals[i] = parent >= 0 ? local * globals[parent] : local;
            _nodeGlobals[name] = globals[i];
        }
    }

    // Deforma de novo as malhas com ossos e atualiza os vértices na GPU.
    public void SetPose(IReadOnlyDictionary<string, Quaternion> pose)
    {
        if (_skinned.Count == 0) return;
        ComputeGlobals(pose);
        foreach (var (mesh, skin) in _skinned)
        {
            var normals = new Vector3[skin.BindPositions.Length];
            Skin(skin, mesh.Positions, normals);
            for (int v = 0; v < mesh.Positions.Length; v++)
            {
                Vector3 p = mesh.Positions[v];
                Vector3 n = normals[v].LengthSquared() > 0 ? Vector3.Normalize(normals[v]) : Vector3.UnitY;
                int o = v * 8;
                skin.Vertices[o + 0] = p.X; skin.Vertices[o + 1] = p.Y; skin.Vertices[o + 2] = p.Z;
                skin.Vertices[o + 3] = n.X; skin.Vertices[o + 4] = n.Y; skin.Vertices[o + 5] = n.Z;
            }
            _gl.BindBuffer(BufferTargetARB.ArrayBuffer, skin.Vbo);
            fixed (float* data = skin.Vertices)
                _gl.BufferSubData(BufferTargetARB.ArrayBuffer, 0, (nuint)(skin.Vertices.Length * sizeof(float)), data);
        }
    }

    // Pele: cada vértice é a média ponderada da posição que cada osso lhe daria.
    private void Skin(SkinData skin, Vector3[] positions, Vector3[] normals)
    {
        Array.Clear(positions);
        foreach (var (bone, offset, ids, weights) in skin.Bones)
        {
            var matrix = offset * _nodeGlobals[bone];
            for (int w = 0; w < ids.Length; w++)
            {
                uint id = ids[w];
                positions[id] += Vector3.Transform(skin.BindPositions[id], matrix) * weights[w];
                normals[id] += Vector3.TransformNormal(skin.BindNormals[id], matrix) * weights[w];
            }
        }
    }

    private void LoadNode(Assimp assimp, Scene* scene, Node* node, string textureDir)
    {
        string name = node->MName.AsString;
        var global = _nodeGlobals[name];
        for (uint i = 0; i < node->MNumMeshes; i++)
            LoadMesh(assimp, scene, scene->MMeshes[node->MMeshes[i]], name, global, textureDir);
        for (uint i = 0; i < node->MNumChildren; i++)
            LoadNode(assimp, scene, node->MChildren[i], textureDir);
    }

    private void LoadMesh(Assimp assimp, Scene* scene, AssimpMesh* mesh, string nodeName, Matrix4x4 global, string textureDir)
    {
        int count = (int)mesh->MNumVertices;
        var positions = new Vector3[count];
        var normals = new Vector3[count];
        var uvs = new Vector2[count];

        SkinData? skin = null;
        if (mesh->MNumBones > 0)
        {
            skin = new SkinData { BindPositions = new Vector3[count], BindNormals = new Vector3[count] };
            for (int v = 0; v < count; v++)
            {
                skin.BindPositions[v] = mesh->MVertices[v];
                if (mesh->MNormals != null) skin.BindNormals[v] = mesh->MNormals[v];
            }
            for (uint b = 0; b < mesh->MNumBones; b++)
            {
                Bone* bone = mesh->MBones[b];
                var ids = new uint[bone->MNumWeights];
                var weights = new float[bone->MNumWeights];
                for (uint w = 0; w < bone->MNumWeights; w++)
                {
                    ids[w] = bone->MWeights[w].MVertexId;
                    weights[w] = bone->MWeights[w].MWeight;
                }
                skin.Bones.Add((bone->MName.AsString, ToNumerics(bone->MOffsetMatrix), ids, weights));
            }
            Skin(skin, positions, normals);
        }
        else
        {
            for (int v = 0; v < count; v++)
            {
                positions[v] = Vector3.Transform(mesh->MVertices[v], global);
                if (mesh->MNormals != null) normals[v] = Vector3.TransformNormal(mesh->MNormals[v], global);
            }
        }

        // Vértice na GPU: posição (3) + normal (3) + uv (2).
        var vertices = new float[count * 8];
        for (int v = 0; v < count; v++)
        {
            Vector3 p = positions[v];
            Vector3 n = normals[v].LengthSquared() > 0 ? Vector3.Normalize(normals[v]) : Vector3.UnitY;
            Vector3 uv = mesh->MTextureCoords[0] != null ? mesh->MTextureCoords[0][v] : Vector3.Zero;
            uvs[v] = new Vector2(uv.X, uv.Y);
            int o = v * 8;
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
            for (int k = 0; k < 3; k++) indices.Add(face.MIndices[k]);
        }

        var draw = new DrawMesh
        {
            Name = nodeName,
            IndexCount = (uint)indices.Count,
            Positions = positions,
            Uvs = uvs,
            Indices = indices.ToArray(),
        };
        Material* material = scene->MMaterials[mesh->MMaterialIndex];

        Vector4 color;
        if (assimp.GetMaterialColor(material, Assimp.MaterialColorDiffuseBase, 0, 0, &color) == Return.Success)
            draw.Color = new Vector4(color.X, color.Y, color.Z, 1f);
        float opacity = 1f;
        uint max = 1;
        if (assimp.GetMaterialFloatArray(material, Assimp.MaterialOpacityBase, 0, 0, &opacity, &max) == Return.Success)
            draw.Color.W = opacity;

        AssimpString materialName;
        assimp.GetMaterialString(material, Assimp.MaterialNameBase, 0, 0, &materialName);
        draw.MaterialName = materialName.AsString;
        if (draw.IsGlass)
            draw.Color.W = draw.MaterialName.Contains("Frosted", StringComparison.OrdinalIgnoreCase) ? 0.6f : 0.25f;

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
        var usage = skin != null ? BufferUsageARB.DynamicDraw : BufferUsageARB.StaticDraw;
        fixed (float* data = vertices)
            _gl.BufferData(BufferTargetARB.ArrayBuffer, (nuint)(vertices.Length * sizeof(float)), data, usage);
        if (skin != null)
        {
            skin.Vertices = vertices;
            skin.Vbo = vbo;
            _skinned.Add((draw, skin));
        }

        uint ebo = _gl.GenBuffer();
        _buffers.Add(ebo);
        _gl.BindBuffer(BufferTargetARB.ElementArrayBuffer, ebo);
        fixed (uint* data = draw.Indices)
            _gl.BufferData(BufferTargetARB.ElementArrayBuffer, (nuint)(draw.Indices.Length * sizeof(uint)), data, BufferUsageARB.StaticDraw);

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
