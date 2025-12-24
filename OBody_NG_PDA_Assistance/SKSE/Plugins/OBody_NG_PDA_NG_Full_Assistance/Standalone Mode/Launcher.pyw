import subprocess
import os
import sys
import threading
import time
from pathlib import Path
import json
import ctypes
import tkinter as tk
import winsound

# Detectar si se ejecuta como EXE o .pyw
if getattr(sys, 'frozen', False):
    # Ejecutando como EXE
    script_dir = Path(sys.executable).parent
else:
    # Ejecutando como .pyw
    script_dir = Path(__file__).parent.absolute()

# Rutas corregidas - El .pyw está en "Standalone Mode"
# Los Assets están un nivel arriba
parent_dir = script_dir.parent
assets_dir = parent_dir / "Assets"

ps1_file = assets_dir / "start.ps1"
gif_file = assets_dir / "Data" / "013.gif"
project_python_exe = assets_dir / "python" / "python.exe"
sound_file = assets_dir / "Sound" / "miau-PDA.wav"

splash_window = None
gif_size = None

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

        folderid_documents = _guid_from_string('{FDD39AD0-238F-46AF-ADB4-6C85480369C7}')
        p_path = ctypes.c_wchar_p()
        hr = shell32.SHGetKnownFolderPath(ctypes.byref(folderid_documents), 0, None, ctypes.byref(p_path))
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

def _read_port_json(port_json_path: Path):
    try:
        if not port_json_path.exists() or not port_json_path.is_file():
            return None
        with open(port_json_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        if not isinstance(data, dict):
            return None
        port = data.get('port')
        if port is None:
            return None
        port_int = int(port)
        if port_int < 0 or port_int > 65535:
            return None
        return port_int
    except Exception:
        return None

def _best_effort_firewall_rule(port: int):
    try:
        port_str = str(int(port))
    except Exception:
        return
    try:
        subprocess.run(
            [
                "netsh", "advfirewall", "firewall", "delete", "rule",
                f"name=SkyrimModManager"
            ],
            creationflags=subprocess.CREATE_NO_WINDOW,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            shell=False,
            check=False
        )
        subprocess.run(
            [
                "netsh", "advfirewall", "firewall", "add", "rule",
                f"name=SkyrimModManager",
                "dir=in",
                "action=allow",
                "protocol=TCP",
                f"localport={port_str}",
                "profile=private"
            ],
            creationflags=subprocess.CREATE_NO_WINDOW,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            shell=False,
            check=False
        )
    except Exception:
        return

def animate_gif(label, gif, frame_num, duration):
    global splash_window
    if splash_window is None:
        return
    try:
        frame = gif[frame_num]
        label.config(image=frame)
        label.image = frame
        next_frame = (frame_num + 1) % len(gif)
        label.after(duration, animate_gif, label, gif, next_frame, duration)
    except:
        pass

def show_gif_splash():
    global splash_window, gif_size
    if not gif_file.exists():
        print("ERROR: GIF not found at", gif_file)
        return
    
    try:
        splash_window = tk.Tk()
        splash_window.overrideredirect(True)
        splash_window.config(bg='white')
        splash_window.attributes('-transparentcolor', 'white')

        frames = []
        frame_index = 0
        while True:
            try:
                frame = tk.PhotoImage(file=str(gif_file), format=f"gif -index {frame_index}")
            except tk.TclError:
                break
            frames.append(frame)
            frame_index += 1
        if not frames:
            raise RuntimeError("No GIF frames loaded")

        gif_size = (frames[0].width(), frames[0].height())
        duration = 100
        
        screen_width = splash_window.winfo_screenwidth()
        screen_height = splash_window.winfo_screenheight()
        x = (screen_width // 2) - (gif_size[0] // 2)
        y = (screen_height // 2) - (gif_size[1] // 2)
        
        splash_window.geometry(f"{gif_size[0]}x{gif_size[1]}+{x}+{y}")
        splash_window.attributes('-alpha', 0)
        splash_window.attributes('-topmost', True)
        
        label = tk.Label(splash_window, image=frames[0], bg='white', bd=0, highlightthickness=0)
        label.image = frames[0]
        label.pack()
        
        splash_window.after(100, lambda: splash_window.attributes('-alpha', 1))
        splash_window.after(150, animate_gif, label, frames, 1, duration)
        splash_window.after(5000, lambda: splash_window.destroy() if splash_window else None)
        
        splash_window.mainloop()
        splash_window = None
        gif_size = None
        
    except Exception as e:
        print(f"Error showing GIF: {e}")
        if splash_window:
            splash_window.destroy()
        splash_window = None
        gif_size = None

# Reproducir sonido
if sound_file.exists():
    winsound.PlaySound(str(sound_file), winsound.SND_FILENAME | winsound.SND_ASYNC)

# Start splash in background
thread_gif = threading.Thread(target=show_gif_splash)
thread_gif.start()
time.sleep(0.5)

# Validar que exista python.exe antes de continuar
if not project_python_exe.exists():
    print(f"ERROR: Python executable not found at: {project_python_exe}")
    sys.exit(1)

manager_mcm_dir = _get_manager_mcm_dir()
backup_port_json = manager_mcm_dir / 'PDA' / 'Json' / 'port.json'
assets_port_json = assets_dir / 'Json' / 'port.json'

port = _read_port_json(backup_port_json)
if port is None:
    port = _read_port_json(assets_port_json)
if port is None:
    port = 6050

try:
    (assets_dir / 'Json').mkdir(exist_ok=True)
except Exception:
    pass
try:
    (assets_dir / 'ini').mkdir(exist_ok=True)
except Exception:
    pass

try:
    off_file = assets_dir / 'ini' / 'off.ini'
    off_file.write_text('on', encoding='utf-8')
except Exception:
    pass

_best_effort_firewall_rule(port)

try:
    subprocess.Popen(
        [str(project_python_exe), "server.pyw"],
        creationflags=subprocess.CREATE_NO_WINDOW,
        cwd=str(assets_dir),
        shell=False
    )
except Exception:
    sys.exit(1)

time.sleep(2)
try:
    os.startfile(f"http://localhost:{port}")
except Exception:
    pass
