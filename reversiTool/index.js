gl.enableWebGL2 = true;

const MOVE_DELAY_AR_MODE = 500;

let spatialInterface;

let camera, scene, realRenderer, renderer, toolReferenceObj, containerObj, groundPlaneReferenceObj;
let isProjectionMatrixSet = false;
let lastProjectionMatrix;
let lastModelViewMatrix;
let lastGroundPlaneMatrix;
let done = false; // used by gl renderer
let rendererStarted = false;

let rendererDimensions = {
    width: 0,
    height: 0
};

window.onload = function () {
    init();
}

function init() {
    initSpatialInterface();
    initRenderer().then(() => {
        load_reversi(containerObj);
    });
}

function initSpatialInterface() {
    spatialInterface = new SpatialInterface();
    spatialInterface.setMoveDelay(MOVE_DELAY_AR_MODE);
    spatialInterface.useWebGlWorker();
    spatialInterface.getScreenDimensions((width, height) => {
        spatialInterface.changeFrameSize(width, height);
    });
    spatialInterface.setStickyFullScreenOn({animated: false, full2D: false});
}

// The gl proxy code calls this with the correct renderer dimensions once set up
main = ({width, height}) => {
    rendererDimensions.width = width;
    rendererDimensions.height = height;
};

// This becomes true once the gl proxy code finishes setting it up, do NOT use the gl object before this is ready
function glIsReady() {
    return (gl instanceof WebGL2RenderingContext);
}

function initRenderer() {
    if (rendererStarted) {
        return Promise.resolve(true);
    }
    return new Promise((resolve, reject) => {
        if (glIsReady()) {
            rendererStarted = true;
            document.body.width = rendererDimensions.width + 'px';
            document.body.height = rendererDimensions.height + 'px';
            const aspectRatio = rendererDimensions.width / rendererDimensions.height;
            
            spatialInterface.changeFrameSize(rendererDimensions.width, rendererDimensions.height);
            spatialInterface.onWindowResized(({width, height}) => {
                rendererDimensions.width = width;
                rendererDimensions.height = height;
                camera.aspect = width / height;
                renderer.setSize(width, height);
                realRenderer.setSize(width, height);
                isProjectionMatrixSet = false;
                spatialInterface.subscribeToMatrix(); // this should trigger a new retrieval of the projectionMatrix
            });

            realRenderer = new THREE.WebGLRenderer( { alpha: true } );
            realRenderer.debug.checkShaderErrors = false;
            realRenderer.setPixelRatio(window.devicePixelRatio);
            realRenderer.setSize(rendererDimensions.width, rendererDimensions.height);
            realGl = realRenderer.getContext();

            // Initialize the three.js renderer
            renderer = new THREE.WebGLRenderer({ context: gl, alpha: true });
            renderer.debug.checkShaderErrors = false;
            renderer.setPixelRatio(window.devicePixelRatio);
            renderer.setSize(rendererDimensions.width, rendererDimensions.height);

            // camera = new THREE.PerspectiveCamera(70, aspectRatio, 1000, 30000);
            camera = new THREE.PerspectiveCamera(70, aspectRatio, 1, 1000);
            window.realCamera = camera;
            scene = new THREE.Scene();
            toolReferenceObj = new THREE.Object3D();
            groundPlaneReferenceObj = new THREE.Object3D();
            containerObj = new THREE.Object3D();
            toolReferenceObj.matrixAutoUpdate = false;
            groundPlaneReferenceObj.matrixAutoUpdate = false;
            scene.add(toolReferenceObj);
            scene.add(groundPlaneReferenceObj);
            scene.add(containerObj);
            scene.add(camera);

            // light the scene with a combination of ambient and directional white light
            let ambLight = new THREE.AmbientLight(0x404040);
            scene.add(ambLight);
            let dirLight1 = new THREE.DirectionalLight(0xffffff, 1);
            dirLight1.position.set(1000, 1000, 1000);
            scene.add(dirLight1);
            let dirLight2 = new THREE.DirectionalLight(0xffffff, 1);
            dirLight2.position.set(-1000, -1000, -1000);
            scene.add(dirLight2);
            
            // const box = new THREE.Mesh(new THREE.BoxGeometry(1000,1000,1000), new THREE.MeshNormalMaterial({side: THREE.DoubleSide}));
            // toolReferenceObj.add(box);

            spatialInterface.onSpatialInterfaceLoaded(function() {
                spatialInterface.subscribeToMatrix();
                spatialInterface.addMatrixListener(updateMatrices);
                spatialInterface.addGroundPlaneMatrixListener(onGroundPlaneMatrix);
                spatialInterface.registerTouchDecider(touchDecider);

                resolve();
            });
        } else {
            setTimeout(() => {
                initRenderer().then(resolve).catch(reject);
            }, 500)
        }
    });
}

/**
 * Touch Decider for Onshape GLTF models
 * @param {*} eventData
 * @returns
 */
function touchDecider(eventData) {
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    pointer.x = ((eventData.x / window.innerWidth) * 2 - 1);
    pointer.y = (- (eventData.y / window.innerHeight) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    const intersects = raycaster.intersectObject(containerObj, true);
    //console.log("Intersects: " + intersects.length)
    console.log(intersects.length);
    return intersects.length > 0;
    // return true;
}

function updateMatrices(modelViewMatrix, projectionMatrix) {
    lastProjectionMatrix = projectionMatrix;
    lastModelViewMatrix = modelViewMatrix;
}

function onGroundPlaneMatrix(groundPlaneMatrix) {
    lastGroundPlaneMatrix = groundPlaneMatrix;
}

// Called by gl proxy code
render = function(_now) {
    // Only set the projection matrix for the camera 1 time, since it stays the same
    if (!isProjectionMatrixSet && lastProjectionMatrix && lastProjectionMatrix.length > 0) {
        setMatrixFromArray(camera.projectionMatrix, lastProjectionMatrix);
        camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
        isProjectionMatrixSet = true;
    }

    // 10. Every frame, set the position of the toolReferenceObj to the modelViewMatrix
    if (isProjectionMatrixSet && lastModelViewMatrix && lastModelViewMatrix.length > 0 && lastGroundPlaneMatrix && lastGroundPlaneMatrix.length > 0) {
        if (renderer && scene && camera) {
            orientContainerObject();
            renderer.render(scene, camera);
        }
    }
}

function orientContainerObject() {
    setMatrixFromArray(toolReferenceObj.matrix, lastModelViewMatrix);
    setMatrixFromArray(groundPlaneReferenceObj.matrix, lastGroundPlaneMatrix);
    toolReferenceObj.matrix.decompose(containerObj.position, containerObj.quaternion, containerObj.scale);

    // Tools scale along two axes which are not guaranteed to be the same sign. We want to scale in all three axes by that magnitude
    const scaleDifferences = [
        Math.abs(Math.abs(containerObj.scale.x) - Math.abs(containerObj.scale.y)),
        Math.abs(Math.abs(containerObj.scale.y) - Math.abs(containerObj.scale.z)),
        Math.abs(Math.abs(containerObj.scale.x) - Math.abs(containerObj.scale.z)),
    ]
    let scale = Math.abs(containerObj.scale.x); // x is guaranteed to be one of the values we can use if [0] is the smallest
    if (scaleDifferences[1] <= scaleDifferences[0] && scaleDifferences[1] <= scaleDifferences[2]) {
        scale = Math.abs(containerObj.scale.y); // y is guaranteed to be one of the values we can use if [1] is the smallest
    } else if (scaleDifferences[2] <= scaleDifferences[0] && scaleDifferences[2] <= scaleDifferences[1]) {
        scale = Math.abs(containerObj.scale.z); // z is guaranteed to be one of the values we can use if [2] is the smallest
    }
    containerObj.scale.set(scale, scale, scale);
}

/**
 * This is just a helper function to set a three.js matrix using an array
 * @param {*} matrix
 * @param {*} array
 */
function setMatrixFromArray(matrix, array) {
    matrix.set(array[0], array[4], array[8], array[12],
        array[1], array[5], array[9], array[13],
        array[2], array[6], array[10], array[14],
        array[3], array[7], array[11], array[15]);
}
