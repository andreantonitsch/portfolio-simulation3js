import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import * as dat from 'lil-gui'
import { Mesh, BoxGeometry, PlaneGeometry, ShadowMaterial, MeshStandardMaterial } from 'three'

import {position_vertex, position_frag, speed_vertex, speed_frag} from './shaders/simulation_shaders.js'
import {viz_common_replace, viz_vertex_replace} from './shaders/visualization_shaders.js'
import { BufferAttribute } from 'three'
import { MeshNormalMaterial } from 'three'
import Stats from 'stats.js'

const stats = new Stats()
stats.showPanel(0) // 0: fps, 1: ms, 2: mb, 3+: custom
document.body.appendChild(stats.dom)

/**
 * Base
 */
// Debug
//const gui = new dat.GUI() 

// Canvas
const canvas = document.querySelector('canvas.webgl')
const clock = new THREE.Clock()

/**
 * Sizes
 */
const sizes = {
    width: window.innerWidth,
    height: window.innerHeight
}

window.addEventListener('resize', () => {
    // Update sizes
    sizes.width = window.innerWidth
    sizes.height = window.innerHeight

    // Update camera
    camera.aspect = sizes.width / sizes.height
    camera.updateProjectionMatrix()

    // Update renderer
    renderer.setSize(sizes.width, sizes.height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
})

/**
 * Renderer
 */
const renderer = new THREE.WebGLRenderer({
    canvas: canvas,
    antialias: true,
    alpha: true
})
renderer.shadowMap.enabled = true
renderer.setSize(sizes.width, sizes.height)
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))


// Scene
const scene = new THREE.Scene()

/**
 * Camera
 */
// Base camera
const camera = new THREE.PerspectiveCamera(27, sizes.width / sizes.height, 0.1, 100)
camera.position.set(4, 1, - 4)
scene.add(camera)

const simCamera1 = new THREE.OrthographicCamera(-1, 1, 1, -1, 1 / Math.pow(2, 53), 1)
// const simCamera1 = new THREE.PerspectiveCamera(27, sizes.width / sizes.height, 0.1, 100)
// simCamera1.position.set(1, 0, 0)
// simCamera1.lookAt(0, 0, 0)

const simCamera2 = new THREE.OrthographicCamera(-1, 1, 1, -1, 1 / Math.pow(2, 53), 1)
// const simCamera2 = new THREE.PerspectiveCamera(27, sizes.width / sizes.height, 0.1, 100)
// simCamera2.position.set(1, 0, 0)
// simCamera2.lookAt(0, 0, 0)

const sqGeom = new THREE.PlaneGeometry(2, 2)

/**
 * Properties
 */
const props = {
    quantity: 256 * 256,
    simulation_resolution : [256, 256]
}

//boxes setup
const cubeGeom = new BoxGeometry(0.5, 0.5, 0.5)
const redMaterial = new MeshStandardMaterial({ color: new THREE.Color("indianred") })

const box1 = new Mesh(cubeGeom, redMaterial)
box1.position.set(2.5, 0, 1)
box1.castShadow = true;

const box2 = new Mesh(cubeGeom, redMaterial)
box2.position.set(-2, 0, 1)
box2.castShadow = true;

scene.add(box1)
scene.add(box2)


//floor shadows
const planeGeom = new PlaneGeometry(10, 10, 10)
const floor = new Mesh(planeGeom, new ShadowMaterial())
// const floor = new Mesh(planeGeom, redMaterial)
floor.receiveShadow = true;
floor.position.y = -0.25
floor.rotation.x = - Math.PI / 2
scene.add(floor)


/**
 * Simulation Objects
 */

let pBuffer0 = new THREE.WebGLRenderTarget(props.simulation_resolution[0], props.simulation_resolution[1],
    {   magFilter: THREE.NearestFilter, minFilter: THREE.NearestFilter, type: THREE.FloatType, depthBuffer: false, })
let pBuffer1 = new THREE.WebGLRenderTarget(props.simulation_resolution[0], props.simulation_resolution[1],
    {   magFilter: THREE.NearestFilter, minFilter: THREE.NearestFilter, type: THREE.FloatType, depthBuffer: false, })
let sBuffer = new THREE.WebGLRenderTarget(props.simulation_resolution[0], props.simulation_resolution[1],
    {   magFilter: THREE.NearestFilter, minFilter: THREE.NearestFilter, type: THREE.FloatType, depthBuffer: false, })


const posMaterial = new THREE.ShaderMaterial(
    {
        uniforms : { 
            uResolution: {value : new THREE.Vector2(props.simulation_resolution[0], props.simulation_resolution[1])},
            uDeltaTime: {value : 0.0},
            uTime : {value : 0},
            positionMap: {value : pBuffer0.texture},
            speedMap: {value : sBuffer.texture}
        },
        vertexShader : position_vertex,
        fragmentShader : position_frag
    }
)

//console.log(position_vertex, position_frag)

const spdMaterial = new THREE.ShaderMaterial(
    {
        uniforms : { 
            uResolution: {value : new THREE.Vector2(props.simulation_resolution[0], props.simulation_resolution[1])},
            speed: {value : 1.0},
            positionMap: {value : pBuffer0.texture},
            uTime : {value : 0},
            uDeltaTime: {value : 0.0}
        },
        vertexShader : speed_vertex,
        fragmentShader : speed_frag
    }
)

const posQuad = new Mesh(sqGeom, posMaterial)
const spdQuad = new Mesh(sqGeom, spdMaterial)
let lastTime = clock.getElapsedTime()
const simulationStep = () => {

    const current = clock.getElapsedTime()
    const delta = current - lastTime
    lastTime = current

    posMaterial.uniforms.uDeltaTime.value = delta
    posMaterial.uniforms.uTime.value = current
    posMaterial.uniforms.positionMap.value = pBuffer0.texture
    posMaterial.uniforms.speedMap.value = sBuffer.texture

    spdMaterial.uniforms.positionMap.value = pBuffer0.texture
    spdMaterial.uniforms.uTime.value = current

    posMaterial.uniformsNeedUpdate = true
    spdMaterial.uniformsNeedUpdate = true

    renderer.setRenderTarget(pBuffer1)
    renderer.render(posQuad, simCamera1)

    renderer.setRenderTarget(sBuffer)
    renderer.render(spdQuad, simCamera2)
    renderer.setRenderTarget(null)
    

    //swap double buffer
    const b = pBuffer0
    pBuffer0 = pBuffer1
    pBuffer1 = b
}


/**
*   Simulation Visualiation Object 
 */

const verticeCount = props.quantity * 18; //18 vertices per
const verts = new Float32Array(verticeCount * 3)
const vertexIDs  = new Uint32Array(verticeCount)
const instanceIDs = new Uint32Array(verticeCount)
// sets verts
let instanceID = 0
for(let i = 0; i < verticeCount; i+=0){ //for every vertice
    const r = (Math.random() -0.5) * 2
    const r2 = (Math.random()  -0.5) * 2
    const r3 = (Math.random()  -0.5) * 2
    for(let j = 0; j < 18; j++){ //randoms for each solid
        verts[i ] = r
        verts[i +1] = r2
        verts[i +2] = r3
        instanceIDs[i ] = instanceID
        instanceIDs[i + 1] = instanceID
        instanceIDs[i + 2] = instanceID
        i+=3
    }
    instanceID += 1
}

//sets ids
for(let i = 0; i < verticeCount; i++){
    vertexIDs[i] = i
}

const bufferGeometry = new THREE.BufferGeometry()
bufferGeometry.setAttribute('position', new BufferAttribute(verts, 3 ))
bufferGeometry.setAttribute('vertexID', new BufferAttribute(vertexIDs, 1))
bufferGeometry.setAttribute('instanceID', new BufferAttribute(instanceIDs, 1))


let viz_uniforms = null

const before_compile = (shader) => {

    shader.vertexShader = shader.vertexShader.replace('#include <common>', viz_common_replace)
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', viz_vertex_replace)

    shader.vertexShader = resolveLygia(shader.vertexShader)

    shader.uniforms.positionMap  = {value : null}
    shader.uniforms.speedMap= {value : null}
    shader.uniforms.uResolution = {value : props.simulation_resolution}
    shader.uniforms.uTime = { value: 0.0 }

    viz_uniforms = shader.uniforms
}

const viz_material = new MeshStandardMaterial()
viz_material.onBeforeCompile = before_compile

const sim_object = new Mesh(bufferGeometry, viz_material) 
scene.add(sim_object)




/**
 * Lights
 */
const directionalLight = new THREE.DirectionalLight('#ffffff', 3)
directionalLight.castShadow = true
directionalLight.shadow.mapSize.set(1024, 1024)
directionalLight.shadow.camera.far = 15
directionalLight.shadow.normalBias = 0.05
directionalLight.position.set(0.25, 2, - 2.25)
scene.add(directionalLight)


// Controls
const controls = new OrbitControls(camera, canvas)
controls.enableDamping = true


/**
 * Animate
 */

const tick = () => {
    const elapsedTime = clock.getElapsedTime()

    // Update controls
    controls.update()

    stats.begin();

    simulationStep()
    renderer.render(scene, camera)

    stats.end();

    if(viz_uniforms){
        viz_uniforms.uTime.value = elapsedTime
        viz_uniforms.positionMap.value = pBuffer0.texture
        viz_uniforms.speedMap.value = sBuffer.texture
    }

    // Render

    // Call tick again on the next frame
    window.requestAnimationFrame(tick)
}

tick()