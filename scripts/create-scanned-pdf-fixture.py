from pathlib import Path
from PIL import Image, ImageDraw
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas

image = Image.new('RGB', (1600, 2200), 'white')
draw = ImageDraw.Draw(image)
draw.text((120, 180), 'ScholarMate OCR Test', fill='black')
draw.text((120, 300), 'Photosynthesis converts light energy into chemical energy.', fill='black')
draw.text((120, 420), 'Chlorophyll absorbs sunlight in plant cells.', fill='black')
image_path = Path('/tmp/scholarmate-scanned-fixture.png')
pdf_path = Path('/tmp/scholarmate-scanned-fixture.pdf')
image.save(image_path, 'PNG')
pdf = canvas.Canvas(str(pdf_path), pagesize=(612, 792))
pdf.drawImage(ImageReader(str(image_path)), 0, 0, width=612, height=792, preserveAspectRatio=True, mask='auto')
pdf.showPage()
pdf.save()
