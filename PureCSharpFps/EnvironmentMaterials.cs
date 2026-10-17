using OpenTK.Mathematics;

namespace PureCSharpFps;

/// <summary>
/// Maps the user-supplied texture files (Assets/Textures) to environment surfaces.
/// Several images are UV-atlas pieces of the original shooting-range model: only a part of the image is real
/// surface content, the rest is edge-stretched padding. Those materials tile only the content region
/// (rectangles measured on the 4096 px images, given as fractions with the origin at the top-left) with mirrored
/// repetition to hide the non-seamless edges. Posters use the whole image.
/// Images that are flat colors or atlas pieces of small props (Counter, Rail, Controller, Door, Target Holder,
/// Inner Wall 01, Ceiling Accent, Ceiling Tile, Wall Counter) are not used by this map.
/// </summary>
public sealed class EnvironmentMaterials
{
    public Material Floor { get; }
    public Material PerimeterWall { get; }
    public Material CorridorWall { get; }
    public Material Platform { get; }
    public Material Crate { get; }
    public Material Signage { get; }
    public Material WarningSign { get; }
    public Material TargetPaper { get; }
    public Material RedPanel { get; }
    public Material Flat { get; } = Material.Flat("Flat accent color");

    public EnvironmentMaterials(TextureLoader loader)
    {
        // Floor 02: dark grey floor tiles occupy the lower ~72 % of the image.
        Floor = Material.Tiled("Floor",
            loader.Load("Floor 02_C.jpeg"), new Vector4(0.03f, 0.28f, 0.97f, 0.98f), 5.5f, tint: new Vector3(1.35f));

        // Inner Wall 02: dark concrete band at the bottom of the image.
        PerimeterWall = Material.Tiled("Perimeter wall",
            loader.Load("Inner Wall 02_C.jpeg"), new Vector4(0.02f, 0.77f, 0.98f, 0.985f), 4.0f, tint: new Vector3(2.0f));

        // Wall Accent: rough dark brick/concrete surface (very dark in the source, so it is brightened).
        CorridorWall = Material.Tiled("Corridor wall",
            loader.Load("Wall Accent_C.jpeg"), new Vector4(0.01f, 0.03f, 0.92f, 0.93f), 3.0f, tint: new Vector3(3.2f));

        // Floor 01: light parquet-like tiles in the lower third of the image.
        Platform = Material.Tiled("Platform",
            loader.Load("Floor 01_C.jpeg"), new Vector4(0.02f, 0.66f, 0.98f, 0.99f), 4.0f, tint: new Vector3(0.9f));

        // Ceiling: light mottled concrete, used for the training boxes.
        Crate = Material.Tiled("Training box",
            loader.Load("Ceiling_C.jpeg"), new Vector4(0.02f, 0.05f, 0.24f, 0.24f), 1.6f, tint: new Vector3(0.85f));

        Signage = Material.Poster("Signage", loader.Load("Signage_C.jpeg"));
        WarningSign = Material.Poster("Warning sign", loader.Load("Warning Sign_C.jpeg"));
        TargetPaper = Material.Poster("Target paper", loader.Load("Target Paper_C.jpeg"));
        RedPanel = Material.Poster("Red panel", loader.Load("Button_C.jpeg"));
    }
}
