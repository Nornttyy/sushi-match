# 寿司店内景与布置素材

模式：内置 image_gen 图片生成。参考现有手绘素材生成，无猫咪、无写实纹理。原始 PNG 保留，旧菜单素材未删除。

- `sushi-interior-v1.png`：948 × 1659，不透明完整店内背景。
- `shop-decorations-v1.png`：1536 × 1024，RGBA 透明装饰图集。3 列 × 2 行依次为盆栽、吊灯、挂画、收纳柜、地毯、菜单牌。
- 文字、金币、关卡按钮均为可交互 HTML；装饰从图集中单独显示，位置和翻转状态保存在浏览器本地。
- 图片显示裁切框见 `menu-interior.css`；不修改源图像像素。

## 内景提示词

```text
Use case: stylized-concept.
Asset type: finished full-screen portrait mobile-game MAIN MENU BACKGROUND, preferably 1024 x 1792 pixels.
Primary request: the INSIDE of a small, cozy conveyor-belt SUSHI RESTAURANT, seen from the entrance looking slightly down into the room. A complete contiguous interior, NOT an outdoor kiosk, NOT a cutaway floating diorama, NOT a shop facade.
Input image 1 is ONLY a palette and drawing-style reference for existing warm brown contours, buttery cream, coral, honey wood and mint. Do NOT repeat its outdoor awning or split atlas layout.
Style: very simple 2D hand-drawn casual mobile game, chunky rounded forms, medium-thick clean warm brown outline, flat matte color, only one soft shadow shape. Low-detail and readable at 350-pixel phone width. No realistic wood grain, no paper texture, no photographic materials, no painterly detail, no 3D render.
Composition explicitly designed for live HTML UI overlays:
- Upper 0–22%: broad quiet pale cream back wall, its center EMPTY for a live title. A small simple coral pendant lamp at each far top side, no writing or sign lettering.
- At 24–42%: cozy back preparation bench with a few simple stacked bowls, rice cooker and ingredient containers; a small mint-curtained window toward left reveals a tiny patch of blue sea, a small shelving unit on right. These are room furnishings, NOT panels or UI boxes. Keep all very simple.
- At 46–65%: the main honey-cream U-shaped/conveyor sushi counter with a broad horizontal oval mint-green conveyor track top seen from above. This is the focal point and spans 90% of width. The FRONT stretch of conveyor is completely EMPTY so three independent clickable sushi plates can later be overlaid across x=22%,50%,78%, near y=59%. No baked-in sushi or plates on this track. Make this front top surface wide and clear, not blocked by anything.
- At 64–76%: short counter front and two small round coral padded stools, near left and right edges, leaving center unobstructed.
- Bottom 77–100%: broad almost empty creamy-beige indoor floor, with at most two very subtle seam lines; empty for live day information and start button.
Keep important room geometry in central 85% of width for mobile crop safety.
NO CATS. NO ANIMALS. NO PEOPLE. NO FACES or mascots on objects. NO text, letters, digits, logos, watermark, UI buttons or baked-in game interface. Full opaque rectangular background; no transparency. Warm welcoming daylight, pleasantly simple, consistent with a small hand-drawn sushi puzzle game.
```

## 装饰提示词

```text
Use case: stylized-concept.
Asset type: production-ready game decoration atlas, 3 columns by 2 rows, six equally sized square cells, 1536x1024 preferred, TRUE transparent background.
Input image 1 is a STYLE AND PERSPECTIVE reference: existing simple cozy sushi restaurant interior. Match its warm brown chunky outlines, cream/coral/sage palette, low-detail flat matte shading and slightly elevated front-facing furniture view. Generate ONLY separate isolated props, not a room.
Each object centered within its cell with generous 12% transparent padding. Invisible grid, no labels or words. Keep sprites clean, coherent and readable at 40–90 pixels. No photo textures, wood grain, 3D, fine patterning, gradients or realistic highlights.
Top-left: one small tabletop bonsai with a rounded sage-green canopy, short trunk and coral ceramic pot, friendly simple silhouette.
Top-middle: one cream-rimmed coral round paper pendant lamp with a short brown cord, simple unlit shape, no face.
Top-right: one small rectangular wall picture with honey-wood frame, a single very simple salmon nigiri illustration centered on blank cream background, no writing.
Bottom-left: one small low wooden storage cabinet with two rounded cream doors and two tiny coral knobs, front-facing slightly elevated camera, no items on it.
Bottom-middle: one rounded coral/cream oval floor rug, seen from a slightly elevated frontal angle so its silhouette is a wide ellipse, a single cream border stripe, no pattern or text.
Bottom-right: one small standing wooden A-frame menu board with sage-green blank board face and one tiny salmon nigiri icon at its top, short feet, no writing or letters.
NO cats, no animals, no humans. No object touches another cell. No baked-in ground plane, no checkerboard, no full-image background, preserve actual alpha transparency.
```

