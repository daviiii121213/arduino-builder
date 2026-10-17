#version 330 core

// Per-vertex data of the shared unit cube.
layout(location = 0) in vec3 aPosition;
layout(location = 1) in vec3 aNormal;
layout(location = 2) in vec2 aUv;          // 0..1 over each face, U to the right, V up (seen from outside)

// Per-instance data (one instance = one box).
layout(location = 3) in vec3 aCenter;
layout(location = 4) in vec3 aSize;
layout(location = 5) in vec3 aColor;       // multiplier (texture) or flat color (untextured material)

uniform mat4 uViewProjection;

out vec3 vWorldPos;
out vec3 vNormal;
out vec3 vColor;
out vec2 vUv;
out vec2 vFaceSize;    // size of this face in meters (u, v), used to tile textures without stretching

void main()
{
    vec3 world = aCenter + aPosition * aSize;
    vWorldPos = world;
    vNormal = aNormal;       // boxes are axis-aligned, so no normal matrix is needed
    vColor = aColor;
    vUv = aUv;

    vec3 a = abs(aNormal);
    if (a.x > 0.5)      vFaceSize = vec2(aSize.z, aSize.y);
    else if (a.y > 0.5) vFaceSize = vec2(aSize.x, aSize.z);
    else                vFaceSize = vec2(aSize.x, aSize.y);

    // OpenTK matrices use the row-vector convention and are uploaded untransposed; GLSL reads
    // that memory as the transpose, which makes matrix * vector the correct product here.
    gl_Position = uViewProjection * vec4(world, 1.0);
}
