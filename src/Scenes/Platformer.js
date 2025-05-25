class Platformer extends Phaser.Scene {
    constructor() {
        super("platformerScene");
    }

    init() {
        this.ACCELERATION = 400;
        this.DRAG = 1000;    
        this.physics.world.gravity.y = 2000;
        this.JUMP_VELOCITY = -800;
        this.MAX_SPEED = 350; 
        this.SCALE = 2.0;
        this.CRAWL_SPEED = 75;
        this.crouching = false;
        this.cameraPan = false;

        // Progressive section system
        this.currentSection = 1;
        this.maxUnlockedSection = 1;
        this.sectionTransitioned = false;
        this.sectionGemsCollected = {}; // Track gems collected per section
    }

    preload() {
        this.load.scenePlugin('AnimatedTiles', './lib/AnimatedTiles.js', 'animatedTiles', 'animatedTiles');
    }

    create() {
        this.map = this.add.tilemap("platformer-level-1", 16, 16, 60, 50);

        this.tileset = this.map.addTilesetImage("monoChrome_tiles_packed", "platformer_tiles");

        this.groundLayer = this.map.createLayer("floor", this.tileset, 0, 0);

        let spawnPoint = this.map.findObject("Objects", obj => obj.name === "spawn");
        let playerSpawnX = 100; 
        let playerSpawnY = 600; 
        
        if (spawnPoint) {
            playerSpawnX = spawnPoint.x;
            playerSpawnY = spawnPoint.y;
        }

        this.groundLayer.setCollisionByProperty({
            collides: true
        });

        my.sprite.player = this.physics.add.sprite(
            playerSpawnX,
            playerSpawnY,
            "platformer_characters",
            "tile_0240.png"
        ).setScale(this.SCALE);

        my.sprite.player.setDepth(10);

        // Create gems organized by section
        this.createSectionGems();

        // Create doors organized by section
        this.createSectionDoors();

        my.sprite.player.setCollideWorldBounds(true);

        // Enable collision handling
        this.physics.add.collider(my.sprite.player, this.groundLayer);

        // Setup gem collision for all sections
        this.setupGemCollisions();

        // Setup door collisions for all sections
        this.setupDoorCollisions();

        let propertyCollider = (obj1, obj2) => {
            // Handle intersection with dangerous tiles
            if (obj2.properties.damage) {
                // Respawn at current section's spawn point
                let currentSpawn = this.getSectionSpawnPoint(this.currentSection);
                my.sprite.player.x = currentSpawn.x;
                my.sprite.player.y = currentSpawn.y;
                console.log("Player hit spikes! Respawning...");
                my.sprite.player.body.setVelocity(0, 0);
            }
        }

        this.physics.add.overlap(my.sprite.player, this.groundLayer, propertyCollider);

        // set up Phaser-provided cursor key input
        cursors = this.input.keyboard.createCursorKeys();

        this.input.keyboard.on('keydown-D', () => {
            this.physics.world.drawDebug = this.physics.world.drawDebug ? false : true
            this.physics.world.debugGraphic.clear()
        }, this);

        this.originalHeight = my.sprite.player.height; 

        // Define your level sections - adjust these values to match your level layout
        this.sections = {
            1: {
                bounds: { x: 0, y: 0, width: 960, height: 800 },
                cameraStart: { x: 0, y: 300 },
                spawnPoint: "spawn",
                nextSection: 2
            },
            2: {
                bounds: { x: 0, y: 0, width: 960, height: 400 },
                cameraStart: { x: 0, y: 300 },
                spawnPoint: "2spawn",
                nextSection: 3
            },
            3: {
                bounds: { x: 0, y: 0, width: 960, height: 600 },
                cameraStart: { x: 0, y: 200 },
                spawnPoint: "3spawn",
                nextSection: null // No next section (end of game)
            }
            // Add more sections as needed
        };

        // Initialize section gems tracking
        for (let sectionNum in this.sections) {
            this.sectionGemsCollected[sectionNum] = false;
        }

        // Set initial camera bounds for section 1
        let initialSection = this.sections[this.currentSection];
        this.cameras.main.setBounds(
            initialSection.bounds.x, 
            initialSection.bounds.y, 
            initialSection.bounds.width, 
            initialSection.bounds.height
        );

        // Start camera at ground level of current section
        let groundCameraY = 600;
        this.cameras.main.setScroll(
            playerSpawnX - 400, 
            groundCameraY - 300
        );

        // Set up following with custom deadzone
        this.cameras.main.startFollow(my.sprite.player, true, 0.08, 0.05);
        this.cameras.main.setDeadzone(100, 100);
        this.cameras.main.setZoom(this.SCALE + 1);
        
        this.animatedTiles.init(this.map);
    }

    createSectionGems() {
        // Create gems for each section
        this.sectionGems = {};
        this.sectionGemGroups = {};

        for (let sectionNum = 1; sectionNum <= 3; sectionNum++) {
            // Look for gems specific to this section
            this.sectionGems[sectionNum] = this.map.createFromObjects("Objects", {
                name: `GEM_S${sectionNum}`, // Gems named like GEM_S1, GEM_S2, etc.
                key: "GEMS_Tiles",
                frame: 20
            });

            // If no section-specific gems found, fall back to generic gems for section 1
            if (this.sectionGems[sectionNum].length === 0 && sectionNum === 1) {
                this.sectionGems[sectionNum] = this.map.createFromObjects("Objects", {
                    name: "GEM",
                    key: "GEMS_Tiles",
                    frame: 20
                });
            }

            // Create physics bodies and groups
            if (this.sectionGems[sectionNum].length > 0) {
                this.physics.world.enable(this.sectionGems[sectionNum], Phaser.Physics.Arcade.STATIC_BODY);
                this.sectionGemGroups[sectionNum] = this.add.group(this.sectionGems[sectionNum]);

                // Create gem animation
                this.anims.create({
                    key: `gemAnim_S${sectionNum}`,
                    frames: this.anims.generateFrameNumbers('GEMS_Tiles', {start: 20, end: 21}),
                    frameRate: 3,
                    repeat: -1
                });

                // Play animation
                this.anims.play(`gemAnim_S${sectionNum}`, this.sectionGems[sectionNum]);
            } else {
                this.sectionGemGroups[sectionNum] = this.add.group([]);
            }
        }
    }

    createSectionDoors() {
        // Create doors for each section
        this.sectionDoors = {};
        this.sectionOpenDoors = {};
        this.sectionDoorGroups = {};
        this.sectionOpenDoorGroups = {};

        for (let sectionNum = 1; sectionNum <= 3; sectionNum++) {
            // Closed doors
            this.sectionDoors[sectionNum] = this.map.createFromObjects("Objects", {
                name: `DOOR_S${sectionNum}`, // Doors named like DOOR_S1, DOOR_S2, etc.
                key: "DOOR_CLOSED",
                frame: 56,
                visible: true
            });

            // If no section-specific doors found, fall back to generic door for section 1
            if (this.sectionDoors[sectionNum].length === 0 && sectionNum === 1) {
                this.sectionDoors[sectionNum] = this.map.createFromObjects("Objects", {
                    name: "DOOR",
                    key: "DOOR_CLOSED",
                    frame: 56,
                    visible: true
                });
            }

            // Open doors
            this.sectionOpenDoors[sectionNum] = this.map.createFromObjects("Objects", {
                name: `OPEN_DOOR_S${sectionNum}`, // Open doors named like OPEN_DOOR_S1, etc.
                key: "OPEN_DOOR",
                frame: 59,
                visible: false
            });

            // If no section-specific open doors found, fall back to generic open door for section 1
            if (this.sectionOpenDoors[sectionNum].length === 0 && sectionNum === 1) {
                this.sectionOpenDoors[sectionNum] = this.map.createFromObjects("Objects", {
                    name: "OPEN_DOOR",
                    key: "OPEN_DOOR",
                    frame: 59,
                    visible: false
                });
            }

            // Create physics bodies and groups
            if (this.sectionDoors[sectionNum].length > 0) {
                this.physics.world.enable(this.sectionDoors[sectionNum], Phaser.Physics.Arcade.STATIC_BODY);
                this.sectionDoorGroups[sectionNum] = this.add.group(this.sectionDoors[sectionNum]);
            }

            if (this.sectionOpenDoors[sectionNum].length > 0) {
                this.physics.world.enable(this.sectionOpenDoors[sectionNum], Phaser.Physics.Arcade.STATIC_BODY);
                this.sectionOpenDoorGroups[sectionNum] = this.add.group(this.sectionOpenDoors[sectionNum]);
            }
        }
    }

    setupGemCollisions() {
        // Setup gem collision for each section
        for (let sectionNum in this.sectionGemGroups) {
            if (this.sectionGemGroups[sectionNum].children.size > 0) {
                this.physics.add.overlap(my.sprite.player, this.sectionGemGroups[sectionNum], 
                    (obj1, obj2) => this.collectGem(obj1, obj2, sectionNum));
            }
        }
    }

    setupDoorCollisions() {
        // Setup door collision for each section
        for (let sectionNum in this.sectionDoorGroups) {
            // Closed door collision
            if (this.sectionDoorGroups[sectionNum] && this.sectionDoorGroups[sectionNum].children.size > 0) {
                this.physics.add.overlap(my.sprite.player, this.sectionDoorGroups[sectionNum], 
                    (obj1, obj2) => this.tryEnterDoor(obj1, obj2, sectionNum));
            }

            // Open door collision
            if (this.sectionOpenDoorGroups[sectionNum] && this.sectionOpenDoorGroups[sectionNum].children.size > 0) {
                this.physics.add.overlap(my.sprite.player, this.sectionOpenDoorGroups[sectionNum], 
                    (obj1, obj2) => this.enterOpenDoor(obj1, obj2, sectionNum));
            }
        }
    }

    collectGem(player, gem, sectionNum) {
        gem.destroy();

        // Check if all gems in this section are collected
        if (this.sectionGemGroups[sectionNum].children.size === 0) {
            this.sectionGemsCollected[sectionNum] = true;
            console.log(`All gems collected in section ${sectionNum}!`);
            
            // Unlock the door for this section
            this.unlockSectionDoor(sectionNum);
            
            // Unlock next section if it exists
            let nextSection = this.sections[sectionNum].nextSection;
            if (nextSection && nextSection > this.maxUnlockedSection) {
                this.maxUnlockedSection = nextSection;
                console.log(`Section ${nextSection} unlocked!`);
            }
        }
    }

    unlockSectionDoor(sectionNum) {
        // Show open doors
        if (this.sectionOpenDoors[sectionNum]) {
            this.sectionOpenDoors[sectionNum].forEach(door => {
                door.setVisible(true);
            });
        }

        // Hide/destroy closed doors
        if (this.sectionDoors[sectionNum]) {
            this.sectionDoors[sectionNum].forEach(door => {
                door.destroy();
            });
            this.sectionDoors[sectionNum] = [];
        }
    }

    tryEnterDoor(player, door, sectionNum) {
        if (!this.sectionGemsCollected[sectionNum]) {
            // TODO: Display message "Collect all gems to unlock!"
            console.log(`Need to collect all gems in section ${sectionNum} first!`);
        }
    }

    enterOpenDoor(player, door, sectionNum) {
        if (this.sectionGemsCollected[sectionNum] && !this.sectionTransitioned) {
            let nextSection = this.sections[sectionNum].nextSection;
            
            if (nextSection && nextSection <= this.maxUnlockedSection) {
                this.sectionTransitioned = true;
                
                setTimeout(() => {
                    if (!this.cameraPan) {
                        this.cameraPan = true;
                        console.log(`Going to section ${nextSection}`);
                        
                        // Move player to next section's spawn point
                        let nextSpawn = this.getSectionSpawnPoint(nextSection);
                        my.sprite.player.x = nextSpawn.x;
                        my.sprite.player.y = nextSpawn.y;
                        
                        // Transition to next section
                        this.transitionToSection(nextSection);
                        
                        // Reset transition flags for next use
                        this.sectionTransitioned = false;
                        this.cameraPan = false;
                    }
                }, 2000);
            } else if (!nextSection) {
                console.log("Congratulations! You've completed all sections!");
                // TODO: Add game completion logic
            } else {
                console.log(`Section ${nextSection} is still locked!`);
            }
        }
    }

    getSectionSpawnPoint(sectionNum) {
        let spawnName = this.sections[sectionNum].spawnPoint;
        let spawnPoint = this.map.findObject("Objects", obj => obj.name === spawnName);
        
        if (spawnPoint) {
            return { x: spawnPoint.x, y: spawnPoint.y };
        } else {
            // Fallback spawn point
            return { x: 100, y: 600 };
        }
    }

    transitionToSection(sectionNumber) {
        this.currentSection = sectionNumber;
        let newSection = this.sections[sectionNumber];
        
        // Update camera bounds to new section
        this.cameras.main.setBounds(
            newSection.bounds.x,
            newSection.bounds.y, 
            newSection.bounds.width,
            newSection.bounds.height
        );
        
        // Smoothly pan camera to new section's starting position
        this.cameras.main.pan(
            newSection.cameraStart.x + newSection.bounds.width/2,
            newSection.cameraStart.y + newSection.bounds.height/2,
            1000,
            'Power2'
        );
        
        console.log(`Transitioned to section ${sectionNumber}`);
    }

    update() {
        let canStandUp = true;
        if(this.crouching) {
            const tileAbove = this.groundLayer.getTileAtWorldXY(
                my.sprite.player.x, 
                my.sprite.player.y - this.originalHeight/2, 
                true
            );
            if(tileAbove && tileAbove.properties.collides) {
                canStandUp = false;
            }

            this.MAX_SPEED = this.CRAWL_SPEED;
        } else {
            this.MAX_SPEED = 350;
        }

        if(cursors.down.isDown && my.sprite.player.body.blocked.down){
            my.sprite.player.anims.play('crouch', true);
        
            if(!this.crouching){
                this.crouching = true;

                let crouchHeight = my.sprite.player.height/2;
                let offsetY = my.sprite.player.height - crouchHeight; 

                my.sprite.player.body.setSize(my.sprite.player.width, crouchHeight, false);
                my.sprite.player.body.setOffset(0, offsetY);
            }
            
        } else if(this.crouching && (!cursors.down.isDown || !my.sprite.player.body.blocked.down) && canStandUp) {
            this.crouching = false;
            
            my.sprite.player.body.setSize(my.sprite.player.width, this.originalHeight, false);
            my.sprite.player.body.setOffset(0, 0);
        }
        
        if(cursors.left.isDown) {
            if(my.sprite.player.body.velocity.x > 0) {
                my.sprite.player.body.setVelocityX(my.sprite.player.body.velocity.x * 0.5);
            }
            my.sprite.player.body.setAccelerationX(-this.ACCELERATION);
            my.sprite.player.setFlip(true, false);
            my.sprite.player.anims.play('walk', true);

            if(this.crouching){
                my.sprite.player.body.setSize(my.sprite.player.width, my.sprite.player.height * 0.5, false);
                my.sprite.player.anims.play('crouch',true);
            } 
            if (my.sprite.player.body.velocity.x < -this.MAX_SPEED) {
                my.sprite.player.body.velocity.x = -this.MAX_SPEED;
            }

        } else if(cursors.right.isDown) {
            if(my.sprite.player.body.velocity.x < 0) {
                my.sprite.player.body.setVelocityX(my.sprite.player.body.velocity.x * 0.5);
            }
            my.sprite.player.body.setAccelerationX(this.ACCELERATION);
            my.sprite.player.resetFlip();
            my.sprite.player.anims.play('walk', true);

            if(this.crouching){
                my.sprite.player.body.setSize(my.sprite.player.width, my.sprite.player.height * 0.5, false);
                my.sprite.player.anims.play('crouch',true);
            }
            if (my.sprite.player.body.velocity.x > this.MAX_SPEED) {
                my.sprite.player.body.velocity.x = this.MAX_SPEED;
            }

        } else if(this.crouching && cursors.down.isDown) {
            my.sprite.player.body.setAccelerationX(0);
            my.sprite.player.body.setDragX(this.DRAG);
            my.sprite.player.anims.play('crouch');

        } else {
            my.sprite.player.body.setAccelerationX(0);
            my.sprite.player.body.setDragX(this.DRAG);
            if(canStandUp){
                my.sprite.player.anims.play('idle');
            }
        }

        if(!canStandUp){
            cursors.up.enabled = false;
        }
        else {
            cursors.up.enabled = true;
        }
        if(!my.sprite.player.body.blocked.down) {
            my.sprite.player.anims.play('jump');
        }
        if(my.sprite.player.body.blocked.down && Phaser.Input.Keyboard.JustDown(cursors.up)) {
            my.sprite.player.body.setVelocityY(this.JUMP_VELOCITY);
        }
    }
}