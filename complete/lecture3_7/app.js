import * as THREE from "../../libs/three/three.module.js";
import { GLTFLoader } from "../../libs/three/jsm/GLTFLoader.js";
import { DRACOLoader } from "../../libs/three/jsm/DRACOLoader.js";
import { XRControllerModelFactory } from "../../libs/three/jsm/XRControllerModelFactory.js";
import { Stats } from "../../libs/stats.module.js";
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
    this.shooting = false;
    this.keysPressed = {};
    this.mouseMovement = new THREE.Vector2();
    this.cameraQuaternion = new THREE.Quaternion();

    window.addEventListener("keydown", this.onKeyDown.bind(this), false);
    window.addEventListener("keyup", this.onKeyUp.bind(this), false);
    window.addEventListener("mousemove", this.onMouseMove.bind(this), false);
    window.addEventListener("mousedown", this.onMouseDown.bind(this), false);
    window.addEventListener("resize", this.resize.bind(this));

    this.colliders = [];
    this.characterBox = new THREE.Box3(); // Bounding box for character
    this.colliderBoxes = []; // Array to hold bounding boxes of colliders

    this.initScene();
    this.setupVR();

    this.renderer.setAnimationLoop(this.render.bind(this));
  }

  onMouseDown(event) {
    if (event.button === 0) {
      // Left mouse button (0) is clicked, trigger shooting
      this.shoot();
    }
  }

  onKeyDown(event) {
    this.keysPressed[event.key] = true;
    this.handleMovement();
  }

  onKeyUp(event) {
    this.keysPressed[event.key] = false;
    this.handleMovement();
  }

  handleMovement() {
    const speed = 0.5; // Adjust movement speed
    const direction = new THREE.Vector3();

    if (this.keysPressed["w"]) {
      // Move forward
      direction.set(0, 0, -1);
      this.moveWithCollision(direction, speed);
    }
    if (this.keysPressed["s"]) {
      // Move backward
      direction.set(0, 0, 1);
      this.moveWithCollision(direction, speed);
    }
    if (this.keysPressed["a"]) {
      // Move left
      direction.set(-1, 0, 0);
      this.moveWithCollision(direction, speed);
    }
    if (this.keysPressed["d"]) {
      // Move right
      direction.set(1, 0, 0);
      this.moveWithCollision(direction, speed);
    }
  }

  moveWithCollision(direction, speed) {
    const newPos = this.dolly.position.clone().add(
      direction
        .applyQuaternion(this.cameraQuaternion)
        .normalize()
        .multiplyScalar(speed)
    );

    // Update character's bounding box with new position
    this.characterBox.setFromCenterAndSize(newPos, new THREE.Vector3(0.25,0.5,0.25)); // Adjust size as per character's dimensions

    // Check for collisions with each collider's bounding box
    for (let i = 0; i < this.colliderBoxes.length; i++) {
      if (this.characterBox.intersectsBox(this.colliderBoxes[i])) {
        // Collision detected, prevent movement
        return;
      }
    }

    // If no collisions, update character position
    this.dolly.position.copy(newPos);
  }

  onMouseMove(event) {
    this.mouseMovement.x = event.movementX || 0;
    this.mouseMovement.y = event.movementY || 0;

    const sensitivity = 0.002;
    this.camera.rotation.y -= this.mouseMovement.x * sensitivity;
    this.dummyCam.rotation.x -= this.mouseMovement.y * sensitivity;

    const maxVerticalRotation = Math.PI / 2 - 0.1;
    this.dummyCam.rotation.x = Math.max(
      -maxVerticalRotation,
      Math.min(maxVerticalRotation, this.dummyCam.rotation.x)
    );

    this.cameraQuaternion.copy(this.camera.quaternion);
  }

  initScene() {
    this.scene.background = new THREE.Color(0xa0a0a0);
    this.scene.fog = new THREE.Fog(0xa0a0a0, 50, 100);

    const ground = new THREE.Mesh(
      new THREE.PlaneBufferGeometry(200, 200),
      new THREE.MeshPhongMaterial({ color: 0x999999, depthWrite: false })
    );
    ground.rotation.x = -Math.PI / 2;
    this.scene.add(ground);

    const grid = new THREE.GridHelper(200, 40, 0x000000, 0x000000);
    grid.material.opacity = 0.2;
    grid.material.transparent = true;
    this.scene.add(grid);

    const geometry = new THREE.BoxGeometry(5, 5, 5);
    const material = new THREE.MeshPhongMaterial({ color: 0xaaaa22 });

    for (let x = -100; x < 100; x += 20) {
      for (let z = -100; z < 100; z += 20) {
        if (x === 0 && z === 0) continue;
        const box = new THREE.Mesh(geometry, material);
        box.position.set(x, 2.5, z);
        this.scene.add(box);

        const boxCollider = new THREE.Box3().setFromObject(box);
        this.colliderBoxes.push(boxCollider);
      }
    }
  }

  setupVR() {
    this.renderer.xr.enabled = true;

    const self = this;

    function onSelectStart() {
      this.userData.selectPressed = true;
      if (self.controller) {
        self.shoot();
      }
    }

    function onSelectEnd() {
      this.userData.selectPressed = false;
    }

    this.controller = this.renderer.xr.getController(0);
    this.controller.addEventListener("selectstart", onSelectStart);
    this.controller.addEventListener("selectend", onSelectEnd);

    this.controller.addEventListener("connected", function (event) {
      const mesh = self.buildController.call(self, event.data);
      mesh.scale.z = 0;
      this.add(mesh);
    });

    this.controller.addEventListener("connected", (event) => {
      if ("gamepad" in event.data) {
        if ("axes" in event.data.gamepad) {
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

  resize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  render() {
    const dt = this.clock.getDelta();
    this.stats.update();
    this.renderer.render(this.scene, this.camera);
  }
}

export {App};
