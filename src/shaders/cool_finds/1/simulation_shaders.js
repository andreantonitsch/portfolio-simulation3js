export const position_vertex = resolveLygia(`
precision highp float;
//attribute vec2 uv;
varying vec2 coord;

void main() {
    gl_Position = vec4(position, 1.0); //screen quad
    coord = position.xy * 0.5 + 0.5;;
}
`)


export const position_frag = resolveLygia(`
precision highp float;
#define RANDOM_HIGHER_RANGE
#include "lygia/generative/random.glsl"


uniform sampler2D positionMap;
uniform sampler2D speedMap;
uniform float uDeltaTime;
uniform float uTime;
uniform vec2 uResolution;
uniform float maxLifetime;

uniform vec3 mousePosition;


varying vec2 coord;


void main() {

    vec4 pos = texture2D(positionMap, coord);
    
    float lifetime = pos.a;
    if(lifetime < 0.0){
        // gl_FragColor =  vec4(normalize(random3(coord * uTime)) - vec3(0.5, 0.5, 0.5), maxLifetime * 0.75 * random(coord * uTime) + maxLifetime * 0.25);
        vec3 new_position = (normalize(random3(coord * uTime)) - vec3(0.5, 0.5, 0.5)) * 0.2;
        // gl_FragColor =  vec4( new_position + mousePosition, maxLifetime * 0.75 * random(coord * uTime) + maxLifetime * 0.25);
        gl_FragColor =  vec4( new_position + mousePosition, maxLifetime - (random(coord) * 0.3 * maxLifetime));
    } else {
        vec3 speed = texture2D(speedMap, coord).xyz / 50.0;

        lifetime -= uDeltaTime;
        pos.xyz += speed.xyz;
        gl_FragColor = vec4(pos.xyz, lifetime);
    }

}
`)

export const speed_vertex = resolveLygia(`
varying vec2 coord;
void main() {
    gl_Position = vec4(position, 1.0); //screen quad
    coord = position.xy * 0.5 + 0.5;;
}
`)
export const speed_frag = resolveLygia(`
#include "lygia/generative/curl.glsl"

    uniform sampler2D positionMap;
    uniform vec2 uResolution;
    uniform float speed;
    uniform float uTime;
    
    varying vec2 coord;

    void main() {

        
        vec2 uv = coord;
        vec4 pos = texture2D(positionMap, uv);
        
        gl_FragColor = vec4(curl(pos.xyz), 1.0);
        

    }
`)