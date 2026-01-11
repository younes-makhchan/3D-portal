// Scene 1: Empty Room
class Scene1 {
    constructor(room) {
        this.room = room;
        this.objects = [];
    }

    async load() {
        console.log('Scene 1: Empty room loaded');
        // Empty room - just the basic room setup (walls, floor, ceiling)
        // No additional objects needed
    }

    unload() {
        // Remove any objects if they exist
        this.objects.forEach(obj => {
            this.room.scene.remove(obj);
        });
        this.objects = [];
    }
}

// Export for use in other files
window.Scene1 = Scene1;