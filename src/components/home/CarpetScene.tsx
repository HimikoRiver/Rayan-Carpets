"use client";

import {
  Canvas,
  useFrame,
  useLoader,
  useThree,
} from "@react-three/fiber";
import {
  Suspense,
  useEffect,
  useMemo,
  useRef,
  type RefObject,
} from "react";
import * as THREE from "three";

const TEXTURES = [
  "/images/home/carpet-garnet.webp",
  "/images/home/carpet-02.webp",
  "/images/home/carpet-03.webp",
];

const BACKGROUND_URL = "/images/home/room-background.webp";

const LENGTH = 7.5;
const SEGMENTS = 560;
const THICKNESS = 0.026;
const FLOOR_Y = 0.04;

const OPEN_DURATION = 1.5;
const HOLD_DURATION = 0.55;
const CLOSE_DURATION = 1.3;
const CHANGE_DURATION = 0.25;

const SCENE_DURATION =
  OPEN_DURATION +
  HOLD_DURATION +
  CLOSE_DURATION +
  CHANGE_DURATION;

const TOTAL_DURATION =
  SCENE_DURATION * (TEXTURES.length - 1) +
  OPEN_DURATION +
  HOLD_DURATION;

function getTextureWidth(texture: THREE.Texture) {
  const image = texture.image as {
    width?: number;
    height?: number;
  };

  const width = image.width || 1024;
  const height = image.height || 1536;

  // Сохраняем исходное соотношение сторон изображения.
  return LENGTH * (width / height);
}

function updateGeometry(
  geometry: THREE.BufferGeometry,
  width: number,
  progress: number,
) {
  const flatLength = LENGTH * progress;
  const remaining = LENGTH - flatLength;

  const coreRadius =
    0.11 * THREE.MathUtils.smoothstep(remaining, 0, 0.65);

  const spiralStep = THICKNESS / (Math.PI * 2);

  const outerRadius = Math.sqrt(
    coreRadius * coreRadius + 2 * spiralStep * remaining,
  );

  const positions = geometry.getAttribute(
    "position",
  ) as THREE.BufferAttribute;

  for (let row = 0; row <= SEGMENTS; row++) {
    const distance = (row / SEGMENTS) * LENGTH;

    let y = FLOOR_Y;
    let z = -LENGTH / 2 + distance;

    if (distance > flatLength && remaining > 0.00001) {
      const rolledDistance = distance - flatLength;

      const radius = Math.sqrt(
        Math.max(
          coreRadius * coreRadius,
          outerRadius * outerRadius -
            2 * spiralStep * rolledDistance,
        ),
      );

      const angle = (outerRadius - radius) / spiralStep;

      y =
        FLOOR_Y +
        outerRadius -
        radius * Math.cos(angle);

      z =
        -LENGTH / 2 +
        flatLength +
        radius * Math.sin(angle);
    }

    for (let side = 0; side < 2; side++) {
      positions.setXYZ(
        row * 2 + side,
        (side - 0.5) * width,
        y,
        z,
      );
    }
  }

  positions.needsUpdate = true;
  geometry.computeVertexNormals();
}

function createGeometry() {
  const positions = new Float32Array((SEGMENTS + 1) * 6);
  const uvs = new Float32Array((SEGMENTS + 1) * 4);
  const indices: number[] = [];

  for (let row = 0; row <= SEGMENTS; row++) {
    const progress = row / SEGMENTS;

    for (let side = 0; side < 2; side++) {
      const vertex = row * 2 + side;

      uvs[vertex * 2] = side;
      uvs[vertex * 2 + 1] = 1 - progress;
    }

    if (row < SEGMENTS) {
      const a = row * 2;
      const b = a + 1;
      const d = a + 2;
      const e = a + 3;

      indices.push(a, d, b, b, d, e);
    }
  }

  const geometry = new THREE.BufferGeometry();

  geometry.setAttribute(
    "position",
    new THREE.BufferAttribute(positions, 3).setUsage(
      THREE.DynamicDrawUsage,
    ),
  );

  geometry.setAttribute(
    "uv",
    new THREE.BufferAttribute(uvs, 2),
  );

  geometry.setIndex(indices);
  updateGeometry(geometry, 5, 0);

  return geometry;
}

function CameraRig({ width }: { width: number }) {
  const { camera, size } = useThree();

  useEffect(() => {
    if (!(camera instanceof THREE.PerspectiveCamera)) {
      return;
    }

    const screenWidth = Math.max(size.width, 1);
    const screenHeight = Math.max(size.height, 1);

    camera.aspect = screenWidth / screenHeight;
    camera.fov = 38;
    camera.clearViewOffset();

    const direction = new THREE.Vector3(0, 8, 10).normalize();

    // Проверяем габариты раскрытого полотна и рулона.
    const points: THREE.Vector3[] = [];

    for (const x of [-width / 2, width / 2]) {
      for (const z of [-LENGTH / 2 - 0.4, LENGTH / 2 + 0.2]) {
        for (const y of [0, 0.6]) {
          points.push(new THREE.Vector3(x, y, z));
        }
      }
    }

    const projected = new THREE.Vector3();

    const measure = (distance: number) => {
      camera.position.copy(direction).multiplyScalar(distance);
      camera.lookAt(0, 0, 0);
      camera.updateProjectionMatrix();
      camera.updateMatrixWorld(true);

      let minX = Infinity;
      let maxX = -Infinity;
      let minY = Infinity;
      let maxY = -Infinity;

      for (const point of points) {
        projected.copy(point).project(camera);

        minX = Math.min(minX, projected.x);
        maxX = Math.max(maxX, projected.x);
        minY = Math.min(minY, projected.y);
        maxY = Math.max(maxY, projected.y);
      }

      return { minX, maxX, minY, maxY };
    };

    let nearDistance = 7;
    let farDistance = 80;

    // Подбираем масштаб без изменения пропорций ковра.
    for (let i = 0; i < 32; i++) {
      const distance = (nearDistance + farDistance) / 2;
      const bounds = measure(distance);

      const fits =
        bounds.maxX - bounds.minX <= 1.65 &&
        bounds.maxY - bounds.minY <= 1.08;

      if (fits) {
        farDistance = distance;
      } else {
        nearDistance = distance;
      }
    }

    const bounds = measure(farDistance);

    const currentCenterY = (bounds.minY + bounds.maxY) / 2;

    // Ковёр расположен на полу, в нижней части комнаты.
    const desiredCenterY = -0.32;

    const offsetY =
      ((desiredCenterY - currentCenterY) * screenHeight) / 2;

    camera.setViewOffset(
      screenWidth,
      screenHeight,
      0,
      offsetY,
      screenWidth,
      screenHeight,
    );

    camera.updateProjectionMatrix();
  }, [camera, size.width, size.height, width]);

  return null;
}

function CarpetSequence({
  targetProgress,
}: {
  targetProgress: RefObject<number>;
}) {
  const textures = useLoader(THREE.TextureLoader, TEXTURES);
  const gl = useThree((state) => state.gl);

  const material = useRef<THREE.MeshStandardMaterial>(null);

  const currentTime = useRef(0);
  const previousIndex = useRef(-1);
  const previousProgress = useRef(-1);

  const geometry = useMemo(createGeometry, []);

  const widths = useMemo(
    () => textures.map(getTextureWidth),
    [textures],
  );

  const maximumWidth = Math.max(...widths);

  useEffect(() => {
    const anisotropy = Math.min(
      16,
      gl.capabilities.getMaxAnisotropy(),
    );

    for (const texture of textures) {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.wrapS = THREE.ClampToEdgeWrapping;
      texture.wrapT = THREE.ClampToEdgeWrapping;
      texture.minFilter = THREE.LinearMipmapLinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.anisotropy = anisotropy;
      texture.needsUpdate = true;
    }
  }, [textures, gl]);

  useEffect(() => {
    return () => {
      geometry.dispose();
    };
  }, [geometry]);

  useFrame((_, delta) => {
    const targetTime = targetProgress.current * TOTAL_DURATION;

    currentTime.current = THREE.MathUtils.damp(
      currentTime.current,
      targetTime,
      8,
      Math.min(delta, 0.05),
    );

    if (Math.abs(currentTime.current - targetTime) < 0.00001) {
      currentTime.current = targetTime;
    }

    const time = currentTime.current;

    const index = Math.min(
      textures.length - 1,
      Math.floor(time / SCENE_DURATION),
    );

    const localTime = time - index * SCENE_DURATION;
    const isLast = index === textures.length - 1;

    let progress = THREE.MathUtils.clamp(
      localTime / OPEN_DURATION,
      0,
      1,
    );

    const closeStart = OPEN_DURATION + HOLD_DURATION;
    const closeEnd = closeStart + CLOSE_DURATION;

    if (!isLast && localTime > closeStart) {
      progress =
        1 -
        THREE.MathUtils.clamp(
          (localTime - closeStart) / CLOSE_DURATION,
          0,
          1,
        );
    }

    // Незаметная смена текстуры в свёрнутом состоянии.
    const changing =
      !isLast && localTime >= closeEnd;

    const changeProgress = THREE.MathUtils.clamp(
      (localTime - closeEnd) / CHANGE_DURATION,
      0,
      1,
    );

    const displayIndex =
      changing && changeProgress >= 0.5
        ? index + 1
        : index;

    if (material.current) {
      material.current.opacity = changing
        ? Math.abs(changeProgress * 2 - 1)
        : 1;

      if (previousIndex.current !== displayIndex) {
        material.current.map = textures[displayIndex];
        material.current.needsUpdate = true;
      }
    }

    if (
      previousIndex.current !== displayIndex ||
      previousProgress.current !== progress
    ) {
      updateGeometry(
        geometry,
        widths[displayIndex],
        progress,
      );

      previousIndex.current = displayIndex;
      previousProgress.current = progress;
    }
  });

  return (
    <>
      <CameraRig width={maximumWidth} />

      <mesh
        geometry={geometry}
        castShadow
        receiveShadow
        frustumCulled={false}
      >
        <meshStandardMaterial
          ref={material}
          map={textures[0]}
          color="#ffffff"
          roughness={0.95}
          metalness={0}
          side={THREE.DoubleSide}
          transparent
          opacity={1}
        />
      </mesh>
    </>
  );
}

export default function CarpetScene() {
  const section = useRef<HTMLElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const targetProgress = useRef(0);

  useEffect(() => {
    const updateProgress = () => {
      const element = section.current;
      const screen = viewport.current;

      if (!element || !screen) return;

      const rect = element.getBoundingClientRect();

      const availableScroll =
        element.offsetHeight - screen.clientHeight;

      targetProgress.current =
        availableScroll > 0
          ? THREE.MathUtils.clamp(
              -rect.top / availableScroll,
              0,
              1,
            )
          : 0;
    };

    updateProgress();

    window.addEventListener("scroll", updateProgress, {
      passive: true,
    });

    window.addEventListener("resize", updateProgress);

    const observer = new ResizeObserver(updateProgress);

    if (section.current) {
      observer.observe(section.current);
    }

    if (viewport.current) {
      observer.observe(viewport.current);
    }

    return () => {
      window.removeEventListener("scroll", updateProgress);
      window.removeEventListener("resize", updateProgress);
      observer.disconnect();
    };
  }, []);

  return (
    <section
      ref={section}
      aria-label="Коллекция ковров в интерьере"
      style={{
        position: "relative",
        height: "900svh",
        background: "#160D0F",
      }}
    >
      <div
        ref={viewport}
        style={{
          position: "sticky",
          top: 0,
          height: "100svh",
          overflow: "hidden",
          backgroundColor: "#160D0F",
          backgroundImage: `url("${BACKGROUND_URL}")`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        }}
      >
        <Canvas
          shadows
          dpr={[1, 1.5]}
          camera={{
            position: [0, 8, 10],
            fov: 38,
            near: 0.1,
            far: 150,
          }}
          gl={{
            antialias: true,
            alpha: true,
            powerPreference: "high-performance",
          }}
          onCreated={({ gl }) => {
            gl.setClearColor(0x000000, 0);
          }}
        >
          <ambientLight
            intensity={1.15}
            color="#FFF4E4"
          />

          <directionalLight
            position={[6, 9, -3]}
            intensity={2.4}
            color="#FFE2B5"
            castShadow
            shadow-mapSize={[2048, 2048]}
            shadow-camera-left={-12}
            shadow-camera-right={12}
            shadow-camera-top={12}
            shadow-camera-bottom={-12}
            shadow-camera-near={0.1}
            shadow-camera-far={40}
            shadow-normalBias={0.015}
            shadow-bias={-0.0001}
          />

          <directionalLight
            position={[-4, 5, 6]}
            intensity={0.7}
            color="#FFF6ED"
          />

          <Suspense fallback={null}>
            <CarpetSequence targetProgress={targetProgress} />
          </Suspense>

          <mesh
            rotation={[-Math.PI / 2, 0, 0]}
            position={[0, 0, 0]}
            receiveShadow
          >
            <planeGeometry args={[100, 100]} />

            <shadowMaterial
              transparent
              opacity={0.28}
              depthWrite={false}
            />
          </mesh>
        </Canvas>
      </div>
    </section>
  );
}