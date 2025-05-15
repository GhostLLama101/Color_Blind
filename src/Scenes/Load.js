class Load extends Phaser.Scene {
    constructor() {
        super("loadScene");
    }

// Tilesheet information:

// Tile size                 •  16px × 16px
// Space between tiles       •  1px × 1px
// ---
// Total tiles (horizontal)  •  20 tiles
// Total tiles (vertical)    •  20 tiles
// ---
// Total tiles in sheet      •  400 tiles

    preload() {
        this.load.setPath("./assets/");
        // maybe make a josn file to access it better
        // Load characters spritesheet
        this.load.atlas("platformer_characters", "mono_packed.png", "mono_packed.json");

        // Load tilemap information
        this.load.image("", "");              // Packed tilemap
        this.load.tilemapTiledJSON("platformer-level-1", "testFloorPlatformer.json");   // Tilemap in JSON
    }

    create() {
        this.anims.create({
            key: 'walk',
            frames: this.anims.generateFrameNames('platformer_characters', {
                prefix: "tile_",
                start: 241,
                end: 244,
                suffix: ".png",
                zeroPad: 4
            }),
            frameRate: 15,
            repeat: -1
        });

        this.anims.create({
            key: 'idle',
            defaultTextureKey: "platformer_characters",
            frames: [
                { frame: "tile_0240.png" }
            ],
            repeat: -1
        });

        this.anims.create({
            key: 'jump',
            defaultTextureKey: "platformer_characters",
            frames: [
                { frame: "tile_0245.png" }
            ],
        });

         // ...and pass to the next Scene
         this.scene.start("platformerScene");
    }

    // Never get here since a new scene is started in create()
    update() {
    }
}