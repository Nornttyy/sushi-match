# 猫咪完整立绘生成记录

- 模式：内置 image_gen（非 CLI）。
- 最终项目文件：`assets/cat-portraits-v1.png`，2172×724，保留生成图片的真实透明通道，未做程序重绘。
- 原始生成文件名：`exec-84010920-a2d4-475a-b095-31af57243571.png`，已原样复制到上面的项目文件。
- 身份与画风参考：`assets/cat-rig-parts-v3.png`。保留橘猫红领巾、三花绿帽围裙、蓝灰猫黄马甲。
- 游戏仅通过显式 SVG clipPath 裁切三只完整角色；裁切边界参考 PNG 透明像素检测，不按等分网格切掉尾巴。绘制位置和大小在 `src/cat-portrait.js` 与 `cat-portrait.css`。

## 最终提示词

Use case: identity-preserve.
Asset type: finished transparent PNG sprite atlas for a small mobile sushi puzzle, NOT a rigging sheet.
Input image 1 is the identity/style reference: three cats currently split into body parts. Reassemble and redraw those SAME three cats as THREE COMPLETE one-piece character illustrations, one row of three. No detached parts, no joints, no construction guides.
Subject left: round ginger tabby with cream muzzle and belly, coral-red neckerchief. Middle: cream calico with orange and dark brown patches, olive green beret and olive apron. Right: blue-gray tabby with cream muzzle and mustard yellow buttoned vest. Keep big round heads, tiny dark oval eyes and sweet small smiling mouths, small pear-shaped bodies, short relaxed naturally connected paws at the sides, short curved tails beside bodies. Head roughly half overall height, stubby proportions; no long humanlike arms. Front facing, all equally sized and aligned at same bottom baseline. Neutral pleasant waiting pose, eyes open, no food or other props.
Style: very simple cute 2D hand-drawn mobile game sticker art. Warm dark brown smooth bold outlines, flat cream and pastel solid color fills, clear readable at 72px. Do NOT add realistic texture, paper texture, grain, fur strands, fabric weave, highlights, gradients, 3D lighting or extra fine detail. No fake joint outlines, no separated limbs.
Composition: wide 3:1 PNG, exactly three whole full-body characters in three evenly spaced cells. Each character entirely isolated with generous fully transparent gutters and margins including under each body and tail. No ground, no shadows, no frame, no icons, no lettering, no extra expressions. Genuine transparent alpha background (not a drawn checkerboard). This is final production sprite artwork, preserve the identity colors and outfits in the reference.
