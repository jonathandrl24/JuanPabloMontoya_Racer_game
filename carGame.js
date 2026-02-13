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
let gameState = "START"; // Options: "START", "PLAYING"

let backgroundOffset = 0;
let roadOffset = 0;
let speed = 0;
let trackPosition = 0;
let maxSpeed = 100;
let accel = 0.5;
let breaking = 0.8;
let decel = 0.1;
let currentCurve = 0;
let isCrashing = false;
let shakeAmount = 0;
let collisionCooldown = 0;
let currentLap = 1;
const lapsToFinish = 4;
const lapDistance = 2000; // How long one lap is
let totalDistance = 0;
let startTime = 0;
let finalTime = 0;

const player = {
  x: 0,
  width: 240, // Adjusted for better screen fit
  height: 160,
};

// Each rival starts at a different distance ahead of the start line
let opponents = [
  { name: "Rival 1", x: -0.5, distance: 300, speed: 68, img: "car1" },
  { name: "Rival 2", x: 0.5, distance: 600, speed: 72, img: "car2" },
  { name: "Rival 3", x: -0.2, distance: 1000, speed: 65, img: "car3" },
];

let playerPosition = 4; // We start in last place (4th)

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

window.addEventListener("keydown", (e) => {
  if (gameState === "START" && e.key === "Enter") {
    gameState = "PLAYING";
    startTime = Date.now();
  }

  if (gameState === "FINISHED" && e.key === "Enter") {
    // Reset the whole game
    currentLap = 1;
    totalDistance = 0;
    speed = 0;
    player.x = 0;
    startTime = Date.now();
    gameState = "PLAYING";
  }

  if (e.key === "ArrowLeft") keys.Left = true;
  if (e.key === "ArrowRight") keys.Right = true;
  if (e.key === "ArrowUp") keys.Up = true;
  if (e.key === "ArrowDown") keys.Down = true;
});

function update() {
  if (shakeAmount > 0) shakeAmount -= 1;

  // Track the time when the game starts
  if (startTime === 0) startTime = Date.now();

  if (keys.Up && !isCrashing) speed += accel;
  else if (keys.Down) speed -= breaking;
  else speed -= decel;

  if (isCrashing) {
    speed -= 2.5;
    if (speed <= 10) isCrashing = false;
  }

  if (speed < 0) speed = 0;
  if (speed > maxSpeed) speed = maxSpeed;

  trackPosition += speed * 0.01;
  roadOffset += speed * 0.1;

  // FIX 1: Use envObjects instead of trees
  envObjects.forEach((obj) => {
    obj.z -= speed * 0.2;
    if (obj.z < 1) obj.z = MAX_Z;
  });

  // Move Opponents (AI Rivals)
  if (collisionCooldown > 0) collisionCooldown--;

  opponents.forEach((opt) => {
    // 1. Rivals move forward at their own constant speed
    opt.distance += opt.speed * 0.01;

    // 2. Calculate their relative Z position to the player for drawing
    // (If they are 500 units ahead of you, their Z is 500)
    let relativeZ = (opt.distance - totalDistance) * 10;
    opt.z = relativeZ;

    // 3. Collision Detection (Only if they are within view)
    if (collisionCooldown === 0 && opt.z > 60 && opt.z < 110) {
      if (Math.abs(opt.x - player.x) < 0.45) {
        handleCollision();
        collisionCooldown = 80;
      }
    }
  });

  currentCurve = Math.sin(trackPosition * 0.4) * 1.2;
  const steerSpeed = 0.0015 * speed;
  if (keys.Left) player.x -= steerSpeed;
  if (keys.Right) player.x += steerSpeed;

  player.x -= currentCurve * (speed / maxSpeed) * 0.025;
  backgroundOffset += currentCurve * (speed * 0.05);

  if (player.x < -2.5) player.x = -2.5;
  if (player.x > 2.5) player.x = 2.5;

  totalDistance += speed * 0.01;

  // Check for Lap Completion
  if (totalDistance >= lapDistance) {
    if (currentLap < lapsToFinish) {
      currentLap++;
      totalDistance = 0; // Reset for next lap
    } else {
      // RACE FINISHED
      finalTime = ((Date.now() - startTime) / 1000).toFixed(2);
      gameState = "FINISHED";
    }
  }

  // --- CALCULATE RACING POSITION ---
  let rank = 1;
  opponents.forEach((opt) => {
    // If the opponent has traveled more distance than you, they are ahead
    if (opt.distance > totalDistance) {
      rank++;
    }
  });
  playerPosition = rank;
}

function handleCollision() {
  if (!isCrashing) {
    isCrashing = true;
    speed *= 0.5;
    shakeAmount = 15;
  }
}

// --- Drawing ---

function drawMenu() {
  // Semi-transparent dark overlay
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

  // Make the "Press Enter" text blink
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
  ctx.fillText("LAP " + currentLap + "/" + lapsToFinish, 20, 40);
  ctx.textAlign = "center";
  // --- DYNAMIC POSITIONING ---
  let posText =
    playerPosition +
    (playerPosition === 1
      ? "st"
      : playerPosition === 2
      ? "nd"
      : playerPosition === 3
      ? "rd"
      : "th");
  ctx.textAlign = "center";
  ctx.fillText(posText, canvas.width / 2, 40);

  ctx.textAlign = "right";
  ctx.fillText(Math.floor(speed * 2.2), canvas.width - 20, 40);
  ctx.textAlign = "left";
}

function drawBackground() {
  const horizon = canvas.height / 2;

  // Layer 1: Distant Dark Peaks
  ctx.fillStyle = "#3c2bad";
  for (let i = -1; i < 4; i++) {
    let x = i * 400 + ((backgroundOffset * 0.3) % 400);
    ctx.beginPath();
    ctx.moveTo(x, horizon);
    ctx.lineTo(x + 200, horizon - 150);
    ctx.lineTo(x + 400, horizon);
    ctx.fill();
  }

  // Layer 2: Closer, Lighter Peaks (Parallax effect)
  ctx.fillStyle = "#4834d4";
  for (let i = -1; i < 5; i++) {
    let x = i * 300 + ((backgroundOffset * 0.7) % 300);
    ctx.beginPath();
    ctx.moveTo(x, horizon);
    ctx.lineTo(x + 150, horizon - 100);
    ctx.lineTo(x + 300, horizon);
    ctx.fill();

    // Add "Snow" caps for extra detail
    ctx.fillStyle = "#686de0";
    ctx.beginPath();
    ctx.moveTo(x + 110, horizon - 73);
    ctx.lineTo(x + 150, horizon - 100);
    ctx.lineTo(x + 190, horizon - 73);
    ctx.fill();
    ctx.fillStyle = "#4834d4"; // reset color for loop
  }

  // Cloud
  ctx.fillStyle = "white";
  let cloudX = (50 + backgroundOffset * 0.2) % (canvas.width + 200);
  ctx.fillRect(cloudX, 50, 60, 20);
  ctx.fillRect(cloudX + 10, 40, 40, 20);

  // Sun
  ctx.fillStyle = "yellow";
  let sunX = (370 + backgroundOffset * 0.2) % (canvas.width + 200);
  ctx.fillRect(sunX, 50, 60, 30);
  ctx.fillRect(sunX + 10, 40, 40, 50);
}

function drawEnvironment() {
  const horizon = canvas.height / 2;
  const centerX = canvas.width / 2;
  const sortedEnv = [...envObjects].sort((a, b) => b.z - a.z);

  sortedEnv.forEach((obj) => {
    let scale = 160 / obj.z;
    let x = centerX + (obj.side - player.x) * (scale * canvas.width * 0.8);
    let y = horizon + scale * 100;
    let size = scale * 250;

    if (obj.z > 10 && y > horizon) {
      if (obj.type === "tree") drawPalmTree(x, y, size);
      else if (obj.type === "rock") drawRock(x, y, size);
    }
  });
}

function drawPalmTree(x, y, size) {
  ctx.fillStyle = "#6d4c41";
  ctx.fillRect(x - size / 20, y - size, size / 10, size);
  ctx.fillStyle = "#2ecc71";
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    let angle = (i * Math.PI) / 2.5;
    ctx.ellipse(x, y - size, size / 2, size / 6, angle, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawRock(x, y, size) {
  ctx.fillStyle = "#95a5a6";
  ctx.beginPath();
  ctx.moveTo(x - size / 3, y);
  ctx.lineTo(x, y - size / 4);
  ctx.lineTo(x + size / 3, y);
  ctx.fill();
}

function drawPlayer() {
  const screenX = canvas.width / 2;
  const screenY = canvas.height - 140;

  if (images.player.complete) {
    ctx.drawImage(
      images.player,
      screenX - player.width / 2,
      screenY,
      player.width,
      player.height
    );
  }
}

function drawOpponents() {
  const horizon = canvas.height / 2;
  const centerX = canvas.width / 2;
  const sortedAI = [...opponents].sort((a, b) => b.z - a.z);

  sortedAI.forEach((opt) => {
    let scale = 160 / opt.z;
    let x = centerX + (opt.x - player.x) * (scale * canvas.width * 0.8);
    let y = horizon + scale * 100;
    let w = scale * 220;
    let h = scale * 130;

    if (opt.z > 10 && y > horizon) {
      if (images[opt.img].complete) {
        ctx.drawImage(images[opt.img], x - w / 2, y - h, w, h);
      }
    }
  });
}

function drawFinishScreen() {
  ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "yellow";
  ctx.textAlign = "center";
  ctx.font = "bold 40px 'Courier New'";

  let result =
    playerPosition === 1 ? "YOU WIN!" : "FINISHED " + playerPosition + "th";
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
    "PRESS ENTER TO RESTART",
    canvas.width / 2,
    canvas.height / 2 + 60
  );
}

function draw() {
  ctx.save();
  if (shakeAmount > 0) {
    ctx.translate(
      (Math.random() - 0.5) * shakeAmount,
      (Math.random() - 0.5) * shakeAmount
    );
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // 1. Sky & Background
  ctx.fillStyle = "#70a1ff";
  ctx.fillRect(0, 0, canvas.width, canvas.height / 2);
  drawBackground();

  // 2. Ground
  let groundColor = Math.floor(trackPosition) % 2 === 0 ? "#27ae60" : "#2ecc71";
  ctx.fillStyle = groundColor;
  ctx.fillRect(0, canvas.height / 2, canvas.width, canvas.height / 2);

  // 3. Road
  const centerX = canvas.width / 2;
  const roadCurveX = centerX + currentCurve * 60;

  ctx.fillStyle = "#34495e";
  ctx.beginPath();
  ctx.moveTo(roadCurveX - 10, canvas.height / 2);
  ctx.lineTo(roadCurveX + 10, canvas.height / 2);
  ctx.lineTo(centerX + (1.5 - player.x) * canvas.width, canvas.height);
  ctx.lineTo(centerX + (-1.5 - player.x) * canvas.width, canvas.height);
  ctx.fill();

  // 4. Lane Markers
  ctx.strokeStyle = "#ecf0f1";
  ctx.lineWidth = 4;
  ctx.setLineDash([20, 40]);
  ctx.lineDashOffset = -roadOffset;
  ctx.beginPath();
  ctx.moveTo(roadCurveX, canvas.height / 2);
  ctx.lineTo(centerX - player.x * canvas.width, canvas.height);
  ctx.stroke();

  // FIX 2: Call drawEnvironment() instead of drawTrees()
  drawEnvironment();
  if (gameState === "PLAYING") {
    drawOpponents();
  }
  if (gameState === "PLAYING") {
    drawPlayer();
  }
  if (gameState === "PLAYING") {
    drawUI();
  }

  ctx.restore();
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
    draw(); // Draw the final frame of the race
    drawFinishScreen();
  }
  requestAnimationFrame(mainLoop);
}

mainLoop();
