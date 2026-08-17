Unicode True

!ifndef APP_VERSION
  !define APP_VERSION "0.1.0"
!endif

!cd ".."

Name "Promarkia Community"
OutFile "release\Promarkia-Community-${APP_VERSION}-Windows-x64-Setup.exe"
InstallDir "$LOCALAPPDATA\Programs\Promarkia Community"
InstallDirRegKey HKCU "Software\Agentix Labs\Promarkia Community" "InstallDir"
RequestExecutionLevel user
SetCompressor /SOLID lzma
LicenseData "LICENSE"

Page license
Page directory
Page instfiles
UninstPage uninstConfirm
UninstPage instfiles

Section "Promarkia Community" SEC_MAIN
  SetOutPath "$INSTDIR"
  File /r "dist\PromarkiaCommunity\*"
  WriteUninstaller "$INSTDIR\Uninstall.exe"
  WriteRegStr HKCU "Software\Agentix Labs\Promarkia Community" "InstallDir" "$INSTDIR"
  CreateDirectory "$SMPROGRAMS\Promarkia Community"
  CreateShortcut "$SMPROGRAMS\Promarkia Community\Promarkia Community.lnk" "$INSTDIR\PromarkiaCommunity.exe"
  CreateShortcut "$SMPROGRAMS\Promarkia Community\Uninstall.lnk" "$INSTDIR\Uninstall.exe"
  CreateShortcut "$DESKTOP\Promarkia Community.lnk" "$INSTDIR\PromarkiaCommunity.exe"
SectionEnd

Section "Uninstall"
  Delete "$DESKTOP\Promarkia Community.lnk"
  RMDir /r "$SMPROGRAMS\Promarkia Community"
  DeleteRegKey HKCU "Software\Agentix Labs\Promarkia Community"
  RMDir /r "$INSTDIR"
SectionEnd

