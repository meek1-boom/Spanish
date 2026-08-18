(function(){
  function install(){
    const header=document.querySelector('.top');
    if(!header)return;

    const setupIds=['profileScreen','typeScreen','domainScreen'];
    function setupScreenVisible(){
      return setupIds.some(id=>{
        const el=document.getElementById(id);
        return el && !el.classList.contains('hidden');
      });
    }
    function syncHeader(){
      header.style.display=setupScreenVisible()?'none':'';
      const footer=document.querySelector('.appVersionFooter');
      if(footer)footer.textContent='PMP Practice v1.7';
    }

    // Watch the setup screens because the app swaps them by adding/removing .hidden.
    const observer=new MutationObserver(syncHeader);
    setupIds.forEach(id=>{
      const el=document.getElementById(id);
      if(el)observer.observe(el,{attributes:true,attributeFilter:['class']});
    });

    // Also wrap the central screen switcher when available.
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
