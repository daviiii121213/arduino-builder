#version 330 core

in vec3 vWorldPos;
in vec3 vNormal;
in vec3 vColor;
in vec2 vUv;
in vec2 vFaceSize;

uniform vec3 uCameraPos;
uniform vec3 uSunDirection;   // direction the light travels (normalized)
uniform vec3 uSkyColor;       // sRGB

// Material
uniform sampler2D uTexture;
uniform bool uHasTexture;
uniform vec2 uTileSize;       // meters per repetition; (0,0) = whole face shows the region once
uniform vec4 uRegion;         // u0, v0, u1, v1 sub-rectangle of the image
uniform bool uMirror;
uniform vec3 uTint;

out vec4 oColor;

const float GAMMA = 2.2;

vec2 mirrorRepeat(vec2 x)
{
    return 1.0 - abs(1.0 - mod(x, 2.0));
}

void main()
{
    vec3 n = normalize(vNormal);
    vec3 albedo;   // linear

    if (uHasTexture)
    {
        bool tiled = uTileSize.x > 0.0;
        vec2 raw = tiled ? vUv * vFaceSize / uTileSize : vUv;
        vec2 local = tiled ? (uMirror ? mirrorRepeat(raw) : fract(raw)) : clamp(raw, 0.0, 1.0);

        vec2 regionSize = uRegion.zw - uRegion.xy;
        vec2 uv = uRegion.xy + local * regionSize;

        // Explicit gradients from the unwrapped coordinate avoid mip artifacts at repeat/mirror seams.
        vec2 dx = dFdx(raw) * regionSize;
        vec2 dy = dFdy(raw) * regionSize;
        vec3 texel = textureGrad(uTexture, uv, dx, dy).rgb;   // already linear (sRGB texture)
        albedo = texel * pow(uTint * vColor, vec3(GAMMA));
    }
    else
    {
        albedo = pow(vColor, vec3(GAMMA));
    }

    // Ambient (hemisphere) + one directional light, no shadows (linear space).
    float hemi = n.y * 0.5 + 0.5;
    vec3 ambient = mix(vec3(0.16, 0.15, 0.15), vec3(0.34, 0.38, 0.46), hemi);
    float diffuse = max(dot(n, -uSunDirection), 0.0);
    vec3 lit = albedo * (ambient + vec3(1.0, 0.94, 0.82) * diffuse * 1.25);

    // Light distance fog towards the sky color for depth cue.
    float dist = length(vWorldPos - uCameraPos);
    float fog = clamp((dist - 60.0) / 90.0, 0.0, 1.0);
    vec3 sky = pow(uSkyColor, vec3(GAMMA));
    vec3 color = mix(lit, sky, fog);

    oColor = vec4(pow(color, vec3(1.0 / GAMMA)), 1.0);
}
