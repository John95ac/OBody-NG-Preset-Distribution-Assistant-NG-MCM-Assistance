import os
import sys
import configparser
import subprocess
from pathlib import Path

cwd = Path(__file__).parent.absolute()

try:
    config = configparser.ConfigParser()
    config.read(Path(cwd).parent / 'ini' / 'PORT_Restart_server.ini')
    new_port = config.get('PORT_new', 'port_new')

    with open(Path(cwd).parent / 'ini' / 'PORT.ini', 'r') as f:
        lines = f.readlines()

    with open(Path(cwd).parent / 'ini' / 'PORT.ini', 'w') as f:
        for line in lines:
            if line.startswith('PORT = '):
                parts = line.split(' = ', 1)
                if len(parts) == 2:
                    comment = parts[1].split(' ', 1)
                    if len(comment) == 2:
                        f.write(f'PORT = {new_port} {comment[1]}')
                    else:
                        f.write(f'PORT = {new_port}\n')
                else:
                    f.write(line)
            else:
                f.write(line)

    subprocess.Popen([Path(cwd).parent.parent / 'Standalone Mode' / 'Standalone Mode.exe'])
    sys.exit(0)
except:
    pass