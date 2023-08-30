import { useRef } from "react"
import { Canvas } from "@react-three/fiber"
import { Center, AccumulativeShadows, RandomizedLight, OrbitControls, Environment,Stats} from '@react-three/drei'

import * as THREE from 'three'


import SimulationObject from "./SimulationObject"

function Content() {

    return <>
        <Canvas shadows camera={{ position: [8, 1.5, 8], fov: 25 }}>
            <Stats/>
            <axesHelper />
            <group position={[0, -0.5, 0]}>
                <Center top position={[-2, 0, 1]}>
                
                    <mesh castShadow>
                        <sphereGeometry args={[0.25, 64, 64]} />
                        <meshStandardMaterial color="indianred" />
                    </mesh>
                </Center>
                <Center top position={[2.5, 0, 1]}>
                    <mesh castShadow rotation={[0, Math.PI / 4, 0]}>
                        <boxGeometry args={[0.5, 0.5, 0.5]} />
                        <meshStandardMaterial color="indianred" />
                    </mesh>
                </Center>

                <Center  top position={[0, 0, 0]} >
                    <SimulationObject quantity={100}/>
                </Center>

                <Center position={[0, -0.01, 0]}>
                    <mesh receiveShadow rotation={[-Math.PI * 0.5, 0, 0]} scale={10}>
                        <planeGeometry />
                        <shadowMaterial receiveShadow />
                        {/* <meshStandardMaterial color={"lightblue"} receiveShadow/> */}

                    </mesh>
                </Center>
                <AccumulativeShadows temporal frames={20} color="goldenrod" colorBlend={5} toneMapped={true} alphaTest={0.2} opacity={2} scale={12}>
                    <RandomizedLight amount={8} radius={4} ambient={0.5} intensity={1} position={[5, 5, -10]} bias={0.05} />
                </AccumulativeShadows>
                {/* <directionalLight  position={[5, 5, -10]} castShadow intensity={0.5} /> */}
            </group>
            <OrbitControls minPolarAngle={0} maxPolarAngle={Math.PI / 2} />
            <Environment preset="city" />
        </Canvas>
    </>
}

export default Content