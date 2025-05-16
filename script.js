const imageInput = document.getElementById("imageInput");
const canvas = document.getElementById("previewCanvas");
const ctx = canvas.getContext("2d");

let imageData, grayData, pins = [];

imageInput.addEventListener("change", handleImage);

function handleImage(e) {
  const reader = new FileReader();
  reader.onload = function (event) {
    const img = new Image();
    img.onload = function () {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      grayData = toGrayscale(imageData);
    };
    img.src = event.target.result;
  };
  reader.readAsDataURL(e.target.files[0]);
}

function toGrayscale(imageData) {
  const gray = [];
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const avg = 0.299 * data[i] + 0.587 * data[i+1] + 0.114 * data[i+2];
    gray.push(avg);
  }
  return gray;
}

function getPins(n) {
  const radius = canvas.width / 2 - 10;
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  const pins = [];
  for (let i = 0; i < n; i++) {
    const angle = (2 * Math.PI * i) / n;
    pins.push([cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)]);
  }
  return pins;
}

function drawLine(p1, p2, color = "black") {
  ctx.beginPath();
  ctx.moveTo(...p1);
  ctx.lineTo(...p2);
  ctx.strokeStyle = color;
  ctx.lineWidth = 0.3;
  ctx.stroke();
}

function generateStringArt(numPins, numLines) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  pins = getPins(numPins);

  let lines = [];
  let current = 0;
  let used = new Set();
  used.add(current);

  for (let i = 0; i < numLines; i++) {
    let best = -1;
    let minDist = Infinity;
    for (let j = 0; j < pins.length; j++) {
      if (j === current) continue;
      const d = lineDarkness(pins[current], pins[j]);
      if (d < minDist) {
        best = j;
        minDist = d;
      }
    }
    lines.push([current, best]);
    current = best;
  }

  let step = 0;
  const interval = setInterval(() => {
    if (step >= lines.length) {
      clearInterval(interval);
      return;
    }
    const [from, to] = lines[step];
    drawLine(pins[from], pins[to]);
    step++;
  }, 1);
}

function lineDarkness(p1, p2) {
  const steps = 100;
  let sum = 0;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = Math.round(p1[0] * (1 - t) + p2[0] * t);
    const y = Math.round(p1[1] * (1 - t) + p2[1] * t);
    const index = y * canvas.width + x;
    sum += grayData[index] || 255;
  }
  return sum / steps;
}

document.getElementById("generateButton").addEventListener("click", () => {
  const numPins = parseInt(document.getElementById("numPins").value);
  const numLines = parseInt(document.getElementById("numLines").value);
  generateStringArt(numPins, numLines);
});

document.getElementById("exportPNG").addEventListener("click", () => {
  const link = document.createElement("a");
  link.download = "string-art.png";
  link.href = canvas.toDataURL("image/png");
  link.click();
});

document.getElementById("exportSVG").addEventListener("click", () => {
  const svgContent = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600">`,
    `<rect width="100%" height="100%" fill="white"/>`
  ];
  for (let i = 0; i < canvas.__lines?.length || 0; i++) {
    const [a, b] = canvas.__lines[i];
    const [x1, y1] = pins[a];
    const [x2, y2] = pins[b];
    svgContent.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="black" stroke-width="0.3"/>`);
  }
  svgContent.push(`</svg>`);
  const blob = new Blob([svgContent.join("\n")], { type: "image/svg+xml" });
  const link = document.createElement("a");
  link.download = "string-art.svg";
  link.href = URL.createObjectURL(blob);
  link.click();
});
