#include <RE/Skyrim.h>
#include <SKSE/SKSE.h>
#include <shlobj.h>
#include <spdlog/sinks/basic_file_sink.h>
#include <windows.h>
#include <Psapi.h>
#include <shellapi.h>

#include <algorithm>
#include <atomic>
#include <chrono>
#include <ctime>
#include <deque>
#include <filesystem>
#include <fstream>
#include <iomanip>
#include <mutex>
#include <sstream>
#include <string>
#include <thread>
#include <unordered_map>
#include <unordered_set>
#include <vector>
#include <set>

#pragma comment(lib, "shell32.lib")

namespace fs = std::filesystem;
namespace logger = SKSE::log;

struct OBodyPDAPaths {
    fs::path primary;
    fs::path secondary;
};

struct OBodyPDAPathsResult {
    bool success;
    std::string detectionMethod;
    
    fs::path dllPath;
    fs::path iniPath;
    
    fs::path sksePluginsDir;
    fs::path scriptsBaseDir;
    
    bool dllFound;
    bool iniFound;
    bool scriptFound;
    
    OBodyPDAPathsResult() 
        : success(false), detectionMethod(""), 
          dllFound(false), iniFound(false), 
          scriptFound(false) {}
};

struct FactionData {
    std::string name;
    std::string editorID;
    RE::FormID formID;
    int rank;
    bool isMember;
};

struct EquippedItemData {
    bool equipped;
    std::string name;
    RE::FormID formID;
    std::string pluginName;
    int slot;
    
    EquippedItemData() : equipped(false), formID(0), slot(-1) {}
};

struct NPCData {
    std::string name;
    std::string editorID;
    std::string pluginName;
    std::string race;
    std::string gender;
    bool isVampire;
    bool isWerewolf;
    RE::FormID refID;
    RE::FormID baseID;
    RE::FormID formID;
    std::vector<FactionData> factions;
    float distanceFromPlayer;
    std::unordered_map<std::string, EquippedItemData> equippedItems;
};

struct NPCTrackingConfig {
    bool start;
    int radio;
    std::time_t lastModified;
};

struct OutfitItemData {
    std::string name;
    RE::FormID formID;
};

struct PluginItemData {
    std::string name;
    RE::FormID formID;
};

struct PluginOutfitData {
    std::string name;
    RE::FormID formID;
    std::vector<OutfitItemData> items;
};

struct PluginOutfitsData {
    std::string pluginName;
    std::vector<PluginItemData> armors;
    std::vector<PluginOutfitData> outfits;
    std::vector<PluginItemData> weapons;
};

struct PluginOutfitsConfig {
    bool start;
    bool pluginList;
    std::time_t lastModified;
    std::time_t lastPluginListModified;
};

struct PluginCountData {
    std::string pluginName;
    int armorCount;
    int outfitCount;
    int weaponCount;
};

struct NPCBasicData {
    std::string name;
    std::string editorID;
    RE::FormID formID;
    RE::FormID baseID;
    std::string race;
    std::string gender;
};

struct PluginNPCListData {
    std::string pluginName;
    std::vector<NPCBasicData> npcs;
};

struct PluginNPCCountData {
    std::string pluginName;
    int npcCount;
};

struct PluginNPCsConfig {
    bool startNPCs;
    bool pluginListNPCs;
    std::time_t lastModified;
};

struct PluginLectorData {
    std::string pluginName;
    std::string idString;
    std::string type;
    bool hasNPCs;
    bool hasArmors;
    bool hasOutfits;
    bool hasWeapons;
    
    PluginLectorData() : hasNPCs(false), hasArmors(false), hasOutfits(false), hasWeapons(false) {}
};

static std::ofstream g_advancedLog;
static std::deque<std::string> g_logLines;
static std::string g_documentsPath;
static std::string g_gamePath;
static bool g_isInitialized = false;
static std::mutex g_logMutex;
static std::atomic<bool> g_isShuttingDown(false);
static std::atomic<bool> g_processActive(false);
static std::atomic<bool> g_monitoringActive(false);
static std::thread g_monitorThread;
static int g_monitorCycles = 0;
static std::unordered_set<std::string> g_processedLines;
static size_t g_lastFileSize = 0;

static std::chrono::steady_clock::time_point g_monitoringStartTime;
static bool g_initialDelayComplete = false;

static std::atomic<bool> g_pauseMonitoring(false);
static bool g_activationMessageShown = false;

static std::atomic<bool> g_startupSoundEnabled(true);
static std::atomic<bool> g_topNotificationsVisible(true);
static std::time_t g_lastIniCheckTime = 0;
static fs::path g_iniPath;
static std::thread g_iniMonitorThread;
static std::atomic<bool> g_monitoringIni(false);

static bool g_usingDllPath = false;
static fs::path g_dllDirectory;
static fs::path g_scriptsDirectory;

static NPCTrackingConfig g_npcTrackingConfig;
static fs::path g_npcTrackingIniPath;
static fs::path g_npcTrackingJsonPath;
static std::thread g_npcTrackingThread;
static std::atomic<bool> g_monitoringNPCTracking(false);
static std::mutex g_npcTrackingMutex;
static std::time_t g_lastNPCIniCheckTime = 0;

static std::thread g_skyrimSwitchThread;
static std::atomic<bool> g_monitoringSkyrimSwitch(false);
static std::deque<std::string> g_skyrimSwitchLines;
static std::mutex g_skyrimSwitchMutex;
static fs::path g_skyrimSwitchLogPath;

static PluginOutfitsConfig g_pluginOutfitsConfig;
static fs::path g_pluginOutfitsJsonPath;
static fs::path g_pluginListJsonPath;
static fs::path g_pluginFilterIniPath;
static std::unordered_map<std::string, bool> g_pluginFilterMap;
static std::mutex g_pluginFilterMutex;

static PluginNPCsConfig g_pluginNPCsConfig;
static fs::path g_npcCountJsonPath;
static fs::path g_npcListJsonPath;
static fs::path g_npcFilterIniPath;
static std::unordered_map<std::string, bool> g_npcFilterMap;
static std::mutex g_npcFilterMutex;

// ===== NEW GLOBALS FOR PLUGIN LECTOR SYSTEM =====
static fs::path g_pluginsLectorLogPath;
static fs::path g_pluginsLectorJsonPath;

void StartMonitoringThread();
void StopMonitoringThread();
bool LoadPDASettings();
bool ModifyINIValue(const std::string& newValue);
void StartIniMonitoring();
void StopIniMonitoring();
OBodyPDAPaths GetAllOBodyLogsPaths();
void WriteToAdvancedLog(const std::string& message, int lineNumber = 0);
void ShowGameNotification(const std::string& message);
fs::path GetDllDirectory();
OBodyPDAPathsResult DetectAllOBodyPDAPaths();
bool LoadNPCTrackingConfig();
bool SaveNPCTrackingConfig();
void StartNPCTrackingMonitoring();
void StopNPCTrackingMonitoring();
void ExecuteNPCTracking();
void ExportNPCDataToJSON(const std::vector<NPCData>& npcList, const NPCData& playerData);
std::vector<NPCData> ScanNPCsAroundPlayer(float radius);
NPCData CapturePlayerData();
NPCData CaptureNPCData(RE::Actor* actor, RE::NiPoint3 playerPos);
std::vector<FactionData> GetActorFactions(RE::Actor* actor);
bool IsDLCInstalled(const std::string& dlcName);
bool IsActorVampire(RE::Actor* actor);
bool IsActorWerewolf(RE::Actor* actor);
std::string GetPluginNameFromFormID(RE::FormID formID);
void StartSkyrimSwitchMonitoring();
void StopSkyrimSwitchMonitoring();
void SkyrimSwitchThreadFunction();
EquippedItemData GetEquippedItemInSlot(RE::Actor* actor, int slot);
std::unordered_map<std::string, EquippedItemData> GetAllEquippedItems(RE::Actor* actor);
bool LoadPluginOutfitsConfig();
bool SavePluginOutfitsConfig();
void ExecutePluginOutfitsScanning();
void ExecutePluginListScanning();
std::vector<PluginOutfitsData> ScanAllPluginsForItems();
std::vector<PluginOutfitsData> ScanFilteredPluginsForItems();
void ExportPluginOutfitsToJSON(const std::vector<PluginOutfitsData>& pluginData);
std::vector<PluginCountData> ScanAllPluginsForCounts();
void ExportPluginListToJSON(const std::vector<PluginCountData>& pluginCounts);
bool LoadPluginFilterList();
std::vector<OutfitItemData> GetOutfitItems(RE::BGSOutfit* outfit);
std::vector<PluginNPCCountData> ScanAllPluginsForNPCCount();
std::vector<PluginNPCListData> ScanFilteredPluginsForNPCList();
void ExportNPCCountToJSON(const std::vector<PluginNPCCountData>& npcCounts);
void ExportNPCListToJSON(const std::vector<PluginNPCListData>& npcData);
void ExecuteNPCCountScanning();
void ExecuteNPCListScanning();
bool LoadNPCFilterList();
void ExecutePluginLectorScanning();

void ShowGameNotification(const std::string& message) {
    if (g_topNotificationsVisible.load()) {
        RE::DebugNotification(message.c_str());
        WriteToAdvancedLog("IN-GAME MESSAGE SHOWN: " + message, __LINE__);
    } else {
        WriteToAdvancedLog("IN-GAME MESSAGE SUPPRESSED: " + message, __LINE__);
    }
}

std::string SafeWideStringToString(const std::wstring& wstr) {
    if (wstr.empty()) {
        return std::string();
    }

    try {
        int size_needed = WideCharToMultiByte(
            CP_UTF8,
            0,
            wstr.c_str(),
            static_cast<int>(wstr.size()),
            nullptr,
            0,
            nullptr,
            nullptr
        );

        if (size_needed <= 0) {
            logger::error("WideCharToMultiByte size calculation failed. Error: {}", GetLastError());
            return std::string();
        }

        std::string result(size_needed, 0);

        int bytes_converted = WideCharToMultiByte(
            CP_UTF8,
            0,
            wstr.c_str(),
            static_cast<int>(wstr.size()),
            &result[0],
            size_needed,
            nullptr,
            nullptr
        );

        if (bytes_converted <= 0) {
            logger::error("WideCharToMultiByte conversion failed. Error: {}", GetLastError());
            return std::string();
        }

        return result;

    } catch (const std::exception& e) {
        logger::error("Exception in SafeWideStringToString: {}", e.what());
        return std::string();
    }
}

std::string GetEnvVar(const std::string& key) {
    char* buf = nullptr;
    size_t sz = 0;
    if (_dupenv_s(&buf, &sz, key.c_str()) == 0 && buf != nullptr) {
        std::string value(buf);
        free(buf);
        return value;
    }
    return "";
}

fs::path GetDllDirectory() {
    try {
        HMODULE hModule = nullptr;

        static int dummyVariable = 0;

        if (GetModuleHandleExA(GET_MODULE_HANDLE_EX_FLAG_FROM_ADDRESS | GET_MODULE_HANDLE_EX_FLAG_UNCHANGED_REFCOUNT,
                               reinterpret_cast<LPCSTR>(&dummyVariable), &hModule) &&
            hModule != nullptr) {
            wchar_t dllPath[MAX_PATH] = {0};
            DWORD size = GetModuleFileNameW(hModule, dllPath, MAX_PATH);

            if (size > 0) {
                std::wstring wsDllPath(dllPath);
                std::string dllPathStr = SafeWideStringToString(wsDllPath);

                if (!dllPathStr.empty()) {
                    fs::path dllDir = fs::path(dllPathStr).parent_path();
                    logger::info("DLL directory detected: {}", dllDir.string());
                    return dllDir;
                }
            }
        }

        logger::warn("Could not determine DLL directory");
        return fs::path();

    } catch (const std::exception& e) {
        logger::error("ERROR in GetDllDirectory: {}", e.what());
        return fs::path();
    } catch (...) {
        logger::error("ERROR in GetDllDirectory: Unknown exception");
        return fs::path();
    }
}

bool IsValidPluginPath(const fs::path& pluginPath) {
    const std::vector<std::string> dllNames = {
        "Act2_OBody_NG_PDA_NG.dll"
    };
    
    for (const auto& dllName : dllNames) {
        fs::path dllPath = pluginPath / dllName;
        
        try {
            if (fs::exists(dllPath)) {
                logger::info("DLL validation passed: Found {}", dllName);
                WriteToAdvancedLog("DLL found: " + dllName, __LINE__);
                return true;
            }
        } catch (...) {
            continue;
        }
    }
    
    logger::warn("DLL validation failed: No valid DLL found in path");
    return false;
}

bool FindFileWithFallback(const fs::path& basePath, const std::string& filename, fs::path& foundPath) {
    try {
        fs::path normalPath = basePath / filename;
        if (fs::exists(normalPath)) {
            foundPath = normalPath;
            logger::info("Found file (exact match): {}", foundPath.string());
            return true;
        }
        
        std::string basePathStr = basePath.string();
        if (!basePathStr.empty() && basePathStr.back() != '\\') {
            basePathStr += '\\';
        }
        basePathStr += '\\';
        basePathStr += filename;
        
        fs::path doubleBackslashPath(basePathStr);
        try {
            doubleBackslashPath = fs::canonical(doubleBackslashPath);
            if (fs::exists(doubleBackslashPath)) {
                foundPath = doubleBackslashPath;
                logger::info("Found file (canonical path): {}", foundPath.string());
                return true;
            }
        } catch (...) {}
        
        if (fs::exists(basePath) && fs::is_directory(basePath)) {
            std::string lowerFilename = filename;
            std::transform(lowerFilename.begin(), lowerFilename.end(), lowerFilename.begin(), ::tolower);
            
            for (const auto& entry : fs::directory_iterator(basePath)) {
                try {
                    std::string entryFilename = entry.path().filename().string();
                    std::string lowerEntryFilename = entryFilename;
                    std::transform(lowerEntryFilename.begin(), lowerEntryFilename.end(), 
                                 lowerEntryFilename.begin(), ::tolower);
                    
                    if (lowerEntryFilename == lowerFilename) {
                        foundPath = entry.path();
                        logger::info("Found file (case-insensitive): {}", foundPath.string());
                        return true;
                    }
                } catch (...) {
                    continue;
                }
            }
        }
        
        return false;
        
    } catch (...) {
        return false;
    }
}

fs::path BuildPathCaseInsensitive(const fs::path& basePath, const std::vector<std::string>& components) {
    try {
        fs::path currentPath = basePath;
        
        for (const auto& component : components) {
            fs::path testPath = currentPath / component;
            if (fs::exists(testPath)) {
                currentPath = testPath;
                continue;
            }
            
            std::string lowerComponent = component;
            std::transform(lowerComponent.begin(), lowerComponent.end(), lowerComponent.begin(), ::tolower);
            testPath = currentPath / lowerComponent;
            if (fs::exists(testPath)) {
                currentPath = testPath;
                continue;
            }
            
            std::string upperComponent = component;
            std::transform(upperComponent.begin(), upperComponent.end(), upperComponent.begin(), ::toupper);
            testPath = currentPath / upperComponent;
            if (fs::exists(testPath)) {
                currentPath = testPath;
                continue;
            }
            
            bool found = false;
            if (fs::exists(currentPath) && fs::is_directory(currentPath)) {
                for (const auto& entry : fs::directory_iterator(currentPath)) {
                    try {
                        std::string entryName = entry.path().filename().string();
                        std::string lowerEntryName = entryName;
                        std::transform(lowerEntryName.begin(), lowerEntryName.end(), 
                                     lowerEntryName.begin(), ::tolower);
                        
                        if (lowerEntryName == lowerComponent) {
                            currentPath = entry.path();
                            found = true;
                            break;
                        }
                    } catch (...) {
                        continue;
                    }
                }
            }
            
            if (!found) {
                currentPath = currentPath / component;
            }
        }
        
        return currentPath;
        
    } catch (...) {
        return basePath;
    }
}

std::string GetCurrentTimeString() {
    auto now = std::chrono::system_clock::now();
    std::time_t time_t = std::chrono::system_clock::to_time_t(now);
    std::tm buf;
    localtime_s(&buf, &time_t);
    std::stringstream ss;
    ss << std::put_time(&buf, "%Y-%m-%d %H:%M:%S");
    return ss.str();
}

std::string GetCurrentTimeStringWithMillis() {
    auto now = std::chrono::system_clock::now();
    auto ms = std::chrono::duration_cast<std::chrono::milliseconds>(now.time_since_epoch()) % 1000;
    std::time_t time_t = std::chrono::system_clock::to_time_t(now);
    std::tm buf;
    localtime_s(&buf, &time_t);
    std::stringstream ss;
    ss << std::put_time(&buf, "%Y-%m-%d %H:%M:%S");
    ss << "." << std::setfill('0') << std::setw(3) << ms.count();
    return ss.str();
}

OBodyPDAPaths GetAllOBodyLogsPaths() {
    static bool loggedOnce = false;
    OBodyPDAPaths paths;
    
    try {
        std::string documentsPath = g_documentsPath;
        if (documentsPath.empty()) {
            documentsPath = "C:\\";
        }

        paths.primary = fs::path(documentsPath) / "My Games" / "Skyrim Special Edition" / "SKSE";
        
        paths.secondary = fs::path(documentsPath) / "My Games" / "Skyrim.INI" / "SKSE";

        try {
            fs::create_directories(paths.primary);
            fs::create_directories(paths.secondary);

            if (!loggedOnce) {
                logger::info("DUAL-PATH SYSTEM INITIALIZED");
                logger::info("PRIMARY path: {}", paths.primary.string());
                logger::info("SECONDARY path: {}", paths.secondary.string());
                loggedOnce = true;
            }
        } catch (const std::exception& e) {
            logger::error("Could not create SKSE logs directories: {}", e.what());
        }

    } catch (const std::exception& e) {
        logger::error("Error in GetAllOBodyLogsPaths: {}", e.what());
    }

    return paths;
}

void WriteToAdvancedLog(const std::string& message, int lineNumber) {
    std::lock_guard<std::mutex> lock(g_logMutex);

    auto paths = GetAllOBodyLogsPaths();
    
    std::vector<fs::path> logPaths = {
        paths.primary / "OBody_NG_Preset_Distribution_Assistant-NG_Advanced_Manager.log",
        paths.secondary / "OBody_NG_Preset_Distribution_Assistant-NG_Advanced_Manager.log"
    };

    for (const auto& logPath : logPaths) {
        try {
            std::ofstream logFile(logPath, std::ios::app);
            if (logFile.is_open()) {
                std::stringstream ss;
                ss << "[" << GetCurrentTimeStringWithMillis() << "] ";
                ss << "[log] [info] ";

                if (lineNumber > 0) {
                    ss << "[plugin.cpp:" << lineNumber << "] ";
                } else {
                    ss << "[plugin.cpp:0] ";
                }

                ss << message;

                logFile << ss.str() << std::endl;
                logFile.close();
            }
        } catch (...) {
        }
    }
}

bool LoadPDASettings() {
    try {
        if (g_iniPath.empty()) {
            logger::error("INI path is empty, cannot load settings");
            WriteToAdvancedLog("ERROR: g_iniPath is empty, impossible to load settings", __LINE__);
            return false;
        }
        
        if (!fs::exists(g_iniPath)) {
            logger::warn("INI file not found: {}", g_iniPath.string());
            WriteToAdvancedLog("WARNING: INI file not found at: " + g_iniPath.string(), __LINE__);
            return false;
        }

        std::ifstream iniFile(g_iniPath);
        if (!iniFile.is_open()) {
            logger::error("Could not open INI file");
            return false;
        }

        std::string line;
        std::string currentSection;
        bool newStartupSound = g_startupSoundEnabled.load();
        bool newTopNotifications = g_topNotificationsVisible.load();

        while (std::getline(iniFile, line)) {
            line.erase(0, line.find_first_not_of(" \t\r\n"));
            line.erase(line.find_last_not_of(" \t\r\n") + 1);

            if (line.empty() || line[0] == ';' || line[0] == '#') {
                continue;
            }

            if (line[0] == '[' && line[line.length() - 1] == ']') {
                currentSection = line.substr(1, line.length() - 2);
                continue;
            }

            size_t equalPos = line.find('=');
            if (equalPos != std::string::npos) {
                std::string key = line.substr(0, equalPos);
                std::string value = line.substr(equalPos + 1);

                key.erase(0, key.find_first_not_of(" \t"));
                key.erase(key.find_last_not_of(" \t") + 1);
                value.erase(0, value.find_first_not_of(" \t"));
                value.erase(value.find_last_not_of(" \t") + 1);

                if (currentSection == "Advanced_Manager" && key == "Startup") {
                    std::transform(value.begin(), value.end(), value.begin(), ::tolower);
                    newStartupSound = (value == "true" || value == "1" || value == "yes");
                } else if (currentSection == "Top Notifications" && key == "Visible") {
                    std::transform(value.begin(), value.end(), value.begin(), ::tolower);
                    newTopNotifications = (value == "true" || value == "1" || value == "yes");
                }
            }
        }

        iniFile.close();

        bool startupChanged = (newStartupSound != g_startupSoundEnabled.load());
        bool notificationsChanged = (newTopNotifications != g_topNotificationsVisible.load());

        g_startupSoundEnabled = newStartupSound;
        g_topNotificationsVisible = newTopNotifications;

        if (startupChanged) {
            logger::info("Startup sound {}", newStartupSound ? "enabled" : "disabled");
            WriteToAdvancedLog("Startup sound " + std::string(newStartupSound ? "enabled" : "disabled"), __LINE__);
        }

        if (notificationsChanged) {
            logger::info("Top notifications {}", newTopNotifications ? "enabled" : "disabled");
            WriteToAdvancedLog("Top notifications " + std::string(newTopNotifications ? "enabled" : "disabled"), __LINE__);
        }

        WriteToAdvancedLog(
            "PDA settings loaded - Startup Sound: " + std::string(g_startupSoundEnabled.load() ? "enabled" : "disabled") +
                ", Top Notifications: " + std::string(g_topNotificationsVisible.load() ? "enabled" : "disabled"),
            __LINE__);

        return true;

    } catch (const std::exception& e) {
        logger::error("Error loading PDA settings: {}", e.what());
        return false;
    }
}

bool ModifyINIValue(const std::string& newValue) {
    try {
        if (g_iniPath.empty()) {
            logger::error("INI path is empty, cannot modify");
            WriteToAdvancedLog("ERROR: g_iniPath is empty, impossible to modify INI", __LINE__);
            return false;
        }
        
        if (!fs::exists(g_iniPath)) {
            logger::error("INI file not found: {}", g_iniPath.string());
            WriteToAdvancedLog("ERROR: INI file not found: " + g_iniPath.string(), __LINE__);
            return false;
        }

        std::ifstream fileIn(g_iniPath);
        if (!fileIn.is_open()) {
            logger::error("Could not open INI file for reading");
            return false;
        }

        std::string content((std::istreambuf_iterator<char>(fileIn)), 
                           std::istreambuf_iterator<char>());
        fileIn.close();

        size_t pos = content.find("Advanced_Manager = ");
        if (pos != std::string::npos) {
            size_t lineEnd = content.find('\n', pos);
            if (lineEnd == std::string::npos) lineEnd = content.length();
            
            std::string newLine = "Advanced_Manager = " + newValue;
            content.replace(pos, lineEnd - pos, newLine);
        } else {
            logger::error("Advanced_Manager entry not found in INI");
            return false;
        }

        std::ofstream fileOut(g_iniPath);
        if (!fileOut.is_open()) {
            logger::error("Could not open INI file for writing");
            return false;
        }
        fileOut << content;
        fileOut.close();

        logger::info("INI modified: Advanced_Manager = {}", newValue);
        WriteToAdvancedLog("INI modified: Advanced_Manager = " + newValue, __LINE__);
        return true;
    } catch (const std::exception& e) {
        logger::error("Error modifying INI: {}", e.what());
        return false;
    }
}

void IniMonitorThreadFunction() {
    logger::info("INI monitoring thread started");

    while (g_monitoringIni.load() && !g_isShuttingDown.load()) {
        try {
            if (fs::exists(g_iniPath)) {
                auto currentModTime = fs::last_write_time(g_iniPath);
                auto currentModTimeT = std::chrono::system_clock::to_time_t(
                    std::chrono::time_point_cast<std::chrono::system_clock::duration>(
                        currentModTime - fs::file_time_type::clock::now() + std::chrono::system_clock::now()));

                if (currentModTimeT > g_lastIniCheckTime) {
                    WriteToAdvancedLog("INI file changed, reloading settings...", __LINE__);
                    LoadPDASettings();
                    g_lastIniCheckTime = currentModTimeT;
                }
            }
        } catch (...) {
        }

        std::this_thread::sleep_for(std::chrono::seconds(2));
    }

    logger::info("INI monitoring thread stopped");
}

void StartIniMonitoring() {
    if (!g_monitoringIni.load()) {
        g_monitoringIni = true;
        g_iniMonitorThread = std::thread(IniMonitorThreadFunction);
    }
}

void StopIniMonitoring() {
    if (g_monitoringIni.load()) {
        g_monitoringIni = false;
        if (g_iniMonitorThread.joinable()) {
            g_iniMonitorThread.join();
        }
    }
}

std::string GetDocumentsPath() {
    try {
        wchar_t path[MAX_PATH] = {0};
        HRESULT result = SHGetFolderPathW(NULL, CSIDL_PERSONAL, NULL, SHGFP_TYPE_CURRENT, path);
        if (SUCCEEDED(result)) {
            std::wstring ws(path);
            std::string converted = SafeWideStringToString(ws);
            if (!converted.empty()) {
                return converted;
            }
        }
        std::string userProfile = GetEnvVar("USERPROFILE");
        if (!userProfile.empty()) {
            return userProfile + "\\Documents";
        }
        return "C:\\Users\\Default\\Documents";
    } catch (...) {
        return "C:\\Users\\Default\\Documents";
    }
}

std::string GetGamePath() {
    try {
        logger::info("==============================================");
        logger::info("GAME PATH DETECTION - OBody PDA Enhanced Mode");
        logger::info("==============================================");

        logger::info("Priority 1: Environment Variables");
        std::string mo2Path = GetEnvVar("MO2_MODS_PATH");
        if (!mo2Path.empty()) {
            fs::path pluginPath = BuildPathCaseInsensitive(fs::path(mo2Path), {"Data", "SKSE", "Plugins"});
            if (IsValidPluginPath(pluginPath)) {
                logger::info("Found and validated game path via MO2_MODS_PATH: {}", mo2Path);
                return mo2Path;
            } else {
                logger::warn("MO2_MODS_PATH found but DLL validation failed");
            }
        }

        std::string vortexPath = GetEnvVar("VORTEX_MODS_PATH");
        if (!vortexPath.empty()) {
            fs::path pluginPath = BuildPathCaseInsensitive(fs::path(vortexPath), {"Data", "SKSE", "Plugins"});
            if (IsValidPluginPath(pluginPath)) {
                logger::info("Found and validated game path via VORTEX_MODS_PATH: {}", vortexPath);
                return vortexPath;
            } else {
                logger::warn("VORTEX_MODS_PATH found but DLL validation failed");
            }
        }

        std::string skyrimMods = GetEnvVar("SKYRIM_MODS_FOLDER");
        if (!skyrimMods.empty()) {
            fs::path pluginPath = BuildPathCaseInsensitive(fs::path(skyrimMods), {"Data", "SKSE", "Plugins"});
            if (IsValidPluginPath(pluginPath)) {
                logger::info("Found and validated game path via SKYRIM_MODS_FOLDER: {}", skyrimMods);
                return skyrimMods;
            } else {
                logger::warn("SKYRIM_MODS_FOLDER found but DLL validation failed");
            }
        }

        logger::info("Priority 2: Windows Registry");
        std::vector<std::pair<std::string, std::string>> registryKeys = {
            {"SOFTWARE\\WOW6432Node\\Bethesda Softworks\\Skyrim Special Edition", "Installed Path"},
            {"SOFTWARE\\WOW6432Node\\GOG.com\\Games\\1457087920", "path"},
            {"SOFTWARE\\WOW6432Node\\Valve\\Steam\\Apps\\489830", "InstallLocation"},
            {"SOFTWARE\\WOW6432Node\\Valve\\Steam\\Apps\\611670", "InstallLocation"}
        };

        HKEY hKey;
        char pathBuffer[MAX_PATH] = {0};
        DWORD pathSize = sizeof(pathBuffer);

        for (const auto& [key, valueName] : registryKeys) {
            if (RegOpenKeyExA(HKEY_LOCAL_MACHINE, key.c_str(), 0, KEY_READ, &hKey) == ERROR_SUCCESS) {
                if (RegQueryValueExA(hKey, valueName.c_str(), NULL, NULL, (LPBYTE)pathBuffer, &pathSize) ==
                    ERROR_SUCCESS) {
                    RegCloseKey(hKey);
                    std::string result(pathBuffer);
                    if (!result.empty() && fs::exists(result)) {
                        fs::path pluginPath = BuildPathCaseInsensitive(fs::path(result), {"Data", "SKSE", "Plugins"});
                        if (IsValidPluginPath(pluginPath)) {
                            logger::info("Found and validated game path in registry: {}", result);
                            return result;
                        } else {
                            logger::warn("Registry path found but DLL validation failed: {}", result);
                        }
                    }
                }
                RegCloseKey(hKey);
            }
            pathSize = sizeof(pathBuffer);
        }

        logger::info("Priority 3: Common Installation Paths");
        std::vector<std::string> commonPaths = {
            "C:\\Program Files (x86)\\Steam\\steamapps\\common\\Skyrim Special Edition",
            "C:\\Program Files\\Steam\\steamapps\\common\\Skyrim Special Edition",
            "D:\\Steam\\steamapps\\common\\Skyrim Special Edition",
            "E:\\Steam\\steamapps\\common\\Skyrim Special Edition",
            "F:\\Steam\\steamapps\\common\\Skyrim Special Edition",
            "G:\\Steam\\steamapps\\common\\Skyrim Special Edition",
            "G:\\SteamLibrary\\steamapps\\common\\Skyrim Special Edition"};

        for (const auto& pathCandidate : commonPaths) {
            try {
                if (fs::exists(pathCandidate) && fs::is_directory(pathCandidate)) {
                    fs::path exePath = fs::path(pathCandidate) / "SkyrimSE.exe";
                    if (fs::exists(exePath)) {
                        fs::path pluginPath = BuildPathCaseInsensitive(fs::path(pathCandidate), {"Data", "SKSE", "Plugins"});
                        if (IsValidPluginPath(pluginPath)) {
                            logger::info("Found and validated game path via common paths: {}", pathCandidate);
                            return pathCandidate;
                        } else {
                            logger::warn("Common path found but DLL validation failed: {}", pathCandidate);
                        }
                    }
                }
            } catch (...) {
                continue;
            }
        }

        logger::info("Priority 4: Executable Directory (Universal Fallback)");
        char exePath[MAX_PATH];
        if (GetModuleFileNameA(NULL, exePath, MAX_PATH) > 0) {
            fs::path fullPath(exePath);
            std::string gamePath = fullPath.parent_path().string();
            
            fs::path pluginPath = BuildPathCaseInsensitive(fs::path(gamePath), {"Data", "SKSE", "Plugins"});
            if (IsValidPluginPath(pluginPath)) {
                logger::info("Using executable directory as game path: {}", gamePath);
                return gamePath;
            } else {
                logger::warn("Executable directory found but DLL validation failed");
            }
        }

        logger::error("All game path detection methods failed");
        logger::info("==============================================");
        return "";
    } catch (const std::exception& e) {
        logger::error("Error in GetGamePath: {}", e.what());
        return "";
    }
}

bool IsDLCInstalled(const std::string& dlcName) {
    auto* dataHandler = RE::TESDataHandler::GetSingleton();
    if (!dataHandler) return false;
    
    auto* file = dataHandler->LookupModByName(dlcName);
    return (file != nullptr);
}

bool IsActorVampire(RE::Actor* actor) {
    if (!actor) return false;
    
    auto* actorBase = actor->GetActorBase();
    if (!actorBase) return false;
    
    auto* actorClass = actorBase->npcClass;
    if (actorClass) {
        RE::FormID classID = actorClass->GetFormID();
        if (classID == 0x0002E00F) {
            return true;
        }
    }
    
    auto* dataHandler = RE::TESDataHandler::GetSingleton();
    if (dataHandler && IsDLCInstalled("Dawnguard.esm")) {
        auto* vampireFaction = dataHandler->LookupForm<RE::TESFaction>(0x020142E6, "Dawnguard.esm");
        if (vampireFaction && actor->IsInFaction(vampireFaction)) {
            return true;
        }
    }
    
    return false;
}

bool IsActorWerewolf(RE::Actor* actor) {
    if (!actor) return false;
    
    auto* actorBase = actor->GetActorBase();
    if (!actorBase) return false;
    
    auto* actorClass = actorBase->npcClass;
    if (actorClass) {
        RE::FormID classID = actorClass->GetFormID();
        if (classID == 0x000A1993 || classID == 0x000A1994 || classID == 0x000A1995) {
            return true;
        }
    }
    
    auto* dataHandler = RE::TESDataHandler::GetSingleton();
    if (dataHandler) {
        auto* werewolfFaction = dataHandler->LookupForm<RE::TESFaction>(0x0009A741, "Skyrim.esm");
        if (werewolfFaction && actor->IsInFaction(werewolfFaction)) {
            return true;
        }
    }
    
    return false;
}

std::string GetPluginNameFromFormID(RE::FormID formID) {
    auto* form = RE::TESForm::LookupByID(formID);
    if (!form) return "Unknown";
    
    auto* file = form->GetFile(0);
    if (!file) return "Unknown";
    
    return file->fileName;
}

std::vector<FactionData> GetActorFactions(RE::Actor* actor) {
    std::vector<FactionData> factions;
    
    if (!actor) return factions;
    
    auto* actorBase = actor->GetActorBase();
    if (!actorBase) return factions;
    
    if (actorBase->factions.empty()) return factions;
    
    for (const auto& factionInfo : actorBase->factions) {
        if (!factionInfo.faction) continue;
        
        FactionData data;
        data.name = factionInfo.faction->GetName();
        
        const char* editorID = factionInfo.faction->GetFormEditorID();
        if (editorID && strlen(editorID) > 0) {
            data.editorID = editorID;
        } else {
            data.editorID = "Unknown";
        }
        
        data.formID = factionInfo.faction->GetFormID();
        data.rank = factionInfo.rank;
        data.isMember = true;
        
        factions.push_back(data);
    }
    
    return factions;
}

EquippedItemData GetEquippedItemInSlot(RE::Actor* actor, int slot) {
    EquippedItemData itemData;
    itemData.slot = slot;
    
    if (!actor) return itemData;
    
    RE::TESForm* equippedForm = nullptr;
    
    if (slot == -1) {
        equippedForm = actor->GetEquippedObject(true);
    } else if (slot == -2) {
        equippedForm = actor->GetEquippedObject(false);
    } else {
        auto inv = actor->GetInventory();
        for (auto& [item, invData] : inv) {
            if (!item || !item->IsArmor()) continue;
            
            auto& [count, entry] = invData;
            if (!entry || !entry->extraLists) continue;
            
            for (auto* xList : *entry->extraLists) {
                if (xList && xList->HasType(RE::ExtraDataType::kWorn)) {
                    auto armor = item->As<RE::TESObjectARMO>();
                    if (armor) {
                        auto armorSlotMask = armor->GetSlotMask();
                        
                        int bitPosition = slot - 30;
                        
                        if (bitPosition < 0 || bitPosition >= 32) {
                            continue;
                        }
                        
                        std::uint32_t slotBit = 1u << bitPosition;
                        std::uint32_t maskValue = static_cast<std::uint32_t>(armorSlotMask);
                        
                        if ((maskValue & slotBit) != 0) {
                            equippedForm = item;
                            break;
                        }
                    }
                }
            }
            if (equippedForm) break;
        }
    }
    
    if (equippedForm) {
        itemData.equipped = true;
        itemData.name = equippedForm->GetName();
        itemData.formID = equippedForm->GetFormID();
        itemData.pluginName = GetPluginNameFromFormID(equippedForm->GetFormID());
    }
    
    return itemData;
}

std::unordered_map<std::string, EquippedItemData> GetAllEquippedItems(RE::Actor* actor) {
    std::unordered_map<std::string, EquippedItemData> equippedItems;
    
    if (!actor) return equippedItems;
    
    equippedItems["right_hand"] = GetEquippedItemInSlot(actor, -1);
    equippedItems["left_hand"] = GetEquippedItemInSlot(actor, -2);
    
    equippedItems["head"] = GetEquippedItemInSlot(actor, 30);
    equippedItems["hair"] = GetEquippedItemInSlot(actor, 31);
    equippedItems["body"] = GetEquippedItemInSlot(actor, 32);
    equippedItems["hands"] = GetEquippedItemInSlot(actor, 33);
    equippedItems["forearms"] = GetEquippedItemInSlot(actor, 34);
    equippedItems["amulet"] = GetEquippedItemInSlot(actor, 35);
    equippedItems["ring"] = GetEquippedItemInSlot(actor, 36);
    equippedItems["feet"] = GetEquippedItemInSlot(actor, 37);
    equippedItems["calves"] = GetEquippedItemInSlot(actor, 38);
    equippedItems["shield"] = GetEquippedItemInSlot(actor, 39);
    equippedItems["tail"] = GetEquippedItemInSlot(actor, 40);
    equippedItems["long_hair"] = GetEquippedItemInSlot(actor, 41);
    equippedItems["circlet"] = GetEquippedItemInSlot(actor, 42);
    equippedItems["ears"] = GetEquippedItemInSlot(actor, 43);
    equippedItems["face_jewelry"] = GetEquippedItemInSlot(actor, 44);
    equippedItems["neck"] = GetEquippedItemInSlot(actor, 45);
    equippedItems["chest_primary"] = GetEquippedItemInSlot(actor, 46);
    equippedItems["back"] = GetEquippedItemInSlot(actor, 47);
    equippedItems["misc_fx"] = GetEquippedItemInSlot(actor, 48);
    equippedItems["pelvis_primary"] = GetEquippedItemInSlot(actor, 49);
    equippedItems["decapitated_head"] = GetEquippedItemInSlot(actor, 50);
    equippedItems["decapitate"] = GetEquippedItemInSlot(actor, 51);
    equippedItems["pelvis_secondary"] = GetEquippedItemInSlot(actor, 52);
    equippedItems["leg_primary_right"] = GetEquippedItemInSlot(actor, 53);
    equippedItems["leg_secondary_left"] = GetEquippedItemInSlot(actor, 54);
    equippedItems["face_alternate"] = GetEquippedItemInSlot(actor, 55);
    equippedItems["chest_secondary"] = GetEquippedItemInSlot(actor, 56);
    equippedItems["shoulder"] = GetEquippedItemInSlot(actor, 57);
    equippedItems["arm_left"] = GetEquippedItemInSlot(actor, 58);
    equippedItems["arm_right"] = GetEquippedItemInSlot(actor, 59);
    equippedItems["unnamed_fx"] = GetEquippedItemInSlot(actor, 60);
    equippedItems["fx01"] = GetEquippedItemInSlot(actor, 61);
    
    return equippedItems;
}

OBodyPDAPathsResult DetectAllOBodyPDAPaths() {
    OBodyPDAPathsResult result;
    
    WriteToAdvancedLog("================================================================", __LINE__);
    WriteToAdvancedLog("  OBODY PDA - COMPLETE PATH DETECTION SYSTEM", __LINE__);
    WriteToAdvancedLog("  Version: 3.8.0", __LINE__);
    WriteToAdvancedLog("  Time: " + GetCurrentTimeString(), __LINE__);
    WriteToAdvancedLog("================================================================", __LINE__);
    WriteToAdvancedLog("", __LINE__);
    
    WriteToAdvancedLog("----------------------------------------------------------------", __LINE__);
    WriteToAdvancedLog(" METHOD 1: DLL DIRECTORY DETECTION (PRIORITY)", __LINE__);
    WriteToAdvancedLog("----------------------------------------------------------------", __LINE__);
    
    fs::path dllDir = GetDllDirectory();
    
    if (!dllDir.empty()) {
        WriteToAdvancedLog("SUCCESS: DLL Directory detected", __LINE__);
        WriteToAdvancedLog("DLL Directory: " + dllDir.string(), __LINE__);
        
        result.sksePluginsDir = dllDir;
        result.detectionMethod = "DLL Directory";
        
        const std::vector<std::string> dllNames = {
            "Act2_OBody_NG_PDA_NG.dll"
        };
        
        for (const auto& dllName : dllNames) {
            fs::path fullDllPath = dllDir / dllName;
            if (fs::exists(fullDllPath)) {
                result.dllPath = fullDllPath;
                result.dllFound = true;
                auto fileSize = fs::file_size(fullDllPath);
                WriteToAdvancedLog("DLL File Found: " + dllName, __LINE__);
                WriteToAdvancedLog("   Full path: " + fullDllPath.string(), __LINE__);
                WriteToAdvancedLog("   File size: " + std::to_string(fileSize) + " bytes", __LINE__);
                break;
            }
        }
        
        WriteToAdvancedLog("", __LINE__);
        WriteToAdvancedLog("SEARCHING FOR INI FILE IN DLL DIRECTORY...", __LINE__);
        
        const std::string iniFileName = "OBody_NG_Preset_Distribution_Assistant_NG.ini";
        fs::path iniPath = dllDir / iniFileName;
        
        WriteToAdvancedLog("Checking: " + iniPath.string(), __LINE__);
        
        if (fs::exists(iniPath)) {
            result.iniPath = iniPath;
            result.iniFound = true;
            auto fileSize = fs::file_size(iniPath);
            WriteToAdvancedLog("INI FILE FOUND!", __LINE__);
            WriteToAdvancedLog("   Full path: " + iniPath.string(), __LINE__);
            WriteToAdvancedLog("   File size: " + std::to_string(fileSize) + " bytes", __LINE__);
        } else {
            WriteToAdvancedLog("INI FILE NOT FOUND in DLL directory", __LINE__);
        }
        
        WriteToAdvancedLog("", __LINE__);
        WriteToAdvancedLog("SEARCHING FOR SCRIPT ASSETS...", __LINE__);
        
        std::vector<fs::path> scriptSearchPaths = {
            dllDir / "OBody_NG_PDA_NG_Full_Assistance" / "Assets",
            dllDir / "Assets",
            dllDir.parent_path() / "OBody_NG_PDA_NG_Full_Assistance" / "Assets"
        };
        
        for (const auto& searchPath : scriptSearchPaths) {
            WriteToAdvancedLog("Checking: " + searchPath.string(), __LINE__);
            
            if (fs::exists(searchPath) && fs::is_directory(searchPath)) {
                result.scriptsBaseDir = searchPath;
                result.scriptFound = true;
                
                WriteToAdvancedLog("SCRIPT ASSETS DIRECTORY FOUND!", __LINE__);
                WriteToAdvancedLog("   Full path: " + searchPath.string(), __LINE__);
                break;
            }
        }
        
        if (!result.scriptFound) {
            WriteToAdvancedLog("SCRIPT ASSETS DIRECTORY NOT FOUND in any location", __LINE__);
        }
        
    } else {
        WriteToAdvancedLog("FAILED: DLL Directory detection returned empty", __LINE__);
        WriteToAdvancedLog("", __LINE__);
        WriteToAdvancedLog("----------------------------------------------------------------", __LINE__);
        WriteToAdvancedLog(" METHOD 2: STANDARD INSTALLATION PATH (FALLBACK)", __LINE__);
        WriteToAdvancedLog("----------------------------------------------------------------", __LINE__);
        
        if (!g_gamePath.empty()) {
            fs::path standardPluginPath = BuildPathCaseInsensitive(
                fs::path(g_gamePath), 
                {"Data", "SKSE", "Plugins"}
            );
            
            WriteToAdvancedLog("Game Path: " + g_gamePath, __LINE__);
            WriteToAdvancedLog("Standard Plugin Path: " + standardPluginPath.string(), __LINE__);
            
            if (fs::exists(standardPluginPath)) {
                result.sksePluginsDir = standardPluginPath;
                result.detectionMethod = "Standard Installation Path";
                
                const std::string iniFileName = "OBody_NG_Preset_Distribution_Assistant_NG.ini";
                fs::path iniPath = standardPluginPath / iniFileName;
                
                if (fs::exists(iniPath)) {
                    result.iniPath = iniPath;
                    result.iniFound = true;
                    WriteToAdvancedLog("INI FOUND: " + iniPath.string(), __LINE__);
                }
                
                fs::path scriptBasePath = BuildPathCaseInsensitive(
                    fs::path(g_gamePath),
                    {"Data", "SKSE", "Plugins", "OBody_NG_PDA_NG_Full_Assistance", "Assets"}
                );
                
                if (fs::exists(scriptBasePath)) {
                    result.scriptsBaseDir = scriptBasePath;
                    result.scriptFound = true;
                    WriteToAdvancedLog("SCRIPT ASSETS FOUND: " + scriptBasePath.string(), __LINE__);
                }
            } else {
                WriteToAdvancedLog("ERROR: Standard plugin path does not exist", __LINE__);
            }
        } else {
            WriteToAdvancedLog("ERROR: Game path is empty", __LINE__);
        }
    }
    
    WriteToAdvancedLog("", __LINE__);
    WriteToAdvancedLog("================================================================", __LINE__);
    WriteToAdvancedLog("  DETECTION SUMMARY", __LINE__);
    WriteToAdvancedLog("================================================================", __LINE__);
    WriteToAdvancedLog("", __LINE__);
    
    WriteToAdvancedLog("Detection Method: " + result.detectionMethod, __LINE__);
    WriteToAdvancedLog("Component Status:", __LINE__);
    WriteToAdvancedLog("  [" + std::string(result.dllFound ? "OK" : "FAIL") + "] DLL File", __LINE__);
    WriteToAdvancedLog("  [" + std::string(result.iniFound ? "OK" : "FAIL") + "] INI Configuration", __LINE__);
    WriteToAdvancedLog("  [" + std::string(result.scriptFound ? "OK" : "FAIL") + "] Script Assets Directory", __LINE__);
    WriteToAdvancedLog("", __LINE__);
    
    result.success = result.dllFound && result.iniFound && result.scriptFound;
    
    if (result.success) {
        WriteToAdvancedLog("================================================================", __LINE__);
        WriteToAdvancedLog("  SUCCESS - ALL COMPONENTS DETECTED!", __LINE__);
        WriteToAdvancedLog("================================================================", __LINE__);
    } else {
        WriteToAdvancedLog("================================================================", __LINE__);
        WriteToAdvancedLog("  DETECTION INCOMPLETE - MISSING COMPONENTS", __LINE__);
        WriteToAdvancedLog("================================================================", __LINE__);
    }
    
    WriteToAdvancedLog("", __LINE__);
    
    return result;
}

// ===== MODIFIED PLUGIN FILTER LOADING WITH SUPPORT FOR BRACKET NAMES AND UNICODE =====

bool LoadPluginFilterList() {
    std::lock_guard<std::mutex> lock(g_pluginFilterMutex);
    
    g_pluginFilterMap.clear();
    
    if (!fs::exists(g_pluginFilterIniPath)) {
        WriteToAdvancedLog("Act2_Plugins.ini not found, will scan all plugins", __LINE__);
        return false;
    }
    
    std::ifstream iniFile(g_pluginFilterIniPath);
    if (!iniFile.is_open()) {
        WriteToAdvancedLog("ERROR: Could not open Act2_Plugins.ini", __LINE__);
        return false;
    }
    
    std::string line;
    int loadedCount = 0;
    
    while (std::getline(iniFile, line)) {
        line.erase(0, line.find_first_not_of(" \t\r\n"));
        line.erase(line.find_last_not_of(" \t\r\n") + 1);
        
        if (line.empty() || line[0] == ';' || line[0] == '#') {
            continue;
        }
        
        if (line[0] == '[' && line[line.length() - 1] == ']' && line.find('=') == std::string::npos) {
            continue;
        }
        
        size_t equalPos = line.find('=');
        if (equalPos != std::string::npos) {
            std::string pluginName = line.substr(0, equalPos);
            std::string value = line.substr(equalPos + 1);
            
            pluginName.erase(0, pluginName.find_first_not_of(" \t"));
            pluginName.erase(pluginName.find_last_not_of(" \t") + 1);
            value.erase(0, value.find_first_not_of(" \t"));
            value.erase(value.find_last_not_of(" \t") + 1);
            
            std::transform(value.begin(), value.end(), value.begin(), ::tolower);
            bool enabled = (value == "true" || value == "1" || value == "yes");
            
            g_pluginFilterMap[pluginName] = enabled;
            loadedCount++;
        }
    }
    
    iniFile.close();
    
    WriteToAdvancedLog("Loaded plugin filter list: " + std::to_string(loadedCount) + " entries", __LINE__);
    return true;
}

// ===== NPC FILTER LOADING WITH SUPPORT FOR BRACKET NAMES AND UNICODE =====

bool LoadNPCFilterList() {
    std::lock_guard<std::mutex> lock(g_npcFilterMutex);
    
    g_npcFilterMap.clear();
    
    if (!fs::exists(g_npcFilterIniPath)) {
        WriteToAdvancedLog("Act2_NPCs.ini not found, will scan all plugins", __LINE__);
        return false;
    }
    
    std::ifstream iniFile(g_npcFilterIniPath);
    if (!iniFile.is_open()) {
        WriteToAdvancedLog("ERROR: Could not open Act2_NPCs.ini", __LINE__);
        return false;
    }
    
    std::string line;
    int loadedCount = 0;
    
    while (std::getline(iniFile, line)) {
        line.erase(0, line.find_first_not_of(" \t\r\n"));
        line.erase(line.find_last_not_of(" \t\r\n") + 1);
        
        if (line.empty() || line[0] == ';' || line[0] == '#') {
            continue;
        }
        
        if (line[0] == '[' && line[line.length() - 1] == ']' && line.find('=') == std::string::npos) {
            continue;
        }
        
        size_t equalPos = line.find('=');
        if (equalPos != std::string::npos) {
            std::string pluginName = line.substr(0, equalPos);
            std::string value = line.substr(equalPos + 1);
            
            pluginName.erase(0, pluginName.find_first_not_of(" \t"));
            pluginName.erase(pluginName.find_last_not_of(" \t") + 1);
            value.erase(0, value.find_first_not_of(" \t"));
            value.erase(value.find_last_not_of(" \t") + 1);
            
            std::transform(value.begin(), value.end(), value.begin(), ::tolower);
            bool enabled = (value == "true" || value == "1" || value == "yes");
            
            g_npcFilterMap[pluginName] = enabled;
            loadedCount++;
        }
    }
    
    iniFile.close();
    
    WriteToAdvancedLog("Loaded NPC filter list: " + std::to_string(loadedCount) + " entries", __LINE__);
    return true;
}

bool LoadNPCTrackingConfig() {
    std::lock_guard<std::mutex> lock(g_npcTrackingMutex);
    
    if (!fs::exists(g_npcTrackingIniPath)) {
        std::ofstream iniFile(g_npcTrackingIniPath);
        if (iniFile.is_open()) {
            iniFile << "[NPC_tracking]\n";
            iniFile << "start = false\n";
            iniFile << "radio = 3000\n";
            iniFile << "\n";
            iniFile << "[Plugin_Outfits]\n";
            iniFile << "start = false\n";
            iniFile << "Plugin_list = false\n";
            iniFile << "\n";
            iniFile << "[Plugin_NPCs]\n";
            iniFile << "startNPCs = false\n";
            iniFile << "Plugin_listNPCs = false\n";
            iniFile.close();
            
            g_npcTrackingConfig.start = false;
            g_npcTrackingConfig.radio = 3000;
            g_npcTrackingConfig.lastModified = 0;
            
            g_pluginOutfitsConfig.start = false;
            g_pluginOutfitsConfig.pluginList = false;
            g_pluginOutfitsConfig.lastModified = 0;
            g_pluginOutfitsConfig.lastPluginListModified = 0;
            
            g_pluginNPCsConfig.startNPCs = false;
            g_pluginNPCsConfig.pluginListNPCs = false;
            g_pluginNPCsConfig.lastModified = 0;
            
            WriteToAdvancedLog("Created default Act2_Manager.ini", __LINE__);
            return true;
        }
        return false;
    }
    
    std::ifstream iniFile(g_npcTrackingIniPath);
    if (!iniFile.is_open()) {
        WriteToAdvancedLog("ERROR: Could not open Act2_Manager.ini", __LINE__);
        return false;
    }
    
    std::string line;
    std::string currentSection;
    
    while (std::getline(iniFile, line)) {
        line.erase(0, line.find_first_not_of(" \t\r\n"));
        line.erase(line.find_last_not_of(" \t\r\n") + 1);
        
        if (line.empty() || line[0] == ';' || line[0] == '#') {
            continue;
        }
        
        if (line[0] == '[' && line[line.length() - 1] == ']') {
            currentSection = line.substr(1, line.length() - 2);
            continue;
        }
        
        size_t equalPos = line.find('=');
        if (equalPos != std::string::npos) {
            std::string key = line.substr(0, equalPos);
            std::string value = line.substr(equalPos + 1);
            
            key.erase(0, key.find_first_not_of(" \t"));
            key.erase(key.find_last_not_of(" \t") + 1);
            value.erase(0, value.find_first_not_of(" \t"));
            value.erase(value.find_last_not_of(" \t") + 1);
            
            if (currentSection == "NPC_tracking") {
                if (key == "start") {
                    std::transform(value.begin(), value.end(), value.begin(), ::tolower);
                    g_npcTrackingConfig.start = (value == "true" || value == "1" || value == "yes");
                } else if (key == "radio") {
                    try {
                        g_npcTrackingConfig.radio = std::stoi(value);
                    } catch (...) {
                        g_npcTrackingConfig.radio = 3000;
                    }
                }
            } else if (currentSection == "Plugin_Outfits") {
                if (key == "start") {
                    std::transform(value.begin(), value.end(), value.begin(), ::tolower);
                    g_pluginOutfitsConfig.start = (value == "true" || value == "1" || value == "yes");
                } else if (key == "Plugin_list") {
                    std::transform(value.begin(), value.end(), value.begin(), ::tolower);
                    g_pluginOutfitsConfig.pluginList = (value == "true" || value == "1" || value == "yes");
                }
            } else if (currentSection == "Plugin_NPCs") {
                if (key == "startNPCs") {
                    std::transform(value.begin(), value.end(), value.begin(), ::tolower);
                    g_pluginNPCsConfig.startNPCs = (value == "true" || value == "1" || value == "yes");
                } else if (key == "Plugin_listNPCs") {
                    std::transform(value.begin(), value.end(), value.begin(), ::tolower);
                    g_pluginNPCsConfig.pluginListNPCs = (value == "true" || value == "1" || value == "yes");
                }
            }
        }
    }
    
    iniFile.close();
    return true;
}

bool SaveNPCTrackingConfig() {
    std::lock_guard<std::mutex> lock(g_npcTrackingMutex);
    
    std::ofstream iniFile(g_npcTrackingIniPath, std::ios::trunc);
    if (!iniFile.is_open()) {
        WriteToAdvancedLog("ERROR: Could not save Act2_Manager.ini", __LINE__);
        return false;
    }
    
    iniFile << "[NPC_tracking]\n";
    iniFile << "start = " << (g_npcTrackingConfig.start ? "true" : "false") << "\n";
    iniFile << "radio = " << g_npcTrackingConfig.radio << "\n";
    iniFile << "\n";
    iniFile << "[Plugin_Outfits]\n";
    iniFile << "start = " << (g_pluginOutfitsConfig.start ? "true" : "false") << "\n";
    iniFile << "Plugin_list = " << (g_pluginOutfitsConfig.pluginList ? "true" : "false") << "\n";
    iniFile << "\n";
    iniFile << "[Plugin_NPCs]\n";
    iniFile << "startNPCs = " << (g_pluginNPCsConfig.startNPCs ? "true" : "false") << "\n";
    iniFile << "Plugin_listNPCs = " << (g_pluginNPCsConfig.pluginListNPCs ? "true" : "false") << "\n";
    
    iniFile.close();
    
    WriteToAdvancedLog("Saved Act2_Manager.ini - NPC start=" + std::string(g_npcTrackingConfig.start ? "true" : "false") + 
                      ", radio=" + std::to_string(g_npcTrackingConfig.radio) + 
                      ", Plugin Outfits start=" + std::string(g_pluginOutfitsConfig.start ? "true" : "false") +
                      ", Plugin_list=" + std::string(g_pluginOutfitsConfig.pluginList ? "true" : "false") +
                      ", Plugin NPCs startNPCs=" + std::string(g_pluginNPCsConfig.startNPCs ? "true" : "false") +
                      ", Plugin_listNPCs=" + std::string(g_pluginNPCsConfig.pluginListNPCs ? "true" : "false"), __LINE__);
    
    return true;
}

bool LoadPluginOutfitsConfig() {
    std::lock_guard<std::mutex> lock(g_npcTrackingMutex);
    
    if (!fs::exists(g_npcTrackingIniPath)) {
        return false;
    }
    
    std::ifstream iniFile(g_npcTrackingIniPath);
    if (!iniFile.is_open()) {
        return false;
    }
    
    std::string line;
    std::string currentSection;
    
    while (std::getline(iniFile, line)) {
        line.erase(0, line.find_first_not_of(" \t\r\n"));
        line.erase(line.find_last_not_of(" \t\r\n") + 1);
        
        if (line.empty() || line[0] == ';' || line[0] == '#') {
            continue;
        }
        
        if (line[0] == '[' && line[line.length() - 1] == ']') {
            currentSection = line.substr(1, line.length() - 2);
            continue;
        }
        
        size_t equalPos = line.find('=');
        if (equalPos != std::string::npos) {
            std::string key = line.substr(0, equalPos);
            std::string value = line.substr(equalPos + 1);
            
            key.erase(0, key.find_first_not_of(" \t"));
            key.erase(key.find_last_not_of(" \t") + 1);
            value.erase(0, value.find_first_not_of(" \t"));
            value.erase(value.find_last_not_of(" \t") + 1);
            
            if (currentSection == "Plugin_Outfits") {
                if (key == "start") {
                    std::transform(value.begin(), value.end(), value.begin(), ::tolower);
                    g_pluginOutfitsConfig.start = (value == "true" || value == "1" || value == "yes");
                } else if (key == "Plugin_list") {
                    std::transform(value.begin(), value.end(), value.begin(), ::tolower);
                    g_pluginOutfitsConfig.pluginList = (value == "true" || value == "1" || value == "yes");
                }
            }
        }
    }
    
    iniFile.close();
    return true;
}

bool SavePluginOutfitsConfig() {
    return SaveNPCTrackingConfig();
}

NPCData CapturePlayerData() {
    NPCData playerData;
    
    auto* player = RE::PlayerCharacter::GetSingleton();
    if (!player) {
        WriteToAdvancedLog("ERROR: Could not get player singleton", __LINE__);
        return playerData;
    }
    
    auto* playerBase = player->GetActorBase();
    if (!playerBase) {
        WriteToAdvancedLog("ERROR: Could not get player base", __LINE__);
        return playerData;
    }
    
    playerData.name = playerBase->GetName();
    
    const char* pEditorID = playerBase->GetFormEditorID();
    if (pEditorID && strlen(pEditorID) > 0) {
        playerData.editorID = pEditorID;
    } else {
        playerData.editorID = "Unknown";
    }
    
    playerData.pluginName = "Skyrim.esm";
    
    auto* race = playerBase->GetRace();
    if (race) {
        playerData.race = race->GetName();
    } else {
        playerData.race = "Unknown";
    }
    
    playerData.gender = playerBase->IsFemale() ? "Female" : "Male";
    playerData.isVampire = IsActorVampire(player);
    playerData.isWerewolf = IsActorWerewolf(player);
    playerData.refID = player->GetFormID();
    playerData.baseID = playerBase->GetFormID();
    playerData.formID = playerBase->GetFormID();
    playerData.distanceFromPlayer = 0.0f;
    playerData.factions = GetActorFactions(player);
    playerData.equippedItems = GetAllEquippedItems(player);
    
    return playerData;
}

NPCData CaptureNPCData(RE::Actor* actor, RE::NiPoint3 playerPos) {
    NPCData npcData;
    
    if (!actor) return npcData;
    
    auto* actorBase = actor->GetActorBase();
    if (!actorBase) return npcData;
    
    npcData.name = actorBase->GetName();
    
    const char* nEditorID = actorBase->GetFormEditorID();
    if (nEditorID && strlen(nEditorID) > 0) {
        npcData.editorID = nEditorID;
    } else {
        npcData.editorID = "Unknown";
    }
    
    npcData.pluginName = GetPluginNameFromFormID(actorBase->GetFormID());
    
    auto* race = actorBase->GetRace();
    if (race) {
        npcData.race = race->GetName();
    } else {
        npcData.race = "Unknown";
    }
    
    npcData.gender = actorBase->IsFemale() ? "Female" : "Male";
    npcData.isVampire = IsActorVampire(actor);
    npcData.isWerewolf = IsActorWerewolf(actor);
    npcData.refID = actor->GetFormID();
    npcData.baseID = actorBase->GetFormID();
    npcData.formID = actorBase->GetFormID();
    
    RE::NiPoint3 npcPos = actor->GetPosition();
    npcData.distanceFromPlayer = playerPos.GetDistance(npcPos);
    
    npcData.factions = GetActorFactions(actor);
    npcData.equippedItems = GetAllEquippedItems(actor);
    
    return npcData;
}

std::vector<NPCData> ScanNPCsAroundPlayer(float radius) {
    std::vector<NPCData> npcList;
    
    auto* player = RE::PlayerCharacter::GetSingleton();
    if (!player) {
        WriteToAdvancedLog("ERROR: Could not get player for NPC scan", __LINE__);
        return npcList;
    }
    
    auto* processLists = RE::ProcessLists::GetSingleton();
    if (!processLists) {
        WriteToAdvancedLog("ERROR: Could not get process lists", __LINE__);
        return npcList;
    }
    
    RE::NiPoint3 playerPos = player->GetPosition();
    auto* playerCell = player->GetParentCell();
    auto* playerWorldspace = player->GetWorldspace();
    
    WriteToAdvancedLog("Starting NPC scan with radius: " + std::to_string(radius), __LINE__);
    WriteToAdvancedLog("Player cell: " + std::string(playerCell ? "Valid" : "NULL"), __LINE__);
    WriteToAdvancedLog("Player worldspace: " + std::string(playerWorldspace ? "Valid" : "NULL"), __LINE__);
    
    auto scanActorList = [&](auto& actorHandles, const std::string& priority) {
        int scanned = 0;
        int skipped_no_3d = 0;
        int skipped_disabled = 0;
        int skipped_different_cell = 0;
        int skipped_different_worldspace = 0;
        int skipped_distance = 0;
        int skipped_unknown_plugin = 0;
        int added = 0;
        
        for (auto& actorHandle : actorHandles) {
            auto actor = actorHandle.get();
            if (!actor) continue;
            
            scanned++;
            
            if (actor.get() == player) continue;
            
            if (!actor->Is3DLoaded()) {
                skipped_no_3d++;
                continue;
            }
            
            if (actor->IsDisabled()) {
                skipped_disabled++;
                continue;
            }
            
            auto* actorCell = actor->GetParentCell();
            if (!actorCell) {
                skipped_different_cell++;
                continue;
            }
            
            auto* actorWorldspace = actor->GetWorldspace();
            
            if (playerWorldspace && actorWorldspace != playerWorldspace) {
                skipped_different_worldspace++;
                continue;
            }
            
            if (!playerWorldspace && !actorWorldspace) {
                if (actorCell != playerCell) {
                    skipped_different_cell++;
                    continue;
                }
            }
            
            RE::NiPoint3 npcPos = actor->GetPosition();
            float distance = playerPos.GetDistance(npcPos);
            
            if (distance > radius) {
                skipped_distance++;
                continue;
            }
            
            auto* actorBase = actor->GetActorBase();
            if (!actorBase) continue;
            
            NPCData npcData = CaptureNPCData(actor.get(), playerPos);
            
            if (npcData.pluginName == "Unknown" || npcData.pluginName.empty()) {
                WriteToAdvancedLog("SKIPPED NPC with Unknown plugin: " + npcData.name + 
                                 " (distance: " + std::to_string(distance) + ")", __LINE__);
                skipped_unknown_plugin++;
                continue;
            }
            
            if (!npcData.name.empty()) {
                npcList.push_back(npcData);
                added++;
                
                WriteToAdvancedLog("ADDED: " + npcData.name + 
                                 " | Distance: " + std::to_string(distance) + 
                                 " | Plugin: " + npcData.pluginName, __LINE__);
            }
        }
        
        WriteToAdvancedLog("===== " + priority + " PRIORITY SCAN RESULTS =====", __LINE__);
        WriteToAdvancedLog("  Total scanned: " + std::to_string(scanned), __LINE__);
        WriteToAdvancedLog("  Skipped (no 3D): " + std::to_string(skipped_no_3d), __LINE__);
        WriteToAdvancedLog("  Skipped (disabled): " + std::to_string(skipped_disabled), __LINE__);
        WriteToAdvancedLog("  Skipped (different cell): " + std::to_string(skipped_different_cell), __LINE__);
        WriteToAdvancedLog("  Skipped (different worldspace): " + std::to_string(skipped_different_worldspace), __LINE__);
        WriteToAdvancedLog("  Skipped (distance): " + std::to_string(skipped_distance), __LINE__);
        WriteToAdvancedLog("  Skipped (unknown plugin): " + std::to_string(skipped_unknown_plugin), __LINE__);
        WriteToAdvancedLog("  ADDED: " + std::to_string(added), __LINE__);
    };
    
    scanActorList(processLists->highActorHandles, "HIGH");
    scanActorList(processLists->middleHighActorHandles, "MEDIUM");
    scanActorList(processLists->lowActorHandles, "LOW");
    
    WriteToAdvancedLog("========================================", __LINE__);
    WriteToAdvancedLog("FINAL RESULT: " + std::to_string(npcList.size()) + " valid NPCs found", __LINE__);
    WriteToAdvancedLog("========================================", __LINE__);
    
    return npcList;
}

std::vector<OutfitItemData> GetOutfitItems(RE::BGSOutfit* outfit) {
    std::vector<OutfitItemData> items;
    
    if (!outfit) return items;
    
    if (outfit->outfitItems.empty()) return items;
    
    for (auto* item : outfit->outfitItems) {
        if (!item) continue;
        
        OutfitItemData itemData;
        
        const char* editorID = item->GetFormEditorID();
        if (editorID && strlen(editorID) > 0) {
            itemData.name = editorID;
        } else {
            const char* displayName = item->GetName();
            if (displayName && strlen(displayName) > 0) {
                itemData.name = displayName;
            } else {
                itemData.name = "Unnamed Item";
            }
        }
        
        itemData.formID = item->GetFormID();
        items.push_back(itemData);
    }
    
    return items;
}

std::vector<PluginCountData> ScanAllPluginsForCounts() {
    std::vector<PluginCountData> pluginCounts;
    
    WriteToAdvancedLog("========================================", __LINE__);
    WriteToAdvancedLog("PLUGIN COUNT SCANNING STARTED", __LINE__);
    WriteToAdvancedLog("========================================", __LINE__);
    
    auto* dataHandler = RE::TESDataHandler::GetSingleton();
    if (!dataHandler) {
        WriteToAdvancedLog("ERROR: Could not get TESDataHandler", __LINE__);
        return pluginCounts;
    }
    
    std::unordered_map<std::string, PluginCountData> pluginMap;
    
    WriteToAdvancedLog("Counting armors...", __LINE__);
    auto& armors = dataHandler->GetFormArray<RE::TESObjectARMO>();
    for (auto* armor : armors) {
        if (!armor) continue;
        
        auto* file = armor->GetFile(0);
        if (!file) continue;
        
        std::string pluginName = file->fileName;
        if (pluginName.empty()) continue;
        
        if (pluginMap.find(pluginName) == pluginMap.end()) {
            PluginCountData newData;
            newData.pluginName = pluginName;
            newData.armorCount = 0;
            newData.outfitCount = 0;
            newData.weaponCount = 0;
            pluginMap[pluginName] = newData;
        }
        
        pluginMap[pluginName].armorCount++;
    }
    
    WriteToAdvancedLog("Counting outfits...", __LINE__);
    auto& outfits = dataHandler->GetFormArray<RE::BGSOutfit>();
    for (auto* outfit : outfits) {
        if (!outfit) continue;
        
        auto* file = outfit->GetFile(0);
        if (!file) continue;
        
        std::string pluginName = file->fileName;
        if (pluginName.empty()) continue;
        
        if (pluginMap.find(pluginName) == pluginMap.end()) {
            PluginCountData newData;
            newData.pluginName = pluginName;
            newData.armorCount = 0;
            newData.outfitCount = 0;
            newData.weaponCount = 0;
            pluginMap[pluginName] = newData;
        }
        
        pluginMap[pluginName].outfitCount++;
    }
    
    WriteToAdvancedLog("Counting weapons...", __LINE__);
    auto& weapons = dataHandler->GetFormArray<RE::TESObjectWEAP>();
    for (auto* weapon : weapons) {
        if (!weapon) continue;
        
        auto* file = weapon->GetFile(0);
        if (!file) continue;
        
        std::string pluginName = file->fileName;
        if (pluginName.empty()) continue;
        
        if (pluginMap.find(pluginName) == pluginMap.end()) {
            PluginCountData newData;
            newData.pluginName = pluginName;
            newData.armorCount = 0;
            newData.outfitCount = 0;
            newData.weaponCount = 0;
            pluginMap[pluginName] = newData;
        }
        
        pluginMap[pluginName].weaponCount++;
    }
    
    for (auto& [pluginName, data] : pluginMap) {
        pluginCounts.push_back(data);
    }
    
    WriteToAdvancedLog("========================================", __LINE__);
    WriteToAdvancedLog("COUNT SCANNING COMPLETE", __LINE__);
    WriteToAdvancedLog("Total plugins: " + std::to_string(pluginCounts.size()), __LINE__);
    WriteToAdvancedLog("========================================", __LINE__);
    
    return pluginCounts;
}

void ExportPluginListToJSON(const std::vector<PluginCountData>& pluginCounts) {
    std::ofstream jsonFile(g_pluginListJsonPath, std::ios::trunc);
    if (!jsonFile.is_open()) {
        WriteToAdvancedLog("ERROR: Could not create Act2_Plugins.json", __LINE__);
        return;
    }
    
    int totalArmors = 0;
    int totalOutfits = 0;
    int totalWeapons = 0;
    
    for (const auto& plugin : pluginCounts) {
        totalArmors += plugin.armorCount;
        totalOutfits += plugin.outfitCount;
        totalWeapons += plugin.weaponCount;
    }
    
    jsonFile << "{\n";
    jsonFile << "  \"timestamp\": \"" << GetCurrentTimeString() << "\",\n";
    jsonFile << "  \"total_plugins\": " << pluginCounts.size() << ",\n";
    jsonFile << "  \"total_armors\": " << totalArmors << ",\n";
    jsonFile << "  \"total_outfits\": " << totalOutfits << ",\n";
    jsonFile << "  \"total_weapons\": " << totalWeapons << ",\n";
    jsonFile << "  \"plugins\": [\n";
    
    for (size_t i = 0; i < pluginCounts.size(); ++i) {
        const auto& plugin = pluginCounts[i];
        
        jsonFile << "    {\n";
        jsonFile << "      \"plugin_name\": \"" << plugin.pluginName << "\",\n";
        jsonFile << "      \"armor_count\": " << plugin.armorCount << ",\n";
        jsonFile << "      \"outfit_count\": " << plugin.outfitCount << ",\n";
        jsonFile << "      \"weapon_count\": " << plugin.weaponCount << "\n";
        jsonFile << "    }" << (i < pluginCounts.size() - 1 ? "," : "") << "\n";
    }
    
    jsonFile << "  ]\n";
    jsonFile << "}\n";
    
    jsonFile.close();
    
    WriteToAdvancedLog("Successfully exported plugin counts to Act2_Plugins.json", __LINE__);
    WriteToAdvancedLog("Total plugins: " + std::to_string(pluginCounts.size()), __LINE__);
    WriteToAdvancedLog("Total armors: " + std::to_string(totalArmors), __LINE__);
    WriteToAdvancedLog("Total outfits: " + std::to_string(totalOutfits), __LINE__);
    WriteToAdvancedLog("Total weapons: " + std::to_string(totalWeapons), __LINE__);
}

void ExecutePluginListScanning() {
    WriteToAdvancedLog("========================================", __LINE__);
    WriteToAdvancedLog("PLUGIN LIST SCANNING SYSTEM ACTIVATED", __LINE__);
    WriteToAdvancedLog("========================================", __LINE__);
    
    WriteToAdvancedLog("Mode: PLUGIN LIST COUNTS ONLY", __LINE__);
    
    std::vector<PluginCountData> pluginCounts = ScanAllPluginsForCounts();
    
    if (pluginCounts.empty()) {
        WriteToAdvancedLog("WARNING: No plugin count data found", __LINE__);
    } else {
        WriteToAdvancedLog("Exporting plugin counts to JSON...", __LINE__);
        ExportPluginListToJSON(pluginCounts);
    }
    
    WriteToAdvancedLog("Resetting plugin_list flag to false...", __LINE__);
    g_pluginOutfitsConfig.pluginList = false;
    SavePluginOutfitsConfig();
    
    WriteToAdvancedLog("========================================", __LINE__);
    WriteToAdvancedLog("PLUGIN LIST SCANNING COMPLETE", __LINE__);
    WriteToAdvancedLog("========================================", __LINE__);
}

// ===== NPC SCANNING SYSTEM FOR PLUGIN NPCS =====

std::vector<PluginNPCCountData> ScanAllPluginsForNPCCount() {
    std::vector<PluginNPCCountData> npcCounts;
    
    WriteToAdvancedLog("========================================", __LINE__);
    WriteToAdvancedLog("NPC COUNT SCANNING STARTED", __LINE__);
    WriteToAdvancedLog("========================================", __LINE__);
    
    auto* dataHandler = RE::TESDataHandler::GetSingleton();
    if (!dataHandler) {
        WriteToAdvancedLog("ERROR: Could not get TESDataHandler", __LINE__);
        return npcCounts;
    }
    
    std::unordered_map<std::string, PluginNPCCountData> pluginMap;
    
    WriteToAdvancedLog("Counting NPCs...", __LINE__);
    auto& npcs = dataHandler->GetFormArray<RE::TESNPC>();
    
    int totalNPCs = 0;
    for (auto* npc : npcs) {
        if (!npc) continue;
        
        auto* file = npc->GetFile(0);
        if (!file) continue;
        
        std::string pluginName = file->fileName;
        if (pluginName.empty()) continue;
        
        if (pluginMap.find(pluginName) == pluginMap.end()) {
            PluginNPCCountData newData;
            newData.pluginName = pluginName;
            newData.npcCount = 0;
            pluginMap[pluginName] = newData;
        }
        
        pluginMap[pluginName].npcCount++;
        totalNPCs++;
    }
    
    for (auto& [pluginName, data] : pluginMap) {
        npcCounts.push_back(data);
    }
    
    WriteToAdvancedLog("========================================", __LINE__);
    WriteToAdvancedLog("NPC COUNT SCANNING COMPLETE", __LINE__);
    WriteToAdvancedLog("Total plugins: " + std::to_string(npcCounts.size()), __LINE__);
    WriteToAdvancedLog("Total NPCs: " + std::to_string(totalNPCs), __LINE__);
    WriteToAdvancedLog("========================================", __LINE__);
    
    return npcCounts;
}

std::vector<PluginNPCListData> ScanFilteredPluginsForNPCList() {
    std::vector<PluginNPCListData> npcDataList;
    
    WriteToAdvancedLog("========================================", __LINE__);
    WriteToAdvancedLog("NPC LIST SCANNING STARTED (FILTERED)", __LINE__);
    WriteToAdvancedLog("========================================", __LINE__);
    
    LoadNPCFilterList();
    
    if (g_npcFilterMap.empty()) {
        WriteToAdvancedLog("WARNING: No NPC filter loaded, aborting scan", __LINE__);
        return npcDataList;
    }
    
    int enabledCount = 0;
    for (const auto& [plugin, enabled] : g_npcFilterMap) {
        if (enabled) enabledCount++;
    }
    
    WriteToAdvancedLog("Filter loaded: " + std::to_string(g_npcFilterMap.size()) + " plugins", __LINE__);
    WriteToAdvancedLog("Enabled plugins: " + std::to_string(enabledCount), __LINE__);
    
    auto* dataHandler = RE::TESDataHandler::GetSingleton();
    if (!dataHandler) {
        WriteToAdvancedLog("ERROR: Could not get TESDataHandler", __LINE__);
        return npcDataList;
    }
    
    std::unordered_map<std::string, PluginNPCListData> pluginMap;
    
    WriteToAdvancedLog("Scanning NPCs (filtered)...", __LINE__);
    int npcCount = 0;
    int npcSkipped = 0;
    auto& npcs = dataHandler->GetFormArray<RE::TESNPC>();
    
    for (auto* npc : npcs) {
        if (!npc) continue;
        
        auto* file = npc->GetFile(0);
        if (!file) continue;
        
        std::string pluginName = file->fileName;
        if (pluginName.empty()) continue;
        
        auto it = g_npcFilterMap.find(pluginName);
        if (it == g_npcFilterMap.end() || !it->second) {
            npcSkipped++;
            continue;
        }
        
        NPCBasicData npcData;
        
        const char* editorID = npc->GetFormEditorID();
        if (editorID && strlen(editorID) > 0) {
            npcData.editorID = editorID;
        } else {
            npcData.editorID = "Unknown";
        }
        
        const char* displayName = npc->GetName();
        if (displayName && strlen(displayName) > 0) {
            npcData.name = displayName;
        } else {
            npcData.name = npcData.editorID;
        }
        
        npcData.formID = npc->GetFormID();
        npcData.baseID = npc->GetFormID();
        
        npcData.race = "Unknown";
        if (npc->race) {
            const char* raceEditorID = npc->race->GetFormEditorID();
            if (raceEditorID && strlen(raceEditorID) > 0) {
                npcData.race = raceEditorID;
            }
        }
        
        npcData.gender = npc->IsFemale() ? "Female" : "Male";
        
        if (pluginMap.find(pluginName) == pluginMap.end()) {
            PluginNPCListData newPluginData;
            newPluginData.pluginName = pluginName;
            pluginMap[pluginName] = newPluginData;
        }
        
        pluginMap[pluginName].npcs.push_back(npcData);
        npcCount++;
    }
    
    WriteToAdvancedLog("NPCs scanned: " + std::to_string(npcCount) + " (skipped: " + std::to_string(npcSkipped) + ")", __LINE__);
    
    for (auto& [pluginName, pluginData] : pluginMap) {
        npcDataList.push_back(pluginData);
    }
    
    WriteToAdvancedLog("========================================", __LINE__);
    WriteToAdvancedLog("FILTERED NPC SCANNING COMPLETE", __LINE__);
    WriteToAdvancedLog("Plugins included: " + std::to_string(npcDataList.size()), __LINE__);
    WriteToAdvancedLog("Total NPCs: " + std::to_string(npcCount), __LINE__);
    WriteToAdvancedLog("========================================", __LINE__);
    
    return npcDataList;
}

void ExportNPCCountToJSON(const std::vector<PluginNPCCountData>& npcCounts) {
    std::ofstream jsonFile(g_npcCountJsonPath, std::ios::trunc);
    if (!jsonFile.is_open()) {
        WriteToAdvancedLog("ERROR: Could not create Act2_NPCs.json", __LINE__);
        return;
    }
    
    int totalNPCs = 0;
    for (const auto& plugin : npcCounts) {
        totalNPCs += plugin.npcCount;
    }
    
    jsonFile << "{\n";
    jsonFile << "  \"timestamp\": \"" << GetCurrentTimeString() << "\",\n";
    jsonFile << "  \"total_plugins\": " << npcCounts.size() << ",\n";
    jsonFile << "  \"total_npcs\": " << totalNPCs << ",\n";
    jsonFile << "  \"plugins\": [\n";
    
    for (size_t i = 0; i < npcCounts.size(); ++i) {
        const auto& plugin = npcCounts[i];
        
        jsonFile << "    {\n";
        jsonFile << "      \"plugin_name\": \"" << plugin.pluginName << "\",\n";
        jsonFile << "      \"npc_count\": " << plugin.npcCount << "\n";
        jsonFile << "    }" << (i < npcCounts.size() - 1 ? "," : "") << "\n";
    }
    
    jsonFile << "  ]\n";
    jsonFile << "}\n";
    
    jsonFile.close();
    
    WriteToAdvancedLog("Successfully exported NPC counts to Act2_NPCs.json", __LINE__);
    WriteToAdvancedLog("Total plugins: " + std::to_string(npcCounts.size()), __LINE__);
    WriteToAdvancedLog("Total NPCs: " + std::to_string(totalNPCs), __LINE__);
}

void ExportNPCListToJSON(const std::vector<PluginNPCListData>& npcData) {
    std::ofstream jsonFile(g_npcListJsonPath, std::ios::trunc);
    if (!jsonFile.is_open()) {
        WriteToAdvancedLog("ERROR: Could not create Act2_NPCs_List.json", __LINE__);
        return;
    }
    
    int totalNPCs = 0;
    for (const auto& plugin : npcData) {
        totalNPCs += static_cast<int>(plugin.npcs.size());
    }
    
    jsonFile << "{\n";
    jsonFile << "  \"timestamp\": \"" << GetCurrentTimeString() << "\",\n";
    jsonFile << "  \"total_npcs\": " << totalNPCs << ",\n";
    jsonFile << "  \"plugins\": {\n";
    
    for (size_t i = 0; i < npcData.size(); ++i) {
        const auto& plugin = npcData[i];
        
        jsonFile << "    \"" << plugin.pluginName << "\": {\n";
        jsonFile << "      \"npcs\": [\n";
        
        for (size_t j = 0; j < plugin.npcs.size(); ++j) {
            const auto& npc = plugin.npcs[j];
            jsonFile << "        {\n";
            jsonFile << "          \"name\": \"" << npc.name << "\",\n";
            jsonFile << "          \"editor_id\": \"" << npc.editorID << "\",\n";
            jsonFile << "          \"form_id\": \"0x" << std::hex << std::uppercase << npc.formID << std::dec << "\",\n";
            jsonFile << "          \"base_id\": \"0x" << std::hex << std::uppercase << npc.baseID << std::dec << "\",\n";
            jsonFile << "          \"race\": \"" << npc.race << "\",\n";
            jsonFile << "          \"gender\": \"" << npc.gender << "\"\n";
            jsonFile << "        }" << (j < plugin.npcs.size() - 1 ? "," : "") << "\n";
        }
        
        jsonFile << "      ]\n";
        jsonFile << "    }" << (i < npcData.size() - 1 ? "," : "") << "\n";
    }
    
    jsonFile << "  }\n";
    jsonFile << "}\n";
    
    jsonFile.close();
    
    WriteToAdvancedLog("Successfully exported NPC list to Act2_NPCs_List.json", __LINE__);
    WriteToAdvancedLog("Total NPCs: " + std::to_string(totalNPCs), __LINE__);
}

void ExecuteNPCCountScanning() {
    WriteToAdvancedLog("========================================", __LINE__);
    WriteToAdvancedLog("NPC COUNT SCANNING SYSTEM ACTIVATED", __LINE__);
    WriteToAdvancedLog("========================================", __LINE__);
    
    WriteToAdvancedLog("Mode: NPC COUNT ONLY", __LINE__);
    
    std::vector<PluginNPCCountData> npcCounts = ScanAllPluginsForNPCCount();
    
    if (npcCounts.empty()) {
        WriteToAdvancedLog("WARNING: No NPC count data found", __LINE__);
    } else {
        WriteToAdvancedLog("Exporting NPC counts to JSON...", __LINE__);
        ExportNPCCountToJSON(npcCounts);
    }
    
    WriteToAdvancedLog("Resetting startNPCs flag to false...", __LINE__);
    g_pluginNPCsConfig.startNPCs = false;
    SaveNPCTrackingConfig();
    
    WriteToAdvancedLog("========================================", __LINE__);
    WriteToAdvancedLog("NPC COUNT SCANNING COMPLETE", __LINE__);
    WriteToAdvancedLog("========================================", __LINE__);
}

void ExecuteNPCListScanning() {
    WriteToAdvancedLog("========================================", __LINE__);
    WriteToAdvancedLog("NPC LIST SCANNING SYSTEM ACTIVATED", __LINE__);
    WriteToAdvancedLog("========================================", __LINE__);
    
    WriteToAdvancedLog("Mode: FULL NPC LIST", __LINE__);
    
    std::vector<PluginNPCListData> npcData = ScanFilteredPluginsForNPCList();
    
    if (npcData.empty()) {
        WriteToAdvancedLog("WARNING: No NPC data found", __LINE__);
    } else {
        WriteToAdvancedLog("Exporting NPC list to JSON...", __LINE__);
        ExportNPCListToJSON(npcData);
    }
    
    WriteToAdvancedLog("Resetting Plugin_listNPCs flag to false...", __LINE__);
    g_pluginNPCsConfig.pluginListNPCs = false;
    SaveNPCTrackingConfig();
    
    WriteToAdvancedLog("========================================", __LINE__);
    WriteToAdvancedLog("NPC LIST SCANNING COMPLETE", __LINE__);
    WriteToAdvancedLog("========================================", __LINE__);
}

std::vector<PluginOutfitsData> ScanAllPluginsForItems() {
    std::vector<PluginOutfitsData> pluginDataList;
    
    WriteToAdvancedLog("========================================", __LINE__);
    WriteToAdvancedLog("PLUGIN OUTFITS SCANNING STARTED (ALL PLUGINS)", __LINE__);
    WriteToAdvancedLog("========================================", __LINE__);
    
    auto* dataHandler = RE::TESDataHandler::GetSingleton();
    if (!dataHandler) {
        WriteToAdvancedLog("ERROR: Could not get TESDataHandler", __LINE__);
        return pluginDataList;
    }
    
    std::unordered_map<std::string, PluginOutfitsData> pluginMap;
    
    WriteToAdvancedLog("Scanning armors...", __LINE__);
    int armorCount = 0;
    auto& armors = dataHandler->GetFormArray<RE::TESObjectARMO>();
    for (auto* armor : armors) {
        if (!armor) continue;
        
        auto* file = armor->GetFile(0);
        if (!file) continue;
        
        std::string pluginName = file->fileName;
        if (pluginName.empty()) continue;
        
        PluginItemData itemData;
        
        const char* editorID = armor->GetFormEditorID();
        if (editorID && strlen(editorID) > 0) {
            itemData.name = editorID;
        } else {
            const char* displayName = armor->GetName();
            if (displayName && strlen(displayName) > 0) {
                itemData.name = displayName;
            } else {
                itemData.name = "Unnamed Armor";
            }
        }
        
        itemData.formID = armor->GetFormID();
        
        if (pluginMap.find(pluginName) == pluginMap.end()) {
            PluginOutfitsData newPluginData;
            newPluginData.pluginName = pluginName;
            pluginMap[pluginName] = newPluginData;
        }
        
        pluginMap[pluginName].armors.push_back(itemData);
        armorCount++;
    }
    WriteToAdvancedLog("Total armors scanned: " + std::to_string(armorCount), __LINE__);
    
    WriteToAdvancedLog("Scanning outfits...", __LINE__);
    int outfitCount = 0;
    auto& outfits = dataHandler->GetFormArray<RE::BGSOutfit>();
    for (auto* outfit : outfits) {
        if (!outfit) continue;
        
        auto* file = outfit->GetFile(0);
        if (!file) continue;
        
        std::string pluginName = file->fileName;
        if (pluginName.empty()) continue;
        
        PluginOutfitData outfitData;
        
        const char* editorID = outfit->GetFormEditorID();
        if (editorID && strlen(editorID) > 0) {
            outfitData.name = editorID;
        } else {
            const char* displayName = outfit->GetName();
            if (displayName && strlen(displayName) > 0) {
                outfitData.name = displayName;
            } else {
                outfitData.name = "Unnamed Outfit";
            }
        }
        
        outfitData.formID = outfit->GetFormID();
        outfitData.items = GetOutfitItems(outfit);
        
        if (pluginMap.find(pluginName) == pluginMap.end()) {
            PluginOutfitsData newPluginData;
            newPluginData.pluginName = pluginName;
            pluginMap[pluginName] = newPluginData;
        }
        
        pluginMap[pluginName].outfits.push_back(outfitData);
        outfitCount++;
    }
    WriteToAdvancedLog("Total outfits scanned: " + std::to_string(outfitCount), __LINE__);
    
    WriteToAdvancedLog("Scanning weapons...", __LINE__);
    int weaponCount = 0;
    auto& weapons = dataHandler->GetFormArray<RE::TESObjectWEAP>();
    for (auto* weapon : weapons) {
        if (!weapon) continue;
        
        auto* file = weapon->GetFile(0);
        if (!file) continue;
        
        std::string pluginName = file->fileName;
        if (pluginName.empty()) continue;
        
        PluginItemData itemData;
        
        const char* editorID = weapon->GetFormEditorID();
        if (editorID && strlen(editorID) > 0) {
            itemData.name = editorID;
        } else {
            const char* displayName = weapon->GetName();
            if (displayName && strlen(displayName) > 0) {
                itemData.name = displayName;
            } else {
                itemData.name = "Unnamed Weapon";
            }
        }
        
        itemData.formID = weapon->GetFormID();
        
        if (pluginMap.find(pluginName) == pluginMap.end()) {
            PluginOutfitsData newPluginData;
            newPluginData.pluginName = pluginName;
            pluginMap[pluginName] = newPluginData;
        }
        
        pluginMap[pluginName].weapons.push_back(itemData);
        weaponCount++;
    }
    WriteToAdvancedLog("Total weapons scanned: " + std::to_string(weaponCount), __LINE__);
    
    for (auto& [pluginName, pluginData] : pluginMap) {
        pluginDataList.push_back(pluginData);
    }
    
    WriteToAdvancedLog("========================================", __LINE__);
    WriteToAdvancedLog("SCANNING COMPLETE", __LINE__);
    WriteToAdvancedLog("Total plugins: " + std::to_string(pluginDataList.size()), __LINE__);
    WriteToAdvancedLog("Total items: " + std::to_string(armorCount + outfitCount + weaponCount), __LINE__);
    WriteToAdvancedLog("========================================", __LINE__);
    
    return pluginDataList;
}

std::vector<PluginOutfitsData> ScanFilteredPluginsForItems() {
    std::vector<PluginOutfitsData> pluginDataList;
    
    WriteToAdvancedLog("========================================", __LINE__);
    WriteToAdvancedLog("PLUGIN OUTFITS SCANNING STARTED (FILTERED)", __LINE__);
    WriteToAdvancedLog("========================================", __LINE__);
    
    LoadPluginFilterList();
    
    if (g_pluginFilterMap.empty()) {
        WriteToAdvancedLog("WARNING: No filter loaded, scanning all plugins", __LINE__);
        return ScanAllPluginsForItems();
    }
    
    int enabledCount = 0;
    for (const auto& [plugin, enabled] : g_pluginFilterMap) {
        if (enabled) enabledCount++;
    }
    
    WriteToAdvancedLog("Filter loaded: " + std::to_string(g_pluginFilterMap.size()) + " plugins", __LINE__);
    WriteToAdvancedLog("Enabled plugins: " + std::to_string(enabledCount), __LINE__);
    
    auto* dataHandler = RE::TESDataHandler::GetSingleton();
    if (!dataHandler) {
        WriteToAdvancedLog("ERROR: Could not get TESDataHandler", __LINE__);
        return pluginDataList;
    }
    
    std::unordered_map<std::string, PluginOutfitsData> pluginMap;
    
    WriteToAdvancedLog("Scanning armors (filtered)...", __LINE__);
    int armorCount = 0;
    int armorSkipped = 0;
    auto& armors = dataHandler->GetFormArray<RE::TESObjectARMO>();
    for (auto* armor : armors) {
        if (!armor) continue;
        
        auto* file = armor->GetFile(0);
        if (!file) continue;
        
        std::string pluginName = file->fileName;
        if (pluginName.empty()) continue;
        
        auto it = g_pluginFilterMap.find(pluginName);
        if (it == g_pluginFilterMap.end() || !it->second) {
            armorSkipped++;
            continue;
        }
        
        PluginItemData itemData;
        
        const char* editorID = armor->GetFormEditorID();
        if (editorID && strlen(editorID) > 0) {
            itemData.name = editorID;
        } else {
            const char* displayName = armor->GetName();
            if (displayName && strlen(displayName) > 0) {
                itemData.name = displayName;
            } else {
                itemData.name = "Unnamed Armor";
            }
        }
        
        itemData.formID = armor->GetFormID();
        
        if (pluginMap.find(pluginName) == pluginMap.end()) {
            PluginOutfitsData newPluginData;
            newPluginData.pluginName = pluginName;
            pluginMap[pluginName] = newPluginData;
        }
        
        pluginMap[pluginName].armors.push_back(itemData);
        armorCount++;
    }
    WriteToAdvancedLog("Armors scanned: " + std::to_string(armorCount) + " (skipped: " + std::to_string(armorSkipped) + ")", __LINE__);
    
    WriteToAdvancedLog("Scanning outfits (filtered)...", __LINE__);
    int outfitCount = 0;
    int outfitSkipped = 0;
    auto& outfits = dataHandler->GetFormArray<RE::BGSOutfit>();
    for (auto* outfit : outfits) {
        if (!outfit) continue;
        
        auto* file = outfit->GetFile(0);
        if (!file) continue;
        
        std::string pluginName = file->fileName;
        if (pluginName.empty()) continue;
        
        auto it = g_pluginFilterMap.find(pluginName);
        if (it == g_pluginFilterMap.end() || !it->second) {
            outfitSkipped++;
            continue;
        }
        
        PluginOutfitData outfitData;
        
        const char* editorID = outfit->GetFormEditorID();
        if (editorID && strlen(editorID) > 0) {
            outfitData.name = editorID;
        } else {
            const char* displayName = outfit->GetName();
            if (displayName && strlen(displayName) > 0) {
                outfitData.name = displayName;
            } else {
                outfitData.name = "Unnamed Outfit";
            }
        }
        
        outfitData.formID = outfit->GetFormID();
        outfitData.items = GetOutfitItems(outfit);
        
        if (pluginMap.find(pluginName) == pluginMap.end()) {
            PluginOutfitsData newPluginData;
            newPluginData.pluginName = pluginName;
            pluginMap[pluginName] = newPluginData;
        }
        
        pluginMap[pluginName].outfits.push_back(outfitData);
        outfitCount++;
    }
    WriteToAdvancedLog("Outfits scanned: " + std::to_string(outfitCount) + " (skipped: " + std::to_string(outfitSkipped) + ")", __LINE__);
    
    WriteToAdvancedLog("Scanning weapons (filtered)...", __LINE__);
    int weaponCount = 0;
    int weaponSkipped = 0;
    auto& weapons = dataHandler->GetFormArray<RE::TESObjectWEAP>();
    for (auto* weapon : weapons) {
        if (!weapon) continue;
        
        auto* file = weapon->GetFile(0);
        if (!file) continue;
        
        std::string pluginName = file->fileName;
        if (pluginName.empty()) continue;
        
        auto it = g_pluginFilterMap.find(pluginName);
        if (it == g_pluginFilterMap.end() || !it->second) {
            weaponSkipped++;
            continue;
        }
        
        PluginItemData itemData;
        
        const char* editorID = weapon->GetFormEditorID();
        if (editorID && strlen(editorID) > 0) {
            itemData.name = editorID;
        } else {
            const char* displayName = weapon->GetName();
            if (displayName && strlen(displayName) > 0) {
                itemData.name = displayName;
            } else {
                itemData.name = "Unnamed Weapon";
            }
        }
        
        itemData.formID = weapon->GetFormID();
        
        if (pluginMap.find(pluginName) == pluginMap.end()) {
            PluginOutfitsData newPluginData;
            newPluginData.pluginName = pluginName;
            pluginMap[pluginName] = newPluginData;
        }
        
        pluginMap[pluginName].weapons.push_back(itemData);
        weaponCount++;
    }
    WriteToAdvancedLog("Weapons scanned: " + std::to_string(weaponCount) + " (skipped: " + std::to_string(weaponSkipped) + ")", __LINE__);
    
    for (auto& [pluginName, pluginData] : pluginMap) {
        pluginDataList.push_back(pluginData);
    }
    
    WriteToAdvancedLog("========================================", __LINE__);
    WriteToAdvancedLog("FILTERED SCANNING COMPLETE", __LINE__);
    WriteToAdvancedLog("Plugins included: " + std::to_string(pluginDataList.size()), __LINE__);
    WriteToAdvancedLog("Total items: " + std::to_string(armorCount + outfitCount + weaponCount), __LINE__);
    WriteToAdvancedLog("========================================", __LINE__);
    
    return pluginDataList;
}

void ExportPluginOutfitsToJSON(const std::vector<PluginOutfitsData>& pluginData) {
    std::ofstream jsonFile(g_pluginOutfitsJsonPath, std::ios::trunc);
    if (!jsonFile.is_open()) {
        WriteToAdvancedLog("ERROR: Could not create Act2_Outfits.json", __LINE__);
        return;
    }
    
    int totalArmors = 0;
    int totalOutfits = 0;
    int totalWeapons = 0;
    
    for (const auto& plugin : pluginData) {
        totalArmors += static_cast<int>(plugin.armors.size());
        totalOutfits += static_cast<int>(plugin.outfits.size());
        totalWeapons += static_cast<int>(plugin.weapons.size());
    }
    
    jsonFile << "{\n";
    jsonFile << "  \"timestamp\": \"" << GetCurrentTimeString() << "\",\n";
    jsonFile << "  \"total_plugins\": " << pluginData.size() << ",\n";
    jsonFile << "  \"total_armors\": " << totalArmors << ",\n";
    jsonFile << "  \"total_outfits\": " << totalOutfits << ",\n";
    jsonFile << "  \"total_weapons\": " << totalWeapons << ",\n";
    jsonFile << "  \"plugins\": {\n";
    
    for (size_t i = 0; i < pluginData.size(); ++i) {
        const auto& plugin = pluginData[i];
        
        jsonFile << "    \"" << plugin.pluginName << "\": {\n";
        
        jsonFile << "      \"armors\": [\n";
        for (size_t j = 0; j < plugin.armors.size(); ++j) {
            const auto& armor = plugin.armors[j];
            jsonFile << "        {\n";
            jsonFile << "          \"name\": \"" << armor.name << "\",\n";
            jsonFile << "          \"form_id\": \"0x" << std::hex << std::uppercase << armor.formID << std::dec << "\"\n";
            jsonFile << "        }" << (j < plugin.armors.size() - 1 ? "," : "") << "\n";
        }
        jsonFile << "      ],\n";
        
        jsonFile << "      \"outfits\": [\n";
        for (size_t j = 0; j < plugin.outfits.size(); ++j) {
            const auto& outfit = plugin.outfits[j];
            jsonFile << "        {\n";
            jsonFile << "          \"name\": \"" << outfit.name << "\",\n";
            jsonFile << "          \"form_id\": \"0x" << std::hex << std::uppercase << outfit.formID << std::dec << "\",\n";
            jsonFile << "          \"items\": [\n";
            
            for (size_t k = 0; k < outfit.items.size(); ++k) {
                const auto& item = outfit.items[k];
                jsonFile << "            {\n";
                jsonFile << "              \"name\": \"" << item.name << "\",\n";
                jsonFile << "              \"form_id\": \"0x" << std::hex << std::uppercase << item.formID << std::dec << "\"\n";
                jsonFile << "            }" << (k < outfit.items.size() - 1 ? "," : "") << "\n";
            }
            
            jsonFile << "          ]\n";
            jsonFile << "        }" << (j < plugin.outfits.size() - 1 ? "," : "") << "\n";
        }
        jsonFile << "      ],\n";
        
        jsonFile << "      \"weapons\": [\n";
        for (size_t j = 0; j < plugin.weapons.size(); ++j) {
            const auto& weapon = plugin.weapons[j];
            jsonFile << "        {\n";
            jsonFile << "          \"name\": \"" << weapon.name << "\",\n";
            jsonFile << "          \"form_id\": \"0x" << std::hex << std::uppercase << weapon.formID << std::dec << "\"\n";
            jsonFile << "        }" << (j < plugin.weapons.size() - 1 ? "," : "") << "\n";
        }
        jsonFile << "      ]\n";
        
        jsonFile << "    }" << (i < pluginData.size() - 1 ? "," : "") << "\n";
    }
    
    jsonFile << "  }\n";
    jsonFile << "}\n";
    
    jsonFile.close();
    
    WriteToAdvancedLog("Successfully exported plugin outfits data to Act2_Outfits.json", __LINE__);
    WriteToAdvancedLog("Total plugins: " + std::to_string(pluginData.size()), __LINE__);
    WriteToAdvancedLog("Total armors: " + std::to_string(totalArmors), __LINE__);
    WriteToAdvancedLog("Total outfits: " + std::to_string(totalOutfits), __LINE__);
    WriteToAdvancedLog("Total weapons: " + std::to_string(totalWeapons), __LINE__);
}

void ExecutePluginOutfitsScanning() {
    WriteToAdvancedLog("========================================", __LINE__);
    WriteToAdvancedLog("PLUGIN OUTFITS SCANNING SYSTEM ACTIVATED", __LINE__);
    WriteToAdvancedLog("========================================", __LINE__);
    
    WriteToAdvancedLog("Mode: FULL OUTFIT SCAN", __LINE__);
    
    std::vector<PluginOutfitsData> pluginData;
    
    if (fs::exists(g_pluginFilterIniPath)) {
        WriteToAdvancedLog("Act2_Plugins.ini found, using filtered scan", __LINE__);
        pluginData = ScanFilteredPluginsForItems();
    } else {
        WriteToAdvancedLog("Act2_Plugins.ini not found, scanning all plugins", __LINE__);
        pluginData = ScanAllPluginsForItems();
    }
    
    if (pluginData.empty()) {
        WriteToAdvancedLog("WARNING: No plugin data found", __LINE__);
    } else {
        WriteToAdvancedLog("Exporting plugin outfits to JSON...", __LINE__);
        ExportPluginOutfitsToJSON(pluginData);
    }
    
    WriteToAdvancedLog("Resetting start flag to false...", __LINE__);
    g_pluginOutfitsConfig.start = false;
    SavePluginOutfitsConfig();
    
    WriteToAdvancedLog("========================================", __LINE__);
    WriteToAdvancedLog("PLUGIN OUTFITS SCANNING COMPLETE", __LINE__);
    WriteToAdvancedLog("========================================", __LINE__);
}

void ExportNPCDataToJSON(const std::vector<NPCData>& npcList, const NPCData& playerData) {
    std::ofstream jsonFile(g_npcTrackingJsonPath, std::ios::trunc);
    if (!jsonFile.is_open()) {
        WriteToAdvancedLog("ERROR: Could not create Act2_Manager.json", __LINE__);
        return;
    }
    
    jsonFile << "{\n";
    jsonFile << "  \"timestamp\": \"" << GetCurrentTimeString() << "\",\n";
    jsonFile << "  \"scan_radius\": " << g_npcTrackingConfig.radio << ",\n";
    jsonFile << "  \"total_npcs\": " << npcList.size() << ",\n";
    jsonFile << "  \"player\": {\n";
    jsonFile << "    \"name\": \"" << playerData.name << "\",\n";
    jsonFile << "    \"editor_id\": \"" << playerData.editorID << "\",\n";
    jsonFile << "    \"plugin\": \"" << playerData.pluginName << "\",\n";
    jsonFile << "    \"race\": \"" << playerData.race << "\",\n";
    jsonFile << "    \"gender\": \"" << playerData.gender << "\",\n";
    jsonFile << "    \"is_vampire\": " << (playerData.isVampire ? "true" : "false") << ",\n";
    jsonFile << "    \"is_werewolf\": " << (playerData.isWerewolf ? "true" : "false") << ",\n";
    jsonFile << "    \"ref_id\": \"0x" << std::hex << std::uppercase << playerData.refID << std::dec << "\",\n";
    jsonFile << "    \"base_id\": \"0x" << std::hex << std::uppercase << playerData.baseID << std::dec << "\",\n";
    jsonFile << "    \"form_id\": \"0x" << std::hex << std::uppercase << playerData.formID << std::dec << "\",\n";
    jsonFile << "    \"factions\": [\n";
    
    for (size_t i = 0; i < playerData.factions.size(); ++i) {
        const auto& faction = playerData.factions[i];
        jsonFile << "      {\n";
        jsonFile << "        \"name\": \"" << faction.name << "\",\n";
        jsonFile << "        \"editor_id\": \"" << faction.editorID << "\",\n";
        jsonFile << "        \"form_id\": \"0x" << std::hex << std::uppercase << faction.formID << std::dec << "\",\n";
        jsonFile << "        \"rank\": " << faction.rank << ",\n";
        jsonFile << "        \"is_member\": " << (faction.isMember ? "true" : "false") << "\n";
        jsonFile << "      }" << (i < playerData.factions.size() - 1 ? "," : "") << "\n";
    }
    
    jsonFile << "    ],\n";
    jsonFile << "    \"equipped_items\": {\n";
    
    std::vector<std::string> slotOrder = {
        "right_hand", "left_hand",
        "head", "hair", "body", "hands", "forearms",
        "amulet", "ring", "feet", "calves", "shield",
        "tail", "long_hair", "circlet", "ears",
        "face_jewelry", "neck", "chest_primary", "back",
        "misc_fx", "pelvis_primary", "decapitated_head", "decapitate",
        "pelvis_secondary", "leg_primary_right", "leg_secondary_left", "face_alternate",
        "chest_secondary", "shoulder", "arm_left", "arm_right",
        "unnamed_fx", "fx01"
    };
    
    for (size_t i = 0; i < slotOrder.size(); ++i) {
        const auto& slotKey = slotOrder[i];
        auto it = playerData.equippedItems.find(slotKey);
        
        if (it != playerData.equippedItems.end()) {
            const auto& item = it->second;
            jsonFile << "      \"" << slotKey << "\": {\n";
            jsonFile << "        \"equipped\": " << (item.equipped ? "true" : "false");
            
            if (item.equipped) {
                jsonFile << ",\n";
                jsonFile << "        \"name\": \"" << item.name << "\",\n";
                jsonFile << "        \"form_id\": \"0x" << std::hex << std::uppercase << item.formID << std::dec << "\",\n";
                jsonFile << "        \"plugin\": \"" << item.pluginName << "\"\n";
            } else {
                jsonFile << "\n";
            }
            
            jsonFile << "      }" << (i < slotOrder.size() - 1 ? "," : "") << "\n";
        }
    }
    
    jsonFile << "    }\n";
    jsonFile << "  },\n";
    jsonFile << "  \"npcs\": [\n";
    
    for (size_t i = 0; i < npcList.size(); ++i) {
        const auto& npc = npcList[i];
        jsonFile << "    {\n";
        jsonFile << "      \"name\": \"" << npc.name << "\",\n";
        jsonFile << "      \"editor_id\": \"" << npc.editorID << "\",\n";
        jsonFile << "      \"plugin\": \"" << npc.pluginName << "\",\n";
        jsonFile << "      \"race\": \"" << npc.race << "\",\n";
        jsonFile << "      \"gender\": \"" << npc.gender << "\",\n";
        jsonFile << "      \"is_vampire\": " << (npc.isVampire ? "true" : "false") << ",\n";
        jsonFile << "      \"is_werewolf\": " << (npc.isWerewolf ? "true" : "false") << ",\n";
        jsonFile << "      \"ref_id\": \"0x" << std::hex << std::uppercase << npc.refID << std::dec << "\",\n";
        jsonFile << "      \"base_id\": \"0x" << std::hex << std::uppercase << npc.baseID << std::dec << "\",\n";
        jsonFile << "      \"form_id\": \"0x" << std::hex << std::uppercase << npc.formID << std::dec << "\",\n";
        jsonFile << "      \"distance_from_player\": " << std::fixed << std::setprecision(2) << npc.distanceFromPlayer << ",\n";
        jsonFile << "      \"factions\": [\n";
        
        for (size_t j = 0; j < npc.factions.size(); ++j) {
            const auto& faction = npc.factions[j];
            jsonFile << "        {\n";
            jsonFile << "          \"name\": \"" << faction.name << "\",\n";
            jsonFile << "          \"editor_id\": \"" << faction.editorID << "\",\n";
            jsonFile << "          \"form_id\": \"0x" << std::hex << std::uppercase << faction.formID << std::dec << "\",\n";
            jsonFile << "          \"rank\": " << faction.rank << ",\n";
            jsonFile << "          \"is_member\": " << (faction.isMember ? "true" : "false") << "\n";
            jsonFile << "        }" << (j < npc.factions.size() - 1 ? "," : "") << "\n";
        }
        
        jsonFile << "      ],\n";
        jsonFile << "      \"equipped_items\": {\n";
        
        for (size_t k = 0; k < slotOrder.size(); ++k) {
            const auto& slotKey = slotOrder[k];
            auto it = npc.equippedItems.find(slotKey);
            
            if (it != npc.equippedItems.end()) {
                const auto& item = it->second;
                jsonFile << "        \"" << slotKey << "\": {\n";
                jsonFile << "          \"equipped\": " << (item.equipped ? "true" : "false");
                
                if (item.equipped) {
                    jsonFile << ",\n";
                    jsonFile << "          \"name\": \"" << item.name << "\",\n";
                    jsonFile << "          \"form_id\": \"0x" << std::hex << std::uppercase << item.formID << std::dec << "\",\n";
                    jsonFile << "          \"plugin\": \"" << item.pluginName << "\"\n";
                } else {
                    jsonFile << "\n";
                }
                
                jsonFile << "        }" << (k < slotOrder.size() - 1 ? "," : "") << "\n";
            }
        }
        
        jsonFile << "      }\n";
        jsonFile << "    }" << (i < npcList.size() - 1 ? "," : "") << "\n";
    }
    
    jsonFile << "  ]\n";
    jsonFile << "}\n";
    
    jsonFile.close();
    
    WriteToAdvancedLog("Successfully exported NPC data to Act2_Manager.json", __LINE__);
    WriteToAdvancedLog("Total entries: 1 player + " + std::to_string(npcList.size()) + " NPCs", __LINE__);
}

void ExecuteNPCTracking() {
    WriteToAdvancedLog("========================================", __LINE__);
    WriteToAdvancedLog("NPC TRACKING SYSTEM ACTIVATED", __LINE__);
    WriteToAdvancedLog("========================================", __LINE__);
    
    WriteToAdvancedLog("Capturing player data...", __LINE__);
    NPCData playerData = CapturePlayerData();
    
    if (playerData.name.empty()) {
        WriteToAdvancedLog("ERROR: Failed to capture player data", __LINE__);
        g_npcTrackingConfig.start = false;
        SaveNPCTrackingConfig();
        return;
    }
    
    WriteToAdvancedLog("Player captured: " + playerData.name, __LINE__);
    WriteToAdvancedLog("Starting NPC scan with radius: " + std::to_string(g_npcTrackingConfig.radio), __LINE__);
    
    std::vector<NPCData> npcList = ScanNPCsAroundPlayer(static_cast<float>(g_npcTrackingConfig.radio));
    
    WriteToAdvancedLog("Scan complete. Found " + std::to_string(npcList.size()) + " NPCs", __LINE__);
    WriteToAdvancedLog("Exporting data to JSON...", __LINE__);
    
    ExportNPCDataToJSON(npcList, playerData);
    
    WriteToAdvancedLog("Resetting start flag to false...", __LINE__);
    g_npcTrackingConfig.start = false;
    SaveNPCTrackingConfig();
    
    WriteToAdvancedLog("========================================", __LINE__);
    WriteToAdvancedLog("NPC TRACKING COMPLETE", __LINE__);
    WriteToAdvancedLog("========================================", __LINE__);
}

void NPCTrackingMonitorThreadFunction() {
    WriteToAdvancedLog("NPC Tracking monitor thread started", __LINE__);
    
    while (g_monitoringNPCTracking.load() && !g_isShuttingDown.load()) {
        try {
            if (fs::exists(g_npcTrackingIniPath)) {
                auto currentModTime = fs::last_write_time(g_npcTrackingIniPath);
                auto currentModTimeT = std::chrono::system_clock::to_time_t(
                    std::chrono::time_point_cast<std::chrono::system_clock::duration>(
                        currentModTime - fs::file_time_type::clock::now() + std::chrono::system_clock::now()));
                
                if (currentModTimeT > g_lastNPCIniCheckTime) {
                    WriteToAdvancedLog("Act2_Manager.ini changed, reloading...", __LINE__);
                    
                    LoadNPCTrackingConfig();
                    
                    if (g_npcTrackingConfig.start) {
                        WriteToAdvancedLog("NPC Tracking start flag detected as TRUE - executing NPC tracking", __LINE__);
                        ExecuteNPCTracking();
                    }
                    
                    if (g_pluginOutfitsConfig.start) {
                        WriteToAdvancedLog("Plugin Outfits start flag detected as TRUE - executing plugin scanning", __LINE__);
                        ExecutePluginOutfitsScanning();
                    }
                    
                    if (g_pluginOutfitsConfig.pluginList) {
                        WriteToAdvancedLog("Plugin List flag detected as TRUE - executing plugin list scanning", __LINE__);
                        ExecutePluginListScanning();
                    }
                    
                    if (g_pluginNPCsConfig.startNPCs) {
                        WriteToAdvancedLog("Plugin NPCs startNPCs flag detected as TRUE - executing NPC count scanning", __LINE__);
                        ExecuteNPCCountScanning();
                    }
                    
                    if (g_pluginNPCsConfig.pluginListNPCs) {
                        WriteToAdvancedLog("Plugin NPCs Plugin_listNPCs flag detected as TRUE - executing NPC list scanning", __LINE__);
                        ExecuteNPCListScanning();
                    }
                    
                    g_lastNPCIniCheckTime = currentModTimeT;
                }
            }
        } catch (const std::exception& e) {
            WriteToAdvancedLog("ERROR in NPC tracking monitor: " + std::string(e.what()), __LINE__);
        } catch (...) {
            WriteToAdvancedLog("UNKNOWN ERROR in NPC tracking monitor", __LINE__);
        }
        
        std::this_thread::sleep_for(std::chrono::seconds(1));
    }
    
    WriteToAdvancedLog("NPC Tracking monitor thread stopped", __LINE__);
}

void StartNPCTrackingMonitoring() {
    if (!g_monitoringNPCTracking.load()) {
        g_monitoringNPCTracking = true;
        g_npcTrackingThread = std::thread(NPCTrackingMonitorThreadFunction);
        WriteToAdvancedLog("NPC Tracking monitoring started", __LINE__);
    }
}

void StopNPCTrackingMonitoring() {
    if (g_monitoringNPCTracking.load()) {
        g_monitoringNPCTracking = false;
        if (g_npcTrackingThread.joinable()) {
            g_npcTrackingThread.join();
        }
        WriteToAdvancedLog("NPC Tracking monitoring stopped", __LINE__);
    }
}

void SkyrimSwitchThreadFunction() {
    WriteToAdvancedLog("SkyrimSwitch monitor thread started", __LINE__);
    
    while (g_monitoringSkyrimSwitch.load() && !g_isShuttingDown.load()) {
        try {
            std::string timestamp = GetCurrentTimeString();
            std::string line = "[" + timestamp + "] [log] [info] the game is on";
            
            {
                std::lock_guard<std::mutex> lock(g_skyrimSwitchMutex);
                
                if (g_skyrimSwitchLines.size() >= 20) {
                    g_skyrimSwitchLines.pop_front();
                }
                g_skyrimSwitchLines.push_back(line);
                
                std::ofstream logFile(g_skyrimSwitchLogPath, std::ios::trunc);
                if (logFile.is_open()) {
                    for (const auto& logLine : g_skyrimSwitchLines) {
                        logFile << logLine << "\n";
                    }
                    logFile.close();
                }
            }
            
        } catch (const std::exception& e) {
            WriteToAdvancedLog("ERROR in SkyrimSwitch monitor: " + std::string(e.what()), __LINE__);
        } catch (...) {
            WriteToAdvancedLog("UNKNOWN ERROR in SkyrimSwitch monitor", __LINE__);
        }
        
        std::this_thread::sleep_for(std::chrono::seconds(3));
    }
    
    WriteToAdvancedLog("SkyrimSwitch monitor thread stopped", __LINE__);
}

void StartSkyrimSwitchMonitoring() {
    if (!g_monitoringSkyrimSwitch.load()) {
        g_monitoringSkyrimSwitch = true;
        g_skyrimSwitchThread = std::thread(SkyrimSwitchThreadFunction);
        WriteToAdvancedLog("SkyrimSwitch monitoring started", __LINE__);
    }
}

void StopSkyrimSwitchMonitoring() {
    if (g_monitoringSkyrimSwitch.load()) {
        g_monitoringSkyrimSwitch = false;
        if (g_skyrimSwitchThread.joinable()) {
            g_skyrimSwitchThread.join();
        }
        WriteToAdvancedLog("SkyrimSwitch monitoring stopped", __LINE__);
    }
}

// ===== MODIFIED PLUGIN LECTOR SCANNING WITH CONTENT FILTERING AND ID CORRECTION =====

void ExecutePluginLectorScanning() {
    WriteToAdvancedLog("========================================", __LINE__);
    WriteToAdvancedLog("PLUGIN LECTOR SCANNING STARTED (FILTERED)", __LINE__);
    WriteToAdvancedLog("========================================", __LINE__);
    
    auto* dataHandler = RE::TESDataHandler::GetSingleton();
    if (!dataHandler) {
        WriteToAdvancedLog("ERROR: Could not get TESDataHandler", __LINE__);
        return;
    }
    
    // Map to store unique plugins and their contents
    // Key: Filename, Value: Data struct
    std::unordered_map<std::string, PluginLectorData> validPluginsMap;
    
    auto processFile = [&](RE::TESFile* file, int contentType) {
        if (!file) return;
        
        std::string filename = file->fileName;
        if (filename.empty()) return;
        
        if (validPluginsMap.find(filename) == validPluginsMap.end()) {
            PluginLectorData data;
            data.pluginName = filename;
            
            std::string extension = "";
            size_t lastDot = filename.find_last_of(".");
            if (lastDot != std::string::npos) {
                extension = filename.substr(lastDot);
                std::transform(extension.begin(), extension.end(), extension.begin(), ::tolower);
            }
            
            bool isLight = file->IsLight();
            uint32_t compileIndex = file->GetCompileIndex();
            
            // ID CORRECTION LOGIC: Prioritize IsLight() over Index
            std::stringstream ssID;
            if (isLight) {
                // Always treat as light if IsLight is true, ignoring compileIndex (even if 0xFF)
                uint32_t smallIndex = file->GetSmallFileCompileIndex();
                ssID << "0xFE" << std::hex << std::uppercase << std::setfill('0') << std::setw(3) << smallIndex;
            } else {
                ssID << "0x" << std::hex << std::uppercase << std::setfill('0') << std::setw(2) << compileIndex;
            }
            data.idString = ssID.str();
            
            if (extension == ".esl") {
                data.type = "ESL";
            } else if (extension == ".esm") {
                data.type = isLight ? "ESM-FE" : "ESM";
            } else if (extension == ".esp") {
                data.type = isLight ? "ESP-FE" : "ESP";
            } else {
                data.type = "UNKNOWN";
            }
            
            validPluginsMap[filename] = data;
        }
        
        // Update flags
        if (contentType == 1) validPluginsMap[filename].hasNPCs = true;
        else if (contentType == 2) validPluginsMap[filename].hasArmors = true;
        else if (contentType == 3) validPluginsMap[filename].hasOutfits = true;
        else if (contentType == 4) validPluginsMap[filename].hasWeapons = true;
    };
    
    // 1. Scan NPCs
    WriteToAdvancedLog("Scanning NPCs for valid plugins...", __LINE__);
    for (auto* npc : dataHandler->GetFormArray<RE::TESNPC>()) {
        if (npc) processFile(npc->GetFile(0), 1);
    }
    
    // 2. Scan Armors
    WriteToAdvancedLog("Scanning Armors for valid plugins...", __LINE__);
    for (auto* armor : dataHandler->GetFormArray<RE::TESObjectARMO>()) {
        if (armor) processFile(armor->GetFile(0), 2);
    }
    
    // 3. Scan Outfits
    WriteToAdvancedLog("Scanning Outfits for valid plugins...", __LINE__);
    for (auto* outfit : dataHandler->GetFormArray<RE::BGSOutfit>()) {
        if (outfit) processFile(outfit->GetFile(0), 3);
    }
    
    // 4. Scan Weapons
    WriteToAdvancedLog("Scanning Weapons for valid plugins...", __LINE__);
    for (auto* weapon : dataHandler->GetFormArray<RE::TESObjectWEAP>()) {
        if (weapon) processFile(weapon->GetFile(0), 4);
    }
    
    // Convert map to vector for sorting/output
    std::vector<PluginLectorData> sortedList;
    for (const auto& pair : validPluginsMap) {
        sortedList.push_back(pair.second);
    }
    
    // Sort by Load Order (basic string comparison of ID for now, roughly accurate)
    // Or we can rely on the fact they were inserted based on scan order which mimics load order somewhat, 
    // but sorting by ID string length then value puts 0x00 before 0xFE
    std::sort(sortedList.begin(), sortedList.end(), [](const PluginLectorData& a, const PluginLectorData& b) {
        // Simple heuristic: shorter IDs (0x00) usually come before longer (0xFE000)
        if (a.idString.length() != b.idString.length()) {
            return a.idString.length() < b.idString.length();
        }
        return a.idString < b.idString;
    });
    
    // Write to LOG
    std::ofstream logFile(g_pluginsLectorLogPath, std::ios::trunc);
    if (logFile.is_open()) {
        logFile << "[" << GetCurrentTimeString() << "] ===== FILTERED PLUGIN LECTOR SCANNING START (NPC/ARMO/OUTFIT/WEAP) =====\n";
        for (const auto& plugin : sortedList) {
            logFile << plugin.pluginName << ", ID: " << plugin.idString << ", " << plugin.type << "\n";
        }
        logFile << "[" << GetCurrentTimeString() << "] ===== PLUGIN LECTOR SCANNING END - TOTAL VALID: " << sortedList.size() << " =====\n";
        logFile.close();
        WriteToAdvancedLog("Generated plugin lector log at: " + g_pluginsLectorLogPath.string(), __LINE__);
    } else {
        WriteToAdvancedLog("ERROR: Could not open plugin lector log file", __LINE__);
    }
    
    // Write to JSON
    std::ofstream jsonFile(g_pluginsLectorJsonPath, std::ios::trunc);
    if (jsonFile.is_open()) {
        jsonFile << "{\n";
        jsonFile << "  \"timestamp\": \"" << GetCurrentTimeString() << "\",\n";
        jsonFile << "  \"total_valid_plugins\": " << sortedList.size() << ",\n";
        jsonFile << "  \"scan_criteria\": \"NPCs, Armors, Outfits, Weapons\",\n";
        jsonFile << "  \"plugin_list\": [\n";
        
        for (size_t i = 0; i < sortedList.size(); ++i) {
            const auto& plugin = sortedList[i];
            jsonFile << "    {\n";
            jsonFile << "      \"plugin\": \"" << plugin.pluginName << "\",\n";
            jsonFile << "      \"id\": \"" << plugin.idString << "\",\n";
            jsonFile << "      \"type\": \"" << plugin.type << "\"\n";
            jsonFile << "    }" << (i < sortedList.size() - 1 ? "," : "") << "\n";
        }
        
        jsonFile << "  ]\n";
        jsonFile << "}\n";
        jsonFile.close();
        WriteToAdvancedLog("Generated plugin lector JSON at: " + g_pluginsLectorJsonPath.string(), __LINE__);
    } else {
        WriteToAdvancedLog("ERROR: Could not open plugin lector JSON file", __LINE__);
    }
    
    WriteToAdvancedLog("========================================", __LINE__);
    WriteToAdvancedLog("PLUGIN LECTOR SCANNING COMPLETE", __LINE__);
    WriteToAdvancedLog("Total validated plugins: " + std::to_string(sortedList.size()), __LINE__);
    WriteToAdvancedLog("========================================", __LINE__);
}

class GameEventProcessor : public RE::BSTEventSink<RE::TESActivateEvent>,
                           public RE::BSTEventSink<RE::MenuOpenCloseEvent>,
                           public RE::BSTEventSink<RE::TESCombatEvent>,
                           public RE::BSTEventSink<RE::TESContainerChangedEvent>,
                           public RE::BSTEventSink<RE::TESEquipEvent>,
                           public RE::BSTEventSink<RE::TESFurnitureEvent>,
                           public RE::BSTEventSink<RE::TESHitEvent>,
                           public RE::BSTEventSink<RE::TESQuestStageEvent>,
                           public RE::BSTEventSink<RE::TESSleepStartEvent>,
                           public RE::BSTEventSink<RE::TESSleepStopEvent>,
                           public RE::BSTEventSink<RE::TESWaitStopEvent> {
    GameEventProcessor() = default;
    ~GameEventProcessor() = default;
    GameEventProcessor(const GameEventProcessor&) = delete;
    GameEventProcessor(GameEventProcessor&&) = delete;
    GameEventProcessor& operator=(const GameEventProcessor&) = delete;
    GameEventProcessor& operator=(GameEventProcessor&&) = delete;

public:
    static GameEventProcessor& GetSingleton() {
        static GameEventProcessor singleton;
        return singleton;
    }

    RE::BSEventNotifyControl ProcessEvent(const RE::TESActivateEvent* event,
                                           RE::BSTEventSource<RE::TESActivateEvent>*) override {
        if (g_pauseMonitoring.load()) {
            return RE::BSEventNotifyControl::kContinue;
        }

        return RE::BSEventNotifyControl::kContinue;
    }

    RE::BSEventNotifyControl ProcessEvent(const RE::MenuOpenCloseEvent* event,
                                           RE::BSTEventSource<RE::MenuOpenCloseEvent>*) override {
        if (g_pauseMonitoring.load()) {
            return RE::BSEventNotifyControl::kContinue;
        }

        return RE::BSEventNotifyControl::kContinue;
    }

    RE::BSEventNotifyControl ProcessEvent(const RE::TESCombatEvent* event,
                                           RE::BSTEventSource<RE::TESCombatEvent>*) override {
        if (g_pauseMonitoring.load()) {
            return RE::BSEventNotifyControl::kContinue;
        }

        return RE::BSEventNotifyControl::kContinue;
    }

    RE::BSEventNotifyControl ProcessEvent(const RE::TESContainerChangedEvent* event,
                                           RE::BSTEventSource<RE::TESContainerChangedEvent>*) override {
        if (g_pauseMonitoring.load()) {
            return RE::BSEventNotifyControl::kContinue;
        }

        return RE::BSEventNotifyControl::kContinue;
    }

    RE::BSEventNotifyControl ProcessEvent(const RE::TESEquipEvent* event,
                                           RE::BSTEventSource<RE::TESEquipEvent>*) override {
        if (g_pauseMonitoring.load()) {
            return RE::BSEventNotifyControl::kContinue;
        }

        return RE::BSEventNotifyControl::kContinue;
    }

    RE::BSEventNotifyControl ProcessEvent(const RE::TESFurnitureEvent* event,
                                           RE::BSTEventSource<RE::TESFurnitureEvent>*) override {
        if (g_pauseMonitoring.load()) {
            return RE::BSEventNotifyControl::kContinue;
        }

        return RE::BSEventNotifyControl::kContinue;
    }

    RE::BSEventNotifyControl ProcessEvent(const RE::TESHitEvent* event, RE::BSTEventSource<RE::TESHitEvent>*) override {
        if (g_pauseMonitoring.load()) {
            return RE::BSEventNotifyControl::kContinue;
        }

        return RE::BSEventNotifyControl::kContinue;
    }

    RE::BSEventNotifyControl ProcessEvent(const RE::TESQuestStageEvent* event,
                                           RE::BSTEventSource<RE::TESQuestStageEvent>*) override {
        if (g_pauseMonitoring.load()) {
            return RE::BSEventNotifyControl::kContinue;
        }

        return RE::BSEventNotifyControl::kContinue;
    }

    RE::BSEventNotifyControl ProcessEvent(const RE::TESSleepStartEvent* event,
                                           RE::BSTEventSource<RE::TESSleepStartEvent>*) override {
        if (g_pauseMonitoring.load()) {
            return RE::BSEventNotifyControl::kContinue;
        }

        return RE::BSEventNotifyControl::kContinue;
    }

    RE::BSEventNotifyControl ProcessEvent(const RE::TESSleepStopEvent* event,
                                           RE::BSTEventSource<RE::TESSleepStopEvent>*) override {
        if (g_pauseMonitoring.load()) {
            return RE::BSEventNotifyControl::kContinue;
        }

        return RE::BSEventNotifyControl::kContinue;
    }

    RE::BSEventNotifyControl ProcessEvent(const RE::TESWaitStopEvent* event,
                                           RE::BSTEventSource<RE::TESWaitStopEvent>*) override {
        if (g_pauseMonitoring.load()) {
            return RE::BSEventNotifyControl::kContinue;
        }

        return RE::BSEventNotifyControl::kContinue;
    }
};

void InitializePlugin() {
    try {
        g_documentsPath = GetDocumentsPath();
        
        auto paths = GetAllOBodyLogsPaths();
        if (!paths.primary.empty()) {
            std::vector<fs::path> logFolders = { paths.primary, paths.secondary };
            
            for (const auto& folder : logFolders) {
                try {
                    auto advancedLogPath = folder / "OBody_NG_Preset_Distribution_Assistant-NG_Advanced_Manager.log";
                    std::ofstream clearLog(advancedLogPath, std::ios::trunc);
                    clearLog.close();
                } catch (...) {}
            }
        }

        WriteToAdvancedLog("OBody PDA Advanced Manager - Starting Complete Detection...", __LINE__);
        WriteToAdvancedLog("========================================", __LINE__);
        WriteToAdvancedLog("OBody PDA Advanced Manager - v3.8.0", __LINE__);
        WriteToAdvancedLog("Started: " + GetCurrentTimeString(), __LINE__);
        WriteToAdvancedLog("========================================", __LINE__);
        
        g_gamePath = GetGamePath();
        
        OBodyPDAPathsResult detection = DetectAllOBodyPDAPaths();
        
        if (detection.success) {
            g_iniPath = detection.iniPath;
            g_scriptsDirectory = detection.scriptsBaseDir.parent_path();
            
            if (detection.detectionMethod == "DLL Directory") {
                g_usingDllPath = true;
                g_dllDirectory = detection.sksePluginsDir;
            }
            
            WriteToAdvancedLog("DETECTION SUCCESSFUL - All components found", __LINE__);
            WriteToAdvancedLog("Detection Method: " + detection.detectionMethod, __LINE__);
            WriteToAdvancedLog("DLL: " + detection.dllPath.string(), __LINE__);
            WriteToAdvancedLog("INI: " + detection.iniPath.string(), __LINE__);
            WriteToAdvancedLog("Script Assets: " + detection.scriptsBaseDir.string(), __LINE__);
            WriteToAdvancedLog("Scripts Directory: " + g_scriptsDirectory.string(), __LINE__);
            
            LoadPDASettings();
            
            StartIniMonitoring();
            
            WriteToAdvancedLog("", __LINE__);
            WriteToAdvancedLog("========================================", __LINE__);
            WriteToAdvancedLog("INITIALIZING NPC TRACKING SYSTEM", __LINE__);
            WriteToAdvancedLog("========================================", __LINE__);
            
            fs::path assetsPath = g_scriptsDirectory / "Assets";
            fs::path iniFolder = assetsPath / "ini";
            fs::path jsonFolder = assetsPath / "Json";
            fs::path logFolder = assetsPath / "log";
            
            try {
                fs::create_directories(iniFolder);
                fs::create_directories(jsonFolder);
                fs::create_directories(logFolder);
                WriteToAdvancedLog("Created Assets/ini, Assets/Json and Assets/log directories", __LINE__);
            } catch (const std::exception& e) {
                WriteToAdvancedLog("ERROR creating directories: " + std::string(e.what()), __LINE__);
            }
            
            g_npcTrackingIniPath = iniFolder / "Act2_Manager.ini";
            g_npcTrackingJsonPath = jsonFolder / "Act2_Manager.json";
            g_pluginOutfitsJsonPath = jsonFolder / "Act2_Outfits.json";
            g_pluginListJsonPath = jsonFolder / "Act2_Plugins.json";
            g_pluginFilterIniPath = iniFolder / "Act2_Plugins.ini";
            g_npcCountJsonPath = jsonFolder / "Act2_NPCs.json";
            g_npcListJsonPath = jsonFolder / "Act2_NPCs_List.json";
            g_npcFilterIniPath = iniFolder / "Act2_NPCs.ini";
            g_skyrimSwitchLogPath = logFolder / "SkyrimSwitch.log";
            
            // Set paths for Plugin Lector
            g_pluginsLectorLogPath = paths.primary / "OBody_NG_Preset_Distribution_Assistant-NG_Plugins_Lector.log";
            g_pluginsLectorJsonPath = jsonFolder / "Act2_PDA_Plugins.json";
            
            WriteToAdvancedLog("NPC Tracking INI path: " + g_npcTrackingIniPath.string(), __LINE__);
            WriteToAdvancedLog("NPC Tracking JSON path: " + g_npcTrackingJsonPath.string(), __LINE__);
            WriteToAdvancedLog("Plugin Outfits JSON path: " + g_pluginOutfitsJsonPath.string(), __LINE__);
            WriteToAdvancedLog("Plugin List JSON path: " + g_pluginListJsonPath.string(), __LINE__);
            WriteToAdvancedLog("Plugin Filter INI path: " + g_pluginFilterIniPath.string(), __LINE__);
            WriteToAdvancedLog("NPC Count JSON path: " + g_npcCountJsonPath.string(), __LINE__);
            WriteToAdvancedLog("NPC List JSON path: " + g_npcListJsonPath.string(), __LINE__);
            WriteToAdvancedLog("NPC Filter INI path: " + g_npcFilterIniPath.string(), __LINE__);
            WriteToAdvancedLog("SkyrimSwitch LOG path: " + g_skyrimSwitchLogPath.string(), __LINE__);
            WriteToAdvancedLog("Plugin Lector LOG path: " + g_pluginsLectorLogPath.string(), __LINE__);
            WriteToAdvancedLog("Plugin Lector JSON path: " + g_pluginsLectorJsonPath.string(), __LINE__);
            
            LoadNPCTrackingConfig();
            
            WriteToAdvancedLog("NPC Tracking Config - start: " + std::string(g_npcTrackingConfig.start ? "true" : "false") + 
                              ", radio: " + std::to_string(g_npcTrackingConfig.radio), __LINE__);
            WriteToAdvancedLog("Plugin Outfits Config - start: " + std::string(g_pluginOutfitsConfig.start ? "true" : "false") +
                              ", Plugin_list: " + std::string(g_pluginOutfitsConfig.pluginList ? "true" : "false"), __LINE__);
            WriteToAdvancedLog("Plugin NPCs Config - startNPCs: " + std::string(g_pluginNPCsConfig.startNPCs ? "true" : "false") +
                              ", Plugin_listNPCs: " + std::string(g_pluginNPCsConfig.pluginListNPCs ? "true" : "false"), __LINE__);
            
            StartNPCTrackingMonitoring();
            
            WriteToAdvancedLog("NPC TRACKING SYSTEM INITIALIZED", __LINE__);
            WriteToAdvancedLog("========================================", __LINE__);
            
            WriteToAdvancedLog("", __LINE__);
            WriteToAdvancedLog("========================================", __LINE__);
            WriteToAdvancedLog("INITIALIZING SKYRIMSWITCH MONITOR", __LINE__);
            WriteToAdvancedLog("========================================", __LINE__);
            
            StartSkyrimSwitchMonitoring();
            
            WriteToAdvancedLog("SKYRIMSWITCH MONITOR INITIALIZED", __LINE__);
            WriteToAdvancedLog("Log interval: 3 seconds", __LINE__);
            WriteToAdvancedLog("Max lines: 20", __LINE__);
            WriteToAdvancedLog("========================================", __LINE__);
            
            g_isInitialized = true;
            
        } else {
            WriteToAdvancedLog("DETECTION FAILED - Missing components:", __LINE__);
            if (!detection.dllFound) WriteToAdvancedLog("  - DLL not found", __LINE__);
            if (!detection.iniFound) WriteToAdvancedLog("  - INI not found", __LINE__);
            if (!detection.scriptFound) WriteToAdvancedLog("  - Script assets directory not found", __LINE__);
            
            g_isInitialized = true;
        }

        WriteToAdvancedLog("PLUGIN INITIALIZATION COMPLETE", __LINE__);
        WriteToAdvancedLog("========================================", __LINE__);

    } catch (const std::exception& e) {
        logger::error("CRITICAL ERROR in Initialize: {}", e.what());
        WriteToAdvancedLog("CRITICAL ERROR: " + std::string(e.what()), __LINE__);
    }
}

void ShutdownPlugin() {
    logger::info("OBODY PDA ADVANCED MANAGER SHUTTING DOWN");
    WriteToAdvancedLog("PLUGIN SHUTTING DOWN", __LINE__);

    g_isShuttingDown = true;

    StopIniMonitoring();
    StopNPCTrackingMonitoring();
    StopSkyrimSwitchMonitoring();

    WriteToAdvancedLog("========================================", __LINE__);
    WriteToAdvancedLog("Plugin shutdown complete at: " + GetCurrentTimeString(), __LINE__);
    WriteToAdvancedLog("========================================", __LINE__);

    logger::info("Plugin shutdown complete");
}

void MessageListener(SKSE::MessagingInterface::Message* message) {
    switch (message->type) {
        case SKSE::MessagingInterface::kNewGame:
            logger::info("kNewGame: New game started - resetting system");
            g_processActive = false;
            g_activationMessageShown = false;
            g_pauseMonitoring = false;

            WriteToAdvancedLog("NEW GAME: All flags reset, ready for fresh initialization", __LINE__);
            break;

        case SKSE::MessagingInterface::kPostLoadGame:
            logger::info("kPostLoadGame: Game loaded - checking systems");
            if (!g_monitoringIni.load()) {
                StartIniMonitoring();
            }
            if (!g_monitoringNPCTracking.load()) {
                StartNPCTrackingMonitoring();
            }
            if (!g_monitoringSkyrimSwitch.load()) {
                StartSkyrimSwitchMonitoring();
            }
            break;

        case SKSE::MessagingInterface::kDataLoaded:
            logger::info("kDataLoaded: Game fully loaded");
            
            // Run Plugin Lector
            ExecutePluginLectorScanning();

            {
                auto& eventProcessor = GameEventProcessor::GetSingleton();

                RE::ScriptEventSourceHolder::GetSingleton()->AddEventSink<RE::TESActivateEvent>(&eventProcessor);
                RE::ScriptEventSourceHolder::GetSingleton()->AddEventSink<RE::TESCombatEvent>(&eventProcessor);
                RE::ScriptEventSourceHolder::GetSingleton()->AddEventSink<RE::TESContainerChangedEvent>(
                    &eventProcessor);
                RE::ScriptEventSourceHolder::GetSingleton()->AddEventSink<RE::TESEquipEvent>(&eventProcessor);
                RE::ScriptEventSourceHolder::GetSingleton()->AddEventSink<RE::TESFurnitureEvent>(&eventProcessor);
                RE::ScriptEventSourceHolder::GetSingleton()->AddEventSink<RE::TESHitEvent>(&eventProcessor);
                RE::ScriptEventSourceHolder::GetSingleton()->AddEventSink<RE::TESQuestStageEvent>(&eventProcessor);
                RE::ScriptEventSourceHolder::GetSingleton()->AddEventSink<RE::TESSleepStartEvent>(&eventProcessor);
                RE::ScriptEventSourceHolder::GetSingleton()->AddEventSink<RE::TESSleepStopEvent>(&eventProcessor);
                RE::ScriptEventSourceHolder::GetSingleton()->AddEventSink<RE::TESWaitStopEvent>(&eventProcessor);

                RE::UI::GetSingleton()->AddEventSink<RE::MenuOpenCloseEvent>(&eventProcessor);

                logger::info("Game event processor registered for all events");
                WriteToAdvancedLog("Game event processor registered", __LINE__);
            }

            logger::info("OBody PDA Advanced Manager ready");
            break;

        default:
            break;
    }
}

void SetupLog() {
    auto logsFolder = SKSE::log::log_directory();
    if (!logsFolder) {
        SKSE::stl::report_and_fail("SKSE log_directory not provided, logs disabled.");
        return;
    }
    auto pluginName = SKSE::PluginDeclaration::GetSingleton()->GetName();
    auto logFilePath = *logsFolder / std::format("{}.log", pluginName);
    auto fileLoggerPtr = std::make_shared<spdlog::sinks::basic_file_sink_mt>(logFilePath.string(), true);
    auto loggerPtr = std::make_shared<spdlog::logger>("log", std::move(fileLoggerPtr));
    spdlog::set_default_logger(std::move(loggerPtr));
    spdlog::set_level(spdlog::level::trace);
    spdlog::flush_on(spdlog::level::info);
}

SKSEPluginLoad(const SKSE::LoadInterface* a_skse) {
    SKSE::Init(a_skse);
    SetupLog();

    logger::info("OBody PDA Advanced Manager v3.8.0 - Starting...");
    
    auto paths = GetAllOBodyLogsPaths();
    try {
        std::ofstream clearLog(paths.primary / "OBody_NG_Preset_Distribution_Assistant-NG_Advanced_Manager.log", std::ios::trunc);
        clearLog.close();
    } catch (...) {}

    WriteToAdvancedLog("========================================", __LINE__);
    WriteToAdvancedLog("OBody PDA Advanced Manager v3.8.0", __LINE__);
    WriteToAdvancedLog("Started: " + GetCurrentTimeString(), __LINE__);
    WriteToAdvancedLog("========================================", __LINE__);

    InitializePlugin();
    
    SKSE::GetMessagingInterface()->RegisterListener(MessageListener);

    logger::info("OBody PDA Advanced Manager loaded successfully with NPC Tracking System, Plugin Outfits Scanner, Plugin NPCs Scanner, Plugin Lector and SkyrimSwitch Monitor");
    return true;
}

constinit auto SKSEPlugin_Version = []() {
    SKSE::PluginVersionData v;
    v.PluginVersion({3, 8, 0});
    v.PluginName("OBody PDA Advanced Manager");
    v.AuthorName("John95AC");
    v.UsesAddressLibrary();
    v.UsesSigScanning();
    v.CompatibleVersions({SKSE::RUNTIME_SSE_LATEST, SKSE::RUNTIME_LATEST_VR});

    return v;
}();
