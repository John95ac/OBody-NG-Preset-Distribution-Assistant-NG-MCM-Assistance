# OBody NG PDA Assistance - Act 2 & Act 3

OBody NG PDA Assistance is a high-performance tool suite designed to extend and enhance the OBody preset distribution system. This documentation covers **Act 2 (Data Engine)** and **Act 3 (Interface & Process Management)**, which bridge the gap between raw game data and user-friendly rule management.

*Note: [Act 1 documentation is maintained separately.](https://github.com/John95ac/OBody_NG_Preset_Distribution_Assistant_NG)*

## System Architecture

The project features a unique hybrid architecture that combines low-level C++ performance with high-level web flexibility:

- **Back-end (Act 2):** A C++ SKSE plugin that performs deep game state analysis, scanning NPCs, factions, and plugin-defined outfits in real-time.
- **Web Interface (Act 3):** A dynamic, multi-tabbed web application (`index.html`, `app.js`, `style.css`) providing a modern UI for rule generation, data extraction, and preset sandboxing.
- **Embeddable Server:** A `server.pyw` running on an embeddable Python distribution. It hosts a local `ThreadedTCPServer` that manages communication between the C++ components and the web interface, ensuring smooth data flow and file management without requiring a full Python installation.

Together, these components empower users to obtain and manage game information to create precise distribution rules for Act 1.

## Key Features

### Act 2: OBody PDA Manager (Back-end)
- **NPC Tracking:** Dynamically scans NPCs within a configurable radius (default: 650 units).
- **Outfit & Item Scanning:** Identifies equipped items and faction data across all loaded plugins.
- **JSON Export:** Generates structured metadata for the web interface.

### Act 3: OBody PDA Interface (Front-end)
- **Dynamic Info Extractor:** Specialized tabs for NPC range scanning, plugin items, and plugin NPCs.
- **INI Generator:** A user-friendly tool to build complex distribution rules.
- **Standalone MCM Support:** Real-time monitoring of external tool states.
- **In-Game Notifications:** Immediate feedback via `RE::DebugNotification`.

## Web Tabs (Act 3 UI)

The local web UI is served by `Assets/server.pyw` and rendered by `Assets/index.html` + `Assets/app.js` + `Assets/style.css`.

- **🗃️ Index:** Home/dashboard with quick actions (create shortcuts), update checker, quick JSON notes auto-save, and project updates feed.
- **🖋️ INI Generator:** Interactive rule builder for OBody NG distribution rules (types, modes, presets/data fields) with guided UI.
- **🔍 NPC Range:** Shows NPCs around the player from `Json/Act2_Manager.json`, with NPC detail panels and a detection range slider saved back to INI.
- **👗 Plugins Items:** Lets you select plugins from `Json/Act2_Plugins.json`, refresh outfit scans, browse `Json/Act2_Outfits.json`, and manage favorites.
- **👯 Plugins NPC:** Lets you select NPC plugins from `Json/Act2_NPCs.json`, refresh NPC lists (`Json/Act2_NPCs_List.json`), and manage favorites.
- **💃 Quick JSON Modifier:** Safe sandbox for `Json/OBody_presetDistributionConfig.json` with refresh, backups, a visual section editor, optional manual edits, and transfer back to the master JSON.
- **📔 Preset Sandbox:** WIP developer-oriented area to inspect preset data, browse Slider Presets XMLs, edit `xml/Preset_Sandbox.xml`, and generate/save a sandbox INI.
- **📃 Log Viewer:** Centralized viewer for server errors plus OBody/Assistant/MCM/analysis logs, with reload/copy/expand actions.
- **😸 News:** Embedded project news page loaded in an iframe (remote content).
- **⚙️ Configurations:** Controls tab visibility (`Json/config_web.json`), port selection/restart, and shows licenses/media credits (includes an INI config area marked WIP).
- **NPC Tracking Detection Range:** Extra UI section for detection range configuration (marked as WIP in `index.html`).
- **Topbar Controls:** Shows Skyrim status/Offline mode, and provides refresh, zoom, and server shutdown actions.

## Rule Generator Tool
For more details, including a specialized rule generator tool, visit:
[OBody NG Preset Distribution Assistant NG - Rule Generator](https://john95ac.github.io/website-documents-John95AC/OBody_NG_Preset_Distribution_Assistant_NG/index.html)

## Requirements
- [SKSE64](https://skse.silverlock.org/)
- [Address Library for SKSE Plugins](https://www.nexusmods.com/skyrimspecialedition/mods/32444)
- [OBody Standalone](https://www.nexusmods.com/skyrimspecialedition/mods/77016)

## Acknowledgements

### Beta Testers
Special thanks to our dedicated beta testers who helped make this project possible:

| ![Cryshy](<./Beta Testers/Cryshy.png>) | ![IAleX](<./Beta Testers/IAleX.png>) | ![Lucas](<./Beta Testers/Lucas.png>) | ![OpheliaMoonlight](<./Beta Testers/OpheliaMoonlight.png>) | ![storm12](<./Beta Testers/storm12.png>) | ![Thalzamar](<./Beta Testers/Thalzamar.png>) |
| :---: | :---: | :---: | :---: | :---: | :---: |
| **Cryshy** | **IAleX** | **Lucas** | **OpheliaMoonlight** | **storm12** | **Thalzamar** |

| ![iDeadSea](<./Beta Testers/iDeadSea.png>) | ![AdrienMassenot](<./Beta Testers/AdrienMassenot.png>) | ![Edsley](<./Beta Testers/Edsley.png>) | ![Triberzis](<./Beta Testers/Triberzis.png>) | ![djdunha](<./Beta Testers/djdunha.png>) |
| :---: | :---: | :---: | :---: | :---: |
| **iDeadSea** | **AdrienMassenot** | **Edsley** | **Triberzis** | **djdunha** |

### Additional Credits
- **Cryshy:** Beta review: UBE users who with their help I managed to better understand the world of this type of bodies. Thanks to their observations and ideas I implemented the automation system for UBE presets in the blacklist, and default application to UBE races. With this, NPCs with UBE will no longer appear skinny by default, but will be able to have UBE presets for them from the start. Thank you very much.
- **Triberzis:** Thanks to your observation about the use of keys, the system has been modified and implemented with a more comprehensive preset search system based on the presets installed in the player's game. Thank you very much for the idea, which has been implemented in the latest version.
- **Lucas, OpheliaMoonlight, Thalzamar, iDeadSea, AdrienMassenot:** I thank you for testing the betas and giving me your respective observations across your different game versions and mod organizers. Thank you very much.
- **AdrienMassenot:** Thanks to his cooperation with HIMBO system testing, which led to significant improvements in the male body preset distribution logic.
- **iDeadSea:** Thanks to his cooperation with multiple beta tests, he provided information from his Skyrim version in Cyrillic, with which it was decided that different Skyrim versions handle different default names for each NPC depending on the language in which the game is played, so it was decided to correct these and add new functions. Thank you.
- **CommonLibSSE NG:** Fundamental framework for developing modern SKSE plugins. [GitHub](https://github.com/CharmedBaryon/CommonLibSSE-NG)
- **SKSE Team:** For the continuous development and support of the [Skyrim Script Extender](https://skse.silverlock.org/).
- **OBody NG Team:** For creating the base [OBody NG](https://www.nexusmods.com/skyrimspecialedition/mods/77016) that makes this functionality possible.
- **Modding Community:** For the constant feedback and ideas for improvements.
- **Music Skyrim:** Thanks to the original authors of Skyrim for the [music played directly from YouTube](https://www.youtube.com/user/SkyrimMusic).
- **Flowchart, Whiteboard and Graphics:** Thanks to [Mermaid](https://mermaid.js.org/), [Excalidraw](https://excalidraw.com/) and Graphics for being free and very useful tools for drawing and creating diagrams.
- **Mrowrpurr (Skyrim Scripting):** Thanks to the tutorial creator Mrowrpurr, whose advice and videos on how to work with SKSE are splendid. [YouTube](https://www.youtube.com/@SkyrimScripting)

### Social Links
- [GitHub](https://github.com/John95ac)
- [Patreon](https://www.patreon.com/John95ac)
- [Ko-fi](https://ko-fi.com/john95ac)
- [Nexus Mods](https://next.nexusmods.com/profile/John1995ac)

## CommonLibSSE NG
This project uses [CommonLibSSE-NG](https://github.com/CharmedBaryon/CommonLibSSE-NG), which ensures compatibility across:
- Skyrim Special Edition (SE)
- Skyrim Anniversary Edition (AE)
- Skyrim GOG Edition
- Skyrim VR

CommonLibSSE-NG is a fork of the popular [CommonLibSSE](https://github.com/powerof3/CommonLibSSE) by powerof3, originally created by Ryan-rsm-McKenzie.

## Version History
- **v2.1.0:** Enhanced Act 2 NPC tracking, Act 3 notification system, and hybrid web architecture integration.
- **v2.0.0:** Initial implementation of Act 2 and Act 3 architecture.

## Licenses & Media
- [Project License (MIT)](OBody_NG_PDA_Assistance/SKSE/Plugins/OBody_NG_PDA_NG_Full_Assistance/Assets/LICENSE%20John95AC%20MIT.txt)
- [Python Embeddable License](OBody_NG_PDA_Assistance/SKSE/Plugins/OBody_NG_PDA_NG_Full_Assistance/Assets/LICENSE%20python%20embeddable.txt)
- [Python 3.13.9](https://www.python.org/downloads/release/python-3139/) - It is not necessary to download this, it is already included in the project 🐱‍💻
- [Frozen Application License](OBody_NG_PDA_Assistance/SKSE/Plugins/OBody_NG_PDA_NG_Full_Assistance/Assets/LICENSE%20frozen_application_license.txt)
- [Sound Credits](OBody_NG_PDA_Assistance/SKSE/Plugins/OBody_NG_PDA_NG_Full_Assistance/Assets/Sound/credits%20Sound.txt)
- [Photo Credits](OBody_NG_PDA_Assistance/SKSE/Plugins/OBody_NG_PDA_NG_Full_Assistance/Assets/Data/credits%20photos.txt)

