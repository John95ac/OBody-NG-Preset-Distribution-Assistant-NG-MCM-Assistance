import subprocess
import os
import sys
import threading
import time
from pathlib import Path
import tkinter as tk
from PIL import Image, ImageTk
import winsound

# Detectar si se ejecuta como EXE o .pyw
if getattr(sys, 'frozen', False):
    script_dir = Path(sys.executable).parent
else:
    script_dir = Path(__file__).parent.absolute()

assets_dir = script_dir / "Assets"
ps1_file = assets_dir / "start.ps1"
gif_file = assets_dir / "Data" / "013.gif"
project_python_exe = assets_dir / "python" / "python.exe"
sound_file = assets_dir / "Sound" / "miau-PDA.wav"

splash_window = None
gif_size = None

def animate_gif(label, gif, frame_num, duration):
    global splash_window
    if splash_window is None:
        return
    try:
        gif.seek(frame_num)
        frame = gif.convert("RGBA").resize(gif_size, Image.Resampling.LANCZOS)
        photo = ImageTk.PhotoImage(frame)
        label.config(image=photo)
        label.image = photo
        next_frame = (frame_num + 1) % gif.n_frames
        label.after(duration, animate_gif, label, gif, next_frame, duration)
    except:
        pass

def show_gif_splash():
    global splash_window, gif_size
    if not gif_file.exists():
        print("ERROR: GIF not found at", gif_file)
        return
    try:
        gif = Image.open(gif_file)
        gif_size = gif.size
        duration = gif.info.get('duration', 100)
        splash_window = tk.Tk()
        splash_window.overrideredirect(True)
        splash_window.config(bg='white')
        splash_window.attributes('-transparentcolor', 'white')
        screen_width = splash_window.winfo_screenwidth()
        screen_height = splash_window.winfo_screenheight()
        x = (screen_width // 2) - (gif_size[0] // 2)
        y = (screen_height // 2) - (gif_size[1] // 2)
        splash_window.geometry(f"{gif_size[0]}x{gif_size[1]}+{x}+{y}")
        splash_window.attributes('-alpha', 0)
        splash_window.attributes('-topmost', True)
        gif.seek(0)
        photo = ImageTk.PhotoImage(gif.convert("RGBA"))
        label = tk.Label(splash_window, image=photo, bg='white', bd=0, highlightthickness=0)
        label.image = photo
        label.pack()
        splash_window.after(100, lambda: splash_window.attributes('-alpha', 1))
        splash_window.after(150, animate_gif, label, gif, 1, duration)
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

env_vars = os.environ.copy()
env_vars["PROJECT_PYTHON_EXE"] = str(project_python_exe)

subprocess.Popen(
    [
        "powershell.exe",
        "-NoProfile",
        "-ExecutionPolicy", "Bypass",
        "-File", str(ps1_file)
    ],
    creationflags=subprocess.CREATE_NO_WINDOW,
    cwd=str(assets_dir),
    env=env_vars
)
