const imageInput = document.getElementById('imageInput');
const imageCanvas = document.getElementById('imageCanvas');
const stringArtCanvas = document.getElementById('stringArtCanvas');
const generateBtn = document.getElementById('generateBtn');
const exportBtn = document.getElementById('exportBtn');
const numPinsInput = document.getElementById('numPins');
const maxLinesInput = document.getElementById('maxLines');
const targetSimInput = document.getElementById('targetSim');

const imageCtx = imageCanvas.getContext('2d');
const artCtx = stringArtCanvas.getContext('2d');

let grayscaleImageData = null;
let pins = [];
let lines = [];

imageInput.addEventListener('change', handleImageUpload);
generateBtn.addEventListener('click', () => generateStringArt().catch(console.error));
exportBtn.addEventListener('click', exportStringArt);

function handleImageUpload(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(event) {
    const img = new Image();
    img.onload = function() {
      const size = 500;
      imageCanvas.width = size;
      imageCanvas.height = size;
      stringArtCanvas.width = size;
      stringArtCanvas.height = size;

      imageCtx.clearRect(0, 0, size, size);
      imageCtx.drawImage(img, 0, 0, size, size);

      const imgData = imageCtx.getImageData(0, 0, size, size);
      grayscaleImageData = toGrayscale(imgData);
      imageCtx.putImageData(grayscaleImageData, 0, 0);

      artCtx.clearRect(0, 0, size, size);
      lines = [];
    };
    img.src = event.target.result;
  };
  reader.readAsDataURL(file);
}

function toGrayscale(imageData) {
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    data[i] = data[i + 1] = data[i + 2] = gray;
  }
  return imageData;
}

function createPins(numPins, radius, centerX, centerY) {
  const pins = [];
  for (let i = 0; i < numPins; i++) {
    const angle = (2 * Math.PI * i) / numPins;
    pins.push({
      x: centerX + radius * Math.cos(angle),
      y: centerY + radius * Math.sin(angle)
    });
  }
  return pins;
}

function drawPins(ctx, pins) {
  ctx.fillStyle = 'black';
  pins.forEach(pin => {
    ctx.beginPath();
    ctx.arc(pin.x, pin.y, 2, 0, Math.PI * 2);
    ctx.fill();
  });
}

function drawPinsOnBothCanvases(pins) {
  imageCtx.putImageData(grayscaleImageData, 0, 0);
  drawPins(imageCtx, pins);

  artCtx.clearRect(0, 0, stringArtCanvas.width, stringArtCanvas.height);
  drawPins(artCtx, pins);
}

function lineBrightnessSum(x0, y0, x1, y1, imageData) {
  const data = imageData.data;
  const width = imageData.width;

  let dx = Math.abs(x1 - x0);
  let dy = Math.abs(y1 - y0);
  let sx = x0 < x1 ? 1 : -1;
  let sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;

  let sum = 0;
  while (true) {
    if (x0 >= 0 && x0 < width && y0 >= 0 && y0 < imageData.height) {
      const idx = (Math.floor(y0) * width + Math.floor(x0)) * 4;
      sum += data[idx]; 
    }
    if (x0 === x1 && y0 === y1) break;
    let e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x0 += sx;
    }
    if (e2 < dx) {
      err += dx;
      y0 += sy;
    }
  }
  return sum;
}

async function generateStringArt() {
  if (!grayscaleImageData) {
    alert("Please upload an image first.");
    return;
  }

  const numPins = parseInt(numPinsInput.value, 10);
  const maxLines = parseInt(maxLinesInput.value, 10);
  const targetSim = parseFloat(targetSimInput.value);

  const radius = stringArtCanvas.width / 2 - 10;
  const centerX = stringArtCanvas.width / 2;
  const centerY = stringArtCanvas.height / 2;
  pins = createPins(numPins, radius, centerX, centerY);

  drawPinsOnBothCanvases(pins);

  lines = [];

  // สร้างชุดคู่ pin ที่ยังไม่เคยใช้ เพื่อคัดเลือกทีละเส้น
  let usedPairs = new Set();

  let currentSim = 0;

  for (let i = 0; i < maxLines; i++) {
    let bestLine = null;
    let bestScore = -Infinity;

    for (let a = 0; a < pins.length; a++) {
      for (let b = a + 1; b < pins.length; b++) {
        const pairKey = `${a}-${b}`;
        if (usedPairs.has(pairKey)) continue;

        const sum = lineBrightnessSum(
          pins[a].x, pins[a].y,
          pins[b].x, pins[b].y,
          grayscaleImageData
        );

        if (sum > bestScore) {
          bestScore = sum;
          bestLine = { a, b };
        }
      }
    }

    if (!bestLine) break;

    lines.push(bestLine);
    usedPairs.add(`${bestLine.a}-${bestLine.b}`);

    // วาดเส้นทีละเส้นพร้อม animation
    artCtx.strokeStyle = 'black';
    artCtx.lineWidth = 1;
    artCtx.beginPath();
    artCtx.moveTo(pins[bestLine.a].x, pins[bestLine.a].y);
    artCtx.lineTo(pins[bestLine.b].x, pins[bestLine.b].y);
    artCtx.stroke();

    // วาดหมุดใหม่ทุกครั้ง (ให้ตรงกับเส้นล่าสุด)
    drawPins(artCtx, pins);

    currentSim = calculateSimilarity();

    if (currentSim >= targetSim) break;

    // รอเพื่อแสดง animation (เช่น 10 ms)
    await new Promise(resolve => setTimeout(resolve, 10));
  }

  alert(`Generation finished. Similarity: ${currentSim.toFixed(2)}%`);
}

function calculateSimilarity() {
  const artData = artCtx.getImageData(0, 0, stringArtCanvas.width, stringArtCanvas.height).data;
  const originalData = grayscaleImageData.data;

  let totalDiff = 0;
  for (let i = 0; i < originalData.length; i += 4) {
    totalDiff += Math.abs(originalData[i] - artData[i]);
  }

  const maxDiff = 255 * (originalData.length / 4);
  return (1 - totalDiff / maxDiff) * 100;
}

function exportStringArt() {
  const link = document.createElement('a');
  link.download = 'string-art.png';
  link.href = stringArtCanvas.toDataURL();
  link.click();
}
