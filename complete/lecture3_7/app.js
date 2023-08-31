import * as THREE from "../../libs/three/three.module.js";
import { GLTFLoader } from "../../libs/three/jsm/GLTFLoader.js";
import { DRACOLoader } from "../../libs/three/jsm/DRACOLoader.js";
import { RGBELoader } from "../../libs/three/jsm/RGBELoader.js";
import { XRControllerModelFactory } from "../../libs/three/jsm/XRControllerModelFactory.js";
import { Pathfinding } from "../../libs/pathfinding/Pathfinding.js";
import { Stats } from "../../libs/stats.module.js";
import { VRButton } from "../../libs/VRButton.js";
import { TeleportMesh } from "../../libs/TeleportMesh.js";
import { Interactable } from "../../libs/Interactable.js";
import { Player } from "../../libs/Player.js";
import { LoadingBar } from "../../libs/LoadingBar.js";
import { Bullet } from "./Bullet.js";
import { OrbitControls } from "../../libs/three/jsm/OrbitControls.js";

class App {
  constructor() {
    const container = document.createElement("div");
    document.body.appendChild(container);

    this.clock = new THREE.Clock();

    this.camera = new THREE.PerspectiveCamera(
      50,
      window.innerWidth / window.innerHeight,
      0.1,
      200
    );
    this.camera.position.set(0, 1.6, 5);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x505050);

    this.bullets = [];
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

    this.keysPressed = {};
    this.mouseMovement = new THREE.Vector2();
    this.cameraQuaternion = new THREE.Quaternion();
    // Add event listeners for keyboard and mouse inputs
    window.addEventListener("keydown", this.onKeyDown.bind(this), false);
    window.addEventListener("keyup", this.onKeyUp.bind(this), false);
    window.addEventListener("mousemove", this.onMouseMove.bind(this), false);

    this.raycaster = new THREE.Raycaster();
    this.workingMatrix = new THREE.Matrix4();
    this.workingVector = new THREE.Vector3();
    this.origin = new THREE.Vector3();

    this.initScene();
    this.setupVR();

    window.addEventListener("resize", this.resize.bind(this));

    this.renderer.setAnimationLoop(this.render.bind(this));
  }

  onKeyDown(event) {
    this.keysPressed[event.key] = true;
    this.handleMovement();
  }

  onKeyUp(event) {
    // Mark the released key as false in the keysPressed map
    this.keysPressed[event.key] = false;

    // Handle movement based on the pressed keys
    this.handleMovement();
  }

  handleMovement() {
    const speed = 0.2; // Adjust movement speed
    const direction = new THREE.Vector3();

    // Handle movement based on the pressed keys
    if (this.keysPressed["w"]) {
      // Move forward in the direction the camera is facing
      this.dolly.position.add(
        this.camera.getWorldDirection(direction).multiplyScalar(speed)
      );
    }
    if (this.keysPressed["s"]) {
      // Move backward
      this.dolly.position.add(
        this.camera.getWorldDirection(direction).multiplyScalar(-speed)
      );
    }
    if (this.keysPressed["a"]) {
      // Strafe left
      direction.set(-1, 0, 0);
      this.dolly.position.add(
        direction
          .applyQuaternion(this.cameraQuaternion)
          .normalize()
          .multiplyScalar(speed)
      );
    }
    if (this.keysPressed["d"]) {
      // Strafe right
      direction.set(1, 0, 0);
      this.dolly.position.add(
        direction
          .applyQuaternion(this.cameraQuaternion)
          .normalize()
          .multiplyScalar(speed)
      );
    }
  }

  onMouseMove(event) {
    // Calculate mouse movement since the last frame
    this.mouseMovement.x = event.movementX || 0;
    this.mouseMovement.y = event.movementY || 0;

    // Update camera rotation based on mouse movement
    const sensitivity = 0.002; // Adjust sensitivity
    this.camera.rotation.y -= this.mouseMovement.x * sensitivity;
    this.dummyCam.rotation.x -= this.mouseMovement.y * sensitivity;

    // Clamp vertical rotation to prevent camera flipping
    const maxVerticalRotation = Math.PI / 2 - 0.1;
    this.dummyCam.rotation.x = Math.max(
      -maxVerticalRotation,
      Math.min(maxVerticalRotation, this.dummyCam.rotation.x)
    );

    this.cameraQuaternion.copy(this.camera.quaternion);
  }

  random(min, max) {
    return Math.random() * (max - min) + min;
  }

  initScene() {
    this.scene.background = new THREE.Color(0xa0a0a0);
    this.scene.fog = new THREE.Fog(0xa0a0a0, 50, 100);

    // ground
    const ground = new THREE.Mesh(
      new THREE.PlaneBufferGeometry(200, 200),
      new THREE.MeshPhongMaterial({ color: 0x999999, depthWrite: false })
    );
    ground.rotation.x = -Math.PI / 2;
    this.scene.add(ground);

    var grid = new THREE.GridHelper(200, 40, 0x000000, 0x000000);
    grid.material.opacity = 0.2;
    grid.material.transparent = true;
    this.scene.add(grid);

    const geometry = new THREE.BoxGeometry(5, 5, 5);
    const material = new THREE.MeshPhongMaterial({ color: 0xaaaa22 });
    const edges = new THREE.EdgesGeometry(geometry);
    const line = new THREE.LineSegments(
      edges,
      new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 2 })
    );

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
    this.controller.addEventListener("selectstart", onSelectStart);
    this.controller.addEventListener("selectend", onSelectEnd);
    
    // this.controller.addEventListener( 'connected', function ( event ) {

    //     const mesh = self.buildController.call(self, event.data );
    //     mesh.scale.z = 0;
    //     this.add( mesh );

    // } );
    this.controller.addEventListener("connected", (event) => {
      if ("gamepad" in event.data) {
        if ("axes" in event.data.gamepad) {
          //we have a modern controller
          this.controller.gamepad = event.data.gamepad;
        }
      }
    });
    this.controller.addEventListener("disconnected", function () {
      this.remove(this.children[0]);
      self.controller = null;
      self.controllerGrip = null;
    });
    this.scene.add(this.controller);

    const controllerModelFactory = new XRControllerModelFactory();

    this.controllerGrip = this.renderer.xr.getControllerGrip(0);
    // this.controllerGrip = this.renderer.xr.getControllerGrip( 1 );
    // this.controllerGrip.add(
    //   controllerModelFactory.createControllerModel(this.controllerGrip)
    // );

    const loader = new GLTFLoader();
    loader.load('../../assets/scene.gltf', (gltf) => {
        const weaponModel = gltf.scene;

        // Resize, position, and orient the weapon model as needed
        weaponModel.scale.set(0.1, 0.1, 0.1);
        weaponModel.position.set(0, -0.1, -0.3);
        weaponModel.rotation.set(0, Math.PI, 0); // Adjust rotation as needed

        // Attach the weapon model to the controllerGrip
        this.controllerGrip.add(weaponModel);
    });
    this.scene.add(this.controllerGrip);

    this.dolly = new THREE.Object3D();
    this.dolly.position.z = 5;
    this.dolly.add(this.camera);
    this.scene.add(this.dolly);

    this.dummyCam = new THREE.Object3D();
    this.camera.add(this.dummyCam);
  }

  onSelectStart(event) {
    if (!this.controllerGrip) return;

    const bullet = new Bullet(this.controllerGrip, {
        gun: this.controllerGrip,
        targets: this.colliders
    });
    
    bullet.fire();
    this.bullets.push(bullet);
}


  buildController(data) {
    let geometry, material;

    switch (data.targetRayMode) {
      case "tracked-pointer":
        geometry = new THREE.BufferGeometry();
        geometry.setAttribute(
          "position",
          new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, -1], 3)
        );
        geometry.setAttribute(
          "color",
          new THREE.Float32BufferAttribute([0.5, 0.5, 0.5, 0, 0, 0], 3)
        );

        material = new THREE.LineBasicMaterial({
          vertexColors: true,
          blending: THREE.AdditiveBlending,
        });

        return new THREE.Line(geometry, material);

      case "gaze":
        geometry = new THREE.RingBufferGeometry(0.02, 0.04, 32).translate(
          0,
          0,
          -1
        );
        material = new THREE.MeshBasicMaterial({
          opacity: 0.5,
          transparent: true,
        });
        return new THREE.Mesh(geometry, material);
    }
  }

  handleController(controller, dt) {
    if (controller.userData.selectPressed){

    }
    if (controller.gamepad) {
      const thumbstickX = controller.gamepad.axes[2]; // Horizontal axis of thumbstick
      const thumbstickY = controller.gamepad.axes[3]; // Vertical axis of thumbstick

      // Use thumbstick input for movement
      const speed = 0.15;
      const direction = new THREE.Vector3(thumbstickX, 0, thumbstickY);

       // Get the headset's orientation
    const headsetQuaternion = this.dummyCam.getWorldQuaternion();

    // Rotate the movement direction using the headset's orientation
    direction.applyQuaternion(headsetQuaternion);


      direction.normalize();
      direction.multiplyScalar(speed);

      

      // Calculate the new position based on thumbstick input
      const newPos = this.dolly.position.clone().add(direction);

      // Perform collision detection before updating the position
      const wallLimit = 1.3;
      const raycaster = new THREE.Raycaster();
      raycaster.set(newPos.clone().add(new THREE.Vector3(0, 1, 0)), direction);

      let blocked = false;
      let intersect = raycaster.intersectObjects(this.colliders);
      if (intersect.length > 0 && intersect[0].distance < wallLimit) {
        blocked = true;
      }

      if (!blocked) {
        this.dolly.position.copy(newPos);
      }
    }

    // if (controller.gamepad) {
    //     const thumbstickX = controller.gamepad.axes[2]; // Horizontal axis of thumbstick
    //     const thumbstickY = controller.gamepad.axes[3]; // Vertical axis of thumbstick

    //     // Use thumbstick input for movement
    //     const speed = 0.15;
    //     const direction = new THREE.Vector3();
    //     direction.set(thumbstickX, 0, thumbstickY);
    //     direction.normalize();
    //     direction.multiplyScalar(speed);
    //     this.dolly.position.add(direction);

    // }

    // if (controller.userData.selectPressed ){

    // const wallLimit = 1.3;
    // const speed = 2;
    // let pos = this.dolly.position.clone();
    // pos.y += 1;

    // let dir = new THREE.Vector3();
    // //Store original dolly rotation
    // const quaternion = this.dolly.quaternion.clone();
    // //Get rotation for movement from the headset pose
    // this.dolly.quaternion.copy( this.dummyCam.getWorldQuaternion() );
    // this.dolly.getWorldDirection(dir);
    // dir.negate();
    // this.raycaster.set(pos, dir);

    // let blocked = false;

    // let intersect = this.raycaster.intersectObjects(this.colliders);
    // if (intersect.length>0){
    //     if (intersect[0].distance < wallLimit) blocked = true;
    // }

    // if (!blocked){
    //     this.dolly.translateZ(-dt*speed);
    //     pos = this.dolly.getWorldPosition( this.origin );
    // }

    // //cast left
    // dir.set(-1,0,0);
    // dir.applyMatrix4(this.dolly.matrix);
    // dir.normalize();
    // this.raycaster.set(pos, dir);

    // intersect = this.raycaster.intersectObjects(this.colliders);
    // if (intersect.length>0){
    //     if (intersect[0].distance<wallLimit) this.dolly.translateX(wallLimit-intersect[0].distance);
    // }

    // //cast right
    // dir.set(1,0,0);
    // dir.applyMatrix4(this.dolly.matrix);
    // dir.normalize();
    // this.raycaster.set(pos, dir);

    // intersect = this.raycaster.intersectObjects(this.colliders);
    // if (intersect.length>0){
    //     if (intersect[0].distance<wallLimit) this.dolly.translateX(intersect[0].distance-wallLimit);
    // }

    // this.dolly.position.y = 0;

    // //Restore the original rotation
    // this.dolly.quaternion.copy( quaternion );

    // }
  }

  resize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  render() {
    const dt = this.clock.getDelta();
    this.stats.update();
    if (this.controller) {
      this.handleController(this.controller, dt);
    }

     // Update and render bullets
     this.bullets.forEach(bullet => bullet.update(dt));

    this.renderer.render(this.scene, this.camera);
  }
}

export { App };
