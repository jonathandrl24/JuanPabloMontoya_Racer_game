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

let gameSpeed = 5; // How fast we move forward

let trees = [
  { z: 500, side: -2.5 },
  { z: 1000, side: 2.5 },
  { z: 1500, side: -3.0 },
  { z: 2000, side: 3.0 },
  { z: 2500, side: -2.2 },
];
const MAX_Z = 2500;

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

  // 2. Tree movement (moving toward player)
  trees.forEach((tree) => {
    tree.z -= gameSpeed;
    if (tree.z < 1) tree.z = MAX_Z; // Reset to horizon
  });

  // 3. Player steering
  const steerSpeed = 0.05;
  if (keys.Left) {
    player.x -= steerSpeed;
    backgroundOffset += 2;
  }
  if (keys.Right) {
    player.x += steerSpeed;
    backgroundOffset -= 2;
  }

  if (player.x < -2) player.x = -2;
  if (player.x > 2) player.x = 2;
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

function drawTrees() {
  const horizon = canvas.height / 2;
  const centerX = canvas.width / 2;

  // Sort by Z (furthest first)
  const sortedTrees = [...trees].sort((a, b) => b.z - a.z);

  sortedTrees.forEach((tree) => {
    // --- THE PERSPECTIVE MATH ---
    let scale = 160 / tree.z; // Constant factor for depth

    // Calculate X: Center + (Relative Side Position * screen width * scale)
    let x = centerX + (tree.side - player.x) * (scale * canvas.width * 0.8);

    // Calculate Y: Horizon + (Offset * scale)
    // This ensures the BASE of the tree stays on the ground plane
    let y = horizon + scale * 100;

    let size = scale * 250; // Size scales with distance

    // Only draw if it's on screen and in front of the camera
    if (tree.z > 10 && y > horizon) {
      drawPalmTree(x, y, size);
    }
  });
}

function drawPalmTree(x, y, size) {
  // 1. Draw Trunk (Segmented for a retro look)
  ctx.fillStyle = "#6d4c41";
  ctx.fillRect(x - size / 20, y - size, size / 10, size);

  // 2. Draw Palm Leaves (Multiple triangles/ovals for "palm" look)
  ctx.fillStyle = "#2ecc71";

  // Left leaves
  ctx.beginPath();
  ctx.ellipse(x - size / 4, y - size, size / 3, size / 6, -0.4, 0, Math.PI * 2);
  ctx.fill();

  // Right leaves
  ctx.beginPath();
  ctx.ellipse(x + size / 4, y - size, size / 3, size / 6, 0.4, 0, Math.PI * 2);
  ctx.fill();

  // Top leaf
  ctx.beginPath();
  ctx.ellipse(x, y - size - size / 8, size / 4, size / 6, 0, 0, Math.PI * 2);
  ctx.fill();
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
  ctx.fillStyle = "#27ae60"; // A darker green looks better for a roadside
  ctx.fillRect(0, canvas.height / 2, canvas.width, canvas.height / 2);

  // Road
  ctx.fillStyle = "#34495e"; // Darker asphalt
  ctx.beginPath();
  ctx.moveTo(canvas.width * 0.48, canvas.height / 2); // Narrow horizon
  ctx.lineTo(canvas.width * 0.52, canvas.height / 2);
  ctx.lineTo(canvas.width * 1.2, canvas.height); // Very wide bottom
  ctx.lineTo(canvas.width * -0.2, canvas.height); // Very wide bottom
  ctx.fill();

  // Moving lane markers
  ctx.strokeStyle = "#ecf0f1";
  ctx.lineWidth = 6;
  ctx.setLineDash([30, 50]);
  ctx.lineDashOffset = -roadOffset;
  ctx.beginPath();
  ctx.moveTo(canvas.width / 2, canvas.height / 2);
  ctx.lineTo(canvas.width / 2, canvas.height);
  ctx.stroke();

  // 6. Trees
  drawTrees();

  // --- Draw the Car ---
  drawPlayer();
}

function mainLoop() {
  update();
  draw();
  requestAnimationFrame(mainLoop);
}

mainLoop();
