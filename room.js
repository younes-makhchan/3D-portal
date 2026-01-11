import { FaceLandmarker, FilesetResolver } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3";



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
        sensitivity: 12.0   // Sensitivity multiplier for eye tracking
    }
};

class Room {
    constructor(config = CONFIG) {
        this.config = config;
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.composer = null;
        this.ambientLight = null;
        this.hemisphereLight = null;
        this.pointLight = null;
        this.faceLandmarker = null;
        this.video = null;
        this.eyePosition = { x: 0, y: 0, z: 60 };
        this.monitorWidth = config.monitor.width;
        this.monitorHeight = config.monitor.height;
        this.gltfLoader = new THREE.GLTFLoader();
        // Global cache for all GLB models across scenes
        if (!window.globalLoadedModels) window.globalLoadedModels = new Map();
        this.objects = []; // Keep for backward compatibility, but scenes manage their own objects
        this.currentScene = 1;
        this.currentSceneInstance = null;

        // Dynamic effects
        this.pulseRadius = 0;
        this.fireflies = null;
        this.fireflyGeometry = null;
        this.fireflyMaterial = null;
        this.globalTime = 0;

        // Clap detection
        this.audioContext = null;
        this.analyser = null;
        this.microphone = null;
        this.clapThreshold = 0.2;
        this.lastClapTime = 0;
        this.clapCooldown = 500;
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
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
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
        this.ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        this.scene.add(this.ambientLight);

        this.hemisphereLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.5);
        this.scene.add(this.hemisphereLight);

        this.pointLight = new THREE.PointLight(0xffffff, 3.0, 800);
        this.pointLight.position.set(0, 0, 10);
        this.scene.add(this.pointLight);

        this.video = document.getElementById('webcam');
       await this.setupTracking();
       await this.setupClapDetection();

        // Build the Room
        this.buildRoom();

        // Setup scene buttons
        this.setupSceneButtons();

        // Load initial scene
        await this.switchScene(1);

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

        // Initial Values for Object Controls
        get('ui-x').value = object.position.x;
        get('ui-y').value = object.position.y;
        get('ui-z').value = object.position.z;
        get('ui-rotY').value = object.rotation.y;
        get('ui-scale').value = object.scale.x;



        // Event Listeners for Object Controls
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

    async loadGLBNormal(url, position = {x:0,y:0,z:0}, scale = {x:1,y:1,z:1}, rotation = {x:0,y:0,z:0}) {
        return new Promise((resolve, reject) => {
            if (window.globalLoadedModels.has(url)) {
                // Use cached model
                const cached = window.globalLoadedModels.get(url);
                const model = cached.scene.clone();

                model.position.set(position.x, position.y, position.z);
                model.scale.set(scale.x, scale.y, scale.z);
                model.rotation.set(rotation.x, rotation.y, rotation.z);

                // Ensure materials work properly with lighting
               

                this.scene.add(model);
                this.objects.push(model);
                this.setupDevUI(model);

                let mixer = null;
                if (cached.animations && cached.animations.length > 0) {
                    mixer = new THREE.AnimationMixer(model);
                    cached.animations.forEach((clip) => {
                        const action = mixer.clipAction(clip);
                        action.loop = THREE.LoopPingPong;
                        action.timeScale = 1;
                        action.play();
                    });
                    this.animationMixers = this.animationMixers || [];
                    this.animationMixers.push(mixer);
                    console.log(`Loaded ${url} from cache with ${cached.animations.length} animations`);
                } else {
                    console.log(`Loaded ${url} from cache as static mesh`);
                }

                resolve({ model, mixer });
            } else {
                // Load new model
                this.gltfLoader.load(
                    url,
                    (gltf) => {
                        window.globalLoadedModels.set(url, gltf);
                        const model = gltf.scene;

                        model.position.set(position.x, position.y, position.z);
                        model.scale.set(scale.x, scale.y, scale.z);
                        model.rotation.set(rotation.x, rotation.y, rotation.z);

                        model.traverse((child) => {
                            if (child.isMesh && child.material) {
                                if (child.material.isMeshStandardMaterial || child.material.isMeshPhysicalMaterial) {
                                    child.material.needsUpdate = true;
                                    if (child.material.map && child.material.color && child.material.color.r === 0 && child.material.color.g === 0 && child.material.color.b === 0) {
                                        child.material.color.setRGB(1, 1, 1);
                                    }
                                }
                            }
                        });

                        this.scene.add(model);
                        this.objects.push(model);
                        this.setupDevUI(model);

                        let mixer = null;
                        if (gltf.animations && gltf.animations.length > 0) {
                            mixer = new THREE.AnimationMixer(model);
                            gltf.animations.forEach((clip) => {
                                const action = mixer.clipAction(clip);
                                action.loop = THREE.LoopPingPong;
                                action.timeScale = 0.8;
                                action.play();
                            });
                            this.animationMixers = this.animationMixers || [];
                            this.animationMixers.push(mixer);
                            console.log(`Loaded ${url} with ${gltf.animations.length} animations`);
                        } else {
                            console.log(`Loaded ${url} as static mesh`);
                        }

                        resolve({ model, mixer });
                    },
                    (progress) => {
                        console.log(`Loading ${url}: ${(progress.loaded / progress.total * 100)}%`);
                    },
                    (error) => {
                        console.error(`Error loading GLB ${url}:`, error);
                        reject(error);
                    }
                );
            }
        });
    }

    renderLoop() {
        requestAnimationFrame(() => this.renderLoop());

        // Update animation mixers
        const deltaTime = 1 / 60; // Assume 60fps for mixer updates
        if (this.animationMixers) {
            this.animationMixers.forEach(mixer => {
                mixer.update(deltaTime);
            });
        }

        if (this.faceLandmarker && this.video.readyState >= this.video.HAVE_CURRENT_DATA) {
            const startTimeMs = performance.now();
            const results = this.faceLandmarker.detectForVideo(this.video, startTimeMs);
            this.onResults(results);
        }
        this.updateCamera();

        // Update dynamic effects (fireflies, energy pulses, etc.)
        this.updateDynamicEffects();

        // Check for clap detection
        //this.checkForClap();

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

    async setupClapDetection() {
        try {
            const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.analyser = this.audioContext.createAnalyser();
            this.microphone = this.audioContext.createMediaStreamSource(audioStream);
            this.microphone.connect(this.analyser);
            this.analyser.fftSize = 256;
            console.log("Clap Detection Initialized");
        } catch (error) {
            console.error('Error accessing microphone:', error);
        }
    }

    checkForClap() {
        if (!this.analyser) return;

        const bufferLength = this.analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        this.analyser.getByteFrequencyData(dataArray);

        // Calculate average volume
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
            sum += dataArray[i];
        }
        const average = sum / bufferLength / 255; // normalize 0-1
        if(average>0.1){
            console.log("average",average)

        }
        const now = Date.now();
        if (average > this.clapThreshold && (now - this.lastClapTime) > this.clapCooldown) {
            this.lastClapTime = now;
            console.log('Clap detected! Switching scene.');
            const nextScene = (this.currentScene % 4) + 1;
            this.switchScene(nextScene);
        }
    }

    setupSceneButtons() {
        const buttons = document.querySelectorAll('.scene-btn');
        buttons.forEach(button => {
            button.addEventListener('click', () => {
                const sceneNumber = parseInt(button.dataset.scene);
                this.switchScene(sceneNumber);
            });
        });
    }

    generateRain(count) {
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(count * 3);
        const speeds = new Float32Array(count);

        for (let i = 0; i < count; i++) {
            positions[i * 3] = (Math.random() - 0.5) * 180; // X spread across room width
            positions[i * 3 + 1] = 35 + Math.random() * 10; // Y start high in room
            positions[i * 3 + 2] = (Math.random() - 0.5) * 140; // Z depth
            speeds[i] = 0.8 + Math.random() * 2.0; // Individual fall speeds
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('speed', new THREE.BufferAttribute(speeds, 1));

        // Rain material with cyan/blue color
        const material = new THREE.ShaderMaterial({
            uniforms: {
                time: { value: 0 },
                lightningFlash: { value: 0 }
            },
            vertexShader: `
                attribute float speed;
                uniform float time;
                uniform float lightningFlash;
                varying float vLightning;

                void main() {
                    vLightning = lightningFlash;

                    vec3 pos = position;
                    // Rain falling effect - reset to top when hitting bottom
                    pos.y = mod(pos.y - time * speed * 0.5, 70.0) - 35.0;

                    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
                    gl_PointSize = 2.0 + lightningFlash * 3.0; // Grow during lightning
                    gl_Position = projectionMatrix * mvPosition;
                }
            `,
            fragmentShader: `
                uniform float lightningFlash;
                varying float vLightning;

                void main() {
                    vec2 c = gl_PointCoord - vec2(0.5);
                    if (dot(c, c) > 0.25) discard;

                    // Mix between cyan rain and white lightning
                    vec3 rainColor = vec3(0.0, 1.0, 1.0); // Cyan
                    vec3 lightningColor = vec3(1.0, 1.0, 1.0); // White
                    vec3 finalColor = mix(rainColor, lightningColor, lightningFlash);

                    gl_FragColor = vec4(finalColor, 0.8);
                }
            `,
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        });

        const rain = new THREE.Points(geometry, material);
        this.rainMaterial = material;
        return rain;
    }

    triggerLightning() {
        if (this.rainMaterial) {
            // Flash effect
            this.rainMaterial.uniforms.lightningFlash.value = 1.0;

            // Fade out over time
            const fadeOut = () => {
                this.rainMaterial.uniforms.lightningFlash.value *= 0.95;
                if (this.rainMaterial.uniforms.lightningFlash.value > 0.01) {
                    requestAnimationFrame(fadeOut);
                }
            };
            fadeOut();
        }
    }

    async switchScene(sceneNumber) {
        // Update UI
        document.querySelectorAll('.scene-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-scene="${sceneNumber}"]`).classList.add('active');

        // Unload current scene
        if (this.currentSceneInstance) {
            this.currentSceneInstance.unload();
        }

        // Clear animation mixers from previous scenes
        if (this.animationMixers) {
            this.animationMixers.length = 0; // Clear the array
        }

        // Stop any existing animations
        if (this.rainAnimationId) {
            cancelAnimationFrame(this.rainAnimationId);
            this.rainAnimationId = null;
        }

        // Load new scene
        this.currentScene = sceneNumber;
        console.log(`Switching to Scene ${sceneNumber}`);

        // Create and load the appropriate scene class
        if (sceneNumber === 1) {
            this.currentSceneInstance = new Scene1(this);
            await this.currentSceneInstance.load();
        } else if (sceneNumber === 2) {
            this.currentSceneInstance = new Scene2(this);
            await this.currentSceneInstance.load();
        } else if (sceneNumber === 3) {
            this.currentSceneInstance = new Scene3(this);
            await this.currentSceneInstance.load();
        } else if (sceneNumber === 4) {
            this.currentSceneInstance = new Scene4(this);
            await this.currentSceneInstance.load();
        }
    }



    // Dynamic Effects for Living Digital World
    generateFireflies(count) {
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(count * 3);
        const colors = new Float32Array(count * 3);

        for (let i = 0; i < count; i++) {
            // Distribute fireflies throughout the room volume
            positions[i * 3] = (Math.random() - 0.5) * 160; // X: room width
            positions[i * 3 + 1] = Math.random() * 35 + 5; // Y: floor to ceiling
            positions[i * 3 + 2] = (Math.random() - 0.5) * 120; // Z: room depth

            // Warm golden/yellow colors
            colors[i * 3] = 1.0;     // R
            colors[i * 3 + 1] = 0.8 + Math.random() * 0.2; // G (vary brightness)
            colors[i * 3 + 2] = 0.2; // B
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        const material = new THREE.ShaderMaterial({
            uniforms: {
                time: { value: 0 },
                cameraPosition: { value: new THREE.Vector3() }
            },
            vertexShader: `
                attribute vec3 color;
                uniform float time;
                uniform vec3 cameraPosition;
                varying vec3 vColor;
                varying float vDistanceToCamera;

                void main() {
                    vColor = color;

                    vec3 pos = position;

                    // Slow drifting motion in lazy circles
                    pos.x += sin(time * 0.5 + position.x * 0.01) * 0.5;
                    pos.y += cos(time * 0.3 + position.y * 0.01) * 0.3;
                    pos.z += sin(time * 0.2 + position.z * 0.01) * 0.4;

                    // Calculate distance to camera for interaction glow
                    vDistanceToCamera = distance(pos, cameraPosition);

                    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
                    gl_PointSize = 3.0 + sin(time * 2.0 + position.x) * 1.0; // Gentle flickering
                    gl_Position = projectionMatrix * mvPosition;
                }
            `,
            fragmentShader: `
                varying vec3 vColor;
                varying float vDistanceToCamera;

                void main() {
                    vec2 c = gl_PointCoord - vec2(0.5);
                    if (dot(c, c) > 0.25) discard;

                    vec3 finalColor = vColor;

                    // Camera interaction glow - points near camera turn cyan
                    if (vDistanceToCamera < 15.0) {
                        float glowFactor = 1.0 - (vDistanceToCamera / 15.0);
                        finalColor = mix(finalColor, vec3(0.0, 1.0, 1.0), glowFactor * 0.7);
                    }

                    gl_FragColor = vec4(finalColor, 0.8);
                }
            `,
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            vertexColors: true
        });

        const fireflies = new THREE.Points(geometry, material);
        this.fireflyGeometry = geometry;
        this.fireflyMaterial = material;
        return fireflies;
    }

    triggerEnergyPulse() {
        console.log('🌊 Energy Pulse triggered!');
        this.pulseRadius = 0;

        // Update all garden materials with pulse effect
        this.objects.forEach(obj => {
            if (obj && obj.traverse) {
                obj.traverse((child) => {
                    if (child.isPoints && child.material && child.material.uniforms) {
                        // Add pulse uniform if it doesn't exist
                        if (!child.material.uniforms.uPulseRadius) {
                            child.material.uniforms.uPulseRadius = { value: 0 };
                        }
                    }
                });
            }
        });
    }

    updateDynamicEffects() {
        this.globalTime += 0.016; // ~60fps

        // Update fireflies
        if (this.fireflyMaterial) {
            this.fireflyMaterial.uniforms.time.value = this.globalTime;
            this.fireflyMaterial.uniforms.cameraPosition.value.copy(this.camera.position);
        }

        // Update energy pulse
        if (this.pulseRadius < 150) {
            this.pulseRadius += 1.2; // Pulse expansion speed

            // Apply pulse to all garden objects
            this.objects.forEach(obj => {
                if (obj && obj.traverse) {
                    obj.traverse((child) => {
                        if (child.isPoints && child.material && child.material.uniforms && child.material.uniforms.uPulseRadius) {
                            child.material.uniforms.uPulseRadius.value = this.pulseRadius;
                        }
                    });
                }
            });
        }

        // Random pulse triggers (every 15-30 seconds)
        if (Math.random() < 0.001 && this.currentScene === 2) { // Only in garden scene
            this.triggerEnergyPulse();
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
