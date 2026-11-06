from PIL import Image, ImageDraw, ImageFont, ImageFilter
import os
R='/home/claude/coach-lol-ia/web/public/'
OUT='/mnt/project-files/instagram/'
os.makedirs(OUT+'publicaciones',exist_ok=True); os.makedirs(OUT+'destacadas',exist_ok=True)
FB='/usr/share/fonts/opentype/inter/InterDisplay-Bold.otf'; FM='/usr/share/fonts/opentype/inter/Inter-Medium.otf'
F=lambda p,s: ImageFont.truetype(p,s)
BG=(10,14,26); SUP=(18,24,41); BOR=(38,49,77); TX=(232,236,245); SUAVE=(139,151,184); OR=(200,170,110); AZ=(79,124,255)
W,H=1080,1350
LOGO=Image.open(R+'iconos/icono-512.png').convert('RGBA')
def cap(n): return Image.open(R+'capturas/'+n+'.webp').convert('RGB')
def base(fondo=None,osc=0.55):
    im=Image.new('RGB',(W,H),BG)
    if fondo:
        f=Image.open(R+fondo).convert('RGB'); s=max(W/f.width,H/f.height); f=f.resize((int(f.width*s)+1,int(f.height*s)+1))
        f=f.crop(((f.width-W)//2,(f.height-H)//2,(f.width-W)//2+W,(f.height-H)//2+H)).filter(ImageFilter.GaussianBlur(3))
        im=Image.blend(f,Image.new('RGB',(W,H),BG),osc)
    # degradado inferior
    g=Image.new('L',(1,H)); [g.putpixel((0,y),int(255*max(0,(y-H*0.35)/(H*0.65))**1.2)) for y in range(H)]
    im.paste(Image.new('RGB',(W,H),BG),(0,0),g.resize((W,H)))
    return im
def wrap(d,t,f,mw):
    out=[];cur=''
    for w in t.split():
        x=(cur+' '+w).strip()
        if d.textlength(x.replace('*',''),font=f)<=mw: cur=x
        else: out.append(cur);cur=w
    out.append(cur);return out
def texto(d,xy,t,f,mw,col=TX,lh=1.18,centro=False):
    x,y=xy
    for l in wrap(d,t,f,mw):
        parts=l.split('*'); tot=sum(d.textlength(p,font=f) for p in parts)
        cx=(W-tot)/2 if centro else x
        for i,p in enumerate(parts):
            d.text((cx,y),p,font=f,fill=OR if i%2 else col); cx+=d.textlength(p,font=f)
        y+=int(f.size*lh)
    return y
def marca(im,d,txt_pie=True):
    im.paste(LOGO.resize((84,84)),(60,54),LOGO.resize((84,84)))
    d.text((160,66),'Coach LoL IA',font=F(FB,40),fill=TX); d.text((160,112),'coachlolia.com',font=F(FM,24),fill=SUAVE)
    if txt_pie: d.text((60,H-62),'Hecho con ayuda de IA · No afiliado a Riot Games',font=F(FM,22),fill=SUAVE)
def chip(d,xy,t,col=OR):
    f=F(FB,30); w=d.textlength(t,font=f); x,y=xy
    d.rounded_rectangle((x,y,x+w+44,y+56),28,fill=col); d.text((x+22,y+10),t,font=f,fill=BG); return y+56
def panel(im,c,box,borde=OR):
    x0,y0,x1,y1=box; c=c.resize((x1-x0,int(c.height*(x1-x0)/c.width)))
    c=c.crop((0,0,c.width,min(c.height,y1-y0)))
    m=Image.new('L',c.size,0); ImageDraw.Draw(m).rounded_rectangle((0,0,c.width-1,c.height-1),24,fill=255)
    sh=Image.new('RGBA',(c.width+60,c.height+60),(0,0,0,0)); ImageDraw.Draw(sh).rounded_rectangle((30,30,c.width+30,c.height+30),24,fill=(0,0,0,170))
    im.paste(sh.filter(ImageFilter.GaussianBlur(18)),(x0-30,y0-14),sh.filter(ImageFilter.GaussianBlur(18)))
    im.paste(c,(x0,y0),m); ImageDraw.Draw(im).rounded_rectangle((x0-3,y0-3,x0+c.width+2,y0+c.height+2),26,outline=borde,width=4)
    return y0+c.height
def guardar(im,n): im.save(OUT+'publicaciones/'+n+'.jpg',quality=92); print(n)

# 01 Portada
im=base('img/splash-yasuo.webp',0.45); d=ImageDraw.Draw(im); marca(im,d)
chip(d,(60,700),'NUEVO')
y=texto(d,(60,790),'Tu *coach de LoL* con IA, en directo y en español',F(FB,92),960)
texto(d,(60,y+20),'Runas en un clic, avisos en partida y análisis claro de cada partida.',F(FM,40),900,SUAVE)
guardar(im,'01-portada')

# 02 Carrusel "Qué hace" (4 diapositivas + cierre)
slides=[('1/5','Runas y objetos *en un clic*','Elige campeón y la app te prepara runas, hechizos y build.','campeon'),
 ('2/5','Un coach que te habla *en partida*','Avisos de objetivos, oleadas y timers mientras juegas.','overlay-partida'),
 ('3/5','Lee la *jungla enemiga*','Te avisa por dónde puede aparecer el jungla rival.','jungla-minimapa'),
 ('4/5','Análisis *al acabar*','Qué hiciste bien, qué fallaste y qué cambiar en la próxima.','partida-objetivos')]
for i,(n,t,s,c) in enumerate(slides):
    im=Image.new('RGB',(W,H),BG); d=ImageDraw.Draw(im); marca(im,d)
    d.text((W-150,74),n,font=F(FB,36),fill=OR)
    y=texto(d,(60,200),t,F(FB,76),960); y=texto(d,(60,y+10),s,F(FM,38),960,SUAVE)
    panel(im,cap(c),(60,y+50,W-60,H-120))
    guardar(im,f'02-que-hace-{i+1}')
im=base('img/splash-jinx.webp',0.5); d=ImageDraw.Draw(im); marca(im,d)
d.text((W-150,74),'5/5',font=F(FB,36),fill=OR)
y=texto(d,(60,760),'Pruébala *gratis*',F(FB,110),960)
y=texto(d,(60,y+10),'Descárgala desde el enlace de la bio. 3 partidas analizadas al mes sin pagar nada.',F(FM,40),940,SUAVE)
chip(d,(60,y+40),'coachlolia.com')
guardar(im,'02-que-hace-5')

# 03..05 Consejos Zed
zed=[('CONSEJO ZED #1','Guarda la *W* para escapar','Si la gastas para farmear, el jungla rival lo sabe. Úsala solo para tradear o salvarte.'),
     ('CONSEJO ZED #2','Primero la *R*, luego el combo','La marca de muerte suma el daño que haces después. Lanza la R antes de Q, E y objetos.'),
     ('CONSEJO ZED #3','Tradea con la *sombra*','W, E y Q desde la sombra: pegas desde lejos y vuelves antes de que te respondan.')]
for i,(k,t,s) in enumerate(zed):
    im=Image.new('RGB',(W,H),SUP); d=ImageDraw.Draw(im)
    d.rectangle((0,0,18,H),fill=OR); marca(im,d)
    chip(d,(60,380),k,AZ)
    y=texto(d,(60,480),t,F(FB,100),960); texto(d,(60,y+30),s,F(FM,44),930,SUAVE)
    d.text((60,H-160),'Guárdalo para tu próxima partida',font=F(FB,34),fill=OR)
    guardar(im,f'0{3+i}-consejo-zed-{i+1}')

# 06 Planes
im=Image.new('RGB',(W,H),BG); d=ImageDraw.Draw(im); marca(im,d)
y=texto(d,(60,200),'Empieza *gratis*. Sube cuando quieras.',F(FB,72),960)
planes=[('Gratis','0 €','3 partidas al mes'),('Aliado','4,99 €/mes','10 partidas al mes'),('Estratega','8,99 €/mes','30 partidas al mes'),('Mariscal','14,99 €/mes','60 partidas al mes'),('Leyenda','24,99 €/mes','120 partidas al mes')]
y+=40
for i,(n,p,q) in enumerate(planes):
    col=OR if i==0 else BOR
    d.rounded_rectangle((60,y,W-60,y+150),24,fill=SUP,outline=col,width=4)
    d.text((100,y+30),n,font=F(FB,48),fill=OR if i==0 else TX); d.text((100,y+92),q,font=F(FM,30),fill=SUAVE)
    d.text((W-100-d.textlength(p,font=F(FB,44)),y+50),p,font=F(FB,44),fill=TX); y+=172
guardar(im,'06-planes')

# 07 Estilos overlay
im=Image.new('RGB',(W,H),BG); d=ImageDraw.Draw(im); marca(im,d)
y=texto(d,(60,200),'Elige el *estilo* de tu overlay',F(FB,72),960)
for n,c in [('Hextech','overlay-estilo-hextech'),('Neón','overlay-estilo-neon'),('Cristal','overlay-estilo-cristal')]:
    ci=cap(c+'-800'); x0=60; yy=y+30
    b=panel(im,ci,(x0,yy,x0+450,yy+290)); d.text((570,yy+110),n,font=F(FB,56),fill=OR); y=b+20
guardar(im,'07-estilos')

# 08 Discord
im=base('img/splash-lux.webp',0.5); d=ImageDraw.Draw(im); marca(im,d)
chip(d,(60,700),'COMUNIDAD',AZ)
y=texto(d,(60,790),'Únete a nuestro *Discord*',F(FB,100),960)
texto(d,(60,y+20),'Dudas, clips, búsqueda de dúo y novedades de la app.  discord.gg/wNrW7tREPJ',F(FM,40),940,SUAVE)
guardar(im,'08-discord')

# 09 Consejo macro
im=Image.new('RGB',(W,H),SUP); d=ImageDraw.Draw(im); d.rectangle((0,0,18,H),fill=OR); marca(im,d)
chip(d,(60,200),'CONSEJO MACRO',AZ)
y=texto(d,(60,290),'Llega al *dragón* antes que ellos',F(FB,80),960)
y=texto(d,(60,y+10),'Empuja tu oleada 30-40 s antes de que salga. Quien llega primero elige la pelea.',F(FM,40),940,SUAVE)
panel(im,cap('partida-dragon'),(60,y+40,W-60,H-120))
guardar(im,'09-consejo-dragon')

# Portadas destacadas (1080x1920)
icons={'App':'▶','Planes':'€','Zed':'Z','Consejos':'★','Discord':'#'}
for n,s in icons.items():
    im=Image.new('RGB',(1080,1920),BG); d=ImageDraw.Draw(im)
    d.ellipse((240,660,840,1260),fill=SUP,outline=OR,width=14)
    f=F(FB,300) if s!='▶' else F('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',260)
    tw=d.textlength(s,font=f); bb=d.textbbox((0,0),s,font=f)
    d.text((540-tw/2,960-(bb[1]+bb[3])/2),s,font=f,fill=OR)
    im.save(OUT+f'destacadas/{n.lower()}.jpg',quality=92); print('dest',n)
