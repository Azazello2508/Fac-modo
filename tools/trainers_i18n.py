"""Вставляет перевод (английский и украинский) в тренажёры games/trenazhery*.html.

Запуск: python tools/trainers_i18n.py
Потом заново встроить игры в index.html: python tools/embed_tanchiki.py games/<файл>.html <блок> (блоки: tr-src, tm-src, ts-src, te-src).

Как это работает. В игры русский текст вшит прямо в код. Поэтому в каждую игру между маркерами
<!--fm-i18n--> и <!--/fm-i18n--> вставляется маленький слой перевода: словарь «русская фраза → [английский, украинский]»
(tools/trainers_i18n/<игра>.json) и код, который заменяет эти фразы в тексте страницы и на холсте (fillText).
Язык приложение передаёт игре само (index.html, fmGame: window.FM_LANG). Если язык русский, слой ничего не делает.
Чтобы поправить перевод, правят JSON-файл и запускают этот скрипт заново (он безопасен при повторном запуске).
Если в игру добавили новый русский текст, его надо добавить в JSON, иначе он останется русским.
"""
import json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GAMES = ["trenazhery", "trenazhery-mech", "trenazhery-ship", "trenazhery-el"]
# единицы из одной буквы (в словари из кода они не попали): вольты, амперы, метры, секунды, часы
COMMON = {"В": ["V", "В"], "А": ["A", "А"], "м": ["m", "м"], "с": ["s", "с"], "ч": ["h", "год"]}
BEGIN, END = "<!--fm-i18n-->", "<!--/fm-i18n-->"

LAYER = r"""<script>(function(){var L=window.FM_LANG||"ru",TR=(L==="en"||L==="uk"),X=L==="en"?0:1,D=__DICT__;
if(TR)document.documentElement.lang=L;var CY=/[А-Яа-яЁё]/,ND=/(?<![\d.,])(\d+)[.,](\d+)(?![\d.,])/g,HN=/\d[.,]\d/;
var keys=Object.keys(D).sort(function(a,b){return b.length-a.length});
function esc(s){return s.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}var re=TR?new RegExp(keys.map(esc).join("|"),"g"):null,cache=new Map();
/* число: английский пишет десятичную точку, русский и украинский запятую */
var SEP=L==="en"?".":",";function num(s){return s.replace(ND,function(m,a,b){return a+SEP+b})}
/* перевод одной строки: самые длинные фразы первыми, фраза не должна начинаться или кончаться внутри русского слова */
function T(s){if(typeof s!=="string")return s;var hc=TR&&CY.test(s),hn=HN.test(s);if(!hc&&!hn)return s;var c=cache.get(s);if(c!==undefined)return c;var r=s;
 if(hc)r=r.replace(re,function(m,o,str){var v=D[m];if(!v)return m;if(CY.test(m.charAt(0))&&o>0&&CY.test(str.charAt(o-1)))return m;
  if(CY.test(m.charAt(m.length-1))&&CY.test(str.charAt(o+m.length)))return m;return v[X]});
 if(hn)r=num(r);
 if(cache.size>4000)cache.clear();cache.set(s,r);return r}
window.FM_T=T;var AT=["title","placeholder","aria-label"],done=new WeakMap();
function attrs(n){for(var i=0;i<AT.length;i++){var v=n.getAttribute(AT[i]);if(v){var r=T(v);if(r!==v)n.setAttribute(AT[i],r)}}}
function node(n){if(n.nodeType===3){var v=n.nodeValue;if(done.get(n)===v)return;var r=T(v);if(r!==v)n.nodeValue=r;done.set(n,n.nodeValue)}
 else if(n.nodeType===1){var t=n.tagName;if(t==="SCRIPT"||t==="STYLE")return;attrs(n);for(var c=n.firstChild;c;c=c.nextSibling)node(c)}}
/* холст: тексты рисуются через fillText/strokeText, меряются через measureText.
   На узком экране холст сжимается, и мелкие подписи становятся нечитаемыми: поднимаем шрифт так,
   чтобы на экране он был не меньше 12 пикселей, но не больше чем в 1,4 раза от задуманного */
var P=window.CanvasRenderingContext2D&&CanvasRenderingContext2D.prototype,FS=/(\d+(?:\.\d+)?)px/,sc=new WeakMap();
function scale(c){var t=performance.now(),e=sc.get(c);if(e&&t-e.t<250)return e.k;var w=c.getBoundingClientRect().width,k=w>20?c.width/w:1;sc.set(c,{t:t,k:k});return k}
if(P)["fillText","strokeText","measureText"].forEach(function(f){var o=P[f];P[f]=function(s){arguments[0]=T(s);var k=scale(this.canvas),fo=this.font,m=FS.exec(fo),ch=false;
 if(m&&k>1){var z=+m[1],w=Math.min(12*k,z*1.4);if(w>z+0.5){this.font=fo.replace(FS,(Math.round(w*10)/10)+"px");ch=true}}
 var r=o.apply(this,arguments);if(ch)this.font=fo;return r}});
function start(){node(document.documentElement);new MutationObserver(function(ms){ms.forEach(function(m){
  if(m.type==="characterData")node(m.target);else if(m.type==="attributes")attrs(m.target);else for(var i=0;i<m.addedNodes.length;i++)node(m.addedNodes[i])})})
 .observe(document.documentElement,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:AT})}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start);else start()})();</script>"""


def build(game):
    d = json.load(open(os.path.join(ROOT, "tools", "trainers_i18n", game + ".json"), encoding="utf-8"))
    d = dict(COMMON, **d)
    js = json.dumps(d, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
    return BEGIN + LAYER.replace("__DICT__", js) + END


def main():
    for g in GAMES:
        p = os.path.join(ROOT, "games", g + ".html")
        s = open(p, encoding="utf-8", newline="").read()
        nl = "\r\n" if "\r\n" in s else "\n"
        s = re.sub(re.escape(BEGIN) + r".*?" + re.escape(END), "", s, flags=re.S)
        i = s.index("<head>") + len("<head>")
        s = s[:i] + build(g).replace("\n", nl) + s[i:]
        open(p, "w", encoding="utf-8", newline="").write(s)
        print(g, "ok", len(s.encode("utf-8")))


if __name__ == "__main__":
    main()
