#version 330 core

in vec3 vWorldPos;
in vec3 vNormal;
in vec3 vColor;
in float vGrid;

uniform vec3 uCameraPos;
uniform vec3 uSunDirection;   // direction the light travels (normalized)
uniform vec3 uSkyColor;

out vec4 oColor;

float gridLine(float coord, float spacing, float width)
{
    float c = coord / spacing;
    float d = abs(fract(c - 0.5) - 0.5) / fwidth(c);
    return 1.0 - clamp(d / width, 0.0, 1.0);
}

void main()
{
    vec3 n = normalize(vNormal);
    vec3 base = vColor;

    // Procedural tile lines on the two axes that lie in the face plane.
    if (vGrid > 0.5)
    {
        vec3 m = 1.0 - abs(n);
        float g = 0.0;
        if (m.x > 0.5) g = max(g, gridLine(vWorldPos.x, 2.0, 1.0));
        if (m.y > 0.5) g = max(g, gridLine(vWorldPos.y, 2.0, 1.0));
        if (m.z > 0.5) g = max(g, gridLine(vWorldPos.z, 2.0, 1.0));
        base *= 1.0 - 0.28 * g;
    }

    // Ambient (hemisphere) + one directional light, no shadows.
    float hemi = n.y * 0.5 + 0.5;
    vec3 ambient = mix(vec3(0.30, 0.28, 0.27), vec3(0.50, 0.55, 0.62), hemi);
    float diffuse = max(dot(n, -uSunDirection), 0.0);
    vec3 lit = base * (ambient + vec3(1.0, 0.96, 0.88) * diffuse * 0.75);

    // Light distance fog towards the sky color for depth cue.
    float dist = length(vWorldPos - uCameraPos);
    float fog = clamp((dist - 60.0) / 90.0, 0.0, 1.0);
    oColor = vec4(mix(lit, uSkyColor, fog), 1.0);
}
