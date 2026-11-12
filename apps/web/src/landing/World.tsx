// The landing page's 3D world: a low-poly farm that moves through the seasons as the camera flies over it,
// and a soil cross-section with N, P and K particles. Everything is generated in code (no model files).
// State comes from `story` (written by scroll), so React never re-renders while scrolling.
import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Bloom, DepthOfField, EffectComposer, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';
import { story, type SeasonId } from './story';

// ---------- helpers ----------

const SEASON_PLANT = [new THREE.Color('#3e9b55'), new THREE.Color('#e2b53a'), new THREE.Color('#b99a6a')];
const SEASON_GROUND = [new THREE.Color('#4f7a3a'), new THREE.Color('#7b8a3e'), new THREE.Color('#b8956a')];
const SEASON_SKY = [new THREE.Color('#8fa7b3'), new THREE.Color('#a9cfe6'), new THREE.Color('#e8d3a8')];
const SEASON_TREE = [new THREE.Color('#2f7a43'), new THREE.Color('#3e8a4a'), new THREE.Color('#8a8a4a')];

/** Colour for a fractional season index (0..2), blending neighbours. */
function seasonColor(stops: THREE.Color[], s: number, out: THREE.Color) {
  const i = Math.min(stops.length - 2, Math.floor(s));
  return out.lerpColors(stops[i]!, stops[i + 1]!, Math.min(1, Math.max(0, s - i)));
}

/** Deterministic pseudo-random numbers, so the world looks the same every load. */
function rand(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let x = Math.imul(a ^ (a >>> 15), 1 | a);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

const FIELD = { cols: 4, rows: 3, w: 5, d: 4, gap: 0.9 };
const fieldHalfW = (FIELD.cols * (FIELD.w + FIELD.gap)) / 2;
const fieldHalfD = (FIELD.rows * (FIELD.d + FIELD.gap)) / 2;

/** Rolling low hills, flattened where the fields are. */
function heightAt(x: number, z: number) {
  const hills =
    1.4 * Math.sin(x * 0.12) * Math.cos(z * 0.1) +
    0.6 * Math.sin(x * 0.31 + z * 0.23) +
    0.3 * Math.cos(z * 0.47);
  const fx = Math.max(0, Math.abs(x) - fieldHalfW - 1) / 6;
  const fz = Math.max(0, Math.abs(z) - fieldHalfD - 1) / 6;
  const t = Math.min(1, Math.hypot(fx, fz));
  return hills * t * t * (3 - 2 * t) - 0.05;
}

// ---------- farm ----------

function Ground() {
  const mat = useRef<THREE.MeshStandardMaterial>(null);
  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(110, 110, 70, 70).toNonIndexed();
    g.rotateX(-Math.PI / 2);
    const p = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) p.setY(i, heightAt(p.getX(i), p.getZ(i)));
    g.computeVertexNormals();
    return g;
  }, []);
  const c = useMemo(() => new THREE.Color(), []);
  useFrame(() => mat.current && mat.current.color.copy(seasonColor(SEASON_GROUND, story.season, c)));
  return (
    <mesh geometry={geo} receiveShadow>
      <meshStandardMaterial ref={mat} flatShading roughness={1} />
    </mesh>
  );
}

/** All crop plants in one instanced mesh. Sway and season height run on the GPU. */
function Crops() {
  const mat = useRef<THREE.MeshStandardMaterial>(null);
  const uniforms = useMemo(() => ({ uTime: { value: 0 }, uHeight: { value: 1 } }), []);
  const { mesh } = useMemo(() => {
    const r = rand(7);
    const positions: [number, number, number][] = [];
    for (let cx = 0; cx < FIELD.cols; cx++)
      for (let cz = 0; cz < FIELD.rows; cz++) {
        const x0 = -fieldHalfW + cx * (FIELD.w + FIELD.gap) + FIELD.gap / 2;
        const z0 = -fieldHalfD + cz * (FIELD.d + FIELD.gap) + FIELD.gap / 2;
        for (let x = 0.2; x < FIELD.w; x += 0.36)
          for (let z = 0.2; z < FIELD.d; z += 0.42) positions.push([x0 + x + (r() - 0.5) * 0.08, 0, z0 + z]);
      }
    const geo = new THREE.ConeGeometry(0.1, 0.5, 5);
    geo.translate(0, 0.25, 0);
    const m = new THREE.InstancedMesh(geo, undefined, positions.length);
    const d = new THREE.Object3D();
    const tint = new THREE.Color();
    positions.forEach(([x, y, z], i) => {
      d.position.set(x, y, z);
      d.rotation.y = r() * Math.PI;
      d.scale.setScalar(0.8 + r() * 0.45);
      d.updateMatrix();
      m.setMatrixAt(i, d.matrix);
      // Small per-plot brightness variation so the fields read as separate plots.
      const plot =
        Math.floor((x + fieldHalfW) / (FIELD.w + FIELD.gap)) * 3 +
        Math.floor((z + fieldHalfD) / (FIELD.d + FIELD.gap));
      const k = 0.86 + ((plot * 37) % 10) / 40;
      m.setColorAt(i, tint.setRGB(k, k, k));
    });
    return { mesh: m };
  }, []);
  const c = useMemo(() => new THREE.Color(), []);
  useFrame(({ clock }) => {
    uniforms.uTime.value = clock.elapsedTime;
    // Zaid stubble is short; kharif and rabi crops stand tall.
    uniforms.uHeight.value = 1 - Math.max(0, story.season - 1) * 0.55;
    if (mat.current) mat.current.color.copy(seasonColor(SEASON_PLANT, story.season, c));
  });
  return (
    <primitive object={mesh}>
      <meshStandardMaterial
        ref={mat}
        attach="material"
        flatShading
        roughness={0.85}
        onBeforeCompile={(shader) => {
          Object.assign(shader.uniforms, uniforms);
          shader.vertexShader = shader.vertexShader
            .replace('#include <common>', '#include <common>\nuniform float uTime;\nuniform float uHeight;')
            .replace(
              '#include <begin_vertex>',
              `#include <begin_vertex>
               transformed.y *= uHeight;
               vec4 root = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
               float sway = sin(uTime * 1.6 + root.x * 0.6 + root.z * 0.4) * 0.09 * transformed.y;
               transformed.x += sway;
               transformed.z += sway * 0.5;`,
            );
        }}
      />
    </primitive>
  );
}

/** Irrigation channels between the plots; water drops in the dry season. */
function Channels() {
  const ref = useRef<THREE.Group>(null);
  const strips = useMemo(() => {
    const out: { x: number; z: number; w: number; d: number }[] = [];
    for (let c = 0; c <= FIELD.cols; c++)
      out.push({ x: -fieldHalfW + c * (FIELD.w + FIELD.gap), z: 0, w: 0.35, d: fieldHalfD * 2 });
    for (let r = 0; r <= FIELD.rows; r++)
      out.push({ x: 0, z: -fieldHalfD + r * (FIELD.d + FIELD.gap), w: fieldHalfW * 2, d: 0.35 });
    return out;
  }, []);
  useFrame(() => {
    if (ref.current) ref.current.position.y = -0.02 - Math.max(0, story.season - 1) * 0.12;
  });
  return (
    <group ref={ref}>
      {strips.map((s, i) => (
        <mesh key={i} position={[s.x, 0, s.z]} rotation-x={-Math.PI / 2}>
          <planeGeometry args={[s.w, s.d]} />
          <meshStandardMaterial color="#3d6e8a" emissive="#24465a" emissiveIntensity={0.3} roughness={0.75} />
        </mesh>
      ))}
    </group>
  );
}

function Trees() {
  const foliage = useMemo(() => new THREE.MeshStandardMaterial({ color: '#2f7a43', flatShading: true }), []);
  const trees = useMemo(() => {
    const r = rand(11);
    const out: { x: number; z: number; s: number }[] = [];
    while (out.length < 26) {
      const x = (r() - 0.5) * 70;
      const z = (r() - 0.5) * 60;
      if (Math.abs(x) < fieldHalfW + 2 && Math.abs(z) < fieldHalfD + 2) continue;
      out.push({ x, z, s: 0.8 + r() * 0.8 });
    }
    return out;
  }, []);
  const c = useMemo(() => new THREE.Color(), []);
  useFrame(() => void foliage.color.copy(seasonColor(SEASON_TREE, story.season, c)));
  return (
    <group>
      {trees.map((t, i) => (
        <group key={i} position={[t.x, heightAt(t.x, t.z), t.z]} scale={t.s}>
          <mesh position={[0, 0.7, 0]}>
            <cylinderGeometry args={[0.12, 0.18, 1.4, 5]} />
            <meshStandardMaterial color="#5a3a26" flatShading />
          </mesh>
          <mesh position={[0, 1.9, 0]} material={foliage}>
            <icosahedronGeometry args={[0.95, 0]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function Farmhouse() {
  const x = -fieldHalfW - 5;
  const z = -3;
  const y = heightAt(x, z);
  return (
    <group position={[x, y, z]} rotation-y={0.4}>
      <mesh position={[0, 0.8, 0]}>
        <boxGeometry args={[2.6, 1.6, 2]} />
        <meshStandardMaterial color="#f1e6da" flatShading />
      </mesh>
      <mesh position={[0, 2.1, 0]} rotation-y={Math.PI / 4}>
        <coneGeometry args={[2.2, 1.2, 4]} />
        <meshStandardMaterial color="#8a5a3b" flatShading />
      </mesh>
      <mesh position={[0.5, 0.45, 1.01]}>
        <boxGeometry args={[0.6, 0.9, 0.04]} />
        <meshStandardMaterial color="#5a3a26" />
      </mesh>
    </group>
  );
}

function Clouds() {
  const group = useRef<THREE.Group>(null);
  const clouds = useMemo(() => {
    const r = rand(23);
    return Array.from({ length: 9 }, () => ({
      x: (r() - 0.5) * 90,
      y: 11 + r() * 5,
      z: -30 + r() * 45,
      speed: 0.4 + r() * 0.5,
      puffs: Array.from({ length: 3 + Math.floor(r() * 3) }, () => ({
        x: (r() - 0.5) * 4,
        y: (r() - 0.5) * 0.8,
        z: (r() - 0.5) * 2,
        s: 1 + r() * 1.3,
      })),
    }));
  }, []);
  const mat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#ffffff',
        flatShading: true,
        transparent: true,
        opacity: 0.92,
      }),
    [],
  );
  useFrame((_, dt) => {
    const g = group.current;
    if (!g) return;
    // Monsoon skies are grey and full; rabi and zaid skies are light and sparse.
    const wet = Math.max(0, 1 - story.season);
    mat.color.setRGB(1 - wet * 0.28, 1 - wet * 0.26, 1 - wet * 0.22);
    g.children.forEach((c, i) => {
      c.position.x += clouds[i]!.speed * dt * 1.5;
      if (c.position.x > 50) c.position.x = -50;
      c.visible = i < 4 + Math.round(wet * 5);
    });
  });
  return (
    <group ref={group}>
      {clouds.map((c, i) => (
        <group key={i} position={[c.x, c.y, c.z]}>
          {c.puffs.map((p, j) => (
            <mesh key={j} position={[p.x, p.y, p.z]} scale={p.s} material={mat}>
              <icosahedronGeometry args={[1, 0]} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

/** Light rain near the camera during the monsoon. */
function Rain({ count }: { count: number }) {
  const pts = useRef<THREE.Points>(null);
  const geo = useMemo(() => {
    const r = rand(5);
    const a = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      a[i * 3] = (r() - 0.5) * 50;
      a[i * 3 + 1] = r() * 16;
      a[i * 3 + 2] = (r() - 0.5) * 40;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(a, 3));
    return g;
  }, [count]);
  useFrame((_, dt) => {
    const p = pts.current;
    if (!p) return;
    const wet = Math.max(0, 1 - story.season * 2);
    p.visible = wet > 0.02 && story.scene === 'farm';
    (p.material as THREE.PointsMaterial).opacity = 0.55 * wet;
    const a = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < count; i++) {
      let y = a.getY(i) - dt * 14;
      if (y < 0) y = 16;
      a.setY(i, y);
    }
    a.needsUpdate = true;
  });
  return (
    <points ref={pts} geometry={geo}>
      <pointsMaterial color="#dbe8ef" size={0.08} transparent depthWrite={false} />
    </points>
  );
}

/** Sun that drifts towards the pointer. Bright enough to bloom. */
function Sun() {
  const mesh = useRef<THREE.Mesh>(null);
  const light = useRef<THREE.DirectionalLight>(null);
  useFrame(() => {
    const tx = 18 + story.pointer.x * 14;
    const ty = 20 + story.pointer.y * 6;
    const m = mesh.current;
    if (!m) return;
    m.position.x += (tx - m.position.x) * 0.05;
    m.position.y += (ty - m.position.y) * 0.05;
    light.current?.position.copy(m.position);
    const dry = Math.max(0, story.season - 1);
    if (light.current) light.current.intensity = 1.7 + dry * 0.6 - Math.max(0, 1 - story.season) * 0.5;
  });
  return (
    <>
      <mesh ref={mesh} position={[18, 20, -40]}>
        <sphereGeometry args={[2.4, 24, 16]} />
        <meshBasicMaterial color={[4, 3.4, 2.2]} toneMapped={false} fog={false} />
      </mesh>
      <directionalLight ref={light} position={[18, 16, -40]} intensity={1.8} color="#fff1d6" />
    </>
  );
}

function SkyAndFog() {
  const { scene } = useThree();
  const c = useMemo(() => new THREE.Color(), []);
  useMemo(() => {
    scene.background = new THREE.Color('#a9cfe6');
    scene.fog = new THREE.Fog('#a9cfe6', 35, 95);
  }, [scene]);
  useFrame(() => {
    if (story.scene === 'soil') {
      (scene.background as THREE.Color).set('#1e1813');
      scene.fog!.color.set('#1e1813');
      return;
    }
    seasonColor(SEASON_SKY, story.season, c);
    (scene.background as THREE.Color).copy(c);
    scene.fog!.color.copy(c);
  });
  return null;
}

function Farm() {
  const ref = useRef<THREE.Group>(null);
  useFrame(() => ref.current && (ref.current.visible = story.scene === 'farm'));
  return (
    <group ref={ref}>
      <Ground />
      <Crops />
      <Channels />
      <Trees />
      <Farmhouse />
      <Clouds />
    </group>
  );
}

// ---------- soil cross-section ----------

/**
 * Example Soil Health Card as particle counts per layer: nitrogen low (sparse), phosphorus medium,
 * potassium high (dense). Only the top two layers hold nutrients.
 */
const LAYERS = [
  { name: 'topsoil', h: 1.1, color: '#5a3a26', npk: [45, 90, 200] },
  { name: 'subsoil', h: 1.4, color: '#8a5a3b', npk: [25, 100, 220] },
  { name: 'clay', h: 1.2, color: '#c9a487', npk: [0, 0, 0] },
  { name: 'rock', h: 1.6, color: '#6b5e52', npk: [0, 0, 0] },
];
const NPK_COLORS = [
  new THREE.Color(0.6, 2.2, 0.8),
  new THREE.Color(0.6, 1.4, 2.6),
  new THREE.Color(2.6, 1.9, 0.4),
];
const SOIL_Y = -100;

/** Glowing nutrient particles filling one layer's volume. */
function LayerNutrients({
  h,
  counts,
  scale,
  seed,
}: {
  h: number;
  counts: number[];
  scale: number;
  seed: number;
}) {
  const sets = useMemo(() => {
    const r = rand(seed);
    return counts.map((n, k) => {
      const count = Math.round(n * scale);
      const a = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        a[i * 3] = (r() - 0.5) * 7.6;
        a[i * 3 + 1] = -r() * h;
        a[i * 3 + 2] = (r() - 0.5) * 5.6;
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(a, 3));
      return { geo: g, color: NPK_COLORS[k]! };
    });
  }, [counts, h, scale, seed]);
  return (
    <>
      {sets.map((s, i) => (
        <points key={i} geometry={s.geo}>
          <pointsMaterial
            color={s.color}
            size={0.12}
            sizeAttenuation
            transparent
            opacity={0.95}
            toneMapped={false}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </points>
      ))}
    </>
  );
}

/**
 * An exploded view of the soil profile: as you scroll, the layers separate vertically and turn slightly,
 * so each one, and the nutrients inside it, can be seen on its own.
 */
function Soil({ particleScale }: { particleScale: number }) {
  const ref = useRef<THREE.Group>(null);
  const layers = useRef<(THREE.Group | null)[]>([]);
  useFrame(({ clock }) => {
    const g = ref.current;
    if (!g) return;
    g.visible = story.scene === 'soil';
    if (!g.visible) return;
    layers.current.forEach((l, i) => {
      if (!l) return;
      l.position.y = -i * story.peel * 0.9 + Math.sin(clock.elapsedTime * 0.6 + i) * 0.03 * story.peel;
      l.rotation.y = story.peel * (i - 1.5) * 0.08;
    });
  });
  let top = 0;
  return (
    <group ref={ref} position={[0, SOIL_Y, 0]}>
      {LAYERS.map((l, i) => {
        const y = top;
        top -= l.h;
        return (
          <group key={l.name} ref={(el) => (layers.current[i] = el)}>
            <group position={[0, y, 0]}>
              <mesh position={[0, -l.h / 2, 0]}>
                <boxGeometry args={[8, l.h, 6]} />
                <meshStandardMaterial
                  color={l.color}
                  flatShading
                  roughness={1}
                  transparent={i < 2}
                  opacity={i < 2 ? 0.55 : 1}
                  depthWrite={i >= 2}
                />
              </mesh>
              {i === 0 && (
                <mesh position={[0, 0.06, 0]}>
                  <boxGeometry args={[8, 0.12, 6]} />
                  <meshStandardMaterial color="#3e9b55" flatShading />
                </mesh>
              )}
              {l.npk[0]! + l.npk[1]! + l.npk[2]! > 0 && (
                <LayerNutrients h={l.h} counts={l.npk} scale={particleScale} seed={31 + i} />
              )}
            </group>
          </group>
        );
      })}
    </group>
  );
}

// ---------- camera ----------

// The flight circles the fields and keeps them in view, so every season shows the crops.
const FLY_POS = new THREE.CatmullRomCurve3([
  new THREE.Vector3(0, 9, 26),
  new THREE.Vector3(-16, 7, 14),
  new THREE.Vector3(-14, 6, -6),
  new THREE.Vector3(4, 7, -17),
  new THREE.Vector3(18, 9, 2),
]);
const FLY_LOOK = new THREE.CatmullRomCurve3([
  new THREE.Vector3(0, 0, 0),
  new THREE.Vector3(-3, 0, 0),
  new THREE.Vector3(-1, 0, -2),
  new THREE.Vector3(2, 0, -2),
  new THREE.Vector3(1, 0, 0),
]);

function CameraRig({ still }: { still: boolean }) {
  const { camera } = useThree();
  const pos = useMemo(() => new THREE.Vector3(), []);
  const look = useMemo(() => new THREE.Vector3(), []);
  const cur = useRef(new THREE.Vector3(0, 0, 0));
  useFrame(({ clock }) => {
    if (story.scene === 'soil') {
      const a = 0.6 + story.peel * 0.5 + (still ? 0 : Math.sin(clock.elapsedTime * 0.15) * 0.05);
      pos.set(Math.sin(a) * 14, SOIL_Y + 3 - story.peel * 1.2, Math.cos(a) * 14);
      look.set(0, SOIL_Y - 2.4 - story.peel * 1.3, 0);
    } else {
      FLY_POS.getPointAt(Math.min(1, Math.max(0, story.fly)), pos);
      FLY_LOOK.getPointAt(Math.min(1, Math.max(0, story.fly)), look);
      pos.x += story.pointer.x * 0.8;
      pos.y += story.pointer.y * 0.4;
    }
    // Ease towards the target so scroll never jerks the camera; snap when switching scenes or for stills.
    const far = camera.position.distanceTo(pos) > 30;
    const k = still || far ? 1 : 0.08;
    camera.position.lerp(pos, k);
    cur.current.lerp(look, k);
    camera.lookAt(cur.current);
  });
  return null;
}

// ---------- canvas ----------

export interface WorldProps {
  /** Highest quality: depth of field on top of bloom */
  quality: 'high' | 'medium';
  /** Render a frozen frame (for Lite-mode stills) */
  still?: SeasonId | 'soil';
  /** Pause rendering when the canvas is off screen */
  paused?: boolean;
}

export default function World({ quality, still, paused = false }: WorldProps) {
  return (
    <Canvas
      dpr={quality === 'high' ? [1, 1.75] : [1, 1.25]}
      frameloop={paused ? 'never' : 'always'}
      camera={{ fov: 42, near: 0.1, far: 220, position: [0, 8, 24] }}
      gl={{ antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: !!still }}
      aria-hidden="true"
    >
      <SkyAndFog />
      <hemisphereLight args={['#e3eef3', '#5a3a26', 0.9]} />
      <ambientLight intensity={0.2} />
      <Sun />
      <Farm />
      <Rain count={quality === 'high' ? 1400 : 600} />
      <Soil particleScale={quality === 'high' ? 1 : 0.6} />
      <CameraRig still={!!still} />
      <PointerTracker disabled={!!still} />
      {quality === 'high' ? (
        <EffectComposer multisampling={0}>
          <Bloom intensity={0.7} luminanceThreshold={0.85} luminanceSmoothing={0.2} mipmapBlur />
          <DepthOfField focusDistance={0.015} focalLength={0.06} bokehScale={2.2} />
          <Vignette eskil={false} offset={0.2} darkness={0.55} />
        </EffectComposer>
      ) : (
        <EffectComposer multisampling={0}>
          <Bloom intensity={0.7} luminanceThreshold={0.85} luminanceSmoothing={0.2} mipmapBlur />
          <Vignette eskil={false} offset={0.2} darkness={0.55} />
        </EffectComposer>
      )}
    </Canvas>
  );
}

function PointerTracker({ disabled }: { disabled: boolean }) {
  useEffect(() => {
    if (disabled) return;
    const on = (e: PointerEvent) => {
      story.pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
      story.pointer.y = -((e.clientY / window.innerHeight) * 2 - 1);
    };
    window.addEventListener('pointermove', on, { passive: true });
    return () => window.removeEventListener('pointermove', on);
  }, [disabled]);
  return null;
}
