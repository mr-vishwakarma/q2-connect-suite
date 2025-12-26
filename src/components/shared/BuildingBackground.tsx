import { useRef, useState, useEffect, Suspense } from 'react';
import { Canvas, useFrame, useThree, useLoader } from '@react-three/fiber';
import { TextureLoader, Mesh, MeshStandardMaterial } from 'three';
import hostelBuilding from '@/assets/hostel-building.jpg';

interface BuildingPlaneProps {
  onAnimationComplete?: () => void;
}

function BuildingPlane({ onAnimationComplete }: BuildingPlaneProps) {
  const meshRef = useRef<Mesh>(null);
  const [animationProgress, setAnimationProgress] = useState(0);
  const [hasCompleted, setHasCompleted] = useState(false);
  const { viewport } = useThree();
  
  const texture = useLoader(TextureLoader, hostelBuilding);
  
  // Calculate aspect ratio from texture
  const imageAspect = texture.image ? texture.image.width / texture.image.height : 16/9;
  const planeHeight = Math.min(viewport.height * 0.75, 8);
  const planeWidth = planeHeight * imageAspect;
  
  // Starting position (above viewport)
  const startY = viewport.height + 5;
  const endY = 0;
  
  useFrame((state, delta) => {
    if (!meshRef.current) return;
    
    if (animationProgress < 1) {
      // Smooth easing for gravity-like fall with slow-down at end
      const newProgress = Math.min(animationProgress + delta * 0.4, 1);
      setAnimationProgress(newProgress);
      
      // Easing function for smooth deceleration
      const easeOutCubic = 1 - Math.pow(1 - newProgress, 3);
      const easeOutBounce = (t: number) => {
        if (t < 0.7) return easeOutCubic;
        // Subtle settle effect at the end
        return easeOutCubic + Math.sin((t - 0.7) * Math.PI * 3) * 0.02 * (1 - t);
      };
      
      const currentY = startY + (endY - startY) * easeOutBounce(newProgress);
      meshRef.current.position.y = currentY;
      
      // Slight scale animation during fall
      const scale = 0.9 + 0.1 * easeOutCubic;
      meshRef.current.scale.set(scale, scale, 1);
      
      // Subtle rotation during fall
      meshRef.current.rotation.x = (1 - newProgress) * 0.05;
      
      if (newProgress >= 1 && !hasCompleted) {
        setHasCompleted(true);
        onAnimationComplete?.();
      }
    } else {
      // Subtle breathing animation after settling
      const time = state.clock.getElapsedTime();
      meshRef.current.position.y = endY + Math.sin(time * 0.5) * 0.02;
    }
  });

  return (
    <mesh ref={meshRef} position={[0, startY, 0]}>
      <planeGeometry args={[planeWidth, planeHeight]} />
      <meshStandardMaterial 
        map={texture} 
        transparent
        opacity={0.85}
        emissive="#1e3a5f"
        emissiveIntensity={0.1}
      />
    </mesh>
  );
}

function Lighting() {
  return (
    <>
      {/* Soft ambient light */}
      <ambientLight intensity={0.6} color="#e0e8f0" />
      
      {/* Main directional light for depth */}
      <directionalLight 
        position={[5, 8, 5]} 
        intensity={0.8} 
        color="#ffffff"
        castShadow
      />
      
      {/* Subtle blue accent light from below */}
      <pointLight 
        position={[0, -3, 3]} 
        intensity={0.4} 
        color="#3b82f6" 
        distance={15}
      />
      
      {/* Warm highlight from top */}
      <pointLight 
        position={[0, 5, 2]} 
        intensity={0.3} 
        color="#f0f4ff"
        distance={12}
      />
    </>
  );
}

function GlowEffect() {
  const meshRef = useRef<Mesh>(null);
  
  useFrame((state) => {
    if (!meshRef.current) return;
    const time = state.clock.getElapsedTime();
    // Subtle pulsing glow
    const material = meshRef.current.material as MeshStandardMaterial;
    material.opacity = 0.15 + Math.sin(time * 0.8) * 0.05;
  });

  return (
    <mesh ref={meshRef} position={[0, 0, -0.5]}>
      <planeGeometry args={[12, 10]} />
      <meshStandardMaterial 
        color="#2563eb"
        transparent
        opacity={0.15}
        emissive="#2563eb"
        emissiveIntensity={0.3}
      />
    </mesh>
  );
}

interface BuildingBackgroundProps {
  showOnHome?: boolean;
}

export function BuildingBackground({ showOnHome = false }: BuildingBackgroundProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  
  if (!showOnHome) return null;
  
  return (
    <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
      {/* Subtle gradient overlay for text readability */}
      <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-transparent to-background/60 z-10" />
      
      {/* Three.js Canvas */}
      <Canvas
        camera={{ position: [0, 0, 10], fov: 50 }}
        className="w-full h-full"
        gl={{ antialias: true, alpha: true }}
        style={{ background: 'transparent' }}
      >
        <Suspense fallback={null}>
          <Lighting />
          <GlowEffect />
          <BuildingPlane onAnimationComplete={() => setIsLoaded(true)} />
        </Suspense>
      </Canvas>
      
      {/* Shadow effect at bottom */}
      <div 
        className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[60%] h-32 z-5"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(0,0,0,0.4) 0%, transparent 70%)',
          filter: 'blur(20px)',
        }}
      />
    </div>
  );
}
