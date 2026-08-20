(function(){
  function init(){
    if(window.__pmpTimedSessionInstalled)return;
    if(typeof showStart!=='function'||typeof startPractice!=='function'||typeof activeIds!=='function'||typeof renderCurrent!=='function'||typeof checkAnswer!=='function'){
      setTimeout(init,100);
      return;
    }
    window.__pmpTimedSessionInstalled=true;

    const APP_VERSION='v1.9';
    const COUNTS=[3,5,10,15,20,40,60,80,100];
    let selectedCount=null;
    let timedActive=false;
    let sessionIds=[];
    let sessionStart=0;
    let questionStart=0;
    let currentTimedUid=null;
    let timerHandle=null;
    let sessionAnswers={};

    const oldShowOnly=showOnly;
    const oldShowStart=showStart;
    const oldShowDomains=showDomains;
    const oldStartPractice=startPractice;
    const oldActiveIds=activeIds;
    const oldRenderCurrent=renderCurrent;
    const oldCheckAnswer=checkAnswer;
    const oldRefreshHeader=refreshHeader;

    const style=document.createElement('style');
    style.textContent=`
      .sessionTimerRow{display:none;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:9px}
      .sessionTimerBox{background:#0d172a;border:1px solid #334563;border-radius:12px;padding:9px 11px}
      .sessionTimerBox:last-child{text-align:right}
      .sessionTimerLabel{display:block;color:#8fa3c8;font-size:11px;margin-bottom:2px;text-transform:uppercase;letter-spacing:.05em}
      .sessionTimerValue{font-variant-numeric:tabular-nums;font-size:20px;font-weight:800;color:#fff}
      .questionCountSection{max-width:560px;margin:18px auto 8px}
      .questionCountSection h3{font-size:17px;margin:0 0 10px}
      .questionCountGrid{display:grid;grid-template-columns:repeat(3,1fr);gap:9px}
      .questionCountBtn{border:1px solid #40547a;background:#1b2a49;color:white;border-radius:11px;padding:12px 8px;font-size:17px;font-weight:800;cursor:pointer}
      .questionCountBtn.selected{outline:2px solid #67cfff;background:#21345b}
      #startBtn:disabled{opacity:.4;cursor:not-allowed}
      .sessionResultsGrid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;max-width:620px;margin:20px auto}
      .sessionMetric{background:#0d172a;border:1px solid #334563;border-radius:13px;padding:15px 10px}
      .sessionMetric small{display:block;color:#9fb0cf;margin-bottom:5px}
      .sessionMetric b{font-size:25px;font-variant-numeric:tabular-nums}
      .sessionBreakdown{max-width:650px;margin:18px auto;text-align:left;border-top:1px solid #293754;padding-top:12px}
      .sessionBreakdownRow{display:flex;justify-content:space-between;gap:12px;padding:7px 2px;border-bottom:1px solid #23314b;color:#cbd7ec;font-size:14px}
      .appVersionFooter{text-align:center;color:#60708f;font-size:12px;padding:24px 0 4px;letter-spacing:.02em}
      .domainPct{display:inline-block;margin-left:9px;color:#67cfff;font-size:.72em;font-weight:800;vertical-align:middle}
      @media(max-width:620px){.questionCountGrid{grid-template-columns:repeat(2,1fr)}.sessionResultsGrid{grid-template-columns:1fr}.sessionTimerValue{font-size:18px}}
    `;
    document.head.appendChild(style);

    const header=document.querySelector('.top');
    const progressWrap=document.querySelector('.bar');
    if(progressWrap)progressWrap.style.display='none';
    const timerRow=document.createElement('div');
    timerRow.id='sessionTimerRow';
    timerRow.className='sessionTimerRow';
    timerRow.innerHTML=`<div class="sessionTimerBox"><span class="sessionTimerLabel">Session</span><span class="sessionTimerValue" id="sessionTimer">00:00</span></div><div class="sessionTimerBox"><span class="sessionTimerLabel">Question</span><span class="sessionTimerValue" id="questionTimer">00:00</span></div>`;
    header.insertBefore(timerRow,header.firstChild);

    const startSummary=document.getElementById('startSummary');
    const countSection=document.createElement('div');
    countSection.id='questionCountSection';
    countSection.className='questionCountSection';
    countSection.innerHTML='<h3>How many questions?</h3><div class="questionCountGrid" id="questionCountGrid"></div><div class="note" id="questionCountNote">Choose a session length to enable Start Practice.</div>';
    startSummary.parentNode.insertBefore(countSection,startSummary.nextSibling);

    const wrap=document.querySelector('.wrap');
    const resultScreen=document.createElement('section');
    resultScreen.id='sessionResultsScreen';
    resultScreen.className='card setup hidden';
    resultScreen.innerHTML=`
      <span class="pill" id="resultConfig"></span>
      <h1>Session complete</h1>
      <div class="sessionResultsGrid">
        <div class="sessionMetric"><small>Score</small><b id="resultScore">0%</b></div>
        <div class="sessionMetric"><small>Total time</small><b id="resultTotalTime">00:00</b></div>
        <div class="sessionMetric"><small>Avg. per question</small><b id="resultAverage">00:00</b></div>
      </div>
      <div class="summary" id="resultDetail"></div>
      <div class="sessionBreakdown" id="resultBreakdown"></div>
      <button class="btn primary big" id="practiceAgainBtn">Practice Again</button><br>
      <button class="btn back" id="resultSetupBtn">Change Setup</button>`;
    wrap.appendChild(resultScreen);

    const versionFooter=document.createElement('footer');
    versionFooter.className='appVersionFooter';
    versionFooter.textContent=`PMP Practice ${APP_VERSION}`;
    wrap.appendChild(versionFooter);

    showOnly=function(id){
      oldShowOnly(id);
      resultScreen.classList.toggle('hidden',id!=='sessionResultsScreen');
      if(progressWrap)progressWrap.style.display=['startScreen','app','sessionResultsScreen'].includes(id)?'':'none';
    };

    function domainStats(type,domain){
      const questions=pool(type,domain);
      const results=questions.map(q=>resultFor(q.uid)).filter(Boolean);
      const correct=results.filter(r=>r&&r.correct).length;
      return {total:questions.length,answered:results.length,score:results.length?Math.round(correct/results.length*100):0};
    }

    function decorateDomainChoices(){
      document.querySelectorAll('.domainBtn').forEach(btn=>{
        const domain=btn.dataset.domain;
        const label=domain==='all'?'All Domains':domain;
        const st=domainStats(TYPE,domain);
        btn.innerHTML=`${esc(label)} <span class="domainPct">${st.score}%</span><small>${st.total} question${st.total===1?'':'s'}${st.answered?` • ${st.answered} answered`:''}</small>`;
      });
    }

    showDomains=function(){
      oldShowDomains();
      decorateDomainChoices();
    };
    document.getElementById('startBack').onclick=showDomains;

    function fmt(ms){
      ms=Math.max(0,Math.floor(ms||0));
      const total=Math.floor(ms/1000),h=Math.floor(total/3600),m=Math.floor((total%3600)/60),s=total%60;
      if(h>0)return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
      return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    }

    function updateTimers(){
      if(!timedActive)return;
      const now=Date.now();
      document.getElementById('sessionTimer').textContent=fmt(now-sessionStart);
      const q=current();
      if(q){
        const frozen=sessionAnswers[q.uid]?.timeMs;
        document.getElementById('questionTimer').textContent=fmt(frozen!=null?frozen:now-questionStart);
      }
    }

    function startTimerLoop(){
      clearInterval(timerHandle);
      updateTimers();
      timerHandle=setInterval(updateTimers,250);
    }

    function stopTimerLoop(){
      clearInterval(timerHandle);
      timerHandle=null;
    }

    function availableCount(){return pool(TYPE,DOMAIN).length}

    function renderCountPicker(){
      const available=availableCount();
      const grid=document.getElementById('questionCountGrid');
      const note=document.getElementById('questionCountNote');
      const start=document.getElementById('startBtn');
      selectedCount=null;

      if(available<=0){
        grid.innerHTML='';
        note.textContent='No questions are available for this question type/domain.';
        start.disabled=true;
        return;
      }

      const choices=COUNTS.filter(n=>n<=available);
      const exactMatch=COUNTS.includes(available);
      const buttons=choices.map(n=>({count:n,label:String(n)}));
      if(!exactMatch)buttons.push({count:available,label:`All ${available}`});
      if(!buttons.length)buttons.push({count:available,label:`All ${available}`});

      grid.innerHTML=buttons.map(x=>`<button type="button" class="questionCountBtn" data-count="${x.count}">${x.label}</button>`).join('');
      start.disabled=true;
      note.textContent=`${available} questions are available for this question type/domain. Choose a session length.`;

      if(buttons.length===1){
        selectedCount=buttons[0].count;
        grid.firstElementChild.classList.add('selected');
        start.disabled=false;
        note.textContent=`All ${available} available questions will be used in this session.`;
      }

      grid.querySelectorAll('.questionCountBtn').forEach(btn=>btn.addEventListener('click',()=>{
        selectedCount=Number(btn.dataset.count);
        grid.querySelectorAll('.questionCountBtn').forEach(x=>x.classList.toggle('selected',x===btn));
        start.disabled=false;
        note.textContent=selectedCount===available?`All ${available} available questions will be used in this session.`:`This session will contain ${selectedCount} questions.`;
      }));
    }

    showStart=function(){
      timedActive=false;
      stopTimerLoop();
      timerRow.style.display='none';
      oldShowStart();
      if(progressWrap)progressWrap.style.display='';
      renderCountPicker();
    };

    function makeSessionIds(){
      const n=selectedCount;
      if(TYPE!=='combo')return shuffle(pool(TYPE,DOMAIN).map(q=>q.uid).slice()).slice(0,n);
      const drag=shuffle(pool('drag',DOMAIN).map(q=>q.uid).slice());
      const mcq=shuffle(pool('mcq',DOMAIN).map(q=>q.uid).slice());
      let left=Math.floor(n/2),right=n-left;
      let picked=drag.splice(0,Math.min(left,drag.length)).concat(mcq.splice(0,Math.min(right,mcq.length)));
      if(picked.length<n){
        const remainder=shuffle(drag.concat(mcq));
        picked=picked.concat(remainder.slice(0,n-picked.length));
      }
      return shuffle(picked);
    }

    activeIds=function(){return timedActive?sessionIds:oldActiveIds()};

    function timedStart(){
      if(!selectedCount)return;
      ensureSession();
      sessionIds=makeSessionIds();
      SESSION.i=0;
      sessionAnswers={};
      sessionStart=Date.now();
      questionStart=sessionStart;
      currentTimedUid=null;
      timedActive=true;
      timerRow.style.display='grid';
      if(progressWrap)progressWrap.style.display='';
      document.getElementById('shuffleBtn').disabled=true;
      document.getElementById('missedBtn').disabled=true;
      oldStartPractice();
      startTimerLoop();
    }

    startPractice=timedStart;
    document.getElementById('startBtn').onclick=timedStart;

    refreshHeader=function(inApp=true){
      if(!timedActive){oldRefreshHeader(inApp);return}
      const answered=Object.keys(sessionAnswers).length;
      const correct=Object.values(sessionAnswers).filter(x=>x.correct).length;
      const liveScore=answered?Math.round(correct/answered*100):0;
      document.getElementById('topUser').textContent=`${ACTIVE} • ${typeLabel(TYPE)}`;
      document.getElementById('topAnswered').textContent=`${answered} / ${sessionIds.length} answered`;
      document.getElementById('score').textContent=`Session ${liveScore}%`;
      document.getElementById('progressBar').style.width=(sessionIds.length?answered/sessionIds.length*100:0)+'%';
      if(!inApp)document.getElementById('position').textContent=DOMAIN==='all'?'All Domains':DOMAIN;
    };

    renderCurrent=function(){
      oldRenderCurrent();
      if(!timedActive)return;
      const q=current();
      const sourceNumber=document.getElementById('qNumber');
      const sourceTitle=document.getElementById('qTitle');
      const isMcq=!!(q&&q.bank==='mcq');
      if(sourceNumber)sourceNumber.style.display=isMcq?'none':'';
      if(sourceTitle)sourceTitle.style.display=isMcq?'none':'';
      if(q&&q.uid!==currentTimedUid){
        currentTimedUid=q.uid;
        questionStart=Date.now();
      }
      const ids=activeIds();
      const next=document.getElementById('nextBtn');
      if(q&&SESSION.i===ids.length-1){
        next.disabled=false;
        next.textContent='Finish Session';
      }else{
        next.textContent='Next →';
      }
      updateTimers();
    };

    checkAnswer=function(){
      const q=current();
      const wasChecked=R.checked;
      oldCheckAnswer();
      if(!timedActive||!q||wasChecked||!R.checked)return;
      if(!sessionAnswers[q.uid]){
        const rr=resultFor(q.uid);
        sessionAnswers[q.uid]={correct:!!(rr&&rr.correct),timeMs:Date.now()-questionStart};
      }
      refreshHeader(true);
      updateTimers();
    };
    document.getElementById('checkBtn').onclick=checkAnswer;

    function finishSession(){
      if(!timedActive)return;
      const totalMs=Date.now()-sessionStart;
      const total=sessionIds.length;
      const answered=Object.keys(sessionAnswers).length;
      const correct=Object.values(sessionAnswers).filter(x=>x.correct).length;
      const scorePct=total?Math.round(correct/total*100):0;
      const avgMs=total?totalMs/total:0;

      stopTimerLoop();
      timedActive=false;
      timerRow.style.display='none';
      document.getElementById('shuffleBtn').disabled=false;
      document.getElementById('missedBtn').disabled=false;

      P.sessionHistory=P.sessionHistory||[];
      P.sessionHistory.unshift({ts:Date.now(),type:TYPE,domain:DOMAIN,count:total,answered,correct,score:scorePct,totalMs,avgMs});
      P.sessionHistory=P.sessionHistory.slice(0,25);
      saveProfile();

      document.getElementById('resultConfig').textContent=`${ACTIVE} • ${typeLabel(TYPE)} • ${DOMAIN==='all'?'All Domains':DOMAIN} • ${total} questions`;
      document.getElementById('resultScore').textContent=`${scorePct}%`;
      document.getElementById('resultTotalTime').textContent=fmt(totalMs);
      document.getElementById('resultAverage').textContent=fmt(avgMs);
      document.getElementById('resultDetail').innerHTML=`<b>${correct} correct</b> out of <b>${total}</b> questions${answered<total?` • ${total-answered} unanswered`:''}.`;
      document.getElementById('resultBreakdown').innerHTML='<b>Time by question</b>'+sessionIds.map((uid,i)=>{
        const q=ITEM.get(uid),a=sessionAnswers[uid];
        const label=q?(q.bank==='mcq'?`MCQ ${q.id}`:`D&D ${q.id}`):`Question ${i+1}`;
        return `<div class="sessionBreakdownRow"><span>${i+1}. ${label}</span><span>${a?fmt(a.timeMs):'Not answered'}</span></div>`;
      }).join('');

      showOnly('sessionResultsScreen');
      document.getElementById('topUser').textContent=`${ACTIVE} • Session Complete`;
      document.getElementById('topAnswered').textContent=`${correct} / ${total} correct`;
      document.getElementById('position').textContent='Completed';
      document.getElementById('score').textContent=`Score ${scorePct}%`;
      document.getElementById('progressBar').style.width='100%';
      window.scrollTo({top:0,behavior:'smooth'});
    }

    document.getElementById('nextBtn').onclick=()=>{
      if(timedActive&&SESSION.i>=activeIds().length-1)finishSession();
      else navigate(1);
    };

    document.getElementById('practiceAgainBtn').onclick=()=>showStart();
    document.getElementById('resultSetupBtn').onclick=()=>showTypes();

    const setupBtn=document.getElementById('setupBtn');
    const switchBtn=document.getElementById('switchBtn');
    setupBtn.onclick=()=>{if(timedActive&&!confirm('End this timed session and change setup?'))return;timedActive=false;stopTimerLoop();timerRow.style.display='none';showTypes()};
    switchBtn.onclick=()=>{if(timedActive&&!confirm('End this timed session and switch user?'))return;timedActive=false;stopTimerLoop();timerRow.style.display='none';showProfiles()};
  }

  if(document.readyState==='complete')setTimeout(init,0);
  else window.addEventListener('load',init,{once:true});
})();
