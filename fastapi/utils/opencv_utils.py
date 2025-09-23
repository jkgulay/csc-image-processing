import numpy as np
import cv2
from dto.opencv_dto import FilterOptions , ApplyFilterRequest

def _apply_canny_overlay(
        img_bgr: np.ndarray,
        low_threshold: int = 100,
        high_threshold: int = 200,
        edge_color: tuple[int, int, int] = (0, 255, 0),
        alpha: float = 0.35,
        thickness: int = 1,
) -> np.ndarray:
    """
    Detect edges and overlay them on the original image to preserve brightness.
    - edge_color: BGR color used to draw edges
    - alpha: blend factor for overlay (0..1)
    - thickness: edge thickness (>=1). Uses dilation when >1.
    """
    gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
    edges = cv2.Canny(gray, low_threshold, high_threshold)

    if thickness > 1:
        k = max(1, int(thickness))
        if k % 2 == 0:
            k += 1
        edges = cv2.dilate(edges, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k, k)))

    overlay = img_bgr.copy()
    # Colorize edges on the overlay
    overlay[edges > 0] = edge_color

    # Blend overlay with original to keep image from turning dark
    blended = cv2.addWeighted(img_bgr, 1.0, overlay, alpha, 0.0)
    return blended


# ... existing code ...
def _apply_filters_cv2(img_bgr: np.ndarray, opts: FilterOptions) -> np.ndarray:
    out = img_bgr.copy()

    # Brightness/Contrast
    if opts.brightness is not None or opts.contrast is not None:
        # Map to alpha (contrast) and beta (brightness) for cv2.convertScaleAbs
        contrast = 1.0
        brightness = 0.0
        if opts.contrast is not None:
            # 50 => 1.0, 0 => 0.0, 100 => ~2.0
            contrast = (opts.contrast / 50.0)
        if opts.brightness is not None:
            # -50..+50 mapped from 0..100
            brightness = float(opts.brightness - 50)
        out = cv2.convertScaleAbs(out, alpha=contrast, beta=brightness)

    # Saturation
    if opts.saturation is not None:
        sat_scale = opts.saturation / 50.0  # 50 => 1.0
        hsv = cv2.cvtColor(out, cv2.COLOR_BGR2HSV).astype(np.float32)
        hsv[..., 1] = np.clip(hsv[..., 1] * sat_scale, 0, 255)
        out = cv2.cvtColor(hsv.astype(np.uint8), cv2.COLOR_HSV2BGR)

    # Vintage (simple sepia + slight desaturation)
    if opts.vintage:
        kernel = np.array([[0.272, 0.534, 0.131],
                           [0.349, 0.686, 0.168],
                           [0.393, 0.769, 0.189]])
        sepia = cv2.transform(out, kernel)
        sepia = np.clip(sepia, 0, 255).astype(np.uint8)
        out = cv2.addWeighted(out, 0.85, sepia, 0.15, 0)

    # Sharpen
    if opts.sharpen:
        k = np.array([[0, -1, 0],
                      [-1, 5, -1],
                      [0, -1, 0]])
        out = cv2.filter2D(out, -1, k)

    # Blur
    if opts.blur and opts.blur > 0:
        ksize = max(1, int(opts.blur))
        if ksize % 2 == 0:
            ksize += 1
        out = cv2.GaussianBlur(out, (ksize, ksize), 0)

    # Edge detection (Canny)
    if opts.edgeDetection:
        # Overlay colored edges instead of replacing the image to avoid dark output
        out = _apply_canny_overlay(
            out,
            low_threshold=100,
            high_threshold=200,
            edge_color=(0, 255, 0),  # bright green edges
            alpha=0.35,  # subtle overlay
            thickness=2,  # make edges visible
        )

    # Face detection (draw rectangles)
    if opts.faceDetection:
        try:
            gray = cv2.cvtColor(out, cv2.COLOR_BGR2GRAY)
            face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")
            faces = face_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(30, 30))
            for (x, y, w, h) in faces:
                cv2.rectangle(out, (x, y), (x + w, y + h), (0, 255, 0), 2)
        except Exception:
            # If classifier not available, skip silently
            pass

    return out

def _encode_image(img_bgr: np.ndarray, fmt: str) -> bytes:
    fmt = fmt.lower()
    ext = ".png"
    if fmt in ("jpg", "jpeg"):
        ext = ".jpg"
    elif fmt == "webp":
        ext = ".webp"
    success, buf = cv2.imencode(ext, img_bgr, [cv2.IMWRITE_JPEG_QUALITY, 90] if ext == ".jpg" else [])
    if not success:
        raise RuntimeError("Failed to encode processed image")
    return buf.tobytes()

def _guess_content_type(fmt: str) -> str:
    fmt = fmt.lower()
    if fmt in ("jpg", "jpeg"):
        return "image/jpeg"
    if fmt == "webp":
        return "image/webp"
    return "image/png"
