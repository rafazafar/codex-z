[Setup]
AppId={{67A90A95-1E88-54C4-A0F4-59B590913659}
AppName=codex-z
AppVersion={#ProductVersion}
AppPublisher=codex-z
DefaultDirName={localappdata}\Programs\codex-z
DefaultGroupName=codex-z
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
OutputDir={#OutputDir}
OutputBaseFilename={#OutputBaseFilename}
Compression=lzma
SolidCompression=yes
WizardStyle=modern
UninstallDisplayName=codex-z
SetupIconFile=..\..\..\crates\launcher\assets\codex-z.ico
UninstallDisplayIcon={app}\bin\codex-z-start.exe

#if Architecture == "x64"
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
#else
ArchitecturesAllowed=arm64
ArchitecturesInstallIn64BitMode=arm64
#endif

[Files]
Source: "{#PayloadRoot}\*"; DestDir: "{app}"; Flags: recursesubdirs createallsubdirs ignoreversion

[Icons]
Name: "{userprograms}\codex-z"; Filename: "{app}\bin\codex-z-start.exe"; WorkingDir: "{app}"

[Dirs]
Name: "{app}"

[UninstallDelete]
Type: filesandordirs; Name: "{app}"
