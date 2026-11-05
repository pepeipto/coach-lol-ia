import sys, subprocess, math
from PIL import Image, ImageDraw, ImageFont, ImageFilter
W,H,FPS=1080,1920,30
CAP='/home/claude/coach-lol-ia/web/public/capturas/'
ICON='/home/claude/coach-lol-ia/web/public/iconos/icono-512.png'
FB='/usr/share/fonts/opentype/inter/InterDisplay-Bold.otf'
FR='/usr/share/fonts/opentype/inter/Inter-Regular.otf'
import os
if not os.path.exists(FR): FR=FB
BG=(10,14,26); GOLD=(240,196,90); BLUE=(70,130,255); WHITE=(245,247,252)
def font(p,s): return ImageFont.truetype(p,s)
def ease(t): return 0.5-0.5*math.cos(math.pi*min(max(t,0),1))
def wrap(d,text,f,maxw):
    words=text.split(); lines=[]; cur=''
    for w in words:
        t=(cur+' '+w).strip()
        if d.textlength(t.replace('*',''),font=f)<=maxw: cur=t
        else: lines.append(cur); cur=w
    lines.append(cur); return lines
def draw_rich(d,x,y,line,f):
    # *word* in gold
    parts=line.split('*'); 
    total=sum(d.textlength(p,font=f) for p in parts)
    cx=x-total/2
    for i,p in enumerate(parts):
        col=GOLD if i%2 else WHITE
        d.text((cx+4,y+4),p,font=f,fill=(0,0,0))
        d.text((cx,y),p,font=f,fill=col); cx+=d.textlength(p,font=f)
_cache={}
def img(n):
    if n not in _cache: _cache[n]=Image.open(CAP+n).convert('RGB')
    return _cache[n]
def frame(scene,t,gt,total):
    im=Image.new('RGB',(W,H),BG)
    src=img(scene['img'])
    a,b=scene['from'],scene['to']; k=ease(t)
    box=[a[i]+(b[i]-a[i])*k for i in range(4)]
    # panel area
    PX,PY,PW=40,560,1000
    bw,bh=box[2]-box[0],box[3]-box[1]
    PH=int(PW*bh/bw)
    if PH>820:
        PH=820; PW2=int(PH*bw/bh)
    else: PW2=PW
    PX=(W-PW2)//2; PW=PW2
    crop=src.crop(tuple(int(v) for v in box)).resize((PW,PH),Image.LANCZOS)
    # glow border
    gl=Image.new('RGB',(PW+40,PH+40),BG); ImageDraw.Draw(gl).rounded_rectangle([10,10,PW+30,PH+30],28,fill=BLUE)
    gl=gl.filter(ImageFilter.GaussianBlur(14)); im.paste(gl,(PX-20,PY-20))
    mask=Image.new('L',(PW,PH),0); ImageDraw.Draw(mask).rounded_rectangle([0,0,PW,PH],26,fill=255)
    im.paste(crop,(PX,PY),mask)
    d=ImageDraw.Draw(im)
    # caption
    f=font(FB,92); lines=wrap(d,scene['text'],f,960)
    pop=min(1,t*6); y=200
    for ln in lines:
        draw_rich(d,W/2,y+int((1-pop)*30),ln,f); y+=108
    if scene.get('sub'):
        fs=font(FB,54); 
        for ln in wrap(d,scene['sub'],fs,960):
            tw=d.textlength(ln,font=fs); d.text(((W-tw)/2,PY+PH+70),ln,font=fs,fill=(190,200,225)); 
            PY+=66
    # brand bottom
    ic=Image.open(ICON).convert('RGBA').resize((90,90)); im.paste(ic,(W//2-260,1640),ic)
    d.text((W//2-150,1650),'coachlolia.com',font=font(FB,58),fill=WHITE)
    small=font(FR,30)
    for i,s in enumerate(['Gratis · Solo Windows · Builds EUW/LAN/LAS','Proyecto independiente, no respaldado por Riot Games','Hecho con ayuda de IA']):
        tw=d.textlength(s,font=small); d.text(((W-tw)/2,1745+i*40),s,font=small,fill=(150,160,185))
    # progress bar
    d.rectangle([0,H-10,int(W*gt/total),H],fill=GOLD)
    return im
def render(scenes,out):
    total=sum(s['dur'] for s in scenes)
    p=subprocess.Popen(['ffmpeg','-y','-loglevel','error','-f','rawvideo','-pix_fmt','rgb24','-s',f'{W}x{H}','-r',str(FPS),'-i','-',
      '-f','lavfi','-i','anullsrc=r=44100:cl=stereo','-shortest','-c:v','libx264','-pix_fmt','yuv420p','-crf','20','-c:a','aac','-movflags','+faststart',out],stdin=subprocess.PIPE)
    gt=0
    for s in scenes:
        n=int(s['dur']*FPS)
        for i in range(n):
            p.stdin.write(frame(s,i/n,gt+i/FPS,total).tobytes())
        gt+=s['dur']
    p.stdin.close(); p.wait()
REELS={
 'reel1-runas-un-clic':[
  dict(img='campeon.webp',from_=None,text='Runas de *Esmeralda+* en un clic',sub='Elige campeón y rol',dur=3.5,**{'from':(300,60,1600,860),'to':(320,80,1560,700)}),
  dict(img='campeon.webp',text='% de victorias y nº de partidas',sub='Datos reales de Solo/Dúo',dur=3.5,**{'from':(320,80,1560,700),'to':(470,180,1040,250)}),
  dict(img='campeon.webp',text='Pulsas *Importar*',sub='Crea la página «Coach: Ahri Central»',dur=3,**{'from':(1000,60,1560,360),'to':(1340,100,1560,190)}),
  dict(img='campeon.webp',text='Objetos y *orden de habilidades*',sub='Núcleo, botas y qué subir primero',dur=4,**{'from':(320,680,1560,1000),'to':(940,680,1560,1000)}),
  dict(img='carga.webp',text='*Gratis* y en español',sub='¿Qué campeón pruebo mañana?',dur=4,**{'from':(0,0,1600,1000),'to':(200,120,1400,870)}),
 ],
 'reel2-coach-en-partida':[
  dict(img='overlay-partida.webp',text='Mi coach de LoL *me habla* en partida',sub='En español, con voz',dur=3.5,**{'from':(0,0,1600,1000),'to':(0,200,900,820)}),
  dict(img='overlay-partida.webp',text='Te dice *qué subir*',sub='«Nivel 6: sube la R»',dur=3,**{'from':(0,200,900,820),'to':(0,250,450,360)}),
  dict(img='overlay-partida.webp',text='Y *qué comprar ya*',sub='Cuando te llega el oro',dur=3,**{'from':(500,600,1300,900),'to':(900,760,1280,880)}),
  dict(img='partida-objetivos.webp',text='Tiempos de *dragón, Heraldo y Barón*',sub='Arriba, sin tapar la partida',dur=3.5,**{'from':(0,0,1600,900),'to':(100,0,900,80)}),
  dict(img='jungla-minimapa.webp',text='*Gratis* · solo API oficiales de Riot',sub='¿Le hago caso o no?',dur=4,**{'from':(0,0,1600,1600),'to':(200,200,1400,1400)}),
 ]}
for name,sc in REELS.items():
    for s in sc: s.pop('from_',None)
    render(sc,f'/mnt/project-files/reels/{name}.mp4'); print('ok',name)
