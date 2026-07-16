<!-- Para generar la estrutra actualizada,ejecuta este comando en la terminal(asegurate de estar en la raiz);


**

$exclude = @(".git", ".vs", ".vscode", ".cache", ".idea", "node_modules", "build", "out", "dist", "__pycache__", "target", ".next", ".nuxt", ".output", ".turbo", "coverage", ".parcel-cache", ".svelte-kit", "Cargo.lock", "package-lock.json"); function T{param($p,$i="")Get-ChildItem $p -Force -EA 0|?{$_.Name -notin $exclude -and !$_.Name.StartsWith(".")}|Sort{!$_.PSIsContainer},Name|%{if($_.PSIsContainer){"$i📁 $($_.Name)";T $_.FullName "$i   "}else{"$i📄 $($_.Name)"}}}; T "." | Tee-Object -FilePath "arbol.txt"

**

 -->