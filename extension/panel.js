const $=id=>document.getElementById(id);let currentFile=null,result=null;
// Remove the obsolete Groq credential left by older versions.
chrome.storage.local.remove('groqKey');
const singleFileWarning='多题听力请逐题单独下载音频文件并分别转写、翻译，避免不同题目内容混在一起。';
const escapeHtml=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const tabs=()=>chrome.tabs.query({active:true,currentWindow:true});
document.querySelectorAll('nav button').forEach(b=>b.onclick=()=>{document.querySelectorAll('nav button').forEach(x=>x.classList.toggle('active',x===b));['audio','result','history','settings'].forEach(x=>$(x).hidden=x!==b.dataset.view);if(b.dataset.view==='history')loadHistory();});
const showResult=()=>document.querySelector('[data-view="result"]').click();
async function refresh(){const [tab]=await tabs();const r=await chrome.runtime.sendMessage({type:'list',tabId:tab.id});$('items').replaceChildren();for(const a of r.items){const el=document.createElement('div');el.className='item';const name=decodeURIComponent(new URL(a.url).pathname.split('/').pop()||'audio').slice(0,120);el.innerHTML=`<b>${escapeHtml(name)}</b><br><small>${escapeHtml(a.url.slice(0,180))}</small><br>`;const btn=document.createElement('button');btn.textContent='下载';btn.onclick=async()=>{const out=await chrome.runtime.sendMessage({type:'download',url:a.url});if(out.error)alert(out.error)};el.append(btn);$('items').append(el);}if(!r.items.length)$('items').textContent='尚未检测到音频。请先播放网页音频。';}
$('refresh').onclick=refresh;chrome.runtime.onMessage.addListener(m=>{if(m.type==='audio-updated')refresh();});
$('file').onchange=e=>{currentFile=e.target.files[0];$('selected').textContent=currentFile?.name||''};
const joinedEnglish=()=>result?.segments.map(s=>s.text.trim()).filter(Boolean).join(' ').replace(/\\s+/g,' ').trim()||'';
const joinedChinese=()=>result?.segments.map(s=>s.translation?.trim()).filter(Boolean).join('').trim()||'';
function render(){
  if(!result)return;
  $('status').textContent=`${result.filename||''} · ${result.segments.length} 段已合并`;
  $('segments').replaceChildren();
  for(const [title,value] of [['英文原文',joinedEnglish()],['中文翻译',joinedChinese()||'尚未翻译，点击上方「翻译成中文」。']]){
    const group=document.createElement('article');group.className='text-block';
    const h=document.createElement('h3');h.textContent=title;
    const text=document.createElement('p');text.className='continuous-text';text.textContent=value;
    group.append(h,text);$('segments').append(group);
  }
}
function time(n){let m=Math.floor(n/60),s=Math.floor(n%60);return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`}
async function save(){const {history=[]}=await chrome.storage.local.get('history');const idx=history.findIndex(x=>x.id===result.id);if(idx>=0)history.splice(idx,1);history.unshift(result);await chrome.storage.local.set({history:history.slice(0,100)});}
async function local(file){
  const ctx=new AudioContext();let audio;
  try{
    const b=await ctx.decodeAudioData(await file.arrayBuffer());
    const offline=new OfflineAudioContext(1,Math.ceil(b.duration*16000),16000);
    const mono=offline.createBuffer(1,b.length,b.sampleRate);
    for(let c=0;c<b.numberOfChannels;c++){
      const src=b.getChannelData(c),dst=mono.getChannelData(0);
      for(let i=0;i<src.length;i++)dst[i]+=src[i]/b.numberOfChannels;
    }
    const source=offline.createBufferSource();source.buffer=mono;source.connect(offline.destination);source.start();
    audio=(await offline.startRendering()).getChannelData(0);
  }finally{await ctx.close()}
  const {localModel='tiny_en'}=await chrome.storage.local.get('localModel');
  return new Promise((resolve,reject)=>{
    const w=new Worker(chrome.runtime.getURL('local-worker.js'),{type:'module'});
    const timeout=setTimeout(()=>{w.terminate();reject(Error('本地识别超时'))},900000);
    w.onmessage=({data})=>{
      if(data.progress){$('progress').textContent=data.progress;return}
      clearTimeout(timeout);w.terminate();
      data.error?reject(Error(data.error)):resolve(data.segments);
    };
    w.onerror=e=>{clearTimeout(timeout);w.terminate();reject(Error(e.message||'Worker 运行失败'))};
    w.postMessage({audio,modelKey:localModel},[audio.buffer]);
  });
}
$('transcribe').onclick=async()=>{if(!currentFile)return alert('请先选择单个听力音频文件');$('transcribe').disabled=true;$('progress').textContent='正在转写…';try{const segments=await local(currentFile);result={id:crypto.randomUUID(),filename:currentFile.name,created:Date.now(),segments};await save();render();showResult();$('progress').textContent='完成'}catch(e){$('progress').textContent='失败：'+e.message}finally{$('transcribe').disabled=false}};
$('translate').onclick=async()=>{if(!result)return alert('请先转写');const {deepseekKey}=await chrome.storage.local.get('deepseekKey');if(!deepseekKey)return alert('请在设置中填写 DeepSeek API Key，或使用网页版分析');$('translate').disabled=true;try{const r=await fetch('https://api.deepseek.com/chat/completions',{method:'POST',headers:{Authorization:'Bearer '+deepseekKey,'Content-Type':'application/json'},body:JSON.stringify({model:'deepseek-chat',temperature:0,messages:[{role:'system',content:'Translate each English segment into Simplified Chinese. Return only a JSON array of strings in the original order.'},{role:'user',content:JSON.stringify(result.segments.map(s=>s.text))}]})});if(!r.ok)throw Error('DeepSeek '+r.status+': '+(await r.text()).slice(0,250));let t=(await r.json()).choices[0].message.content.replace(/^```(?:json)?\s*/,'').replace(/\s*```$/,'');const a=JSON.parse(t);if(!Array.isArray(a)||a.length!==result.segments.length)throw Error('返回段落数量不一致');result.segments.forEach((s,i)=>s.translation=String(a[i]||''));await save();render()}catch(e){alert('翻译失败：'+e.message)}finally{$('translate').disabled=false}};
const textResult=()=>[joinedEnglish(),joinedChinese()].filter(Boolean).join('\n\n');
$('copy').onclick=()=>navigator.clipboard.writeText(textResult());
$('deepseek').onclick=async()=>{if(!result)return alert('请先转写');const prompt='下面仅为单个听力文件的转写内容。请根据原文分析，并结合我接下来手动粘贴的题目及选项进行讲解。不要推测不存在的题目或将其他题目混入。\n\n'+textResult()+'\n\n【请用户手动粘贴本题题干与全部选项】';await navigator.clipboard.writeText(prompt);await chrome.tabs.create({url:'https://chat.deepseek.com/'});alert('已复制听力原文和指令。请在 DeepSeek 聊天框粘贴后，手动补充对应题目的题干及全部选项，再发送。')};
function downloadText(name,content,type='text/plain'){const a=document.createElement('a');const u=URL.createObjectURL(new Blob([content],{type}));a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000)}
$('export').onclick=()=>{if(result)downloadText('transcript.txt',textResult())};
$('srt').onclick=()=>{if(!result)return;const stamp=n=>{let h=Math.floor(n/3600),m=Math.floor(n%3600/60),s=Math.floor(n%60),ms=Math.round((n%1)*1000);return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')},${String(ms).padStart(3,'0')}`};downloadText('subtitles.srt',result.segments.map((s,i)=>`${i+1}\n${stamp(s.start)} --> ${stamp(s.end)}\n${s.text}${s.translation?'\n'+s.translation:''}\n`).join('\n'))};
async function loadHistory(){const {history=[]}=await chrome.storage.local.get('history');$('records').replaceChildren();for(const r of history){const el=document.createElement('div');el.className='record';el.innerHTML=`<b>${escapeHtml(r.filename)}</b><br><small>${new Date(r.created).toLocaleString()}</small><br>`;const b=document.createElement('button');b.textContent='查看';b.onclick=()=>{result=r;render();showResult()};el.append(b);$('records').append(el)}if(!history.length)$('records').textContent='暂无记录'}
$('clear').onclick=async()=>{if(confirm('确认删除所有历史记录？')){await chrome.storage.local.remove('history');loadHistory()}};
refresh();

(async()=>{const s=await chrome.storage.local.get(['deepseekKey','localModel']);$('localModel').value=s.localModel||'tiny_en';$('deepseekKey').value=s.deepseekKey||''})();$('saveSettings').onclick=async()=>{await chrome.storage.local.set({localModel:$('localModel').value,deepseekKey:$('deepseekKey').value.trim()});$('settingsStatus').textContent='设置已保存'};
