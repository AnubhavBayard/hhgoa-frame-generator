"""Cut the photo well out of the PFP frame, keeping the HACKER HOUSE sticker.

public/pfp-back.jpg  the printed frame as-is — the empty state, avatar and all
public/pfp-frame.png the same art with the well punched transparent, so an
                     uploaded photo sits under the sticker
"""
import sys
from PIL import Image, ImageDraw, ImageFilter
import numpy as np

SRC, OUT, SIZE = sys.argv[1], sys.argv[2], 1000

im = Image.open(SRC).convert('RGB').resize((SIZE, SIZE), Image.LANCZOS)
a = np.asarray(im).astype(int)

# 1. The well: flood the flat dark green from a point beside the head. This
# tracks the wavy inner border exactly, which no fitted shape would.
flood = im.copy()
ImageDraw.floodfill(flood, (int(SIZE * 0.35), SIZE // 2), (255, 0, 255), thresh=42)
well = np.all(np.asarray(flood) == (255, 0, 255), axis=-1)
ys, xs = np.nonzero(well)
print('well px', well.sum(), 'x', xs.min(), xs.max(), 'y', ys.min(), ys.max())

# 2. The sticker is the only white in the art. Its rounded box is what has to
# survive the cut — the photo goes behind it.
lum = a.sum(2) / 3
wy, wx = np.nonzero(lum > 190)
print('sticker box x', wx.min(), wx.max(), 'y', wy.min(), wy.max())
# The sticker is a rotated rounded rectangle — convex — so the hull of its face
# is the sticker itself. A bounding box would keep a slab of background green and
# a slice of the old avatar's shoulder; flood-filling leaks out through the gap
# the गोवा badge opens in the rim, and out along the yellow rim itself, which
# touches the ring the sticker overlaps.
#
# The face is the white lettering plus the panel green behind it. The panel is
# the only green in the art with any blue in it — the well and the tapa band are
# both flat olive — so that one channel separates it from everything around it.
r, g, b = a[:, :, 0], a[:, :, 1], a[:, :, 2]
# g > b as well as g > r, or the avatar's shadowed grey-blue shirt joins in.
panel = (b > 30) & (g > r + 10) & (g > b + 8) & (r < 140)
near = np.zeros((SIZE, SIZE), bool)
near[wy.min() - 40:wy.max() + 40, wx.min() - 40:wx.max() + 40] = True
face = Image.fromarray(((near & (panel | (lum > 190))) * 255).astype('uint8'))
# A convex hull is only as good as its worst outlier: a single speck of tapa
# pattern 30px to the right drags the whole edge with it. Erode the specks off.
face = face.filter(ImageFilter.MinFilter(3))
fy, fx = np.nonzero(np.asarray(face) > 127)
print('face px', len(fx), 'x', fx.min(), fx.max(), 'y', fy.min(), fy.max())
def hull(points):
    pts = sorted(set(points))
    def half(seq):
        out = []
        for p in seq:
            while len(out) > 1:
                (ax, ay), (bx, by) = out[-2], out[-1]
                if (bx - ax) * (p[1] - ay) - (by - ay) * (p[0] - ax) > 0:
                    break
                out.pop()
            out.append(p)
        return out[:-1]
    return half(pts) + half(pts[::-1])


poly = hull(list(zip(fx.tolist(), fy.tolist())))
# Push the hull out past the face: the yellow rim (~9px) and its drop shadow sit
# outside the panel, and cutting through them is what strips the sticker's border
# once a photo is behind it.
cx0 = sum(p[0] for p in poly) / len(poly)
cy0 = sum(p[1] for p in poly) / len(poly)
RIM = 13
grown = []
for px, py in poly:
    dx, dy = px - cx0, py - cy0
    d = max((dx * dx + dy * dy) ** 0.5, 1e-6)
    grown.append((px + dx / d * RIM, py + dy / d * RIM))

def filled(points):
    m = Image.new('L', (SIZE, SIZE), 0)
    ImageDraw.Draw(m).polygon(points, fill=255)
    return np.asarray(m) > 127


# Radial growth overshoots at the rounded corners, where it grabs a patch of the
# avatar's shoulder. Nothing inside the face is touched; in the added band, drop
# what is skin or shirt. Blue tells them from the rim: the yellow has none.
band = filled(grown) & ~filled(poly)
avatar = ((r > g + 18) | (b > g + 5)) & (b > 45) & (lum < 235)
sticker = filled(grown) & ~(band & avatar)
print('sticker px', sticker.sum(), 'dropped from band', (band & avatar).sum())

# 3. The avatar silhouette is not part of the flood (it is drawn over the well),
# so union in an ellipse inset from the well's own bounds to sweep it up.
inset = 6
oval = Image.new('L', (SIZE, SIZE), 0)
ImageDraw.Draw(oval).ellipse(
    [xs.min() + inset, ys.min() + inset, xs.max() - inset, ys.max() - inset], fill=255
)
cut = (well | (np.asarray(oval) > 127)) & ~sticker

# Feather the cut edge by one pixel so the photo does not alias against the art.
alpha = Image.fromarray(np.where(cut, 0, 255).astype('uint8')).filter(ImageFilter.GaussianBlur(0.6))

cy, cx = np.nonzero(cut)
print('CUT bbox', cx.min(), cy.min(), cx.max() + 1, cy.max() + 1)
print('fractions', [round(v / SIZE, 4) for v in (cx.min(), cy.min(), cx.max() + 1 - cx.min(), cy.max() + 1 - cy.min())])

rgba = np.dstack([a.astype('uint8'), np.asarray(alpha)])
rgba[rgba[:, :, 3] == 0, :3] = 0  # hidden pixels compress better flat
# The art is a handful of flat greens, so 200 colours is lossless to the eye and
# takes the overlay from 1.3MB to 140KB.
out = Image.fromarray(rgba, 'RGBA').quantize(colors=200, method=Image.FASTOCTREE)
out.save(f'{OUT}/pfp-frame.png', optimize=True)
im.save(f'{OUT}/pfp-back.jpg', quality=92, optimize=True)
