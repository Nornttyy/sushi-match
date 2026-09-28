// Offline authored menus. These become stored records, never runtime shuffles.
const menus=[
  ['salmon','makiCucumber','shrimp','roe','tamago','makiAvocado','tuna','makiSalmon'],
  ['tamago','makiAvocado','tuna','makiSalmon','salmon','roe','shrimp','makiCucumber'],
  ['makiSalmon','shrimp','makiCucumber','tamago','roe','tuna','makiAvocado','salmon'],
  ['tuna','roe','salmon','makiAvocado','shrimp','makiSalmon','tamago','makiCucumber']
];
export const EXTRA_CAMPAIGN=Array.from({length:24},(_,index)=>{
  const id=index+25,chapter=Math.floor(index/4),type=index%4;
  const menu=menus[type],shift=chapter%menu.length;
  const orders=[...menu.slice(shift),...menu.slice(0,shift),
    ['salmon','tamago','shrimp','tuna'][chapter%4],['makiCucumber','makiSalmon','makiAvocado','roe'][chapter%4]];
  if(id>=33&&type!==2)orders.push(id>=41?'roe':'shrimp');
  return {id,orders,railLimit:7,undoLimit:1,difficulty:'高手',assist:false};
});
