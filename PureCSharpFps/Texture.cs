using OpenTK.Graphics.OpenGL4;
using StbImageSharp;

namespace PureCSharpFps;

/// <summary>Raised with an exact description when a texture file is missing, unreadable or unusable.</summary>
public sealed class TextureLoadException : Exception
{
    public TextureLoadException(string message, Exception? inner = null) : base(message, inner) { }
}

/// <summary>A GPU texture (sRGB color data, mipmapped). Created through <see cref="TextureLoader"/>.</summary>
public sealed class Texture2D : IDisposable
{
    private bool _disposed;

    public int Handle { get; }
    public string Path { get; }
    /// <summary>Size of the image file on disk (the GPU copy may be smaller, see TextureLoader.MaxTextureSize).</summary>
    public int Width { get; }
    public int Height { get; }
    public int GpuWidth { get; }
    public int GpuHeight { get; }

    internal Texture2D(int handle, string path, int width, int height, int gpuWidth, int gpuHeight)
    {
        Handle = handle;
        Path = path;
        Width = width;
        Height = height;
        GpuWidth = gpuWidth;
        GpuHeight = gpuHeight;
    }

    public void Bind(TextureUnit unit = TextureUnit.Texture0)
    {
        GL.ActiveTexture(unit);
        GL.BindTexture(TextureTarget.Texture2D, Handle);
    }

    public void Dispose()
    {
        if (_disposed) return;
        _disposed = true;
        GL.DeleteTexture(Handle);
    }
}

/// <summary>
/// Loads image files (JPEG, PNG, BMP, ... via StbImageSharp) into OpenGL textures. Each file is loaded only
/// once; later requests for the same path return the cached GPU texture. The loader owns the textures.
/// Source images are only read, never modified.
/// </summary>
public sealed class TextureLoader : IDisposable
{
    private readonly Dictionary<string, Texture2D> _cache = new(StringComparer.OrdinalIgnoreCase);
    private readonly float _maxAnisotropy;
    private readonly int _maxGlSize;

    /// <summary>
    /// Images larger than this (in either direction) are box-filtered down by a power of two when uploaded to the
    /// GPU, to keep memory and load time reasonable on integrated graphics. 0 disables it (full resolution).
    /// The file on disk is never changed.
    /// </summary>
    public int MaxTextureSize { get; set; } = 2048;

    public string RootDirectory { get; }

    public TextureLoader(string rootDirectory)
    {
        RootDirectory = rootDirectory;
        GL.GetInteger(GetPName.MaxTextureSize, out _maxGlSize);

        // Anisotropic filtering is an extension (0x84FE / 0x84FF) supported by practically every driver.
        _maxAnisotropy = 0f;
        GL.GetInteger(GetPName.NumExtensions, out int count);
        for (int i = 0; i < count; i++)
        {
            if (GL.GetString(StringNameIndexed.Extensions, i) == "GL_EXT_texture_filter_anisotropic")
            {
                GL.GetFloat((GetPName)0x84FF, out _maxAnisotropy);
                break;
            }
        }
    }

    /// <summary>Loads <paramref name="fileName"/> (relative to the root directory), or returns the cached texture.</summary>
    public Texture2D Load(string fileName)
    {
        string path = System.IO.Path.Combine(RootDirectory, fileName);
        if (_cache.TryGetValue(path, out Texture2D? cached)) return cached;

        if (!File.Exists(path))
            throw new TextureLoadException($"Texture file not found: '{path}'.");

        ImageResult image;
        try
        {
            StbImage.stbi_set_flip_vertically_on_load(1);   // OpenGL's first row is the bottom row
            using var stream = File.OpenRead(path);
            image = ImageResult.FromStream(stream, ColorComponents.RedGreenBlueAlpha);
        }
        catch (Exception ex)
        {
            throw new TextureLoadException($"Texture file could not be decoded (corrupted or unsupported format): '{path}'. {ex.Message}", ex);
        }

        if (image.Width <= 0 || image.Height <= 0 || image.Data == null || image.Data.Length < image.Width * image.Height * 4)
            throw new TextureLoadException($"Texture file decoded to an invalid image: '{path}'.");

        byte[] data = image.Data;
        int w = image.Width, h = image.Height;

        int limit = MaxTextureSize > 0 ? Math.Min(MaxTextureSize, _maxGlSize) : _maxGlSize;
        while (w > limit || h > limit)
        {
            if (w < 2 || h < 2)
                throw new TextureLoadException($"Texture '{path}' ({image.Width}x{image.Height}) exceeds the GPU limit of {_maxGlSize} and cannot be reduced.");
            data = Downscale2x(data, w, h);
            w /= 2;
            h /= 2;
        }

        int handle = GL.GenTexture();
        GL.BindTexture(TextureTarget.Texture2D, handle);
        GL.PixelStore(PixelStoreParameter.UnpackAlignment, 1);
        // sRGB internal format: the GPU converts to linear on sampling, so lighting is done in linear space.
        GL.TexImage2D(TextureTarget.Texture2D, 0, PixelInternalFormat.Srgb8Alpha8, w, h, 0,
            PixelFormat.Rgba, PixelType.UnsignedByte, data);
        GL.GenerateMipmap(GenerateMipmapTarget.Texture2D);

        GL.TexParameter(TextureTarget.Texture2D, TextureParameterName.TextureMinFilter, (int)TextureMinFilter.LinearMipmapLinear);
        GL.TexParameter(TextureTarget.Texture2D, TextureParameterName.TextureMagFilter, (int)TextureMagFilter.Linear);
        GL.TexParameter(TextureTarget.Texture2D, TextureParameterName.TextureWrapS, (int)TextureWrapMode.ClampToEdge);
        GL.TexParameter(TextureTarget.Texture2D, TextureParameterName.TextureWrapT, (int)TextureWrapMode.ClampToEdge);
        if (_maxAnisotropy > 0f)
            GL.TexParameter(TextureTarget.Texture2D, (TextureParameterName)0x84FE, Math.Min(8f, _maxAnisotropy));

        GL.BindTexture(TextureTarget.Texture2D, 0);

        var texture = new Texture2D(handle, path, image.Width, image.Height, w, h);
        _cache[path] = texture;
        return texture;
    }

    private static byte[] Downscale2x(byte[] src, int w, int h)
    {
        int nw = w / 2, nh = h / 2;
        var dst = new byte[nw * nh * 4];
        for (int y = 0; y < nh; y++)
        {
            int r0 = (y * 2) * w * 4, r1 = (y * 2 + 1) * w * 4, d = y * nw * 4;
            for (int x = 0; x < nw; x++)
            {
                int a = r0 + x * 8, b = r1 + x * 8;
                for (int c = 0; c < 4; c++)
                    dst[d + x * 4 + c] = (byte)((src[a + c] + src[a + 4 + c] + src[b + c] + src[b + 4 + c] + 2) >> 2);
            }
        }
        return dst;
    }

    public void Dispose()
    {
        foreach (Texture2D t in _cache.Values) t.Dispose();
        _cache.Clear();
    }
}
