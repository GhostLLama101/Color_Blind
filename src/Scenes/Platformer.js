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
        this.gemsCollected = false;
        this.crouching = false;
    }

    preload() {
        this.load.scenePlugin('AnimatedTiles', './lib/AnimatedTiles.js', 'animatedTiles', 'animatedTiles');
    }

    create() {
        this.map = this.add.tilemap("platformer-level-1", 16, 16, 60, 50);

        this.tileset = this.map.addTilesetImage("monoChrome_tiles_packed", "platformer_tiles");

        this.groundLayer = this.map.createLayer("floor", this.tileset, 0, 0);

        const spawnPoint = this.map.findObject("Objects", obj => obj.name === "spawn");
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

        this.gems = this.map.createFromObjects("Objects", {
            name: "GEM",
            key: "GEMS_Tiles",
            frame: 20
        });

        // Create animation for coins created from Object layer
        this.anims.create({
                key: 'gemAnim', // Animation key
                frames: this.anims.generateFrameNumbers('GEMS_Tiles', 
                        {start: 20, end: 21}
                ),
                frameRate: 3,  // Higher is faster
                repeat: -1      // Loop the animation indefinitely
         });

        // Play the same animation for every memeber of the 
        // Object coins array
        this.anims.play('gemAnim', this.gems);

        
        this.door = this.map.createFromObjects("Objects", {
            name: "DOOR",
            key: "DOOR_CLOSED",
            frame: 56,
            visible: true
        });

        this.opendoor = this.map.createFromObjects("Objects", {
            name: "OPEN_DOOR",
            key: "OPEN_DOOR",
            frame: 59,
            visible: false
        });

        
        // this.opendoor.setDepth(9);

        my.sprite.player.setCollideWorldBounds(true);

        // Enable collision handling
        this.physics.add.collider(my.sprite.player, this.groundLayer);
        this.physics.world.enable(this.gems, Phaser.Physics.Arcade.STATIC_BODY);
        this.physics.world.enable(this.door, Phaser.Physics.Arcade.STATIC_BODY);
        this.physics.world.enable(this.opendoor, Phaser.Physics.Arcade.STATIC_BODY); //need colision to excit the game.

        this.gemGroup = this.add.group(this.gems);
        this.doorGroup = this.add.group(this.door);
        this.openDoorGroup = this.add.group(this.opendoor); 



        let propertyCollider = (obj1, obj2) => {
            // Handle intersection with dangerous tiles
            if (obj2.properties.damage) {
                my.sprite.player.x = spawnPoint.x;
                my.sprite.player.y = spawnPoint.y;
                console.log("Player hit spikes! Respawning...");
                my.sprite.player.body.setVelocity(0, 0);
            }
            // Could add handlers for other types of tiles here
        }

        this.physics.add.overlap(my.sprite.player, this.groundLayer, propertyCollider);

        this.physics.add.overlap(my.sprite.player, this.gemGroup, (obj1, obj2) => {
            obj2.destroy(); 

            if(this.gemGroup.children.size === 0) {
                this.gemsCollected = true;
                
                // Handle door swap immediately when all gems collected
                if (!this.doorsSwapped) {
                    this.doorsSwapped = true;
                    
                    // Show and position open doors
                    this.opendoor.forEach(opendoor => {
                        opendoor.setVisible(true);
                    });
                    
                    // Destroy closed doors
                    this.door.forEach(door => {
                        door.destroy();
                    });
                    
                    // Clear the door array
                    this.door = [];
                }
            }
        });

        this.physics.add.overlap(my.sprite.player, this.door, (obj1, obj2) => {
            if(!this.gemsCollected) {
                //TODO: display need to collect power gems. 
                
            }
        });

        this.physics.add.overlap(my.sprite.player, this.opendoor, (obj1,obj2) => {
            if(this.gemsCollected) { 
                // add a flag to only do the camer pan once.
                setTimeout(() => {
                    console.log('collided with open door');
                    // pan camera to second spawn point
                    // spawn player at second spawn point.
                }, 2000);

                // OPTIONAL: add a fade in and out effect to transition levels?
            }
        });

        // set up Phaser-provided cursor key input
        cursors = this.input.keyboard.createCursorKeys();

        this.input.keyboard.on('keydown-D', () => {
            this.physics.world.drawDebug = this.physics.world.drawDebug ? false : true
            this.physics.world.debugGraphic.clear()
        }, this);

        this.originalHeight = my.sprite.player.height;

        this.cameras.main.setBounds(0, 0, this.map.widthInPixels, this.map.heightInPixels);
        this.cameras.main.startFollow(my.sprite.player, true, 0.25, 0.25);
        this.cameras.main.setDeadzone(150, 150);
        this.cameras.main.setZoom(this.SCALE+1);
        
        this.animatedTiles.init(this.map);

    }

    update() {
        //Claud
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
        //Claud
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
            // Only reset from crouching if the player CAN stand up (no ceiling above)
            this.crouching = false;
            
            // Reset hitbox to original size with no offset
            my.sprite.player.body.setSize(my.sprite.player.width, this.originalHeight, false);
            my.sprite.player.body.setOffset(0, 0);
        }
        
        if(cursors.left.isDown) {
            // const accel = this.crouching ? this.ACCELERATION * 0.5 : this.ACCELERATION;
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
                my.sprite.player.body.setSize(my.sprite.player.width, my.sprite.player.height * 0.5, false); // need to change this to make the bouns shrink from the top
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
            // this.crouching = false;
            my.sprite.player.body.setAccelerationX(0);
            my.sprite.player.body.setDragX(this.DRAG);
            if(canStandUp){
                my.sprite.player.anims.play('idle');
            }
            // add the crouch and lie down on your soamac after a couble seconds.
        }
            // player.anims.getCurrentKey() === 'crouch'
        if(!canStandUp){ //crouched cant jump
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