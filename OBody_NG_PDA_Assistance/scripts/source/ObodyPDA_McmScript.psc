scriptName ObodyPDA_McmScript extends SKI_ConfigBase

Int buttonAdvancedMCM
Int useImage

function OnConfigOpen()
	Pages = new String[2]
	Pages[0] = "Overview"
	Pages[1] = "About"
endFunction

function OnOptionSelect(Int option)
	if option == buttonAdvancedMCM
		Bool result = ShowMessage("Press OK to activate Advanced Configuration", true)
		if result
			ObodyPDA_NativeScript.ActivateAdvancedMCM()
			debug.Trace("[OBodyPDA] Advanced MCM activated", 0)
		else
			debug.Trace("[OBodyPDA] Advanced MCM activation cancelled", 0)
		endIf
	endIf
endFunction

function OnPageReset(String page)
	self.SetCursorFillMode(self.LEFT_TO_RIGHT)
	self.SetCursorPosition(0)
	
	if page == ""
		self.DisplaySplashScreen()
	else
		self.UnloadCustomContent()
		if page == "Overview"
			self.DisplayOverview()
		elseIf page == "About"
			self.DisplayAbout()
		endIf
	endIf
endFunction

function DisplayOverview()
    self.SetCursorFillMode(self.TOP_TO_BOTTOM)
    
    ; COLUMNA IZQUIERDA
    self.SetCursorPosition(0)
    self.AddHeaderOption("OBody PDA Settings")
    self.AddEmptyOption()
    buttonAdvancedMCM = self.AddTextOption("Activate Advanced MCM", "")  ; BLANCO (clickeable)
    
    ; COLUMNA DERECHA
    self.SetCursorPosition(1)
    self.AddHeaderOption("About Advanced Configuration")
    self.AddEmptyOption()
    self.AddTextOption("New Panel with options for NPC monitoring,", "", OPTION_FLAG_DISABLED)  ; GRIS
    self.AddTextOption("INI configuration, JSON config with backup", "", OPTION_FLAG_DISABLED)  ; GRIS
    self.AddEmptyOption()
    self.AddTextOption("Updatable NPC tracking system with refresh,", "", OPTION_FLAG_DISABLED)  ; GRIS
	self.AddTextOption("Reading and modifying installed preset XML files", "", OPTION_FLAG_DISABLED)  ; GRIS
    self.AddEmptyOption()
    self.AddTextOption("Read complete plugins: names, factions,", "", OPTION_FLAG_DISABLED)  ; GRIS
    self.AddTextOption("IDs and more custom elements", "", OPTION_FLAG_DISABLED)  ; GRIS
    self.AddEmptyOption()
    self.AddTextOption("Favorite system for presets.", "", OPTION_FLAG_DISABLED)  ; GRIS	
endFunction


function DisplayAbout()
    self.SetCursorFillMode(self.TOP_TO_BOTTOM)
    
    ; COLUMNA IZQUIERDA
    self.SetCursorPosition(0)
    self.AddHeaderOption("About OBody PDA")
    self.AddEmptyOption()
    self.AddTextOption("Version 3.0.0", "", OPTION_FLAG_DISABLED)  ; GRIS
    
    ; COLUMNA DERECHA
    self.SetCursorPosition(1)
    self.AddTextOption("John95ac: I hope this is useful to you,", "", OPTION_FLAG_DISABLED)  ; GRIS
    self.AddTextOption("I had fun creating this control interface", "", OPTION_FLAG_DISABLED)  ; GRIS
    self.AddTextOption("for Skyrim, they have been very useful", "", OPTION_FLAG_DISABLED)  ; GRIS
    self.AddTextOption("in my games.", "", OPTION_FLAG_DISABLED)  ; GRIS
endFunction


function DisplaySplashScreen()
	if useImage == 0
		self.LoadCustomContent("ObodyPDA/OBodyNGPDA1.dds", 0.000000, 0.000000)
		useImage = 1
	elseIf useImage == 1
		self.LoadCustomContent("ObodyPDA/OBodyNGPDA2.dds", 0.000000, 0.000000)
		useImage = 2
	else
		self.LoadCustomContent("ObodyPDA/OBodyNGPDA3.dds", 0.000000, 0.000000)
		useImage = 0
	endIf
endFunction