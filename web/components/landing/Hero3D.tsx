"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, type ThreeElements } from "@react-three/fiber";
import * as THREE from "three";

/**
 * WebGL hero: a slowly rotating constellation of agent nodes with light beams
 * flowing into a central SIGNA core, traveling pulses along each beam, and
 * mouse parallax. Brand colors (electric blue → violet on near-black).
 *
 * Degrades gracefully: prefers-reduced-motion or no-WebGL renders a static
 * gradient glow instead. Client-only (imported with ssr:false). Perf-capped
 * (dpr ceiling, ~9 nodes) so it stays light on mobile.
 */

const ORIGIN = new THREE.Vector3(0, 0, 0);
const NODE_COLORS = ["#5b8def", "#8b5cf6", "#22d3ee", "#34d399", "#fbbf24", "#fb7185", "#a78bfa", "#60a5fa", "#e879f9"];

/** Fibonacci sphere — evenly distributed points for the node ring. */
function fibonacciNodes(n: number, radius: number): THREE.Vector3[] {
  const pts: THREE.Vector3[] = [];
  const phi = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / (n - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    const theta = phi * i;
    pts.push(new THREE.Vector3(Math.cos(theta) * r * radius, y * radius * 0.78, Math.sin(theta) * r * radius));
  }
  return pts;
}

function Beam({ from, color, phase }: { from: THREE.Vector3; color: string; phase: number }) {
  const pulse = useRef<THREE.Mesh>(null);
  const positions = useMemo(() => new Float32Array([from.x, from.y, from.z, 0, 0, 0]), [from]);
  useFrame((state) => {
    if (!pulse.current) return;
    const t = (state.clock.elapsedTime * 0.32 + phase) % 1;
    pulse.current.position.lerpVectors(from, ORIGIN, t);
    const mat = pulse.current.material as THREE.MeshBasicMaterial;
    mat.opacity = Math.sin(t * Math.PI) * 0.9;
    const s = 0.04 + Math.sin(t * Math.PI) * 0.05;
    pulse.current.scale.setScalar(s);
  });
  return (
    <group>
      <line>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        </bufferGeometry>
        <lineBasicMaterial color={color} transparent opacity={0.22} />
      </line>
      <mesh ref={pulse}>
        <sphereGeometry args={[1, 12, 12]} />
        <meshBasicMaterial color={color} transparent toneMapped={false} />
      </mesh>
    </group>
  );
}

function Node({ pos, color }: { pos: THREE.Vector3; color: string }) {
  const ref = useRef<THREE.Mesh>(null);
  const seed = useMemo(() => Math.random() * 6, []);
  useFrame((state) => {
    if (!ref.current) return;
    const m = ref.current.material as THREE.MeshStandardMaterial;
    m.emissiveIntensity = 1.4 + Math.sin(state.clock.elapsedTime * 1.6 + seed) * 0.6;
  });
  return (
    <mesh ref={ref} position={pos}>
      <sphereGeometry args={[0.085, 18, 18]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.6} toneMapped={false} />
    </mesh>
  );
}

function Core() {
  const ring = useRef<THREE.Mesh>(null);
  const ico = useRef<THREE.Mesh>(null);
  useFrame((state, dt) => {
    if (ico.current) ico.current.rotation.y += dt * 0.4;
    if (ring.current) {
      const s = 1 + Math.sin(state.clock.elapsedTime * 1.4) * 0.12;
      ring.current.scale.setScalar(s);
      (ring.current.material as THREE.MeshBasicMaterial).opacity = 0.18 + Math.sin(state.clock.elapsedTime * 1.4) * 0.1;
    }
  });
  return (
    <group>
      <mesh ref={ico}>
        <icosahedronGeometry args={[0.5, 1]} />
        <meshStandardMaterial color="#5b8def" emissive="#6f7bff" emissiveIntensity={1.3} metalness={0.4} roughness={0.25} toneMapped={false} />
      </mesh>
      <mesh ref={ring}>
        <sphereGeometry args={[0.78, 24, 24]} />
        <meshBasicMaterial color="#8b5cf6" transparent opacity={0.2} side={THREE.BackSide} toneMapped={false} />
      </mesh>
      <pointLight position={[0, 0, 0]} color="#7c9cff" intensity={8} distance={9} />
    </group>
  );
}

function Constellation() {
  const group = useRef<THREE.Group>(null);
  const nodes = useMemo(() => fibonacciNodes(9, 3.1), []);
  useFrame((state, dt) => {
    const g = group.current;
    if (!g) return;
    g.rotation.y += dt * 0.1;
    const tiltX = state.pointer.y * 0.25;
    const tiltZ = state.pointer.x * 0.12;
    g.rotation.x += (tiltX - g.rotation.x) * 0.04;
    g.rotation.z += (tiltZ - g.rotation.z) * 0.04;
  });
  return (
    <group ref={group}>
      <Core />
      {nodes.map((p, i) => (
        <Node key={`n${i}`} pos={p} color={NODE_COLORS[i % NODE_COLORS.length]} />
      ))}
      {nodes.map((p, i) => (
        <Beam key={`b${i}`} from={p} color={NODE_COLORS[i % NODE_COLORS.length]} phase={(i / nodes.length) * 1} />
      ))}
    </group>
  );
}

/** Static brand glow — the fallback for reduced-motion / no-WebGL. */
export function HeroGlow() {
  return (
    <div aria-hidden className="absolute inset-0 pointer-events-none overflow-hidden">
      <div
        className="absolute top-[-10%] right-[-5%] w-[60vw] h-[60vw] rounded-full blur-[140px] opacity-40"
        style={{ background: "radial-gradient(circle, rgba(91,141,239,0.5), transparent 70%)" }}
      />
      <div
        className="absolute bottom-[-20%] left-[-10%] w-[55vw] h-[55vw] rounded-full blur-[150px] opacity-30"
        style={{ background: "radial-gradient(circle, rgba(139,92,246,0.45), transparent 70%)" }}
      />
    </div>
  );
}

export function Hero3D() {
  const [mode, setMode] = useState<"loading" | "3d" | "flat">("loading");

  useEffect(() => {
    let webgl = false;
    try {
      const c = document.createElement("canvas");
      webgl = !!(c.getContext("webgl2") || c.getContext("webgl"));
    } catch {
      webgl = false;
    }
    const reduced = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    setMode(webgl && !reduced ? "3d" : "flat");
  }, []);

  if (mode !== "3d") return <HeroGlow />;

  return (
    <div aria-hidden className="absolute inset-0">
      <HeroGlow />
      <Canvas
        className="!absolute inset-0"
        camera={{ position: [0, 0, 9], fov: 45 }}
        dpr={[1, 1.75]}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      >
        <ambientLight intensity={0.5} />
        <Constellation />
      </Canvas>
    </div>
  );
}

// quiet an unused-type import in some TS configs
export type _R3F = ThreeElements;
