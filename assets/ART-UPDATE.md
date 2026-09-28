# 顾客与主题素材更新

使用内置 image_gen 制作；原有食材和装饰图保留，修正渲染与摆放，不用 Emoji 代替角色或胜负插画。

实际接入的项目文件：

- `assets/cat-portraits-v1.png`：2172×724 RGBA，三只完整猫咪立绘；不再拼装分件或使用骨骼动画。
- `assets/menu/theme-garden-v1.png`：樱庭春日室内背景。
- `assets/menu/theme-night-v1.png`：月港夜食室内背景。
- `assets/victory-platter-v1.png`：1536×1024 RGBA 寿司船胜利插画。

当前猫咪使用完整立绘 `assets/cat-portraits-v1.png`，由内置 image_gen 参考 v3 分件的身份、配色和服饰重新绘制。每只猫只有一个源图像，手臂、脸、头、身体和尾巴都在同一张立绘内；只保留接餐时短暂的整体平移弹跳。下面的分件与蒙皮记录为历史方案，不再在游戏中加载。

本次最终提示词与保存位置见 [完整立绘生成记录](CAT-PORTRAITS.md)。

### 历史方案：分件与蒙皮（已停用）

此前猫咪使用 `assets/cat-rig-parts-v3.png`（2172×724 RGBA，内置 image_gen 生成），肩肘分别旋转，小幅挥手叠加在前臂上。v1、v2、v3 现均为历史稿。

手臂衔接修订：`src/cat-arm.js` 使用原图中完整的手臂/爪子像素作为连续蒙皮，肩和肘仍为独立骨骼，沿 20 段网格混合权重弯曲。避免两个闭合轮廓叠在关节上产生双重黑线。纹理先按实际边界隔离，再做实时变形；没有覆盖、重画原始 PNG，也没有改猫咪的脸或配色。三角形按内切圆中心等距外扩亚像素，防止抗锯齿产生透明细缝。

所有食物和猫咪位图通过 `src/atlas-art.js` 的显式 clipPath 裁切原图像素，不只依赖 SVG viewport 的 overflow。后者在长宽比不一致时会从留白处露出邻图。玉子烧和甜虾使用精确的空角裁切，保护完整轮廓；9 种食材、8 种寿司、24 个猫咪部件、5 件摆件、2 个菜单图标的 48 个裁切区已核对。

## cat-rig-parts-v3.png 最终提示词

Use case: stylized-concept. Final production PNG sprite sheet for a cute flat 2D sushi puzzle game. Draw from scratch, extreme simplicity: PURE SOLID COLORS, clean thick dark-brown uniform outlines. NO GRADIENTS, NO TEXTURES, NO SHADING, NO rendered lighting. True transparent RGBA canvas, 3:1 landscape. Exactly 3 rows x 8 columns, all parts isolated with wide empty transparent gutters. Each row is one cat: first ginger tabby with coral bandana, second cream calico with olive-green apron and beret, third blue-gray cat with mustard waistcoat. Eight columns, left to right, in each row: 1 round cat head and ears with tiny smiling nose/mouth and cream muzzle, NO eyes; 2 pear-shaped clothed torso, no limbs, no head; 3 very SHORT round plain-fur upper arm, NO paw; 4 very SHORT forearm ending in round cream paw; 5 matching opposite upper arm; 6 matching opposite forearm/paw; 7 curved tail; 8 detached PAIR of small dark oval eyes. Heads large and cute, body simple. Both upper arm and forearm almost ROUND, each only 1.2 times taller than wide. Shoulder and elbow ends are round overlapping joint shapes. Arms point vertically downward; paws have no fingers, only two tiny toe lines. No whole assembled cats, no feet, no additional sprites, no grid, no text. Every shape has flat vector-like fill with no internal variations. Clean anti-aliased alpha edges with no stray pixels or colored halo. This is separated production art for shoulder-and-elbow skeletal animation, not an illustration or sticker sheet.

原始生成文件名：`exec-cb7abe54-fdb2-44c9-bad5-6c760e11d2cb.png`。已原样复制进项目，保留透明通道。

## customers-v2.png 提示词（弃用方案，未接入游戏）

Production transparent sprite atlas for a simple hand-drawn sushi shop game. EXACTLY nine whole HUMAN customer sprites in a precise 3-column by 3-row grid of equal cells. Row 1: adult fisherman, blue rolled sleeves, knit cap, small grey moustache. Row 2: adult office woman, short dark bob, coral cardigan, cream shirt, olive trousers. Row 3: elderly woman with silver bun, round glasses, sage green jacket, cream skirt. Each row is the SAME character at SAME scale in three poses. Column 1 waiting calmly, arms relaxed; column 2 receiving a small sushi plate with both hands and looking down; column 3 finished eating, small smile, raising one hand goodbye. Full bodies and feet visible, about three heads tall, simple natural faces, readable clothing and limbs. Cream/coral/sage palette, slightly hand-drawn brown outlines, flat colors, minimal shading, low detail. Genuine transparent RGBA background and wide transparent gaps between isolated complete figures. Square sheet. NO text, hearts, stickers, emoji, animals, oversized heads, photorealism, realistic texture, or 3D.

## cat-rig-parts-v1.png 提示词

Use case: stylized-concept. Production CUTOUT RIG SPRITE SHEET, not a finished character illustration. Exactly 8 columns by 3 rows of separated parts, 24 isolated sprites, on truly transparent RGBA background. Landscape 3:1 canvas. Each row one cute round cat sushi-shop customer. Row 1 ginger tabby with cream muzzle and coral neckerchief; row 2 cream calico with one dark ear, sage pinafore and small green beret on head; row 3 blue-grey cat with cream muzzle and mustard vest. Consistent 2D hand-drawn flat cream casual-game art, medium warm-brown outlines, minimal shading, no textures. Columns in EVERY ROW: 1 detached HEAD with ears, muzzle, nose and small mouth but NO EYES; 2 pear-shaped clothed TORSO only, no head, tail or limbs; 3 LEFT UPPER ARM, short vertical rounded capsule with fur color; 4 LEFT FOREARM plus round paw, vertical; 5 RIGHT UPPER ARM, vertical capsule; 6 RIGHT FOREARM plus round paw, vertical; 7 separate curved furry TAIL; 8 a PAIR OF small cute dark oval EYES with tiny highlights, no face behind. Arms have rounded fully painted overlapping ends for shoulder/elbow joints. HEADS and TORSOS never include arms. All components upright front view, isolated and completely contained in their equal cells with generous transparent gutters. Not human hands, no fingers, no feet, no complete assembled cats, no sticker borders, no icons, no text, no grid lines, no grey checkerboard, no photorealism, no 3D. This is a real skeletal animation parts atlas with unconnected limbs and eyes, not emoji faces.

## theme-garden-v1.png 提示词

Edit reference restaurant into a spring garden sushi shop. Keep exactly the reference camera and room geometry: upper wall 0–30%, preparation ledge at 32%, U-shaped sushi counter 35–54%, stools at edges near 62%, open floor bottom 34%. Clear center wall x38–66%, y14–30%, clear back ledge at x50%, y33% for movable decorations. Distinct honey-bamboo cabinetry, dusty rose counter tiles, pink cushions, arched wooden left window onto a cherry-blossom garden, pale sage floor tiles. Flat cream hand-drawn casual-game style, simple large shapes, warm brown contours, one-step shading, no fine texture. Entire 4:7 portrait canvas. NO people, cats, text, UI, labels, logos or loose floor ornaments. Reference is a composition/layout guide, not an instruction to add a color filter.

## theme-night-v1.png 提示词

Edit reference restaurant into a moonlit harbor sushi shop. Keep exactly the reference camera and room geometry: upper wall 0–30%, preparation ledge at 32%, U-shaped sushi counter 35–54%, stools at edges near 62%, open floor bottom 34%. Clear center wall x38–66%, y14–30%, clear back ledge at x50%, y33% for movable decorations. Distinct midnight-blue painted cabinetry, rounded harbor window with a moon and simple sailboats, amber globe pendant lamps, teal tiled sushi counter, cream seat cushions, pale blue floor. Cozy light interior, not a dark black scene. Flat cream hand-drawn casual-game style, simple large shapes, warm brown contours, one-step shading, no fine texture. Entire 4:7 portrait canvas. NO people, cats, text, UI, labels, logos or loose floor ornaments. Reference is a composition/layout guide, not an instruction to add a color filter.

## victory-platter-v1.png 提示词

Usable transparent game illustration, a celebratory sushi platter on one small honey-bamboo serving boat with salmon nigiri, tuna nigiri, tamago, cucumber rolls and roe sushi arranged neatly, a few gold coins and a folded coral napkin beside the boat. Single centered compact composition, slight overhead front view. Simple cream hand-drawn casual-game art with warm brown outlines, large rounded shapes, minimal flat shading, no realistic texture or elaborate detail. Truly transparent RGBA background, generous transparent padding, no text, logo, emoji, face, character, confetti or backdrop. Landscape image, entire boat and coins visible. Intended for an animated end-of-level success screen.
