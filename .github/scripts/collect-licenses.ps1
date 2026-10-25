param(
    [Parameter(Mandatory = $true)]
    [string]$OutputDirectory
)

$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$licenseRoot = [System.IO.Path]::GetFullPath($OutputDirectory)
$goOutput = Join-Path $licenseRoot 'go'
$npmOutput = Join-Path $licenseRoot 'npm'
New-Item -ItemType Directory -Force -Path $goOutput, $npmOutput | Out-Null

function Copy-LicenseFile {
    param(
        [string]$Source,
        [string]$DestinationDirectory,
        [string]$Prefix
    )

    $safePrefix = $Prefix -replace '[\\/:*?"<>|]', '_'
    $name = (Split-Path -Leaf $Source) -replace '[\\/:*?"<>|]', '_'
    $destination = Join-Path $DestinationDirectory "$safePrefix`_$name"
    Copy-Item -LiteralPath $Source -Destination $destination -Force
}

Push-Location $repoRoot
try {
    $goModules = go list -m -f '{{if not .Main}}{{.Dir}}|{{.Path}}|{{.Version}}{{end}}' all
    foreach ($line in $goModules) {
        if (-not $line) { continue }
        $parts = $line -split '\|', 3
        if ($parts.Count -lt 3 -or -not (Test-Path -LiteralPath $parts[0] -PathType Container)) {
            continue
        }
        $licenseFiles = Get-ChildItem -LiteralPath $parts[0] -File |
            Where-Object { $_.Name -match '^(LICENSE|LICENCE|COPYING|NOTICE)' }
        foreach ($license in $licenseFiles) {
            Copy-LicenseFile -Source $license.FullName -DestinationDirectory $goOutput `
                -Prefix "$($parts[1])@$($parts[2])"
        }
    }

    $nodeModules = Join-Path $repoRoot 'frontend\node_modules'
    if (Test-Path -LiteralPath $nodeModules -PathType Container) {
        $npmLicenses = Get-ChildItem -LiteralPath $nodeModules -Recurse -File |
            Where-Object { $_.Name -match '^(LICENSE|LICENCE|COPYING|NOTICE)' }
        foreach ($license in $npmLicenses) {
            $relative = [System.IO.Path]::GetRelativePath($nodeModules, $license.FullName)
            Copy-LicenseFile -Source $license.FullName -DestinationDirectory $npmOutput `
                -Prefix $relative
        }
    }

    $fontAwesomeLicense = Join-Path $repoRoot `
        'frontend\src\assets\toolbar-icons-fontawesome\LICENSE.txt'
    if (Test-Path -LiteralPath $fontAwesomeLicense -PathType Leaf) {
        Copy-LicenseFile -Source $fontAwesomeLicense -DestinationDirectory $licenseRoot `
            -Prefix 'FontAwesome-Free'
    }

    Get-ChildItem -LiteralPath $licenseRoot -Recurse -File |
        ForEach-Object { [System.IO.Path]::GetRelativePath($licenseRoot, $_.FullName) } |
        Sort-Object |
        Set-Content -LiteralPath (Join-Path $licenseRoot 'MANIFEST.txt') -Encoding utf8NoBOM
}
finally {
    Pop-Location
}
