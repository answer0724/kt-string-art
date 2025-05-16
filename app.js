const uploadInput = document.getElementById("upload");
const imagePreview = document.getElementById("image-preview");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const generateBtn = document.getElementById("generateBtn");
const exportBtn = document.getElementById("exportBtn");
const progressBar = document.getElementById("progressBar");
const numPinsInput = document.getElementById("numPins");
const maxLinesInput = document.getElementById("maxLines");
const targetSimInput = document.getElementById("targetSim");

let uploadedImage = null;
let imgData = null;
let pins = [];
let lines = [];

uploadInput.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function (event) {
    uploadedImage = new Image();
    uploadedImage.onload = function () {
      imagePreview.innerHTML = "";
      const previewImg = document.createElement("img");
      previewImg.src = uploadedImage.src;
      imagePreview.appendChild(previewImg);

      // ตั้งขนาด canvas ตามภาพ
      canvas.width = uploadedImage.width;
      canvas.height = uploadedImage.height;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(uploadedImage, 0, 0);

      imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    };
    uploadedImage.src = event.target.result;
  };
  reader.readAsDataURL(file);
});

function setupPins() {
  pins = [];
  const N = parseInt(numPinsInput.value);
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  const r = Math.min(cx, cy) - 10;

  for (let i = 0; i < N; i++) {
    const angle = (2 * Math.PI * i) / N - Math.PI / 2;
    pins.push({
      x: cx + r * Math.cos(angle),
      y: cy + r * Math.sin(angle),
    });
  }
}

function imageDataToGray(imgData) {
  const gray = new Uint8ClampedArray(imgData.width * imgData.height);
  for (let i = 0; i < gray.length; i++) {
    const idx = i * 4;
    const r = imgData.data[idx];
    const g = imgData.data[idx + 1];
    const b = imgData.data[idx + 2];
    gray[i] = 0.299 * r + 0.587 * g + 0.114 * b;
  }
  return { data: gray, width: imgData.width, height: imgData.height };
}

function calcSimilarity(baseGray, workingGray) {
  let diffSum = 0;
  const len = baseGray.data.length;
  for (let i = 0; i < len; i++) {
    const diff = baseGray.data[i] - workingGray.data[i];
    diffSum += diff * diff;
  }
  return 1 - diffSum / (len * 255 * 255);
}

function drawLineOnGray(gray, start, end, intensity = 10) {
  let x0 = Math.round(start.x);
  let y0 = Math.round(start.y);
  let x1 = Math.round(end.x);
  let y1 = Math.round(end.y);

  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;

  while (true) {
    const idx = y0 * gray.width + x0;
    if (idx >= 0 && idx < gray.data.length) {
      gray.data[idx] = Math.max(0, gray.data[idx] - intensity);
    }
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x0 += sx;
    }
    if (e2 < dx) {
      err += dx;
      y0 += sy;
    }
  }
}

function drawPins() {
  ctx.fillStyle = "black";
  pins.forEach((p) => {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3, 0, 2 * Math.PI);
    ctx.fill();
  });
}

generateBtn.addEventListener("click", () => {
  if (!imgData) {
    alert("Please upload an image first!");
    return;
  }

  lines = [];
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(uploadedImage, 0, 0);

  setupPins();
  drawPins();

  const baseGray = imageDataToGray(imgData);
  let workingGray = new Uint8ClampedArray(baseGray.data);

  const maxLines = Math.min(parseInt(maxLinesInput.value), 3000);
  const targetSimilarity = parseInt(targetSimInput.value) / 100;

  progressBar.value = 0;

  let currentSimilarity = calcSimilarity(baseGray, { data: workingGray, width: baseGray.width, height: baseGray.height });
  let linesDrawn = 0;

  function generateStep() {
    if (linesDrawn >= maxLines || currentSimilarity >= targetSimilarity) {
      progressBar.value = 100;
      alert(`Generation finished. Similarity: ${(currentSimilarity * 100).toFixed(2)}%`);
      return;
    }

    let bestLine = null;
    let bestSimilarity = currentSimilarity;

    const trials = 100;
    for (let t = 0; t < trials; t++) {
      const a = Math.floor(Math.random() * pins.length);
      const b = Math.floor(Math.random() * pins.length);
      if (a === b) continue;

      const testGray = new Uint8ClampedArray(workingGray);
      const testImg = { data: testGray, width: baseGray.width, height: baseGray.height };

      drawLineOnGray(testImg, pins[a], pins[b]);

      const sim = calcSimilarity(baseGray, testImg);

      if (sim > bestSimilarity) {
        bestSimilarity = sim;
        bestLine = { start: pins[a], end: pins[b], a, b };
      }
    }

    if (bestLine) {
      lines.push(bestLine);
      // วาดเส้นแบบโปร่งหน่อย
      ctx.strokeStyle = "rgba(0,0,0,0.05)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(bestLine.start.x, bestLine.start.y);
      ctx.lineTo(bestLine.end.x, bestLine.end.y);
      ctx.stroke();

      drawLineOnGray({ data: workingGray, width: baseGray.width, height: baseGray.height }, bestLine.start, bestLine.end);

      currentSimilarity = bestSimilarity;
      linesDrawn++;
      progressBar.value = (linesDrawn / maxLines) * 100;

      requestAnimationFrame(generateStep);
    } else {
      // ถ้าไม่มีเส้นใหม่ที่ดีขึ้นให้จบเลย
      progressBar.value = 100;
      alert(`Generation stopped. Similarity: ${(currentSimilarity * 100).toFixed(2)}%`);
    }
  }

  generateStep();
});

exportBtn.addEventListener("click", () => {
  const dataURL = canvas.toDataURL("image/png");
  const link = document.createElement("a");
  link.download = "string-art.png";
  link.href = dataURL;
  link.click();
});
