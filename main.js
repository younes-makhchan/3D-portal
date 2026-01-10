const CONFIG = {
    room: {
        width: 80,         // Made slightly wider for that wide-screen look
        height: 50,
        depth: 65,        // Deep tunnel
        gridSize: 5,       // Larger number = more spacing between lines
    },
    visuals: {
        neonColor: 0x00ffff,
        bloomStrength: 1.5,
        emissiveIntensity: 10, // Crank this up for that bright glow
    },
    camera: {
        fov: 60,           // Lower FOV feels more cinematic
        initialZ: 0        // Stand at the "glass" of the monitor
    }
};
let scene, camera, renderer, composer, pointLight;

function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);

    // 1. Camera Setup
    camera = new THREE.PerspectiveCamera(CONFIG.camera.fov, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 0, CONFIG.camera.initialZ);

    // 2. Renderer & Post-Processing (The Neon Glow)
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.toneMapping = THREE.ReinhardToneMapping;
    document.getElementById('container').appendChild(renderer.domElement);

    composer = new THREE.EffectComposer(renderer);
    composer.addPass(new THREE.RenderPass(scene, camera));

    const bloomPass = new THREE.UnrealBloomPass(
        new THREE.Vector2(window.innerWidth, window.innerHeight),
        CONFIG.visuals.bloomStrength,
        0.4,
        0.85
    );
    composer.addPass(bloomPass);

    // 3. Lighting (Static for now)
    pointLight = new THREE.PointLight(0xffffff, 1.0, 500);
    pointLight.position.set(0, 0, 10);
    scene.add(pointLight);

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
    // No animations or tracking logic here to keep it stable
    composer.render();
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
