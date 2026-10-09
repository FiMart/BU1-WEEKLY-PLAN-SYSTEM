# BU1 Weekly Plan · makes the frames of the help clips (assets/help/<frame>.jpg) from the app itself.
# Needs: Microsoft Edge, and serve.ps1 (this folder) running on http://localhost:8765/.
# Usage:  powershell -File tools\help-clips\gen.ps1            (all frames)
#         powershell -File tools\help-clips\gen.ps1 -Only add-1,view-3
# Each frame: the app (sample data, light theme + clipgen.html) inside a fixed iframe (1280 x 800, phone 390 x 844) in
# __clip.html; one headless run takes the screenshot, a second one prints the highlight box. Copy the printed boxes into
# the r:[x,y,w,h] of js/views/help-clips.js when a screen has moved.
param([string]$Only='')
Add-Type -AssemblyName System.Drawing
$sp=Split-Path -Parent $MyInvocation.MyCommand.Path
$root=(Resolve-Path (Join-Path $sp '..\..')).Path
$tmp=Join-Path $env:TEMP 'bu1-help-clips';New-Item -ItemType Directory -Force -Path $tmp | Out-Null
$out=Join-Path $root 'assets\help'
if(-not (Test-Path -LiteralPath $out)){New-Item -ItemType Directory -Path $out | Out-Null}
$edge="${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe"
# the app with the light theme + the frame generator
$base=[IO.File]::ReadAllText("$root\index.html")
$html=$base -replace '(<script src="js/config.js"></script>)','$1<script>BU1_CONFIG.supabaseUrl="";try{localStorage.setItem("bu1wp.prefs.local",JSON.stringify({pmode:"week"}))}catch(e){}</script>'
foreach($one in 'lightx.html','clipgen.html'){$s=[IO.File]::ReadAllText("$sp\$one");$html=$html -replace '</body>',($s+'</body>')}
[IO.File]::WriteAllText("$root\__shot.html",$html,(New-Object Text.UTF8Encoding($false)))
$wrap=@'
<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0;background:#222">
<iframe id="f" style="position:fixed;left:0;top:0;border:0;background:#fff"></iframe>
<pre id="res" style="position:fixed;left:0;top:0;max-height:0;overflow:hidden;margin:0"></pre>
<script>var p=new URLSearchParams(location.search);var f=document.getElementById('f');f.style.width=(p.get('w')||1280)+'px';f.style.height=(p.get('h')||800)+'px';
f.src='__shot.html?f='+p.get('f')+'&r='+Math.random()+'#'+(p.get('v')||'plan');
var t=setInterval(function(){try{var W=f.contentWindow;if(W.__READY){clearInterval(t);document.getElementById('res').textContent=JSON.stringify({r:W.__RECT,e:W.__ERR||null})}}catch(e){}},100);</script></body></html>
'@
[IO.File]::WriteAllText("$root\__clip.html",$wrap,(New-Object Text.UTF8Encoding($false)))
$frames=@('add-1','add-2','add-3','add-4','add-5','add-6','add-7','view-1','view-2','view-3','view-4','view-5','pick-1','pick-2','pick-3','pick-4','pick-5','filter-1','filter-2','filter-3','filter-4','share-1','share-2','share-3','share-4','pages-1','pages-2','pages-3','pages-4','phone-1','phone-2','phone-3','phone-4')
if($Only){$frames=$Only.Split(',')}
$jpg=[System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders()|Where-Object{$_.MimeType -eq 'image/jpeg'}
$ep=New-Object System.Drawing.Imaging.EncoderParameters 1;$ep.Param[0]=New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality,[long]80)
foreach($fid in $frames){
  $phone=$fid -like 'phone-*';$W=if($phone){390}else{1280};$H=if($phone){844}else{800};$WW=if($phone){800}else{1280}
  $url="http://localhost:8765/__clip.html?f=$fid&w=$W&h=$H&v=plan"
  $png="$tmp\clip-$fid.png"
  $prof=Join-Path $env:TEMP ("edgeclip-"+[guid]::NewGuid().ToString('N').Substring(0,8))
  $p=Start-Process -FilePath $edge -ArgumentList @('--headless','--disable-gpu','--no-first-run','--hide-scrollbars',"--user-data-dir=$prof","--window-size=$WW,$H",'--virtual-time-budget=20000',"--screenshot=$png",$url) -PassThru -WindowStyle Hidden
  $null=$p.WaitForExit(60000)
  $prof2=Join-Path $env:TEMP ("edgeclip-"+[guid]::NewGuid().ToString('N').Substring(0,8))
  $dom="$tmp\clipdom-$fid.txt"
  $p=Start-Process -FilePath $edge -ArgumentList @('--headless','--disable-gpu','--no-first-run','--hide-scrollbars',"--user-data-dir=$prof2","--window-size=$WW,$H",'--virtual-time-budget=20000','--dump-dom',$url) -RedirectStandardOutput $dom -PassThru -WindowStyle Hidden
  $null=$p.WaitForExit(60000)
  $s='';for($i=0;$i -lt 20;$i++){try{$s=[IO.File]::ReadAllText($dom);break}catch{Start-Sleep 1}}
  $m=[regex]::Match($s,'<pre id="res"[^>]*>(.*?)</pre>',[Text.RegularExpressions.RegexOptions]::Singleline)
  $json=[Net.WebUtility]::HtmlDecode($m.Groups[1].Value)
  if(Test-Path -LiteralPath $png){
    $img=[System.Drawing.Image]::FromFile($png);$bmp=New-Object System.Drawing.Bitmap $W,$H;$g=[System.Drawing.Graphics]::FromImage($bmp)
    $g.DrawImage($img,(New-Object System.Drawing.Rectangle 0,0,$W,$H),(New-Object System.Drawing.Rectangle 0,0,$W,$H),[System.Drawing.GraphicsUnit]::Pixel);$g.Dispose();$img.Dispose()
    $bmp.Save((Join-Path $out "$fid.jpg"),$jpg,$ep);$bmp.Dispose()
  }
  "$fid $json"
}
# the two temporary pages in the app folder are not needed any more
foreach($n in '__shot.html','__clip.html'){$t=Join-Path $root $n;if(Test-Path -LiteralPath $t){[IO.File]::Delete($t)}}
