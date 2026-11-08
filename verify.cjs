const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
const elements=new Map(),stored=new Map();const element=()=>({textContent:'',innerHTML:'',classList:{add(){},remove(){},toggle(){}},showModal(){this.open=true},close(){this.open=false},focus(){},open:false});
const context={console,crypto:{randomUUID},localStorage:{getItem:k=>stored.get(k),setItem:(k,v)=>stored.set(k,v)},document:{querySelector:s=>{if(!elements.has(s))elements.set(s,element());return elements.get(s)},querySelectorAll:()=>[],body:element(),addEventListener(){}},window:{addEventListener(){},scrollTo(){}},location:{hash:''},setTimeout:()=>0,clearTimeout(){},setInterval(){},URL,Blob,Map,Date};vm.createContext(context);vm.runInContext(fs.readFileSync('app.js','utf8'),context);
vm.runInContext(`
loadDemo();
if(live('tasks').length!==3)throw Error('Demo tasks');
if(live('meetings')[0].contact!==live('contacts')[0].id)throw Error('Contact relation');
const serialized=JSON.stringify(db); const restored=validate(JSON.parse(serialized));
if(restored.tasks.length!==3)throw Error('Backup round trip');
let rejected=false;try{validate({version:1,profile:{name:'x'},tasks:'bad'})}catch{rejected=true}if(!rejected)throw Error('Invalid import accepted');
for(const v of Object.keys(views)){view=v;render();if(!$('#main').innerHTML)throw Error('Empty view '+v)}
const task=db.tasks[0];toggleTimer(task.id);if(!task.startedAt)throw Error('Timer not started');toggleTimer(task.id);if(task.startedAt)throw Error('Timer not stopped');
task.deletedAt='now';if(live('tasks').length!==2)throw Error('Soft delete');delete task.deletedAt;if(live('tasks').length!==3)throw Error('Restore');
if(esc('<img src=x onerror=alert(1)>').includes('<img'))throw Error('Escaping');
if(!persist())throw Error('Persistence');
`,context);assert.ok(stored.get('mininotion.v1'));console.log('PASS: all views, linked demo records, backup validation, timer, trash/restore, escaping, local persistence');
