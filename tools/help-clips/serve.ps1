# BU1 Weekly Plan · a small local web server for tools\help-clips\gen.ps1 (http://localhost:8765/, the app folder)
$root=(Resolve-Path (Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) '..\..')).Path
$l=New-Object System.Net.HttpListener;$l.Prefixes.Add('http://localhost:8765/');$l.Start()
$types=@{'.html'='text/html; charset=utf-8';'.js'='application/javascript; charset=utf-8';'.css'='text/css; charset=utf-8';'.svg'='image/svg+xml';'.png'='image/png';'.json'='application/json';'.woff2'='font/woff2';'.ico'='image/x-icon'}
while($l.IsListening){
  try{$c=$l.GetContext();$p=[Uri]::UnescapeDataString($c.Request.Url.AbsolutePath.TrimStart('/'));if(!$p){$p='index.html'}
    $f=Join-Path $root $p
    if((Test-Path -LiteralPath $f -PathType Leaf) -and ([IO.Path]::GetFullPath($f).StartsWith($root))){$b=[IO.File]::ReadAllBytes($f);$e=[IO.Path]::GetExtension($f).ToLower();$c.Response.ContentType=$(if($types[$e]){$types[$e]}else{'application/octet-stream'});$c.Response.Headers.Add('Cache-Control','no-store');$c.Response.OutputStream.Write($b,0,$b.Length)}
    else{$c.Response.StatusCode=404}
    $c.Response.Close()}catch{}
}
