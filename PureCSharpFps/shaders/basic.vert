#version 330 core

// Per-vertex data of the shared unit cube.
layout(location = 0) in vec3 aPosition;
layout(location = 1) in vec3 aNormal;

// Per-instance data (one instance = one box).
layout(location = 2) in vec3 aCenter;
layout(location = 3) in vec3 aSize;
layout(location = 4) in vec3 aColor;
layout(location = 5) in float aGrid;

uniform mat4 uViewProjection;

out vec3 vWorldPos;
out vec3 vNormal;
out vec3 vColor;
out float vGrid;

void main()
{
    vec3 world = aCenter + aPosition * aSize;
    vWorldPos = world;
    vNormal = aNormal;       // boxes are axis-aligned, so no normal matrix is needed
    vColor = aColor;
    vGrid = aGrid;

    // OpenTK matrices use the row-vector convention and are uploaded untransposed; GLSL reads
    // that memory as the transpose, which makes matrix * vector the correct product here.
    gl_Position = uViewProjection * vec4(world, 1.0);
}
