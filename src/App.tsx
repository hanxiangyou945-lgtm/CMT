import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import { motion, AnimatePresence } from 'motion/react';
import { MODES, STATE, Particle, Mode } from './types';

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(true);
  const [uiVisible, setUiVisible] = useState(true);
  const [currentMode, setCurrentMode] = useState<Mode>(MODES.TREE);
  
  const sceneRef = useRef<{
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    composer: EffectComposer;
    particles: Particle[];
    mainGroup: THREE.Group;
    mats: Record<string, THREE.Material>;
    geos: Record<string, THREE.BufferGeometry>;
  } | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    // --- Three.js Initialization ---
    const scene = new THREE.Scene();
    const renderer = new THREE.WebGLRenderer({ canvas: canvasRef.current, antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.toneMapping = THREE.ReinhardToneMapping;
    renderer.toneMappingExposure = 1.2;

    const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 1000);
    camera.position.set(0, 2, 50);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;

    const renderScene = new RenderPass(scene, camera);
    const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.3, 0.4, 0.7);
    const composer = new EffectComposer(renderer);
    composer.addPass(renderScene);
    composer.addPass(bloomPass);

    scene.add(new THREE.AmbientLight(0xffffff, 0.3));
    const pLight = new THREE.PointLight(0xffaa00, 1);
    pLight.position.set(0, 5, 0);
    scene.add(pLight);

    const spot1 = new THREE.SpotLight(0xd4af37, 600);
    spot1.position.set(30, 40, 40);
    scene.add(spot1);

    const spot2 = new THREE.SpotLight(0x0044ff, 300);
    spot2.position.set(-30, 20, -30);
    scene.add(spot2);

    const mainGroup = new THREE.Group();
    scene.add(mainGroup);

    // Materials
    const mats: Record<string, THREE.Material> = {
      gold: new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.9, roughness: 0.1 }),
      green: new THREE.MeshStandardMaterial({ color: 0x003300, roughness: 0.8 }),
      red: new THREE.MeshPhysicalMaterial({ color: 0xaa0000, metalness: 0.5, roughness: 0.1, clearcoat: 1 }),
      dust: new THREE.MeshBasicMaterial({ color: 0xfceea7, transparent: true, opacity: 0.6 })
    };

    // Geometries
    const geos: Record<string, THREE.BufferGeometry> = {
      box: new THREE.BoxGeometry(0.8, 0.8, 0.8),
      sphere: new THREE.SphereGeometry(0.5, 16, 16),
      dust: new THREE.SphereGeometry(0.05, 8, 8),
    };

    // Candy Cane Geo
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 1.5, 0),
      new THREE.Vector3(0.5, 1.8, 0),
      new THREE.Vector3(0.8, 1.5, 0)
    ]);
    geos.cane = new THREE.TubeGeometry(curve, 20, 0.1, 8, false);
    
    const canvas = document.createElement('canvas');
    canvas.width = 64; canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0,0,64,64);
    ctx.strokeStyle = '#ff0000';
    ctx.lineWidth = 10;
    ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(64,64); ctx.stroke();
    
    const caneTex = new THREE.CanvasTexture(canvas);
    caneTex.wrapS = caneTex.wrapT = THREE.RepeatWrapping;
    caneTex.repeat.set(4, 1);
    mats.cane = new THREE.MeshStandardMaterial({ map: caneTex });

    const particles: Particle[] = [];

    // Generate Content
    for(let i=0; i<1500; i++) {
      let mesh;
      const rand = Math.random();
      if(rand < 0.3) mesh = new THREE.Mesh(geos.box, Math.random() > 0.5 ? mats.gold : mats.green);
      else if(rand < 0.6) mesh = new THREE.Mesh(geos.sphere, Math.random() > 0.5 ? mats.gold : mats.red);
      else mesh = new THREE.Mesh(geos.cane, mats.cane);
      
      mainGroup.add(mesh);
      particles.push(new Particle(mesh, 'DECO'));
    }

    for(let i=0; i<2500; i++) {
      const mesh = new THREE.Mesh(geos.dust, mats.dust);
      mainGroup.add(mesh);
      particles.push(new Particle(mesh, 'DUST'));
    }

    // Initial Photo
    const photoCanvas = document.createElement('canvas');
    photoCanvas.width = 512; photoCanvas.height = 512;
    const pCtx = photoCanvas.getContext('2d')!;
    pCtx.fillStyle = '#1a1a1a'; pCtx.fillRect(0,0,512,512);
    pCtx.fillStyle = '#d4af37'; pCtx.font = '60px Cinzel';
    pCtx.textAlign = 'center'; pCtx.fillText('JOYEUX NOEL', 256, 256);
    const photoTex = new THREE.CanvasTexture(photoCanvas);

    const addPhoto = (texture: THREE.Texture) => {
      const group = new THREE.Group();
      const photoGeo = new THREE.PlaneGeometry(4, 4);
      const photoMat = new THREE.MeshBasicMaterial({ map: texture });
      const photoMesh = new THREE.Mesh(photoGeo, photoMat);
      
      const frameGeo = new THREE.BoxGeometry(4.4, 4.4, 0.2);
      const frameMesh = new THREE.Mesh(frameGeo, mats.gold);
      frameMesh.position.z = -0.15;
      
      group.add(photoMesh, frameMesh);
      mainGroup.add(group);
      particles.push(new Particle(group, 'PHOTO'));
    };

    addPhoto(photoTex);

    sceneRef.current = { scene, camera, renderer, composer, particles, mainGroup, mats, geos };

    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
      composer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);

    const handleKeyDown = (e: KeyboardEvent) => {
      if(e.key.toLowerCase() === 'h') {
        setUiVisible(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    // --- Animation Loop ---
    let frameId: number;
    const animate = () => {
      frameId = requestAnimationFrame(animate);
      
      const time = performance.now() * 0.001;
      let decoIdx = 0;
      let dustIdx = 0;

      particles.forEach((p, i) => {
        if (STATE.currentMode === MODES.TREE) {
          if (p.type === 'DECO' || p.type === 'PHOTO') {
            const t = decoIdx / 1500;
            const height = 30;
            const angle = t * Math.PI * 60;
            const radius = 12 * (1 - t);
            p.targetPos.set(
              Math.cos(angle) * radius,
              t * height - height/2,
              Math.sin(angle) * radius
            );
            p.targetScale.set(1, 1, 1);
            decoIdx++;
          } else {
            const angle = dustIdx * 0.1 + time * 0.2;
            p.targetPos.set(Math.cos(angle)*15, (dustIdx/2500)*40-20, Math.sin(angle)*15);
            dustIdx++;
          }
        } 
        else if (STATE.currentMode === MODES.SCATTER) {
          if(p.type === 'PHOTO') {
            const angle = (i * 0.5);
            p.targetPos.set(Math.cos(angle)*15, Math.sin(time*0.5 + i)*5, Math.sin(angle)*15);
          } else {
            if (p.mesh.position.length() > 25 || p.mesh.position.length() < 5) {
              p.targetPos.set(
                (Math.random()-0.5)*40,
                (Math.random()-0.5)*40,
                (Math.random()-0.5)*40
              );
            }
          }
        }
        else if (STATE.currentMode === MODES.FOCUS) {
          if (p === STATE.focusTarget) {
            p.targetPos.set(0, 2, 35);
            p.targetScale.set(4.5, 4.5, 4.5);
            p.targetRot.setFromEuler(new THREE.Euler(0, 0, 0));
          } else {
            const angle = i * 0.1;
            p.targetPos.set(Math.cos(angle)*30, Math.sin(angle)*30, -10);
            p.targetScale.set(0.5, 0.5, 0.5);
          }
        }
        p.update(STATE.currentMode);
      });

      if(STATE.isHandActive) {
        mainGroup.rotation.y = THREE.MathUtils.lerp(mainGroup.rotation.y, (STATE.handPos.x - 0.5) * Math.PI, 0.1);
        mainGroup.rotation.x = THREE.MathUtils.lerp(mainGroup.rotation.x, (STATE.handPos.y - 0.5) * Math.PI * 0.5, 0.1);
      } else {
        mainGroup.rotation.y += 0.005;
      }

      composer.render();
    };
    animate();

    setLoading(false);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('keydown', handleKeyDown);
      cancelAnimationFrame(frameId);
      renderer.dispose();
    };
  }, []);

  // --- MediaPipe Setup ---
  useEffect(() => {
    let handLandmarker: any;
    let video: HTMLVideoElement;
    let active = true;

    async function setupCV() {
      const vision = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm");
      handLandmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: { 
          modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`, 
          delegate: "GPU" 
        },
        runningMode: "VIDEO", 
        numHands: 1
      });

      video = videoRef.current!;
      const constraints = { video: { width: 1280, height: 720 } };
      try {
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        video.srcObject = stream;
        video.onloadeddata = predict;
      } catch (err) {
        console.error("Webcam access denied", err);
      }
    }

    async function predict() {
      if (!active || !handLandmarker || !video) return;
      
      const results = handLandmarker.detectForVideo(video, performance.now());
      if (results.landmarks && results.landmarks.length > 0) {
        const landmarks = results.landmarks[0];
        STATE.isHandActive = true;
        STATE.handPos.x = landmarks[9].x;
        STATE.handPos.y = landmarks[9].y;

        const getDist = (p1: number, p2: number) => Math.hypot(landmarks[p1].x - landmarks[p2].x, landmarks[p1].y - landmarks[p2].y);
        
        const pinchDist = getDist(4, 8);
        const tipIds = [8, 12, 16, 20];
        let avgDistToWrist = 0;
        tipIds.forEach(id => avgDistToWrist += getDist(id, 0));
        avgDistToWrist /= 4;

        if (pinchDist < 0.05 && STATE.currentMode !== MODES.FOCUS) {
          const photos = sceneRef.current?.particles.filter(p => p.type === 'PHOTO') || [];
          if(photos.length > 0) {
            STATE.currentMode = MODES.FOCUS;
            setCurrentMode(MODES.FOCUS);
            STATE.focusTarget = photos[Math.floor(Math.random() * photos.length)];
          }
        } else if (avgDistToWrist < 0.25) {
          STATE.currentMode = MODES.TREE;
          setCurrentMode(MODES.TREE);
          STATE.focusTarget = null;
        } else if (avgDistToWrist > 0.45) {
          STATE.currentMode = MODES.SCATTER;
          setCurrentMode(MODES.SCATTER);
          STATE.focusTarget = null;
        }
      } else {
        STATE.isHandActive = false;
      }
      requestAnimationFrame(predict);
    }

    setupCV();

    return () => {
      active = false;
      if (video && video.srcObject) {
        (video.srcObject as MediaStream).getTracks().forEach(t => t.stop());
      }
    };
  }, []);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && sceneRef.current) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        new THREE.TextureLoader().load(ev.target?.result as string, (t) => {
          t.colorSpace = THREE.SRGBColorSpace;
          
          const group = new THREE.Group();
          const photoGeo = new THREE.PlaneGeometry(4, 4);
          const photoMat = new THREE.MeshBasicMaterial({ map: t });
          const photoMesh = new THREE.Mesh(photoGeo, photoMat);
          
          const frameGeo = new THREE.BoxGeometry(4.4, 4.4, 0.2);
          const frameMesh = new THREE.Mesh(frameGeo, sceneRef.current!.mats.gold);
          frameMesh.position.z = -0.15;
          
          group.add(photoMesh, frameMesh);
          sceneRef.current!.mainGroup.add(group);
          sceneRef.current!.particles.push(new Particle(group, 'PHOTO'));
        });
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="relative w-full h-full bg-black overflow-hidden font-serif">
      <AnimatePresence>
        {loading && (
          <motion.div 
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black z-50 flex flex-col items-center justify-center"
          >
            <div className="w-10 h-10 border border-gold/20 border-t-gold rounded-full animate-spin mb-5" />
            <div className="hint-text tracking-[3px]">LOADING HOLIDAY MAGIC</div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div 
        animate={{ opacity: uiVisible ? 1 : 0 }}
        className="absolute inset-0 pointer-events-none z-10 flex flex-col items-center justify-between py-10"
      >
        <h1 className="font-cinzel text-4xl md:text-6xl gold-text tracking-widest">Merry Christmas</h1>
        
        <div className="flex flex-col items-center gap-4 pointer-events-auto">
          <button 
            className="btn-glass"
            onClick={() => fileInputRef.current?.click()}
          >
            ADD MEMORIES
          </button>
          <input 
            type="file" 
            ref={fileInputRef} 
            hidden 
            accept="image/*" 
            onChange={handleFileUpload}
          />
          <div className="hint-text">Press 'H' to Hide Controls</div>
          <div className="text-[10px] text-cream/40 uppercase tracking-wider">
            Current Mode: {currentMode}
          </div>
        </div>
      </motion.div>

      <div className="absolute bottom-5 right-5 opacity-0 pointer-events-none">
        <video ref={videoRef} autoPlay playsInline muted />
      </div>

      <canvas ref={canvasRef} className="block w-full h-full" />
    </div>
  );
}
