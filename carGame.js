const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

canvas.width = 640;
canvas.height = 360;

// --- 1. PRELOAD IMAGES ---
const images = {};
function loadImage(name, src) {
  images[name] = new Image();
  images[name].src = src;
}
loadImage("player", "models/playerOne.png");
loadImage("car1", "models/car1.png");
loadImage("car2", "models/car2.png");
loadImage("car3", "models/car3.png");

// --- Game State ---
let gameState = "START";
let backgroundOffset = 0;
let roadOffset = 0;
let speed = 0;
let trackPosition = 0;
let maxSpeed = 100;
let accel = 0.5;
let breaking = 0.8;
let decel = 0.1;
let isCrashing = false;
let shakeAmount = 0;
let collisionCooldown = 0;

// GLOBAL DISTANCE (This never resets to 0)
let playerDistance = 0;

let currentLap = 1;
const lapsToFinish = 4;
const lapDistance = 2000;
let startTime = 0;
let finalTime = 0;
let playerPosition = 4;
// MUSIC
let audioCtx, engineOsc, engineGain;
let particles = [];
let exhaustFlicker = 0;
// best TIME
let bestTime = localStorage.getItem("retroRacer_bestTime") || null;

const player = {
  x: 0,
  width: 240,
  height: 160,
};

// Each rival starts at a fixed global distance
let opponents = [
  { name: "Rival 1", x: -0.5, distance: 300, speed: 66, img: "car1" },
  { name: "Rival 2", x: 0.5, distance: 600, speed: 70, img: "car2" },
  { name: "Rival 3", x: -0.2, distance: 1000, speed: 62, img: "car3" },
];

let envObjects = [
  { z: 500, side: -2.5, type: "tree" },
  { z: 1000, side: 2.5, type: "tree" },
  { z: 1500, side: -3.2, type: "rock" },
  { z: 1800, side: 3.5, type: "rock" },
  { z: 2200, side: -2.8, type: "tree" },
];

const MAX_Z = 2500;
const keys = { Left: false, Right: false, Up: false, Down: false };

// --- Input Listeners ---
window.addEventListener("keydown", (e) => {
  if (gameState === "START" && e.key === "Enter") {
    initAudio();
    gameState = "PLAYING";
    startTime = Date.now();
  }
  if (gameState === "FINISHED" && e.key === "Enter") {
    // FULL RESET
    playerDistance = 0;
    currentLap = 1;
    speed = 0;
    player.x = 0;
    opponents[0].distance = 300;
    opponents[1].distance = 600;
    opponents[2].distance = 1000;
    startTime = Date.now();
    gameState = "PLAYING";
  }
  if (e.key === "ArrowLeft") keys.Left = true;
  if (e.key === "ArrowRight") keys.Right = true;
  if (e.key === "ArrowUp") keys.Up = true;
  if (e.key === "ArrowDown") keys.Down = true;
});

window.addEventListener("keyup", (e) => {
  if (e.key === "ArrowLeft") keys.Left = false;
  if (e.key === "ArrowRight") keys.Right = false;
  if (e.key === "ArrowUp") keys.Up = false;
  if (e.key === "ArrowDown") keys.Down = false;
});

function initAudio() {
  if (audioCtx) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  engineOsc = audioCtx.createOscillator();
  engineGain = audioCtx.createGain();

  engineOsc.type = "sawtooth"; // Classic 8-bit engine buzz
  engineOsc.frequency.setValueAtTime(40, audioCtx.currentTime);
  engineGain.gain.setValueAtTime(0, audioCtx.currentTime);

  engineOsc.connect(engineGain);
  engineGain.connect(audioCtx.destination);
  engineOsc.start();
}

function update() {
  if (shakeAmount > 0) shakeAmount -= 1;
  if (startTime === 0) startTime = Date.now();

  // 1. Physics
  if (keys.Up && !isCrashing) speed += accel;
  else if (keys.Down) speed -= breaking;
  else speed -= decel;

  if (isCrashing) {
    speed -= 2.5;
    if (speed <= 10) isCrashing = false;
  }

  if (speed < 0) speed = 0;
  if (speed > maxSpeed) speed = maxSpeed;

  // 2. Movement Tracking
  playerDistance += speed * 0.01;
  trackPosition += speed * 0.01;
  roadOffset += speed * 0.1;

  // 3. Environment
  envObjects.forEach((obj) => {
    obj.z -= speed * 0.2;
    if (obj.z < 1) obj.z = MAX_Z;
  });

  // 4. Opponents Logic
  let rank = 1;
  if (collisionCooldown > 0) collisionCooldown--;

  opponents.forEach((opt) => {
    opt.distance += opt.speed * 0.01; // AI moves forward

    // Z is now calculated using ONLY global distance. No resets.
    opt.z = (opt.distance - playerDistance) * 10;

    // Position check: if they have more global distance, they are ahead
    if (opt.distance > playerDistance) rank++;

    // Collision
    if (collisionCooldown === 0 && opt.z > 60 && opt.z < 110) {
      if (Math.abs(opt.x - player.x) < 0.45) {
        handleCollision();
        collisionCooldown = 80;
      }
    }
  });
  playerPosition = rank;

  // 5. Steering
  const steerSpeed = 0.0015 * speed;
  if (keys.Left) player.x -= steerSpeed;
  if (keys.Right) player.x += steerSpeed;

  if (player.x < -2.5) player.x = -2.5;
  if (player.x > 2.5) player.x = 2.5;

  // 6. Lap & Win Logic
  currentLap = Math.floor(playerDistance / lapDistance) + 1;

  if (currentLap > lapsToFinish) {
    finalTime = ((Date.now() - startTime) / 1000).toFixed(2);

    // --- HIGH SCORE LOGIC ---
    if (!bestTime || parseFloat(finalTime) < parseFloat(bestTime)) {
      bestTime = finalTime;
      localStorage.setItem("retroRacer_bestTime", bestTime);
    }

    gameState = "FINISHED";
  }

  // 1. Update Audio Pitch
  if (audioCtx) {
    let freq = 40 + speed * 1.8; // Higher speed = higher pitch
    engineOsc.frequency.setTargetAtTime(freq, audioCtx.currentTime, 0.1);

    let vol = gameState === "PLAYING" ? 0.05 + (speed / maxSpeed) * 0.08 : 0;
    engineGain.gain.setTargetAtTime(vol, audioCtx.currentTime, 0.1);
  }

  // 2. Generate Tire Smoke
  // Only smoke if moving fast and steering hard
  if (speed > 40 && (keys.Left || keys.Right)) {
    for (let i = 0; i < 2; i++) {
      particles.push({
        x: canvas.width / 2 + (Math.random() - 0.5) * 120, // Spread across tires
        y: canvas.height - 40,
        vx: (Math.random() - 0.5) * 4,
        vy: -Math.random() * 3,
        size: Math.random() * 5 + 5, // Start small
        growth: Math.random() * 0.5 + 0.2, // NEW: Expand over time
        color: Math.random() > 0.5 ? "#ecf0f1" : "#bdc3c7", // Variation in smoke color
        life: 1.0,
      });
    }
  }

  // 3. Update Particles
  particles.forEach((p, i) => {
    if (p.isSpark) {
      ctx.shadowBlur = 10;
      ctx.shadowColor = "orange";
      ctx.fillStyle = "white";
      ctx.fillRect(p.x, p.y, p.size, p.size); // Sparks are square/pixels
      ctx.shadowBlur = 0; // reset
    } else {
      p.x += p.vx;
      p.y += p.vy;
      p.life -= 0.03;
      if (p.life <= 0) particles.splice(i, 1);
    }
  });

  exhaustFlicker = Math.sin(Date.now() * 0.1) * 10;
}

function handleCollision() {
  if (!isCrashing) {
    isCrashing = true;
    speed *= 0.5;
    shakeAmount = 15;
  }
}

// --- Drawing functions remain mostly same ---

function drawMenu() {
  ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "white";
  ctx.textAlign = "center";
  ctx.font = "bold 50px 'Courier New'";
  ctx.fillText("RETRO RACER", canvas.width / 2, canvas.height / 2 - 40);

  ctx.font = "20px 'Courier New'";
  ctx.fillText(
    "USE ARROW KEYS TO DRIVE",
    canvas.width / 2,
    canvas.height / 2 + 20
  );

  // Show Best Time
  ctx.fillStyle = "#00d2ff";
  ctx.font = "18px 'Courier New'";
  let recordText = bestTime ? "RECORD: " + bestTime + "s" : "RECORD: ---";
  ctx.fillText(recordText, canvas.width / 2, canvas.height / 2 + 130);

  if (Math.floor(Date.now() / 500) % 2 === 0) {
    ctx.font = "bold 24px 'Courier New'";
    ctx.fillStyle = "yellow";
    ctx.fillText(
      "PRESS ENTER TO START",
      canvas.width / 2,
      canvas.height / 2 + 80
    );
  }
}

function drawUI() {
  ctx.fillStyle = "white";
  ctx.font = "bold 24px 'Courier New'";
  ctx.textAlign = "left";
  // Cap the lap display so it doesn't show "Lap 5/4"
  let lapText = Math.min(currentLap, lapsToFinish);
  ctx.fillText("LAP " + lapText + "/" + lapsToFinish, 20, 40);

  ctx.textAlign = "center";
  let suffix = ["st", "nd", "rd", "th"][playerPosition - 1];
  ctx.fillText(playerPosition + suffix, canvas.width / 2, 40);

  ctx.textAlign = "right";
  ctx.fillText(Math.floor(speed * 2.2), canvas.width - 20, 40);
}

function drawBackground() {
  const horizon = canvas.height / 2;

  // 1. GRADIENT SKY (Banded for a retro look)
  // We draw 4 bands of color to simulate a sunset/atmosphere
  const skyColors = ["#1a1a4e", "#24247e", "#3c2bad", "#70a1ff"];
  const bandHeight = horizon / skyColors.length;
  skyColors.forEach((color, i) => {
    ctx.fillStyle = color;
    ctx.fillRect(0, i * bandHeight, canvas.width, bandHeight + 1);
  });

  // 2. RETRO STRIPED SUN
  // This stays behind the mountains
  let sunX = (450 + backgroundOffset * 0.1) % (canvas.width + 300);
  if (sunX < -150) sunX = canvas.width + 150;

  ctx.fillStyle = "#ffdd59";
  ctx.beginPath();
  ctx.arc(sunX, horizon - 80, 60, 0, Math.PI * 2);
  ctx.fill();

  // Add "Vaporwave" stripes to the sun
  ctx.fillStyle = skyColors[1];
  for (let i = 0; i < 5; i++) {
    ctx.fillRect(sunX - 70, horizon - 110 + i * 15, 140, 3 + i);
  }

  // 3. FAR MOUNTAINS (Jagged Silhouette)
  // We add extra "points" to the path to make them look rocky, not like geometric triangles
  ctx.fillStyle = "#1a1a4e";
  for (let i = -1; i < 4; i++) {
    let x = i * 400 + ((backgroundOffset * 0.3) % 400);
    let h = 180;

    ctx.beginPath();
    ctx.moveTo(x, horizon);
    ctx.lineTo(x + 100, horizon - h * 0.6); // Shoulder
    ctx.lineTo(x + 180, horizon - h); // Peak
    ctx.lineTo(x + 220, horizon - h * 0.8); // Notch
    ctx.lineTo(x + 280, horizon - h * 0.9); // Second peak
    ctx.lineTo(x + 400, horizon);
    ctx.fill();

    // Darker shading on the right face
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.beginPath();
    ctx.moveTo(x + 180, horizon - h);
    ctx.lineTo(x + 400, horizon);
    ctx.lineTo(x + 180, horizon);
    ctx.fill();
    ctx.fillStyle = "#1a1a4e";
  }

  // 4. NEAR MOUNTAINS (Chiseled with Snow)
  for (let i = -1; i < 5; i++) {
    let x = i * 300 + ((backgroundOffset * 0.7) % 300);
    let h = 110;

    // Mountain Body
    ctx.fillStyle = "#4834d4";
    ctx.beginPath();
    ctx.moveTo(x, horizon);
    ctx.lineTo(x + 120, horizon - h * 0.8);
    ctx.lineTo(x + 150, horizon - h);
    ctx.lineTo(x + 180, horizon - h * 0.7);
    ctx.lineTo(x + 300, horizon);
    ctx.fill();

    // SNOW CAP (Follows the jagged peak)
    ctx.fillStyle = "#dff9fb";
    ctx.beginPath();
    ctx.moveTo(x + 150, horizon - h);
    ctx.lineTo(x + 170, horizon - h + 30);
    ctx.lineTo(x + 150, horizon - h + 20); // Jagged bottom of snow
    ctx.lineTo(x + 130, horizon - h + 30);
    ctx.fill();

    // Side Shading for 3D depth
    ctx.fillStyle = "rgba(0,0,0,0.2)";
    ctx.beginPath();
    ctx.moveTo(x + 150, horizon - h);
    ctx.lineTo(x + 300, horizon);
    ctx.lineTo(x + 150, horizon);
    ctx.fill();
  }

  // 5. CLOUDS (With depth)
  ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
  let cloudX = (100 + backgroundOffset * 0.2) % (canvas.width + 200);
  // Draw a blocky, retro-style cloud
  ctx.fillRect(cloudX, 40, 80, 20);
  ctx.fillRect(cloudX + 20, 30, 40, 20);
}

function drawEnvironment() {
  const horizon = canvas.height / 2;
  const centerX = canvas.width / 2;

  // 1. SORT BY DEPTH
  const sortedEnv = [...envObjects].sort((a, b) => b.z - a.z);

  sortedEnv.forEach((obj) => {
    // 2. PROJECT TO 2D
    let scale = 160 / obj.z;
    let x = centerX + (obj.side - player.x) * (scale * canvas.width * 0.8);
    let y = horizon + scale * 100;
    let size = scale * 250;

    // 3. ATMOSPHERIC FADING (The Haze)
    // As objects get further away (lower scale), they fade into the blue sky color
    let opacity = 1.0;
    if (obj.z > 1500) {
      opacity = 1.0 - (obj.z - 1500) / (MAX_Z - 1500);
    }

    // 4. DRAW ONLY IF ON SCREEN
    if (obj.z > 5 && y > horizon && x + size > 0 && x - size < canvas.width) {
      ctx.globalAlpha = Math.max(0, opacity);

      // 5. DYNAMIC GROUND SHADOW
      // We offset the shadow slightly to the opposite side of the sun
      let sunX = (450 + backgroundOffset * 0.1) % (canvas.width + 300);
      let shadowOffset = (x - sunX) * 0.05;

      ctx.fillStyle = "rgba(0,0,0,0.25)";
      ctx.beginPath();
      // The shadow stretches more when the object is closer
      ctx.ellipse(
        x + shadowOffset,
        y + scale * 5,
        size / 3,
        size / 12,
        0,
        0,
        Math.PI * 2
      );
      ctx.fill();

      // 6. DRAW OBJECTS WITH DEPTH DETAIL
      if (obj.type === "tree") {
        // Pass a tiny "wind" wobble based on track position
        let wobble = Math.sin(trackPosition * 2 + obj.z) * (scale * 5);
        drawPalmTree(x + wobble, y, size);
      } else if (obj.type === "rock") {
        drawRock(x, y, size);
      }

      ctx.globalAlpha = 1.0; // Reset alpha for next object
    }
  });
}

function drawPalmTree(x, y, size) {
  // 1. TAPERED SEGMENTED TRUNK
  const segments = 7;
  const trunkBaseWidth = size / 6;

  for (let i = 0; i < segments; i++) {
    let percent = i / segments;
    let nextPercent = (i + 1) / segments;

    // Tapering logic: wider at bottom, narrower at top
    let currentWidth = trunkBaseWidth * (1 - percent * 0.5);
    let nextWidth = trunkBaseWidth * (1 - nextPercent * 0.5);

    let segY = y - size * percent;
    let nextY = y - size * nextPercent;

    // Add a natural curve/lean to the trunk
    let lean = Math.sin(i * 0.5) * (size / 40);
    let nextLean = Math.sin((i + 1) * 0.5) * (size / 40);

    // Draw the "Shadow" side
    ctx.fillStyle = "#5d4037";
    ctx.beginPath();
    ctx.moveTo(x + lean - currentWidth / 2, segY);
    ctx.lineTo(x + nextLean - nextWidth / 2, nextY);
    ctx.lineTo(x + nextLean, nextY);
    ctx.lineTo(x + lean, segY);
    ctx.fill();

    // Draw the "Highlight" side
    ctx.fillStyle = "#8d6e63";
    ctx.beginPath();
    ctx.moveTo(x + lean, segY);
    ctx.lineTo(x + nextLean, nextY);
    ctx.lineTo(x + nextLean + nextWidth / 2, nextY);
    ctx.lineTo(x + lean + currentWidth / 2, segY);
    ctx.fill();

    // Add horizontal "Bark" lines
    ctx.strokeStyle = "rgba(0,0,0,0.1)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + lean - currentWidth / 2, segY);
    ctx.lineTo(x + lean + currentWidth / 2, segY);
    ctx.stroke();
  }

  // 2. THE CROWN (The bulbous part where leaves start)
  ctx.fillStyle = "#3e2723";
  ctx.beginPath();
  let crownLean = Math.sin(segments * 0.5) * (size / 40);
  ctx.arc(x + crownLean, y - size, size / 12, 0, Math.PI * 2);
  ctx.fill();

  // 3. DROOPING PALM FRONDS (The Leaves)
  const leafCount = 10;
  for (let i = 0; i < leafCount; i++) {
    ctx.save();
    ctx.translate(x + crownLean, y - size);
    ctx.rotate((i * Math.PI * 2) / leafCount);

    // Create a drooping effect using a quadratic curve
    let leafLen = size * 0.6;
    let leafWidth = size / 8;

    // Shade alternating leaves
    ctx.fillStyle = i % 2 === 0 ? "#2ecc71" : "#27ae60";

    // Draw leaf as a "Swaying blade"
    ctx.beginPath();
    ctx.moveTo(0, 0);
    // Control point creates the "droop"
    ctx.quadraticCurveTo(leafLen / 2, -leafWidth, leafLen, leafWidth);
    ctx.quadraticCurveTo(leafLen / 2, leafWidth / 2, 0, 0);
    ctx.fill();

    // Add a "Spine" to the leaf
    ctx.strokeStyle = "rgba(0,0,0,0.15)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(leafLen / 2, -leafWidth / 2, leafLen, leafWidth);
    ctx.stroke();

    ctx.restore();
  }
}

function drawRock(x, y, size) {
  let w = size / 2;
  let h = size / 4;

  // Sun-lit side (top/left)
  ctx.fillStyle = "#bdc3c7";
  ctx.beginPath();
  ctx.moveTo(x - w, y);
  ctx.lineTo(x - w / 2, y - h);
  ctx.lineTo(x + w / 4, y - h / 1.5);
  ctx.lineTo(x, y);
  ctx.fill();

  // Shadow side (right)
  ctx.fillStyle = "#7f8c8d";
  ctx.beginPath();
  ctx.moveTo(x + w / 4, y - h / 1.5);
  ctx.lineTo(x + w, y);
  ctx.lineTo(x, y);
  ctx.fill();
}

function drawOpponents() {
  const horizon = canvas.height / 2;
  const centerX = canvas.width / 2;

  // 1. SORT BY DEPTH (Painter's Algorithm)
  const sortedAI = [...opponents].sort((a, b) => b.z - a.z);

  sortedAI.forEach((opt) => {
    // 2. PROJECT TO 2D
    let scale = 160 / opt.z;
    let x = centerX + (opt.x - player.x) * (scale * canvas.width * 0.8);
    let y = horizon + scale * 100;

    // Scale widths based on the sprites provided (proportions 220x130)
    let w = scale * 220;
    let h = scale * 130;

    // 3. VISIBILITY & FADING
    // Don't draw if behind the camera or too far into the distance
    if (opt.z > 10 && opt.z < 2500) {
      ctx.save();

      // ATMOSPHERIC FADE: Far cars blend into the horizon haze
      let opacity = 1.0;
      if (opt.z > 1500) opacity = 1.0 - (opt.z - 1500) / 1000;
      ctx.globalAlpha = Math.max(0, opacity);

      // 4. ENGINE VIBRATION
      // Makes the rivals look like they are actually driving, not sliding
      let vibration = Math.sin(Date.now() * 0.2 + opt.z) * (scale * 2);
      ctx.translate(x, y + vibration);

      // 5. GROUND SHADOW
      // This is vital to make the AI look like it's touching the asphalt
      ctx.fillStyle = "rgba(0,0,0,0.3)";
      ctx.beginPath();
      ctx.ellipse(0, 0, w * 0.45, h * 0.15, 0, 0, Math.PI * 2);
      ctx.fill();

      // 6. DRAW THE CAR SPRITE
      if (images[opt.img].complete) {
        ctx.drawImage(images[opt.img], -w / 2, -h, w, h);
      }

      // 7. TAIL LIGHT GLOW (The "Chase" Effect)
      // Adds a subtle red glow to rivals to make them pop against the road
      if (opt.z < 1000) {
        ctx.shadowBlur = 15 * scale;
        ctx.shadowColor = "red";
        // Draw two small red rectangles over the tail light positions
        ctx.fillStyle = "rgba(255, 0, 0, 0.5)";
        ctx.fillRect(-w * 0.3, -h * 0.3, w * 0.15, h * 0.1); // Left light
        ctx.fillRect(w * 0.14, -h * 0.3, w * 0.15, h * 0.1); // Right light
      }

      ctx.restore();
    }
  });
}

function drawFinishScreen() {
  ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // If the current time matches the best time, it's a new record!
  if (finalTime === bestTime) {
    ctx.fillStyle = "cyan";
    ctx.font = "bold 20px 'Courier New'";
    ctx.fillText("NEW RECORD!", canvas.width / 2, canvas.height / 2 - 80);
  }

  ctx.fillStyle = "yellow";
  ctx.textAlign = "center";
  ctx.font = "bold 40px 'Courier New'";
  let result =
    playerPosition === 1
      ? "YOU WIN!"
      : "FINISHED " +
        playerPosition +
        (playerPosition === 2 ? "nd" : playerPosition === 3 ? "rd" : "th");
  ctx.fillText(result, canvas.width / 2, canvas.height / 2 - 40);

  ctx.fillStyle = "white";
  ctx.font = "24px 'Courier New'";
  ctx.fillText(
    "TIME: " + finalTime + "s",
    canvas.width / 2,
    canvas.height / 2 + 10
  );

  ctx.font = "18px 'Courier New'";
  ctx.fillText(
    "BEST: " + bestTime + "s",
    canvas.width / 2,
    canvas.height / 2 + 40
  );

  ctx.font = "18px 'Courier New'";
  ctx.fillText(
    "PRESS ENTER TO RESTART",
    canvas.width / 2,
    canvas.height / 2 + 80
  );
}

function drawParticles() {
  particles.forEach((p) => {
    // 1. UPDATE LOGIC (Integrated here for smoothness)
    p.size += p.growth; // Particles expand as they rise
    p.x += p.vx;
    p.y += p.vy;
    p.life -= 0.02;

    if (p.life > 0) {
      ctx.save();

      // 2. SOFT EDGES (Blur effect)
      // High-end smoke shouldn't have hard pixel edges
      ctx.globalAlpha = p.life * 0.4;

      // 3. LAYERED CLOUDS
      // We draw the particle twice: a larger soft outer glow and a tighter core
      const drawCloud = (color, sizeMult) => {
        ctx.fillStyle = color;
        ctx.beginPath();
        // We use slightly randomized offsets to make the smoke look "lumpy"
        let offsetX = Math.sin(p.life * 10) * 2;
        ctx.arc(p.x + offsetX, p.y, p.size * sizeMult, 0, Math.PI * 2);
        ctx.fill();
      };

      // Draw shadow/outer smoke
      drawCloud("#7f8c8d", 1.2);
      // Draw inner bright smoke
      drawCloud(p.color, 0.8);

      ctx.restore();
    }
  });
}

function drawPlayer() {
  const screenX = canvas.width / 2;
  const screenY = canvas.height - 140;

  // 1. ENGINE VIBRATION & BOUNCE
  // Makes the car vibrate slightly based on speed (suspension feel)
  let vibration =
    speed > 0 ? Math.sin(Date.now() * 0.1) * (speed / 100) * 2 : 0;

  // 2. STEERING LEAN
  // Tilts the car sprite slightly when turning left or right
  let lean = 0;
  if (keys.Left) lean = -0.05;
  if (keys.Right) lean = 0.05;

  ctx.save();
  ctx.translate(screenX, screenY + vibration);
  ctx.rotate(lean); // Apply the tilt

  // 3. GROUND SHADOW
  // Anchors the car to the road so it doesn't look like it's floating
  ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
  ctx.beginPath();
  ctx.ellipse(0, player.height - 10, player.width * 0.4, 15, 0, 0, Math.PI * 2);
  ctx.fill();

  // 4. ELITE AFTERBURNER EFFECTS
  if (keys.Up && speed > 0) {
    // Ground Reflection of the flames
    let gradientRef = ctx.createRadialGradient(
      0,
      player.height,
      0,
      0,
      player.height,
      60
    );
    gradientRef.addColorStop(0, "rgba(0, 200, 255, 0.4)");
    gradientRef.addColorStop(1, "rgba(0, 200, 255, 0)");
    ctx.fillStyle = gradientRef;
    ctx.fillRect(-player.width, player.height - 20, player.width * 2, 40);

    // Flickering Flame Glows
    const drawFlame = (offsetX) => {
      let size = 25 + exhaustFlicker;
      // Core (Bright white/blue)
      ctx.fillStyle = "white";
      ctx.beginPath();
      ctx.arc(offsetX, player.height - 40, size * 0.4, 0, Math.PI * 2);
      ctx.fill();
      // Outer Glow
      let grad = ctx.createRadialGradient(
        offsetX,
        player.height - 40,
        0,
        offsetX,
        player.height - 40,
        size
      );
      grad.addColorStop(0, "rgba(0, 200, 255, 0.8)");
      grad.addColorStop(1, "rgba(0, 200, 255, 0)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(offsetX, player.height - 40, size, 0, Math.PI * 2);
      ctx.fill();
    };

    drawFlame(-50); // Left Exhaust
    drawFlame(50); // Right Exhaust
  }

  // 5. DRAW THE SPRITE
  if (images.player.complete) {
    // We use -width/2 because we translated the context to screenX
    ctx.drawImage(
      images.player,
      -player.width / 2,
      0,
      player.width,
      player.height
    );
  }

  ctx.restore();
}

function draw() {
  const centerX = canvas.width / 2;
  const horizon = canvas.height / 2;

  // 1. DRAW STATIC UI BACKGROUND (Doesn't shake)
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // 2. START THE WORLD SHAKE (Only affects the scenery)
  ctx.save();
  if (shakeAmount > 0) {
    ctx.translate(
      (Math.random() - 0.5) * shakeAmount,
      (Math.random() - 0.5) * shakeAmount
    );
  }

  // 3. SKY & BACKGROUND
  ctx.fillStyle = "#70a1ff";
  ctx.fillRect(0, 0, canvas.width, horizon);
  drawBackground();

  // 4. THE GROUND (Alternating moving segments)
  // We use trackPosition to alternate colors for a sense of movement
  let isDarkSegment = Math.floor(trackPosition) % 2 === 0;
  ctx.fillStyle = isDarkSegment ? "#27ae60" : "#2ecc71";
  ctx.fillRect(0, horizon, canvas.width, horizon);

  // 5. THE ROAD SHOULDERS (Dirt/Sand edges)
  // These provide a transition between the grass and the asphalt
  ctx.fillStyle = "#d1ccc0";
  ctx.beginPath();
  ctx.moveTo(centerX - 40, horizon);
  ctx.lineTo(centerX + 40, horizon);
  ctx.lineTo(centerX + (1.8 - player.x) * canvas.width, canvas.height);
  ctx.lineTo(centerX + (-1.8 - player.x) * canvas.width, canvas.height);
  ctx.fill();

  // 6. THE ROAD (Asphalt)
  ctx.fillStyle = "#34495e";
  ctx.beginPath();
  ctx.moveTo(centerX - 15, horizon);
  ctx.lineTo(centerX + 15, horizon);
  ctx.lineTo(centerX + (1.3 - player.x) * canvas.width, canvas.height);
  ctx.lineTo(centerX + (-1.3 - player.x) * canvas.width, canvas.height);
  ctx.fill();

  // 7. RUMBLE STRIPS (Red/White stripes)
  // This is the "Gold Standard" of retro racers. It adds a massive sense of speed.
  ctx.strokeStyle = isDarkSegment ? "#eb4d4b" : "#ffffff";
  ctx.lineWidth = 15;
  ctx.setLineDash([0, 0]); // Reset for solid lines

  // Left Rumble
  ctx.beginPath();
  ctx.moveTo(centerX - 18, horizon);
  ctx.lineTo(centerX + (-1.3 - player.x) * canvas.width, canvas.height);
  ctx.stroke();

  // Right Rumble
  ctx.beginPath();
  ctx.moveTo(centerX + 18, horizon);
  ctx.lineTo(centerX + (1.3 - player.x) * canvas.width, canvas.height);
  ctx.stroke();

  // 8. CENTER LANE MARKERS
  ctx.strokeStyle = "#ecf0f1";
  ctx.lineWidth = 4;
  ctx.setLineDash([20, 40]);
  ctx.lineDashOffset = -roadOffset;
  ctx.beginPath();
  ctx.moveTo(centerX, horizon);
  ctx.lineTo(centerX - player.x * canvas.width, canvas.height);
  ctx.stroke();

  // 9. HORIZON HAZE
  // Blends the sky into the ground for a soft, professional look
  let haze = ctx.createLinearGradient(0, horizon - 30, 0, horizon + 30);
  haze.addColorStop(0, "rgba(112, 161, 255, 0)");
  haze.addColorStop(0.5, "rgba(112, 161, 255, 0.5)");
  haze.addColorStop(1, "rgba(112, 161, 255, 0)");
  ctx.fillStyle = haze;
  ctx.fillRect(0, horizon - 30, canvas.width, 60);

  // 10. OBJECTS
  drawEnvironment();

  if (gameState === "PLAYING") {
    drawParticles();
    drawOpponents();
    drawPlayer();
  }

  ctx.restore(); // STOP SHAKING HERE

  // 11. UI (Always stays fixed on top, never shakes)
  if (gameState === "PLAYING") {
    drawUI();
  } else if (gameState === "START") {
    drawMenu();
  } else if (gameState === "FINISHED") {
    drawFinishScreen();
  }
}

function mainLoop() {
  if (gameState === "START") {
    backgroundOffset += 1;
    draw();
    drawMenu();
  } else if (gameState === "PLAYING") {
    update();
    draw();
  } else if (gameState === "FINISHED") {
    draw();
    drawFinishScreen();
  }
  requestAnimationFrame(mainLoop);
}

mainLoop();
