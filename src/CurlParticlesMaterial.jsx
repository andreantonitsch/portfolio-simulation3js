import { useEffect, useRef, useCallback, useMemo, useState } from 'react'
import { ScreenQuad, shaderMaterial } from "@react-three/drei"
import * as THREE from "three"

import { useFrame, extend, createPortal } from "@react-three/fiber"

const SIMULATION_RESOLUTION = [64, 64]

// Jank
let _vizShaderU = null

const PositionSimulationMaterial = shaderMaterial(
    { //uniforms
        uResolution: SIMULATION_RESOLUTION,
        uDeltaTime: 0.0,
        uTime : 0,
        positionMap: null,
        speedMap: null
    },
    //vertex shader
    resolveLygia(`
        void main() {
            gl_Position = vec4(position, 1.0); //screen quad
        }
    `),
    //frag shader
    resolveLygia(`
        #include "lygia/generative/random.glsl"

        uniform sampler2D positionMap;
        uniform sampler2D speedMap;
        uniform float uDeltaTime;
        uniform float uTime;
        uniform vec2 uResolution;

        void main() {

            vec2 uv = gl_FragCoord.xy / uResolution.xy;

            vec4 pos = texture2D(positionMap, uv);
            
            float lifetime = pos.a;
            if(lifetime < 0.0){
                gl_FragColor =  vec4(random3(vec2(uTime, uTime) + uv ), 10.0);
            } else {
                vec4 speed = texture2D(positionMap, uv);

                lifetime -= uDeltaTime;
                pos.xyz += speed.xyz;
                gl_FragColor = vec4(pos.xyz, lifetime);
            }

        }
    `)
)

const SpeedSimulationMaterial = shaderMaterial(
    { //uniforms
        uResolution: SIMULATION_RESOLUTION,
        speed: 1.0,
        positionMap: null
    },
    //vertex shader
    resolveLygia(`
    
        void main() {
            gl_Position = vec4(position, 1.0); //screen quad
        }
    `),
    //frag shader
    resolveLygia(`
    #include "lygia/generative/curl.glsl"

        uniform sampler2D positionMap;
        uniform vec2 uResolution;
        uniform float speed;

        void main() {

            vec2 uv = gl_FragCoord.xy / uResolution.xy;
            vec4 pos = texture2D(positionMap, uv);
            gl_FragColor = vec4(curl(vec4(pos.xyz, gl_FragCoord.x * uResolution.y + uResolution.y)), 0.0);
            gl_FragColor *= (mix(0.0, speed * 0.9, pos.a) + 0.1);

        }
    `)
)

extend({ PositionSimulationMaterial })
extend({ SpeedSimulationMaterial })

function injectVizShader(shader, renderer) {

    shader.vertexShader = shader.vertexShader.replace('#include <common>', `#include <common>
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
    const float l2 = 0.1;
    const float l3 = 0.08; // l2 * sin 60

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
    }
    
    `)
    shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        `
        uint vInstanceID = umod(vertexID, 18u); //id of this vertex in this instance [0;17]
        uint vertexLabel = vertexLabels[vInstanceID]; //type of vertex [0-4]

        vec2 instance_uv = vec2(float(vInstanceID / uint(uResolution.y)), float(vInstanceID % uint(uResolution.y))) / uResolution;

        vec4 pos = texture2D(positionMap, instance_uv);
        vec3 direction = texture2D(speedMap, instance_uv).xyz + vec3(1.0, 0.0, 0.0);
        vec3 transformed = pos.xyw;

        //direction = normalize(direction)  * pos.a / 10.0;

        float r = random(position) * 10.0  * 6.1832;
        //vec3 orbitedPosition = vec3(1.0, 0.0, 0.0) * sin(uTime + r ) + vec3(0.0, 0.0, 1.0) * cos(uTime  + r) +  position;
        //transformed += vec3(orbitedPosition);
        //vec3 direction = normalize(color);
        
        transformed += computeVertexOffset(vertexLabel, direction);
        
        ` )
    shader.vertexShader = resolveLygia(shader.vertexShader)
    
    shader.uniforms.positionMap  = {value : null}
    shader.uniforms.speedMap= {value : null}
    shader.uniforms.uResolution = {value : SIMULATION_RESOLUTION}
    shader.uniforms.uTime = { value: 0.0 }

    _vizShaderU = shader.uniforms
}


function CurlParticlesMaterial(props) {

    const material = useRef(null)
    const posMaterial = useRef(null)
    const speedMaterial = useRef(null)

    //Double buffers
    const pBuffer0 = useRef(new THREE.WebGLRenderTarget(SIMULATION_RESOLUTION[0], SIMULATION_RESOLUTION[1],
        {
            magFilter: THREE.NearestFilter,
            minFilter: THREE.NearestFilter,
            format: THREE.RGBAFormat,
            depthBuffer: false,
        }))
    const pBuffer1 = useRef(new THREE.WebGLRenderTarget(SIMULATION_RESOLUTION[0], SIMULATION_RESOLUTION[1],
        {
            magFilter: THREE.NearestFilter,
            minFilter: THREE.NearestFilter,
            format: THREE.RGBAFormat,
            depthBuffer: false,
        }))

    //Buffers for simulation material
    const sBuffer = useRef(new THREE.WebGLRenderTarget(SIMULATION_RESOLUTION[0], SIMULATION_RESOLUTION[1],
        {
            magFilter: THREE.NearestFilter,
            minFilter: THREE.NearestFilter,
            format: THREE.RGBAFormat,
            depthBuffer: false,
        }))

    const [positionScene] = useState(() => new THREE.Scene(), [])
    const [speedScene] = useState(() => new THREE.Scene(), [])
    const [camera] = useState(() => new THREE.OrthographicCamera(-1, 1, 1, -1, 1 / Math.pow(2, 53), 1)
    );

    const vizShaderCompile = useCallback(injectVizShader, [])

    useFrame((state) => {

        posMaterial.current.uDeltaTime = state.clock.getDelta()
        posMaterial.current.uTime = state.clock.elapsedTime
        posMaterial.current.positionMap = pBuffer0.texture
        posMaterial.current.speedMap = sBuffer.texture

        speedMaterial.current.positionMap = pBuffer0.texture

        posMaterial.uniformsNeedUpdate = true
        speedMaterial.uniformsNeedUpdate = true


        // Render To Si mulation Buffers
        const target = state.gl.getRenderTarget()
        state.gl.setRenderTarget(pBuffer1.current)
        state.gl.render(positionScene, camera)
        state.gl.setRenderTarget(sBuffer.current)

        state.gl.render(speedScene, camera)
        state.gl.setRenderTarget(target)

        //swap double buffer
        const b = pBuffer0.current
        pBuffer0.current = pBuffer1.current
        pBuffer1.current = b
        
        if (_vizShaderU){   
            _vizShaderU.uTime.value = state.clock.elapsedTime
            _vizShaderU.positionMap.value = pBuffer0.current.texture
            _vizShaderU.speedMap.value = sBuffer.current.texture
        }

    }, [])

    return <>
        {createPortal(

            <ScreenQuad>
                <positionSimulationMaterial ref={posMaterial} />
            </ScreenQuad>, positionScene

        )}
        {createPortal(

            <ScreenQuad>
                <speedSimulationMaterial ref={speedMaterial} />
            </ScreenQuad>, speedScene
        )}


        {/* <meshStandardMaterial {...props} ref={material} side={THREE.DoubleSide} vertexColors onBeforeCompile={vizShaderCompile} uniforms={vizUniforms} > */}
        <meshStandardMaterial {...props} ref={material} side={THREE.DoubleSide} vertexColors onBeforeCompile={vizShaderCompile} >
            {/* <RenderTexture attach="positionBuffer" renderPriority={2} width={1024} height={1024}>
                <ScreenQuad>
                    <positionSimulationMaterial ref={posMaterial}/>
                </ScreenQuad>
            </RenderTexture>
            <RenderTexture attach="speedBuffer" renderPriority={1} width={1024} height={1024}>
                <ScreenQuad>
                    <speedSimulationMaterial ref={speedMaterial}/>
                </ScreenQuad>
            </RenderTexture> */}
        </meshStandardMaterial>
    </>


}

export default CurlParticlesMaterial