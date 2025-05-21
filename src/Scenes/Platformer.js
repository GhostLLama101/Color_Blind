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

        this.crouching = false;
    }

    create() {
        this.map = this.add.tilemap("platformer-level-1", 16, 16, 60, 50);

        this.tileset = this.map.addTilesetImage("monoChrome_tiles_packed", "platformer_tiles");

        this.groundLayer = this.map.createLayer("floor", this.tileset, 0, 0);
        // this.groundLayer.setScale(1.5);

        this.groundLayer.setCollisionByProperty({
            collides: true
        });

        // set up player avatar
        my.sprite.player = this.physics.add.sprite(
            game.config.width/4,
            game.config.height/2,
            "platformer_characters",
            "tile_0240.png"
        ).setScale(SCALE)

        my.sprite.player.setCollideWorldBounds(true);

        // Enable collision handling
        this.physics.add.collider(my.sprite.player, this.groundLayer);

        // set up Phaser-provided cursor key input
        cursors = this.input.keyboard.createCursorKeys();

        // debug key listener (assigned to D key)
        this.input.keyboard.on('keydown-D', () => {
            this.physics.world.drawDebug = this.physics.world.drawDebug ? false : true
            this.physics.world.debugGraphic.clear()
        }, this);

        this.originalHeight = my.sprite.player.height;

        this.cameras.main.setBounds(0, 0, this.map.widthInPixels, this.map.heightInPixels);
        this.cameras.main.startFollow(my.sprite.player, true, 0.25, 0.25); // (target, [,roundPixels][,lerpX][,lerpY])
        this.cameras.main.setDeadzone(50, 50);
        this.cameras.main.setZoom(this.SCALE+1);

    }

    update() {
        let canStandUp = true;
        if(this.crouching) {
            // Create a temporary physics body above the player to check for collisions
            const tileAbove = this.groundLayer.getTileAtWorldXY(
                my.sprite.player.x, 
                my.sprite.player.y - this.originalHeight/2, 
                true
            );
            
            // If there's a colliding tile above, the player can't stand up
            if(tileAbove && tileAbove.properties.collides) {
                canStandUp = false;
            }
        }

        // Existing crouching logic, but modified to check if player can stand up
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