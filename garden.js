// Export for use in other files
window.Garden = class Garden {
    constructor() {
        this.objects = [];
    }

    createMasterGarden() {
        const totalPoints = 1200000; // High density including lush grass meadow
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(totalPoints * 3);
        const colors = new Float32Array(totalPoints * 3);
        const color = new THREE.Color();

        let offset = 0;

        // --- 1. PLANT THE GRASS MEADOW FIRST (Base Layer) ---
        offset = this.generateGrassMeadow(positions, colors, offset, 300000);

        // --- 2. GENERATE CONTRASTING TREES ---
        offset = this.generatePineTree(positions, colors, offset, {x: -25, y: -22, z: -45}, 80000); // Left: Sharp Pine (Structure)
        offset = this.generateWeepingWillow(positions, colors, offset, {x: 25, y: -22, z: -40}, 150000); // Right: Flowing Willow (Chaos)

        // --- 3. GENERATE 4 DENSE BUSHES ---
        for (let b = 0; b < 4; b++) {
            const bushPos = { x: -30 + (b * 20), y: -22, z: -30 };
            offset = this.generateBushData(positions, colors, offset, bushPos, 20000);
        }

        // --- 4. GENERATE 300 TALL, COMPLETE FLOWERS (On Top of Grass) ---
        const groundLevel = -22;

        for (let f = 0; f < 300; f++) {
            // 1. Pick a spot on the floor
            const flowerX = (Math.random() - 0.5) * 80;
            const flowerZ = -40 - (Math.random() * 20);

            // 2. Decide on a random height for this flower (e.g., 3 to 8 units tall)
            const stemHeight = 3 + Math.random() * 5;

            // 3. GENERATE THE STEM (Green stalk growing up from the ground)
            const stemBase = { x: flowerX, y: groundLevel, z: flowerZ };
            // Use ~300 points for a solid stem
            offset = this.generateStem(positions, colors, offset, stemBase, stemHeight, 300);

            // 4. GENERATE THE FLOWER HEAD (At the TOP of the stem)
            const flowerHeadPos = {
                x: flowerX,
                y: groundLevel + stemHeight, // Position at the top of the stem
                z: flowerZ
            };
            // Pick a vibrant, random color
            const flowerColor = new THREE.Color().setHSL(Math.random(), 0.8, 0.6);
            // Use ~1500 points for a detailed, volumetric petal head
            offset = this.generateFlowerData(positions, colors, offset, flowerHeadPos, flowerColor, 1500);
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        const material = new THREE.PointsMaterial({
            size: 0.06,             // Smaller points prevent the "blob" look
            vertexColors: true,
            transparent: true,
            opacity: 0.7,           // Increased for shinier appearance
            blending: THREE.AdditiveBlending,
            depthWrite: true,       // Enable depth writing to prevent clipping issues
            sizeAttenuation: true   // Crucial for depth perception
        });

        const garden = new THREE.Points(geometry, material);
        return garden;
    }

    // --- GENERATE STEM (Green Stalk) ---
    generateStem(positions, colors, offset, basePos, height, count) {
        for (let i = 0; i < count; i++) {
            const pIdx = (offset++) * 3;
            if (pIdx >= positions.length) break;

            const t = i / count; // 0 at base, 1 at top
            const currentY = basePos.y + (t * height);

            // Add a slight, natural wiggle to the stem
            const jitterX = Math.sin(t * 12) * 0.15;
            const jitterZ = Math.cos(t * 12) * 0.15;

            positions[pIdx] = basePos.x + jitterX;
            positions[pIdx + 1] = currentY;
            positions[pIdx + 2] = basePos.z + jitterZ;

            // Color: Green gradient, getting lighter towards the top
            colors[pIdx] = 0.3;
            colors[pIdx + 1] = 0.7 + (t * 0.3);
            colors[pIdx + 2] = 0.3;
        }
        return offset;
    }

    // --- GENERATE FLOWER DATA (3D Cup-Shaped Petals) ---
    generateFlowerData(positions, colors, offset, pos, col, count) {
        const petals = 5 + Math.floor(Math.random() * 4); // 5 to 8 petals
        const radiusScale = 1.2 + Math.random() * 0.8; // How wide the flower is

        for (let i = 0; i < count; i++) {
            const pIdx = (offset++) * 3;
            if (pIdx >= positions.length) break;

            const angle = Math.random() * Math.PI * 2;
            // Rose curve math for petal shape
            const r = Math.cos(petals * angle) * Math.random() * radiusScale;

            const x = Math.cos(angle) * r;
            const z = Math.sin(angle) * r;

            // THE KEY CHANGE FOR HEIGHT:
            // This formula makes the petals curve upwards into a cup shape.
            // The '2.0' multiplier controls how tall the flower cup is.
            const y = Math.pow(Math.abs(r) / radiusScale, 1.5) * 2.0;

            positions[pIdx] = pos.x + x;
            positions[pIdx + 1] = pos.y + y; // Add the cup height to the base position
            positions[pIdx + 2] = pos.z + z;

            // Color gradient: darker at the center, brighter at the petal tips
            const brightness = 0.7 + (y / 2.0) * 0.5;
            colors[pIdx] = col.r * brightness;
            colors[pIdx + 1] = col.g * brightness;
            colors[pIdx + 2] = col.b * brightness;
        }
        return offset;
    }

    // --- GENERATE PINE TREE DATA (Conical Structure) ---
    generatePineTree(positions, colors, offset, pos, totalPoints) {
        const trunkPoints = Math.floor(totalPoints * 0.2);
        const leafPoints = totalPoints - trunkPoints;
        const height = 35; // Tall, majestic pine
        const baseWidth = 12;

        // --- 1. THE CENTRAL TRUNK ---
        for (let i = 0; i < trunkPoints; i++) {
            const pIdx = (offset++) * 3;
            const t = Math.random(); // Height factor (0 to 1)
            const currHeight = t * height;

            // Trunk tapers as it goes up
            const trunkRad = 1.8 * (1 - t * 0.9);
            const angle = Math.random() * Math.PI * 2;

            // Add "Bark Noise" for complexity
            const noise = (Math.random() - 0.5) * 0.2;

            positions[pIdx] = pos.x + Math.cos(angle) * (trunkRad + noise);
            positions[pIdx+1] = pos.y + currHeight;
            positions[pIdx+2] = pos.z + Math.sin(angle) * (trunkRad + noise);

            // Dark, textured bark color
            colors[pIdx] = 0.12; colors[pIdx+1] = 0.08; colors[pIdx+2] = 0.05;
        }

        // --- 2. THE CONICAL TIERS (Branches & Needles) ---
        const tiers = 12; // Number of horizontal branch levels
        const pointsPerTier = Math.floor(leafPoints / tiers);

        for (let j = 0; j < tiers; j++) {
            const tierLevel = j / tiers; // 0 at bottom, 1 at top
            const tierHeight = (tierLevel * height * 0.8) + (height * 0.15);
            const tierMaxRadius = baseWidth * (1 - tierLevel); // Pyramidal shape

            for (let k = 0; k < pointsPerTier; k++) {
                const pIdx = (offset++) * 3;
                if (pIdx >= positions.length) break;

                // Spiral distribution within the tier
                const angle = Math.random() * Math.PI * 2;
                const dist = Math.pow(Math.random(), 1.5) * tierMaxRadius;

                // Drooping effect (pine branches often dip down at the ends)
                const droop = Math.sin(dist * 0.5) * 2;

                positions[pIdx] = pos.x + Math.cos(angle) * dist;
                positions[pIdx+1] = pos.y + tierHeight - droop + (Math.random() - 0.5) * 1.5;
                positions[pIdx+2] = pos.z + Math.sin(angle) * dist;

                // Color: Deep Forest Green to Pine Needle Cyan
                const greenVariety = Math.random();
                colors[pIdx] = 0.0;
                colors[pIdx+1] = 0.3 + (greenVariety * 0.3);
                colors[pIdx+2] = 0.1 + (greenVariety * 0.2);
            }
        }
        return offset;
    }

    // --- GENERATE WEEPING WILLOW DATA (Volumetric Trunk + Cascades) ---
    generateWeepingWillow(positions, colors, offset, pos, totalPoints) {
        const trunkPoints = Math.floor(totalPoints * 0.3);
        const vinePoints = totalPoints - trunkPoints;

        // --- 1. THE VOLUMETRIC TRUNK (Bark Volume) ---
        offset = this.generateTrunk(positions, colors, offset, pos, 16, 2.2);

        // --- 2. THE SPREADING CROWN ---
        const growSpreadingBranch = (start, parentAngle, length, depth) => {
            if (depth <= 0) return;
            const points = 4000;
            const end = { x: 0, y: 0, z: 0 };

            // --- BRANCH DIRECTION LOGIC ---
            // Instead of pure random, we use the parent angle + a spread
            const horizontalSpread = 2.5; // High value = wide tree
            const upwardForce = 0.5;      // Lower value = branches grow flatter/outward

            const dirX = Math.cos(parentAngle) * horizontalSpread * 0.5;
            const dirZ = Math.sin(parentAngle) * horizontalSpread;
            const dirY = upwardForce + Math.random() ;

            for (let i = 0; i < points; i++) {
                const pIdx = (offset++) * 3;
                const t = i / points;

                // Twist and Thickness
                const twist = Math.sin(t * 3 + depth) * 1.5;
                const radius = 0.8 * (1 - t * 0.5);
                const rAngle = Math.random() * Math.PI * 2;
                const rDist = Math.sqrt(Math.random()) * radius;

                positions[pIdx] = start.x + (dirX * length * t) + Math.cos(rAngle) * rDist + twist;
                positions[pIdx+1] = start.y + (dirY * length * t) + Math.sin(rAngle) * rDist;
                positions[pIdx+2] = start.z + (dirZ * length * t) + Math.cos(rAngle) * rDist + twist;

                colors[pIdx] = 0.08; colors[pIdx+1] = 0.1; colors[pIdx+2] = 0.08;

                if (i === points - 1) { end.x = positions[pIdx]; end.y = positions[pIdx+1]; end.z = positions[pIdx+2]; }
            }

            // --- DROP VINES ---
            if (depth < 3) {
                for (let v = 0; v < 12; v++) {
                    const vStart = { x: end.x + (Math.random()-0.5)*4, y: end.y, z: end.z + (Math.random()-0.5)*4 };
                    offset = this.dropVine(positions, colors, offset, vStart, 1200);
                }
            }

            // --- SPLIT LOGIC (FORCED SPREAD) ---
            const splits = 2;
            for (let s = 0; s < splits; s++) {
                // Force children to go left and right of the parent direction
                const angleOffset = (s === 0) ? 0.8 : -0.8;
                growSpreadingBranch(end, parentAngle + angleOffset, length * 0.8, depth - 1);
            }
        };

        // --- THE STARTING CROWN ---
        // Instead of calling it once, start 4 main branches in 4 different directions
        const trunkTop = { x: pos.x, y: pos.y + 15, z: pos.z };
        for (let i = 0; i < 4; i++) {
            const startAngle = (i / 4) * Math.PI * 2; // 0, 90, 180, 270 degrees
            growSpreadingBranch(trunkTop, startAngle, 4, 2);
        }
        return offset;
    }

    // --- GENERATE TRUNK (Volumetric Cylinder with Bark Texture) ---
    generateTrunk(positions, colors, offset, pos, height, baseRadius) {
        const pointsPerLevel = 120; // Dense for solid look
        const levels = 200;
        const color = new THREE.Color();

        for (let i = 0; i < levels; i++) {
            const t = i / levels; // Height factor (0 to 1)
            const currY = t * height;

            // TAPERING: Trunk gets thinner as it goes up
            const currRadius = baseRadius * (1 - t * 0.7);

            for (let j = 0; j < pointsPerLevel; j++) {
                const pIdx = (offset++) * 3;
                if (pIdx >= positions.length) break;

                // VOLUME MATH: Fill the inside of the circle evenly
                const angle = Math.random() * Math.PI * 2;
                // Use Math.sqrt for even distribution across the circle area
                const r = Math.sqrt(Math.random()) * currRadius;

                // BARK NOISE: Make it look gnarled, not a smooth pipe
                const jitter = (Math.random() - 0.5) * 0.3;

                positions[pIdx] = pos.x + Math.cos(angle) * r + jitter;
                positions[pIdx+1] = pos.y + currY;
                positions[pIdx+2] = pos.z + Math.sin(angle) * r + jitter;

                // COLOR: Darker at the bottom, slightly lighter at top
                const darkness = 0.05 + (t * 0.1);
                color.setHSL(0.1, 0.5, darkness); // Brownish/Grey tones

                colors[pIdx] = color.r;
                colors[pIdx+1] = color.g;
                colors[pIdx+2] = color.b;
            }
        }
        return offset;
    }

    // --- DROP VINE (Volumetric Misty Clouds) ---
    dropVine(positions, colors, offset, start, count) {
        const vineLength = 15 + Math.random() * 15;
        const color = new THREE.Color();

        for (let i = 0; i < count; i++) {
            const pIdx = (offset++) * 3;
            if (pIdx >= positions.length) break;

            const t = i / count;

            // MISTAKE FIX: Instead of a straight line, we use a "Volume"
            // We add random spread that increases as the vine goes down
            const spread = 0.8 + (t * 1.5);
            const angle = Math.random() * Math.PI * 2;
            const radius = Math.sqrt(Math.random()) * spread;

            // Position with swaying and volume
            const sway = Math.sin(t * 5 + start.x) * 0.5;
            positions[pIdx] = start.x + Math.cos(angle) * radius + sway;
            positions[pIdx+1] = start.y - (t * vineLength); // Drops DOWN
            positions[pIdx+2] = start.z + Math.sin(angle) * radius + sway;

            // MISTAKE FIX: Deep HSL Colors (Avoid pure white)
            // Reference photo has purples and cyans mixed in
            const hue = 0.5 + Math.random()*0.1; // Subtle color variation
            color.setHSL(hue, 0.8, 0.3); // Deep rich colors

            colors[pIdx] = color.r;
            colors[pIdx+1] = color.g;
            colors[pIdx+2] = color.b;
        }
        return offset;
    }

    // --- GENERATE GRASS MEADOW (Lush Floor Covering) ---
    generateGrassMeadow(positions, colors, offset, count) {
        const color = new THREE.Color();
        const roomWidth = 90; // Match room dimensions
        const roomDepth = 70;

        for (let i = 0; i < count; i++) {
            const pIdx = (offset++) * 3;
            if (pIdx >= positions.length) break;

            // 1. POSITION: Spread across the entire floor
            const x = (Math.random() - 0.5) * roomWidth;
            const z = (Math.random() - 1) * roomDepth;

            // 2. HEIGHT: Small variation to look like grass blades
            // Using Math.pow(Math.random(), 3) keeps most points very close to the floor
            const y = -22 + (Math.pow(Math.random(), 5) * 1);

            positions[pIdx] = x;
            positions[pIdx + 1] = y;
            positions[pIdx + 2] = z;

            // 3. COLOR: Mix of deep forest greens and bright lime
            // HSL: 0.25 to 0.35 is the "Green" range with dark baseline
            const hue = 0.25 + (Math.random() * 0.1);
            const saturation = 0.5 + (Math.random() * 0.4);
            const lightness = 0.3 + (Math.random() * 0.4); // Increased for shinier appearance

            color.setHSL(hue, saturation, lightness);

            colors[pIdx] = color.r;
            colors[pIdx + 1] = color.g;
            colors[pIdx + 2] = color.b;
        }
        return offset;
    }

    // --- GENERATE BUSH DATA ---
    generateBushData(positions, colors, offset, pos, count) {
        for (let i = 0; i < count; i++) {
            const pIdx = (offset + i) * 3;
            const angle = Math.random() * Math.PI * 2;
            const radius = Math.random() * 8;
            const height = Math.pow(Math.random(), 2) * 6; // Denser at bottom

            const x = Math.cos(angle) * radius;
            const z = Math.sin(angle) * radius;
            const y = height;

            positions[pIdx] = pos.x + x;
            positions[pIdx + 1] = pos.y + y;
            positions[pIdx + 2] = pos.z + z;

            // Dark green with occasional flowers
            if (Math.random() > 0.95) {
                colors[pIdx] = 1.0; colors[pIdx + 1] = 0.5; colors[pIdx + 2] = 1.0; // Magenta flowers
            } else {
                colors[pIdx] = 0.1; colors[pIdx + 1] = 0.3; colors[pIdx + 2] = 0.1; // Brighter green
            }
        }
        return offset + count;
    }

    // --- LOAD GLB MODEL AS TEXTURED POINTS ---
    async loadGLBModel(url, position = {x:0,y:0,z:0}, scale = {x:1,y:1,z:1}, rotation = {x:0,y:0,z:0},pointSize=0.02,pointMany=2000.0) {
        return new Promise((resolve, reject) => {
            const loader = new THREE.GLTFLoader();

            loader.load(
                url,
                (gltf) => {
                    const root = new THREE.Group();
                    let meshCount = 0;

                    gltf.scene.traverse((child) => {
                        if (child.isMesh && child.material && child.material.map) {
                            // Convert mesh to textured points using the shader
                            const texture = child.material.map;
                            texture.colorSpace = THREE.SRGBColorSpace;
                            console.log(pointSize,pointMany)
                            const material = new THREE.ShaderMaterial({
                                uniforms: {
                                    map: { value: texture }
                                },
                                vertexShader: `
                                    varying vec2 vUv;
                                    void main() {
                                        vUv = uv;
                                        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                                        gl_PointSize =${''+pointSize} * (${''+pointMany+".0"} / -mvPosition.z);
                                        gl_Position = projectionMatrix * mvPosition;
                                    }
                                `,
                                fragmentShader: `
                                    uniform sampler2D map;
                                    varying vec2 vUv;
                                    void main() {
                                        vec2 c = gl_PointCoord - vec2(0.5);
                                        if (dot(c, c) > 0.25) discard;
                                        vec4 texColor = texture2D(map, vUv);
                                        if (texColor.a < 0.1) discard;
                                        gl_FragColor = texColor * 1.6;
                                    }
                                `,
                                transparent: true,
                                depthWrite: true
                            });

                            const points = new THREE.Points(child.geometry, material);

                            // Preserve mesh transforms
                            points.position.copy(child.position);
                            points.rotation.copy(child.rotation);
                            points.scale.copy(child.scale);

                            root.add(points);
                            meshCount++;
                        }
                    });

                    if (meshCount === 0) {
                        console.warn(`No textured meshes found in ${url}`);
                    }

                    // Apply root transforms
                    root.position.set(position.x, position.y, position.z);
                    root.scale.set(scale.x, scale.y, scale.z);
                    root.rotation.set(rotation.x, rotation.y, rotation.z);

                    console.log(`Loaded ${url} as ${meshCount} textured point clouds`);
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

    // --- HYBRID GARDEN: PROCEDURAL + GLB MODELS ---
    async createHybridGarden() {
        const totalPoints = 800000; // Reduced for hybrid approach
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(totalPoints * 3);
        const colors = new Float32Array(totalPoints * 3);
        const color = new THREE.Color();

        let offset = 0;

        // 1. GRASS MEADOW (Base layer)
        offset = this.generateGrassMeadow(positions, colors, offset, 500000);

        // 2. PROCEDURAL BUSHES (Fill in areas)
        for (let b = 0; b < 2; b++) {
            const bushPos = { x: -40 + (b * 80), y: -22, z: -20 };
            offset = this.generateBushData(positions, colors, offset, bushPos, 15000);
        }

        // 3. SOME PROCEDURAL FLOWERS
        

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        const material = new THREE.PointsMaterial({
            size: 0.03,
            vertexColors: true,
            transparent: true,
            opacity: 0.3,
            blending: THREE.AdditiveBlending,
            depthWrite: true,
            sizeAttenuation: true
        });

        const garden = new THREE.Points(geometry, material);

        // ADD GLB MODELS AS POINTS
        try {
            //const grassPoints = await this.loadGLBModel('http://localhost:8000/grass.glb', {x: 0, y: -20, z: -35}, {x: 40, y: 30, z: 10},{x: 0.1, y: 0, z: 0},0.02,4000.0);
            //garden.add(grassPoints);
            // Load flower GLB as points
            const orangeFlower = await this.loadGLBModel('http://localhost:8000/flower.glb', {x: -25, y: 15, z: -30}, {x: 10, y: 10, z: 10},{x:0,y:0,z:3},0.03,2000.0);
            garden.add(orangeFlower);
            //const orangeFlower1 = await this.loadGLBModel('http://localhost:8000/flower.glb', {x: -8, y: -13, z: -29}, {x: 10, y: 10, z: 10},{x:0,y:0,z:0},0.03,2000.0);
            //garden.add(orangeFlower1);
            //const orangeFlower2 = await this.loadGLBModel('http://localhost:8000/flower.glb', {x: -20, y: -13, z: -32}, {x: 10, y: 10, z: 10},{x:0,y:0,z:0},0.03,2000.0);
            //garden.add(orangeFlower2);
            //const redFlower = await this.loadGLBModel('http://localhost:8000/red_flower.glb', {x: -5, y: -13, z: -35}, {x: 20, y: 100, z: 20},{x:0,y:0,z:0},0.03,5000.0);
            //garden.add(redFlower);
            const whiteFlower1 = await this.loadGLBModel('http://localhost:8000/white_flower.glb', {x: -25, y: -15, z: -28}, {x: 20, y: 20, z: 20},{x:0,y:0,z:0},0.03,4000.0);
            garden.add(whiteFlower1);
            const whiteFlower2 = await this.loadGLBModel('http://localhost:8000/white_flower.glb', {x: 5, y: -13, z: -23}, {x: 20, y: 20, z: 20},{x:0,y:0,z:0},0.02,4000.0);
            garden.add(whiteFlower2);
            //const whiteFlower7 = await this.loadGLBModel('http://localhost:8000/white_flower.glb', {x: -3, y: 10, z: -23}, {x: 20, y: 20, z: 20},{x:0,y:0,z:3},0.02,4000.0);
            //garden.add(whiteFlower7);

            //const whiteFlower3 = await this.loadGLBModel('http://localhost:8000/white_flower.glb',{ x: 12, y: -13, z: -22}, {x: 20, y: 20, z: 20},{x:0,y:0,z:0},0.02,4000.0);
            //garden.add(whiteFlower3);
            const whiteFlower4 = await this.loadGLBModel('http://localhost:8000/white_flower.glb', { x: 17, y: -13, z: -32}, {x: 20, y: 20, z: 20},{x:0,y:0,z:0},0.02,4000.0);
            garden.add(whiteFlower4);
 
            const whiteFlower5 = await this.loadGLBModel('http://localhost:8000/white_flower.glb', { x: -3, y: -13, z: -35}, {x: 20, y: 20, z: 20},{x:0,y:0,z:0},0.02,4000.0);
            garden.add(whiteFlower5);
            const whiteFlower6 = await this.loadGLBModel('http://localhost:8000/white_flower.glb', { x: -10, y: -13, z: -33}, {x: 20, y: 20, z: 20},{x:0,y:0,z:0},0.02,4000.0);
            garden.add(whiteFlower6);
            const whiteFlower8 = await this.loadGLBModel('http://localhost:8000/white_flower.glb', { x: -2, y: -16, z: -32}, {x: 15, y: 15, z: 15},{x:0,y:0,z:0},0.02,4000.0);
            garden.add(whiteFlower8);
            const whiteFlower9 = await this.loadGLBModel('http://localhost:8000/white_flower.glb', { x: -8, y: -16, z: -28}, {x: 10, y: 10, z: 10},{x:0,y:0,z:0},0.02,2000.0);
            garden.add(whiteFlower9);
            //bush

            const pinkBush1 = await this.loadGLBModel('http://localhost:8000/pink_bush.glb', {x: -20, y: -13, z: -30}, {x: 10, y: 10, z: 10});
            garden.add(pinkBush1);
            const pinkBush2 = await this.loadGLBModel('http://localhost:8000/pink_bush.glb', {x: 0, y: -13, z: -36}, {x: 10, y: 10, z: 10});
            garden.add(pinkBush2);  
            const pinkBush = await this.loadGLBModel('http://localhost:8000/pink_bush.glb', {x: 20, y: -13, z: -30}, {x: 10, y: 10, z: 10});
            garden.add(pinkBush);
            const desertBush = await this.loadGLBModel('http://localhost:8000/desert_bush.glb', {x: 18, y: -7, z: -36}, {x: 8, y: 8, z: 8},{x: 0.0, y: 0, z: 0},0.02,2000.0);
            garden.add(desertBush);
            const tallBush = await this.loadGLBModel('http://localhost:8000/tall_bush.glb', {x: 25, y: -10, z: -27}, {x: 20, y: 20, z: 20},{x: 0.0, y: 10, z: 0},0.03,2000.0);
            garden.add(tallBush);
            // const tallestBush = await this.loadGLBModel('http://localhost:8000/tallest_bush.glb', {x: -4, y: -10, z: -27}, {x: 15, y: 15, z: 15},{x: 0.0, y: 10, z: 0},0.03,4000.0);
            //garden.add(tallestBush);
             const redBush = await this.loadGLBModel('http://localhost:8000/red_bush.glb', {x: 5, y: -11.2, z: -27}, {x: 10, y: 10, z: 10},{x: 0.1, y: 10, z: 0},0.03,2000.0);
             garden.add(redBush);
            // const randBush = await this.loadGLBModel('http://localhost:8000/rand_bush.glb', {x: -20, y: -10, z: -35}, {x: 10, y: 10, z: 10});
            // garden.add(randBush)
            // const smallBush = await this.loadGLBModel('http://localhost:8000/small_bush.glb', {x: -10, y: -10, z: -35}, {x: 10, y: 10, z: 10});
            // garden.add(smallBush) 
            // Load tree GLB as points
            
            //Tree
            //const treePoints = await this.loadGLBModel('http://localhost:8000/trees.glb', {x: 0, y: -17, z: -35}, {x: 35, y: 35, z: 35},{x: 0, y: 5.5, z: 0});
            //garden.add(treePoints);
            const simpleTreePoints1 = await this.loadGLBModel('http://localhost:8000/simple_tree.glb', {x: 0, y: 4, z: -35}, {x: 25, y: 25, z: 26},{x: 0, y: 0, z: 0},0.02,10000.0);
            garden.add(simpleTreePoints1);

            const simpleTreePoints = await this.loadGLBModel('http://localhost:8000/simple_tree.glb', {x: -20, y: -5, z: -35}, {x: 20, y: 20, z: 20},{x: 0, y: 5.5, z: 0},0.03,8000.0);
            garden.add(simpleTreePoints);
            console.log('Hybrid garden created with procedural elements + GLB models');
        } catch (error) {
            console.warn('Could not load GLB models, using procedural only:', error);
        }

        return garden;
    }
}
