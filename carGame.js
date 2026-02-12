const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

canvas.width = 640;
canvas.height = 360;

// --- Game State ---
let backgroundOffset = 0;
let roadOffset = 0;
let speed = 0;
let trackPosition = 0;
let maxSpeed = 100;
let accel = 0.5;
let breaking = 0.8;
let decel = 0.1;
let currentCurve = 0;

const player = {
  x: 0, // -1 to 1 is the road range
  width: 80,
  height: 50,
  color: "#f39c12",
};

let trees = [
  { z: 500, side: -2.5 },
  { z: 1000, side: 2.5 },
  { z: 1500, side: -3.0 },
  { z: 2000, side: 3.0 },
  { z: 2500, side: -2.2 },
];
const MAX_Z = 2500;

const keys = { Left: false, Right: false, Up: false, Down: false };

// --- Input Listeners ---
window.addEventListener("keydown", (e) => {
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
  // 1. Physics
  if (keys.Up) speed += accel;
  else if (keys.Down) speed -= breaking;
  else speed -= decel;

  if (speed < 0) speed = 0;
  if (speed > maxSpeed) speed = maxSpeed;

  // 2. Movement
  trackPosition += speed * 0.01;
  roadOffset += speed * 0.1;
  trees.forEach((tree) => {
    tree.z -= speed * 0.2;
    if (tree.z < 1) tree.z = MAX_Z;
  });

  // 3. Curves & Steering
  currentCurve = Math.sin(trackPosition * 0.005) * 1;

  // 4. Steering
  const steerSpeed = 0.002 * speed;
  if (keys.Left) player.x -= steerSpeed;
  if (keys.Right) player.x += steerSpeed;

  // Force pulling player on curves (Only happens if moving)
  player.x -= currentCurve * (speed / maxSpeed) * 0.03;

  // Background only shifts if we are moving through a curve
  backgroundOffset += currentCurve * (speed * 0.05);

  if (player.x < -3) player.x = -3;
  if (player.x > 3) player.x = 3;
}

// --- Drawing ---

function drawUI() {
  ctx.fillStyle = "white";
  ctx.font = "bold 24px 'Courier New'";
  ctx.textAlign = "left";
  ctx.fillText("LAP 2/4", 20, 40);

  ctx.textAlign = "center";
  ctx.fillText("2nd", canvas.width / 2, 40);

  ctx.textAlign = "right";
  ctx.fillText(Math.floor(speed * 2.2), canvas.width - 20, 40);
}

function drawBackground() {
  const horizon = canvas.height / 2;
  ctx.fillStyle = "#4834d4";
  for (let i = -1; i < 4; i++) {
    let x = i * 400 + ((backgroundOffset * 0.5) % 400);
    ctx.beginPath();
    ctx.moveTo(x, horizon);
    ctx.lineTo(x + 200, horizon - 100);
    ctx.lineTo(x + 400, horizon);
    ctx.fill();
  }
  ctx.fillStyle = "white";
  let cloudX = (200 + backgroundOffset * 0.2) % (canvas.width + 200);
  if (cloudX < -100) cloudX = canvas.width + 100;
  ctx.fillRect(cloudX, 50, 60, 20);
  ctx.fillRect(cloudX + 10, 40, 40, 20);
}

function drawTrees() {
  const horizon = canvas.height / 2;
  const centerX = canvas.width / 2;
  const sortedTrees = [...trees].sort((a, b) => b.z - a.z);

  sortedTrees.forEach((tree) => {
    let scale = 160 / tree.z;
    let x = centerX + (tree.side - player.x) * (scale * canvas.width * 0.8);
    let y = horizon + scale * 100;
    let size = scale * 250;
    if (tree.z > 10 && y > horizon) {
      drawPalmTree(x, y, size);
    }
  });
}

function drawPalmTree(x, y, size) {
  ctx.fillStyle = "#6d4c41";
  ctx.fillRect(x - size / 20, y - size, size / 10, size);
  ctx.fillStyle = "#2ecc71";
  ctx.beginPath();
  ctx.ellipse(x - size / 4, y - size, size / 3, size / 6, -0.4, 0, Math.PI * 2);
  ctx.ellipse(x + size / 4, y - size, size / 3, size / 6, 0.4, 0, Math.PI * 2);
  ctx.fill();
}

function drawPlayer() {
  const screenX = canvas.width / 2;
  const screenY = canvas.height - 70;
  ctx.fillStyle = player.color;
  ctx.fillRect(
    screenX - player.width / 2,
    screenY,
    player.width,
    player.height
  );
  ctx.fillStyle = "#222";
  ctx.fillRect(
    screenX - player.width / 3,
    screenY - 15,
    player.width / 1.5,
    20
  );
  ctx.fillStyle = "red";
  ctx.fillRect(screenX - player.width / 2, screenY + 10, 15, 10);
  ctx.fillRect(screenX + player.width / 2 - 15, screenY + 10, 15, 10);
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // 1. Sky & Background
  ctx.fillStyle = "#70a1ff";
  ctx.fillRect(0, 0, canvas.width, canvas.height / 2);
  drawBackground();

  // Ground (Alternating stripes for a sense of speed)
  let groundColor = Math.floor(trackPosition) % 2 === 0 ? "#27ae60" : "#2ecc71";
  ctx.fillStyle = groundColor;
  ctx.fillRect(0, canvas.height / 2, canvas.width, canvas.height / 2);

  // 3. Road (Shifted by player.x for a real steering effect)
  const centerX = canvas.width / 2;
  const roadCurveX = centerX + currentCurve * 40;

  ctx.fillStyle = "#34495e";
  ctx.beginPath();
  ctx.moveTo(roadCurveX - 20, canvas.height / 2);
  ctx.lineTo(roadCurveX + 20, canvas.height / 2);
  // The bottom of the road shifts based on player steering
  ctx.lineTo(centerX + (1.5 - player.x) * canvas.width, canvas.height);
  ctx.lineTo(centerX + (-1.5 - player.x) * canvas.width, canvas.height);
  ctx.fill();

  // 4. Lane Markers
  ctx.strokeStyle = "#ecf0f1";
  ctx.lineWidth = 6;
  ctx.setLineDash([30, 50]);
  ctx.lineDashOffset = -roadOffset;
  ctx.beginPath();
  ctx.moveTo(roadCurveX, canvas.height / 2);
  ctx.lineTo(centerX - player.x * canvas.width, canvas.height);
  ctx.stroke();

  drawTrees();
  drawPlayer();
  drawUI(); // <--- This adds the Speedometer back!
}

function mainLoop() {
  update();
  draw();
  requestAnimationFrame(mainLoop);
}

mainLoop();
