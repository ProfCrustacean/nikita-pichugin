import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Group } from "three";

interface HeroStageProps {
  images: string[];
}

interface StageMark {
  color: string;
  opacity: number;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: number;
}

function ArtworkFragments({ images }: HeroStageProps) {
  const group = useRef<Group>(null);
  const marks = useMemo<StageMark[]>(
    () => [
      { color: "#ff1f32", opacity: 0.34, position: [-3.2, -1.25, -0.8], rotation: [-0.05, 0.14, -0.22], scale: 2.6 },
      { color: "#ff1f32", opacity: 0.28, position: [-1.2, 0.95, -0.4], rotation: [0.08, -0.18, 0.28], scale: 1.8 },
      { color: "#ff1f32", opacity: 0.22, position: [1.3, -0.9, -0.7], rotation: [-0.08, 0.24, -0.22], scale: 2.1 },
      { color: "#ff1f32", opacity: 0.2, position: [3.1, 0.55, -0.6], rotation: [0.04, -0.16, 0.28], scale: 1.4 }
    ],
    []
  );
  const imageWeight = Math.max(images.length, 1);

  useFrame(({ clock, pointer }) => {
    if (!group.current) return;
    group.current.rotation.y = pointer.x * 0.045 + Math.sin(clock.elapsedTime * 0.18) * 0.018;
    group.current.rotation.x = -pointer.y * 0.025 + Math.sin(clock.elapsedTime * 0.14) * 0.012;
  });

  return (
    <group ref={group}>
      {marks.map((mark, index) => (
        <mesh key={`${mark.color}-${index}`} position={mark.position} rotation={mark.rotation}>
          <planeGeometry args={[2.2 * mark.scale, 0.045, 1, 1]} />
          <meshBasicMaterial color={mark.color} transparent opacity={mark.opacity + imageWeight * 0.012} />
        </mesh>
      ))}
      <mesh rotation={[0.22, 0.1, -0.18]} position={[0.1, -0.14, 0.2]}>
        <torusGeometry args={[2.25, 0.012, 8, 140]} />
        <meshBasicMaterial color="#ff1f32" transparent opacity={0.2} />
      </mesh>
      <mesh rotation={[0.62, -0.12, 0.48]} position={[0.0, 0.08, 0.3]}>
        <torusGeometry args={[2.82, 0.018, 8, 150]} />
        <meshBasicMaterial color="#ff1f32" transparent opacity={0.22} />
      </mesh>
      <mesh rotation={[-0.28, 0.1, 1.1]} position={[0.0, 0.08, 0.4]}>
        <torusGeometry args={[3.2, 0.008, 8, 150]} />
        <meshBasicMaterial color="#ff1f32" transparent opacity={0.18} />
      </mesh>
    </group>
  );
}

function useReducedMotion() {
  const [prefersReduced, setPrefersReduced] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setPrefersReduced(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  return prefersReduced;
}

export default function HeroStage({ images }: HeroStageProps) {
  const prefersReducedMotion = useReducedMotion();

  if (prefersReducedMotion) return null;

  return (
    <Canvas camera={{ position: [0, 0, 6.6], fov: 45 }} dpr={[1, 1.5]} gl={{ alpha: true, antialias: true }}>
      <color attach="background" args={["#030303"]} />
      <ArtworkFragments images={images} />
    </Canvas>
  );
}
