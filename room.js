import { FaceLandmarker, FilesetResolver } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3";
const POINTS_VERTEX_SHADER = `
  varying vec2 vUv;

  void main() {
    vUv = uv;

    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);

    float depth = -mvPosition.z;
    float softness = smoothstep(40.0, 160.0, depth);
    gl_PointSize = mix(
      0.045 * (2000.0 / depth),
      0.08 * (2000.0 / depth),
      softness
    );

    gl_Position = projectionMatrix * mvPosition;
  }
`;

const POINTS_FRAGMENT_SHADER = `
  uniform sampler2D map;
  varying vec2 vUv;

  void main() {
    vec2 c = gl_PointCoord - vec2(0.5);
    float d = dot(c, c) * 4.0; // distance from center
    float alpha = exp(-d * 1.8); // softness control

    if (alpha < 0.05) discard;

    vec4 texColor = texture2D(map, vUv);

    // kill transparent texels (leaves clean edges)
    if (texColor.a < 0.1) discard;

    gl_FragColor = vec4(texColor.rgb, texColor.a * alpha);
  }
`;

const CONFIG = {
    room: {
        width: 90,         // 18 * 5 = perfect grid
        height: 45,        // 9 * 5 = perfect grid
        depth: 70,         // 14 * 5 = perfect grid, no gaps
        gridSize: 7,       // Grid spacing
    },
    visuals: {
        neonColor: 0xffffff,
        bloomStrength: 0.8,
        emissiveIntensity: 1, // Reduced to avoid over-shininess on grid
    },
    camera: {
        fov: 60,           // Lower FOV feels more cinematic
        initialZ: 0        // Stand at the "glass" of the monitor
    },
    motion: {
        enabled: true,      // Enable/disable motion tracking
        parallaxFactor: 0.25, // Multiplier for camera movement based on eye position
        smoothing: 0.3    // Smoothing factor for eye position updates (0-1, lower = smoother)
    },
    monitor: {
        width: 32,          // Monitor width for tracking calculations
        height: 20          // Monitor height for tracking calculations
    },
    tracking: {
        sensitivity: 4.0   // Sensitivity multiplier for eye tracking
    }
};

class Room {
    constructor(config = CONFIG) {
        this.config = config;
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.composer = null;
        this.pointLight = null;
        this.faceLandmarker = null;
        this.video = null;
        this.eyePosition = { x: 0, y: 0, z: 60 };
        this.monitorWidth = config.monitor.width;
        this.monitorHeight = config.monitor.height;
        this.gltfLoader = new THREE.GLTFLoader();
        this.objects = [];
    }



    // Initialize garden system
    initGarden() {
        const garden = new Garden();
        const gardenObject = garden.createMasterGarden();
        this.scene.add(gardenObject);
        this.objects.push(gardenObject);
        this.setupDevUI(gardenObject);
        return gardenObject;
    }

    // Initialize hybrid garden with GLB models
    async initHybridGarden() {
        const garden = new Garden();
        const gardenObject = await garden.createHybridGarden();
        this.scene.add(gardenObject);
        this.objects.push(gardenObject);
        this.setupDevUI(gardenObject);
        return gardenObject;
    }

    async init(containerId) {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x000000);

        // Add depth fog for enhanced camera-like depth perception
        this.scene.fog = new THREE.FogExp2(0x000000, 0.015);

        // Camera Setup
        this.camera = new THREE.PerspectiveCamera(this.config.camera.fov, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.set(0, 0, this.config.camera.initialZ);

        // Renderer & Post-Processing
        this.renderer = new THREE.WebGLRenderer({
            antialias: true,
            powerPreference: "high-performance"
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.toneMapping = THREE.NoToneMapping;
        this.renderer.outputEncoding = THREE.sRGBEncoding;
        document.getElementById(containerId).appendChild(this.renderer.domElement);

        const renderTarget = new THREE.WebGLRenderTarget(
            window.innerWidth,
            window.innerHeight,
            {
                type: THREE.FloatType,
                format: THREE.RGBAFormat,
                encoding: THREE.sRGBEncoding
            }
        );
        this.composer = new THREE.EffectComposer(this.renderer, renderTarget);
        this.composer.addPass(new THREE.RenderPass(this.scene, this.camera));

        const bloomPass = new THREE.UnrealBloomPass(
            new THREE.Vector2(window.innerWidth, window.innerHeight),
            1.5, // Stronger bloom for bigger effect
            1.0, // Larger radius for bigger blur
            0.8  // Threshold to focus bloom on bright areas
        );
        this.composer.addPass(bloomPass);

        // Add Depth-of-Field (DoF) blur for camera-like depth effect
        const bokehPass = new THREE.BokehPass(this.scene, this.camera, {
            focus: 1000.0,     // Distance from camera that stays sharp (garden depth)
            aperture: 0.0008, // Controls blur amount - subtle but noticeable
            maxblur: 0.0015    // Maximum blur radius
        });
        this.composer.addPass(bokehPass);

        // Lighting
        this.pointLight = new THREE.PointLight(0xffffff, 2.0, 500);
        this.pointLight.position.set(0, 0, 10);
        this.scene.add(this.pointLight);

        this.video = document.getElementById('webcam');
       await this.setupTracking();

        // Build the Room
        this.buildRoom();

        this.renderLoop();
    }

    buildRoom() {
        const gridTex = this.createBorderTexture();
        const { width, height, depth, gridSize } = this.config.room;

        // Back Wall
        this.addWall(0, 0, -depth, width, height, 0, 0, 0, width/gridSize, height/gridSize, gridTex);
        // Floor
        this.addWall(0, -height/2, -depth/2, width, depth, -Math.PI/2, 0, 0, width/gridSize, depth/gridSize, gridTex);
        // Ceiling
        this.addWall(0, height/2, -depth/2, width, depth, Math.PI/2, 0, 0, width/gridSize, depth/gridSize, gridTex);
        // Left Wall
        this.addWall(-width/2, 0, -depth/2, depth, height, 0, Math.PI/2, 0, depth/gridSize, height/gridSize, gridTex);
        // Right Wall
        this.addWall(width/2, 0, -depth/2, depth, height, 0, -Math.PI/2, 0, depth/gridSize, height/gridSize, gridTex);
    }

    addWall(x, y, z, w, h, rx, ry, rz, repX, repY, baseTex) {
        const wallTex = baseTex.clone();
        wallTex.needsUpdate = true;
        wallTex.wrapS = wallTex.wrapT = THREE.RepeatWrapping;
        wallTex.repeat.set(repX, repY);

        const material = new THREE.MeshStandardMaterial({
            color: 0x000000,
            emissive: this.config.visuals.neonColor,
            emissiveIntensity: this.config.visuals.emissiveIntensity,
            emissiveMap: wallTex,
            transparent: true,
            metalness: 0,
            roughness: 1
        });

        const plane = new THREE.Mesh(new THREE.PlaneGeometry(w, h), material);
        plane.position.set(x, y, z);
        plane.rotation.set(rx, ry, rz);
        this.scene.add(plane);
    }

    setupDevUI(object) {
        const ui = document.getElementById('dev-ui');
        ui.style.display = 'block';

        const get = (id) => document.getElementById(id);

        // Initial Values
        get('ui-x').value = object.position.x;
        get('ui-y').value = object.position.y;
        get('ui-z').value = object.position.z;
        get('ui-rotY').value = object.rotation.y;
        get('ui-scale').value = object.scale.x;

        // Event Listeners
        get('ui-x').oninput = (e) => object.position.x = parseFloat(e.target.value);
        get('ui-y').oninput = (e) => object.position.y = parseFloat(e.target.value);
        get('ui-z').oninput = (e) => object.position.z = parseFloat(e.target.value);
        get('ui-rotY').oninput = (e) => object.rotation.y = parseFloat(e.target.value);
        get('ui-scale').oninput = (e) => {
            const s = parseFloat(e.target.value);
            object.scale.set(s, s, s);
        };

        // Helper: Print to console so you can save your favorite position
        get('ui-copy').onclick = () => {
            console.log(`Final Config:
            Position: { x: ${object.position.x}, y: ${object.position.y}, z: ${object.position.z} },
            Rotation: { x: ${object.rotation.x}, y: ${object.rotation.y}, z: ${object.rotation.z} },
            Scale: { x: ${object.scale.x}, y: ${object.scale.y}, z: ${object.scale.z} }`);
            alert("Config printed to Console (F12)");
        };

        // Toggle Visibility with 'H'
        window.addEventListener('keydown', (e) => {
            if (e.key.toLowerCase() === 'h') {
                ui.style.display = ui.style.display === 'none' ? 'block' : 'none';
            }
        });
    }

    convertMeshToTexturedPoints(mesh) {
        if (!mesh.geometry || !mesh.material || !mesh.material.map) return null;

        const texture = mesh.material.map;
        texture.colorSpace = THREE.SRGBColorSpace;

        const material = new THREE.ShaderMaterial({
            uniforms: {
                map: { value: texture }
            },
            vertexShader: POINTS_VERTEX_SHADER,
            fragmentShader: POINTS_FRAGMENT_SHADER,
            transparent: true,
            depthWrite: false
        });

        const points = new THREE.Points(mesh.geometry, material);

        // preserve transforms
        points.position.copy(mesh.position);
        points.rotation.copy(mesh.rotation);
        points.scale.copy(mesh.scale);

        return points;
    }

    async addObject(url, position = {x:0,y:0,z:0}, scale = {x:1,y:1,z:1}, rotation = {x:0,y:0,z:0}) {
        return new Promise((resolve, reject) => {
            this.gltfLoader.load(
                url,
                (gltf) => {
                    const root = new THREE.Group();

                    gltf.scene.traverse((child) => {
                        if (child.isMesh) {
                            const points = this.convertMeshToTexturedPoints(child);

                            if (points) {
                                root.add(points);
                            }
                        }
                    });

                    root.position.set(position.x, position.y, position.z);
                    root.scale.set(scale.x, scale.y, scale.z);
                    root.rotation.set(rotation.x, rotation.y, rotation.z);

                    this.scene.add(root);
                    this.objects.push(root);
                    this.setupDevUI(root);
                    resolve(root);
                },
                undefined,
                (error) => {
                    console.error('Error loading GLTF:', error);
                    reject(error);
                }
            );
        });
    }

    async loadGLBAsPoints(url, position = {x:0,y:0,z:0}, scale = {x:1,y:1,z:1}, rotation = {x:0,y:0,z:0}) {
        return new Promise((resolve, reject) => {
            this.gltfLoader.load(
                url,
                (gltf) => {
                    const root = new THREE.Group();
                    let meshCount = 0;

                    gltf.scene.traverse((child) => {
                        if (child.isMesh && child.material && child.material.map) {
                            const points = this.convertMeshToTexturedPoints(child);
                            if (points) {
                                root.add(points);
                                meshCount++;
                            }
                        }
                    });

                    if (meshCount === 0) {
                        console.warn(`No textured meshes found in ${url}`);
                    }

                    root.position.set(position.x, position.y, position.z);
                    root.scale.set(scale.x, scale.y, scale.z);
                    root.rotation.set(rotation.x, rotation.y, rotation.z);

                    this.scene.add(root);
                    this.objects.push(root);
                    this.setupDevUI(root);

                    console.log(`Loaded ${url} as ${meshCount} point clouds`);
                    resolve(root);
                },
                (progress) => {
                    console.log(`Loading ${url}: ${(progress.loaded / progress.total * 100)}%`);
                },
                (error) => {
                    console.error(`Error loading GLB ${url}:`, error);
                    reject(error);
                }
            );
        });
    }

    renderLoop() {
        requestAnimationFrame(() => this.renderLoop());
        if (this.faceLandmarker && this.video.readyState >= this.video.HAVE_CURRENT_DATA) {
            const startTimeMs = performance.now();
            const results = this.faceLandmarker.detectForVideo(this.video, startTimeMs);
            this.onResults(results);
        }
        this.updateCamera();

        // Small pulse light effect for garden models
        const time = performance.now() * 0.001;
        this.pointLight.intensity = 2.0 + Math.sin(time * 2) * 0.2;

        this.composer.render();
    }

    updateCamera() {
        if (this.config.motion.enabled) {
            this.camera.position.x = this.eyePosition.x * this.config.motion.parallaxFactor;
            this.camera.position.y = this.eyePosition.y * this.config.motion.parallaxFactor;
        }
        this.camera.lookAt(0, 0, -this.config.room.depth / 2);
    }

    async setupTracking() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            this.video.srcObject = stream;
            this.video.play();

            const vision = await FilesetResolver.forVisionTasks(
                "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
            );

            this.faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
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

    onResults(results) {
        if (results.faceLandmarks && results.faceLandmarks.length > 0) {
            const landmarks = results.faceLandmarks[0];
            const leftEye = landmarks[159];
            const rightEye = landmarks[386];

            const normX = (leftEye.x + rightEye.x) / 2;
            const normY = (leftEye.y + rightEye.y) / 2;

            this.eyePosition.x += ((0.5 - normX) * this.monitorWidth * this.config.tracking.sensitivity - this.eyePosition.x) * this.config.motion.smoothing;
            this.eyePosition.y += ((0.5 - normY) * this.monitorHeight * this.config.tracking.sensitivity - this.eyePosition.y) * this.config.motion.smoothing;
        }
    }

    createBorderTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 256;
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, 256, 256);

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        const spacingX = 256;
        const spacingY = spacingX / 2;
        for (let x = 0; x <= 256; x += spacingX) {
            ctx.moveTo(x, 0);
            ctx.lineTo(x, 256);
        }
        for (let y = 0; y <= 256; y += spacingY) {
            ctx.moveTo(0, y);
            ctx.lineTo(256, y);
        }
        ctx.stroke();

        const texture = new THREE.CanvasTexture(canvas);
        texture.magFilter = THREE.NearestFilter;
        return texture;
    }
}

// Export for use in other files
console.log("exporting room")
window.Room = Room;
// Export for use in other files
