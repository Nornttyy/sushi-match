# 摆件扩充素材记录

使用内置 `image_gen` 图片生成工具制作，不使用占位图、代码绘制或外部热链。九件新摆件均为独立透明 PNG；原图直接复制入项目，未涂改像素。网页和微信版共用 `src/decor-assets.js` 的可见区域裁切与比例。

## 文件与提示词

以下按共同风格提示词和单件主体整理；墙面三件的主体说明为归档摘要。生成时各件分别请求，不是从拼图裁切。

共同风格提示词：

```text
Use case: stylized-concept. Asset type: production-ready individual 2D decoration sprite for a cozy mobile sushi shop game, NOT a scene or mockup. Style: very simple cream-colored hand-drawn casual game illustration, chunky rounded shapes, medium-thick clean warm brown outlines, flat buttery cream / honey wood / muted coral / sage green fills, only one crisp simple shading shape per part. NO realistic textures, NO paper grain, NO wood grain, NO gradients, NO 3D render, NO photorealistic highlights, NO ground shadow, NO glow. Viewpoint: almost front-facing, gently looking down enough to see top surfaces, consistent slightly elevated frontal furniture view. Center exactly ONE complete ornament, occupy roughly 75% of square canvas, at least 10% empty margin on every side; complete silhouette, no cropping. Background: genuine alpha transparency, no checkerboard or solid background. No people, cats, faces, lanterns, text, numbers, logos or watermarks. Clear at 50 pixels.
```

### 茶具托盘

文件：[tea-set-v1.png](./tea-set-v1.png)

```text
Subject: ONE compact tabletop tea service: a rounded sage-green teapot with short spout and cream lid plus two matching tiny cups, grouped on one shallow oval honey-brown tray. The objects form one compact ornament; no steam.
```

### 调味小架

文件：[condiment-rack-v1.png](./condiment-rack-v1.png)

```text
Subject: ONE compact tabletop condiment caddy: low honey-wood tray holding a squat cream soy sauce bottle with coral cap, a small sage seasoning jar and a cream chopstick cup with three thick brown chopsticks. One coherent grouped ornament, no labels.
```

### 小花瓶

文件：[flower-vase-v1.png](./flower-vase-v1.png)

```text
Subject: ONE short coral rounded tabletop vase with three simple cream daisy flowers with honey yellow centers and four broad sage leaves. Friendly low-detail silhouette, not fine botanical drawing.
```

### 竹叶盆栽

文件：[bamboo-pot-v1.png](./bamboo-pot-v1.png)

```text
Subject: ONE floor-standing potted bamboo plant: three short thick simplified stems, a sparse crown of broad chunky sage leaves, a squat cream round pot with a single coral stripe. Compact vertical silhouette with no fine foliage. Complete base visible.
```

### 软垫长凳

文件：[cushion-bench-v1.png](./cushion-bench-v1.png)

```text
Subject: ONE small low waiting bench: honey-wood rounded bench frame on four short thick legs, one broad coral padded seat and two simple cream button dimples. No backrest, no pillows, no people. Wide horizontal silhouette, gently elevated front view.
```

### 茶点推车

文件：[tea-cart-v1.png](./tea-cart-v1.png)

```text
Subject: ONE small compact two-tier sushi restaurant service cart: honey-wood rounded frame, sage handle, four tiny chunky wheels, upper shelf holding two stacked cream bowls and one small coral lidded teapot, lower shelf holding a single folded cream towel. Readable broad shapes, NO tiny tools or glass parts. Gently elevated front view.
```

### 寿司挂钟

文件：[sushi-clock-v1.png](./sushi-clock-v1.png)

```text
Subject: ONE simple round sushi-themed wall clock: honey-brown rim, cream face, short brown clock hands and simple hour marks, coral and sage sushi-inspired accents. Front view, one compact clock, no words or numerals.
```

### 小鱼木牌

文件：[fish-plaque-v1.png](./fish-plaque-v1.png)

```text
Subject: ONE simple horizontal fish-shaped wall plaque: chunky honey-wood fish silhouette with broad sage and cream decorative details, flat front view. One coherent wall ornament, no text or fine wood grain.
```

### 碗碟壁架

文件：[dish-shelf-v1.png](./dish-shelf-v1.png)

```text
Subject: ONE simple short wall-mounted honey-wood shelf with two thick brackets, holding a few chunky cream and sage bowls and plates. Wide horizontal silhouette, almost frontal view, one grouped wall ornament.
```

## 接入与检查

- 新增售价 360–1180 金币，不更改原来五件的售价或金币收益。
- 台面、墙面、地面分类；网页版横滑，微信 Canvas 版每页五件。
- 茶具、调味架、小花瓶摆在台面；挂钟、木牌、壁架挂墙；竹叶盆栽、长凳、推车摆在地面。
- 允许收起后免费重新摆放，摆放空间不足不购买、不扣金币。
- 测试校验原图尺寸、透明通道、裁切边界、比例、购买和存档兼容。

