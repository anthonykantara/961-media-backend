#!/usr/bin/env python3
"""
Unit tests for Python Pillow Image Manipulation Engine.
"""

import unittest
import os
import shutil
import tempfile
from PIL import Image, ImageDraw, ImageFont, ImageEnhance

from src.engine.pillow_engine import (
    enhance_image,
    render_featured_image,
    render_carousel_deck,
    parse_and_wrap_text,
    upload_to_wasabi_and_get_cdn_urls,
    process_workflow,
    get_font,
    BRAND_RED,
    TEXT_WHITE
)


class TestPillowEngine(unittest.TestCase):

    def setUp(self):
        self.test_dir = tempfile.mkdtemp()

    def tearDown(self):
        shutil.rmtree(self.test_dir, ignore_errors=True)

    def test_enhancement_pass(self):
        """Tests contrast (+18%) and saturation (+15%) enhancement pass."""
        raw_img = Image.new("RGB", (400, 300), (100, 150, 200))
        enhanced = enhance_image(raw_img)

        self.assertEqual(enhanced.size, (400, 300))
        self.assertIn(enhanced.mode, ("RGB", "RGBA"))

        orig_pixel = raw_img.getpixel((50, 50))
        enh_pixel = enhanced.getpixel((50, 50))
        self.assertNotEqual(orig_pixel, enh_pixel)

    def test_bracket_parsing_and_text_wrapping(self):
        r"""Tests r"\[(.*?)\]" parsing for brand red highlights and white normal text."""
        img = Image.new("RGB", (1200, 630))
        draw = ImageDraw.Draw(img)
        font = get_font(48)
        max_width = 1000

        text = "Discover the [best rooftops] in Beirut this summer"
        lines, space_width = parse_and_wrap_text(text, font, draw, max_width)

        self.assertGreater(len(lines), 0)
        self.assertGreater(space_width, 0)

        all_words = [item for line in lines for item in line]
        red_words = [item["word"] for item in all_words if item["color"] == BRAND_RED]
        white_words = [item["word"] for item in all_words if item["color"] == TEXT_WHITE]

        self.assertIn("best", red_words)
        self.assertIn("rooftops", red_words)
        self.assertIn("Discover", white_words)
        self.assertIn("Beirut", white_words)

    def test_featured_image_rendering(self):
        """Tests 1200x630 featured image rendering (JPG format)."""
        base_img = Image.new("RGB", (800, 800), (100, 100, 100))
        headline = "Lebanon [Tech Sector] Booming in 2026"

        featured = render_featured_image(base_img, headline)

        self.assertEqual(featured.size, (1200, 630))
        self.assertEqual(featured.mode, "RGB")

        save_path = os.path.join(self.test_dir, "featured.jpg")
        featured.save(save_path, format="JPEG")
        self.assertTrue(os.path.exists(save_path))

        with Image.open(save_path) as reloaded:
            self.assertEqual(reloaded.size, (1200, 630))
            self.assertEqual(reloaded.format, "JPEG")

    def test_carousel_deck_rendering(self):
        """Tests 4 carousel slide images (1080x1350 PNG) with dark tint and arrows."""
        base_img = Image.new("RGB", (800, 800), (120, 120, 120))
        slides = [
            "Slide 1 with [highlight 1]",
            "Slide 2 with [highlight 2]",
            "Slide 3 with [highlight 3]",
            "Slide 4 with [highlight 4]"
        ]

        carousel_imgs = render_carousel_deck(base_img, slides)

        self.assertEqual(len(carousel_imgs), 4)

        for idx, slide_img in enumerate(carousel_imgs):
            self.assertEqual(slide_img.size, (1080, 1350))
            save_path = os.path.join(self.test_dir, f"carousel_{idx + 1}.png")
            slide_img.save(save_path, format="PNG")

            with Image.open(save_path) as reloaded:
                self.assertEqual(reloaded.size, (1080, 1350))
                self.assertEqual(reloaded.format, "PNG")

    def test_wasabi_and_cdn_urls(self):
        """Tests Wasabi storage path and Cloudflare CDN URL generation."""
        os.environ["CLOUDFLARE_CDN_URL"] = "https://cdn.961.co"
        local_files = {
            "featured": os.path.join(self.test_dir, "featured.jpg"),
            "carousel_1": os.path.join(self.test_dir, "carousel_1.png")
        }
        for p in local_files.values():
            with open(p, "w") as f:
                f.write("test")

        result = upload_to_wasabi_and_get_cdn_urls(local_files, "job-123")

        cdn_urls = result["cdn_urls"]
        storage_paths = result["storage_paths"]

        self.assertEqual(cdn_urls["featured"], "https://cdn.961.co/express-creation/job-123/featured.jpg")
        self.assertEqual(storage_paths["featured"], "express-creation/job-123/featured.jpg")

    def test_process_workflow_end_to_end(self):
        """Tests full process_workflow orchestration."""
        payload = {
            "job_id": "test-workflow-001",
            "headline": "Full [End-to-End] Test Headline",
            "carousel_slides": [
                "Slide 1 [highlight]",
                "Slide 2 [highlight]",
                "Slide 3 [highlight]",
                "Slide 4 [highlight]"
            ],
            "output_dir": self.test_dir
        }

        result = process_workflow(payload)

        self.assertEqual(result["status"], "success")
        self.assertEqual(result["job_id"], "test-workflow-001")
        self.assertEqual(result["featured_image"]["dimensions"], {"width": 1200, "height": 630})
        self.assertEqual(len(result["carousel_slides"]), 4)

        for i in range(1, 5):
            slide_info = result["carousel_slides"][i - 1]
            self.assertEqual(slide_info["slide"], i)
            self.assertEqual(slide_info["dimensions"], {"width": 1080, "height": 1350})
            self.assertTrue(os.path.exists(slide_info["local_path"]))


if __name__ == "__main__":
    unittest.main()
