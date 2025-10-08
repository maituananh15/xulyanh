import React, { useState, useRef, useEffect } from 'react';
import { Upload, Download, ImageIcon } from 'lucide-react';

export default function ImageToPainting() {
  // === State quản lý ảnh ===
  const [originalImage, setOriginalImage] = useState(null); // ảnh gốc người dùng tải lên
  const [processedImage, setProcessedImage] = useState(null); // ảnh đã áp dụng hiệu ứng
  const [filterType, setFilterType] = useState('cartoon'); // kiểu hiệu ứng (cartoon, pencil, watercolor, edge)
  const [grayLevel, setGrayLevel] = useState(128); // ngưỡng xám cho viền cạnh
  const [edgeStrength, setEdgeStrength] = useState(50); // độ mạnh biên (dùng cho cartoon)
  const canvasRef = useRef(null); // canvas ẩn để xử lý ảnh
  const fileInputRef = useRef(null); // ref để reset input file

  // === Hàm xử lý tải ảnh lên ===
  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          setOriginalImage(img);
          applyFilter(img, filterType); // tự động áp dụng hiệu ứng ngay khi tải ảnh
        };
        img.src = event.target.result;
      };
      reader.readAsDataURL(file);
    }
  };

  // === Hàm lọc bilateral để làm mịn (như yêu cầu) ===
  const applyBilateralFilter = (imageData, d = 9, sigmaColor = 75, sigmaSpace = 75) => {
    const { width, height, data } = imageData;
    const output = new Uint8ClampedArray(data);
    const radius = Math.floor(d / 2);

    // duyệt từng pixel
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let rSum = 0, gSum = 0, bSum = 0, wSum = 0;
        const idx = (y * width + x) * 4;
        const centerR = data[idx];
        const centerG = data[idx + 1];
        const centerB = data[idx + 2];

        for (let dy = -radius; dy <= radius; dy++) {
          for (let dx = -radius; dx <= radius; dx++) {
            const ny = Math.min(Math.max(y + dy, 0), height - 1);
            const nx = Math.min(Math.max(x + dx, 0), width - 1);
            const nIdx = (ny * width + nx) * 4;

            const spaceDist = dx * dx + dy * dy;
            const colorDist = Math.pow(data[nIdx] - centerR, 2) +
                              Math.pow(data[nIdx + 1] - centerG, 2) +
                              Math.pow(data[nIdx + 2] - centerB, 2);

            const spaceWeight = Math.exp(-spaceDist / (2 * sigmaSpace * sigmaSpace));
            const colorWeight = Math.exp(-colorDist / (2 * sigmaColor * sigmaColor));
            const weight = spaceWeight * colorWeight;

            rSum += data[nIdx] * weight;
            gSum += data[nIdx + 1] * weight;
            bSum += data[nIdx + 2] * weight;
            wSum += weight;
          }
        }

        output[idx] = rSum / wSum;
        output[idx + 1] = gSum / wSum;
        output[idx + 2] = bSum / wSum;
      }
    }

    return new ImageData(output, width, height);
  };

  // === Hàm phát hiện biên (dùng Sobel operator) ===
  const detectEdges = (imageData) => {
    const { width, height, data } = imageData;
    const gray = new Uint8ClampedArray(width * height);
    
    // chuyển ảnh sang grayscale
    for (let i = 0; i < data.length; i += 4) {
      gray[i / 4] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    }

    const edges = new Uint8ClampedArray(width * height);
    const sobelX = [[-1, 0, 1], [-2, 0, 2], [-1, 0, 1]];
    const sobelY = [[-1, -2, -1], [0, 0, 0], [1, 2, 1]];

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        let gx = 0, gy = 0;
        
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const idx = (y + ky) * width + (x + kx);
            gx += gray[idx] * sobelX[ky + 1][kx + 1];
            gy += gray[idx] * sobelY[ky + 1][kx + 1];
          }
        }
        
        edges[y * width + x] = Math.sqrt(gx * gx + gy * gy); // magnitude gradient
      }
    }

    return edges; // trả về mảng biên
  };

  // === Hàm áp dụng hiệu ứng theo kiểu filterType ===
  const applyFilter = (img, type) => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    // resize ảnh nếu quá lớn
    const maxWidth = 800;
    const maxHeight = 600;
    let width = img.width;
    let height = img.height;
    
    if (width > maxWidth || height > maxHeight) {
      const ratio = Math.min(maxWidth / width, maxHeight / height);
      width *= ratio;
      height *= ratio;
    }
    
    canvas.width = width;
    canvas.height = height;
    ctx.drawImage(img, 0, 0, width, height);
    
    let imageData = ctx.getImageData(0, 0, width, height);

    // === Hiệu ứng Cartoon: làm mịn + viền biên ===
    if (type === 'cartoon') {
      imageData = applyBilateralFilter(imageData, 9, 75, 75); // làm mịn
      const edges = detectEdges(imageData); // phát hiện biên
      
      for (let i = 0; i < imageData.data.length; i += 4) {
        const edgeIdx = i / 4;
        if (edges[edgeIdx] > edgeStrength) { // vẽ viền đen
          imageData.data[i] = 0;
          imageData.data[i + 1] = 0;
          imageData.data[i + 2] = 0;
        }
      }

    // === Hiệu ứng Pencil (vẽ chì) ===
    } else if (type === 'pencil') {
      const gray = new Uint8ClampedArray(imageData.data.length / 4);
      for (let i = 0; i < imageData.data.length; i += 4) {
        gray[i / 4] = 0.299 * imageData.data[i] + 0.587 * imageData.data[i + 1] + 0.114 * imageData.data[i + 2];
      }

      const inverted = gray.map(v => 255 - v); // đảo màu
      const blurred = new Uint8ClampedArray(inverted.length);
      
      // Gaussian blur đơn giản
      for (let y = 2; y < height - 2; y++) {
        for (let x = 2; x < width - 2; x++) {
          let sum = 0;
          for (let ky = -2; ky <= 2; ky++) {
            for (let kx = -2; kx <= 2; kx++) {
              sum += inverted[(y + ky) * width + (x + kx)];
            }
          }
          blurred[y * width + x] = sum / 25;
        }
      }

      // áp dụng hiệu ứng vẽ chì
      for (let i = 0; i < imageData.data.length; i += 4) {
        const idx = i / 4;
        const value = Math.min(255, (gray[idx] * 256) / (256 - blurred[idx]));
        imageData.data[i] = value;
        imageData.data[i + 1] = value;
        imageData.data[i + 2] = value;
      }

    // === Hiệu ứng Watercolor (màu nước) ===
    } else if (type === 'watercolor') {
      imageData = applyBilateralFilter(imageData, 15, 100, 100); // làm mịn mạnh
      
      // giảm số mức màu để tạo hiệu ứng màu nước
      for (let i = 0; i < imageData.data.length; i += 4) {
        imageData.data[i] = Math.floor(imageData.data[i] / 20) * 20;
        imageData.data[i + 1] = Math.floor(imageData.data[i + 1] / 20) * 20;
        imageData.data[i + 2] = Math.floor(imageData.data[i + 2] / 20) * 20;
      }

    // === Hiệu ứng Edge (phát hiện viền) ===
    } else if (type === 'edge') {
      const edges = detectEdges(imageData);
      const threshold = grayLevel; // ngưỡng xám người dùng chọn
      
      for (let i = 0; i < imageData.data.length; i += 4) {
        const edgeIdx = i / 4;
        const value = edges[edgeIdx] > threshold ? 0 : 255; // biên đen, nền trắng
        imageData.data[i] = value;
        imageData.data[i + 1] = value;
        imageData.data[i + 2] = value;
      }
    }

    ctx.putImageData(imageData, 0, 0);
    setProcessedImage(canvas.toDataURL()); // cập nhật ảnh đã xử lý
  };

  // === Cập nhật hiệu ứng khi filterType hoặc slider thay đổi ===
  useEffect(() => {
    if (originalImage) {
      applyFilter(originalImage, filterType);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterType, grayLevel, edgeStrength]);

  // === Tải ảnh xuống ===
  const handleDownload = () => {
    if (processedImage) {
      const link = document.createElement('a');
      link.download = `tranh-ve-${filterType}.png`;
      link.href = processedImage;
      link.click();
    }
  };

  // === JSX hiển thị giao diện ===
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-100 via-pink-50 to-blue-100 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h1 className="text-4xl font-bold text-center mb-2 bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
            Chuyển Ảnh Thành Tranh Vẽ
          </h1>

          {/* Upload ảnh */}
          <div className="mb-8">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
              id="file-upload"
            />
            <label
              htmlFor="file-upload"
              className="flex items-center justify-center gap-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white px-6 py-3 rounded-lg cursor-pointer hover:from-purple-600 hover:to-pink-600 transition-all w-full max-w-xs mx-auto"
            >
              <Upload size={20} />
              Tải Ảnh Lên
            </label>
          </div>

          {/* Hiển thị các lựa chọn hiệu ứng */}
          {originalImage && (
            <>
              <div className="mb-6 p-6 bg-gray-50 rounded-xl">
                <h3 className="text-lg font-semibold mb-4 text-gray-800">Chọn Hiệu Ứng Tranh Vẽ</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                  {[{ value: 'cartoon', label: 'Phim Hoạt Hình', icon: '🎨' },
                    { value: 'pencil', label: 'Vẽ Chì', icon: '✏️' },
                    { value: 'watercolor', label: 'Màu Nước', icon: '🖌️' },
                    { value: 'edge', label: 'Viền Cạnh', icon: '🖼️' }]
                    .map(filter => (
                      <button
                        key={filter.value}
                        onClick={() => setFilterType(filter.value)}
                        className={`p-4 rounded-lg transition-all ${
                          filterType === filter.value
                            ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg scale-105'
                            : 'bg-white text-gray-700 hover:bg-gray-100 border-2 border-gray-200'
                        }`}
                      >
                        <div className="text-2xl mb-1">{filter.icon}</div>
                        <div className="text-sm font-medium">{filter.label}</div>
                      </button>
                    ))
                  }
                </div>

                {/* Slider điều chỉnh ngưỡng xám (Edge) */}
                {filterType === 'edge' && (
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Ngưỡng xám: {grayLevel}
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="255"
                      value={grayLevel}
                      onChange={(e) => setGrayLevel(parseInt(e.target.value))}
                      className="w-full"
                    />
                  </div>
                )}

                {/* Slider điều chỉnh độ mạnh biên (Cartoon) */}
                {filterType === 'cartoon' && (
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Độ mạnh viền: {edgeStrength}
                    </label>
                    <input
                      type="range"
                      min="10"
                      max="100"
                      value={edgeStrength}
                      onChange={(e) => setEdgeStrength(parseInt(e.target.value))}
                      className="w-full"
                    />
                  </div>
                )}
              </div>

              {/* Hiển thị ảnh gốc và ảnh đã xử lý */}
              <div className="grid md:grid-cols-2 gap-6 mb-6">
                <div className="bg-gray-50 p-4 rounded-xl">
                  <h3 className="text-lg font-semibold mb-3 text-gray-800 flex items-center gap-2">
                    <ImageIcon size={20} />
                    Ảnh Gốc
                  </h3>
                  <img src={originalImage.src} alt="Original" className="w-full rounded-lg shadow-md" />
                </div>
                <div className="bg-gray-50 p-4 rounded-xl">
                  <h3 className="text-lg font-semibold mb-3 text-gray-800 flex items-center gap-2">
                    🎨 Tranh Vẽ
                  </h3>
                  {processedImage && (
                    <img src={processedImage} alt="Processed" className="w-full rounded-lg shadow-md" />
                  )}
                </div>
              </div>

              {/* Button tải xuống và reset */}
              <div className="flex justify-center gap-4">
                <button
                  onClick={handleDownload}
                  className="flex items-center gap-2 bg-green-500 text-white px-6 py-3 rounded-lg hover:bg-green-600 transition-all shadow-md"
                >
                  <Download size={20} />
                  Tải Xuống
                </button>
              </div>
            </>
          )}
          {/* Canvas ẩn để xử lý ảnh */}
          <canvas ref={canvasRef} className="hidden" />
        </div>
      </div>
    </div>
  );
}
