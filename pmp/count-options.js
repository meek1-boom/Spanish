(function(){
  function install(){
    if(window.__pmpDynamicCountsInstalled)return;
    if(!window.__pmpTimedSessionInstalled||typeof showStart!=='function'||typeof pool!=='function'){
      setTimeout(install,100);
      return;
    }
    window.__pmpDynamicCountsInstalled=true;

    const STANDARD=[3,5,10,15,20,40,60,80,100];
    const originalShowStart=showStart;

    function rebuildCountChoices(){
      const grid=document.getElementById('questionCountGrid');
      const note=document.getElementById('questionCountNote');
      const start=document.getElementById('startBtn');
      if(!grid||!note||!start)return;

      const available=pool(TYPE,DOMAIN).length;
      if(available<=0){
        grid.innerHTML='';
        note.textContent='No questions are available for this question type/domain.';
        start.disabled=true;
        return;
      }

      const bridge=grid.querySelector('.questionCountBtn');
      if(!bridge)return;

      let values=STANDARD.filter(n=>n<=available);
      if(!values.includes(available))values.push(available);

      grid.innerHTML='';
      const buttons=[];
      values.forEach((n,index)=>{
        const isAll=n===available&&!STANDARD.includes(available);
        const btn=document.createElement('button');
        btn.type='button';
        btn.className='questionCountBtn';
        btn.dataset.count=String(n);
        btn.textContent=isAll?'All '+n:String(n);
        btn.onclick=()=>{
          bridge.dataset.count=String(n);
          bridge.click();
          buttons.forEach(x=>x.classList.remove('selected'));
          btn.classList.add('selected');
          start.disabled=false;
          note.textContent=isAll?`All ${available} available questions will be used in this session.`:`This session will contain ${n} questions.`;
        };
        buttons.push(btn);
        grid.appendChild(btn);
      });

      start.disabled=true;
      note.textContent=`${available} questions are available for this question type/domain. Choose a session length.`;

      if(values.length===1){
        buttons[0].textContent='All '+available;
        buttons[0].click();
      }
    }

    showStart=function(){
      originalShowStart();
      rebuildCountChoices();
    };

    const startScreen=document.getElementById('startScreen');
    if(startScreen&&!startScreen.classList.contains('hidden'))rebuildCountChoices();
  }

  install();
})();