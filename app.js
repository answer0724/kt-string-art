const imageUpload = document.getElementById("imageUpload");
const generateBtn = document.getElementById("generateBtn");
const exportBtn = document.getElementById("exportBtn");

const outputCanvas = document.getElementById("outputCanvas");
const uploadedImageCanvas = document.getElementById("uploadedImageCanvas");
const hiddenCanvas = document.getElementById("hiddenCanvas");

const ctx = outputCanvas.getContext("2d");
const uploadedCtx = uploadedImageCanvas.getContext("2d");
const hiddenCtx = hiddenCanvas.getContext("2d");

let originalImage = null;

imageUpload.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function (event) {
    const img = new Image();
    img.onload = function () {
      uploadedCtx.clearRect(0, 0, uploadedImageCanvas.width, uploadedImageCanvas.height);
      uploadedCtx.drawImage(img, 0, 0, uploadedImageCanvas.width, uploadedImageCanvas.height);
      hiddenCtx.drawImage(img, 0, 0, hiddenCanvas.width, hiddenCanvas.height);
      originalImage = hiddenCtx.getImageData(0, 0, hiddenCanvas.width, hiddenCanvas.height);
    };
    img.src = event.target.result;
  };
  reader.readAsDataURL(file);
});

function drawPins(ctx, pinCount) {
  ctx.fillStyle = "#000";
  const cx = ctx.canvas.width / 2;
  const cy = ctx.canvas.height / 2;
  const radius = cx - 10;
  for (let i = 0; i < pinCount; i++) {
    const angle = (2 * Math.PI * i) / pinCount;
    const x = cx + radius * Math.cos(angle);
    const y = cy + radius * Math.sin(angle);
    ctx.beginPath();
    ctx.arc(x, y, 2, 0, 2 * Math.PI);
    ctx.fill();
  }
}

function getPins(pinCount) {
  const pins = [];
  const cx = outputCanvas.width / 2;
  const cy = outputCanvas.height / 2;
  const radius = cx - 10;
  for (let i = 0; i < pinCount; i++) {
    const angle = (2 * Math.PI * i) / pinCount;
    const x = cx + radius * Math.cos(angle);
    const y = cy + radius * Math.sin(angle);
    pins.push([x, y]);
  }
  return pins;
}

function getImageGrayscale(imageData) {
  const gray = new Float32Array(imageData.width * imageData.height);
  for (let i = 0; i < gray.length; i++) {
    const r = imageData.data[i * 4];
    const g = imageData.data[i * 4 + 1];
    const b = imageData.data[i * 4 + 2];
    gray[i] = (r + g + b) / 3 / 255;
  }
  return gray;
}

function drawLine(ctx, x1, y1, x2, y2, color = "rgba(0,0,0,0.03)") {
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function calculateError(original, current) {
  let error = 0;
  for (let i = 0; i < original.length; i++) {
    error += Math.abs(original[i] - current[i]);
  }
  return error / original.length;
}

function copyCanvasData(ctx, width, height) {
  const imageData = ctx.getImageData(0, 0, width, height);
  return getImageGrayscale(imageData);
}

generateBtn.addEventListener("click", () => {
  if (!originalImage) {
    alert("Please upload an image first.");
    return;
  }

  const pinCount = parseInt(document.getElementById("numPins").value);
  const maxLines = parseInt(document.getElementById("maxLines").value);
  const targetSimilarity = parseInt(document.getElementById("targetSimilarity").value) / 100;

  const pins = getPins(pinCount);
  const targetGray = getImageGrayscale(originalImage);
  const current = new Float32Array(targetGray.length);
  let bestError = calculateError(targetGray, current);
  let lines = [];
  let prevIndex = 0;

  ctx.clearRect(0, 0, outputCanvas.width, outputCanvas.height);
  drawPins(ctx, pinCount);

  function step(i) {
    if (i >= maxLines || (1 - bestError) >= targetSimilarity) {
      console.log("Finished generating.");
      return;
    }

    let bestLine = null;
    let bestDelta = 0;

    for (let j = 0; j < pins.length; j++) {
      if (j === prevIndex) continue;

      hiddenCtx.fillStyle = "white";
      hiddenCtx.fillRect(0, 0, hiddenCanvas.width, hiddenCanvas.height);
      hiddenCtx.strokeStyle = "black";
      hiddenCtx.lineWidth = 1;

      hiddenCtx.beginPath();
      lines.forEach(([from, to]) => {
        const [x1, y1] = pins[from];
        const [x2, y2] = pins[to];
        hiddenCtx.moveTo(x1, y1);
        hiddenCtx.lineTo(x2, y2);
      });
      hiddenCtx.moveTo(...pins[prevIndex]);
      hiddenCtx.lineTo(...pins[j]);
      hiddenCtx.stroke();

      const sim = copyCanvasData(hiddenCtx, hiddenCanvas.width, hiddenCanvas.height);
      const newError = calculateError(targetGray, sim);
      const delta = bestError - newError;

      if (delta > bestDelta) {
        bestDelta = delta;
        bestLine = j;
      }
    }

    if (bestLine !== null) {
      drawLine(ctx, ...pins[prevIndex], ...pins[bestLine]);
      lines.push([prevIndex, bestLine]);
      prevIndex = bestLine;
      bestError -= bestDelta;
    }

    requestAnimationFrame(() => step(i + 1));
  }

  step(0);
});

exportBtn.addEventListener("click", () => {
  const link = document.createElement("a");
  link.download = "string_art.png";
  link.href = outputCanvas.toDataURL();
  link.click();
});
