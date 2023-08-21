import * as THREE from '../../libs/three/three.module.js';
import { VRButton } from '../../libs/VRButton.js';
import { XRControllerModelFactory } from '../../libs/three/jsm/XRControllerModelFactory.js';
import { Stats } from '../../libs/stats.module.js';
import { OrbitControls } from '../../libs/three/jsm/OrbitControls.js';


class App {
    constructor() {
        const container = document.createElement('div');
        document.body.appendChild(container);

        this.clock = new THREE.Clock();


        this.moveSpeed = 2; // Adjust the movement speed
        this.maxMoveSpeed = 5; // Maximum movement speed
        this.moveDirection = new THREE.Vector3();


        this.camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 200);
        this.camera.position.set(0, 1.6, 5);

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x505050);

        this.scene.add(new THREE.HemisphereLight(0xffffff, 0x404040));

        const light = new THREE.DirectionalLight(0xffffff);
        light.position.set(1, 1, 1).normalize();
        this.scene.add(light);

        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.outputEncoding = THREE.sRGBEncoding;

        container.appendChild(this.renderer.domElement);

        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.target.set(0, 1.6, 0);
        this.controls.update();

        this.stats = new Stats();

        this.raycaster = new THREE.Raycaster();
        this.workingMatrix = new THREE.Matrix4();
        this.workingVector = new THREE.Vector3();
        this.origin = new THREE.Vector3();

        this.initScene();
        this.setupVR();

        window.addEventListener('resize', this.resize.bind(this));

        this.renderer.setAnimationLoop(this.render.bind(this));
    }

    random(min, max) {
        return Math.random() * (max - min) + min;
    }

    initScene() {

        this.scene.background = new THREE.Color(0xa0a0a0);
        this.scene.fog = new THREE.Fog(0xa0a0a0, 50, 100);

        // ground
        const ground = new THREE.Mesh(new THREE.PlaneBufferGeometry(200, 200), new THREE.MeshPhongMaterial({ color: 0x999999, depthWrite: false }));
        ground.rotation.x = - Math.PI / 2;
        this.scene.add(ground);

        var grid = new THREE.GridHelper(200, 40, 0x000000, 0x000000);
        grid.material.opacity = 0.2;
        grid.material.transparent = true;
        this.scene.add(grid);

        const geometry = new THREE.BoxGeometry(5, 5, 5);
        const material = new THREE.MeshPhongMaterial({ color: 0xAAAA22 });
        const edges = new THREE.EdgesGeometry(geometry);
        const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 2 }));

        this.colliders = [];

        for (let x = -100; x < 100; x += 10) {
            for (let z = -100; z < 100; z += 10) {
                if (x == 0 && z == 0) continue;
                const box = new THREE.Mesh(geometry, material);
                box.position.set(x, 2.5, z);
                const edge = line.clone();
                edge.position.copy(box.position);
                this.scene.add(box);
                this.scene.add(edge);
                this.colliders.push(box);
            }
        }

    }

    setupVR() {
        this.renderer.xr.enabled = true;

        const button = new VRButton(this.renderer);

        const self = this;

        function onSelectStart() {

            this.userData.selectPressed = true;
        }

        function onSelectEnd() {

            this.userData.selectPressed = false;

        }

        this.controller = this.renderer.xr.getController(0);
        this.controller.addEventListener('selectstart', onSelectStart);
        this.controller.addEventListener('selectend', onSelectEnd);
        this.controller.addEventListener('connected', function (event) {

            const mesh = self.buildController.call(self, event.data);
            mesh.scale.z = 0;
            this.add(mesh);

        });
        this.controller.addEventListener('disconnected', function () {

            this.remove(this.children[0]);
            self.controller = null;
            self.controllerGrip = null;

        });
        this.scene.add(this.controller);

        const controllerModelFactory = new XRControllerModelFactory();

        this.controllerGrip = this.renderer.xr.getControllerGrip(0);
        this.controllerGrip.add(controllerModelFactory.createControllerModel(this.controllerGrip));
        this.scene.add(this.controllerGrip);

        this.dolly = new THREE.Object3D();
        this.dolly.position.z = 5;
        this.dolly.add(this.camera);
        this.scene.add(this.dolly);

        this.dummyCam = new THREE.Object3D();
        this.camera.add(this.dummyCam);

    }

    buildController(data) {
        let geometry, material;

        switch (data.targetRayMode) {

            case 'tracked-pointer':

                geometry = new THREE.BufferGeometry();
                geometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, - 1], 3));
                geometry.setAttribute('color', new THREE.Float32BufferAttribute([0.5, 0.5, 0.5, 0, 0, 0], 3));

                material = new THREE.LineBasicMaterial({ vertexColors: true, blending: THREE.AdditiveBlending });

                return new THREE.Line(geometry, material);

            case 'gaze':

                geometry = new THREE.RingBufferGeometry(0.02, 0.04, 32).translate(0, 0, - 1);
                material = new THREE.MeshBasicMaterial({ opacity: 0.5, transparent: true });
                return new THREE.Mesh(geometry, material);

        }

    }

    handleController(controller, dt) {
        if (controller.userData.selectPressed) {

            // Read joystick input for movement
            const joystickAxes = controller.gamepad.axes;
            const moveX = joystickAxes[0];
            const moveZ = joystickAxes[1];


            const wallLimit = 1.3;
            const speed = 2;
            let pos = this.dolly.position.clone();
            pos.y += 1;

            let dir = new THREE.Vector3();
            //Store original dolly rotation
            const quaternion = this.dolly.quaternion.clone();
            //Get rotation for movement from the headset pose
            this.dolly.quaternion.copy(this.dummyCam.getWorldQuaternion());
            this.dolly.getWorldDirection(dir);
            dir.negate();
            this.raycaster.set(pos, dir);

            let blocked = false;

            let intersect = this.raycaster.intersectObjects(this.colliders);
            if (intersect.length > 0) {
                if (intersect[0].distance < wallLimit) blocked = true;
            }

            // Update movement direction based on joystick input
            this.moveDirection.set(moveX, 0, moveZ);

            if (!blocked) {
                this.dolly.translateZ(-dt * speed);
                pos = this.dolly.getWorldPosition(this.origin);
            }



            // Read joystick button input for shooting
            this.shooting = controller.userData.selectPressed;

            // Check if cooldown timer has elapsed and shooting is allowed
            if (this.shooting && this.shootTimer <= 0) {
                this.shoot();
                this.shootTimer = this.shootCooldown;
            }

            // Update shoot cooldown timer
            this.shootTimer -= dt;



            //cast left
            dir.set(-1, 0, 0);
            dir.applyMatrix4(this.dolly.matrix);
            dir.normalize();
            this.raycaster.set(pos, dir);

            intersect = this.raycaster.intersectObjects(this.colliders);
            if (intersect.length > 0) {
                if (intersect[0].distance < wallLimit) this.dolly.translateX(wallLimit - intersect[0].distance);
            }

            //cast right
            dir.set(1, 0, 0);
            dir.applyMatrix4(this.dolly.matrix);
            dir.normalize();
            this.raycaster.set(pos, dir);

            intersect = this.raycaster.intersectObjects(this.colliders);
            if (intersect.length > 0) {
                if (intersect[0].distance < wallLimit) this.dolly.translateX(intersect[0].distance - wallLimit);
            }

            this.dolly.position.y = 0;

            //Restore the original rotation
            this.dolly.quaternion.copy(quaternion);

        }
    }

    shoot() {
        const bulletGeometry = new THREE.SphereGeometry(0.05, 16, 16);
        const bulletMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
        const bullet = new THREE.Mesh(bulletGeometry, bulletMaterial);

        // Set bullet's initial position and velocity based on the dolly's position and direction
        bullet.position.copy(this.dolly.getWorldPosition(new THREE.Vector3()));
        const bulletDirection = new THREE.Vector3();
        this.dolly.getWorldDirection(bulletDirection);
        bulletDirection.normalize();
        bullet.userData.velocity = bulletDirection.clone().multiplyScalar(10); // Adjust bullet speed

        // Add bullet to the scene
        this.scene.add(bullet);
    }


    resize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    render() {
        const dt = this.clock.getDelta();

        // Update shooting cooldown timer
        this.shootTimer -= dt;

        // Update bullets
        const bulletsToRemove = [];
        this.scene.traverse(object => {
            if (object instanceof THREE.Mesh && object.userData.velocity) {
                // Update bullet position based on its velocity
                object.position.add(object.userData.velocity.clone().multiplyScalar(dt));

                // Check for collision with objects or out-of-bounds
                // Implement collision detection logic here
                // Remove bullets that are out of bounds or collided

                if (object.position.distanceTo(this.dolly.position) > 50) {
                    bulletsToRemove.push(object);
                }
            }
        });

        // Remove bullets that are out of bounds
        bulletsToRemove.forEach(bullet => {
            this.scene.remove(bullet);
        });

        this.stats.update();
        if (this.controller) this.handleController(this.controller, dt);
        this.renderer.render(this.scene, this.camera);
    }
}

export { App };