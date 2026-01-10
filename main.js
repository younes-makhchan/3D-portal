import { FaceLandmarker, FilesetResolver } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3";
const CONFIG = {
    room: {
        width: 80,         // Made slightly wider for that wide-screen look
        height: 50,
        depth: 65,        // Deep tunnel
        gridSize: 5,       // Larger number = more spacing between lines
    },
    visuals: {
        neonColor: 0xffffff,
        bloomStrength: 0.5,
        emissiveIntensity: 3, // Crank this up for that bright glow
    },
    camera: {
        fov: 60,           // Lower FOV feels more cinematic
        initialZ: 0        // Stand at the "glass" of the monitor
    }
};
let scene, camera, renderer, composer, pointLight, faceLandmarker, video;
let eyePosition = { x: 0, y: 0, z: 60 };
let monitorWidth = 50;
let monitorHeight = 30;

function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);

    // 1. Camera Setup
    camera = new THREE.PerspectiveCamera(CONFIG.camera.fov, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 0, CONFIG.camera.initialZ);

    // 2. Renderer & Post-Processing (The Neon Glow)
    renderer = new THREE.WebGLRenderer({ 
    antialias: true,
    powerPreference: "high-performance" 
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.outputEncoding = THREE.sRGBEncoding;
    document.getElementById('container').appendChild(renderer.domElement);

    const renderTarget = new THREE.WebGLRenderTarget(
        window.innerWidth, 
        window.innerHeight, 
        {
            type: THREE.FloatType, // This is the secret for bloom!
            format: THREE.RGBAFormat,
            encoding: THREE.sRGBEncoding
        }
    );
    composer = new THREE.EffectComposer(renderer,renderTarget);
    composer.addPass(new THREE.RenderPass(scene, camera));

    const bloomPass = new THREE.UnrealBloomPass(
        new THREE.Vector2(window.innerWidth, window.innerHeight),
        CONFIG.visuals.bloomStrength,
        0,
        1
    );
    composer.addPass(bloomPass);

    // 3. Lighting (Static for now)
    pointLight = new THREE.PointLight(0xffffff, 1.0, 500);
    pointLight.position.set(0, 0, 10);
    scene.add(pointLight);

    video = document.getElementById('webcam');
    setupTracking();

    // 4. Build the Room
    const gridTex = createBorderTexture();
    const { width, height, depth, gridSize } = CONFIG.room;

    // Back Wall
    addWall(0, 0, -depth, width, height, 0, 0, 0, width/gridSize, height/gridSize, gridTex);
    // Floor
    addWall(0, -height/2, -depth/2, width, depth, -Math.PI/2, 0, 0, width/gridSize, depth/gridSize, gridTex);
    // Ceiling
    addWall(0, height/2, -depth/2, width, depth, Math.PI/2, 0, 0, width/gridSize, depth/gridSize, gridTex);
    // Left Wall
    addWall(-width/2, 0, -depth/2, depth, height, 0, Math.PI/2, 0, depth/gridSize, height/gridSize, gridTex);
    // Right Wall
    addWall(width/2, 0, -depth/2, depth, height, 0, -Math.PI/2, 0, depth/gridSize, height/gridSize, gridTex);

    renderLoop();
}

function addWall(x, y, z, w, h, rx, ry, rz, repX, repY, baseTex) {
    const wallTex = baseTex.clone();
    wallTex.needsUpdate = true;
    wallTex.wrapS = wallTex.wrapT = THREE.RepeatWrapping;
    wallTex.repeat.set(repX, repY);

    const material = new THREE.MeshStandardMaterial({
        color: 0x000000,           // The "gap" between lines stays black
        emissive: CONFIG.visuals.neonColor, // The color of the glow
        emissiveIntensity: CONFIG.visuals.emissiveIntensity,
        emissiveMap: wallTex,      // CRITICAL: Only the white lines glow
        transparent: true,
        metalness: 0,
        roughness: 1
    });

    const plane = new THREE.Mesh(new THREE.PlaneGeometry(w, h), material);
    plane.position.set(x, y, z);
    plane.rotation.set(rx, ry, rz);
    scene.add(plane);
}

function renderLoop() {
    requestAnimationFrame(renderLoop);
    if (faceLandmarker && video.readyState >= video.HAVE_CURRENT_DATA) {
        const startTimeMs = performance.now();
        // Modern detection method
        const results = faceLandmarker.detectForVideo(video, startTimeMs);
        onResults(results);
    }
    updateCamera();
    composer.render();
}

function updateCamera() {
    // Simple parallax: move camera based on eye position
    camera.position.x = eyePosition.x * 0.1;
    camera.position.y = eyePosition.y * 0.1;
    camera.lookAt(0, 0, -CONFIG.room.depth / 2);
}

async function setupTracking() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        video.srcObject = stream;
        video.play();
        
        // Use the imported FilesetResolver
        const vision = await FilesetResolver.forVisionTasks(
            "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
        );
        
        // Use the imported FaceLandmarker
        faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
            baseOptions: {
                modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
                delegate: "GPU"
            },
            runningMode: "VIDEO",
            numFaces: 1
        });
        
        console.log("Face Tracking Initialized");
    } catch (error) {
        console.error('Error accessing webcam:', error);
    }
}

function onResults(results) {
    if (results.faceLandmarks && results.faceLandmarks.length > 0) {
        const landmarks = results.faceLandmarks[0];
        
        // Landmarks 159 (Left Pupil) and 386 (Right Pupil)
        const leftEye = landmarks[159];
        const rightEye = landmarks[386];
        
        const normX = (leftEye.x + rightEye.x) / 2;
        const normY = (leftEye.y + rightEye.y) / 2;

        // Smooth movement logic
        eyePosition.x += ((normX - 0.5) * monitorWidth - eyePosition.x) * 0.15;
        eyePosition.y += ((0.5 - normY) * monitorHeight - eyePosition.y) * 0.15;
    }
}

function createBorderTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    // 1. Black Background
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, 256, 256);

    // 2. White Grid Lines (These will become your neon lines)
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 4; // Tweak this to make lines thicker/thinner
    ctx.strokeRect(0, 0, 256, 256); 

    const texture = new THREE.CanvasTexture(canvas);
    texture.magFilter = THREE.NearestFilter; // Keeps lines from getting blurry
    return texture;
}

document.addEventListener('DOMContentLoaded', init);
