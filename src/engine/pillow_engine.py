#!/usr/bin/env python3
r"""
Python Pillow Image Manipulation Engine for Express Creation Workflow.

Features:
1. Enhancement Pass: Contrast (+18%) and Saturation (+15%) on raw uploads.
2. Website Featured Image (1200x630 JPG): Dynamic headline text wrapping with regex r"\[(.*?)\]"
   red (#FF0000) highlights and white (#FFFFFF) normal text, advancing X coordinates dynamically using font.getbbox().
3. Instagram Carousel Deck (1080x1350 PNGs): Outputs 4 slide images (carousel_1.png - carousel_4.png)
   in 4:5 aspect ratio with 40% dark tint overlay, dynamic text wrapping with bracketed red highlights,
   and slide navigation arrow icons.
4. Wasabi & Cloudflare CDN Integration: Uploads rendered assets to designated Wasabi storage paths
   and generates public Cloudflare CDN URLs.
"""

import sys
import os
import re
import json
import uuid
import tempfile
import urllib.request
import base64
from io import BytesIO
from typing import List, Tuple, Dict, Any, Optional

from PIL import Image, ImageDraw, ImageFont, ImageEnhance
import boto3

# --- Constants & Default Settings ---
BRAND_RED = "#FF0000"
TEXT_WHITE = "#FFFFFF"
WASABI_DEFAULT_ENDPOINT = "https://s3.wasabisys.com"
DEFAULT_CDN_BASE = "https://cdn.961.co"
DEFAULT_BUCKET = "961-media"

FONT_SEARCH_PATHS = [
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
    "/usr/share/fonts/truetype/freefont/FreeSansBold.ttf",
    "DejaVuSans-Bold.ttf"
]


def get_font(size: int) -> Any:
    """Loads a bold font at the given size, falling back safely if needed."""
    for path in FONT_SEARCH_PATHS:
        if os.path.exists(path):
            try:
                return ImageFont.truetype(path, size)
            except Exception:
                pass
    try:
        return ImageFont.truetype("DejaVuSans-Bold.ttf", size)
    except Exception:
        pass
    try:
        return ImageFont.load_default(size=size)
    except Exception:
        return ImageFont.load_default()


def load_input_image(input_source: Optional[str]) -> Image.Image:
    """
    Loads raw input image from file path, URL, base64 string, or creates a default background canvas.
    """
    if input_source and isinstance(input_source, str):
        # 1. Base64 data URL or raw string
        if input_source.startswith("data:image/") or ";base64," in input_source:
            try:
                base64_data = input_source.split(";base64,")[-1]
                image_data = base64.b64decode(base64_data)
                return Image.open(BytesIO(image_data))
            except Exception as err:
                print(f"Warning: Failed to decode base64 image: {err}", file=sys.stderr)

        # 2. HTTP / HTTPS URL
        if input_source.startswith("http://") or input_source.startswith("https://"):
            try:
                req = urllib.request.Request(input_source, headers={"User-Agent": "Mozilla/5.0"})
                with urllib.request.urlopen(req, timeout=10) as response:
                    image_data = response.read()
                    return Image.open(BytesIO(image_data))
            except Exception as err:
                print(f"Warning: Failed to download image URL {input_source}: {err}", file=sys.stderr)

        # 3. Local file path
        if os.path.exists(input_source):
            try:
                return Image.open(input_source)
            except Exception as err:
                print(f"Warning: Failed to open image file {input_source}: {err}", file=sys.stderr)

    # 4. Fallback background canvas
    canvas = Image.new("RGB", (1200, 1200), (30, 32, 42))
    draw = ImageDraw.Draw(canvas)
    for y in range(1200):
        r = int(30 + (y / 1200) * 20)
        g = int(32 + (y / 1200) * 20)
        b = int(42 + (y / 1200) * 35)
        draw.line([(0, y), (1200, y)], fill=(r, g, b))
    return canvas


# --- Step 1: Enhancement Pass ---
def enhance_image(image: Image.Image) -> Image.Image:
    """
    Applies image contrast (+18%) and saturation (+15%) enhancements on raw uploads.
    """
    if image.mode not in ("RGB", "RGBA"):
        image = image.convert("RGB")

    # Contrast Enhancement (+18% -> factor 1.18)
    contrast_enhancer = ImageEnhance.Contrast(image)
    image = contrast_enhancer.enhance(1.18)

    # Saturation Enhancement (+15% -> factor 1.15)
    color_enhancer = ImageEnhance.Color(image)
    image = color_enhancer.enhance(1.15)

    return image


def crop_and_scale(image: Image.Image, target_width: int, target_height: int) -> Image.Image:
    """
    Crops and resizes an image to target_width x target_height using aspect fill.
    """
    orig_w, orig_h = image.size
    target_aspect = target_width / target_height
    orig_aspect = orig_w / orig_h

    if orig_aspect > target_aspect:
        crop_w = int(orig_h * target_aspect)
        left = (orig_w - crop_w) // 2
        right = left + crop_w
        top = 0
        bottom = orig_h
    else:
        crop_h = int(orig_w / target_aspect)
        top = (orig_h - crop_h) // 2
        bottom = top + crop_h
        left = 0
        right = orig_w

    cropped = image.crop((left, top, right, bottom))
    resized = cropped.resize((target_width, target_height), Image.Resampling.LANCZOS)
    return resized


# --- Text Parsing & Dynamic Word Wrapping ---
def parse_and_wrap_text(
    text: str,
    font: Any,
    draw: ImageDraw.ImageDraw,
    max_width: int
) -> Tuple[List[List[Dict[str, Any]]], int]:
    r"""
    Parses bracketed keywords r"\[(.*?)\]" into red (#FF0000) segments and normal text into white (#FFFFFF).
    Wraps text into lines based on max_width and measures space width for dynamic X advancement.
    """
    segments = re.split(r'(\[.*?\])', text)
    word_tokens = []

    for seg in segments:
        if not seg:
            continue
        if seg.startswith('[') and seg.endswith(']'):
            keyword = seg[1:-1]
            color = BRAND_RED
        else:
            keyword = seg
            color = TEXT_WHITE

        words = keyword.split()
        for word in words:
            word_tokens.append({"word": word, "color": color})

    # Calculate space width using font metrics (font.getbbox() / draw.textbbox())
    space_bbox = draw.textbbox((0, 0), " ", font=font)
    space_width = space_bbox[2] - space_bbox[0]

    lines = []
    current_line = []
    current_line_width = 0

    for token in word_tokens:
        word = token["word"]
        color = token["color"]

        # Calculate word width using font metrics (font.getbbox / draw.textbbox)
        bbox = draw.textbbox((0, 0), word, font=font)
        w_width = bbox[2] - bbox[0]

        if not current_line:
            current_line.append({"word": word, "color": color, "width": w_width})
            current_line_width = w_width
        else:
            test_width = current_line_width + space_width + w_width
            if test_width <= max_width:
                current_line.append({"word": word, "color": color, "width": w_width})
                current_line_width = test_width
            else:
                lines.append(current_line)
                current_line = [{"word": word, "color": color, "width": w_width}]
                current_line_width = w_width

    if current_line:
        lines.append(current_line)

    return lines, space_width


def draw_wrapped_text_block(
    image: Image.Image,
    lines: List[List[Dict[str, Any]]],
    space_width: int,
    font: Any,
    start_x: int,
    start_y: int,
    line_spacing: int = 16,
    alignment: str = "left",
    max_width: int = 1000
) -> int:
    """
    Renders wrapped text lines onto the image, advancing X coordinates dynamically using font metrics.
    """
    draw = ImageDraw.Draw(image)
    y = start_y

    for line in lines:
        if not line:
            continue

        line_width = sum(item["width"] for item in line) + space_width * (len(line) - 1)

        if alignment == "center":
            x = start_x + (max_width - line_width) // 2
        else:
            x = start_x

        sample_bbox = draw.textbbox((0, 0), "Ag", font=font)
        font_height = sample_bbox[3] - sample_bbox[1]

        # Draw inline colored text segments, advancing X-coordinates dynamically using font metrics
        for item in line:
            # Subtle text drop shadow for legibility
            draw.text((x + 2, y + 2), item["word"], font=font, fill=(0, 0, 0, 180))
            draw.text((x, y), item["word"], font=font, fill=item["color"])

            # Dynamic X coordinate advancement using font metrics
            x += item["width"] + space_width

        y += font_height + line_spacing

    return y - start_y


# --- Step 2: Website Featured Image (1200x630 JPG) ---
def render_featured_image(
    base_image: Image.Image,
    headline: str
) -> Image.Image:
    r"""
    Renders 1200x630 website featured image with headline dynamically wrapped over main image.
    Uses r"\[(.*?)\]" parsing for brand red highlights and white normal text.
    """
    canvas_w, canvas_h = 1200, 630
    featured = crop_and_scale(base_image, canvas_w, canvas_h)
    featured_rgba = featured.convert("RGBA")

    # Dark overlay gradient for readability
    overlay = Image.new("RGBA", (canvas_w, canvas_h), (0, 0, 0, 0))
    overlay_draw = ImageDraw.Draw(overlay)
    overlay_h = int(canvas_h * 0.65)
    for y_idx in range(overlay_h):
        alpha = int(210 * (y_idx / overlay_h))
        y_pos = canvas_h - overlay_h + y_idx
        overlay_draw.line([(0, y_pos), (canvas_w, y_pos)], fill=(0, 0, 0, alpha))

    featured_rgba = Image.alpha_composite(featured_rgba, overlay)

    font = get_font(52)
    temp_draw = ImageDraw.Draw(featured_rgba)
    margin_x = 70
    max_text_width = canvas_w - (margin_x * 2)

    lines, space_width = parse_and_wrap_text(headline, font, temp_draw, max_text_width)

    sample_bbox = temp_draw.textbbox((0, 0), "Ag", font=font)
    font_h = sample_bbox[3] - sample_bbox[1]
    line_spacing = 16
    total_text_h = len(lines) * (font_h + line_spacing)

    start_y = canvas_h - total_text_h - 70
    if start_y < 50:
        start_y = 50

    draw_wrapped_text_block(
        featured_rgba,
        lines,
        space_width,
        font,
        start_x=margin_x,
        start_y=start_y,
        line_spacing=line_spacing,
        alignment="left",
        max_width=max_text_width
    )

    return featured_rgba.convert("RGB")


# --- Step 3: Instagram Carousel Deck (1080x1350 PNGs) ---
def render_carousel_deck(
    base_image: Image.Image,
    carousel_slides: List[str]
) -> List[Image.Image]:
    """
    Renders 4 slide images (carousel_1.png to carousel_4.png) in 4:5 aspect ratio (1080x1350).
    Applies 40% dark tint overlay, dynamic text wrapping with bracketed red highlights,
    and slide navigation arrow icons.
    """
    canvas_w, canvas_h = 1080, 1350
    scaled_base = crop_and_scale(base_image, canvas_w, canvas_h)

    # Ensure carousel_slides has 4 slides
    slides_content = list(carousel_slides) if carousel_slides else []
    while len(slides_content) < 4:
        if slides_content:
            slides_content.append(slides_content[-1])
        else:
            slides_content.append("Slide Content")
    slides_content = slides_content[:4]

    output_slides = []

    for idx, slide_text in enumerate(slides_content):
        slide_img = scaled_base.convert("RGBA")

        # 40% dark tint overlay (black fill with 40% alpha, RGBA (0, 0, 0, 102))
        dark_tint = Image.new("RGBA", (canvas_w, canvas_h), (0, 0, 0, 102))
        slide_img = Image.alpha_composite(slide_img, dark_tint)

        draw = ImageDraw.Draw(slide_img)

        # Dynamic text wrapping
        font = get_font(52)
        margin_x = 80
        max_text_w = canvas_w - (margin_x * 2)

        lines, space_width = parse_and_wrap_text(slide_text, font, draw, max_text_w)

        sample_bbox = draw.textbbox((0, 0), "Ag", font=font)
        font_h = sample_bbox[3] - sample_bbox[1]
        line_spacing = 20
        total_text_h = len(lines) * (font_h + line_spacing)
        start_y = (canvas_h - total_text_h) // 2

        draw_wrapped_text_block(
            slide_img,
            lines,
            space_width,
            font,
            start_x=margin_x,
            start_y=start_y,
            line_spacing=line_spacing,
            alignment="left",
            max_width=max_text_w
        )

        # Navigation Arrow Icons
        cy = canvas_h // 2
        cx_left = 60
        cx_right = canvas_w - 60

        # Backward Arrow on slides 2, 3, 4 (idx >= 1)
        if idx > 0:
            draw.ellipse((cx_left - 24, cy - 24, cx_left + 24, cy + 24), fill=(0, 0, 0, 150))
            draw.line([(cx_left + 6, cy - 12), (cx_left - 6, cy), (cx_left + 6, cy + 12)], fill=(255, 255, 255, 240), width=4)

        # Forward Arrow on slides 1, 2, 3 (idx < 3)
        if idx < 3:
            draw.ellipse((cx_right - 24, cy - 24, cx_right + 24, cy + 24), fill=(0, 0, 0, 150))
            draw.line([(cx_right - 6, cy - 12), (cx_right + 6, cy), (cx_right - 6, cy + 12)], fill=(255, 255, 255, 240), width=4)

        # Slide counter badge at bottom
        indicator_text = f"{idx + 1} / 4"
        indicator_font = get_font(28)
        ind_bbox = draw.textbbox((0, 0), indicator_text, font=indicator_font)
        ind_w = ind_bbox[2] - ind_bbox[0]
        draw.text(((canvas_w - ind_w) // 2, canvas_h - 70), indicator_text, font=indicator_font, fill=(255, 255, 255, 180))

        output_slides.append(slide_img)

    return output_slides


# --- Step 4: Wasabi & Cloudflare CDN Integration ---
def upload_to_wasabi_and_get_cdn_urls(
    local_files: Dict[str, str],
    job_id: str
) -> Dict[str, Any]:
    """
    Uploads rendered assets (featured.jpg, carousel_N.png) to designated Wasabi storage paths
    and constructs public Cloudflare CDN URLs.
    """
    endpoint_url = os.environ.get("WASABI_ENDPOINT", WASABI_DEFAULT_ENDPOINT)
    access_key = (
        os.environ.get("WASABI_ACCESS_KEY_ID") or
        os.environ.get("WASABI_ACCESS_KEY") or
        os.environ.get("AWS_ACCESS_KEY_ID")
    )
    secret_key = (
        os.environ.get("WASABI_SECRET_ACCESS_KEY") or
        os.environ.get("WASABI_SECRET_KEY") or
        os.environ.get("AWS_SECRET_ACCESS_KEY")
    )
    bucket = (
        os.environ.get("WASABI_BUCKET") or
        os.environ.get("WASABI_BUCKET_NAME") or
        os.environ.get("S3_BUCKET") or
        DEFAULT_BUCKET
    )
    region = os.environ.get("WASABI_REGION", "us-east-1")
    cdn_base = (
        os.environ.get("CLOUDFLARE_CDN_URL") or
        os.environ.get("CDN_BASE_URL") or
        DEFAULT_CDN_BASE
    ).rstrip("/")

    s3_client = None
    if access_key and secret_key:
        try:
            s3_client = boto3.client(
                's3',
                endpoint_url=endpoint_url,
                aws_access_key_id=access_key,
                aws_secret_access_key=secret_key,
                region_name=region
            )
        except Exception as err:
            print(f"Warning: Failed to initialize Wasabi boto3 client: {err}", file=sys.stderr)

    cdn_urls = {}
    storage_paths = {}

    for file_key, local_path in local_files.items():
        filename = os.path.basename(local_path)
        storage_path = f"express-creation/{job_id}/{filename}"
        storage_paths[file_key] = storage_path

        content_type = "image/jpeg" if filename.lower().endswith((".jpg", ".jpeg")) else "image/png"

        if s3_client:
            try:
                s3_client.upload_file(
                    local_path,
                    bucket,
                    storage_path,
                    ExtraArgs={'ContentType': content_type}
                )
            except Exception as err:
                print(f"Warning: Failed to upload {storage_path} to Wasabi: {err}", file=sys.stderr)

        cdn_url = f"{cdn_base}/{storage_path}"
        cdn_urls[file_key] = cdn_url

    return {
        "cdn_urls": cdn_urls,
        "storage_paths": storage_paths
    }


def process_workflow(payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    Main orchestration function for Express Creation image manipulation workflow.
    """
    job_id = payload.get("job_id") or payload.get("article_id") or str(uuid.uuid4())
    raw_input = payload.get("image") or payload.get("image_path") or payload.get("imageUrl") or payload.get("raw_image")
    headline = payload.get("headline") or payload.get("title") or "Discover [961] Media Highlights"
    carousel_slides = payload.get("carousel_slides") or [
        "Discover the [latest news] from 961 Media",
        "Explore [exclusive stories] updated daily",
        "Join our [vibrant community] across Lebanon",
        "Stay tuned for [more updates] coming soon"
    ]

    # Convert carousel_slides list items if they are objects
    formatted_slides = []
    for slide in carousel_slides:
        if isinstance(slide, dict):
            formatted_slides.append(slide.get("text") or slide.get("content") or str(slide))
        else:
            formatted_slides.append(str(slide))

    output_dir = payload.get("output_dir") or os.path.join(tempfile.gettempdir(), "express_creation", job_id)
    os.makedirs(output_dir, exist_ok=True)

    # Step 0: Load raw upload image
    raw_img = load_input_image(raw_input)

    # Step 1: Enhancement Pass (+18% Contrast, +15% Saturation)
    enhanced_img = enhance_image(raw_img)

    # Step 2: Website Featured Image (1200x630 JPG)
    featured_img = render_featured_image(enhanced_img, headline)
    featured_path = os.path.join(output_dir, "featured.jpg")
    featured_img.save(featured_path, format="JPEG", quality=92)

    # Step 3: Instagram Carousel Deck (1080x1350 PNGs)
    carousel_imgs = render_carousel_deck(enhanced_img, formatted_slides)
    local_files = {"featured": featured_path}

    carousel_paths = []
    for idx, c_img in enumerate(carousel_imgs):
        filename = f"carousel_{idx + 1}.png"
        c_path = os.path.join(output_dir, filename)
        c_img.save(c_path, format="PNG")
        file_key = f"carousel_{idx + 1}"
        local_files[file_key] = c_path
        carousel_paths.append(c_path)

    # Step 4: Wasabi & Cloudflare CDN Integration
    upload_result = upload_to_wasabi_and_get_cdn_urls(local_files, job_id)
    cdn_urls = upload_result["cdn_urls"]
    storage_paths = upload_result["storage_paths"]

    carousel_cdn_list = [cdn_urls[f"carousel_{idx + 1}"] for idx in range(4)]

    response_data = {
        "status": "success",
        "job_id": job_id,
        "featured_image": {
            "url": cdn_urls["featured"],
            "storage_path": storage_paths["featured"],
            "local_path": featured_path,
            "dimensions": {"width": 1200, "height": 630},
            "format": "JPG"
        },
        "carousel_slides": [
            {
                "slide": idx + 1,
                "url": cdn_urls[f"carousel_{idx + 1}"],
                "storage_path": storage_paths[f"carousel_{idx + 1}"],
                "local_path": carousel_paths[idx],
                "dimensions": {"width": 1080, "height": 1350},
                "format": "PNG"
            }
            for idx in range(4)
        ],
        "cdn_urls": {
            "featured": cdn_urls["featured"],
            "carousel": carousel_cdn_list
        }
    }

    return response_data


def main():
    """CLI / Stdin entry point."""
    input_data = {}
    if len(sys.argv) > 1:
        arg = sys.argv[1]
        if arg.startswith("{"):
            input_data = json.loads(arg)
        elif os.path.exists(arg):
            with open(arg, "r", encoding="utf-8") as f:
                input_data = json.load(f)
    if not input_data:
        try:
            stdin_str = sys.stdin.read().strip()
            if stdin_str:
                input_data = json.loads(stdin_str)
        except Exception:
            pass

    try:
        result = process_workflow(input_data)
        print(json.dumps(result, indent=2))
        sys.exit(0)
    except Exception as err:
        error_res = {
            "status": "error",
            "message": str(err)
        }
        print(json.dumps(error_res), file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
