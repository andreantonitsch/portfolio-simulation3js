import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import * as dat from 'lil-gui'
import { Mesh, BoxGeometry, PlaneGeometry, ShadowMaterial, MeshStandardMaterial } from 'three'

import {position_vertex, position_frag, speed_vertex, speed_frag} from './shaders/simulation_shaders.js'
import {viz_common_replace, viz_vertex_replace, viz_normal_replace, viz_depth_replace} from './shaders/visualization_shaders.js'
import { BufferAttribute } from 'three'
import { MeshNormalMaterial } from 'three'
import Stats from 'stats.js'


/**
 * Properties
 */
const q = 128
const props = {
    quantity: q * q,
    simulation_resolution : [q, q],
    debug : window.location.hash === '#debug',
    dummyprops : {objColor : new THREE.Color("rgba(191, 91, 91, 1)"),
                  backgroundColor : new THREE.Color("rgba(243, 224, 80,1)")},

    maxLifetime : 3.0,
    particleSpeed : 1.0,
    pLength : {value: 0.15},
    pWidth : { value : 0.02 },
    pHeight : {value : 0.03},
    speedScale : { value : 0.02},
    lifetimeVariation : { value : 0.1},
    particleSpawnJitter : {value : 0.2},
    minimumParticleSize : {value : 0.05}
}

let gui;
if(props.debug)
    gui = new dat.GUI()

const stats = new Stats()
stats.showPanel(0) // 0: fps, 1: ms, 2: mb, 3+: custom
document.body.appendChild(stats.dom)


/**
 * Mouse
 */
const mouse = new THREE.Vector2()

window.addEventListener('mousemove', (event) =>
{
    mouse.x = event.clientX / sizes.width * 2 - 1
    mouse.y = - (event.clientY / sizes.height) * 2 + 1

})


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

const sqGeom = new THREE.PlaneGeometry(2, 2)


//boxes setup
const cubeGeom = new BoxGeometry(0.5, 0.5, 0.5)
const redMaterial = new MeshStandardMaterial({ color: new THREE.Color("rgba(191, 91, 91, 1)") })

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
            speedMap: {value : sBuffer.texture},
            maxLifetime : {value : props.maxLifetime},
            mousePosition : { value : new THREE.Vector3()},
            uSpeedScale : props.speedScale,
            uLifetimeVariation : props.lifetimeVariation,
            uSpawnJitter : props.particleSpawnJitter
        
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
    renderer.render(spdQuad, simCamera1)
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


let viz_uniforms = {}
let shadow_uniforms = {}

const make_before_compile = (uniforms, depth=false) =>{
    return (shader) => {

        shader.vertexShader = shader.vertexShader.replace('#include <common>', viz_common_replace)
        if(depth){
            shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', viz_depth_replace)
        } else{
            shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', viz_vertex_replace)
            shader.vertexShader = shader.vertexShader.replace('#include <defaultnormal_vertex>', viz_normal_replace)
        }

        shader.vertexShader = resolveLygia(shader.vertexShader)

        shader.uniforms.positionMap  = {value : null}
        shader.uniforms.speedMap= {value : null}
        shader.uniforms.uResolution = {value : props.simulation_resolution}
        shader.uniforms.uTime = { value: 0.0 },
        shader.uniforms.maxLifetime = {value : props.maxLifetime}
        shader.uniforms.pHeight = props.pHeight
        shader.uniforms.pWidth = props.pWidth
        shader.uniforms.pLength = props.pLength
        shader.uniforms.uMinimumSize = props.minimumParticleSize
        uniforms.data = shader.uniforms
    }
}

const viz_material = new MeshStandardMaterial( { color : new THREE.Color("rgba(191, 91, 91, 1)")})
viz_material.onBeforeCompile = make_before_compile(viz_uniforms)
//console.log(viz_material.onBeforeCompile)

// const shadowMaterial = new THREE.MeshDepthMaterial()
// shadowMaterial.onBeforeCompile = make_before_compile(shadow_uniforms, true)

const sim_object = new Mesh(bufferGeometry, viz_material)

// sim_object.customDepthMaterial = shadowMaterial
// sim_object.castShadow = true

scene.add(sim_object)
sim_object.position.set(0.0, 0.5, 0.0)



/**
 * Mouse Raycasting
 */

const raycast_floor = new Mesh(new PlaneGeometry(20, 20, 1, 1), new THREE.MeshBasicMaterial())
raycast_floor.visible = false
raycast_floor.position.y = -0.5
raycast_floor.rotateX(- Math.PI / 2)
scene.add(raycast_floor)
const raycaster = new THREE.Raycaster()

let cast = true;

const cast_mouse = ( ) =>{
    if(cast){
        raycaster.setFromCamera(mouse, camera)
        const intersection = raycaster.intersectObject(raycast_floor)
    
        if(intersection.length > 0 ){
            posMaterial.uniforms.mousePosition.value.copy(intersection[0].point)
            posMaterial.uniforms.mousePosition.value.y =  -1
        }
    }
    cast = !cast

}


/**
 * Lights
 */
const directionalLight = new THREE.DirectionalLight('#ffffff', 3)
directionalLight.castShadow = true
directionalLight.shadow.mapSize.set(1024, 1024)
directionalLight.shadow.camera.far = 15
directionalLight.shadow.normalBias = 0.05
directionalLight.position.set(0.25, 2, - 2.25)

const ambientLight = new THREE.AmbientLight('#ffffff', 0.1)
scene.add(directionalLight)
scene.add(ambientLight)


// Controls
const controls = new OrbitControls(camera, canvas)
controls.enableDamping = true



/**
 * UI Tweaks
 */
if(props.debug){
    const generalGUI = gui.addFolder("General settings")
    generalGUI.addColor(props.dummyprops, "backgroundColor").onChange((v)=>{
    document.body.style.backgroundColor = "#" + v.getHexString();
    })

    const objsGUI = gui.addFolder("Object Parameters")
    objsGUI.addColor(props.dummyprops, "objColor").onChange((v) =>{
        redMaterial.color.set(v)
        viz_material.color.set(v)
    }).name("object color")

    const particlesGUI = gui.addFolder("Particle Parameters")
    particlesGUI.add(posMaterial.uniforms.maxLifetime,"value", 0.1, 20, 0.01).name("max life time").onChange((v) =>{
        viz_uniforms.data.maxLifetime.value = v;
    })

    particlesGUI.add(props.speedScale, 'value', 0.001, 0.1, 0.001).name("time scale")
    particlesGUI.add(props.lifetimeVariation, 'value', 0.00, 1.0, 0.01).name("% lifetime variation ")
    particlesGUI.add(props.particleSpawnJitter, 'value', 0.00, 1.0, 0.01).name("spawn jitter")

    particlesGUI.add(props.minimumParticleSize, 'value', 0.0, 1.0, 0.01).name("min p size")

    const particleDimensions = particlesGUI.addFolder("particle dimensions")
    particleDimensions.add(props.pWidth, 'value', 0.01, 0.3, 0.01 ).name('particle max width')
    particleDimensions.add(props.pHeight, 'value', 0.01, 0.3, 0.01 ).name('particle max height')
    particleDimensions.add(props.pLength, 'value', 0.01, 0.3, 0.01 ).name('particle max length')

    const lightsGUI = gui.addFolder("Lighting settings")
    lightsGUI.add(directionalLight, 'intensity', 0, 10, 0.01).name("directional light intensity")
    lightsGUI.add(ambientLight, 'intensity', 0, 10, 0.01).name("ambient light intensity")

}





/**
 * Animate
 */

const tick = () => {
    const elapsedTime = clock.getElapsedTime()

    // Update controls
    controls.update()

    stats.begin();

    cast_mouse()

    simulationStep()
    
    
    if(viz_uniforms.data){
        viz_uniforms.data.uTime.value = elapsedTime
        viz_uniforms.data.positionMap.value = pBuffer0.texture
        viz_uniforms.data.speedMap.value = sBuffer.texture
        
        // shadow_uniforms.data.uTime.value = elapsedTime
        // shadow_uniforms.data.positionMap.value = pBuffer0.texture
        // shadow_uniforms.data.speedMap.value = sBuffer.texture
    }
    
    renderer.render(scene, camera)
    stats.end();

    // Render

    // Call tick again on the next frame
    window.requestAnimationFrame(tick)
}

tick()