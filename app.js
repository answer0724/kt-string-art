window.addEventListener("DOMContentLoaded", () => {
  const imageUpload = document.getElementById("imageUpload");
  const previewImage = document.getElementById("previewImage");
  const generateBtn = document.getElementById("generateBtn");
  const exportBtn = document.getElementById("exportBtn");
  const outputCanvas = document.getElementById("outputCanvas");
  const hiddenCanvas = document.getElementById("hiddenCanvas");
  const ctx = outputCanvas.getContext("2d", { willReadFrequently: true });
  const hiddenCtx = hiddenCanvas.getContext("2d", { willReadFrequently: true });

  let originalImage = null;

  // Limit constants for performance
  const MAX_PINS_LIMIT = 120;
  const MAX_LINES_LIMIT = 300;

  // Show preview and store original image data
  imageUpload.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (event) {
      const img = new Image();
      img.onload = function () {
        // Show preview
        previewImage.src = img.src;

        // Draw resized image on hidden canvas
        hiddenCtx.clearRect(0, 0, hiddenCanvas.width, hiddenCanvas.height);
        hiddenCtx.drawImage(img, 0, 0, hiddenCanvas.width, hiddenCanvas.height);

        // Save image data for calculations
        originalImage = hiddenCtx.getImageData(0, 0, hiddenCanvas.width, hiddenCanvas.height);

        drawPins();
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  });

  function drawPins() {
    ctx.clearRect(0, 0, outputCanvas.width, outputCanvas.height);
    const pinCount = parseInt(document.getElementById("numPins").value);
    const cx = outputCanvas.width / 2;
    const cy = outputCanvas.height / 2;
    const radius = cx - 10;

    ctx.fillStyle = "#000";
    for (let i = 0; i < pinCount; i++) {
      const angle = (2 * Math.PI * i) / pinCount;
      const x = cx + radius * Math.cos(angle);
      const y = cy + radius * Math.sin(angle);
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, 2 * Math.PI);
      ctx.fill();
    }
  }

  function getPins(numPins) {
    const pins = [];
    const cx = outputCanvas.width / 2;
    const cy = outputCanvas.height / 2;
    const radius = cx - 10;

    for (let i = 0; i < numPins; i++) {
      const angle = (2 * Math.PI * i) / numPins;
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

  function drawLine(x1, y1, x2, y2, color = "rgba(0,0,0,0.03)") {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5; // เพิ่มความหนาเส้นจาก 1 เป็น 1.5
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

    // อ่านค่าจาก input และจำกัดค่าเพื่อลดเวลาการประมวลผล
    let pinCount = parseInt(document.getElementById("numPins").value);
    let maxLines = parseInt(document.getElementById("maxLines").value);
    const targetSimilarity = parseInt(document.getElementById("targetSimilarity").value) / 100;

    if (pinCount > MAX_PINS_LIMIT) {
      pinCount = MAX_PINS_LIMIT;
      alert(`Number of pins limited to ${MAX_PINS_LIMIT} for performance.`);
      document.getElementById("numPins").value = MAX_PINS_LIMIT;
    }

    if (maxLines > MAX_LINES_LIMIT) {
      maxLines = MAX_LINES_LIMIT;
      alert(`Max lines limited to ${MAX_LINES_LIMIT} for performance.`);
      document.getElementById("maxLines").value = MAX_LINES_LIMIT;
    }

    const pins = getPins(pinCount);

    ctx.clearRect(0, 0, outputCanvas.width, outputCanvas.height);
    drawPins();

    const targetGray = getImageGrayscale(originalImage);
    const current = new Float32Array(targetGray.length); // Start blank (all zeros)
    let bestError = calculateError(targetGray, current);
    let lines = [];
    let prevIndex = 0;

    function step(i) {
      if (i >= maxLines || (1 - bestError) >= targetSimilarity) {
        console.log("Generation finished");
        return;
      }

      let bestLine = null;
      let bestDelta = 0;

      for (let j = 0; j < pins.length; j++) {
        if (j === prevIndex) continue;

        hiddenCtx.clearRect(0, 0, hiddenCanvas.width, hiddenCanvas.height);

        // ตรงนี้จะใช้รูปภาพต้นฉบับ เพื่อเปรียบเทียบ error
        hiddenCtx.putImageData(originalImage, 0, 0);

        // วาดพื้นหลังสีขาวใน hidden canvas เพื่อเก็บเส้น thread
        hiddenCtx.fillStyle = "white";
        hiddenCtx.fillRect(0, 0, hiddenCanvas.width, hiddenCanvas.height);

        // วาดเส้น thread เก่า ๆ + candidate line บน hidden canvas
        hiddenCtx.strokeStyle = "black";
        hiddenCtx.lineWidth = 1;
        hiddenCtx.beginPath();

        // วาดเส้นเดิมบน output canvas เพื่อดู animation
        ctx.clearRect(0, 0, outputCanvas.width, outputCanvas.height);
        drawPins();
        lines.forEach(([from, to]) => {
          const [x1, y1] = pins[from];
          const [x2, y2] = pins[to];
          drawLine(x1, y1, x2, y2);
          hiddenCtx.moveTo(x1, y1);
          hiddenCtx.lineTo(x2, y2);
        });

        // วาด candidate line บน hidden canvas
        hiddenCtx.moveTo(...pins[prevIndex]);
        hiddenCtx.lineTo(...pins[j]);
        hiddenCtx.stroke();

        // คำนวณ grayscale และ error เพื่อตัดสินใจเลือกเส้นที่ดีที่สุด
        const sim = copyCanvasData(hiddenCtx, hiddenCanvas.width, hiddenCanvas.height);
        const newError = calculateError(targetGray, sim);
        const delta = bestError - newError;

        if (delta > bestDelta) {
          bestDelta = delta;
          bestLine = j;
        }
      }

      if (bestLine !== null) {
        drawLine(...pins[prevIndex], ...pins[bestLine]);
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

});
