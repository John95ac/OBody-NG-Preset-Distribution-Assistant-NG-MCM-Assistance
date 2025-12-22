#include <RE/Skyrim.h>
#include <SKSE/SKSE.h>
#include <shlobj.h>
#include <spdlog/sinks/basic_file_sink.h>
#include <windows.h>
#include <mmdeviceapi.h>
#include <audiopolicy.h>
#include <endpointvolume.h>
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

#pragma comment(lib, "ole32.lib")
#pragma comment(lib, "shell32.lib")

namespace fs = std::filesystem;
namespace logger = SKSE::log;

struct OBodyPDAPaths {
    fs::path primary;
    fs::path secondary;
};

struct ScriptState {
    std::string name;
    fs::path scriptPath;
    fs::path stopFilePath;
    fs::path trackFilePath;
    PROCESS_INFORMATION processInfo;
    bool isRunning;
    bool isPaused;
    std::string currentTrack;

    ScriptState()
        : name(""),
          scriptPath(""),
          stopFilePath(""),
          trackFilePath(""),
          processInfo({0}),
          isRunning(false),
          isPaused(false),
          currentTrack("") {}
};

struct OBodyPDAPathsResult {
    bool success;
    std::string detectionMethod;
    
    fs::path dllPath;
    fs::path iniPath;
    fs::path soundFilePath;
    fs::path startMCMScriptPath;
    
    fs::path sksePluginsDir;
    fs::path soundsBaseDir;
    fs::path scriptsBaseDir;
    
    bool dllFound;
    bool iniFound;
    bool soundFound;
    bool scriptFound;
    
    OBodyPDAPathsResult() 
        : success(false), detectionMethod(""), 
          dllFound(false), iniFound(false), 
          soundFound(false), scriptFound(false) {}
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

static ScriptState g_soundScript;

static bool g_scriptsInitialized = false;
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

static std::atomic<bool> g_soundsPaused(false);
static std::mutex g_pauseMutex;

static bool g_usingDllPath = false;
static fs::path g_dllDirectory;
static fs::path g_soundsDirectory;
static fs::path g_scriptsDirectory;
static fs::path g_soundScriptDirectory;

static std::atomic<float> g_soundVolume(0.8f);
static std::atomic<bool> g_volumeControlEnabled(true);

static std::atomic<bool> g_startMCMExecuted(false);

static fs::path g_hostIniPath;
static std::string g_mcmUrl = "http://localhost:6050/";
static std::mutex g_urlMutex;

static fs::path g_mcmIniPath;
static std::thread g_mcmMonitorThread;
static std::atomic<bool> g_monitoringMCMIni(false);
static std::time_t g_lastMCMIniCheckTime = 0;
static std::mutex g_mcmIniMutex;

static fs::path g_jsonMasterIniPath;
static fs::path g_jsonSourcePath;
static fs::path g_jsonDestPath;
static fs::path g_jsonDestDirectory;
static std::thread g_jsonMonitorThread;
static std::atomic<bool> g_monitoringJsonMaster(false);
static std::mutex g_jsonMutex;

static fs::path g_jsonRecordIniPath;
static std::thread g_jsonRecordMonitorThread;
static std::atomic<bool> g_monitoringJsonRecord(false);

void ProcessOBodyPDAActivation();
void PlaySoundOnce(const std::string& soundFileName);
void ExecuteStartMCMScript();
void ExecuteStartMCMAtStartup();
void ResetHostActiveAtStartup();
void StartMonitoringThread();
void StopMonitoringThread();
bool LoadPDASettings();
bool LoadHostSettings();
bool ModifyINIValue(const std::string& newValue);
bool SetHostActiveStatus(bool active);
bool GetHostActiveStatus();
bool SetMCMActiveStatus(bool active);
bool GetMCMActiveStatus();
void StartIniMonitoring();
void StopIniMonitoring();
void StartMCMIniMonitoring();
void StopMCMIniMonitoring();
void StopAllSounds();
OBodyPDAPaths GetAllOBodyLogsPaths();
void WriteToAdvancedLog(const std::string& message, int lineNumber = 0);
void ShowGameNotification(const std::string& message);
void CleanOldScripts();
void GenerateStaticScripts();
void StartAllScriptsFrozen();
void StopAllScripts();
void StopScript(ScriptState& scriptState);
void SuspendProcess(HANDLE hProcess);
void ResumeProcess(HANDLE hProcess);
PROCESS_INFORMATION LaunchPowerShellScript(const std::string& scriptPath);
void CleanStopFiles();
void GenerateSoundScript();
fs::path GetDllDirectory();
bool SetProcessVolume(DWORD processID, float volume);
OBodyPDAPathsResult DetectAllOBodyPDAPaths();
void OpenMCMUrl();
bool GetJsonMasterStatus();
bool SetJsonMasterStatus(bool active);
bool CopyJsonFile();
void JsonMasterMonitorThreadFunction();
void StartJsonMasterMonitoring();
void StopJsonMasterMonitoring();
bool GetJsonRecordStatus();
bool SetJsonRecordStatus(bool active);
bool CopyJsonRecordFile();
void JsonRecordMonitorThreadFunction();
void StartJsonRecordMonitoring();
void StopJsonRecordMonitoring();

static size_t FindCaseInsensitive(const std::string& haystack, const std::string& needle) {
    auto it = std::search(
        haystack.begin(), haystack.end(),
        needle.begin(), needle.end(),
        [](char ch1, char ch2) {
            return static_cast<unsigned char>(std::tolower(ch1)) == static_cast<unsigned char>(std::tolower(ch2));
        });
    if (it == haystack.end()) {
        return std::string::npos;
    }
    return static_cast<size_t>(it - haystack.begin());
}

void ShowGameNotification(const std::string& message) {
    if (g_topNotificationsVisible.load()) {
        RE::DebugNotification(message.c_str());
        WriteToAdvancedLog("IN-GAME MESSAGE SHOWN: " + message, __LINE__);
    } else {
        WriteToAdvancedLog("IN-GAME MESSAGE SUPPRESSED: " + message, __LINE__);
    }
}

std::string GetTrackDirectory() {
    fs::path trackDir;
    
    if (g_usingDllPath) {
        trackDir = g_soundScriptDirectory / "Track";
        logger::info("Using Wabbajack/MO2 Track directory: {}", trackDir.string());
    } else {
        trackDir = fs::path(g_gamePath) / "Data" / "SKSE" / "Plugins" / "OBody_NG_PDA_NG_Full_Assistance" / "Assets" / "Sound" / "Track";
    }
    
    try {
        fs::create_directories(trackDir);
    } catch (const std::exception& e) {
        logger::error("Error creating Track directory: {}", e.what());
    }
    
    std::string trackDirStr = trackDir.string();
    std::replace(trackDirStr.begin(), trackDirStr.end(), '/', '\\');
    
    return trackDirStr;
}

void ForceKillProcess(PROCESS_INFORMATION& pi) {
    if (pi.hProcess != 0 && pi.hProcess != INVALID_HANDLE_VALUE) {
        TerminateProcess(pi.hProcess, 1);
        WaitForSingleObject(pi.hProcess, 100);
        CloseHandle(pi.hProcess);
        CloseHandle(pi.hThread);
    }
    ZeroMemory(&pi, sizeof(pi));
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
        "Act3_OBody_NG_PDA_NG.dll"
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
        paths.primary / "OBody_NG_Preset_Distribution_Assistant-NG_Advanced_MCM.log",
        paths.secondary / "OBody_NG_Preset_Distribution_Assistant-NG_Advanced_MCM.log"
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

void SuspendProcess(HANDLE hProcess) {
    if (hProcess != 0 && hProcess != INVALID_HANDLE_VALUE) {
        typedef LONG(NTAPI * NtSuspendProcess)(IN HANDLE ProcessHandle);
        NtSuspendProcess pfnNtSuspendProcess =
            (NtSuspendProcess)GetProcAddress(GetModuleHandleA("ntdll"), "NtSuspendProcess");
        if (pfnNtSuspendProcess) {
            pfnNtSuspendProcess(hProcess);
        }
    }
}

void ResumeProcess(HANDLE hProcess) {
    if (hProcess != 0 && hProcess != INVALID_HANDLE_VALUE) {
        typedef LONG(NTAPI * NtResumeProcess)(IN HANDLE ProcessHandle);
        NtResumeProcess pfnNtResumeProcess =
            (NtResumeProcess)GetProcAddress(GetModuleHandleA("ntdll"), "NtResumeProcess");
        if (pfnNtResumeProcess) {
            pfnNtResumeProcess(hProcess);
        }
    }
}

void CleanStopFiles() {
    std::string trackDir = GetTrackDirectory();

    std::vector<std::string> stopFiles = {
        trackDir + "\\stop_OBody_Sound.tmp"
    };

    for (const auto& stopFile : stopFiles) {
        if (fs::exists(stopFile)) {
            try {
                fs::remove(stopFile);
            } catch (...) {
            }
        }
    }
}

// ===== HOST INI MANAGEMENT SYSTEM =====
bool LoadHostSettings() {
    try {
        if (g_hostIniPath.empty()) {
            fs::path dllDir = GetDllDirectory();
            if (!dllDir.empty()) {
                g_hostIniPath = dllDir / "Act3_OBody_NG_PDA_NG.ini";
            } else {
                logger::error("Could not determine DLL directory for host INI");
                WriteToAdvancedLog("ERROR: Could not determine DLL directory for host INI", __LINE__);
                return false;
            }
        }
        
        if (!fs::exists(g_hostIniPath)) {
            logger::warn("Host INI file not found: {}", g_hostIniPath.string());
            WriteToAdvancedLog("WARNING: Host INI file not found at: " + g_hostIniPath.string(), __LINE__);
            WriteToAdvancedLog("Using default URL: " + g_mcmUrl, __LINE__);
            return false;
        }

        std::ifstream iniFile(g_hostIniPath);
        if (!iniFile.is_open()) {
            logger::error("Could not open Host INI file");
            WriteToAdvancedLog("ERROR: Could not open Host INI file", __LINE__);
            return false;
        }

        std::string line;
        std::string currentSection;
        std::string newUrl = g_mcmUrl;

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

                std::string sectionLower = currentSection;
                std::string keyLower = key;
                std::transform(sectionLower.begin(), sectionLower.end(), sectionLower.begin(), ::tolower);
                std::transform(keyLower.begin(), keyLower.end(), keyLower.begin(), ::tolower);

                if (sectionLower == "host" && keyLower == "localhost") {
                    newUrl = value;
                    break;
                }
            }
        }

        iniFile.close();

        {
            std::lock_guard<std::mutex> lock(g_urlMutex);
            if (newUrl != g_mcmUrl) {
                g_mcmUrl = newUrl;
                logger::info("MCM URL updated from host INI: {}", g_mcmUrl);
                WriteToAdvancedLog("MCM URL updated from host INI: " + g_mcmUrl, __LINE__);
            }
        }

        WriteToAdvancedLog("Host settings loaded successfully", __LINE__);
        WriteToAdvancedLog("Current MCM URL: " + g_mcmUrl, __LINE__);

        return true;

    } catch (const std::exception& e) {
        logger::error("Error loading host settings: {}", e.what());
        WriteToAdvancedLog("ERROR loading host settings: " + std::string(e.what()), __LINE__);
        return false;
    }
}

bool GetHostActiveStatus() {
    try {
        if (g_hostIniPath.empty() || !fs::exists(g_hostIniPath)) {
            WriteToAdvancedLog("Host INI not found, returning false", __LINE__);
            return false;
        }

        std::ifstream iniFile(g_hostIniPath);
        if (!iniFile.is_open()) {
            WriteToAdvancedLog("Could not open Host INI for reading", __LINE__);
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

                std::string sectionLower = currentSection;
                std::string keyLower = key;
                std::transform(sectionLower.begin(), sectionLower.end(), sectionLower.begin(), ::tolower);
                std::transform(keyLower.begin(), keyLower.end(), keyLower.begin(), ::tolower);

                if (sectionLower == "active" && keyLower == "active_host") {
                    std::transform(value.begin(), value.end(), value.begin(), ::tolower);
                    bool result = (value == "true" || value == "1" || value == "yes");
                    iniFile.close();
                    WriteToAdvancedLog("Host active status read: " + std::string(result ? "true" : "false"), __LINE__);
                    return result;
                }
            }
        }

        iniFile.close();
        WriteToAdvancedLog("active_host not found in INI, returning false", __LINE__);
        return false;

    } catch (const std::exception& e) {
        WriteToAdvancedLog("ERROR reading host active status: " + std::string(e.what()), __LINE__);
        return false;
    }
}

bool SetHostActiveStatus(bool active) {
    try {
        if (g_hostIniPath.empty() || !fs::exists(g_hostIniPath)) {
            WriteToAdvancedLog("Host INI not found, cannot set active status", __LINE__);
            return false;
        }

        std::ifstream fileIn(g_hostIniPath);
        if (!fileIn.is_open()) {
            WriteToAdvancedLog("Could not open Host INI for reading", __LINE__);
            return false;
        }

        std::string content((std::istreambuf_iterator<char>(fileIn)), 
                           std::istreambuf_iterator<char>());
        fileIn.close();

        std::string searchPattern = "active_host = ";
        size_t pos = content.find(searchPattern);
        if (pos != std::string::npos) {
            size_t lineEnd = content.find('\n', pos);
            if (lineEnd == std::string::npos) lineEnd = content.length();
            
            std::string newLine = searchPattern + (active ? "true" : "false");
            content.replace(pos, lineEnd - pos, newLine);
        } else {
            WriteToAdvancedLog("active_host entry not found in Host INI", __LINE__);
            return false;
        }

        std::ofstream fileOut(g_hostIniPath);
        if (!fileOut.is_open()) {
            WriteToAdvancedLog("Could not open Host INI for writing", __LINE__);
            return false;
        }
        fileOut << content;
        fileOut.close();

        WriteToAdvancedLog("Host active status set to: " + std::string(active ? "true" : "false"), __LINE__);
        return true;

    } catch (const std::exception& e) {
        WriteToAdvancedLog("ERROR setting host active status: " + std::string(e.what()), __LINE__);
        return false;
    }
}

// ===== MCM INI MANAGEMENT SYSTEM =====
bool GetMCMActiveStatus() {
    try {
        if (g_mcmIniPath.empty() || !fs::exists(g_mcmIniPath)) {
            return false;
        }

        std::ifstream iniFile(g_mcmIniPath);
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

                std::string sectionLower = currentSection;
                std::string keyLower = key;
                std::transform(sectionLower.begin(), sectionLower.end(), sectionLower.begin(), ::tolower);
                std::transform(keyLower.begin(), keyLower.end(), keyLower.begin(), ::tolower);

                if (sectionLower == "active_mcm" && keyLower == "mcm") {
                    std::transform(value.begin(), value.end(), value.begin(), ::tolower);
                    bool result = (value == "true" || value == "1" || value == "yes");
                    iniFile.close();
                    return result;
                }
            }
        }

        iniFile.close();
        return false;

    } catch (const std::exception& e) {
        return false;
    }
}

bool SetMCMActiveStatus(bool active) {
    try {
        if (g_mcmIniPath.empty() || !fs::exists(g_mcmIniPath)) {
            return false;
        }

        std::ifstream fileIn(g_mcmIniPath);
        if (!fileIn.is_open()) {
            return false;
        }

        std::string content((std::istreambuf_iterator<char>(fileIn)), 
                           std::istreambuf_iterator<char>());
        fileIn.close();

        std::string searchPattern = "MCM = ";
        size_t pos = content.find(searchPattern);
        if (pos != std::string::npos) {
            size_t lineEnd = content.find('\n', pos);
            if (lineEnd == std::string::npos) lineEnd = content.length();
            
            std::string newLine = searchPattern + (active ? "true" : "false");
            content.replace(pos, lineEnd - pos, newLine);
        } else {
            return false;
        }

        std::ofstream fileOut(g_mcmIniPath);
        if (!fileOut.is_open()) {
            return false;
        }
        fileOut << content;
        fileOut.close();

        WriteToAdvancedLog("MCM INI status set to: " + std::string(active ? "true" : "false"), __LINE__);
        return true;

    } catch (const std::exception& e) {
        return false;
    }
}

// ===== JSON MASTER INI MANAGEMENT SYSTEM =====
bool GetJsonMasterStatus() {
    try {
        if (g_jsonMasterIniPath.empty() || !fs::exists(g_jsonMasterIniPath)) {
            return false;
        }

        std::ifstream iniFile(g_jsonMasterIniPath);
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

                std::string sectionLower = currentSection;
                std::string keyLower = key;
                std::transform(sectionLower.begin(), sectionLower.end(), sectionLower.begin(), ::tolower);
                std::transform(keyLower.begin(), keyLower.end(), keyLower.begin(), ::tolower);

                if (sectionLower == "act3_json" && keyLower == "startact3") {
                    std::transform(value.begin(), value.end(), value.begin(), ::tolower);
                    bool result = (value == "true" || value == "1" || value == "yes");
                    iniFile.close();
                    return result;
                }
            }
        }

        iniFile.close();
        return false;

    } catch (const std::exception& e) {
        WriteToAdvancedLog("ERROR reading JsonMaster status: " + std::string(e.what()), __LINE__);
        return false;
    }
}

bool SetJsonMasterStatus(bool active) {
    try {
        if (g_jsonMasterIniPath.empty() || !fs::exists(g_jsonMasterIniPath)) {
            WriteToAdvancedLog("JsonMaster INI not found, cannot set status", __LINE__);
            return false;
        }

        std::ifstream fileIn(g_jsonMasterIniPath);
        if (!fileIn.is_open()) {
            WriteToAdvancedLog("Could not open JsonMaster INI for reading", __LINE__);
            return false;
        }

        std::string content((std::istreambuf_iterator<char>(fileIn)), 
                           std::istreambuf_iterator<char>());
        fileIn.close();

        std::string searchPattern = "startAct3 = ";
        size_t pos = content.find(searchPattern);
        if (pos != std::string::npos) {
            size_t lineEnd = content.find('\n', pos);
            if (lineEnd == std::string::npos) lineEnd = content.length();
            
            std::string newLine = searchPattern + (active ? "true" : "false");
            content.replace(pos, lineEnd - pos, newLine);
        } else {
            WriteToAdvancedLog("startAct3 entry not found in JsonMaster INI", __LINE__);
            return false;
        }

        std::ofstream fileOut(g_jsonMasterIniPath);
        if (!fileOut.is_open()) {
            WriteToAdvancedLog("Could not open JsonMaster INI for writing", __LINE__);
            return false;
        }
        fileOut << content;
        fileOut.flush();
        fileOut.close();
        
        bool verifyStatus = GetJsonMasterStatus();
        if (verifyStatus != active) {
            WriteToAdvancedLog("ERROR: JsonMaster status verification failed after write", __LINE__);
            WriteToAdvancedLog("Expected: " + std::string(active ? "true" : "false") + 
                              ", Got: " + std::string(verifyStatus ? "true" : "false"), __LINE__);
            return false;
        }

        WriteToAdvancedLog("JsonMaster status set to: " + std::string(active ? "true" : "false") + " (verified)", __LINE__);
        return true;

    } catch (const std::exception& e) {
        WriteToAdvancedLog("ERROR setting JsonMaster status: " + std::string(e.what()), __LINE__);
        return false;
    }
}

bool CopyJsonFile() {
    try {
        std::lock_guard<std::mutex> lock(g_jsonMutex);

        if (g_jsonSourcePath.empty() || g_jsonDestPath.empty()) {
            WriteToAdvancedLog("ERROR: JSON paths not configured", __LINE__);
            return false;
        }

        if (!fs::exists(g_jsonSourcePath)) {
            WriteToAdvancedLog("ERROR: Source JSON file not found: " + g_jsonSourcePath.string(), __LINE__);
            return false;
        }

        // Verificar si el archivo de origen es legible
        std::ifstream sourceFile(g_jsonSourcePath);
        if (!sourceFile.is_open()) {
            WriteToAdvancedLog("ERROR: Cannot read source JSON file: " + g_jsonSourcePath.string(), __LINE__);
            return false;
        }
        sourceFile.close();

        if (!fs::exists(g_jsonDestDirectory)) {
            try {
                fs::create_directories(g_jsonDestDirectory);
                WriteToAdvancedLog("Created destination directory: " + g_jsonDestDirectory.string(), __LINE__);
            } catch (const std::exception& e) {
                WriteToAdvancedLog("ERROR creating destination directory: " + std::string(e.what()), __LINE__);
                return false;
            }
        }

        // Verificar si el archivo de destino existe y es escribible
        if (fs::exists(g_jsonDestPath)) {
            std::ofstream testFile(g_jsonDestPath, std::ios::app);
            if (!testFile.is_open()) {
                WriteToAdvancedLog("ERROR: Cannot write to destination JSON file: " + g_jsonDestPath.string(), __LINE__);
                return false;
            }
            testFile.close();
        }

        // Realizar la copia
        try {
            fs::copy_file(g_jsonSourcePath, g_jsonDestPath, fs::copy_options::overwrite_existing);
            
            // Verificar que la copia fue exitosa
            if (!fs::exists(g_jsonDestPath)) {
                WriteToAdvancedLog("ERROR: Destination file does not exist after copy operation", __LINE__);
                return false;
            }
            
            // Comparar tamaños para verificar la integridad
            auto sourceSize = fs::file_size(g_jsonSourcePath);
            auto destSize = fs::file_size(g_jsonDestPath);
            
            if (sourceSize != destSize) {
                WriteToAdvancedLog("ERROR: File size mismatch after copy. Source: " + 
                                  std::to_string(sourceSize) + " bytes, Destination: " + 
                                  std::to_string(destSize) + " bytes", __LINE__);
                return false;
            }
            
            WriteToAdvancedLog("JSON file copied and verified successfully", __LINE__);
            WriteToAdvancedLog("Source: " + g_jsonSourcePath.string() + " (" + std::to_string(sourceSize) + " bytes)", __LINE__);
            WriteToAdvancedLog("Destination: " + g_jsonDestPath.string() + " (" + std::to_string(destSize) + " bytes)", __LINE__);
            
            return true;
            
        } catch (const std::exception& e) {
            WriteToAdvancedLog("ERROR during copy operation: " + std::string(e.what()), __LINE__);
            return false;
        }
        
    } catch (const std::exception& e) {
        WriteToAdvancedLog("ERROR in CopyJsonFile: " + std::string(e.what()), __LINE__);
        return false;
    }
}

bool GetJsonRecordStatus() {
    try {
        if (g_jsonRecordIniPath.empty() || !fs::exists(g_jsonRecordIniPath)) {
            return false;
        }

        std::ifstream iniFile(g_jsonRecordIniPath);
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
                std::transform(currentSection.begin(), currentSection.end(), currentSection.begin(), ::tolower);
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

                std::string sectionLower = currentSection;
                std::string keyLower = key;
                std::transform(sectionLower.begin(), sectionLower.end(), sectionLower.begin(), ::tolower);
                std::transform(keyLower.begin(), keyLower.end(), keyLower.begin(), ::tolower);

                if (sectionLower == "act4_json" && keyLower == "startact4") {
                    std::transform(value.begin(), value.end(), value.begin(), ::tolower);
                    bool result = (value == "true" || value == "1" || value == "yes");
                    iniFile.close();
                    return result;
                }
            }
        }

        iniFile.close();
        return false;

    } catch (const std::exception& e) {
        WriteToAdvancedLog("ERROR reading JsonRecord status: " + std::string(e.what()), __LINE__);
        return false;
    }
}

bool SetJsonRecordStatus(bool active) {
    try {
        if (g_jsonRecordIniPath.empty() || !fs::exists(g_jsonRecordIniPath)) {
            WriteToAdvancedLog("JsonRecord INI not found, cannot set status", __LINE__);
            return false;
        }

        std::ifstream fileIn(g_jsonRecordIniPath);
        if (!fileIn.is_open()) {
            WriteToAdvancedLog("Could not open JsonRecord INI for reading", __LINE__);
            return false;
        }

        std::string content((std::istreambuf_iterator<char>(fileIn)),
                           std::istreambuf_iterator<char>());
        fileIn.close();

        std::string searchPatternLower = "startact4 = ";
        size_t pos = FindCaseInsensitive(content, searchPatternLower);
        if (pos != std::string::npos) {
            size_t lineEnd = content.find('\n', pos);
            if (lineEnd == std::string::npos) lineEnd = content.length();

            std::string newLine = "startAct4 = " + std::string(active ? "true" : "false");
            content.replace(pos, lineEnd - pos, newLine);
        } else {
            WriteToAdvancedLog("startAct4 entry not found in JsonRecord INI", __LINE__);
            return false;
        }

        std::ofstream fileOut(g_jsonRecordIniPath);
        if (!fileOut.is_open()) {
            WriteToAdvancedLog("Could not open JsonRecord INI for writing", __LINE__);
            return false;
        }
        fileOut << content;
        fileOut.flush();
        fileOut.close();

        bool verifyStatus = GetJsonRecordStatus();
        if (verifyStatus != active) {
            WriteToAdvancedLog("ERROR: JsonRecord status verification failed after write", __LINE__);
            WriteToAdvancedLog("Expected: " + std::string(active ? "true" : "false") +
                              ", Got: " + std::string(verifyStatus ? "true" : "false"), __LINE__);
            return false;
        }

        WriteToAdvancedLog("JsonRecord status set to: " + std::string(active ? "true" : "false") + " (verified)", __LINE__);
        return true;

    } catch (const std::exception& e) {
        WriteToAdvancedLog("ERROR setting JsonRecord status: " + std::string(e.what()), __LINE__);
        return false;
    }
}

bool CopyJsonRecordFile() {
    try {
        std::lock_guard<std::mutex> lock(g_jsonMutex);

        if (g_jsonSourcePath.empty() || g_jsonDestPath.empty()) {
            WriteToAdvancedLog("ERROR: JSON record paths not configured", __LINE__);
            return false;
        }

        if (!fs::exists(g_jsonDestPath)) {
            WriteToAdvancedLog("ERROR: Record source JSON file not found: " + g_jsonDestPath.string(), __LINE__);
            return false;
        }

        if (!fs::exists(g_jsonSourcePath.parent_path())) {
            try {
                fs::create_directories(g_jsonSourcePath.parent_path());
                WriteToAdvancedLog("Created record destination directory: " + g_jsonSourcePath.parent_path().string(), __LINE__);
            } catch (const std::exception& e) {
                WriteToAdvancedLog("ERROR creating record destination directory: " + std::string(e.what()), __LINE__);
                return false;
            }
        }

        if (fs::exists(g_jsonSourcePath)) {
            std::ofstream testFile(g_jsonSourcePath, std::ios::app);
            if (!testFile.is_open()) {
                WriteToAdvancedLog("ERROR: Cannot write to record destination JSON file: " + g_jsonSourcePath.string(), __LINE__);
                return false;
            }
            testFile.close();
        }

        try {
            fs::copy_file(g_jsonDestPath, g_jsonSourcePath, fs::copy_options::overwrite_existing);

            if (!fs::exists(g_jsonSourcePath)) {
                WriteToAdvancedLog("ERROR: Record destination file does not exist after copy operation", __LINE__);
                return false;
            }

            auto sourceSize = fs::file_size(g_jsonDestPath);
            auto destSize = fs::file_size(g_jsonSourcePath);

            if (sourceSize != destSize) {
                WriteToAdvancedLog("ERROR: Record file size mismatch after copy. Source: " +
                                  std::to_string(sourceSize) + " bytes, Destination: " +
                                  std::to_string(destSize) + " bytes", __LINE__);
                return false;
            }

            WriteToAdvancedLog("JSON record file copied and verified successfully", __LINE__);
            WriteToAdvancedLog("Record Source: " + g_jsonDestPath.string() + " (" + std::to_string(sourceSize) + " bytes)", __LINE__);
            WriteToAdvancedLog("Record Destination: " + g_jsonSourcePath.string() + " (" + std::to_string(destSize) + " bytes)", __LINE__);

            return true;

        } catch (const std::exception& e) {
            WriteToAdvancedLog("ERROR during record copy operation: " + std::string(e.what()), __LINE__);
            return false;
        }

    } catch (const std::exception& e) {
        WriteToAdvancedLog("ERROR in CopyJsonRecordFile: " + std::string(e.what()), __LINE__);
        return false;
    }
}

void JsonMasterMonitorThreadFunction() {
    logger::info("JsonMaster monitoring thread started");
    WriteToAdvancedLog("JsonMaster monitoring thread started (1 second interval)", __LINE__);
    
    bool lastStatus = GetJsonMasterStatus();
    WriteToAdvancedLog("JsonMaster initial status: " + std::string(lastStatus ? "true" : "false"), __LINE__);
    fs::file_time_type lastWriteTime;
    if (fs::exists(g_jsonMasterIniPath)) {
        lastWriteTime = fs::last_write_time(g_jsonMasterIniPath);
    } else {
        lastWriteTime = fs::file_time_type::min();
    }

    while (g_monitoringJsonMaster.load() && !g_isShuttingDown.load()) {
        try {
            if (fs::exists(g_jsonMasterIniPath)) {
                auto currentWriteTime = fs::last_write_time(g_jsonMasterIniPath);
                if (currentWriteTime != lastWriteTime) {
                    lastWriteTime = currentWriteTime;

                    bool currentStatus = GetJsonMasterStatus();

                    if (lastStatus != currentStatus) {
                        WriteToAdvancedLog("JsonMaster status changed from " + std::string(lastStatus ? "true" : "false") +
                                          " to " + std::string(currentStatus ? "true" : "false"), __LINE__);
                    }

                    if (!lastStatus && currentStatus) {
                        WriteToAdvancedLog("JsonMaster status changed from false to true, initiating JSON copy and reset", __LINE__);

                        bool copySuccess = CopyJsonFile();

                        if (copySuccess) {
                            WriteToAdvancedLog("JSON copy completed successfully", __LINE__);
                            WriteToAdvancedLog("Source: " + g_jsonSourcePath.string(), __LINE__);
                            WriteToAdvancedLog("Destination: " + g_jsonDestPath.string(), __LINE__);

                            bool resetSuccess = SetJsonMasterStatus(false);
                            if (resetSuccess) {
                                WriteToAdvancedLog("JsonMaster status reset to false by plugin", __LINE__);
                            } else {
                                WriteToAdvancedLog("ERROR: Failed to reset JsonMaster status to false", __LINE__);
                            }
                        } else {
                            WriteToAdvancedLog("ERROR: JSON copy failed", __LINE__);
                            WriteToAdvancedLog("Source: " + g_jsonSourcePath.string(), __LINE__);
                            WriteToAdvancedLog("Destination: " + g_jsonDestPath.string(), __LINE__);
                        }

                        lastStatus = false;
                    } else {
                        lastStatus = currentStatus;
                    }
                }
            }
        } catch (const std::exception& e) {
            WriteToAdvancedLog("ERROR in JsonMaster monitor: " + std::string(e.what()), __LINE__);
        } catch (...) {
            WriteToAdvancedLog("ERROR in JsonMaster monitor: Unknown exception", __LINE__);
        }

        std::this_thread::sleep_for(std::chrono::seconds(1));
    }

    logger::info("JsonMaster monitoring thread stopped");
    WriteToAdvancedLog("JsonMaster monitoring thread stopped", __LINE__);
}

void JsonRecordMonitorThreadFunction() {
    logger::info("JsonRecord monitoring thread started");
    WriteToAdvancedLog("JsonRecord monitoring thread started (1 second interval)", __LINE__);

    bool lastStatus = GetJsonRecordStatus();
    WriteToAdvancedLog("JsonRecord initial status: " + std::string(lastStatus ? "true" : "false"), __LINE__);
    fs::file_time_type lastWriteTime;
    if (fs::exists(g_jsonRecordIniPath)) {
        lastWriteTime = fs::last_write_time(g_jsonRecordIniPath);
    } else {
        lastWriteTime = fs::file_time_type::min();
    }

    while (g_monitoringJsonRecord.load() && !g_isShuttingDown.load()) {
        try {
            if (fs::exists(g_jsonRecordIniPath)) {
                auto currentWriteTime = fs::last_write_time(g_jsonRecordIniPath);
                if (currentWriteTime != lastWriteTime) {
                    lastWriteTime = currentWriteTime;

                    bool currentStatus = GetJsonRecordStatus();

                    if (lastStatus != currentStatus) {
                        WriteToAdvancedLog("JsonRecord status changed from " + std::string(lastStatus ? "true" : "false") +
                                          " to " + std::string(currentStatus ? "true" : "false"), __LINE__);
                    }

                    if (!lastStatus && currentStatus) {
                        WriteToAdvancedLog("JsonRecord status changed from false to true, initiating JSON record copy and reset", __LINE__);

                        bool copySuccess = CopyJsonRecordFile();

                        if (copySuccess) {
                            WriteToAdvancedLog("JSON record copy completed successfully", __LINE__);

                            bool resetSuccess = SetJsonRecordStatus(false);
                            if (resetSuccess) {
                                WriteToAdvancedLog("JsonRecord status reset to false by plugin", __LINE__);
                            } else {
                                WriteToAdvancedLog("ERROR: Failed to reset JsonRecord status to false", __LINE__);
                            }
                        } else {
                            WriteToAdvancedLog("ERROR: JSON record copy failed", __LINE__);
                        }

                        lastStatus = false;
                    } else {
                        lastStatus = currentStatus;
                    }
                }
            }
        } catch (const std::exception& e) {
            WriteToAdvancedLog("ERROR in JsonRecord monitor: " + std::string(e.what()), __LINE__);
        } catch (...) {
            WriteToAdvancedLog("ERROR in JsonRecord monitor: Unknown exception", __LINE__);
        }

        std::this_thread::sleep_for(std::chrono::seconds(1));
    }

    logger::info("JsonRecord monitoring thread stopped");
    WriteToAdvancedLog("JsonRecord monitoring thread stopped", __LINE__);
}

void StartJsonMasterMonitoring() {
    if (!g_monitoringJsonMaster.load() && !g_jsonMasterIniPath.empty() && fs::exists(g_jsonMasterIniPath)) {
        g_monitoringJsonMaster = true;
        g_jsonMonitorThread = std::thread(JsonMasterMonitorThreadFunction);
        WriteToAdvancedLog("JsonMaster monitoring started for: " + g_jsonMasterIniPath.string(), __LINE__);
        WriteToAdvancedLog("JSON Source: " + g_jsonSourcePath.string(), __LINE__);
        WriteToAdvancedLog("JSON Destination: " + g_jsonDestPath.string(), __LINE__);
    } else {
        if (g_jsonMasterIniPath.empty()) {
            WriteToAdvancedLog("WARNING: JsonMaster monitoring not started - INI path empty", __LINE__);
        } else if (!fs::exists(g_jsonMasterIniPath)) {
            WriteToAdvancedLog("WARNING: JsonMaster monitoring not started - INI file not found: " + g_jsonMasterIniPath.string(), __LINE__);
        }
    }
}

void StartJsonRecordMonitoring() {
    if (!g_monitoringJsonRecord.load() && !g_jsonRecordIniPath.empty() && fs::exists(g_jsonRecordIniPath)) {
        g_monitoringJsonRecord = true;
        g_jsonRecordMonitorThread = std::thread(JsonRecordMonitorThreadFunction);
        WriteToAdvancedLog("JsonRecord monitoring started for: " + g_jsonRecordIniPath.string(), __LINE__);
    } else {
        if (g_jsonRecordIniPath.empty()) {
            WriteToAdvancedLog("WARNING: JsonRecord monitoring not started - INI path empty", __LINE__);
        } else if (!fs::exists(g_jsonRecordIniPath)) {
            WriteToAdvancedLog("WARNING: JsonRecord monitoring not started - INI file not found: " + g_jsonRecordIniPath.string(), __LINE__);
        }
    }
}

void StopJsonMasterMonitoring() {
    if (g_monitoringJsonMaster.load()) {
        g_monitoringJsonMaster = false;
        if (g_jsonMonitorThread.joinable()) {
            g_jsonMonitorThread.join();
        }
        WriteToAdvancedLog("JsonMaster monitoring stopped", __LINE__);
    }
}

void StopJsonRecordMonitoring() {
    if (g_monitoringJsonRecord.load()) {
        g_monitoringJsonRecord = false;
        if (g_jsonRecordMonitorThread.joinable()) {
            g_jsonRecordMonitorThread.join();
        }
        WriteToAdvancedLog("JsonRecord monitoring stopped", __LINE__);
    }
}

// ===== STARTUP RESET SYSTEM =====
void ResetHostActiveAtStartup() {
    try {
        WriteToAdvancedLog("========================================", __LINE__);
        WriteToAdvancedLog("STARTUP RESET: Checking host active status", __LINE__);
        WriteToAdvancedLog("========================================", __LINE__);
        
        bool currentStatus = GetHostActiveStatus();
        WriteToAdvancedLog("Current host active status: " + std::string(currentStatus ? "true" : "false"), __LINE__);
        
        if (currentStatus) {
            WriteToAdvancedLog("Resetting host active status from true to false", __LINE__);
            SetHostActiveStatus(false);
        } else {
            WriteToAdvancedLog("Host active status already false, no change needed", __LINE__);
        }
        
        WriteToAdvancedLog("Startup reset completed", __LINE__);
        WriteToAdvancedLog("========================================", __LINE__);
        
    } catch (const std::exception& e) {
        WriteToAdvancedLog("ERROR in startup reset: " + std::string(e.what()), __LINE__);
    }
}

// ===== MCM INI MONITORING SYSTEM =====
void MCMIniMonitorThreadFunction() {
    logger::info("MCM INI monitoring thread started");
    WriteToAdvancedLog("MCM INI monitoring thread started", __LINE__);

    while (g_monitoringMCMIni.load() && !g_isShuttingDown.load()) {
        try {
            if (fs::exists(g_mcmIniPath)) {
                auto currentModTime = fs::last_write_time(g_mcmIniPath);
                auto currentModTimeT = std::chrono::system_clock::to_time_t(
                    std::chrono::time_point_cast<std::chrono::system_clock::duration>(
                        currentModTime - fs::file_time_type::clock::now() + std::chrono::system_clock::now()));

                if (currentModTimeT > g_lastMCMIniCheckTime) {
                    std::lock_guard<std::mutex> lock(g_mcmIniMutex);
                    
                    bool mcmActive = GetMCMActiveStatus();
                    if (mcmActive) {
                        WriteToAdvancedLog("MCM INI detected as active=true, performing reset", __LINE__);
                        
                        SetHostActiveStatus(false);
                        SetMCMActiveStatus(false);
                        
                        WriteToAdvancedLog("Reset completed: host=false, MCM=false", __LINE__);
                    }
                    
                    g_lastMCMIniCheckTime = currentModTimeT;
                }
            }
        } catch (...) {
        }

        std::this_thread::sleep_for(std::chrono::seconds(4));
    }

    logger::info("MCM INI monitoring thread stopped");
    WriteToAdvancedLog("MCM INI monitoring thread stopped", __LINE__);
}

void StartMCMIniMonitoring() {
    if (!g_monitoringMCMIni.load() && !g_mcmIniPath.empty() && fs::exists(g_mcmIniPath)) {
        g_monitoringMCMIni = true;
        g_mcmMonitorThread = std::thread(MCMIniMonitorThreadFunction);
        WriteToAdvancedLog("MCM INI monitoring started for: " + g_mcmIniPath.string(), __LINE__);
    }
}

void StopMCMIniMonitoring() {
    if (g_monitoringMCMIni.load()) {
        g_monitoringMCMIni = false;
        if (g_mcmMonitorThread.joinable()) {
            g_mcmMonitorThread.join();
        }
        WriteToAdvancedLog("MCM INI monitoring stopped", __LINE__);
    }
}

// ===== URL OPENING SYSTEM =====
void OpenMCMUrl() {
    try {
        std::string urlToOpen;
        {
            std::lock_guard<std::mutex> lock(g_urlMutex);
            urlToOpen = g_mcmUrl;
        }

        WriteToAdvancedLog("Opening MCM URL: " + urlToOpen, __LINE__);

        HINSTANCE result = ShellExecuteA(
            NULL,
            "open",
            urlToOpen.c_str(),
            NULL,
            NULL,
            SW_SHOW
        );

        if ((INT_PTR)result > 32) {
            WriteToAdvancedLog("MCM URL opened successfully in default browser", __LINE__);
            logger::info("MCM URL opened successfully: {}", urlToOpen);
        } else {
            WriteToAdvancedLog("ERROR: Failed to open MCM URL, error code: " + std::to_string((INT_PTR)result), __LINE__);
            logger::error("Failed to open MCM URL: {}, error code: {}", urlToOpen, (INT_PTR)result);
        }

    } catch (const std::exception& e) {
        logger::error("Error in OpenMCMUrl: {}", e.what());
        WriteToAdvancedLog("ERROR in OpenMCMUrl: " + std::string(e.what()), __LINE__);
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
        float newSoundVolume = g_soundVolume.load();
        bool newVolumeEnabled = g_volumeControlEnabled.load();

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

                std::string sectionLower = currentSection;
                std::string keyLower = key;
                std::transform(sectionLower.begin(), sectionLower.end(), sectionLower.begin(), ::tolower);
                std::transform(keyLower.begin(), keyLower.end(), keyLower.begin(), ::tolower);

                if (sectionLower == "advanced_mcm" && keyLower == "startup") {
                    std::transform(value.begin(), value.end(), value.begin(), ::tolower);
                    newStartupSound = (value == "true" || value == "1" || value == "yes");
                } else if (sectionLower == "top notifications" && keyLower == "visible") {
                    std::transform(value.begin(), value.end(), value.begin(), ::tolower);
                    newTopNotifications = (value == "true" || value == "1" || value == "yes");
                } else if (sectionLower == "volume control") {
                    if (keyLower == "soundvolume") {
                        try {
                            float vol = std::stof(value);
                            if (vol >= 0.0f && vol <= 1.0f) {
                                newSoundVolume = vol;
                            }
                        } catch (...) {}
                    } else if (keyLower == "mastervolumeenabled") {
                        std::transform(value.begin(), value.end(), value.begin(), ::tolower);
                        newVolumeEnabled = (value == "true" || value == "1" || value == "yes");
                    }
                }
            }
        }

        iniFile.close();

        bool startupChanged = (newStartupSound != g_startupSoundEnabled.load());
        bool notificationsChanged = (newTopNotifications != g_topNotificationsVisible.load());
        bool volumeChanged = (newSoundVolume != g_soundVolume.load() || 
                             newVolumeEnabled != g_volumeControlEnabled.load());

        g_startupSoundEnabled = newStartupSound;
        g_topNotificationsVisible = newTopNotifications;
        g_soundVolume = newSoundVolume;
        g_volumeControlEnabled = newVolumeEnabled;

        if (startupChanged) {
            logger::info("Startup sound {}", newStartupSound ? "enabled" : "disabled");
            WriteToAdvancedLog("Startup sound " + std::string(newStartupSound ? "enabled" : "disabled"), __LINE__);
        }

        if (notificationsChanged) {
            logger::info("Top notifications {}", newTopNotifications ? "enabled" : "disabled");
            WriteToAdvancedLog("Top notifications " + std::string(newTopNotifications ? "enabled" : "disabled"), __LINE__);
        }

        if (volumeChanged) {
            logger::info("Volume settings changed - Sound: {}, Enabled: {}", 
                        newSoundVolume, newVolumeEnabled);
            WriteToAdvancedLog("Volume settings - Sound: " + std::to_string(newSoundVolume) + 
                              ", Control: " + std::string(newVolumeEnabled ? "enabled" : "disabled"), __LINE__);
        }

        WriteToAdvancedLog(
            "PDA settings loaded - Startup Sound: " + std::string(g_startupSoundEnabled.load() ? "enabled" : "disabled") +
                ", Top Notifications: " + std::string(g_topNotificationsVisible.load() ? "enabled" : "disabled") +
                ", Volume Control: " + std::string(g_volumeControlEnabled.load() ? "enabled" : "disabled"),
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

        size_t pos = content.find("Advanced_MCM = ");
        if (pos != std::string::npos) {
            size_t lineEnd = content.find('\n', pos);
            if (lineEnd == std::string::npos) lineEnd = content.length();
            
            std::string newLine = "Advanced_MCM = " + newValue;
            content.replace(pos, lineEnd - pos, newLine);
        } else {
            logger::error("Advanced_MCM entry not found in INI");
            return false;
        }

        std::ofstream fileOut(g_iniPath);
        if (!fileOut.is_open()) {
            logger::error("Could not open INI file for writing");
            return false;
        }
        fileOut << content;
        fileOut.close();

        logger::info("INI modified: Advanced_MCM = {}", newValue);
        WriteToAdvancedLog("INI modified: Advanced_MCM = " + newValue, __LINE__);
        return true;
    } catch (const std::exception& e) {
        logger::error("Error modifying INI: {}", e.what());
        return false;
    }
}

void IniMonitorThreadFunction() {
    logger::info("INI monitoring thread started");
    
    // Initialize timestamp to prevent immediate reload on startup
    if (fs::exists(g_iniPath)) {
        try {
            auto currentModTime = fs::last_write_time(g_iniPath);
            g_lastIniCheckTime = std::chrono::system_clock::to_time_t(
                std::chrono::time_point_cast<std::chrono::system_clock::duration>(
                    currentModTime - fs::file_time_type::clock::now() + std::chrono::system_clock::now()));
        } catch (...) {}
    }

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
                    LoadHostSettings();
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

bool SetProcessVolume(DWORD processID, float volume) {
    HRESULT hr = CoInitialize(nullptr);
    if (FAILED(hr)) {
        logger::error("CoInitialize failed in SetProcessVolume");
        return false;
    }
    
    IMMDeviceEnumerator* deviceEnumerator = nullptr;
    hr = CoCreateInstance(__uuidof(MMDeviceEnumerator), nullptr, CLSCTX_INPROC_SERVER,
                         __uuidof(IMMDeviceEnumerator), (LPVOID*)&deviceEnumerator);
    
    if (FAILED(hr)) {
        logger::error("Failed to create device enumerator");
        CoUninitialize();
        return false;
    }
    
    IMMDevice* defaultDevice = nullptr;
    hr = deviceEnumerator->GetDefaultAudioEndpoint(eRender, eConsole, &defaultDevice);
    
    if (FAILED(hr)) {
        logger::error("Failed to get default audio endpoint");
        deviceEnumerator->Release();
        CoUninitialize();
        return false;
    }
    
    IAudioSessionManager2* sessionManager = nullptr;
    hr = defaultDevice->Activate(__uuidof(IAudioSessionManager2), CLSCTX_INPROC_SERVER,
                                nullptr, (LPVOID*)&sessionManager);
    
    if (FAILED(hr)) {
        logger::error("Failed to activate session manager");
        defaultDevice->Release();
        deviceEnumerator->Release();
        CoUninitialize();
        return false;
    }
    
    IAudioSessionEnumerator* sessionEnum = nullptr;
    hr = sessionManager->GetSessionEnumerator(&sessionEnum);
    
    if (FAILED(hr)) {
        logger::error("Failed to get session enumerator");
        sessionManager->Release();
        defaultDevice->Release();
        deviceEnumerator->Release();
        CoUninitialize();
        return false;
    }
    
    int sessionCount = 0;
    sessionEnum->GetCount(&sessionCount);
    
    bool volumeSet = false;
    
    for (int i = 0; i < sessionCount; i++) {
        IAudioSessionControl* sessionControl = nullptr;
        sessionEnum->GetSession(i, &sessionControl);
        
        if (sessionControl == nullptr) {
            continue;
        }
        
        IAudioSessionControl2* sessionControl2 = nullptr;
        hr = sessionControl->QueryInterface(__uuidof(IAudioSessionControl2), (LPVOID*)&sessionControl2);
        
        if (FAILED(hr)) {
            sessionControl->Release();
            continue;
        }
        
        DWORD sessionPID = 0;
        sessionControl2->GetProcessId(&sessionPID);
        
        if (sessionPID == processID) {
            ISimpleAudioVolume* audioVolume = nullptr;
            hr = sessionControl2->QueryInterface(__uuidof(ISimpleAudioVolume), (LPVOID*)&audioVolume);
            
            if (SUCCEEDED(hr) && audioVolume != nullptr) {
                hr = audioVolume->SetMasterVolume(volume, nullptr);
                
                if (SUCCEEDED(hr)) {
                    volumeSet = true;
                    logger::info("Volume set to {} for process {}", volume, processID);
                } else {
                    logger::error("Failed to set volume for process {}", processID);
                }
                
                audioVolume->Release();
            }
            
            sessionControl2->Release();
            sessionControl->Release();
            break;
        }
        
        sessionControl2->Release();
        sessionControl->Release();
    }
    
    sessionEnum->Release();
    sessionManager->Release();
    defaultDevice->Release();
    deviceEnumerator->Release();
    CoUninitialize();
    
    return volumeSet;
}

void GenerateSoundScript() {
    fs::path scriptFile = g_soundScriptDirectory / "OBody_Sound.ps1";

    std::string soundsFolder = g_soundsDirectory.string();

    std::ofstream script(scriptFile, std::ios::binary);
    if (!script.is_open()) {
        logger::error("Failed to create Sound script");
        return;
    }
    script << "\xEF\xBB\xBF";

    script << "# ===================================================================\n";
    script << "# OBody_Sound.ps1\n";
    script << "# OBody PDA sound handler\n";
    script << "# Generated: " << GetCurrentTimeString() << "\n";
    if (g_usingDllPath) {
        script << "# MODE: Wabbajack/MO2 (DLL-relative paths)\n";
    } else {
        script << "# MODE: Standard installation\n";
    }
    script << "# ===================================================================\n\n";

    std::string trackDir = GetTrackDirectory();
    script << "$carpetaSonidos = '" << soundsFolder << "'\n";
    script << "$stopFile = '" << trackDir << "\\stop_OBody_Sound.tmp'\n";
    script << "$trackFile = '" << trackDir << "\\track_OBody_Sound.tmp'\n\n";

    script << "# Available tracks\n";
    script << "$archivosWAV = @(\n";
    script << "    'miau-PDA.wav'\n";
    script << ")\n\n";

    script << "# Verify WAV files exist\n";
    script << "foreach ($wav in $archivosWAV) {\n";
    script << "    $rutaCompleta = Join-Path $carpetaSonidos $wav\n";
    script << "    if (-not (Test-Path $rutaCompleta)) {\n";
    script << "        Write-Host \"ERROR: Sound file not found: $rutaCompleta\"\n";
    script << "        exit 1\n";
    script << "    }\n";
    script << "}\n\n";

    script << "# Initialize player\n";
    script << "$script:reproductor = New-Object System.Media.SoundPlayer\n";
    script << "$indiceActual = 0\n";
    script << "$ultimoTrackSeleccionado = 'miau-PDA.wav'\n";
    script << "$ultimaModificacionTrack = [DateTime]::MinValue\n\n";

    script << "# Read initial track if exists\n";
    script << "if (Test-Path $trackFile) {\n";
    script << "    try {\n";
    script << "        $trackInicial = Get-Content $trackFile -Raw -ErrorAction SilentlyContinue\n";
    script << "        $trackInicial = $trackInicial.Trim()\n";
    script << "        $parts = $trackInicial -split '\\|'\n";
    script << "        $soundFile = $parts[0]\n";
    script << "        for ($i = 0; $i -lt $archivosWAV.Count; $i++) {\n";
    script << "            if ($archivosWAV[$i] -eq $soundFile) {\n";
    script << "                $indiceActual = $i\n";
    script << "                $ultimoTrackSeleccionado = $soundFile\n";
    script << "                Write-Host \"Starting with pre-selected track: $soundFile\"\n";
    script << "                break\n";
    script << "            }\n";
    script << "        }\n";
    script << "    } catch { }\n";
    script << "}\n\n";

    script << "# Function to play track once\n";
    script << "function Play-Track-Once {\n";
    script << "    param($index)\n";
    script << "    $trackName = $archivosWAV[$index]\n";
    script << "    $rutaWAV = Join-Path $carpetaSonidos $trackName\n";
    script << "    try {\n";
    script << "        if ($script:reproductor -ne $null) {\n";
    script << "            $script:reproductor.Stop()\n";
    script << "            Start-Sleep -Milliseconds 100\n";
    script << "            $script:reproductor.Dispose()\n";
    script << "            $script:reproductor = $null\n";
    script << "        }\n";
    script << "        $script:reproductor = New-Object System.Media.SoundPlayer\n";
    script << "        $script:reproductor.SoundLocation = $rutaWAV\n";
    script << "        $script:reproductor.Load()\n";
    script << "        $script:reproductor.Play()\n";
    script << "        Write-Host \"NOW PLAYING (ONCE): $trackName (Index: $index)\"\n";
    script << "        Start-Sleep -Seconds 2\n";
    script << "        if ($script:reproductor -ne $null) {\n";
    script << "            $script:reproductor.Stop()\n";
    script << "            $script:reproductor.Dispose()\n";
    script << "            $script:reproductor = $null\n";
    script << "        }\n";
    script << "        Write-Host \"Sound playback completed: $trackName\"\n";
    script << "        exit 0\n";
    script << "    } catch {\n";
    script << "        Write-Host \"ERROR: Cannot play sound: $_\"\n";
    script << "        exit 1\n";
    script << "    }\n";
    script << "}\n\n";

    script << "# Play initial track once and exit\n";
    script << "Play-Track-Once -index $indiceActual\n";

    script.close();

    g_soundScript.name = "Sound";
    g_soundScript.scriptPath = scriptFile;
    std::string trackDirStr = trackDir;
    g_soundScript.stopFilePath = trackDirStr + "\\stop_OBody_Sound.tmp";
    g_soundScript.trackFilePath = trackDirStr + "\\track_OBody_Sound.tmp";

    WriteToAdvancedLog("Generated OBody_Sound.ps1" + std::string(g_usingDllPath ? " (Wabbajack mode)" : ""), __LINE__);
}

void CleanOldScripts() {
    fs::path scriptsPath = g_soundScriptDirectory;

    if (!fs::exists(scriptsPath)) {
        logger::info("Scripts directory does not exist yet, will be created");
        return;
    }

    try {
        int deletedCount = 0;
        for (auto& entry : fs::directory_iterator(scriptsPath)) {
            if (entry.path().extension() == ".ps1") {
                std::string filename = entry.path().filename().string();
                if (filename.find("OBody_") == 0) {
                    fs::remove(entry.path());
                    deletedCount++;
                }
            }
        }

        WriteToAdvancedLog("Cleaned " + std::to_string(deletedCount) + " old OBody scripts", __LINE__);

    } catch (const std::exception& e) {
        logger::error("Error cleaning old scripts: {}", e.what());
        WriteToAdvancedLog("ERROR cleaning old scripts: " + std::string(e.what()), __LINE__);
    }
}

void GenerateStaticScripts() {
    fs::create_directories(g_soundScriptDirectory);

    CleanOldScripts();

    WriteToAdvancedLog("GENERATING OBODY PDA SOUND SCRIPT...", __LINE__);
    WriteToAdvancedLog("Sound script path: " + g_soundScriptDirectory.string(), __LINE__);
    if (g_usingDllPath) {
        WriteToAdvancedLog("MODE: Wabbajack/MO2 (DLL-relative paths)", __LINE__);
        WriteToAdvancedLog("Sounds path: " + g_soundsDirectory.string(), __LINE__);
    }

    GenerateSoundScript();

    WriteToAdvancedLog("GENERATED SOUND SCRIPT SUCCESSFULLY", __LINE__);
    WriteToAdvancedLog("Script: Sound (one-time play)", __LINE__);
}

PROCESS_INFORMATION LaunchPowerShellScript(const std::string& scriptPath) {
    PROCESS_INFORMATION pi = {0};

    std::string command =
        "powershell.exe -WindowStyle Hidden -ExecutionPolicy Bypass -NoProfile -File \"" + scriptPath + "\"";

    STARTUPINFOA si = {sizeof(si)};
    si.dwFlags = STARTF_USESHOWWINDOW;
    si.wShowWindow = SW_HIDE;

    if (CreateProcessA(NULL, (LPSTR)command.c_str(), NULL, NULL, FALSE, CREATE_NO_WINDOW | BELOW_NORMAL_PRIORITY_CLASS,
                       NULL, NULL, &si, &pi)) {
        logger::info("Launched PowerShell script: {}", scriptPath);
        return pi;
    } else {
        logger::error("Failed to launch PowerShell script: {}", scriptPath);
        return pi;
    }
}

void StartAllScriptsFrozen() {
    if (g_scriptsInitialized) {
        logger::info("Scripts already initialized, skipping");
        return;
    }

    WriteToAdvancedLog("========================================", __LINE__);
    WriteToAdvancedLog("INITIALIZING OBODY PDA SCRIPT SYSTEM", __LINE__);
    WriteToAdvancedLog("========================================", __LINE__);

    CleanStopFiles();

    GenerateStaticScripts();

    g_scriptsInitialized = true;

    WriteToAdvancedLog("OBODY PDA SCRIPTS READY FOR EXECUTION", __LINE__);
    WriteToAdvancedLog("Status: Sound script [READY]", __LINE__);
    WriteToAdvancedLog("========================================", __LINE__);

    logger::info("OBody PDA scripts initialized successfully");
}

void StopScript(ScriptState& scriptState) {
    if (!scriptState.isRunning) return;
    
    WriteToAdvancedLog("Stopping script: " + scriptState.name +
                          (scriptState.isPaused ? " [FROZEN]" : " [ACTIVE]"), __LINE__);
    
    if (scriptState.processInfo.hProcess != 0 && scriptState.processInfo.hProcess != INVALID_HANDLE_VALUE) {
        TerminateProcess(scriptState.processInfo.hProcess, 0);
        WaitForSingleObject(scriptState.processInfo.hProcess, 500);
        WriteToAdvancedLog("Script " + scriptState.name + " terminated directly", __LINE__);
    }
    
    CloseHandle(scriptState.processInfo.hProcess);
    CloseHandle(scriptState.processInfo.hThread);
    ZeroMemory(&scriptState.processInfo, sizeof(PROCESS_INFORMATION));
    
    scriptState.isRunning = false;
    scriptState.isPaused = false;
    scriptState.currentTrack = "";
    
    try {
        fs::remove(scriptState.stopFilePath);
    } catch (...) {}
    
    WriteToAdvancedLog("Script " + scriptState.name + " stopped cleanly", __LINE__);
}

void StopAllScripts() {
    WriteToAdvancedLog("STOPPING ALL OBODY PDA SCRIPTS", __LINE__);

    StopScript(g_soundScript);

    g_scriptsInitialized = false;

    WriteToAdvancedLog("All OBody PDA scripts stopped", __LINE__);
}

void StopAllSounds() { 
    StopAllScripts(); 
}

void PlaySoundOnce(const std::string& soundFileName) {
    try {
        if (!g_scriptsInitialized) {
            StartAllScriptsFrozen();
        }

        fs::path soundPath = g_soundsDirectory / soundFileName;
        
        if (!fs::exists(soundPath)) {
            logger::error("Sound file not found: {}", soundPath.string());
            WriteToAdvancedLog("ERROR: Sound file not found: " + soundPath.string(), __LINE__);
            return;
        }

        PROCESS_INFORMATION pi = LaunchPowerShellScript(g_soundScript.scriptPath.string());
        
        if (pi.hProcess != 0 && pi.hProcess != INVALID_HANDLE_VALUE) {
            if (g_volumeControlEnabled.load()) {
                std::this_thread::sleep_for(std::chrono::milliseconds(500));
                bool volumeApplied = SetProcessVolume(pi.dwProcessId, g_soundVolume.load());
                if (volumeApplied) {
                    WriteToAdvancedLog("Sound script volume set to " + std::to_string(static_cast<int>(g_soundVolume.load() * 100)) + "% (PID: " + std::to_string(pi.dwProcessId) + ")", __LINE__);
                } else {
                    WriteToAdvancedLog("WARNING: Could not set volume for Sound script", __LINE__);
                }
            }
            
            CloseHandle(pi.hProcess);
            CloseHandle(pi.hThread);
            WriteToAdvancedLog("Sound played successfully: " + soundFileName, __LINE__);
            logger::info("Sound played successfully");
        } else {
            logger::error("Failed to create sound process. Error: {}", GetLastError());
            WriteToAdvancedLog("ERROR: Failed to play sound", __LINE__);
        }
    } catch (const std::exception& e) {
        logger::error("Error in PlaySoundOnce: {}", e.what());
        WriteToAdvancedLog("ERROR in PlaySoundOnce: " + std::string(e.what()), __LINE__);
    }
}

void ExecuteStartMCMScript() {
    try {
        fs::path startMCMPath = g_scriptsDirectory / "Assets" / "startMCM.ps1";  
        
        if (!fs::exists(startMCMPath)) {
            logger::error("StartMCM script not found: {}", startMCMPath.string());
            WriteToAdvancedLog("ERROR: StartMCM script not found: " + startMCMPath.string(), __LINE__);
            return;
        }

        PROCESS_INFORMATION pi = LaunchPowerShellScript(startMCMPath.string());
        
        if (pi.hProcess != 0 && pi.hProcess != INVALID_HANDLE_VALUE) {
            CloseHandle(pi.hProcess);
            CloseHandle(pi.hThread);
            WriteToAdvancedLog("StartMCM script executed successfully", __LINE__);
            WriteToAdvancedLog("Web interface activated", __LINE__);
            logger::info("StartMCM script executed successfully");
        } else {
            logger::error("Failed to execute StartMCM script. Error: {}", GetLastError());
            WriteToAdvancedLog("ERROR: Failed to execute StartMCM script", __LINE__);
        }
    } catch (const std::exception& e) {
        logger::error("Error in ExecuteStartMCMScript: {}", e.what());
        WriteToAdvancedLog("ERROR in ExecuteStartMCMScript: " + std::string(e.what()), __LINE__);
    }
}

// ===== MODIFIED ACTIVATION SYSTEM WITH NEW LOGIC =====
void ProcessOBodyPDAActivation() {
    WriteToAdvancedLog("========================================", __LINE__);
    WriteToAdvancedLog("MCM BUTTON PRESSED - NEW ACTIVATION LOGIC", __LINE__);
    WriteToAdvancedLog("========================================", __LINE__);

    std::thread([]() {
        try {
            WriteToAdvancedLog("Step 1: Playing sound notification", __LINE__);
            PlaySoundOnce("miau-PDA.wav");
            
            WriteToAdvancedLog("Step 2: Loading host settings and checking status", __LINE__);
            LoadHostSettings();
            
            bool isActive = GetHostActiveStatus();
            WriteToAdvancedLog("Current host active status: " + std::string(isActive ? "true" : "false"), __LINE__);
            
            if (!isActive) {
                WriteToAdvancedLog("Step 3a: First time activation - Setting active_host to true", __LINE__);
                SetHostActiveStatus(true);
                
                WriteToAdvancedLog("Step 3b: Executing startMCM.ps1 script", __LINE__);
                ExecuteStartMCMScript();
                
                std::this_thread::sleep_for(std::chrono::milliseconds(1000));
                
                WriteToAdvancedLog("Step 3c: Opening MCM URL", __LINE__);
                OpenMCMUrl();
                
                WriteToAdvancedLog("First time activation completed", __LINE__);
            } else {
                WriteToAdvancedLog("Step 3: Subsequent activation - Opening MCM URL directly", __LINE__);
                OpenMCMUrl();
                
                WriteToAdvancedLog("Subsequent activation completed", __LINE__);
            }
            
            WriteToAdvancedLog("MCM activation process finished", __LINE__);
            WriteToAdvancedLog("========================================", __LINE__);
            
        } catch (const std::exception& e) {
            WriteToAdvancedLog("ERROR in MCM activation: " + std::string(e.what()), __LINE__);
        }
    }).detach();
}

namespace ObodyPDA_Native {
    void ActivateAdvancedMCM(RE::StaticFunctionTag*) {
        logger::info("ActivateAdvancedMCM called from MCM - New Logic System");
        WriteToAdvancedLog("MCM Button pressed - New activation logic triggered", __LINE__);
        ProcessOBodyPDAActivation();
    }

    bool RegisterPapyrusFunctions(RE::BSScript::IVirtualMachine* vm) {
        vm->RegisterFunction("ActivateAdvancedMCM", "ObodyPDA_NativeScript", ActivateAdvancedMCM);
        logger::info("ObodyPDA_NativeScript functions registered successfully");
        WriteToAdvancedLog("Papyrus functions registered successfully", __LINE__);
        return true;
    }
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

// ===== UNIFIED DETECTION LOGGING SYSTEM WITH JSON MASTER SUPPORT =====

OBodyPDAPathsResult DetectAllOBodyPDAPaths() {
    OBodyPDAPathsResult result;
    
    WriteToAdvancedLog("================================================================", __LINE__);
    WriteToAdvancedLog("  OBODY PDA - COMPLETE PATH DETECTION SYSTEM", __LINE__);
    WriteToAdvancedLog("  Version: 2.0.9", __LINE__);
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
            "Act3_OBody_NG_PDA_NG.dll"
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
        WriteToAdvancedLog("SEARCHING FOR HOST INI FILE...", __LINE__);
        
        const std::string hostIniFileName = "Act3_OBody_NG_PDA_NG.ini";
        fs::path hostIniPath = dllDir / hostIniFileName;
        
        WriteToAdvancedLog("Checking: " + hostIniPath.string(), __LINE__);
        
        if (fs::exists(hostIniPath)) {
            g_hostIniPath = hostIniPath;
            auto fileSize = fs::file_size(hostIniPath);
            WriteToAdvancedLog("HOST INI FILE FOUND!", __LINE__);
            WriteToAdvancedLog("   Full path: " + hostIniPath.string(), __LINE__);
            WriteToAdvancedLog("   File size: " + std::to_string(fileSize) + " bytes", __LINE__);
        } else {
            WriteToAdvancedLog("HOST INI FILE NOT FOUND in DLL directory", __LINE__);
        }
        
        WriteToAdvancedLog("", __LINE__);
        WriteToAdvancedLog("SEARCHING FOR MCM INI FILE...", __LINE__);
        
        std::vector<fs::path> mcmIniSearchPaths = {
            dllDir / "OBody_NG_PDA_NG_Full_Assistance" / "Assets" / "ini" / "MCM.ini",
            dllDir / "Assets" / "ini" / "MCM.ini",
            dllDir.parent_path() / "OBody_NG_PDA_NG_Full_Assistance" / "Assets" / "ini" / "MCM.ini"
        };
        
        for (const auto& searchPath : mcmIniSearchPaths) {
            WriteToAdvancedLog("Checking: " + searchPath.string(), __LINE__);
            
            if (fs::exists(searchPath)) {
                g_mcmIniPath = searchPath;
                auto fileSize = fs::file_size(searchPath);
                WriteToAdvancedLog("MCM INI FILE FOUND!", __LINE__);
                WriteToAdvancedLog("   Full path: " + searchPath.string(), __LINE__);
                WriteToAdvancedLog("   File size: " + std::to_string(fileSize) + " bytes", __LINE__);
                break;
            }
        }
        
        if (g_mcmIniPath.empty()) {
            WriteToAdvancedLog("MCM INI FILE NOT FOUND in any location", __LINE__);
        }
        
        WriteToAdvancedLog("", __LINE__);
        WriteToAdvancedLog("SEARCHING FOR JSON MASTER INI FILE...", __LINE__);
        
        fs::path jsonMasterIniPath = dllDir / "OBody_NG_PDA_NG_Full_Assistance" / "Assets" / "ini" / "JsonMaster.ini";
        
        WriteToAdvancedLog("Checking: " + jsonMasterIniPath.string(), __LINE__);
        
        if (fs::exists(jsonMasterIniPath)) {
            g_jsonMasterIniPath = jsonMasterIniPath;
            auto fileSize = fs::file_size(jsonMasterIniPath);
            WriteToAdvancedLog("JSON MASTER INI FILE FOUND!", __LINE__);
            WriteToAdvancedLog("   Full path: " + jsonMasterIniPath.string(), __LINE__);
            WriteToAdvancedLog("   File size: " + std::to_string(fileSize) + " bytes", __LINE__);

            // Check for JsonRecord.ini relative to JsonMaster.ini
            fs::path jsonRecordIniPath = jsonMasterIniPath.parent_path() / "JsonRecord.ini";
            WriteToAdvancedLog("Checking for JsonRecord at: " + jsonRecordIniPath.string(), __LINE__);
            
            if (fs::exists(jsonRecordIniPath)) {
                g_jsonRecordIniPath = jsonRecordIniPath;
                auto recordFileSize = fs::file_size(jsonRecordIniPath);
                WriteToAdvancedLog("JSON RECORD INI FILE FOUND!", __LINE__);
                WriteToAdvancedLog("   Full path: " + jsonRecordIniPath.string(), __LINE__);
                WriteToAdvancedLog("   File size: " + std::to_string(recordFileSize) + " bytes", __LINE__);
            } else {
                WriteToAdvancedLog("JSON RECORD INI FILE NOT FOUND at expected location", __LINE__);
            }
        } else {
            WriteToAdvancedLog("JSON MASTER INI FILE NOT FOUND", __LINE__);
        }
        
        WriteToAdvancedLog("", __LINE__);
        WriteToAdvancedLog("SEARCHING FOR JSON SOURCE FILE...", __LINE__);
        
        const std::string jsonFileName = "OBody_presetDistributionConfig.json";
        fs::path jsonSourcePath = dllDir / jsonFileName;
        
        WriteToAdvancedLog("Checking: " + jsonSourcePath.string(), __LINE__);
        
        if (fs::exists(jsonSourcePath)) {
            g_jsonSourcePath = jsonSourcePath;
            auto fileSize = fs::file_size(jsonSourcePath);
            WriteToAdvancedLog("JSON SOURCE FILE FOUND!", __LINE__);
            WriteToAdvancedLog("   Full path: " + jsonSourcePath.string(), __LINE__);
            WriteToAdvancedLog("   File size: " + std::to_string(fileSize) + " bytes", __LINE__);
        } else {
            WriteToAdvancedLog("JSON SOURCE FILE NOT FOUND in DLL directory", __LINE__);
        }
        
        WriteToAdvancedLog("", __LINE__);
        WriteToAdvancedLog("CONFIGURING JSON DESTINATION PATH...", __LINE__);
        
        g_jsonDestDirectory = dllDir / "OBody_NG_PDA_NG_Full_Assistance" / "Assets" / "Json";
        g_jsonDestPath = g_jsonDestDirectory / jsonFileName;
        
        WriteToAdvancedLog("JSON Destination Directory: " + g_jsonDestDirectory.string(), __LINE__);
        WriteToAdvancedLog("JSON Destination File: " + g_jsonDestPath.string(), __LINE__);
        
        if (fs::exists(g_jsonDestDirectory)) {
            WriteToAdvancedLog("JSON destination directory exists", __LINE__);
        } else {
            WriteToAdvancedLog("JSON destination directory will be created when needed", __LINE__);
        }
        
        WriteToAdvancedLog("", __LINE__);
        WriteToAdvancedLog("SEARCHING FOR SOUND FILE...", __LINE__);
        
        const std::string soundFileName = "miau-PDA.wav";
        
        std::vector<fs::path> soundSearchPaths = {
            dllDir / "Obody_PDA_sound",
            dllDir.parent_path() / "sound" / "Obody_PDA_sound",
            dllDir.parent_path().parent_path() / "sound" / "Obody_PDA_sound",
            dllDir / "OBody_NG_PDA_NG_Full_Assistance" / "Assets" / "Sound"
        };
        
        for (const auto& searchPath : soundSearchPaths) {
            WriteToAdvancedLog("Checking: " + searchPath.string(), __LINE__);
            
            if (fs::exists(searchPath) && fs::is_directory(searchPath)) {
                fs::path potentialSoundPath = searchPath / soundFileName;
                
                if (fs::exists(potentialSoundPath)) {
                    result.soundFilePath = potentialSoundPath;
                    result.soundsBaseDir = searchPath;
                    result.soundFound = true;
                    
                    auto fileSize = fs::file_size(potentialSoundPath);
                    WriteToAdvancedLog("SOUND FILE FOUND!", __LINE__);
                    WriteToAdvancedLog("   Full path: " + potentialSoundPath.string(), __LINE__);
                    WriteToAdvancedLog("   File size: " + std::to_string(fileSize) + " bytes", __LINE__);
                    break;
                }
            }
        }
        
        if (!result.soundFound) {
            WriteToAdvancedLog("SOUND FILE NOT FOUND in any location", __LINE__);
        }
        
        WriteToAdvancedLog("", __LINE__);
        WriteToAdvancedLog("SEARCHING FOR STARTMCM SCRIPT...", __LINE__);
        
        const std::string scriptFileName = "startMCM.ps1";
        
        std::vector<fs::path> scriptSearchPaths = {
            dllDir / "OBody_NG_PDA_NG_Full_Assistance" / "Assets",
            dllDir / "Assets",
            dllDir.parent_path() / "OBody_NG_PDA_NG_Full_Assistance" / "Assets"
        };
        
        for (const auto& searchPath : scriptSearchPaths) {
            WriteToAdvancedLog("Checking: " + searchPath.string(), __LINE__);
            
            if (fs::exists(searchPath) && fs::is_directory(searchPath)) {
                fs::path potentialScriptPath = searchPath / scriptFileName;
                
                if (fs::exists(potentialScriptPath)) {
                    result.startMCMScriptPath = potentialScriptPath;
                    result.scriptsBaseDir = searchPath;
                    result.scriptFound = true;
                    
                    auto fileSize = fs::file_size(potentialScriptPath);
                    WriteToAdvancedLog("STARTMCM SCRIPT FOUND!", __LINE__);
                    WriteToAdvancedLog("   Full path: " + potentialScriptPath.string(), __LINE__);
                    WriteToAdvancedLog("   File size: " + std::to_string(fileSize) + " bytes", __LINE__);
                    break;
                }
            }
        }
        
        if (!result.scriptFound) {
            WriteToAdvancedLog("STARTMCM SCRIPT NOT FOUND in any location", __LINE__);
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
                
                const std::string hostIniFileName = "Act3_OBody_NG_PDA_NG.ini";
                fs::path hostIniPath = standardPluginPath / hostIniFileName;
                
                if (fs::exists(hostIniPath)) {
                    g_hostIniPath = hostIniPath;
                    WriteToAdvancedLog("HOST INI FOUND: " + hostIniPath.string(), __LINE__);
                }
                
                fs::path mcmIniPath = BuildPathCaseInsensitive(
                    fs::path(g_gamePath),
                    {"Data", "SKSE", "Plugins", "OBody_NG_PDA_NG_Full_Assistance", "Assets", "ini", "MCM.ini"}
                );
                
                if (fs::exists(mcmIniPath)) {
                    g_mcmIniPath = mcmIniPath;
                    WriteToAdvancedLog("MCM INI FOUND: " + mcmIniPath.string(), __LINE__);
                }
                
                fs::path jsonMasterIniPath = BuildPathCaseInsensitive(
                    fs::path(g_gamePath),
                    {"Data", "SKSE", "Plugins", "OBody_NG_PDA_NG_Full_Assistance", "Assets", "ini", "JsonMaster.ini"}
                );
                
                if (fs::exists(jsonMasterIniPath)) {
                    g_jsonMasterIniPath = jsonMasterIniPath;
                    WriteToAdvancedLog("JSON MASTER INI FOUND: " + jsonMasterIniPath.string(), __LINE__);
                }

                if (!g_jsonMasterIniPath.empty()) {
                    fs::path jsonRecordIniPath = g_jsonMasterIniPath.parent_path() / "JsonRecord.ini";
                    if (fs::exists(jsonRecordIniPath)) {
                        g_jsonRecordIniPath = jsonRecordIniPath;
                        WriteToAdvancedLog("JSON RECORD INI FOUND: " + jsonRecordIniPath.string(), __LINE__);
                    }
                }
                
                const std::string jsonFileName = "OBody_presetDistributionConfig.json";
                fs::path jsonSourcePath = standardPluginPath / jsonFileName;
                
                if (fs::exists(jsonSourcePath)) {
                    g_jsonSourcePath = jsonSourcePath;
                    WriteToAdvancedLog("JSON SOURCE FOUND: " + jsonSourcePath.string(), __LINE__);
                }
                
                g_jsonDestDirectory = BuildPathCaseInsensitive(
                    fs::path(g_gamePath),
                    {"Data", "SKSE", "Plugins", "OBody_NG_PDA_NG_Full_Assistance", "Assets", "Json"}
                );
                g_jsonDestPath = g_jsonDestDirectory / jsonFileName;
                WriteToAdvancedLog("JSON DEST configured: " + g_jsonDestPath.string(), __LINE__);
                
                const std::string soundFileName = "miau-PDA.wav";
                fs::path soundBasePath = BuildPathCaseInsensitive(
                    fs::path(g_gamePath),
                    {"Data", "sound", "Obody_PDA_sound"}
                );
                
                fs::path soundFilePath = soundBasePath / soundFileName;
                if (fs::exists(soundFilePath)) {
                    result.soundFilePath = soundFilePath;
                    result.soundsBaseDir = soundBasePath;
                    result.soundFound = true;
                    WriteToAdvancedLog("SOUND FOUND: " + soundFilePath.string(), __LINE__);
                }
                
                const std::string scriptFileName = "startMCM.ps1";
                fs::path scriptBasePath = BuildPathCaseInsensitive(
                    fs::path(g_gamePath),
                    {"Data", "SKSE", "Plugins", "OBody_NG_PDA_NG_Full_Assistance", "Assets"}
                );
                
                fs::path scriptFilePath = scriptBasePath / scriptFileName;
                if (fs::exists(scriptFilePath)) {
                    result.startMCMScriptPath = scriptFilePath;
                    result.scriptsBaseDir = scriptBasePath;
                    result.scriptFound = true;
                    WriteToAdvancedLog("SCRIPT FOUND: " + scriptFilePath.string(), __LINE__);
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
    WriteToAdvancedLog("  [" + std::string(result.soundFound ? "OK" : "FAIL") + "] Sound File (miau-PDA.wav)", __LINE__);
    WriteToAdvancedLog("  [" + std::string(result.scriptFound ? "OK" : "FAIL") + "] StartMCM Script", __LINE__);
    WriteToAdvancedLog("  [" + std::string(!g_hostIniPath.empty() ? "OK" : "FAIL") + "] Host INI Configuration", __LINE__);
    WriteToAdvancedLog("  [" + std::string(!g_mcmIniPath.empty() ? "OK" : "FAIL") + "] MCM INI Configuration", __LINE__);
    WriteToAdvancedLog("  [" + std::string(!g_jsonMasterIniPath.empty() ? "OK" : "FAIL") + "] JsonMaster INI Configuration", __LINE__);
    WriteToAdvancedLog("  [" + std::string(!g_jsonRecordIniPath.empty() ? "OK" : "FAIL") + "] JsonRecord INI Configuration", __LINE__);
    WriteToAdvancedLog("  [" + std::string(!g_jsonSourcePath.empty() && fs::exists(g_jsonSourcePath) ? "OK" : "FAIL") + "] JSON Source File", __LINE__);
    WriteToAdvancedLog("", __LINE__);
    
    result.success = result.dllFound && result.iniFound && result.soundFound && result.scriptFound;
    
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

// ===== INITIALIZE PLUGIN WITH JSON MASTER SUPPORT =====
void InitializePlugin() {
    try {
        g_documentsPath = GetDocumentsPath();
        
        auto paths = GetAllOBodyLogsPaths();
        if (!paths.primary.empty()) {
            std::vector<fs::path> logFolders = { paths.primary, paths.secondary };
            
            for (const auto& folder : logFolders) {
                try {
                    auto advancedLogPath = folder / "OBody_NG_Preset_Distribution_Assistant-NG_Advanced_MCM.log";
                    std::ofstream clearLog(advancedLogPath, std::ios::trunc);
                    clearLog.close();
                } catch (...) {}
            }
        }

        WriteToAdvancedLog("OBody PDA Plugin - Starting Complete Detection...", __LINE__);
        WriteToAdvancedLog("========================================", __LINE__);
        WriteToAdvancedLog("OBody PDA Plugin - v2.6.0", __LINE__);
        WriteToAdvancedLog("Started: " + GetCurrentTimeString(), __LINE__);
        WriteToAdvancedLog("========================================", __LINE__);
        
        OBodyPDAPathsResult detection = DetectAllOBodyPDAPaths();
        
        if (detection.success) {
            g_iniPath = detection.iniPath;
            g_soundsDirectory = detection.soundsBaseDir;
            g_scriptsDirectory = detection.scriptsBaseDir.parent_path();
            g_soundScriptDirectory = g_scriptsDirectory / "Sound";
            
            if (detection.detectionMethod == "DLL Directory") {
                g_usingDllPath = true;
                g_dllDirectory = detection.sksePluginsDir;
            }
            
            WriteToAdvancedLog("DETECTION SUCCESSFUL - All components found", __LINE__);
            WriteToAdvancedLog("Detection Method: " + detection.detectionMethod, __LINE__);
            WriteToAdvancedLog("DLL: " + detection.dllPath.string(), __LINE__);
            WriteToAdvancedLog("INI: " + detection.iniPath.string(), __LINE__);
            WriteToAdvancedLog("Sound: " + detection.soundFilePath.string(), __LINE__);
            WriteToAdvancedLog("Script: " + detection.startMCMScriptPath.string(), __LINE__);
            WriteToAdvancedLog("Host INI: " + g_hostIniPath.string(), __LINE__);
            WriteToAdvancedLog("MCM INI: " + g_mcmIniPath.string(), __LINE__);
            WriteToAdvancedLog("JsonMaster INI: " + g_jsonMasterIniPath.string(), __LINE__);
            WriteToAdvancedLog("JsonRecord INI: " + g_jsonRecordIniPath.string(), __LINE__);
            WriteToAdvancedLog("JSON Source: " + g_jsonSourcePath.string(), __LINE__);
            WriteToAdvancedLog("JSON Destination: " + g_jsonDestPath.string(), __LINE__);
            WriteToAdvancedLog("Sounds Directory: " + g_soundsDirectory.string(), __LINE__);
            WriteToAdvancedLog("Scripts Directory: " + g_scriptsDirectory.string(), __LINE__);
            
            LoadPDASettings();
            LoadHostSettings();
            
            ResetHostActiveAtStartup();

            bool initialJsonMasterStatus = GetJsonMasterStatus();
            if (initialJsonMasterStatus) {
                WriteToAdvancedLog("Initial JsonMaster status is true, processing JSON copy and reset", __LINE__);
                bool masterCopySuccess = CopyJsonFile();
                if (masterCopySuccess) {
                    WriteToAdvancedLog("Initial JSON copy completed successfully", __LINE__);
                    bool masterResetSuccess = SetJsonMasterStatus(false);
                    if (masterResetSuccess) {
                        WriteToAdvancedLog("Initial JsonMaster status reset to false by plugin", __LINE__);
                    } else {
                        WriteToAdvancedLog("ERROR: Failed to reset initial JsonMaster status to false", __LINE__);
                    }
                } else {
                    WriteToAdvancedLog("ERROR: Initial JSON copy failed", __LINE__);
                }
            }

            bool initialJsonRecordStatus = GetJsonRecordStatus();
            if (initialJsonRecordStatus) {
                WriteToAdvancedLog("Initial JsonRecord status is true, processing JSON record copy and reset", __LINE__);
                bool recordCopySuccess = CopyJsonRecordFile();
                if (recordCopySuccess) {
                    WriteToAdvancedLog("Initial JSON record copy completed successfully", __LINE__);
                    bool recordResetSuccess = SetJsonRecordStatus(false);
                    if (recordResetSuccess) {
                        WriteToAdvancedLog("Initial JsonRecord status reset to false by plugin", __LINE__);
                    } else {
                        WriteToAdvancedLog("ERROR: Failed to reset initial JsonRecord status to false", __LINE__);
                    }
                } else {
                    WriteToAdvancedLog("ERROR: Initial JSON record copy failed", __LINE__);
                }
            }
            
            StartIniMonitoring();
            StartMCMIniMonitoring();
            StartJsonMasterMonitoring();
            StartJsonRecordMonitoring();
            
            g_isInitialized = true;
            
        } else {
            WriteToAdvancedLog("DETECTION FAILED - Missing components:", __LINE__);
            if (!detection.dllFound) WriteToAdvancedLog("  - DLL not found", __LINE__);
            if (!detection.iniFound) WriteToAdvancedLog("  - INI not found", __LINE__);
            if (!detection.soundFound) WriteToAdvancedLog("  - Sound file not found", __LINE__);
            if (!detection.scriptFound) WriteToAdvancedLog("  - StartMCM script not found", __LINE__);
            
            g_isInitialized = true;
        }

        WriteToAdvancedLog("PLUGIN INITIALIZATION COMPLETE", __LINE__);
        WriteToAdvancedLog("========================================", __LINE__);

    } catch (const std::exception& e) {
        logger::error("CRITICAL ERROR in Initialize: {}", e.what());
        WriteToAdvancedLog("CRITICAL ERROR: " + std::string(e.what()), __LINE__);
    }
}

// ===== SHUTDOWN PLUGIN WITH JSON MASTER SUPPORT =====
void ShutdownPlugin() {
    logger::info("OBODY PDA PLUGIN SHUTTING DOWN");
    WriteToAdvancedLog("PLUGIN SHUTTING DOWN", __LINE__);

    g_isShuttingDown = true;

    StopAllSounds();
    StopIniMonitoring();
    StopMCMIniMonitoring();
    StopJsonMasterMonitoring();
    StopJsonRecordMonitoring();

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
            g_scriptsInitialized = false;
            g_activationMessageShown = false;
            g_pauseMonitoring = false;
            g_startMCMExecuted = false;

            WriteToAdvancedLog("NEW GAME: All flags reset, ready for fresh initialization", __LINE__);
            ResetHostActiveAtStartup();
            break;

        case SKSE::MessagingInterface::kPostLoadGame:
            logger::info("kPostLoadGame: Game loaded - checking systems");
            if (!g_monitoringIni.load()) {
                StartIniMonitoring();
            }
            if (!g_monitoringMCMIni.load()) {
                StartMCMIniMonitoring();
            }
            if (!g_monitoringJsonMaster.load()) {
                StartJsonMasterMonitoring();
            }
            if (!g_monitoringJsonRecord.load()) {
                StartJsonRecordMonitoring();
            }
            break;

        case SKSE::MessagingInterface::kDataLoaded:
            logger::info("kDataLoaded: Game fully loaded");

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

            logger::info("OBody PDA Plugin ready for MCM activation");
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

    logger::info("OBody PDA Plugin v2.6.0 - Starting...");
    
    auto paths = GetAllOBodyLogsPaths();
    try {
        std::ofstream clearLog(paths.primary / "OBody_NG_Preset_Distribution_Assistant-NG_Advanced_MCM.log", std::ios::trunc);
        clearLog.close();
    } catch (...) {}

    WriteToAdvancedLog("========================================", __LINE__);
    WriteToAdvancedLog("OBody PDA Plugin v2.6.0", __LINE__);
    WriteToAdvancedLog("Started: " + GetCurrentTimeString(), __LINE__);
    WriteToAdvancedLog("========================================", __LINE__);

    InitializePlugin();

    SKSE::GetPapyrusInterface()->Register(ObodyPDA_Native::RegisterPapyrusFunctions);
    
    SKSE::GetMessagingInterface()->RegisterListener(MessageListener);

    logger::info("OBody PDA Plugin loaded successfully with JSON Master System");
    return true;
}

constinit auto SKSEPlugin_Version = []() {
    SKSE::PluginVersionData v;
    v.PluginVersion({2, 6, 0});
    v.PluginName("OBody PDA Advanced MCM");
    v.AuthorName("John95AC");
    v.UsesAddressLibrary();
    v.UsesSigScanning();
    v.CompatibleVersions({SKSE::RUNTIME_SSE_LATEST, SKSE::RUNTIME_LATEST_VR});

    return v;
}();
