// One continuous 3D world for the pitch deck: the landing page's farm above ground and a small data centre
// below it. Each slide sets a camera target and season; the camera glides there, and moving to the
// architecture slide is a dive through the field into the data centre.
import { useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Bloom, EffectComposer, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';
import { Farm, Rain, SkyAndFog, Sun } from '../landing/World';
import { story } from '../landing/story';
import type { Slide } from './slides';

const LAB_Y = -200;

function rand(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let x = Math.imul(a ^ (a >>> 15), 1 | a);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

/** Server racks with blinking status lights around a glowing core (the advisory engine). */
function DataCentre() {
  const group = useRef<THREE.Group>(null);
  const core = useRef<THREE.Mesh>(null);
  const leds = useRef<THREE.InstancedMesh>(null);
  const { racks, ledPos } = useMemo(() => {
    const r = rand(42);
    const racks: [number, number][] = [];
    for (let row = -1; row <= 1; row += 2) for (let i = -3; i <= 3; i++) racks.push([i * 1.6, row * 3.2]);
    const ledPos: [number, number, number][] = [];
    for (const [x, z] of racks)
      for (let k = 0; k < 10; k++)
        ledPos.push([x - 0.35 + r() * 0.7, 0.3 + k * 0.28, z + (z > 0 ? -0.46 : 0.46)]);
    return { racks, ledPos };
  }, []);
  const ledColors = useMemo(
    () => [new THREE.Color(0.4, 2.4, 0.8), new THREE.Color(2.4, 1.8, 0.3), new THREE.Color(0.5, 1.4, 2.6)],
    [],
  );

  useFrame(({ clock }) => {
    const g = group.current;
    if (!g) return;
    g.visible = story.scene === 'lab';
    if (!g.visible) return;
    if (core.current) {
      core.current.rotation.y = clock.elapsedTime * 0.5;
      core.current.rotation.x = clock.elapsedTime * 0.2;
    }
    const m = leds.current;
    if (m) {
      const c = new THREE.Color();
      for (let i = 0; i < ledPos.length; i++) {
        const on = Math.sin(clock.elapsedTime * (2 + (i % 7)) + i * 1.7) > 0.2;
        m.setColorAt(i, on ? ledColors[i % 3]! : c.setRGB(0.05, 0.08, 0.06));
      }
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
  });

  const ledMesh = useMemo(() => {
    const inst = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.06, 0.04, 0.02),
      new THREE.MeshBasicMaterial({ toneMapped: false }),
      ledPos.length,
    );
    const d = new THREE.Object3D();
    ledPos.forEach((p, i) => {
      d.position.set(...p);
      d.updateMatrix();
      inst.setMatrixAt(i, d.matrix);
      inst.setColorAt(i, new THREE.Color(0.4, 2.4, 0.8));
    });
    return inst;
  }, [ledPos]);

  return (
    <group ref={group} position={[0, LAB_Y, 0]}>
      <gridHelper args={[40, 40, '#3d6e8a', '#24465a']} />
      {racks.map(([x, z], i) => (
        <mesh key={i} position={[x, 1.5, z]}>
          <boxGeometry args={[1.1, 3, 0.9]} />
          <meshStandardMaterial color="#1d2a33" metalness={0.4} roughness={0.5} />
        </mesh>
      ))}
      <primitive ref={leds} object={ledMesh} />
      {/* Cables from every rack to the core */}
      {racks.map(([x, z], i) => (
        <line key={`c${i}`}>
          <bufferGeometry
            attach="geometry"
            onUpdate={(g) =>
              g.setFromPoints([
                new THREE.Vector3(x, 3, z),
                new THREE.Vector3(x * 0.5, 3.6, z * 0.4),
                new THREE.Vector3(0, 2.2, 0),
              ])
            }
          />
          <lineBasicMaterial
            attach="material"
            color={[0.4, 1.6, 0.8]}
            toneMapped={false}
            transparent
            opacity={0.6}
          />
        </line>
      ))}
      <mesh ref={core} position={[0, 2.2, 0]}>
        <icosahedronGeometry args={[0.8, 0]} />
        <meshStandardMaterial
          color="#3e9b55"
          emissive={new THREE.Color(0.3, 1.6, 0.5)}
          emissiveIntensity={1.4}
          flatShading
          toneMapped={false}
        />
      </mesh>
      <pointLight position={[0, 4, 0]} intensity={30} distance={18} color="#9bd18f" />
    </group>
  );
}

/** Glides the camera to the slide's view and blends the season; picks the scene from the camera's depth. */
function PitchCamera({ slide, still }: { slide: Slide; still: boolean }) {
  const { camera } = useThree();
  const look = useRef(new THREE.Vector3(...slide.camera.look));
  const target = useMemo(() => new THREE.Vector3(), []);
  const lookTarget = useMemo(() => new THREE.Vector3(), []);
  useFrame((_, dt) => {
    target.set(...slide.camera.pos);
    lookTarget.set(...slide.camera.look);
    target.x += story.pointer.x * 0.6;
    target.y += story.pointer.y * 0.3;
    // Frame-rate independent easing; still renders jump straight there.
    const k = still ? 1 : 1 - Math.pow(0.05, dt);
    camera.position.lerp(target, k);
    look.current.lerp(lookTarget, k);
    camera.lookAt(look.current);
    story.season += (slide.season - story.season) * (still ? 1 : Math.min(1, dt * 1.8));
    // Above ground is the farm; deep below is the data centre. The dive between them passes the field.
    story.scene = camera.position.y < -40 ? 'lab' : 'farm';
  });
  return null;
}

export default function PitchWorld({
  slide,
  quality,
  still = false,
}: {
  slide: Slide;
  quality: 'high' | 'medium';
  still?: boolean;
}) {
  return (
    <Canvas
      dpr={quality === 'high' ? [1, 1.75] : [1, 1.25]}
      camera={{ fov: 42, near: 0.1, far: 260, position: [-22, 14, 26] }}
      gl={{ antialias: false }}
      aria-hidden="true"
    >
      <SkyAndFog />
      <hemisphereLight args={['#e3eef3', '#5a3a26', 0.9]} />
      <ambientLight intensity={0.2} />
      <Sun />
      <Farm />
      <Rain count={quality === 'high' ? 1000 : 400} />
      <DataCentre />
      <PitchCamera slide={slide} still={still} />
      <EffectComposer multisampling={0}>
        <Bloom intensity={0.8} luminanceThreshold={0.85} luminanceSmoothing={0.2} mipmapBlur />
        <Vignette eskil={false} offset={0.2} darkness={0.6} />
      </EffectComposer>
    </Canvas>
  );
}
