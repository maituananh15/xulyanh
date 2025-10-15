import cv2
import numpy as np
import tkinter as tk
from tkinter import filedialog, ttk, messagebox
from PIL import Image, ImageTk

# Khai báo biến toàn cục
global_img_original = None
global_img_result = None

# --- THUẬT TOÁN XỬ LÝ ẢNH (Dựa trên Chương 5) ---
def apply_sketch_effect(img_input, params):
    """
    Áp dụng các thuật toán xử lý ảnh để chuyển ảnh thành tranh vẽ.
    * Đảm bảo chuyển đổi mức xám (Grayscale) là bước đầu tiên.
    """
    if img_input is None:
        return None
    
    # 1. Chuyển đổi mức xám (Chương 5)
    if len(img_input.shape) == 3:
        gray = cv2.cvtColor(img_input, cv2.COLOR_BGR2GRAY)
    else:
        gray = img_input.copy()

    # 2. Làm mịn ảnh (Smoothing/Giảm nhiễu)
    smoothing_method = params['smoothing_method']
    smoothed = gray
    
    # Lấy các tham số Bilateral/Gaussian (Chương 5 và Yêu cầu thêm)
    sigma_s = int(params['sigma_s']) # Bán kính/Kích thước kernel
    sigma_r = int(params['sigma_r']) # Mức ảnh hưởng màu
    
    if smoothing_method == 'Bilateral':
        # Bilateral filter (edge-preserving)
        smoothed = cv2.bilateralFilter(gray, 
                                       d=sigma_s, # Bán kính lân cận (d=sigma_s)
                                       sigmaColor=sigma_r, 
                                       sigmaSpace=sigma_r) # Sigma Space
    elif smoothing_method == 'Gaussian':
        # Gaussian Filter (Bước làm mịn của Canny)
        ksize = sigma_s # Sử dụng sigma_s làm kích thước kernel
        if ksize < 3: ksize = 3
        if ksize % 2 == 0: ksize += 1 # Kích thước kernel phải là số lẻ
        smoothed = cv2.GaussianBlur(gray, (ksize, ksize), 0)
    # else: smoothed = gray

    # 3. Phát hiện biên (Edge Detection)
    edge_method = params['edge_method']
    edges = None
    
    if edge_method == 'Canny':
        # Canny: Phát hiện biên tối ưu (Dùng ngưỡng kép T1, T2)
        T_low = int(params['canny_t_low'])
        T_high = int(params['canny_t_high'])
        edges = cv2.Canny(smoothed, T_low, T_high)
        
    elif edge_method == 'Sobel':
        # Sobel: Phương pháp Gradient bậc 1
        sobelx = cv2.Sobel(smoothed, cv2.CV_64F, 1, 0, ksize=3) 
        sobely = cv2.Sobel(smoothed, cv2.CV_64F, 0, 1, ksize=3) 
        mag = cv2.magnitude(sobelx, sobely)
        
        # Chuẩn hóa, ngưỡng đơn giản, và đảo ngược để có nét đen
        mag = cv2.normalize(mag, None, 0, 255, cv2.NORM_MINMAX, cv2.CV_8U)
        _, edges = cv2.threshold(mag, 100, 255, cv2.THRESH_BINARY_INV) # Biên đen trên nền trắng
        
    elif edge_method == 'Laplacian':
        # Laplacian: Đạo hàm bậc 2
        laplacian = cv2.Laplacian(smoothed, cv2.CV_64F, ksize=3)
        laplacian = cv2.normalize(laplacian, None, 0, 255, cv2.NORM_MINMAX, cv2.CV_8U)
        
        # Ngưỡng: giữ lại các đường nét mạnh
        _, edges = cv2.threshold(laplacian, 80, 255, cv2.THRESH_BINARY_INV)

    # 4. Tạo hiệu ứng Sketch (Pencil Sketch Effect - Color Dodge Blend)
    if edges is not None and np.any(edges > 0):
        # Đảo ngược màu biên (từ edges_binary -> edges_inv_binary)
        edges_inv = cv2.bitwise_not(edges) 
        
        # Pha trộn: smooth / (255 - edges_inv) * 256.0
        smoothed_float = smoothed.astype(float)
        edges_inv_float = edges_inv.astype(float)
        
        # Xử lý chia cho 0
        denominator = 255.0 - edges_inv_float
        denominator[denominator == 0] = 1.0 # Ngăn chia cho 0
        
        sketch = cv2.divide(smoothed_float, denominator, scale=256.0)
        sketch = sketch.astype(np.uint8)
        
        # Trả về ảnh 3 kênh BGR
        return cv2.cvtColor(sketch, cv2.COLOR_GRAY2BGR)
    
    # Nếu không phát hiện được biên, trả về ảnh đã làm mịn (hiệu ứng màu nước)
    return cv2.cvtColor(smoothed, cv2.COLOR_GRAY2BGR)


# --- CHỨC NĂNG GIAO DIỆN ---

def open_image():
    """Mở hộp thoại chọn ảnh, tải ảnh gốc và gọi xử lý ảnh."""
    global global_img_original
    file_path = filedialog.askopenfilename(
        title="Chọn ảnh đầu vào",
        filetypes=[("Image files", "*.jpg;*.jpeg;*.png;*.bmp")]
    )
    if not file_path:
        return

    img_bgr = cv2.imread(file_path)
    if img_bgr is None:
        messagebox.showerror("Lỗi", "Không thể đọc ảnh.")
        return

    global_img_original = img_bgr
    
    # Hiển thị ảnh gốc
    display_image(global_img_original, label_original, 'Ảnh Gốc')
    
    # Áp dụng hiệu ứng mặc định ngay lập tức
    process_image()

def save_image():
    """Lưu ảnh kết quả."""
    global global_img_result
    if global_img_result is None:
        messagebox.showwarning("Cảnh báo", "Chưa có ảnh kết quả để lưu.")
        return

    file_path = filedialog.asksaveasfilename(
        defaultextension=".png",
        filetypes=[("PNG files", "*.png"), ("JPEG files", "*.jpg")],
        title="Lưu ảnh kết quả"
    )
    if file_path:
        cv2.imwrite(file_path, global_img_result)
        messagebox.showinfo("Thành công", f"Đã lưu ảnh tại: {file_path}")

def process_image(*args):
    """Lấy tham số từ UI và xử lý ảnh (được gọi bởi nút, combobox, scale)."""
    global global_img_original, global_img_result
    if global_img_original is None:
        return

    # Lấy các giá trị hiện tại
    params = {
        'smoothing_method': combo_smoothing.get(),
        'edge_method': combo_edge.get(),
        'sigma_s': scale_sigma_s.get(),
        'sigma_r': scale_sigma_r.get(),
        'canny_t_low': scale_canny_t_low.get(),
        'canny_t_high': scale_canny_t_high.get(),
    }
    
    # Đảm bảo Ngưỡng Thấp (T_low) luôn nhỏ hơn Ngưỡng Cao (T_high)
    if params['edge_method'] == 'Canny':
         if params['canny_t_low'] >= params['canny_t_high']:
             # Đặt Ngưỡng Thấp bằng Ngưỡng Cao - 1
             new_low = params['canny_t_high'] - 1 if params['canny_t_high'] > 1 else 1
             scale_canny_t_low.set(new_low)
             params['canny_t_low'] = new_low
    
    # Thực hiện xử lý
    result_bgr = apply_sketch_effect(global_img_original, params)

    if result_bgr is not None:
        global_img_result = result_bgr
        # Hiển thị ảnh kết quả
        display_image(result_bgr, label_result, 'Kết quả Tranh Vẽ')
    else:
        label_result.config(image='', text="Lỗi xử lý ảnh")
        global_img_result = None

def display_image(img_bgr, label_widget, title):
    """Chuyển đổi ảnh OpenCV sang định dạng Tkinter và hiển thị."""
    
    # Chuyển BGR sang RGB
    img_rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
    
    # Resize ảnh cho vừa cửa sổ (tối đa 400x400)
    h, w = img_rgb.shape[:2]
    max_size = 400
    ratio = min(max_size / w, max_size / h)
    new_w, new_h = int(w * ratio), int(h * ratio)
    
    img_resized = cv2.resize(img_rgb, (new_w, new_h), interpolation=cv2.INTER_AREA)

    # Chuyển sang định dạng PIL Image và Tkinter PhotoImage
    img_pil = Image.fromarray(img_resized)
    img_tk = ImageTk.PhotoImage(img_pil)
    
    # Cập nhật Label
    label_widget.config(image=img_tk, text="")
    label_widget.image = img_tk
    label_widget.config(text=title, compound='top')

# --- CẤU TRÚC GIAO DIỆN (TKINTER) ---

app = tk.Tk()
app.title("Phần mềm Chuyển ảnh thành Tranh vẽ (Chương 5)")

# Khung điều khiển (Trái)
frame_controls = ttk.LabelFrame(app, text="Cài đặt Thuật toán", padding="10")
frame_controls.grid(row=0, column=0, padx=10, pady=10, sticky="n")

# Khung hiển thị (Phải)
frame_display = ttk.Frame(app, padding="10")
frame_display.grid(row=0, column=1, padx=10, pady=10, sticky="nsew")

# --- CONTROL WIDGETS ---

# 1. Nút Tải/Lưu
btn_open = ttk.Button(frame_controls, text="1. Tải Ảnh (Upload)", command=open_image)
btn_open.pack(fill='x', pady=5)

btn_save = ttk.Button(frame_controls, text="5. Lưu Ảnh (Download)", command=save_image)
btn_save.pack(fill='x', pady=5)

ttk.Separator(frame_controls, orient='horizontal').pack(fill='x', pady=10)

# 2. Lựa chọn Làm mịn (Smoothing)
ttk.Label(frame_controls, text="2. Kỹ thuật Làm mịn:").pack(anchor='w')
combo_smoothing = ttk.Combobox(frame_controls, values=['None', 'Bilateral', 'Gaussian'], state='readonly')
combo_smoothing.set('Bilateral') 
combo_smoothing.bind("<<ComboboxSelected>>", process_image)
combo_smoothing.pack(fill='x', pady=5)

# Tham số Làm mịn
ttk.Label(frame_controls, text="Kích thước/Bán kính Kernel (Sigma S):").pack(anchor='w', pady=(5, 0))
scale_sigma_s = ttk.Scale(frame_controls, from_=5, to=50, orient=tk.HORIZONTAL, command=process_image)
scale_sigma_s.set(15)
scale_sigma_s.pack(fill='x')

ttk.Label(frame_controls, text="Sigma Color/Tác động màu (Sigma R):").pack(anchor='w', pady=(5, 0))
scale_sigma_r = ttk.Scale(frame_controls, from_=10, to=150, orient=tk.HORIZONTAL, command=process_image)
scale_sigma_r.set(75)
scale_sigma_r.pack(fill='x')

ttk.Separator(frame_controls, orient='horizontal').pack(fill='x', pady=10)

# 3. Lựa chọn Phát hiện biên
ttk.Label(frame_controls, text="3. Phát hiện Biên:").pack(anchor='w')
combo_edge = ttk.Combobox(frame_controls, values=['Canny', 'Sobel', 'Laplacian'], state='readonly')
combo_edge.set('Canny') 
combo_edge.bind("<<ComboboxSelected>>", process_image)
combo_edge.pack(fill='x', pady=5)

# Tham số Canny (Ngưỡng kép)
ttk.Label(frame_controls, text="Ngưỡng Thấp (T_low - Canny):").pack(anchor='w', pady=(5, 0))
scale_canny_t_low = ttk.Scale(frame_controls, from_=1, to=250, orient=tk.HORIZONTAL, command=process_image)
scale_canny_t_low.set(50)
scale_canny_t_low.pack(fill='x')

ttk.Label(frame_controls, text="Ngưỡng Cao (T_high - Canny):").pack(anchor='w', pady=(5, 0))
scale_canny_t_high = ttk.Scale(frame_controls, from_=10, to=255, orient=tk.HORIZONTAL, command=process_image)
scale_canny_t_high.set(150)
scale_canny_t_high.pack(fill='x')

# --- DISPLAY WIDGETS ---

# Ảnh gốc
label_original = ttk.Label(frame_display, text="Ảnh Gốc\n(Tải ảnh để xem)", compound='top', relief='solid', width=60)
label_original.grid(row=0, column=0, padx=5, pady=5)

# Ảnh kết quả
label_result = ttk.Label(frame_display, text="Kết quả Tranh Vẽ\n(Chờ xử lý)", compound='top', relief='solid', width=60)
label_result.grid(row=0, column=1, padx=5, pady=5)

app.mainloop()