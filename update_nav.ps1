$pages = Get-ChildItem -Path "pages" -Filter "*.html" -Recurse | Where-Object {
    $_.Name -ne "meinteresa.html" -and $_.Name -ne "preregistro.html"
}

foreach ($file in $pages) {
    $content = Get-Content $file.FullName -Raw -Encoding UTF8
    if ($content -match "preregistro\.html") {
        $updated = $content -replace "preregistro\.html", "meinteresa.html" -replace "Pre-registro", "Me Interesa"
        Set-Content -Path $file.FullName -Value $updated -Encoding UTF8
        Write-Host "Updated: $($file.Name)"
    }
}
Write-Host "Done."
