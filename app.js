const imageInput = document.getElementById("imageInput");
const imageCanvas = document.getElementById("imageCanvas");
const stringArtCanvas = document.getElementById("stringArtCanvas");
const ctxImage = imageCanvas.getContext("2d");
const ctxArt = stringArtCanvas.getContext("2d");

const imageWidth = imageCanvas.width;
const imageHeight = imageCanvas.height;

let imageData, grayData, edgeData;
let pins = [];
let lines = [];

let animationRunning = false;

function toGrayscale(data, width, height) {
  const gray = new Uint8ClampedArray(width * height);
  for (let i = 0; i < width * height; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    gray[i] = 0.299 * r + 0.587 * g + 0.114 * b;
  }
  return gray;
}

function sobelEdgeDetection(gray, width, height) {
  const kernelX = [
    [-1, 0, 1],
    [-2, 0, 2],
    [-1, 0, 1],
  ];
  const kernelY = [
    [-1, -2, -1],
    [0, 0, 0],
    [1, 2, 1],
  ];
  const edge = new Float32Array(width * height);

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let gx = 0;
      let gy = 0;
      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const pixel = gray[(y + ky) * width + (x + kx)];
          gx += kernelX[ky + 1][kx + 1] * pixel;
          gy += kernelY[ky + 1][kx + 1] * pixel;
        }
      }
      edge[y * width + x] = Math.sqrt(gx * gx + gy * gy);
    }
  }

  const maxEdge = Math.max(...edge);
  for (let i = 0; i < edge.length; i++) {
    edge[i] = (edge[i] / maxEdge) * 255;
  }
  return edge;
}

function setupPins(numPins) {
  pins = [];
  const centerX = imageWidth / 2;
  const centerY = imageHeight / 2;
  const radius = Math.min(centerX, centerY) - 2;
  for (let i = 0; i < numPins; i++) {
    const angle = (2 * Math.PI * i) / numPins;
    pins.push({
      x: centerX + radius * Math.cos(angle),
      y: centerY + radius * Math.sin(angle),
    });
  }
}

function lineScore(pinA, pinB) {
  const dx = pinB.x - pinA.x;
  const dy = pinB.y - pinA.y;
  const dist = Math.hypot(dx, dy);
  const steps = Math.floor(dist);
  let totalScore = 0;

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = Math.floor(pinA.x + dx * t);
    const y = Math.floor(pinA.y + dy * t);
    const idx = y * imageWidth + x;

    const edgeWeight = edgeData[idx] / 255;
    const grayVal = grayData[idx] / 255;

    // More weight for dark and edge pixels
    const score = (1 - grayVal) * (1 + edgeWeight * 2);

    totalScore += score;
  }
  return totalScore / steps;
}

function generateStringArt(numPins, maxLines, targetSimilarity) {
  lines = [];
  setupPins(numPins);

  animationRunning = true;
  ctxArt.clearRect(0, 0, imageWidth, imageHeight);
  ctxArt.strokeStyle = "black";
  ctxArt.lineWidth = 0.5;

  let iterations = 0;
  let similarity = 0;

  function step() {
    if (iterations >= maxLines || similarity >= targetSimilarity) {
      animationRunning = false;
      alert(`Generation finished. Similarity: ${similarity.toFixed(2)}%`);
      return;
    }

    let bestScore = -Infinity;
    let bestLine = null;

    for (let i = 0; i < numPins; i++) {
      for (let j = i + 1; j < numPins; j++) {
        if (lines.find(line => (line[0] === i && line[1] === j) || (line[0] === j && line[1] === i))) continue;

        const score = lineScore(pins[i], pins[j]);
        if (score > bestScore) {
          bestScore = score;
          bestLine = [i, j];
        }
      }
    }

    if (!bestLine) {
      animationRunning = false;
      alert("No more lines to draw.");
      return;
    }

    lines.push(bestLine);

    // Draw line
    const p1 = pins[bestLine[0]];
    const p2 = pins[bestLine[1]];
    ctxArt.beginPath();
    ctxArt.moveTo(p1.x, p1.y);
    ctxArt.lineTo(p2.x, p2.y);
    ctxArt.stroke();

    iterations++;
    similarity = (iterations / maxLines) * 100;

    requestAnimationFrame(step);
  }

  step();
}

imageInput.addEventListener("change", (e) => {
  const file = e.target.files[0];
  const img = new Image();
  img.onload = () => {
    ctxImage.clearRect(0, 0, imageWidth, imageHeight);
    ctxImage.drawImage(img, 0, 0, imageWidth, imageHeight);

    const rawData = ctxImage.getImageData(0, 0, imageWidth, imageHeight);
    imageData = rawData.data;
    grayData = toGrayscale(imageData, imageWidth, imageHeight);
    edgeData = sobelEdgeDetection(grayData, imageWidth, imageHeight);

    ctxArt.clearRect(0, 0, imageWidth, imageHeight);
    lines = [];
  };
  img.src = URL.createObjectURL(file);
});

document.getElementById("generateBtn").addEventListener("click", () => {
  if (animationRunning) {
    alert("Animation is already running!");
    return;
  }
  const numPins = parseInt(document.getElementById("numPins").value);
  const maxLines = parseInt(document.getElementById("maxLines").value);
  const targetSim = parseFloat(document.getElementById("targetSim").value);

  if (!grayData || !edgeData) {
    alert("Please upload an image first.");
    return;
  }

  generateStringArt(numPins, maxLines, targetSim);
});

document.getElementById("exportBtn").addEventListener("click", () => {
  const link = document.createElement("a");
  link.download = "string_art.png";
  link.href = stringArtCanvas.toDataURL("image/png");
  link.click();
});
