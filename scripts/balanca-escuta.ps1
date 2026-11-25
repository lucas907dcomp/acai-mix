param([int]$Minutos = 20, [string]$Porta = 'COM8', [int]$Baud = 9600, [int]$DepoisSeg = 15)
# Escuta fixa + ENQ a cada 300 ms (igual ao PDV). Encerra DepoisSeg após o 1º byte.
$fim = (Get-Date).AddMinutes($Minutos); $primeiro = $null; $p = $null; $enq = 0; $tot = 0
$buf = New-Object System.Collections.Generic.List[byte]; $ultimo = Get-Date
function Show-Lote($b) {
  $n = [Math]::Min($b.Count, 96); $a = $b.ToArray()[0..($n - 1)]
  "{0:HH:mm:ss.fff} {1,3} bytes | {2} | {3}" -f (Get-Date), $b.Count, (($a | ForEach-Object { $_.ToString('X2') }) -join ' '), (-join ($a | ForEach-Object { if ($_ -ge 32 -and $_ -lt 127) { [char]$_ } else { '.' } }))
}
while ((Get-Date) -lt $fim) {
  try {
    if (-not $p -or -not $p.IsOpen) {
      $p = New-Object System.IO.Ports.SerialPort $Porta, $Baud, 'None', 8, 'One'
      $p.DtrEnable = $true; $p.RtsEnable = $false; $p.Open(); "{0:HH:mm:ss} porta aberta {1}" -f (Get-Date), $Baud; $tEnq = Get-Date
    }
    if (((Get-Date) - $tEnq).TotalMilliseconds -gt 300) { $p.Write([byte[]](5), 0, 1); $enq++; $tEnq = Get-Date }
    while ($p.BytesToRead -gt 0) { $buf.Add([byte]$p.ReadByte()); $tot++; $ultimo = Get-Date; if (-not $primeiro) { $primeiro = Get-Date } }
    if ($buf.Count -gt 0 -and (((Get-Date) - $ultimo).TotalMilliseconds -gt 60 -or $buf.Count -ge 96)) { Show-Lote $buf; $buf.Clear() }
    if ($primeiro -and ((Get-Date) - $primeiro).TotalSeconds -gt $DepoisSeg) { break }
    Start-Sleep -Milliseconds 10
  } catch { "{0:HH:mm:ss} porta caiu/ocupada: {1}" -f (Get-Date), $_.Exception.Message; try { $p.Close() } catch {}; $p = $null; Start-Sleep -Seconds 2 }
}
if ($p -and $p.IsOpen) { $p.Close() }
"FIM: $tot bytes, $enq ENQs enviados"
