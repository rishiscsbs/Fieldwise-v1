// Optional 3D view of crop suitability scores: one bar per crop, the chosen crop in the accent colour.
// Drag (or use the arrow keys) to turn it. Decorative extra; the 2D chart and its table carry the same data.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export interface Bar3D {
  id: string;
  label: string;
  emoji: string;
  score: number;
  active: boolean;
}

const css = (name: string, fallback: string) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;

/** A small text sprite (emoji + score) floating above a bar. */
function useLabelTexture(text: string, color: string) {
  return useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 128;
    const ctx = c.getContext('2d')!;
    ctx.font = '600 64px Mukta, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = color;
    ctx.fillText(text, 128, 64);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, [text, color]);
}

function Bar({ bar, x, onHover }: { bar: Bar3D; x: number; onHover: (b: Bar3D | null) => void }) {
  const mesh = useRef<THREE.Mesh>(null);
  const target = (bar.score / 100) * 5;
  const ink = css('--text', '#1d1a16');
  const tex = useLabelTexture(`${bar.emoji} ${bar.score}`, ink);
  const color = bar.active ? css('--accent', '#d9a21b') : css('--series-1', '#3e9b55');
  useFrame(() => {
    const m = mesh.current;
    if (!m) return;
    // Bars grow in from the ground on first show.
    m.scale.y += (Math.max(0.01, target) - m.scale.y) * 0.08;
    m.position.y = m.scale.y / 2;
  });
  return (
    <group position={[x, 0, 0]}>
      <mesh
        ref={mesh}
        scale={[1, 0.01, 1]}
        onPointerOver={(e) => {
          e.stopPropagation();
          onHover(bar);
        }}
        onPointerOut={() => onHover(null)}
      >
        <boxGeometry args={[0.8, 1, 0.8]} />
        <meshStandardMaterial color={color} flatShading />
      </mesh>
      <sprite position={[0, target + 0.6, 0]} scale={[1.6, 0.8, 1]}>
        <spriteMaterial map={tex} transparent depthWrite={false} />
      </sprite>
    </group>
  );
}

function Controls({ keyTurn }: { keyTurn: React.MutableRefObject<number> }) {
  const { camera, gl } = useThree();
  const controls = useMemo(() => {
    const c = new OrbitControls(camera, gl.domElement);
    c.enableDamping = true;
    c.enablePan = false;
    c.minDistance = 8;
    c.maxDistance = 22;
    c.maxPolarAngle = Math.PI / 2.1;
    c.target.set(0, 1.5, 0);
    return c;
  }, [camera, gl]);
  useEffect(() => () => controls.dispose(), [controls]);
  useFrame(() => {
    if (keyTurn.current) {
      // Arrow keys turn the view around its centre.
      const off = camera.position.clone().sub(controls.target);
      off.applyAxisAngle(new THREE.Vector3(0, 1, 0), keyTurn.current);
      camera.position.copy(controls.target).add(off);
      keyTurn.current = 0;
    }
    controls.update();
  });
  return null;
}

export default function Suitability3D({ bars, hint }: { bars: Bar3D[]; hint: string }) {
  const [hover, setHover] = useState<Bar3D | null>(null);
  const keyTurn = useRef(0);
  const n = bars.length;
  return (
    <div
      className="relative h-80 cursor-grab touch-none rounded-md bg-surface-2 outline-none focus-visible:ring-2 focus-visible:ring-focus active:cursor-grabbing"
      tabIndex={0}
      aria-label={hint}
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft') keyTurn.current = 0.2;
        if (e.key === 'ArrowRight') keyTurn.current = -0.2;
      }}
    >
      <Canvas dpr={[1, 1.75]} camera={{ position: [4, 4.5, 9], fov: 45 }} aria-hidden="true">
        <hemisphereLight args={['#ffffff', '#8a5a3b', 1]} />
        <directionalLight position={[5, 10, 6]} intensity={1.2} />
        <mesh rotation-x={-Math.PI / 2} position={[0, -0.01, 0]}>
          <planeGeometry args={[n * 1.2 + 2, 4]} />
          <meshStandardMaterial color={css('--surface', '#ffffff')} />
        </mesh>
        {bars.map((b, i) => (
          <Bar key={b.id} bar={b} x={(i - (n - 1) / 2) * 1.2} onHover={setHover} />
        ))}
        <Controls keyTurn={keyTurn} />
      </Canvas>
      {hover && (
        <div className="pointer-events-none absolute left-3 top-3 rounded-md border border-line bg-surface px-3 py-2 text-sm shadow-2">
          <b className="num">{hover.score}</b> <span className="text-fg-muted">{hover.label}</span>
        </div>
      )}
      <p className="absolute bottom-2 left-3 right-3 text-xs text-fg-muted">{hint}</p>
    </div>
  );
}
