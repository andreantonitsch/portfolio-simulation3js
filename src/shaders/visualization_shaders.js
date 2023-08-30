export const viz_common_replace = `#include <common>
#include "lygia/generative/curl.glsl"
#include "lygia/generative/random.glsl"
#include "lygia/generative/curl.glsl"

uniform float uTime;

attribute uint vertexID;

uniform vec2 uResolution;
uniform sampler2D positionMap;
uniform sampler2D speedMap;

uint vertexLabels[18] = uint[18](0u, 2u, 1u,  //tri 0  -
                                 0u, 3u, 2u,  //tri 1    > front pyramid 
                                 0u, 1u, 3u,  //tri 2  -

                                 4u, 1u, 2u,  //tri 3  -
                                 4u, 2u ,3u,  //tri 4    > back pyramid
                                 4u, 3u, 1u);  //tri 5 -  

const float l1 = 0.2;
const float l2 = 0.03;
const float l3 = 0.015; // l2 * sin 60

vec3 computeVertexOffset(uint vertexLabel, vec3 direction){
    vec3 offset = vec3(0.0, 0.0, 0.0);

    if(vertexLabel == 0u){
        offset += direction * l1;

    }else if( vertexLabel ==  4u){
        offset -= direction * l2;

    } else if (vertexLabel == 1u){
            vec3 right = normalize(cross(direction, vec3(0.0, 1.0, 0.0)));
            
            vec3 up = normalize(cross(direction, right));
            offset += right * l2;

    } else if (vertexLabel == 2u){                
        vec3 right = cross(direction, vec3(0.0, 1.0, 0.0));
        vec3 up = normalize(cross(direction, right));
        offset += up * l3;

    } else if (vertexLabel == 3u){
        vec3 right = normalize(cross(direction, vec3(0.0, 1.0, 0.0)));
        vec3 up = normalize(cross(direction, right));
        offset -= right * l2;
    }
    return offset;
}

uint umod(uint x, uint y){
    return x - y *(x/y);
}`


export const viz_vertex_replace = `

uint vInstanceID = umod(vertexID, 18u); //id of this vertex in this instance [0;17]
uint vertexLabel = vertexLabels[vInstanceID]; //type of vertex [0-4]

vec2 instance_uv = vec2(float(vInstanceID / uint(uResolution.y)), float(vInstanceID % uint(uResolution.y))) / uResolution;

vec4 pos = texture2D(positionMap, instance_uv) + vec4(position, 0.0);
vec3 direction = normalize(texture2D(speedMap, instance_uv).xyz);
vec3 transformed = pos.xyz;

//float r = random(position) * 10.0  * 6.1832;
//vec3 orbitedPosition = vec3(1.0, 0.0, 0.0) * sin(uTime + r ) + vec3(0.0, 0.0, 1.0) * cos(uTime  + r) +  position;
//transformed += vec3(orbitedPosition);
//vec3 direction = normalize(color);

transformed += computeVertexOffset(vertexLabel, direction);


`