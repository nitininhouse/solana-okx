// App.tsx
import React, { useRef, useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";
import { Box, Flex, Heading } from "@radix-ui/themes";
import { ConnectButton } from "@mysten/dapp-kit";
import { OrganisationProfile } from "./createorg";
import { CreateClaim } from "./createclaim";
import { ClaimsList } from "./Claims";
import { OrganizationDirectory } from "./allorg";
import { LendRequestPage } from "./lendreq";
import * as THREE from 'three';

function Navbar() {
  return (
    <Flex
      position="sticky"
      px="4"
      py="2"
      justify="between"
      align="center"
      style={{
        borderBottom: "1px solid var(--gray-a2)",
        backgroundColor: "var(--color-background)",
        zIndex: 1000
      }}
    >
      <Box>
        <Heading>ZK Carbon</Heading>
      </Box>
      <Flex gap="3" align="center">
        <LinkButton to="/organisation">My Organization</LinkButton>
        <LinkButton to="/create-claim">Create Claim</LinkButton>
        <LinkButton to="/claims">Claims</LinkButton>
        <LinkButton to="/organisations">Organisations</LinkButton>
        <LinkButton to="/lend_request">Lend Request</LinkButton>
        <ConnectButton />
      </Flex>
    </Flex>
  );
}

function LinkButton({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link to={to}>
      <button
        style={{
          padding: "8px 12px",
          borderRadius: "4px",
          background: "var(--gray-3)",
          border: "none",
          cursor: "pointer"
        }}
      >
        {children}
      </button>
    </Link>
  );
}

function LandingPage() {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<any>(null);
  const animationRef = useRef<number | null>(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (!mountRef.current) return;

    // Scene setup
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x000000, 0);
    mountRef.current.appendChild(renderer.domElement);

    // Create floating spheres with slower movement
    const spheres: any[] = [];
    const sphereGeometry = new THREE.SphereGeometry(0.3, 32, 32);
    
    for (let i = 0; i < 12; i++) {
      const material = new THREE.MeshPhongMaterial({
        color: new THREE.Color().setHSL(0.3 + Math.random() * 0.1, 0.7, 0.5),
        transparent: true,
        opacity: 0.6
      });
      
      const sphere = new THREE.Mesh(sphereGeometry, material);
      sphere.position.set(
        (Math.random() - 0.5) * 15,
        (Math.random() - 0.5) * 15,
        (Math.random() - 0.5) * 15
      );
      
      spheres.push({
        mesh: sphere,
        originalPosition: sphere.position.clone(),
        speed: Math.random() * 0.005 + 0.002 // Much slower speed
      });
      
      scene.add(sphere);
    }

    // Lighting
    const ambientLight = new THREE.AmbientLight(0x404040, 0.4);
    scene.add(ambientLight);
    
    const pointLight = new THREE.PointLight(0x00ff88, 0.8, 100);
    pointLight.position.set(10, 10, 10);
    scene.add(pointLight);

    camera.position.z = 8;
    sceneRef.current = { scene, camera, renderer, spheres };

    // Animation loop
    const animate = () => {
      animationRef.current = requestAnimationFrame(animate);
      
      spheres.forEach((sphereObj, index) => {
        const time = Date.now() * sphereObj.speed;
        sphereObj.mesh.position.y = sphereObj.originalPosition.y + Math.sin(time + index) * 1;
        sphereObj.mesh.rotation.x += 0.003; // Slower rotation
        sphereObj.mesh.rotation.y += 0.003;
      });

      // Mouse interaction - slower and smoother
      camera.position.x += (mousePosition.x * 0.2 - camera.position.x) * 0.02;
      camera.position.y += (-mousePosition.y * 0.2 - camera.position.y) * 0.02;
      camera.lookAt(scene.position);

      renderer.render(scene, camera);
    };

    animate();

    // Handle resize
    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      if (mountRef.current && renderer.domElement) {
        mountRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [mousePosition]);

  const handleMouseMove = (e: React.MouseEvent) => {
    setMousePosition({
      x: (e.clientX / window.innerWidth) * 2 - 1,
      y: -(e.clientY / window.innerHeight) * 2 + 1
    });
  };

  return (
    <div style={{ position: 'relative', minHeight: '100vh', overflow: 'hidden' }}>
      {/* 3D Background */}
      <div 
        ref={mountRef} 
        style={{ 
          position: 'absolute', 
          top: 0, 
          left: 0, 
          right: 0, 
          bottom: 0, 
          zIndex: 0,
          background: 'linear-gradient(135deg, #0f172a 0%, #064e3b 50%, #000000 100%)'
        }}
        onMouseMove={handleMouseMove}
      />
      
      {/* Gradient Overlay */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.7) 100%)',
        zIndex: 1
      }} />
      
      {/* Main Content */}
      <div style={{ 
        position: 'relative', 
        zIndex: 2, 
        minHeight: '100vh', 
        display: 'flex', 
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
        textAlign: 'center'
      }}>
        {/* Hero Section */}
        <div style={{ maxWidth: '800px', marginBottom: '3rem' }}>
          <h1 style={{
            fontSize: 'clamp(3rem, 8vw, 6rem)',
            fontWeight: 'bold',
            background: 'linear-gradient(135deg, #10b981, #34d399, #6ee7b7)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            marginBottom: '1rem',
            lineHeight: '1.1'
          }}>
            ZK 
          </h1>
          <h2 style={{
            fontSize: 'clamp(2rem, 5vw, 4rem)',
            fontWeight: '300',
            color: 'rgba(255, 255, 255, 0.9)',
            marginTop: '-1rem',
            marginBottom: '2rem'
          }}>
            CARBON
          </h2>
          
          <p style={{
            fontSize: 'clamp(1.1rem, 2.5vw, 1.5rem)',
            color: 'rgba(187, 247, 208, 0.8)',
            marginBottom: '3rem',
            lineHeight: '1.6',
            maxWidth: '600px',
            margin: '0 auto 3rem auto'
          }}>
            The future of carbon trading is here. Track, verify, and trade carbon credits 
            on a secure, transparent blockchain platform.
          </p>
          
          {/* CTA Buttons */}
          <div style={{ 
            display: 'flex', 
            gap: '1.5rem', 
            justifyContent: 'center', 
            flexWrap: 'wrap',
            marginBottom: '4rem'
          }}>
            <Link to="/create-claim">
              <button style={{
                padding: '1rem 2rem',
                background: 'linear-gradient(135deg, #10b981, #059669)',
                border: 'none',
                borderRadius: '9999px',
                color: 'white',
                fontSize: '1.1rem',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                boxShadow: '0 4px 20px rgba(16, 185, 129, 0.3)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.05)';
                e.currentTarget.style.boxShadow = '0 8px 30px rgba(16, 185, 129, 0.4)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.boxShadow = '0 4px 20px rgba(16, 185, 129, 0.3)';
              }}>
                Start Trading
              </button>
            </Link>
            
            <Link to="/organisations">
              <button style={{
                padding: '1rem 2rem',
                background: 'rgba(255, 255, 255, 0.1)',
                border: '2px solid rgba(16, 185, 129, 0.5)',
                borderRadius: '9999px',
                color: '#6ee7b7',
                fontSize: '1.1rem',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                backdropFilter: 'blur(10px)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(16, 185, 129, 0.1)';
                e.currentTarget.style.borderColor = '#10b981';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                e.currentTarget.style.borderColor = 'rgba(16, 185, 129, 0.5)';
              }}>
                Explore Organizations
              </button>
            </Link>
          </div>
        </div>
        
        {/* Stats */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
          gap: '2rem',
          width: '100%',
          maxWidth: '800px'
        }}>
          <div style={{
            background: 'rgba(255, 255, 255, 0.1)',
            borderRadius: '1rem',
            padding: '1.5rem',
            border: '1px solid rgba(16, 185, 129, 0.2)',
            backdropFilter: 'blur(10px)'
          }}>
            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#10b981', marginBottom: '0.5rem' }}>
              1.2M+
            </div>
            <div style={{ color: 'rgba(187, 247, 208, 0.7)' }}>
              Carbon Credits Traded
            </div>
          </div>
          
          <div style={{
            background: 'rgba(255, 255, 255, 0.1)',
            borderRadius: '1rem',
            padding: '1.5rem',
            border: '1px solid rgba(16, 185, 129, 0.2)',
            backdropFilter: 'blur(10px)'
          }}>
            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#10b981', marginBottom: '0.5rem' }}>
              500+
            </div>
            <div style={{ color: 'rgba(187, 247, 208, 0.7)' }}>
              Verified Organizations
            </div>
          </div>
          
          <div style={{
            background: 'rgba(255, 255, 255, 0.1)',
            borderRadius: '1rem',
            padding: '1.5rem',
            border: '1px solid rgba(16, 185, 129, 0.2)',
            backdropFilter: 'blur(10px)'
          }}>
            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#10b981', marginBottom: '0.5rem' }}>
              99.9%
            </div>
            <div style={{ color: 'rgba(187, 247, 208, 0.7)' }}>
              Transaction Security
            </div>
          </div>
        </div>
      </div>
      
      {/* Floating particles effect */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none', zIndex: 1 }}>
        {[...Array(15)].map((_, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              width: '4px',
              height: '4px',
              background: 'rgba(16, 185, 129, 0.3)',
              borderRadius: '50%',
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animation: `pulse ${3 + Math.random() * 2}s infinite`,
              animationDelay: `${Math.random() * 3}s`
            }}
          />
        ))}
      </div>
      
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.3; transform: scale(1); }
          50% { opacity: 0.8; transform: scale(1.2); }
        }
      `}</style>
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <Navbar />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/organisation" element={<OrganisationProfile />} />
        <Route path="/create-claim" element={<CreateClaim />} />
        <Route path="/claims" element={<ClaimsList />} />
        <Route path="/organisations" element={<OrganizationDirectory />} />
        <Route path="/lend_request" element={<LendRequestPage />} />
      </Routes>
    </Router>
  );
}