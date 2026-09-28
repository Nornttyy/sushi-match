export const MENU_PAGES = Object.freeze([
  {id:'home',label:'小店'}, {id:'business',label:'营业'}, {id:'decor',label:'装修'}
]);
export function menuPageIndex(id) { return Math.max(0,MENU_PAGES.findIndex(page=>page.id===id)); }
export function stepMenuPage(id, direction) {
  return MENU_PAGES[Math.max(0,Math.min(MENU_PAGES.length-1,menuPageIndex(id)+Math.sign(direction)))].id;
}
