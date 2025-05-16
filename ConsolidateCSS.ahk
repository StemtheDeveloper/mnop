#Requires AutoHotkey v2.0
; consolidate-css.ahk
; ----------------------------------------------------------
; Cut the contents of every *.css (except   src\App.css)
; Append them to src\App.css with a proper banner comment
; Leave the originals in place but truncated to a 1-line stub
; ----------------------------------------------------------

destRel   := "src\App.css"                                 ; master stylesheet
ignoreDir := StrSplit("node_modules|dist|.git|.firebase", "|")
encoding  := "UTF-8"

root      := A_ScriptDir
destFull  := root "\" destRel
SplitPath destFull, , &destDir
DirCreate destDir                                           ; make sure path exists

; --- 1) read existing App.css and normalise its ending
base := ""
if FileExist(destFull) {
    base := FileRead(destFull, encoding)
    base := RTrim(base, "`r`n ") . "`r`n`r`n"              ; exactly 1 blank line
}

; --- 2) sweep every other .css file
blocks := ""
Loop Files root "\*.css", "R" {
    f := A_LoopFilePath
    if (f = destFull)
        continue

    skip := false
    for _, d in ignoreDir
        if InStr(f, "\" d "\") {
            skip := true
            break
        }
    if skip
        continue

    txt := FileRead(f, encoding)
    if txt = ""
        continue

    rel := "." . StrReplace(SubStr(f, StrLen(root) + 1), "\", "/")
    banner := "/* " rel " */`r`n`r`n"
    blocks .= banner . RTrim(txt, "`r`n ") . "`r`n`r`n"

    ; leave a stub so the file still exists in source control
    FileOpen(f, "w", encoding . "-RAW").Write("/* moved to App.css */`r`n")
}

if (blocks = "") {
    MsgBox "No CSS files found to consolidate.", "Nothing to do"
    ExitApp
}

; --- 3) final write
FileDelete destFull
FileAppend base . blocks, destFull, encoding . "-RAW"

MsgBox "✅  Consolidated styles into " . destRel . "`r`n"
     . "(source files emptied, not deleted).", "Done"
ExitApp
