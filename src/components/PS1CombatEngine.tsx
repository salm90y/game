import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import confetti from 'canvas-confetti';
import { 
  PS1Button, 
  InputFrame, 
  DisplaySettings, 
  GameMatchState, 
  VehicleState, 
  GameROM 
} from '../types';
import { inputManager } from '../services/ps1InputManager';
import { netplayCoordinator } from '../services/netplayCoordinator';
import { soundFx } from '../services/audioSynthesizer';

interface PS1CombatEngineProps {
  activeRom: GameROM;
  displaySettings: DisplaySettings;
  isPaused: boolean;
  onOpenSettings: () => void;
  onFpsUpdate?: (fps: number) => void;
}

export const PS1CombatEngine: React.FC<PS1CombatEngineProps> = ({
  activeRom,
  displaySettings,
  isPaused,
  onOpenSettings,
  onFpsUpdate
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Game State Ref (Mutable for 60fps lockstep loop)
  const gameStateRef = useRef<GameMatchState>({
    frame: 0,
    gameTime: 0,
    p1: createInitialVehicle(-14, 0, 0, 1),
    p2: createInitialVehicle(14, 0, Math.PI, 2),
    projectiles: [],
    pickups: [
      { id: 'p1', type: 'health', x: 0, z: -15, active: true, respawnTimer: 0 },
      { id: 'p2', type: 'missiles', x: 0, z: 15, active: true, respawnTimer: 0 },
      { id: 'p3', type: 'nitro', x: -18, z: 0, active: true, respawnTimer: 0 },
      { id: 'p4', type: 'shield', x: 18, z: 0, active: true, respawnTimer: 0 },
    ],
    round: 1,
    winner: 0,
    isPaused: false
  });

  const [hudState, setHudState] = useState<{
    p1Health: number;
    p1Shield: number;
    p1Nitro: number;
    p1Missiles: number;
    p1Score: number;
    p2Health: number;
    p2Shield: number;
    p2Nitro: number;
    p2Missiles: number;
    p2Score: number;
    round: number;
    winner: 0 | 1 | 2;
    fps: number;
  }>({
    p1Health: 100,
    p1Shield: 100,
    p1Nitro: 100,
    p1Missiles: 8,
    p1Score: 0,
    p2Health: 100,
    p2Shield: 100,
    p2Nitro: 100,
    p2Missiles: 8,
    p2Score: 0,
    round: 1,
    winner: 0,
    fps: 60,
  });

  // Three.js instances
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const p1MeshRef = useRef<THREE.Group | null>(null);
  const p2MeshRef = useRef<THREE.Group | null>(null);
  const projectileMeshes = useRef<Map<string, THREE.Mesh>>(new Map());
  const pickupMeshes = useRef<Map<string, THREE.Group>>(new Map());
  const particleSystem = useRef<THREE.Points | null>(null);
  const particleGeo = useRef<THREE.BufferGeometry | null>(null);
  const particlePositions = useRef<Float32Array>(new Float32Array(300 * 3));
  const particleVelocities = useRef<Float32Array>(new Float32Array(300 * 3));
  const particleLifetimes = useRef<Float32Array>(new Float32Array(300));

  // Frame timing
  const animationFrameId = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(performance.now());
  const fpsCountRef = useRef<number>(0);
  const fpsTimerRef = useRef<number>(performance.now());

  // Initialize Three.js Scene
  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;

    const width = containerRef.current.clientWidth || 800;
    const height = containerRef.current.clientHeight || 600;

    // 1. Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x06080e);
    scene.fog = new THREE.FogExp2(0x0a0f1d, 0.015);
    sceneRef.current = scene;

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(50, width / height, 0.5, 200);
    camera.position.set(0, 32, 38);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    // 3. Renderer (PS1 style low-res texture rendering with crisp pixelated scale)
    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current,
      antialias: displaySettings.resolutionScale > 1,
      powerPreference: 'high-performance',
      alpha: false,
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, displaySettings.resolutionScale));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.BasicShadowMap; // PS1 sharp retro shadow maps
    rendererRef.current = renderer;

    // 4. Lights
    const ambientLight = new THREE.AmbientLight(0xdde5ff, 0.7);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffeedd, 1.2);
    dirLight.position.set(25, 45, 20);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    scene.add(dirLight);

    const redArenaLight = new THREE.PointLight(0xff3344, 1.5, 30);
    redArenaLight.position.set(-20, 8, -20);
    scene.add(redArenaLight);

    const blueArenaLight = new THREE.PointLight(0x3388ff, 1.5, 30);
    blueArenaLight.position.set(20, 8, 20);
    scene.add(blueArenaLight);

    // 5. Arena Ground (Checkerboard / Cyber PS1 grid)
    buildArena(scene);

    // 6. Vehicles
    const p1Group = createVehicleMesh(0xff2a44, 'P1');
    p1Group.position.set(-14, 0.5, 0);
    scene.add(p1Group);
    p1MeshRef.current = p1Group;

    const p2Group = createVehicleMesh(0x2a88ff, 'P2');
    p2Group.position.set(14, 0.5, 0);
    p2Group.rotation.y = Math.PI;
    scene.add(p2Group);
    p2MeshRef.current = p2Group;

    // 7. Pickups
    buildPickups(scene, pickupMeshes.current);

    // 8. Particle System for sparks and smoke
    buildParticleSystem(scene);

    // Boot chime
    soundFx.playPs1Boot();
    soundFx.startCombatMusic();

    const handleResize = () => {
      if (!containerRef.current || !rendererRef.current || !cameraRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      soundFx.stopCombatMusic();
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
      renderer.dispose();
    };
  }, [displaySettings.resolutionScale]);

  // Main 60 FPS deterministic Game Loop
  const gameLoop = useCallback((currentTime: number) => {
    animationFrameId.current = requestAnimationFrame(gameLoop);

    if (isPaused) {
      lastTimeRef.current = currentTime;
      return;
    }

    const delta = (currentTime - lastTimeRef.current) / 1000;
    lastTimeRef.current = currentTime;

    // FPS Meter calculation
    fpsCountRef.current++;
    if (currentTime - fpsTimerRef.current >= 1000) {
      const currentFps = fpsCountRef.current;
      fpsCountRef.current = 0;
      fpsTimerRef.current = currentTime;
      if (onFpsUpdate) onFpsUpdate(currentFps);
      setHudState(prev => ({ ...prev, fps: currentFps }));
    }

    const state = gameStateRef.current;
    state.frame++;
    state.gameTime += 1 / 60;

    // Step 1: Poll Local Inputs & Remote Netplay Inputs
    const p1Raw = inputManager.pollInput(1);
    const p2Raw = inputManager.pollInput(2);

    let p1Bitmask = p1Raw.bitmask;
    let p2Bitmask = p2Raw.bitmask;

    const netplayState = netplayCoordinator['state'];

    if (netplayState.role === 'host') {
      // Host plays P1 locally, gets P2 from netplay
      const remote = netplayCoordinator.getOpponentFrame(state.frame);
      if (remote) p2Bitmask = remote.p2Input;

      // Broadcast frame
      netplayCoordinator.sendFrameInput({
        frame: state.frame,
        p1Input: p1Bitmask,
        p2Input: p2Bitmask,
        timestamp: Date.now()
      });
    } else if (netplayState.role === 'client') {
      // Client plays P2 locally, gets P1 from host
      const remote = netplayCoordinator.getOpponentFrame(state.frame);
      if (remote) p1Bitmask = remote.p1Input;

      // Broadcast client input
      netplayCoordinator.sendFrameInput({
        frame: state.frame,
        p1Input: 0,
        p2Input: p1Raw.bitmask, // local player controls P2 on client
        timestamp: Date.now()
      });
      p2Bitmask = p1Raw.bitmask;
    } else if (netplayState.role === 'offline_single') {
      // AI Controller for Player 2
      p2Bitmask = runSimpleVehicleAI(state.p2, state.p1, state.frame);
    }

    // Step 2: Update Physics & Vehicle Dynamics
    updateVehiclePhysics(state.p1, p1Bitmask, p1Raw.analog, state, 1);
    updateVehiclePhysics(state.p2, p2Bitmask, p2Raw.analog, state, 2);

    // Step 3: Vehicle vs Vehicle Collision
    handleVehicleCollision(state.p1, state.p2);

    // Step 4: Update Projectiles
    updateProjectiles(state);

    // Step 5: Update Pickups
    updatePickups(state);

    // Step 6: Sync Three.js Meshes & Camera
    syncMeshesWithState(state);

    // Step 7: Update Particles
    updateParticles(delta);

    // Step 8: Update HUD throttled every 4 frames
    if (state.frame % 4 === 0) {
      setHudState(prev => ({
        ...prev,
        p1Health: Math.round(state.p1.health),
        p1Shield: Math.round(state.p1.shields),
        p1Nitro: Math.round(state.p1.nitro),
        p1Missiles: state.p1.missiles,
        p1Score: state.p1.score,
        p2Health: Math.round(state.p2.health),
        p2Shield: Math.round(state.p2.shields),
        p2Nitro: Math.round(state.p2.nitro),
        p2Missiles: state.p2.missiles,
        p2Score: state.p2.score,
        round: state.round,
        winner: state.winner,
      }));
    }

    // Check Round Victory
    if (state.winner === 0) {
      if (!state.p1.alive && state.p2.alive) {
        state.winner = 2;
        state.p2.score += 1;
        triggerVictoryFx(2);
      } else if (!state.p2.alive && state.p1.alive) {
        state.winner = 1;
        state.p1.score += 1;
        triggerVictoryFx(1);
      }
    }

    // Render Scene
    if (rendererRef.current && sceneRef.current && cameraRef.current) {
      rendererRef.current.render(sceneRef.current, cameraRef.current);
    }

    // Clean old netplay buffer
    if (state.frame % 120 === 0) {
      netplayCoordinator.clearOldFrames(state.frame);
    }
  }, [isPaused, onFpsUpdate]);

  // Start animation loop
  useEffect(() => {
    animationFrameId.current = requestAnimationFrame(gameLoop);
    return () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, [gameLoop]);

  // Reset Match / Restart
  const handleRestartMatch = () => {
    soundFx.playUiBlip(900);
    const s = gameStateRef.current;
    s.winner = 0;
    s.p1 = createInitialVehicle(-14, 0, 0, 1);
    s.p2 = createInitialVehicle(14, 0, Math.PI, 2);
    s.projectiles = [];
    s.round += 1;
  };

  const triggerVictoryFx = (winner: 1 | 2) => {
    soundFx.playExplosion();
    confetti({
      particleCount: 70,
      spread: 80,
      origin: { y: 0.6 },
      colors: winner === 1 ? ['#ff3344', '#ff8899', '#ffffff'] : ['#3388ff', '#88bbff', '#ffffff']
    });
  };

  // Three.js helpers
  const spawnSpark = (x: number, y: number, z: number, count: number = 8) => {
    const pos = particlePositions.current;
    const vel = particleVelocities.current;
    const life = particleLifetimes.current;

    for (let i = 0; i < count; i++) {
      const idx = Math.floor(Math.random() * 300);
      pos[idx * 3] = x;
      pos[idx * 3 + 1] = y;
      pos[idx * 3 + 2] = z;

      vel[idx * 3] = (Math.random() - 0.5) * 14;
      vel[idx * 3 + 1] = Math.random() * 10 + 2;
      vel[idx * 3 + 2] = (Math.random() - 0.5) * 14;

      life[idx] = 0.4 + Math.random() * 0.4;
    }
  };

  const updateParticles = (dt: number) => {
    const pos = particlePositions.current;
    const vel = particleVelocities.current;
    const life = particleLifetimes.current;

    for (let i = 0; i < 300; i++) {
      if (life[i] > 0) {
        life[i] -= dt;
        pos[i * 3] += vel[i * 3] * dt;
        pos[i * 3 + 1] += vel[i * 3 + 1] * dt;
        pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
        vel[i * 3 + 1] -= 22 * dt; // Gravity
        if (pos[i * 3 + 1] < 0) {
          pos[i * 3 + 1] = 0;
          vel[i * 3 + 1] *= -0.3;
        }
      } else {
        pos[i * 3 + 1] = -999;
      }
    }

    if (particleGeo.current) {
      particleGeo.current.attributes.position.needsUpdate = true;
    }
  };

  const syncMeshesWithState = (state: GameMatchState) => {
    if (!sceneRef.current || !cameraRef.current) return;

    // P1 Mesh
    if (p1MeshRef.current) {
      p1MeshRef.current.position.set(state.p1.x, state.p1.y + 0.5, state.p1.z);
      p1MeshRef.current.rotation.y = state.p1.rotation;
      p1MeshRef.current.visible = state.p1.alive;
    }

    // P2 Mesh
    if (p2MeshRef.current) {
      p2MeshRef.current.position.set(state.p2.x, state.p2.y + 0.5, state.p2.z);
      p2MeshRef.current.rotation.y = state.p2.rotation;
      p2MeshRef.current.visible = state.p2.alive;
    }

    // Projectiles
    const existingIds = new Set<string>();
    state.projectiles.forEach(p => {
      existingIds.add(p.id);
      let mesh = projectileMeshes.current.get(p.id);
      if (!mesh) {
        const geo = p.type === 'missile'
          ? new THREE.ConeGeometry(0.35, 1.2, 6)
          : (p.type === 'mine' ? new THREE.CylinderGeometry(0.6, 0.6, 0.25, 8) : new THREE.SphereGeometry(0.2, 6, 6));
        const mat = new THREE.MeshBasicMaterial({
          color: p.type === 'missile' ? 0xffaa00 : (p.type === 'mine' ? 0xff2200 : (p.owner === 1 ? 0xff5555 : 0x5599ff))
        });
        mesh = new THREE.Mesh(geo, mat);
        sceneRef.current?.add(mesh);
        projectileMeshes.current.set(p.id, mesh);
      }
      mesh.position.set(p.x, p.y, p.z);
      if (p.type === 'missile') {
        mesh.rotation.x = Math.PI / 2;
        mesh.rotation.z = Math.atan2(p.vx, p.vz);
      }
    });

    // Remove dead projectile meshes
    for (const [id, mesh] of projectileMeshes.current.entries()) {
      if (!existingIds.has(id)) {
        sceneRef.current.remove(mesh);
        mesh.geometry.dispose();
        projectileMeshes.current.delete(id);
      }
    }

    // Animate pickups (spinning and floating)
    pickupMeshes.current.forEach((group, id) => {
      const pickupData = state.pickups.find(p => p.id === id);
      if (pickupData) {
        group.visible = pickupData.active;
        group.rotation.y += 0.04;
        group.position.y = 1.0 + Math.sin(state.frame * 0.08) * 0.25;
      }
    });

    // Dynamic Camera Tracking (Cinematic PS1 Chase / Arena View)
    const midX = (state.p1.x + state.p2.x) / 2;
    const midZ = (state.p1.z + state.p2.z) / 2;
    const dist = Math.hypot(state.p1.x - state.p2.x, state.p1.z - state.p2.z);
    const targetCamY = Math.max(26, Math.min(48, 20 + dist * 0.7));
    const targetCamZ = midZ + Math.max(28, Math.min(52, 22 + dist * 0.7));

    cameraRef.current.position.x += (midX * 0.4 - cameraRef.current.position.x) * 0.05;
    cameraRef.current.position.y += (targetCamY - cameraRef.current.position.y) * 0.05;
    cameraRef.current.position.z += (targetCamZ - cameraRef.current.position.z) * 0.05;
    cameraRef.current.lookAt(midX * 0.6, 1.5, midZ * 0.6);
  };

  // Helper: Build Arena Ground and PS1 Decor
  const buildArena = (scene: THREE.Scene) => {
    // Floor
    const floorGeo = new THREE.PlaneGeometry(64, 64, 16, 16);
    const floorCanvas = document.createElement('canvas');
    floorCanvas.width = 256;
    floorCanvas.height = 256;
    const ctx = floorCanvas.getContext('2d')!;
    ctx.fillStyle = '#141a29';
    ctx.fillRect(0, 0, 256, 256);
    ctx.strokeStyle = '#22304d';
    ctx.lineWidth = 4;
    for (let i = 0; i <= 256; i += 32) {
      ctx.beginPath();
      ctx.moveTo(i, 0); ctx.lineTo(i, 256);
      ctx.moveTo(0, i); ctx.lineTo(256, i);
      ctx.stroke();
    }
    // Arena Hazard markings
    ctx.strokeStyle = '#e67e22';
    ctx.lineWidth = 8;
    ctx.strokeRect(16, 16, 224, 224);

    const floorTex = new THREE.CanvasTexture(floorCanvas);
    floorTex.wrapS = THREE.RepeatWrapping;
    floorTex.wrapT = THREE.RepeatWrapping;
    floorTex.repeat.set(4, 4);
    floorTex.magFilter = THREE.NearestFilter; // PS1 crisp pixelated texture filtering!

    const floorMat = new THREE.MeshStandardMaterial({
      map: floorTex,
      roughness: 0.8,
      metalness: 0.2,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    // Perimeter Neon Barrier
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.5 });
    const borderGeoX = new THREE.BoxGeometry(66, 3, 1.5);
    const borderGeoZ = new THREE.BoxGeometry(1.5, 3, 66);

    const northWall = new THREE.Mesh(borderGeoX, wallMat);
    northWall.position.set(0, 1.5, -33);
    scene.add(northWall);

    const southWall = new THREE.Mesh(borderGeoX, wallMat);
    southWall.position.set(0, 1.5, 33);
    scene.add(southWall);

    const eastWall = new THREE.Mesh(borderGeoZ, wallMat);
    eastWall.position.set(33, 1.5, 0);
    scene.add(eastWall);

    const westWall = new THREE.Mesh(borderGeoZ, wallMat);
    westWall.position.set(-33, 1.5, 0);
    scene.add(westWall);

    // Corner Light Towers
    const towerGeo = new THREE.CylinderGeometry(1.2, 1.8, 12, 6);
    const towerMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.6 });
    const positions = [
      [-30, -30], [30, -30], [-30, 30], [30, 30]
    ];
    positions.forEach(([x, z]) => {
      const tower = new THREE.Mesh(towerGeo, towerMat);
      tower.position.set(x, 6, z);
      scene.add(tower);

      const beacon = new THREE.Mesh(
        new THREE.SphereGeometry(0.8, 6, 6),
        new THREE.MeshBasicMaterial({ color: 0x00f3ff })
      );
      beacon.position.set(x, 12.5, z);
      scene.add(beacon);
    });

    // Obstacle Pillars in arena
    const obsGeo = new THREE.BoxGeometry(4, 4, 4);
    const obsMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.7 });
    const obstacles = [[-10, -10], [10, -10], [-10, 10], [10, 10]];
    obstacles.forEach(([ox, oz]) => {
      const obs = new THREE.Mesh(obsGeo, obsMat);
      obs.position.set(ox, 2, oz);
      obs.castShadow = true;
      obs.receiveShadow = true;
      scene.add(obs);
    });
  };

  // Helper: Low-poly 3D PS1 Vehicle
  const createVehicleMesh = (mainColor: number, label: string) => {
    const group = new THREE.Group();

    // Chassis (Angular Low-poly muscle car / battle buggy)
    const bodyGeo = new THREE.BoxGeometry(2.4, 0.9, 4.2);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: mainColor,
      metalness: 0.4,
      roughness: 0.5,
      flatShading: true, // Authentic PS1 flat polygonal aesthetic
    });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0.5;
    body.castShadow = true;
    group.add(body);

    // Cabin / Windshield
    const cabinGeo = new THREE.BoxGeometry(1.9, 0.7, 2.0);
    const cabinMat = new THREE.MeshStandardMaterial({ color: 0x111927, roughness: 0.2 });
    const cabin = new THREE.Mesh(cabinGeo, cabinMat);
    cabin.position.set(0, 1.1, -0.3);
    group.add(cabin);

    // Dual Roof-Mounted Cannons / Machine Guns
    const gunGeo = new THREE.CylinderGeometry(0.12, 0.12, 1.8, 6);
    const gunMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.9 });
    
    const leftGun = new THREE.Mesh(gunGeo, gunMat);
    leftGun.rotation.x = Math.PI / 2;
    leftGun.position.set(-0.7, 1.4, 0.5);
    group.add(leftGun);

    const rightGun = new THREE.Mesh(gunGeo, gunMat);
    rightGun.rotation.x = Math.PI / 2;
    rightGun.position.set(0.7, 1.4, 0.5);
    group.add(rightGun);

    // Wheels (4 chunky polygonal cylinders)
    const wheelGeo = new THREE.CylinderGeometry(0.55, 0.55, 0.5, 8);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x1e222d, roughness: 0.9 });
    const wheelPositions = [
      [-1.3, 0.3, 1.3],
      [1.3, 0.3, 1.3],
      [-1.3, 0.3, -1.3],
      [1.3, 0.3, -1.3],
    ];
    wheelPositions.forEach(([wx, wy, wz]) => {
      const wheel = new THREE.Mesh(wheelGeo, wheelMat);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(wx, wy, wz);
      group.add(wheel);
    });

    // Nitro exhaust pipes
    const exhaustGeo = new THREE.CylinderGeometry(0.15, 0.2, 0.5, 6);
    const exhaustMat = new THREE.MeshStandardMaterial({ color: 0xff6600, emissive: 0x441100 });
    const leftEx = new THREE.Mesh(exhaustGeo, exhaustMat);
    leftEx.rotation.x = Math.PI / 2;
    leftEx.position.set(-0.6, 0.4, -2.1);
    group.add(leftEx);

    const rightEx = new THREE.Mesh(exhaustGeo, exhaustMat);
    rightEx.rotation.x = Math.PI / 2;
    rightEx.position.set(0.6, 0.4, -2.1);
    group.add(rightEx);

    return group;
  };

  // Helper: Build Pickups
  const buildPickups = (scene: THREE.Scene, meshes: Map<string, THREE.Group>) => {
    const pickupTypes = [
      { id: 'p1', color: 0x22c55e, shape: 'cross', x: 0, z: -15 },     // Health (Green)
      { id: 'p2', color: 0xf59e0b, shape: 'missile', x: 0, z: 15 },   // Missiles (Amber)
      { id: 'p3', color: 0x06b6d4, shape: 'bolt', x: -18, z: 0 },      // Nitro (Cyan)
      { id: 'p4', color: 0xa855f7, shape: 'shield', x: 18, z: 0 },     // Shield (Purple)
    ];

    pickupTypes.forEach(p => {
      const grp = new THREE.Group();
      const core = new THREE.Mesh(
        new THREE.OctahedronGeometry(1.0, 0),
        new THREE.MeshStandardMaterial({
          color: p.color,
          emissive: p.color,
          emissiveIntensity: 0.5,
          roughness: 0.3
        })
      );
      grp.add(core);

      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(1.6, 0.1, 6, 12),
        new THREE.MeshBasicMaterial({ color: p.color })
      );
      ring.rotation.x = Math.PI / 2;
      grp.add(ring);

      grp.position.set(p.x, 1, p.z);
      scene.add(grp);
      meshes.set(p.id, grp);
    });
  };

  // Helper: Particle System
  const buildParticleSystem = (scene: THREE.Scene) => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(particlePositions.current, 3));
    const mat = new THREE.PointsMaterial({
      color: 0xffbb44,
      size: 0.8,
      transparent: true,
      blending: THREE.AdditiveBlending
    });
    const points = new THREE.Points(geo, mat);
    scene.add(points);
    particleSystem.current = points;
    particleGeo.current = geo;
  };

  // Physics Update functions
  const updateVehiclePhysics = (
    veh: VehicleState, 
    inputBitmask: number, 
    analog: { lx: number; ly: number; rx: number; ry: number },
    state: GameMatchState,
    playerNum: 1 | 2
  ) => {
    if (!veh.alive) return;

    // Movement Controls
    const up = inputManager.constructor['isButtonPressed'](inputBitmask, PS1Button.DPAD_UP) || analog.ly < -0.3;
    const down = inputManager.constructor['isButtonPressed'](inputBitmask, PS1Button.DPAD_DOWN) || analog.ly > 0.3;
    const left = inputManager.constructor['isButtonPressed'](inputBitmask, PS1Button.DPAD_LEFT) || analog.lx < -0.3;
    const right = inputManager.constructor['isButtonPressed'](inputBitmask, PS1Button.DPAD_RIGHT) || analog.lx > 0.3;

    const cross = inputManager.constructor['isButtonPressed'](inputBitmask, PS1Button.CROSS); // Nitro / Accelerate
    const square = inputManager.constructor['isButtonPressed'](inputBitmask, PS1Button.SQUARE); // Machine Gun
    const circle = inputManager.constructor['isButtonPressed'](inputBitmask, PS1Button.CIRCLE); // Missile
    const triangle = inputManager.constructor['isButtonPressed'](inputBitmask, PS1Button.TRIANGLE); // Mine / Special
    const drift = inputManager.constructor['isButtonPressed'](inputBitmask, PS1Button.L1) || inputManager.constructor['isButtonPressed'](inputBitmask, PS1Button.R1);

    // Steering
    const steerSpeed = drift ? 0.075 : 0.052;
    if (left) veh.rotation += steerSpeed * (veh.speed >= 0 ? 1 : -1);
    if (right) veh.rotation -= steerSpeed * (veh.speed >= 0 ? 1 : -1);

    // Acceleration & Nitro
    let maxSpeed = 0.55;
    let accel = 0.022;

    if (cross && veh.nitro > 0) {
      maxSpeed = 0.95;
      accel = 0.045;
      veh.nitro = Math.max(0, veh.nitro - 0.4);
      if (state.frame % 6 === 0) {
        soundFx.playNitro();
        spawnSpark(veh.x, veh.y + 0.4, veh.z, 2);
      }
    } else {
      // Passive nitro regen
      veh.nitro = Math.min(100, veh.nitro + 0.1);
    }

    if (up) {
      veh.speed = Math.min(maxSpeed, veh.speed + accel);
    } else if (down) {
      veh.speed = Math.max(-maxSpeed * 0.4, veh.speed - accel * 1.5);
    } else {
      // Natural friction
      veh.speed *= 0.96;
    }

    // Apply Velocity along forward vector
    // In Three.js vehicle model, forward is (sin(rotation), cos(rotation))
    veh.x += Math.sin(veh.rotation) * veh.speed;
    veh.z += Math.cos(veh.rotation) * veh.speed;

    // Arena boundary collision with bounce
    const limit = 30;
    if (Math.abs(veh.x) > limit) {
      veh.x = Math.sign(veh.x) * limit;
      veh.speed *= -0.5;
      soundFx.playExplosion();
      spawnSpark(veh.x, 1, veh.z, 10);
    }
    if (Math.abs(veh.z) > limit) {
      veh.z = Math.sign(veh.z) * limit;
      veh.speed *= -0.5;
      soundFx.playExplosion();
      spawnSpark(veh.x, 1, veh.z, 10);
    }

    // Weapon 1: Machine Guns (Square)
    if (square && state.frame % 6 === 0) {
      soundFx.playMachineGun();
      const forwardX = Math.sin(veh.rotation);
      const forwardZ = Math.cos(veh.rotation);
      state.projectiles.push({
        id: `p-${Date.now()}-${Math.random()}`,
        type: 'bullet',
        x: veh.x + forwardX * 2.2,
        y: 1.2,
        z: veh.z + forwardZ * 2.2,
        vx: forwardX * 1.8,
        vz: forwardZ * 1.8,
        owner: playerNum,
        lifetime: 45
      });
      spawnSpark(veh.x + forwardX * 2.0, 1.2, veh.z + forwardZ * 2.0, 3);
    }

    // Weapon 2: Homing / Heavy Missile (Circle)
    if (circle && veh.missiles > 0 && state.frame % 20 === 0) {
      veh.missiles--;
      soundFx.playMissileLaunch();
      const forwardX = Math.sin(veh.rotation);
      const forwardZ = Math.cos(veh.rotation);
      state.projectiles.push({
        id: `m-${Date.now()}-${Math.random()}`,
        type: 'missile',
        x: veh.x + forwardX * 2.5,
        y: 1.4,
        z: veh.z + forwardZ * 2.5,
        vx: forwardX * 1.4,
        vz: forwardZ * 1.4,
        owner: playerNum,
        lifetime: 90
      });
    }

    // Weapon 3: Rear Mine Drop (Triangle)
    if (triangle && veh.mines > 0 && state.frame % 30 === 0) {
      veh.mines--;
      soundFx.playUiBlip(350);
      const backX = -Math.sin(veh.rotation);
      const backZ = -Math.cos(veh.rotation);
      state.projectiles.push({
        id: `mine-${Date.now()}-${Math.random()}`,
        type: 'mine',
        x: veh.x + backX * 2.5,
        y: 0.3,
        z: veh.z + backZ * 2.5,
        vx: 0,
        vz: 0,
        owner: playerNum,
        lifetime: 600
      });
    }
  };

  // AI Logic for Offline Mode
  const runSimpleVehicleAI = (ai: VehicleState, target: VehicleState, frame: number): number => {
    let mask = 0;
    if (!ai.alive || !target.alive) return mask;

    // Angle to target
    const dx = target.x - ai.x;
    const dz = target.z - ai.z;
    const targetAngle = Math.atan2(dx, dz);
    let diff = targetAngle - ai.rotation;

    // Normalize angle to -PI..PI
    while (diff < -Math.PI) diff += Math.PI * 2;
    while (diff > Math.PI) diff -= Math.PI * 2;

    // Steering
    if (diff > 0.15) mask |= (1 << PS1Button.DPAD_LEFT);
    else if (diff < -0.15) mask |= (1 << PS1Button.DPAD_RIGHT);

    // Throttle
    const dist = Math.hypot(dx, dz);
    if (dist > 8) {
      mask |= (1 << PS1Button.DPAD_UP);
      if (dist > 18 && ai.nitro > 40) mask |= (1 << PS1Button.CROSS); // AI Boost
    } else {
      mask |= (1 << PS1Button.DPAD_UP);
      if (Math.abs(diff) < 0.3) {
        // Fire Weapons!
        if (frame % 8 === 0) mask |= (1 << PS1Button.SQUARE);
        if (dist < 16 && ai.missiles > 0 && frame % 45 === 0) mask |= (1 << PS1Button.CIRCLE);
      }
    }

    return mask;
  };

  // Vehicle Collision
  const handleVehicleCollision = (p1: VehicleState, p2: VehicleState) => {
    if (!p1.alive || !p2.alive) return;
    const dist = Math.hypot(p1.x - p2.x, p1.z - p2.z);
    const minDistance = 3.2;

    if (dist < minDistance && dist > 0.001) {
      const overlap = minDistance - dist;
      const nx = (p1.x - p2.x) / dist;
      const nz = (p1.z - p2.z) / dist;

      p1.x += nx * overlap * 0.5;
      p1.z += nz * overlap * 0.5;
      p2.x -= nx * overlap * 0.5;
      p2.z -= nz * overlap * 0.5;

      // Ramming damage based on speed
      const ramForce = Math.abs(p1.speed) + Math.abs(p2.speed);
      if (ramForce > 0.3) {
        soundFx.playExplosion();
        damageVehicle(p1, ramForce * 12);
        damageVehicle(p2, ramForce * 12);
        spawnSpark((p1.x + p2.x) / 2, 1, (p1.z + p2.z) / 2, 15);
      }

      p1.speed *= -0.4;
      p2.speed *= -0.4;
    }
  };

  // Damage helper
  const damageVehicle = (v: VehicleState, amount: number) => {
    if (v.shields > 0) {
      const absorbed = Math.min(v.shields, amount);
      v.shields -= absorbed;
      amount -= absorbed;
    }
    if (amount > 0) {
      v.health = Math.max(0, v.health - amount);
      if (v.health <= 0) {
        v.alive = false;
        soundFx.playExplosion();
        spawnSpark(v.x, 1.5, v.z, 30);
      }
    }
  };

  // Projectiles
  const updateProjectiles = (state: GameMatchState) => {
    for (let i = state.projectiles.length - 1; i >= 0; i--) {
      const p = state.projectiles[i];
      p.lifetime--;

      // Homing missile logic
      if (p.type === 'missile') {
        const target = p.owner === 1 ? state.p2 : state.p1;
        if (target.alive) {
          const tdx = target.x - p.x;
          const tdz = target.z - p.z;
          const tDist = Math.hypot(tdx, tdz);
          if (tDist > 0.1) {
            p.vx += (tdx / tDist) * 0.08;
            p.vz += (tdz / tDist) * 0.08;
            // Cap missile speed
            const curSpeed = Math.hypot(p.vx, p.vz);
            if (curSpeed > 1.6) {
              p.vx = (p.vx / curSpeed) * 1.6;
              p.vz = (p.vz / curSpeed) * 1.6;
            }
          }
        }
      }

      p.x += p.vx;
      p.z += p.vz;

      // Hit detection vs Vehicles
      const target = p.owner === 1 ? state.p2 : state.p1;
      const hitRadius = p.type === 'mine' ? 2.4 : (p.type === 'missile' ? 2.2 : 1.6);

      if (target.alive && Math.hypot(p.x - target.x, p.z - target.z) < hitRadius) {
        const dmg = p.type === 'missile' ? 32 : (p.type === 'mine' ? 45 : 7);
        damageVehicle(target, dmg);
        soundFx.playExplosion();
        spawnSpark(p.x, p.y, p.z, p.type === 'bullet' ? 6 : 20);
        state.projectiles.splice(i, 1);
        continue;
      }

      // Check arena boundaries or lifetime
      if (p.lifetime <= 0 || Math.abs(p.x) > 32 || Math.abs(p.z) > 32) {
        state.projectiles.splice(i, 1);
      }
    }
  };

  // Pickups
  const updatePickups = (state: GameMatchState) => {
    state.pickups.forEach(p => {
      if (!p.active) {
        p.respawnTimer--;
        if (p.respawnTimer <= 0) p.active = true;
        return;
      }

      // Check P1 and P2 collecting pickup
      [state.p1, state.p2].forEach((v) => {
        if (!v.alive) return;
        if (Math.hypot(v.x - p.x, v.z - p.z) < 2.5) {
          p.active = false;
          p.respawnTimer = 600; // 10 seconds respawn
          soundFx.playPickup();
          spawnSpark(p.x, 1.2, p.z, 12);

          if (p.type === 'health') v.health = Math.min(v.maxHealth, v.health + 40);
          else if (p.type === 'shield') v.shields = Math.min(100, v.shields + 50);
          else if (p.type === 'missiles') v.missiles = Math.min(16, v.missiles + 4);
          else if (p.type === 'nitro') v.nitro = 100;
        }
      });
    });
  };

  function createInitialVehicle(x: number, z: number, rotation: number, _playerNum: 1 | 2): VehicleState {
    return {
      x,
      z,
      y: 0,
      rotation,
      speed: 0,
      health: 100,
      maxHealth: 100,
      shields: 100,
      nitro: 100,
      missiles: 8,
      mines: 4,
      score: 0,
      isDrifting: false,
      isFiring: false,
      lastHitTime: 0,
      alive: true
    };
  }

  // Aspect ratio class helper
  const getAspectRatioClass = () => {
    switch (displaySettings.aspectRatio) {
      case '4:3':
        return 'aspect-[4/3] max-h-full max-w-full my-auto shadow-2xl';
      case '16:9':
        return 'aspect-[16/9] max-h-full max-w-full my-auto shadow-2xl';
      case 'stretch':
      case 'fit':
      default:
        return 'w-full h-full';
    }
  };

  return (
    <div 
      id="ps1-combat-screen-wrapper"
      className="relative w-full h-full flex items-center justify-center bg-black overflow-hidden select-none"
    >
      {/* 3D Game Canvas Container (Adaptive, Full Screen, Clean) */}
      <div 
        ref={containerRef}
        id="ps1-game-viewport"
        className={`relative ${getAspectRatioClass()} flex items-center justify-center overflow-hidden bg-[#06080e]`}
      >
        <canvas 
          ref={canvasRef} 
          id="ps1-gl-canvas"
          className="w-full h-full block cursor-none"
        />

        {/* CRT Scanlines & Vignette Filter Overlay */}
        {displaySettings.crtFilter && (
          <div className="absolute inset-0 pointer-events-none crt-overlay z-10" />
        )}
        {displaySettings.scanlines && (
          <div className="absolute inset-0 pointer-events-none crt-vignette crt-curvature z-10" />
        )}

        {/* Minimalist Retro PlayStation HUD (Non-intrusive, clean top bar) */}
        <div className="absolute top-2 inset-x-3 pointer-events-none flex justify-between items-start z-20 font-cyber text-xs">
          {/* P1 Status (Red Crusher) */}
          <div className="flex flex-col gap-1 bg-black/60 backdrop-blur-xs px-3 py-1.5 rounded-sm border-l-2 border-red-500 min-w-[140px] sm:min-w-[180px]">
            <div className="flex justify-between items-center text-red-400 font-bold text-[11px] sm:text-xs">
              <span>P1 CRIMSON</span>
              <span className="text-white font-mono-retro text-sm">{hudState.p1Score}</span>
            </div>
            {/* Health */}
            <div className="w-full bg-red-950/80 h-2 rounded-xs overflow-hidden">
              <div 
                className="bg-gradient-to-r from-red-600 to-rose-400 h-full transition-all duration-75"
                style={{ width: `${hudState.p1Health}%` }}
              />
            </div>
            {/* Shield & Nitro mini bars */}
            <div className="flex gap-1 items-center text-[10px] text-slate-300">
              <div className="flex-1 bg-purple-950/80 h-1 rounded-xs overflow-hidden">
                <div className="bg-purple-500 h-full" style={{ width: `${hudState.p1Shield}%` }} />
              </div>
              <div className="flex-1 bg-cyan-950/80 h-1 rounded-xs overflow-hidden">
                <div className="bg-cyan-400 h-full" style={{ width: `${hudState.p1Nitro}%` }} />
              </div>
              <span className="font-mono-retro text-[10px] text-amber-300">🚀 {hudState.p1Missiles}</span>
            </div>
          </div>

          {/* Match Status / Round Center */}
          <div className="flex flex-col items-center">
            <div className="px-2.5 py-0.5 bg-black/70 rounded-b-xs border border-t-0 border-slate-700 text-[11px] font-mono-retro text-slate-400">
              الجولة {hudState.round} {displaySettings.showFps && `• ${hudState.fps} FPS`}
            </div>
          </div>

          {/* P2 Status (Blue Spectre) */}
          <div className="flex flex-col gap-1 bg-black/60 backdrop-blur-xs px-3 py-1.5 rounded-sm border-r-2 border-blue-500 min-w-[140px] sm:min-w-[180px] text-left">
            <div className="flex justify-between items-center text-blue-400 font-bold text-[11px] sm:text-xs">
              <span className="text-white font-mono-retro text-sm">{hudState.p2Score}</span>
              <span>P2 COBALT</span>
            </div>
            {/* Health */}
            <div className="w-full bg-blue-950/80 h-2 rounded-xs overflow-hidden">
              <div 
                className="bg-gradient-to-l from-blue-600 to-sky-400 h-full transition-all duration-75"
                style={{ width: `${hudState.p2Health}%` }}
              />
            </div>
            {/* Shield & Nitro mini bars */}
            <div className="flex gap-1 items-center text-[10px] text-slate-300 justify-end">
              <span className="font-mono-retro text-[10px] text-amber-300">🚀 {hudState.p2Missiles}</span>
              <div className="flex-1 bg-cyan-950/80 h-1 rounded-xs overflow-hidden">
                <div className="bg-cyan-400 h-full" style={{ width: `${hudState.p2Nitro}%` }} />
              </div>
              <div className="flex-1 bg-purple-950/80 h-1 rounded-xs overflow-hidden">
                <div className="bg-purple-500 h-full" style={{ width: `${hudState.p2Shield}%` }} />
              </div>
            </div>
          </div>
        </div>

        {/* Winner Banner Overlay */}
        {hudState.winner !== 0 && (
          <div className="absolute inset-0 z-30 bg-black/75 backdrop-blur-xs flex flex-col items-center justify-center animate-fade-in">
            <div className="text-center p-6 rounded-xl border border-slate-700 bg-slate-900/90 shadow-2xl max-w-sm mx-4">
              <div className="text-2xl font-cyber font-bold mb-2">
                {hudState.winner === 1 ? (
                  <span className="text-red-400">🔥 انتصار اللاعب 1 (Crimson)</span>
                ) : (
                  <span className="text-blue-400">⚡ انتصار اللاعب 2 (Cobalt)</span>
                )}
              </div>
              <p className="text-xs text-slate-400 mb-5 font-mono-retro">
                تم تدمير مركبة الخصم في ساحة PS1 Netplay
              </p>
              <button
                id="btn-restart-round"
                onClick={handleRestartMatch}
                className="px-6 py-2.5 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-bold rounded-lg shadow-lg cursor-pointer transition-transform active:scale-95 text-sm"
              >
                الجولة التالية ⚔️
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Discrete Isolated Floating Settings Button (⚙) - Hidden unobtrusively on corner */}
      <button
        id="btn-floating-ps1-settings"
        onClick={() => {
          soundFx.playUiBlip(700);
          onOpenSettings();
        }}
        aria-label="إعدادات PS1 و Netplay"
        title="الإعدادات (⚙)"
        className="absolute top-3 right-3 z-40 w-9 h-9 rounded-full bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/80 backdrop-blur-md flex items-center justify-center shadow-lg transition-all active:scale-90 opacity-40 hover:opacity-100 cursor-pointer"
      >
        <span className="text-lg leading-none select-none">⚙</span>
      </button>
    </div>
  );
};
