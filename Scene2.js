// Scene 2: Garden Room
class Scene2 {
    constructor(room) {
        this.room = room;
        this.objects = [];
        this.fireflies = null;
    }

    async load() {
        console.log('Scene 2: Garden room loading...');

        // Initialize hybrid garden with GLB models
        const garden = new Garden();
        const gardenObject = await garden.createHybridGarden();
        this.room.scene.add(gardenObject);
        this.objects.push(gardenObject);
        this.room.setupDevUI(gardenObject);

        // Add floating fireflies to fill the empty air
        const fireflies = this.room.generateFireflies(800); // 800 fireflies
        this.room.scene.add(fireflies);
        this.fireflies = fireflies;
        this.objects.push(fireflies);

        console.log('Scene 2: Garden room loaded with floating fireflies!');
    }

    unload() {
        // Remove garden objects and fireflies
        this.objects.forEach(obj => {
            this.room.scene.remove(obj);
        });
        this.objects = [];

        // Clear firefly references
        if (this.fireflies) {
            this.fireflies = null;
        }
    }
}

// Export for use in other files
window.Scene2 = Scene2;