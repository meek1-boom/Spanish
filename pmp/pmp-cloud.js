(function(){
  const VERSION='10.12.5';
  const PROFILE_NAMES=['Mike','Kira'];
  const writeTimers=new Map();
  let app=null,auth=null,db=null,mods=null,userPromise=null;

  function isConfigured(){
    const c=window.PMP_FIREBASE_CONFIG;
    return !!(c&&c.apiKey&&c.authDomain&&c.projectId&&c.appId);
  }

  function clone(x){return JSON.parse(JSON.stringify(x||{}))}
  function profileSlug(name){return String(name||'').toLowerCase()}
  function emptyProfile(){return {dragResults:{},mcqResults:{},sessions:{},sessionHistory:[]}}

  function normalizeProfile(p){
    const x=Object.assign(emptyProfile(),clone(p));
    x.dragResults=x.dragResults||{};
    x.mcqResults=x.mcqResults||{};
    x.sessions=x.sessions||{};
    x.sessionHistory=Array.isArray(x.sessionHistory)?x.sessionHistory:[];
    return x;
  }

  function newer(a,b){
    const at=Number(a&&a.ts)||Number(a&&a.updatedAt)||0;
    const bt=Number(b&&b.ts)||Number(b&&b.updatedAt)||0;
    return at>=bt;
  }

  function mergeResults(local={},remote={}){
    const out=Object.assign({},remote);
    Object.keys(local).forEach(k=>{
      if(!out[k]||newer(local[k],out[k]))out[k]=local[k];
    });
    return out;
  }

  function mergeSessions(local={},remote={}){
    const out=Object.assign({},remote);
    Object.keys(local).forEach(k=>{
      const l=local[k],r=out[k];
      if(!r||Number(l&&l.updatedAt||0)>=Number(r&&r.updatedAt||0))out[k]=l;
    });
    return out;
  }

  function mergeHistory(local=[],remote=[]){
    const seen=new Set();
    return remote.concat(local).filter(item=>{
      if(!item||!item.ts)return false;
      const key=[item.ts,item.type,item.domain,item.count,item.score].join('|');
      if(seen.has(key))return false;
      seen.add(key);
      return true;
    }).sort((a,b)=>(b.ts||0)-(a.ts||0)).slice(0,50);
  }

  function mergeProfiles(localProfile,remoteProfile){
    const local=normalizeProfile(localProfile);
    const remote=normalizeProfile(remoteProfile);
    const merged=normalizeProfile(remote);
    merged.dragResults=mergeResults(local.dragResults,remote.dragResults);
    merged.mcqResults=mergeResults(local.mcqResults,remote.mcqResults);
    merged.sessions=mergeSessions(local.sessions,remote.sessions);
    merged.sessionHistory=mergeHistory(local.sessionHistory,remote.sessionHistory);
    merged.updatedAt=Math.max(Number(local.updatedAt)||0,Number(remote.updatedAt)||0,Date.now());
    return merged;
  }

  async function init(){
    if(!isConfigured())return null;
    if(app)return {app,auth,db};
    const [appMod,authMod,firestoreMod]=await Promise.all([
      import(`https://www.gstatic.com/firebasejs/${VERSION}/firebase-app.js`),
      import(`https://www.gstatic.com/firebasejs/${VERSION}/firebase-auth.js`),
      import(`https://www.gstatic.com/firebasejs/${VERSION}/firebase-firestore.js`)
    ]);
    mods={appMod,authMod,firestoreMod};
    app=appMod.getApps().length?appMod.getApp():appMod.initializeApp(window.PMP_FIREBASE_CONFIG);
    auth=authMod.getAuth(app);
    await authMod.setPersistence(auth,authMod.browserLocalPersistence);
    db=firestoreMod.getFirestore(app);
    firestoreMod.enableIndexedDbPersistence(db).catch(()=>{});
    userPromise=new Promise(resolve=>{
      const off=authMod.onAuthStateChanged(auth,u=>{off();resolve(u||null)});
    });
    return {app,auth,db};
  }

  async function readyUser(){
    await init();
    return userPromise?userPromise:null;
  }

  async function signIn(email,password){
    await init();
    const cred=await mods.authMod.signInWithEmailAndPassword(auth,email,password);
    userPromise=Promise.resolve(cred.user);
    return cred.user;
  }

  async function signOut(){
    if(!auth)return;
    await mods.authMod.signOut(auth);
    userPromise=Promise.resolve(null);
  }

  function currentUser(){return auth&&auth.currentUser}
  function profileRef(name){
    const uid=currentUser()&&currentUser().uid;
    if(!uid)throw new Error('Not signed in');
    return mods.firestoreMod.doc(db,'pmpProgress',uid,'profiles',profileSlug(name));
  }

  async function loadProfile(name,localProfile){
    await init();
    if(!currentUser())return normalizeProfile(localProfile);
    const ref=profileRef(name);
    const snap=await mods.firestoreMod.getDoc(ref);
    const remote=snap.exists()?snap.data().profile:null;
    const merged=mergeProfiles(localProfile,remote);
    await mods.firestoreMod.setDoc(ref,{profile:clone(merged),updatedAt:Date.now(),updatedAtServer:mods.firestoreMod.serverTimestamp()},{merge:true});
    return merged;
  }

  function saveProfile(name,profile){
    if(!db||!currentUser()||!PROFILE_NAMES.includes(name))return;
    clearTimeout(writeTimers.get(name));
    writeTimers.set(name,setTimeout(async()=>{
      try{
        const clean=normalizeProfile(profile);
        clean.updatedAt=Date.now();
        await mods.firestoreMod.setDoc(profileRef(name),{profile:clone(clean),updatedAt:clean.updatedAt,updatedAtServer:mods.firestoreMod.serverTimestamp()},{merge:true});
      }catch(err){
        console.warn('PMP cloud save failed',err);
      }
    },700));
  }

  function watchProfile(name,onRemote){
    if(!db||!currentUser())return null;
    return mods.firestoreMod.onSnapshot(profileRef(name),snap=>{
      if(snap.exists())onRemote(normalizeProfile(snap.data().profile));
    },err=>console.warn('PMP cloud watch failed',err));
  }

  window.PMP_SYNC={isConfigured,init,readyUser,signIn,signOut,currentUser,loadProfile,saveProfile,watchProfile,mergeProfiles,normalizeProfile};
})();
