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

LAYER = r"""<script>(function(){var L=window.FM_LANG;if(L!=="en"&&L!=="uk")return;var X=L==="en"?0:1,D=__DICT__;
document.documentElement.lang=L;var CY=/[А-Яа-яЁё]/,keys=Object.keys(D).sort(function(a,b){return b.length-a.length});
function esc(s){return s.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}var re=new RegExp(keys.map(esc).join("|"),"g"),cache=new Map();
/* перевод одной строки: самые длинные фразы первыми, фраза не должна начинаться или кончаться внутри русского слова */
function T(s){if(typeof s!=="string"||!CY.test(s))return s;var c=cache.get(s);if(c!==undefined)return c;
 var r=s.replace(re,function(m,o,str){var v=D[m];if(!v)return m;if(CY.test(m.charAt(0))&&o>0&&CY.test(str.charAt(o-1)))return m;
  if(CY.test(m.charAt(m.length-1))&&CY.test(str.charAt(o+m.length)))return m;return v[X]});
 if(cache.size>4000)cache.clear();cache.set(s,r);return r}
window.FM_T=T;var AT=["title","placeholder","aria-label"],done=new WeakMap();
function attrs(n){for(var i=0;i<AT.length;i++){var v=n.getAttribute(AT[i]);if(v&&CY.test(v)){var r=T(v);if(r!==v)n.setAttribute(AT[i],r)}}}
function node(n){if(n.nodeType===3){var v=n.nodeValue;if(!CY.test(v)||done.get(n)===v)return;var r=T(v);if(r!==v)n.nodeValue=r;done.set(n,n.nodeValue)}
 else if(n.nodeType===1){var t=n.tagName;if(t==="SCRIPT"||t==="STYLE")return;attrs(n);for(var c=n.firstChild;c;c=c.nextSibling)node(c)}}
/* холст: тексты рисуются через fillText/strokeText, меряются через measureText */
var P=window.CanvasRenderingContext2D&&CanvasRenderingContext2D.prototype;
if(P)["fillText","strokeText","measureText"].forEach(function(f){var o=P[f];P[f]=function(s){arguments[0]=T(s);return o.apply(this,arguments)}});
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
