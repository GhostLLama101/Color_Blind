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
        this.PARTICLE_VELOCITY = 50;
        this.wasGrounded = true;
        this.walkSoundTimer = 0;
        this.WALK_SOUND_DELAY = 400; 
        this.gameStarted = false;
        this.currentSection = 1;
        this.maxUnlockedSection = 1;
        this.sectionTransitioned = false;
        this.sectionGemsCollected = {}; 
    }

    preload() {
        this.load.scenePlugin('AnimatedTiles', './lib/AnimatedTiles.js', 'animatedTiles', 'animatedTiles');
    }

    create() {
        this.map = this.add.tilemap("platformer-level-1", 16, 16, 180, 60);

        this.tileset = this.map.addTilesetImage("monoChrome_tiles_packed", "platformer_tiles");

        this.groundLayer = this.map.createLayer("floor", this.tileset, 0, 0);
        this.backgroundLayer = this.map.createLayer("background",this.tileset,0,0);

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

        this.physics.world.setBounds(0, 0, this.map.widthInPixels, this.map.heightInPixels);

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

        // this.input.keyboard.on('keydown-D', () => {
        //     this.physics.world.drawDebug = this.physics.world.drawDebug ? false : true
        //     this.physics.world.debugGraphic.clear()
        // }, this);

        this.originalHeight = my.sprite.player.height; 

        // Define your level sections - adjust these values to match your level layout
        this.sections = {
            1: {
                bounds: { x: 0, y: 400, width: 960, height: 400 },
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
                bounds: { x: 912, y: 0, width: 960, height: 400 },
                cameraStart: { x: 0, y: 300 },
                spawnPoint: "3spawn",
                nextSection: 4 // No next section (end of game)
            },
            4: {
                bounds: { x: 912, y: 400, width: 960, height: 400 },
                cameraStart: { x: 0, y: 300 },
                spawnPoint: "4spawn",
                nextSection: 5 
            },
            5: {
                bounds: { x: 912*2, y: 400, width: 1060, height: 400 },
                cameraStart: { x: 0, y: 300 },
                spawnPoint: "5spawn",
                nextSection: 6 
            },
            6: {
                bounds: { x: 912*2, y: 0, width: 1060, height: 400 },
                cameraStart: { x: 0, y: 300 },
                spawnPoint: "6spawn",
                nextSection: null 
            }
        };

        // Initialize section gems tracking
        for (let sectionNum in this.sections) {
            this.sectionGemsCollected[sectionNum] = false;
        }

        // SECTIONED CAMERA MODE - Focus on bottom left section (Section 1)
        let initialSection = this.sections[this.currentSection];
        this.cameras.main.setBounds(
            initialSection.bounds.x, 
            initialSection.bounds.y, 
            initialSection.bounds.width, 
            initialSection.bounds.height
        );

        // Position camera to show the bottom left section properly
        this.cameras.main.setScroll(
            initialSection.bounds.x, 
            initialSection.bounds.y
        );

        // Set up following with custom deadzone
        this.cameras.main.startFollow(my.sprite.player, true, 0.08, 0.05);
        this.cameras.main.setDeadzone(100, 100);
        this.cameras.main.setZoom(3); // Adjusted zoom for better view
        
        this.animatedTiles.init(this.map);

        my.vfx.walking = this.add.particles(0, 0, "kenny-particles", {
            frame: ['window_01.png', 'window_02.png'],
            random: true,
            scale: {start: 0.02, end: 0.01},
            maxAliveParticles: 50,
            lifespan: 500,
            gravityY: -10,
            alpha: {start: 0.05, end: 0.01}, 
        });

        my.vfx.walking.stop();

        my.vfx.jumping = this.add.particles(0, 0, "kenny-particles", {
            frame: ['smoke_01.png', 'smoke_10.png'],
            random: true,
            scale: {start: 0.01, end: 0.05},
            maxAliveParticles: 300, // Double the particles
            lifespan: 200, // Make them last longer
            gravityY: -20,
            alpha: {start: 0.5, end: 0.01},
            speedX: {min: -100, max: 100}, // Spread particles horizontally
            speedY: {min: -150, max: -50}, // Vary vertical speed
        });

        my.vfx.jumping.stop();

        my.vfx.coin_Collect = this.add.particles(20, 20, "kenny-particles", {
            frame: ['magic_01.png', 'magic_04.png'],
            random: true,
            scale: {start: 0.01, end: 0.05},
            maxAliveParticles: 300, // Double the particles
            lifespan: 200, // Make them last longer
            gravityY: 10,
            alpha: {start: 1, end: 0.01},
        });

        my.vfx.coin_Collect.stop();

        // Create audio objects
        this.walkSound = this.sound.add('walkSound', { volume: 0.3 });
        this.jumpSound = this.sound.add('jumpSound', { volume: 0.5 });
        this.gemSound = this.sound.add('gemSound', { volume: 0.7 });
        
        // Background overlay
        this.completeOverlay = this.add.rectangle(
            this.cameras.main.centerX, 
            this.cameras.main.centerY, 
            this.cameras.main.width, 
            this.cameras.main.height, 
            0x000000, 
            0.7
        ).setScrollFactor(0).setVisible(false);
        
        // Level complete text
        this.completeText = this.add.text(
            this.cameras.main.centerX, 
            this.cameras.main.centerY - 50, 
            'LEVEL COMPLETE!', 
            {
                fontSize: '48px',
                fill: '#FFD700',
                fontFamily: 'Arial',
                stroke: '#000000',
                strokeThickness: 4
            }
        ).setOrigin(0.5).setScrollFactor(0).setVisible(false);
        
        // Replay instruction text
        this.replayText = this.add.text(
            this.cameras.main.centerX, 
            this.cameras.main.centerY + 20, 
            'Press R to Replay Level', 
            {
                fontSize: '24px',
                fill: '#FFFFFF',
                fontFamily: 'Arial'
            }
        ).setOrigin(0.5).setScrollFactor(0).setVisible(false);

        // START SCREEN UI ELEMENTS - Fixed positioning and styling
        // Background overlay for start screen
        this.startOverlay = this.add.rectangle(
            this.cameras.main.centerX, 
            this.cameras.main.centerY, 
            this.cameras.main.width, 
            this.cameras.main.height, 
            0x000000, 
            0.8
        ).setScrollFactor(0).setVisible(false);

        this.title = this.add.text(
            this.cameras.main.centerX,
            this.cameras.main.centerY -80,
            'COLOR BLIND',
            {
                fontSize: '48px',
                fill: '#FFFFFF',
                fontFamily: 'Times'
            }
        ).setOrigin(0.5).setScrollFactor(0).setVisible(false);

        this.control = this.add.text(
            this.cameras.main.centerX,
            this.cameras.main.centerY -20,
            'Arrow Keys: Move\nUp Arrow: Jump\nDown Arrow: Crouch\nCollect all gems to unlock doors!',
            {
                fontSize: '18px',
                fill: '#FFFFFF',
                fontFamily: 'Goudy Bookletter 1911',
                align: 'center'
            }
        ).setOrigin(0.5).setScrollFactor(0).setVisible(false);
        
        this.startText = this.add.text(
            this.cameras.main.centerX,
            this.cameras.main.centerY +60,
            'click SPACE to start',
            {
                fontSize: '20px',
                fill: '#FFFFFF',
                fontFamily: 'Goudy Bookletter 1911'
            }
        ).setOrigin(0.5).setScrollFactor(0).setVisible(false);
        
        
        // Set up replay key
        this.replayKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.R);

        this.startKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE)

        this.showStartScreen();
    }

    createSectionGems() {
        // Create gems for each section
        this.sectionGems = {};
        this.sectionGemGroups = {};

        for (let sectionNum = 1; sectionNum <= 6; sectionNum++) {
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

        for (let sectionNum = 1; sectionNum <= 6; sectionNum++) {
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
        my.vfx.coin_Collect.setPosition(gem.x, gem.y);
        my.vfx.coin_Collect.explode(30); // Burst of 30 particles
        
        // Play gem collection sound
        this.gemSound.play();
       
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
                // Show level complete screen instead of console.log
                setTimeout(() => {
                    this.showLevelComplete();
                }, 1000); // Small delay for dramatic effect
            } else {
                console.log(`Section ${nextSection} is still locked!`);
            }
        }
    }
    showStartScreen()  {

        this.startOverlay.setVisible(true);
        this.title.setVisible(true);
        this.control.setVisible(true);
        this.startText.setVisible(true);

        this.startOverlay.setDepth(1000);
        this.title.setDepth(1001);
        this.control.setDepth(1001);
        this.startText.setDepth(1001);

        this.physics.pause();

        this.tweens.add({
            targets: this.startText,
            alpha: 0.3,
            duration: 800,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
    }

    startLevel() {
        this.startOverlay.setVisible(false);
        this.title.setVisible(false);
        this.control.setVisible(false);
        this.startText.setVisible(false);
        
        // Stop any tweens
        this.tweens.killAll();
        
        this.gameStarted = true;

        // Resume physics if paused
        this.physics.resume();
    }

    showLevelComplete() {
        // Show all completion UI elements
        this.completeOverlay.setVisible(true);
        this.completeText.setVisible(true);
        this.replayText.setVisible(true);
        
        // Bring UI to front individually
        this.completeOverlay.setDepth(1000);
        this.completeText.setDepth(1001);
        this.replayText.setDepth(1001);
        
        // Optional: Pause the game physics
        this.physics.pause();

        // Make replay text blink
        this.tweens.add({
            targets: this.replayText,
            alpha: 0.3,
            duration: 800,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
        
        console.log("Level Complete! Press R to replay.");
    }

    replayLevel() {
        this.scene.restart();
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
            newSection.bounds.x + newSection.bounds.width/2,
            newSection.bounds.y + newSection.bounds.height/2,
            1000,
            'Power2'
        );
        
        // Update current section indicator
        if (this.currentSectionText) {
            this.currentSectionText.setText(`Current Section: ${sectionNumber}`);
        }
        
        console.log(`Transitioned to section ${sectionNumber}`);
    }

    update() {

        // UPDATED: Check for start key press before game starts
        if (!this.gameStarted && Phaser.Input.Keyboard.JustDown(this.startKey)) {
            this.startLevel();
            return; // Exit early if game hasn't started yet
        }

        // Only process game logic if the game has started
        if (!this.gameStarted) {
            return;
        }

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

            my.vfx.walking.startFollow(my.sprite.player, my.sprite.player.displayWidth/2-10, 
                                    my.sprite.player.displayHeight/2-5, false);

            my.vfx.walking.setParticleSpeed(this.PARTICLE_VELOCITY, 0);

            if (my.sprite.player.body.blocked.down) {
                my.vfx.walking.start();
                
                // Update walk sound timer
                this.walkSoundTimer += this.game.loop.delta;
                
                // Play sound if enough time has passed
                if (this.walkSoundTimer >= this.WALK_SOUND_DELAY) {
                    this.walkSound.play();
                    this.walkSoundTimer = 0; // Reset timer
                }
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

            my.vfx.walking.startFollow(my.sprite.player, my.sprite.player.displayWidth/2-20, 
                                    my.sprite.player.displayHeight/2-5, false);

            my.vfx.walking.setParticleSpeed(this.PARTICLE_VELOCITY, 0);

            if (my.sprite.player.body.blocked.down) {
                my.vfx.walking.start();
                
                // Update walk sound timer
                this.walkSoundTimer += this.game.loop.delta;
                
                // Play sound if enough time has passed
                if (this.walkSoundTimer >= this.WALK_SOUND_DELAY) {
                    this.walkSound.play();
                    this.walkSoundTimer = 0; // Reset timer
                }
            }

        } else if(this.crouching && cursors.down.isDown) {
            my.sprite.player.body.setAccelerationX(0);
            my.sprite.player.body.setDragX(this.DRAG);
            my.sprite.player.anims.play('crouch');

        } else {
            my.sprite.player.body.setAccelerationX(0);
            my.sprite.player.body.setDragX(this.DRAG);
            if(canStandUp){
                my.vfx.walking.stop();
                this.walkSoundTimer = 0; // Reset timer when stopping
                my.sprite.player.anims.play('idle');
            }
        }

        if(!canStandUp){
            cursors.up.enabled = false;
        }
        else {
            cursors.up.enabled = true;
        }

        let isGrounded = my.sprite.player.body.blocked.down;
    
        if (!isGrounded && this.wasGrounded) {
            // Player just started jumping/falling - play particle effect once
            my.vfx.jumping.setPosition(my.sprite.player.x, my.sprite.player.y + my.sprite.player.displayHeight/2);
            my.vfx.jumping.explode(50);
            my.sprite.player.anims.play('jump');
            
            // Play jump sound
            this.jumpSound.play();
        } else if (isGrounded && !this.wasGrounded) {
            // Player just landed - you could add landing particles here if wanted
        }
        
        // Update the grounded state for next frame
        this.wasGrounded = isGrounded;
        
        // Handle jump input
        if(isGrounded && Phaser.Input.Keyboard.JustDown(cursors.up)) {
            my.sprite.player.body.setVelocityY(this.JUMP_VELOCITY);
        }
        
        // Continue with animation updates for when not grounded
        if (!isGrounded) {
            my.sprite.player.anims.play('jump');
        }

        // Check for replay key press
        if (Phaser.Input.Keyboard.JustDown(this.replayKey)) {
            // Only replay if completion screen is visible
            if (this.completeText.visible) {
                this.replayLevel();
            }
        }
    }
}