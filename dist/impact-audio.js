// Broadband pressure impulses and irregular resonances, rendered once at startup.
// No pitch slides or periodic electronic oscillators in the effects.
export function impactSamples(rate,kind,seed=31){
 if(kind==='clash')return clashSamples(rate,seed);
 if(kind==='step')return footstepSamples(rate,seed);
 const settings={quick:[.36,.12,.7],normal:[.85,.26,1],serious:[2.1,.62,1.35],boost:[1.6,.45,1.15],debris:[.65,.19,.65],collapse:[2.5,.8,1.1],step:[.15,.045,.3]};
 const [duration,decay,weight]=settings[kind]||settings.normal,n=Math.ceil(rate*duration),data=new Float32Array(n);let low=0,body=0,air=0,peak=0;
 const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2147483648-1;};
 const a=1-Math.exp(-2*Math.PI*115/rate),b=1-Math.exp(-2*Math.PI*620/rate),c=1-Math.exp(-2*Math.PI*4200/rate);
 for(let i=0;i<n;i++){const t=i/rate,noise=random();low+=a*(noise-low);body+=b*(noise-body);air+=c*(noise-air);
  const onset=1-Math.exp(-t*4500),crack=(noise-air)*Math.exp(-t/(kind==='step'?.009:.015)),thump=low*7*Math.exp(-t/decay),grit=(body-low)*2.8*Math.exp(-t/(decay*.65));
  const scatter=(.55+.45*Math.sin(t*43+Math.sin(t*71))**2),tail=body*scatter*Math.exp(-t/(decay*1.5));
  const shock=(kind==='boost'||kind==='serious')?Math.max(-1,1-t/.009)*Math.exp(-t/.018)*.3:0;
  data[i]=(crack*.5+thump*weight+grit+tail*.6+shock)*onset*Math.min(1,(duration-t)/.04);peak=Math.max(peak,Math.abs(data[i]));
 }
 // Short irregular reflections provide scale without a pitched reverb tail.
 for(const [delay,gain] of [[.047,.13],[.109,.08],[.173,.04]]){const shift=Math.floor(delay*rate);for(let i=n-1;i>=shift;i--)data[i]+=data[i-shift]*gain;}
 peak=0;for(const x of data)peak=Math.max(peak,Math.abs(x));for(let i=0;i<n;i++)data[i]=Math.tanh(data[i]/Math.max(.01,peak)*1.4)*.85;
 return data;
}
export function createImpactBank(context){const bank={};for(const kind of ['quick','normal','serious','boost','debris','collapse','step','clash']){bank[kind]=[];for(let variant=0;variant<2;variant++){const samples=impactSamples(context.sampleRate,kind,31+variant*973+kind.length*7),buffer=context.createBuffer(1,samples.length,context.sampleRate);buffer.getChannelData(0).set(samples);bank[kind].push(buffer);}}return bank;}

// Rounded heel contact followed by a softer sole scuff, without a pressure crack or echo.
function footstepSamples(rate,seed){
 const duration=.22,data=new Float32Array(Math.ceil(rate*duration));let heel=0,sole=0;
 const a=1-Math.exp(-2*Math.PI*170/rate),b=1-Math.exp(-2*Math.PI*950/rate);
 for(let i=0;i<data.length;i++){
  const t=i/rate;seed=(Math.imul(seed,1664525)+1013904223)>>>0;const noise=seed/2147483648-1;
  heel+=a*(noise-heel);sole+=b*(noise-sole);
  const contact=(1-Math.exp(-t/.012))*Math.exp(-t/.032),scuff=Math.exp(-(((t-.075)/.034)**2));
  data[i]=(heel*2.2*contact+(sole-heel)*.16*scuff)*Math.min(1,(duration-t)/.035);
 }
 return data;
}

// A sharp rupture, delayed pressure boom, and decaying irregular city rumble.
function clashSamples(rate,seed){
 const duration=4.2,data=new Float32Array(Math.ceil(rate*duration));let low=0,body=0,air=0,peak=0;
 const filter=f=>1-Math.exp(-2*Math.PI*f/rate),a=filter(65),b=filter(340),c=filter(3800);
 for(let i=0;i<data.length;i++){const t=i/rate;seed=(Math.imul(seed,1664525)+1013904223)>>>0;const noise=seed/2147483648-1;
  low+=a*(noise-low);body+=b*(noise-body);air+=c*(noise-air);
  const pressure=Math.max(0,t-.075),boom=t>.075?(1-Math.exp(-pressure*90))*Math.exp(-pressure/.65):0;
  const rumble=(1-Math.exp(-t*18))*Math.exp(-t/1.15)*(.65+.35*Math.sin(t*17+Math.sin(t*31))**2);
  data[i]=((noise-air)*.85*Math.exp(-t/.018)+low*(12*boom+5*rumble)+(body-low)*2.2*rumble)*(1-Math.exp(-t*4000))*Math.min(1,(duration-t)/.25);
 }
 for(const [delay,gain]of [[.18,.22],[.37,.14],[.62,.08]]){const shift=Math.floor(delay*rate);for(let i=data.length-1;i>=shift;i--)data[i]+=data[i-shift]*gain;}
 for(const x of data)peak=Math.max(peak,Math.abs(x));for(let i=0;i<data.length;i++)data[i]=Math.tanh(data[i]/Math.max(.01,peak)*1.6)*.88;
 return data;
}
