/* global SpatialInterface, Envelope, THREE, GLTFLoader, realGl, gl */
/**
 * Copyright (c) 2023 PTC
 */

gl.enableWebGL2 = true;

// Various threejs and gl proxy support variables
let realRenderer, renderer;
let camera, scene;
let raycaster;
let mainContainerObj;
let material;

let spatialInterface;

let aspectRatio;

let lastProjectionMatrix = null;
let lastModelViewMatrix = null;
let isProjectionMatrixSet = false;
let done = false; // used by gl renderer

let rendererDimensions = {
    width: 0,
    height: 0
};

let rendererStarted = false;

if (!spatialInterface) {
    spatialInterface = new SpatialInterface();
}

spatialInterface.setMoveDelay(500); // Sets long-press delay for dragging app around in milliseconds
spatialInterface.useWebGlWorker(); // Required to proxy GL calls
spatialInterface.setAlwaysFaceCamera(true); // Set to true if you want the minimized app to always face the user

let color = new THREE.Color(1, 0, 0); // Keep track of the app's state

spatialInterface.initNode('storage', 'storeData'); // Creates a 'storeData' node called 'storage' which we can use to synchronize data across users
spatialInterface.addReadPublicDataListener('storage', 'color', function (newColor) { // Whenever 'color' is changed on the node by another user, update to match
    color = new THREE.Color(newColor);
});

// Opens the app UI when clicked
const launchButton = document.querySelector('#launchButton');
launchButton.addEventListener('pointerup', function () {
    envelope.open();
}, false);

const randomizeButton = document.querySelector('#randomizeButton');
randomizeButton.addEventListener('pointerup', function () {
    color = new THREE.Color(Math.random(), Math.random(), Math.random());
    material.color = color;
    const colorHex = color.toJSON();
    spatialInterface.writePublicData('storage', 'color', colorHex);
})

// Envelopes are the means by which apps can be opened, closed, and minimized via our UI
const openEnvelopeUi = document.querySelector('#openEnvelopeUi'); // 2D UI visible when app opens, fixed to screen
const closedEnvelopeUi = document.querySelector('#closedEnvelopeUi'); // 2D UI visible when app is closed, located in 3D space
const isStackable = true; // Whether or not other apps can be open at the same time in the background
const areFramesOrdered = false; // Unused
const isFullscreenFull2D = false; // Set to false if using a 3D library
const opensWhenAdded = true; // Opens app automatically when dropped into the scene
const envelope = new Envelope(spatialInterface, [], openEnvelopeUi, closedEnvelopeUi, isStackable, areFramesOrdered, isFullscreenFull2D, opensWhenAdded);
envelope.onOpen(() => { // When app is opened from a closed state
    spatialInterface.setAlwaysFaceCamera(false); // Set to false when rendering 3D content in the scene, otherwise, the entire 3D scene rotates to face the camera
    initRenderer().then(() => {
        scene.visible = true;
        spatialInterface.registerTouchDecider(touchDecider);
    });
});
envelope.onClose(() => { // When app is closed fully
    spatialInterface.unregisterTouchDecider();
    if (scene) {
        scene.visible = false;
    }
    spatialInterface.setAlwaysFaceCamera(true);
});
envelope.onBlur(() => { // When app is minimized
    openEnvelopeUi.style.display = 'none';
});
envelope.onFocus(() => { // When app gains focus
    openEnvelopeUi.style.display = '';
});

// This becomes true once the gl proxy code finishes setting it up, do NOT use the gl object before this is ready
function glIsReady() {
    return (gl instanceof WebGL2RenderingContext);
}

// The gl proxy code calls this with the correct renderer dimensions once set up
main = ({width, height}) => {
    rendererDimensions.width = width;
    rendererDimensions.height = height;
};

function initRenderer() {
    if (rendererStarted) {
        return Promise.resolve(true);
    }
    return new Promise((resolve, reject) => {
        if (glIsReady()) { // Insert scene setup in this block
            rendererStarted = true;
            document.body.width = rendererDimensions.width + 'px';
            document.body.height = rendererDimensions.height + 'px';
            aspectRatio = rendererDimensions.width / rendererDimensions.height;

            spatialInterface.changeFrameSize(rendererDimensions.width, rendererDimensions.height);
            spatialInterface.onWindowResized(({width, height}) => {
                rendererDimensions.width = width;
                rendererDimensions.height = height;
                aspectRatio = rendererDimensions.width / rendererDimensions.height;
                camera.aspect = aspectRatio;
                renderer.setSize(rendererDimensions.width, rendererDimensions.height);
                realRenderer.setSize(rendererDimensions.width, rendererDimensions.height);
                isProjectionMatrixSet = false;
                spatialInterface.subscribeToMatrix(); // this should trigger a new retrieval of the projectionMatrix
            });

            realRenderer = new THREE.WebGLRenderer( { alpha: true } );
            realRenderer.debug.checkShaderErrors = false;
            realRenderer.setPixelRatio(window.devicePixelRatio);
            realRenderer.setSize(rendererDimensions.width, rendererDimensions.height);
            realGl = realRenderer.getContext();
            
            // create a fullscreen webgl renderer for the threejs content
            renderer = new THREE.WebGLRenderer( { context: gl, alpha: true } );
            renderer.debug.checkShaderErrors = false;
            renderer.setPixelRatio( window.devicePixelRatio );
            renderer.setSize( rendererDimensions.width, rendererDimensions.height );

            // create a threejs camera and scene
            camera = new THREE.PerspectiveCamera( 70, aspectRatio, 1, 1000 );
            scene = new THREE.Scene();
            scene.add(camera);

            raycaster = new THREE.Raycaster();

            // create a parent 3D object to contain all the three js objects
            // we can apply the marker transform to this object and all of its
            // children objects will be affected
            mainContainerObj = new THREE.Object3D();
            mainContainerObj.matrixAutoUpdate = false;
            mainContainerObj.name = 'mainContainerObj';
            scene.add(mainContainerObj);

            const ambientLight = new THREE.AmbientLight( 0x606060 ); // soft white light
            scene.add( ambientLight );
            
            const directionalLight = new THREE.DirectionalLight( 0xffffff, 0.5 );
            directionalLight.position.set(1, 1, 1);
            scene.add( directionalLight );
            
            const loader = new THREE.GLTFLoader();
            loader.load('models/3dbenchy.glb', (gltf) => {
                material = new THREE.MeshStandardMaterial({color: color});
                const loadedObj = gltf.scene;
                loadedObj.traverse(child => {
                    // Setting our own material so we can change the colors easily
                    if (child.material) {
                        child.material = material;
                    }
                });
                // Scaling and rotation depend on how your model was exported
                loadedObj.rotateX(Math.PI/2);
                loadedObj.scale.set(1000, 1000, 1000);
                mainContainerObj.add(loadedObj);

                spatialInterface.onSpatialInterfaceLoaded(function() {
                    spatialInterface.subscribeToMatrix();
                    spatialInterface.addMatrixListener(updateMatrices); // whenever we receive new matrices from the editor, update the 3d scene
                    spatialInterface.registerTouchDecider(touchDecider);
                    resolve();
                });
            });
        } else {
            setTimeout(() => {
                initRenderer().then(resolve).catch(reject);
            }, 500);
        }
    });
}

// Limit interactions to when this app's envelope is open
function touchDecider(_eventData) {
    return envelope.isOpen;
}

function setMatrixFromArray(matrix, array) {
    matrix.set( array[0], array[4], array[8], array[12],
        array[1], array[5], array[9], array[13],
        array[2], array[6], array[10], array[14],
        array[3], array[7], array[11], array[15]
    );
}

function updateMatrices(modelViewMatrix, projectionMatrix) {
    lastProjectionMatrix = projectionMatrix;
    lastModelViewMatrix = modelViewMatrix;
}

// Called by gl proxy code
render = function(_now) {
    // only set the projection matrix for the camera 1 time, since it stays the same
    if (!isProjectionMatrixSet && lastProjectionMatrix && lastProjectionMatrix.length === 16) {
        setMatrixFromArray(camera.projectionMatrix, lastProjectionMatrix);
        camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
        isProjectionMatrixSet = true;
    }

    if (isProjectionMatrixSet && lastModelViewMatrix && lastModelViewMatrix.length === 16) {
        // update model view matrix
        setMatrixFromArray(mainContainerObj.matrix, lastModelViewMatrix);

        // render the scene
        if (renderer && scene && camera) {
            renderer.render(scene, camera);
        }
    }
};
