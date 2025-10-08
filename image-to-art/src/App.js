import React, { useState, useRef, useEffect } from 'react';
import { Upload, Image as ImageIcon, Download, Sparkles } from 'lucide-react';

export default function ImageToArtConverter() {
  const [image, setImage] = useState(null);
  const [filter, setFilter] = useState('sketch');
  const [intensity, setIntensity] = useState(50);
  const canvasRef = useRef(null);
  const originalCanvasRef = useRef(null);

  const filters = [
    { id: 'sketch', name: 'Phác Họa', icon: '✏️' },
    { id: 'watercolor', name: 'Màu Nước', icon: '🎨' },
    { id: 'oil', name: 'Sơn Dầu', icon: '🖌️' },
    { id: 'cartoon', name: 'Hoạt Hình', icon: '🎭' },
    { id: 'pencil', name: 'Bút Chì', icon: '✍️' },
    { id: 'vintage', name: 'Cổ Điển', icon: '📜' }
  ];

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => setImage(img);
        img.src = event.target.result;
      };
      reader.readAsDataURL(file);
    }
  };

  useEffect(() => {
    if (image) applyFilter();
  }, [image, filter, intensity]);

  const applyFilter = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const origCanvas = originalCanvasRef.current;
    const origCtx = origCanvas.getContext('2d');

    const maxWidth = 800;
    const scale = Math.min(1, maxWidth / image.width);
    canvas.width = image.width * scale;
    canvas.height = image.height * scale;
    origCanvas.width = canvas.width;
    origCanvas.height = canvas.height;

    origCtx.drawImage(image, 0, 0, canvas.width, canvas.height);
    const imageData = origCtx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    let filteredData = ctx.createImageData(imageData);

    switch(filter) {
      case 'sketch': applySketchFilter(data, filteredData.data, canvas.width, canvas.height); break;
      case 'watercolor': applyWatercolorFilter(data, filteredData.data); break;
      case 'oil': applyOilFilter(data, filteredData.data); break;
      case 'cartoon': applyCartoonFilter(data, filteredData.data); break;
      case 'pencil': applyPencilFilter(data, filteredData.data); break;
      case 'vintage': applyVintageFilter(data, filteredData.data); break;
      default: filteredData = imageData;
    }

    ctx.putImageData(filteredData, 0, 0);
  };

  const applySketchFilter = (src, dst, width, height) => {
    for (let i = 0; i < src.length; i += 4) {
      const gray = src[i]*0.3 + src[i+1]*0.59 + src[i+2]*0.11;
      dst[i] = dst[i+1] = dst[i+2] = gray;
      dst[i+3] = src[i+3];
    }
    const factor = intensity/50;
    for (let y=1; y<height-1; y++){
      for (let x=1; x<width-1; x++){
        const i = (y*width + x)*4;
        const gx = (
          -dst[i-4]-2*dst[i]-dst[i+4] +
          dst[i+width*4-4]+2*dst[i+width*4]+dst[i+width*4+4]
        );
        const gy = (
          -dst[i-width*4-4]-2*dst[i-width*4]-dst[i-width*4+4] +
          dst[i+width*4-4]+2*dst[i+width*4]+dst[i+width*4+4]
        );
        const edge = Math.sqrt(gx*gx + gy*gy) * factor;
        const val = 255 - Math.min(255, edge);
        dst[i] = dst[i+1] = dst[i+2] = val;
      }
    }
  };

  const applyWatercolorFilter = (src, dst) => {
    const factor = intensity/100;
    for (let i=0;i<src.length;i+=4){
      dst[i] = Math.min(255, Math.max(0, src[i]*(0.8+factor*0.2) + Math.random()*20-10));
      dst[i+1] = Math.min(255, Math.max(0, src[i+1]*(0.8+factor*0.2) + Math.random()*20-10));
      dst[i+2] = Math.min(255, Math.max(0, src[i+2]*(0.8+factor*0.2) + Math.random()*20-10));
      dst[i+3] = src[i+3]*0.9;
    }
  };

  const applyOilFilter = (src,dst)=>{
    const factor=intensity/50;
    for(let i=0;i<src.length;i+=4){
      dst[i]=Math.min(255,src[i]*1.2*factor);
      dst[i+1]=Math.min(255,src[i+1]*1.2*factor);
      dst[i+2]=Math.min(255,src[i+2]*1.2*factor);
      dst[i+3]=src[i+3];
    }
  };

  const applyCartoonFilter=(src,dst)=>{
    const levels=Math.floor(3+intensity/20);
    for(let i=0;i<src.length;i+=4){
      dst[i]=Math.floor(src[i]/(256/levels))*(256/levels);
      dst[i+1]=Math.floor(src[i+1]/(256/levels))*(256/levels);
      dst[i+2]=Math.floor(src[i+2]/(256/levels))*(256/levels);
      dst[i+3]=src[i+3];
    }
  };

  const applyPencilFilter=(src,dst)=>{
    for(let i=0;i<src.length;i+=4){
      const gray=src[i]*0.3 + src[i+1]*0.59 + src[i+2]*0.11;
      const inverted=255-gray;
      const val=Math.min(255,inverted*(intensity/50));
      dst[i]=dst[i+1]=dst[i+2]=255-val;
      dst[i+3]=src[i+3];
    }
  };

  const applyVintageFilter=(src,dst)=>{
    for(let i=0;i<src.length;i+=4){
      dst[i]=src[i]*1.1+30;
      dst[i+1]=src[i+1]*1.0+20;
      dst[i+2]=src[i+2]*0.9;
      dst[i+3]=src[i+3]*(0.9+intensity/1000);

      const r=dst[i], g=dst[i+1], b=dst[i+2];
      dst[i]=Math.min(255,r*0.393+g*0.769+b*0.189);
      dst[i+1]=Math.min(255,r*0.349+g*0.686+b*0.168);
      dst[i+2]=Math.min(255,r*0.272+g*0.534+b*0.131);
    }
  };

  const downloadImage = ()=>{
    const canvas=canvasRef.current;
    const link=document.createElement('a');
    link.download=`artwork-${filter}.png`;
    link.href=canvas.toDataURL();
    link.click();
  };

  return (
    <div style={{minHeight:'100vh',background:'linear-gradient(135deg,#f5f0ff 0%,#ffe4f5 50%,#e0f2ff 100%)',padding:'2rem',fontFamily:'system-ui,-apple-system,sans-serif'}}>
      <div style={{maxWidth:'1200px',margin:'0 auto'}}>
        <div style={{textAlign:'center',marginBottom:'2rem'}}>
          <h1 style={{fontSize:'2.5rem',fontWeight:'bold',color:'#1f2937',marginBottom:'0.5rem',display:'flex',alignItems:'center',justifyContent:'center',gap:'1rem'}}>
            <Sparkles color="#9333ea" size={32}/>
            Chuyển Đổi Ảnh Thành Tranh Vẽ
            <Sparkles color="#9333ea" size={32}/>
          </h1>
          <p style={{color:'#6b7280',fontSize:'1.1rem'}}>Biến ảnh của bạn thành tác phẩm nghệ thuật</p>
        </div>

        {!image ? (
          <div style={{background:'white',borderRadius:'1rem',boxShadow:'0 10px 30px rgba(0,0,0,0.1)',padding:'3rem'}}>
            <label style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',cursor:'pointer',border:'4px dashed #d8b4fe',borderRadius:'1rem',padding:'3rem',transition:'all 0.3s'}}
              onMouseEnter={(e)=>{e.currentTarget.style.borderColor='#a855f7';e.currentTarget.style.background='#faf5ff';}}
              onMouseLeave={(e)=>{e.currentTarget.style.borderColor='#d8b4fe';e.currentTarget.style.background='transparent';}}
            >
              <Upload color="#c084fc" size={64}/>
              <span style={{fontSize:'1.5rem',fontWeight:'600',color:'#374151',marginBottom:'0.5rem'}}>Tải ảnh lên</span>
              <span style={{color:'#6b7280'}}>Chọn ảnh để bắt đầu chuyển đổi</span>
              <input type="file" accept="image/*" onChange={handleImageUpload} style={{display:'none'}}/>
            </label>
          </div>
        ) : (
          <div>
            {/* Chọn phong cách */}
            <div style={{background:'white',borderRadius:'1rem',boxShadow:'0 10px 30px rgba(0,0,0,0.1)',padding:'1.5rem',marginBottom:'1.5rem'}}>
              <h2 style={{fontSize:'1.5rem',fontWeight:'bold',color:'#1f2937',marginBottom:'1rem',display:'flex',alignItems:'center',gap:'0.5rem'}}>
                <ImageIcon size={24}/> Chọn Phong Cách
              </h2>
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(120px,1fr))',gap:'0.75rem'}}>
                {filters.map(f=>(
                  <button key={f.id} onClick={()=>setFilter(f.id)} style={{
                    padding:'1rem',borderRadius:'0.75rem',textAlign:'center',transition:'all 0.3s',border:'none',cursor:'pointer',
                    background: filter===f.id?'linear-gradient(135deg,#a855f7 0%,#ec4899 100%)':'#f3f4f6',
                    color: filter===f.id?'white':'#374151', transform: filter===f.id?'scale(1.05)':'scale(1)',
                    boxShadow: filter===f.id?'0 10px 20px rgba(168,85,247,0.3)':'none'
                  }}>
                    <div style={{fontSize:'2rem',marginBottom:'0.5rem'}}>{f.icon}</div>
                    <div style={{fontSize:'0.9rem',fontWeight:'600'}}>{f.name}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Cường độ */}
            <div style={{background:'white',borderRadius:'1rem',boxShadow:'0 10px 30px rgba(0,0,0,0.1)',padding:'1.5rem',marginBottom:'1.5rem'}}>
              <h2 style={{fontSize:'1.5rem',fontWeight:'bold',color:'#1f2937',marginBottom:'1rem'}}>Cường Độ Hiệu Ứng</h2>
              <div style={{display:'flex',alignItems:'center',gap:'1rem'}}>
                <span style={{color:'#6b7280',fontWeight:'500'}}>Nhẹ</span>
                <input type="range" min="0" max="100" value={intensity} onChange={e=>setIntensity(Number(e.target.value))}
                  style={{flex:1,height:'8px',borderRadius:'4px',background:'linear-gradient(90deg,#ddd6fe 0%,#a855f7 100%)',outline:'none',cursor:'pointer'}}/>
                <span style={{color:'#6b7280',fontWeight:'500'}}>Mạnh</span>
                <span style={{color:'#a855f7',fontWeight:'bold',width:'60px',textAlign:'center',fontSize:'1.1rem'}}>{intensity}%</span>
              </div>
            </div>

            {/* Kết quả */}
            <div style={{background:'white',borderRadius:'1rem',boxShadow:'0 10px 30px rgba(0,0,0,0.1)',padding:'1.5rem',marginBottom:'1.5rem'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'1rem'}}>
                <h2 style={{fontSize:'1.5rem',fontWeight:'bold',color:'#1f2937',margin:0}}>Kết Quả</h2>
                <button onClick={downloadImage} style={{display:'flex',alignItems:'center',gap:'0.5rem',background:'linear-gradient(135deg,#10b981 0%,#059669 100%)',color:'white',padding:'0.75rem 1.5rem',borderRadius:'0.75rem',border:'none',cursor:'pointer',fontSize:'1rem',fontWeight:'600',boxShadow:'0 4px 12px rgba(16,185,129,0.3)',transition:'all 0.3s'}}>
                  <Download size={20}/> Tải Xuống
                </button>
              </div>
              <div style={{display:'flex',justifyContent:'center',background:'#f9fafb',borderRadius:'0.75rem',padding:'1rem'}}>
                <canvas ref={canvasRef} style={{maxWidth:'100%',height:'auto',borderRadius:'0.5rem',boxShadow:'0 8px 24px rgba(0,0,0,0.15)'}}/>
              </div>
              <canvas ref={originalCanvasRef} style={{display:'none'}}/>
            </div>

            <div style={{textAlign:'center'}}>
              <button onClick={()=>setImage(null)} style={{color:'#6b7280',textDecoration:'underline',background:'none',border:'none',cursor:'pointer',fontSize:'1rem',padding:'0.5rem'}}>Tải ảnh khác</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
