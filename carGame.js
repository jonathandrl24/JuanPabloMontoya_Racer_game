const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

canvas.width = 640;
canvas.height = 360;

// --- New Game State ---
let backgroundOffset = 0; // This will track the mountain position
let roadOffset = 0;
const player = {
  x: 0, // 0 is center, -1 is left edge, 1 is right edge
  width: 80,
  height: 50,
  color: "#f39c12", // Orange like the reference image
};

const keys = { Left: false, Right: false };

// --- Input Listeners ---
window.addEventListener("keydown", (e) => {
  if (e.key === "ArrowLeft") keys.Left = true;
  if (e.key === "ArrowRight") keys.Right = true;
});
window.addEventListener("keyup", (e) => {
  if (e.key === "ArrowLeft") keys.Left = false;
  if (e.key === "ArrowRight") keys.Right = false;
});

function update() {
  roadOffset += 5;
  if (roadOffset > 100) roadOffset = 0;

  const speed = 0.05;
  if (keys.Left) {
    player.x -= speed;
    backgroundOffset += 2; // Move mountains right when steering left
  }
  if (keys.Right) {
    player.x += speed;
    backgroundOffset -= 2; // Move mountains left when steering right
  }

  if (player.x < -1.5) player.x = -1.5;
  if (player.x > 1.5) player.x = 1.5;
}

function drawBackground() {
  const horizon = canvas.height / 2;

  // 1. Draw Far Mountains (Darker Purple)
  ctx.fillStyle = "#4834d4";
  for (let i = -1; i < 3; i++) {
    let x = i * 400 + ((backgroundOffset * 0.5) % 400);
    ctx.beginPath();
    ctx.moveTo(x, horizon);
    ctx.lineTo(x + 200, horizon - 100);
    ctx.lineTo(x + 400, horizon);
    ctx.fill();
  }

  // 2. Draw Near Mountains (Lighter Purple/Blue)
  ctx.fillStyle = "#686de0";
  for (let i = -1; i < 3; i++) {
    let x = i * 300 + (backgroundOffset % 300);
    ctx.beginPath();
    ctx.moveTo(x, horizon);
    ctx.lineTo(x + 150, horizon - 60);
    ctx.lineTo(x + 300, horizon);
    ctx.fill();
  }

  // 3. Draw a Simple Retro Cloud
  ctx.fillStyle = "white";
  let cloudX = (200 + backgroundOffset * 0.2) % (canvas.width + 200);
  if (cloudX < -100) cloudX = canvas.width + 100;
  ctx.fillRect(cloudX, 50, 60, 20);
  ctx.fillRect(cloudX + 10, 40, 40, 20);
}

function drawPlayer() {
  // Calculate screen position
  // Center of screen + (offset * half-width)
  const screenX = canvas.width / 2 + player.x * (canvas.width / 3);
  const screenY = canvas.height - 70;

  // Draw a simple retro car shape
  ctx.fillStyle = player.color;
  // Main Body
  ctx.fillRect(
    screenX - player.width / 2,
    screenY,
    player.width,
    player.height
  );
  // Cabin
  ctx.fillStyle = "#222";
  ctx.fillRect(
    screenX - player.width / 3,
    screenY - 15,
    player.width / 1.5,
    20
  );
  // Tail lights
  ctx.fillStyle = "red";
  ctx.fillRect(screenX - player.width / 2, screenY + 10, 15, 10);
  ctx.fillRect(screenX + player.width / 2 - 15, screenY + 10, 15, 10);
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Sky
  ctx.fillStyle = "#70a1ff";
  ctx.fillRect(0, 0, canvas.width, canvas.height / 2);

  // Sky
  drawBackground();

  // Ground
  ctx.fillStyle = "#6ab87e";
  ctx.fillRect(0, canvas.height / 2, canvas.width, canvas.height / 2);

  // Road
  ctx.fillStyle = "#444";
  ctx.beginPath();
  ctx.moveTo(canvas.width * 0.45, canvas.height / 2);
  ctx.lineTo(canvas.width * 0.55, canvas.height / 2);
  ctx.lineTo(canvas.width * 0.9, canvas.height);
  ctx.lineTo(canvas.width * 0.1, canvas.height);
  ctx.fill();

  // Moving lane markers
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 4;
  ctx.setLineDash([20, 30]);
  ctx.lineDashOffset = -roadOffset;
  ctx.beginPath();
  ctx.moveTo(canvas.width / 2, canvas.height / 2);
  ctx.lineTo(canvas.width / 2, canvas.height);
  ctx.stroke();

  // --- Draw the Car ---
  drawPlayer();
}

function mainLoop() {
  update();
  draw();
  requestAnimationFrame(mainLoop);
}

mainLoop();
