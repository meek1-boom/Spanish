(function(){
  function install(){
    const header=document.querySelector('.top');
    if(!header)return;

    const setupIds=['passwordScreen','syncScreen','profileScreen','typeScreen','domainScreen'];
    const syncEmail=()=>((window.PMP_FIREBASE_CONFIG&&window.PMP_FIREBASE_CONFIG.syncEmail)||'pmp-sync@pmp.local');
    function preparePasswordOnlySync(){
      const screen=document.getElementById('syncScreen');
      if(!screen)return;
      const title=screen.querySelector('h1');
      const copy=screen.querySelector('.muted');
      const email=document.getElementById('syncEmail');
      const password=document.getElementById('syncPassword');
      const signIn=document.getElementById('syncSignInBtn');
      const local=document.getElementById('syncLocalBtn');
      if(title)title.textContent='Enter password';
      if(copy)copy.textContent='Enter the shared password to continue.';
      if(email){
        email.value=syncEmail();
        email.type='hidden';
        email.autocomplete='off';
        email.style.display='none';
        try{localStorage.setItem('pmpSyncEmail',syncEmail())}catch(e){}
      }
      if(password){
        password.placeholder='Password';
        password.autocomplete='current-password';
      }
      if(signIn)signIn.textContent='Continue';
      if(local)local.style.display='none';
    }
    function setupScreenVisible(){
      return setupIds.some(id=>{
        const el=document.getElementById(id);
        return el && !el.classList.contains('hidden');
      });
    }
    function syncHeader(){
      preparePasswordOnlySync();
      header.style.display=setupScreenVisible()?'none':'';
      const footer=document.querySelector('.appVersionFooter');
      if(footer)footer.textContent='PMP Practice v2.0';
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

  if(document.querySelector('.top'))install();
  else document.addEventListener('DOMContentLoaded',install,{once:true});
})();
