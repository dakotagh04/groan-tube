// Motion-controlled ball with proper device motion permission + physics integration
// iOS 13+ requires an explicit user gesture to grant motion sensor access.
// This sketch shows a small button to enable motion on supported devices.

const CANVAS_SIZE_PERCENT = 0.8; // canvas size as percent of smaller screen dimension

let ax = 0,
  ay = 0,
  az = 0; // raw acceleration (including gravity)
let vx = 0,
  vy = 0; // velocity we integrate from acceleration
let xpos, ypos; // position
let friction = 0.98; // simple damping to avoid runaway speeds
let accelScale = 1.2; // scale factor to tune sensitivity
let permissionBtn; // UI button for iOS permission

let invertX = false;
let invertY = false;

// Variables para el sonido
let oscillator;
let maxVolume = 1.0; // Volumen máximo aumentado
let currentVolume = 0;
let volumeSmoothing = 0.92; // Menos suavizado para respuesta más inmediata

// Rangos de frecuencia más apropiados para groan-tube
const MIN_FREQ = 60;   // Frecuencia mínima más audible
const MAX_FREQ = 600;  // Frecuencia máxima aumentada
const BASE_FREQ = 120; // Frecuencia base más alta

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
      }
    } catch (error) {
      console.error("Error requesting motion permission:", error);
    }
  } else {
    // Other platforms: start listening right away
    startMotion();
  }
});

const canvas = document.getElementById("canvas");

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

  // Configurar el oscilador para el sonido
  setupSound();
}

function setupSound() {
  // Crear un oscilador - usar sine para sonido más puro como groan-tube
  oscillator = new p5.Oscillator('sine');
  
  // Frecuencia inicial en el centro
  oscillator.freq(BASE_FREQ);
  
  // Configurar el volumen - empezar con volumen muy bajo pero audible
  oscillator.amp(0.1);
  
  // Iniciar el oscilador
  oscillator.start();
  
  console.log("Oscilador iniciado - Groan Tube mejorado activado");
}

function draw() {
  background(0);

  // Map device acceleration to screen coordinates considering screen rotation
  const { sx, sy } = mapMotionToScreen(ax || 0, ay || 0);

  // Integrate acceleration into velocity; flip screen Y so tilting up moves ball up
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

  // ACTUALIZAR EL SONIDO BASADO EN LA POSICIÓN VERTICAL Y HORIZONTAL
  updateSound();

  // Draw ball
  noStroke();
  fill(255, 0, 0);
  ellipse(xpos, ypos, r * 2, r * 2);

  // Draw center line for frequency reference
  stroke(100);
  line(width/2, 0, width/2, height);
  
  // Visual feedback for sound
  drawSoundFeedback();
  
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
  text("Volumen: " + nf(currentVolume, 1, 2), 25, 175);
  text("Frecuencia: " + nf(oscillator ? oscillator.getFreq() : 0, 1, 0) + " Hz", 25, 200);
  
  // Frequency guide text
  fill(150);
  text("← Grave", 10, height - 20);
  text("Agudo →", width - 80, height - 20);
}

function drawSoundFeedback() {
  // Visual feedback del sonido
  let freq = oscillator ? oscillator.getFreq() : BASE_FREQ;
  let vol = currentVolume;
  
  // Dibujar onda de sonido
  stroke(0, 255, 0);
  strokeWeight(2);
  noFill();
  beginShape();
  for (let x = 0; x < width; x += 5) {
    let angle = map(x, 0, width, 0, TWO_PI * 4);
    let y = height - 50 + sin(angle * freq / 100) * vol * 30;
    vertex(x, y);
  }
  endShape();
  
  // Dibujar medidor de volumen
  fill(255, 0, 0, 100);
  noStroke();
  rect(width - 30, height - 100, 20, -vol * 80);
}

function updateSound() {
  // CONTROL DE VOLUMEN BASADO EN POSICIÓN VERTICAL
  // Cuando la bola está arriba (ypos baja), volumen alto
  // Cuando la bola está abajo (ypos alta), volumen bajo
  
  // Normalizar la posición Y entre 0 y 1 (invertido porque Y=0 es arriba)
  let normalizedY = 1 - (ypos / height);
  
  // Curva más pronunciada para cambios de volumen más dramáticos
  let targetVolume = pow(normalizedY, 2) * maxVolume;
  
  // Mínimo volumen para que siempre se escuche algo
  targetVolume = max(targetVolume, 0.1);
  
  // Suavizar el cambio de volumen
  currentVolume = currentVolume * volumeSmoothing + targetVolume * (1 - volumeSmoothing);
  
  // CONTROL DE FRECUENCIA BASADO EN POSICIÓN HORIZONTAL
  // Cuando la bola está a la izquierda, frecuencia baja (grave)
  // Cuando la bola está a la derecha, frecuencia alta (agudo)
  
  // Normalizar la posición X entre -1 y 1 (centro en 0)
  let normalizedX = (xpos / width) * 2 - 1;
  
  // Escala más lineal para mejor control
  let freqModifier = normalizedX;
  
  // Calcular frecuencia target - usar escala más musical
  let targetFreq;
  if (freqModifier >= 0) {
    // Derecha - agudo
    targetFreq = BASE_FREQ + (MAX_FREQ - BASE_FREQ) * pow(freqModifier, 1.5);
  } else {
    // Izquierda - grave
    targetFreq = BASE_FREQ + (MIN_FREQ - BASE_FREQ) * pow(-freqModifier, 1.2);
  }
  
  // Asegurar que la frecuencia esté en rango audible
  targetFreq = constrain(targetFreq, MIN_FREQ, MAX_FREQ);
  
  // Aplicar el volumen y frecuencia al oscilador
  if (oscillator) {
    // Volumen con menos suavizado para respuesta más inmediata
    oscillator.amp(currentVolume, 0.05);
    
    // Frecuencia con cambio inmediato para efecto groan-tube más auténtico
    oscillator.freq(targetFreq, 0.1);
  }
}

function startMotion() {
  // Listen for motion events; prefer includingGravity for broader support
  window.addEventListener(
    "devicemotion",
    (e) => {
      const a = e.accelerationIncludingGravity || e.acceleration;
      if (!a) return;
      // Use floats (parseInt would zero-out small values!)
      ax = typeof a.x === "number" ? a.x : 0;
      ay = typeof a.y === "number" ? a.y : 0;
      az = typeof a.z === "number" ? a.z : 0;
    },
    true
  );
}

// --- Helpers to normalize device axes to screen axes ---
function getScreenAngle() {
  // 0, 90, 180, 270 degrees depending on orientation
  if (screen.orientation && typeof screen.orientation.angle === "number") {
    return screen.orientation.angle;
  }
  if (typeof window.orientation === "number") {
    return window.orientation; // legacy iOS/Android
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
  // Rotate device vector into current screen orientation
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
  // Tecla espacio para prueba de sonido
  if (key === ' ') {
    if (oscillator) {
      // Test rápido de frecuencia
      oscillator.freq(300, 0);
      oscillator.amp(0.5, 0.1);
      setTimeout(() => {
        oscillator.amp(currentVolume, 0.2);
        oscillator.freq(BASE_FREQ, 0.2);
      }, 500);
    }
  }
}

// Función para detener el sonido cuando sea necesario
function stopSound() {
  if (oscillator) {
    oscillator.stop();
  }
}