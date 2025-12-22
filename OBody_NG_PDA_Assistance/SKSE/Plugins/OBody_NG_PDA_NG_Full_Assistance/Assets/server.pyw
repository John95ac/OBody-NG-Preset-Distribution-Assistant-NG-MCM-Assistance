import http.server
import socketserver
import socket
import json
import configparser
from pathlib import Path
import urllib.parse
import os
import shutil
import threading
import time
import subprocess
import traceback
from datetime import datetime
import logging
import re
import hashlib
import zipfile
import mimetypes
import urllib.request
import ctypes

ASSETS_DIR = Path(__file__).resolve().parent
LOG_DIR = ASSETS_DIR / 'log'
SERVER_ERRORS_LOG = LOG_DIR / 'server_errors.log'
SKYRIM_SWITCH_LOG = LOG_DIR / 'SkyrimSwitch.log'

class ThreadedTCPServer(socketserver.ThreadingMixIn, socketserver.TCPServer):
    pass

def _get_mod_root_dir():
    try:
        current_dir = Path(__file__).resolve().parent
    except Exception:
        current_dir = Path.cwd()

    rute_ini = current_dir / 'ini' / 'Rute.ini'
    if rute_ini.exists():
        try:
            config = configparser.ConfigParser()
            config.read(rute_ini, encoding='utf-8')
            server_rute = config.get('Server_rute', 'rute', fallback='').strip()
            if server_rute:
                pyw_path = Path(server_rute).resolve()
                for parent in pyw_path.parents:
                    if parent.name.lower() == 'skse':
                        return parent.parent
        except Exception:
            pass

    root_dir = current_dir
    for _ in range(4):
        parent = root_dir.parent
        if parent == root_dir:
            break
        root_dir = parent
    return root_dir

def _show_save_ini_dialog(default_dir: Path, default_filename: str):
    try:
        import ctypes.wintypes as wintypes
    except Exception:
        return None

    class OPENFILENAMEW(ctypes.Structure):
        _fields_ = [
            ('lStructSize', wintypes.DWORD),
            ('hwndOwner', wintypes.HWND),
            ('hInstance', wintypes.HINSTANCE),
            ('lpstrFilter', wintypes.LPCWSTR),
            ('lpstrCustomFilter', wintypes.LPWSTR),
            ('nMaxCustFilter', wintypes.DWORD),
            ('nFilterIndex', wintypes.DWORD),
            ('lpstrFile', wintypes.LPWSTR),
            ('nMaxFile', wintypes.DWORD),
            ('lpstrFileTitle', wintypes.LPWSTR),
            ('nMaxFileTitle', wintypes.DWORD),
            ('lpstrInitialDir', wintypes.LPCWSTR),
            ('lpstrTitle', wintypes.LPCWSTR),
            ('Flags', wintypes.DWORD),
            ('nFileOffset', wintypes.WORD),
            ('nFileExtension', wintypes.WORD),
            ('lpstrDefExt', wintypes.LPCWSTR),
            ('lCustData', wintypes.LPARAM),
            ('lpfnHook', wintypes.LPVOID),
            ('lpTemplateName', wintypes.LPCWSTR),
            ('pvReserved', wintypes.LPVOID),
            ('dwReserved', wintypes.DWORD),
            ('FlagsEx', wintypes.DWORD),
        ]

    try:
        default_dir_str = str(default_dir.resolve())
    except Exception:
        default_dir_str = str(default_dir)

    default_filename = (default_filename or 'OBodyNG_PDA_(your_name).ini').strip()
    if not default_filename.lower().endswith('.ini'):
        default_filename += '.ini'

    # FORCE PATH: Combine dir and filename to override Windows MRU memory
    try:
        # Resolve to absolute path and ensure backslashes
        full_path = (default_dir / default_filename).resolve()
        full_path_str = str(full_path).replace('/', '\\')
    except Exception:
        full_path_str = default_filename

    max_path = 32768
    file_buffer = ctypes.create_unicode_buffer(max_path)
    file_buffer.value = full_path_str

    filter_str = 'INI files (*.ini)\0*.ini\0All files (*.*)\0*.*\0\0'

    OFN_EXPLORER = 0x00080000
    OFN_OVERWRITEPROMPT = 0x00000002
    OFN_PATHMUSTEXIST = 0x00000800
    OFN_NOCHANGEDIR = 0x00000008

    ofn = OPENFILENAMEW()
    ofn.lStructSize = ctypes.sizeof(OPENFILENAMEW)
    try:
        ofn.hwndOwner = ctypes.windll.user32.GetForegroundWindow()
    except Exception:
        ofn.hwndOwner = None
    ofn.hInstance = None
    ofn.lpstrFilter = filter_str
    ofn.lpstrCustomFilter = None
    ofn.nMaxCustFilter = 0
    ofn.nFilterIndex = 1
    ofn.lpstrFile = ctypes.cast(file_buffer, wintypes.LPWSTR)
    ofn.nMaxFile = max_path
    ofn.lpstrFileTitle = None
    ofn.nMaxFileTitle = 0
    ofn.lpstrInitialDir = default_dir_str
    ofn.lpstrTitle = 'Save OBody NG PDA Rules'
    ofn.Flags = OFN_EXPLORER | OFN_OVERWRITEPROMPT | OFN_PATHMUSTEXIST | OFN_NOCHANGEDIR
    ofn.nFileOffset = 0
    ofn.nFileExtension = 0
    ofn.lpstrDefExt = 'ini'
    ofn.lCustData = 0
    ofn.lpfnHook = None
    ofn.lpTemplateName = None
    ofn.pvReserved = None
    ofn.dwReserved = 0
    ofn.FlagsEx = 0

    try:
        ok = ctypes.windll.comdlg32.GetSaveFileNameW(ctypes.byref(ofn))
        if ok:
            selected = file_buffer.value.strip()
            if not selected:
                return None
            p = Path(selected)
            if not p.suffix:
                p = p.with_suffix('.ini')
            return p
        err = ctypes.windll.comdlg32.CommDlgExtendedError()
        if err:
            _startup_log(f'GetSaveFileNameW error: {err}')
        return None
    except Exception:
        return None

def _read_text_with_retries(path: Path, attempts: int = 25, delay_s: float = 0.1):
    for _ in range(max(1, int(attempts))):
        try:
            if path.exists():
                content = path.read_text(encoding='utf-8')
                if content.strip():
                    return content
        except Exception:
            pass
        try:
            time.sleep(float(delay_s))
        except Exception:
            pass
    return ''

def _export_temp_ini_via_save_dialog():
    temp_ini_path = Path('ini/OBodyNG_PDA_temp.ini')
    content = _read_text_with_retries(temp_ini_path)
    if not content:
        return False, 'Temp INI is missing or empty'

    default_dir = _get_mod_root_dir()
    selected_path = _show_save_ini_dialog(default_dir, 'OBodyNG_PDA_(your_name).ini')
    if selected_path is None:
        return False, 'Cancelled'

    try:
        selected_path.parent.mkdir(parents=True, exist_ok=True)
    except Exception:
        pass
    selected_path.write_text(content, encoding='utf-8')
    return True, str(selected_path)

def _show_open_ini_multiselect_dialog(default_dir: Path):
    try:
        import ctypes.wintypes as wintypes
    except Exception:
        return []

    class OPENFILENAMEW(ctypes.Structure):
        _fields_ = [
            ('lStructSize', wintypes.DWORD),
            ('hwndOwner', wintypes.HWND),
            ('hInstance', wintypes.HINSTANCE),
            ('lpstrFilter', wintypes.LPCWSTR),
            ('lpstrCustomFilter', wintypes.LPWSTR),
            ('nMaxCustFilter', wintypes.DWORD),
            ('nFilterIndex', wintypes.DWORD),
            ('lpstrFile', wintypes.LPWSTR),
            ('nMaxFile', wintypes.DWORD),
            ('lpstrFileTitle', wintypes.LPWSTR),
            ('nMaxFileTitle', wintypes.DWORD),
            ('lpstrInitialDir', wintypes.LPCWSTR),
            ('lpstrTitle', wintypes.LPCWSTR),
            ('Flags', wintypes.DWORD),
            ('nFileOffset', wintypes.WORD),
            ('nFileExtension', wintypes.WORD),
            ('lpstrDefExt', wintypes.LPCWSTR),
            ('lCustData', wintypes.LPARAM),
            ('lpfnHook', wintypes.LPVOID),
            ('lpTemplateName', wintypes.LPCWSTR),
            ('pvReserved', wintypes.LPVOID),
            ('dwReserved', wintypes.DWORD),
            ('FlagsEx', wintypes.DWORD),
        ]

    try:
        default_dir_str = str(default_dir.resolve())
    except Exception:
        default_dir_str = str(default_dir)

    max_buffer = 65536
    file_buffer = ctypes.create_unicode_buffer(max_buffer)
    file_buffer[0] = '\0'

    filter_str = 'INI files (*.ini)\0*.ini\0\0'

    OFN_EXPLORER = 0x00080000
    OFN_FILEMUSTEXIST = 0x00001000
    OFN_PATHMUSTEXIST = 0x00000800
    OFN_ALLOWMULTISELECT = 0x00000200
    OFN_NOCHANGEDIR = 0x00000008

    ofn = OPENFILENAMEW()
    ofn.lStructSize = ctypes.sizeof(OPENFILENAMEW)
    try:
        ofn.hwndOwner = ctypes.windll.user32.GetForegroundWindow()
    except Exception:
        ofn.hwndOwner = None
    ofn.hInstance = None
    ofn.lpstrFilter = filter_str
    ofn.lpstrCustomFilter = None
    ofn.nMaxCustFilter = 0
    ofn.nFilterIndex = 1
    ofn.lpstrFile = ctypes.cast(file_buffer, wintypes.LPWSTR)
    ofn.nMaxFile = max_buffer
    ofn.lpstrFileTitle = None
    ofn.nMaxFileTitle = 0
    ofn.lpstrInitialDir = default_dir_str
    # Changed title to reset Windows MRU cache for this dialog
    ofn.lpstrTitle = 'Select INI files for Mod Pack (Project)'
    ofn.Flags = OFN_EXPLORER | OFN_FILEMUSTEXIST | OFN_PATHMUSTEXIST | OFN_ALLOWMULTISELECT | OFN_NOCHANGEDIR
    ofn.nFileOffset = 0
    ofn.nFileExtension = 0
    ofn.lpstrDefExt = 'ini'
    ofn.lCustData = 0
    ofn.lpfnHook = None
    ofn.lpTemplateName = None
    ofn.pvReserved = None
    ofn.dwReserved = 0
    ofn.FlagsEx = 0

    try:
        ok = ctypes.windll.comdlg32.GetOpenFileNameW(ctypes.byref(ofn))
        if not ok:
            return []
        raw = ''.join(file_buffer)
        parts = [p for p in raw.split('\x00') if p]
        if not parts:
            return []
        if len(parts) == 1:
            return [Path(parts[0])]
        base_dir = Path(parts[0])
        return [base_dir / name for name in parts[1:]]
    except Exception:
        return []

def _show_open_ini_dialog_single(default_dir: Path):
    try:
        import ctypes.wintypes as wintypes
    except Exception:
        return None

    class OPENFILENAMEW(ctypes.Structure):
        _fields_ = [
            ('lStructSize', wintypes.DWORD),
            ('hwndOwner', wintypes.HWND),
            ('hInstance', wintypes.HINSTANCE),
            ('lpstrFilter', wintypes.LPCWSTR),
            ('lpstrCustomFilter', wintypes.LPWSTR),
            ('nMaxCustFilter', wintypes.DWORD),
            ('nFilterIndex', wintypes.DWORD),
            ('lpstrFile', wintypes.LPWSTR),
            ('nMaxFile', wintypes.DWORD),
            ('lpstrFileTitle', wintypes.LPWSTR),
            ('nMaxFileTitle', wintypes.DWORD),
            ('lpstrInitialDir', wintypes.LPCWSTR),
            ('lpstrTitle', wintypes.LPCWSTR),
            ('Flags', wintypes.DWORD),
            ('nFileOffset', wintypes.WORD),
            ('nFileExtension', wintypes.WORD),
            ('lpstrDefExt', wintypes.LPCWSTR),
            ('lCustData', wintypes.LPARAM),
            ('lpfnHook', wintypes.LPVOID),
            ('lpTemplateName', wintypes.LPCWSTR),
            ('pvReserved', wintypes.LPVOID),
            ('dwReserved', wintypes.DWORD),
            ('FlagsEx', wintypes.DWORD),
        ]

    try:
        default_dir_str = str(default_dir.resolve())
    except Exception:
        default_dir_str = str(default_dir)

    max_path = 32768
    file_buffer = ctypes.create_unicode_buffer(max_path)
    file_buffer.value = ''

    filter_str = 'INI files (*.ini)\0*.ini\0All files (*.*)\0*.*\0\0'

    OFN_EXPLORER = 0x00080000
    OFN_FILEMUSTEXIST = 0x00001000
    OFN_PATHMUSTEXIST = 0x00000800
    OFN_NOCHANGEDIR = 0x00000008

    ofn = OPENFILENAMEW()
    ofn.lStructSize = ctypes.sizeof(OPENFILENAMEW)
    try:
        ofn.hwndOwner = ctypes.windll.user32.GetForegroundWindow()
    except Exception:
        ofn.hwndOwner = None
    ofn.hInstance = None
    ofn.lpstrFilter = filter_str
    ofn.lpstrCustomFilter = None
    ofn.nMaxCustFilter = 0
    ofn.nFilterIndex = 1
    ofn.lpstrFile = ctypes.cast(file_buffer, wintypes.LPWSTR)
    ofn.nMaxFile = max_path
    ofn.lpstrFileTitle = None
    ofn.nMaxFileTitle = 0
    ofn.lpstrInitialDir = default_dir_str
    ofn.lpstrTitle = 'Open OBody NG PDA Rules'
    ofn.Flags = OFN_EXPLORER | OFN_FILEMUSTEXIST | OFN_PATHMUSTEXIST | OFN_NOCHANGEDIR
    ofn.nFileOffset = 0
    ofn.nFileExtension = 0
    ofn.lpstrDefExt = 'ini'
    ofn.lCustData = 0
    ofn.lpfnHook = None
    ofn.lpTemplateName = None
    ofn.pvReserved = None
    ofn.dwReserved = 0
    ofn.FlagsEx = 0

    try:
        ok = ctypes.windll.comdlg32.GetOpenFileNameW(ctypes.byref(ofn))
        if not ok:
            return None
        selected = file_buffer.value.strip()
        if not selected:
            return None
        return Path(selected)
    except Exception:
        return None

def _show_open_ini_dialog(default_dir: Path):
    files = _show_open_ini_multiselect_dialog(default_dir)
    if not files:
        return None
    first = files[0]
    return first if isinstance(first, Path) else None

def _show_save_zip_dialog(default_dir: Path, default_filename: str):
    try:
        import ctypes.wintypes as wintypes
    except Exception:
        return None

    class OPENFILENAMEW(ctypes.Structure):
        _fields_ = [
            ('lStructSize', wintypes.DWORD),
            ('hwndOwner', wintypes.HWND),
            ('hInstance', wintypes.HINSTANCE),
            ('lpstrFilter', wintypes.LPCWSTR),
            ('lpstrCustomFilter', wintypes.LPWSTR),
            ('nMaxCustFilter', wintypes.DWORD),
            ('nFilterIndex', wintypes.DWORD),
            ('lpstrFile', wintypes.LPWSTR),
            ('nMaxFile', wintypes.DWORD),
            ('lpstrFileTitle', wintypes.LPWSTR),
            ('nMaxFileTitle', wintypes.DWORD),
            ('lpstrInitialDir', wintypes.LPCWSTR),
            ('lpstrTitle', wintypes.LPCWSTR),
            ('Flags', wintypes.DWORD),
            ('nFileOffset', wintypes.WORD),
            ('nFileExtension', wintypes.WORD),
            ('lpstrDefExt', wintypes.LPCWSTR),
            ('lCustData', wintypes.LPARAM),
            ('lpfnHook', wintypes.LPVOID),
            ('lpTemplateName', wintypes.LPCWSTR),
            ('pvReserved', wintypes.LPVOID),
            ('dwReserved', wintypes.DWORD),
            ('FlagsEx', wintypes.DWORD),
        ]

    try:
        default_dir_str = str(default_dir.resolve())
    except Exception:
        default_dir_str = str(default_dir)

    default_filename = (default_filename or 'ModPack.zip').strip()
    if not default_filename.lower().endswith('.zip'):
        default_filename += '.zip'

    # FORCE PATH: Combine dir and filename to override Windows MRU memory
    try:
        # Resolve to absolute path and ensure backslashes
        full_path = (default_dir / default_filename).resolve()
        full_path_str = str(full_path).replace('/', '\\')
    except Exception:
        full_path_str = default_filename

    max_path = 32768
    file_buffer = ctypes.create_unicode_buffer(max_path)
    file_buffer.value = full_path_str

    filter_str = 'ZIP files (*.zip)\0*.zip\0All files (*.*)\0*.*\0\0'

    OFN_EXPLORER = 0x00080000
    OFN_OVERWRITEPROMPT = 0x00000002
    OFN_PATHMUSTEXIST = 0x00000800
    OFN_NOCHANGEDIR = 0x00000008

    ofn = OPENFILENAMEW()
    ofn.lStructSize = ctypes.sizeof(OPENFILENAMEW)
    ofn.hwndOwner = None
    ofn.hInstance = None
    ofn.lpstrFilter = filter_str
    ofn.lpstrCustomFilter = None
    ofn.nMaxCustFilter = 0
    ofn.nFilterIndex = 1
    ofn.lpstrFile = ctypes.cast(file_buffer, wintypes.LPWSTR)
    ofn.nMaxFile = max_path
    ofn.lpstrFileTitle = None
    ofn.nMaxFileTitle = 0
    ofn.lpstrInitialDir = default_dir_str
    ofn.lpstrTitle = 'Save Mod Pack'
    ofn.Flags = OFN_EXPLORER | OFN_OVERWRITEPROMPT | OFN_PATHMUSTEXIST | OFN_NOCHANGEDIR
    ofn.nFileOffset = 0
    ofn.nFileExtension = 0
    ofn.lpstrDefExt = 'zip'
    ofn.lCustData = 0
    ofn.lpfnHook = None
    ofn.lpTemplateName = None
    ofn.pvReserved = None
    ofn.dwReserved = 0
    ofn.FlagsEx = 0

    try:
        ok = ctypes.windll.comdlg32.GetSaveFileNameW(ctypes.byref(ofn))
        if ok:
            selected = file_buffer.value.strip()
            if not selected:
                return None
            p = Path(selected)
            if not p.suffix:
                p = p.with_suffix('.zip')
            return p
        return None
    except Exception:
        return None

def _export_sandbox_ini_via_save_dialog():
    sandbox_ini_path = Path('ini/OBodyNG_PDA_Sandbox_temp.ini')
    content = _read_text_with_retries(sandbox_ini_path)
    if not content:
        return False, 'Sandbox temp INI is missing or empty'

    default_dir = get_install_root_folder()
    selected_path = _show_save_ini_dialog(default_dir, 'OBodyNG_PDA_(your_name).ini')
    if selected_path is None:
        return False, 'Cancelled'

    try:
        selected_path.parent.mkdir(parents=True, exist_ok=True)
    except Exception:
        pass
    selected_path.write_text(content, encoding='utf-8')
    return True, str(selected_path)

def _startup_log(message):
    try:
        LOG_DIR.mkdir(parents=True, exist_ok=True)
        timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        with open(SERVER_ERRORS_LOG, 'a', encoding='utf-8') as f:
            f.write(f"[{timestamp}] {message}\n")
    except Exception:
        pass

def _read_json_file(path: Path):
    try:
        if not path.exists() or not path.is_file():
            return None
        with open(path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception:
        return None

def _write_json_file(path: Path, data):
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        return True
    except Exception:
        return False

def _get_windows_documents_dir():
    try:
        shell32 = ctypes.windll.shell32
        ole32 = ctypes.windll.ole32

        class GUID(ctypes.Structure):
            _fields_ = [
                ('Data1', ctypes.c_ulong),
                ('Data2', ctypes.c_ushort),
                ('Data3', ctypes.c_ushort),
                ('Data4', ctypes.c_ubyte * 8),
            ]

        def _guid_from_string(guid_string):
            g = GUID()
            ole32.IIDFromString(ctypes.c_wchar_p(guid_string), ctypes.byref(g))
            return g

        FOLDERID_Documents = _guid_from_string('{FDD39AD0-238F-46AF-ADB4-6C85480369C7}')
        p_path = ctypes.c_wchar_p()
        hr = shell32.SHGetKnownFolderPath(ctypes.byref(FOLDERID_Documents), 0, None, ctypes.byref(p_path))
        if hr != 0:
            return None
        try:
            return Path(p_path.value)
        finally:
            ole32.CoTaskMemFree(p_path)
    except Exception:
        return None

def _detect_documents_base_dir():
    home = Path.home()
    env_candidates = []
    for key in ('OneDriveConsumer', 'OneDriveCommercial', 'OneDrive'):
        val = os.environ.get(key)
        if val:
            base = Path(val)
            env_candidates.extend([base / 'Documents', base / 'Documentos'])

    known_documents = _get_windows_documents_dir()

    candidates = []
    candidates.extend(env_candidates)
    if known_documents:
        candidates.append(known_documents)
    candidates.extend([
        home / 'OneDrive' / 'Documents',
        home / 'OneDrive' / 'Documentos',
        home / 'Documents',
        home / 'Documentos',
    ])
    for p in candidates:
        try:
            if p.exists() and p.is_dir():
                return p
        except Exception:
            continue
    return home / 'Documents'

def _get_my_games_dir():
    base = _detect_documents_base_dir()
    candidates = [base / 'My Games', base / 'Mis juegos']
    for p in candidates:
        try:
            if p.exists() and p.is_dir():
                return p
        except Exception:
            continue
    try:
        candidates[0].mkdir(parents=True, exist_ok=True)
    except Exception:
        pass
    return candidates[0]

def _get_manager_mcm_dir():
    my_games = _get_my_games_dir()
    candidates = [
        my_games / 'Skyrim Special Edition' / 'Manager_MCM',
        my_games / 'Skyrim.INI' / 'Manager_MCM',
    ]
    for p in candidates:
        try:
            if p.exists() and p.is_dir():
                return p
        except Exception:
            continue
    try:
        candidates[0].mkdir(parents=True, exist_ok=True)
    except Exception:
        pass
    return candidates[0]

def _get_port_from_port_json():
    try:
        data = _read_json_file(Path('Json/port.json'))
        if not isinstance(data, dict):
            return None
        port = data.get('port')
        return int(port)
    except Exception:
        return None

def _normalize_port_do_not_use_list(value):
    if not isinstance(value, list):
        return []
    normalized = []
    seen = set()
    for item in value:
        try:
            port_int = int(item)
        except Exception:
            continue
        if port_int < 0 or port_int > 65535:
            continue
        if port_int in seen:
            continue
        seen.add(port_int)
        normalized.append(port_int)
    return normalized

def _normalize_ports_list(value):
    if not isinstance(value, list):
        return []
    normalized = []
    for item in value:
        if not isinstance(item, dict):
            continue
        port = item.get('port')
        service = item.get('service')
        reason = item.get('reason')
        port_do_not_use = _normalize_port_do_not_use_list(item.get('port do not use'))
        try:
            port_int = int(port)
        except Exception:
            continue
        if not isinstance(service, str) or not service.strip():
            continue
        if not isinstance(reason, str):
            reason = ''
        entry = {'port': port_int, 'service': service, 'reason': reason}
        if port_do_not_use:
            entry['port do not use'] = port_do_not_use
        normalized.append(entry)
    return normalized

def _get_port_master_base_data():
    base_path = Path('Json/Port_Master_base.json')
    data = _read_json_file(base_path)
    if isinstance(data, dict):
        return data
    return None

def _get_self_service_info():
    base_data = _get_port_master_base_data()
    if not isinstance(base_data, dict):
        return '', '', []
    pr = base_data.get('port_restrictions')
    if not isinstance(pr, dict):
        return '', '', []
    ports_list = _normalize_ports_list(pr.get('common_development_ports'))
    if not ports_list:
        return '', '', []
    entry = ports_list[0]
    service = entry.get('service') if isinstance(entry, dict) else ''
    reason = entry.get('reason') if isinstance(entry, dict) else ''
    if not isinstance(service, str):
        service = ''
    if not isinstance(reason, str):
        reason = ''
    port_do_not_use = _normalize_port_do_not_use_list(entry.get('port do not use') if isinstance(entry, dict) else None)
    return service, reason, port_do_not_use

def ensure_port_master_json(current_port: int):
    base_data = _get_port_master_base_data()
    manager_dir = _get_manager_mcm_dir()
    master_path = manager_dir / 'Port_Master.json'
    _startup_log("Path of free and stable port. Updated in the JSON master list.")

    if not master_path.exists():
        if base_data is not None:
            try:
                base_path = Path('Json/Port_Master_base.json')
                master_path.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(base_path, master_path)
            except Exception:
                _startup_log("PORT_MASTER copy base -> master failed")

    master_data = _read_json_file(master_path)
    if not isinstance(master_data, dict):
        if base_data is not None:
            master_data = base_data
        else:
            master_data = {'port_restrictions': {'common_development_ports': []}}

    pr = master_data.get('port_restrictions')
    if not isinstance(pr, dict):
        pr = {}
        master_data['port_restrictions'] = pr

    if base_data is not None:
        base_pr = base_data.get('port_restrictions')
        if isinstance(base_pr, dict):
            base_reserved = base_pr.get('reserved_range')
            if isinstance(base_reserved, dict):
                pr['reserved_range'] = base_reserved

    self_service, self_reason, base_self_port_do_not_use = _get_self_service_info()

    ports_list = _normalize_ports_list(pr.get('common_development_ports'))
    has_self = False
    for entry in ports_list:
        if self_service and entry.get('service') == self_service:
            entry['port'] = int(current_port)
            if self_reason:
                entry['reason'] = self_reason
            if 'port do not use' not in entry and base_self_port_do_not_use:
                entry['port do not use'] = base_self_port_do_not_use
            has_self = True
    if not has_self:
        if self_service:
            self_entry = {'port': int(current_port), 'service': self_service}
            if self_reason:
                self_entry['reason'] = self_reason
            if base_self_port_do_not_use:
                self_entry['port do not use'] = base_self_port_do_not_use
            ports_list.append(self_entry)

    pr['common_development_ports'] = ports_list
    if not _write_json_file(master_path, master_data):
        _startup_log(f"PORT_MASTER write failed: {master_path}")
    return master_data

def validate_port_against_master(port: int):
    try:
        port = int(port)
    except Exception:
        return False, 'Port must be a valid integer'
    if port < 0 or port > 65535:
        return False, 'Invalid port number (0-65535)'

    master = ensure_port_master_json(PORT)
    pr = master.get('port_restrictions') if isinstance(master, dict) else None
    if not isinstance(pr, dict):
        return True, ''

    reserved = pr.get('reserved_range')
    if isinstance(reserved, dict):
        start = reserved.get('start')
        end = reserved.get('end')
        try:
            start_i = int(start)
            end_i = int(end)
        except Exception:
            start_i = None
            end_i = None
        if start_i is not None and end_i is not None and start_i <= port <= end_i:
            return False, 'Port 0-1024 is reserved by the system. Choose a port above 1024.'

        very_used = reserved.get('Very used ports')
        if isinstance(very_used, list):
            try:
                very_used_set = {int(x) for x in very_used}
            except Exception:
                very_used_set = set()
            if port in very_used_set:
                return False, 'This port is commonly used by other services and cannot be used here.'

    ports_list = _normalize_ports_list(pr.get('common_development_ports'))
    self_service, _, _ = _get_self_service_info()
    self_do_not_use = []
    for entry in ports_list:
        if self_service and entry.get('service') == self_service:
            self_do_not_use = _normalize_port_do_not_use_list(entry.get('port do not use'))
            break
    if self_do_not_use and port in set(self_do_not_use):
        return False, 'This port is reserved or may be used by another service in the future.'

    for entry in ports_list:
        if self_service and entry.get('service') == self_service:
            continue
        if entry.get('port') == port:
            other = entry.get('service') or 'another service'
            return False, f'Port already used by: {other}'

    return True, ''

os.chdir(os.path.dirname(os.path.abspath(__file__)))

if Path('ini/PORT.ini').exists():
    try:
        config = configparser.ConfigParser()
        config.read('ini/PORT.ini')
        PORT = config.getint('PORT', 'PORT')
    except:
        PORT = 6050

        # Save to PORT.ini
        config = configparser.ConfigParser()
        config.add_section('PORT')
        config.set('PORT', 'PORT', str(PORT))
        Path('ini').mkdir(exist_ok=True)
        with open('ini/PORT.ini', 'w') as f:
            config.write(f)
else:
    PORT = 6050

    # Save to PORT.ini
    config = configparser.ConfigParser()
    config.add_section('PORT')
    config.set('PORT', 'PORT', str(PORT))
    Path('ini').mkdir(exist_ok=True)
    with open('ini/PORT.ini', 'w') as f:
        config.write(f)

# Write port config for frontend
port_config = {'port': PORT}
with open('Json/port.json', 'w') as f:
    json.dump(port_config, f)
_port_from_json = _get_port_from_port_json()
ensure_port_master_json(_port_from_json if _port_from_json is not None else PORT)
shutdown_flag = False
game_log_active = False
MAX_LOG_LINES = 1000000

# Variables globales para monitorear tiempos de start
npc_tracking_start_time = None
plugin_outfits_start_time = None
plugin_list_time = None
plugin_npcs_time = None
plugin_npcs_start_time = None
act3_start_time = None
act4_start_time = None

# Variable global para almacenar contenido del INI temporal
temp_ini_content = ""
# Variable global para trackear si hay nuevo contenido disponible
new_temp_content_available = False

# Lock para sincronizar acceso a archivos INI
plugins_ini_lock = threading.Lock()
act2_ini_lock = threading.Lock()
rule_generator_lock = threading.Lock()

def log_error(message):
    """Escribe TODOS los mensajes y errores en log/server_errors.log"""
    try:
        LOG_DIR.mkdir(parents=True, exist_ok=True)
        timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        with open(SERVER_ERRORS_LOG, 'a', encoding='utf-8') as f:
            f.write(f"[{timestamp}] {message}\n")
    except:
        pass

def load_detection_radio():
    """Lee el radio de detección del INI"""
    try:
        config = configparser.ConfigParser()
        ini_path = Path('ini/Act2_Manager.ini')
        if ini_path.exists():
            config.read(ini_path, encoding='utf-8')
            if 'NPC_tracking' in config:
                radio = config.getint('NPC_tracking', 'radio', fallback=500)
                return {'status': 'success', 'radio': radio}
        return {'status': 'success', 'radio': 500}
    except Exception as e:
        log_error(f"Error loading detection radio: {str(e)}")
        return {'status': 'error', 'message': str(e)}

def save_npc_scripts(data):
    """Guarda scripts del NPC"""
    try:
        scripts = data.get('scripts', '')
        filepath = Path('Json/npc_scripts.json')
        filepath.parent.mkdir(parents=True, exist_ok=True)
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump({'scripts': scripts}, f, indent=2, ensure_ascii=False)
        return {'status': 'success', 'message': 'Scripts saved'}
    except Exception as e:
        log_error(f"Error saving NPC scripts: {str(e)}")
        return {'status': 'error', 'message': str(e)}

def save_detection_radio(radio):
    """Guarda el radio de detección en Act2_Manager.ini"""
    try:
        config = configparser.ConfigParser()
        ini_path = Path('ini/Act2_Manager.ini')

        if ini_path.exists():
            config.read(ini_path, encoding='utf-8')

        if 'NPC_tracking' not in config:
            config.add_section('NPC_tracking')

        config.set('NPC_tracking', 'radio', str(int(radio)))

        ini_path.parent.mkdir(exist_ok=True)
        with open(ini_path, 'w', encoding='utf-8') as f:
            config.write(f)

        log_error(f"Detection radio saved: {radio}")
        return {'status': 'success', 'message': f'Detection radio saved: {radio}'}
    except Exception as e:
        log_error(f"Error saving detection radio: {str(e)}")
        return {'status': 'error', 'message': str(e)}

def clear_error_log():
    """Limpia el log de errores al iniciar el servidor"""
    try:
        if SERVER_ERRORS_LOG.exists():
            SERVER_ERRORS_LOG.unlink()
    except:
        pass

clear_error_log()

def reset_mcm_ini():
    try:
        mcm_file = Path('ini/MCM.ini')
        if mcm_file.exists():
            content = mcm_file.read_text(encoding='utf-8')
            new_content = content.replace('MCM = true', 'MCM = false')
            mcm_file.write_text(new_content, encoding='utf-8')
            log_error("MCM.ini reset to false on startup")
        else:
            Path('ini').mkdir(exist_ok=True)
            mcm_file.write_text('[active_MCM]\nMCM = false\n', encoding='utf-8')
            log_error("MCM.ini created with default value (false)")
    except Exception as e:
        log_error(f"ERROR in reset_mcm_ini: {e}")
        log_error(traceback.format_exc())

reset_mcm_ini()

def load_version_status():
    """
    Check for updates by comparing local and remote version information.
    Returns JSON with version status instead of logging.
    """
    try:
        # Read local updates.json
        updates_path = Path('Data/updates.json')
        if not updates_path.exists():
            return {
                'status': 'error',
                'current_version': '0.0.0',
                'latest_version': '0.0.0',
                'update_status': 'up_to_date',
                'message': 'Local updates.json not found'
            }

        try:
            with open(updates_path, 'r', encoding='utf-8') as f:
                local_updates = json.load(f)
        except Exception as e:
            return {
                'status': 'error',
                'current_version': '0.0.0',
                'latest_version': '0.0.0',
                'update_status': 'up_to_date',
                'message': f'Error reading local updates.json: {str(e)}'
            }

        if not local_updates or len(local_updates) == 0:
            return {
                'status': 'error',
                'current_version': '0.0.0',
                'latest_version': '0.0.0',
                'update_status': 'up_to_date',
                'message': 'No updates found in local updates.json'
            }

        # Get the latest local version (last item in array)
        latest_local = local_updates[-1]
        local_version = latest_local.get('version', '0.0.0')

        # Fetch remote updates with timeout
        remote_url = 'https://john95ac.github.io/website-documents-John95AC/NEWS_MCM/Notes%20and%20updates/PDA.json'
        remote_data = None

        try:
            # Set timeout to 10 seconds
            with urllib.request.urlopen(remote_url, timeout=10) as response:
                if response.getcode() == 200:
                    remote_data = json.loads(response.read().decode('utf-8'))
        except Exception:
            return {
                'status': 'success',
                'current_version': local_version,
                'latest_version': local_version,
                'update_status': 'up_to_date',
                'message': 'No internet connection, update check skipped.'
            }

        if not remote_data or len(remote_data) == 0:
            return {
                'status': 'error',
                'current_version': local_version,
                'latest_version': '0.0.0',
                'update_status': 'up_to_date',
                'message': 'No updates found in remote PDA.json'
            }

        # Get the latest remote version (last item in array)
        latest_remote = remote_data[-1]
        remote_version = latest_remote.get('version', '0.0.0')

        # Compare versions
        if local_version == remote_version:
            return {
                'status': 'success',
                'current_version': local_version,
                'latest_version': remote_version,
                'update_status': 'up_to_date',
                'message': f'System is up to date with version {local_version}'
            }
        else:
            return {
                'status': 'success',
                'current_version': local_version,
                'latest_version': remote_version,
                'update_status': 'update_available',
                'update_type': latest_remote.get('update_type', 'hard'),
                'message': f'New version {remote_version} available (current: {local_version})'
            }

    except Exception as e:
        return {
            'status': 'error',
            'current_version': '0.0.0',
            'latest_version': '0.0.0',
            'update_status': 'up_to_date',
            'message': f'Unexpected error: {str(e)}'
        }

def check_for_updates():
    """
    Check for updates by comparing local and remote version information.
    Uses the last version from the local updates.json array and compares with remote PDA.json
    """
    try:
        # Read local updates.json
        updates_path = Path('Data/updates.json')
        if not updates_path.exists():
            log_error("Local updates.json not found")
            return

        try:
            with open(updates_path, 'r', encoding='utf-8') as f:
                local_updates = json.load(f)
        except Exception as e:
            log_error(f"Error reading local updates.json: {str(e)}")
            return

        if not local_updates or len(local_updates) == 0:
            log_error("No updates found in local updates.json")
            return

        # Get the latest local version (last item in array)
        latest_local = local_updates[-1]
        local_version = latest_local.get('version', '0.0.0')

        # Fetch remote updates with timeout
        remote_url = 'https://john95ac.github.io/website-documents-John95AC/NEWS_MCM/Notes%20and%20updates/PDA.json'
        remote_data = None

        try:
            # Set timeout to 10 seconds
            with urllib.request.urlopen(remote_url, timeout=10) as response:
                if response.getcode() == 200:
                    remote_data = json.loads(response.read().decode('utf-8'))
        except urllib.request.URLError as e:
            log_error(f"Network error fetching remote updates: {str(e)}")
            return
        except Exception as e:
            log_error(f"Error processing remote updates: {str(e)}")
            return

        if not remote_data or len(remote_data) == 0:
            log_error("No updates found in remote PDA.json")
            return

        # Get the latest remote version (last item in array)
        latest_remote = remote_data[-1]
        remote_version = latest_remote.get('version', '0.0.0')

        # Compare versions
        if local_version == remote_version:
            log_error(f"Update check completed - System is up to date with latest version {local_version} from https://john95ac.github.io/website-documents-John95AC/NEWS_MCM/Notes%20and%20updates/PDA.json")
        else:
            log_error(f"New version available: {remote_version} (current: {local_version}) from https://john95ac.github.io/website-documents-John95AC/NEWS_MCM/Notes%20and%20updates/PDA.json")

    except Exception as e:
        log_error(f"Unexpected error in check_for_updates: {str(e)}")
        log_error(traceback.format_exc())

def _get_windows_known_folder_path(folder_guid: str):
    try:
        import ctypes
        import uuid
        from ctypes import wintypes

        class GUID(ctypes.Structure):
            _fields_ = [
                ("Data1", wintypes.DWORD),
                ("Data2", wintypes.WORD),
                ("Data3", wintypes.WORD),
                ("Data4", wintypes.BYTE * 8),
            ]

        u = uuid.UUID(folder_guid)
        guid = GUID(
            u.time_low,
            u.time_mid,
            u.time_hi_version,
            (wintypes.BYTE * 8).from_buffer_copy(u.bytes[8:]),
        )

        p_path = ctypes.c_wchar_p()
        shell32 = ctypes.windll.shell32
        shell32.SHGetKnownFolderPath.argtypes = [
            ctypes.POINTER(GUID),
            wintypes.DWORD,
            wintypes.HANDLE,
            ctypes.POINTER(ctypes.c_wchar_p),
        ]
        shell32.SHGetKnownFolderPath.restype = wintypes.HRESULT
        ole32 = ctypes.windll.ole32
        ole32.CoTaskMemFree.argtypes = [wintypes.LPVOID]

        hr = shell32.SHGetKnownFolderPath(ctypes.byref(guid), 0, None, ctypes.byref(p_path))
        if hr != 0 or not p_path.value:
            return None
        path = Path(p_path.value)
        ole32.CoTaskMemFree(p_path)
        return path
    except Exception:
        return None


def get_skyrim_documents_path():
    def _score_my_games_root(root: Path) -> int:
        try:
            score = 0
            if (root / "Skyrim Special Edition" / "SKSE").exists():
                score += 3
            if (root / "Skyrim.INI" / "SKSE").exists():
                score += 3
            if (root / "Skyrim Special Edition").exists():
                score += 1
            if (root / "Skyrim.INI").exists():
                score += 1
            return score
        except Exception:
            return 0
    
    def _find_candidate_roots(docs_path: Path, max_depth: int = 3):
        try:
            if not docs_path.exists() or not docs_path.is_dir():
                return []
        except Exception:
            return []

        candidates = []
        seen = set()
        queue = [(docs_path, 0)]

        while queue:
            cur, depth = queue.pop(0)
            try:
                key = str(cur.resolve()).lower()
            except Exception:
                key = str(cur).lower()
            if key in seen:
                continue
            seen.add(key)

            try:
                if (cur / "Skyrim Special Edition").exists() or (cur / "Skyrim.INI").exists():
                    candidates.append(cur)
            except Exception:
                pass

            if depth >= max_depth:
                continue

            try:
                for child in cur.iterdir():
                    try:
                        if child.is_dir():
                            queue.append((child, depth + 1))
                    except Exception:
                        continue
            except Exception:
                continue

        return candidates

    documents_candidates = []

    docs = _get_windows_known_folder_path("FDD39AD0-238F-46AF-ADB4-6C85480369C7")
    if docs:
        documents_candidates.append(docs)

    try:
        documents_candidates.append(Path.home() / "Documents")
    except Exception:
        pass
    try:
        documents_candidates.append(Path.home() / "Documentos")
    except Exception:
        pass

    for var in ("OneDrive", "OneDriveConsumer", "OneDriveCommercial"):
        try:
            base = os.environ.get(var)
            if base:
                documents_candidates.append(Path(base) / "Documents")
                documents_candidates.append(Path(base) / "Documentos")
        except Exception:
            pass

    seen = set()
    normalized_candidates = []
    for p in documents_candidates:
        try:
            key = str(p.resolve()).lower()
        except Exception:
            key = str(p).lower()
        if key in seen:
            continue
        seen.add(key)
        normalized_candidates.append(p)

    best_root = None
    best_score = -1
    for docs_path in normalized_candidates:
        try:
            if not docs_path.exists() or not docs_path.is_dir():
                continue

            for candidate in _find_candidate_roots(docs_path, max_depth=3):
                score = _score_my_games_root(candidate)
                if score > best_score:
                    best_score = score
                    best_root = candidate
        except Exception:
            continue

    if best_root:
        log_error(f"Detected Skyrim documents root: {best_root}")
        return best_root

    log_error("WARNING: Skyrim documents root not detected (My Games).")
    return None


def ensure_rute_ini_structure():
    rute_file = Path("ini/Rute.ini")
    existing = configparser.ConfigParser()

    if rute_file.exists():
        try:
            existing.read(rute_file, encoding="utf-8")
        except configparser.ParsingError as e:
            log_error(f"ERROR: Rute.ini parsing error, recreating: {e}")
            existing = configparser.ConfigParser()

    skyrim_docs_root = get_skyrim_documents_path()
    if skyrim_docs_root:
        first_option = skyrim_docs_root / "Skyrim Special Edition" / "SKSE"
        second_option = skyrim_docs_root / "Skyrim.INI" / "SKSE"
        if not first_option.exists():
            log_error(f"WARNING: SKSE log path not found: {first_option}")
        if not second_option.exists():
            log_error(f"WARNING: SKSE log path not found: {second_option}")
    else:
        first_option = Path(existing.get("SKSE_logs", "first_option", fallback="") or "")
        second_option = Path(existing.get("SKSE_logs", "second_option", fallback="") or "")

    config = configparser.ConfigParser()

    if "SKSE_logs" not in config:
        config.add_section("SKSE_logs")
    config.set("SKSE_logs", "first_option", str(first_option) if str(first_option) != "." else "")
    config.set("SKSE_logs", "second_option", str(second_option) if str(second_option) != "." else "")

    if "Logs" not in config:
        config.add_section("Logs")

    fixed_logs = [
        ("log1", "OBody.log"),
        ("log2", "OBody_NG_Preset_Distribution_Assistant-NG.log"),
        ("log3", "OBody_NG_Preset_Distribution_Assistant-NG_Advanced_MCM.log"),
        ("log4", "OBody_NG_Preset_Distribution_Assistant-NG_Analysis_INIs.log"),
        ("log5", "OBody_NG_Preset_Distribution_Assistant-NG_Doctor.log"),
        ("log6", "OBody_NG_Preset_Distribution_Assistant-NG_List-Helper.log"),
        ("log7", "OBody_NG_Preset_Distribution_Assistant-NG_Smart_Cleaning.log"),
    ]
    for key, filename in fixed_logs:
        config.set("Logs", key, filename)

    if "Server_rute" not in config:
        config.add_section("Server_rute")
    config.set("Server_rute", "rute", os.path.abspath(__file__))

    for section in existing.sections():
        if section in ("SKSE_logs", "Logs", "Server_rute"):
            continue
        if section not in config:
            config.add_section(section)
        for k, v in existing.items(section):
            config.set(section, k, v)

    rute_file.parent.mkdir(exist_ok=True)
    with open(rute_file, "w", encoding="utf-8") as f:
        config.write(f)

def get_install_root_folder():
    try:
        current_dir = Path(__file__).resolve().parent
    except Exception:
        current_dir = Path.cwd()

    rute_ini = current_dir / 'ini' / 'Rute.ini'
    if rute_ini.exists():
        try:
            config = configparser.ConfigParser()
            config.read(rute_ini, encoding='utf-8')
            server_rute = config.get('Server_rute', 'rute', fallback='').strip()
            if server_rute:
                pyw_path = Path(server_rute).resolve()
                for parent in pyw_path.parents:
                    if parent.name.lower() == 'skse':
                        return parent.parent
        except Exception:
            pass

    try:
        p = current_dir.resolve()
        for parent in p.parents:
            if parent.name.lower() == 'skse':
                return parent.parent
        parents = list(p.parents)
        if len(parents) >= 5:
            return parents[4]
        return p.parent
    except Exception:
        return current_dir

def sync_ruleini_files(src_root: Path, dst_dir: Path):
    allowed_exts = {'.ini', '.zip', '.rar'}

    def _list_dir_files(base_dir: Path):
        files = {}
        if not base_dir.exists() or not base_dir.is_dir():
            return files
        for p in base_dir.iterdir():
            try:
                if not p.is_file():
                    continue
                name_lower = p.name.lower()
                if name_lower == 'meta.ini':
                    continue
                if p.suffix.lower() not in allowed_exts:
                    continue
                st = p.stat()
                files[name_lower] = {
                    'path': p,
                    'name': p.name,
                    'mtime': st.st_mtime,
                    'size': st.st_size,
                }
            except Exception:
                continue
        return files

    created = 0
    updated = 0
    deleted = 0

    dst_dir.mkdir(parents=True, exist_ok=True)
    src_files = _list_dir_files(src_root)
    dst_files = _list_dir_files(dst_dir)

    for key, info in list(dst_files.items()):
        if key in src_files:
            continue
        try:
            info['path'].unlink()
            deleted += 1
        except Exception:
            pass

    for key, src in src_files.items():
        dst = dst_files.get(key)
        dst_path = dst['path'] if dst else (dst_dir / src['name'])
        if not dst_path.exists():
            try:
                shutil.copy2(src['path'], dst_path)
                created += 1
            except Exception:
                pass
            continue

        try:
            dst_st = dst_path.stat()
            dst_mtime = dst_st.st_mtime
            dst_size = dst_st.st_size
        except Exception:
            dst_mtime = 0
            dst_size = -1

        if src['mtime'] > dst_mtime or src['size'] != dst_size:
            try:
                shutil.copy2(src['path'], dst_path)
                updated += 1
            except Exception:
                pass

    return created, updated, deleted

def create_backup_folders():
    """Crea carpetas de backup copiando ini/, Json/, log/, xml/ a la ruta SKSE/../Manager_MCM/PDA"""
    try:
        log_error("=== STARTING BACKUP PROCESS ===")
        config = configparser.ConfigParser()
        rute_file = Path('ini/Rute.ini')
        if not rute_file.exists():
            log_error("Rute.ini not found, cannot create backup")
            return
        config.read(rute_file, encoding='utf-8')
        skse_path = None
        if 'SKSE_logs' in config:
            for key, value in config['SKSE_logs'].items():
                if Path(value).exists():
                    skse_path = value
                    log_error(f"Using SKSE path: {skse_path}")
                    break
        if not skse_path:
            log_error("No valid SKSE path found in Rute.ini")
            return
        # Construir ruta destino: [SKSE_path]\..\Manager_MCM\PDA
        skse_parent = Path(skse_path).parent
        manager_mcm_path = skse_parent / 'Manager_MCM'
        pda_path = manager_mcm_path / 'PDA'
        pda_path.mkdir(parents=True, exist_ok=True)
        log_error(f"Backup destination: {pda_path}")
        # Carpetas a copiar
        folders_to_copy = ['ini', 'Json', 'log', 'xml']
        for folder in folders_to_copy:
            src = Path(folder)
            dst = pda_path / folder
            if src.exists():
                log_error(f"Copying {folder} to {dst}")
                if folder.lower() == 'json':
                    def _ignore_master_json(_dir, names):
                        return {n for n in names if str(n).lower() == 'obody_presetdistributionconfig.json'}
                    shutil.copytree(src, dst, dirs_exist_ok=True, ignore=_ignore_master_json)
                    master_in_backup = dst / 'OBody_presetDistributionConfig.json'
                    if master_in_backup.exists() and master_in_backup.is_file():
                        try:
                            master_in_backup.unlink()
                        except Exception:
                            pass
                else:
                    shutil.copytree(src, dst, dirs_exist_ok=True)
            else:
                log_error(f"Source folder {folder} does not exist, skipping")

        try:
            src_root = get_install_root_folder()
            dst_ruleini = pda_path / 'RuleINI'
            created, updated, deleted = sync_ruleini_files(src_root, dst_ruleini)
            log_error(f"RuleINI sync: created={created}, updated={updated}, deleted={deleted} src={src_root} dst={dst_ruleini}")
        except Exception as e:
            log_error(f"ERROR syncing RuleINI in create_backup_folders: {str(e)}")
            log_error(traceback.format_exc())

        # Copiar archivo ConfigMCM_Backups_John95AC.txt condicionalmente
        config_file_src = Path('Data/ConfigMCM_Backups_John95AC.txt')
        config_file_dst = manager_mcm_path / 'ConfigMCM_Backups_John95AC.txt'
        log_error(f"ConfigMCM_Backups_John95AC.txt source path: {config_file_src.absolute()}")
        log_error(f"ConfigMCM_Backups_John95AC.txt destination path: {config_file_dst.absolute()}")
        if config_file_src.exists():
            log_error(f"Source file exists, size: {config_file_src.stat().st_size} bytes")
            if not config_file_dst.exists():
                log_error(f"Copying ConfigMCM_Backups_John95AC.txt to {config_file_dst}")
                shutil.copy2(config_file_src, config_file_dst)
                log_error("ConfigMCM_Backups_John95AC.txt copied successfully")
            else:
                log_error("ConfigMCM_Backups_John95AC.txt already exists in Manager_MCM, skipping copy")
        else:
            log_error("Source ConfigMCM_Backups_John95AC.txt does not exist, skipping")

        log_error("=== BACKUP PROCESS COMPLETED ===")
    except Exception as e:
        log_error(f"ERROR in create_backup_folders: {str(e)}")
        log_error(traceback.format_exc())

def restore_from_manager_mcm_if_requested():
    try:
        state_file = Path('Data/01_Update_Restoration.ini')
        if not state_file.exists():
            return

        state = configparser.ConfigParser()
        state.read(state_file, encoding='utf-8')
        restoration_value = ''
        if 'State' in state and 'Restoration' in state['State']:
            restoration_value = str(state['State'].get('Restoration', '')).strip().lower()

        if restoration_value not in ('true', '1', 'yes', 'on'):
            return

        log_error("=== UPDATE RESTORATION REQUESTED (Data/01_Update_Restoration.ini) ===")

        rute_config = configparser.ConfigParser()
        rute_file = Path('ini/Rute.ini')
        skse_path = None
        if rute_file.exists():
            try:
                rute_config.read(rute_file, encoding='utf-8')
            except Exception:
                pass

        if 'SKSE_logs' in rute_config:
            for _, value in rute_config['SKSE_logs'].items():
                if Path(value).exists():
                    skse_path = value
                    break

        if not skse_path:
            detected_path = get_skyrim_documents_path()
            if detected_path:
                candidates = [
                    detected_path / 'Skyrim Special Edition' / 'SKSE',
                    detected_path / 'Skyrim.INI' / 'SKSE',
                ]
                for candidate in candidates:
                    if candidate.exists():
                        skse_path = str(candidate)
                        break

        if not skse_path:
            log_error("Restoration requested but no valid SKSE path found; skipping restoration")
            return

        skse_parent = Path(skse_path).parent
        backup_root = skse_parent / 'Manager_MCM' / 'PDA'
        if not backup_root.exists():
            log_error(f"Restoration requested but backup folder does not exist: {backup_root}")
            return

        folders = ['ini', 'Json', 'log', 'xml']
        total_overwritten = 0
        total_created = 0

        for folder in folders:
            backup_dir = backup_root / folder
            work_dir = Path(folder)
            if not backup_dir.exists():
                log_error(f"Restoration source folder missing, skipping: {backup_dir}")
                continue

            work_dir.mkdir(parents=True, exist_ok=True)

            overwritten = 0
            created = 0
            for src_file in backup_dir.rglob('*'):
                try:
                    if not src_file.is_file():
                        continue
                    relative_path = src_file.relative_to(backup_dir)
                    relative_key = str(relative_path).replace('\\', '/').lower()
                    if folder.lower() == 'json' and relative_key == 'obody_presetdistributionconfig.json':
                        continue
                    dst_file = work_dir / relative_path
                    dst_file.parent.mkdir(parents=True, exist_ok=True)
                    existed = dst_file.exists()
                    shutil.copy2(src_file, dst_file)
                    if existed:
                        overwritten += 1
                    else:
                        created += 1
                except Exception:
                    continue

            total_overwritten += overwritten
            total_created += created
            log_error(f"Restoration folder '{folder}': overwritten={overwritten}, created={created}")

        state.set('State', 'Restoration', 'false')
        state_file.parent.mkdir(exist_ok=True)
        with open(state_file, 'w', encoding='utf-8') as f:
            state.write(f)

        log_error(f"=== UPDATE RESTORATION COMPLETED: overwritten={total_overwritten}, created={total_created} ===")
    except Exception as e:
        log_error(f"ERROR in restore_from_manager_mcm_if_requested: {str(e)}")
        log_error(traceback.format_exc())

# Maintain ini/Rute.ini structure at startup
try:
    log_error("=== MAINTAINING RUTE.INI (SKSE_logs / Logs / Server_rute) ===")
    ensure_rute_ini_structure()
    log_error("Rute.ini updated successfully")
except Exception as e:
    log_error(f"ERROR maintaining Rute.ini: {e}")
    log_error(traceback.format_exc())
    log_error("Server will continue without updating Rute.ini")

restore_from_manager_mcm_if_requested()
create_backup_folders()

def count_log_lines(file_path):
    try:
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
            return sum(1 for _ in f)
    except Exception as e:
        log_error(f"ERROR counting lines: {e}")
        return 0

def check_game_log():
    global shutdown_flag, game_log_active
    
    try:
        log_error("=== DEAD MAN SWITCH THREAD STARTED ===")
        log_file = SKYRIM_SWITCH_LOG
        log_error(f"Looking for: {log_file.absolute()}")
        
        # FASE 1: Esperar indefinidamente hasta que el log EXISTA
        while not shutdown_flag:
            if not log_file.exists():
                time.sleep(5)
                continue
            else:
                log_error("File exists - Starting monitoring")
                break
        
        # FASE 2: Monitorear indefinidamente hasta detectar ACTIVIDAD
        log_error("Waiting for log activity...")
        last_modified = 0
        
        while not shutdown_flag:
            try:
                current_modified = log_file.stat().st_mtime
                
                if last_modified == 0:
                    last_modified = current_modified
                    time.sleep(5)
                    continue
                
                if current_modified != last_modified:
                    log_error(f"ACTIVITY DETECTED! File modified at {datetime.fromtimestamp(current_modified)}")
                    break
                else:
                    time.sleep(5)
                    
            except Exception as e:
                log_error(f"ERROR checking for activity: {e}")
                time.sleep(5)
        
        # FASE 3: Dead Man Switch ACTIVADO - monitoreo activo
        log_error("*** DEAD MAN SWITCH ACTIVATED ***")
        game_log_active = True
        last_modified = log_file.stat().st_mtime
        last_update_time = time.time()
        last_line_count = count_log_lines(log_file)
        log_error(f"Active monitoring started - {last_line_count} lines")
        
        while not shutdown_flag:
            time.sleep(1)
            
            try:
                current_modified = log_file.stat().st_mtime
                current_lines = count_log_lines(log_file)
                
                if current_lines > MAX_LOG_LINES:
                    log_error(f"CRITICAL: Log exceeded {MAX_LOG_LINES} lines ({current_lines})")
                    log_error("SHUTTING DOWN SERVER")
                    shutdown_flag = True
                    os._exit(0)
                
                if current_lines - last_line_count > 10000:
                    log_error(f"CRITICAL: Abnormal growth {current_lines - last_line_count} lines/sec")
                    log_error("SHUTTING DOWN SERVER")
                    shutdown_flag = True
                    os._exit(0)
                
                if current_modified != last_modified:
                    last_modified = current_modified
                    last_update_time = time.time()
                    last_line_count = current_lines
                    # log_error("SKYRIM IS ACTIVE")  # Removido para reducir logs excesivos
                else:
                    elapsed = time.time() - last_update_time

                    if elapsed > 6:
                        log_error("SKYRIM HAS CLOSED - WAITING 3 SECONDS BEFORE SHUTTING DOWN SERVER")
                        time.sleep(3)
                        log_error("SHUTTING DOWN SERVER NOW")
                        shutdown_flag = True
                        os._exit(0)
                        
            except Exception as e:
                log_error(f"ERROR in monitoring loop: {e}")
                log_error(traceback.format_exc())
                time.sleep(1)
                
    except Exception as e:
        log_error(f"FATAL ERROR in check_game_log: {e}")
        log_error(traceback.format_exc())

def check_shutdown():
    global shutdown_flag
    try:
        while not shutdown_flag:
            time.sleep(3)
            off_file = Path('ini/off.ini')
            if off_file.exists():
                content = off_file.read_text(encoding='utf-8').strip().lower()
                if content == 'off':
                    shutdown_flag = True
                    log_error("Shutdown via off.ini")
                    os._exit(0)
    except Exception as e:
        log_error(f"ERROR in check_shutdown: {e}")
        log_error(traceback.format_exc())

def check_enable_save():
    last_state = False
    try:
        while not shutdown_flag:
            time.sleep(0.5)
            ini_file = Path('ini/configuracion.ini')
            if ini_file.exists():
                try:
                    content = ini_file.read_text(encoding='utf-8')
                    lines = content.splitlines()
                    current_state = False

                    for line in lines:
                        if 'EnableSave' in line and '=' in line:
                            value = line.split('=')[1].strip().lower()
                            if value == 'true':
                                current_state = True
                                break

                    if current_state and not last_state:
                        try:
                            content = ini_file.read_text(encoding='utf-8')
                            new_content = content.replace('EnableSave = true', 'EnableSave = false')
                            if new_content != content:
                                ini_file.write_text(new_content, encoding='utf-8')
                        except Exception:
                            pass
                        try:
                            ok, info = _export_temp_ini_via_save_dialog()
                            if ok:
                                log_error(f"Rules exported: {info}")
                            else:
                                log_error(f"Rules export skipped: {info}")
                        except Exception as e:
                            log_error(f"ERROR exporting rules: {e}")
                        last_state = False
                    else:
                        last_state = current_state

                except Exception as e:
                    log_error(f"ERROR in check_enable_save loop: {e}")
                    log_error(traceback.format_exc())
                    last_state = False
    except Exception as e:
        log_error(f"FATAL ERROR in check_enable_save: {e}")
        log_error(traceback.format_exc())


def monitor_rule_generator():
    global temp_ini_content, new_temp_content_available
    log_error("Rule generator monitor started")
    while not shutdown_flag:
        try:
            time.sleep(1)  # Check every second instead of 2
            ini_path = Path('tools/Rule_Generator_open.ini')
            if ini_path.exists():
                with rule_generator_lock:
                    with open(ini_path, 'r', encoding='utf-8') as f:
                        content = f.read()

                    # Check if contains 'start = true'
                    if 'start = true' in content.lower():
                        log_error("Detected start = true in Rule_Generator_open.ini, waiting 1 second then resetting to false")

                        # Wait 1 second as requested
                        time.sleep(1)

                        # Load content from OBodyNG_PDA_temp.ini
                        temp_ini_path = Path('ini/OBodyNG_PDA_temp.ini')
                        if temp_ini_path.exists():
                            temp_ini_content = temp_ini_path.read_text(encoding='utf-8')
                            new_temp_content_available = True  # Mark as new content available
                            log_error("Loaded content from OBodyNG_PDA_temp.ini")
                        else:
                            log_error("OBodyNG_PDA_temp.ini not found")
                            temp_ini_content = ""

                        # Reset start to false
                        new_content = re.sub(r'start\s*=\s*true', 'start = false', content, flags=re.IGNORECASE)

                        with open(ini_path, 'w', encoding='utf-8') as f:
                            f.write(new_content)
                        log_error("Rule_Generator_open.ini start reset to false")
        except Exception as e:
            log_error(f"Error in monitor_rule_generator: {str(e)}")
            time.sleep(1)  # Wait on error

def monitor_temp_ini_changes():
    global temp_ini_content, new_temp_content_available
    log_error("Temp INI changes monitor started")
    temp_ini_path = Path('ini/OBodyNG_PDA_temp.ini')
    last_hash = ""
    while not shutdown_flag:
        try:
            time.sleep(1)  # Check every second
            if temp_ini_path.exists():
                content = temp_ini_path.read_text(encoding='utf-8')
                current_hash = hashlib.md5(content.encode('utf-8')).hexdigest()
                if last_hash != "" and current_hash != last_hash:
                    log_error("Detected changes in OBodyNG_PDA_temp.ini, updating content")
                    temp_ini_content = content
                    new_temp_content_available = True
                last_hash = current_hash
            else:
                last_hash = ""
        except Exception as e:
            log_error(f"Error in monitor_temp_ini_changes: {str(e)}")
            time.sleep(1)  # Wait on error

def set_plugin_list_true():
    """Establece Plugin_list = true en Act2_Manager.ini y programa el reset automático"""
    try:
        log_error("=== SET_PLUGIN_LIST_TRUE STARTED ===")
        ini_file = Path('ini/Act2_Manager.ini')
        log_error(f"Looking for INI file: {ini_file.absolute()}")

        with act2_ini_lock:
            lines = []
            found = False
            section_start = None
            if ini_file.exists():
                with open(ini_file, 'r', encoding='utf-8') as f:
                    for line in f:
                        line_lower = line.lower().strip()
                        if line_lower == '[plugin_outfits]':
                            section_start = len(lines)
                        if 'plugin_list =' in line_lower and 'plugin_listnpcs' not in line_lower:
                            lines.append('Plugin_list = true\n')
                            found = True
                        else:
                            lines.append(line)
            if not found:
                if section_start is not None:
                    insert_pos = len(lines)
                    for j in range(section_start, len(lines)):
                        if lines[j].strip().lower().startswith('['):
                            insert_pos = j
                            break
                    lines.insert(insert_pos, 'Plugin_list = true\n')
                else:
                    lines.append('[Plugin_Outfits]\nPlugin_list = true\n')
            ini_file.parent.mkdir(exist_ok=True)
            with open(ini_file, 'w', encoding='utf-8') as f:
                f.writelines(lines)
        log_error("Setting Plugin_Outfits Plugin_list to true")
    
        # Gestionar temporizador de auto-reset
        global plugin_list_time
        plugin_list_time = time.time()

        log_error("Act2_Manager.ini updated")

        log_error("Sending success response...")
        # This will be called from the handler, so no direct response here

    except Exception as e:
        log_error(f"ERROR in set_plugin_list_true: {str(e)}")
        log_error(traceback.format_exc())
        # Error handling will be in the handler

def monitor_start_timers():
    """Monitorea los valores de start en [NPC_tracking], [Plugin_Outfits] y [Plugin_NPCs] y los resetea a false después de 8 segundos"""
    global npc_tracking_start_time, plugin_outfits_start_time, plugin_list_time, plugin_npcs_time, plugin_npcs_start_time, act3_start_time, act4_start_time
    while not shutdown_flag:
        time.sleep(1)
        try:
            config = configparser.ConfigParser()
            ini_path = Path('ini/Act2_Manager.ini')
            if ini_path.exists():
                config.read(ini_path, encoding='utf-8')

                # Verificar NPC_tracking
                if 'NPC_tracking' in config:
                    current = config.get('NPC_tracking', 'start', fallback='false')
                    if current == 'true' and npc_tracking_start_time is not None:
                        if time.time() - npc_tracking_start_time > 8:
                            config.set('NPC_tracking', 'start', 'false')
                            with open(ini_path, 'w', encoding='utf-8') as f:
                                config.write(f)
                            log_error("NPC_tracking start auto-reset to false after 8 seconds")
                            npc_tracking_start_time = None
                    elif current == 'false':
                        npc_tracking_start_time = None

                # Verificar Plugin_Outfits start
                if 'Plugin_Outfits' in config:
                    current = config.get('Plugin_Outfits', 'start', fallback='false')
                    if current == 'true' and plugin_outfits_start_time is not None:
                        if time.time() - plugin_outfits_start_time > 8:
                            config.set('Plugin_Outfits', 'start', 'false')
                            with open(ini_path, 'w', encoding='utf-8') as f:
                                config.write(f)
                            log_error("Plugin_Outfits start auto-reset to false after 8 seconds")
                            plugin_outfits_start_time = None
                    elif current == 'false':
                        plugin_outfits_start_time = None

                # Verificar Plugin_Outfits Plugin_list
                if plugin_list_time is not None:
                    if time.time() - plugin_list_time > 8:
                        with act2_ini_lock:
                            lines = []
                            found = False
                            section_start = None
                            if ini_path.exists():
                                with open(ini_path, 'r', encoding='utf-8') as f:
                                    for line in f:
                                        line_lower = line.lower().strip()
                                        if line_lower == '[plugin_outfits]':
                                            section_start = len(lines)
                                        if 'plugin_list =' in line_lower and 'plugin_listnpcs' not in line_lower:
                                            lines.append('Plugin_list = false\n')
                                            found = True
                                        else:
                                            lines.append(line)
                            if not found:
                                if section_start is not None:
                                    insert_pos = len(lines)
                                    for j in range(section_start, len(lines)):
                                        if lines[j].strip().lower().startswith('['):
                                            insert_pos = j
                                            break
                                    lines.insert(insert_pos, 'Plugin_list = false\n')
                                else:
                                    lines.append('[Plugin_Outfits]\nPlugin_list = false\n')
                            ini_path.parent.mkdir(exist_ok=True)
                            with open(ini_path, 'w', encoding='utf-8') as f:
                                f.writelines(lines)
                            log_error("Plugin_Outfits Plugin_list auto-reset to false after 8 seconds")
                        plugin_list_time = None
                    else:
                        # Chequear si ya es false
                        with act2_ini_lock:
                            is_true = False
                            if ini_path.exists():
                                with open(ini_path, 'r', encoding='utf-8') as f:
                                    for line in f:
                                        if line.lower().strip().startswith('plugin_list = true') and 'plugin_listnpcs' not in line.lower().strip():
                                            is_true = True
                                            break
                            if not is_true:
                                plugin_list_time = None

                # Verificar Plugin_NPCs Plugin_listNPCs
                if plugin_npcs_time is not None:
                    if time.time() - plugin_npcs_time > 8:
                        with act2_ini_lock:
                            lines = []
                            found = False
                            section_start = None
                            if ini_path.exists():
                                with open(ini_path, 'r', encoding='utf-8') as f:
                                    for line in f:
                                        line_lower = line.lower().strip()
                                        if line_lower == '[plugin_npcs]':
                                            section_start = len(lines)
                                        if 'plugin_listnpcs' in line_lower:
                                            lines.append('Plugin_listNPCs = false\n')
                                            found = True
                                        else:
                                            lines.append(line)
                            if not found:
                                if section_start is not None:
                                    insert_pos = len(lines)
                                    for j in range(section_start, len(lines)):
                                        if lines[j].strip().lower().startswith('['):
                                            insert_pos = j
                                            break
                                    lines.insert(insert_pos, 'Plugin_listNPCs = false\n')
                                else:
                                    lines.append('[Plugin_NPCs]\nPlugin_listNPCs = false\n')
                            ini_path.parent.mkdir(exist_ok=True)
                            with open(ini_path, 'w', encoding='utf-8') as f:
                                f.writelines(lines)
                            log_error("Plugin_NPCs Plugin_listNPCs auto-reset to false after 8 seconds")
                        plugin_npcs_time = None
                    else:
                        # Chequear si ya es false
                        with act2_ini_lock:
                            is_true = False
                            if ini_path.exists():
                                with open(ini_path, 'r', encoding='utf-8') as f:
                                    for line in f:
                                        if 'plugin_listnpcs' in line.lower().strip() and 'true' in line.lower().strip():
                                            is_true = True
                                            break
                            if not is_true:
                                plugin_npcs_time = None

                # Verificar Plugin_NPCs startNPCs
                if plugin_npcs_start_time is not None:
                    if time.time() - plugin_npcs_start_time > 8:
                        with act2_ini_lock:
                            lines = []
                            found = False
                            section_start = None
                            if ini_path.exists():
                                with open(ini_path, 'r', encoding='utf-8') as f:
                                    for line in f:
                                        line_lower = line.lower().strip()
                                        if line_lower == '[plugin_npcs]':
                                            section_start = len(lines)
                                        if 'startnpcs' in line_lower:
                                            lines.append('startNPCs = false\n')
                                            found = True
                                        else:
                                            lines.append(line)
                            if not found:
                                if section_start is not None:
                                    insert_pos = len(lines)
                                    for j in range(section_start, len(lines)):
                                        if lines[j].strip().lower().startswith('['):
                                            insert_pos = j
                                            break
                                    lines.insert(insert_pos, 'startNPCs = false\n')
                                else:
                                    lines.append('[Plugin_NPCs]\nstartNPCs = false\n')
                            ini_path.parent.mkdir(exist_ok=True)
                            with open(ini_path, 'w', encoding='utf-8') as f:
                                f.writelines(lines)
                            log_error("Plugin_NPCs startNPCs auto-reset to false after 8 segundos")
                        plugin_npcs_start_time = None
                    else:
                        with act2_ini_lock:
                            is_true = False
                            if ini_path.exists():
                                with open(ini_path, 'r', encoding='utf-8') as f:
                                    for line in f:
                                        if 'startnpcs' in line.lower().strip() and 'true' in line.lower().strip():
                                            is_true = True
                                            break
                            if not is_true:
                                plugin_npcs_start_time = None

                json_master_ini = Path('ini/JsonMaster.ini')
                if json_master_ini.exists():
                    config_json_master = configparser.ConfigParser()
                    config_json_master.read(json_master_ini, encoding='utf-8')
                    if 'Act3_Json' in config_json_master:
                        current_act3 = config_json_master.get('Act3_Json', 'startAct3', fallback='false')
                        if current_act3.lower() == 'true' and act3_start_time is not None:
                            if time.time() - act3_start_time > 5:
                                config_json_master.set('Act3_Json', 'startAct3', 'false')
                                with open(json_master_ini, 'w', encoding='utf-8') as f:
                                    config_json_master.write(f)
                                log_error("JsonMaster Act3_Json startAct3 auto-reset to false after 5 seconds")
                                act3_start_time = None
                        elif current_act3.lower() == 'false':
                            act3_start_time = None

                json_record_ini = Path('ini/JsonRecord.ini')
                if json_record_ini.exists():
                    config_json_record = configparser.ConfigParser()
                    config_json_record.read(json_record_ini, encoding='utf-8')
                    if 'Act4_Json' in config_json_record:
                        current_act4 = config_json_record.get('Act4_Json', 'startact4', fallback='false')
                        if current_act4.lower() == 'true' and act4_start_time is not None:
                            if time.time() - act4_start_time > 8:
                                config_json_record.set('Act4_Json', 'startact4', 'false')
                                with open(json_record_ini, 'w', encoding='utf-8') as f:
                                    config_json_record.write(f)
                                log_error("JsonRecord Act4_Json startact4 auto-reset to false after 8 seconds - possible Skyrim is not running")
                                act4_start_time = None
                        elif current_act4.lower() == 'false':
                            act4_start_time = None

        except Exception as e:
            log_error(f"Error in monitor_start_timers: {e}")

def sync_plugins_ini_json():
    """Sincroniza Act2_Plugins.ini con Act2_Plugins.json cada 2 segundos"""
    while not shutdown_flag:
        time.sleep(2)
        try:
            # Leer JSON
            json_path = Path('Json/Act2_Plugins.json')
            plugins_from_json = set()
            if json_path.exists():
                with open(json_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                plugins_from_json = {plugin['plugin_name'] for plugin in data.get('plugins', [])}

            with plugins_ini_lock:
                # Leer INI
                ini_path = Path('ini/Act2_Plugins.ini')
                current_plugins = {}
                if ini_path.exists():
                    with open(ini_path, 'r', encoding='utf-8') as f:
                        for line in f:
                            line = line.strip()
                            if '=' in line:
                                plugin_name, value = line.split('=', 1)
                                plugin_name = plugin_name.strip().lstrip('!')
                                plugin_name = plugin_name.replace('\n', '').replace('\r', '').replace('\0', '').strip()
                                value = value.strip()
                                current_plugins[plugin_name] = value

                # Sincronizar
                updated = False
                # Agregar nuevos plugins con false por defecto
                for plugin in plugins_from_json:
                    if plugin not in current_plugins:
                        current_plugins[plugin] = 'false'
                        updated = True

                # Remover plugins que ya no están en JSON
                to_remove = [p for p in current_plugins if p not in plugins_from_json]
                for p in to_remove:
                    del current_plugins[p]
                    updated = True

                # Escribir INI si hubo cambios
                if updated:
                    ini_path.parent.mkdir(exist_ok=True)
                    with open(ini_path, 'w', encoding='utf-8') as f:
                        for plugin, value in sorted(current_plugins.items()):
                            plugin_clean = plugin.replace('\n', '').replace('\r', '').replace('\0', '').strip()
                            f.write(f"{plugin_clean} = {value}\n")
                    # log_error("Act2_Plugins.ini synchronized with Act2_Plugins.json")  # Removido para reducir logs excesivos

        except Exception as e:
            log_error(f"Error in sync_plugins_ini_json: {str(e)}")

def sync_npcs_ini_json():
    """Sincroniza Act2_NPCs.ini con Act2_NPCs.json cada 2 segundos"""
    while not shutdown_flag:
        time.sleep(2)
        try:
            # Leer JSON
            json_path = Path('Json/Act2_NPCs.json')
            plugins_from_json = set()
            if json_path.exists():
                with open(json_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                plugins_from_json = {plugin['plugin_name'] for plugin in data.get('plugins', [])}

            with plugins_ini_lock:
                # Leer INI
                ini_path = Path('ini/Act2_NPCs.ini')
                current_plugins = {}
                if ini_path.exists():
                    with open(ini_path, 'r', encoding='utf-8') as f:
                        for line in f:
                            line = line.strip()
                            if '=' in line:
                                plugin_name, value = line.split('=', 1)
                                plugin_name = plugin_name.strip().lstrip('!')
                                plugin_name = plugin_name.replace('\n', '').replace('\r', '').replace('\0', '').strip()
                                value = value.strip()
                                current_plugins[plugin_name] = value

                # Sincronizar
                updated = False
                # Agregar nuevos plugins con false por defecto
                for plugin in plugins_from_json:
                    if plugin not in current_plugins:
                        current_plugins[plugin] = 'false'
                        updated = True

                # Remover plugins que ya no están en JSON
                to_remove = [p for p in current_plugins if p not in plugins_from_json]
                for p in to_remove:
                    del current_plugins[p]
                    updated = True

                # Escribir INI si hubo cambios
                if updated:
                    ini_path.parent.mkdir(exist_ok=True)
                    with open(ini_path, 'w', encoding='utf-8') as f:
                        for plugin, value in sorted(current_plugins.items()):
                            plugin_clean = plugin.replace('\n', '').replace('\r', '').replace('\0', '').strip()
                            f.write(f"{plugin_clean} = {value}\n")
                    # log_error("Act2_NPCs.ini synchronized with Act2_NPCs.json")  # Removido para reducir logs excesivos

        except Exception as e:
            log_error(f"Error in sync_npcs_ini_json: {str(e)}")

def sync_backup_folders():
    r"""Sincroniza bidireccionalmente las carpetas ini/, Json/, log/, xml/ con el directorio de backup Manager_MCM\PDA"""
    def _list_files_by_relative_path(base_dir: Path):
        files = {}
        if not base_dir.exists():
            return files
        for file_path in base_dir.rglob('*'):
            try:
                if not file_path.is_file():
                    continue
                relative_path = file_path.relative_to(base_dir)
                relative_key = str(relative_path).replace('\\', '/').lower()
                files[relative_key] = {'path': file_path, 'mtime': file_path.stat().st_mtime}
            except Exception:
                continue
        return files

    def _safe_unlink(path: Path):
        try:
            if path.exists() and path.is_file():
                path.unlink()
                return True
        except Exception:
            return False
        return False

    def _safe_copy(src: Path, dst: Path):
        try:
            dst.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(src, dst)
            return True
        except Exception:
            return False

    global backup_sync_state
    if 'backup_sync_state' not in globals():
        backup_sync_state = {}

    install_root = get_install_root_folder()

    while not shutdown_flag:
        time.sleep(5)  # Verificar cada 5 segundos
        try:
            # Determinar ruta de backup
            config = configparser.ConfigParser()
            rute_file = Path('ini/Rute.ini')
            if not rute_file.exists():
                log_error("Rute.ini not found, cannot sync backup")
                time.sleep(60)
                continue
            config.read(rute_file, encoding='utf-8')
            skse_path = None
            if 'SKSE_logs' in config:
                for key, value in config['SKSE_logs'].items():
                    if Path(value).exists():
                        skse_path = value
                        break
            if not skse_path:
                log_error("No valid SKSE path found in Rute.ini")
                time.sleep(60)
                continue
            skse_parent = Path(skse_path).parent
            backup_path = skse_parent / 'Manager_MCM' / 'PDA'
            backup_path.mkdir(parents=True, exist_ok=True)
            folders = ['ini', 'Json', 'log', 'xml']
            for folder in folders:
                src_dir = Path(folder)
                dst_dir = backup_path / folder
                dst_dir.mkdir(exist_ok=True)
                if not src_dir.exists():
                    log_error(f"Source folder {folder} does not exist, skipping sync")
                    continue

                src_files = _list_files_by_relative_path(src_dir)
                dst_files = _list_files_by_relative_path(dst_dir)

                if folder.lower() == 'json':
                    master_key = 'obody_presetdistributionconfig.json'
                    if master_key in dst_files:
                        _safe_unlink(dst_files[master_key]['path'])
                        dst_files.pop(master_key, None)
                    src_files.pop(master_key, None)

                state_key = folder.lower()
                previous = backup_sync_state.get(state_key)

                if previous is None:
                    for rel in (set(dst_files.keys()) - set(src_files.keys())):
                        dst_info = dst_files.get(rel)
                        if dst_info:
                            _safe_unlink(dst_info['path'])

                    for rel, src_info in src_files.items():
                        rel_path = Path(rel.replace('/', os.sep))
                        dst_info = dst_files.get(rel)
                        if not dst_info:
                            _safe_copy(src_info['path'], dst_dir / rel_path)
                            continue
                        if src_info['mtime'] > dst_info['mtime']:
                            _safe_copy(src_info['path'], dst_dir / rel_path)

                    updated_src = _list_files_by_relative_path(src_dir)
                    updated_dst = _list_files_by_relative_path(dst_dir)
                    if folder.lower() == 'json':
                        updated_src.pop('obody_presetdistributionconfig.json', None)
                        updated_dst.pop('obody_presetdistributionconfig.json', None)
                    backup_sync_state[state_key] = {
                        'src': {k: v['mtime'] for k, v in updated_src.items()},
                        'dst': {k: v['mtime'] for k, v in updated_dst.items()},
                    }
                    continue

                prev_src = set(previous.get('src', {}).keys())
                prev_dst = set(previous.get('dst', {}).keys())
                curr_src = set(src_files.keys())
                curr_dst = set(dst_files.keys())

                deleted_from_src = prev_src - curr_src
                deleted_from_dst = prev_dst - curr_dst

                for rel in deleted_from_src:
                    dst_info = dst_files.get(rel)
                    if dst_info:
                        if _safe_unlink(dst_info['path']):
                            dst_files.pop(rel, None)

                for rel in deleted_from_dst:
                    src_info = src_files.get(rel)
                    if src_info:
                        if _safe_unlink(src_info['path']):
                            src_files.pop(rel, None)

                created_in_src = curr_src - prev_src
                created_in_dst = curr_dst - prev_dst

                for rel in created_in_src:
                    if rel not in dst_files:
                        src_info = src_files.get(rel)
                        if src_info:
                            rel_path = Path(rel.replace('/', os.sep))
                            _safe_copy(src_info['path'], dst_dir / rel_path)

                for rel in created_in_dst:
                    if rel not in src_files:
                        dst_info = dst_files.get(rel)
                        if dst_info:
                            rel_path = Path(rel.replace('/', os.sep))
                            _safe_copy(dst_info['path'], src_dir / rel_path)

                shared = set(src_files.keys()) & set(dst_files.keys())
                for rel in shared:
                    src_info = src_files.get(rel)
                    dst_info = dst_files.get(rel)
                    if not src_info or not dst_info:
                        continue
                    src_mtime = src_info['mtime']
                    dst_mtime = dst_info['mtime']
                    if src_mtime > dst_mtime:
                        rel_path = Path(rel.replace('/', os.sep))
                        _safe_copy(src_info['path'], dst_dir / rel_path)
                    elif dst_mtime > src_mtime:
                        rel_path = Path(rel.replace('/', os.sep))
                        _safe_copy(dst_info['path'], src_dir / rel_path)

                updated_src = _list_files_by_relative_path(src_dir)
                updated_dst = _list_files_by_relative_path(dst_dir)
                if folder.lower() == 'json':
                    updated_src.pop('obody_presetdistributionconfig.json', None)
                    updated_dst.pop('obody_presetdistributionconfig.json', None)
                backup_sync_state[state_key] = {
                    'src': {k: v['mtime'] for k, v in updated_src.items()},
                    'dst': {k: v['mtime'] for k, v in updated_dst.items()},
                }

            try:
                ruleini_dir = backup_path / 'RuleINI'
                created, updated, deleted = sync_ruleini_files(install_root, ruleini_dir)
                if created or updated or deleted:
                    log_error(f"RuleINI sync: created={created}, updated={updated}, deleted={deleted} src={install_root} dst={ruleini_dir}")
            except Exception as e:
                log_error(f"Error syncing RuleINI: {str(e)}")
        except Exception as e:
            log_error(f"Error in sync_backup_folders: {str(e)}")
            time.sleep(10)

class ModManagerHandler(http.server.SimpleHTTPRequestHandler):
    
    def send_json_response(self, data):
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps(data).encode('utf-8'))

    def log_message(self, format, *args):
        pass

    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

    def do_GET(self):
        full_path = self.path
        parsed_url = urllib.parse.urlparse(full_path)
        self.path = parsed_url.path
        if self.path == '/':
            self.path = '/index.html'

        if self.path == '/load-json':
            self.load_json()
        elif self.path == '/load-web-config':
            self.load_web_config()
        elif self.path == '/load-sandbox-xml':
            self.load_sandbox_xml()
        elif self.path == '/load-ini':
            self.load_ini()
        elif self.path == '/ini-hash':
            self.get_ini_hash()
        elif self.path == '/load-rute-ini':
            self.load_rute_ini()
        elif self.path == '/load-favoritos':
            self.load_favoritos()
        elif self.path == '/load-favoritos-xml':
            self.load_favoritos_xml()
        elif self.path == '/load-favoritos-npcs':
            self.load_favoritos_npcs()
        elif self.path == '/load-favoritos-outfits':
            self.load_favoritos_outfits()
        elif self.path == '/load-memori-f':
            self.load_memori_f()
        elif self.path == '/load-master-json':
            self.load_master_json()
        elif self.path == '/list-backups':
            self.list_master_json_backups()
        elif self.path == '/load-analysis-log':
            self.load_analysis_log()
        elif self.path == '/load-act2-json':
            self.load_act2_json()
        elif self.path == '/load-outfits-json':
            self.load_outfits_json()
        elif self.path == '/load-detection-radio':
            response = load_detection_radio()
            self.send_json_response(response)
        elif self.path == '/game-status':
            global game_log_active
            game_status = 'on' if game_log_active else 'off'
            response = {'status': 'success', 'game_status': game_status}
            self.send_json_response(response)
        elif self.path == '/check-dead-man-switch':
            self.handle_check_dead_man_switch()
        elif self.path == '/load-plugins-json':
            self.load_plugins_json()
        elif self.path == '/load-plugins-ini':
            self.load_plugins_ini()
        elif self.path == '/load-npcs-json':
            self.load_npcs_json()
        elif self.path == '/load-npcs-ini':
            self.load_npcs_ini()
        elif self.path == '/load-pda-plugins-json':
            self.load_pda_plugins_json()
        elif self.path == '/load-styles-headers':
            self.load_styles_headers()
        elif self.path == '/load-npcs-list-json':
            self.load_npcs_list_json()
        elif self.path == '/load-additional-config':
            self.load_additional_config()
        elif self.path == '/load-future-content':
            self.load_future_content()
        elif self.path == '/check-act3-status':
            self.check_act3_status()
        elif self.path == '/check-act4-status':
            self.check_act4_status()
        elif self.path == '/load-port-restart':
            self.load_port_restart()
        elif self.path == '/port-master':
            self.load_port_master()
        elif self.path == '/load-temp-ini':
            self.load_temp_ini()
        elif self.path == '/check-new-temp-content':
            self.check_new_temp_content()
        elif self.path == '/load-sandbox-ini':
            self.load_sandbox_ini()
        elif self.path == '/load-version-status':
            response = load_version_status()
            self.send_json_response(response)
        elif self.path == '/test-connection':
            self.send_json_response({"status": "ok", "port": PORT})
        elif self.path == '/load-license-python':
            try:
                with open('LICENSE python embeddable.txt', 'r', encoding='utf-8') as f:
                    content = f.read()
                self.send_json_response({'status': 'success', 'content': content})
            except Exception as e:
                log_error(f"Error loading license python: {str(e)}")
                self.send_json_response({'status': 'error', 'message': str(e)})
        elif self.path == '/load-license-frozen':
            try:
                with open('LICENSE frozen_application_license.txt', 'r', encoding='utf-8') as f:
                    content = f.read()
                self.send_json_response({'status': 'success', 'content': content})
            except Exception as e:
                log_error(f"Error loading license frozen: {str(e)}")
                self.send_json_response({'status': 'error', 'message': str(e)})
        elif self.path == '/load-license-mit':
            try:
                with open('LICENSE John95AC MIT.txt', 'r', encoding='utf-8') as f:
                    content = f.read()
                self.send_json_response({'status': 'success', 'content': content})
            except Exception as e:
                log_error(f"Error loading license mit: {str(e)}")
                self.send_json_response({'status': 'error', 'message': str(e)})
        elif self.path == '/api/licenses/python':
            try:
                with open('LICENSE python embeddable.txt', 'r', encoding='utf-8') as f:
                    content = f.read()
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"content": content}).encode('utf-8'))
            except FileNotFoundError:
                self.send_response(404)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"error": "File not found"}).encode('utf-8'))
            except Exception as e:
                log_error(f"Error loading license python: {str(e)}")
                self.send_response(500)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e)}).encode('utf-8'))
        elif self.path == '/api/licenses/frozen':
            try:
                with open('LICENSE frozen_application_license.txt', 'r', encoding='utf-8') as f:
                    content = f.read()
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"content": content}).encode('utf-8'))
            except FileNotFoundError:
                self.send_response(404)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"error": "File not found"}).encode('utf-8'))
            except Exception as e:
                log_error(f"Error loading license frozen: {str(e)}")
                self.send_response(500)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e)}).encode('utf-8'))
        elif self.path == '/api/licenses/john95ac':
            try:
                with open('LICENSE John95AC MIT.txt', 'r', encoding='utf-8') as f:
                    content = f.read()
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"content": content}).encode('utf-8'))
            except FileNotFoundError:
                self.send_response(404)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"error": "File not found"}).encode('utf-8'))
            except Exception as e:
                log_error(f"Error loading license john95ac: {str(e)}")
                self.send_response(500)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e)}).encode('utf-8'))
        elif self.path == '/save-plugin' and parsed_url.query:
            self.path = full_path
            self.save_plugin_get()
        elif self.path == '/save-npc-plugin' and parsed_url.query:
            self.path = full_path
            self.save_npc_plugin_get()
        elif self.path.startswith('/load-log/'):
            self.load_log()
        elif self.path == '/get-port':
            log_error("Get port requested")
            self.send_json_response({'port': PORT})
        elif self.path == '/load-license-python':
            try:
                with open('LICENSE python embeddable.txt', 'r', encoding='utf-8') as f:
                    content = f.read()
                self.send_json_response({'status': 'success', 'content': content})
            except Exception as e:
                log_error(f"Error loading license python: {str(e)}")
                self.send_json_response({'status': 'error', 'message': str(e)})
        elif self.path == '/load-license-frozen':
            try:
                with open('LICENSE frozen_application_license.txt', 'r', encoding='utf-8') as f:
                    content = f.read()
                self.send_json_response({'status': 'success', 'content': content})
            except Exception as e:
                log_error(f"Error loading license frozen: {str(e)}")
                self.send_json_response({'status': 'error', 'message': str(e)})
        elif self.path == '/load-license-mit':
            try:
                with open('LICENSE John95AC MIT.txt', 'r', encoding='utf-8') as f:
                    content = f.read()
                self.send_json_response({'status': 'success', 'content': content})
            except Exception as e:
                log_error(f"Error loading license mit: {str(e)}")
                self.send_json_response({'status': 'error', 'message': str(e)})
        elif self.path == '/load-generated-rules':
            self.load_generated_rules()
        elif self.path.startswith('/Assets/'):
            file_path = os.path.normpath(urllib.parse.unquote(self.path[1:]))
            if '..' in file_path or not file_path.startswith('Assets'):
                self.send_response(403)
                self.end_headers()
                return
            if os.path.exists(file_path):
                mime_type, _ = mimetypes.guess_type(file_path)
                if mime_type is None:
                    mime_type = 'application/octet-stream'
                self.send_response(200)
                self.send_header('Content-type', mime_type)
                self.end_headers()
                with open(file_path, 'rb') as f:
                    self.wfile.write(f.read())
            else:
                self.send_response(404)
                self.end_headers()
            return
        else:
            if self.path.endswith('.css'):
                self.send_response(200)
                self.send_header('Content-type', 'text/css')
                self.end_headers()
                try:
                    with open(self.path[1:], 'rb') as f:
                        self.wfile.write(f.read())
                except:
                    pass
                return
            elif self.path.endswith('.js'):
                self.send_response(200)
                self.send_header('Content-type', 'application/javascript')
                self.end_headers()
                try:
                    with open(self.path[1:], 'rb') as f:
                        self.wfile.write(f.read())
                except:
                    pass
                return
            elif self.path.endswith('.json'):
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                try:
                    with open(self.path[1:], 'rb') as f:
                        self.wfile.write(f.read())
                except:
                    pass
                return
            elif self.path.endswith('.html'):
                self.send_response(200)
                self.send_header('Content-type', 'text/html')
                self.end_headers()
                try:
                    with open(self.path[1:], 'rb') as f:
                        self.wfile.write(f.read())
                except:
                    pass
                return
            elif self.path.endswith('.ico'):
                self.send_response(200)
                self.send_header('Content-type', 'image/x-icon')
                self.end_headers()
                try:
                    with open(self.path[1:], 'rb') as f:
                        self.wfile.write(f.read())
                except:
                    pass
                return
            else:
                file_path = os.path.normpath(urllib.parse.unquote(self.path[1:]))
                if '..' in file_path:
                    self.send_response(403)
                    self.end_headers()
                    return
                if os.path.exists(file_path):
                    mime_type, _ = mimetypes.guess_type(file_path)
                    if mime_type is None:
                        mime_type = 'application/octet-stream'
                    self.send_response(200)
                    self.send_header('Content-type', mime_type)
                    self.end_headers()
                    with open(file_path, 'rb') as f:
                        self.wfile.write(f.read())
                else:
                    self.send_response(404)
                    self.end_headers()
                return

    def do_POST(self):
        self.path = urllib.parse.urlparse(self.path).path
        if self.path == '/save-npc-scripts':
            content_length = int(self.headers.get('Content-Length', 0))
            try:
                body = self.rfile.read(content_length)
            except (ConnectionError, OSError) as e:
                if '10053' in str(e) or 'connection reset' in str(e).lower():
                    log_error(f"Connection reset in {self.path}: {str(e)}")
                    self.send_response(200)
                    self.end_headers()
                    return
                else:
                    raise
            data = json.loads(body.decode('utf-8'))
            result = save_npc_scripts(data)
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps(result).encode('utf-8'))
            return
        elif self.path == '/shutdown':
            self.shutdown_server()
            return
        elif self.path == '/upload-ini':
            self.upload_ini()
            return
        elif self.path == '/open-ini-dialog':
            self.open_ini_dialog()
            return
        
        if self.path == '/execute-save-dialog':
            self.execute_save_dialog()
            return
        
        content_length = int(self.headers.get('Content-Length', 0))
        if self.path == '/save-styles-headers' and content_length == 0:
            self.send_json_response({'status': 'success'}); return
        try:
            post_data = self.rfile.read(content_length)
        except (ConnectionError, OSError) as e:
            if '10053' in str(e) or 'connection reset' in str(e).lower():
                log_error(f"Connection reset in {self.path}: {str(e)}")
                self.send_response(200)
                self.end_headers()
                return
            else:
                raise
        
        if content_length > 0:
            data = json.loads(post_data.decode('utf-8'))
        else:
            data = {}

        if self.path == '/save-json':
            self.save_json(data)
        elif self.path == '/save-master-json':
            self.save_master_json(data)
        elif self.path == '/create-backup':
            self.create_master_json_backup()
        elif self.path == '/load-backup':
            self.load_master_json_backup(data)
        elif self.path == '/restore-backup':
            self.restore_master_json_backup(data)
        elif self.path == '/save-web-config':
            self.save_web_config(data)
        elif self.path == '/save-ini':
            self.save_ini(data)
        elif self.path == '/save-generated-rules':
            self.save_generated_rules(data)
        elif self.path == '/export-generated-rules':
            self.export_generated_rules()
        elif self.path == '/save-sandbox-xml':
            self.save_sandbox_xml(data)
        elif self.path == '/restore-sandbox-xml':
            self.restore_sandbox_xml()
        elif self.path == '/load-example-doctor-log':
            self.load_example_doctor_log()
        elif self.path == '/load-example-smart-cleaning-log':
            self.load_example_smart_cleaning_log()
        elif self.path == '/toggle-enable-save':
            self.toggle_enable_save(data)
        elif self.path == '/save-favoritos':
            self.save_favoritos(data)
        elif self.path == '/save-favoritos-xml':
            self.save_favoritos_xml(data)
        elif self.path == '/save-favoritos-npcs':
            self.save_favoritos_npcs(data)
        elif self.path == '/save-favoritos-outfits':
            self.save_favoritos_outfits(data)
        elif self.path == '/save-memori-f':
            self.save_memori_f(data)
        elif self.path == '/toggle-act2-start':
            self.toggle_act2_start()
        elif self.path == '/toggle-plugin-outfits-start':
            self.toggle_plugin_outfits_start()
        elif self.path == '/toggle-act3-start':
            self.toggle_act3_start()
        elif self.path == '/toggle-act4-start':
            self.toggle_act4_start()
        elif self.path == '/activate-npc-tracking':
            self.activate_npc_tracking()
        elif self.path == '/accumulate-faction-names':
            self.accumulate_faction_names()
        elif self.path == '/save-detection-radio':
            response = save_detection_radio(data.get('radio', 500))
            self.send_json_response(response)
        elif self.path == '/create-shortcuts':
            self.create_shortcuts()
        elif self.path == '/launch-offline-mode':
            self.launch_offline_mode()
        elif self.path == '/save-plugin-selector':
            self.save_plugin_selector(data)
        elif self.path == '/save-npc-plugin-selector':
            self.save_npc_plugin_selector(data)
        elif self.path == '/save-styles-headers':
            self.save_styles_headers()
        elif self.path == '/set-plugin-list-true':
            self.set_plugin_list_true_handler()
        elif self.path == '/set-npc-list-true':
            self.set_npc_list_true_handler()
        elif self.path == '/toggle-npc-plugins-start':
            self.toggle_npc_plugins_start()
        elif self.path == '/save-additional-config':
            response = self.save_additional_config(data)
            self.send_json_response(response)
        elif self.path == '/save-future-content':
            response = self.save_future_content(data)
            self.send_json_response(response)
        elif self.path == '/save-port':
            self.save_port_restart(data)
            return
        elif self.path == '/log-json-event':
            self.log_json_event(data)
        elif self.path == '/save-port-restart':
            self.save_port_restart(data)
            return
        elif self.path == '/restart-server':
            response = self.restart_server()
            self.send_json_response(response)
        elif self.path == '/run-folder-script':
            self.run_folder_script()
        elif self.path == '/open-manager-mcm-folder':
            self.open_manager_mcm_folder()
        elif self.path == '/run-open-script':
            self.run_open_script()
        elif self.path == '/run-sandbox-export-script':
            self.run_sandbox_export_script()
        elif self.path == '/run-sandbox-open-script':
            self.run_sandbox_open_script()
        elif self.path == '/run-mod-pack-script':
            self.run_mod_pack_script()
        elif self.path == '/save-sandbox-ini':
            self.save_sandbox_ini(data)
            return

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def execute_save_dialog(self):
        try:
            ok, info = _export_temp_ini_via_save_dialog()
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({
                'status': 'success' if ok else 'cancelled',
                'message': info
            }).encode('utf-8'))
            
        except Exception as e:
            log_error(f"ERROR executing save dialog: {e}")
            self.send_response(500)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({
                'status': 'error',
                'message': str(e)
            }).encode('utf-8'))

    def open_ini_dialog(self):
        global temp_ini_content, new_temp_content_available
        try:
            default_dir = _get_mod_root_dir()
            selected_path = _show_open_ini_dialog_single(default_dir)
            if selected_path is None:
                self.send_json_response({'status': 'cancelled', 'message': 'Cancelled'})
                return

            try:
                raw = selected_path.read_bytes()
                ini_content = raw.decode('utf-8-sig', errors='ignore')
            except Exception:
                ini_content = selected_path.read_text(encoding='utf-8', errors='ignore')

            ini_content = ini_content.replace('\r\n', '\n')

            temp_ini_path = Path('ini/OBodyNG_PDA_temp.ini')
            temp_ini_path.parent.mkdir(exist_ok=True)
            temp_ini_path.write_text(ini_content, encoding='utf-8')

            temp_ini_content = ini_content
            new_temp_content_available = True

            self.send_json_response({'status': 'success', 'message': str(selected_path)})
        except Exception as e:
            log_error(f"ERROR opening INI dialog: {e}")
            self.send_json_response({'status': 'error', 'message': str(e)})

    def shutdown_server(self):
        global shutdown_flag
        shutdown_flag = True
        try:
            mcm_file = Path('ini/MCM.ini')
            if mcm_file.exists():
                content = mcm_file.read_text(encoding='utf-8')
                new_content = content.replace('MCM = false', 'MCM = true')
                mcm_file.write_text(new_content, encoding='utf-8')
                log_error("MCM.ini set to true before shutdown")
        except Exception as e:
            log_error(f"ERROR setting MCM.ini: {e}")
        
        Path('ini').mkdir(exist_ok=True)
        Path('ini/off.ini').write_text('off', encoding='utf-8')
        
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps({'status': 'success'}).encode('utf-8'))

        try:
            server = getattr(self, 'server', None)
            if server:
                threading.Thread(target=server.shutdown, daemon=True).start()
        except Exception as e:
            log_error(f"ERROR requesting server shutdown: {e}")

    def load_json(self):
        json_file = Path('Json/config.json')
        content = json_file.read_text(encoding='utf-8') if json_file.exists() else ""
        
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps({'status': 'success', 'content': content}).encode('utf-8'))

    def save_web_config(self, data):
        Path('Json').mkdir(exist_ok=True)
        config = data.get('config', {})
        if 'visibleTabs' not in config:
            config['visibleTabs'] = {}
        config['visibleTabs']['tab-news'] = True
        Path('Json/config_web.json').write_text(json.dumps(config, indent=4), encoding='utf-8')

        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps({'status': 'success'}).encode('utf-8'))

    def save_json(self, data):
        Path('Json').mkdir(exist_ok=True)
        Path('Json/config.json').write_text(data.get('content', ''), encoding='utf-8')

        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps({'status': 'success'}).encode('utf-8'))

    def save_master_json(self, data):
        try:
            Path('Json').mkdir(exist_ok=True)
            raw_content = data.get('content', '{}')
            try:
                parsed = json.loads(raw_content)
            except json.JSONDecodeError:
                self.send_response(400)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'status': 'error', 'message': 'Invalid JSON content'}).encode('utf-8'))
                return

            json_file = Path('Json/OBody_presetDistributionConfig.json')
            json_file.write_text(json.dumps(parsed, indent=4, ensure_ascii=False), encoding='utf-8')

            try:
                log_action = data.get('logAction')
                if log_action == 'delete_element':
                    section = data.get('logSection', '')
                    element = data.get('logElement', '')
                    deleted_key = data.get('logDeletedKey', None)
                    deleted_value = data.get('logDeletedValue', None)

                    base_parts = ["[JSON DELETE]"]
                    if section:
                        base_parts.append(f"section={section}")
                    if element:
                        base_parts.append(f"element={element}")
                    if deleted_key is not None:
                        base_parts.append(f"key={deleted_key}")
                    log_error(" ".join(base_parts))

                    if deleted_value is not None:
                        try:
                            if isinstance(deleted_value, list):
                                log_error("Deleted value:")
                                for item in deleted_value:
                                    log_error(f"    {json.dumps(item, ensure_ascii=False)}")
                            else:
                                try:
                                    value_str = json.dumps(deleted_value, indent=4, ensure_ascii=False)
                                except Exception:
                                    value_str = str(deleted_value)
                                for line in value_str.splitlines() or [value_str]:
                                    log_error(f"    {line}")
                        except Exception as value_ex:
                            log_error(f"[JSON DELETE] value log error: {str(value_ex)}")
            except Exception as log_ex:
                log_error(f"[JSON DELETE] log error: {str(log_ex)}")

            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'status': 'success'}).encode('utf-8'))
        except Exception as e:
            log_error(f"Error saving master json: {str(e)}")
            log_error(traceback.format_exc())
            self.send_response(500)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'status': 'error', 'message': str(e)}).encode('utf-8'))

    def list_master_json_backups(self):
        try:
            back_dir = Path('Json/Back')
            if not back_dir.exists():
                self.send_json_response({'status': 'success', 'items': [], 'latest': None})
                return

            items = []
            for p in back_dir.iterdir():
                if not p.is_file():
                    continue
                if p.suffix.lower() != '.json':
                    continue
                try:
                    st = p.stat()
                    mtime = st.st_mtime
                except Exception:
                    mtime = 0
                items.append({
                    'name': p.name,
                    'mtime': mtime
                })

            items.sort(key=lambda x: x.get('mtime', 0), reverse=True)
            latest = items[0]['name'] if items else None
            self.send_json_response({'status': 'success', 'items': items, 'latest': latest})
        except Exception as e:
            log_error(f"Error listing master json backups: {str(e)}")
            self.send_json_response({'status': 'error', 'message': str(e)})

    def create_master_json_backup(self):
        try:
            Path('Json').mkdir(exist_ok=True)
            back_dir = Path('Json/Back')
            back_dir.mkdir(parents=True, exist_ok=True)

            src = Path('Json/OBody_presetDistributionConfig.json')
            if src.exists():
                content = src.read_text(encoding='utf-8').lstrip('\ufeff')
            else:
                content = "{}"

            ts = datetime.now().strftime('%Y-%m-%d %H%M%S.%f')[:-3]
            dst = back_dir / f"{ts} OBody_presetDistributionConfig.json"
            dst.write_text(content, encoding='utf-8')

            try:
                max_backups = 30
                backups = []
                for p in back_dir.iterdir():
                    if not p.is_file():
                        continue
                    if p.suffix.lower() != '.json':
                        continue
                    try:
                        mtime = p.stat().st_mtime
                    except Exception:
                        mtime = 0
                    backups.append((mtime, p.name.lower(), p))

                backups.sort(key=lambda x: (x[0], x[1]))
                while len(backups) > max_backups:
                    _, _, oldest = backups.pop(0)
                    try:
                        oldest.unlink()
                        log_error(f"[JSON BACKUP] pruned_oldest={oldest.name}")
                    except Exception as prune_ex:
                        log_error(f"[JSON BACKUP] prune_error file={oldest.name} error={str(prune_ex)}")
                        break
            except Exception as prune_outer_ex:
                log_error(f"[JSON BACKUP] prune_error error={str(prune_outer_ex)}")

            self.send_json_response({'status': 'success', 'name': dst.name})
        except Exception as e:
            log_error(f"Error creating master json backup: {str(e)}")
            self.send_json_response({'status': 'error', 'message': str(e)})

    def load_master_json_backup(self, data):
        try:
            name = data.get('name', '')
            if not isinstance(name, str) or not name.strip():
                self.send_response(400)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'status': 'error', 'message': 'Missing backup name'}).encode('utf-8'))
                return

            safe_name = os.path.basename(name)
            p = Path('Json/Back') / safe_name
            if not p.exists() or not p.is_file():
                self.send_response(404)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'status': 'error', 'message': 'Backup not found'}).encode('utf-8'))
                return

            content = p.read_text(encoding='utf-8').lstrip('\ufeff')
            self.send_json_response({'status': 'success', 'content': content, 'name': safe_name})
        except Exception as e:
            log_error(f"Error loading master json backup: {str(e)}")
            self.send_json_response({'status': 'error', 'message': str(e)})

    def restore_master_json_backup(self, data):
        try:
            name = data.get('name', '')
            if not isinstance(name, str) or not name.strip():
                self.send_response(400)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'status': 'error', 'message': 'Missing backup name'}).encode('utf-8'))
                return

            safe_name = os.path.basename(name)
            backup_path = Path('Json/Back') / safe_name
            if not backup_path.exists() or not backup_path.is_file():
                self.send_response(404)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'status': 'error', 'message': 'Backup not found'}).encode('utf-8'))
                return

            content = backup_path.read_text(encoding='utf-8').lstrip('\ufeff')
            try:
                parsed = json.loads(content or '{}')
            except json.JSONDecodeError:
                self.send_response(400)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'status': 'error', 'message': 'Backup has invalid JSON'}).encode('utf-8'))
                return

            dst = Path('Json/OBody_presetDistributionConfig.json')
            dst.write_text(json.dumps(parsed, indent=4, ensure_ascii=False), encoding='utf-8')
            log_error(f"[JSON BACKUP] restored={safe_name}")

            self.send_json_response({'status': 'success', 'restored': safe_name})
        except Exception as e:
            log_error(f"Error restoring master json backup: {str(e)}")
            self.send_json_response({'status': 'error', 'message': str(e)})

    def log_json_event(self, data):
        try:
            action = data.get('action', 'json-event')
            section = data.get('section', '')
            element = data.get('element', '')
            message = data.get('message', '')
            deleted_key = data.get('deletedKey', None)
            deleted_value = data.get('deletedValue', None)

            parts = [f"[JSON EVENT] action={action}"]
            if section:
                parts.append(f"section={section}")
            if element:
                parts.append(f"element={element}")
            if message:
                parts.append(f"info={message}")

            log_error(' | '.join(parts))

            if action == 'delete_element' and deleted_key is not None:
                try:
                    log_error("Clean rule key")
                    key_str = str(deleted_key)

                    # Si el valor es una lista (caso típico de reglas del JSON maestro)
                    if isinstance(deleted_value, list):
                        log_error(f'        "{key_str}": [')
                        for item in deleted_value:
                            log_error(f'            {json.dumps(item, ensure_ascii=False)}')
                        log_error("        ]")
                    else:
                        # Fallback genérico para otros tipos
                        try:
                            value_str = json.dumps(deleted_value, indent=4, ensure_ascii=False)
                        except Exception:
                            value_str = str(deleted_value)
                        for line in value_str.splitlines() or [value_str]:
                            log_error(f"        {line}")

                    log_error("Done")
                except Exception as extra_ex:
                    log_error(f"[JSON EVENT] extra log error: {str(extra_ex)}")

            self.send_json_response({'status': 'success'})
        except Exception as e:
            log_error(f"Error logging JSON event: {str(e)}")
            self.send_json_response({'status': 'error', 'message': str(e)})

    def load_web_config(self):
        web_config_file = Path('Json/config_web.json')

        default_data = {
            'hideMemoriasTab': False,
            'hideIniGeneratorTab': False,
            'hideMantellaTab': False,
            'hideChimTab': False,
            'hideSkynetTab': False,
            'hideOstimTab': False,
            'visibleTabs': {
                'tab-news': True
            }
        }

        if web_config_file.exists():
            try:
                data = json.loads(web_config_file.read_text(encoding='utf-8'))
            except:
                data = default_data
        else:
            data = default_data

        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps({'status': 'success', 'data': data}).encode('utf-8'))

    def load_sandbox_xml(self):
        xml_file = Path('xml/Preset_Sandbox.xml')
        content = xml_file.read_text(encoding='utf-8') if xml_file.exists() else "XML file not found"

        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps({'status': 'success', 'content': content}).encode('utf-8'))

    def save_sandbox_xml(self, data):
        Path('xml').mkdir(exist_ok=True)
        content = data.get('content', '')
        Path('xml/Preset_Sandbox.xml').write_text(content, encoding='utf-8')

        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps({'status': 'success'}).encode('utf-8'))

    def restore_sandbox_xml(self):
        backup_file = Path('xml/Preset_Sandbox_Back.xml')
        content = backup_file.read_text(encoding='utf-8') if backup_file.exists() else "Backup file not found"

        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps({'status': 'success', 'content': content}).encode('utf-8'))

    def load_example_doctor_log(self):
        example_file = Path('ejemplo/OBody_NG_Preset_Distribution_Assistant-NG_Doctor.log')
        content = example_file.read_text(encoding='utf-8') if example_file.exists() else "Example file not found"

        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps({'status': 'success', 'content': content}).encode('utf-8'))

    def load_example_smart_cleaning_log(self):
        example_file = Path('ejemplo/OBody_NG_Preset_Distribution_Assistant-NG_Smart_Cleaning.log')
        content = example_file.read_text(encoding='utf-8') if example_file.exists() else "Example file not found"

        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps({'status': 'success', 'content': content}).encode('utf-8'))

    def load_ini(self):
        ini_file = Path('ini/configuracion.ini')

        default_data = {
            'enableMod': True,
            'debugMode': False,
            'autoSave': True,
            'volume': 80,
            'frequency': 5
        }

        data = self.parse_ini(ini_file) if ini_file.exists() else default_data

        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps({'status': 'success', 'data': data}).encode('utf-8'))

    def get_ini_hash(self):
        try:
            ini_file = Path('ini/OBodyNG_PDA_temp.ini')
            if not ini_file.exists():
                self.send_json_response({'status': 'error', 'message': 'INI file not found'})
                return
            content = ini_file.read_text(encoding='utf-8')
            hash_md5 = hashlib.md5(content.encode('utf-8')).hexdigest()
            self.send_json_response({'status': 'success', 'hash': hash_md5})
        except Exception as e:
            log_error(f"Error calculating INI hash: {str(e)}")
            self.send_json_response({'status': 'error', 'message': str(e)})

    def save_ini(self, data):
        Path('ini').mkdir(exist_ok=True)
        
        ini_content = f"""[ModConfiguration]
EnableMod = {str(data.get('enableMod', True)).lower()}
DebugMode = {str(data.get('debugMode', False)).lower()}
AutoSave = {str(data.get('autoSave', True)).lower()}

[Audio]
Volume = {data.get('volume', 80)}

[System]
UpdateFrequency = {data.get('frequency', 5)}

[INI_RULE]
EnableSave = false
"""
        
        Path('ini/configuracion.ini').write_text(ini_content, encoding='utf-8')
        
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps({'status': 'success'}).encode('utf-8'))

    def parse_ini(self, ini_file):
        data = {}

        for line in ini_file.read_text(encoding='utf-8').splitlines():
            line = line.strip()
            if '=' in line and not line.startswith('[') and not line.startswith(';'):
                key, value = line.split('=', 1)
                key = key.strip().replace(' ', '')
                value = value.strip()

                camel_key = key[0].lower() + key[1:] if key else key

                if value.lower() in ['true', 'false']:
                    data[camel_key] = (value.lower() == 'true')
                elif value.isdigit():
                    data[camel_key] = int(value)
                else:
                    data[camel_key] = value

        return data

    def load_rute_ini(self):
        rute_file = Path('ini/Rute.ini')
        data = {}

        if rute_file.exists():
            content = rute_file.read_text(encoding='utf-8')
            current_section = None

            for line in content.splitlines():
                line = line.strip()
                if line.startswith('[') and line.endswith(']'):
                    current_section = line[1:-1]
                    data[current_section] = {}
                elif '=' in line and current_section and not line.startswith(';'):
                    key, value = line.split('=', 1)
                    key = key.strip()
                    value = value.strip()
                    if current_section == 'Logs':
                        if 'logs' not in data[current_section]:
                            data[current_section]['logs'] = []
                        data[current_section]['logs'].append(value)
                    else:
                        data[current_section][key] = value

        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps({'status': 'success', 'data': data}).encode('utf-8'))

    def load_log(self):
        path_parts = self.path.split('/')
        if len(path_parts) < 3:
            self.send_response(400)
            self.end_headers()
            return

        log_filename = path_parts[2]

        # Special handling for server_errors.log
        if log_filename == 'server_errors.log':
            log_path = SERVER_ERRORS_LOG
            if log_path.exists():
                try:
                    log_content = log_path.read_text(encoding='utf-8', errors='ignore')
                    found_path = str(log_path)
                except Exception as e:
                    log_content = f"Error reading log file: {str(e)}"
                    found_path = str(log_path)
            else:
                log_content = f"Log file '{log_filename}' not found."
                found_path = ""
        else:
            rute_file = Path('ini/Rute.ini')
            log_paths = []

            if rute_file.exists():
                content = rute_file.read_text(encoding='utf-8')
                current_section = None

                for line in content.splitlines():
                    line = line.strip()
                    if line.startswith('[') and line.endswith(']'):
                        current_section = line[1:-1]
                    elif '=' in line and current_section == 'SKSE_logs':
                        key, value = line.split('=', 1)
                        key = key.strip()
                        value = value.strip()
                        log_paths.append(value)

            log_content = ""
            found_path = ""

            for base_path in log_paths:
                full_path = Path(base_path) / log_filename
                if full_path.exists():
                    try:
                        log_content = full_path.read_text(encoding='utf-8', errors='ignore')
                        found_path = str(full_path)
                        break
                    except Exception as e:
                        log_content = f"Error reading log file: {str(e)}"
                        found_path = str(full_path)
                        break

            if not log_content:
                log_content = f"Log file '{log_filename}' not found in any of the specified paths."

        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps({
            'status': 'success',
            'filename': log_filename,
            'content': log_content,
            'path': found_path
        }).encode('utf-8'))

    def save_generated_rules(self, data):
        Path('ini').mkdir(exist_ok=True)
        rules = data.get('rules', '')
        Path('ini/OBodyNG_PDA_temp.ini').write_text(rules, encoding='utf-8')

        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps({'status': 'success'}).encode('utf-8'))

    def toggle_enable_save(self, data):
        ini_file = Path('ini/configuracion.ini')
        try:
            Path('ini').mkdir(exist_ok=True)
            content = ini_file.read_text(encoding='utf-8') if ini_file.exists() else ''

            if not content.strip():
                new_content = '[INI_RULE]\nEnableSave = true\n'
            else:
                lines = content.splitlines()
                updated_lines = []
                found_key = False
                for line in lines:
                    if re.match(r'^\s*EnableSave\s*=', line, flags=re.IGNORECASE):
                        updated_lines.append('EnableSave = true')
                        found_key = True
                    else:
                        updated_lines.append(line)

                if not found_key:
                    inserted = False
                    final_lines = []
                    for line in updated_lines:
                        final_lines.append(line)
                        if not inserted and re.match(r'^\s*\[INI_RULE\]\s*$', line, flags=re.IGNORECASE):
                            final_lines.append('EnableSave = true')
                            inserted = True
                    if not inserted:
                        final_lines.append('[INI_RULE]')
                        final_lines.append('EnableSave = true')
                    updated_lines = final_lines

                new_content = '\n'.join(updated_lines).rstrip('\n') + '\n'

            ini_file.write_text(new_content, encoding='utf-8')
            log_error("EnableSave set to true")

            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'status': 'success'}).encode('utf-8'))
        except Exception as e:
            log_error(f"ERROR toggling EnableSave: {e}")
            self.send_response(500)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'status': 'error', 'message': str(e)}).encode('utf-8'))

    def handle_check_dead_man_switch(self):
        """
        Evalúa server_errors.log para exponer el estado del Dead Man Switch y cierre de Skyrim.
        Compatible con la lógica usada por la bola de estado del frontend.
        No modifica game_log_active ni shutdown_flag.
        """
        try:
            dead_man_switch_activated = False
            skyrim_closed = False

            log_path = SERVER_ERRORS_LOG
            if log_path.exists():
                with open(log_path, 'r', encoding='utf-8', errors='ignore') as f:
                    for line in f:
                        stripped = line.strip()
                        if 'ACTIVITY DETECTED!' in stripped:
                            dead_man_switch_activated = True
                        if stripped.endswith('SKYRIM HAS CLOSED - SHUTTING DOWN SERVER NOW'):
                            skyrim_closed = True

            response = {
                'status': 'success',
                'dead_man_switch_activated': dead_man_switch_activated,
                'skyrim_closed': skyrim_closed
            }
            self.send_json_response(response)

        except Exception as e:
            # Reusar el sistema de logging ya presente en server.pyw
            try:
                log_error(f"ERROR in handle_check_dead_man_switch: {e}")
            except Exception:
                pass

            self.send_json_response({
                'status': 'error',
                'dead_man_switch_activated': False,
                'skyrim_closed': False,
                'message': 'Internal error while checking Dead Man Switch'
            })

    def load_master_json(self):
        json_file = Path('Json/OBody_presetDistributionConfig.json')
        content = json_file.read_text(encoding='utf-8') if json_file.exists() else "{}"
        content = content.lstrip('\ufeff')

        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps({'status': 'success', 'content': content}).encode('utf-8'))

    def load_analysis_log(self):
        rute_file = Path('ini/Rute.ini')
        log_paths = []

        if rute_file.exists():
            content = rute_file.read_text(encoding='utf-8')
            current_section = None

            for line in content.splitlines():
                line = line.strip()
                if line.startswith('[') and line.endswith(']'):
                    current_section = line[1:-1]
                elif '=' in line and current_section == 'SKSE_logs':
                    key, value = line.split('=', 1)
                    key = key.strip()
                    value = value.strip()
                    log_paths.append(value)

        log_content = ""
        found_path = ""

        for base_path in log_paths:
            full_path = Path(base_path) / 'OBody_NG_Preset_Distribution_Assistant-NG_Analysis_INIs.log'
            if full_path.exists():
                try:
                    log_content = full_path.read_text(encoding='utf-8', errors='ignore')
                    found_path = str(full_path)
                    break
                except Exception as e:
                    log_content = f"Error reading log file: {str(e)}"
                    found_path = str(full_path)
                    break

        if not log_content:
            example_file = Path('ejemplo/OBody_NG_Preset_Distribution_Assistant-NG_Analysis_INIs.log')
            if example_file.exists():
                try:
                    log_content = example_file.read_text(encoding='utf-8', errors='ignore')
                    found_path = str(example_file)
                except Exception as e:
                    log_content = f"Error reading example log file: {str(e)}"
                    found_path = str(example_file)

        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps({
            'status': 'success',
            'content': log_content,
            'path': found_path
        }).encode('utf-8'))

    def load_favoritos(self):
        favoritos_file = Path('Json/config_Favori.json')
        data = {}

        if favoritos_file.exists():
            try:
                data = json.loads(favoritos_file.read_text(encoding='utf-8'))
            except:
                data = {}

        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps({'status': 'success', 'data': data}).encode('utf-8'))

    def save_favoritos(self, data):
        Path('Json').mkdir(exist_ok=True)
        favoritos = data.get('favoritos', {})
        Path('Json/config_Favori.json').write_text(json.dumps(favoritos, indent=4), encoding='utf-8')

        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps({'status': 'success'}).encode('utf-8'))

    def load_favoritos_xml(self):
        favoritos_file = Path('Json/config_Favori_XML.json')
        data = {}

        if favoritos_file.exists():
            try:
                data = json.loads(favoritos_file.read_text(encoding='utf-8'))
                if not isinstance(data, dict):
                    data = {}
            except:
                data = {}

        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps({'status': 'success', 'data': data}).encode('utf-8'))

    def save_favoritos_xml(self, data):
        Path('Json').mkdir(exist_ok=True)
        favoritos_xml = data.get('favoritos_xml', {})
        if not isinstance(favoritos_xml, dict):
            favoritos_xml = {}
        Path('Json/config_Favori_XML.json').write_text(json.dumps(favoritos_xml, indent=4, ensure_ascii=False), encoding='utf-8')

        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps({'status': 'success'}).encode('utf-8'))

    def load_favoritos_npcs(self):
        favoritos_npcs_file = Path('Json/config_Favori_NPCs.json')
        data = {}

        if favoritos_npcs_file.exists():
            try:
                data = json.loads(favoritos_npcs_file.read_text(encoding='utf-8'))
            except:
                data = {}

        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps({'status': 'success', 'data': data}).encode('utf-8'))

    def save_favoritos_npcs(self, data):
        Path('Json').mkdir(exist_ok=True)
        favoritos_npcs = data.get('favoritos_npcs', {})
        Path('Json/config_Favori_NPCs.json').write_text(json.dumps(favoritos_npcs, indent=4, ensure_ascii=False), encoding='utf-8')

        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps({'status': 'success'}).encode('utf-8'))

    def load_memori_f(self):
        try:
            memori_file = Path('Json/Act2_Manager_MemoriF.json')
            data = {}

            if memori_file.exists():
                content = memori_file.read_text(encoding='utf-8')
                if content.strip():
                    data = json.loads(content)

            self.send_json_response({'status': 'success', 'data': data})
        except Exception as e:
            log_error(f"Error loading Act2_Manager_MemoriF.json: {str(e)}")
            self.send_json_response({'status': 'error', 'message': str(e)})

    def save_memori_f(self, data):
        try:
            Path('Json').mkdir(exist_ok=True)
            memori = data.get('memori_f', {})

            if not isinstance(memori, dict):
                self.send_json_response({'status': 'error', 'message': 'Invalid data type'})
                return

            memori_file = Path('Json/Act2_Manager_MemoriF.json')
            memori_file.write_text(json.dumps(memori, indent=4, ensure_ascii=False), encoding='utf-8')

            self.send_json_response({'status': 'success'})
        except Exception as e:
            log_error(f"Error saving Act2_Manager_MemoriF.json: {str(e)}")
            self.send_json_response({'status': 'error', 'message': str(e)})

    def accumulate_faction_names(self):
        try:
            Path('Json').mkdir(exist_ok=True)
            manager_file = Path('Json/Act2_Manager.json')
            if not manager_file.exists():
                self.send_json_response({'status': 'error', 'message': 'Act2_Manager.json not found'})
                return

            try:
                content = manager_file.read_text(encoding='utf-8')
            except UnicodeDecodeError:
                with open(manager_file, 'r', encoding='utf-8', errors='ignore') as f:
                    content = f.read()
            content = content.lstrip('\ufeff')
            if content.strip():
                manager_data = json.loads(content)
            else:
                manager_data = {}

            memori_file = Path('Json/Act2_Manager_MemoriF.json')
            existing_memori = {}
            if memori_file.exists():
                memori_content = memori_file.read_text(encoding='utf-8')
                if memori_content.strip():
                    try:
                        existing_memori = json.loads(memori_content)
                        if not isinstance(existing_memori, dict):
                            existing_memori = {}
                    except json.JSONDecodeError:
                        existing_memori = {}

            # Collect faction editor_ids from player and NPC factions
            faction_ids = set()
            name_by_editor = {}

            player = manager_data.get('player', {})
            player_factions = player.get('factions', [])
            for faction in player_factions:
                editor_id = str(faction.get('editor_id', '')).strip()
                name = str(faction.get('name', '')).strip()
                if editor_id:
                    faction_ids.add(editor_id)
                    if name and editor_id not in name_by_editor:
                        name_by_editor[editor_id] = name

            for npc in manager_data.get('npcs', []):
                npc_factions = npc.get('factions', [])
                for faction in npc_factions:
                    editor_id = str(faction.get('editor_id', '')).strip()
                    name = str(faction.get('name', '')).strip()
                    if editor_id:
                        faction_ids.add(editor_id)
                        if name and editor_id not in name_by_editor:
                            name_by_editor[editor_id] = name

            memori_data = {}
            for editor_id in sorted(faction_ids):
                # Determine previous enabled flag (backward compatible with old formats)
                prev = existing_memori.get(editor_id)
                if prev is None:
                    # Migration path: old file may have been keyed by name
                    name = name_by_editor.get(editor_id, '')
                    if name and name in existing_memori:
                        prev = existing_memori[name]

                if isinstance(prev, dict):
                    enabled = bool(prev.get('enabled', True))
                elif isinstance(prev, bool):
                    enabled = prev
                else:
                    enabled = True

                name = name_by_editor.get(editor_id, '')
                memori_data[editor_id] = {
                    'name': name,
                    'enabled': enabled
                }

            memori_file.write_text(json.dumps(memori_data, indent=4, ensure_ascii=False), encoding='utf-8')

            self.send_json_response({'status': 'success', 'count': len(memori_data)})
        except Exception as e:
            log_error(f"Error accumulating faction names: {str(e)}")
            self.send_json_response({'status': 'error', 'message': str(e)})

    def load_favoritos_outfits(self):
        try:
            Path('Json').mkdir(exist_ok=True)
            favoritos_outfits_file = Path('Json/config_Favori_Outfits.json')
            data = {}

            if favoritos_outfits_file.exists():
                content = favoritos_outfits_file.read_text(encoding='utf-8')
                if content.strip():  # Si el archivo no está vacío
                    data = json.loads(content)

            self.send_json_response({'status': 'success', 'data': data})
        except Exception as e:
            log_error(f"Error loading favoritos outfits: {str(e)}")
            self.send_json_response({'status': 'error', 'message': str(e)})

    def save_favoritos_outfits(self, data):
        try:
            Path('Json').mkdir(exist_ok=True)
            favoritos_outfits = data.get('favoritos_outfits', {})

            # Validar que sea un objeto JSON válido
            if not isinstance(favoritos_outfits, dict):
                log_error("Invalid data type for favoritos_outfits")
                self.send_json_response({'status': 'error', 'message': 'Invalid data type'})
                return

            # Escribir con manejo de errores robusto
            json_file = Path('Json/config_Favori_Outfits.json')
            json_file.write_text(json.dumps(favoritos_outfits, indent=4, ensure_ascii=False), encoding='utf-8')

            self.send_json_response({'status': 'success'})
        except json.JSONDecodeError as e:
            log_error(f"Invalid JSON data for favoritos outfits: {str(e)}")
            self.send_json_response({'status': 'error', 'message': 'Invalid JSON data'})
        except PermissionError as e:
            log_error(f"Permission error saving favoritos outfits: {str(e)}")
            self.send_json_response({'status': 'error', 'message': 'Permission denied'})
        except OSError as e:
            log_error(f"OS error saving favoritos outfits: {str(e)}")
            self.send_json_response({'status': 'error', 'message': 'File system error'})
        except Exception as e:
            log_error(f"Error saving favoritos outfits: {str(e)}")
            self.send_json_response({'status': 'error', 'message': str(e)})

    def load_act2_json(self):
        try:
            log_error("=== LOAD_ACT2_JSON STARTED ===")
            json_file = Path('Json/Act2_Manager.json')
            log_error(f"Looking for file: {json_file.absolute()}")

            if json_file.exists():
                log_error("File exists, reading content with error handling...")
                try:
                    # Try UTF-8 first
                    content = json_file.read_text(encoding='utf-8')
                    log_error("File read successfully with UTF-8")
                except UnicodeDecodeError:
                    log_error("UTF-8 failed, trying with errors='ignore'...")
                    # If UTF-8 fails, try with error ignoring
                    with open(json_file, 'r', encoding='utf-8', errors='ignore') as f:
                        content = f.read()
                    log_error("File read successfully with errors='ignore'")

                content = content.lstrip('\ufeff')
                log_error(f"Content length: {len(content)} characters")

                # Validate JSON
                try:
                    json.loads(content)
                    log_error("JSON validation passed")
                except json.JSONDecodeError as je:
                    log_error(f"JSON validation failed: {str(je)}")
                    # Try to fix common JSON issues
                    content = content.replace('\n', '').replace('\r', '').strip()
                    if content.endswith(','):
                        content = content[:-1] + '}'
                    log_error("Attempted to fix JSON formatting")

            else:
                log_error("File does not exist, returning empty JSON")
                content = "{}"

            log_error("Sending response...")
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            response_data = {'status': 'success', 'content': content}
            self.wfile.write(json.dumps(response_data).encode('utf-8'))
            log_error("Response sent successfully")
            log_error("=== LOAD_ACT2_JSON COMPLETED ===")

        except Exception as e:
            log_error(f"ERROR in load_act2_json: {str(e)}")
            log_error(traceback.format_exc())
            self.send_response(500)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'status': 'error', 'message': str(e)}).encode('utf-8'))

    def load_outfits_json(self):
        try:
            log_error("=== LOAD_OUTFITS_JSON STARTED ===")
            json_file = Path('Json/Act2_Outfits.json')
            log_error(f"Looking for file: {json_file.absolute()}")

            if json_file.exists():
                log_error("File exists, reading content with error handling...")
                try:
                    # Try UTF-8 first
                    content = json_file.read_text(encoding='utf-8')
                    log_error("File read successfully with UTF-8")
                except UnicodeDecodeError:
                    log_error("UTF-8 failed, trying with errors='ignore'...")
                    # If UTF-8 fails, try with error ignoring
                    with open(json_file, 'r', encoding='utf-8', errors='ignore') as f:
                        content = f.read()
                    log_error("File read successfully with errors='ignore'")

                content = content.lstrip('\ufeff')
                log_error(f"Content length: {len(content)} characters")

                # Validate JSON
                try:
                    json.loads(content)
                    log_error("JSON validation passed")
                except json.JSONDecodeError as je:
                    log_error(f"JSON validation failed: {str(je)}")
                    # Try to fix common JSON issues
                    content = content.replace('\n', '').replace('\r', '').strip()
                    if content.endswith(','):
                        content = content[:-1] + '}'
                    log_error("Attempted to fix JSON formatting")

            else:
                log_error("File does not exist, returning empty JSON")
                content = "{}"

            log_error("Sending response...")
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            response_data = {'status': 'success', 'content': content}
            self.wfile.write(json.dumps(response_data).encode('utf-8'))
            log_error("Response sent successfully")
            log_error("=== LOAD_OUTFITS_JSON COMPLETED ===")

        except Exception as e:
            log_error(f"ERROR in load_outfits_json: {str(e)}")
            log_error(traceback.format_exc())
            self.send_response(500)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'status': 'error', 'message': str(e)}).encode('utf-8'))

    def load_npcs_list_json(self):
        try:
            log_error("=== LOAD_NPCS_LIST_JSON STARTED ===")
            json_file = Path('Json/Act2_NPCs_List.json')
            log_error(f"Looking for file: {json_file.absolute()}")

            content = "{}"  # Default empty JSON

            if json_file.exists():
                log_error("File exists, reading content with error handling...")
                try:
                    # Try UTF-8 first
                    content = json_file.read_text(encoding='utf-8')
                    log_error("File read successfully with UTF-8")
                except UnicodeDecodeError:
                    log_error("UTF-8 failed, trying with errors='ignore'...")
                    # If UTF-8 fails, try with error ignoring
                    with open(json_file, 'r', encoding='utf-8', errors='ignore') as f:
                        content = f.read()
                    log_error("File read successfully with errors='ignore'")

                content = content.lstrip('\ufeff')
                log_error(f"Content length: {len(content)} characters")

                # Validate JSON
                try:
                    json.loads(content)
                    log_error("JSON validation passed")
                except json.JSONDecodeError as je:
                    log_error(f"JSON validation failed: {str(je)}")
                    # Try to fix common JSON issues
                    content = content.replace('\n', '').replace('\r', '').strip()
                    if content.endswith(','):
                        content = content[:-1] + '}'
                    log_error("Attempted to fix JSON formatting")
                    # If still invalid, use empty JSON
                    try:
                        json.loads(content)
                    except json.JSONDecodeError:
                        log_error("JSON still invalid after fixes, using empty JSON")
                        content = "{}"

            else:
                log_error("File does not exist, returning empty JSON")

            log_error("Sending response...")
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            response_data = {'status': 'success', 'content': content}
            self.wfile.write(json.dumps(response_data).encode('utf-8'))
            log_error("Response sent successfully")
            log_error("=== LOAD_NPCS_LIST_JSON COMPLETED ===")

        except Exception as e:
            log_error(f"ERROR in load_npcs_list_json: {str(e)}")
            log_error(traceback.format_exc())
            # Always respond with 200 and success, even on error
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'status': 'success', 'content': '{}'}).encode('utf-8'))

    def toggle_act2_start(self):
        try:
            log_error("=== TOGGLE_ACT2_START STARTED ===")
            ini_file = Path('ini/Act2_Manager.ini')
            log_error(f"Looking for INI file: {ini_file.absolute()}")

            config = configparser.ConfigParser()
            if ini_file.exists():
                config.read(ini_file, encoding='utf-8')

            if 'NPC_tracking' not in config:
                config.add_section('NPC_tracking')

            current_value = config.get('NPC_tracking', 'start', fallback='false')
            new_value = 'true' if current_value == 'false' else 'false'

            config.set('NPC_tracking', 'start', new_value)
            log_error(f"Changing NPC_tracking start from {current_value} to {new_value}")

            # Gestionar temporizador de auto-reset
            global npc_tracking_start_time
            if new_value == 'true':
                npc_tracking_start_time = time.time()
            else:
                npc_tracking_start_time = None

            ini_file.parent.mkdir(exist_ok=True)
            with open(ini_file, 'w', encoding='utf-8') as f:
                config.write(f)

            log_error("Act2_Manager.ini updated")

            log_error("Sending success response...")
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'status': 'success'}).encode('utf-8'))
            log_error("=== TOGGLE_ACT2_START COMPLETED ===")

        except Exception as e:
            log_error(f"ERROR in toggle_act2_start: {str(e)}")
            log_error(traceback.format_exc())
            self.send_response(500)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'status': 'error', 'message': str(e)}).encode('utf-8'))

    def toggle_plugin_outfits_start(self):
        try:
            log_error("=== TOGGLE_PLUGIN_OUTFITS_START STARTED ===")
            ini_file = Path('ini/Act2_Manager.ini')
            log_error(f"Looking for INI file: {ini_file.absolute()}")

            with act2_ini_lock:
                lines = []
                current_value = 'false'
                in_section = False
                if ini_file.exists():
                    with open(ini_file, 'r', encoding='utf-8') as f:
                        for line in f:
                            stripped = line.strip()
                            if stripped.lower() == '[plugin_outfits]':
                                in_section = True
                                lines.append(line)
                            elif stripped.startswith('[') and in_section:
                                in_section = False
                                lines.append(line)
                            elif in_section:
                                if stripped.lower().startswith('start'):
                                    parts = stripped.split('=', 1)
                                    if len(parts) == 2:
                                        current_value = parts[1].strip().lower()
                                    lines.append(line)
                                elif stripped.lower().startswith('plugin_list'):
                                    lines.append('Plugin_list = false\n')
                                else:
                                    lines.append(line)
                            else:
                                lines.append(line)

                new_value = 'true' if current_value == 'false' else 'false'
                log_error(f"Changing Plugin_Outfits start from {current_value} to {new_value}")

                # Gestionar temporizador de auto-reset
                global plugin_outfits_start_time
                if new_value == 'true':
                    plugin_outfits_start_time = time.time()
                else:
                    plugin_outfits_start_time = None

                # Reemplazar la línea start
                updated_lines = []
                in_section = False
                for line in lines:
                    stripped = line.strip()
                    if stripped.lower() == '[plugin_outfits]':
                        in_section = True
                        updated_lines.append(line)
                    elif stripped.startswith('[') and in_section:
                        in_section = False
                        updated_lines.append(line)
                    elif in_section and stripped.lower().startswith('start'):
                        updated_lines.append(f'start = {new_value}\n')
                    else:
                        updated_lines.append(line)

                ini_file.parent.mkdir(exist_ok=True)
                with open(ini_file, 'w', encoding='utf-8') as f:
                    f.writelines(updated_lines)

            log_error("Act2_Manager.ini updated")

            log_error("Sending success response...")
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'status': 'success'}).encode('utf-8'))
            log_error("=== TOGGLE_PLUGIN_OUTFITS_START COMPLETED ===")

        except Exception as e:
            log_error(f"ERROR in toggle_plugin_outfits_start: {str(e)}")
            log_error(traceback.format_exc())
            self.send_response(500)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'status': 'error', 'message': str(e)}).encode('utf-8'))

    def toggle_npc_plugins_start(self):
        try:
            log_error("=== TOGGLE_NPC_PLUGINS_START REQUEST RECEIVED ===")
            log_error("=== TOGGLE_NPC_PLUGINS_START STARTED ===")
            ini_file = Path('ini/Act2_Manager.ini')
            log_error(f"Looking for INI file: {ini_file.absolute()}")

            # Try to acquire lock non-blocking to avoid hang
            if not act2_ini_lock.acquire(blocking=False):
                log_error("act2_ini_lock is busy, cannot proceed")
                self.send_response(500)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'status': 'error', 'message': 'Server busy'}).encode('utf-8'))
                return

            try:
                log_error("Acquiring act2_ini_lock")
                lines = []
                found = False
                section_start = None
                log_error("Reading INI file")
                if ini_file.exists():
                    with open(ini_file, 'r', encoding='utf-8') as f:
                        for line_num, line in enumerate(f, 1):
                            log_error(f"Processing line {line_num}: {line.strip()}")
                            if line.strip().lower() == '[plugin_npcs]':
                                section_start = len(lines)
                                log_error(f"Found [Plugin_NPCs] section at line {line_num}")
                            if 'startnpcs' in line.lower():
                                log_error(f"Found startNPCs at line {line_num}, replacing with true")
                                lines.append('startNPCs = true\n')
                                found = True
                            else:
                                lines.append(line)
                else:
                    log_error("INI file does not exist, will create")
                log_error(f"Finished reading, found: {found}, section_start: {section_start}")
                if not found:
                    log_error("startNPCs not found, adding it")
                    if section_start is not None:
                        insert_pos = len(lines)
                        for j in range(section_start, len(lines)):
                            if lines[j].strip().lower().startswith('['):
                                insert_pos = j
                                break
                        log_error(f"Inserting at position {insert_pos}")
                        lines.insert(insert_pos, 'startNPCs = true\n')
                    else:
                        log_error("No [Plugin_NPCs] section found, creating section and key")
                        lines.append('[Plugin_NPCs]\nstartNPCs = true\n')
                log_error("Writing INI file")
                ini_file.parent.mkdir(exist_ok=True)
                with open(ini_file, 'w', encoding='utf-8') as f:
                    f.writelines(lines)
                log_error("INI file written successfully")
    
                # Test INI write post-fix
                log_error("Testing INI write by reading back")
                with open(ini_file, 'r', encoding='utf-8') as f:
                    test_lines = f.readlines()
                test_found = any('startnpcs' in line.lower() and 'true' in line.lower() for line in test_lines)
                if test_found:
                    log_error("INI write test passed: startNPCs = true found")
                else:
                    log_error("INI write test failed: startNPCs = true not found")
                    raise Exception("INI write verification failed")
    
                log_error("Setting Plugin_NPCs startNPCs to true")
    
                # Gestionar temporizador de auto-reset
                global plugin_npcs_start_time
                plugin_npcs_start_time = time.time()
                log_error("Set plugin_npcs_start_time")
    
                log_error("Act2_Manager.ini updated")
    
                log_error("Sending success response...")
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'status': 'success'}).encode('utf-8'))
                log_error("=== TOGGLE_NPC_PLUGINS_START COMPLETED ===")
    
            finally:
                act2_ini_lock.release()
                log_error("act2_ini_lock released")
    
        except Exception as e:
            log_error(f"ERROR in toggle_npc_plugins_start: {str(e)}")
            log_error(traceback.format_exc())
            try:
                act2_ini_lock.release()
            except:
                pass
            self.send_response(500)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'status': 'error', 'message': str(e)}).encode('utf-8'))

    def toggle_act3_start(self):
        try:
            ini_file = Path('ini/JsonMaster.ini')
            config = configparser.ConfigParser()
            if ini_file.exists():
                config.read(ini_file, encoding='utf-8')
            if 'Act3_Json' not in config:
                config.add_section('Act3_Json')
            current_value = config.get('Act3_Json', 'startAct3', fallback='false')
            new_value = 'true'
            config.set('Act3_Json', 'startAct3', new_value)
            global act3_start_time
            act3_start_time = time.time()
            ini_file.parent.mkdir(exist_ok=True)
            with open(ini_file, 'w', encoding='utf-8') as f:
                config.write(f)
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'status': 'success', 'previous': current_value.lower(), 'current': new_value}).encode('utf-8'))
        except Exception as e:
            log_error(f"ERROR in toggle_act3_start: {str(e)}")
            log_error(traceback.format_exc())
            self.send_response(500)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'status': 'error', 'message': str(e)}).encode('utf-8'))

    def check_act3_status(self):
        try:
            ini_file = Path('ini/JsonMaster.ini')
            config = configparser.ConfigParser()
            value = 'false'
            if ini_file.exists():
                config.read(ini_file, encoding='utf-8')
                if 'Act3_Json' in config:
                    value = config.get('Act3_Json', 'startAct3', fallback='false')
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'status': 'success', 'startAct3': value.lower()}).encode('utf-8'))
        except Exception as e:
            log_error(f"ERROR in check_act3_status: {str(e)}")
            log_error(traceback.format_exc())
            self.send_response(500)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'status': 'error', 'message': str(e)}).encode('utf-8'))

    def toggle_act4_start(self):
        try:
            try:
                src_json = Path('Json/OBody_presetDistributionConfig.json')
                if src_json.exists():
                    back_dir = Path('Json/Back')
                    back_dir.mkdir(exist_ok=True)
                    ts = datetime.now().strftime('%Y-%m-%d %H%M%S.%f')[:-3]
                    backup_path = back_dir / f"{ts} OBody_presetDistributionConfig.json"
                    shutil.copy2(src_json, backup_path)
                    try:
                        max_backups = 30
                        backups = []
                        for p in back_dir.iterdir():
                            if not p.is_file():
                                continue
                            if p.suffix.lower() != '.json':
                                continue
                            try:
                                mtime = p.stat().st_mtime
                            except Exception:
                                mtime = 0
                            backups.append((mtime, p.name.lower(), p))

                        backups.sort(key=lambda x: (x[0], x[1]))
                        while len(backups) > max_backups:
                            _, _, oldest = backups.pop(0)
                            try:
                                oldest.unlink()
                                log_error(f"[JSON BACKUP] pruned_oldest={oldest.name}")
                            except Exception as prune_ex:
                                log_error(f"[JSON BACKUP] prune_error file={oldest.name} error={str(prune_ex)}")
                                break
                    except Exception as prune_outer_ex:
                        log_error(f"[JSON BACKUP] prune_error error={str(prune_outer_ex)}")
                else:
                    log_error("toggle_act4_start: Json/OBody_presetDistributionConfig.json not found, backup skipped")
            except Exception as backup_ex:
                log_error(f"toggle_act4_start: backup error: {str(backup_ex)}")
                log_error(traceback.format_exc())

            ini_file = Path('ini/JsonRecord.ini')
            config = configparser.ConfigParser()
            if ini_file.exists():
                config.read(ini_file, encoding='utf-8')
            if 'Act4_Json' not in config:
                config.add_section('Act4_Json')
            current_value = config.get('Act4_Json', 'startact4', fallback='false')
            new_value = 'true'
            config.set('Act4_Json', 'startact4', new_value)
            global act4_start_time
            act4_start_time = time.time()
            ini_file.parent.mkdir(exist_ok=True)
            with open(ini_file, 'w', encoding='utf-8') as f:
                config.write(f)
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'status': 'success', 'previous': current_value.lower(), 'current': new_value}).encode('utf-8'))
        except Exception as e:
            log_error(f"ERROR in toggle_act4_start: {str(e)}")
            log_error(traceback.format_exc())
            self.send_response(500)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'status': 'error', 'message': str(e)}).encode('utf-8'))

    def check_act4_status(self):
        try:
            ini_file = Path('ini/JsonRecord.ini')
            config = configparser.ConfigParser()
            value = 'false'
            if ini_file.exists():
                config.read(ini_file, encoding='utf-8')
                if 'Act4_Json' in config:
                    value = config.get('Act4_Json', 'startact4', fallback='false')
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'status': 'success', 'startact4': value.lower()}).encode('utf-8'))
        except Exception as e:
            log_error(f"ERROR in check_act4_status: {str(e)}")
            log_error(traceback.format_exc())
            self.send_response(500)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'status': 'error', 'message': str(e)}).encode('utf-8'))

    def activate_npc_tracking(self):
        try:
            log_error("=== ACTIVATE_NPC_TRACKING STARTED ===")
            ini_file = Path('ini/Act2_Manager.ini')
            log_error(f"Looking for INI file: {ini_file.absolute()}")

            config = configparser.ConfigParser()
            if ini_file.exists():
                config.read(ini_file, encoding='utf-8')

            if 'NPC_tracking' not in config:
                config.add_section('NPC_tracking')

            config.set('NPC_tracking', 'start', 'true')
            log_error("Setting NPC_tracking start to true")

            # Gestionar temporizador de auto-reset
            global npc_tracking_start_time
            npc_tracking_start_time = time.time()

            ini_file.parent.mkdir(exist_ok=True)
            with open(ini_file, 'w', encoding='utf-8') as f:
                config.write(f)

            log_error("Act2_Manager.ini updated")

            log_error("Sending success response...")
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'status': 'success'}).encode('utf-8'))
            log_error("=== ACTIVATE_NPC_TRACKING COMPLETED ===")

        except Exception as e:
            log_error(f"ERROR in activate_npc_tracking: {str(e)}")
            log_error(traceback.format_exc())
            self.send_response(500)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'status': 'error', 'message': str(e)}).encode('utf-8'))

    def create_shortcuts(self):
        try:
            log_error("=== CREATE_SHORTCUTS STARTED ===")

            # DEBUG: Verificar si el módulo 'os' está disponible en este scope
            try:
                log_error(f"DEBUG: os module type: {type(os)}")
                log_error(f"DEBUG: os.path exists: {hasattr(os, 'path')}")
            except NameError as ne:
                log_error(f"DEBUG: NameError checking os: {str(ne)}")
            except Exception as e:
                log_error(f"DEBUG: Error checking os: {str(e)}")

            # Detectar ruta del ejecutable standalone
            executable_path = None

            # PRIMERA PRIORIDAD: Buscar en ruta relativa al directorio del servidor
            server_dir = os.path.dirname(os.path.abspath(__file__))
            relative_exe_path = os.path.join(server_dir, '..', 'Standalone Mode', 'Standalone Mode.exe')
            relative_exe_path = os.path.abspath(relative_exe_path)
            log_error(f"Trying relative path first: {relative_exe_path}")

            if os.path.exists(relative_exe_path):
                executable_path = relative_exe_path
                log_error(f"SUCCESS: Found executable at relative path: {executable_path}")
            else:
                log_error(f"Relative path does not exist: {relative_exe_path}")

            # SEGUNDA PRIORIDAD: Buscar en rutas SKSE como fallback
            if not executable_path:
                log_error("Relative path not found, trying SKSE paths as fallback...")
                rute_file = Path('ini/Rute.ini')

                if rute_file.exists():
                    log_error("Reading Rute.ini to find executable path...")
                    content = rute_file.read_text(encoding='utf-8')
                    current_section = None

                    for line in content.splitlines():
                        line = line.strip()
                        if line.startswith('[') and line.endswith(']'):
                            current_section = line[1:-1]
                            log_error(f"Processing section: [{current_section}]")
                        elif '=' in line and current_section == 'SKSE_logs':
                            key, value = line.split('=', 1)
                            key = key.strip()
                            value = value.strip()
                            log_error(f"Found SKSE_logs entry: {key} = {value}")

                            # Buscar la ruta SKSE
                            if 'skse' in key.lower() or 'skyrim' in key.lower():
                                skse_path = Path(value)
                                log_error(f"Checking SKSE path: {skse_path}")
                                if skse_path.exists():
                                    log_error(f"SKSE path exists: {skse_path}")
                                    # Construir ruta al ejecutable standalone
                                    standalone_path = skse_path / 'SKSE' / 'Plugins' / 'OBody_NG_PDA_NG_Full_Assistance' / 'Standalone Mode' / 'Standalone Mode.exe'
                                    log_error(f"Constructed standalone path: {standalone_path}")
                                    if standalone_path.exists():
                                        executable_path = str(standalone_path)
                                        log_error(f"Found executable at SKSE path: {executable_path}")
                                        break
                                    else:
                                        log_error(f"Standalone executable does not exist at: {standalone_path}")
                                        # Verificar directorios intermedios
                                        plugins_path = skse_path / 'SKSE' / 'Plugins'
                                        if plugins_path.exists():
                                            log_error(f"SKSE/Plugins exists: {plugins_path}")
                                            obody_path = plugins_path / 'OBody_NG_PDA_NG_Full_Assistance'
                                            if obody_path.exists():
                                                log_error(f"OBody_NG_PDA_NG_Full_Assistance exists: {obody_path}")
                                                standalone_mode_path = obody_path / 'Standalone Mode'
                                                if standalone_mode_path.exists():
                                                    log_error(f"Standalone Mode exists: {standalone_mode_path}")
                                                    exe_path = standalone_mode_path / 'Standalone Mode.exe'
                                                    log_error(f"Checking exe file: {exe_path} (exists: {exe_path.exists()})")
                                                else:
                                                    log_error(f"Standalone Mode directory does not exist: {standalone_mode_path}")
                                            else:
                                                log_error(f"OBody_NG_PDA_NG_Full_Assistance directory does not exist: {obody_path}")
                                        else:
                                            log_error(f"SKSE/Plugins directory does not exist: {plugins_path}")
                                else:
                                    log_error(f"SKSE path does not exist: {skse_path}")

            if not executable_path:
                log_error("ERROR: Could not find executable path in relative location or SKSE installations")
                log_error("Available SKSE paths checked:")
                # Re-leer y mostrar todas las rutas disponibles
                rute_file = Path('ini/Rute.ini')
                if rute_file.exists():
                    content = rute_file.read_text(encoding='utf-8')
                    for line in content.splitlines():
                        if '=' in line and 'SKSE_logs' in content[content.find(line)-20:content.find(line)]:
                            log_error(f"  {line.strip()}")
                self.send_response(404)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'status': 'error', 'message': 'Executable not found'}).encode('utf-8'))
                return

            # Crear script PowerShell temporal
            import tempfile

            with tempfile.NamedTemporaryFile(mode='w', suffix='.ps1', delete=False, encoding='utf-8') as ps_file:
                ps_script_path = ps_file.name

                current_dir = Path.cwd()
                log_error(f"Current working directory: {current_dir}")
                assets_dir = Path(__file__).resolve().parent
                icon_path = assets_dir / 'Data' / 'log.ico'
                log_error(f"Resolved icon path: {icon_path}")
                log_error(f"Icon exists: {icon_path.exists()}")
                if icon_path.exists():
                    log_error(f"Icon file size: {icon_path.stat().st_size} bytes")
                else:
                    log_error("Icon not found - this will cause shortcut without icon")

                icon_path_for_shortcut = icon_path
                try:
                    import ctypes
                    from ctypes import wintypes

                    def get_short_path(p: Path) -> Path:
                        GetShortPathNameW = ctypes.windll.kernel32.GetShortPathNameW
                        GetShortPathNameW.argtypes = [wintypes.LPCWSTR, wintypes.LPWSTR, wintypes.DWORD]
                        GetShortPathNameW.restype = wintypes.DWORD

                        buf_size = 260
                        while True:
                            buf = ctypes.create_unicode_buffer(buf_size)
                            needed = GetShortPathNameW(str(p), buf, buf_size)
                            if needed == 0:
                                return p
                            if needed < buf_size:
                                val = buf.value
                                return Path(val) if val else p
                            buf_size = needed + 1

                    icon_path_for_shortcut = get_short_path(icon_path)
                except Exception as e:
                    log_error(f"Warning: could not compute short path for icon: {str(e)}")

                icon_location = f"{icon_path_for_shortcut},0"
                log_error(f"IconLocation used: {icon_location}")

                # Calcular el directorio de trabajo antes de escribir el script
                import os as os_module
                working_dir = os_module.path.dirname(executable_path)
                # Leer la ruta del servidor desde Rute.ini para el segundo shortcut
                config = configparser.ConfigParser()
                rute_file = Path('ini/Rute.ini')
                server_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # fallback (raíz del mod)
                if rute_file.exists():
                    config.read(rute_file, encoding='utf-8')
                    if 'Server_rute' in config and 'rute' in config['Server_rute']:
                        server_rute = config.get('Server_rute', 'rute')
                        server_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(server_rute)))))  # subir cinco niveles para llegar a la raíz del mod
                log_error(f"DEBUG: executable working_dir: {working_dir}")
                log_error(f"DEBUG: server_dir (Mod root) from Rute.ini: {server_dir}")

                ps_file.write(f'''
$WshShell = New-Object -comObject WScript.Shell

# Primer shortcut: en el escritorio
$Shortcut1 = $WshShell.CreateShortcut("$([Environment]::GetFolderPath("Desktop"))\\OBody NG PDA Assistance.lnk")
$Shortcut1.TargetPath = "{executable_path}"
$Shortcut1.IconLocation = "{icon_location}"
$Shortcut1.Description = "OBody NG Preset Distribution Assistant - Standalone Mode"
$Shortcut1.WorkingDirectory = "{working_dir}"
$Shortcut1.Save()
Write-Host "Desktop shortcut created successfully"

# Segundo shortcut: en la raíz del mod (directorio padre de Assets)
$Shortcut2Path = "{server_dir}\\OBody NG PDA Assistance.lnk"
Write-Host "DEBUG: Creating Mod root shortcut at: $Shortcut2Path"
$Shortcut2 = $WshShell.CreateShortcut($Shortcut2Path)
$Shortcut2.TargetPath = "{executable_path}"
$Shortcut2.IconLocation = "{icon_location}"
$Shortcut2.Description = "OBody NG Preset Distribution Assistant - Standalone Mode"
$Shortcut2.WorkingDirectory = "{working_dir}"
$Shortcut2.Save()
Write-Host "Mod root folder shortcut created successfully"
''')

            log_error(f"Created PowerShell script at: {ps_script_path}")

            # Ejecutar el script PowerShell
            try:
                result = subprocess.run(
                    ['powershell.exe', '-ExecutionPolicy', 'Bypass', '-WindowStyle', 'Hidden', '-File', ps_script_path],
                    capture_output=True,
                    text=True,
                    timeout=30
                )

                log_error(f"PowerShell exit code: {result.returncode}")
                if result.stdout:
                    log_error(f"PowerShell stdout: {result.stdout}")
                    # Verificar si ambos shortcuts se crearon
                    if "Desktop shortcut created successfully" in result.stdout and "Mod root folder shortcut created successfully" in result.stdout:
                        log_error("SUCCESS: Both shortcuts created according to PowerShell output")
                    elif "Desktop shortcut created successfully" in result.stdout and "Mod root folder shortcut created successfully" not in result.stdout:
                        log_error("ERROR: Only desktop shortcut created, Mod root shortcut failed")
                    elif "Desktop shortcut created successfully" not in result.stdout and "Mod root folder shortcut created successfully" in result.stdout:
                        log_error("ERROR: Only Mod root shortcut created, desktop shortcut failed")
                    else:
                        log_error("ERROR: Neither shortcut was created successfully")
                if result.stderr:
                    log_error(f"PowerShell stderr: {result.stderr}")

                # Limpiar archivo temporal
                try:
                    import os as os_module
                    os_module.unlink(ps_script_path)
                    log_error("Temporary PowerShell script deleted")
                except:
                    log_error("Warning: Could not delete temporary script")

                if result.returncode == 0:
                    log_error("Both shortcuts created successfully")
                    self.send_response(200)
                    self.send_header('Content-type', 'application/json')
                    self.end_headers()
                    self.wfile.write(json.dumps({'status': 'success', 'message': 'Shortcuts created on desktop and mod root folder'}).encode('utf-8'))
                else:
                    log_error(f"PowerShell script failed with code {result.returncode}")
                    self.send_response(500)
                    self.send_header('Content-type', 'application/json')
                    self.end_headers()
                    self.wfile.write(json.dumps({'status': 'error', 'message': f'PowerShell error: {result.stderr}'}).encode('utf-8'))

            except subprocess.TimeoutExpired:
                log_error("PowerShell script timed out")
                self.send_response(500)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'status': 'error', 'message': 'Script execution timed out'}).encode('utf-8'))
            except Exception as e:
                log_error(f"Error executing PowerShell script: {str(e)}")
                self.send_response(500)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'status': 'error', 'message': str(e)}).encode('utf-8'))

            log_error("=== CREATE_SHORTCUTS COMPLETED ===")

        except Exception as e:
            log_error(f"ERROR in create_shortcuts: {str(e)}")
            log_error(traceback.format_exc())
            self.send_response(500)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'status': 'error', 'message': str(e)}).encode('utf-8'))

    def launch_offline_mode(self):
        try:
            log_error("=== LAUNCH_OFFLINE_MODE STARTED ===")

            # Usar la misma lógica de búsqueda que create_shortcuts()
            executable_path = None

            # PRIMERA PRIORIDAD: Buscar en ruta relativa al directorio del servidor
            server_dir = os.path.dirname(os.path.abspath(__file__))
            relative_exe_path = os.path.join(server_dir, '..', 'Standalone Mode', 'Standalone Mode.exe')
            relative_exe_path = os.path.abspath(relative_exe_path)
            log_error(f"Trying relative path first: {relative_exe_path}")

            if os.path.exists(relative_exe_path):
                executable_path = relative_exe_path
                log_error(f"SUCCESS: Found executable at relative path: {executable_path}")
            else:
                log_error(f"Relative path does not exist: {relative_exe_path}")

            # SEGUNDA PRIORIDAD: Buscar en rutas SKSE como fallback
            if not executable_path:
                log_error("Relative path not found, trying SKSE paths as fallback...")
                rute_file = Path('ini/Rute.ini')

                if rute_file.exists():
                    log_error("Reading Rute.ini to find executable path...")
                    content = rute_file.read_text(encoding='utf-8')
                    current_section = None

                    for line in content.splitlines():
                        line = line.strip()
                        if line.startswith('[') and line.endswith(']'):
                            current_section = line[1:-1]
                            log_error(f"Processing section: [{current_section}]")
                        elif '=' in line and current_section == 'SKSE_logs':
                            key, value = line.split('=', 1)
                            key = key.strip()
                            value = value.strip()
                            log_error(f"Found SKSE_logs entry: {key} = {value}")

                            # Buscar la ruta SKSE
                            if 'skse' in key.lower() or 'skyrim' in key.lower():
                                skse_path = Path(value)
                                log_error(f"Checking SKSE path: {skse_path}")
                                if skse_path.exists():
                                    log_error(f"SKSE path exists: {skse_path}")
                                    # Construir ruta al ejecutable standalone
                                    standalone_path = skse_path / 'SKSE' / 'Plugins' / 'OBody_NG_PDA_NG_Full_Assistance' / 'Standalone Mode' / 'Standalone Mode.exe'
                                    log_error(f"Constructed standalone path: {standalone_path}")
                                    if standalone_path.exists():
                                        executable_path = str(standalone_path)
                                        log_error(f"Found executable at SKSE path: {executable_path}")
                                        break
                                    else:
                                        log_error(f"Standalone executable does not exist at: {standalone_path}")

            if not executable_path:
                log_error("ERROR: Could not find executable path in relative location or SKSE installations")
                self.send_response(404)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'status': 'error', 'message': 'Executable not found'}).encode('utf-8'))
                return

            # Ejecutar el ejecutable usando subprocess.Popen con las mismas flags
            log_error(f"Launching executable: {executable_path}")
            working_dir = os.path.dirname(executable_path)

            process = subprocess.Popen(
                [executable_path],
                cwd=working_dir,
                creationflags=subprocess.CREATE_NO_WINDOW if hasattr(subprocess, 'CREATE_NO_WINDOW') else 0,
                shell=False
            )

            log_error(f"Executable launched successfully with PID: {process.pid}")
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'status': 'success', 'message': 'Offline mode launched successfully'}).encode('utf-8'))

            log_error("=== LAUNCH_OFFLINE_MODE COMPLETED ===")

        except Exception as e:
            log_error(f"ERROR in launch_offline_mode: {str(e)}")
            log_error(traceback.format_exc())
            self.send_response(500)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'status': 'error', 'message': str(e)}).encode('utf-8'))

    def load_plugins_json(self):
        try:
            with open('Json/Act2_Plugins.json', 'r', encoding='utf-8') as f:
                data = json.load(f)
            self.send_json_response(data)
        except Exception as e:
            self.send_json_response({'error': str(e)})

    def load_plugins_ini(self):
        try:
            data = {}
            with plugins_ini_lock:
                with open('ini/Act2_Plugins.ini', 'r', encoding='utf-8') as f:
                    for line in f:
                        line = line.strip()
                        if '=' in line and not line.startswith(';'):
                            plugin_name, value = line.split('=', 1)
                            plugin_name = plugin_name.strip().lstrip('!')
                            plugin_name = plugin_name.replace('\n', '').replace('\r', '').replace('\0', '').strip()
                            value = value.strip()
                            data[plugin_name] = value.lower() == 'true'
            self.send_json_response(data)
        except Exception as e:
            self.send_json_response({'error': str(e)})

    def save_plugin_selector(self, data=None):
        try:
            if data is None:
                content_length = int(self.headers.get('Content-Length', 0))
                if content_length == 0:
                    log_error("Skipping empty plugin save")
                    self.send_json_response({'status': 'success'})
                    return
                post_data = self.rfile.read(content_length)
                try:
                    data = json.loads(post_data.decode('utf-8'))
                except:
                    log_error("Invalid JSON plugin save")
                    self.send_json_response({'status': 'success'})
                    return
            plugin = str(data.get('plugin', '')).replace('\0', '').replace('\r', '').replace('\n', '').strip()
            plugin = plugin.replace('=', '').replace(';', '').strip()
            if not plugin:
                self.send_json_response({'status': 'error', 'error': 'Missing plugin'})
                return

            enabled_raw = data.get('enabled', False)
            if isinstance(enabled_raw, bool):
                enabled = enabled_raw
            elif isinstance(enabled_raw, (int, float)):
                enabled = bool(enabled_raw)
            else:
                enabled = str(enabled_raw).strip().lower() in ('1', 'true', 'yes', 'on')
            log_error(f"Saving plugin: {plugin}, enabled: {enabled}")
            with plugins_ini_lock:
                # Read the file
                lines = []
                found = False
                with open('ini/Act2_Plugins.ini', 'r', encoding='utf-8') as f:
                    for line in f:
                        stripped = line.strip()
                        if '=' in stripped and not stripped.startswith(';'):
                            p, v = stripped.split('=', 1)
                            p = p.strip()
                            if p == plugin or p == '!' + plugin:
                                # Update this line
                                lines.append(f"{plugin} = {'true' if enabled else 'false'}\n")
                                found = True
                            else:
                                lines.append(line)
                        else:
                            lines.append(line)
                if not found:
                    lines.append(f"{plugin} = {'true' if enabled else 'false'}\n")
                with open('ini/Act2_Plugins.ini', 'w', encoding='utf-8') as f:
                    f.writelines(lines)
            self.send_json_response({'status': 'success'})
        except Exception as e:
            log_error(f"Error in save_plugin_selector: {str(e)}")
            self.send_json_response({'error': str(e)})

    def save_plugin_get(self):
        try:
            query_string = self.path.split('?', 1)[1]
            qs = urllib.parse.parse_qs(query_string)
            plugin_raw = qs.get('plugin', [''])[0]
            plugin = urllib.parse.unquote(plugin_raw)
            enabled_str = qs.get('enabled', ['false'])[0].strip().lower()
            enabled = enabled_str == 'true'
            log_error(f"Saving plugin via GET: {plugin}, enabled: {enabled}")
            with plugins_ini_lock:
                # Read the file
                lines = []
                found = False
                with open('ini/Act2_Plugins.ini', 'r', encoding='utf-8') as f:
                    for line in f:
                        stripped = line.strip()
                        if '=' in stripped and not stripped.startswith(';'):
                            p, v = stripped.split('=', 1)
                            p = p.strip()
                            if p == plugin or p == '!' + plugin:
                                # Update this line
                                lines.append(f"{plugin} = {'true' if enabled else 'false'}\n")
                                found = True
                            else:
                                lines.append(line)
                        else:
                            lines.append(line)
                if not found:
                    lines.append(f"{plugin} = {'true' if enabled else 'false'}\n")
                with open('ini/Act2_Plugins.ini', 'w', encoding='utf-8') as f:
                    f.writelines(lines)
            self.send_json_response({'status': 'success'})
        except Exception as e:
            log_error(f"Error in save_plugin_get: {str(e)}")
            self.send_json_response({'error': str(e)})

    def set_plugin_list_true_handler(self):
        try:
            set_plugin_list_true()
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'status': 'success'}).encode('utf-8'))
        except Exception as e:
            log_error(f"ERROR in set_plugin_list_true_handler: {str(e)}")
            self.send_response(500)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'status': 'error', 'message': str(e)}).encode('utf-8'))

    def set_npc_list_true(self):
        """Establece Plugin_listNPCs = true en Act2_Manager.ini y programa el reset automático"""
        try:
            log_error("=== SET_NPC_LIST_TRUE STARTED ===")
            ini_file = Path('ini/Act2_Manager.ini')
            log_error(f"Looking for INI file: {ini_file.absolute()}")

            with act2_ini_lock:
                lines = []
                found = False
                section_start = None
                if ini_file.exists():
                    with open(ini_file, 'r', encoding='utf-8') as f:
                        for line in f:
                            line_lower = line.lower().strip()
                            if line_lower == '[plugin_npcs]':
                                section_start = len(lines)
                            if 'plugin_listnpcs' in line_lower:
                                lines.append('Plugin_listNPCs = true\n')
                                found = True
                            else:
                                lines.append(line)
                if not found:
                    if section_start is not None:
                        insert_pos = len(lines)
                        for j in range(section_start, len(lines)):
                            if lines[j].strip().lower().startswith('['):
                                insert_pos = j
                                break
                        lines.insert(insert_pos, 'Plugin_listNPCs = true\n')
                    else:
                        lines.append('[Plugin_NPCs]\nPlugin_listNPCs = true\n')
                ini_file.parent.mkdir(exist_ok=True)
                with open(ini_file, 'w', encoding='utf-8') as f:
                    f.writelines(lines)
            log_error("Setting Plugin_NPCs Plugin_listNPCs to true")

            # Gestionar temporizador de auto-reset
            global plugin_npcs_time
            plugin_npcs_time = time.time()

            log_error("Act2_Manager.ini updated")

            log_error("Sending success response...")
            # This will be called from the handler, so no direct response here

        except Exception as e:
            log_error(f"ERROR in set_npc_list_true: {str(e)}")
            log_error(traceback.format_exc())
            # Error handling will be in the handler

    def set_npc_list_true_handler(self):
        try:
            self.set_npc_list_true()
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'status': 'success'}).encode('utf-8'))
        except Exception as e:
            log_error(f"ERROR in set_npc_list_true_handler: {str(e)}")
            self.send_response(500)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'status': 'error', 'message': str(e)}).encode('utf-8'))

    def load_npcs_json(self):
        try:
            with open('Json/Act2_NPCs.json', 'r', encoding='utf-8') as f:
                data = json.load(f)
            self.send_json_response(data)
        except Exception as e:
            self.send_json_response({'error': str(e)})

    def load_npcs_ini(self):
        try:
            data = {}
            with plugins_ini_lock:
                with open('ini/Act2_NPCs.ini', 'r', encoding='utf-8') as f:
                    for line in f:
                        line = line.strip()
                        if '=' in line and not line.startswith(';'):
                            plugin_name, value = line.split('=', 1)
                            plugin_name = plugin_name.strip()
                            plugin_name = plugin_name.replace('\n', '').replace('\r', '').replace('\0', '').strip()
                            value = value.strip()
                            enabled = value.lower() == 'true'
                            data[plugin_name] = enabled
                            if plugin_name.startswith('!'):
                                data[plugin_name.lstrip('!')] = enabled
                            else:
                                data['!' + plugin_name] = enabled
            self.send_json_response(data)
        except Exception as e:
            self.send_json_response({'error': str(e)})

    def save_npc_plugin_selector(self, data=None):
        try:
            if data is None:
                content_length = int(self.headers.get('Content-Length', 0))
                if content_length == 0:
                    self.send_json_response({'status': 'success'})
                    return
                post_data = self.rfile.read(content_length)
                data = json.loads(post_data.decode('utf-8'))

            plugin_input = str(data.get('plugin', '')).replace('\0', '').replace('\r', '').replace('\n', '').strip()
            plugin_input = plugin_input.replace('=', '').replace(';', '').strip()
            if not plugin_input:
                self.send_json_response({'status': 'error', 'error': 'Missing plugin'})
                return

            enabled_raw = data.get('enabled', False)
            if isinstance(enabled_raw, bool):
                enabled = enabled_raw
            elif isinstance(enabled_raw, (int, float)):
                enabled = bool(enabled_raw)
            else:
                enabled = str(enabled_raw).strip().lower() in ('1', 'true', 'yes', 'on')

            plugin_base = plugin_input.lstrip('!')
            variants = {plugin_input, plugin_base, '!' + plugin_base}

            with plugins_ini_lock:
                lines = []
                found = False
                with open('ini/Act2_NPCs.ini', 'r', encoding='utf-8') as f:
                    for line in f:
                        stripped = line.strip()
                        if '=' in stripped and not stripped.startswith(';'):
                            p, v = stripped.split('=', 1)
                            p = p.strip()
                            if p in variants:
                                lines.append(f"{p} = {'true' if enabled else 'false'}\n")
                                found = True
                            else:
                                lines.append(line)
                        else:
                            lines.append(line)

                if not found:
                    lines.append(f"{plugin_input} = {'true' if enabled else 'false'}\n")

                with open('ini/Act2_NPCs.ini', 'w', encoding='utf-8') as f:
                    f.writelines(lines)

            self.send_json_response({'status': 'success'})
        except Exception as e:
            log_error(f"Error in save_npc_plugin_selector: {str(e)}")
            self.send_json_response({'error': str(e)})

    def load_pda_plugins_json(self):
        try:
            with open('Json/Act2_PDA_Plugins.json', 'r', encoding='utf-8') as f:
                data = json.load(f)
            self.send_json_response(data)
        except Exception as e:
            self.send_json_response({'error': str(e)})

    def load_pda_plugins_json(self):
        try:
            with open('Json/Act2_PDA_Plugins.json', 'r', encoding='utf-8') as f:
                data = json.load(f)
            self.send_json_response(data)
        except Exception as e:
            self.send_json_response({'error': str(e)})

    def save_npc_plugin_get(self):
        try:
            query_string = self.path.split('?', 1)[1]
            qs = urllib.parse.parse_qs(query_string)
            plugin_raw = qs.get('plugin', [''])[0]
            plugin = urllib.parse.unquote(plugin_raw)
            plugin = str(plugin).replace('\0', '').replace('\r', '').replace('\n', '').strip()
            plugin = plugin.replace('=', '').replace(';', '').strip()

            enabled_raw = qs.get('enabled', ['false'])[0]
            enabled = str(enabled_raw).strip().lower() in ('1', 'true', 'yes', 'on')
            log_error(f"Saving NPC plugin via GET: {plugin}, enabled: {enabled}")

            plugin_base = plugin.lstrip('!')
            variants = {plugin, plugin_base, '!' + plugin_base}
            with plugins_ini_lock:
                # Read the file
                lines = []
                found = False
                with open('ini/Act2_NPCs.ini', 'r', encoding='utf-8') as f:
                    for line in f:
                        stripped = line.strip()
                        if '=' in stripped and not stripped.startswith(';'):
                            p, v = stripped.split('=', 1)
                            p = p.strip()
                            if p in variants:
                                # Update this line
                                lines.append(f"{p} = {'true' if enabled else 'false'}\n")
                                found = True
                            else:
                                lines.append(line)
                        else:
                            lines.append(line)
                if not found:
                    lines.append(f"{plugin} = {'true' if enabled else 'false'}\n")
                with open('ini/Act2_NPCs.ini', 'w', encoding='utf-8') as f:
                    f.writelines(lines)
            self.send_json_response({'status': 'success'})
        except Exception as e:
            log_error(f"Error in save_npc_plugin_get: {str(e)}")
            self.send_json_response({'error': str(e)})

    def load_styles_headers(self):
        try:
            styles_file = Path('ini/styles_headers.ini')
            data = {}

            if styles_file.exists():
                config = configparser.ConfigParser()
                config.read(styles_file, encoding='utf-8')
                if 'Styles_Headers' in config:
                    for key, value in config['Styles_Headers'].items():
                        data[key] = value

            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'status': 'success', 'data': data}).encode('utf-8'))
        except Exception as e:
            log_error(f"ERROR in load_styles_headers: {str(e)}")
            self.send_response(500)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'status': 'error', 'message': str(e)}).encode('utf-8'))

    def save_styles_headers(self):
        try:
            content_length = int(self.headers.get('Content-Length', 0))
            try:
                post_data = self.rfile.read(content_length)
            except (ConnectionError, OSError) as conn_err:
                if '10053' in str(conn_err) or 'connection reset' in str(conn_err).lower():
                    log_error(f"Connection reset during read: {str(conn_err)}")
                    self.send_response(200)
                    self.send_header('Content-type', 'application/json')
                    self.end_headers()
                    self.wfile.write(json.dumps({'status': 'success', 'skipped': True}).encode('utf-8'))
                    return
                else:
                    raise

            if len(post_data) == 0:
                log_error("Skipping empty POST")
                self.send_json_response({'status': 'success'})
                return

            try:
                data = json.loads(post_data.decode('utf-8'))
            except json.JSONDecodeError:
                data = {}

            styles_data = data.get('styles', {})

            if not styles_data or len(styles_data) == 0:
                log_error("Skipping empty styles data")
                self.send_json_response({'status': 'success'})
                return

            # Load current INI to compare
            styles_file = Path('ini/styles_headers.ini')
            current_styles = {}
            if styles_file.exists():
                config = configparser.ConfigParser()
                config.read(styles_file, encoding='utf-8')
                if 'Styles_Headers' in config:
                    for key, value in config['Styles_Headers'].items():
                        current_styles[key] = value

            # If styles_data is the same as current, skip writing
            if styles_data == current_styles:
                log_error("Styles unchanged, skipping write")
                self.send_json_response({'status': 'success'})
                return

            config = configparser.ConfigParser()
            config.add_section('Styles_Headers')

            for key, value in styles_data.items():
                config.set('Styles_Headers', key, value)

            styles_file.parent.mkdir(exist_ok=True)

            with open(styles_file, 'w', encoding='utf-8') as f:
                config.write(f)

            self.send_json_response({'status': 'success'})
        except Exception as e:
            log_error(f"ERROR in save_styles_headers: {str(e)}")
            self.send_json_response({'status': 'error', 'message': str(e)})

    def load_additional_config(self):
        """Load additional configuration data"""
        try:
            # Placeholder for future configuration data
            data = {}
            self.send_json_response({'status': 'success', 'data': data})
        except Exception as e:
            log_error(f"Error loading additional config: {str(e)}")
            self.send_json_response({'status': 'error', 'message': str(e)})

    def save_additional_config(self, data):
        """Save additional configuration data"""
        try:
            # Placeholder for future configuration saving
            return {'status': 'success', 'message': 'Additional config saved'}
        except Exception as e:
            log_error(f"Error saving additional config: {str(e)}")
            return {'status': 'error', 'message': str(e)}

    def load_future_content(self):
        """Load future content configuration data"""
        try:
            # Placeholder for future content data
            data = {}
            self.send_json_response({'status': 'success', 'data': data})
        except Exception as e:
            log_error(f"Error loading future content: {str(e)}")
            self.send_json_response({'status': 'error', 'message': str(e)})

    def save_future_content(self, data):
        """Save future content configuration data"""
        try:
            # Placeholder for future content saving
            return {'status': 'success', 'message': 'Future content saved'}
        except Exception as e:
            log_error(f"Error saving future content: {str(e)}")
            return {'status': 'error', 'message': str(e)}

    def load_generated_rules(self):
        try:
            with open('Json/generated_rules.json', 'r', encoding='utf-8') as f:
                data = json.load(f)
            self.send_json_response(data)
        except Exception as e:
            self.send_json_response({'error': str(e)})

    def load_port_restart(self):
        """Load port from PORT_Restart_server.ini"""
        try:
            config = configparser.ConfigParser()
            ini_path = Path('ini/PORT_Restart_server.ini')
            if ini_path.exists():
                config.read(ini_path, encoding='utf-8')
                try:
                    port = config.getint('PORT_new', 'PORT_new')
                except (configparser.NoSectionError, configparser.NoOptionError):
                    port = PORT
                self.send_json_response({'status': 'success', 'port': port})
            else:
                self.send_json_response({'status': 'success', 'port': PORT})
        except Exception as e:
            log_error(f"Error loading port restart: {str(e)}")
            self.send_json_response({'status': 'error', 'message': str(e)})

    def load_port_master(self):
        try:
            port_from_json = _get_port_from_port_json()
            data = ensure_port_master_json(port_from_json if port_from_json is not None else PORT)
            self_service, self_reason, self_do_not_use = _get_self_service_info()
            self.send_json_response({
                'status': 'success',
                'data': data,
                'self_service': self_service,
                'self_reason': self_reason,
                'self_port_do_not_use': self_do_not_use
            })
        except Exception as e:
            log_error(f"Error loading port master: {str(e)}")
            self.send_json_response({'status': 'error', 'message': str(e)})

    def save_port_restart(self, data):
        """Save port to PORT_Restart_server.ini"""
        try:
            port = data.get('port')
            if port is None:
                self.send_json_response({'status': 'error', 'message': 'Port is required'})
                return
            try:
                port = int(port)
            except ValueError:
                self.send_json_response({'status': 'error', 'message': 'Port must be a valid integer'})
                return
            is_valid, message = validate_port_against_master(port)
            if not is_valid:
                self.send_json_response({'status': 'error', 'message': message or 'Invalid port'})
                return

            config = configparser.ConfigParser()
            ini_path = Path('ini/PORT_Restart_server.ini')

            if ini_path.exists():
                config.read(ini_path, encoding='utf-8')

            if 'PORT_new' not in config:
                config.add_section('PORT_new')

            config.set('PORT_new', 'PORT_new', str(port))

            ini_path.parent.mkdir(exist_ok=True)
            with open(ini_path, 'w', encoding='utf-8') as f:
                config.write(f)

            ensure_port_master_json(port)
            self.send_json_response({'status': 'success'})

            ps1_path = Path('tools/Restart_server.ps1').absolute()
            subprocess.Popen(
                ['powershell.exe', '-ExecutionPolicy', 'Bypass', '-WindowStyle', 'Hidden', '-File', str(ps1_path)],
                creationflags=subprocess.CREATE_NO_WINDOW,
                shell=False
            )
            os._exit(0)
        except Exception as e:
            log_error(f"Error saving port restart: {str(e)}")
            self.send_json_response({'status': 'error', 'message': str(e)})
            return

    def restart_server(self):
        """Execute PowerShell script to restart server"""
        try:
            ps1_path = Path('tools/Restart_server.ps1').absolute()
            if not ps1_path.exists():
                log_error(f"PowerShell script not found: {ps1_path}")
                return {'status': 'error', 'message': f'PowerShell script not found: {ps1_path}'}

            log_error(f"Executing PowerShell script: {ps1_path}")
            subprocess.Popen(
                ['powershell.exe', '-ExecutionPolicy', 'Bypass', '-WindowStyle', 'Hidden', '-File', str(ps1_path)],
                creationflags=subprocess.CREATE_NO_WINDOW,
                shell=False
            )
            log_error("PS1 launched asynchronously, shutting down server")
            os._exit(0)
            return {'status': 'success', 'message': 'Server restart initiated successfully'}
        except Exception as e:
            log_error(f"Error executing PowerShell script: {str(e)}")
            return {'status': 'error', 'message': str(e)}

    def run_folder_script(self):
        try:
            root_path = None
            try:
                config = configparser.ConfigParser()
                rute_ini = Path('ini/Rute.ini')
                if rute_ini.exists():
                    config.read(rute_ini, encoding='utf-8')
                    if 'Server_rute' in config and 'rute' in config['Server_rute']:
                        pyw_path = Path(config['Server_rute']['rute'])
                        for parent in pyw_path.parents:
                            if parent.name.lower() == 'skse':
                                root_path = parent.parent
                                break
            except Exception as e:
                log_error(f"Error reading Rute.ini for folder script: {e}")

            if not root_path:
                root_path = get_install_root_folder()

            if not root_path or not root_path.exists():
                raise Exception(f"Could not determine or find root folder: {root_path}")

            log_error(f"Opening root folder: {root_path}")
            os.startfile(root_path)

            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({
                'status': 'success',
                'message': f'Folder opened: {root_path}'
            }).encode('utf-8'))

        except Exception as e:
            log_error(f"ERROR executing folder action: {e}")
            self.send_response(500)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({
                'status': 'error',
                'message': str(e)
            }).encode('utf-8'))

    def open_manager_mcm_folder(self):
        try:
            manager_path = _get_manager_mcm_dir()
            if not manager_path.exists() or not manager_path.is_dir():
                raise Exception(f"Folder not found: {manager_path}")

            log_error(f"Opening Manager_MCM folder: {manager_path}")
            os.startfile(manager_path)

            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({
                'status': 'success',
                'message': f'Folder opened: {manager_path}'
            }).encode('utf-8'))
        except Exception as e:
            log_error(f"ERROR opening Manager_MCM folder: {e}")
            self.send_response(500)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({
                'status': 'error',
                'message': str(e)
            }).encode('utf-8'))

    def run_open_script(self):
        try:
            ps1_path = Path('tools/Rule_Generator_open.ps1').absolute()

            if not ps1_path.exists():
                self.send_response(404)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({
                    'status': 'error',
                    'message': f'PS1 not found at {ps1_path}'
                }).encode('utf-8'))
                return

            subprocess.Popen(
                ['powershell.exe', '-ExecutionPolicy', 'Bypass', '-WindowStyle', 'Hidden', '-File', str(ps1_path)],
                creationflags=subprocess.CREATE_NO_WINDOW,
                shell=False
            )

            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({
                'status': 'success',
                'message': 'Open script executed'
            }).encode('utf-8'))

        except Exception as e:
            log_error(f"ERROR executing open script: {e}")
            self.send_response(500)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({
                'status': 'error',
                'message': str(e)
            }).encode('utf-8'))

    def run_sandbox_export_script(self):
        try:
            ok, info = _export_sandbox_ini_via_save_dialog()
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({
                'status': 'success' if ok else 'cancelled',
                'message': info
            }).encode('utf-8'))

        except Exception as e:
            log_error(f"ERROR exporting sandbox rules: {e}")
            self.send_response(500)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({
                'status': 'error',
                'message': str(e)
            }).encode('utf-8'))

    def run_sandbox_open_script(self):
        try:
            default_dir = _get_mod_root_dir()
            selected = _show_open_ini_dialog(default_dir)
            if selected is None or not selected.exists() or not selected.is_file():
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({
                    'status': 'cancelled',
                    'message': 'No INI file selected'
                }).encode('utf-8'))
                return

            try:
                data = selected.read_bytes()
                content = data.decode('utf-8-sig', errors='ignore')
            except Exception:
                content = selected.read_text(encoding='utf-8', errors='ignore')

            sandbox_ini_path = Path('ini/OBodyNG_PDA_Sandbox_temp.ini')
            sandbox_ini_path.parent.mkdir(exist_ok=True)
            sandbox_ini_path.write_text(content, encoding='utf-8')

            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({
                'status': 'success',
                'message': 'Sandbox INI loaded',
                'content': content
            }).encode('utf-8'))
        except Exception as e:
            log_error(f"ERROR opening sandbox INI: {e}")
            self.send_response(500)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({
                'status': 'error',
                'message': str(e)
            }).encode('utf-8'))

    def run_mod_pack_script(self):
        try:
            default_dir = _get_mod_root_dir()
            selected_files = _show_open_ini_multiselect_dialog(default_dir)
            selected_files = [p for p in selected_files if isinstance(p, Path)]
            selected_files = [p for p in selected_files if p.exists() and p.is_file()]
            selected_files = [p for p in selected_files if p.suffix.lower() == '.ini']

            if not selected_files:
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({
                    'status': 'cancelled',
                    'message': 'No INI files selected'
                }).encode('utf-8'))
                return

            default_zip_name = 'ModPack.zip'
            try:
                stem = selected_files[0].stem.strip()
                if stem:
                    default_zip_name = f'{stem}.zip'
            except Exception:
                pass

            zip_path = _show_save_zip_dialog(default_dir, default_zip_name)
            if zip_path is None:
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({
                    'status': 'cancelled',
                    'message': 'Cancelled'
                }).encode('utf-8'))
                return

            try:
                zip_path.parent.mkdir(parents=True, exist_ok=True)
            except Exception:
                pass

            used_names = set()
            with zipfile.ZipFile(zip_path, 'w', compression=zipfile.ZIP_DEFLATED) as zf:
                for i, p in enumerate(selected_files):
                    arcname = p.name
                    if arcname in used_names:
                        arcname = f'{p.stem}_{i}{p.suffix}'
                    used_names.add(arcname)
                    zf.write(p, arcname=arcname)

            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({
                'status': 'success',
                'message': f'Mod pack created: {zip_path}'
            }).encode('utf-8'))

        except Exception as e:
            log_error(f"ERROR executing mod pack script: {e}")
            self.send_response(500)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({
                'status': 'error',
                'message': str(e)
            }).encode('utf-8'))

    def upload_ini(self):
        global temp_ini_content, new_temp_content_available
        log_error("POST request received for /upload-ini")
        try:
            # Parse multipart form data
            content_type = self.headers.get('Content-Type', '')
            if not content_type.startswith('multipart/form-data'):
                log_error("Invalid content type for /upload-ini")
                self.send_response(400)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({
                    'status': 'error',
                    'message': 'Invalid content type'
                }).encode('utf-8'))
                return

            # Simple multipart parser for file upload
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length)

            # Find the file content (simplified parser)
            boundary = content_type.split('boundary=')[1].encode()
            parts = body.split(boundary)

            file_content = None
            for part in parts:
                if b'filename=' in part and b'.ini' in part.lower():
                    # Extract file content
                    content_start = part.find(b'\r\n\r\n')
                    if content_start != -1:
                        file_content = part[content_start + 4:].split(b'\r\n--' + boundary)[0].rstrip(b'\r\n')
                        break

            if file_content is None:
                log_error("No INI file found in multipart upload")
                self.send_response(400)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({
                    'status': 'error',
                    'message': 'No INI file found in upload'
                }).encode('utf-8'))
                return

            # Decode content
            try:
                ini_content = file_content.decode('utf-8', errors='ignore')
            except Exception as decode_error:
                log_error(f"Error decoding INI file content: {str(decode_error)}")
                raise

            # Remove trailing "--" line if present
            lines = ini_content.splitlines()
            if lines and lines[-1].strip() == '--':
                lines = lines[:-1]
                ini_content = '\n'.join(lines)

            # Save to temp file
            try:
                temp_ini_path = Path('ini/OBodyNG_PDA_temp.ini')
                temp_ini_path.parent.mkdir(exist_ok=True)
                with open(temp_ini_path, 'w', encoding='utf-8') as f:
                    f.write(ini_content)
            except Exception as save_error:
                log_error(f"Error saving INI file to temp location: {str(save_error)}")
                raise

            # Update global variables
            temp_ini_content = ini_content
            new_temp_content_available = True

            log_error("INI file uploaded and saved to temp")

            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({
                'status': 'success',
                'message': 'INI file uploaded successfully'
            }).encode('utf-8'))

        except Exception as e:
            log_error(f"ERROR uploading INI file: {e}")
            self.send_response(500)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({
                'status': 'error',
                'message': str(e)
            }).encode('utf-8'))

    def load_temp_ini(self):
        """Load temporary INI content that was loaded by the monitor"""
        try:
            global temp_ini_content
            self.send_json_response({'status': 'success', 'content': temp_ini_content})
        except Exception as e:
            log_error(f"Error loading temp INI: {str(e)}")
            self.send_json_response({'status': 'error', 'message': str(e)})

    def check_new_temp_content(self):
        """Check if there's new temporary INI content available"""
        try:
            global new_temp_content_available
            has_new_content = new_temp_content_available
            if has_new_content:
                new_temp_content_available = False  # Reset flag after checking
            self.send_json_response({'status': 'success', 'has_new_content': has_new_content})
        except Exception as e:
            log_error(f"Error checking new temp content: {str(e)}")
            self.send_json_response({'status': 'error', 'message': str(e)})

    def load_sandbox_ini(self):
        """Load sandbox INI content from OBodyNG_PDA_Sandbox_temp.ini"""
        try:
            sandbox_ini_path = Path('ini/OBodyNG_PDA_Sandbox_temp.ini')
            content = ""
            if sandbox_ini_path.exists():
                content = sandbox_ini_path.read_text(encoding='utf-8')
            self.send_json_response({'status': 'success', 'content': content})
        except Exception as e:
            log_error(f"Error loading sandbox INI: {str(e)}")
            self.send_json_response({'status': 'error', 'message': str(e)})

    def save_sandbox_ini(self, data):
        """Save sandbox INI content to OBodyNG_PDA_Sandbox_temp.ini"""
        try:
            content = data.get('content', '')

            sandbox_ini_path = Path('ini/OBodyNG_PDA_Sandbox_temp.ini')
            sandbox_ini_path.parent.mkdir(exist_ok=True)
            sandbox_ini_path.write_text(content, encoding='utf-8')

            log_error(f"Successfully saved sandbox INI to 'Assets/ini/OBodyNG_PDA_Sandbox_temp.ini'. Content: {content[:500]}{'...' if len(content) > 500 else ''}")

            self.send_json_response({'status': 'success'})
            return
        except Exception as e:
            log_error(f"Error saving sandbox INI to 'Assets/ini/OBodyNG_PDA_Sandbox_temp.ini'. Error details: {str(e)}")
            self.send_json_response({'status': 'error', 'message': str(e)})
            return

def _auto_export_default_ini_on_startup():
    try:
        default_dir = _get_mod_root_dir()
        target_path = (default_dir / 'OBodyNG_PDA_(your_name).ini')

        temp_rule_ini_path = Path('ini/OBodyNG_PDA_temp.ini')
        sandbox_ini_path = Path('ini/OBodyNG_PDA_Sandbox_temp.ini')

        content = ''
        try:
            if temp_rule_ini_path.exists():
                content = temp_rule_ini_path.read_text(encoding='utf-8', errors='ignore')
        except Exception:
            content = ''

        if not content:
            try:
                if sandbox_ini_path.exists():
                    content = sandbox_ini_path.read_text(encoding='utf-8', errors='ignore')
            except Exception:
                content = ''

        try:
            target_path.parent.mkdir(parents=True, exist_ok=True)
        except Exception:
            pass

        target_path.write_text(content or '', encoding='utf-8')
        log_error(f"Auto-exported default INI: {target_path}")
    except Exception as e:
        log_error(f"ERROR auto-exporting default INI: {e}")

def _auto_export_explanations_ini_on_startup():
    try:
        default_dir = _get_mod_root_dir()
        target_path = (default_dir / 'PDA_explanations.ini')

        source_path = (ASSETS_DIR / 'Data' / 'PDA_explanations.ini')
        content = ''
        try:
            if source_path.exists():
                content = source_path.read_text(encoding='utf-8-sig', errors='ignore')
        except Exception:
            content = ''

        try:
            target_path.parent.mkdir(parents=True, exist_ok=True)
        except Exception:
            pass

        target_path.write_text(content or '', encoding='utf-8')
        log_error(f"Auto-exported explanations INI: {target_path}")
    except Exception as e:
        log_error(f"ERROR auto-exporting explanations INI: {e}")

if __name__ == '__main__':
    log_error("="*60)
    log_error("SERVER STARTING")
    log_error("="*60)
    _auto_export_explanations_ini_on_startup()
    
    game_log_thread = threading.Thread(target=check_game_log, daemon=True)
    shutdown_thread = threading.Thread(target=check_shutdown, daemon=True)
    enable_save_thread = threading.Thread(target=check_enable_save, daemon=True)
    
    game_log_thread.start()
    log_error("Dead Man Switch thread started")
    
    shutdown_thread.start()
    log_error("Shutdown monitor thread started")
    
    enable_save_thread.start()
    log_error("EnableSave monitor thread started")

    rule_generator_thread = threading.Thread(target=monitor_rule_generator, daemon=True)
    rule_generator_thread.start()
    log_error("Rule generator monitor thread started")

    temp_ini_monitor_thread = threading.Thread(target=monitor_temp_ini_changes, daemon=True)
    temp_ini_monitor_thread.start()
    log_error("Temp INI changes monitor thread started")

    start_timer_thread = threading.Thread(target=monitor_start_timers, daemon=True)
    start_timer_thread.start()
    log_error("Start timer monitor thread started")

    plugins_sync_thread = threading.Thread(target=sync_plugins_ini_json, daemon=True)
    plugins_sync_thread.start()
    log_error("Plugins sync thread started")

    npcs_sync_thread = threading.Thread(target=sync_npcs_ini_json, daemon=True)
    npcs_sync_thread.start()
    log_error("NPCs sync thread started")

    backup_sync_thread = threading.Thread(target=sync_backup_folders, daemon=True)
    backup_sync_thread.start()
    log_error("Backup sync thread started")

    log_error(f"Server running on http://localhost:{PORT}")

    # Start update check after 5 seconds in a separate thread
    def delayed_update_check():
        time.sleep(5)
        check_for_updates()

    update_thread = threading.Thread(target=delayed_update_check, daemon=True)
    update_thread.start()

    with ThreadedTCPServer(("127.0.0.1", PORT), ModManagerHandler) as httpd:
        httpd.serve_forever()
