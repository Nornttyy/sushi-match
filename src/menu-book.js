import {MENU_PAGES,menuPageIndex,stepMenuPage} from './menu-pages.js';

export function mountMenuBook({root,onChange=()=>{},onSound=()=>{}}) {
  const pages=[...root.querySelectorAll('[data-book-page]')];
  const nav=root.querySelector('#menu-book-navigation');
  const previous=root.querySelector('#menu-book-previous');
  const next=root.querySelector('#menu-book-next');
  const number=root.querySelector('#menu-book-number');
  let current='home', animation=null, swipe=null;

  function show(id,{animate=true,focus=false}={}) {
    if(!MENU_PAGES.some(page=>page.id===id))return;
    const changed=current!==id,direction=menuPageIndex(id)-menuPageIndex(current);
    animation?.cancel();current=id;root.dataset.menuPage=id;
    for(const page of pages){page.hidden=page.dataset.bookPage!==id;page.inert=page.hidden;}
    nav.querySelectorAll('[data-menu-target]').forEach(button=>button.setAttribute('aria-current',button.dataset.menuTarget===id?'page':'false'));
    previous.disabled=menuPageIndex(id)===0;next.disabled=menuPageIndex(id)===MENU_PAGES.length-1;
    number.textContent=(menuPageIndex(id)+1)+' / '+MENU_PAGES.length;
    onChange(id);
    const page=pages.find(page=>page.dataset.bookPage===id);
    if(changed&&animate&&!matchMedia('(prefers-reduced-motion: reduce)').matches&&page.animate){
      animation=page.animate([
        {opacity:.4,transform:'perspective(900px) rotateY('+(direction>0?'-7':'7')+'deg) translateX('+(direction>0?'16':'-16')+'px)'},
        {opacity:1,transform:'perspective(900px) rotateY(0deg) translateX(0px)'}
      ],{duration:280,easing:'ease-out'});
    }
    if(focus)nav.querySelector('[data-menu-target="'+id+'"]').focus({preventScroll:true});
  }
  function turn(direction){const id=stepMenuPage(current,direction);if(id!==current){show(id,{focus:true});onSound('ui');}}
  nav.addEventListener('click',event=>{
    const button=event.target.closest('[data-menu-target]');
    if(button){show(button.dataset.menuTarget);onSound('ui');}
  });
  previous.addEventListener('click',()=>turn(-1));next.addEventListener('click',()=>turn(1));
  nav.addEventListener('keydown',event=>{
    if(!['ArrowLeft','ArrowRight','PageUp','PageDown'].includes(event.key))return;
    event.preventDefault();turn(['ArrowLeft','PageUp'].includes(event.key)?-1:1);
  });
  root.addEventListener('pointerdown',event=>{
    if(event.button!==0||event.target.closest('button,a,input,.decor-tray,.placed-decor'))return;
    swipe={id:event.pointerId,x:event.clientX,y:event.clientY};
  });
  root.addEventListener('pointermove',event=>{
    if(swipe?.id!==event.pointerId)return;
    if(Math.abs(event.clientX-swipe.x)>15&&Math.abs(event.clientX-swipe.x)>Math.abs(event.clientY-swipe.y)*1.5){
      root.setPointerCapture(event.pointerId);event.preventDefault();
    }
  });
  root.addEventListener('pointerup',event=>{
    if(swipe?.id!==event.pointerId)return;
    const dx=event.clientX-swipe.x,dy=event.clientY-swipe.y;swipe=null;
    if(Math.abs(dx)>=55&&Math.abs(dx)>Math.abs(dy)*1.5)turn(dx<0?1:-1);
  });
  root.addEventListener('pointercancel',()=>{swipe=null;});
  show('home',{animate:false});
  return {show,get page(){return current;}};
}
