# 菜单正式素材 · v1

使用内置 image_gen 工具，参考已有游戏界面和顾客图集生成。未替换旧图集，也未对原 PNG 做破坏性处理。PNG 保留原始透明度；物件由 CSS 裁切显示，中文字仍由 HTML 渲染。

## 文件和接入

| 文件 | 尺寸 | 内容 / 用途 |
| --- | --- | --- |
| seaside-backdrop-v1.png | 1024 × 1536，RGB | 海边菜单背景 |
| cat-chef-expressions-v1.png | 1254 × 1254，RGBA | 2 × 2：待机、眨眼、开心、试吃 |
| shop-parts-v1.png | 1254 × 1254，RGBA | 2 × 2：店铺后景、柜台、餐盘、茶杯 |
| shop-details-v1.png | 1254 × 1254，RGBA | 2 × 2：唱片、爱心、星光、空白吊牌 |

猫咪使用 627 × 627 等大帧，保持原始图集坐标；其他物件根据实际不透明内容设独立裁切框，定义见 menu-art.css。背景与物件分层，按钮、关卡选择和文字可独立交互。

## 生成提示词

### seaside-backdrop-v1

参考（仅作角色/风格参考，不是修改目标）：`/tmp/sushi-menu-qa.wWDYr7/home-390.png`

```text
Use case: stylized-concept. Production-ready 2D raster assets for the portrait casual sushi puzzle game shown in the reference. Match its simple cute hand-drawn shapes, warm medium-brown outline, buttery cream, muted coral, mint and pale turquoise palette. Flat matte color with at most ONE simple shadow shape; absolutely no realistic materials, no wood grain, no paper grain, no glossy 3D, no intricate detail, no text, no watermark. Readable at small mobile-game sizes.
Asset type: portrait game menu background, 1024 x 1536 preferred.
Input image 1 is a composition and palette REFERENCE, not an edit target. Generate only the empty seaside backdrop; do NOT copy interface, store, text, animals, food or buttons.
Composition: soft mint sky in upper 42%, a very simple distant turquoise sea band in middle 35%, a gently curved cream sand foreground filling bottom 35%. Two flat fluffy cream clouds near side edges, a soft pale yellow sun partly near upper-right edge, two very small gull strokes well off-center, a few broad rounded sea ripples. Keep central 70% extremely quiet and low contrast for an independently layered sushi shop, with empty sky for a title. The lower cream sand must be nearly blank for interactive controls. No horizon detail, no buildings, no rocks, no trees, no text or frames. Friendly bold low-detail children's casual game painting, opaque background, vertical canvas.
```

### cat-chef-expressions-v1

参考（仅作角色/风格参考，不是修改目标）：`assets/customer-atlas-v1.png`

```text
Use case: stylized-concept. Production-ready 2D raster assets for the portrait casual sushi puzzle game shown in the reference. Match its simple cute hand-drawn shapes, warm medium-brown outline, buttery cream, muted coral, mint and pale turquoise palette. Flat matte color with at most ONE simple shadow shape; absolutely no realistic materials, no wood grain, no paper grain, no glossy 3D, no intricate detail, no text, no watermark. Readable at small mobile-game sizes.
Asset type: transparent character expression sprite atlas. One square PNG 1024x1024 preferred, EXACT 2 columns and 2 rows, four equal invisible square cells, each same scale and identical character head/torso registration. Every sprite entirely inside its own cell with 10% padding. REAL alpha transparency around sprites, no background whatsoever, no visible grid or labels.
Input image 1 is the established CHARACTER IDENTITY reference: use ONLY the cream cat in its middle, keep warm brown contour, coral bow on the viewer's right ear, tiny pink nose and cheeks, two little cream paws at chest height. The otter and duck must not appear. Keep exactly the cat's identity and proportions, simplified flat colors. No legs, accessories or added costume. The same cat bust front-facing in ALL four cells, head centered at same pixel position, torso and paws stay aligned.
Top-left: relaxed idle, eyes OPEN friendly black rounded eyes, small smiling mouth, paws together.
Top-right: blinking, eyes gently CLOSED, same small smile, paws same position.
Bottom-left: delighted, cheerful closed crescent eyes, happy open smiling mouth, paws slightly lifted.
Bottom-right: nibbling, eyes closed contentedly, round puffed cheeks, tiny mouth, paws hold one tiny salmon nigiri immediately below mouth.
Keep silhouettes consistent for swapping frames without jumping; no giant floating hearts or background props; all parts fully visible.
```

### shop-parts-v1

参考（仅作角色/风格参考，不是修改目标）：`/tmp/sushi-menu-qa.wWDYr7/home-390.png`

```text
Use case: stylized-concept. Production-ready 2D raster assets for the portrait casual sushi puzzle game shown in the reference. Match its simple cute hand-drawn shapes, warm medium-brown outline, buttery cream, muted coral, mint and pale turquoise palette. Flat matte color with at most ONE simple shadow shape; absolutely no realistic materials, no wood grain, no paper grain, no glossy 3D, no intricate detail, no text, no watermark. Readable at small mobile-game sizes.
Asset type: transparent environment-part sprite sheet, four independently layerable pieces. Square PNG 1024x1024 preferred, exact 2 columns x 2 rows equal invisible cells. All outside each piece genuinely alpha-transparent, no grid, no labels. In each cell keep the object centered and completely inside a 10% transparent margin. Style reference is the provided existing menu screenshot. Draw these FOUR assets separately, NOT assembled into a full scene:
TOP LEFT: front-facing small sushi kiosk BACK LAYER: muted coral and cream striped scalloped awning, two stout honey-beige posts, pale mint opaque empty serving-window interior beneath; flat frontal elevation. Entire middle opening empty for a cat sprite later, no character, no counter, no lettering. One simple clean framework, no sign. Wide rectangular silhouette.
TOP RIGHT: separate FRONT COUNTER layer: rounded honey-cream wooden kiosk bar with a broad horizontal oval cream turntable inset on top, viewed front-on from slightly above; empty turntable with thin warm-brown concentric rim and simple discrete flat shadow under lip, short plain front fascia. No wood grain, NO sushi, NO plates, no food, no characters. Wide rectangular silhouette.
BOTTOM LEFT: empty round cream ceramic sushi plate seen from slightly above, wide oval silhouette, coral rim accent, single flat shadow underneath, NO FOOD, no patterns.
BOTTOM RIGHT: a little mint green tea cup, short rounded cylindrical silhouette, thick brown hand-drawn contour, small tea surface visible on top, no steam (steam animated separately), no handle, no text.
Must look painted in the exact same low-detail 2D style as the cat/sushi references, NOT 3D.
```

### shop-details-v1

参考（仅作角色/风格参考，不是修改目标）：`/tmp/sushi-menu-qa.wWDYr7/home-390.png`

```text
Use case: stylized-concept. Production-ready 2D raster assets for the portrait casual sushi puzzle game shown in the reference. Match its simple cute hand-drawn shapes, warm medium-brown outline, buttery cream, muted coral, mint and pale turquoise palette. Flat matte color with at most ONE simple shadow shape; absolutely no realistic materials, no wood grain, no paper grain, no glossy 3D, no intricate detail, no text, no watermark. Readable at small mobile-game sizes.
Asset type: transparent menu decoration and feedback sprite atlas. Square PNG 1024x1024 preferred, EXACT 2 columns x 2 rows equal invisible cells. Four independent isolated assets with 10% clear margin, actual alpha-transparent background, no labels, no grid.
TOP LEFT: small cute circular vinyl record, muted dark sage with just two broad concentric rings and a tiny coral center label, NO letters, centered large enough to rotate independently.
TOP RIGHT: a cluster of three chunky pink/coral hearts, one large heart and two small side hearts, outlined warm brown, very few details, intended as a brief happy-customer particle burst.
BOTTOM LEFT: small celebratory group of three four-point buttery-yellow sparkles, thick warm golden outlines, no dots clutter, intended as a sushi serving success effect.
BOTTOM RIGHT: blank coral hanging wooden shop-opening plaque, a simple horizontally wide rounded rectangle suspended by two short brown strings, a warm brown outline and a single lighter top highlight, perfectly empty flat central surface for HTML text overlay. Do NOT draw letters or symbols.
Match the flat hand-drawn sushi shop, no photographic textures or glossy effects.
```

