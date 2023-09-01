export const viz_common_replace = `
precision highp float;
#include <common>
#include "lygia/generative/curl.glsl"
#include "lygia/generative/random.glsl"
#include "lygia/generative/curl.glsl"
#include "lygia/animation/easing.glsl"

uniform float uTime;

attribute uint vertexID;
attribute uint instanceID;
attribute uvec2 neighbours;

uniform vec2 uResolution;
uniform sampler2D positionMap;
uniform sampler2D speedMap;

uniform float maxLifetime; 

uint vertexLabels[18] = uint[18](0u, 2u, 1u,  //tri 0  -
                                 0u, 3u, 2u,  //tri 1    > front pyramid 
                                 0u, 1u, 3u,  //tri 2  -

                                 4u, 1u, 2u,  //tri 3  -
                                 4u, 2u ,3u,  //tri 4    > back pyramid
                                 4u, 3u, 1u);  //tri 5 -  

const float l1 = 0.15;
const float l2 = 0.08;
const float l3 = 0.08; // l2 * sin 60

vec3 computeVertexOffset(uint vertexLabel, vec3 direction, float scale){
    vec3 offset = vec3(0.0, 0.0, 0.0);

    if(vertexLabel == 0u){
        offset += direction * l1 * scale;

    }else if( vertexLabel ==  4u){
        offset -= direction * l2 * scale;

    } else if (vertexLabel == 1u){
            vec3 right = normalize(cross(direction, vec3(0.0, 1.0, 0.0)));
            
            vec3 up = normalize(cross(direction, right));
            offset += right * l2 * scale;

    } else if (vertexLabel == 2u){                
        vec3 right = cross(direction, vec3(0.0, 1.0, 0.0));
        vec3 up = normalize(cross(direction, right));
        offset += up * l3 * scale;

    } else if (vertexLabel == 3u){
        vec3 right = normalize(cross(direction, vec3(0.0, 1.0, 0.0)));
        vec3 up = normalize(cross(direction, right));
        offset -= right * l2 * scale;
    }
    return offset;
}

uint umod(uint x, uint y){
    return x - y *(x/y);
}`


export const viz_vertex_replace = `

transformed += v0;

`


export const viz_normal_replace = `

vec2 instance_uv = vec2(float(instanceID / uint(uResolution.y)), float(umod(instanceID, uint(uResolution.y))) ) / uResolution;
vec4 pos = texture2D(positionMap, instance_uv);
vec3 direction =  normalize(texture2D(speedMap, instance_uv).xyz);
vec3 transformed = pos.xyz;

uint vLocalID = umod(vertexID, 18u); //id of this vertex in this instance [0;17]
uint vertexLabel = vertexLabels[vLocalID]; //type of vertex [0-4]
uint triIndex = vLocalID / 3u; // triangleIndex

uint triStartIndex = (triIndex * 3u);
uint v1LocalID = triStartIndex + umod(vLocalID + 1u, 3u);
uint v2LocalID = triStartIndex + umod(vLocalID + 2u, 3u);

uint v1Label = vertexLabels[v1LocalID];
uint v2Label = vertexLabels[v2LocalID];

float scale = (pos.a / maxLifetime ); //[0;1)
scale = 1.0 -  (abs(scale - 0.5) * 2.0);
//scale = smoothstep(0.0, 1.0, scale);
scale = exponentialIn(scale);

vec3 v0 = computeVertexOffset(vertexLabel, direction, scale);
vec3 v1 = computeVertexOffset(v1Label, direction, scale);
vec3 v2 = computeVertexOffset(v2Label, direction, scale);

objectNormal = cross(v1-v0, v2-v0);

#include <defaultnormal_vertex>
`

export const viz_depth_replace = `

vec2 instance_uv = vec2(float(instanceID / uint(uResolution.y)), float(umod(instanceID, uint(uResolution.y))) ) / uResolution;
vec4 pos = texture2D(positionMap, instance_uv);
vec3 direction =  normalize(texture2D(speedMap, instance_uv).xyz);
vec3 transformed = pos.xyz;

uint vLocalID = umod(vertexID, 18u); //id of this vertex in this instance [0;17]
uint vertexLabel = vertexLabels[vLocalID]; //type of vertex [0-4]

float scale = pos.a / 4.0;

vec3 v0 = computeVertexOffset(vertexLabel, direction, scale);


transformed += v0;


`