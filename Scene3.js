// Scene 3: Animated Flower Scene
class Scene3 {
    constructor(room) {
        this.room = room;
        this.objects = [];
        this.animationMixers = []; // Store mixers for cleanup
        this.rainAnimationId = null;
        this.lightningIntervalId = null;
    }

    async load() {
        console.log('Scene 3: Animated flower scene loading...');

        // Load animated flower as normal mesh with animations
        const { model: flowerObject, mixer } = await this.room.loadGLBNormal('effects/simple_flower_loop.glb',
            {x: 0, y: 0, z: -50}, // Center of room
            {x: 5, y: 5, z: 5}, // Larger scale for visibility
            {x: 0, y: 0, z: 0}
        ); 

        this.objects.push(flowerObject);

        // Store mixer for cleanup if it exists
        if (mixer) {
            this.animationMixers.push(mixer);
        }

        // Enhance bloom for dramatic effect
        if (this.room.composer && this.room.composer.passes[1]) {
            this.room.composer.passes[1].strength = 2.5;
            this.room.composer.passes[1].radius = 1.2;
        }

        // Generate and add rain
        const rain = this.room.generateRain(1500); // More rain for dramatic effect
        this.room.scene.add(rain);
        this.objects.push(rain);

        // Start rain animation
        this.startRainAnimation();

        // Start random lightning strikes
        this.startLightningStrikes();

        console.log('Scene 3: Animated flower scene loaded with rain and lightning!');
    }

    startRainAnimation() {
        let time = 0;
        const animate = () => {
            time += 0.016; // ~60fps
            if (this.room.rainMaterial) {
                this.room.rainMaterial.uniforms.time.value = time;
            }
            this.rainAnimationId = requestAnimationFrame(animate);
        };
        animate();
    }

    startLightningStrikes() {
        const scheduleLightning = () => {
            // Random delay between 2-8 seconds
            const delay = 2000 + Math.random() * 6000;
            this.lightningIntervalId = setTimeout(() => {
                this.room.triggerLightning();
                if (this.room.currentScene === 3) { // Only if still in scene 3
                    scheduleLightning();
                }
            }, delay);
        };
        scheduleLightning();
    }

    unload() {
        // Reset bloom to default
        if (this.room.composer && this.room.composer.passes[1]) {
            this.room.composer.passes[1].strength = 1.5;
            this.room.composer.passes[1].radius = 1.0;
        }

        // Stop animations
        if (this.rainAnimationId) {
            cancelAnimationFrame(this.rainAnimationId);
            this.rainAnimationId = null;
        }
        if (this.lightningIntervalId) {
            clearTimeout(this.lightningIntervalId);
            this.lightningIntervalId = null;
        }

        // Remove objects
        this.objects.forEach(obj => {
            this.room.scene.remove(obj);
        });
        this.objects = [];

        // Clear rain material reference
        if (this.room.rainMaterial) {
            this.room.rainMaterial = null;
        }
    }
}

// Export for use in other files
window.Scene3 = Scene3;