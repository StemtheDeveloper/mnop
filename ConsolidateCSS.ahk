#Requires AutoHotkey v2.0
; move-css-into-app.ahk
; ────────────────────────────────────────────────────────────────
; • Reads every *.css (except src\App.css)
; • Appends its content to src\App.css with banner "// ./relative/path"
; • Deletes the original file (i.e. CUT not copy)
; ────────────────────────────────────────────────────────────────

destCssRel := "src\App.css"                               ; consolidated file
ignoreDirs := StrSplit("node_modules|dist|.git|.firebase", "|")
encoding   := "UTF-8"

repoRoot     := A_ScriptDir
destCssFull  := repoRoot . "\" . destCssRel

; ensure destination folder exists
SplitPath destCssFull, , &destDir
DirCreate destDir

; open destination once (append mode, no BOM)
destFile := FileOpen(destCssFull, "a", encoding . "-RAW")
if !destFile {
    MsgBox "Cannot open " destCssRel " for writing.", "Error", "48"
    ExitApp
}

Loop Files repoRoot "\*.css", "R" {
    full := A_LoopFilePath
    if (full = destCssFull)
        continue                        ; never re-append App.css itself

    ; ── skip ignored directories ──
    skip := false
    for _, dir in ignoreDirs
        if InStr(full, "\" dir "\") {
            skip := true
            break
        }
    if skip
        continue

    css := FileRead(full, encoding)
    if (css = "")
        continue

    rel := "." . SubStr(full, StrLen(repoRoot) + 1)   ; "./path/to/file"
    banner := "// " . rel . "`r`n`r`n"

    destFile.Write(banner . css . "`r`n`r`n")         ; append block
    FileDelete full                                   ; delete source file
}

destFile.Close()
MsgBox "✅  All CSS files have been moved into " destCssRel "`r`n(originals deleted)."
ExitApp
