# 机关正式素材 · v1

使用内置 image_gen 生成，非 SVG 形状占位图。源 PNG 保留原始透明通道，没有抠图、改色或手工重画。每种图片单独保存，用源坐标裁剪消除透明留白，不共享图集，避免邻图露边。

- `ice-full-v1.png`：完整冰块边框，双层状态。
- `ice-cracked-v1.png`：基于完整冰框编辑的破裂状态，单层状态。
- `key-v1.png`：钥匙标记。
- `lock-v1.png`：锁扣。
- `crate-v1.png`：订单封箱边框。

编号与剩余层数/订单数由 UI 单独排版，不烘焙进图片。奶油色、简洁卡通，无真实材质纹理；框内透明，保留原食材的可见性。

## 最终生成提示词

### ice-cracked（编辑 ice-full）

Use case: precise-object-edit. Asset type: production transparent PNG game obstacle sprite. Input image 1 is the EDIT TARGET: the intact pale blue ice rim. Make its partly broken / one-layer-remaining version. Preserve the exact front-facing rounded-square silhouette, image size, placement, rim thickness, palette, bold blue outline, generous transparent exterior and genuinely transparent center opening. Change ONLY these details: add two bold simple jagged fractures that cross the rim on the TOP RIGHT and LOWER LEFT, with tiny triangular chips missing at the cracks. Fractures should remain clear when scaled to 60 pixels, not a web of tiny lines. Keep the rest of the rim in place, no debris floating outside. Same simple smooth cream-cartoon shading; no realistic ice texture, no noise or micro-detail, no snowflakes. No words, numbers, labels, food or background. Preserve true alpha transparency.

### ice-full

Use case: stylized-concept. Asset type: production PNG sprite for a mobile sushi tile-matching game, not concept art. Style: simple cute creamy flat hand-drawn 2D, rounded chubby shapes, smooth solid pastel color areas, bold cocoa-brown or muted colored outlines, at most ONE flat shadow color, readable at 60 pixels. ABSOLUTELY NO realistic texture, wood grain, paper texture, noise, stippling, detailed painting, photorealism, 3D lighting, gradients or micro-details. No food, characters, scene, text, numbers, labels, watermark, cast shadow or presentation board. One isolated asset centered on TRUE TRANSPARENT RGBA background, with generous even padding; do not draw a checkerboard. Front-facing orthographic view, not isometric. Subject: an intact rounded-square pale icy-blue frost border that fits around a square food tile. Draw only a continuous chunky rounded icy rim, a tiny flat highlight stroke near the upper left, and one simple broad facet on the lower right. The large central opening must be genuinely transparent so an existing food drawing can show through, no opaque ice pane in the middle. Outer rim fills about 82% of square canvas; rim thickness about 10% of canvas. Smooth toy-like snow-blue corners, simple blue-grey outline. No snowflakes, no crystals sticking outside, no scattered decoration. 1024 x 1024 square.

### key

Use case: stylized-concept. Asset type: production PNG sprite for a mobile sushi tile-matching game, not concept art. Style: simple cute creamy flat hand-drawn 2D, rounded chubby shapes, smooth solid pastel color areas, bold cocoa-brown or muted colored outlines, at most ONE flat shadow color, readable at 60 pixels. ABSOLUTELY NO realistic texture, wood grain, paper texture, noise, stippling, detailed painting, photorealism, 3D lighting, gradients or micro-details. No food, characters, scene, text, numbers, labels, watermark, cast shadow or presentation board. One isolated asset centered on TRUE TRANSPARENT RGBA background, with generous even padding; do not draw a checkerboard. Front-facing orthographic view, not isometric. Subject: one simple plump golden-yellow key with a rounded circular bow containing an actually transparent circular hole, a short horizontal shaft and two chunky teeth pointing down. Warm buttery yellow fill, simple pale cream highlight, thin cocoa outline. Key lies horizontally pointing right. Large coherent silhouette filling 80% width and 48% height of square canvas. No attached tag, no key ring, no other keys. 1024 x 1024 square.

### lock

Use case: stylized-concept. Asset type: production PNG sprite for a mobile sushi tile-matching game, not concept art. Style: simple cute creamy flat hand-drawn 2D, rounded chubby shapes, smooth solid pastel color areas, bold cocoa-brown or muted colored outlines, at most ONE flat shadow color, readable at 60 pixels. ABSOLUTELY NO realistic texture, wood grain, paper texture, noise, stippling, detailed painting, photorealism, 3D lighting, gradients or micro-details. No food, characters, scene, text, numbers, labels, watermark, cast shadow or presentation board. One isolated asset centered on TRUE TRANSPARENT RGBA background, with generous even padding; do not draw a checkerboard. Front-facing orthographic view, not isometric. Subject: one closed cute chubby padlock, creamy caramel-gold rounded rectangular lock body, a thick rounded U-shaped gold shackle above it with genuinely transparent hole inside. Tiny simple keyhole in lower half of body. Front view perfectly upright. Solid pastel yellow and buttercream areas with cocoa-brown outlines, no metallic reflections. Fills 68% width and 82% height of square canvas. No chain, strap, key, numbers or badge. 1024 x 1024 square.

### crate

Use case: stylized-concept. Asset type: production PNG sprite for a mobile sushi tile-matching game, not concept art. Style: simple cute creamy flat hand-drawn 2D, rounded chubby shapes, smooth solid pastel color areas, bold cocoa-brown or muted colored outlines, at most ONE flat shadow color, readable at 60 pixels. ABSOLUTELY NO realistic texture, wood grain, paper texture, noise, stippling, detailed painting, photorealism, 3D lighting, gradients or micro-details. No food, characters, scene, text, numbers, labels, watermark, cast shadow or presentation board. One isolated asset centered on TRUE TRANSPARENT RGBA background, with generous even padding; do not draw a checkerboard. Front-facing orthographic view, not isometric. Subject: top-down rounded square cream takeaway lunchbox RIM with a large empty transparent center opening through which an existing food tile will be visible. Draw ONLY the open square cardboard rim with rounded corners, flat beige edge and cocoa outline, and one small simple coral-red bow on the LOWER LEFT corner. Center opening occupies at least 65% of width and height and is genuinely transparent, no floor, no base panel, no food, no crossed ribbons in the opening. A cute little blank cream tag is integrated into the lower-right rim without text. Outer frame fills 84% of square canvas with even padding. No perspective, no lid standing upright, no wooden crate slats. 1024 x 1024 square.
