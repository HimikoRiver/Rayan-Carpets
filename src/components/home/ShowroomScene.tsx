"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  Environment,
  Lightformer,
  MeshReflectorMaterial,
  RoundedBox,
} from "@react-three/drei";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

type Position = [number, number, number];

const GOLD = "#C89A2B";
const BACKGROUND = "#130C0E";

function hash(x: number, y: number) {
  const value = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return value - Math.floor(value);
}

function noise(x: number, y: number) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);

  const fx = x - ix;
  const fy = y - iy;

  const u = fx * fx * (3 - 2 * fx);
  const v = fy * fy * (3 - 2 * fy);

  const top = THREE.MathUtils.lerp(
    hash(ix, iy),
    hash(ix + 1, iy),
    u,
  );

  const bottom = THREE.MathUtils.lerp(
    hash(ix, iy + 1),
    hash(ix + 1, iy + 1),
    u,
  );

  return THREE.MathUtils.lerp(top, bottom, v);
}

function fbm(x: number, y: number) {
  let value = 0;
  let amplitude = 0.5;

  for (let i = 0; i < 5; i++) {
    value += noise(x, y) * amplitude;
    x = x * 2.03 + 17.2;
    y = y * 2.03 + 9.4;
    amplitude *= 0.5;
  }

  return value;
}

function createMarbleTexture(floor = false) {
  const size = 768;
  const canvas = document.createElement("canvas");

  canvas.width = size;
  canvas.height = size;

  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Не удалось создать материал мрамора.");
  }

  const image = context.createImageData(size, size);

  const base = floor ? [42, 35, 33] : [ seventy(), 24, 32 ];
  const veinColor = floor ? [143, 123, 96] : [173, 133, 91];

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = (x / size) * 5;
      const v = (y / size) * 5;

      const cloud = fbm(u, v);
      const distortion = fbm(u * 1.8 + 11, v * 1.8 + 7);

      const veinField = Math.abs(
        Math.sin(
          u * 2.8 +
            v * 1.9 +
            cloud * 10 +
            distortion * 4,
        ),
      );

      const fineVein = Math.exp(-veinField * 85);
      const softVein = Math.exp(-veinField * 12) * 0.13;
      const grain = (hash(x, y) - 0.5) * 3;

      const shade = 0.66 + cloud * 0.55;
      const mix = Math.min(0.82, fineVein * 0.7 + softVein);

      const offset = (y * size + x) * 4;

      for (let channel = 0; channel < 3; channel++) {
        image.data[offset + channel] = THREE.MathUtils.lerp(
          base[channel] * shade + grain,
          veinColor[channel],
          mix,
        );
      }

      image.data[offset + 3] = 255;
    }
  }

  context.putImageData(image, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.MirroredRepeatWrapping;
  texture.wrapT = THREE.MirroredRepeatWrapping;
  texture.anisotropy = 8;

  if (floor) {
    texture.repeat.set(5, 5);
  }

  return texture;
}

function seventy() {
  return 70;
}

function StoneBlock({
  position,
  size,
  texture,
}: {
  position: Position;
  size: Position;
  texture: THREE.Texture;
}) {
  return (
    <RoundedBox
      args={size}
      position={position}
      radius={0.035}
      smoothness={3}
      castShadow
      receiveShadow
    >
      <meshPhysicalMaterial
        map={texture}
        roughness={0.32}
        metalness={0}
        clearcoat={0.28}
        clearcoatRoughness={0.25}
        envMapIntensity={0.65}
      />
    </RoundedBox>
  );
}

function Brass({
  position,
  size,
}: {
  position: Position;
  size: Position;
}) {
  return (
    <mesh position={position} castShadow receiveShadow>
      <boxGeometry args={size} />

      <meshStandardMaterial
        color={GOLD}
        metalness={0.88}
        roughness={0.3}
        envMapIntensity={1.1}
      />
    </mesh>
  );
}

function LightStrip({
  position,
  size,
}: {
  position: Position;
  size: Position;
}) {
  return (
    <mesh position={position}>
      <boxGeometry args={size} />

      <meshStandardMaterial
        color="#FFE4B4"
        emissive="#FFD398"
        emissiveIntensity={4}
        toneMapped={false}
      />
    </mesh>
  );
}

function GallerySpot({
  x,
  shadows = false,
}: {
  x: number;
  shadows?: boolean;
}) {
  const target = useMemo(() => {
    const object = new THREE.Object3D();
    object.position.set(x, 2.1, -4.05);
    return object;
  }, [x]);

  return (
    <>
      <primitive object={target} />

      <mesh position={[x, 6.28, -2.76]}>
        <cylinderGeometry args={[0.11, 0.11, 0.08, 24]} />
        <meshStandardMaterial
          color="#1B1511"
          metalness={0.8}
          roughness={0.35}
        />
      </mesh>

      <mesh
        position={[x, 6.23, -2.76]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <circleGeometry args={[0.075, 24]} />
        <meshBasicMaterial color="#FFE4B4" toneMapped={false} />
      </mesh>

      <spotLight
        position={[x, 6.18, -2.7]}
        target={target}
        color="#FFE4BD"
        intensity={55}
        angle={0.55}
        penumbra={0.75}
        distance={12}
        decay={2}
        castShadow={shadows}
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.00015}
        shadow-normalBias={0.025}
      />
    </>
  );
}

function FlutedPanel({ x }: { x: number }) {
  return (
    <group>
      <mesh position={[x, 3.5, -3.2]} receiveShadow>
        <boxGeometry args={[0.9, 7, 0.25]} />
        <meshStandardMaterial
          color="#211611"
          roughness={0.65}
        />
      </mesh>

      {Array.from({ length: 11 }, (_, index) => (
        <mesh
          key={index}
          position={[x - 0.4 + index * 0.08, 3.5, -2.99]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[0.036, 7, 0.16]} />
          <meshStandardMaterial
            color={index % 3 === 0 ? "#745233" : "#39261A"}
            metalness={0.18}
            roughness={0.48}
          />
        </mesh>
      ))}
    </group>
  );
}

function Pedestal({
  x,
  texture,
}: {
  x: number;
  texture: THREE.Texture;
}) {
  return (
    <group position={[x, 0, -2.4]}>
      <StoneBlock
        position={[0, 0.6, 0]}
        size={[0.62, 1.2, 0.62]}
        texture={texture}
      />

      <Brass
        position={[0, 1.205, 0]}
        size={[0.66, 0.025, 0.66]}
      />

      <mesh
        position={[0, 1.71, 0]}
        rotation={[0.12, 0.4, -0.18]}
        scale={[0.29, 0.53, 0.24]}
        castShadow
        receiveShadow
      >
        <icosahedronGeometry args={[1, 1]} />
        <meshStandardMaterial
          color="#A4834C"
          roughness={0.48}
          metalness={0.72}
        />
      </mesh>
    </group>
  );
}

function Room() {
  const wallTexture = useMemo(() => createMarbleTexture(), []);
  const floorTexture = useMemo(() => createMarbleTexture(true), []);

  useEffect(() => {
    return () => {
      wallTexture.dispose();
      floorTexture.dispose();
    };
  }, [wallTexture, floorTexture]);

  return (
    <>
      {/* Световое окружение создаётся внутри сцены, без внешних HDRI. */}
      <Environment resolution={128} frames={1}>
        <Lightformer
          position={[0, 7, 1]}
          rotation={[Math.PI / 2, 0, 0]}
          scale={[12, 9, 1]}
          color="#FFF0D6"
          intensity={2}
        />

        <Lightformer
          position={[7, 3, 0]}
          rotation={[0, -Math.PI / 2, 0]}
          scale={[6, 5, 1]}
          color="#E9BC7F"
          intensity={3}
        />

        <Lightformer
          position={[-7, 4, 4]}
          rotation={[0, Math.PI / 2, 0]}
          scale={[5, 6, 1]}
          color="#E2D9CF"
          intensity={1.2}
        />
      </Environment>

      <ambientLight intensity={0.32} color="#EEDCC7" />

      <pointLight
        position={[-4, 4.5, 3]}
        intensity={55}
        distance={18}
        decay={2}
        color="#FFE7CB"
      />

      <pointLight
        position={[6, 3.5, 2]}
        intensity={45}
        distance={16}
        decay={2}
        color="#FFD59C"
      />

      {/* Задняя стена ниши находится глубже основной стены. */}
      <StoneBlock
        position={[2, 3.25, -4.4]}
        size={[5.4, 6.5, 0.35]}
        texture={wallTexture}
      />

      {/* Основная стена слева и справа от проёма. */}
      <StoneBlock
        position={[-4.85, 4, -3.6]}
        size={[8.3, 8, 0.8]}
        texture={wallTexture}
      />

      <StoneBlock
        position={[6.85, 4, -3.6]}
        size={[4.3, 8, 0.8]}
        texture={wallTexture}
      />

      <StoneBlock
        position={[2, 7.25, -3.6]}
        size={[5.4, 1.5, 0.8]}
        texture={wallTexture}
      />

      {/* Боковые поверхности и потолок ниши. */}
      <StoneBlock
        position={[-0.67, 3.25, -3.65]}
        size={[0.16, 6.5, 1.5]}
        texture={wallTexture}
      />

      <StoneBlock
        position={[4.67, 3.25, -3.65]}
        size={[0.16, 6.5, 1.5]}
        texture={wallTexture}
      />

      <StoneBlock
        position={[2, 6.45, -3.65]}
        size={[5.4, 0.18, 1.5]}
        texture={wallTexture}
      />

      {/* Латунная рама с реальной толщиной. */}
      <Brass position={[-0.8, 3.25, -3.02]} size={[0.09, 6.5, 0.12]} />
      <Brass position={[4.8, 3.25, -3.02]} size={[0.09, 6.5, 0.12]} />
      <Brass position={[2, 6.53, -3.02]} size={[5.7, 0.09, 0.12]} />

      <LightStrip position={[-0.53, 3.2, -4.02]} size={[0.025, 6.1, 0.03]} />
      <LightStrip position={[4.53, 3.2, -4.02]} size={[0.025, 6.1, 0.03]} />

      {/* Подсветка стен рядом со световыми полосами. */}
      {[-0.38, 4.38].map((x) => (
        <pointLight
          key={x}
          position={[x, 3.3, -3.7]}
          intensity={12}
          distance={4}
          decay={2}
          color="#FFD294"
        />
      ))}

      <GallerySpot x={0} shadows />
      <GallerySpot x={1.35} />
      <GallerySpot x={2.7} shadows />
      <GallerySpot x={4} />

      <FlutedPanel x={-1.55} />
      <FlutedPanel x={5.55} />

      <Pedestal x={-2.45} texture={wallTexture} />
      <Pedestal x={6.45} texture={wallTexture} />

      {/* Боковые стены и потолок дают пространственную глубину. */}
      <StoneBlock
        position={[-9, 4, 2]}
        size={[0.4, 8, 12]}
        texture={wallTexture}
      />

      <StoneBlock
        position={[9, 4, 2]}
        size={[0.4, 8, 12]}
        texture={wallTexture}
      />

      <mesh position={[0, 8, 1]}>
        <boxGeometry args={[18, 0.3, 12]} />
        <meshStandardMaterial color="#1C1113" roughness={0.8} />
      </mesh>

      <Brass position={[-4.9, 0.1, -3.13]} size={[8.1, 0.13, 0.09]} />
      <Brass position={[6.9, 0.1, -3.13]} size={[4.1, 0.13, 0.09]} />

      <LightStrip position={[-4.9, 0.035, -3.08]} size={[8.1, 0.025, 0.03]} />
      <LightStrip position={[6.9, 0.035, -3.08]} size={[4.1, 0.025, 0.03]} />

      {/* Пол отражает реальные объекты сцены. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[36, 36]} />

        <MeshReflectorMaterial
          map={floorTexture}
          color="#D4C3B2"
          resolution={512}
          blur={[240, 120]}
          mixBlur={0.85}
          mixStrength={0.65}
          mirror={0.25}
          roughness={0.3}
          metalness={0.12}
          depthScale={0.15}
          minDepthThreshold={0.7}
          maxDepthThreshold={1.3}
        />
      </mesh>
    </>
  );
}

function CameraRig() {
  const { camera, pointer, size } = useThree();
  const reducedMotion = useRef(false);

  const targetPosition = useMemo(() => new THREE.Vector3(), []);
  const lookTarget = useMemo(() => new THREE.Vector3(), []);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");

    const update = () => {
      reducedMotion.current = query.matches;
    };

    update();
    query.addEventListener("change", update);

    return () => query.removeEventListener("change", update);
  }, []);

  useFrame((_, delta) => {
    if (!(camera instanceof THREE.PerspectiveCamera)) return;

    const aspect = size.width / Math.max(size.height, 1);
    const mobile = aspect < 1;

    const centerX = mobile ? 2 : 0;
    const distance = mobile ? Math.max(13, 5.7 / aspect) : 13;

    const movementX = reducedMotion.current ? 0 : pointer.x * 0.16;
    const movementY = reducedMotion.current ? 0 : pointer.y * 0.07;

    targetPosition.set(
      centerX + movementX,
      3.25 + movementY,
      -3 + distance,
    );

    camera.position.lerp(
      targetPosition,
      1 - Math.exp(-Math.min(delta, 0.05) * 3),
    );

    lookTarget.set(centerX, 3.05, -3.5);
    camera.lookAt(lookTarget);
  });

  return null;
}

export default function ShowroomScene() {
  return (
    <main
      aria-label="Трёхмерный выставочный зал AURUM"
      style={{
        width: "100%",
        height: "100svh",
        minHeight: 360,
        overflow: "hidden",
        background: BACKGROUND,
      }}
    >
      <Canvas
        shadows
        dpr={[1, 1.5]}
        camera={{
          position: [0, 3.25, 10],
          fov: 42,
          near: 0.1,
          far: 80,
        }}
        gl={{
          antialias: true,
          alpha: false,
          powerPreference: "high-performance",
        }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.15;
        }}
      >
        <color attach="background" args={[BACKGROUND]} />
        <fog attach="fog" args={[BACKGROUND, 24, 55]} />

        <CameraRig />
        <Room />
      </Canvas>
    </main>
  );
}