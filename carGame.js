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
  // Calculate lap based on global distance. No resetting distance to 0.
  currentLap = Math.floor(playerDistance / lapDistance) + 1;

  if (currentLap > lapsToFinish) {
    finalTime = ((Date.now() - startTime) / 1000).toFixed(2);
    gameState = "FINISHED";
  }
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
  ctx.fillStyle = "#3c2bad";
  for (let i = -1; i < 4; i++) {
    let x = i * 400 + ((backgroundOffset * 0.3) % 400);
    ctx.beginPath();
    ctx.moveTo(x, horizon);
    ctx.lineTo(x + 200, horizon - 150);
    ctx.lineTo(x + 400, horizon);
    ctx.fill();
  }
  ctx.fillStyle = "#4834d4";
  for (let i = -1; i < 5; i++) {
    let x = i * 300 + ((backgroundOffset * 0.7) % 300);
    ctx.beginPath();
    ctx.moveTo(x, horizon);
    ctx.lineTo(x + 150, horizon - 100);
    ctx.lineTo(x + 300, horizon);
    ctx.fill();
  }
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
    if (opt.z > 10 && opt.z < 2000) {
      // Only draw if within reasonable distance
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
  ctx.fillStyle = "#70a1ff";
  ctx.fillRect(0, 0, canvas.width, canvas.height / 2);
  drawBackground();
  let groundColor = Math.floor(trackPosition) % 2 === 0 ? "#27ae60" : "#2ecc71";
  ctx.fillStyle = groundColor;
  ctx.fillRect(0, canvas.height / 2, canvas.width, canvas.height / 2);
  const centerX = canvas.width / 2;
  ctx.fillStyle = "#34495e";
  ctx.beginPath();
  ctx.moveTo(centerX - 10, canvas.height / 2);
  ctx.lineTo(centerX + 10, canvas.height / 2);
  ctx.lineTo(centerX + (1.5 - player.x) * canvas.width, canvas.height);
  ctx.lineTo(centerX + (-1.5 - player.x) * canvas.width, canvas.height);
  ctx.fill();
  ctx.strokeStyle = "#ecf0f1";
  ctx.lineWidth = 4;
  ctx.setLineDash([20, 40]);
  ctx.lineDashOffset = -roadOffset;
  ctx.beginPath();
  ctx.moveTo(centerX, canvas.height / 2);
  ctx.lineTo(centerX - player.x * canvas.width, canvas.height);
  ctx.stroke();
  drawEnvironment();
  if (gameState === "PLAYING") {
    drawOpponents();
    drawPlayer();
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
    draw();
    drawFinishScreen();
  }
  requestAnimationFrame(mainLoop);
}

mainLoop();
