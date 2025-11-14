// ===============================
//      CONFIGURACIÓN GENERAL
// ===============================

const CANVAS_SIZE_PERCENT = 0.8;

let ax = 0, ay = 0, az = 0;
let vx = 0, vy = 0;
let xpos, ypos;
let friction = 0.98;
let accelScale = 1.2;

let invertX = false;
let invertY = false;

const invertXCheckbox = document.getElementById("invertX");
const invertYCheckbox = document.getElementById("invertY");
invertXCheckbox.addEventListener("change", () => invertX = invertXCheckbox.checked);
invertYCheckbox.addEventListener("change", () => invertY = invertYCheckbox.checked);

const permissionButton = document.getElementById("permissionButton");
permissionButton.addEventListener("click", async (e) => {
  e.preventDefault();
  if (typeof DeviceMotionEvent !== "undefined"
   && typeof DeviceMotionEvent.requestPermission === "function") {
    try {
      const response = await DeviceMotionEvent.requestPermission();
      if (response === "granted") startMotion();
    } catch (err) {
      console.error(err);
    }
  } else startMotion();
});

// ====================================
//         SISTEMA DE SONIDO
// ====================================

let osc, filter, env;
let soundEnabled = false;

const sensSlider = document.getElementById("sensSlider");
const brightSlider = document.getElementById("brightSlider");
const soundBtn = document.getElementById("soundButton");

soundBtn.addEventListener("click", async () => {
  const ctx = getAudioContext();
  await ctx.resume();

  if (!soundEnabled) {
    startGroanSound();
    soundEnabled = true;
    soundBtn.innerText = "Sonido activado ✔";
  }
});

function startGroanSound() {
  osc = new p5.Oscillator("triangle");
  filter = new p5.LowPass();
  env = new p5.Envelope(0.01, 0.6, 0.2, 0.0);

  osc.disconnect();
  osc.connect(filter);
  osc.start();
  osc.amp(0);
}

function updateGroanSound(ax, ay, az) {
  if (!soundEnabled || !osc) return;

  const mag = Math.sqrt(ax*ax + ay*ay + az*az);
  const sens = parseFloat(sensSlider.value);

  const freq = map(mag * sens, 0, 30, 80, 800);
  osc.freq(freq, 0.1);

  const brightness = parseFloat(brightSlider.value);
  const cutoff = map(mag, 0, 20, 200, brightness);
  filter.freq(cutoff);

  const amp = constrain(map(mag, 0, 25, 0, 0.8), 0, 0.8);
  osc.amp(amp, 0.1);

  if (mag > 12) env.play(osc);
}

// ====================================
//      ACELERÓMETRO + FÍSICA
// ====================================

function startMotion() {
  window.addEventListener("devicemotion", (e) => {
    const a = e.accelerationIncludingGravity || e.acceleration;
    if (!a) return;

    ax = a.x || 0;
    ay = a.y || 0;
    az = a.z || 0;

    updateGroanSound(ax, ay, az);
  }, true);
}

function getScreenAngle() {
  if (screen.orientation && typeof screen.orientation.angle === "number")
    return screen.orientation.angle;
  if (typeof window.orientation === "number")
    return window.orientation;
  return 0;
}

function rotate2D(x, y, deg) {
  const rad = (deg * Math.PI) / 180;
  return {
    x: x * Math.cos(rad) - y * Math.sin(rad),
    y: x * Math.sin(rad) + y * Math.cos(rad)
  };
}

function mapMotionToScreen(axDev, ayDev) {
  const ang = getScreenAngle();
  const r = rotate2D(axDev, ayDev, ang);

  return {
    sx: r.x * (invertX ? -1 : 1),
    sy: r.y * (invertY ? -1 : 1),
  };
}

// ====================================
//              P5.JS
// ====================================

function setup() {
  const s = min(windowWidth, windowHeight) * CANVAS_SIZE_PERCENT;
  createCanvas(s, s, null, document.getElementById("canvas"));

  rectMode(CENTER);
  xpos = width / 2;
  ypos = height / 2;
}

function windowResized() {
  const s = min(windowWidth, windowHeight) * CANVAS_SIZE_PERCENT;
  resizeCanvas(s, s);
  xpos = constrain(xpos, 0, width);
  ypos = constrain(ypos, 0, height);
  redraw();
}

function draw() {
  background(0);

  const { sx, sy } = mapMotionToScreen(ax, ay);

  vx += sx * accelScale;
  vy += -sy * accelScale;

  vx *= friction;
  vy *= friction;

  xpos += vx;
  ypos += vy;

  const r = 12.5;

  if (xpos > width - r) { xpos = width - r; vx *= -0.8; }
  if (xpos < r) { xpos = r; vx *= -0.8; }
  if (ypos > height - r) { ypos = height - r; vy *= -0.8; }
  if (ypos < r) { ypos = r; vy *= -0.8; }

  fill(255, 0, 0);
  ellipse(xpos, ypos, r*2, r*2);

  fill(255);
  textSize(14);
  text("ax: " + nf(ax,1,2), 10, 20);
  text("ay: " + nf(ay,1,2), 10, 40);
  text("az: " + nf(az,1,2), 10, 60);
  text("freq ~ mov:", 10, 90);
  text("invertX:" + invertX, 10, 120);
  text("invertY:" + invertY, 10, 140);
}

function keyPressed() {
  if (key === "x") invertX = !invertX;
  if (key === "y") invertY = !invertY;
}
