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
        // Load characters spritesheet
        this.load.atlas("platformer_characters", "monoChromeCharacter_packed.png", "monoChromeCharacter_packed.json");

        // Load tilemap information
        this.load.image("platformer_tiles", "monoChrome_tiles_packed.png");

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

        this.anims.create({
            key: 'crouch',
            defaultTextureKey: "platformer_characters",
            frames: [
                { frame: "tile_0246.png"}
            ],
        });

        this.scene.start("platformerScene");
    }
}