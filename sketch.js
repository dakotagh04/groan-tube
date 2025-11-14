// Motion-controlled ball with proper device motion permission + physics integration
// iOS 13+ requires an explicit user gesture to grant motion sensor access.

const CANVAS_SIZE_PERCENT = 0.8; // canvas size as percent of smaller screen dimension

let ax = 0,
  ay = 0,
  az = 0; // raw acceleration (including gravity)
let vx = 0,
  vy = 0; // velocity we integrate from acceleration
let xpos, ypos; // position
let friction = 0.98; // simple damping to avoid runaway speeds
let accelScale = 1.2; // scale factor to tune sensitivity

let invertX = false;
let invertY = false;

const invertXCheckbox = document.getElementById("invertX");
const invertYCheckbox = document.getElementById("invertY");
invertXCheckbox.checked = invertX;
invertYCheckbox.checked = invertY;
invertXCheckbox.addEventListener("change", () => {
  invertX = invertXCheckbox.checked;
});
invertYCheckbox.addEventListener("change", () => {
  invertY = invertYCheckbox.checked;
});

const permissionButton = document.getElementById("permissionButton");

let osc; // p5.Oscillator

permissionButton.addEventListener("click", async (e) => {
  e.preventDefault();

  // iOS 13+ requires a user gesture to grant access
  if (
    typeof DeviceMotionEvent !== "undefined" &&
    typeof DeviceMotionEvent.requestPermission === "function"
  ) {
    try {
      const response = await DeviceMotionEvent.requestPermission();
      if (response === "granted") {
        startMotion();
        // start audio after user gesture
        userStartAudio().then(() => {
          if (!osc) setupOscillator();
          osc.start();
        });
      }
    } catch (error) {
      console.error("Error requesting motion permission:", error);
    }
  } else {
    startMotion();
    userStartAudio().then(() => {
      if (!osc) setupOscillator();
      osc.start();
    });
  }
});

const canvas = document.getElementById("canvas");

function setupOscillator() {
  osc = new p5.Oscillator('sine'); // nota constante
  osc.freq(440); // La4
  osc.amp(0); // volumen inicial
}

function windowResized() {
  const s = min(windowWidth, windowHeight) * CANVAS_SIZE_PERCENT;
  resizeCanvas(s, s);

  xpos = constrain(xpos, 0, width);
  ypos = constrain(ypos, 0, height);

  redraw();
}

function setup() {
  rectMode(CENTER);
  const s = min(windowWidth, windowHeight) * CANVAS_SIZE_PERCENT;
  createCanvas(s, s, null, canvas);

  xpos = width / 2;
  ypos = height / 2;
}

function draw() {
  background(0);

  // Map device acceleration to screen coordinates considering screen rotation
  const { sx, sy } = mapMotionToScreen(ax || 0, ay || 0);

  // Integrate acceleration into velocity
  vx += sx * accelScale;
  vy += -sy * accelScale;

  // Apply simple friction
  vx *= friction;
  vy *= friction;

  // Update position
  xpos += vx;
  ypos += vy;

  // Collide with edges and bounce
  const r = 12.5; // radius of the ball
  if (xpos > width - r) {
    xpos = width - r;
    vx *= -0.8;
  }
  if (xpos < r) {
    xpos = r;
    vx *= -0.8;
  }
  if (ypos > height - r) {
    ypos = height - r;
    vy *= -0.8;
  }
  if (ypos < r) {
    ypos = r;
    vy *= -0.8;
  }

  // Draw ball
  noStroke();
  fill(255, 0, 0);
  ellipse(xpos, ypos, r * 2, r * 2);

  // --- CONTROL OSCILLATOR VOLUME ---
  if (osc) {
    // arriba = volumen máximo, abajo = volumen mínimo
    let vol = map(ypos, height, 0, 0.05, 1);
    vol = constrain(vol, 0, 1);
    osc.amp(vol, 0.1); // suavizado
  }

  // Debug text
  fill(255);
  noStroke();
  textSize(14);
  text("ax: " + nf(ax, 1, 2), 25, 25);
  text("ay: " + nf(ay, 1, 2), 25, 45);
  text("az: " + nf(az, 1, 2), 25, 65);
  text("vx: " + nf(vx, 1, 2), 25, 90);
  text("vy: " + nf(vy, 1, 2), 25, 110);
  text("invertX: " + invertX, 25, 135);
  text("invertY: " + invertY, 25, 150);
}

function startMotion() {
  window.addEventListener(
    "devicemotion",
    (e) => {
      const a = e.accelerationIncludingGravity || e.acceleration;
      if (!a) return;
      ax = typeof a.x === "number" ? a.x : 0;
      ay = typeof a.y === "number" ? a.y : 0;
      az = typeof a.z === "number" ? a.z : 0;
    },
    true
  );
}

// --- Helpers to normalize device axes to screen axes ---
function getScreenAngle() {
  if (screen.orientation && typeof screen.orientation.angle === "number") {
    return screen.orientation.angle;
  }
  if (typeof window.orientation === "number") {
    return window.orientation;
  }
  return 0;
}

function rotate2D(x, y, deg) {
  const rad = (deg * Math.PI) / 180;
  const cosA = Math.cos(rad);
  const sinA = Math.sin(rad);
  return { x: x * cosA - y * sinA, y: x * sinA + y * cosA };
}

function mapMotionToScreen(axDev, ayDev) {
  const ang = getScreenAngle();
  const r = rotate2D(axDev, ayDev, ang);
  let sx = r.x * (invertX ? -1 : 1);
  let sy = r.y * (invertY ? -1 : 1);
  return { sx, sy };
}

function keyPressed() {
  if (key === "x" || key === "X") invertX = !invertX;
  if (key === "y" || key === "Y") invertY = !invertY;
  if (key === "f" || key === "F") {
    invertX = !invertX;
    invertY = !invertY;
  }
}
