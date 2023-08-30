import {useMemo, useRef, useEffect} from "react"
import CurlParticlesMaterial from './CurlParticlesMaterial'
import * as THREE from "three" 

function SimulationObject(props){


    const geom = useRef(null);
    const verticeCount = props.quantity * 18; //18 vertices per 

    //dummy positions
    const verts = useMemo(() =>{
        const verts = new Float32Array(verticeCount * 3)
        
        for(let i = 0; i < verticeCount; i+=0){ //for every vertice
            const r = (Math.random() -0.5) * 2
            const r2 = (Math.random()  -0.5) * 2
            const r3 = (Math.random()  -0.5) * 2
            for(let j = 0; j < 18; j++){ //randoms for each solid
                verts[i ] = r
                verts[i +1] = r2
                verts[i +2] = r3
                i+=3
            }
        }
        return verts
    }, [])

    //position for orbiting **TEMP**
    const colors = useMemo(() =>{ 
        const colors  = new Float32Array(verticeCount * 3)

        for(let i = 0; i < verticeCount; i+=0){
            const r = (Math.random() -0.5) * 2
            const r2 = (Math.random()  -0.5) * 2
            const r3 = (Math.random()  -0.5) * 2
            for(let j = 0; j < 18; j++){ //randoms for each solid
                colors[i ] = r
                colors[i +1] = r2
                colors[i +2] = r3
                i+=3
            }
        }
        return colors
    }, [])

    const vertexIDs = useMemo(() =>{ 
        const vertexIDs  = new Uint32Array(verticeCount)

        for(let i = 0; i < verticeCount; i++){
            vertexIDs[i] = i
        }
        return vertexIDs
    }, [])

    useEffect(()=>{
        geom.current.computeVertexNormals()
        geom.current.computeBoundingBox()
    }, [])  


    return <>
        <mesh castShadow>
            <bufferGeometry ref={geom}>
                <bufferAttribute 
                    attach="attributes-position" 
                    count={verticeCount}
                    itemSize={3}
                    array={verts}
                />
                <bufferAttribute 
                    attach="attributes-color"
                    count={verticeCount}
                    itemSize={3}
                    array={colors}
                />
                <bufferAttribute 
                    attach="attributes-vertexID"
                    count={verticeCount}
                    itemSize={1}
                    array={vertexIDs}
                />
            </bufferGeometry>
            <CurlParticlesMaterial />
        </mesh>
    
    </>

}

export default SimulationObject