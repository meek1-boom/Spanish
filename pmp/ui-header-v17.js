(function(){
  function install(){
    const header=document.querySelector('.top');
    if(!header)return;

    const setupIds=['syncScreen','profileScreen','typeScreen','domainScreen'];
    function setupScreenVisible(){
      return setupIds.some(id=>{
        const el=document.getElementById(id);
        return el && !el.classList.contains('hidden');
      });
    }
    function syncHeader(){
      header.style.display=setupScreenVisible()?'none':'';
      const footer=document.querySelector('.appVersionFooter');
      if(footer)footer.textContent='PMP Practice v1.9';
    }

    const observer=new MutationObserver(syncHeader);
    setupIds.forEach(id=>{
      const el=document.getElementById(id);
      if(el)observer.observe(el,{attributes:true,attributeFilter:['class']});
    });

    if(typeof window.showOnly==='function'&&!window.__pmpHeaderV17Wrapped){
      const previous=window.showOnly;
      window.showOnly=function(id){
        previous(id);
        syncHeader();
      };
      window.__pmpHeaderV17Wrapped=true;
    }

    syncHeader();
  }

  if(document.readyState==='complete')install();
  else window.addEventListener('load',install,{once:true});
})();
