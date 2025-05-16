document.addEventListener('DOMContentLoaded', () => {
    // Get DOM elements
    const uploadImage = document.getElementById('uploadImage');
    const pinInput = document.getElementById('pinCount');
    const lineInput = document.getElementById('maxLines');
    const targetInput = document.getElementById('targetSim');
    const generateBtn = document.getElementById('generateBtn');
    const exportBtn = document.getElementById('exportBtn');
    const canvasOutput = document.getElementById('canvasOutput');
    const canvasHidden = document.getElementById('canvasHidden');
    const ctxOut = canvasOutput.getContext('2d');
    const ctxHidden = canvasHidden.getContext('2d');

    let pins = [];
    let width = canvasOutput.width;
    let height = canvasOutput.height;
    let imageDataOriginal = null;

    // Handle image upload
    uploadImage.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (!file) return;
        const img = new Image();
        img.onload = () => {
            // Draw uploaded image to hidden canvas (scaled)
            canvasHidden.width = width;
            canvasHidden.height = height;
            ctxHidden.drawImage(img, 0, 0, width, height);
            // Store image data for similarity checks
            imageDataOriginal = ctxHidden.getImageData(0, 0, width, height).data;
            // Clear output canvas
            ctxOut.clearRect(0, 0, width, height);
            ctxOut.fillStyle = '#ffffff';
            ctxOut.fillRect(0, 0, width, height);
        };
        img.src = URL.createObjectURL(file);
    });

    // Generate string art
    generateBtn.addEventListener('click', () => {
        if (!imageDataOriginal) {
            alert('Please upload an image first!');
            return;
        }
        const numPins = parseInt(pinInput.value);
        const maxLines = parseInt(lineInput.value);
        const targetSim = parseFloat(targetInput.value);

        // Setup output canvas
        ctxOut.clearRect(0, 0, width, height);
        ctxOut.fillStyle = '#ffffff';
        ctxOut.fillRect(0, 0, width, height);

        // Calculate pin coordinates on a circle
        pins = [];
        const radius = Math.min(width, height) * 0.45;
        const centerX = width / 2;
        const centerY = height / 2;
        for (let i = 0; i < numPins; i++) {
            const angle = (2 * Math.PI * i) / numPins;
            const x = centerX + radius * Math.cos(angle);
            const y = centerY + radius * Math.sin(angle);
            pins.push({x: x, y: y});
        }

        // Iteratively draw lines
        let linesDrawn = 0;
        function drawStep() {
            if (linesDrawn >= maxLines) return;
            // Pick two random distinct pins
            const i = Math.floor(Math.random() * numPins);
            let j = Math.floor(Math.random() * numPins);
            if (j === i) j = (j + 1) % numPins;
            // Draw line between pins[i] and pins[j]
            ctxOut.strokeStyle = 'rgba(0,0,0,0.05)';
            ctxOut.lineWidth = 1;
            ctxOut.beginPath();
            ctxOut.moveTo(pins[i].x, pins[i].y);
            ctxOut.lineTo(pins[j].x, pins[j].y);
            ctxOut.stroke();

            linesDrawn++;
            // Check similarity every 10 lines for efficiency
            if (linesDrawn % 10 === 0) {
                const dataOut = ctxOut.getImageData(0, 0, width, height).data;
                let diffSum = 0;
                for (let p = 0; p < dataOut.length; p += 4) {
                    // Compare grayscale values
                    const grayOrig = imageDataOriginal[p] * 0.299 + imageDataOriginal[p+1] * 0.587 + imageDataOriginal[p+2] * 0.114;
                    const grayOut = dataOut[p] * 0.299 + dataOut[p+1] * 0.587 + dataOut[p+2] * 0.114;
                    diffSum += Math.abs(grayOrig - grayOut);
                }
                const similarity = 1 - diffSum / (255 * width * height);
                if (similarity >= targetSim) {
                    return; // target reached
                }
            }
            // Request next frame
            requestAnimationFrame(drawStep);
        }
        drawStep();
    });

    // Export canvas to PNG
    exportBtn.addEventListener('click', () => {
        const link = document.createElement('a');
        link.download = 'string_art.png';
        link.href = canvasOutput.toDataURL('image/png');
        link.click();
    });
});
