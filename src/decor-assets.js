// Shared, source-pixel artwork bounds for both HTML and Canvas renderers.
const original = crop => ({ file:'menu/shop-decorations-v1.png', width:1536, height:1024, crop });
const single = (id, crop, width=1254, height=1254) => ({ file:'menu/decor/'+id+'-v1.png', width, height, crop });
export const DECOR_ART = Object.freeze({
  bonsai:original([102,115,366,383]), picture:original([1072,152,380,292]),
  cabinet:original([73,602,423,307]), rug:original([540,651,458,207]), board:original([1089,553,369,370]),
  'tea-set':single('tea-set',[74,198,1110,845]),
  'condiment-rack':single('condiment-rack',[43,113,1169,996]),
  'flower-vase':single('flower-vase',[176,109,906,1048]),
  'sushi-clock':single('sushi-clock',[122,126,1010,996]),
  'fish-plaque':single('fish-plaque',[45,175,1166,847]),
  'dish-shelf':single('dish-shelf',[49,355,1156,564]),
  'bamboo-pot':single('bamboo-pot',[279,73,688,1081]),
  'cushion-bench':single('cushion-bench',[103,252,1330,522],1536,1024),
  'tea-cart':single('tea-cart',[166,100,922,1057])
});
export const NEW_DECOR_IMAGES = [...new Set(Object.values(DECOR_ART).map(art=>art.file))].filter(file=>file.includes('/decor/'));
