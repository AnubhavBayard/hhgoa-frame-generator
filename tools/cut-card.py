"""Cut the photo window out of the card art, keeping the wavy yellow border.

public/frame.jpg       the printed poster as-is — still the empty state
public/card-frame.png  the same art with the window punched transparent, so an
                       uploaded photo sits UNDER the wavy border instead of
                       inside it with a seam of printed green in between
"""
import sys
from PIL import Image, ImageDraw, ImageFilter
import numpy as np

SRC, OUT = sys.argv[1], sys.argv[2]

im = Image.open(SRC).convert('RGB')
W, H = im.size
a = np.asarray(im).astype(int)

# Flood the flat green inside the window. Starting point is well clear of the
# printed boat at the window's foot. Like the PFP cut, the flood tracks the wavy
# border exactly — no fitted rectangle follows those scallops.
flood = im.copy()
ImageDraw.floodfill(flood, (int(W * 0.5), int(H * 0.26)), (255, 0, 255), thresh=40)
hole = np.all(np.asarray(flood) == (255, 0, 255), axis=-1)
print('flood px', hole.sum())

# The boat is drawn over the window in a darker green, so the flood breaks
# around it. Close every row between its own extremes: the window is convex per
# row, so this fills the boat back in without touching anything outside.
ys, xs = np.nonzero(hole)
y0, y1, x0, x1 = ys.min(), ys.max(), xs.min(), xs.max()
for y in range(y0, y1 + 1):
    row = np.nonzero(hole[y])[0]
    if len(row):
        hole[y, row.min():row.max() + 1] = True
print('closed px', hole.sum(), 'bbox', x0, y0, x1 + 1, y1 + 1)

# Grow the cut a couple of pixels into the border. The photo then runs beneath
# the yellow rather than butting against it, which is what makes the two read as
# one piece instead of a photo dropped into a hole.
UNDER = 3
grown = Image.fromarray((hole * 255).astype('uint8')).filter(ImageFilter.MaxFilter(UNDER * 2 + 1))
hole = np.asarray(grown) > 127

# Feather by a pixel so the photo does not alias against the art.
alpha = Image.fromarray(np.where(hole, 0, 255).astype('uint8')).filter(ImageFilter.GaussianBlur(0.6))

cy, cx = np.nonzero(hole)
print('CUT bbox', cx.min(), cy.min(), cx.max() + 1, cy.max() + 1)
print('WINDOW fractions x,y,w,h:', [
    round(v, 4) for v in (
        cx.min() / W, cy.min() / H, (cx.max() + 1 - cx.min()) / W, (cy.max() + 1 - cy.min()) / H,
    )
])

rgba = np.dstack([a.astype('uint8'), np.asarray(alpha)])
rgba[rgba[:, :, 3] == 0, :3] = 0  # hidden pixels compress better flat
# The art is a handful of flat greens plus paper grain, so a 200-colour palette
# is lossless to the eye and takes the overlay from 1.7MB to a fraction of it.
out = Image.fromarray(rgba, 'RGBA').quantize(colors=200, method=Image.FASTOCTREE)
out.save(f'{OUT}/card-frame.png', optimize=True)
