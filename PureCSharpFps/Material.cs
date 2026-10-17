using OpenTK.Mathematics;

namespace PureCSharpFps;

/// <summary>
/// Lightweight material: a texture plus how it is mapped. Several textures supplied for this project are UV-atlas
/// pieces (only part of the image is real content, the rest is edge padding), so a material can select a
/// sub-rectangle ("region") of the image and tile only that part. Without a texture the material is a flat color.
/// </summary>
public sealed class Material
{
    public string Name { get; }
    public Texture2D? Texture { get; }

    /// <summary>World size in meters that one repetition of the region covers. (0,0) = stretch the whole face once.</summary>
    public Vector2 TileSize { get; }

    /// <summary>Texture sub-rectangle (u0, v0, u1, v1), bottom-left origin, in 0..1 of the image.</summary>
    public Vector4 Region { get; }

    /// <summary>Mirror the region on every repetition (hides seams of images that are not seamless).</summary>
    public bool Mirror { get; }

    /// <summary>Brightness/color multiplier applied to the texture (the image file itself is untouched).</summary>
    public Vector3 Tint { get; }

    private Material(string name, Texture2D? texture, Vector2 tileSize, Vector4 region, bool mirror, Vector3 tint)
    {
        Name = name;
        Texture = texture;
        TileSize = tileSize;
        Region = region;
        Mirror = mirror;
        Tint = tint;
    }

    /// <summary>
    /// Tiled material. <paramref name="regionTopLeft"/> is (x0, y0, x1, y1) in 0..1 with the origin at the top-left of
    /// the image (as seen in an image viewer). <paramref name="metersPerRegionWidth"/> sets the scale; the height
    /// follows from the region's pixel aspect so texels stay square.
    /// </summary>
    public static Material Tiled(string name, Texture2D texture, Vector4 regionTopLeft, float metersPerRegionWidth,
        Vector3? tint = null, bool mirror = true)
    {
        var region = new Vector4(regionTopLeft.X, 1f - regionTopLeft.W, regionTopLeft.Z, 1f - regionTopLeft.Y);
        float pxW = (region.Z - region.X) * texture.Width;
        float pxH = (region.W - region.Y) * texture.Height;
        var tile = new Vector2(metersPerRegionWidth, metersPerRegionWidth * pxH / pxW);
        return new Material(name, texture, tile, region, mirror, tint ?? Vector3.One);
    }

    /// <summary>Material showing the whole image once per face (signs, posters); not tiled, edges clamped.</summary>
    public static Material Poster(string name, Texture2D texture, Vector3? tint = null) =>
        new(name, texture, Vector2.Zero, new Vector4(0f, 0f, 1f, 1f), false, tint ?? Vector3.One);

    /// <summary>Untextured material; the per-box color is used as is.</summary>
    public static Material Flat(string name) =>
        new(name, null, Vector2.Zero, new Vector4(0f, 0f, 1f, 1f), false, Vector3.One);
}
