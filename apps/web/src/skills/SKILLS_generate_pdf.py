import uuid
import requests
from fpdf import FPDF
from typing import List, Dict, Optional
from pathlib import Path
from PIL import Image, ImageDraw, ImageOps
from io import BytesIO

def generate_and_save_pdf(
    sections: List[Dict[str, Optional[str]]], 
    output_file: str = "report.pdf", 
    report_title: str = "PDF Report"
) -> None:
    """
    Function to generate a beautiful PDF report in A4 paper format. 

    :param sections: A list of sections where each section is represented by a dictionary containing:
                     - title: The title of the section.
                     - level: The heading level (e.g., "title", "h1", "h2").
                     - content: The content or body text of the section.
                     - image: (Optional) The URL or local path to the image.
    :param output_file: The name of the output PDF file. (default is "report.pdf")
    :param report_title: The title of the report. (default is "PDF Report")
    :return: None
    """

    def get_image(image_url_or_path):
        if image_url_or_path.startswith("http://") or image_url_or_path.startswith("https://"):
            response = requests.get(image_url_or_path)
            if response.status_code == 200:
                return BytesIO(response.content)
        elif Path(image_url_or_path).is_file():
            return open(image_url_or_path, 'rb')
        return None

    def add_rounded_corners(img, radius=6):
        mask = Image.new('L', img.size, 0)
        draw = ImageDraw.Draw(mask)
        draw.rounded_rectangle([(0, 0), img.size], radius, fill=255)
        img = ImageOps.fit(img, mask.size, centering=(0.5, 0.5))
        img.putalpha(mask)
        return img

    class PDF(FPDF):
        def header(self):
            self.set_font("Arial", "B", 12)
            self.cell(0, 10, report_title, 0, 1, "C")
            
        def chapter_title(self, txt): 
            self.set_font("Arial", "B", 12)
            self.cell(0, 10, txt, 0, 1, "L")
            self.ln(2)
        
        def chapter_body(self, body):
            self.set_font("Arial", "", 12)
            self.multi_cell(0, 10, body)
            self.ln()

        def add_image(self, img_data):
            img = Image.open(img_data)
            img = add_rounded_corners(img)
            img_path = Path(f"temp_{uuid.uuid4().hex}.png")
            img.save(img_path, format="PNG")
            self.image(str(img_path), x=None, y=None, w=190 if img.width > 190 else img.width)
            self.ln(10)
            img_path.unlink()

    pdf = PDF()
    pdf.add_page()
    font_size = {"title": 16, "h1": 14, "h2": 12, "body": 12}

    for section in sections:
        title, level, content, image = section.get("title", ""), section.get("level", "h1"), section.get("content", ""), section.get("image")
        pdf.set_font("Arial", "B" if level in font_size else "", font_size.get(level, font_size["body"]))
        pdf.chapter_title(title)

        if content: pdf.chapter_body(content)
        if image:
            img_data = get_image(image)
            if img_data:
                pdf.add_image(img_data)
                if isinstance(img_data, BytesIO):
                    img_data.close()

    pdf.output(output_file)
    print(f"PDF report saved as {output_file}")