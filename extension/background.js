const audioByTab = new Map();
const isAudio = (url) => { try { const u=new URL(url); return /^https?:$/.test(u.protocol) && /\.(mp3|m4a|wav|ogg|aac|flac)(?:$|[?#])/i.test(url); } catch {return false;} };
chrome.webRequest.onBeforeRequest.addListener(d=>{
  if(d.tabId<0 || !isAudio(d.url))return;
  const old=audioByTab.get(d.tabId)||[];
  if(!old.some(x=>x.url===d.url)) {old.unshift({url:d.url,at:Date.now()});audioByTab.set(d.tabId,old.slice(0,80));chrome.runtime.sendMessage({type:'audio-updated',tabId:d.tabId}).catch(()=>{});}
},{urls:['<all_urls>']});
chrome.tabs.onRemoved.addListener(id=>audioByTab.delete(id));
chrome.action.onClicked.addListener(async tab=>{await chrome.sidePanel.open({tabId:tab.id});});
chrome.runtime.onMessage.addListener((m,s,reply)=>{
 if(m.type==='list'){reply({items:audioByTab.get(m.tabId)||[]});return;}
 if(m.type==='download'){chrome.downloads.download({url:m.url,saveAs:true},id=>reply({id,error:chrome.runtime.lastError?.message}));return true;}
});
