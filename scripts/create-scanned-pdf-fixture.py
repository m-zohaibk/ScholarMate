from PIL import Image, ImageDraw

image = Image.new('RGB', (1600, 2200), 'white')
draw = ImageDraw.Draw(image)
draw.text((120, 180), 'ScholarMate OCR Test', fill='black')
draw.text((120, 300), 'Photosynthesis converts light energy into chemical energy.', fill='black')
draw.text((120, 420), 'Chlorophyll absorbs sunlight in plant cells.', fill='black')
image.save('/tmp/scholarmate-scanned-fixture.pdf', 'PDF', resolution=150.0)
