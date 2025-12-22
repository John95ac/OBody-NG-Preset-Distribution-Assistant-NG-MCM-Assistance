const canvas = document.getElementById('particles');
const ctx = canvas.getContext('2d');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

let particlesArray = [];
const numberOfParticles = 50;
let particleColor = { r: 0, g: 188, b: 212 };
let BASE_URL = `http://${window.location.hostname}:${window.location.port}`;
let masterJsonData = null;
let pendingJsonKeyDelete = null;
let currentJsonModifierSection = null;
let currentJsonModifierSelection = null;

const bellAudio = new Audio('./Sound/bell.wav');
bellAudio.preload = 'auto';
bellAudio.load();

const factionSelectAudio = new Audio('./Sound/gameplay-recover-hp.wav');
factionSelectAudio.preload = 'auto';
factionSelectAudio.volume = 0.5;
factionSelectAudio.load();

// BASE_URL is now initialized dynamically from window.location.port

class Particle {
    constructor() {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        this.size = Math.random() * 3 + 1;
        this.speedX = Math.random() * 0.5 - 0.25;
        this.speedY = Math.random() * 0.5 - 0.25;
        this.opacity = Math.random() * 0.5 + 0.2;
    }
    update() {
        this.x += this.speedX;
        this.y += this.speedY;
        if (this.x > canvas.width) this.x = 0;
        if (this.x < 0) this.x = canvas.width;
        if (this.y > canvas.height) this.y = 0;
        if (this.y < 0) this.y = canvas.height;
    }
    draw() {
        ctx.fillStyle = `rgba(${particleColor.r}, ${particleColor.g}, ${particleColor.b}, ${this.opacity})`;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
    }
}

function initParticles() {
    particlesArray = [];
    for (let i = 0; i < numberOfParticles; i++) {
        particlesArray.push(new Particle());
    }
}

function animateParticles() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < particlesArray.length; i++) {
        particlesArray[i].update();
        particlesArray[i].draw();
    }
    requestAnimationFrame(animateParticles);
}

window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    initParticles();
});

function hexToRgb(hex) {
    if (!hex) return null;
    hex = hex.trim();
    if (hex.startsWith('rgb')) {
        const m = hex.match(/(\d+),\s*(\d+),\s*(\d+)/);
        return m ? { r: +m[1], g: +m[2], b: +m[3] } : null;
    }
    if (hex[0] === '#') hex = hex.slice(1);
    if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
    const num = parseInt(hex, 16);
    if (Number.isNaN(num)) return null;
    return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

function updateParticleColorFromTheme() {
    const primary = getComputedStyle(document.body).getPropertyValue('--primary').trim();
    const rgb = hexToRgb(primary);
    if (rgb) particleColor = rgb;
}

const tabButtons = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');

const tabThemeMap = {
    'tab-indice': 'indice',
    'tab-memorias': 'indice',
    'tab-ini-generator': 'ini-generator',
    'tab-chim': 'chim',
    'tab-skynet': 'skynet',
    'tab-ostim': 'ostim',
    'tab-plugins': 'ostim',
    'tab-plugins-npc': 'ostim',
    'tab-configuraciones': 'indice',
    'tab-news': 'indice',
};

const tabNameMap = {
    'tab-indice': 'Home, quick access and information',
    'tab-ini-generator': 'INI Generator',
    'tab-ostim': 'Dynamic Info Extractor NPC Range',
    'tab-plugins': 'Dynamic Info Extractor Plugins Items',
    'tab-plugins-npc': 'Dynamic Info Extractor Plugins NPC',
    'tab-skynet': 'JSON Quick Notes',
    'tab-chim': 'Preset Sandbox',
    'tab-memorias': 'Log Viewer',
    'tab-configuraciones': 'Configurations',
    'submenu-dynamic': 'Dynamic Info Extractor',
    'tab-news': 'News',
};

const themes = [
    {id: 'dark', name: 'Dark', color: '#1a1a1a'},
    {id: 'darkred', name: 'Dark Red', color: '#330000'},
    {id: 'ini-generator', name: 'Generator', color: '#08d190'},
    {id: 'indice', name: 'Índice', color: '#00bcd4'},
    {id: 'chim', name: 'Chim', color: '#e0b867'},
    {id: 'skynet', name: 'Skynet', color: '#00e09f'},
    {id: 'ostim', name: 'Ostim', color: '#ff3d7f'},
    {id: 'cyberpunk', name: 'Cyberpunk', color: '#8a2be2'},
    {id: 'neon', name: 'Neon', color: '#00ffff'}
];

function setTheme(theme) {
    // Remove all existing theme classes
    const allClasses = Array.from(document.body.classList);
    const themeClasses = allClasses.filter(cls => cls.startsWith('theme-'));
    document.body.classList.remove(...themeClasses);
    // Add new theme class
    document.body.classList.add('theme-' + theme);
    updateParticleColorFromTheme();
}

function activateTab(id) {
    tabButtons.forEach(btn => {
        const isActive = btn.dataset.target === id;
        btn.classList.toggle('active', isActive);
        btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });
    tabContents.forEach(sec => {
        if (sec.id === id) sec.classList.add('active');
        else sec.classList.remove('active');
    });

    // Special handling for submenu-dynamic button when sub-tabs are active
    const submenuDynamicBtn = document.querySelector('button[data-target="submenu-dynamic"]');
    if (submenuDynamicBtn) {
        const isSubTabActive = ['tab-ostim', 'tab-plugins', 'tab-plugins-npc'].includes(id);
        submenuDynamicBtn.classList.toggle('active', isSubTabActive);
        submenuDynamicBtn.setAttribute('aria-selected', isSubTabActive ? 'true' : 'false');
    }

    const theme = tabThemes[id] || tabThemeMap[id] || 'indice';
    setTheme(theme);
    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (id === 'tab-indice') {
        setTimeout(() => {
            loadUpdatesJson();
            loadVersionStatus();
        }, 500);
    }

    if (id === 'tab-news') {
        setTimeout(() => {
            loadUpdatesJson();
            const iframe = document.getElementById('newsIframe');
            if (iframe) {
                iframe.src = `https://john95ac.github.io/website-documents-John95AC/NEWS_MCM/index.html?v=${Date.now()}`;
            }
        }, 500);
    }

    if (id === 'tab-memorias') {
        setTimeout(() => {
            loadAllLogs();
            // Auto-update server errors log every 5 seconds
            if (window.serverErrorsInterval) {
                clearInterval(window.serverErrorsInterval);
            }
            window.serverErrorsInterval = setInterval(() => {
                loadLog('server_errors.log', 'log-server-errors');
            }, 5000);
        }, 500);
    }

    if (id === 'tab-plugins') {
        setTimeout(() => {
            loadPluginSelector();
            loadPluginsJson();
        }, 500);
    }

    if (id === 'tab-plugins-npc') {
        setTimeout(() => {
            loadNpcPluginSelector();
            loadNpcPluginsList();
        }, 500);
    }
}

tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        if (btn.classList.contains('disabled-initial')) return;
        if (btn.dataset.target && btn.dataset.target.startsWith('tab-')) {
            activateTab(btn.dataset.target);
        }
    });
});

window.addEventListener('load', () => {
    const initialTabsToDisable = [
        'tab-ini-generator',
        'submenu-dynamic',
        'tab-skynet',
        'tab-chim',
        'tab-memorias',
        'tab-news',
        'tab-configuraciones'
    ];

    tabButtons.forEach(btn => {
        const target = btn.dataset.target;
        if (initialTabsToDisable.includes(target)) {
            btn.classList.add('disabled-initial');
        }
    });

    setTimeout(() => {
        tabButtons.forEach(btn => {
            btn.classList.remove('disabled-initial');
        });
    }, 1000);
});

// Dropdown Submenu functionality
const dynamicSubmenuTab = document.querySelector('button[data-target="submenu-dynamic"]');
const dynamicSubmenu = document.querySelector('.dropdown-submenu');
const submenuOptions = document.querySelectorAll('.dropdown-option');

if (dynamicSubmenuTab && dynamicSubmenu) {
    dynamicSubmenuTab.addEventListener('click', (e) => {
        e.preventDefault();
        const isVisible = dynamicSubmenu.style.display === 'block';
        dynamicSubmenu.style.display = isVisible ? 'none' : 'block';
    });

    submenuOptions.forEach(option => {
        option.addEventListener('click', () => {
            const target = option.dataset.target;
            activateTab(target);
            dynamicSubmenu.style.display = 'none';
        });
    });

    // Close submenu when clicking outside
    document.addEventListener('click', (e) => {
        if (!dynamicSubmenuTab.contains(e.target) && !dynamicSubmenu.contains(e.target)) {
            dynamicSubmenu.style.display = 'none';
        }
    });
}

initParticles();
animateParticles();

// Load version status on initial page load
setTimeout(() => {
    loadVersionStatus();
}, 500);

const jsonTextarea = document.getElementById('jsonTextarea');
const jsonStatus = document.getElementById('jsonStatus');
const openSkseFolderBtn = document.getElementById('openSkseFolderBtn');
let jsonSaveTimeout;

if (jsonTextarea) {
    jsonTextarea.addEventListener('input', () => {
        clearTimeout(jsonSaveTimeout);
        jsonStatus.textContent = 'Editing...';
        jsonStatus.style.background = 'rgba(251, 191, 36, 0.2)';
        jsonSaveTimeout = setTimeout(() => { saveJSON(); }, 2000);
    });
}

if (openSkseFolderBtn) {
    openSkseFolderBtn.addEventListener('click', async () => {
        try {
            const response = await fetch(`${BASE_URL}/open-manager-mcm-folder`, { method: 'POST' });
            const result = await response.json().catch(() => ({}));
            if (response.ok && result.status === 'success') {
                showToast('✓ Folder opened', '#10b981');
            } else {
                showToast(result.message || '❌ Failed to open folder', '#ef4444');
            }
        } catch (error) {
            showToast('Connection error', '#ef4444');
        }
    });
}

async function saveJSON() {
    const text = jsonTextarea.value;
    console.log('saveJSON called, BASE_URL:', BASE_URL);
    try {
        const url = `${BASE_URL}/save-json`;
        console.log('Fetching URL:', url);
        const response = await fetch(url, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({content: text})
        });
        console.log('saveJSON response status:', response.status);
        if (!response.ok) throw new Error('HTTP ' + response.status);
        const result = await response.json();
        if (result.status === 'success') {
            jsonStatus.textContent = 'Saved to Json/config.json';
            jsonStatus.style.background = 'rgba(16, 185, 129, 0.2)';
        } else {
            jsonStatus.textContent = 'Save error';
            jsonStatus.style.background = 'rgba(239, 68, 68, 0.2)';
        }
    } catch (error) {
        console.error('Error:', error);
        jsonStatus.textContent = 'Connection error';
        jsonStatus.style.background = 'rgba(239, 68, 68, 0.2)';
    }
}

async function loadJSON() {
    console.log('loadJSON called, BASE_URL:', BASE_URL);
    try {
        const url = `${BASE_URL}/load-json`;
        console.log('Fetching URL:', url);
        const response = await fetch(url);
        console.log('loadJSON response status:', response.status);
        if (!response.ok) throw new Error('HTTP ' + response.status);
        const result = await response.json();
        if (result.status === 'success') {
            jsonTextarea.value = result.content || '';
        }
    } catch (error) {
        console.error('Error loading JSON:', error);
    }
}

async function loadLicense(type) {
    const contentDiv = document.getElementById('licenseContent');
    try {
        // Map license types to correct server endpoints
        const typeMap = {
            'python': 'python',
            'frozen': 'frozen',
            'john95ac': 'mit'
        };
        const serverType = typeMap[type] || type;
        const response = await fetch(`${BASE_URL}/load-license-${serverType}`);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        const data = await response.json();
        if (data.status === 'success') {
            contentDiv.innerHTML = `<pre style="white-space: pre-wrap; font-size: 0.8rem; line-height: 1.4; overflow: auto; max-height: 400px; background: #f8f8f8; padding: 1rem; border-radius: 4px;">${data.content}</pre>`;
        } else {
            contentDiv.innerHTML = `<p style="color: red;">Error al cargar la licencia: ${data.message || 'Unknown error'}</p>`;
        }
    } catch (error) {
        contentDiv.innerHTML = `<p style="color: red;">Error: ${error.message}</p>`;
    }
}

function openLicenseModal(type, title) {
    // Create modal overlay
    const modal = document.createElement('div');
    modal.className = 'modal-overlay license-modal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.7);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 10000;
    `;

    // Create modal content
    const modalContent = document.createElement('div');
    modalContent.className = 'modal-content';
    modalContent.style.cssText = `
        background: var(--surface);
        border-radius: 8px;
        max-width: 800px;
        width: 90%;
        max-height: 80vh;
        display: flex;
        flex-direction: column;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
    `;

    // Create modal header
    const modalHeader = document.createElement('div');
    modalHeader.className = 'modal-header';
    modalHeader.style.cssText = `
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 1rem;
        border-bottom: 1px solid var(--border);
    `;

    const modalTitle = document.createElement('h3');
    modalTitle.textContent = title;
    modalTitle.style.margin = '0';

    const closeBtn = document.createElement('button');
    closeBtn.className = 'modal-close';
    closeBtn.textContent = '×';
    closeBtn.style.cssText = `
        background: none;
        border: none;
        font-size: 1.5rem;
        cursor: pointer;
        color: var(--text);
        padding: 0;
        width: 30px;
        height: 30px;
        display: flex;
        align-items: center;
        justify-content: center;
    `;

    modalHeader.appendChild(modalTitle);
    modalHeader.appendChild(closeBtn);

    // Create modal body
    const modalBody = document.createElement('div');
    modalBody.className = 'modal-body';
    modalBody.style.cssText = `
        padding: 1rem;
        overflow-y: auto;
        flex: 1;
    `;

    // Loading text
    modalBody.innerHTML = '<p>Loading license content...</p>';

    // Assemble modal
    modalContent.appendChild(modalHeader);
    modalContent.appendChild(modalBody);
    modal.appendChild(modalContent);
    document.body.appendChild(modal);

    // Load license content
    loadLicenseContent(type, modalBody);

    // Event listeners
    closeBtn.addEventListener('click', () => {
        document.body.removeChild(modal);
    });

    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            document.body.removeChild(modal);
        }
    });

    // ESC key listener
    const escHandler = (e) => {
        if (e.key === 'Escape') {
            document.body.removeChild(modal);
            document.removeEventListener('keydown', escHandler);
        }
    };
    document.addEventListener('keydown', escHandler);
}

async function loadLicenseContent(type, container) {
    try {
        if (type === 'sound') {
            const response = await fetch('Sound/credits Sound.txt');
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            const text = await response.text();
            const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
            const html = lines.map(line => {
                const safeText = line
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;');
                if (line.startsWith('http://') || line.startsWith('https://')) {
                    return `<a href="${line}" target="_blank" rel="noreferrer noopener">${safeText}</a>`;
                }
                return safeText;
            }).join('<br>');
            container.innerHTML = `<pre style="white-space: pre-wrap; font-size: 0.9rem; line-height: 1.4; margin: 0; font-family: 'Courier New', monospace;">${html}</pre>`;
            return;
        }

        // Map license types to correct server endpoints
        const typeMap = {
            'python': 'python',
            'frozen': 'frozen',
            'john95ac': 'mit'
        };
        const serverType = typeMap[type] || type;
        const response = await fetch(`${BASE_URL}/load-license-${serverType}`);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        const data = await response.json();
        if (data.status === 'success') {
            container.innerHTML = `<pre style="white-space: pre-wrap; font-size: 0.9rem; line-height: 1.4; margin: 0; font-family: 'Courier New', monospace;">${data.content}</pre>`;
        } else {
            container.innerHTML = `<p style="color: red;">Error loading license content: ${data.message || 'Unknown error'}</p>`;
        }
    } catch (error) {
        container.innerHTML = `<p style="color: red;">Error: ${error.message}</p>`;
    }
}

const enableMod = document.getElementById('enableMod');
const debugMode = document.getElementById('debugMode');
const autoSave = document.getElementById('autoSave');
const volumeSlider = document.getElementById('volumeSlider');
const volumeValue = document.getElementById('volumeValue');
const frequencySlider = document.getElementById('frequencySlider');
const frequencyValue = document.getElementById('frequencyValue');
const saveIniBtn = document.getElementById('saveIni');
const resetIniBtn = document.getElementById('resetIni');
const shutdownBtn = document.getElementById('shutdownBtn');
const createShortcutsBtn = document.getElementById('createShortcutsBtn');
const shortcutsStatus = document.getElementById('shortcutsStatus');
const iniStatus = document.getElementById('iniStatus');
const portInput = document.getElementById('portInput');
const savePortBtn = document.getElementById('savePortBtn');
const portStatus = document.getElementById('portStatus');
let portMasterData = null;
const PORT_STATUS_DEFAULT_TEXT = portStatus ? portStatus.textContent : '';
const PORT_STATUS_DEFAULT_BG = portStatus ? portStatus.style.background : '';
let selfServiceName = '';
let lastPortInvalid = false;
let savePortInProgress = false;
let portUiLoaded = false;

if (volumeSlider && volumeValue) {
    volumeSlider.addEventListener('input', () => {
        volumeValue.textContent = volumeSlider.value;
    });
}

if (frequencySlider && frequencyValue) {
    frequencySlider.addEventListener('input', () => {
        frequencyValue.textContent = frequencySlider.value;
    });
}

if (saveIniBtn) {
    saveIniBtn.addEventListener('click', async () => {
        const iniData = {
            enableMod: enableMod.checked,
            debugMode: debugMode.checked,
            autoSave: autoSave.checked,
            volume: parseInt(volumeSlider.value),
            frequency: parseInt(frequencySlider.value)
        };
        try {
            const response = await fetch(`${BASE_URL}/save-ini`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(iniData)
            });
            if (!response.ok) throw new Error('HTTP ' + response.status);
            const result = await response.json();
            if (result.status === 'success') {
                iniStatus.textContent = 'Saved to ini/configuracion.ini';
                iniStatus.style.background = 'rgba(16, 185, 129, 0.2)';
            } else {
                iniStatus.textContent = 'Save error';
                iniStatus.style.background = 'rgba(239, 68, 68, 0.2)';
            }
        } catch (error) {
            console.error('Error:', error);
            iniStatus.textContent = 'Connection error';
            iniStatus.style.background = 'rgba(239, 68, 68, 0.2)';
        }
    });
}

if (savePortBtn) {
    savePortBtn.addEventListener('click', () => {
        bellAudio.currentTime = 0;
        bellAudio.play();
        savePort();
    });
}

if (portInput) {
    portInput.addEventListener('input', () => {
        validatePort();
    });
}

if (resetIniBtn) {
    resetIniBtn.addEventListener('click', () => {
        enableMod.checked = true;
        debugMode.checked = false;
        autoSave.checked = true;
        volumeSlider.value = 80;
        volumeValue.textContent = '80';
        frequencySlider.value = 5;
        frequencyValue.textContent = '5';
        iniStatus.textContent = 'Values restored (not saved)';
        iniStatus.style.background = 'rgba(251, 191, 36, 0.2)';
    });
}

if (shutdownBtn) {
    shutdownBtn.addEventListener('click', async () => {
        if (confirm('Shut down the server? The page will stop working.')) {
            try {
                const response = await fetch(`${BASE_URL}/shutdown`, {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'}
                });
                const result = await response.json();
                if (result.status === 'success') {
                    alert('Server shutting down in 3 seconds...');
                    setTimeout(() => location.reload(), 3000);
                }
            } catch (error) { console.error('Error:', error); }
        }
    });
}

if (createShortcutsBtn) {
    // Apply special styling that changes with theme
    createShortcutsBtn.style.border = '2px solid var(--primary)';
    createShortcutsBtn.style.boxShadow = '0 0 10px var(--primary)';
    createShortcutsBtn.style.transition = 'box-shadow 0.3s ease';

    createShortcutsBtn.addEventListener('mouseenter', () => {
        createShortcutsBtn.style.boxShadow = '0 0 20px var(--primary)';
    });

    createShortcutsBtn.addEventListener('mouseleave', () => {
        createShortcutsBtn.style.boxShadow = '0 0 10px var(--primary)';
    });

    createShortcutsBtn.addEventListener('click', async () => {
        // Play sound when button is clicked
        const audio = new Audio('Sound/slide_fretboard.wav');
        audio.play();
        shortcutsStatus.textContent = 'Creating shortcuts...';
        shortcutsStatus.style.background = 'rgba(251, 191, 36, 0.2)';
        try {
            const response = await fetch(`${BASE_URL}/create-shortcuts`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'}
            });
            const result = await response.json();
            if (result.status === 'success') {
                shortcutsStatus.textContent = 'Shortcuts created successfully!';
                shortcutsStatus.style.background = 'rgba(16, 185, 129, 0.2)';
            } else {
                shortcutsStatus.textContent = 'Error creating shortcuts: ' + (result.message || 'Unknown error');
                shortcutsStatus.style.background = 'rgba(239, 68, 68, 0.2)';
            }
        } catch (error) {
            console.error('Error:', error);
            shortcutsStatus.textContent = 'Connection error';
            shortcutsStatus.style.background = 'rgba(239, 68, 68, 0.2)';
        }
    });
}

async function loadINI() {
    console.log('loadINI called, BASE_URL:', BASE_URL);
    try {
        const url = `${BASE_URL}/load-ini`;
        console.log('Fetching URL:', url);
        const response = await fetch(url);
        console.log('loadINI response status:', response.status);
        if (!response.ok) throw new Error('HTTP ' + response.status);
        const result = await response.json();
        if (result.status === 'success') {
            const data = result.data || {};
            enableMod.checked = !!data.enableMod;
            debugMode.checked = !!data.debugMode;
            autoSave.checked = !!data.autoSave;
            if (typeof data.volume === 'number') {
                volumeSlider.value = data.volume;
                volumeValue.textContent = String(data.volume);
            }
            const freq = (typeof data.updateFrequency === 'number') ? data.updateFrequency : data.frequency;
            if (typeof freq === 'number') {
                frequencySlider.value = freq;
                frequencyValue.textContent = String(freq);
            }
        }
    } catch (error) {
        console.error('Error loading INI:', error);
    }
}

let currentIniHash = null;
let isUserEditing = false;

async function loadPortMaster() {
    try {
        const response = await fetch(`${BASE_URL}/port-master`, { cache: 'no-store' });
        if (!response.ok) return;
        const result = await response.json();
        if (result && result.status === 'success' && result.data) {
            portMasterData = result.data;
            if (typeof result.self_service === 'string') {
                selfServiceName = result.self_service;
            } else {
                selfServiceName = '';
            }
            validatePort();
        }
    } catch (error) {
        portMasterData = null;
        selfServiceName = '';
    }
}

function validatePort() {
    if (!portInput) return true;
    const portError = document.getElementById('portError');
    const raw = String(portInput.value || '').trim();
    const port = parseInt(raw, 10);

    let message = '';
    if (!portUiLoaded && raw === '') {
        if (portError) {
            portError.style.display = 'none';
            portError.textContent = '';
        }
        if (savePortBtn) savePortBtn.disabled = true;
        if (portStatus) {
            portStatus.textContent = PORT_STATUS_DEFAULT_TEXT || 'Once pressed, the new one will open on its own.';
            portStatus.style.background = PORT_STATUS_DEFAULT_BG || 'rgba(0, 188, 212, 0.2)';
        }
        portInput.style.borderColor = '';
        return true;
    }
    if (Number.isNaN(port) || port < 0 || port > 65535) {
        message = 'Invalid port number (0-65535)';
    } else if (portMasterData && portMasterData.port_restrictions) {
        const pr = portMasterData.port_restrictions;
        const reserved = pr.reserved_range;
        if (reserved && typeof reserved === 'object') {
            const start = parseInt(reserved.start, 10);
            const end = parseInt(reserved.end, 10);
            if (!Number.isNaN(start) && !Number.isNaN(end) && port >= start && port <= end) {
                message = 'Port 0-1024 is reserved by the system. Choose a port above 1024.';
            }
            const veryUsed = reserved['Very used ports'];
            if (!message && Array.isArray(veryUsed)) {
                const veryUsedSet = new Set(veryUsed.map((x) => parseInt(x, 10)).filter((x) => !Number.isNaN(x)));
                if (veryUsedSet.has(port)) {
                    message = 'This port is commonly used by other services and cannot be used here.';
                }
            }
        }

        if (!message && Array.isArray(pr.common_development_ports)) {
            const selfEntry = pr.common_development_ports.find((e) => {
                if (!e || typeof e !== 'object') return false;
                const service = typeof e.service === 'string' ? e.service : '';
                return !!selfServiceName && service === selfServiceName;
            });
            if (!message && selfEntry && Array.isArray(selfEntry['port do not use'])) {
                const selfDoNotUseSet = new Set(
                    selfEntry['port do not use']
                        .map((x) => parseInt(x, 10))
                        .filter((x) => !Number.isNaN(x))
                );
                if (selfDoNotUseSet.has(port)) {
                    message = 'This port is reserved or may be used by another service in the future.';
                }
            }

            const other = pr.common_development_ports.find((e) => {
                if (!e || typeof e !== 'object') return false;
                const p = parseInt(e.port, 10);
                const service = typeof e.service === 'string' ? e.service : '';
                if (selfServiceName && service === selfServiceName) return false;
                return p === port;
            });
            if (other && typeof other.service === 'string' && other.service.trim()) {
                message = `Port already used by: ${other.service}`;
            } else if (other) {
                message = 'Port already used by another service.';
            }
        }
    }

    const isValid = !message;
    if (portError) {
        portError.style.display = 'none';
        portError.textContent = '';
    }

    if (savePortBtn) savePortBtn.disabled = !isValid;
    if (portStatus) {
        if (isValid) {
            if (lastPortInvalid) {
                portStatus.textContent = PORT_STATUS_DEFAULT_TEXT || 'Once pressed, the new one will open on its own.';
                portStatus.style.background = PORT_STATUS_DEFAULT_BG || 'rgba(0, 188, 212, 0.2)';
            }
            lastPortInvalid = false;
        } else {
            portStatus.textContent = message;
            if (message === 'This port is reserved or may be used by another service in the future.') {
                portStatus.style.background = 'rgba(251, 191, 36, 0.2)';
            } else if (message === 'Port 0-1024 is reserved by the system. Choose a port above 1024.') {
                portStatus.style.background = 'rgba(249, 115, 22, 0.2)';
            } else {
                portStatus.style.background = 'rgba(239, 68, 68, 0.2)';
            }
            lastPortInvalid = true;
        }
    }
    portInput.style.borderColor = isValid ? '' : 'rgb(239, 68, 68)';

    return isValid;
}

async function initializeIniHash() {
    try {
        const response = await fetch(`${BASE_URL}/ini-hash`);
        if (!response.ok) throw new Error('HTTP ' + response.status);
        const result = await response.json();
        if (result.status === 'success') {
            currentIniHash = result.hash;
        }
    } catch (error) {
        console.error('Error initializing INI hash:', error);
    }
}

function startIniPolling() {
    setInterval(async () => {
        try {
            const response = await fetch(`${BASE_URL}/ini-hash`);
            if (!response.ok) throw new Error('HTTP ' + response.status);
            const result = await response.json();
            if (result.status === 'success' && result.hash !== currentIniHash) {
                currentIniHash = result.hash;
                if (!isUserEditing) {
                    loadINI();
                }
            }
        } catch (error) {
            console.error('Error polling INI hash:', error);
        }
    }, 2500); // Poll every 2.5 seconds
}

// Track user editing state
if (enableMod) enableMod.addEventListener('change', () => { isUserEditing = true; setTimeout(() => isUserEditing = false, 3000); });
if (debugMode) debugMode.addEventListener('change', () => { isUserEditing = true; setTimeout(() => isUserEditing = false, 3000); });
if (autoSave) autoSave.addEventListener('change', () => { isUserEditing = true; setTimeout(() => isUserEditing = false, 3000); });
if (volumeSlider) volumeSlider.addEventListener('input', () => { isUserEditing = true; setTimeout(() => isUserEditing = false, 3000); });
if (frequencySlider) frequencySlider.addEventListener('input', () => { isUserEditing = true; setTimeout(() => isUserEditing = false, 3000); });

async function loadPort() {
    console.log('loadPort called');
    try {
        const response = await fetch('Json/port.json');
        console.log('loadPort response status:', response.status);
        if (!response.ok) throw new Error('HTTP ' + response.status);
        const data = await response.json();
        const port = data.port || '';
        portInput.value = port;
        const currentPortDisplay = document.getElementById('currentPortDisplay');
        if (currentPortDisplay) currentPortDisplay.textContent = port;
        const portNumber = document.getElementById('portNumber');
        if (portNumber) portNumber.textContent = port;
        const portValueDisplay = document.getElementById('portValueDisplay');
        if (portValueDisplay) portValueDisplay.textContent = port;
        portUiLoaded = true;
        validatePort();
    } catch (error) {
        console.error('Error loading port:', error);
    }
}

async function savePort() {
    if (!validatePort()) return;
    const port = parseInt(portInput.value, 10);
    if (Number.isNaN(port)) return;
    try {
        savePortInProgress = true;
        if (portStatus) {
            portStatus.textContent = 'ready wait for the cat';
            portStatus.style.background = 'rgba(251, 191, 36, 0.2)';
        }
        const response = await fetch(`${BASE_URL}/save-port-restart`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({port: port})
        });
        if (!response.ok) throw new Error('HTTP ' + response.status);
        const result = await response.json();
        if (result.status === 'success') {
            if (portStatus) {
                portStatus.textContent = 'ready wait for the cat';
                portStatus.style.background = 'rgba(251, 191, 36, 0.2)';
            }
            setTimeout(() => location.reload(), 800);
        } else {
            savePortInProgress = false;
            if (portStatus) {
                portStatus.textContent = result.message || 'Save error';
                if (portStatus.textContent === 'This port is reserved or may be used by another service in the future.') {
                    portStatus.style.background = 'rgba(251, 191, 36, 0.2)';
                } else if (portStatus.textContent === 'Port 0-1024 is reserved by the system. Choose a port above 1024.') {
                    portStatus.style.background = 'rgba(249, 115, 22, 0.2)';
                } else {
                    portStatus.style.background = 'rgba(239, 68, 68, 0.2)';
                }
            }
        }
    } catch (error) {
        console.error('Error:', error);
        if (savePortInProgress) {
            if (portStatus) {
                portStatus.textContent = 'ready wait for the cat';
                portStatus.style.background = 'rgba(251, 191, 36, 0.2)';
            }
            setTimeout(() => location.reload(), 1200);
        } else if (portStatus) {
            portStatus.textContent = 'Connection error';
            portStatus.style.background = 'rgba(239, 68, 68, 0.2)';
        }
    }
}

async function restartServer() {
    if (!validatePort()) {
        portStatus.textContent = 'Invalid port number (0-65535)';
        portStatus.style.background = 'rgba(239, 68, 68, 0.2)';
        return;
    }
    portStatus.textContent = 'Restarting server...';
    portStatus.style.background = 'rgba(251, 191, 36, 0.2)';
    try {
        const response = await fetch(`${BASE_URL}/restart-server`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'}
        });
        if (!response.ok) throw new Error('HTTP ' + response.status);
        const result = await response.json();
        if (result.status === 'success') {
            portStatus.textContent = 'Server restart initiated successfully';
            portStatus.style.background = 'rgba(16, 185, 129, 0.2)';
        } else {
            portStatus.textContent = 'Restart error: ' + (result.message || 'Unknown error');
            portStatus.style.background = 'rgba(239, 68, 68, 0.2)';
        }
    } catch (error) {
        console.error('Error:', error);
        portStatus.textContent = 'Server restart initiated successfully';
        portStatus.style.background = 'rgba(16, 185, 129, 0.2)';
    }
}

async function loadVersionStatus() {
    const versionStatus = document.getElementById('versionStatus');
    const updateBtn = document.getElementById('updateBtn');
    if (!versionStatus) return;

    versionStatus.textContent = 'Loading version info...';
    versionStatus.style.background = 'rgba(251, 191, 36, 0.2)';

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 seconds timeout

    try {
        const response = await fetch(`${BASE_URL}/load-version-status`, {
            signal: controller.signal,
            cache: 'no-store'
        });
        clearTimeout(timeoutId);
        if (!response.ok) throw new Error('HTTP ' + response.status);
        const data = await response.json();

        if (data.status === 'success') {
            let message = '';
            let color = '';

            if (data.update_status === 'up_to_date') {
                message = data.message;
                color = 'rgba(16, 185, 129, 0.2)'; // green
                if (updateBtn) {
                    updateBtn.textContent = 'Nothing to Updates';
                    updateBtn.disabled = true;
                    updateBtn.style.background = 'rgba(128, 128, 128, 0.5)'; // gray
                }
            } else if (data.update_status === 'update_available') {
                message = data.message;
                color = 'rgba(239, 68, 68, 0.2)'; // red
                if (updateBtn) {
                    updateBtn.disabled = false;
                    updateBtn.style.background = 'rgba(0, 139, 139, 0.8)'; // worthy emerald green
                    if (data.update_type === 'soft') {
                        updateBtn.textContent = 'Update with one click';
                    } else if (data.update_type === 'hard') {
                        updateBtn.textContent = 'Update from Nexus';
                    } else {
                        updateBtn.textContent = 'Update';
                    }
                    // Add event listener for updateBtn
                    updateBtn.addEventListener('click', () => {
                        // Only redirect if button is enabled and text is "Update from Nexus"
                        if (!updateBtn.disabled && updateBtn.textContent === 'Update from Nexus') {
                            bellAudio.currentTime = 0;
                            bellAudio.play().then(() => {
                                window.open('https://next.nexusmods.com/profile/John1995ac', '_blank');
                            }).catch(error => {
                                console.error('Audio play failed:', error);
                                window.open('https://next.nexusmods.com/profile/John1995ac', '_blank');
                            });
                        }
                    });
                }
            } else {
                message = 'Version status unknown';
                color = 'rgba(251, 191, 36, 0.2)'; // yellow
                if (updateBtn) {
                    updateBtn.textContent = 'Nothing to Updates';
                    updateBtn.disabled = true;
                    updateBtn.style.background = 'rgba(128, 128, 128, 0.5)'; // gray
                }
            }

            versionStatus.textContent = message;
            versionStatus.style.background = color;
        } else {
            versionStatus.textContent = 'Error loading version info';
            versionStatus.style.background = 'rgba(239, 68, 68, 0.2)';
            if (updateBtn) {
                updateBtn.textContent = 'Update';
                updateBtn.disabled = true;
                updateBtn.style.background = 'rgba(128, 128, 128, 0.5)'; // gray
            }
        }
    } catch (error) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
            versionStatus.textContent = 'Request timeout';
            versionStatus.style.background = 'rgba(239, 68, 68, 0.2)';
        } else {
            console.error('Error loading version status:', error);
            versionStatus.textContent = 'Connection error';
            versionStatus.style.background = 'rgba(239, 68, 68, 0.2)';
        }
        if (updateBtn) {
            updateBtn.textContent = 'Nothing to Updates';
            updateBtn.disabled = true;
            updateBtn.style.background = 'rgba(128, 128, 128, 0.5)'; // gray
        }
    }
}

async function loadUpdatesJson() {
    const updatesStatus = document.getElementById('updatesStatus');
    const updateContent = document.getElementById('updateContent');
    if (!updatesStatus || !updateContent) return;

    updatesStatus.textContent = 'Loading...';
    updatesStatus.style.background = 'rgba(251, 191, 36, 0.2)';

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 seconds timeout

    try {
        const response = await fetch(`Data/updates.json?v=${Date.now()}`, {
            signal: controller.signal,
            cache: 'no-store'
        });
        clearTimeout(timeoutId);
        if (!response.ok) throw new Error('HTTP ' + response.status);
        const updates = await response.json();

        // Clear previous content
        updateContent.innerHTML = '';

        // Process updates in reverse order (most recent first)
        const reversedUpdates = updates.slice().reverse();

        reversedUpdates.forEach(update => {
            // Create container for each update
            const updateContainer = document.createElement('div');
            updateContainer.className = 'update-item';
            updateContainer.style.marginBottom = '40px';

            // Create structured HTML elements for each update
            const titleEl = document.createElement('div');
            titleEl.className = 'update-title';
            titleEl.innerHTML = `<div style="border-top: 2px solid #00bcd4; padding-top: 8px; font-size: 1.4rem; font-weight: bold;">${update.update_title}</div>`;
            updateContainer.appendChild(titleEl);

            const versionEl = document.createElement('div');
            versionEl.className = 'update-version';
            versionEl.innerHTML = `Version: ${update.version}`;
            updateContainer.appendChild(versionEl);

            const descEl = document.createElement('div');
            descEl.className = 'update-description';
            descEl.textContent = update.description;
            updateContainer.appendChild(descEl);

            const detailsEl = document.createElement('div');
            detailsEl.className = 'update-details';
            detailsEl.innerHTML = `
                <div>Date: ${update.details.date}</div>
                <div>Changes:</div>
                <ul>
                    ${update.details.changes.map(change => `<li>${change}</li>`).join('')}
                </ul>
            `;
            updateContainer.appendChild(detailsEl);

            updateContent.appendChild(updateContainer);
        });

        updatesStatus.textContent = 'Loaded successfully';
        updatesStatus.style.background = 'rgba(16, 185, 129, 0.2)';
    } catch (error) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
            updateContent.innerHTML = '<div>Request timeout</div>';
            updatesStatus.textContent = 'Request timeout';
            updatesStatus.style.background = 'rgba(239, 68, 68, 0.2)';
        } else {
            console.error('Error loading updates JSON:', error);
            updateContent.innerHTML = '<div>Error loading updates</div>';
            updatesStatus.textContent = 'Error loading updates';
            updatesStatus.style.background = 'rgba(239, 68, 68, 0.2)';
        }
    }
}


let permanentRules = '';
const DEFAULT_RULE_MESSAGE = '; Complete all fields to generate the INI rule';
let hasLocalGeneratedRulesEdits = false;
let favoritos = {};
let favoritosXML = {};
let favoritosNPCs = {};
let favoritosOutfits = {};

function silentlyLockButton(button, ms = 1000) {
    if (!button) return () => {};

    if (button.__pdaUnlockFn) {
        if (typeof ms === 'number' && ms > 0) {
            if (button.__pdaUnlockTimer) clearTimeout(button.__pdaUnlockTimer);
            button.__pdaUnlockTimer = setTimeout(() => button.__pdaUnlockFn(), ms);
        } else {
            if (button.__pdaUnlockTimer) {
                clearTimeout(button.__pdaUnlockTimer);
                button.__pdaUnlockTimer = null;
            }
        }
        return button.__pdaUnlockFn;
    }

    button.disabled = true;

    const unlock = () => {
        if (button.__pdaUnlockTimer) {
            clearTimeout(button.__pdaUnlockTimer);
            button.__pdaUnlockTimer = null;
        }
        button.disabled = false;
        button.__pdaUnlockFn = null;
    };

    button.__pdaUnlockFn = unlock;
    if (typeof ms === 'number' && ms > 0) {
        button.__pdaUnlockTimer = setTimeout(unlock, ms);
    } else {
        button.__pdaUnlockTimer = null;
    }

    return unlock;
}
const PINNED_PRESETS = [
    { name: 'Without Preset PDA', category: 'normal' },
    { name: 'HIMBO Default', category: 'himbo' },
    { name: '-Zeroed Sliders-', category: 'ube' }
];
const PINNED_PRESET_NAMES = PINNED_PRESETS.map(preset => preset.name);
let factionTooltipTimeout;
let factionTooltipElement;
const FACTIONS_MEMORI_TOOLTIP_TEXT = `Since the number of factions in a modded playthrough can range from 1000 to over half a million, to maintain sanity and not break the program, this system will only collect factions from the NPCs you encounter along the way, both your factions and those of the NPCs. This is achieved each time you update the data in 🔍 Dynamic Info Extractor NPC Range, obtaining these factions. It's the simplest and least destructive method I found… yes, I tried many things, in the future I'll make a more stable version, but I like this method, at least for me.`;
const FACTIONS_CSV_TOOLTIP_TEXT = `This is a database that I've been building myself, with all the names and factions of the game. What really matters is the EDID. It took me some time to extract them bit by bit from the entire original element, quite a lot of text. Since the data is already built, there's no need to load or demand anything from the Skyrim SKSE, which improves the project's performance... One of the most common questions is what faction is, with this you'll have a basic list.`;
let factionsLibraryNames = [];
let factionsLibraryDetails = {};
let factionsLibrarySearchInitialized = false;
let factionsSource = 'memori';
let factionsMemoriNames = [];
let factionsMemoriDetails = {};
let factionsCsvNames = [];
let factionsCsvDetails = {};
let tabThemes = {};
let saveTimeout;
let npcPluginDetailsInterval;
let currentPollingPlugin;

async function initializeINIGenerator() {
    const newRuleBtn = document.getElementById('newRule');
    const modPackBtn = document.getElementById('modPackBtn');
    const ruleTypeSelect = document.getElementById('ruleType');
    const elementValueSelect = document.getElementById('elementValue');
    const blacklistedValue = document.getElementById('blacklistedValue');
    const elementValueInput = document.getElementById('elementValueInput');
    const outfitsValue = document.getElementById('outfitsValue');
    const presetsInput = document.getElementById('presets');
    const modeSelect = document.getElementById('mode');
    const generatedRuleEl = document.getElementById('generatedRule');
    const copyRuleBtn = document.getElementById('copyRuleBtn');
    const cleanRuleBtn = document.getElementById('cleanRuleBtn');

    if (!newRuleBtn || !generatedRuleEl) return;

    let undoStack = [];
    let redoStack = [];

    const sampleData = {
        npcFormID: {
            values: ['Skyrim.esm', 'Dawnguard.esm', 'Dragonborn.esm'],
            presets: ['IDnpc,PresetA,PresetB,...', '00013BA3,Bardmaid', '00013BA2,Wench Preset,Demonic']
        },
        blacklistedNpcsFormID: {
            values: ['YurianaWench.esp', 'Immersive Wenches.esp', 'DarkDesiresCircleOfLust.esp'],
            presets: ['0B000817', 'FE000817', '0A000123']
        },
        blacklistedOutfitsFromORefitFormID: {
            values: ['YurianaWench.esp', 'Immersive Wenches.esp', 'DarkDesiresCircleOfLust.esp'],
            presets: ['FE000817', '0C000456', '0D000789']
        },
        outfitsForceRefitFormID: {
            values: ['YurianaWench.esp', 'Immersive Wenches.esp', 'DarkDesiresCircleOfLust.esp'],
            presets: ['0C000456', '0D000789', '0E000123']
        },
        npc: {
            values: ['Serana', 'Lydia', 'Aela', 'Mjoll'],
            presets: ['Custom Preset 1,Custom Preset 2']
        },
        factionFemale: {
            values: ['ImperialFaction', 'StormcloakFaction', 'GuardFaction'],
            presets: ['Imperial Body,Noble Body']
        },
        factionMale: {
            values: ['ImperialFaction', 'StormcloakFaction', 'GuardFaction'],
            presets: ['Imperial Male,Noble Male']
        },
        npcPluginFemale: {
            values: ['YurianaWench.esp', 'Immersive Wenches.esp', 'Miya_follower.esp'],
            presets: ['Wench Body 2.0 Naked Body SSE,!CCPoundcakeNaked2']
        },
        npcPluginMale: {
            values: ['Plugin222.esp', 'Zapato.esp', 'Male_follower.esp'],
            presets: ['Male Body Preset 1,Male Body Preset 2']
        },
        raceFemale: {
            values: ['NordRace', 'ImperialRace', 'BretonRace'],
            presets: ['Nordic Female,Orcish Female']
        },
        raceMale: {
            values: ['NordRace', 'ImperialRace', 'BretonRace'],
            presets: ['Nordic Male,Orcish Male']
        },
        blacklisted: {
            values: ['Npcs', 'NpcsPluginFemale', 'NpcsPluginMale', 'RacesFemale', 'RacesMale', 'PresetsFromRandomDistribution'],
            presets: {
                'Npcs': 'Mjoll,Serana',
                'NpcsPluginFemale': 'Immersive Wenches.esp,TDD.esp',
                'NpcsPluginMale': 'Immersive Wenches.esp,TDD.esp',
                'RacesFemale': 'NordRace,00UBE_BretonRace',
                'RacesMale': 'NordRace,00UBE_BretonRace',
                'PresetsFromRandomDistribution': 'HIMBO Zero for OBody,UBE Chonky'
            }
        },
        outfits: {
            values: ['outfitsForceRefit', 'blacklistedOutfitsFromORefit', 'blacklistedOutfitsFromORefitPlugin'],
            presets: {
                'outfitsForceRefit': 'Nihon - Jacket,Nihon - Jacket Neon,Nihon - Yellow',
                'blacklistedOutfitsFromORefit': 'LS Force Naked,OBody Nude 32',
                'blacklistedOutfitsFromORefitPlugin': 'NewmChainmail.esp,NewmillerLeatherBikini.esp,NewmExtendedDressLong.esl'
            }
        }
    };

    ruleTypeSelect.addEventListener('change', function() {
        const selectedType = this.value;

        if (selectedType === 'raceFemale' || selectedType === 'raceMale') {
            elementValueSelect.style.display = 'block';
            blacklistedValue.style.display = 'none';
            outfitsValue.style.display = 'none';
            elementValueInput.style.display = 'none';
            elementValueSelect.value = '';
        } else if (selectedType === 'blacklisted') {
            elementValueSelect.style.display = 'none';
            blacklistedValue.style.display = 'block';
            outfitsValue.style.display = 'none';
            elementValueInput.style.display = 'none';
            blacklistedValue.value = '';
        } else if (selectedType === 'outfits') {
            elementValueSelect.style.display = 'none';
            blacklistedValue.style.display = 'none';
            outfitsValue.style.display = 'block';
            elementValueInput.style.display = 'none';
            outfitsValue.value = '';
        } else if (selectedType === 'blacklistedNpcsFormID' || selectedType === 'blacklistedOutfitsFromORefitFormID' || selectedType === 'outfitsForceRefitFormID') {
            elementValueSelect.style.display = 'none';
            blacklistedValue.style.display = 'none';
            outfitsValue.style.display = 'none';
            elementValueInput.style.display = 'block';
            elementValueInput.value = '';
            elementValueInput.placeholder = 'E.g.: YurianaWench.esp';
        } else {
            elementValueSelect.style.display = 'none';
            blacklistedValue.style.display = 'none';
            outfitsValue.style.display = 'none';
            elementValueInput.style.display = 'block';
            elementValueInput.value = '';
            elementValueInput.placeholder = 'E.g.: Serana, GuardFaction, xx0001...';
        }

        const data = sampleData[selectedType];
        if (data) {
            let randomPresets = '';

            if (selectedType === 'blacklisted') {
                const firstElement = data.values[0];
                randomPresets = data.presets[firstElement];
            } else if (selectedType === 'outfits') {
                const firstElement = data.values[0];
                randomPresets = data.presets[firstElement];
            } else {
                if (Array.isArray(data.presets)) {
                    randomPresets = data.presets[Math.floor(Math.random() * data.presets.length)];
                }
            }

            presetsInput.value = randomPresets;

            if (selectedType !== 'raceFemale' && selectedType !== 'raceMale' && selectedType !== 'blacklisted' && selectedType !== 'outfits') {
                if (selectedType === 'npcFormID') {
                    elementValueInput.value = data.values[0];
                } else if (selectedType === 'blacklistedNpcsFormID' || selectedType === 'blacklistedOutfitsFromORefitFormID' || selectedType === 'outfitsForceRefitFormID') {
                    elementValueInput.value = data.values[0];
                } else {
                    const randomValue = data.values[Math.floor(Math.random() * data.values.length)];
                    elementValueInput.value = randomValue;
                }
            }
        }

        if (!selectedType) {
            presetsInput.value = '';
            modeSelect.value = '';
        }

        updateRuleFavoritesVisibility(selectedType);
    });

    blacklistedValue.addEventListener('change', function() {
        if (ruleTypeSelect.value === 'blacklisted') {
            const data = sampleData.blacklisted;
            if (data && this.value && data.presets[this.value]) {
                presetsInput.value = data.presets[this.value];
            }
        }
        updateRuleFavoritesVisibility(ruleTypeSelect.value);
    });

    elementValueSelect.addEventListener('change', function() {
        if (this.value === 'custom') {
            this.style.display = 'none';
            elementValueInput.style.display = 'block';
            elementValueInput.value = '';
            elementValueInput.placeholder = 'Enter custom race name...';
            elementValueInput.focus();
        }
    });

    outfitsValue.addEventListener('change', function() {
        if (ruleTypeSelect.value === 'outfits') {
            const data = sampleData.outfits;
            const selectedOutfitType = this.value;
            if (data && selectedOutfitType && data.presets[selectedOutfitType]) {
                presetsInput.value = data.presets[selectedOutfitType];
            }
        }
        updateRuleFavoritesVisibility(ruleTypeSelect.value);
    });

    newRuleBtn.addEventListener('click', function(e) {
        e.preventDefault();
        newRuleBtn.classList.add('glow');
        setTimeout(() => newRuleBtn.classList.remove('glow'), 500);
        const ruleType = ruleTypeSelect.value;
        let elementValue = '';

        if (ruleType === 'outfits') {
            elementValue = outfitsValue.value;
        } else if (ruleType === 'blacklisted' && blacklistedValue.style.display !== 'none') {
            elementValue = blacklistedValue.value;
        } else if (elementValueSelect.style.display !== 'none' && elementValueSelect.value !== 'custom') {
            elementValue = elementValueSelect.value;
        } else {
            elementValue = elementValueInput.value.trim();
        }

        const presets = presetsInput.value.trim();
        const mode = modeSelect.value;

        if (!ruleType || !elementValue || !presets) {
            const baseRules = removeDefaultRuleMessage(permanentRules);
            if (baseRules) {
                generatedRuleEl.innerHTML = highlightRule(baseRules);
            } else {
                generatedRuleEl.innerHTML = DEFAULT_RULE_MESSAGE;
            }
            return;
        }

        const modeDescriptions = {
            'x': 'simple application', '': 'simple application', '1': 'once', '0': 'disabled', 
            '-': 'remove preset', 'x-': 'unlimited remove', '*': 'priority preset', 
            'x*': 'unlimited priority preset', '1-': 'once remove', '1*': 'once priority',
            'KeyWord': 'keyword search', 'KeyWord-': 'keyword remove', 'KeyWord*': 'keyword priority', 
            'KeyWord1': 'keyword once', 'KeyWord1-': 'keyword once remove', 'KeyWord1*': 'keyword once priority',
            'KeyWordChart': 'chart keyword search', 'KeyWordChart-': 'chart keyword remove', 
            'KeyWordChart*': 'chart keyword priority', 'KeyWordChart1': 'chart keyword once', 
            'KeyWordChart1-': 'chart keyword once remove', 'KeyWordChart1*': 'chart keyword once priority',
            'KeyAuthor': 'author search', 'KeyAuthor-': 'author remove', 'KeyAuthor*': 'author priority', 
            'KeyAuthor1': 'author once', 'KeyAuthor1-': 'author once remove', 'KeyAuthor1*': 'author once priority',
            'KeyNormal': 'normal family filter', 'KeyNormal-': 'normal family remove', 
            'KeyNormal*': 'normal family priority', 'KeyNormal1': 'normal family once', 
            'KeyNormal1-': 'normal family once remove', 'KeyNormal1*': 'normal family once priority',
            'KeyUBE': 'UBE family filter', 'KeyUBE-': 'UBE family remove', 'KeyUBE*': 'UBE family priority', 
            'KeyUBE1': 'UBE family once', 'KeyUBE1-': 'UBE family once remove', 'KeyUBE1*': 'UBE family once priority',
            'KeyHIMBO': 'HIMBO family filter', 'KeyHIMBO-': 'HIMBO family remove', 
            'KeyHIMBO*': 'HIMBO family priority', 'KeyHIMBO1': 'HIMBO family once', 
            'KeyHIMBO1-': 'HIMBO family once remove', 'KeyHIMBO1*': 'HIMBO family once priority'
        };
        const modeDesc = modeDescriptions[mode] || mode;

        let comment = '';
        if (ruleType === 'blacklisted') {
            comment = `;${elementValue} blacklisted in mode ${modeDesc}`;
        } else if (ruleType === 'outfits') {
            comment = `;${elementValue} outfits in mode ${modeDesc}`;
        } else if (ruleType === 'npcFormID') {
            comment = `;${elementValue} npcFormID in mode ${modeDesc}`;
        } else if (ruleType === 'blacklistedNpcsFormID') {
            comment = `;${elementValue} blacklistedNpcsFormID in mode ${modeDesc}`;
        } else if (ruleType === 'blacklistedOutfitsFromORefitFormID') {
            comment = `;${elementValue} blacklistedOutfitsFromORefitFormID in mode ${modeDesc}`;
        } else if (ruleType === 'outfitsForceRefitFormID') {
            comment = `;${elementValue} outfitsForceRefitFormID in mode ${modeDesc}`;
        } else {
            comment = `;${elementValue} ${ruleType} in mode ${modeDesc}`;
        }

        const rule = `${ruleType} = ${elementValue}|${presets}|${mode}`;
        const newRuleText = `${comment}\n${rule}`;

        const baseRules = removeDefaultRuleMessage(permanentRules);
        undoStack.push(baseRules);
        redoStack = [];
        permanentRules = baseRules + (baseRules ? '\n\n' : '') + newRuleText;
        generatedRuleEl.innerHTML = highlightRule(permanentRules);

        if (elementValueSelect.style.display !== 'none') {
            elementValueSelect.value = '';
        } else if (blacklistedValue.style.display !== 'none') {
            blacklistedValue.value = '';
        } else if (outfitsValue.style.display !== 'none') {
            outfitsValue.value = '';
        } else {
            elementValueInput.value = '';
        }
        presetsInput.value = '';
        modeSelect.value = '';

        const basicRadio = document.querySelector('input[name="modeLevel"][value="basic"]');
        if (basicRadio) {
            basicRadio.checked = true;
            setupModeLevelFilter();
        }

        ruleTypeSelect.value = '';
        elementValueSelect.style.display = 'none';
        blacklistedValue.style.display = 'none';
        outfitsValue.style.display = 'none';
        elementValueInput.style.display = 'block';
        elementValueInput.placeholder = 'E.g.: Serana, GuardFaction, xx0001...';
        hasLocalGeneratedRulesEdits = true;
        saveGeneratedRules();
    });

    copyRuleBtn.addEventListener('click', function() {
        silentlyLockButton(this, 1000);
        const rawText = generatedRuleEl.innerText.trim();
        let ruleText = removeDefaultRuleMessage(rawText);

        if (!hasEffectiveRules(ruleText)) {
            showToast('❌ No rules to copy', '#ef4444');
            return;
        }

        const lines = ruleText.split('\n');
        if (!(lines.length >= 2 && lines[lines.length - 2].trim().startsWith(';') && lines[lines.length - 1].includes('='))) {
            ruleText = removeDefaultRuleMessage(permanentRules).trim();
        }

        if (!hasEffectiveRules(ruleText)) {
            showToast('❌ No rules to copy', '#ef4444');
            return;
        }

        copyToClipboard(ruleText, this);
        const audio = new Audio('Sound/newspaper-foley.wav');
        audio.play();
    });

    cleanRuleBtn.addEventListener('click', function() {
        silentlyLockButton(this, 1000);
        undoStack.push(permanentRules);
        redoStack = [];
        permanentRules = '';
        generatedRuleEl.innerHTML = DEFAULT_RULE_MESSAGE;
        saveGeneratedRules();
        showToast('🗑️ CLEANED!', '#10b981');
        // Play sound when cleaning rules
        const audio = new Audio('Assets/Sound/swoosh-07.wav');
        audio.play();
    });

    saveRuleBtn.addEventListener('click', async function() {
        silentlyLockButton(this, 1000);
        const rawRules = generatedRuleEl.innerText.trim();
        const rules = removeDefaultRuleMessage(rawRules);
        if (!hasEffectiveRules(rules)) {
            showFeedback(this, '❌ No rules to save', '#ef4444');
            return;
        }
    
        // Play the sound as first action
        const audio = new Audio('Sound/ding-small-bell-sfx.wav');
        audio.play();
    
        // Show auto-sync indicator
        document.getElementById('autoSyncIndicator').style.display = 'flex';

        // Save to temp file for Python to use
        try {
            const response = await fetch(`${BASE_URL}/save-generated-rules`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rules: rules })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            if (result.status === 'success') {
                console.log('Rules saved to temp file for Python processing');
            } else {
                console.error('Failed to save rules to temp file:', result.message);
                showToast('❌ Failed to save rules to temp file', '#ef4444');
                document.getElementById('autoSyncIndicator').style.display = 'none';
                return;
            }
        } catch (error) {
            console.error('Error saving rules to temp file:', error);
            showFeedback(this, '❌ Error saving rules to temp file', '#ef4444');
            document.getElementById('autoSyncIndicator').style.display = 'none';
            return;
        }

        try {
            const toggleResponse = await fetch(`${BASE_URL}/toggle-enable-save`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({})
            });
            if (!toggleResponse.ok) throw new Error('HTTP ' + toggleResponse.status);
            const toggleResult = await toggleResponse.json();
            if (toggleResult.status === 'success') {
                console.log('EnableSave activated successfully');
                showToast('✓ Save dialog opened', '#10b981');
            } else {
                console.error('Failed to toggle EnableSave:', toggleResult.message);
                showToast('❌ Failed to open save dialog', '#ef4444');
                document.getElementById('autoSyncIndicator').style.display = 'none';
                return;
            }
        } catch (error) {
            console.error('Error toggling EnableSave:', error);
            showFeedback(this, '❌ Error opening save dialog', '#ef4444');
            document.getElementById('autoSyncIndicator').style.display = 'none';
            return;
        }

        // Hide auto-sync indicator
        document.getElementById('autoSyncIndicator').style.display = 'none';
    });

    if (modPackBtn) {
        modPackBtn.addEventListener('click', async (e) => {
            silentlyLockButton(e.currentTarget, 1000);
            const audio = new Audio('../Sound/ding-small-bell-sfx.wav');
            audio.play();
            try {
                const response = await fetch(`${BASE_URL}/run-mod-pack-script`, {
                    method: 'POST'
                });
                if (!response.ok) throw new Error('HTTP ' + response.status);
                const result = await response.json();
                if (result.status === 'success') {
                    showToast(result.message || 'Mod pack created', '#10b981');
                } else {
                    if (result.status === 'cancelled') {
                        showToast(result.message || 'Cancelled', '#9ca3af');
                    } else {
                        showToast(result.message || 'Error creating mod pack', '#ef4444');
                    }
                }
            } catch (error) {
                console.error('Error:', error);
                showToast('Connection error', '#ef4444');
            }
        });
    }

    [ruleTypeSelect, elementValueSelect, blacklistedValue, elementValueInput, outfitsValue, presetsInput, modeSelect].forEach(element => {
        element.addEventListener('input', updatePreview);
        element.addEventListener('change', updatePreview);
    });

    function updatePreview() {
        const ruleType = ruleTypeSelect.value;
        let elementValue = '';

        if (ruleType === 'outfits') {
            elementValue = outfitsValue.value;
        } else if (ruleType === 'blacklisted' && blacklistedValue.style.display !== 'none') {
            elementValue = blacklistedValue.value;
        } else if (elementValueSelect.style.display !== 'none' && elementValueSelect.value !== 'custom') {
            elementValue = elementValueSelect.value;
        } else {
            elementValue = elementValueInput.value.trim();
        }

        const presets = presetsInput.value.trim();
        const mode = modeSelect.value;

        const baseRules = removeDefaultRuleMessage(permanentRules);

        if (!baseRules && (!ruleType || !elementValue || !presets)) {
            generatedRuleEl.innerHTML = DEFAULT_RULE_MESSAGE;
            return;
        }

        if (baseRules && (!ruleType || !elementValue || !presets)) {
            generatedRuleEl.innerHTML = highlightRule(baseRules);
            return;
        }

        const modeDescriptions = {
            'x': 'simple application', '': 'simple application', '1': 'once', '0': 'disabled',
            '-': 'remove preset', 'x-': 'unlimited remove', '*': 'priority preset',
            'x*': 'unlimited priority preset', '1-': 'once remove', '1*': 'once priority',
            'KeyWord': 'keyword search', 'KeyWord-': 'keyword remove', 'KeyWord*': 'keyword priority',
            'KeyWord1': 'keyword once', 'KeyWord1-': 'keyword once remove', 'KeyWord1*': 'keyword once priority',
            'KeyWordChart': 'chart keyword search', 'KeyWordChart-': 'chart keyword remove',
            'KeyWordChart*': 'chart keyword priority', 'KeyWordChart1': 'chart keyword once',
            'KeyWordChart1-': 'chart keyword once remove', 'KeyWordChart1*': 'chart keyword once priority',
            'KeyAuthor': 'author search', 'KeyAuthor-': 'author remove', 'KeyAuthor*': 'author priority',
            'KeyAuthor1': 'author once', 'KeyAuthor1-': 'author once remove', 'KeyAuthor1*': 'author once priority',
            'KeyNormal': 'Normal family filter', 'KeyNormal-': 'Normal family remove',
            'KeyNormal*': 'Normal family priority', 'KeyNormal1': 'Normal family once',
            'KeyNormal1-': 'Normal family once remove', 'KeyNormal1*': 'Normal family once priority',
            'KeyUBE': 'UBE family filter', 'KeyUBE-': 'UBE family remove', 'KeyUBE*': 'UBE family priority',
            'KeyUBE1': 'UBE family once', 'KeyUBE1-': 'UBE family once remove', 'KeyUBE1*': 'UBE family once priority',
            'KeyHIMBO': 'HIMBO family filter', 'KeyHIMBO-': 'HIMBO family remove',
            'KeyHIMBO*': 'HIMBO family priority', 'KeyHIMBO1': 'HIMBO family once',
            'KeyHIMBO1-': 'HIMBO family once remove', 'KeyHIMBO1*': 'HIMBO family once priority'
        };
        const modeDesc = modeDescriptions[mode] || mode;

        let comment = '';
        if (ruleType === 'blacklisted') {
            comment = `;${elementValue} blacklisted in mode ${modeDesc}`;
        } else if (ruleType === 'outfits') {
            comment = `;${elementValue} outfits in mode ${modeDesc}`;
        } else if (ruleType === 'npcFormID') {
            comment = `;${elementValue} npcFormID in mode ${modeDesc}`;
        } else if (ruleType === 'blacklistedNpcsFormID') {
            comment = `;${elementValue} blacklistedNpcsFormID in mode ${modeDesc}`;
        } else if (ruleType === 'blacklistedOutfitsFromORefitFormID') {
            comment = `;${elementValue} blacklistedOutfitsFromORefitFormID in mode ${modeDesc}`;
        } else if (ruleType === 'outfitsForceRefitFormID') {
            comment = `;${elementValue} outfitsForceRefitFormID in mode ${modeDesc}`;
        } else {
            comment = `;${elementValue} presets in mode ${modeDesc}`;
        }

        const rule = `${ruleType} = ${elementValue}|${presets}|${mode}`;
        const previewText = `${comment}\n${rule}`;

        const mergedText = baseRules ? baseRules + '\n\n' + previewText : previewText;
        generatedRuleEl.innerHTML = highlightRule(mergedText);
    }

    setupModeLevelFilter();

    try {
        const response = await fetch(`${BASE_URL}/load-temp-ini`);
        if (!response.ok) throw new Error('HTTP ' + response.status);
        const result = await response.json();
        if (result.status === 'success' && result.content) {
            permanentRules = removeDefaultRuleMessage(result.content || '');
        }
    } catch (error) {
        console.error('Error loading initial temp content:', error);
    }

    await loadTempContentToGeneratedRules();

    // Add undo/redo buttons
    const rulesSection = generatedRuleEl.parentElement;
    rulesSection.style.position = 'relative';

    const undoBtn = document.createElement('button');
    undoBtn.textContent = '← Undo';
    undoBtn.style.cssText = 'position: absolute; bottom: 10px; right: 80px; z-index: 10; background: rgba(0,0,0,0.5); color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer; font-size: 14px;';
    undoBtn.addEventListener('click', () => {
        if (undoStack.length > 0) {
            redoStack.push(permanentRules);
            permanentRules = undoStack.pop();
            generatedRuleEl.innerHTML = highlightRule(permanentRules);
            saveGeneratedRules();
        }
    });

    const redoBtn = document.createElement('button');
    redoBtn.textContent = 'Redo →';
    redoBtn.style.cssText = 'position: absolute; bottom: 10px; right: 10px; z-index: 10; background: rgba(0,0,0,0.5); color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer; font-size: 14px;';
    redoBtn.addEventListener('click', () => {
        if (redoStack.length > 0) {
            undoStack.push(permanentRules);
            permanentRules = redoStack.pop();
            generatedRuleEl.innerHTML = highlightRule(permanentRules);
            saveGeneratedRules();
        }
    });

    rulesSection.appendChild(undoBtn);
    rulesSection.appendChild(redoBtn);
}

function setupModeLevelFilter() {
    const radios = document.querySelectorAll('input[name="modeLevel"]');
    const modeSelect = document.getElementById('mode');
    
    if (!radios.length || !modeSelect) return;
    
    const allOptions = Array.from(modeSelect.querySelectorAll('option')).map(opt => ({
        value: opt.value,
        text: opt.textContent,
        level: opt.getAttribute('data-level') || 'basic'
    }));

    function filterOptions(selectedLevel) {
        modeSelect.innerHTML = '';
        allOptions.forEach(optData => {
            let shouldShow = false;
            if (selectedLevel === 'basic' && optData.level === 'basic') shouldShow = true;
            else if (selectedLevel === 'medium' && (optData.level === 'basic' || optData.level === 'medium')) shouldShow = true;
            else if (selectedLevel === 'advanced') shouldShow = true;
            
            if (shouldShow) {
                const option = document.createElement('option');
                option.value = optData.value;
                option.textContent = optData.text;
                option.setAttribute('data-level', optData.level);
                modeSelect.appendChild(option);
            }
        });
    }

    radios.forEach(radio => {
        radio.addEventListener('change', function() {
            filterOptions(this.value);
        });
    });

    filterOptions('basic');
}

function highlightRule(text) {
    const lines = text.split('\n');
    return lines.map(line => {
        const trimmed = line.trim();
        if (trimmed.startsWith(';')) {
            return `<span style="color: var(--text-muted);">${line}</span>`;
        }
        if (!trimmed.includes('=')) return line;

        const [key, ...rest] = line.split('=');
        const value = rest.join('=').trim();
        const [element, presets, mode] = value.split('|');

        let highlighted = `<span class="rule-key">${key.trim()}</span> = `;
        highlighted += `<span class="rule-element">${element || ''}</span>`;
        if (presets !== undefined) highlighted += `|<span class="rule-presets">${presets}</span>`;
        if (mode !== undefined) highlighted += `|<span class="rule-mode">${mode}</span>`;

        return highlighted;
    }).join('\n');
}

function removeDefaultRuleMessage(text) {
    if (!text) return '';
    const lines = text.split('\n');
    const filtered = lines.filter(line => line.trim() !== DEFAULT_RULE_MESSAGE);
    return filtered.join('\n').trim();
}

function hasEffectiveRules(text) {
    if (!text) return false;
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
        const trimmed = lines[i].trim();
        if (!trimmed) continue;
        if (trimmed === DEFAULT_RULE_MESSAGE) continue;
        if (trimmed.includes('=')) return true;
        if (trimmed.startsWith(';')) return true;
    }
    return false;
}

function copyToClipboard(text, button) {
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(() => {
            showFeedback(button, '✓ Copied!', '#10b981');
        }).catch(() => {
            fallbackCopy(text, button);
        });
    } else {
        fallbackCopy(text, button);
    }
}

function fallbackCopy(text, button) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    const success = document.execCommand('copy');
    document.body.removeChild(textarea);

    if (success) {
        showFeedback(button, '✓ Copied!', '#10b981');
    } else {
        showFeedback(button, '❌ Error', '#ef4444');
    }
}

function showFeedback(button, message, color) {
    const originalText = button.innerHTML;
    const originalColor = button.style.backgroundColor;
    
    button.innerHTML = message;
    button.style.backgroundColor = color;
    button.disabled = true;
    
    setTimeout(() => {
        button.innerHTML = originalText;
        button.style.backgroundColor = originalColor;
        button.disabled = false;
    }, 1200);
}

function loadLog(filename, textareaId) {
    const container = document.getElementById(textareaId);
    if (!container) return;

    // Store current content and scroll position
    const currentContent = container.innerHTML;
    const wasAtBottom = container.scrollHeight - container.scrollTop <= container.clientHeight + 10;

    // Only show loading if container is empty
    if (!currentContent.trim()) {
        container.innerHTML = 'Loading...';
        container.style.color = '#fbbf24';
    }

    fetch(`${BASE_URL}/load-log/${filename}`)
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                const newContent = data.content;

                const safeContent = newContent
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;');

                const analysisIniKeyColorMap = {
                    npcFormID: '#5fa8ff',
                    npc: '#5fa8ff',
                    factionFemale: '#5fa8ff',
                    factionMale: '#5fa8ff',
                    npcPluginFemale: '#5fa8ff',
                    npcPluginMale: '#5fa8ff',
                    raceFemale: '#5fa8ff',
                    raceMale: '#5fa8ff',
                    blacklistedNpcs: '#10b981',
                    blacklistedNpcsFormID: '#10b981',
                    blacklistedNpcsPluginFemale: '#10b981',
                    blacklistedNpcsPluginMale: '#10b981',
                    blacklistedRacesFemale: '#10b981',
                    blacklistedRacesMale: '#10b981',
                    blacklistedPresetsShowInOBodyMenu: '#10b981',
                    blacklistedOutfitsFromORefitFormID: '#f59e0b',
                    blacklistedOutfitsFromORefit: '#f59e0b',
                    blacklistedOutfitsFromORefitPlugin: '#f59e0b',
                    outfitsForceRefitFormID: '#f59e0b',
                    outfitsForceRefit: '#f59e0b',
                    blacklistedPresetsFromRandomDistribution: '#f59e0b',
                    blacklisted: '#10b981',
                    outfits: '#f59e0b'
                };

                const applyAnalysisIniLineRules = filename === 'OBody_NG_Preset_Distribution_Assistant-NG_Analysis_INIs.log';

                // Process each line to apply syntax highlighting
                const processedContent = safeContent.split('\n').map(line => {
                    let actorName = null;
                    if (filename === 'OBody.log') {
                        const actorRegex = /(\bto\s+actor\s+)(.+)$/i;
                        const actorMatch = line.match(actorRegex);
                        if (actorMatch) {
                            actorName = (actorMatch[2] || '').trim();
                            line = line.replace(actorRegex, '$1__ACTOR_NAME__');
                        }
                    }

                    if (applyAnalysisIniLineRules) {
                        const lineRuleMatch = line.match(/^(\s*)\[LINE\s+(\d+)\]\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
                        if (lineRuleMatch) {
                            const indent = lineRuleMatch[1] || '';
                            const lineNumber = lineRuleMatch[2];
                            const key = lineRuleMatch[3];
                            const rawValue = lineRuleMatch[4] || '';
                            const keyColor = analysisIniKeyColorMap[key];

                            if (keyColor) {
                                const firstPipe = rawValue.indexOf('|');
                                const lastPipe = rawValue.lastIndexOf('|');

                                let partA = rawValue;
                                let partB = '';
                                let partC = '';
                                let hasPipes = false;

                                if (firstPipe !== -1) {
                                    hasPipes = true;
                                    partA = rawValue.slice(0, firstPipe);
                                    if (lastPipe !== -1 && lastPipe !== firstPipe) {
                                        partB = rawValue.slice(firstPipe + 1, lastPipe);
                                        partC = rawValue.slice(lastPipe + 1);
                                    } else {
                                        partB = rawValue.slice(firstPipe + 1);
                                    }
                                }

                                const prefix = `${indent}<span style="color: #fbbf24;">[LINE</span> <span style="color: #fb923c;">${lineNumber}</span><span style="color: #fbbf24;">]</span> `;
                                const keyHtml = `<span style="color: ${keyColor}; font-weight: 700;">${key}</span>`;
                                const eqHtml = `<span style="color: #cbd5e1;"> = </span>`;

                                if (hasPipes) {
                                    const pipeHtml = `<span style="color: #94a3b8;">|</span>`;
                                    const partAHtml = `<span style="color: #fbbf24;">${partA}</span>`;
                                    const partBHtml = `<span style="color: #00bcd4;">${partB}</span>`;
                                    const partCHtml = `<span style="color: #f59e0b;">${partC}</span>`;
                                    return `${prefix}${keyHtml}${eqHtml}${partAHtml}${pipeHtml}${partBHtml}${pipeHtml}${partCHtml}`;
                                }

                                return `${prefix}${keyHtml}${eqHtml}<span style="color: #fbbf24;">${rawValue}</span>`;
                            }
                        }
                    }

                    // Highlight text in double quotes in lime green (first to protect content)
                    line = line.replace(/"([^"]*)"/g, '"<span style="color: #ccffcc;">$1</span>"');

                    // Highlight text in single quotes in lime green
                    line = line.replace(/'([^']*)'/g, '\'<span style="color: #ccffcc;">$1</span>\'');

                    // Highlight "false" and "False" in red
                    line = line.replace(/\b(?:false|False)\b/g, '<span style="color: #ef4444;">$&</span>');

                    // Highlight "true" and "True" in green
                    line = line.replace(/\b(?:true|True)\b/g, '<span style="color: #10b981;">$&</span>');

                    // Highlight file extensions (.ini, .log, .json, .xml) in cyan
                    line = line.replace(/\.ini\b/g, '<span style="color: #00bfff;">$&</span>');
                    line = line.replace(/\.log\b/g, '<span style="color: #00bfff;">$&</span>');
                    line = line.replace(/\.json\b/g, '<span style="color: #00bfff;">$&</span>');
                    line = line.replace(/\.xml\b/g, '<span style="color: #00bfff;">$&</span>');

                    // Highlight standalone words (ini, log, json, xml) in purple (case-insensitive)
                    line = line.replace(/\bini\b/gi, '<span style="color: #9932cc;">$&</span>');
                    line = line.replace(/\blog\b/gi, '<span style="color: #9932cc;">$&</span>');
                    line = line.replace(/\bjson\b/gi, '<span style="color: #9932cc;">$&</span>');
                    line = line.replace(/\bxml\b/gi, '<span style="color: #9932cc;">$&</span>');

                    // Highlight numbers in orange
                    line = line.replace(/\b\d+\b/g, '<span style="color: #ff8c00;">$&</span>');

                    // Highlight timestamps: [YYYY-MM-DD HH:MM:SS] (global replacement) - last to avoid conflicts
                    line = line.replace(/\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\]/g,
                        `<span style="color: #fbbf24;">[</span><span style="color: #fb923c;">$1</span><span style="color: #fbbf24;">]</span>`
                    );

                    if (actorName !== null) {
                        line = line.replace(/__ACTOR_NAME__/g, `<span class=log-actor-name>${actorName}</span>`);
                    }

                    return line;
                }).join('\n');

                container.innerHTML = processedContent;
                container.style.color = 'var(--text)';

                // Auto-scroll to bottom if user was at bottom
                if (wasAtBottom) {
                    container.scrollTop = container.scrollHeight;
                }

                if (data.path) {
                    console.log(`Loaded ${filename} from: ${data.path}`);
                }
            } else {
                if (!currentContent.trim()) {
                    container.innerHTML = 'Error loading log file';
                    container.style.color = '#ef4444';
                }
            }
        })
        .catch(error => {
            console.error('Error:', error);
            if (!currentContent.trim()) {
                container.innerHTML = 'Connection error';
                container.style.color = '#ef4444';
            }
        });
}

function loadAllLogs() {
    const logFiles = [
        { filename: 'OBody.log', textareaId: 'log-obody' },
        { filename: 'OBody_NG_Preset_Distribution_Assistant-NG.log', textareaId: 'log-assistant' },
        { filename: 'OBody_NG_Preset_Distribution_Assistant-NG_Advanced_MCM.log', textareaId: 'log-mcm' },
        { filename: 'OBody_NG_Preset_Distribution_Assistant-NG_Analysis_INIs.log', textareaId: 'log-analysis' },
        { filename: 'OBody_NG_Preset_Distribution_Assistant-NG_Doctor.log', textareaId: 'log-doctor' },
        { filename: 'OBody_NG_Preset_Distribution_Assistant-NG_List-Helper.log', textareaId: 'log-list' },
        { filename: 'OBody_NG_Preset_Distribution_Assistant-NG_Smart_Cleaning.log', textareaId: 'log-cleaning' },
        { filename: 'server_errors.log', textareaId: 'log-server-errors' }
    ];

    logFiles.forEach(log => {
        loadLog(log.filename, log.textareaId);
    });
}

function expandLog(textareaId, title) {
    const source = document.getElementById(textareaId);
    const modal = document.getElementById('logExpandModal');
    const content = document.getElementById('logExpandContent');
    const titleEl = document.getElementById('logExpandTitle');
    if (!source || !modal || !content || !titleEl) return;

    const inner = source.innerHTML && source.innerHTML.trim()
        ? source.innerHTML
        : 'No log content loaded yet. Click "Reload" first.';

    content.innerHTML = inner;
    titleEl.textContent = title || 'Log Viewer';
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

function closeLogExpandModal() {
    const modal = document.getElementById('logExpandModal');
    if (!modal) return;
    modal.style.display = 'none';
    document.body.style.overflow = 'auto';
}

function setupObodyLogLink() {
    const link = document.getElementById('obodyLogLink');
    if (!link) return;

    link.addEventListener('click', () => {
        showObodyLogLoadingToast();
        const logTabBtn = document.querySelector('button[data-target="tab-memorias"]');
        if (logTabBtn) {
            logTabBtn.click();
        }
        setTimeout(() => {
            expandLog('log-obody', 'OBody.log');
        }, 2000);
    });
}

function playReloadSound() {
    const audio = new Audio('Sound/swoosh-07.wav');
    audio.play();
}

function playCopySound() {
    const audio = new Audio('Sound/newspaper-foley.wav');
    audio.play();
}

function playExpandSound() {
    const audio = new Audio('Sound/finger-snap.wav');
    audio.play();
}

async function loadPluginSelector() {
    console.log('[DEBUG] loadPluginSelector: Starting plugin selector load');
    try {
        // Guardar referencias a los elementos GIF
        const tableGifContainer = document.querySelector('.table-gif-container');

        const [jsonResponse, iniResponse, pdaResponse] = await Promise.all([
            fetch(`${BASE_URL}/load-plugins-json`),
            fetch(`${BASE_URL}/load-plugins-ini`),
            fetch(`${BASE_URL}/load-pda-plugins-json`)
        ]);
        const pluginsData = await jsonResponse.json();
        const iniData = await iniResponse.json();
        const pdaData = await pdaResponse.json();
        console.log('[DEBUG] loadPluginSelector: Data loaded successfully', {
            pluginsCount: pluginsData.plugins?.length || 0,
            iniDataKeys: Object.keys(iniData).length,
            pdaDataKeys: Object.keys(pdaData).length
        });

        // Create map from PDA plugins: name -> {id, type}
        const pdaMap = {};
        if (pdaData.plugin_list) {
            pdaData.plugin_list.forEach(plugin => {
                pdaMap[plugin.plugin] = { id: plugin.id, type: plugin.type };
            });
        }

        // Merge PDA data into pluginsData.plugins
        if (pluginsData.plugins && Array.isArray(pluginsData.plugins)) {
            pluginsData.plugins.forEach(plugin => {
                const pdaInfo = pdaMap[plugin.plugin_name] || {};
                plugin.id = pdaInfo.id || '-';
                plugin.type = pdaInfo.type || '-';
            });
        }
        const container = document.getElementById('pluginSelectorContent');
        console.log('[DEBUG] loadPluginSelector: Container found:', !!container);
        container.innerHTML = '';
        if (pluginsData.plugins && Array.isArray(pluginsData.plugins)) {
            console.log('[DEBUG] loadPluginSelector: Creating table with', pluginsData.plugins.length, 'plugins');
            const tableWrapper = document.createElement('div');
            tableWrapper.style.height = '1200px';
            tableWrapper.style.overflowY = 'auto';
            tableWrapper.style.borderRadius = '6px';

            const table = document.createElement('table');
            table.className = 'plugin-selector-table';
            table.innerHTML = `
                <thead>
                    <tr>
                        <th class="plugin-name sortable" data-sort="name">Name <span class="arrow"></span></th>
                        <th class="plugin-id sortable" data-sort="id">ID <span class="arrow"></span></th>
                        <th class="plugin-type sortable" data-sort="type">Type <span class="arrow"></span></th>
                        <th class="plugin-armor sortable" data-sort="armor">Armor <span class="arrow"></span></th>
                        <th class="plugin-outfit sortable" data-sort="outfit">Outfit <span class="arrow"></span></th>
                        <th class="plugin-weapon sortable" data-sort="weapon">Weapon <span class="arrow"></span></th>
                        <th class="plugin-checkbox sortable" data-sort="checkbox">Check <span class="arrow"></span></th>
                    </tr>
                </thead>
                <tbody>
                </tbody>
            `;
            console.log('[DEBUG] loadPluginSelector: Table header created with "Check" column');
            tableWrapper.appendChild(table);
            container.appendChild(tableWrapper);

            // Animación aleatoria de GIFs
            let images = [];
            try {
                const response = await fetch('Data/LIST.txt');
                if (response.ok) {
                    const text = await response.text();
                    const lines = text.split('\n').filter(line => line.trim());
                    images = lines.map(line => 'Data/' + line.trim()).filter(Boolean);
                } else {
                    // Fallback si el fetch falla
                    images = ['Data/013.gif'];
                }
            } catch (error) {
                console.error('Error loading GIF list:', error);
                images = ['Data/013.gif'];
            }

            // Segundo GIF estático debajo de la tabla
            const tableGif = document.createElement('div');
            tableGif.className = 'table-gif-container';
            const img = document.createElement('img');
            const randomImg = images.length > 0 ? images[Math.floor(Math.random() * images.length)] : 'Data/013.gif';
            img.src = randomImg;
            img.className = 'table-gif';
            img.alt = "Icon";
            tableGif.appendChild(img);
            container.appendChild(tableGif);

            // Cambiar GIF aleatorio cada 30 segundos
            const gifInterval = setInterval(() => {
                const randomImg = images.length > 0 ? images[Math.floor(Math.random() * images.length)] : 'Data/013.gif';
                img.src = randomImg;
            }, 30000);

            const gifImg = document.createElement('img');

            // Control de animación del GIF
            const toggleGifBtn = document.getElementById('toggleGifBtn');
            if (toggleGifBtn && gifImg) {
                toggleGifBtn.addEventListener('click', () => {
                    gifImg.style.animationPlayState =
                        gifImg.style.animationPlayState === 'paused' ? 'running' : 'paused';
                });
            }
            const tbody = table.querySelector('tbody');
            pluginsData.plugins.forEach(plugin => {
                const pluginName = plugin.plugin_name;
                const enabled = iniData[pluginName] === true;
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td class="plugin-name">${pluginName}</td>
                    <td class="plugin-id">${plugin.id || '-'}</td>
                    <td class="plugin-type">${plugin.type || '-'}</td>
                    <td class="plugin-armor">${plugin.armor_count}</td>
                    <td class="plugin-outfit">${plugin.outfit_count}</td>
                    <td class="plugin-weapon">${plugin.weapon_count}</td>
                    <td class="plugin-checkbox"><input type="checkbox" ${enabled ? 'checked' : ''} data-type="general" data-plugin="${pluginName}"></td>
                `;
                tbody.appendChild(tr);
            });
            // Add plugin count badge
            const pluginCount = pluginsData.plugins.length;
            const countEl = document.getElementById('pluginCount');
            countEl.textContent = `${pluginCount} plugins total`;
            countEl.classList.add('plugin-badge');

            updateSelectedBadge('general', 'selectedBadgePlugins', 'pluginOutfitsActualisationBtn');

            // Add event listeners
            let debounce;
            container.querySelectorAll('input[type="checkbox"]').forEach(cb => {
                cb.addEventListener('change', () => {
                    updateSelectedBadge('general', 'selectedBadgePlugins', 'pluginOutfitsActualisationBtn');
                    clearTimeout(debounce);
                    debounce = setTimeout(async () => {
                        const plugin = String(cb.dataset.plugin || '').trim();
                        const enabled = cb.checked;
                        try {
                            const saveResponse = await fetch(`${BASE_URL}/save-plugin-selector`, {
                                method: 'POST',
                                headers: {'Content-Type': 'application/json'},
                                body: JSON.stringify({ plugin, enabled })
                            });
                            const result = await saveResponse.json().catch(() => ({}));
                            if (!saveResponse.ok || result.error) {
                                throw new Error(result.error || ('HTTP ' + saveResponse.status));
                            }
                        } catch (error) {
                            console.error('Error saving plugin selector:', error);
                        }
                        updateSelectedBadge('general', 'selectedBadgePlugins', 'pluginOutfitsActualisationBtn');
                    }, 1000);
                });
            });

            // Add click event listeners to table rows for selection
            tbody.querySelectorAll('tr').forEach(tr => {
                tr.addEventListener('click', () => {
                    // Remove selected class from all rows
                    tbody.querySelectorAll('tr').forEach(otherTr => otherTr.classList.remove('selected'));
                    // Add selected class to clicked row
                    tr.classList.add('selected');
                });
            });

            // Add click event listeners to sortable headers
            container.querySelectorAll('.sortable').forEach(header => {
                header.addEventListener('click', () => {
                    const column = header.dataset.sort;
                    sortTable(column, 'pluginSelectorContent');
                });
            });

            // Initial sort by armor desc (mayor a menor)
            sortTable('armor', 'pluginSelectorContent');
            console.log('[DEBUG] loadPluginSelector: Table creation completed successfully');
        } else {
            console.error('[DEBUG] loadPluginSelector: Invalid plugins data format');
            container.innerHTML = '<p>Error: Invalid plugins data format</p>';
        }
    } catch (error) {
        console.error('[DEBUG] loadPluginSelector: Error loading plugin selector:', error);
        const container = document.getElementById('pluginSelectorContent');
        if (container) {
            container.innerHTML = '<p>Error loading plugin selector. Check server connection.</p>';
        }
        showToast('Error loading plugin selector', '#ef4444');
    }
    console.log('[DEBUG] loadPluginSelector: Function execution completed');
}

/**
 * Toggle visibility of GIF elements in the plugin selector
 */
function toggleGifVisibility() {
    const tableGifContainers = document.querySelectorAll('.table-gif-container');

    // Si no hay contenedores, salir
    if (tableGifContainers.length === 0) return;

    // Determinar si debemos mostrar u ocultar basado en el primer GIF
    // Si el primer GIF tiene display 'none' (por CSS o inline), mostramos todos
    // Si no, ocultamos todos
    const shouldShow = tableGifContainers[0].style.display === 'none' ||
                       window.getComputedStyle(tableGifContainers[0]).display === 'none';

    // Aplicar el mismo estado a todos los GIFs
    tableGifContainers.forEach(container => {
        container.style.display = shouldShow ? 'block' : 'none';
    });
}

/**
 * Refresh the plugin selector by reloading
 */
function refreshPluginSelector() {
    loadPluginSelector();
}

function sortTable(column, containerId) {
    // Detectar el contenedor correcto (NPC o Plugins Items)
    const container = document.getElementById(containerId);
    const isNpcTable = containerId === 'npcPluginSelectorContent';

    const tbody = container.querySelector('tbody');
    if (!tbody) return;

    const rows = Array.from(tbody.querySelectorAll('tr'));
    const selectedRow = tbody.querySelector('tr.selected');

    // Toggle direction for name, id, type, armor, outfit, weapon, checkbox, and npc
    if (column === 'name') {
        sortTable.nameDir = (sortTable.nameDir === 'asc') ? 'desc' : 'asc';
    } else if (column === 'id') {
        sortTable.idDir = (sortTable.idDir === 'asc') ? 'desc' : 'asc';
    } else if (column === 'type') {
        sortTable.typeDir = (sortTable.typeDir === 'asc') ? 'desc' : 'asc';
    } else if (column === 'armor') {
        sortTable.armorDir = (sortTable.armorDir === 'asc') ? 'desc' : 'asc';
    } else if (column === 'outfit') {
        sortTable.outfitDir = (sortTable.outfitDir === 'asc') ? 'desc' : 'asc';
    } else if (column === 'weapon') {
        sortTable.weaponDir = (sortTable.weaponDir === 'asc') ? 'desc' : 'asc';
    } else if (column === 'checkbox') {
        sortTable.checkboxDir = (sortTable.checkboxDir === 'desc') ? 'asc' : 'desc'; // checked first (desc) or unchecked first (asc)
    } else if (column === 'npc') {
        sortTable.npcDir = (sortTable.npcDir === 'asc') ? 'desc' : 'asc';
    }

    const dir = (column === 'name') ? sortTable.nameDir :
                (column === 'id') ? sortTable.idDir :
                (column === 'type') ? sortTable.typeDir :
                (column === 'armor') ? sortTable.armorDir :
                (column === 'outfit') ? sortTable.outfitDir :
                (column === 'weapon') ? sortTable.weaponDir :
                (column === 'npc') ? sortTable.npcDir : sortTable.checkboxDir;

    // Update arrow classes
    const headers = container.querySelectorAll('.sortable');
    headers.forEach(header => {
        const arrow = header.querySelector('.arrow');
        if (header.dataset.sort === column) {
            arrow.className = 'arrow ' + dir;
        } else {
            arrow.className = 'arrow';
        }
    });

    rows.sort((a, b) => {
        let aVal, bVal;
        if (column === 'name') {
            aVal = a.cells[0].textContent.trim().toLowerCase();
            bVal = b.cells[0].textContent.trim().toLowerCase();
            return dir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
        } else if (column === 'id') {
            aVal = a.cells[1].textContent.trim().toLowerCase();
            bVal = b.cells[1].textContent.trim().toLowerCase();
            return dir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
        } else if (column === 'type') {
            aVal = a.cells[2].textContent.trim().toLowerCase();
            bVal = b.cells[2].textContent.trim().toLowerCase();
            return dir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
        } else if (column === 'armor') {
            aVal = parseInt(a.cells[3].textContent.trim()) || 0;
            bVal = parseInt(b.cells[3].textContent.trim()) || 0;
            return dir === 'asc' ? aVal - bVal : bVal - aVal;
        } else if (column === 'outfit') {
            aVal = parseInt(a.cells[4].textContent.trim()) || 0;
            bVal = parseInt(b.cells[4].textContent.trim()) || 0;
            return dir === 'asc' ? aVal - bVal : bVal - aVal;
        } else if (column === 'weapon') {
            aVal = parseInt(a.cells[5].textContent.trim()) || 0;
            bVal = parseInt(b.cells[5].textContent.trim()) || 0;
            return dir === 'asc' ? aVal - bVal : bVal - aVal;
        } else if (column === 'checkbox') {
            // Para la tabla de Plugins Items (7 columnas)
            if (!isNpcTable) {
                aVal = a.cells[6].querySelector('input[type="checkbox"]').checked ? 1 : 0;
                bVal = b.cells[6].querySelector('input[type="checkbox"]').checked ? 1 : 0;
            }
            // Para la tabla de NPC (5 columnas)
            else {
                aVal = a.cells[4].querySelector('input[type="checkbox"]').checked ? 1 : 0;
                bVal = b.cells[4].querySelector('input[type="checkbox"]').checked ? 1 : 0;
            }
            return dir === 'desc' ? bVal - aVal : aVal - bVal; // desc: checked first, asc: unchecked first
        } else if (column === 'npc') {
            aVal = parseInt(a.cells[3].textContent.trim()) || 0;
            bVal = parseInt(b.cells[3].textContent.trim()) || 0;
            return dir === 'asc' ? aVal - bVal : bVal - aVal;
        }
        return 0;
    });

    // Re-append rows to tbody
    rows.forEach(row => tbody.appendChild(row));

    // Restore selected row
    if (selectedRow) {
        const newSelected = tbody.querySelector(`tr[data-plugin="${selectedRow.getAttribute('data-plugin')}"]`);
        if (newSelected) {
            tbody.querySelectorAll('tr').forEach(tr => tr.classList.remove('selected'));
            newSelected.classList.add('selected');
        }
    }
}

// Initialize sort directions
sortTable.nameDir = 'asc';
sortTable.idDir = 'asc';
sortTable.typeDir = 'asc';
sortTable.armorDir = 'desc'; // desc by default for armor (mayor a menor)
sortTable.outfitDir = 'desc'; // desc by default for outfit (mayor a menor)
sortTable.weaponDir = 'desc'; // desc by default for weapon (mayor a menor)
sortTable.checkboxDir = 'desc'; // checked first
sortTable.npcDir = 'desc'; // desc by default for npc

function countSelected(type) {
    const checkboxes = document.querySelectorAll(`input[type="checkbox"][data-type="${type}"]:checked`);
    return checkboxes.length;
}

function updateSelectedBadge(type, badgeId, buttonId) {
    const count = countSelected(type);
    const existing = document.getElementById(badgeId);
    if (existing) {
        existing.textContent = `(${count} selected)`;
        return;
    }
    const btn = document.getElementById(buttonId);
    if (!btn || !btn.parentNode) return;
    const span = document.createElement('span');
    span.id = badgeId;
    span.className = 'selected-badge';
    span.textContent = `(${count} selected)`;
    btn.parentNode.insertBefore(span, btn.nextSibling);
}

async function loadNpcPluginSelector() {
    try {
        const [jsonResponse, iniResponse, pdaResponse] = await Promise.all([
            fetch(`${BASE_URL}/load-npcs-json`),
            fetch(`${BASE_URL}/load-npcs-ini`),
            fetch(`${BASE_URL}/load-pda-plugins-json`)
        ]);
        const pluginsData = await jsonResponse.json();
        const iniData = await iniResponse.json();
        const pdaData = await pdaResponse.json();

        // Create map from PDA plugins: name -> {id, type}
        const pdaMap = {};
        if (pdaData.plugin_list) {
            pdaData.plugin_list.forEach(plugin => {
                pdaMap[plugin.plugin] = { id: plugin.id, type: plugin.type };
            });
        }

        // Merge PDA data into pluginsData.plugins
        if (pluginsData.plugins && Array.isArray(pluginsData.plugins)) {
            pluginsData.plugins.forEach(plugin => {
                const pdaInfo = pdaMap[plugin.plugin_name] || {};
                plugin.id = pdaInfo.id || '-';
                plugin.type = pdaInfo.type || '-';
            });
        }
        const container = document.getElementById('npcPluginSelectorContent');
        container.innerHTML = '';
        if (pluginsData.plugins && Array.isArray(pluginsData.plugins)) {
            const npcPluginCount = pluginsData.plugins.length;
            document.getElementById('npcPluginCount').textContent = `${npcPluginCount} plugins total`;
            document.getElementById('npcPluginCount').classList.add('plugin-badge');
            const pluginCount = pluginsData.plugins.length;
            const descriptionEl = document.querySelector('#pluginDescription');
            if (descriptionEl) {
                descriptionEl.textContent = `Content from Json/Act2_Plugins.json (${pluginCount} plugins total)`;
            }
            // Header moved to table thead

            const tableWrapper = document.createElement('div');
            tableWrapper.style.height = '1200px';
            tableWrapper.style.overflowY = 'auto';
            tableWrapper.style.borderRadius = '6px';

            const table = document.createElement('table');
            table.className = 'plugin-selector-table';
            table.innerHTML = `
                <thead>
                    <tr>
                        <th class="npc-name sortable" data-sort="name">Name <span class="arrow"></span></th>
                        <th class="plugin-id sortable" data-sort="id">ID <span class="arrow"></span></th>
                        <th class="plugin-type sortable" data-sort="type">Type <span class="arrow"></span></th>
                        <th class="npc-count sortable" data-sort="npc">NPC <span class="arrow desc"></span></th>
                        <th class="npc-checkbox sortable" data-sort="checkbox">Checkbox <span class="arrow"></span></th>
                    </tr>
                </thead>
                <tbody>
                </tbody>
            `;
            tableWrapper.appendChild(table);
            container.appendChild(tableWrapper);

            // Animación aleatoria de GIFs
            let images = [];
            try {
                const response = await fetch('Data/LIST.txt');
                if (response.ok) {
                    const text = await response.text();
                    const lines = text.split('\n').filter(line => line.trim());
                    images = lines.map(line => 'Data/' + line.trim()).filter(Boolean);
                } else {
                    // Fallback si el fetch falla
                    images = ['Data/013.gif'];
                }
            } catch (error) {
                console.error('Error loading GIF list:', error);
                images = ['Data/013.gif'];
            }

            // GIF estático debajo de la tabla
            const tableGif = document.createElement('div');
            tableGif.className = 'table-gif-container';
            const img = document.createElement('img');
            const randomImg = images.length > 0 ? images[Math.floor(Math.random() * images.length)] : 'Data/013.gif';
            img.src = randomImg;
            img.className = 'table-gif';
            img.alt = "Icon";
            tableGif.appendChild(img);
            container.appendChild(tableGif);

            // Cambiar GIF aleatorio cada 30 segundos
            const gifInterval = setInterval(() => {
                const randomImg = images.length > 0 ? images[Math.floor(Math.random() * images.length)] : 'Data/013.gif';
                img.src = randomImg;
            }, 30000);

            const tbody = table.querySelector('tbody');
            pluginsData.plugins.forEach(plugin => {
                const pluginName = plugin.plugin_name;
                const enabled = iniData[pluginName] === true;
                const tr = document.createElement('tr');
                tr.setAttribute('data-plugin', pluginName);
                tr.innerHTML = `
                    <td class="npc-name">${pluginName}</td>
                    <td class="plugin-id">${plugin.id || '-'}</td>
                    <td class="plugin-type">${plugin.type || '-'}</td>
                    <td class="npc-count">${plugin.npc_count}</td>
                    <td class="npc-checkbox"><input type="checkbox" ${enabled ? 'checked' : ''} data-type="npc" data-plugin="${pluginName}"></td>
                `;
                tbody.appendChild(tr);
            });
            // Add selected count span after button (remove if exists to avoid duplicates)
            const npcBtn = document.getElementById('npcPluginOutfitsActualisationBtn');
            if (npcBtn) {
                const existingSpan = document.getElementById('selectedBadgeNpcPlugins');
                if (existingSpan) {
                    existingSpan.remove();
                }
                const npcSpan = document.createElement('span');
                npcSpan.id = 'selectedBadgeNpcPlugins';
                npcSpan.className = 'selected-badge';
                npcSpan.textContent = `(${countSelected('npc')} selected)`;
                npcBtn.parentNode.insertBefore(npcSpan, npcBtn.nextSibling);
            }

            // Add click event listeners to sortable headers
            container.querySelectorAll('.sortable').forEach(header => {
                header.addEventListener('click', () => {
                    const column = header.dataset.sort;
                    sortTable(column, 'npcPluginSelectorContent');
                });
            });

            // Add event listeners
            let debounce;
            container.querySelectorAll('input[type="checkbox"]').forEach(cb => {
                cb.addEventListener('change', () => {
                    clearTimeout(debounce);
                    debounce = setTimeout(async () => {
                        const plugin = String(cb.dataset.plugin || '').trim();
                        const enabled = cb.checked;
                        try {
                            const saveResponse = await fetch(`${BASE_URL}/save-npc-plugin-selector`, {
                                method: 'POST',
                                headers: {'Content-Type': 'application/json'},
                                body: JSON.stringify({ plugin, enabled })
                            });
                            const result = await saveResponse.json().catch(() => ({}));
                            if (!saveResponse.ok || result.error) {
                                throw new Error(result.error || ('HTTP ' + saveResponse.status));
                            }
                        } catch (error) {
                            console.error('Error saving NPC plugin selector:', error);
                        }
                        // Update selected count
                        const count = countSelected('npc');
                        const span = document.getElementById('selectedBadgeNpcPlugins');
                        if (span) {
                            span.textContent = `(${count} selected)`;
                        }
                    }, 1000);
                });
            });
        } else {
            container.innerHTML = '<p>Error: Invalid NPC plugins data format</p>';
        }
    } catch (error) {
        console.error('Error loading NPC plugin selector:', error);
        const container = document.getElementById('npcPluginSelectorContent');
        if (container) {
            container.innerHTML = '<p>Error loading NPC plugin selector. Check server connection.</p>';
        }
        showToast('Error loading NPC plugin selector', '#ef4444');
    }
}

function copyLog(containerId) {
    const container = document.getElementById(containerId);
    const card = document.querySelector(`#${containerId}`)?.closest('.log-card');
    const button = card ? card.querySelector('.btn-primary') : null;

    const text = container
        ? (typeof container.value === 'string' ? container.value : (container.innerText || container.textContent || ''))
        : '';

    if (!container || !text.trim()) {
        if (button) {
            showFeedback(button, '❌', '#ef4444');
        }
        return;
    }

    if (!button) {
        return;
    }

    const originalBg = button.style.backgroundColor;
    button.style.backgroundColor = '#fbbf24';
    button.textContent = 'Copying...';

    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(() => {
            showFeedback(button, '✓ Copied!', '#10b981');
            setTimeout(() => {
                button.textContent = 'Copy';
                button.style.backgroundColor = originalBg;
            }, 1500);
        }).catch(() => {
            fallbackCopyLog(text, button);
        });
    } else {
        fallbackCopyLog(text, button);
    }
}

function copyPresetToClipboard(presetName) {
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(presetName).then(() => {
            showToast('✓ Preset copied to clipboard!', '#10b981');
            const audio = new Audio('Sound/finger-snap.wav');
            audio.play();
        }).catch(() => {
            fallbackCopyPreset(presetName);
        });
    } else {
        fallbackCopyPreset(presetName);
    }
}

function selectPreset(presetName) {
    const selectedPresetsArea = document.getElementById('jsonFavoritosSelectedPresets');
    if (currentJsonModifierSection && selectedPresetsArea) {
        const current = selectedPresetsArea.value.trim();
        if (current) {
            selectedPresetsArea.value = current + ', ' + presetName;
        } else {
            selectedPresetsArea.value = presetName;
        }
        selectedPresetsArea.dispatchEvent(new Event('input', { bubbles: true }));
        bellAudio.currentTime = 0;
        bellAudio.play();
        return;
    }

    const presetsInput = document.getElementById('presets');
    if (presetsInput) {
        if (presetsInput.value.trim()) {
            presetsInput.value += ',' + presetName;
        } else {
            presetsInput.value = presetName;
        }
        presetsInput.dispatchEvent(new Event('input', { bubbles: true }));
        const audio = new Audio('Sound/ding-small-bell-sfx.wav');
        audio.play();
    }
}

async function clearAllPluginFavorites() {
    if (confirm('Are you sure you want to clear ALL Plugin Outfits favorites? This cannot be undone.')) {
        // Iterate over favoritosOutfits and empty arrays, keeping all_favorites: false
        for (const plugin in favoritosOutfits) {
            if (favoritosOutfits.hasOwnProperty(plugin)) {
                favoritosOutfits[plugin].armors = [];
                favoritosOutfits[plugin].outfits = [];
                favoritosOutfits[plugin].weapons = [];
                favoritosOutfits[plugin].all_favorites = false;
            }
        }
        await saveFavoritosOutfits();
        displayFavoritosOutfits();
        
        // Refresh details panel if open
        const panel = document.getElementById('pluginsDetailsContent');
        if (panel) {
             const activeStars = panel.querySelectorAll('.star.active');
             activeStars.forEach(star => {
                 star.classList.remove('active');
                 star.textContent = '☆';
             });
             const masterStars = panel.querySelectorAll('.master-star.active');
             masterStars.forEach(ms => ms.classList.remove('active'));
             
             // Update badges
             const badgeFav = panel.querySelector('.badge-fav');
             if (badgeFav) {
                 const total = badgeFav.textContent.split('/')[1];
                 badgeFav.textContent = `Fav: 0/${total}`;
             }
        }

        showToast('All Plugin Outfits favorites cleared successfully!', '#10b981');
        const audio = new Audio('Sound/ding-small-bell-sfx.wav');
        audio.play();
    }
}

function toggleFavorito(presetName, event) {
    event.stopPropagation(); // Prevent triggering selectPreset
    if (PINNED_PRESET_NAMES.includes(presetName)) {
        return;
    }
    favoritos[presetName] = !favoritos[presetName];
    saveFavoritos();
    // Re-render the preset lists to reflect the change
    loadPresetLists();
    // Also update the individual preset items to show the change immediately
    updatePresetItemDisplay(presetName);
    // Update the compact favorites display
    displayFavoritosCompact();
    // Play sound when toggling favorite
    const audio = new Audio('Sound/ding-small-bell-sfx.wav');
    audio.play();
}

function toggleFavoritoXML(xmlFileName, event) {
    event.stopPropagation();
    const nextValue = !(favoritosXML[xmlFileName] === true);
    if (nextValue) {
        favoritosXML[xmlFileName] = true;
    } else {
        delete favoritosXML[xmlFileName];
    }
    saveFavoritosXML();

    const isActive = nextValue;
    const star = event?.currentTarget;
    if (star && star.classList) {
        star.classList.toggle('active', isActive);
    }
    const item = star?.closest?.('.preset-item');
    if (item && item.classList) {
        item.classList.toggle('favorito', isActive);
    }

    const audio = new Audio('Sound/ding-small-bell-sfx.wav');
    audio.play();
}

function toggleNpcFavorito(npcEditorId, event) {
    event.stopPropagation(); // Prevent triggering any other action
    // Find and remove the NPC from favoritosNPCs
    for (const plugin in favoritosNPCs) {
        const npcIndex = favoritosNPCs[plugin].npcs.findIndex(npc => npc.editor_id === npcEditorId);
        if (npcIndex !== -1) {
            favoritosNPCs[plugin].npcs.splice(npcIndex, 1);
            // Update all_favorites flag
            const totalNPCs = window.currentNpcPluginsData?.plugins[plugin]?.npcs?.length || 0;
            favoritosNPCs[plugin].all_favorites = favoritosNPCs[plugin].npcs.length === totalNPCs;
            break;
        }
    }
    saveFavoritosNPCs();
    // Re-render the favorites display
    displayFavoritosNPCs();
    // Play sound when toggling favorite
    const audio = new Audio('Sound/ding-small-bell-sfx.wav');
    audio.play();
}

async function loadFavoritos() {
    try {
        const response = await fetch(`${BASE_URL}/load-favoritos`);
        if (!response.ok) throw new Error('HTTP ' + response.status);
        const result = await response.json();
        if (result.status === 'success') {
            favoritos = result.data || {};
            PINNED_PRESET_NAMES.forEach(name => {
                favoritos[name] = true;
            });
        }
    } catch (error) {
        console.error('Error loading favoritos:', error);
    }
}

async function loadFavoritosXML() {
    try {
        const response = await fetch(`${BASE_URL}/load-favoritos-xml`);
        if (!response.ok) throw new Error('HTTP ' + response.status);
        const result = await response.json();
        if (result.status === 'success') {
            favoritosXML = result.data || {};
        }
    } catch (error) {
        console.error('Error loading favoritos XML:', error);
        favoritosXML = {};
    }
}

async function saveFavoritos() {
    try {
        const response = await fetch(`${BASE_URL}/save-favoritos`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({favoritos: favoritos})
        });
        if (!response.ok) throw new Error('HTTP ' + response.status);
        const result = await response.json();
        if (result.status !== 'success') {
            console.error('Error saving favoritos');
        }
    } catch (error) {
        console.error('Error saving favoritos:', error);
    }
}

async function saveFavoritosXML() {
    try {
        const response = await fetch(`${BASE_URL}/save-favoritos-xml`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({favoritos_xml: favoritosXML})
        });
        if (!response.ok) throw new Error('HTTP ' + response.status);
        const result = await response.json();
        if (result.status !== 'success') {
            console.error('Error saving favoritos XML');
        }
    } catch (error) {
        console.error('Error saving favoritos XML:', error);
    }
}

window.saveFavoritosNPCs = async () => {
    try {
        const response = await fetch(`${BASE_URL}/save-favoritos-npcs`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({favoritos_npcs: favoritosNPCs})
        });
        if (!response.ok) throw new Error('HTTP ' + response.status);
        const result = await response.json();
        if (result.status !== 'success') {
            console.error('Error saving favoritosNPCs');
        }
    } catch (error) {
        console.error('Favoritos NPCs error', error);
    }
};

window.loadFavoritosOutfits = async () => {
    try {
        const response = await fetch(`${BASE_URL}/load-favoritos-outfits`);
        if (!response.ok) {
            // Si el archivo no existe o está vacío, inicializar estructura vacía
            if (response.status === 404 || response.status === 400) {
                console.log('Archivo de favoritos de outfits no encontrado o vacío, inicializando estructura vacía');
                favoritosOutfits = {};
                return true;
            }
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();

        if (result.status === 'success') {
            // Inicializar estructura vacía si no hay datos
            favoritosOutfits = result.data || {};

            // Asegurar que todos los plugins tengan la estructura correcta
            for (const plugin in favoritosOutfits) {
                // Migrar estructura antigua si es necesario
                if (!favoritosOutfits[plugin].armors && !favoritosOutfits[plugin].outfits && !favoritosOutfits[plugin].weapons) {
                    // Estructura antigua: solo outfits
                    favoritosOutfits[plugin] = {
                        armors: [],
                        outfits: favoritosOutfits[plugin].outfits || [],
                        weapons: [],
                        all_favorites: favoritosOutfits[plugin].all_favorites || false
                    };
                } else {
                    // Asegurar que todas las categorías existan
                    favoritosOutfits[plugin] = {
                        armors: favoritosOutfits[plugin].armors || [],
                        outfits: favoritosOutfits[plugin].outfits || [],
                        weapons: favoritosOutfits[plugin].weapons || [],
                        all_favorites: favoritosOutfits[plugin].all_favorites || false
                    };
                }

                // Compute all_favorites considering items inside outfits
                const pluginData = window.currentPluginsData?.plugins[plugin];
                if (pluginData) {
                    // Calcular total de items (armors + outfits + weapons + items dentro de outfits)
                    const totalArmors = pluginData.armors?.length || 0;
                    const totalOutfits = pluginData.outfits?.length || 0;
                    const totalWeapons = pluginData.weapons?.length || 0;

                    // Contar items dentro de outfits (armors anidadas)
                    let totalItemsInOutfits = 0;
                    if (pluginData.outfits) {
                        pluginData.outfits.forEach(outfit => {
                            if (outfit.items) {
                                totalItemsInOutfits += outfit.items.length;
                            }
                        });
                    }

                    const totalItems = totalArmors + totalOutfits + totalWeapons + totalItemsInOutfits;

                    // Calcular items favoritos
                    const favArmors = favoritosOutfits[plugin].armors?.length || 0;
                    const favOutfits = favoritosOutfits[plugin].outfits?.length || 0;
                    const favWeapons = favoritosOutfits[plugin].weapons?.length || 0;

                    // Contar items dentro de outfits que están marcados como favoritos
                    let favItemsInOutfits = 0;
                    if (pluginData.outfits && favoritosOutfits[plugin].armors) {
                        pluginData.outfits.forEach(outfit => {
                            if (outfit.items) {
                                outfit.items.forEach(item => {
                                    // Verificar si este item está en favoritos (como armor individual)
                                    const isItemFavorito = favoritosOutfits[plugin].armors.some(
                                        favItem => favItem.form_id === item.form_id
                                    );
                                    if (isItemFavorito) {
                                        favItemsInOutfits++;
                                    }
                                });
                            }
                        });
                    }

                    const favItems = favArmors + favOutfits + favWeapons + favItemsInOutfits;

                    // Actualizar all_favorites (usar el valor existente si está definido, de lo contrario calcular)
                    if (favoritosOutfits[plugin].all_favorites === undefined || favoritosOutfits[plugin].all_favorites === null) {
                        favoritosOutfits[plugin].all_favorites = favItems === totalItems && totalItems > 0;
                    }
                    console.log(`Computed all_favorites for ${plugin}: ${favoritosOutfits[plugin].all_favorites}, fav: ${favItems}, total: ${totalItems}`);
                } else {
                    // Si no hay datos del plugin, mantener el valor existente o poner false
                    if (favoritosOutfits[plugin].all_favorites === undefined || favoritosOutfits[plugin].all_favorites === null) {
                        favoritosOutfits[plugin].all_favorites = false;
                    }
                }
            }

            console.log('Favoritos outfits cargados correctamente');
            return true;

        } else {
            console.error('Error loading favoritosOutfits:', result.message || 'Unknown error');
            showToast('Error al cargar favoritos de outfits', '#ef4444');
            return false;
        }

    } catch (error) {
        console.error('Error al cargar favoritos de outfits:', error);
        // Inicializar estructura vacía si hay error
        favoritosOutfits = {};
        showToast(`Error al cargar favoritos: ${error.message}`, '#ef4444');
        return false;
    }
};

window.saveFavoritosOutfits = async () => {
    try {
        // Ensure all plugins have the proper structure
        const structuredFavoritos = {};

        for (const pluginName in favoritosOutfits) {
            structuredFavoritos[pluginName] = {
                armors: favoritosOutfits[pluginName].armors || [],
                outfits: favoritosOutfits[pluginName].outfits || [],
                weapons: favoritosOutfits[pluginName].weapons || [],
                all_favorites: favoritosOutfits[pluginName].all_favorites || false
            };
        }

        const response = await fetch(`${BASE_URL}/save-favoritos-outfits`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                favoritos_outfits: structuredFavoritos,
                timestamp: new Date().toISOString()
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();

        if (result.status !== 'success') {
            console.error('Error saving favoritosOutfits:', result.message || 'Unknown error');
            showToast('Error al guardar favoritos de outfits', '#ef4444');
            return false;
        }

        console.log('Favoritos outfits guardados correctamente');
        return true;

    } catch (error) {
        console.error('Error al guardar favoritos de outfits:', error);
        showToast(`Error al guardar favoritos: ${error.message}`, '#ef4444');
        return false;
    }
};

async function clearFavoritos() {
    favoritos = {};
    await saveFavoritos();
    displayFavoritosCompact();
    updatePresetItemDisplay();
    showToast('All preset favorites cleared!', '#10b981');
    const audio = new Audio('Sound/ding-small-bell-sfx.wav');
    audio.play();
}

async function clearFavoritosNPCs() {
    favoritosNPCs = {};
    await saveFavoritosNPCs();
    displayFavoritosNPCs();
    showToast('All NPC favorites cleared!', '#10b981');
    const audio = new Audio('Sound/ding-small-bell-sfx.wav');
    audio.play();
}

async function clearAllNpcFavorites() {
    if (confirm('Are you sure you want to clear ALL NPC favorites? This cannot be undone.')) {
        // Iterate over favoritosNPCs and empty each npcs array, keeping all_favorites: false
        for (const plugin in favoritosNPCs) {
            if (favoritosNPCs.hasOwnProperty(plugin)) {
                favoritosNPCs[plugin].npcs = [];
                favoritosNPCs[plugin].all_favorites = false;
            }
        }
        await saveFavoritosNPCs();
        displayFavoritosNPCs();
        showToast('All NPC favorites cleared successfully!', '#10b981');
        const audio = new Audio('Sound/ding-small-bell-sfx.wav');
        audio.play();
    }
}


function updatePresetItemDisplay(presetName) {
    // Update the display of a specific preset item across all lists
    const allPresetItems = document.querySelectorAll('.preset-item');
    allPresetItems.forEach(item => {
        const presetNameSpan = item.querySelector('.preset-name');
        if (presetNameSpan && presetNameSpan.textContent === presetName) {
            const isFavorito = favoritos[presetName] === true;
            item.classList.toggle('active', isFavorito);
            const star = item.querySelector('.star');
            if (star) {
                star.textContent = '★';
                star.style.color = isFavorito ? '#ffd700' : '';
            }
        }
    });
}

function fallbackCopyPreset(text) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    const success = document.execCommand('copy');
    document.body.removeChild(textarea);

    if (success) {
        showToast('✓ Preset copied to clipboard!', '#10b981');
    } else {
        showToast('❌ Failed to copy preset', '#ef4444');
    }
}

function showToast(message, color, durationMs = 2000) {
    const existingToast = document.querySelector('.toast-notification');
    if (existingToast) {
        existingToast.remove();
    }

    const toast = document.createElement('div');
    toast.className = 'toast-notification';
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${color};
        color: white;
        padding: 12px 20px;
        border-radius: 6px;
        font-weight: 600;
        font-size: 0.9rem;
        z-index: 10000;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        animation: slideIn 0.3s ease-out;
    `;

    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease-in';
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    }, durationMs);
}

function showPersistentLoadingToast(message) {
    const existingToast = document.querySelector('.toast-notification');
    if (existingToast) {
        existingToast.remove();
    }

    const toast = document.createElement('div');
    toast.className = 'toast-notification';
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: rgba(16, 185, 129, 0.28);
        border: 1px solid rgba(52, 211, 153, 0.55);
        color: white;
        padding: 10px 16px;
        border-radius: 6px;
        font-weight: 600;
        font-size: 0.85rem;
        z-index: 10000;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        backdrop-filter: blur(4px);
        animation: slideIn 0.3s ease-out;
    `;

    const row = document.createElement('div');
    row.style.display = 'flex';
    row.style.alignItems = 'center';
    row.style.gap = '8px';

    const img = document.createElement('img');
    img.src = 'Data/013.gif';
    img.alt = 'Loading';
    img.style.width = '24px';
    img.style.height = '24px';

    const text = document.createElement('span');
    text.textContent = message;

    row.appendChild(img);
    row.appendChild(text);
    toast.appendChild(row);
    document.body.appendChild(toast);

    return () => {
        if (!toast || !toast.parentNode) return;
        toast.style.animation = 'slideOut 0.3s ease-in';
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    };
}

function showObodyLogLoadingToast() {
    const existingToast = document.querySelector('.toast-notification');
    if (existingToast) {
        existingToast.remove();
    }

    const toast = document.createElement('div');
    toast.className = 'toast-notification';
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #10b981;
        color: white;
        padding: 10px 16px;
        border-radius: 6px;
        font-weight: 600;
        font-size: 0.85rem;
        z-index: 10000;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        animation: slideIn 0.3s ease-out;
    `;

    toast.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px;">
            <img src="Data/013.gif" alt="Loading" style="width: 24px; height: 24px;">
            <span>Please wait, loading OBody log...</span>
        </div>
    `;

    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease-in';
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    }, 2000);
}

function fallbackCopyLog(text, button) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    const success = document.execCommand('copy');
    document.body.removeChild(textarea);

    if (success) {
        showFeedback(button, '✓ Copied!', '#10b981');
        setTimeout(() => {
            button.textContent = 'Copy';
            button.style.backgroundColor = '';
        }, 1500);
    } else {
        showFeedback(button, '❌ Failed', '#ef4444');
        setTimeout(() => {
            button.textContent = 'Copy';
            button.style.backgroundColor = '';
        }, 1500);
    }
}

function loadPresetLists() {
    fetch(`${BASE_URL}/load-log/OBody_NG_Preset_Distribution_Assistant-NG_List-Helper.log`)
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                parseAndDisplayPresets(data.content);
            } else {
                document.getElementById('normalPresets').textContent = 'Error loading preset list';
                document.getElementById('ubePresets').textContent = 'Error loading preset list';
                document.getElementById('himboPresets').textContent = 'Error loading preset list';
            }
        })
        .catch(error => {
            console.error('Error loading preset lists:', error);
            document.getElementById('normalPresets').textContent = 'Connection error';
            document.getElementById('ubePresets').textContent = 'Connection error';
            document.getElementById('himboPresets').textContent = 'Connection error';
        });
}

function parseAndDisplayPresets(logContent) {
    const lines = logContent.split('\n');
    let currentSection = '';
    const normalPresets = [];
    const ubePresets = [];
    const himboPresets = [];
    let totalPresets = 0;
    let normalCount = 0;
    let ubeCount = 0;
    let himboCount = 0;

    for (const line of lines) {
        const trimmed = line.trim();

        if (trimmed.includes('INSTALLED PRESETS LIST (') && trimmed.includes(' total)')) {
            const match = trimmed.match(/INSTALLED PRESETS LIST \((\d+) total\)/);
            if (match) {
                totalPresets = parseInt(match[1]);
            }
        }

        if (trimmed.includes('NORMAL PRESETS') && trimmed.includes('total')) {
            const match = trimmed.match(/NORMAL PRESETS.*- (\d+) total/);
            if (match) {
                normalCount = parseInt(match[1]);
            }
            currentSection = 'normal';
        } else if (trimmed.includes('UBE PRESETS') && trimmed.includes('total')) {
            const match = trimmed.match(/UBE PRESETS.*- (\d+) total/);
            if (match) {
                ubeCount = parseInt(match[1]);
            }
            currentSection = 'ube';
        } else if (trimmed.includes('HIMBO PRESETS') && trimmed.includes('total')) {
            const match = trimmed.match(/HIMBO PRESETS.*- (\d+) total/);
            if (match) {
                himboCount = parseInt(match[1]);
            }
            currentSection = 'himbo';
        } else if (trimmed.includes('----------------------------------------------------')) {
            break;
        } else if (trimmed.startsWith('- Zeroed Sliders -') ||
                  trimmed.startsWith('----chr\'s----') ||
                  trimmed === '' ||
                  trimmed.startsWith(';') ||
                  trimmed.startsWith('=') ||
                  trimmed.includes('total') ||
                  trimmed.includes('PRESETS') ||
                  trimmed.includes('INSTALLED') ||
                  trimmed.includes('================================================')) {
            continue;
        } else if (currentSection && trimmed && !trimmed.includes('[') && !trimmed.includes(']')) {
            if (currentSection === 'normal') {
                normalPresets.push(trimmed);
            } else if (currentSection === 'ube') {
                ubePresets.push(trimmed);
            } else if (currentSection === 'himbo') {
                himboPresets.push(trimmed);
            }
        }
    }

    window.presetCategoryMap = {};
    normalPresets.forEach(name => {
        window.presetCategoryMap[name] = 'normal';
    });
    ubePresets.forEach(name => {
        window.presetCategoryMap[name] = 'ube';
    });
    himboPresets.forEach(name => {
        window.presetCategoryMap[name] = 'himbo';
    });
    PINNED_PRESETS.forEach(preset => {
        window.presetCategoryMap[preset.name] = preset.category;
    });

    displayPresetList('normalPresets', normalPresets);
    displayPresetList('ubePresets', ubePresets);
    displayPresetList('himboPresets', himboPresets);

    const favoritosBase = Object.keys(favoritos).filter(preset => favoritos[preset] === true);
    const favoritosPresets = Array.from(new Set([
        ...favoritosBase,
        ...PINNED_PRESET_NAMES
    ]));
    displayFavoritosCompact();

    setupPresetSearch('normalSearch', normalPresets, 'normalPresets');
    setupPresetSearch('ubeSearch', ubePresets, 'ubePresets');
    setupPresetSearch('himboSearch', himboPresets, 'himboPresets');
    setupPresetSearch('favoritosSearchInline', favoritosPresets, 'favoritosList');
    setupPresetSearch('jsonFavoritosSearchInline', favoritosPresets, 'jsonFavoritosListPresets');

    // Update the title with total count
    const titleElement = document.getElementById('presetListsTitle');
    if (titleElement) {
        titleElement.textContent = `Preset Lists from List-Helper.log (${totalPresets} total)`;
    }

    // Update individual section headers with counts
    updateSectionHeader('normalPresets', '💃 NORMAL PRESETS (CBBE/3BA/BHUNP/etc.)', normalCount);
    updateSectionHeader('ubePresets', '💋 UBE PRESETS (Female)', ubeCount);
    updateSectionHeader('himboPresets', '🕺 HIMBO PRESETS (Male)', himboCount);
}

function updateSectionHeader(containerId, baseTitle, count) {
    const container = document.getElementById(containerId);
    if (container) {
        const header = container.closest('.preset-list-card').querySelector('h3');
        if (header) {
            header.textContent = `${baseTitle} - ${count} total`;
        }
    }
}

function displayPresetList(containerId, presets) {
    const container = document.getElementById(containerId);
    if (presets.length === 0) {
        container.innerHTML = '<div class="no-presets">No presets found</div>';
        return;
    }

    // Sort presets alphabetically
    presets.sort((a, b) => a.localeCompare(b));

    container.innerHTML = presets.map(preset => {
        const isXmlItem = containerId === 'sandboxXmlFiles';
        const isFavorito = isXmlItem ? favoritosXML[preset] === true : favoritos[preset] === true;
        const safePreset = preset.replace(/'/g, "\\'");
        const starClass = isFavorito ? 'active' : '';
        const wrapperClass = isFavorito ? 'preset-item favorito' : 'preset-item';
        const toggleHandler = isXmlItem ? `toggleFavoritoXML('${safePreset}', event)` : `toggleFavorito('${safePreset}', event)`;
        return `<div class="${wrapperClass}" ondblclick="copyPresetToClipboard('${safePreset}')" onclick="selectPreset('${safePreset}')" title="Click to select, double-click to copy">
            <span class="preset-name">${preset}</span>
            <span class="star ${starClass}" onclick="${toggleHandler}" title="Toggle favorite">★</span>
        </div>`;
    }).join('');
}

function renderFavoritosOutfitsToContainer(containerId, countId, outfitsToDisplay) {
    const container = document.getElementById(containerId);
    const countElement = document.getElementById(countId);

    if (countElement) {
        countElement.textContent = outfitsToDisplay.length;
    }

    if (!container) return;

    if (outfitsToDisplay.length === 0) {
        container.innerHTML = '<div class="no-presets">No favorites yet</div>';
        return;
    }

    // Sort outfits alphabetically by name
    outfitsToDisplay.sort((a, b) => a.name.localeCompare(b.name));

    // Group by plugin
    const groupedOutfits = {};
    outfitsToDisplay.forEach(outfit => {
        const plugin = outfit.plugin || 'Unknown';
        if (!groupedOutfits[plugin]) groupedOutfits[plugin] = [];
        groupedOutfits[plugin].push(outfit);
    });

    // Sort armors within each plugin alphabetically by name
    for (const pluginName in groupedOutfits) {
        groupedOutfits[pluginName].sort((a, b) => a.name.localeCompare(b.name));
    }

    container.innerHTML = Object.keys(groupedOutfits).sort().map(pluginName => {
        const outfits = groupedOutfits[pluginName];
        return `
            <div class="plugin-section">
                <h3><span style="color: #4CAF50">${pluginName}</span> - <span style="color: #ff9800">armors (${outfits.length})</span></h3>
                <div class="outfit-category">
                    <div class="outfit-items">
                        ${outfits.map(outfit =>
                            `<div class="preset-item-compact-favorito" onclick="selectFavoritoOutfit('${outfit.plugin.replace(/'/g, "\\'")}', '${outfit.form_id.replace(/'/g, "\\'")}', event)">
                                <span class="preset-name"><span style="color: #00bcd4">${outfit.name}</span> - ${outfit.form_id}</span>
                                <span class="star active" onclick="toggleOutfitFavorito('${outfit.form_id.replace(/'/g, "\\'")}', event)" title="Remove from favorites">★</span>
                            </div>`
                        ).join('')}
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function displayFavoritosOutfits() {
    // 1. Get all outfits
    const allFavoritosOutfits = [];
    for (const plugin in favoritosOutfits) {
        if (favoritosOutfits[plugin].armors) {
            allFavoritosOutfits.push(...favoritosOutfits[plugin].armors.map(outfit => ({...outfit, plugin})));
        }
    }

    // 2. Render to INI Generator Tab
    const searchInput1 = document.getElementById('favoritosOutfitsSearchInline');
    const term1 = searchInput1 ? searchInput1.value.toLowerCase().trim() : '';
    const list1 = term1 ? allFavoritosOutfits.filter(o => o.name.toLowerCase().includes(term1)) : allFavoritosOutfits;
    renderFavoritosOutfitsToContainer('favoritosOutfitsList', 'favoritosOutfitsCount', list1);

    // 3. Render to Plugins Tab
    const searchInput2 = document.getElementById('favoritosOutfitsSearchInline_Plugins');
    const term2 = searchInput2 ? searchInput2.value.toLowerCase().trim() : '';
    const list2 = term2 ? allFavoritosOutfits.filter(o => o.name.toLowerCase().includes(term2)) : allFavoritosOutfits;
    renderFavoritosOutfitsToContainer('favoritosOutfitsList_Plugins', 'favoritosOutfitsCount_Plugins', list2);

    // 4. Render to Quick JSON Modifier panel (no search filter)
    const jsonOutfitsContainer = document.getElementById('jsonFavoritosOutfitsList');
    const jsonOutfitsCount = document.getElementById('jsonFavoritosOutfitsCount');
    if (jsonOutfitsContainer && jsonOutfitsCount) {
        renderFavoritosOutfitsToContainer('jsonFavoritosOutfitsList', 'jsonFavoritosOutfitsCount', allFavoritosOutfits);
    }
}

function displayFavoritosCompact(filteredPresets = null) {
    const container = document.getElementById('favoritosList');
    const countElement = document.getElementById('favoritosCount');
    const jsonContainer = document.getElementById('jsonFavoritosListPresets');
    const jsonCountElement = document.getElementById('jsonFavoritosCountPresets');
    const allFavoritosPresets = Object.keys(favoritos).filter(preset => favoritos[preset] === true);
    const basePresets = Array.from(new Set([
        ...allFavoritosPresets,
        ...PINNED_PRESET_NAMES
    ]));
    const effectivePresets = filteredPresets !== null ? filteredPresets : basePresets;
    const visiblePinned = PINNED_PRESETS.filter(preset => effectivePresets.includes(preset.name));
    const nonPinnedPresets = effectivePresets.filter(preset => !PINNED_PRESET_NAMES.includes(preset));

    const totalVisible = visiblePinned.length + nonPinnedPresets.length;

    if (countElement) {
        countElement.textContent = totalVisible;
    }
    if (jsonCountElement) {
        jsonCountElement.textContent = totalVisible;
    }

    const noPresetsHtml = '<div class="no-presets">No favorites yet</div>';

    if (totalVisible === 0) {
        if (container) {
            container.innerHTML = noPresetsHtml;
        }
        if (jsonContainer) {
            jsonContainer.innerHTML = noPresetsHtml;
        }
        return;
    }

    nonPinnedPresets.sort((a, b) => a.localeCompare(b));

    const pinnedHtml = visiblePinned.map(preset => {
        let emoji = '';
        const category = window.presetCategoryMap ? window.presetCategoryMap[preset.name] : preset.category;
        if (category === 'normal') {
            emoji = '💃';
        } else if (category === 'ube') {
            emoji = '💋';
        } else if (category === 'himbo') {
            emoji = '🕺';
        }
        const safePreset = preset.name.replace(/'/g, "\\'");
        return `<div class="preset-item-compact-favorito" onclick="selectPreset('${safePreset}')" title="Permanent preset (cannot be removed)">
            <span class="preset-name">${emoji ? `<span class="preset-category-emoji">${emoji}</span>` : ''}${preset.name}</span>
        </div>`;
    }).join('');

    const favoritesHtml = nonPinnedPresets.map(preset => {
        let emoji = '';
        const category = window.presetCategoryMap ? window.presetCategoryMap[preset] : null;
        if (category === 'normal') {
            emoji = '💃';
        } else if (category === 'ube') {
            emoji = '💋';
        } else if (category === 'himbo') {
            emoji = '🕺';
        }
        const safePreset = preset.replace(/'/g, "\\'");
        return `<div class="preset-item-compact-favorito" onclick="selectPreset('${safePreset}')" title="Click to select preset">
            <span class="preset-name">${emoji ? `<span class="preset-category-emoji">${emoji}</span>` : ''}${preset}</span>
            <span class="star active" onclick="toggleFavorito('${safePreset}', event)" title="Remove from favorites">★</span>
        </div>`;
    }).join('');

    if (container) {
        container.innerHTML = pinnedHtml + favoritesHtml;
    }
    if (jsonContainer) {
        jsonContainer.innerHTML = pinnedHtml + favoritesHtml;
    }
}

function showFactionTooltip(mouseX, mouseY, htmlContent) {
    hideFactionTooltip();
    const tooltip = document.createElement('div');
    tooltip.className = 'faction-tooltip';
    tooltip.innerHTML = htmlContent;
    document.body.appendChild(tooltip);
    tooltip.style.position = 'absolute';
    const offsetX = 8;
    const offsetY = 40;
    tooltip.style.left = (mouseX + offsetX) + 'px';
    tooltip.style.top = (mouseY + offsetY) + 'px';
    tooltip.style.zIndex = '10000';
    factionTooltipElement = tooltip;
}

function hideFactionTooltip() {
    if (factionTooltipTimeout) {
        clearTimeout(factionTooltipTimeout);
        factionTooltipTimeout = null;
    }
    if (factionTooltipElement) {
        factionTooltipElement.remove();
        factionTooltipElement = null;
    }
}

function updateJsonFactionsLibraryDropdown() {
    displayJsonFactionsLibraryInModal();
}

function displayJsonFactionsLibraryInModal(filteredFactions = null) {
    const container = document.getElementById('jsonFactionsLibraryList');
    const countElement = document.getElementById('jsonFactionsLibraryCount');
    if (!container || !countElement) return;

    const source = filteredFactions !== null ? filteredFactions : factionsLibraryNames;
    countElement.textContent = source.length;

    if (!source.length) {
        container.innerHTML = '<div class="no-presets">No factions found</div>';
        return;
    }

    const sorted = [...source].sort((a, b) => a.localeCompare(b));
    const html = sorted.map(editorId => {
        const info = factionsLibraryDetails[editorId] || {};
        const name = info.name || '';
        const safeEditorId = editorId.replace(/'/g, "\\'");
        const safeName = name.replace(/'/g, "\\'");
        const hasName = safeName.length > 0;
        const namePart = hasName ? `<span class="faction-name">${safeName}</span>` : '';
        return `<div class="preset-item-compact-favorito" onclick="selectFactionFromLibrary('${safeEditorId}')"><span class="faction-edid">${safeEditorId}</span>${namePart}</div>`;
    }).join('');

    container.innerHTML = html;
}

function displayFactionsLibrary(filteredFactions = null) {
    const container = document.getElementById('factionsLibraryList');
    const countElement = document.getElementById('factionsLibraryCount');
    if (!container || !countElement) return;

    const source = filteredFactions !== null ? filteredFactions : factionsLibraryNames;
    countElement.textContent = source.length;

    if (!source.length) {
        container.innerHTML = '<div class="no-presets">No factions found</div>';
        return;
    }

    const sorted = [...source].sort((a, b) => a.localeCompare(b));
    const html = sorted.map(editorId => {
        const info = factionsLibraryDetails[editorId] || {};
        const name = info.name || '';
        const safeEditorId = editorId.replace(/'/g, "\\'");
        const safeName = name.replace(/'/g, "\\'");
        const hasName = safeName.length > 0;
        const namePart = hasName ? `<span class="faction-name">${safeName}</span>` : '';
        return `<div class="preset-item-compact-favorito" onclick="selectFactionFromLibrary('${safeEditorId}')"><span class="faction-edid">${safeEditorId}</span>${namePart}</div>`;
    }).join('');

    container.innerHTML = html;
}

function updateFactionsSourceButtons() {
    const memoriBtnMain = document.getElementById('loadMemoriFFactionsBtn');
    const csvBtnMain = document.getElementById('loadCsvFactionsBtn');
    const memoriBtnJson = document.getElementById('jsonLoadMemoriFFactionsBtn');
    const csvBtnJson = document.getElementById('jsonLoadCsvFactionsBtn');

    const memoriCount = factionsMemoriNames.length;
    const csvCount = factionsCsvNames.length;

    if (memoriBtnMain) {
        memoriBtnMain.textContent = `⚔️ Faction From NPCs around you (${memoriCount})`;
    }

    if (csvBtnMain) {
        csvBtnMain.textContent = `⚔️ Faction From CSV Base Game (${csvCount})`;
    }

    if (memoriBtnJson) {
        memoriBtnJson.textContent = `⚔️ Faction From NPCs around you (${memoriCount})`;
    }

    if (csvBtnJson) {
        csvBtnJson.textContent = `⚔️ Faction From CSV Base Game (${csvCount})`;
    }

    const applyActiveClasses = (memoriBtn, csvBtn) => {
        if (!memoriBtn || !csvBtn) return;
        if (factionsSource === 'memori') {
            memoriBtn.classList.add('btn-primary');
            memoriBtn.classList.remove('btn-secondary');
            csvBtn.classList.add('btn-secondary');
            csvBtn.classList.remove('btn-primary');
        } else if (factionsSource === 'csv') {
            csvBtn.classList.add('btn-primary');
            csvBtn.classList.remove('btn-secondary');
            memoriBtn.classList.add('btn-secondary');
            memoriBtn.classList.remove('btn-primary');
        }
    };

    applyActiveClasses(memoriBtnMain, csvBtnMain);
    applyActiveClasses(memoriBtnJson, csvBtnJson);
}

function initializeFactionSourceButtons() {
    const memoriBtnMain = document.getElementById('loadMemoriFFactionsBtn');
    const csvBtnMain = document.getElementById('loadCsvFactionsBtn');
    const memoriBtnJson = document.getElementById('jsonLoadMemoriFFactionsBtn');
    const csvBtnJson = document.getElementById('jsonLoadCsvFactionsBtn');
    const tooltipDelay = 1000;
    const attachHandlers = (memoriBtn, csvBtn) => {
        if (memoriBtn) {
            memoriBtn.addEventListener('click', async () => {
                hideFactionTooltip();
                factionsSource = 'memori';
                if (!factionsMemoriNames.length) {
                    await loadFactionsLibrary();
                } else {
                    factionsLibraryDetails = factionsMemoriDetails;
                    factionsLibraryNames = factionsMemoriNames.slice();
                    displayFactionsLibrary();
                    updateFactionsSourceButtons();
                    displayJsonFactionsLibraryInModal();
                }
            });
            memoriBtn.addEventListener('mouseenter', (e) => {
                if (factionTooltipTimeout) {
                    clearTimeout(factionTooltipTimeout);
                }
                const startX = e.pageX;
                const startY = e.pageY;
                factionTooltipTimeout = setTimeout(() => {
                    showFactionTooltip(
                        startX,
                        startY,
                        `<div class="faction-tooltip-text">${FACTIONS_MEMORI_TOOLTIP_TEXT}</div>`
                    );
                }, tooltipDelay);
            });
            memoriBtn.addEventListener('mouseleave', () => {
                hideFactionTooltip();
            });
        }

        if (csvBtn) {
            csvBtn.addEventListener('click', async () => {
                hideFactionTooltip();
                factionsSource = 'csv';
                await loadCsvFactionsLibraryData();
                factionsLibraryDetails = factionsCsvDetails;
                factionsLibraryNames = factionsCsvNames.slice();
                displayFactionsLibrary();
                updateFactionsSourceButtons();
                displayJsonFactionsLibraryInModal();
            });
            csvBtn.addEventListener('mouseenter', (e) => {
                if (factionTooltipTimeout) {
                    clearTimeout(factionTooltipTimeout);
                }
                const startX = e.pageX;
                const startY = e.pageY;
                factionTooltipTimeout = setTimeout(() => {
                    showFactionTooltip(
                        startX,
                        startY,
                        `<img src="Data/SSEEdit_kO8AnWqGfk.png" alt="SSEEdit example" class="faction-tooltip-image"><div class="faction-tooltip-text">${FACTIONS_CSV_TOOLTIP_TEXT}</div>`
                    );
                }, tooltipDelay);
            });
            csvBtn.addEventListener('mouseleave', () => {
                hideFactionTooltip();
            });
        }
    };

    attachHandlers(memoriBtnMain, csvBtnMain);
    attachHandlers(memoriBtnJson, csvBtnJson);
}

function updateRuleFavoritesVisibility(ruleType) {
    const presetsSection = document.getElementById('ruleFavoritesPresetsSection');
    const npcSection = document.getElementById('ruleFavoritesNpcSection');
    const outfitsSection = document.getElementById('ruleFavoritesOutfitsSection');
    const factionsSection = document.getElementById('ruleFavoritesFactionsSection');

    const sections = [presetsSection, npcSection, outfitsSection, factionsSection];

    sections.forEach(section => {
        if (section) {
            section.classList.remove('visible');
        }
    });

    if (!ruleType) {
        sections.forEach(section => {
            if (section) {
                section.classList.add('visible');
            }
        });
        return;
    }

    let showPresets = ['npcFormID', 'npc', 'factionFemale', 'factionMale', 'npcPluginFemale', 'npcPluginMale', 'raceFemale', 'raceMale', 'blacklisted', 'outfits'].includes(ruleType);
    let showNpc = ['npcFormID', 'npc', 'factionFemale', 'factionMale', 'npcPluginFemale', 'npcPluginMale', 'raceFemale', 'raceMale', 'blacklisted', 'blacklistedNpcsFormID', 'outfits'].includes(ruleType);
    let showOutfits = ['blacklisted', 'blacklistedOutfitsFromORefitFormID', 'outfitsForceRefitFormID', 'outfits'].includes(ruleType);
    let showFactions = ['factionFemale', 'factionMale', 'blacklisted', 'outfits'].includes(ruleType);

    if (ruleType === 'npcPluginFemale' || ruleType === 'npcPluginMale') {
        showPresets = true;
        showNpc = true;
        showOutfits = false;
        showFactions = false;
    }

    if (ruleType === 'factionFemale' || ruleType === 'factionMale') {
        showPresets = true;
        showNpc = false;
        showOutfits = false;
        showFactions = true;
    }

    if (ruleType === 'blacklisted') {
        const blacklistedValueEl = document.getElementById('blacklistedValue');
        const blacklistedValue = blacklistedValueEl ? blacklistedValueEl.value : '';
        if (blacklistedValue) {
            showPresets = false;
            showNpc = false;
            showOutfits = false;
            showFactions = false;
            if (blacklistedValue === 'PresetsFromRandomDistribution') {
                showPresets = true;
            } else if (
                blacklistedValue === 'Npcs' ||
                blacklistedValue === 'NpcsPluginFemale' ||
                blacklistedValue === 'NpcsPluginMale' ||
                blacklistedValue === 'RacesFemale' ||
                blacklistedValue === 'RacesMale'
            ) {
                showNpc = true;
            }
        }
    }

    if (ruleType === 'outfits') {
        const outfitsValueEl = document.getElementById('outfitsValue');
        const outfitsValue = outfitsValueEl ? outfitsValueEl.value : '';
        if (outfitsValue) {
            showPresets = false;
            showNpc = false;
            showFactions = false;
            showOutfits = true;
        }
    }

    if (showPresets && presetsSection) {
        presetsSection.classList.add('visible');
    }
    if (showNpc && npcSection) {
        npcSection.classList.add('visible');
    }
    if (showOutfits && outfitsSection) {
        outfitsSection.classList.add('visible');
    }
    if (showFactions && factionsSection) {
        factionsSection.classList.add('visible');
    }
}

function notifyRuleConfigChanged() {
    const presetsInput = document.getElementById('presets');
    const elementValueInput = document.getElementById('elementValueInput');
    const elementValueSelect = document.getElementById('elementValue');
    const blacklistedValue = document.getElementById('blacklistedValue');
    const outfitsValue = document.getElementById('outfitsValue');
    const modeSelect = document.getElementById('mode');
    [presetsInput, elementValueInput, elementValueSelect, blacklistedValue, outfitsValue, modeSelect].forEach(el => {
        if (el) {
            el.dispatchEvent(new Event('input', { bubbles: true }));
        }
    });
}

function selectFactionFromLibrary(editorId) {
    const ruleTypeSelect = document.getElementById('ruleType');
    const elementValueInput = document.getElementById('elementValueInput');
    if (ruleTypeSelect && elementValueInput) {
        const currentRuleType = ruleTypeSelect.value;
        if (currentRuleType === 'factionFemale' || currentRuleType === 'factionMale') {
            elementValueInput.style.display = 'block';
            elementValueInput.value = editorId;
            elementValueInput.focus();
            notifyRuleConfigChanged();
        }
    }

    if (currentJsonModifierSection === 'factionFemale' || currentJsonModifierSection === 'factionMale') {
        const factionNameInput = document.getElementById('jsonFavoritosFactionNameCustom');
        if (factionNameInput) {
            factionNameInput.value = editorId;
            factionNameInput.focus();
        }
    }

    try {
        factionSelectAudio.currentTime = 0;
        factionSelectAudio.play();
    } catch (e) {
    }
}

async function loadCsvFactionsLibraryData() {
    if (factionsCsvNames.length && Object.keys(factionsCsvDetails).length) {
        return;
    }

    try {
        const response = await fetch('Data/AllFactions_EDID_Name.csv', { cache: 'no-store' });
        if (!response.ok) throw new Error('HTTP ' + response.status);
        const text = await response.text();

        const map = {};
        const lines = text.split(/\r?\n/);
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            const match = trimmed.match(/^"([^"]+)"\s*,\s*"([^"]*)"/);
            if (!match) continue;
            const editorId = match[1].trim();
            const name = match[2].trim();
            if (!editorId || Object.prototype.hasOwnProperty.call(map, editorId)) continue;
            map[editorId] = { name };
        }

        factionsCsvDetails = map;
        factionsCsvNames = Object.keys(map);
    } catch (error) {
        console.error('Error loading CSV factions library:', error);
        factionsCsvDetails = {};
        factionsCsvNames = [];
    }
}

function selectFavoritoNpc(plugin, npcName, event) {
    event.stopPropagation();
    const npc = favoritosNPCs[plugin]?.npcs.find(n => n.name === npcName);

    if (currentJsonModifierSection === 'npcFormID' || currentJsonModifierSection === 'blacklistedNpcsFormID') {
        const pluginInput = document.getElementById('jsonFavoritosPluginNameCustom');
        const formIdInput = document.getElementById('jsonFavoritosFormIdCustom');
        if (pluginInput && formIdInput && npc) {
            pluginInput.value = plugin;
            formIdInput.value = npc.form_id.replace(/^0x/, '');
            bellAudio.currentTime = 0;
            bellAudio.play();
        }
        return;
    }

    if (currentJsonModifierSection === 'npc' || currentJsonModifierSection === 'blacklistedNpcs') {
        const npcNameInput = document.getElementById('jsonFavoritosNpcNameCustom');
        if (npcNameInput && npc) {
            npcNameInput.value = npc.name;
            bellAudio.currentTime = 0;
            bellAudio.play();
        }
        return;
    }

    if (
        currentJsonModifierSection === 'npcPluginFemale' ||
        currentJsonModifierSection === 'npcPluginMale' ||
        currentJsonModifierSection === 'blacklistedNpcsPluginFemale' ||
        currentJsonModifierSection === 'blacklistedNpcsPluginMale'
    ) {
        const pluginInput = document.getElementById('jsonFavoritosPluginNameCustom');
        if (pluginInput && npc) {
            pluginInput.value = plugin;
            bellAudio.currentTime = 0;
            bellAudio.play();
        }
        return;
    }

    if (
        currentJsonModifierSection === 'raceFemale' ||
        currentJsonModifierSection === 'raceMale' ||
        currentJsonModifierSection === 'blacklistedRacesFemale' ||
        currentJsonModifierSection === 'blacklistedRacesMale'
    ) {
        const raceSelect = document.getElementById('jsonFavoritosRaceSelect');
        const raceCustomInput = document.getElementById('jsonFavoritosRaceCustom');
        if (raceSelect && raceCustomInput && npc && npc.race) {
            const raceValue = npc.race;
            const option = raceSelect.querySelector(`option[value="${raceValue}"]`);
            if (option) {
                raceSelect.value = raceValue;
                raceCustomInput.value = '';
                raceCustomInput.style.display = 'none';
                raceCustomInput.disabled = true;
            } else {
                raceSelect.value = 'custom';
                raceCustomInput.value = raceValue;
                raceCustomInput.style.display = '';
                raceCustomInput.disabled = false;
            }
            bellAudio.currentTime = 0;
            bellAudio.play();
        }
        return;
    }

    const ruleTypeSelect = document.getElementById('ruleType');
    if (!ruleTypeSelect) {
        return;
    }

    if (ruleTypeSelect.value === 'raceFemale' || ruleTypeSelect.value === 'raceMale') {
        const elementValueSelect = document.getElementById('elementValue');
        const elementValueInput = document.getElementById('elementValueInput');
        if (elementValueSelect && elementValueInput && npc && npc.race) {
            elementValueSelect.value = 'custom';
            elementValueSelect.dispatchEvent(new Event('change', { bubbles: true }));
            elementValueInput.value = npc.race;
            elementValueInput.focus();
            bellAudio.currentTime = 0;
            bellAudio.play();
        }
    } else if (ruleTypeSelect.value === 'npcFormID') {
        const elementValueInput = document.getElementById('elementValueInput');
        const presetsInput = document.getElementById('presets');
        if (elementValueInput && presetsInput && npc) {
            elementValueInput.value = plugin;
            presetsInput.value = npc.form_id.replace(/^0x/, '');
            bellAudio.currentTime = 0;
            bellAudio.play();
        }
    } else if (ruleTypeSelect && ruleTypeSelect.value === 'blacklistedNpcsFormID') {
        const elementValueInput = document.getElementById('elementValueInput');
        const presetsInput = document.getElementById('presets');
        if (elementValueInput && presetsInput && npc) {
            elementValueInput.value = plugin;
            presetsInput.value = npc.form_id.replace(/^0x/, '');
            bellAudio.currentTime = 0;
            bellAudio.play();
        }
    } else if (ruleTypeSelect.value === 'npc') {
        const elementValueInput = document.getElementById('elementValueInput');
        if (elementValueInput) {
            elementValueInput.value = npcName;
            bellAudio.currentTime = 0;
            bellAudio.play();
        }
    } else if (ruleTypeSelect && ruleTypeSelect.value === 'blacklisted') {
        const presetsInput = document.getElementById('presets');
        const blacklistedValueSelect = document.getElementById('blacklistedValue');
        const blacklistedValue = blacklistedValueSelect ? blacklistedValueSelect.value : '';
        if (presetsInput) {
            let valueToAdd = npcName;
            if (blacklistedValue === 'NpcsPluginFemale' || blacklistedValue === 'NpcsPluginMale') {
                valueToAdd = plugin;
            } else if ((blacklistedValue === 'RacesFemale' || blacklistedValue === 'RacesMale') && npc && npc.race) {
                valueToAdd = npc.race;
            }
            if (valueToAdd) {
                if (presetsInput.value.trim()) {
                    presetsInput.value += ',' + valueToAdd;
                } else {
                    presetsInput.value = valueToAdd;
                }
                bellAudio.currentTime = 0;
                bellAudio.play();
            }
        }
    } else if (ruleTypeSelect && ruleTypeSelect.value === 'npcPluginFemale') {
        const elementValueInput = document.getElementById('elementValueInput');
        const presetsInput = document.getElementById('presets');
        if (elementValueInput && presetsInput) {
            elementValueInput.value = plugin;
            bellAudio.currentTime = 0;
            bellAudio.play();
        }
    } else if (ruleTypeSelect && ruleTypeSelect.value === 'npcPluginMale') {
        const elementValueInput = document.getElementById('elementValueInput');
        const presetsInput = document.getElementById('presets');
        if (elementValueInput && presetsInput) {
            elementValueInput.value = plugin;
            bellAudio.currentTime = 0;
            bellAudio.play();
        }
    }
    notifyRuleConfigChanged();
}

function selectFavoritoOutfit(plugin, formId, event) {
    event.stopPropagation();
    const outfit =
        favoritosOutfits[plugin] && Array.isArray(favoritosOutfits[plugin].armors)
            ? favoritosOutfits[plugin].armors.find(a => a.form_id === formId)
            : null;

    if (
        currentJsonModifierSection === 'blacklistedOutfitsFromORefitFormID' ||
        currentJsonModifierSection === 'outfitsForceRefitFormID'
    ) {
        const pluginInput = document.getElementById('jsonFavoritosPluginNameCustom');
        const formIdInput = document.getElementById('jsonFavoritosFormIdCustom');
        if (pluginInput && formIdInput && outfit) {
            pluginInput.value = plugin;
            formIdInput.value = formId.replace(/^0x/, '');
            bellAudio.currentTime = 0;
            bellAudio.play();
        }
        return;
    }

    if (currentJsonModifierSection === 'blacklistedOutfitsFromORefit' || currentJsonModifierSection === 'outfitsForceRefit') {
        const outfitNameInput = document.getElementById('jsonFavoritosOutfitNameCustom');
        if (outfitNameInput && outfit) {
            outfitNameInput.value = outfit.name;
            bellAudio.currentTime = 0;
            bellAudio.play();
        }
        return;
    }

    if (currentJsonModifierSection === 'blacklistedOutfitsFromORefitPlugin') {
        const pluginInput = document.getElementById('jsonFavoritosPluginNameCustom');
        if (pluginInput) {
            pluginInput.value = plugin;
            bellAudio.currentTime = 0;
            bellAudio.play();
        }
        return;
    }

    const ruleTypeSelect = document.getElementById('ruleType');
    if (!ruleTypeSelect) {
        return;
    }

    if (ruleTypeSelect.value === 'outfitsForceRefitFormID') {
        const elementValueInput = document.getElementById('elementValueInput');
        const presetsInput = document.getElementById('presets');
        if (elementValueInput && presetsInput) {
            elementValueInput.value = plugin;
            presetsInput.value = formId.replace(/^0x/, '');
            bellAudio.currentTime = 0;
            bellAudio.play();
        }
    } else if (ruleTypeSelect.value === 'blacklistedOutfitsFromORefitFormID') {
        const elementValueInput = document.getElementById('elementValueInput');
        const presetsInput = document.getElementById('presets');
        if (elementValueInput && presetsInput) {
            elementValueInput.value = plugin;
            presetsInput.value = formId.replace(/^0x/, '');
            bellAudio.currentTime = 0;
            bellAudio.play();
        }
    } else if (ruleTypeSelect.value === 'outfits') {
        const presetsInput = document.getElementById('presets');
        const outfitsValueSelect = document.getElementById('outfitsValue');
        const outfitsValue = outfitsValueSelect ? outfitsValueSelect.value : '';
        if (presetsInput) {
            let valueToAdd = '';
            if (outfitsValue === 'blacklistedOutfitsFromORefitPlugin') {
                valueToAdd = plugin;
            } else if (outfit) {
                valueToAdd = outfit.name;
            }
            if (valueToAdd) {
                if (presetsInput.value.trim()) {
                    presetsInput.value += ',' + valueToAdd;
                } else {
                    presetsInput.value = valueToAdd;
                }
                bellAudio.currentTime = 0;
                bellAudio.play();
            }
        }
    } else if (ruleTypeSelect.value === 'npcPluginFemale') {
        const elementValueInput = document.getElementById('elementValueInput');
        if (elementValueInput) {
            elementValueInput.value = plugin;
            bellAudio.currentTime = 0;
            bellAudio.play();
        }
    } else if (ruleTypeSelect.value === 'npcPluginMale') {
        const elementValueInput = document.getElementById('elementValueInput');
        if (elementValueInput) {
            elementValueInput.value = plugin;
            bellAudio.currentTime = 0;
            bellAudio.play();
        }
    }
    notifyRuleConfigChanged();
}

function displayFavoritosNPCs(filteredNPCs = null) {
    const container = document.getElementById('favoritosNpcList');
    const countElement = document.getElementById('favoritosNpcCount');
    const jsonContainer = document.getElementById('jsonFavoritosNpcList');
    const jsonCountElement = document.getElementById('jsonFavoritosNpcCount');

    // New container in Plugins NPC tab
    const containerPlugins = document.getElementById('favoritosNPCsList_Plugins');
    const countElementPlugins = document.getElementById('favoritosNPCsCount_Plugins');

    // Calculate total NPCs
    let totalNPCs = 0;
    const allFavoritosNPCs = [];
    for (const plugin in favoritosNPCs) {
        totalNPCs += favoritosNPCs[plugin].npcs.length;
        allFavoritosNPCs.push(...favoritosNPCs[plugin].npcs.map(npc => ({...npc, plugin})));
    }

    // Use filtered list if provided, otherwise all
    const displayNPCs = filteredNPCs !== null ? filteredNPCs : allFavoritosNPCs;

    if (countElement) countElement.textContent = displayNPCs.length;
    if (countElementPlugins) countElementPlugins.textContent = displayNPCs.length;
    if (jsonCountElement) jsonCountElement.textContent = displayNPCs.length;

    // Update header text (legacy selector, might need adjustment if multiple headers match)
    const headerElement = document.querySelector('.favoritos-header:nth-of-type(2) h2');
    if (headerElement) {
        headerElement.innerHTML = `👥 Favorites NPC - ${displayNPCs.length} total`;
    }

    const generateHTML = () => {
        if (displayNPCs.length === 0) {
            return '<div class="no-presets">No favorites yet</div>';
        }

        // Group by plugin
        const groupedNPCs = {};
        displayNPCs.forEach(npc => {
            const plugin = npc.plugin || 'Unknown';
            if (!groupedNPCs[plugin]) groupedNPCs[plugin] = [];
            groupedNPCs[plugin].push(npc);
        });

        // Sort plugins alphabetically
        const sortedPlugins = Object.keys(groupedNPCs).sort();

        // Sort NPCs within each plugin alphabetically by editor_id
        sortedPlugins.forEach(pluginName => {
            groupedNPCs[pluginName].sort((a, b) => a.editor_id.localeCompare(b.editor_id));
        });

        return sortedPlugins.map(pluginName => {
            const npcs = groupedNPCs[pluginName];
            return `
                <div class="plugin-section">
                    <h3><span style="color: #4CAF50">${pluginName}</span> - <span style="color: #ff9800">NPCs (${npcs.length})</span></h3>
                    <div class="outfit-category">
                        <div class="outfit-items">
                            ${npcs.map(npc =>
                                `<div class="preset-item-compact-favorito" onclick="selectFavoritoNpc('${npc.plugin.replace(/'/g, "\\'")}', '${npc.name.replace(/'/g, "\\'")}', event)">
                                    <span class="preset-name"><span style="color: #00bcd4;">${npc.name}</span> - <span style="color: #ffeb3b;">${npc.editor_id}</span> - ${npc.form_id} - <span style="color: #F5F5DC;">${npc.race}</span> - <span style="color: #ff9800;">${npc.gender}</span></span>
                                    <span class="star" onclick="toggleNpcFavorito('${npc.editor_id.replace(/'/g, "\\'")}', event)" title="Remove from favorites" style="color: #ffd700;">★</span>
                                </div>`
                            ).join('')}
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    };

    const htmlContent = generateHTML();

    if (container) container.innerHTML = htmlContent;
    if (containerPlugins) containerPlugins.innerHTML = htmlContent;
    if (jsonContainer) jsonContainer.innerHTML = htmlContent;
}

function toggleFavoritosCollapse() {
    const content = document.getElementById('favoritosContent');
    content.classList.toggle('collapsed');
    const header = document.querySelector('.favoritos-header');
    header.classList.toggle('collapsed');
}

function toggleFavoritosCollapseNpc() {
    const content = document.getElementById('favoritosNpcContent');
    content.classList.toggle('collapsed');
    const header = content.previousElementSibling;
    header.classList.toggle('collapsed');
}

function toggleFavoritosCollapseOutfits() {
    const content = document.getElementById('favoritosOutfitsContent');
    content.classList.toggle('collapsed');
    const header = content.previousElementSibling;
    header.classList.toggle('collapsed');
}

function toggleFavoritosCollapseOutfitsPlugins() {
    const content = document.getElementById('favoritosOutfitsContent_Plugins');
    content.classList.toggle('collapsed');
    const header = content.previousElementSibling;
    header.classList.toggle('collapsed');
}

function toggleFactionsLibraryCollapse() {
    const content = document.getElementById('factionsLibraryContent');
    if (!content) return;
    content.classList.toggle('collapsed');
    const header = content.previousElementSibling;
    if (header) {
        header.classList.toggle('collapsed');
    }
}

function clearPresetsField() {
    const input = document.getElementById('presets');
    if (input) {
        input.value = '';
    }
}

function toggleJsonFavoritosCollapse(section) {
    let contentId = null;
    if (section === 'presets') {
        contentId = 'jsonFavoritosPresetsContent';
    } else if (section === 'npc') {
        contentId = 'jsonFavoritosNpcContent';
    } else if (section === 'outfits') {
        contentId = 'jsonFavoritosOutfitsContent';
    } else if (section === 'factions') {
        contentId = 'jsonFactionsLibraryContent';
    }
    if (!contentId) return;
    const content = document.getElementById(contentId);
    if (!content) return;
    content.classList.toggle('collapsed');
    const header = content.previousElementSibling;
    if (header) {
        header.classList.toggle('collapsed');
    }
}

function openJsonFavoritesModal() {
    const modal = document.getElementById('jsonFavoritesModal');
    if (!modal) return;

    const sectionPresets = document.getElementById('jsonFavoritosSectionPresets');
    const sectionSelectedPresets = document.getElementById('jsonFavoritosSectionSelectedPresets');
    const selectedPresetsTitle = document.getElementById('jsonFavoritosSelectedPresetsTitle');
    const stateSelect = document.getElementById('jsonFavoritosStateSelect');
    const selectedPresetsArea = document.getElementById('jsonFavoritosSelectedPresets');
    const sectionNpc = document.getElementById('jsonFavoritosSectionNpc');
    const sectionOutfits = document.getElementById('jsonFavoritosSectionOutfits');
    const sectionNpcNameCustom = document.getElementById('jsonFavoritosSectionNpcNameCustom');
    const sectionOutfitNameCustom = document.getElementById('jsonFavoritosSectionOutfitNameCustom');
    const sectionFactionCustom = document.getElementById('jsonFavoritosSectionFactionCustom');
    const sectionRace = document.getElementById('jsonFavoritosSectionRace');
    const sectionPluginCustom = document.getElementById('jsonFavoritosSectionPluginCustom');
    const sectionFormIdCustom = document.getElementById('jsonFavoritosSectionFormIdCustom');
    const sectionFactionsLibrary = document.getElementById('jsonFavoritosSectionFactionsLibrary');

    const allSections = [
        sectionPresets,
        sectionSelectedPresets,
        sectionNpc,
        sectionOutfits,
        sectionNpcNameCustom,
        sectionOutfitNameCustom,
        sectionFactionCustom,
        sectionRace,
        sectionPluginCustom,
        sectionFormIdCustom,
        sectionFactionsLibrary
    ];

    allSections.forEach(sec => {
        if (sec) sec.style.display = '';
    });

    const presetsContent = document.getElementById('jsonFavoritosPresetsContent');
    const npcContent = document.getElementById('jsonFavoritosNpcContent');
    const outfitsContent = document.getElementById('jsonFavoritosOutfitsContent');

    const presetsHeader = sectionPresets ? sectionPresets.querySelector('.favoritos-header') : null;
    const npcHeader = sectionNpc ? sectionNpc.querySelector('.favoritos-header') : null;
    const outfitsHeader = sectionOutfits ? sectionOutfits.querySelector('.favoritos-header') : null;

    [presetsContent, npcContent, outfitsContent].forEach(content => {
        if (content) {
            content.classList.add('collapsed');
        }
    });

    [presetsHeader, npcHeader, outfitsHeader].forEach(header => {
        if (header) {
            header.classList.remove('collapsed');
        }
    });

    if (selectedPresetsTitle) {
        if (currentJsonModifierSection === 'blacklistedPresetsShowInOBodyMenu') {
            selectedPresetsTitle.textContent = 'Selected state';
        } else {
            selectedPresetsTitle.textContent = 'Selected Presets';
        }
    }

    if (stateSelect && selectedPresetsArea) {
        if (currentJsonModifierSection === 'blacklistedPresetsShowInOBodyMenu') {
            stateSelect.style.display = '';
            selectedPresetsArea.style.display = 'none';
            if (masterJsonData && typeof masterJsonData === 'object') {
                if (typeof masterJsonData.blacklistedPresetsShowInOBodyMenu === 'boolean') {
                    stateSelect.value = masterJsonData.blacklistedPresetsShowInOBodyMenu ? 'true' : 'false';
                } else {
                    stateSelect.value = 'true';
                }
            } else {
                stateSelect.value = 'true';
            }
        } else {
            stateSelect.style.display = 'none';
            selectedPresetsArea.style.display = '';
        }
    }

    if (currentJsonModifierSection === 'npcFormID') {
        if (sectionOutfits) sectionOutfits.style.display = 'none';
        if (sectionPluginCustom) sectionPluginCustom.style.display = '';
        if (sectionFormIdCustom) sectionFormIdCustom.style.display = '';
        if (sectionNpcNameCustom) sectionNpcNameCustom.style.display = 'none';
        if (sectionOutfitNameCustom) sectionOutfitNameCustom.style.display = 'none';
        if (sectionFactionCustom) sectionFactionCustom.style.display = 'none';
        if (sectionRace) sectionRace.style.display = 'none';
        if (sectionFactionsLibrary) sectionFactionsLibrary.style.display = 'none';
        if (sectionNpc) sectionNpc.style.display = '';
        if (sectionPresets) sectionPresets.style.display = '';
        if (sectionSelectedPresets) sectionSelectedPresets.style.display = '';
    } else if (currentJsonModifierSection === 'npc') {
        if (sectionOutfits) sectionOutfits.style.display = 'none';
        if (sectionPluginCustom) sectionPluginCustom.style.display = 'none';
        if (sectionFormIdCustom) sectionFormIdCustom.style.display = 'none';
        if (sectionNpcNameCustom) sectionNpcNameCustom.style.display = '';
        if (sectionOutfitNameCustom) sectionOutfitNameCustom.style.display = 'none';
        if (sectionFactionCustom) sectionFactionCustom.style.display = 'none';
        if (sectionRace) sectionRace.style.display = 'none';
        if (sectionFactionsLibrary) sectionFactionsLibrary.style.display = 'none';
        if (sectionNpc) sectionNpc.style.display = '';
        if (sectionPresets) sectionPresets.style.display = '';
        if (sectionSelectedPresets) sectionSelectedPresets.style.display = '';
    } else if (currentJsonModifierSection === 'factionFemale' || currentJsonModifierSection === 'factionMale') {
        if (sectionOutfits) sectionOutfits.style.display = 'none';
        if (sectionPluginCustom) sectionPluginCustom.style.display = 'none';
        if (sectionFormIdCustom) sectionFormIdCustom.style.display = 'none';
        if (sectionNpcNameCustom) sectionNpcNameCustom.style.display = 'none';
        if (sectionOutfitNameCustom) sectionOutfitNameCustom.style.display = 'none';
        if (sectionFactionCustom) sectionFactionCustom.style.display = '';
        if (sectionRace) sectionRace.style.display = 'none';
        if (sectionFactionsLibrary) sectionFactionsLibrary.style.display = '';
        if (sectionNpc) sectionNpc.style.display = 'none';
        if (sectionPresets) sectionPresets.style.display = '';
        if (sectionSelectedPresets) sectionSelectedPresets.style.display = '';
    } else if (currentJsonModifierSection === 'npcPluginFemale' || currentJsonModifierSection === 'npcPluginMale') {
        if (sectionOutfits) sectionOutfits.style.display = 'none';
        if (sectionPluginCustom) sectionPluginCustom.style.display = '';
        if (sectionFormIdCustom) sectionFormIdCustom.style.display = 'none';
        if (sectionNpcNameCustom) sectionNpcNameCustom.style.display = 'none';
        if (sectionOutfitNameCustom) sectionOutfitNameCustom.style.display = 'none';
        if (sectionFactionCustom) sectionFactionCustom.style.display = 'none';
        if (sectionRace) sectionRace.style.display = 'none';
        if (sectionFactionsLibrary) sectionFactionsLibrary.style.display = 'none';
        if (sectionNpc) sectionNpc.style.display = '';
        if (sectionPresets) sectionPresets.style.display = '';
        if (sectionSelectedPresets) sectionSelectedPresets.style.display = '';
    } else if (currentJsonModifierSection === 'raceFemale' || currentJsonModifierSection === 'raceMale') {
        if (sectionOutfits) sectionOutfits.style.display = 'none';
        if (sectionPluginCustom) sectionPluginCustom.style.display = 'none';
        if (sectionFormIdCustom) sectionFormIdCustom.style.display = 'none';
        if (sectionNpcNameCustom) sectionNpcNameCustom.style.display = 'none';
        if (sectionOutfitNameCustom) sectionOutfitNameCustom.style.display = 'none';
        if (sectionFactionCustom) sectionFactionCustom.style.display = 'none';
        if (sectionRace) sectionRace.style.display = '';
        if (sectionFactionsLibrary) sectionFactionsLibrary.style.display = 'none';
        if (sectionNpc) sectionNpc.style.display = '';
        if (sectionPresets) sectionPresets.style.display = '';
        if (sectionSelectedPresets) sectionSelectedPresets.style.display = '';
    } else if (
        currentJsonModifierSection === 'blacklistedOutfitsFromORefitFormID' ||
        currentJsonModifierSection === 'outfitsForceRefitFormID'
    ) {
        if (sectionOutfits) sectionOutfits.style.display = '';
        if (sectionPluginCustom) sectionPluginCustom.style.display = '';
        if (sectionFormIdCustom) sectionFormIdCustom.style.display = '';
        if (sectionNpcNameCustom) sectionNpcNameCustom.style.display = 'none';
        if (sectionOutfitNameCustom) sectionOutfitNameCustom.style.display = 'none';
        if (sectionFactionCustom) sectionFactionCustom.style.display = 'none';
        if (sectionRace) sectionRace.style.display = 'none';
        if (sectionFactionsLibrary) sectionFactionsLibrary.style.display = 'none';
        if (sectionNpc) sectionNpc.style.display = 'none';
        if (sectionPresets) sectionPresets.style.display = 'none';
        if (sectionSelectedPresets) sectionSelectedPresets.style.display = 'none';
    } else if (
        currentJsonModifierSection === 'blacklistedOutfitsFromORefit' ||
        currentJsonModifierSection === 'outfitsForceRefit'
    ) {
        if (sectionOutfits) sectionOutfits.style.display = '';
        if (sectionOutfitNameCustom) sectionOutfitNameCustom.style.display = '';
        if (sectionPluginCustom) sectionPluginCustom.style.display = 'none';
        if (sectionFormIdCustom) sectionFormIdCustom.style.display = 'none';
        if (sectionNpcNameCustom) sectionNpcNameCustom.style.display = 'none';
        if (sectionFactionCustom) sectionFactionCustom.style.display = 'none';
        if (sectionRace) sectionRace.style.display = 'none';
        if (sectionFactionsLibrary) sectionFactionsLibrary.style.display = 'none';
        if (sectionNpc) sectionNpc.style.display = 'none';
        if (sectionPresets) sectionPresets.style.display = 'none';
        if (sectionSelectedPresets) sectionSelectedPresets.style.display = 'none';
    } else if (currentJsonModifierSection === 'blacklistedOutfitsFromORefitPlugin') {
        if (sectionOutfits) sectionOutfits.style.display = '';
        if (sectionPluginCustom) sectionPluginCustom.style.display = '';
        if (sectionFormIdCustom) sectionFormIdCustom.style.display = 'none';
        if (sectionNpcNameCustom) sectionNpcNameCustom.style.display = 'none';
        if (sectionOutfitNameCustom) sectionOutfitNameCustom.style.display = 'none';
        if (sectionFactionCustom) sectionFactionCustom.style.display = 'none';
        if (sectionRace) sectionRace.style.display = 'none';
        if (sectionFactionsLibrary) sectionFactionsLibrary.style.display = 'none';
        if (sectionNpc) sectionNpc.style.display = 'none';
        if (sectionPresets) sectionPresets.style.display = 'none';
        if (sectionSelectedPresets) sectionSelectedPresets.style.display = 'none';
    } else if (currentJsonModifierSection === 'blacklistedPresetsFromRandomDistribution') {
        if (sectionPresets) sectionPresets.style.display = '';
        if (sectionSelectedPresets) sectionSelectedPresets.style.display = '';
        if (sectionOutfits) sectionOutfits.style.display = 'none';
        if (sectionNpc) sectionNpc.style.display = 'none';
        if (sectionNpcNameCustom) sectionNpcNameCustom.style.display = 'none';
        if (sectionOutfitNameCustom) sectionOutfitNameCustom.style.display = 'none';
        if (sectionFactionCustom) sectionFactionCustom.style.display = 'none';
        if (sectionRace) sectionRace.style.display = 'none';
        if (sectionPluginCustom) sectionPluginCustom.style.display = 'none';
        if (sectionFormIdCustom) sectionFormIdCustom.style.display = 'none';
        if (sectionFactionsLibrary) sectionFactionsLibrary.style.display = 'none';
    } else if (currentJsonModifierSection === 'blacklistedPresetsShowInOBodyMenu') {
        if (sectionPresets) sectionPresets.style.display = 'none';
        if (sectionSelectedPresets) sectionSelectedPresets.style.display = '';
        if (sectionOutfits) sectionOutfits.style.display = 'none';
        if (sectionNpc) sectionNpc.style.display = 'none';
        if (sectionNpcNameCustom) sectionNpcNameCustom.style.display = 'none';
        if (sectionOutfitNameCustom) sectionOutfitNameCustom.style.display = 'none';
        if (sectionFactionCustom) sectionFactionCustom.style.display = 'none';
        if (sectionRace) sectionRace.style.display = 'none';
        if (sectionPluginCustom) sectionPluginCustom.style.display = 'none';
        if (sectionFormIdCustom) sectionFormIdCustom.style.display = 'none';
        if (sectionFactionsLibrary) sectionFactionsLibrary.style.display = 'none';
    } else if (currentJsonModifierSection === 'blacklistedNpcs') {
        if (sectionOutfits) sectionOutfits.style.display = 'none';
        if (sectionPluginCustom) sectionPluginCustom.style.display = 'none';
        if (sectionFormIdCustom) sectionFormIdCustom.style.display = 'none';
        if (sectionNpcNameCustom) sectionNpcNameCustom.style.display = '';
        if (sectionOutfitNameCustom) sectionOutfitNameCustom.style.display = 'none';
        if (sectionFactionCustom) sectionFactionCustom.style.display = 'none';
        if (sectionRace) sectionRace.style.display = 'none';
        if (sectionNpc) sectionNpc.style.display = '';
        if (sectionPresets) sectionPresets.style.display = 'none';
        if (sectionSelectedPresets) sectionSelectedPresets.style.display = 'none';
        if (sectionFactionsLibrary) sectionFactionsLibrary.style.display = 'none';
    } else if (currentJsonModifierSection === 'blacklistedNpcsFormID') {
        if (sectionOutfits) sectionOutfits.style.display = 'none';
        if (sectionPluginCustom) sectionPluginCustom.style.display = '';
        if (sectionFormIdCustom) sectionFormIdCustom.style.display = '';
        if (sectionNpcNameCustom) sectionNpcNameCustom.style.display = 'none';
        if (sectionOutfitNameCustom) sectionOutfitNameCustom.style.display = 'none';
        if (sectionFactionCustom) sectionFactionCustom.style.display = 'none';
        if (sectionRace) sectionRace.style.display = 'none';
        if (sectionNpc) sectionNpc.style.display = '';
        if (sectionPresets) sectionPresets.style.display = 'none';
        if (sectionSelectedPresets) sectionSelectedPresets.style.display = 'none';
        if (sectionFactionsLibrary) sectionFactionsLibrary.style.display = 'none';
    } else if (currentJsonModifierSection === 'blacklistedNpcsPluginFemale' || currentJsonModifierSection === 'blacklistedNpcsPluginMale') {
        if (sectionOutfits) sectionOutfits.style.display = 'none';
        if (sectionPluginCustom) sectionPluginCustom.style.display = '';
        if (sectionFormIdCustom) sectionFormIdCustom.style.display = 'none';
        if (sectionNpcNameCustom) sectionNpcNameCustom.style.display = 'none';
        if (sectionOutfitNameCustom) sectionOutfitNameCustom.style.display = 'none';
        if (sectionFactionCustom) sectionFactionCustom.style.display = 'none';
        if (sectionRace) sectionRace.style.display = 'none';
        if (sectionNpc) sectionNpc.style.display = '';
        if (sectionPresets) sectionPresets.style.display = 'none';
        if (sectionSelectedPresets) sectionSelectedPresets.style.display = 'none';
        if (sectionFactionsLibrary) sectionFactionsLibrary.style.display = 'none';
    } else if (currentJsonModifierSection === 'blacklistedRacesFemale' || currentJsonModifierSection === 'blacklistedRacesMale') {
        if (sectionOutfits) sectionOutfits.style.display = 'none';
        if (sectionPluginCustom) sectionPluginCustom.style.display = 'none';
        if (sectionFormIdCustom) sectionFormIdCustom.style.display = 'none';
        if (sectionNpcNameCustom) sectionNpcNameCustom.style.display = 'none';
        if (sectionOutfitNameCustom) sectionOutfitNameCustom.style.display = 'none';
        if (sectionFactionCustom) sectionFactionCustom.style.display = 'none';
        if (sectionRace) sectionRace.style.display = '';
        if (sectionNpc) sectionNpc.style.display = '';
        if (sectionPresets) sectionPresets.style.display = 'none';
        if (sectionSelectedPresets) sectionSelectedPresets.style.display = 'none';
        if (sectionFactionsLibrary) sectionFactionsLibrary.style.display = 'none';
    } else {
        if (sectionPluginCustom) sectionPluginCustom.style.display = 'none';
        if (sectionFormIdCustom) sectionFormIdCustom.style.display = 'none';
        if (sectionOutfits) sectionOutfits.style.display = '';
        if (sectionNpcNameCustom) sectionNpcNameCustom.style.display = 'none';
        if (sectionOutfitNameCustom) sectionOutfitNameCustom.style.display = 'none';
        if (sectionFactionCustom) sectionFactionCustom.style.display = 'none';
        if (sectionRace) sectionRace.style.display = 'none';
        if (sectionFactionsLibrary) sectionFactionsLibrary.style.display = 'none';
        if (sectionSelectedPresets) sectionSelectedPresets.style.display = '';
    }

    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

function closeJsonFavoritesModal() {
    const modal = document.getElementById('jsonFavoritesModal');
    if (!modal) return;
    modal.style.display = 'none';
    document.body.style.overflow = 'auto';
}

function openJsonKeyDeleteModal(info) {
    pendingJsonKeyDelete = info;
    const modal = document.getElementById('jsonKeyDeleteModal');
    const messageEl = document.getElementById('jsonKeyDeleteMessage');
    if (messageEl && info) {
        const sectionKey = info.sectionKey || '';
        const label = info.label || '';
        if (sectionKey && label) {
            messageEl.textContent = `Do you want to delete this element "${label}" from "${sectionKey}" in your JSON?`;
        } else {
            messageEl.textContent = 'Do you want to delete this element from your JSON?';
        }
    }
    if (modal) {
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }
}

function closeJsonKeyDeleteModal() {
    const modal = document.getElementById('jsonKeyDeleteModal');
    if (modal) {
        modal.style.display = 'none';
    }
    document.body.style.overflow = 'auto';
    pendingJsonKeyDelete = null;
}

async function handleConfirmJsonKeyDelete() {
    if (!pendingJsonKeyDelete || !masterJsonData) {
        closeJsonKeyDeleteModal();
        return;
    }
    const sectionKey = pendingJsonKeyDelete.sectionKey;
    const type = pendingJsonKeyDelete.type;
    const index = pendingJsonKeyDelete.index;
    const elementKey = pendingJsonKeyDelete.elementKey;
    const label = pendingJsonKeyDelete.label;

    if (!sectionKey || !Object.prototype.hasOwnProperty.call(masterJsonData, sectionKey)) {
        closeJsonKeyDeleteModal();
        return;
    }

        try {
            let hadServerError = false;
            const sectionData = masterJsonData[sectionKey];
            let deletedValue = null;

        if (Array.isArray(sectionData) && type === 'array') {
            if (typeof index !== 'number' || index < 0 || index >= sectionData.length) {
                throw new Error('Invalid array index');
            }
            deletedValue = sectionData[index];
            sectionData.splice(index, 1);
        } else if (sectionData && typeof sectionData === 'object' && type === 'object') {
            if (!Object.prototype.hasOwnProperty.call(sectionData, elementKey)) {
                throw new Error('Element key not found');
            }
            deletedValue = sectionData[elementKey];
            delete sectionData[elementKey];
        } else {
            throw new Error('Invalid section data for deletion');
        }

        const elementName = type === 'object'
            ? (elementKey || '')
            : (label || (typeof index === 'number' ? `Item ${index + 1}` : ''));

        const response = await fetch(`${BASE_URL}/save-master-json`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                content: JSON.stringify(masterJsonData, null, 4),
                logAction: 'delete_element',
                logSection: sectionKey,
                logType: type,
                logElement: elementName,
                logDeletedKey: type === 'object' ? elementKey : index,
                logDeletedValue: deletedValue
            })
        });

        let data = null;
        try {
            data = await response.json();
        } catch (parseError) {
            console.error('Error parsing save-master-json response:', parseError);
        }
        if (!response.ok || (data && data.status && data.status !== 'success')) {
            hadServerError = true;
        }

        const viewer = document.getElementById('masterJsonViewer');
        if (viewer) {
            renderJsonTree(masterJsonData, viewer);
        }

        const editorKeys = document.getElementById('jsonModifierEditorKeys');
        const jsonViewer = document.getElementById('jsonModifierViewer');
        if (editorKeys && jsonViewer) {
            if (Object.prototype.hasOwnProperty.call(masterJsonData, sectionKey)) {
                const updatedSection = masterJsonData[sectionKey];
                setupJsonEditor(sectionKey, updatedSection, editorKeys, jsonViewer);
            } else {
                editorKeys.textContent = 'No elements for this section';
                jsonViewer.textContent = '';
            }
        }

        if (typeof showToast === 'function') {
            const itemLabel = label || (type === 'array' ? `Item ${typeof index === 'number' ? index + 1 : ''}` : elementKey || '');
            if (!hadServerError) {
                if (itemLabel) {
                    showToast(`Element "${itemLabel}" deleted from "${sectionKey}"`, '#10b981');
                } else {
                    showToast(`Element deleted from "${sectionKey}"`, '#10b981');
                }
            } else {
                showToast('Element deleted, but there was an error saving JSON', '#f97316');
            }
        }

        try {
            await fetch(`${BASE_URL}/log-json-event`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    action: 'delete_element',
                    section: sectionKey,
                    type: type,
                    element: elementName,
                    deletedKey: type === 'object' ? elementKey : index,
                    deletedValue: deletedValue,
                    message: 'Element deleted from JSON Modificador'
                })
            });
                } catch (logError) {
                    console.error('Error logging JSON delete event:', logError);
                }

                if (!hadServerError && typeof playCopySound === 'function') {
                    playCopySound();
                }
            } catch (error) {
                console.error('Error deleting JSON element:', error);
            } finally {
        closeJsonKeyDeleteModal();
        const loadMasterJsonBtn = document.getElementById('loadMasterJson');
        if (loadMasterJsonBtn) {
            setTimeout(() => {
                loadMasterJsonBtn.click();
            }, 1000);
        }
    }
}

function openExampleModal() {
    const modal = document.getElementById('exampleModal');
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    if (typeof setExampleTab === 'function') {
        setExampleTab('visual');
    }
}

function closeExampleModal() {
    const modal = document.getElementById('exampleModal');
    modal.style.display = 'none';
    document.body.style.overflow = 'auto';
}

function setExampleTab(tab) {
    const titleEl = document.getElementById('exampleModalTitle');
    const visualContent = document.getElementById('exampleVisualContent');
    const catContent = document.getElementById('exampleCatContent');
    const visualBtn = document.getElementById('exampleTabVisual');
    const catBtn = document.getElementById('exampleTabCat');
    if (!titleEl || !visualContent || !catContent || !visualBtn || !catBtn) return;

    if (tab === 'cat') {
        visualContent.style.display = 'none';
        catContent.style.display = 'block';
        titleEl.textContent = 'Didactic explanation of JSON Master of Obody NG, explained by a cat';
        visualBtn.classList.remove('btn-primary');
        visualBtn.classList.add('btn-secondary');
        catBtn.classList.remove('btn-secondary');
        catBtn.classList.add('btn-primary');
        initializeCatJsonExplanation();
    } else {
        visualContent.style.display = 'block';
        catContent.style.display = 'none';
        titleEl.textContent = 'Visual rules application';
        visualBtn.classList.remove('btn-secondary');
        visualBtn.classList.add('btn-primary');
        catBtn.classList.remove('btn-primary');
        catBtn.classList.add('btn-secondary');
    }
}

// Close modal when clicking outside
document.addEventListener('click', function(event) {
    const exampleModal = document.getElementById('exampleModal');
    const jsonFavoritesModal = document.getElementById('jsonFavoritesModal');
    const logExpandModal = document.getElementById('logExpandModal');
    const jsonKeyDeleteModal = document.getElementById('jsonKeyDeleteModal');
    if (event.target === exampleModal) {
        closeExampleModal();
    }
    if (event.target === jsonFavoritesModal) {
        closeJsonFavoritesModal();
    }
    if (event.target === logExpandModal) {
        closeLogExpandModal();
    }
    if (event.target === jsonKeyDeleteModal) {
        closeJsonKeyDeleteModal();
    }
});

// Close modal with Escape key
document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
        const exampleModal = document.getElementById('exampleModal');
        if (exampleModal && exampleModal.style.display === 'flex') {
            closeExampleModal();
        }
        const jsonFavoritesModal = document.getElementById('jsonFavoritesModal');
        if (jsonFavoritesModal && jsonFavoritesModal.style.display === 'flex') {
            closeJsonFavoritesModal();
        }
        const logExpandModal = document.getElementById('logExpandModal');
        if (logExpandModal && logExpandModal.style.display === 'flex') {
            closeLogExpandModal();
        }
        const jsonKeyDeleteModal = document.getElementById('jsonKeyDeleteModal');
        if (jsonKeyDeleteModal && jsonKeyDeleteModal.style.display === 'flex') {
            closeJsonKeyDeleteModal();
        }
    }
});

function setupPresetSearch(searchId, allPresets, containerId) {
    const searchInput = document.getElementById(searchId);
    const container = document.getElementById(containerId);

    searchInput.addEventListener('input', function() {
        const searchTerm = this.value.toLowerCase().trim();
        const filteredPresets = allPresets.filter(preset => 
            preset.toLowerCase().includes(searchTerm)
        );
        if (containerId === 'favoritosList' || containerId === 'jsonFavoritosListPresets') {
            displayFavoritosCompact(filteredPresets);
        } else {
            displayPresetList(containerId, filteredPresets);
        }
    });
}

function setupNpcSearch(searchId, getAllNpcs, containerId) {
    const searchInput = document.getElementById(searchId);
    const container = document.getElementById(containerId);

    searchInput.addEventListener('input', function() {
        const searchTerm = this.value.toLowerCase().trim();
        const allNpcs = getAllNpcs();
        const filteredNpcs = allNpcs.filter(npc =>
            npc.name.toLowerCase().includes(searchTerm)
        );
        displayFavoritosNPCs(filteredNpcs);
    });
}

function setupOutfitsSearch(searchId, allOutfitsProvider, containerId, countId) {
    const searchInput = document.getElementById(searchId);
    if (!searchInput) return;

    searchInput.addEventListener('input', function() {
        const searchTerm = this.value.toLowerCase().trim();
        const allOutfits = allOutfitsProvider();
        const filteredOutfits = allOutfits.filter(outfit =>
            outfit.name.toLowerCase().includes(searchTerm)
        );
        renderFavoritosOutfitsToContainer(containerId, countId, filteredOutfits);
    });
}

async function loadFactionsLibrary() {
    const container = document.getElementById('factionsLibraryList');
    const countElement = document.getElementById('factionsLibraryCount');
    const searchInput = document.getElementById('factionsLibrarySearchInline');

    if (!container || !countElement || !searchInput) return;

    try {
        const response = await fetch(`${BASE_URL}/load-memori-f`);
        if (!response.ok) throw new Error('HTTP ' + response.status);
        const result = await response.json();
        if (result.status === 'success' && result.data && typeof result.data === 'object') {
            factionsMemoriDetails = result.data;
            factionsMemoriNames = Object.keys(result.data);
        } else {
            factionsMemoriDetails = {};
            factionsMemoriNames = [];
        }
    } catch (error) {
        console.error('Error loading factions library:', error);
        factionsMemoriDetails = {};
        factionsMemoriNames = [];
    }

    if (factionsSource === 'memori') {
        factionsLibraryDetails = factionsMemoriDetails;
        factionsLibraryNames = factionsMemoriNames.slice();
        displayFactionsLibrary();
        updateJsonFactionsLibraryDropdown();
    }

    updateFactionsSourceButtons();

    if (!factionsLibrarySearchInitialized) {
        factionsLibrarySearchInitialized = true;
        searchInput.addEventListener('input', function () {
            const term = this.value.toLowerCase().trim();
            if (!term) {
                displayFactionsLibrary();
                return;
            }
            const filtered = factionsLibraryNames.filter(name => name.toLowerCase().includes(term));
            displayFactionsLibrary(filtered);
        });
    }
}

window.addEventListener('DOMContentLoaded', () => {
    setTheme('indice');
    updateParticleColorFromTheme();
    loadJSON();
    loadINI();
    loadPortMaster();
    loadPort();
    initializeINIGenerator();
    loadFavoritos().then(() => {
        loadPresetLists();
    });
    loadFavoritosNPCs().then(() => {
        displayFavoritosNPCs();
        // Setup search for NPC favorites
        function getAllFavoritosNPCs() {
            const allFavoritosNPCs = [];
            for (const plugin in favoritosNPCs) {
                allFavoritosNPCs.push(...favoritosNPCs[plugin].npcs.map(npc => ({...npc, plugin})));
            }
            return allFavoritosNPCs;
        }
        setupNpcSearch('favoritosNpcSearchInline', getAllFavoritosNPCs, 'favoritosNpcList');
        setupNpcSearch('jsonFavoritosNpcSearchInline', getAllFavoritosNPCs, 'jsonFavoritosNpcList');
    });
    loadFavoritosOutfits().then(() => {
        displayFavoritosOutfits();
        // Setup search for Outfits favorites (only armors)
        function getAllFavoritosOutfits() {
            const all = [];
            for (const plugin in favoritosOutfits) {
                if (favoritosOutfits[plugin].armors) {
                    all.push(...favoritosOutfits[plugin].armors.map(armor => ({...armor, plugin})));
                }
            }
            return all;
        }

        setupOutfitsSearch('favoritosOutfitsSearchInline', getAllFavoritosOutfits, 'favoritosOutfitsList', 'favoritosOutfitsCount');
        setupOutfitsSearch('favoritosOutfitsSearchInline_Plugins', getAllFavoritosOutfits, 'favoritosOutfitsList_Plugins', 'favoritosOutfitsCount_Plugins');
        setupOutfitsSearch('jsonFavoritosOutfitsSearchInline', getAllFavoritosOutfits, 'jsonFavoritosOutfitsList', 'jsonFavoritosOutfitsCount');
    });
    loadFactionsLibrary();
    loadCsvFactionsLibraryData().then(() => {
        updateFactionsSourceButtons();
        initializeFactionSourceButtons();
    });
    const jsonFactionsSearchInput = document.getElementById('jsonFactionsLibrarySearchInline');
    if (jsonFactionsSearchInput) {
        jsonFactionsSearchInput.addEventListener('input', function () {
            const term = this.value.toLowerCase().trim();
            if (!term) {
                displayJsonFactionsLibraryInModal();
                return;
            }
            const filtered = factionsLibraryNames.filter(name => name.toLowerCase().includes(term));
            displayJsonFactionsLibraryInModal(filtered);
        });
    }
    updateRuleFavoritesVisibility(document.getElementById('ruleType') ? document.getElementById('ruleType').value : '');
    loadUpdatesJson();

    setupObodyLogLink();

    const pluginInput = document.getElementById('jsonFavoritosPluginNameCustom');
    const formIdInput = document.getElementById('jsonFavoritosFormIdCustom');
    const npcNameInput = document.getElementById('jsonFavoritosNpcNameCustom');
    const outfitNameInput = document.getElementById('jsonFavoritosOutfitNameCustom');
    const factionNameInput = document.getElementById('jsonFavoritosFactionNameCustom');
    const raceSelect = document.getElementById('jsonFavoritosRaceSelect');
    const raceCustomInput = document.getElementById('jsonFavoritosRaceCustom');
    const globalAddKeyBtn = document.getElementById('jsonFavoritesAddKeyBtn');
    const globalCleanKeyBtn = document.getElementById('jsonFavoritesCleanBtn');
    const stateSelect = document.getElementById('jsonFavoritosStateSelect');
    const selectedPresetsArea = document.getElementById('jsonFavoritosSelectedPresets');
    const selectedPresetsClearBtn = document.getElementById('jsonFavoritosSelectedPresetsClearBtn');

    if (selectedPresetsClearBtn && selectedPresetsArea) {
        selectedPresetsClearBtn.addEventListener('click', () => {
            selectedPresetsArea.value = '';
            selectedPresetsArea.dispatchEvent(new Event('input', { bubbles: true }));
        });
    }

    if (raceSelect && raceCustomInput) {
        raceSelect.addEventListener('change', () => {
            if (raceSelect.value === 'custom') {
                raceCustomInput.style.display = '';
                raceCustomInput.disabled = false;
            } else {
                raceCustomInput.style.display = 'none';
                raceCustomInput.disabled = true;
                raceCustomInput.value = '';
            }
        });
    }

    if (globalCleanKeyBtn) {
        globalCleanKeyBtn.addEventListener('click', () => {
            if (pluginInput) pluginInput.value = '';
            if (formIdInput) formIdInput.value = '';
            if (npcNameInput) npcNameInput.value = '';
            if (outfitNameInput) outfitNameInput.value = '';
            if (factionNameInput) factionNameInput.value = '';
            if (stateSelect) stateSelect.value = 'true';
            if (selectedPresetsArea) {
                selectedPresetsArea.value = '';
                selectedPresetsArea.dispatchEvent(new Event('input', { bubbles: true }));
            }
            if (raceSelect && raceCustomInput) {
                raceSelect.value = '';
                raceCustomInput.value = '';
                raceCustomInput.style.display = 'none';
                raceCustomInput.disabled = true;
            }
            if (typeof showToast === 'function') {
                showToast('Key Elements fields cleared.', '#10b981');
            }
        });
    }

    if (globalAddKeyBtn) {
        globalAddKeyBtn.addEventListener('click', async () => {
            const section = currentJsonModifierSection;
            if (!section) {
                if (typeof showToast === 'function') {
                    showToast('Select a JSON key first.', '#f97316');
                }
                return;
            }

            if (!masterJsonData || typeof masterJsonData !== 'object') {
                if (typeof showToast === 'function') {
                    showToast('Master JSON not loaded. Use Refresh first.', '#f97316');
                }
                return;
            }

            const selectedText = selectedPresetsArea ? selectedPresetsArea.value : '';
            let presets = [];
            if (selectedText && selectedText.trim()) {
                presets = selectedText.split(/[,\n;]/).map(v => v.trim()).filter(v => v.length > 0);
            }

            if (section === 'npcFormID') {
                const pluginValueRaw = pluginInput ? pluginInput.value.trim() : '';
                const formIdRaw = formIdInput ? formIdInput.value.trim() : '';

                if (!pluginValueRaw || !formIdRaw) {
                    if (typeof showToast === 'function') {
                        showToast('Plugin and FormID are required.', '#f97316');
                    }
                    return;
                }

                const pluginValue = pluginValueRaw;
                let formIdValue = formIdRaw.replace(/^0x/i, '').trim();
                if (!formIdValue) {
                    if (typeof showToast === 'function') {
                        showToast('Invalid FormID.', '#f97316');
                    }
                    return;
                }

                if (presets.length === 0) {
                    presets = [formIdValue];
                }

                try {
                    if (!masterJsonData.npcFormID || typeof masterJsonData.npcFormID !== 'object') {
                        masterJsonData.npcFormID = {};
                    }
                    const npcFormSection = masterJsonData.npcFormID;
                    if (!npcFormSection[pluginValue] || typeof npcFormSection[pluginValue] !== 'object') {
                        npcFormSection[pluginValue] = {};
                    }
                    const pluginBlock = npcFormSection[pluginValue];

                    if (!Array.isArray(pluginBlock[formIdValue])) {
                        pluginBlock[formIdValue] = presets.slice();
                    } else {
                        const existing = pluginBlock[formIdValue];
                        presets.forEach(p => {
                            if (!existing.includes(p)) {
                                existing.push(p);
                            }
                        });
                    }

                    let hadServerError = false;

                    const response = await fetch(`${BASE_URL}/save-master-json`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            content: JSON.stringify(masterJsonData, null, 4),
                            logAction: 'add_element',
                            logSection: 'npcFormID',
                            logType: 'npcFormID_entry',
                            logPlugin: pluginValue,
                            logFormId: formIdValue,
                            logPresets: pluginBlock[formIdValue]
                        })
                    });

                    let data = null;
                    try {
                        data = await response.json();
                    } catch (parseError) {
                        console.error('Error parsing save-master-json response (add_element):', parseError);
                    }

                    if (!response.ok || (data && data.status && data.status !== 'success')) {
                        hadServerError = true;
                    }

                    try {
                        await fetch(`${BASE_URL}/log-json-event`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                action: 'add_element',
                                section: 'npcFormID',
                                type: 'npcFormID_entry',
                                plugin: pluginValue,
                                formId: formIdValue,
                                presets: pluginBlock[formIdValue],
                                message: 'Element added from JSON Modificador Key Elements Addons'
                            })
                        });
                    } catch (logError) {
                        console.error('Error logging JSON add event:', logError);
                    }

                    if (typeof showToast === 'function') {
                        if (!hadServerError) {
                            showToast(`Entry added to npcFormID for "${pluginValue}"`, '#10b981');
                        } else {
                            showToast('Entry added, but there was an error saving JSON', '#f97316');
                        }
                    }

                    if (!hadServerError) {
                        if (pluginInput) pluginInput.value = '';
                        if (formIdInput) formIdInput.value = '';
                        if (selectedPresetsArea) selectedPresetsArea.value = '';

                        if (typeof playReloadSound === 'function') {
                            playReloadSound();
                        }

                        closeJsonFavoritesModal();

                        const loadMasterJsonBtn = document.getElementById('loadMasterJson');
                        if (loadMasterJsonBtn) {
                            setTimeout(() => {
                                loadMasterJsonBtn.click();
                            }, 800);
                        }
                    }
                } catch (error) {
                    console.error('Error adding npcFormID entry:', error);
                    if (typeof showToast === 'function') {
                        showToast('Unexpected error adding entry', '#f97316');
                    }
                }
                return;
            }

            if (section === 'npc') {
                const nameRaw = npcNameInput ? npcNameInput.value.trim() : '';
                if (!nameRaw) {
                    if (typeof showToast === 'function') {
                        showToast('NPC name is required.', '#f97316');
                    }
                    return;
                }
                if (presets.length === 0) {
                    if (typeof showToast === 'function') {
                        showToast('At least one preset is required.', '#f97316');
                    }
                    return;
                }
                const targetSectionKey = 'npc';
                try {
                    if (!masterJsonData[targetSectionKey] || typeof masterJsonData[targetSectionKey] !== 'object') {
                        masterJsonData[targetSectionKey] = {};
                    }
                    const npcSection = masterJsonData[targetSectionKey];
                    const keyName = nameRaw;
                    if (!Array.isArray(npcSection[keyName])) {
                        npcSection[keyName] = presets.slice();
                    } else {
                        const existing = npcSection[keyName];
                        presets.forEach(p => {
                            if (!existing.includes(p)) {
                                existing.push(p);
                            }
                        });
                    }

                    let hadServerError = false;

                    const response = await fetch(`${BASE_URL}/save-master-json`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            content: JSON.stringify(masterJsonData, null, 4),
                            logAction: 'add_element',
                            logSection: targetSectionKey,
                            logType: 'npc_entry',
                            logNpcName: keyName,
                            logPresets: npcSection[keyName]
                        })
                    });

                    let data = null;
                    try {
                        data = await response.json();
                    } catch (parseError) {
                        console.error('Error parsing save-master-json response (npc add_element):', parseError);
                    }

                    if (!response.ok || (data && data.status && data.status !== 'success')) {
                        hadServerError = true;
                    }

                    try {
                        await fetch(`${BASE_URL}/log-json-event`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                action: 'add_element',
                                section: targetSectionKey,
                                type: 'npc_entry',
                                npcName: keyName,
                                presets: npcSection[keyName],
                                message: 'Element added from JSON Modificador Key Elements Addons'
                            })
                        });
                    } catch (logError) {
                        console.error('Error logging JSON add event (npc):', logError);
                    }

                    if (typeof showToast === 'function') {
                        if (!hadServerError) {
                            showToast(`Entry added to npc for "${keyName}"`, '#10b981');
                        } else {
                            showToast('Entry added, but there was an error saving JSON', '#f97316');
                        }
                    }

                    if (!hadServerError) {
                        if (npcNameInput) npcNameInput.value = '';
                        if (selectedPresetsArea) selectedPresetsArea.value = '';

                        if (typeof playReloadSound === 'function') {
                            playReloadSound();
                        }

                        closeJsonFavoritesModal();

                        const loadMasterJsonBtn = document.getElementById('loadMasterJson');
                        if (loadMasterJsonBtn) {
                            setTimeout(() => {
                                loadMasterJsonBtn.click();
                            }, 800);
                        }
                    }
                } catch (error) {
                    console.error('Error adding npc entry:', error);
                    if (typeof showToast === 'function') {
                        showToast('Unexpected error adding npc entry', '#f97316');
                    }
                }
                return;
            }

            if (section === 'factionFemale' || section === 'factionMale') {
                const factionRaw = factionNameInput ? factionNameInput.value.trim() : '';
                if (!factionRaw) {
                    if (typeof showToast === 'function') {
                        showToast('Faction name is required.', '#f97316');
                    }
                    return;
                }
                if (presets.length === 0) {
                    if (typeof showToast === 'function') {
                        showToast('At least one preset is required.', '#f97316');
                    }
                    return;
                }

                const targetSectionKey = section;

                try {
                    if (!masterJsonData[targetSectionKey] || typeof masterJsonData[targetSectionKey] !== 'object') {
                        masterJsonData[targetSectionKey] = {};
                    }
                    const factionSection = masterJsonData[targetSectionKey];
                    const keyName = factionRaw;
                    if (!Array.isArray(factionSection[keyName])) {
                        factionSection[keyName] = presets.slice();
                    } else {
                        const existing = factionSection[keyName];
                        presets.forEach(p => {
                            if (!existing.includes(p)) {
                                existing.push(p);
                            }
                        });
                    }

                    let hadServerError = false;

                    const response = await fetch(`${BASE_URL}/save-master-json`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            content: JSON.stringify(masterJsonData, null, 4),
                            logAction: 'add_element',
                            logSection: targetSectionKey,
                            logType: 'faction_entry',
                            logFaction: keyName,
                            logPresets: factionSection[keyName]
                        })
                    });

                    let data = null;
                    try {
                        data = await response.json();
                    } catch (parseError) {
                        console.error('Error parsing save-master-json response (faction add_element):', parseError);
                    }

                    if (!response.ok || (data && data.status && data.status !== 'success')) {
                        hadServerError = true;
                    }

                    try {
                        await fetch(`${BASE_URL}/log-json-event`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                action: 'add_element',
                                section: targetSectionKey,
                                type: 'faction_entry',
                                faction: keyName,
                                presets: factionSection[keyName],
                                message: 'Element added from JSON Modificador Key Elements Addons'
                            })
                        });
                    } catch (logError) {
                        console.error('Error logging JSON add event (faction):', logError);
                    }

                    if (typeof showToast === 'function') {
                        if (!hadServerError) {
                            showToast(`Entry added to ${targetSectionKey} for "${keyName}"`, '#10b981');
                        } else {
                            showToast('Entry added, but there was an error saving JSON', '#f97316');
                        }
                    }

                    if (!hadServerError) {
                        if (factionNameInput) factionNameInput.value = '';
                        if (selectedPresetsArea) selectedPresetsArea.value = '';

                        if (typeof playReloadSound === 'function') {
                            playReloadSound();
                        }

                        closeJsonFavoritesModal();

                        const loadMasterJsonBtn = document.getElementById('loadMasterJson');
                        if (loadMasterJsonBtn) {
                            setTimeout(() => {
                                loadMasterJsonBtn.click();
                            }, 800);
                        }
                    }
                } catch (error) {
                    console.error('Error adding faction entry:', error);
                    if (typeof showToast === 'function') {
                        showToast('Unexpected error adding faction entry', '#f97316');
                    }
                }
                return;
            }

            if (section === 'npcPluginFemale' || section === 'npcPluginMale') {
                const pluginValueRaw = pluginInput ? pluginInput.value.trim() : '';
                if (!pluginValueRaw) {
                    if (typeof showToast === 'function') {
                        showToast('Plugin name is required.', '#f97316');
                    }
                    return;
                }
                if (presets.length === 0) {
                    if (typeof showToast === 'function') {
                        showToast('At least one preset is required.', '#f97316');
                    }
                    return;
                }

                const targetSectionKey = section;

                try {
                    if (!masterJsonData[targetSectionKey] || typeof masterJsonData[targetSectionKey] !== 'object') {
                        masterJsonData[targetSectionKey] = {};
                    }
                    const pluginSection = masterJsonData[targetSectionKey];
                    const keyName = pluginValueRaw;
                    if (!Array.isArray(pluginSection[keyName])) {
                        pluginSection[keyName] = presets.slice();
                    } else {
                        const existing = pluginSection[keyName];
                        presets.forEach(p => {
                            if (!existing.includes(p)) {
                                existing.push(p);
                            }
                        });
                    }

                    let hadServerError = false;

                    const response = await fetch(`${BASE_URL}/save-master-json`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            content: JSON.stringify(masterJsonData, null, 4),
                            logAction: 'add_element',
                            logSection: targetSectionKey,
                            logType: 'npcPlugin_entry',
                            logPlugin: keyName,
                            logPresets: pluginSection[keyName]
                        })
                    });

                    let data = null;
                    try {
                        data = await response.json();
                    } catch (parseError) {
                        console.error('Error parsing save-master-json response (npcPlugin add_element):', parseError);
                    }

                    if (!response.ok || (data && data.status && data.status !== 'success')) {
                        hadServerError = true;
                    }

                    try {
                        await fetch(`${BASE_URL}/log-json-event`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                action: 'add_element',
                                section: targetSectionKey,
                                type: 'npcPlugin_entry',
                                plugin: keyName,
                                presets: pluginSection[keyName],
                                message: 'Element added from JSON Modificador Key Elements Addons'
                            })
                        });
                    } catch (logError) {
                        console.error('Error logging JSON add event (npcPlugin):', logError);
                    }

                    if (typeof showToast === 'function') {
                        if (!hadServerError) {
                            showToast(`Entry added to ${targetSectionKey} for "${keyName}"`, '#10b981');
                        } else {
                            showToast('Entry added, but there was an error saving JSON', '#f97316');
                        }
                    }

                    if (!hadServerError) {
                        if (pluginInput) pluginInput.value = '';
                        if (selectedPresetsArea) selectedPresetsArea.value = '';

                        if (typeof playReloadSound === 'function') {
                            playReloadSound();
                        }

                        closeJsonFavoritesModal();

                        const loadMasterJsonBtn = document.getElementById('loadMasterJson');
                        if (loadMasterJsonBtn) {
                            setTimeout(() => {
                                loadMasterJsonBtn.click();
                            }, 800);
                        }
                    }
                } catch (error) {
                    console.error('Error adding npcPlugin entry:', error);
                    if (typeof showToast === 'function') {
                        showToast('Unexpected error adding npcPlugin entry', '#f97316');
                    }
                }
                return;
            }

            if (section === 'raceFemale' || section === 'raceMale') {
                let raceKey = '';
                if (raceSelect) {
                    const val = raceSelect.value;
                    if (val === 'custom') {
                        raceKey = raceCustomInput ? raceCustomInput.value.trim() : '';
                    } else {
                        raceKey = val;
                    }
                } else if (raceCustomInput) {
                    raceKey = raceCustomInput.value.trim();
                }

                if (!raceKey) {
                    if (typeof showToast === 'function') {
                        showToast('Race is required.', '#f97316');
                    }
                    return;
                }

                if (presets.length === 0) {
                    if (typeof showToast === 'function') {
                        showToast('At least one preset is required.', '#f97316');
                    }
                    return;
                }

                const targetSectionKey = section;

                try {
                    if (!masterJsonData[targetSectionKey] || typeof masterJsonData[targetSectionKey] !== 'object') {
                        masterJsonData[targetSectionKey] = {};
                    }
                    const raceSection = masterJsonData[targetSectionKey];
                    const keyName = raceKey;
                    if (!Array.isArray(raceSection[keyName])) {
                        raceSection[keyName] = presets.slice();
                    } else {
                        const existing = raceSection[keyName];
                        presets.forEach(p => {
                            if (!existing.includes(p)) {
                                existing.push(p);
                            }
                        });
                    }

                    let hadServerError = false;

                    const response = await fetch(`${BASE_URL}/save-master-json`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            content: JSON.stringify(masterJsonData, null, 4),
                            logAction: 'add_element',
                            logSection: targetSectionKey,
                            logType: 'race_entry',
                            logRace: keyName,
                            logPresets: raceSection[keyName]
                        })
                    });

                    let data = null;
                    try {
                        data = await response.json();
                    } catch (parseError) {
                        console.error('Error parsing save-master-json response (race add_element):', parseError);
                    }

                    if (!response.ok || (data && data.status && data.status !== 'success')) {
                        hadServerError = true;
                    }

                    try {
                        await fetch(`${BASE_URL}/log-json-event`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                action: 'add_element',
                                section: targetSectionKey,
                                type: 'race_entry',
                                race: keyName,
                                presets: raceSection[keyName],
                                message: 'Element added from JSON Modificador Key Elements Addons'
                            })
                        });
                    } catch (logError) {
                        console.error('Error logging JSON add event (race):', logError);
                    }

                    if (typeof showToast === 'function') {
                        if (!hadServerError) {
                            showToast(`Entry added to ${targetSectionKey} for "${keyName}"`, '#10b981');
                        } else {
                            showToast('Entry added, but there was an error saving JSON', '#f97316');
                        }
                    }

                    if (!hadServerError) {
                        if (raceSelect) raceSelect.value = '';
                        if (raceCustomInput) {
                            raceCustomInput.value = '';
                            raceCustomInput.style.display = 'none';
                            raceCustomInput.disabled = true;
                        }
                        if (selectedPresetsArea) selectedPresetsArea.value = '';

                        if (typeof playReloadSound === 'function') {
                            playReloadSound();
                        }

                        closeJsonFavoritesModal();

                        const loadMasterJsonBtn = document.getElementById('loadMasterJson');
                        if (loadMasterJsonBtn) {
                            setTimeout(() => {
                                loadMasterJsonBtn.click();
                            }, 800);
                        }
                    }
                } catch (error) {
                    console.error('Error adding race entry:', error);
                    if (typeof showToast === 'function') {
                        showToast('Unexpected error adding race entry', '#f97316');
                    }
                }
                return;
            }

            if (section === 'blacklistedOutfitsFromORefitFormID' || section === 'outfitsForceRefitFormID') {
                const pluginValueRaw = pluginInput ? pluginInput.value.trim() : '';
                const formIdRaw = formIdInput ? formIdInput.value.trim() : '';

                if (!pluginValueRaw || !formIdRaw) {
                    if (typeof showToast === 'function') {
                        showToast('Plugin and FormID are required.', '#f97316');
                    }
                    return;
                }

                const pluginValue = pluginValueRaw;
                let formIdValue = formIdRaw.replace(/^0x/i, '').trim();
                if (!formIdValue) {
                    if (typeof showToast === 'function') {
                        showToast('Invalid FormID.', '#f97316');
                    }
                    return;
                }

                const targetSectionKey = section;

                try {
                    if (!masterJsonData[targetSectionKey] || typeof masterJsonData[targetSectionKey] !== 'object') {
                        masterJsonData[targetSectionKey] = {};
                    }
                    const outfitSection = masterJsonData[targetSectionKey];
                    if (!Array.isArray(outfitSection[pluginValue])) {
                        outfitSection[pluginValue] = [formIdValue];
                    } else if (!outfitSection[pluginValue].includes(formIdValue)) {
                        outfitSection[pluginValue].push(formIdValue);
                    }

                    let hadServerError = false;

                    const logType =
                        targetSectionKey === 'blacklistedOutfitsFromORefitFormID'
                            ? 'blacklistedOutfitsFromORefitFormID_entry'
                            : 'outfitsForceRefitFormID_entry';

                    const response = await fetch(`${BASE_URL}/save-master-json`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            content: JSON.stringify(masterJsonData, null, 4),
                            logAction: 'add_element',
                            logSection: targetSectionKey,
                            logType: logType,
                            logPlugin: pluginValue,
                            logFormId: formIdValue,
                            logFormIds: outfitSection[pluginValue]
                        })
                    });

                    let data = null;
                    try {
                        data = await response.json();
                    } catch (parseError) {
                        console.error('Error parsing save-master-json response (outfitFormID add_element):', parseError);
                    }

                    if (!response.ok || (data && data.status && data.status !== 'success')) {
                        hadServerError = true;
                    }

                    try {
                        const logTypeEvent =
                            targetSectionKey === 'blacklistedOutfitsFromORefitFormID'
                                ? 'blacklistedOutfitsFromORefitFormID_entry'
                                : 'outfitsForceRefitFormID_entry';

                        await fetch(`${BASE_URL}/log-json-event`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                action: 'add_element',
                                section: targetSectionKey,
                                type: logTypeEvent,
                                plugin: pluginValue,
                                formId: formIdValue,
                                formIds: outfitSection[pluginValue],
                                message: 'Element added from JSON Modificador Key Elements Addons'
                            })
                        });
                    } catch (logError) {
                        console.error('Error logging JSON add event (outfitFormID):', logError);
                    }

                    if (typeof showToast === 'function') {
                        if (!hadServerError) {
                            showToast(`Entry added to ${targetSectionKey} for "${pluginValue}"`, '#10b981');
                        } else {
                            showToast('Entry added, but there was an error saving JSON', '#f97316');
                        }
                    }

                    if (!hadServerError) {
                        if (pluginInput) pluginInput.value = '';
                        if (formIdInput) formIdInput.value = '';
                        if (selectedPresetsArea) selectedPresetsArea.value = '';

                        if (typeof playReloadSound === 'function') {
                            playReloadSound();
                        }

                        closeJsonFavoritesModal();

                        const loadMasterJsonBtn = document.getElementById('loadMasterJson');
                        if (loadMasterJsonBtn) {
                            setTimeout(() => {
                                loadMasterJsonBtn.click();
                            }, 800);
                        }
                    }
                } catch (error) {
                    console.error('Error adding outfitFormID entry:', error);
                    if (typeof showToast === 'function') {
                        showToast('Unexpected error adding outfitFormID entry', '#f97316');
                    }
                }
                return;
            }

            if (section === 'blacklistedOutfitsFromORefit' || section === 'outfitsForceRefit') {
                const outfitNameRaw = outfitNameInput ? outfitNameInput.value.trim() : '';

                if (!outfitNameRaw) {
                    if (typeof showToast === 'function') {
                        showToast('Outfit name is required.', '#f97316');
                    }
                    return;
                }

                const targetSectionKey = section;

                try {
                    if (!Array.isArray(masterJsonData[targetSectionKey])) {
                        masterJsonData[targetSectionKey] = [];
                    }
                    const list = masterJsonData[targetSectionKey];
                    if (!list.includes(outfitNameRaw)) {
                        list.push(outfitNameRaw);
                    }

                    let hadServerError = false;

                    const logType =
                        targetSectionKey === 'blacklistedOutfitsFromORefit'
                            ? 'blacklistedOutfitsFromORefit_entry'
                            : 'outfitsForceRefit_entry';

                    const response = await fetch(`${BASE_URL}/save-master-json`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            content: JSON.stringify(masterJsonData, null, 4),
                            logAction: 'add_element',
                            logSection: targetSectionKey,
                            logType: logType,
                            logOutfitName: outfitNameRaw,
                            logValues: list
                        })
                    });

                    let data = null;
                    try {
                        data = await response.json();
                    } catch (parseError) {
                        console.error('Error parsing save-master-json response (outfit add_element):', parseError);
                    }

                    if (!response.ok || (data && data.status && data.status !== 'success')) {
                        hadServerError = true;
                    }

                    try {
                        const logTypeEvent =
                            targetSectionKey === 'blacklistedOutfitsFromORefit'
                                ? 'blacklistedOutfitsFromORefit_entry'
                                : 'outfitsForceRefit_entry';

                        await fetch(`${BASE_URL}/log-json-event`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                action: 'add_element',
                                section: targetSectionKey,
                                type: logTypeEvent,
                                outfitName: outfitNameRaw,
                                values: list,
                                message: 'Element added from JSON Modificador Key Elements Addons'
                            })
                        });
                    } catch (logError) {
                        console.error('Error logging JSON add event (outfit):', logError);
                    }

                    if (typeof showToast === 'function') {
                        if (!hadServerError) {
                            showToast(`Entry added to ${targetSectionKey} for "${outfitNameRaw}"`, '#10b981');
                        } else {
                            showToast('Entry added, but there was an error saving JSON', '#f97316');
                        }
                    }

                    if (!hadServerError) {
                        if (outfitNameInput) outfitNameInput.value = '';
                        if (selectedPresetsArea) selectedPresetsArea.value = '';

                        if (typeof playReloadSound === 'function') {
                            playReloadSound();
                        }

                        closeJsonFavoritesModal();

                        const loadMasterJsonBtn = document.getElementById('loadMasterJson');
                        if (loadMasterJsonBtn) {
                            setTimeout(() => {
                                loadMasterJsonBtn.click();
                            }, 800);
                        }
                    }
                } catch (error) {
                    console.error('Error adding outfit entry:', error);
                    if (typeof showToast === 'function') {
                        showToast('Unexpected error adding outfit entry', '#f97316');
                    }
                }
                return;
            }

            if (section === 'blacklistedOutfitsFromORefitPlugin') {
                const pluginValueRaw = pluginInput ? pluginInput.value.trim() : '';

                if (!pluginValueRaw) {
                    if (typeof showToast === 'function') {
                        showToast('Plugin name is required.', '#f97316');
                    }
                    return;
                }

                const targetSectionKey = 'blacklistedOutfitsFromORefitPlugin';

                try {
                    if (!Array.isArray(masterJsonData[targetSectionKey])) {
                        masterJsonData[targetSectionKey] = [];
                    }
                    const list = masterJsonData[targetSectionKey];
                    if (!list.includes(pluginValueRaw)) {
                        list.push(pluginValueRaw);
                    }

                    let hadServerError = false;

                    const response = await fetch(`${BASE_URL}/save-master-json`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            content: JSON.stringify(masterJsonData, null, 4),
                            logAction: 'add_element',
                            logSection: targetSectionKey,
                            logType: 'blacklistedOutfitsFromORefitPlugin_entry',
                            logPlugin: pluginValueRaw,
                            logValues: list
                        })
                    });

                    let data = null;
                    try {
                        data = await response.json();
                    } catch (parseError) {
                        console.error(
                            'Error parsing save-master-json response (blacklistedOutfitsFromORefitPlugin add_element):',
                            parseError
                        );
                    }

                    if (!response.ok || (data && data.status && data.status !== 'success')) {
                        hadServerError = true;
                    }

                    try {
                        await fetch(`${BASE_URL}/log-json-event`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                action: 'add_element',
                                section: targetSectionKey,
                                type: 'blacklistedOutfitsFromORefitPlugin_entry',
                                plugin: pluginValueRaw,
                                values: list,
                                message: 'Element added from JSON Modificador Key Elements Addons'
                            })
                        });
                    } catch (logError) {
                        console.error(
                            'Error logging JSON add event (blacklistedOutfitsFromORefitPlugin):',
                            logError
                        );
                    }

                    if (typeof showToast === 'function') {
                        if (!hadServerError) {
                            showToast(
                                `Entry added to ${targetSectionKey} for "${pluginValueRaw}"`,
                                '#10b981'
                            );
                        } else {
                            showToast('Entry added, but there was an error saving JSON', '#f97316');
                        }
                    }

                    if (!hadServerError) {
                        if (pluginInput) pluginInput.value = '';
                        if (selectedPresetsArea) selectedPresetsArea.value = '';

                        if (typeof playReloadSound === 'function') {
                            playReloadSound();
                        }

                        closeJsonFavoritesModal();

                        const loadMasterJsonBtn = document.getElementById('loadMasterJson');
                        if (loadMasterJsonBtn) {
                            setTimeout(() => {
                                loadMasterJsonBtn.click();
                            }, 800);
                        }
                    }
                } catch (error) {
                    console.error('Error adding blacklistedOutfitsFromORefitPlugin entry:', error);
                    if (typeof showToast === 'function') {
                        showToast(
                            'Unexpected error adding blacklistedOutfitsFromORefitPlugin entry',
                            '#f97316'
                        );
                    }
                }
                return;
            }

            if (section === 'blacklistedNpcs') {
                const nameRaw = npcNameInput ? npcNameInput.value.trim() : '';
                if (!nameRaw) {
                    if (typeof showToast === 'function') {
                        showToast('NPC name is required.', '#f97316');
                    }
                    return;
                }

                const targetSectionKey = 'blacklistedNpcs';

                try {
                    if (!Array.isArray(masterJsonData[targetSectionKey])) {
                        masterJsonData[targetSectionKey] = [];
                    }
                    const list = masterJsonData[targetSectionKey];
                    if (!list.includes(nameRaw)) {
                        list.push(nameRaw);
                    }

                    let hadServerError = false;

                    const response = await fetch(`${BASE_URL}/save-master-json`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            content: JSON.stringify(masterJsonData, null, 4),
                            logAction: 'add_element',
                            logSection: targetSectionKey,
                            logType: 'blacklistedNpc_entry',
                            logNpcName: nameRaw,
                            logValues: list
                        })
                    });

                    let data = null;
                    try {
                        data = await response.json();
                    } catch (parseError) {
                        console.error('Error parsing save-master-json response (blacklistedNpcs add_element):', parseError);
                    }

                    if (!response.ok || (data && data.status && data.status !== 'success')) {
                        hadServerError = true;
                    }

                    try {
                        await fetch(`${BASE_URL}/log-json-event`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                action: 'add_element',
                                section: targetSectionKey,
                                type: 'blacklistedNpc_entry',
                                npcName: nameRaw,
                                values: list,
                                message: 'Element added from JSON Modificador Key Elements Addons'
                            })
                        });
                    } catch (logError) {
                        console.error('Error logging JSON add event (blacklistedNpcs):', logError);
                    }

                    if (typeof showToast === 'function') {
                        if (!hadServerError) {
                            showToast(`Entry added to blacklistedNpcs for "${nameRaw}"`, '#10b981');
                        } else {
                            showToast('Entry added, but there was an error saving JSON', '#f97316');
                        }
                    }

                    if (!hadServerError) {
                        if (npcNameInput) npcNameInput.value = '';
                        if (selectedPresetsArea) selectedPresetsArea.value = '';

                        if (typeof playReloadSound === 'function') {
                            playReloadSound();
                        }

                        closeJsonFavoritesModal();

                        const loadMasterJsonBtn = document.getElementById('loadMasterJson');
                        if (loadMasterJsonBtn) {
                            setTimeout(() => {
                                loadMasterJsonBtn.click();
                            }, 800);
                        }
                    }
                } catch (error) {
                    console.error('Error adding blacklistedNpcs entry:', error);
                    if (typeof showToast === 'function') {
                        showToast('Unexpected error adding blacklistedNpcs entry', '#f97316');
                    }
                }
                return;
            }

            if (section === 'blacklistedNpcsFormID') {
                const pluginValueRaw = pluginInput ? pluginInput.value.trim() : '';
                const formIdRaw = formIdInput ? formIdInput.value.trim() : '';

                if (!pluginValueRaw || !formIdRaw) {
                    if (typeof showToast === 'function') {
                        showToast('Plugin and FormID are required.', '#f97316');
                    }
                    return;
                }

                const pluginValue = pluginValueRaw;
                let formIdValue = formIdRaw.replace(/^0x/i, '').trim();
                if (!formIdValue) {
                    if (typeof showToast === 'function') {
                        showToast('Invalid FormID.', '#f97316');
                    }
                    return;
                }

                const targetSectionKey = 'blacklistedNpcsFormID';

                try {
                    if (!masterJsonData[targetSectionKey] || typeof masterJsonData[targetSectionKey] !== 'object') {
                        masterJsonData[targetSectionKey] = {};
                    }
                    const blacklistSection = masterJsonData[targetSectionKey];
                    if (!Array.isArray(blacklistSection[pluginValue])) {
                        blacklistSection[pluginValue] = [formIdValue];
                    } else if (!blacklistSection[pluginValue].includes(formIdValue)) {
                        blacklistSection[pluginValue].push(formIdValue);
                    }

                    let hadServerError = false;

                    const response = await fetch(`${BASE_URL}/save-master-json`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            content: JSON.stringify(masterJsonData, null, 4),
                            logAction: 'add_element',
                            logSection: targetSectionKey,
                            logType: 'blacklistedNpcsFormID_entry',
                            logPlugin: pluginValue,
                            logFormId: formIdValue,
                            logFormIds: blacklistSection[pluginValue]
                        })
                    });

                    let data = null;
                    try {
                        data = await response.json();
                    } catch (parseError) {
                        console.error('Error parsing save-master-json response (blacklistedNpcsFormID add_element):', parseError);
                    }

                    if (!response.ok || (data && data.status && data.status !== 'success')) {
                        hadServerError = true;
                    }

                    try {
                        await fetch(`${BASE_URL}/log-json-event`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                action: 'add_element',
                                section: targetSectionKey,
                                type: 'blacklistedNpcsFormID_entry',
                                plugin: pluginValue,
                                formId: formIdValue,
                                formIds: blacklistSection[pluginValue],
                                message: 'Element added from JSON Modificador Key Elements Addons'
                            })
                        });
                    } catch (logError) {
                        console.error('Error logging JSON add event (blacklistedNpcsFormID):', logError);
                    }

                    if (typeof showToast === 'function') {
                        if (!hadServerError) {
                            showToast(`Entry added to blacklistedNpcsFormID for "${pluginValue}"`, '#10b981');
                        } else {
                            showToast('Entry added, but there was an error saving JSON', '#f97316');
                        }
                    }

                    if (!hadServerError) {
                        if (pluginInput) pluginInput.value = '';
                        if (formIdInput) formIdInput.value = '';
                        if (selectedPresetsArea) selectedPresetsArea.value = '';

                        if (typeof playReloadSound === 'function') {
                            playReloadSound();
                        }

                        closeJsonFavoritesModal();

                        const loadMasterJsonBtn = document.getElementById('loadMasterJson');
                        if (loadMasterJsonBtn) {
                            setTimeout(() => {
                                loadMasterJsonBtn.click();
                            }, 800);
                        }
                    }
                } catch (error) {
                    console.error('Error adding blacklistedNpcsFormID entry:', error);
                    if (typeof showToast === 'function') {
                        showToast('Unexpected error adding blacklistedNpcsFormID entry', '#f97316');
                    }
                }
                return;
            }

            if (section === 'blacklistedNpcsPluginFemale' || section === 'blacklistedNpcsPluginMale') {
                const pluginValueRaw = pluginInput ? pluginInput.value.trim() : '';
                if (!pluginValueRaw) {
                    if (typeof showToast === 'function') {
                        showToast('Plugin name is required.', '#f97316');
                    }
                    return;
                }

                const targetSectionKey = section;

                try {
                    if (!Array.isArray(masterJsonData[targetSectionKey])) {
                        masterJsonData[targetSectionKey] = [];
                    }
                    const list = masterJsonData[targetSectionKey];
                    if (!list.includes(pluginValueRaw)) {
                        list.push(pluginValueRaw);
                    }

                    let hadServerError = false;

                    const response = await fetch(`${BASE_URL}/save-master-json`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            content: JSON.stringify(masterJsonData, null, 4),
                            logAction: 'add_element',
                            logSection: targetSectionKey,
                            logType: 'blacklistedNpcPlugin_entry',
                            logPlugin: pluginValueRaw,
                            logValues: list
                        })
                    });

                    let data = null;
                    try {
                        data = await response.json();
                    } catch (parseError) {
                        console.error('Error parsing save-master-json response (blacklistedNpcsPlugin add_element):', parseError);
                    }

                    if (!response.ok || (data && data.status && data.status !== 'success')) {
                        hadServerError = true;
                    }

                    try {
                        await fetch(`${BASE_URL}/log-json-event`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                action: 'add_element',
                                section: targetSectionKey,
                                type: 'blacklistedNpcPlugin_entry',
                                plugin: pluginValueRaw,
                                values: list,
                                message: 'Element added from JSON Modificador Key Elements Addons'
                            })
                        });
                    } catch (logError) {
                        console.error('Error logging JSON add event (blacklistedNpcsPlugin):', logError);
                    }

                    if (typeof showToast === 'function') {
                        if (!hadServerError) {
                            showToast(`Entry added to ${targetSectionKey} for "${pluginValueRaw}"`, '#10b981');
                        } else {
                            showToast('Entry added, but there was an error saving JSON', '#f97316');
                        }
                    }

                    if (!hadServerError) {
                        if (pluginInput) pluginInput.value = '';
                        if (selectedPresetsArea) selectedPresetsArea.value = '';

                        if (typeof playReloadSound === 'function') {
                            playReloadSound();
                        }

                        closeJsonFavoritesModal();

                        const loadMasterJsonBtn = document.getElementById('loadMasterJson');
                        if (loadMasterJsonBtn) {
                            setTimeout(() => {
                                loadMasterJsonBtn.click();
                            }, 800);
                        }
                    }
                } catch (error) {
                    console.error('Error adding blacklistedNpcsPlugin entry:', error);
                    if (typeof showToast === 'function') {
                        showToast('Unexpected error adding blacklistedNpcsPlugin entry', '#f97316');
                    }
                }
                return;
            }

            if (section === 'blacklistedPresetsFromRandomDistribution') {
                if (presets.length === 0) {
                    if (typeof showToast === 'function') {
                        showToast('At least one preset is required.', '#f97316');
                    }
                    return;
                }

                const targetSectionKey = 'blacklistedPresetsFromRandomDistribution';

                try {
                    if (!Array.isArray(masterJsonData[targetSectionKey])) {
                        masterJsonData[targetSectionKey] = [];
                    }
                    const list = masterJsonData[targetSectionKey];
                    presets.forEach(presetName => {
                        if (!list.includes(presetName)) {
                            list.push(presetName);
                        }
                    });

                    let hadServerError = false;

                    const response = await fetch(`${BASE_URL}/save-master-json`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            content: JSON.stringify(masterJsonData, null, 4),
                            logAction: 'add_element',
                            logSection: targetSectionKey,
                            logType: 'blacklistedPresetsFromRandomDistribution_entry',
                            logValues: list,
                            logAddedPresets: presets
                        })
                    });

                    let data = null;
                    try {
                        data = await response.json();
                    } catch (parseError) {
                        console.error(
                            'Error parsing save-master-json response (blacklistedPresetsFromRandomDistribution add_element):',
                            parseError
                        );
                    }

                    if (!response.ok || (data && data.status && data.status !== 'success')) {
                        hadServerError = true;
                    }

                    try {
                        await fetch(`${BASE_URL}/log-json-event`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                action: 'add_element',
                                section: targetSectionKey,
                                type: 'blacklistedPresetsFromRandomDistribution_entry',
                                values: list,
                                addedPresets: presets,
                                message: 'Element added from JSON Modificador Key Elements Addons'
                            })
                        });
                    } catch (logError) {
                        console.error(
                            'Error logging JSON add event (blacklistedPresetsFromRandomDistribution):',
                            logError
                        );
                    }

                    if (typeof showToast === 'function') {
                        if (!hadServerError) {
                            showToast(
                                `Entries added to ${targetSectionKey} (${presets.length} presets)`,
                                '#10b981'
                            );
                        } else {
                            showToast('Entry added, but there was an error saving JSON', '#f97316');
                        }
                    }

                    if (!hadServerError) {
                        if (selectedPresetsArea) selectedPresetsArea.value = '';

                        if (typeof playReloadSound === 'function') {
                            playReloadSound();
                        }

                        closeJsonFavoritesModal();

                        const loadMasterJsonBtn = document.getElementById('loadMasterJson');
                        if (loadMasterJsonBtn) {
                            setTimeout(() => {
                                loadMasterJsonBtn.click();
                            }, 800);
                        }
                    }
                } catch (error) {
                    console.error(
                        'Error adding blacklistedPresetsFromRandomDistribution entry:',
                        error
                    );
                    if (typeof showToast === 'function') {
                        showToast(
                            'Unexpected error adding blacklistedPresetsFromRandomDistribution entry',
                            '#f97316'
                        );
                    }
                }
                return;
            }

            if (section === 'blacklistedPresetsShowInOBodyMenu') {
                const stateSelect = document.getElementById('jsonFavoritosStateSelect');
                const rawState = stateSelect ? stateSelect.value.trim().toLowerCase() : '';

                if (!rawState) {
                    if (typeof showToast === 'function') {
                        showToast('State is required (true or false).', '#f97316');
                    }
                    return;
                }

                let stateValue;
                if (['true', '1', 'yes', 'y'].includes(rawState)) {
                    stateValue = true;
                } else if (['false', '0', 'no', 'n'].includes(rawState)) {
                    stateValue = false;
                } else {
                    if (typeof showToast === 'function') {
                        showToast('Invalid state. Use true or false.', '#f97316');
                    }
                    return;
                }

                const targetSectionKey = 'blacklistedPresetsShowInOBodyMenu';

                try {
                    masterJsonData[targetSectionKey] = stateValue;

                    let hadServerError = false;

                    const response = await fetch(`${BASE_URL}/save-master-json`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            content: JSON.stringify(masterJsonData, null, 4),
                            logAction: 'add_element',
                            logSection: targetSectionKey,
                            logType: 'blacklistedPresetsShowInOBodyMenu_entry',
                            logState: stateValue
                        })
                    });

                    let data = null;
                    try {
                        data = await response.json();
                    } catch (parseError) {
                        console.error(
                            'Error parsing save-master-json response (blacklistedPresetsShowInOBodyMenu add_element):',
                            parseError
                        );
                    }

                    if (!response.ok || (data && data.status && data.status !== 'success')) {
                        hadServerError = true;
                    }

                    try {
                        await fetch(`${BASE_URL}/log-json-event`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                action: 'add_element',
                                section: targetSectionKey,
                                type: 'blacklistedPresetsShowInOBodyMenu_entry',
                                state: stateValue,
                                message: 'Element added from JSON Modificador Key Elements Addons'
                            })
                        });
                    } catch (logError) {
                        console.error(
                            'Error logging JSON add event (blacklistedPresetsShowInOBodyMenu):',
                            logError
                        );
                    }

                    if (typeof showToast === 'function') {
                        if (!hadServerError) {
                            showToast(
                                `State set for ${targetSectionKey} to ${stateValue ? 'true' : 'false'}`,
                                '#10b981'
                            );
                        } else {
                            showToast('Entry added, but there was an error saving JSON', '#f97316');
                        }
                    }

                    if (!hadServerError) {
                        if (selectedPresetsArea) selectedPresetsArea.value = '';

                        if (typeof playReloadSound === 'function') {
                            playReloadSound();
                        }

                        closeJsonFavoritesModal();

                        const loadMasterJsonBtn = document.getElementById('loadMasterJson');
                        if (loadMasterJsonBtn) {
                            setTimeout(() => {
                                loadMasterJsonBtn.click();
                            }, 800);
                        }
                    }
                } catch (error) {
                    console.error(
                        'Error adding blacklistedPresetsShowInOBodyMenu entry:',
                        error
                    );
                    if (typeof showToast === 'function') {
                        showToast(
                            'Unexpected error adding blacklistedPresetsShowInOBodyMenu entry',
                            '#f97316'
                        );
                    }
                }
                return;
            }

            if (section === 'blacklistedRacesFemale' || section === 'blacklistedRacesMale') {
                let raceKey = '';
                if (raceSelect) {
                    const val = raceSelect.value;
                    if (val === 'custom') {
                        raceKey = raceCustomInput ? raceCustomInput.value.trim() : '';
                    } else {
                        raceKey = val;
                    }
                } else if (raceCustomInput) {
                    raceKey = raceCustomInput.value.trim();
                }

                if (!raceKey) {
                    if (typeof showToast === 'function') {
                        showToast('Race is required.', '#f97316');
                    }
                    return;
                }

                const targetSectionKey = section;

                try {
                    if (!Array.isArray(masterJsonData[targetSectionKey])) {
                        masterJsonData[targetSectionKey] = [];
                    }
                    const list = masterJsonData[targetSectionKey];
                    if (!list.includes(raceKey)) {
                        list.push(raceKey);
                    }

                    let hadServerError = false;

                    const response = await fetch(`${BASE_URL}/save-master-json`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            content: JSON.stringify(masterJsonData, null, 4),
                            logAction: 'add_element',
                            logSection: targetSectionKey,
                            logType: 'blacklistedRace_entry',
                            logRace: raceKey,
                            logValues: list
                        })
                    });

                    let data = null;
                    try {
                        data = await response.json();
                    } catch (parseError) {
                        console.error('Error parsing save-master-json response (blacklistedRaces add_element):', parseError);
                    }

                    if (!response.ok || (data && data.status && data.status !== 'success')) {
                        hadServerError = true;
                    }

                    try {
                        await fetch(`${BASE_URL}/log-json-event`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                action: 'add_element',
                                section: targetSectionKey,
                                type: 'blacklistedRace_entry',
                                race: raceKey,
                                values: list,
                                message: 'Element added from JSON Modificador Key Elements Addons'
                            })
                        });
                    } catch (logError) {
                        console.error('Error logging JSON add event (blacklistedRaces):', logError);
                    }

                    if (typeof showToast === 'function') {
                        if (!hadServerError) {
                            showToast(`Entry added to ${targetSectionKey} for "${raceKey}"`, '#10b981');
                        } else {
                            showToast('Entry added, but there was an error saving JSON', '#f97316');
                        }
                    }

                    if (!hadServerError) {
                        if (raceSelect) raceSelect.value = '';
                        if (raceCustomInput) {
                            raceCustomInput.value = '';
                            raceCustomInput.style.display = 'none';
                            raceCustomInput.disabled = true;
                        }
                        if (selectedPresetsArea) selectedPresetsArea.value = '';

                        if (typeof playReloadSound === 'function') {
                            playReloadSound();
                        }

                        closeJsonFavoritesModal();

                        const loadMasterJsonBtn = document.getElementById('loadMasterJson');
                        if (loadMasterJsonBtn) {
                            setTimeout(() => {
                                loadMasterJsonBtn.click();
                            }, 800);
                        }
                    }
                } catch (error) {
                    console.error('Error adding blacklistedRaces entry:', error);
                    if (typeof showToast === 'function') {
                        showToast('Unexpected error adding blacklistedRaces entry', '#f97316');
                    }
                }
                return;
            }

            if (typeof showToast === 'function') {
                showToast('Add key is not configured for this section.', '#f97316');
            }
        });
    }

    // Add event listener for direct editing of generated rules
    const generatedRuleEl = document.getElementById('generatedRule');
    if (generatedRuleEl) {
        generatedRuleEl.addEventListener('input', () => {
            hasLocalGeneratedRulesEdits = true;
            saveGeneratedRules();
        });

        // Auto-save every second when mouse is over the element
        let autoSaveInterval;
        generatedRuleEl.addEventListener('mouseenter', () => {
            autoSaveInterval = setInterval(saveGeneratedRules, 1000);
        });
        generatedRuleEl.addEventListener('mouseleave', () => {
            if (autoSaveInterval) {
                clearInterval(autoSaveInterval);
                autoSaveInterval = null;
            }
        });
    }
    async function saveGeneratedRules() {
        const generatedRuleEl = document.getElementById('generatedRule');
        if (!generatedRuleEl) return;

        const rules = generatedRuleEl.innerText.trim();

        try {
            const response = await fetch(`${BASE_URL}/save-generated-rules`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rules: rules })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            if (result.status === 'success') {
                console.log('Generated rules saved successfully!');
            } else {
                console.error('Failed to save generated rules:', result.message);
            }
        } catch (error) {
            console.error('Error saving generated rules:', error);
        }
    }

    async function saveRuleCopy(rules, button) {
        try {
            const response = await fetch(`${BASE_URL}/save-rule-copy`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    rules: rules
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            if (result.status === 'success') {
                showFeedback(button, '✓ Copy saved!', '#10b981');
            } else {
                showFeedback(button, '❌ Save failed', '#ef4444');
            }
        } catch (error) {
            console.error('Error saving rule copy:', error);
            showFeedback(button, '❌ Error', '#ef4444');
        }
    }

    // Styles Headers Functions
    async function retryFetch(url, options, maxRetries = 3, delay = 1000) {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const response = await fetch(url, options);
                const data = await response.json();
                if (data.status === 'success') {
                    return data;
                } else {
                    throw new Error('Server error');
                }
            } catch (error) {
                console.error(`Attempt ${attempt} failed:`, error);
                if (attempt === maxRetries) {
                    throw error;
                }
                await new Promise(resolve => setTimeout(resolve, delay * attempt)); // exponential backoff
            }
        }
    }



    // Web Configuration Functions
    async function loadWebConfig() {
        try {
            const response = await fetch(`${BASE_URL}/load-web-config`);
            if (!response.ok) throw new Error('HTTP ' + response.status);
            const result = await response.json();
            if (result.status === 'success') {
                const config = result.data || {};
                const visibleTabs = config.visibleTabs || {
                    "tab-indice": true,
                    "tab-ini-generator": true,
                    "tab-dynamic": true,
                    "tab-skynet": true,
                    "tab-chim": true,
                    "tab-memorias": true,
                    "tab-configuraciones": true
                };
                // Set checkboxes based on visibleTabs
                document.getElementById('showIndex').checked = visibleTabs["tab-indice"] !== false;
                document.getElementById('showIniGenerator').checked = visibleTabs["tab-ini-generator"] !== false;
                document.getElementById('showDynamic').checked = visibleTabs["tab-dynamic"] !== false;
                document.getElementById('showSkynet').checked = visibleTabs["tab-skynet"] !== false;
                document.getElementById('showChim').checked = visibleTabs["tab-chim"] !== false;
                document.getElementById('showMemorias').checked = visibleTabs["tab-memorias"] !== false;
                applyWebConfig(config);
            }
        } catch (error) {
            console.error('Error loading web config:', error);
        }
    }

    function applyWebConfig(config) {
        const visibleTabs = config.visibleTabs || {
            "tab-indice": true,
            "tab-ini-generator": true,
            "tab-dynamic": true,
            "tab-skynet": true,
            "tab-chim": true,
            "tab-memorias": true,
            "tab-configuraciones": true
        };
    
        visibleTabs["tab-news"] = document.getElementById('showNews').checked !== false;
    
        // Ensure tab-configuraciones is always visible
        visibleTabs["tab-configuraciones"] = true;
    
        const tabMappings = {
            "tab-indice": 'tab-indice',
            "tab-ini-generator": 'tab-ini-generator',
            "tab-dynamic": 'submenu-dynamic', // Map tab-dynamic to submenu-dynamic
            "tab-skynet": 'tab-skynet',
            "tab-chim": 'tab-chim',
            "tab-memorias": 'tab-memorias',
            "tab-configuraciones": 'tab-configuraciones',
            "tab-news": 'tab-news'
        };

        Object.keys(visibleTabs).forEach(tabKey => {
            const actualTabId = tabMappings[tabKey];
            const tabButton = document.querySelector(`button[data-target="${actualTabId}"]`);
            const tabSection = document.getElementById(actualTabId);

            if (visibleTabs[tabKey]) {
                if (tabButton) tabButton.style.display = '';
                if (tabSection) tabSection.style.display = '';
            } else {
                if (tabButton) tabButton.style.display = 'none';
                if (tabSection) tabSection.style.display = 'none';
            }
        });
    }

    async function saveWebConfig() {
        const webConfigStatus = document.getElementById('webConfigStatus');
    
        const config = {
            visibleTabs: {
                "tab-indice": document.getElementById('showIndex').checked,
                "tab-ini-generator": document.getElementById('showIniGenerator').checked,
                "tab-dynamic": document.getElementById('showDynamic').checked,
                "tab-skynet": document.getElementById('showSkynet').checked,
                "tab-chim": document.getElementById('showChim').checked,
                "tab-memorias": document.getElementById('showMemorias').checked,
                "tab-news": document.getElementById('showNews').checked !== false,
                "tab-configuraciones": true
            }
        };

        try {
            const response = await fetch(`${BASE_URL}/save-web-config`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({config: config})
            });
            if (!response.ok) throw new Error('HTTP ' + response.status);
            const result = await response.json();
            if (result.status === 'success') {
                webConfigStatus.textContent = 'Tab interface configurations saved to Json/config_web.json';
                webConfigStatus.style.background = 'rgba(16, 185, 129, 0.2)';
                applyWebConfig(config);
            } else {
                webConfigStatus.textContent = 'Save error';
                webConfigStatus.style.background = 'rgba(239, 68, 68, 0.2)';
            }
        } catch (error) {
            console.error('Error:', error);
            webConfigStatus.textContent = 'Connection error';
            webConfigStatus.style.background = 'rgba(239, 68, 68, 0.2)';
        }
    }

    // Event listeners for web config
    const saveWebConfigBtn = document.getElementById('saveWebConfig');
    const resetWebConfigBtn = document.getElementById('resetWebConfig');

    if (saveWebConfigBtn) {
        saveWebConfigBtn.addEventListener('click', saveWebConfig);
    }

    if (resetWebConfigBtn) {
        resetWebConfigBtn.addEventListener('click', () => {
            document.getElementById('showIndex').checked = true;
            document.getElementById('showIniGenerator').checked = true;
            document.getElementById('showDynamic').checked = true;
            document.getElementById('showSkynet').checked = true;
            document.getElementById('showChim').checked = true;
            document.getElementById('showMemorias').checked = true;
            document.getElementById('showNews').checked = true;
            saveWebConfig();
        });
    }

    // Load web config on page load
    loadWebConfig();

    // Add event listeners for checkboxes to auto-save
    ['showIndex', 'showIniGenerator', 'showDynamic', 'showSkynet', 'showChim', 'showMemorias', 'showNews'].forEach(id => {
        const checkbox = document.getElementById(id);
        if (checkbox) {
            checkbox.addEventListener('change', saveWebConfig);
        }
    });
    // Load tab themes from localStorage
    Object.keys(tabNameMap).forEach(tabId => {
        const savedTheme = localStorage.getItem(`tabTheme_${tabId}`) || tabThemeMap[tabId] || 'indice';
        tabThemes[tabId] = savedTheme;
        const tab = document.getElementById(tabId);
        if (tab) applyTabTheme(tabId, savedTheme);
    });
    setTheme(tabThemes['tab-indice'] || 'indice');

    // Theme selector functions
    function getDarkenColor(color) {
        const darkenMap = {
            '#00bcd4': '#0099aa',
            '#08d190': '#06b87a',
            '#e0b867': '#c9a55a',
            '#00e09f': '#00c78a',
            '#ff3d7f': '#e6356f'
        };
        return darkenMap[color] || color;
    }

    function toggleThemeDropdown(tabId) {
        const header = document.querySelector(`#${tabId} header`);
        let dropdown = header.querySelector('.theme-dropdown');

        if (!dropdown) {
            dropdown = document.createElement('div');
            dropdown.className = 'theme-dropdown';
            const buttonsHtml = themes.map(theme => {
                return `<button class="theme-option" data-theme="${theme.id}" style="background: linear-gradient(135deg, ${theme.color}, ${getDarkenColor(theme.color)}); padding-left: 10px;" onclick="event.stopPropagation(); setTabTheme('${tabId}', '${theme.id}');">${theme.name} Style</button>`;
            }).join('');
            dropdown.innerHTML = buttonsHtml;
            header.appendChild(dropdown);
        }

        // Close other dropdowns
        document.querySelectorAll('.theme-dropdown.show').forEach(d => {
            if (d !== dropdown) d.classList.remove('show');
        });

        dropdown.classList.toggle('show');
    }

    function setTabTheme(tabId, themeId) {
        const theme = themes.find(t => t.id === themeId);
        if (!theme) return;
        tabThemes[tabId] = theme.id;
        localStorage.setItem(`tabTheme_${tabId}`, theme.id);
        applyTabTheme(tabId, tabThemes[tabId]);
        setTheme(theme.id);
        // Close dropdown
        const dropdown = document.querySelector(`#${tabId} .theme-dropdown`);
        if (dropdown) dropdown.classList.remove('show');
    }

    function applyTabTheme(tabId, theme) {
        const tab = document.getElementById(tabId);
        if (!tab) return;

        // Remove existing tab theme classes
        const themeClasses = ['theme-indice', 'theme-ini-generator', 'theme-mantella', 'theme-chim', 'theme-skynet', 'theme-ostim'];
        tab.classList.remove(...themeClasses);

        // Add new theme class
        if (theme) {
            tab.classList.add('theme-' + theme);
        }
    }

    // Close dropdowns when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.theme-selector') && !e.target.closest('.theme-dropdown')) {
            document.querySelectorAll('.theme-dropdown.show').forEach(d => d.classList.remove('show'));
        }
    });

    // Make theme functions global for onclick attributes
    window.toggleThemeDropdown = toggleThemeDropdown;
    window.setTabTheme = setTabTheme;

    // Zoom functionality using browser zoom
    const zoomInBtn = document.getElementById('zoomInBtn');
    const zoomOutBtn = document.getElementById('zoomOutBtn');

    if (zoomInBtn) {
        zoomInBtn.addEventListener('click', () => {
            // Use browser's zoom functionality
            document.body.style.zoom = (parseFloat(document.body.style.zoom || 1) + 0.1).toString();
        });
    }

    if (zoomOutBtn) {
        zoomOutBtn.addEventListener('click', () => {
            // Use browser's zoom functionality
            const currentZoom = parseFloat(document.body.style.zoom || 1);
            if (currentZoom > 0.5) {
                document.body.style.zoom = (currentZoom - 0.1).toString();
            }
        });
        
        // Función global para mostrar tooltip de outfit items
        function showTooltip(element, items) {
            hideTooltip(); // ocultar cualquier tooltip existente
            const tooltip = document.createElement('div');
            tooltip.className = 'outfit-tooltip';
            tooltip.innerHTML = items.map(item => `Item: ${item.name} | <strong style="color: var(--primary);">ID: ${item.form_id}</strong>${item.plugin ? ' | Plugin: ' + item.plugin : ''}`).join('<br>');
            document.body.appendChild(tooltip);
        
            // posicionar el tooltip
            const rect = element.getBoundingClientRect();
            tooltip.style.position = 'absolute';
            tooltip.style.left = rect.left + 'px';
            tooltip.style.top = (rect.bottom + 5) + 'px';
            tooltip.style.zIndex = '10000';
        }
        
        // Función para ocultar tooltip
        function hideTooltip() {
            const existing = document.querySelector('.outfit-tooltip');
            if (existing) existing.remove();
        }
    }

    // Preset Sandbox functionality
    function loadSandboxXmlFiles() {
        fetch(`${BASE_URL}/load-log/OBody_NG_Preset_Distribution_Assistant-NG_Doctor.log`)
            .then(response => response.json())
            .then(data => {
                if (data.status === 'success') {
                    parseAndDisplaySandboxXmlFiles(data.content);
                } else {
                    // Fallback to example file if not found in configured paths
                    console.log('Doctor.log not found in configured paths, using example file');
                    fetch(`${BASE_URL}/load-example-doctor-log`)
                        .then(response => response.json())
                        .then(data => {
                            if (data.status === 'success') {
                                parseAndDisplaySandboxXmlFiles(data.content);
                            } else {
                                document.getElementById('sandboxXmlFiles').textContent = 'Error loading XML files list';
                            }
                        })
                        .catch(error => {
                            console.error('Error loading example doctor log:', error);
                            document.getElementById('sandboxXmlFiles').textContent = 'Connection error';
                        });
                }
            })
            .catch(error => {
                console.error('Error loading doctor log from configured paths:', error);
                // Fallback to example file
                fetch(`${BASE_URL}/load-example-doctor-log`)
                    .then(response => response.json())
                    .then(data => {
                        if (data.status === 'success') {
                            parseAndDisplaySandboxXmlFiles(data.content);
                        } else {
                            document.getElementById('sandboxXmlFiles').textContent = 'Error loading XML files list';
                        }
                    })
                    .catch(error => {
                        console.error('Error loading example doctor log:', error);
                        document.getElementById('sandboxXmlFiles').textContent = 'Connection error';
                    });
            });
    }

    function parseAndDisplaySandboxXmlFiles(logContent) {
        const lines = logContent.split('\n');
        const xmlFiles = [];
        let totalFiles = 0;

        let inXmlSection = false;

        for (const line of lines) {
            const trimmed = line.trim();

            if (trimmed.includes('XML FILES FOUND IN SLIDER PRESETS FOLDER:')) {
                inXmlSection = true;
                continue;
            }

            if (trimmed.includes('Total files:')) {
                const match = trimmed.match(/Total files:\s*(\d+)/);
                if (match) {
                    totalFiles = parseInt(match[1]);
                }
                continue;
            }

            if (inXmlSection && trimmed.includes('===================================================')) {
                break;
            }

            if (inXmlSection && trimmed && !trimmed.includes('Total files:') && !trimmed.includes('XML FILES FOUND') && trimmed.endsWith('.xml')) {
                xmlFiles.push(trimmed);
            }
        }

        // Update the total files display
        const headerElement = document.querySelector('#sandboxXmlFiles').closest('.preset-list-card').querySelector('.description');
        if (headerElement) {
            headerElement.textContent = `Total files: ${totalFiles}`;
        }

        displayPresetList('sandboxXmlFiles', xmlFiles);
        setupPresetSearch('sandboxXmlSearch', xmlFiles, 'sandboxXmlFiles');
    }

    function loadSandboxXml() {
        fetch(`${BASE_URL}/load-sandbox-xml`)
            .then(response => response.json())
            .then(data => {
                if (data.status === 'success') {
                    document.getElementById('sandboxXmlContent').value = data.content;
                    // Parse and populate preset info fields
                    parseAndPopulatePresetInfo(data.content);
                } else {
                    document.getElementById('sandboxXmlContent').value = 'Error loading XML file';
                }
            })
            .catch(error => {
                console.error('Error loading sandbox XML:', error);
                document.getElementById('sandboxXmlContent').value = 'Connection error';
            });
    }

    function parseAndPopulatePresetInfo(xmlContent) {
        // Use regex to extract all Preset elements from the XML content
        const presetRegex = /<Preset\s+name="([^"]*)"\s+set="([^"]*)"[^>]*\/>/g;
        const presets = [];
        let match;

        while ((match = presetRegex.exec(xmlContent)) !== null) {
            presets.push({
                name: match[1] || '',
                set: match[2] || ''
            });
        }

        const container = document.getElementById('presetFields');
        container.innerHTML = '';

        // Add total presets info
        const totalPresetsDiv = document.createElement('div');
        totalPresetsDiv.className = 'preset-item-editor';
        totalPresetsDiv.innerHTML = `<p class="description">Total presets: ${presets.length}</p>`;
        container.appendChild(totalPresetsDiv);

        presets.forEach((preset, index) => {
            const presetDiv = document.createElement('div');
            presetDiv.className = 'preset-item-editor';
            presetDiv.innerHTML = `
                <h4>${preset.name || `Preset ${index + 1}`}</h4>
                <div class="control-group">
                    <label class="form-label">Preset name</label>
                    <input type="text" class="form-control preset-name" value="${preset.name}" placeholder="Enter preset name...">
                </div>
                <div class="control-group">
                    <label class="form-label">set</label>
                    <input type="text" class="form-control preset-set" value="${preset.set}" placeholder="Enter set name...">
                </div>
            `;

            container.appendChild(presetDiv);

            // Add real-time update for the title when name changes
            const nameInput = presetDiv.querySelector('.preset-name');
            const h4 = presetDiv.querySelector('h4');
            nameInput.addEventListener('input', function() {
                h4.textContent = this.value.trim() || `Preset ${index + 1}`;
            });
        });
    }

    function updatePresetInfo() {
        const presetDivs = Array.from(document.querySelectorAll('.preset-item-editor')).filter(div => div.querySelector('.preset-name'));
        let allValid = true;

        const presets = [];
        presetDivs.forEach(div => {
            const name = div.querySelector('.preset-name').value.trim();
            const set = div.querySelector('.preset-set').value.trim();

            if (!name || !set) {
                allValid = false;
            } else {
                presets.push({ name, set });
            }
        });

        if (!allValid || presets.length === 0) {
            showToast('Please fill in all fields for all presets', '#ef4444');
            return;
        }

        // Get current XML content and update it using regex
        let currentXml = document.getElementById('sandboxXmlContent').value;

        // Update each preset in the XML string
        presets.forEach((preset, index) => {
            // Find the nth Preset element and update its attributes
            const presetRegex = new RegExp(`(<Preset[^>]*name=")[^"]*("[^>]*set=")[^"]*("[^>]*>)`, 'g');
            let matchCount = 0;

            currentXml = currentXml.replace(presetRegex, (match, beforeName, between, afterSet) => {
                if (matchCount === index) {
                    return `${beforeName}${preset.name}${between}${preset.set}${afterSet}`;
                }
                matchCount++;
                return match;
            });
        });

        document.getElementById('sandboxXmlContent').value = currentXml;
        saveSandboxXml();
        showToast('Preset info updated!', '#10b981');
        const audio = new Audio('Sound/ding-small-bell-sfx.wav');
        audio.play();

        // Update the titles in the preset fields to reflect the new names
        presetDivs.forEach((div, index) => {
            const newName = presets[index].name;
            const h4 = div.querySelector('h4');
            if (h4) {
                h4.textContent = newName || `Preset ${index + 1}`;
            }
        });
    }

    function saveSandboxXml() {
        const content = document.getElementById('sandboxXmlContent').value;
        fetch(`${BASE_URL}/save-sandbox-xml`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: content })
        })
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                console.log('Sandbox XML saved successfully');
                // Update preset fields when XML is saved
                parseAndPopulatePresetInfo(content);
            } else {
                console.error('Failed to save sandbox XML:', data.message);
            }
        })
        .catch(error => {
            console.error('Error saving sandbox XML:', error);
        });
    }

    function restoreSandboxXml() {
        fetch(`${BASE_URL}/restore-sandbox-xml`)
            .then(response => response.json())
            .then(data => {
                if (data.status === 'success') {
                    document.getElementById('sandboxXmlContent').value = data.content;
                    saveSandboxXml(); // Save the restored content
                    parseAndPopulatePresetInfo(data.content); // Update preset fields
                    showToast('XML restored from backup!', '#10b981');
                } else {
                    showToast('Error restoring XML', '#ef4444');
                }
            })
            .catch(error => {
                console.error('Error restoring sandbox XML:', error);
                showToast('Connection error', '#ef4444');
            });
    }

    function loadFilenameMapping() {
        fetch(`${BASE_URL}/load-log/OBody_NG_Preset_Distribution_Assistant-NG_Smart_Cleaning.log`)
            .then(response => response.json())
            .then(data => {
                if (data.status === 'success') {
                    parseAndDisplayFilenameMapping(data.content);
                } else {
                    document.getElementById('filenameMapping').innerHTML = 'Error loading filename mapping';
                }
            })
            .catch(error => {
                console.error('Error loading filename mapping:', error);
                document.getElementById('filenameMapping').innerHTML = 'Connection error';
            });
    }

    function parseAndDisplayFilenameMapping(logContent) {
        const lines = logContent.split('\n');
        const mappings = [];
        let inMappingSection = false;

        for (const line of lines) {
            const trimmed = line.trim();

            if (trimmed.includes('FILENAME TO INTERNAL NAME MAPPING:')) {
                inMappingSection = true;
                continue;
            }

            if (inMappingSection && trimmed.includes('Total mappings:')) {
                break;
            }

            if (inMappingSection && trimmed.startsWith('File:') && trimmed.includes('-> Internal:')) {
                const fileMatch = trimmed.match(/File:\s*(.+)\.xml/);
                const internalMatch = trimmed.match(/-> Internal:\s*(.+)/);

                if (fileMatch && internalMatch) {
                    mappings.push({
                        filename: fileMatch[1] + '.xml',
                        internal: internalMatch[1]
                    });
                }
            }
            
        }

        // Sort mappings alphabetically by filename
        mappings.sort((a, b) => a.filename.localeCompare(b.filename));

        const container = document.getElementById('filenameMapping');
        if (mappings.length === 0) {
            container.innerHTML = '<div class="no-presets">No filename mappings found</div>';
            console.log('No mappings found. Log content preview:', logContent.substring(0, 500));
            return;
        }

        container.innerHTML = mappings.map(mapping =>
            `<div class="mapping-item" onclick="expandMapping('${mapping.filename.replace(/'/g, "\\'")}', '${mapping.internal.replace(/'/g, "\\'")}')" title="Click to expand details">
                <span class="mapping-file">${mapping.filename}</span>
                <span class="mapping-arrow">→</span>
                <span class="mapping-internal">${mapping.internal}</span>
            </div>`
        ).join('');
    }

    function expandMapping(filename, internalName) {
        // Create expanded view
        const expandedDiv = document.createElement('div');
        expandedDiv.className = 'mapping-expanded';
        expandedDiv.innerHTML = `
            <div class="mapping-detail">
                <strong>File:</strong> ${filename}<br>
                <strong>Internal:</strong> ${internalName}
            </div>
        `;

        // Replace the clicked item temporarily
        const clickedItem = event.target.closest('.mapping-item');
        const originalContent = clickedItem.innerHTML;
        clickedItem.innerHTML = expandedDiv.innerHTML;
        clickedItem.classList.add('expanded');

        // Play sound
        const audio = new Audio('Sound/slide_fretboard.wav');
        audio.play();

        // Collapse after 3 seconds
        setTimeout(() => {
            clickedItem.innerHTML = originalContent;
            clickedItem.classList.remove('expanded');
        }, 3000);
    }
    function expandFactions(event) {
        const header = event.target.closest('.factions-header');
        const factionIds = header.dataset.factionIds;

        // Find the click-hint span and replace its text with the faction IDs
        const clickHint = header.querySelector('.click-hint');
        if (clickHint) {
            clickHint.textContent = factionIds;
        }

        // Play sound
        const audio = new Audio('Sound/slide_fretboard.wav');
        audio.play();
    }

    function expandPluginsFactions(event) {
        const header = event.target.closest('.factions-header');
        const factionIds = header.dataset.factionIds;

        // Find the click-hint span and replace its text with the faction IDs
        const clickHint = header.querySelector('.click-hint');
        if (clickHint) {
            clickHint.textContent = factionIds;
        }

        // Play sound
        const audio = new Audio('Sound/slide_fretboard.wav');
        audio.play();
    }

    function highlightXml(xml) {
        // Simple syntax highlighting for XML
        let highlighted = xml;

        // Escape HTML entities
        highlighted = highlighted.replace(/&/g, '&');
        highlighted = highlighted.replace(/</g, '<');
        highlighted = highlighted.replace(/>/g, '>');

        // Highlight XML declarations
        highlighted = highlighted.replace(/(<\?[\w\s=".-]*\?>)/g, '<span style="color: #c678dd;">$1</span>');

        // Highlight tags
        highlighted = highlighted.replace(/(<\/?[\w:-]+[^&]*?>)/g, '<span style="color: #e06c75;">$1</span>');

        // Highlight attributes within tags
        highlighted = highlighted.replace(/(<span style="color: #e06c75;">[^<]*?)(\w+)=("[^"]*")/g, '$1<span style="color: #e5c07b;">$2</span>=<span style="color: #98c379;">$3</span>');

        // Highlight comments
        highlighted = highlighted.replace(/(<!--[\s\S]*?-->)/g, '<span style="color: #5c6370; font-style: italic;">$1</span>');

        return highlighted;
    }

    // Event listeners for sandbox
    const reloadSandboxXmlBtn = document.getElementById('reloadSandboxXml');
    const restoreSandboxXmlBtn = document.getElementById('restoreSandboxXml');
    const updatePresetInfoBtn = document.getElementById('updatePresetInfo');
    const sandboxXmlTextarea = document.getElementById('sandboxXmlContent');

    if (reloadSandboxXmlBtn) {
        reloadSandboxXmlBtn.addEventListener('click', loadSandboxXml);
    }

    if (restoreSandboxXmlBtn) {
        restoreSandboxXmlBtn.addEventListener('click', restoreSandboxXml);
    }

    if (updatePresetInfoBtn) {
        updatePresetInfoBtn.addEventListener('click', updatePresetInfo);
    }

    if (sandboxXmlTextarea) {
        sandboxXmlTextarea.addEventListener('input', () => {
            saveSandboxXml();
            // Update preset fields when XML is manually edited
            parseAndPopulatePresetInfo(sandboxXmlTextarea.value);
        });
    }

    // Load sandbox content when tab is activated
    const chimTab = document.querySelector('button[data-target="tab-chim"]');
    if (chimTab) {
        chimTab.addEventListener('click', () => {
            setTimeout(() => {
                loadFavoritosXML().then(() => {
                    loadSandboxXmlFiles();
                    loadSandboxXml();
                    loadFilenameMapping();
                });
            }, 500);
        });
    }

    function loadMasterJson() {
        const viewer = document.getElementById('masterJsonViewer');
        const modifierContainer = document.getElementById('jsonModifier');
        if (!viewer) return;

        viewer.textContent = 'Loading...';
        viewer.style.color = '#fbbf24';

        fetch(`Json/OBody_presetDistributionConfig.json?ts=${Date.now()}`, { cache: 'no-store' })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }
                return response.text();
            })
            .then(text => {
                const jsonData = JSON.parse(text);
                masterJsonData = jsonData;
                renderJsonTree(jsonData, viewer);
                viewer.style.color = 'var(--text)';
                if (modifierContainer) {
                    initializeJsonModifier(jsonData);
                }
            })
            .catch(error => {
                viewer.textContent = `Error loading JSON: ${error && error.message ? error.message : String(error)}`;
                viewer.style.color = '#ef4444';
            });
    }

    function setMasterJsonBackupsMenuOpen(open) {
        const menu = document.getElementById('masterJsonBackupsMenu');
        if (!menu) return;
        menu.style.display = open ? 'flex' : 'none';
    }

    function isMasterJsonBackupsMenuOpen() {
        const menu = document.getElementById('masterJsonBackupsMenu');
        return !!(menu && menu.style.display !== 'none' && menu.style.display !== '');
    }

    function toggleMasterJsonBackupsMenu() {
        setMasterJsonBackupsMenuOpen(!isMasterJsonBackupsMenuOpen());
    }

    async function refreshMasterJsonBackupsMenu() {
        const menu = document.getElementById('masterJsonBackupsMenu');
        const createBtn = document.getElementById('createMasterJsonBackupBtn');
        if (!menu || !createBtn) return;

        let list = document.getElementById('masterJsonBackupsList');
        if (!list) {
            list = document.createElement('div');
            list.id = 'masterJsonBackupsList';
            menu.appendChild(list);
        }

        while (list.firstChild) {
            list.removeChild(list.firstChild);
        }

        const loadingRow = document.createElement('button');
        loadingRow.type = 'button';
        loadingRow.className = 'dropdown-option';
        loadingRow.disabled = true;
        loadingRow.dataset.backupsEmpty = '1';
        loadingRow.textContent = 'Loading...';
        list.appendChild(loadingRow);

        try {
            const response = await fetch(`${BASE_URL}/list-backups`, { cache: 'no-store' });
            const data = await response.json().catch(() => ({}));
            if (!response.ok || data.status !== 'success') {
                throw new Error((data && data.message) || 'Server error');
            }

            const items = Array.isArray(data.items) ? data.items : [];
            const latest = typeof data.latest === 'string' ? data.latest : null;

            loadingRow.remove();

            if (items.length === 0) {
                const emptyRow = document.createElement('button');
                emptyRow.type = 'button';
                emptyRow.className = 'dropdown-option';
                emptyRow.disabled = true;
                emptyRow.dataset.backupsEmpty = '1';
                emptyRow.textContent = '(No backups found)';
                list.appendChild(emptyRow);
                return;
            }

            for (const item of items) {
                if (!item || typeof item.name !== 'string') continue;
                const isLatest = latest && item.name === latest;

                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'dropdown-option';
                btn.dataset.backupName = item.name;
                btn.textContent = item.name;
                if (isLatest) {
                    btn.style.color = '#10b981';
                }
                btn.addEventListener('click', () => {
                    handleMasterJsonBackupClick(item.name);
                });
                list.appendChild(btn);
            }
        } catch (error) {
            loadingRow.textContent = '(Backups unavailable)';
            if (typeof showToast === 'function') {
                showToast('Error loading backups list', '#ef4444');
            }
        }
    }

    async function handleMasterJsonBackupClick(name) {
        const viewer = document.getElementById('masterJsonViewer');
        if (!viewer || !name) return;

        setMasterJsonBackupsMenuOpen(false);

        try {
            const response = await fetch(`${BASE_URL}/load-backup`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name })
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok || data.status !== 'success') {
                throw new Error((data && data.message) || 'Server error');
            }

            const text = typeof data.content === 'string' ? data.content : '{}';
            const jsonData = JSON.parse(text);
            renderJsonTree(jsonData, viewer);

            const accepted = confirm(
                'Restore this backup and overwrite Json/OBody_presetDistributionConfig.json.\n\n'
                + "That is, in the JSON Configuration Sandbox you'll see the restoration. "
                + 'It will be up to you whether to load that new configuration to the master in the "Update Sandbox to Master JSON 🢁" button.'
            );
            if (!accepted) {
                if (typeof showToast === 'function') {
                    showToast('Restore canceled', '#f97316');
                }
                return;
            }

            const restoreResponse = await fetch(`${BASE_URL}/restore-backup`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name })
            });
            const restoreData = await restoreResponse.json().catch(() => ({}));
            if (!restoreResponse.ok || restoreData.status !== 'success') {
                throw new Error((restoreData && restoreData.message) || 'Server error');
            }

            if (typeof showToast === 'function') {
                showToast('Backup restored', '#10b981');
            }
            loadMasterJson();
            refreshMasterJsonBackupsMenu();
        } catch (error) {
            if (typeof showToast === 'function') {
                showToast('Error loading/restoring backup', '#ef4444');
            }
            loadMasterJson();
        }
    }

    async function createMasterJsonBackup() {
        const btn = document.getElementById('createMasterJsonBackupBtn');
        if (btn) btn.disabled = true;
        try {
            const response = await fetch(`${BASE_URL}/create-backup`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({})
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok || data.status !== 'success') {
                throw new Error((data && data.message) || 'Server error');
            }
            if (typeof showToast === 'function') {
                showToast('Backup created', '#10b981');
            }
            refreshMasterJsonBackupsMenu();
        } catch (error) {
            if (typeof showToast === 'function') {
                showToast('Error creating backup', '#ef4444');
            }
        } finally {
            if (btn) btn.disabled = false;
        }
    }

    async function triggerMasterJsonFlow() {
        if (!isSkyrimConnectedNow()) {
            await playOfflineBlockedSound();
            showSkyrimOfflineToast();
            return;
        }
        const triggerBtn = document.getElementById('triggerMasterJson');
        if (!triggerBtn) return;
        triggerBtn.disabled = true;
        let closeLoadingToast = null;
        try {
            closeLoadingToast = showPersistentLoadingToast('Extracting information from the original master JSON, this may take a few seconds');
            if (typeof playReloadSound === 'function') {
                playReloadSound();
            }
            const response = await fetch(`${BASE_URL}/toggle-act3-start`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({})
            });
            const data = await response.json();
            if (!response.ok || data.status !== 'success') {
                throw new Error('Server error');
            }
            const startTime = Date.now();
            const maxWaitMs = 7000;
            while (Date.now() - startTime < maxWaitMs) {
                await new Promise(resolve => setTimeout(resolve, 500));
                const statusResponse = await fetch(`${BASE_URL}/check-act3-status?ts=${Date.now()}`, {
                    cache: 'no-store'
                });
                if (!statusResponse.ok) {
                    continue;
                }
                const statusData = await statusResponse.json();
                const value = String(statusData.startAct3 || 'false').toLowerCase();
                if (value === 'false') {
                    break;
                }
            }
            await new Promise(resolve => setTimeout(resolve, 2000));
            if (loadMasterJsonBtn) {
                loadMasterJsonBtn.click();
            } else {
                loadMasterJson();
            }
        } catch (error) {
            console.error('Error in triggerMasterJsonFlow:', error);
            if (typeof showToast === 'function') {
                showToast('Error triggering Master JSON', '#ef4444');
            }
        } finally {
            if (typeof closeLoadingToast === 'function') {
                closeLoadingToast();
            }
            triggerBtn.disabled = false;
        }
    }

    function initializeJsonModifier(jsonData) {
        const modifier = document.getElementById('jsonModifier');
        const editorKeys = document.getElementById('jsonModifierEditorKeys');
        const viewer = document.getElementById('jsonModifierViewer');
        const searchInput = document.getElementById('jsonModifierSearch');
        const addBtn = document.getElementById('jsonModifierAddBtn');
        if (!modifier || !editorKeys || !viewer) return;

        const manualToggle = document.getElementById('jsonModifierEnableManualEdit');
        if (manualToggle) {
            manualToggle.onchange = () => {
                syncJsonModifierManualEditUI();
            };
        }
        syncJsonModifierManualEditUI();

        if (addBtn) {
            addBtn.style.display = 'none';
            addBtn.onclick = openJsonFavoritesModal;
        }

        editorKeys.textContent = 'Select a section to load editor';
        viewer.textContent = 'Waiting for editor selection...';

        if (searchInput) {
            searchInput.value = '';
            searchInput.oninput = () => {
                const term = searchInput.value.toLowerCase();
                const editorButtons = editorKeys.querySelectorAll('.json-editor-btn');
                editorButtons.forEach(btn => {
                    const text = btn.textContent.toLowerCase();
                    btn.style.display = text.includes(term) ? '' : 'none';
                });
            };
        }

        const buttons = modifier.querySelectorAll('.json-key-btn');
        buttons.forEach(btn => {
            const key = btn.getAttribute('data-json-key');
            if (!key) return;

            btn.onclick = () => {
                const allBtns = modifier.querySelectorAll('.json-key-btn');
                allBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                clearJsonModifierManualEditor();

                const currentKey = btn.getAttribute('data-json-key');
                currentJsonModifierSection = currentKey || null;

                scrollMasterJsonViewerToKey(currentKey);

                if (!currentKey || !(currentKey in jsonData)) {
                    editorKeys.textContent = 'No elements for this section';
                    viewer.textContent = '';
                    if (addBtn) {
                        addBtn.style.display = 'inline-block';
                    }
                    if (searchInput) {
                        searchInput.value = '';
                    }
                    return;
                }

                const sectionData = jsonData[currentKey];
                setupJsonEditor(currentKey, sectionData, editorKeys, viewer);

                if (searchInput) {
                    searchInput.value = '';
                    const editorButtons = editorKeys.querySelectorAll('.json-editor-btn');
                    editorButtons.forEach(b => {
                        b.style.display = '';
                    });
                }

                if (addBtn) {
                    addBtn.style.display = 'inline-block';
                }
            };
        });
    }

    function isJsonModifierManualEditEnabled() {
        const toggle = document.getElementById('jsonModifierEnableManualEdit');
        return !!(toggle && toggle.checked);
    }

    function getJsonModifierSelectionValue() {
        if (!masterJsonData || !currentJsonModifierSelection) return undefined;
        const { sectionKey, type, elementKey, index } = currentJsonModifierSelection;
        if (!sectionKey || !Object.prototype.hasOwnProperty.call(masterJsonData, sectionKey)) return undefined;

        const sectionData = masterJsonData[sectionKey];
        if (type === 'object') {
            if (!sectionData || typeof sectionData !== 'object' || Array.isArray(sectionData) || !elementKey) return undefined;
            return sectionData[elementKey];
        }
        if (type === 'array') {
            if (!Array.isArray(sectionData) || typeof index !== 'number') return undefined;
            if (index < 0 || index >= sectionData.length) return undefined;
            return sectionData[index];
        }
        if (type === 'single') {
            return sectionData;
        }
        return undefined;
    }

    function populateJsonModifierManualEditorFromSelection() {
        const editor = document.getElementById('jsonModifierManualEditor');
        const saveBtn = document.getElementById('jsonModifierSaveManualBtn');
        if (!editor || !saveBtn) return;

        const value = getJsonModifierSelectionValue();
        if (value === undefined) {
            editor.value = '';
            saveBtn.disabled = true;
            return;
        }

        try {
            editor.value = JSON.stringify(value, null, 4);
        } catch {
            editor.value = String(value);
        }
        saveBtn.disabled = false;
    }

    function syncJsonModifierManualEditUI() {
        const manualArea = document.getElementById('jsonModifierManualArea');
        const editor = document.getElementById('jsonModifierManualEditor');
        const saveBtn = document.getElementById('jsonModifierSaveManualBtn');
        const enabled = isJsonModifierManualEditEnabled();

        if (manualArea) {
            manualArea.style.display = enabled ? 'block' : 'none';
        }

        if (!enabled) {
            if (editor) editor.value = '';
            if (saveBtn) saveBtn.disabled = true;
            return;
        }

        populateJsonModifierManualEditorFromSelection();
    }

    function clearJsonModifierManualEditor() {
        currentJsonModifierSelection = null;
        const editor = document.getElementById('jsonModifierManualEditor');
        const saveBtn = document.getElementById('jsonModifierSaveManualBtn');
        if (editor) {
            editor.value = '';
        }
        if (saveBtn) {
            saveBtn.disabled = true;
        }
    }

    function selectJsonModifierElement(selection, value, viewer) {
        currentJsonModifierSelection = selection || null;

        if (viewer) {
            renderJsonTree(value, viewer);
        }

        if (!isJsonModifierManualEditEnabled()) {
            return;
        }

        populateJsonModifierManualEditorFromSelection();
    }

    async function saveJsonModifierManualChange() {
        const editor = document.getElementById('jsonModifierManualEditor');
        const saveBtn = document.getElementById('jsonModifierSaveManualBtn');
        const keysContainer = document.getElementById('jsonModifierEditorKeys');
        const viewer = document.getElementById('jsonModifierViewer');

        if (!isJsonModifierManualEditEnabled() || !editor || !saveBtn || !masterJsonData || !currentJsonModifierSelection) {
            return;
        }

        const { sectionKey, type, elementKey, index } = currentJsonModifierSelection;
        if (!sectionKey || !Object.prototype.hasOwnProperty.call(masterJsonData, sectionKey)) {
            return;
        }

        let parsedValue;
        try {
            parsedValue = JSON.parse(editor.value);
        } catch (error) {
            if (typeof showToast === 'function') {
                showToast('Does not match a valid structure. You may have forgotten commas or quotes. Be careful, this is very delicate.', '#f97316', 5000);
            }
            return;
        }

        const originalValue = getJsonModifierSelectionValue();
        const originalIsArray = Array.isArray(originalValue);
        const parsedIsArray = Array.isArray(parsedValue);
        const originalIsNull = originalValue === null;
        const parsedIsNull = parsedValue === null;
        const originalType = originalIsNull ? 'null' : (originalIsArray ? 'array' : typeof originalValue);
        const parsedType = parsedIsNull ? 'null' : (parsedIsArray ? 'array' : typeof parsedValue);
        const structureMismatch = originalValue !== undefined && originalType !== parsedType;
        if (structureMismatch) {
            if (typeof showToast === 'function') {
                showToast('Does not match a valid structure. You may have forgotten commas or quotes. Be careful, this is very delicate.', '#f97316', 5000);
            }
            return;
        }

        const sectionData = masterJsonData[sectionKey];
        if (type === 'object' && sectionData && typeof sectionData === 'object' && !Array.isArray(sectionData) && elementKey) {
            sectionData[elementKey] = parsedValue;
        } else if (type === 'array' && Array.isArray(sectionData) && typeof index === 'number') {
            if (index < 0 || index >= sectionData.length) {
                return;
            }
            sectionData[index] = parsedValue;
        } else if (type === 'single') {
            masterJsonData[sectionKey] = parsedValue;
        } else {
            return;
        }

        saveBtn.disabled = true;
        try {
            const response = await fetch(`${BASE_URL}/save-master-json`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    content: JSON.stringify(masterJsonData, null, 4),
                    logAction: 'manual_edit',
                    logSection: sectionKey,
                    logType: type,
                    logElement: type === 'object' ? (elementKey || '') : (type === 'array' ? String(index) : sectionKey)
                })
            });

            let data = null;
            try {
                data = await response.json();
            } catch {}

            const hadServerError = !response.ok || (data && data.status && data.status !== 'success');

            const masterViewer = document.getElementById('masterJsonViewer');
            if (masterViewer) {
                renderJsonTree(masterJsonData, masterViewer);
            }
            if (keysContainer && viewer) {
                setupJsonEditor(sectionKey, masterJsonData[sectionKey], keysContainer, viewer);
                if (type === 'object' && elementKey) {
                    const btn = Array.from(keysContainer.querySelectorAll('.json-editor-btn')).find(b => b.dataset.jsonEditorType === 'object' && b.dataset.jsonEditorKey === elementKey);
                    if (btn) {
                        btn.click();
                    }
                } else if (type === 'array' && typeof index === 'number') {
                    const btn = Array.from(keysContainer.querySelectorAll('.json-editor-btn')).find(b => b.dataset.jsonEditorType === 'array' && Number(b.dataset.jsonEditorIndex) === index);
                    if (btn) {
                        btn.click();
                    }
                }
            }

            if (typeof showToast === 'function') {
                if (!hadServerError) {
                    showToast('Manual change saved', '#10b981');
                } else {
                    showToast('Saved locally, but there was an error saving JSON', '#f97316');
                }
            }

            try {
                await fetch(`${BASE_URL}/log-json-event`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        action: 'manual_edit',
                        section: sectionKey,
                        element: type === 'object' ? (elementKey || '') : (type === 'array' ? String(index) : sectionKey),
                        message: 'Manual edit saved from JSON Modificador'
                    })
                });
            } catch {}
        } catch (error) {
            if (typeof showToast === 'function') {
                showToast('Error saving manual change', '#ef4444');
            }
        } finally {
            saveBtn.disabled = false;
        }
    }

    function setupJsonEditor(sectionKey, sectionData, keysContainer, viewer) {
        keysContainer.innerHTML = '';
        viewer.textContent = 'Waiting for editor selection...';
        clearJsonModifierManualEditor();

        if (sectionData === null || sectionData === undefined) {
            keysContainer.textContent = 'No elements';
            viewer.textContent = '';
            return;
        }

        if (Array.isArray(sectionData)) {
            if (sectionData.length === 0) {
                keysContainer.textContent = 'No elements';
                viewer.textContent = '';
                return;
            }
            sectionData.forEach((item, index) => {
                const btn = document.createElement('button');
                btn.className = 'btn btn-secondary json-editor-btn';
                btn.dataset.jsonEditorType = 'array';
                btn.dataset.jsonEditorIndex = String(index);
                const rawLabel = typeof item === 'string' ? item : `Item ${index + 1}`;
                const label = rawLabel.length > 30 ? rawLabel.slice(0, 27) + '...' : rawLabel;

                const labelSpan = document.createElement('span');
                labelSpan.className = 'json-editor-label';
                labelSpan.textContent = label;

                const deleteSpan = document.createElement('span');
                deleteSpan.className = 'json-editor-delete';
                deleteSpan.textContent = '✖';

                btn.appendChild(labelSpan);
                btn.appendChild(deleteSpan);

                btn.addEventListener('click', () => {
                    selectJsonModifierElement({
                        sectionKey,
                        type: 'array',
                        index
                    }, item, viewer);
                });

                deleteSpan.addEventListener('click', event => {
                    event.stopPropagation();
                    openJsonKeyDeleteModal({
                        sectionKey: sectionKey,
                        type: 'array',
                        index: index,
                        label: rawLabel
                    });
                });

                keysContainer.appendChild(btn);
            });
            return;
        }

        if (typeof sectionData === 'object') {
            const keys = Object.keys(sectionData);
            if (keys.length === 0) {
                keysContainer.textContent = 'No elements';
                viewer.textContent = '';
                return;
            }
            keys.forEach(key => {
                const btn = document.createElement('button');
                btn.className = 'btn btn-secondary json-editor-btn';
                btn.dataset.jsonEditorType = 'object';
                btn.dataset.jsonEditorKey = key;

                const labelSpan = document.createElement('span');
                labelSpan.className = 'json-editor-label';
                labelSpan.textContent = key;

                const deleteSpan = document.createElement('span');
                deleteSpan.className = 'json-editor-delete';
                deleteSpan.textContent = '✖';

                btn.appendChild(labelSpan);
                btn.appendChild(deleteSpan);

                btn.addEventListener('click', () => {
                    selectJsonModifierElement({
                        sectionKey,
                        type: 'object',
                        elementKey: key
                    }, sectionData[key], viewer);
                });

                deleteSpan.addEventListener('click', event => {
                    event.stopPropagation();
                    openJsonKeyDeleteModal({
                        sectionKey: sectionKey,
                        type: 'object',
                        elementKey: key,
                        label: key
                    });
                });

                keysContainer.appendChild(btn);
            });
            return;
        }

        keysContainer.textContent = 'Single value';
        selectJsonModifierElement({
            sectionKey,
            type: 'single'
        }, sectionData, viewer);
    }

    function loadAnalysisLog() {
        const viewer = document.getElementById('analysisLogViewer');
        if (!viewer) return;

        const currentContent = viewer.innerHTML;

        if (!currentContent.trim()) {
            viewer.innerHTML = 'Loading...';
            viewer.style.color = '#fbbf24';
        }

        fetch(`${BASE_URL}/load-analysis-log`)
            .then(response => response.json())
            .then(data => {
                if (data.status === 'success') {
                    const newContent = data.content;

                    const safeContent = newContent
                        .replace(/&/g, '&amp;')
                        .replace(/</g, '&lt;')
                        .replace(/>/g, '&gt;');

                    const keyColorMap = {
                        npcFormID: '#5fa8ff',
                        npc: '#5fa8ff',
                        factionFemale: '#5fa8ff',
                        factionMale: '#5fa8ff',
                        npcPluginFemale: '#5fa8ff',
                        npcPluginMale: '#5fa8ff',
                        raceFemale: '#5fa8ff',
                        raceMale: '#5fa8ff',
                        blacklistedNpcs: '#10b981',
                        blacklistedNpcsFormID: '#10b981',
                        blacklistedNpcsPluginFemale: '#10b981',
                        blacklistedNpcsPluginMale: '#10b981',
                        blacklistedRacesFemale: '#10b981',
                        blacklistedRacesMale: '#10b981',
                        blacklistedPresetsShowInOBodyMenu: '#10b981',
                        blacklistedOutfitsFromORefitFormID: '#f59e0b',
                        blacklistedOutfitsFromORefit: '#f59e0b',
                        blacklistedOutfitsFromORefitPlugin: '#f59e0b',
                        outfitsForceRefitFormID: '#f59e0b',
                        outfitsForceRefit: '#f59e0b',
                        blacklistedPresetsFromRandomDistribution: '#f59e0b',
                        blacklisted: '#10b981',
                        outfits: '#f59e0b'
                    };

                    const processedContent = safeContent.split('\n').map(line => {
                        const lineRuleMatch = line.match(/^(\s*)\[LINE\s+(\d+)\]\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
                        if (lineRuleMatch) {
                            const indent = lineRuleMatch[1] || '';
                            const lineNumber = lineRuleMatch[2];
                            const key = lineRuleMatch[3];
                            const rawValue = lineRuleMatch[4] || '';
                            const keyColor = keyColorMap[key];

                            if (keyColor) {
                                const firstPipe = rawValue.indexOf('|');
                                const lastPipe = rawValue.lastIndexOf('|');

                                let partA = rawValue;
                                let partB = '';
                                let partC = '';
                                let hasPipes = false;

                                if (firstPipe !== -1) {
                                    hasPipes = true;
                                    partA = rawValue.slice(0, firstPipe);
                                    if (lastPipe !== -1 && lastPipe !== firstPipe) {
                                        partB = rawValue.slice(firstPipe + 1, lastPipe);
                                        partC = rawValue.slice(lastPipe + 1);
                                    } else {
                                        partB = rawValue.slice(firstPipe + 1);
                                    }
                                }

                                const prefix = `${indent}<span style="color: #fbbf24;">[LINE</span> <span style="color: #fb923c;">${lineNumber}</span><span style="color: #fbbf24;">]</span> `;
                                const keyHtml = `<span style="color: ${keyColor}; font-weight: 700;">${key}</span>`;
                                const eqHtml = `<span style="color: #cbd5e1;"> = </span>`;

                                if (hasPipes) {
                                    const pipeHtml = `<span style="color: #94a3b8;">|</span>`;
                                    const partAHtml = `<span style="color: #fbbf24;">${partA}</span>`;
                                    const partBHtml = `<span style="color: #00bcd4;">${partB}</span>`;
                                    const partCHtml = `<span style="color: #f59e0b;">${partC}</span>`;
                                    return `${prefix}${keyHtml}${eqHtml}${partAHtml}${pipeHtml}${partBHtml}${pipeHtml}${partCHtml}`;
                                }

                                return `${prefix}${keyHtml}${eqHtml}<span style="color: #fbbf24;">${rawValue}</span>`;
                            }
                        }

                        line = line.replace(/"([^"]*)"/g, '"<span style="color: #ccffcc;">$1</span>"');
                        line = line.replace(/'([^']*)'/g, '\'<span style="color: #ccffcc;">$1</span>\'');
                        line = line.replace(/\b(?:false|False)\b/g, '<span style="color: #ef4444;">$&</span>');
                        line = line.replace(/\b(?:true|True)\b/g, '<span style="color: #10b981;">$&</span>');
                        line = line.replace(/\.ini\b/g, '<span style="color: #00bfff;">$&</span>');
                        line = line.replace(/\.log\b/g, '<span style="color: #00bfff;">$&</span>');
                        line = line.replace(/\.json\b/g, '<span style="color: #00bfff;">$&</span>');
                        line = line.replace(/\.xml\b/g, '<span style="color: #00bfff;">$&</span>');
                        line = line.replace(/\bini\b/gi, '<span style="color: #9932cc;">$&</span>');
                        line = line.replace(/\blog\b/gi, '<span style="color: #9932cc;">$&</span>');
                        line = line.replace(/\bjson\b/gi, '<span style="color: #9932cc;">$&</span>');
                        line = line.replace(/\bxml\b/gi, '<span style="color: #9932cc;">$&</span>');
                        line = line.replace(/\b\d+\b/g, '<span style="color: #ff8c00;">$&</span>');
                        line = line.replace(/\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\]/g,
                            `<span style="color: #fbbf24;">[</span><span style="color: #fb923c;">$1</span><span style="color: #fbbf24;">]</span>`
                        );

                        return line;
                    }).join('\n');

                    viewer.innerHTML = processedContent;
                    viewer.style.color = 'var(--text)';
                } else {
                    if (!currentContent.trim()) {
                        viewer.innerHTML = 'Error loading log file';
                        viewer.style.color = '#ef4444';
                    }
                }
            })
            .catch(error => {
                console.error('Error loading analysis log:', error);
                if (!currentContent.trim()) {
                    viewer.innerHTML = 'Connection error';
                    viewer.style.color = '#ef4444';
                }
            });
    }

    const MASTER_JSON_GREEN_KEYS = [
        'npcFormID',
        'npc',
        'factionFemale',
        'factionMale',
        'npcPluginFemale',
        'npcPluginMale',
        'raceFemale',
        'raceMale',
        'blacklistedNpcs',
        'blacklistedNpcsFormID',
        'blacklistedNpcsPluginFemale',
        'blacklistedNpcsPluginMale',
        'blacklistedRacesFemale',
        'blacklistedRacesMale',
        'blacklistedOutfitsFromORefitFormID',
        'blacklistedOutfitsFromORefit',
        'blacklistedOutfitsFromORefitPlugin',
        'outfitsForceRefitFormID',
        'outfitsForceRefit',
        'blacklistedPresetsFromRandomDistribution',
        'blacklistedPresetsShowInOBodyMenu'
    ];

    function scrollMasterJsonViewerToKey(keyName) {
        if (!keyName) return;

        const viewer = document.getElementById('masterJsonViewer');
        if (!viewer) return;

        const greenKeys = viewer.querySelectorAll('.json-key-green');
        const allKeys = viewer.querySelectorAll('.json-key');

        const matchByText = (nodes) => {
            for (const node of nodes) {
                if (node && node.textContent === keyName) return node;
            }
            return null;
        };

        const target = matchByText(greenKeys) || matchByText(allKeys);
        if (!target) return;

        const viewerRect = viewer.getBoundingClientRect();
        const targetRect = target.getBoundingClientRect();
        const topPaddingPx = 10;
        const desiredTop = (targetRect.top - viewerRect.top) + viewer.scrollTop - topPaddingPx;
        viewer.scrollTo({ top: Math.max(0, desiredTop), behavior: 'smooth' });
    }

    function renderJsonTree(data, container, level = 0) {
        container.innerHTML = '';

        const isMasterViewer = container && container.id === 'masterJsonViewer';

        function createElement(type, className, text) {
            const el = document.createElement(type);
            if (className) el.className = className;
            if (text !== undefined) el.textContent = text;
            return el;
        }

        function createQuotedText(contentClassName, value) {
            const fragment = document.createDocumentFragment();
            fragment.appendChild(createElement('span', 'json-quote', '"'));
            fragment.appendChild(createElement('span', contentClassName, value));
            fragment.appendChild(createElement('span', 'json-quote', '"'));
            return fragment;
        }

        function formatJson(obj, indent = 0) {
            const spaces = '    '.repeat(indent);

            if (obj === null) {
                return createElement('span', 'json-null', 'null');
            }

            if (typeof obj === 'boolean') {
                return createElement('span', 'json-boolean', obj.toString());
            }

            if (typeof obj === 'number') {
                return createElement('span', 'json-number', obj.toString());
            }

            if (typeof obj === 'string') {
                return createQuotedText('json-string', obj);
            }

            if (Array.isArray(obj)) {
                const fragment = document.createDocumentFragment();
                fragment.appendChild(createElement('span', 'json-bracket', '['));

                if (obj.length > 0) {
                    fragment.appendChild(document.createTextNode('\n'));

                    obj.forEach((item, index) => {
                        fragment.appendChild(document.createTextNode(spaces + '    '));
                        fragment.appendChild(formatJson(item, indent + 1));
                        if (index < obj.length - 1) {
                            fragment.appendChild(createElement('span', 'json-comma', ','));
                        }
                        fragment.appendChild(document.createTextNode('\n'));
                    });

                    fragment.appendChild(document.createTextNode(spaces));
                }

                fragment.appendChild(createElement('span', 'json-bracket', ']'));
                return fragment;
            }

            if (typeof obj === 'object') {
                const fragment = document.createDocumentFragment();
                fragment.appendChild(createElement('span', 'json-bracket', '{'));

                const keys = Object.keys(obj);
                if (keys.length > 0) {
                    fragment.appendChild(document.createTextNode('\n'));

                    keys.forEach((key, index) => {
                        fragment.appendChild(document.createTextNode(spaces + '    '));
                        const isTopLevelMasterKey = isMasterViewer && indent === 0 && MASTER_JSON_GREEN_KEYS.indexOf(key) !== -1;
                        const keyClassName = isTopLevelMasterKey ? 'json-key json-key-green' : 'json-key';
                        fragment.appendChild(createQuotedText(keyClassName, key));
                        fragment.appendChild(createElement('span', 'json-colon', ': '));
                        fragment.appendChild(formatJson(obj[key], indent + 1));
                        if (index < keys.length - 1) {
                            fragment.appendChild(createElement('span', 'json-comma', ','));
                        }
                        fragment.appendChild(document.createTextNode('\n'));
                    });

                    fragment.appendChild(document.createTextNode(spaces));
                }

                fragment.appendChild(createElement('span', 'json-bracket', '}'));
                return fragment;
            }
        }

        container.appendChild(formatJson(data));
    }

    let catJsonData = null;
    let catJsonInitialized = false;

    function initializeCatJsonExplanation() {
        if (catJsonInitialized) return;
        const sampleContainer = document.getElementById('catJsonSample');
        const keysList = document.getElementById('catJsonKeysList');
        const explanationEl = document.getElementById('catKeyExplanation');
        const previewEl = document.getElementById('catKeyJsonPreview');
        const selectedKeyPill = document.getElementById('catSelectedKeyPill');

        if (!sampleContainer || !keysList || !explanationEl || !previewEl) return;

        catJsonInitialized = true;

        const updateSelectedKeyPill = (keyName) => {
            if (!selectedKeyPill) return;
            selectedKeyPill.textContent = keyName;
            selectedKeyPill.classList.add('is-visible');
            selectedKeyPill.classList.remove('pulse');
            void selectedKeyPill.offsetWidth;
            selectedKeyPill.classList.add('pulse');
        };

        const scrollCatSampleToKey = (keyName) => {
            if (!keyName) return;
            const keyNodes = sampleContainer.querySelectorAll('.json-key');
            let target = null;
            for (const node of keyNodes) {
                if (node && node.textContent === keyName) {
                    target = node;
                    break;
                }
            }
            if (!target) return;

            const previousHighlights = sampleContainer.querySelectorAll('.cat-json-key-highlight');
            previousHighlights.forEach((el) => el.classList.remove('cat-json-key-highlight'));

            const viewerRect = sampleContainer.getBoundingClientRect();
            const targetRect = target.getBoundingClientRect();
            const topPaddingPx = 10;
            const desiredTop = (targetRect.top - viewerRect.top) + sampleContainer.scrollTop - topPaddingPx;
            sampleContainer.scrollTo({ top: Math.max(0, desiredTop), behavior: 'smooth' });

            target.classList.add('cat-json-key-highlight');
            setTimeout(() => {
                target.classList.remove('cat-json-key-highlight');
            }, 750);
        };

        sampleContainer.textContent = 'Loading example JSON...';

        fetch('Data/OBody_presetDistributionConfig.json')
            .then(response => response.json())
            .then(data => {
                catJsonData = data;
                renderJsonTree(data, sampleContainer);
            })
            .catch(error => {
                console.error('Error loading example JSON for cat tab:', error);
                sampleContainer.textContent = 'Error loading example JSON';
            });

        const keys = [
            'npcFormID',
            'npc',
            'factionFemale',
            'factionMale',
            'npcPluginFemale',
            'npcPluginMale',
            'raceFemale',
            'raceMale',
            'blacklistedNpcs',
            'blacklistedNpcsFormID',
            'blacklistedNpcsPluginFemale',
            'blacklistedNpcsPluginMale',
            'blacklistedRacesFemale',
            'blacklistedRacesMale',
            'blacklistedOutfitsFromORefitFormID',
            'blacklistedOutfitsFromORefit',
            'blacklistedOutfitsFromORefitPlugin',
            'outfitsForceRefitFormID',
            'outfitsForceRefit',
            'blacklistedPresetsFromRandomDistribution',
            'blacklistedPresetsShowInOBodyMenu'
        ];

        keys.forEach(key => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'btn-mini btn-secondary cat-key-btn';
            btn.textContent = key;
            btn.dataset.key = key;
            btn.addEventListener('click', () => {
                const allBtns = keysList.querySelectorAll('.cat-key-btn');
                allBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                updateSelectedKeyPill(key);
                scrollCatSampleToKey(key);

                if (key === 'npcFormID') {
                    explanationEl.innerHTML = 'This is the first rule, and it\'s one of the first that OBody NG reads to apply. <span class="cat-highlight">I personally don\'t recommend it, since it\'s somewhat complicated to add the correct elements and it\'s prone to fail due to how strict it is with ID order (I\'m working on a support system to auto-correct the ID order personalized for each player, I\'ll let you know when it\'s ready).</span> The approach of this rule is to first place the full name of the plugin the NPC belongs to, followed by the FormID, you can obtain this with the PDA MCM, SSEEdit or in the game itself. Then you place the list of presets, it can be one or multiple, chosen from the set of presets you include in it.';
                } else if (key === 'npc') {
                    explanationEl.innerHTML = 'This is the second rule that OBody reads to apply presets. <span class="cat-highlight">This one focuses on applying the NPC\'s name, yes, the name, not the ID, and this name has to be correctly written.</span> For people who play in other languages like Cyrillic, Korean, or other of the <span class="cat-highlight-orange">8 official languages and the unofficial ones</span>, where NPC names are affected by translations, you will have to take that into account. A player had problems because the NPC rule didn\'t work for him, and it was because he used, for example, "<span class="cat-highlight-orange">Serana</span>" and his game was in Cyrillic internally, so the game processes the names as "<span class="cat-highlight-orange">Серана</span>", which is Serana in Cyrillic, and that\'s how it worked. <span class="cat-highlight">Serana is almost the same in all other languages, but in Chinese it changes to "<span class="cat-highlight-orange">瑟拉娜</span>".</span> <span class="cat-highlight">The PDA program is capable of detecting these names.</span> I\'ll create a generic auto-correction library in case of some names, but that will be for next year. <span class="cat-highlight">This requires the full name of the NPC and the presets you decide to apply to it.</span> I recommend using this if you know very well what names the NPCs have and that they haven\'t been modified by languages.';
                } else if (key === 'factionFemale' || key === 'factionMale') {
                    explanationEl.innerHTML = 'Third key that OBody reads. <span class="cat-highlight">The number of factions in the game is ridiculously high; creating a complete list would be very tedious, and there are easily more than 1k.</span> So you can use or search online which faction belongs to which NPC (including in the 🔍 Dynamic Info Extractor NPC Range a display of factions each NPC around belongs to, that can help create rules), and save city NPCs or more, including mod factions. <span class="cat-highlight">It requires the faction name, not the ID, and then the presets you want to apply.</span> This is the same for female and male. I don\'t recommend it much, but it is functional.';
                } else if (key === 'npcPluginFemale' || key === 'npcPluginMale') {
                    explanationEl.innerHTML = '<span class="cat-highlight">My favorite, and the one I use the most when dealing with mod NPCs. This is the best option.</span> First, it is very unlikely for an NPC associated with a plugin to have plugin name variation; the plugin names are always static, so it is a solid way to associate a preset to an NPC: you put the plugin name and directly apply which preset you want to use on the NPCs within that plugin.';
                } else if (key === 'raceFemale' || key === 'raceMale') {
                    explanationEl.innerHTML = '<span class="cat-highlight">Another of my favorites: races.</span> There are the common races, the UBE races, and of course the customizable races. In these rules the list is already there, but you can write whichever you like in the PDA. <span class="cat-highlight">The system can read what race each NPC added to favorites is, and will vary according to which they belong to.</span> It is very rare for this to be affected by translations. In this case, these keys require the race to which they will apply the set of presets, and using a range from one to multiple preset sets; <span class="cat-highlight">don\'t limit yourself to just one, make a closed selection set.</span>';
                } else if (key === 'blacklistedNpcs') {
                    explanationEl.innerHTML = 'Here we start with what isn\'t used much, <span class="cat-highlight">if you\'re a common Skyrim user you probably won\'t need this, but if you\'re already in the modding environment you can use it.</span> OBody reads this not to apply presets, but quite the opposite, <span class="cat-highlight">it\'s to apply nothing to them.</span> Here you require the name, and you must remember the original and full name of the NPC. If it\'s in another language and you have the game in that language, put the name in that language, if it\'s from a mod, put the name that appears in the mod. It\'s simple to follow.';
                } else if (key === 'blacklistedNpcsFormID') {
                    explanationEl.innerHTML = 'Same idea as the previous one, but using IDs. Here you can choose an NPC through the plugin it belongs to and its full ID. <span class="cat-highlight">I don\'t recommend it much due to ID fluctuation between load orders.</span> Once applied, that NPC will no longer appear in the randomization system.';
                } else if (key === 'blacklistedNpcsPluginFemale' || key === 'blacklistedNpcsPluginMale') {
                    explanationEl.innerHTML = 'Again it consists of the plugin, but <span class="cat-highlight">this is one of the most recommended blacklist options.</span> Here you put the name of the plugin you want to ban and that\'s it, no presets will be applied to these NPCs. If you have problems you can use its counterpart in the adding system, npcPlugin. <span class="cat-highlight">There you put the plugin name followed by a single preset, usually <span class="cat-preset-name">"Without Preset PDA"</span>. I created it to apply to NPCs from CBBE/3BA/BHUNP/COtR/etc. so they stay slim by default and you can apply your preset with OBody as you like. This also applies to presets for UBE <span class="cat-preset-name">"-Zeroed Sliders-"</span> and the slim preset for HIMBO <span class="cat-preset-name">"HIMBO Default"</span>. I leave these three as default favorites.</span>';
                } else if (key === 'blacklistedRacesFemale' || key === 'blacklistedRacesMale') {
                    explanationEl.innerHTML = 'You already know the same about races and the list, but here there’s something special… <span class="cat-highlight">these will be filled automatically with presets. Generally those for UBE.</span> This is an option I added to avoid bugs and make the work cleaner. <span class="cat-highlight">This helps prevent some bodies from becoming corrupted.</span> It’s interesting how to add presets here, but applying it above doesn’t delete or block it, rather it <span class="cat-highlight">prevents NPCs that are (CBBE/3BA/BHUNP/COtR/etc.) from accidentally being applied a UBE or HIMBO preset, and in turn it’s not an obstacle for HIMBO and UBE NPCs to have their respective presets applied, since the system I created auto-applies the set of your specific presets to those NPCs, avoiding breakage.</span> It was a long and heavy work, thanks to all the beta testers for the testing.';
                } else if (key === 'blacklistedOutfitsFromORefitFormID') {
                    explanationEl.innerHTML = 'Outfits… here it\'s complicated territory. <span class="cat-highlight">Here you can apply game clothing and prevent them from auto-adjusting, it\'s quite complicated to explain, so I invite you to look on Discord for a user named "Cryshy", he asked me to apply the clothing dynamics in the PDA system, he explained with images and more, but I\'m not an expert in that.</span> What I can explain here is that if for some reason an NPC is UBE and equips UBE clothing, the clothes stick too much to the body and don\'t take physics properly. <span class="cat-highlight">This helps with that.</span> All outfit rules are like this, you can add or remove. In particular, this first one is to leave clothes out of OBody\'s refit, leaving the clothing physics as is, and this is achieved with the plugin name and the equipment ID.';
                } else if (key === 'blacklistedOutfitsFromORefit') {
                    explanationEl.innerHTML = '<span class="cat-highlight">Here it\'s easier: just place the name of the outfit for those you don\'t want to have a refit done on. That simple.</span> So when an NPC puts on the clothing, it won\'t stick to the body but will take the body\'s physics, or something like that. As I already told you, this section is not my specialty because I don\'t use UBE at the moment; I lack money for a better hard drive 😹.';
                } else if (key === 'blacklistedOutfitsFromORefitPlugin') {
                    explanationEl.innerHTML = '<span class="cat-highlight">The same but with clothing plugin name, ok. Plugins that contain clothing, not NPCs, but clothing.</span>';
                } else if (key === 'outfitsForceRefitFormID') {
                    explanationEl.innerHTML = 'And here the opposite, <span class="cat-highlight">this one does do a refit. As I mentioned I\'m not an expert, so I invite you to try it or ask some from the UBE photographer, they know more.</span> I haven\'t installed UBE on my PC yet because I have no memory left, and with how expensive it is, it\'ll be for next year, hahahah. Here they require the plugin name and the exact ID of the armor set. <span class="cat-highlight">I\'ll also work on this to improve it in the automatic ID correction system, to avoid errors, in the future.</span>';
                } else if (key === 'outfitsForceRefit') {
                    explanationEl.innerHTML = 'And here you have to put <span class="cat-highlight">the name of the equipment</span> in the language it is in, ok. Complete.';
                } else if (key === 'blacklistedPresetsFromRandomDistribution') {
                    explanationEl.innerHTML = 'This is <span class="cat-highlight">one of the special ones.</span> Before the PDA existed, you had to manually place all presets that were for UBE or HIMBO here to avoid errors. <span class="cat-highlight">Now the mod does this automatically, so I recommend not touching it, except to add presets you personally consider necessary; it is already self-sufficient now.</span>';
                } else if (key === 'blacklistedPresetsShowInOBodyMenu') {
                    explanationEl.innerHTML = 'Here this value can be true or false, but <span class="cat-highlight">the PDA mod auto-adjusts it to true.</span> Essentially, this will <span class="cat-highlight">make all previous presets that are on the blacklist visible in the game, so with the O you can apply them to NPCs.</span> It is very useful for those using HIMBO and UBE. <span class="cat-highlight">If you use these, do not set this to false. It needs to stay true.</span>';
                } else {
                    explanationEl.textContent = `Explanation for "${key}" coming soon.`;
                }

                if (catJsonData && Object.prototype.hasOwnProperty.call(catJsonData, key)) {
                    renderJsonTree(catJsonData[key], previewEl);
                } else {
                    previewEl.textContent = 'This key is not present in the example JSON.';
                }
            });
            keysList.appendChild(btn);
        });
    }

    window.initializeCatJsonExplanation = initializeCatJsonExplanation;


    function copyAnalysisLog() {
        const viewer = document.getElementById('analysisLogViewer');
        const text = viewer ? (viewer.innerText || viewer.textContent || '') : '';

        if (!viewer || !text.trim()) {
            showToast('❌ No log content to copy', '#ef4444');
            return;
        }

        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(text).then(() => {
                showToast('✓ Analysis log copied to clipboard!', '#10b981');
            }).catch(() => {
                fallbackCopyAnalysisLog(text);
            });
        } else {
            fallbackCopyAnalysisLog(text);
        }
    }

    function fallbackCopyAnalysisLog(text) {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        document.body.appendChild(textarea);
        textarea.select();
        const success = document.execCommand('copy');
        document.body.removeChild(textarea);

        if (success) {
            showToast('✓ Analysis log copied to clipboard!', '#10b981');
        } else {
            showToast('❌ Failed to copy analysis log', '#ef4444');
        }
    }

    // SkyNet event listeners
    const loadMasterJsonBtn = document.getElementById('loadMasterJson');
    const triggerMasterJsonBtn = document.getElementById('triggerMasterJson');
    const masterJsonBackupsToggle = document.getElementById('masterJsonBackupsToggle');
    const createMasterJsonBackupBtn = document.getElementById('createMasterJsonBackupBtn');
    const transferMasterJsonBtn = document.getElementById('transferMasterJson');
    const jsonModifierSaveManualBtn = document.getElementById('jsonModifierSaveManualBtn');
    const loadAnalysisLogBtn = document.getElementById('loadAnalysisLog');
    const copyAnalysisLogBtn = document.getElementById('copyAnalysisLog');
    const expandAnalysisLogBtn = document.getElementById('expandAnalysisLog');
    const confirmJsonKeyDeleteBtn = document.getElementById('confirmJsonKeyDeleteBtn');
    const cancelJsonKeyDeleteBtn = document.getElementById('cancelJsonKeyDeleteBtn');
    const iniWipOverlay = document.getElementById('iniWipOverlay');

    if (iniWipOverlay) {
        const wipMessage = 'WIP: this project configuration table is not completely finished yet.';
        const showWipMessage = () => {
            if (typeof showToast === 'function') {
                showToast(wipMessage, '#3b82f6', 3500);
            }
        };
        iniWipOverlay.addEventListener('click', (event) => {
            if (event) {
                event.preventDefault();
                event.stopPropagation();
            }
            showWipMessage();
        });
        iniWipOverlay.addEventListener('keydown', (event) => {
            if (!event) return;
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                event.stopPropagation();
                showWipMessage();
            }
        });
    }

    if (loadMasterJsonBtn) {
        loadMasterJsonBtn.addEventListener('click', loadMasterJson);
    }
    if (triggerMasterJsonBtn) {
        triggerMasterJsonBtn.addEventListener('click', triggerMasterJsonFlow);
    }
    if (createMasterJsonBackupBtn) {
        createMasterJsonBackupBtn.addEventListener('click', createMasterJsonBackup);
    }
    if (masterJsonBackupsToggle) {
        masterJsonBackupsToggle.addEventListener('click', (event) => {
            if (event) event.stopPropagation();
            toggleMasterJsonBackupsMenu();
        });
        refreshMasterJsonBackupsMenu();
    }
    document.addEventListener('click', (event) => {
        const dropdown = document.getElementById('masterJsonBackupsDropdown');
        if (!dropdown) return;
        if (!isMasterJsonBackupsMenuOpen()) return;
        if (dropdown.contains(event.target)) return;
        setMasterJsonBackupsMenuOpen(false);
    });
    if (transferMasterJsonBtn) {
        transferMasterJsonBtn.addEventListener('click', async () => {
            if (!isSkyrimConnectedNow()) {
                await playOfflineBlockedSound();
                showSkyrimOfflineToast();
                return;
            }
            try {
                const audio = new Audio('Sound/gameplay-recover-hp.wav');
                audio.volume = 0.5;
                await audio.play();
            } catch {}

            const accepted = confirm("By pressing this button, all changes made in the Sandbox will be passed to the original master JSON and a backup will be created in case you want to revert. Remember: every change made in the master JSON will be reflected once the game starts again. It's an OBody NG thing.");
            if (!accepted) return;

            transferMasterJsonBtn.disabled = true;
            try {
                if (typeof playReloadSound === 'function') {
                    playReloadSound();
                }

                const response = await fetch(`${BASE_URL}/toggle-act4-start`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({})
                });

                const data = await response.json().catch(() => ({}));
                if (!response.ok || data.status !== 'success') {
                    throw new Error(data && data.message ? data.message : 'Server error');
                }

                if (typeof showToast === 'function') {
                    showToast('Transfer started. Waiting for the game...', '#3b82f6');
                }
                if (typeof playCopySound === 'function') {
                    playCopySound();
                }
            } catch (error) {
                if (typeof showToast === 'function') {
                    showToast('Error starting transfer', '#ef4444');
                }
            } finally {
                transferMasterJsonBtn.disabled = false;
            }
        });
    }
    if (jsonModifierSaveManualBtn) {
        jsonModifierSaveManualBtn.addEventListener('click', saveJsonModifierManualChange);
    }
    if (confirmJsonKeyDeleteBtn) {
        confirmJsonKeyDeleteBtn.addEventListener('click', handleConfirmJsonKeyDelete);
    }
    if (cancelJsonKeyDeleteBtn) {
        cancelJsonKeyDeleteBtn.addEventListener('click', closeJsonKeyDeleteModal);
    }

    function expandAnalysisLog() {
        expandLog('analysisLogViewer', 'INI Analysis Log');
    }

    function handleLoadAnalysisLogClick() {
        if (typeof playReloadSound === 'function') {
            playReloadSound();
        }
        loadAnalysisLog();
    }

    function handleCopyAnalysisLogClick() {
        if (typeof playCopySound === 'function') {
            playCopySound();
        }
        copyAnalysisLog();
    }

    function handleExpandAnalysisLogClick() {
        if (typeof playExpandSound === 'function') {
            playExpandSound();
        }
        expandAnalysisLog();
    }

    if (loadAnalysisLogBtn) {
        loadAnalysisLogBtn.addEventListener('click', handleLoadAnalysisLogClick);
    }

    if (copyAnalysisLogBtn) {
        copyAnalysisLogBtn.addEventListener('click', handleCopyAnalysisLogClick);
    }

    if (expandAnalysisLogBtn) {
        expandAnalysisLogBtn.addEventListener('click', handleExpandAnalysisLogClick);
    }

    // Load SkyNet content when tab is activated
    const skynetTab = document.querySelector('button[data-target="tab-skynet"]');
    if (skynetTab) {
        skynetTab.addEventListener('click', () => {
            setTimeout(() => {
                // Auto-load content when tab is opened
                loadMasterJson();
                loadAnalysisLog();
            }, 500);
        });
    }


    const clearNpcFavoritesBtn = document.getElementById('clearNpcFavoritesBtn');
    if (clearNpcFavoritesBtn) {
        clearNpcFavoritesBtn.addEventListener('click', clearAllNpcFavorites);
    }

    const clearPluginFavoritesBtn = document.getElementById('clearPluginFavoritesBtn');
    if (clearPluginFavoritesBtn) {
        clearPluginFavoritesBtn.addEventListener('click', clearAllPluginFavorites);
    }

    // Ostim SA functionality
    function displayAct2Data(data) {
        const container = document.getElementById('act2Display');
        if (!container) return;

        container.innerHTML = '<div class="preset-search"><input id="act2Search" placeholder="Search NPCs/Player..." class="preset-search-input"></div>';

        const playerSection = document.createElement('div');
        playerSection.className = 'act2-section';
        playerSection.innerHTML = `<h3>Player</h3>`;

        const playerCard = document.createElement('div');
        playerCard.className = 'act2-npc-card';
        playerCard.innerHTML = `
            <div class="npc-name">${data.player?.name || 'Unknown'}</div>
            <div class="npc-info">Gender: ${data.player?.gender || 'Unknown'} | Vampire: ${data.player?.is_vampire ? 'Yes' : 'No'}</div>
        `;
        playerCard.addEventListener('click', () => showPlayerDetails(data.player));
        playerSection.appendChild(playerCard);

        container.appendChild(playerSection);

        if (data.npcs && data.npcs.length > 0) {
            const npcsSection = document.createElement('div');
            npcsSection.className = 'act2-section';
            npcsSection.innerHTML = `<h3>NPCs - ${data.npcs.length} total</h3>`;

            data.npcs.sort((a, b) => parseFloat(a.distance_from_player) - parseFloat(b.distance_from_player));

            data.npcs.forEach(npc => {
                const npcCard = document.createElement('div');
                npcCard.className = 'act2-npc-card';
                npcCard.innerHTML = `
                    <div class="npc-name">${npc.name}</div>
                    <div class="npc-info">Gender: ${npc.gender} | Distance: ${(npc.distance_from_player / 100).toFixed(2)}m</div>
                `;
                npcCard.addEventListener('click', () => showNPCDetails(npc));
                npcsSection.appendChild(npcCard);
            });

            container.appendChild(npcsSection);
        }

        window.currentAct2Data = data;

        if (data && data.player) {
            showPlayerDetails(data.player);
        }
    }

    function displayPluginsData(data) {
        const container = document.getElementById('pluginsDisplay');
        if (!container) return;

        const mergedPlugins = {};
        if (window.currentPluginsData && window.currentPluginsData.plugins && typeof window.currentPluginsData.plugins === 'object') {
            Object.assign(mergedPlugins, window.currentPluginsData.plugins);
        }
        if (data && data.plugins && typeof data.plugins === 'object') {
            Object.assign(mergedPlugins, data.plugins);
        }
        data = Object.assign({}, data, { plugins: mergedPlugins });
    
        container.innerHTML = '<div class="preset-search"><input id="pluginsSearch" placeholder="Search plugins..." class="preset-search-input"></div>';
    
        if (data.plugins && Object.keys(data.plugins).length > 0) {
            const pluginsSection = document.createElement('div');
            pluginsSection.className = 'act2-section';
            pluginsSection.innerHTML = `<h3>Plugins - ${Object.keys(data.plugins).length} total</h3>`;
    
            Object.keys(data.plugins).sort().forEach(pluginName => {
                const pluginData = data.plugins[pluginName];
                const pluginCard = document.createElement('div');
                pluginCard.className = 'act2-npc-card';
                pluginCard.innerHTML = `
                    <div class="npc-name">${pluginName}</div>
                    <div class="npc-info">Armors: ${pluginData.armors?.length || 0} | Outfits: ${pluginData.outfits?.length || 0} | Weapons: ${pluginData.weapons?.length || 0}</div>
                `;
                pluginCard.addEventListener('click', () => showPluginDetails(pluginName, pluginData));
                pluginsSection.appendChild(pluginCard);
            });
    
            container.appendChild(pluginsSection);
        }
    
        const pluginsSearchInput = document.getElementById('pluginsSearch');
        pluginsSearchInput.addEventListener('input', function() {
            const searchTerm = this.value.toLowerCase().trim();
            const cards = container.querySelectorAll('.act2-npc-card');
            cards.forEach(card => {
                const pluginName = card.querySelector('.npc-name').textContent.toLowerCase();
                card.style.display = pluginName.includes(searchTerm) ? '' : 'none';
            });
        });
    
        window.currentPluginsData = data;
    }

    function displayNpcPluginsList(data) {
        const container = document.getElementById('npcPluginsDisplay');
        if (!container) return;

        // Limpiar cualquier contenido anterior (incluyendo el placeholder)
        container.innerHTML = '';

        container.innerHTML = `
            <div class="preset-search">
                <input type="text" id="npcPluginsSearch" placeholder="Search plugins NPC..." class="preset-search-input">
            </div>
        `;
    
        if (data.plugins && Object.keys(data.plugins).length > 0) {
            const pluginsSection = document.createElement('div');
            pluginsSection.className = 'act2-section';
            pluginsSection.innerHTML = `<h3>NPC Plugins - ${Object.keys(data.plugins).length} total</h3>`;
    
            Object.keys(data.plugins).sort().forEach(pluginName => {
                const pluginData = data.plugins[pluginName];
                const pluginCard = document.createElement('div');
                pluginCard.className = 'act2-npc-card';
                pluginCard.innerHTML = `
                    <div class="npc-name">${pluginName}</div>
                    <div class="npc-info">NPCs: ${pluginData.npcs?.length || 0} total</div>
                `;
                pluginCard.addEventListener('click', async () => {
                    await showNpcPluginDetails(pluginName, pluginData);
                });
                pluginsSection.appendChild(pluginCard);
            });
    
            container.appendChild(pluginsSection);
        }
    
        const npcPluginsSearchInput = document.getElementById('npcPluginsSearch');
        npcPluginsSearchInput.addEventListener('input', function() {
            const searchTerm = this.value.toLowerCase().trim();
            const cards = container.querySelectorAll('.act2-npc-card');
            cards.forEach(card => {
                const pluginName = card.querySelector('.npc-name').textContent.toLowerCase();
                card.style.display = pluginName.includes(searchTerm) ? '' : 'none';
            });
        });
    
        window.currentNpcPluginsData = data;
    }

    // Mapeo de slots a categorías y nombres oficiales
    const slotMapping = {
        'HEAD': {
            'head': 'Head',
            'hair': 'Hair',
            'long_hair': 'Long Hair',
            'circlet': 'Circlet',
            'ears': 'Ears'
        },
        'FACE': {
            'face_jewelry': 'Face Jewelry',
            'face_alternate': 'Face Alternate'
        },
        'NECK': {
            'amulet': 'Amulet',
            'neck': 'Neck'
        },
        'TORSO': {
            'body': 'Body',
            'chest_primary': 'Chest Primary',
            'chest_secondary': 'Chest Secondary',
            'back': 'Back',
            'pelvis_primary': 'Pelvis Primary',
            'pelvis_secondary': 'Pelvis Secondary',
            'decapitated_head': 'Decapitated Head',
            'decapitate': 'Decapitate'
        },
        'ARMS': {
            'forearms': 'Forearms',
            'arm_left': 'Arm Left',
            'arm_right': 'Arm Right',
            'shoulder': 'Shoulder'
        },
        'HANDS': {
            'hands': 'Hands',
            'right_hand': 'Right Hand',
            'left_hand': 'Left Hand',
            'ring': 'Ring'
        },
        'LEGS': {
            'calves': 'Calves',
            'leg_primary_right': 'Leg Primary Right',
            'leg_secondary_left': 'Leg Secondary Left'
        },
        'FEET': {
            'feet': 'Feet',
            'shield': 'Shield'
        },
        'TAIL': {
            'tail': 'Tail'
        },
        'FX': {
            'misc_fx': 'Misc FX',
            'unnamed_fx': 'Unnamed FX',
            'fx01': 'FX01',
            'vagina': 'Vagina',
            'penis': 'Penis',
            'nipples': 'Nipples',
            'anus': 'Anus'
        },
        'DECORPSE': {
            // Slots for decapitated corpses or special effects
        }
    };
    
    const slotNumbers = {
        'head': 30,
        'hair': 30,
        'long_hair': 41,
        'circlet': 31,
        'ears': 43,
        'face_jewelry': 52,
        'amulet': 35,
        'neck': 45,
        'body': 32,
        'chest_primary': 46,
        'chest_secondary': 47,
        'pelvis_primary': 48,
        'pelvis_secondary': 49,
        'forearms': 34,
        'arm_left': 58,
        'arm_right': 59,
        'shoulder': 57,
        'hands': 33,
        'ring': 36,
        'calves': 38,
        'leg_primary_right': 50,
        'leg_secondary_left': 51,
        'feet': 37,
        'shield': 39,
        'tail': 40,
        'misc_fx': 60,
        'vagina': 61,
        'penis': 62,
        'nipples': 63,
        'anus': 64
    };
    
    const ordenSlots = ['HEAD', 'FACE', 'NECK', 'TORSO', 'ARMS', 'HANDS', 'LEGS', 'FEET', 'TAIL', 'FX', 'DECORPSE'];

    function parseSlot(slot) {
        // Los slots ahora son nombres directos, devolver el slot como está
        return slot;
    }

    // Función para inferir el slot de un item basado en su nombre
    // Similar al sistema de slots en Skyrim, categorizando items por partes del cuerpo
    function inferSlot(itemName) {
        const lower = itemName.toLowerCase();
        if (lower.includes('helmet') || lower.includes('hat') || lower.includes('circlet') || lower.includes('hood') || lower.includes('mask') || lower.includes('head')) return 'HEAD';
        if (lower.includes('amulet') || lower.includes('necklace') || lower.includes('neck')) return 'NECK';
        if (lower.includes('body') || lower.includes('cuirass') || lower.includes('armor') || lower.includes('chest') || lower.includes('torso') || lower.includes('shirt') || lower.includes('robe')) return 'TORSO';
        if (lower.includes('gauntlets') || lower.includes('gloves') || lower.includes('bracers') || lower.includes('arms') || lower.includes('forearms')) return 'ARMS';
        if (lower.includes('boots') || lower.includes('shoes') || lower.includes('feet')) return 'FEET';
        if (lower.includes('pants') || lower.includes('leggings') || lower.includes('legs') || lower.includes('calves')) return 'LEGS';
        if (lower.includes('ring') || lower.includes('hands')) return 'HANDS';
        if (lower.includes('shield')) return 'FEET'; // shield often goes to feet/offhand
        if (lower.includes('sword') || lower.includes('axe') || lower.includes('mace') || lower.includes('dagger') || lower.includes('bow') || lower.includes('weapon')) return 'WEAPON';
        return 'OTHER';
    }

    function getCategory(parsed) {
        for (const cat in slotMapping) {
            if (parsed in slotMapping[cat]) return cat;
        }
        return 'OTHER';
    }

    function getSlotName(slot) {
        const parsed = parseSlot(slot);
        for (const cat in slotMapping) {
            if (parsed in slotMapping[cat]) {
                const name = slotMapping[cat][parsed];
                const number = slotNumbers[parsed];
                return (number !== null && number !== undefined && number !== 0) ? `${name} (Slot ${number})` : name;
            }
        }
        return slot; // fallback
    }

    async function showPlayerDetails(player) {
        const panel = document.getElementById('npcDetailsPanel');
        const content = document.getElementById('npcDetailsContent');
        if (!panel || !content) return;

        await loadFavoritosNPCs();
        await loadFavoritosOutfits();
        const pluginName = player.plugin || 'Unknown';
        const isFavorito = favoritosNPCs[pluginName]?.npcs?.some(n => n.editor_id === player.editor_id);

        let html = `<h3 class="npc-name-highlight">${player.name} <span class="npc-star ${isFavorito ? 'active' : ''}" onclick="toggleNpcStar(event)" data-plugin="${pluginName}" data-npc="${btoa(JSON.stringify(player))}">★</span></h3>`;
        html += `<div class="detail-item copyable" ondblclick="copyToClipboardWithSound('${player.plugin}')"><strong>Plugin:</strong> ${player.plugin}</div>`;
        html += `<div class="detail-item copyable" ondblclick="copyToClipboardWithSound('${player.gender}')"><strong>Gender:</strong> ${player.gender}</div>`;
        html += `<div class="detail-item copyable" ondblclick="copyToClipboardWithSound('${player.race}')"><strong>Race:</strong> ${player.race}</div>`;
        html += `<div class="detail-item copyable" ondblclick="copyToClipboardWithSound('${player.is_vampire ? 'Yes' : 'No'}')"><strong>Vampire:</strong> ${player.is_vampire ? 'Yes' : 'No'}</div>`;
        html += `<div class="detail-item copyable" ondblclick="copyToClipboardWithSound('${player.is_werewolf ? 'Yes' : 'No'}')"><strong>Werewolf:</strong> ${player.is_werewolf ? 'Yes' : 'No'}</div>`;

        // Agregar IDs después de la información básica
        html += `<div class="detail-ids">`;
        html += `<div class="detail-item copyable" ondblclick="copyToClipboardWithSound('${player.ref_id}')"><strong>Ref ID:</strong> ${player.ref_id}</div>`;
        html += `<div class="detail-item copyable" ondblclick="copyToClipboardWithSound('${player.base_id}')"><strong>Base ID:</strong> ${player.base_id}</div>`;
        html += `<div class="detail-item copyable" ondblclick="copyToClipboardWithSound('${player.form_id}')"><strong>Form ID:</strong> ${player.form_id}</div>`;
        html += `</div>`;

        // Agregar facciones después de IDs
        if (player.factions && player.factions.length > 0) {
            const factionIds = player.factions.map(f => f.form_id).join(',');
            html += `<div class="detail-section factions-header" data-faction-ids="${factionIds}" onclick="expandFactions(event)"><strong>Factions (${player.factions.length}):</strong> <span class="click-hint">(click for IDs)</span></div>`;
            html += `<div class="preset-search"><input type="text" id="npcDetailsFactionsSearch" placeholder="Filter factions by EDID..." class="preset-search-input"></div>`;
            html += `<div class="faction-list">`;
            player.factions.forEach(faction => {
                const factionName = faction.name || 'Unnamed';
                const factionEditorId = faction.editor_id || factionName;
                const isActive = faction.is_member ? 'active' : 'inactive';
                const displayText = `${factionEditorId} = ${faction.rank}`;
                html += `<div class="faction-item ${isActive}" data-edid="${factionEditorId}" title="${factionName}" ondblclick="copyToClipboardWithSound('${factionEditorId}')">${displayText}</div>`;
            });
            html += `</div>`;
        }

        // Agregar equipped items después de facciones
        html += '<div class="equipped-section"><h4>Equipped Items</h4>';
        ordenSlots.forEach(cat => {
          const slotsCat = Object.keys(slotMapping[cat] || {});
          let itemsCat = [];
          slotsCat.forEach(slot => {
            if (slot === 'right_hand' || slot === 'left_hand') return;
            const item = player.equipped_items[slot];
            if (item?.equipped) {
              itemsCat.push({
                slotName: getSlotName(slot),
                name: item.name || 'Unnamed',
                form_id: item.form_id || '',
                plugin: item.plugin || ''
              });
            }
          });
          if (itemsCat.length > 0) {
            html += `<div class="slot-category" data-cat="${cat.toLowerCase()}"><h5>${cat}</h5><div class="item-grid">`;
            itemsCat.forEach(item => {
              const canFavorite = !!(item.form_id && item.plugin);
              const isEquippedFavorito = canFavorite && !!(favoritosOutfits[item.plugin]?.armors?.some(a => a.form_id === item.form_id));
              html += `<div class="item-card copyable" style="position: relative;" ondblclick="copyToClipboardWithSound('${item.slotName}: ${item.name} | ${item.form_id} | ${item.plugin}')">
                ${canFavorite ? `<span class="star ${isEquippedFavorito ? 'active' : ''}" onclick="toggleOutfitStar(event)" data-plugin="${item.plugin}" data-type="armor" data-name="${item.name}" data-form-id="${item.form_id}" data-category="armor" style="position: absolute; top: 5px; right: 5px; cursor: pointer; font-size: 1.4em;">★</span>` : ''}
                <strong>${item.slotName}:</strong> ${item.name}<br>
                <small>${item.form_id} | ${item.plugin}</small>
              </div>`;
            });
            html += '</div></div>';
          }
        });
        html += '</div>';

        content.innerHTML = html;

        const factionsSearch = document.getElementById('npcDetailsFactionsSearch');
        if (factionsSearch) {
            factionsSearch.addEventListener('input', function() {
                const term = this.value.toLowerCase().trim();
                const items = content.querySelectorAll('.faction-list .faction-item');
                items.forEach(item => {
                    const edid = String(item.getAttribute('data-edid') || '').toLowerCase();
                    item.style.display = !term || edid.includes(term) ? '' : 'none';
                });
            });
        }

        // Agregar event listeners para toggle de outfits
        content.querySelectorAll('.outfit-header').forEach(header => {
            header.addEventListener('click', () => toggleOutfitDetails(header));
        });
        panel.classList.add('visible');

    }

    // Función para expandir/colapsar detalles de outfit
    function toggleOutfitDetails(headerElement) {
        const container = headerElement.parentElement;
        const itemsDiv = container.querySelector('.outfit-items');
        const icon = headerElement.querySelector('.toggle-icon');

        if (itemsDiv.style.display === 'none') {
            itemsDiv.style.display = 'block';
            icon.style.color = 'gold';
        } else {
            itemsDiv.style.display = 'none';
            icon.style.color = 'gray';
        }
        const audio = new Audio('Sound/ding-small-bell-sfx.wav');
        audio.play();
    }

    function showPluginsPlayerDetails(player) {
        const panel = document.getElementById('pluginsDetailsPanel');
        const content = document.getElementById('pluginsDetailsContent');
        if (!panel || !content) return;

        let html = `<h3>${player.name}</h3>`;
        html += `<div class="detail-item copyable" ondblclick="copyToClipboardWithSound('${player.plugin}')"><strong>Plugin:</strong> ${player.plugin}</div>`;
        html += `<div class="detail-item copyable" ondblclick="copyToClipboardWithSound('${player.gender}')"><strong>Gender:</strong> ${player.gender}</div>`;
        html += `<div class="detail-item copyable" ondblclick="copyToClipboardWithSound('${player.race}')"><strong>Race:</strong> ${player.race}</div>`;
        html += `<div class="detail-item copyable" ondblclick="copyToClipboardWithSound('${player.is_vampire ? 'Yes' : 'No'}')"><strong>Vampire:</strong> ${player.is_vampire ? 'Yes' : 'No'}</div>`;
        html += `<div class="detail-item copyable" ondblclick="copyToClipboardWithSound('${player.is_werewolf ? 'Yes' : 'No'}')"><strong>Werewolf:</strong> ${player.is_werewolf ? 'Yes' : 'No'}</div>`;

        // Agregar IDs después de la información básica
        html += `<div class="detail-ids">`;
        html += `<div class="detail-item copyable" ondblclick="copyToClipboardWithSound('${player.ref_id}')"><strong>Ref ID:</strong> ${player.ref_id}</div>`;
        html += `<div class="detail-item copyable" ondblclick="copyToClipboardWithSound('${player.base_id}')"><strong>Base ID:</strong> ${player.base_id}</div>`;
        html += `<div class="detail-item copyable" ondblclick="copyToClipboardWithSound('${player.form_id}')"><strong>Form ID:</strong> ${player.form_id}</div>`;
        html += `</div>`;

        // Agregar facciones después de IDs
        if (player.factions && player.factions.length > 0) {
            const factionIds = player.factions.map(f => f.form_id).join(',');
            html += `<div class="detail-section factions-header" data-faction-ids="${factionIds}" onclick="expandPluginsFactions(event)"><strong>Factions (${player.factions.length}):</strong> <span class="click-hint">(click for IDs)</span></div>`;
            html += `<div class="faction-list">`;
            player.factions.forEach(faction => {
                const factionName = faction.name || 'Unnamed';
                const factionEditorId = faction.editor_id || factionName;
                const isActive = faction.is_member ? 'active' : 'inactive';
                const displayText = `${factionEditorId} = ${faction.rank}`;
                html += `<div class="faction-item ${isActive}" title="${factionName}" ondblclick="copyToClipboardWithSound('${factionEditorId}')">${displayText}</div>`;
            });
            html += `</div>`;
        }

        // Agregar equipped items después de facciones
        html += '<div class="equipped-section"><h4>Equipped Items</h4>';
        ordenSlots.forEach(cat => {
          const slotsCat = Object.keys(slotMapping[cat] || {});
          let itemsCat = [];
          slotsCat.forEach(slot => {
            const item = player.equipped_items[slot];
            if (item?.equipped) {
              itemsCat.push({
                slotName: getSlotName(slot),
                name: item.name || 'Unnamed',
                form_id: item.form_id || '',
                plugin: item.plugin || ''
              });
            }
          });
          if (itemsCat.length > 0) {
            html += `<div class="slot-category" data-cat="${cat.toLowerCase()}"><h5>${cat}</h5><div class="item-grid">`;
            itemsCat.forEach(item => {
              html += `<div class="item-card copyable" ondblclick="copyToClipboardWithSound('${item.slotName}: ${item.name} | ${item.form_id} | ${item.plugin}')">
                <strong>${item.slotName}:</strong> ${item.name} ✓<br>
                <small>${item.form_id} | ${item.plugin}</small>
              </div>`;
            });
            html += '</div></div>';
          }
        });
        html += '</div>';

        content.innerHTML = html;

        // Agregar event listeners para tooltips de outfits
        content.querySelectorAll('.outfit-name').forEach((span, index) => {
            const outfit = pluginData.outfits[index];
            let timeout;
            span.addEventListener('mouseover', () => {
                timeout = setTimeout(() => {
                    showTooltip(span, outfit.items);
                }, 2000);
            });
            span.addEventListener('mouseout', () => {
                clearTimeout(timeout);
                hideTooltip();
            });
        });

        panel.classList.add('visible');
    }

    async function showNPCDetails(npc) {
        const panel = document.getElementById('npcDetailsPanel');
        const content = document.getElementById('npcDetailsContent');
        if (!panel || !content) return;

        await loadFavoritosNPCs();
        await loadFavoritosOutfits();
        const pluginName = npc.plugin || 'Unknown';
        const isFavorito = favoritosNPCs[pluginName]?.npcs?.some(n => n.editor_id === npc.editor_id);

        let html = `<h3 class="npc-name-highlight">${formatLongName(npc.name)} <span class="npc-star ${isFavorito ? 'active' : ''}" onclick="toggleNpcStar(event)" data-plugin="${pluginName}" data-npc="${btoa(JSON.stringify(npc))}">★</span></h3>`;
        html += `<div class="detail-item copyable" ondblclick="copyToClipboardWithSound('${npc.plugin}')"><strong>Plugin:</strong> ${npc.plugin}</div>`;
        html += `<div class="detail-item copyable" ondblclick="copyToClipboardWithSound('${npc.gender}')"><strong>Gender:</strong> ${npc.gender}</div>`;
        html += `<div class="detail-item copyable" ondblclick="copyToClipboardWithSound('${npc.race}')"><strong>Race:</strong> ${npc.race}</div>`;
        html += `<div class="detail-item copyable" ondblclick="copyToClipboardWithSound('${(npc.distance_from_player / 100).toFixed(2)}m')"><strong>Distance:</strong> ${(npc.distance_from_player / 100).toFixed(2)}m</div>`;
        html += `<div class="detail-item copyable" ondblclick="copyToClipboardWithSound('${npc.is_vampire ? 'Yes' : 'No'}')"><strong>Vampire:</strong> ${npc.is_vampire ? 'Yes' : 'No'}</div>`;
        html += `<div class="detail-item copyable" ondblclick="copyToClipboardWithSound('${npc.is_werewolf ? 'Yes' : 'No'}')"><strong>Werewolf:</strong> ${npc.is_werewolf ? 'Yes' : 'No'}</div>`;

        // Agregar IDs después de la información básica
        html += `<div class="detail-ids">`;
        html += `<div class="detail-item copyable" ondblclick="copyToClipboardWithSound('${npc.ref_id}')"><strong>Ref ID:</strong> ${npc.ref_id}</div>`;
        html += `<div class="detail-item copyable" ondblclick="copyToClipboardWithSound('${npc.base_id}')"><strong>Base ID:</strong> ${npc.base_id}</div>`;
        html += `<div class="detail-item copyable" ondblclick="copyToClipboardWithSound('${npc.form_id}')"><strong>Form ID:</strong> ${npc.form_id}</div>`;
        html += `</div>`;

        // Agregar facciones después de IDs
        if (npc.factions && npc.factions.length > 0) {
            const factionIds = npc.factions.map(f => f.form_id).join(',');
            html += `<div class="detail-section factions-header" data-faction-ids="${factionIds}" onclick="expandFactions(event)"><strong>Factions (${npc.factions.length}):</strong> <span class="click-hint">(click for IDs)</span></div>`;
            html += `<div class="preset-search"><input type="text" id="npcDetailsFactionsSearch" placeholder="Filter factions by EDID..." class="preset-search-input"></div>`;
            html += `<div class="faction-list">`;
            npc.factions.forEach(faction => {
                const factionName = faction.name || 'Unnamed';
                const factionEditorId = faction.editor_id || factionName;
                const isActive = faction.is_member ? 'active' : 'inactive';
                const displayText = `${factionEditorId} = ${faction.rank}`;
                html += `<div class="faction-item ${isActive}" data-edid="${factionEditorId}" title="${factionName}" ondblclick="copyToClipboardWithSound('${factionEditorId}')">${displayText}</div>`;
            });
            html += `</div>`;
        }

        // Agregar equipped items después de facciones
        html += '<div class="equipped-section"><h4>Equipped Items</h4>';
        ordenSlots.forEach(cat => {
          const slotsCat = Object.keys(slotMapping[cat] || {});
          let itemsCat = [];
          slotsCat.forEach(slot => {
            if (slot === 'right_hand' || slot === 'left_hand') return;
            const item = npc.equipped_items[slot];
            if (item?.equipped) {
              itemsCat.push({
                slotName: getSlotName(slot),
                name: item.name || 'Unnamed',
                form_id: item.form_id || '',
                plugin: item.plugin || ''
              });
            }
          });
          if (itemsCat.length > 0) {
            html += `<div class="slot-category" data-cat="${cat.toLowerCase()}"><h5>${cat}</h5><div class="item-grid">`;
            itemsCat.forEach(item => {
              const canFavorite = !!(item.form_id && item.plugin);
              const isEquippedFavorito = canFavorite && !!(favoritosOutfits[item.plugin]?.armors?.some(a => a.form_id === item.form_id));
              html += `<div class="item-card copyable" style="position: relative;" ondblclick="copyToClipboardWithSound('${item.slotName}: ${item.name} | ${item.form_id} | ${item.plugin}')">
                ${canFavorite ? `<span class="star ${isEquippedFavorito ? 'active' : ''}" onclick="toggleOutfitStar(event)" data-plugin="${item.plugin}" data-type="armor" data-name="${item.name}" data-form-id="${item.form_id}" data-category="armor" style="position: absolute; top: 5px; right: 5px; cursor: pointer; font-size: 1.4em;">★</span>` : ''}
                <strong>${item.slotName}:</strong> ${item.name}<br>
                <small>${item.form_id} | ${item.plugin}</small>
              </div>`;
            });
            html += '</div></div>';
          }
        });
        html += '</div>';

        content.innerHTML = html;

        const factionsSearch = document.getElementById('npcDetailsFactionsSearch');
        if (factionsSearch) {
            factionsSearch.addEventListener('input', function() {
                const term = this.value.toLowerCase().trim();
                const items = content.querySelectorAll('.faction-list .faction-item');
                items.forEach(item => {
                    const edid = String(item.getAttribute('data-edid') || '').toLowerCase();
                    item.style.display = !term || edid.includes(term) ? '' : 'none';
                });
            });
        }

        const pluginsDetailsSearch = document.getElementById('pluginsDetailsSearch');
        if (pluginsDetailsSearch) {
            pluginsDetailsSearch.addEventListener('input', function() {
                const searchTerm = this.value.toLowerCase().trim();
                const cards = content.querySelectorAll('.weapon-card, .item-card, .nested-item');
                cards.forEach(card => {
                    const text = card.textContent.toLowerCase();
                    card.style.display = text.includes(searchTerm) ? '' : 'none';
                });
            });
        }

        panel.classList.add('visible');
    }

    // Función para mostrar detalles de un plugin con 3 categorías principales: Armors, Outfits, Weapons
    function showPluginDetails(pluginName, pluginData) {
        console.log('showPluginDetails called for', pluginName, 'with data:', pluginData);
        const panel = document.getElementById('pluginsDetailsPanel');
        const content = document.getElementById('pluginsDetailsContent');
        if (!panel || !content) return;

        let html = `<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;"><h3 style="margin: 0;">${pluginName} <span class="master-star" onclick="toggleOutfitStar(event)" data-plugin="${pluginName}">★</span></h3><div class="preset-search"><input id="pluginsDetailsSearch" placeholder="Search items..." class="preset-search-input"></div></div>`;

        // Sección Armors - lista simple
        if (pluginData.armors && pluginData.armors.length > 0) {
            html += '<div class="equipped-section"><h4>Armors</h4><div class="weapons-grid">';
            pluginData.armors.forEach(armor => {
                const isFavorito = favoritosOutfits[pluginName]?.armors?.some(a => a.form_id === armor.form_id);
                html += `<div class="weapon-card copyable" style="min-height: 80px; padding: 12px; display: flex; flex-direction: column; justify-content: space-between; position: relative;" ondblclick="copyToClipboardWithSound('Armor: ${armor.name} | ${armor.form_id} | ${pluginName}')">
                    <span class="star ${isFavorito ? 'active' : ''}" onclick="toggleOutfitStar(event)" data-plugin="${pluginName}" data-type="armor" data-name="${armor.name}" data-form-id="${armor.form_id}" data-category="armor" style="position: absolute; top: 5px; right: 5px; cursor: pointer; font-size: 1.4em;">★</span>
                    <strong>Armor:</strong> ${formatEditorId(armor.name)}<br>
                    <small>${armor.form_id} | ${pluginName}</small>
                </div>`;
            });
            html += '</div></div>';
        }

        // Sección Outfits - con jerarquía anidada
        if (pluginData.outfits && pluginData.outfits.length > 0) {
            html += '<div class="equipped-section"><h4>Outfits</h4>';
            pluginData.outfits.forEach(outfit => {
                const isOutfitFavorito = favoritosOutfits[pluginName]?.outfits?.some(o => o.form_id === outfit.form_id);
                html += `<div class="outfit-container">
                    <div class="outfit-header">
                        <strong>Outfit:</strong> <span class="outfit-name" title="${outfit.items ? outfit.items.map(item => item.name).join('\n') : ''}">${outfit.name}</span> (${outfit.items ? outfit.items.length : 0} items)${outfit.price ? ' - Price: ' + outfit.price : ''}
                        <span class="star ${isOutfitFavorito ? 'active' : ''}" onclick="toggleOutfitStar(event)" data-plugin="${pluginName}" data-type="outfit" data-name="${outfit.name}" data-form-id="${outfit.form_id}" data-category="outfit" style="cursor: pointer;">★</span>
                    </div>
                    <div class="outfit-items" style="display: none;">`;
                if (outfit.items && outfit.items.length > 0) {
                    outfit.items.forEach(item => {
                        const isItemFavorito = favoritosOutfits[pluginName]?.outfits?.some(o => o.form_id === outfit.form_id) ||
                                              favoritosOutfits[pluginName]?.armors?.some(a => a.form_id === item.form_id) ||
                                              favoritosOutfits[pluginName]?.weapons?.some(w => w.form_id === item.form_id);
                        html += `<div class="item-card copyable nested-item" style="min-height: 80px; padding: 12px; display: flex; flex-direction: column; justify-content: space-between; position: relative;" ondblclick="copyToClipboardWithSound('Outfit Item: ${item.name} | ${item.form_id} | ${pluginName}')">
                            <span class="star ${isItemFavorito ? 'active' : ''}" onclick="toggleOutfitStar(event)" data-plugin="${pluginName}" data-type="armor" data-name="${item.name}" data-form-id="${item.form_id}" data-category="armor" style="position: absolute; top: 5px; right: 5px; cursor: pointer; font-size: 1.4em;">★</span>
                            <strong>Item: ${formatEditorId(item.name)} | <strong style="color: var(--secondary);">ID: ${item.form_id}</strong></strong><br><small>${item.plugin || pluginName}</small>
                        </div>`;
                    });
                }
                html += '</div></div>';
            });
            html += '</div>';
        }

        // Sección Weapons - en formato grid
        if (pluginData.weapons && pluginData.weapons.length > 0) {
            html += '<div class="equipped-section"><h4>Weapons</h4><div class="weapons-grid">';
            pluginData.weapons.forEach(weapon => {
                const isFavorito = favoritosOutfits[pluginName]?.weapons?.some(w => w.form_id === weapon.form_id);
                html += `<div class="weapon-card copyable" style="min-height: 80px; padding: 12px; display: flex; flex-direction: column; justify-content: space-between; position: relative;" ondblclick="copyToClipboardWithSound('Weapon: ${weapon.name} | ${weapon.form_id} | ${pluginName}')">
                    <span class="star ${isFavorito ? 'active' : ''}" onclick="toggleOutfitStar(event)" data-plugin="${pluginName}" data-type="weapon" data-name="${weapon.name}" data-form-id="${weapon.form_id}" data-category="weapon" style="position: absolute; top: 5px; right: 5px; cursor: pointer; font-size: 1.4em;">★</span>
                    <strong>Weapon:</strong> ${formatEditorId(weapon.name)}<br>
                    <small>${weapon.form_id} | ${pluginName}</small>
                </div>`;
            });
            html += '</div></div>';
        }

        content.innerHTML = html;

        const pluginsDetailsSearch = document.getElementById('pluginsDetailsSearch');
        if (pluginsDetailsSearch) {
            pluginsDetailsSearch.addEventListener('input', function() {
                const searchTerm = this.value.toLowerCase().trim();
                const cards = content.querySelectorAll('.weapon-card, .item-card, .nested-item');
                cards.forEach(card => {
                    const text = card.textContent.toLowerCase();
                    card.style.display = text.includes(searchTerm) ? '' : 'none';
                });
            });
        }

        panel.classList.add('visible');

        // Actualizar la estrella maestra para reflejar el estado de "all_favorites"
        updateOutfitMasterStar(pluginName);

        // Actualizar la estrella maestra para reflejar el estado de "all_favorites"
        updateOutfitMasterStar(pluginName);
    }

    // Función helper para dividir Editor IDs largos
    function formatEditorId(editorId) {
        const maxLength = 75;
        const parts = [];
        let remaining = editorId;
        while (remaining.length > maxLength) {
            let cutAt = maxLength;
            // Search el último '_' antes de maxLength
            for (let i = maxLength - 1; i >= 0; i--) {
                if (remaining[i] === '_') {
                    cutAt = i + 1; // incluir el '_'
                    break;
                }
            }
            parts.push(remaining.substring(0, cutAt));
            remaining = remaining.substring(cutAt);
        }
        if (remaining) parts.push(remaining);
        return parts.join('<br>');
    }

    // Función para dividir nombres largos de NPC en líneas lógicas (camelCase ~60 chars)
    function formatLongName(name) {
        if (name.length <= 60) return name;
        const parts = name.split(/(?=[A-Z])/);
        let lines = [];
        let currentLine = '';
        for (let part of parts) {
            if (currentLine.length + part.length > 40) {
                if (currentLine) lines.push(currentLine);
                currentLine = part;
            } else {
                currentLine += part;
            }
        }
        if (currentLine) lines.push(currentLine);
        return lines.join('<br>');
    }

    // Función para mostrar detalles de un plugin NPC con lista de NPCs
    async function showNpcPluginDetails(pluginName, pluginData) {
        await loadFavoritosNPCs();
        currentPollingPlugin = pluginName;
        const panel = document.getElementById('npcPluginsDetailsPanel');
        const content = document.getElementById('npcPluginsDetailsContent');
        if (!panel || !content) return;

        const total = pluginData.npcs.length;
        const favCount = favoritosNPCs[pluginName]?.npcs?.length || 0;

        let html = `<h3 data-plugin="${pluginName}">${pluginName} <span class="master-star ${favoritosNPCs[pluginName]?.all_favorites ? 'active' : ''}" onclick="toggleNpcPluginStars(event)" data-plugin="${pluginName}">★</span> <span class="badge-total">Total: ${total}</span> <span class="badge-fav">Fav: ${favCount}/${total}</span></h3>`;

        // Sección NPCs - lista de cards por NPC
        if (pluginData.npcs && pluginData.npcs.length > 0) {
            html += '<div class="preset-search"><input type="text" id="npcDetailsSearch" placeholder="Search NPCs by name..." class="preset-search-input"></div><div class="equipped-section"><h4>NPCs</h4><div class="weapons-grid">';
            pluginData.npcs.forEach(npc => {
                const isFavorito = favoritosNPCs[pluginName]?.npcs.some(n => n.editor_id === npc.editor_id);
                html += `<div class="weapon-card copyable" style="position: relative; min-height: auto; padding: 10px; display: flex; flex-direction: column; justify-content: space-between;" data-editor-id="${npc.editor_id}" data-npc="${btoa(JSON.stringify(npc))}">
                    <strong class="npc-name-large">${formatLongName(npc.name)}</strong>
                    <span class="npc-star ${isFavorito ? 'active' : ''}" data-plugin="${pluginName}" data-npc="${btoa(JSON.stringify(npc))}" style="position: absolute; top: 5px; right: 5px; cursor: pointer; font-size: 1.4em; z-index: 10;" title="Favorito">${isFavorito ? '★' : '✩'}</span>
                    <small class="copyable editor-small" ondblclick="copyToClipboardWithSound('${npc.editor_id}')">Editor ID: ${formatEditorId(npc.editor_id)}</small>
                    <div class="compact-info">
                        <small class="copyable" ondblclick="copyToClipboardWithSound('${npc.form_id}')">Form ID: ${npc.form_id}</small>
                        <small class="copyable" ondblclick="copyToClipboardWithSound('${npc.base_id}')">Base ID: ${npc.base_id}</small>
                        <small class="copyable" ondblclick="copyToClipboardWithSound('${npc.race}')">Race: ${npc.race}</small>
                        <small class="copyable" ondblclick="copyToClipboardWithSound('${npc.gender}')">Gender: ${npc.gender}</small>
                    </div>
                </div>`;
            });
            html += '</div></div>';
        }

        content.innerHTML = html;
        document.querySelectorAll('#npcPluginsDetailsContent .npc-star').forEach(star => {
            star.addEventListener('click', (e) => {
                e.stopPropagation();
                const pluginName = star.dataset.plugin;
                const npcB64 = star.dataset.npc;
                let npc;
                try {
                    npc = JSON.parse(atob(npcB64));
                } catch (err) {
                    console.error('NPC parse error', err);
                    return;
                }
                console.log('Toggle NPC', npc.editor_id);
                favoritosNPCs[pluginName] ||= {npcs:[]};
                const isFavorito = favoritosNPCs[pluginName].npcs.some(n => n.editor_id === npc.editor_id);
                if (isFavorito) {
                    favoritosNPCs[pluginName].npcs = favoritosNPCs[pluginName].npcs.filter(n => n.editor_id !== npc.editor_id);
                } else {
                    favoritosNPCs[pluginName].npcs.push(npc);
                }
                saveFavoritosNPCs();
                star.classList.toggle('active', !isFavorito);
                // star.style.color = '#ffd700'; // Handled by CSS
                console.log('Updated stars for', pluginName, isFavorito);
                const audio = new Audio('Sound/ding-small-bell-sfx.wav');
                audio.play();
            });
        });
        const npcDetailsSearchInput = content.querySelector('#npcDetailsSearch');
        npcDetailsSearchInput.addEventListener('input', function() {
            const searchTerm = this.value.toLowerCase().trim();
            const cards = content.querySelectorAll('.weapon-card');
            cards.forEach(card => {
                const npcName = card.querySelector('strong').textContent.toLowerCase();
                card.style.display = npcName.includes(searchTerm) ? '' : 'none';
            });
        });
        panel.classList.add('visible');

        // Start polling for real-time favorites update
        if (npcPluginDetailsInterval) clearInterval(npcPluginDetailsInterval);
        npcPluginDetailsInterval = setInterval(async () => {
            if (!currentPollingPlugin || !document.getElementById('npcPluginsDetailsPanel').classList.contains('visible')) return;
            try {
                await loadFavoritosNPCs();
                // Update badge
                const total = window.currentNpcPluginsData?.plugins[currentPollingPlugin]?.npcs?.length || 0;
                const favCount = favoritosNPCs[currentPollingPlugin]?.npcs?.length || 0;
                console.log('Poll update', favCount);
                const badgeFav = document.querySelector('#npcPluginsDetailsContent .badge-fav');
                if (badgeFav) {
                    badgeFav.textContent = `Fav: ${favCount}/${total}`;
                }
                // Update stars
                const npcCards = document.querySelectorAll('#npcPluginsDetailsContent .weapon-card');
                npcCards.forEach(card => {
                    const npcB64 = card.dataset.npc;
                    let npc;
                    try {
                        npc = JSON.parse(atob(npcB64));
                    } catch (err) {
                        console.error('NPC parse error in polling', err);
                        return;
                    }
                    const isFavorito = favoritosNPCs[currentPollingPlugin]?.npcs.some(n => n.editor_id === npc.editor_id);
                    let star = card.querySelector('.npc-star');
                    if (!star) {
                        // Add star if missing
                        star = document.createElement('span');
                        star.className = 'npc-star';
                        star.dataset.plugin = currentPollingPlugin;
                        star.dataset.npc = npcB64;
                        star.style = 'position: absolute; top: 5px; right: 5px; cursor: pointer; font-size: 1.4em; z-index: 10;';
                        star.title = 'Favorito';
                        star.textContent = '✩';
                        star.addEventListener('click', (e) => {
                            e.stopPropagation();
                            const pluginName = star.dataset.plugin;
                            const npcB64 = star.dataset.npc;
                            let npc;
                            try {
                                npc = JSON.parse(atob(npcB64));
                            } catch (err) {
                                console.error('NPC parse error', err);
                                return;
                            }
                            console.log('Toggle NPC', npc.editor_id);
                            favoritosNPCs[pluginName] ||= {npcs:[]};
                            const isFavorito = favoritosNPCs[pluginName].npcs.some(n => n.editor_id === npc.editor_id);
                            if (isFavorito) {
                                favoritosNPCs[pluginName].npcs = favoritosNPCs[pluginName].npcs.filter(n => n.editor_id !== npc.editor_id);
                            } else {
                                favoritosNPCs[pluginName].npcs.push(npc);
                            }
                            saveFavoritosNPCs();
                            const newIsFavorito = !isFavorito;
                            if (newIsFavorito) {
                                star.textContent = '★';
                            } else {
                                star.textContent = '✩';
                            }
                            star.classList.toggle('active');
                            console.log('Updated stars for', pluginName, newIsFavorito);
                            const audio = new Audio('Sound/ding-small-bell-sfx.wav');
                            audio.play();
                        });
                        card.appendChild(star);
                    }
                    // Update star state only if favorito to avoid flickering on silver stars
                    if (isFavorito) {
                        star.classList.add('active');
                        star.textContent = '★';
                    } else {
                        star.classList.remove('active');
                        star.textContent = '✩';
                    }
                });
                // Update master star
                const masterStar = document.querySelector('#npcPluginsDetailsContent .master-star');
                if (masterStar) {
                    const allFavorites = favCount === total && total > 0;
                    masterStar.classList.toggle('active', allFavorites);
                }
                // Update badges in main list
                const badgeFavList = document.querySelector(`#npcPluginsDisplay h3[data-plugin="${currentPollingPlugin}"] .badge-fav`);
                if (badgeFavList) badgeFavList.textContent = `Fav: ${favCount}/${total}`;
                const masterStarList = document.querySelector(`#npcPluginsDisplay h3[data-plugin="${currentPollingPlugin}"] .master-star`);
                if (masterStarList) masterStarList.classList.toggle('active', allFavorites);
            } catch (error) {
                console.error('Error in NPC plugin polling:', error);
                clearInterval(npcPluginDetailsInterval);
                npcPluginDetailsInterval = null;
                closeNpcPluginsDetails();
            }
        }, 2000);
    }

    function copyToClipboard(text) {
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(text).then(() => {
                showToast(`Copied: ${text}`, '10b981');
                const audio = new Audio('Sound/ding-small-bell-sfx.wav');
                audio.play();
            }).catch(() => {
                fallbackCopy(text);
            });
        } else {
            fallbackCopy(text);
        }
    }

    function fallbackCopy(text) {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        document.body.appendChild(textarea);
        textarea.select();
        const success = document.execCommand('copy');
        document.body.removeChild(textarea);
        if (success) {
            showToast(`Copied: ${text}`, '10b981');
            const audio = new Audio('Sound/ding-small-bell-sfx.wav');
            audio.play();
        } else {
            showToast('Failed to copy', 'ef4444');
        }
    }

    function copyToClipboardWithSound(text) {
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(text).then(() => {
                showToast(`Copied: ${text}`, '10b981');
                const audio = new Audio('Sound/ding-small-bell-sfx.wav');
                audio.play();
            }).catch(() => {
                fallbackCopyWithSound(text);
            });
        } else {
            fallbackCopyWithSound(text);
        }
    }

    function fallbackCopyWithSound(text) {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        document.body.appendChild(textarea);
        textarea.select();
        const success = document.execCommand('copy');
        document.body.removeChild(textarea);
        if (success) {
            showToast(`Copied: ${text}`, '10b981');
            const audio = new Audio('Sound/ding-small-bell-sfx.wav');
            audio.play();
        } else {
            showToast('Failed to copy', 'ef4444');
        }
    }

    function closeNPCDetails() {
        const panel = document.getElementById('npcDetailsPanel');
        if (panel) {
            panel.classList.remove('visible');
        }
    }

    function closePluginsDetails() {
        const panel = document.getElementById('pluginsDetailsPanel');
        if (panel) {
            panel.classList.remove('visible');
        }
    }
    
    function closeNpcPluginsDetails() {
        const panel = document.getElementById('npcPluginsDetailsPanel');
        if (panel) {
            panel.classList.remove('visible');
            if (npcPluginDetailsInterval) {
                clearInterval(npcPluginDetailsInterval);
                npcPluginDetailsInterval = null;
            }
        }
        currentPollingPlugin = null;
    }

    function loadAct2Json() {
        const viewer = document.getElementById('act2Display');
        if (!viewer) return Promise.resolve();

        viewer.textContent = 'Loading...';
        viewer.style.color = '#fbbf24';

        return fetch(`${BASE_URL}/load-act2-json`)
            .then(response => response.json())
            .then(data => {
                if (data.status === 'success') {
                    const jsonData = JSON.parse(data.content || '{}');
                    displayAct2Data(jsonData);
                    const act2Search = document.getElementById('act2Search');
                    if (act2Search) {
                        act2Search.addEventListener('input', function() {
                            const searchTerm = this.value.toLowerCase().trim();
                            const cards = document.querySelectorAll('.act2-npc-card');
                            cards.forEach(card => {
                                const npcName = card.querySelector('.npc-name').textContent.toLowerCase();
                                card.style.display = npcName.includes(searchTerm) ? '' : 'none';
                            });
                        });
                    }
                } else {
                    viewer.textContent = 'Error loading JSON file';
                    viewer.style.color = '#ef4444';
                }
            })
            .catch(error => {
                console.error('Error loading Act2 JSON:', error);
                viewer.textContent = 'Connection error';
                viewer.style.color = '#ef4444';
            });
    }

    function loadPluginsJson() {
        const viewer = document.getElementById('pluginsDisplay');
        if (!viewer) return Promise.resolve();

        viewer.textContent = 'Loading...';
        viewer.style.color = '#fbbf24';

        return fetch(`${BASE_URL}/load-outfits-json`)
            .then(response => response.json())
            .then(data => {
                if (data.status === 'success') {
                    const jsonData = JSON.parse(data.content || '{}');
                    displayPluginsData(jsonData);
                } else {
                    viewer.textContent = 'Error loading JSON file';
                    viewer.style.color = '#ef4444';
                }
            })
            .catch(error => {
                console.error('Error loading Plugins JSON:', error);
                viewer.textContent = 'Connection error';
                viewer.style.color = '#ef4444';
            });
    }

    async function loadNpcPluginsList() {
        const viewer = document.getElementById('npcPluginsDisplay');
        if (!viewer) return;

        viewer.textContent = 'Loading...';
        viewer.style.color = '#fbbf24';

        await loadFavoritosNPCs();

        return fetch(`${BASE_URL}/load-npcs-list-json`)
            .then(response => {
                if (!response.ok) {
                    // Parse text as fallback before json()
                    return response.text().then(text => {
                        throw new Error(`HTTP ${response.status}: ${text}`);
                    });
                }
                return response.json();
            })
            .then(data => {
                if (data.status === 'success') {
                    const jsonData = JSON.parse(data.content || '{}');
                    displayNpcPluginsList(jsonData);
                } else {
                    viewer.textContent = 'Error loading JSON file';
                    viewer.style.color = '#ef4444';
                }
            })
            .catch(error => {
                console.error('Full error:', error, error.response ? error.response.status : 'No response');
                viewer.textContent = `Error: ${error.message.includes('HTTP') ? error.message.split(':')[0] : 'Connection error'} - Check console/server`;
                viewer.style.color = '#ef4444';
            });
    }
    
    async function toggleAct2Start(e) {
        if (!isSkyrimConnectedNow()) {
            await playOfflineBlockedSound();
            showSkyrimOfflineToast();
            return;
        }

        const button = e && e.currentTarget ? e.currentTarget : document.getElementById('toggleAct2Start');
        const unlock = silentlyLockButton(button, null);

        try {
            const response = await fetch(`${BASE_URL}/activate-npc-tracking`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'}
            });
            const data = await response.json();
            if (data.status === 'success') {
                showToast('The list will be updated, please wait', '#10b981');
                const act2Display = document.getElementById('act2Display');
                if (act2Display) {
                    const waitMessage = document.createElement('div');
                    waitMessage.id = 'waitMessage';
                    waitMessage.textContent = 'Please wait...';
                    waitMessage.style.cssText = 'text-align: center; padding: 20px; font-size: 1.2em; color: #fbbf24;';
                    act2Display.appendChild(waitMessage);
                }

                await new Promise(r => setTimeout(r, 3000));

                const waitMessage = document.getElementById('waitMessage');
                if (waitMessage) waitMessage.remove();

                await loadAct2Json();

                try {
                    const accResponse = await fetch(`${BASE_URL}/accumulate-faction-names`, {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'}
                    });
                    const result = await accResponse.json();
                    if (result.status !== 'success') {
                        console.error('Error accumulating faction names:', result);
                    } else {
                        loadFactionsLibrary();
                    }
                } catch (error) {
                    console.error('Error accumulating faction names:', error);
                }
            } else {
                showToast('Error toggling Act2 start value', '#ef4444');
            }
        } catch (error) {
            console.error('Error toggling Act2 start:', error);
            showToast('Connection error', '#ef4444');
        } finally {
            unlock();
        }
    }

    async function togglePluginsStart(e) {
        const button = e && e.currentTarget ? e.currentTarget : document.getElementById('togglePluginsStart');
        const unlock = silentlyLockButton(button, null);

        try {
            const response = await fetch(`${BASE_URL}/toggle-plugin-outfits-start`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'}
            });
            const data = await response.json();
            if (data.status === 'success') {
                showToast('The list will be updated, please wait', '#10b981');
                const pluginsDisplay = document.getElementById('pluginsDisplay');
                if (pluginsDisplay) {
                    const waitMessage = document.createElement('div');
                    waitMessage.id = 'waitPluginsMessage';
                    waitMessage.textContent = 'Please wait...';
                    waitMessage.style.cssText = 'text-align: center; padding: 20px; font-size: 1.2em; color: #fbbf24;';
                    pluginsDisplay.appendChild(waitMessage);
                }

                await new Promise(r => setTimeout(r, 3000));

                const waitMessage = document.getElementById('waitPluginsMessage');
                if (waitMessage) waitMessage.remove();

                await loadPluginsJson();
            } else {
                showToast('Error toggling Plugin Outfits start value', '#ef4444');
            }
        } catch (error) {
            console.error('Error toggling Plugin Outfits start:', error);
            showToast('Connection error', '#ef4444');
        } finally {
            unlock();
        }
    }

    async function toggleNpcPluginsStart(e) {
        const button = e && e.currentTarget ? e.currentTarget : document.getElementById('npcTogglePluginsStart');
        const unlock = silentlyLockButton(button, null);

        try {
            const npcPluginsDisplay = document.getElementById('npcPluginsDisplay');
            if (npcPluginsDisplay) {
                npcPluginsDisplay.innerHTML = '';
            }

            const response = await fetch(`${BASE_URL}/set-npc-list-true`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'}
            });
            const data = await response.json();
            if (data.status === 'success') {
                showToast('NPC list updated', '#10b981');
                const npcPluginsDisplay = document.getElementById('npcPluginsDisplay');
                if (npcPluginsDisplay) {
                    const waitMessage = document.createElement('div');
                    waitMessage.id = 'npcWaitMessage';
                    waitMessage.textContent = 'Please wait...';
                    waitMessage.style.cssText = 'text-align: center; padding: 20px; font-size: 1.2em; color: #fbbf24;';
                    npcPluginsDisplay.appendChild(waitMessage);
                }

                await new Promise(r => setTimeout(r, 3000));

                const waitMessage = document.getElementById('npcWaitMessage');
                if (waitMessage) waitMessage.remove();

                await loadNpcPluginsList();
            } else {
                showToast('Error toggling NPC Plugin Outfits start value', '#ef4444');
            }
        } catch (e) {
            console.error('NPC toggle error', e);
            showToast('Connection error', '#ef4444');
        } finally {
            unlock();
        }
    }

    // Ostim SA event listeners
    const loadAct2JsonBtn = document.getElementById('loadAct2Json');
    const toggleAct2StartBtn = document.getElementById('toggleAct2Start');

    if (loadAct2JsonBtn) {
        loadAct2JsonBtn.addEventListener('click', loadAct2Json);
    }

    if (toggleAct2StartBtn) {
        toggleAct2StartBtn.addEventListener('click', toggleAct2Start);
    }

    // Plugins SA event listeners
    const loadPluginsJsonBtn = document.getElementById('loadPluginsJson');
    const togglePluginsStartBtn = document.getElementById('togglePluginsStart');

    if (loadPluginsJsonBtn) {
        loadPluginsJsonBtn.addEventListener('click', loadPluginsJson);
    }

    if (togglePluginsStartBtn) {
        togglePluginsStartBtn.addEventListener('click', togglePluginsStart);
    }

    // NPC Plugins SA event listeners
    const npcTogglePluginsStartBtn = document.getElementById('npcTogglePluginsStart');

    if (npcTogglePluginsStartBtn) {
        npcTogglePluginsStartBtn.addEventListener('click', toggleNpcPluginsStart);
    }

    // Load Ostim content when tab is activated
    const ostimTab = document.querySelector('button[data-target="tab-ostim"]');
    if (ostimTab) {
        ostimTab.addEventListener('click', () => {
            setTimeout(() => {
                loadAct2Json();
                loadRadioFromINI();
            }, 500);
        });
    }

    // Load Plugins content when tab is activated
    const pluginsTab = document.querySelector('button[data-target="tab-plugins"]');
    if (pluginsTab) {
        pluginsTab.addEventListener('click', () => {
            setTimeout(() => {
                loadFavoritosOutfits().then(() => {
                    loadPluginsJson();
                    displayFavoritosOutfits();
                });
            }, 500);
        });
    }

    // Plugin search functionality
    const pluginSearchInput = document.getElementById('pluginSearch');
    if (pluginSearchInput) {
        pluginSearchInput.addEventListener('input', function() {
            const searchTerm = this.value.toLowerCase().trim();
            const table = document.querySelector('.plugin-selector-table');
            if (table) {
                const rows = table.querySelectorAll('tbody tr');
                rows.forEach(row => {
                    const pluginName = row.cells[0].textContent.toLowerCase();
                    if (pluginName.includes(searchTerm)) {
                        row.style.display = '';
                    } else {
                        row.style.display = 'none';
                    }
                });
            }
        });
    }
    
    // Plugin Outfits actualization button
    const pluginOutfitsActualisationBtn = document.getElementById('pluginOutfitsActualisationBtn');
    if (pluginOutfitsActualisationBtn) {
        pluginOutfitsActualisationBtn.addEventListener('click', async (e) => {
            if (!isSkyrimConnectedNow()) {
                await playOfflineBlockedSound();
                showSkyrimOfflineToast();
                return;
            }

            const unlock = silentlyLockButton(e.currentTarget, null);

            try {
                const response = await fetch(`${BASE_URL}/set-plugin-list-true`, {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'}
                });
                if (!response.ok) throw new Error('HTTP ' + response.status);
                const result = await response.json();
                if (result.status === 'success') {
                    showToast('Plugin list updated, will reset', '#10b981');
                    await new Promise(r => setTimeout(r, 4000));
                    await loadPluginSelector();
                } else {
                    showToast('Error setting Plugin_list', '#ef4444');
                }
            } catch (error) {
                console.error('Error:', error);
                showToast('Connection error', '#ef4444');
            } finally {
                unlock();
            }
        });
    }

    // NPC Plugin search functionality
    const npcPluginSearchInput = document.getElementById('npcPluginSearch');
    if (npcPluginSearchInput) {
        npcPluginSearchInput.addEventListener('input', function() {
            const searchTerm = this.value.toLowerCase().trim();
            const table = document.querySelector('#npcPluginSelectorContent .plugin-selector-table');
            if (table) {
                const rows = table.querySelectorAll('tbody tr');
                rows.forEach(row => {
                    const pluginName = row.cells[0].textContent.toLowerCase();
                    if (pluginName.includes(searchTerm)) {
                        row.style.display = '';
                    } else {
                        row.style.display = 'none';
                    }
                });
            }
        });
    }

    // NPC Plugin Outfits actualization button
    const npcPluginOutfitsActualisationBtn = document.getElementById('npcPluginOutfitsActualisationBtn');
    
    // Load NPC Plugins content when tab is activated
    const npcPluginsTab = document.querySelector('button[data-target="tab-plugins-npc"]');
    if (npcPluginsTab) {
        npcPluginsTab.addEventListener('click', () => {
            setTimeout(() => {
                loadFavoritosNPCs().then(() => {
                    loadNpcPluginsList();
                    displayFavoritosNPCs();
                });
            }, 500);
        });
    }

    // NPC Favorites Search Listener
    const favSearchInput = document.getElementById('favoritosNPCsSearchInline_Plugins');
    if (favSearchInput) {
        favSearchInput.addEventListener('input', displayFavoritosNPCs);
    }
    if (npcPluginOutfitsActualisationBtn) {
        npcPluginOutfitsActualisationBtn.addEventListener('click', async (e) => {
            if (!isSkyrimConnectedNow()) {
                await playOfflineBlockedSound();
                showSkyrimOfflineToast();
                return;
            }

            const unlock = silentlyLockButton(e.currentTarget, null);

            try {
                const response = await fetch(`${BASE_URL}/set-npc-list-true`, {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'}
                });
                if (!response.ok) throw new Error('HTTP ' + response.status);
                const result = await response.json();
                if (result.status === 'success') {
                    showToast('NPC plugin list updated, will reset', '#10b981');
                    await new Promise(r => setTimeout(r, 4000));
                    await loadNpcPluginSelector();
                } else {
                    showToast('Error setting NPC_list', '#ef4444');
                }
            } catch (error) {
                console.error('Error:', error);
                showToast('Connection error', '#ef4444');
            } finally {
                unlock();
            }
        });
    }

    async function loadRadioFromINI() {
        const radioSlider = document.getElementById('radioDetecion');
        const radioValue = document.getElementById('radioValue');
        const radioStatus = document.getElementById('radioStatus');

        if (!radioSlider) return;

        try {
            const response = await fetch(`${BASE_URL}/load-detection-radio`);
            if (!response.ok) throw new Error('HTTP ' + response.status);
            const result = await response.json();
            if (result.status === 'success') {
                radioSlider.value = result.radio / 100;
                radioValue.textContent = (result.radio / 100).toFixed(1) + 'M';
                radioStatus.textContent = 'Range loaded from INI';
                radioStatus.style.background = 'rgba(16, 185, 129, 0.2)';
            } else {
                radioStatus.textContent = 'Load error';
                radioStatus.style.background = 'rgba(239, 68, 68, 0.2)';
            }
        } catch (error) {
            console.error('Error loading radio:', error);
            radioStatus.textContent = 'Connection error';
            radioStatus.style.background = 'rgba(239, 68, 68, 0.2)';
        }
    }


    // NPC Scripts functionality
    function closeNPCScripts() {
        const panel = document.getElementById('npcScriptsPanel');
        if (panel) {
            panel.style.display = 'none';
            document.getElementById('npcScriptsContent').innerHTML = '<p class="placeholder-text">Scripts cleared</p>';
        }
    }


    const saveNpcScriptsBtn = document.getElementById('saveNpcScripts');
    if (saveNpcScriptsBtn) {
        saveNpcScriptsBtn.addEventListener('click', async () => {
            const scripts = document.getElementById('npcScriptsTextarea').value;
            const status = document.getElementById('scriptsStatus');
            try {
                const response = await fetch(`${BASE_URL}/save-npc-scripts`, {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({scripts: scripts})
                });
                if (!response.ok) throw new Error('HTTP ' + response.status);
                const result = await response.json();
                if (result.status === 'success') {
                    status.textContent = 'Scripts saved';
                    status.style.background = 'rgba(16, 185, 129, 0.2)';
                } else {
                    status.textContent = 'Save error';
                    status.style.background = 'rgba(239, 68, 68, 0.2)';
                }
            } catch (error) {
                console.error('Error:', error);
                status.textContent = 'Connection error';
                status.style.background = 'rgba(239, 68, 68, 0.2)';
            }
        });
    }

    const radioSlider = document.getElementById('radioDetecion');
    const radioValue = document.getElementById('radioValue');
    const loadRadioBtn = document.getElementById('loadRadio');
    const saveRadioBtn = document.getElementById('saveRadio');
    const radioStatus = document.getElementById('radioStatus');


    if (radioSlider) {
        radioSlider.addEventListener('input', () => {
            radioValue.textContent = parseFloat(radioSlider.value).toFixed(1) + 'M';
        });

        radioSlider.addEventListener('change', async () => {
            try {
                const response = await fetch(`${BASE_URL}/save-detection-radio`, {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({radio: parseInt(radioSlider.value * 100)})
                });
                if (!response.ok) throw new Error('HTTP ' + response.status);
                const result = await response.json();
                if (result.status === 'success') {
                    radioStatus.textContent = 'Auto-saved to INI';
                    radioStatus.style.background = 'rgba(16, 185, 129, 0.2)';
                    setTimeout(() => {
                        radioStatus.textContent = 'Ready';
                        radioStatus.style.background = '';
                    }, 2000);
                }
            } catch (error) {
                console.error('Auto-save error:', error);
                radioStatus.textContent = 'Auto-save failed';
                radioStatus.style.background = 'rgba(239, 68, 68, 0.2)';
            }
        });
    }

    if (loadRadioBtn) {
        loadRadioBtn.addEventListener('click', async () => {
            try {
                const response = await fetch(`${BASE_URL}/load-detection-radio`);
                if (!response.ok) throw new Error('HTTP ' + response.status);
                const result = await response.json();
                if (result.status === 'success') {
                    radioSlider.value = result.radio / 100;
                    radioValue.textContent = (result.radio / 100).toFixed(1);
                    radioStatus.textContent = 'Range loaded from INI';
                    radioStatus.style.background = 'rgba(16, 185, 129, 0.2)';
                } else {
                    radioStatus.textContent = 'Load error';
                    radioStatus.style.background = 'rgba(239, 68, 68, 0.2)';
                }
            } catch (error) {
                console.error('Error:', error);
                radioStatus.textContent = 'Connection error';
                radioStatus.style.background = 'rgba(239, 68, 68, 0.2)';
            }
        });
    }

    if (saveRadioBtn) {
        saveRadioBtn.addEventListener('click', async () => {
            try {
                const response = await fetch(`${BASE_URL}/save-detection-radio`, {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({radio: parseInt(radioSlider.value * 100)})
                });
                if (!response.ok) throw new Error('HTTP ' + response.status);
                const result = await response.json();
                if (result.status === 'success') {
                    radioStatus.textContent = 'Radio saved to INI';
                    radioStatus.style.background = 'rgba(16, 185, 129, 0.2)';
                } else {
                    radioStatus.textContent = 'Save error';
                    radioStatus.style.background = 'rgba(239, 68, 68, 0.2)';
                }
            } catch (error) {
                console.error('Error:', error);
                radioStatus.textContent = 'Connection error';
                radioStatus.style.background = 'rgba(239, 68, 68, 0.2)';
            }
        });
    }

}
)

let previousSkyrimStatus = 'red';

function isSkyrimConnectedNow() {
    return typeof previousSkyrimStatus !== 'undefined' && previousSkyrimStatus === 'green';
}

async function playOfflineBlockedSound() {
    try {
        const audio = new Audio('Sound/slide_fretboard.wav');
        audio.volume = 0.6;
        await audio.play();
    } catch {}
}

function showSkyrimOfflineToast() {
    if (typeof showToast === 'function') {
        showToast(
            "Skyrim is not active, so it can't connect to the SKSE Act2 DLL. When you start the game, it will activate.",
            '#f97316',
            5000
        );
    }
}

function updateMasterJsonActionButtonsLockState() {
    const locked = !isSkyrimConnectedNow();
    const ids = [
        'triggerMasterJson',
        'transferMasterJson',
        'toggleAct2Start',
        'pluginOutfitsActualisationBtn',
        'npcPluginOutfitsActualisationBtn'
    ];
    for (const id of ids) {
        const el = document.getElementById(id);
        if (!el) continue;
        el.classList.toggle('btn-offline-locked', locked);
        el.setAttribute('aria-disabled', locked ? 'true' : 'false');
    }
}

// Función para actualizar el estado de Skyrim
function updateSkyrimStatus() {
    fetch(`${BASE_URL}/check-dead-man-switch`)
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                const statusElement = document.getElementById('skyrimStatus');
                if (statusElement) {
                    let colorClass = 'skyrim-red';
                    let title = 'Dead man switch not activated';

                    if (data.skyrim_closed) {
                        colorClass = 'skyrim-yellow';
                        title = 'Skyrim closed';
                    } else if (data.dead_man_switch_activated) {
                        colorClass = 'skyrim-green';
                        title = 'Skyrim running and dead man switch activated';
                    }

                    // Calcular el nuevo estado
                    const newStatus = colorClass.replace('skyrim-', '');

                    // Mostrar modal solo si el estado cambia de 'green' a 'yellow'
                    if (previousSkyrimStatus === 'green' && newStatus === 'yellow') {
                        showSkyrimConnectionLostModal();
                    }

                    statusElement.className = `skyrim-status ${colorClass}`;
                    statusElement.title = title;
                    previousSkyrimStatus = newStatus;

                    // Update status text
                    const statusTextElement = document.getElementById('skyrimStatusText');
                    if (statusTextElement) {
                        if (colorClass === 'skyrim-green') {
                            statusTextElement.textContent = 'Skyrim Connected';
                        } else {
                            statusTextElement.textContent = 'Offline Mode';
                        }
                    }

                    updateMasterJsonActionButtonsLockState();
                }
            }
        })
        .catch(error => {
            console.error('Error checking Skyrim status:', error);
            const statusElement = document.getElementById('skyrimStatus');
            if (statusElement) {
                const colorClass = previousSkyrimStatus === 'green' ? 'skyrim-yellow' : 'skyrim-red';
                statusElement.className = `skyrim-status ${colorClass}`;
                statusElement.title = 'Server disconnected';

                // Update status text
                const statusTextElement = document.getElementById('skyrimStatusText');
                if (statusTextElement) {
                    if (colorClass === 'skyrim-green') {
                        statusTextElement.textContent = 'Skyrim Connected';
                    } else {
                        statusTextElement.textContent = 'Offline Mode';
                    }
                }

                if (previousSkyrimStatus === 'green') {
                    showSkyrimConnectionLostModal();
                }
            }

            updateMasterJsonActionButtonsLockState();
        });
}

// Función para mostrar el modal de conexión perdida de Skyrim
function showSkyrimConnectionLostModal() {
    const modal = document.getElementById('skyrimConnectionLostModal');
    if (modal) {
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }
}

// Función para ocultar el modal de conexión perdida de Skyrim
function hideSkyrimConnectionLostModal() {
    const modal = document.getElementById('skyrimConnectionLostModal');
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
    }
}

// Function to toggle collapse of NPC favorites in Plugins tab
function toggleFavoritosCollapseNPCsPlugins() {
    const content = document.getElementById('favoritosNPCsContent_Plugins');
    content.classList.toggle('collapsed');
    const header = content.previousElementSibling;
    header.classList.toggle('collapsed');
}

window.loadFavoritosNPCs = async () => {
    try {
        const response = await fetch(`${BASE_URL}/load-favoritos-npcs`);
        if (!response.ok) {
            if (response.status === 404 || response.status === 400) {
                console.log('Archivo de favoritos de NPCs no encontrado o vacío, inicializando estructura vacía');
                favoritosNPCs = {};
                return true;
            }
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();

        if (result.status === 'success') {
            favoritosNPCs = result.data || {};
            // Ensure structure
            for (const plugin in favoritosNPCs) {
                 favoritosNPCs[plugin] = {
                    npcs: favoritosNPCs[plugin].npcs || [],
                    all_favorites: favoritosNPCs[plugin].all_favorites || false
                };
            }
            console.log('Favoritos NPCs cargados correctamente');
            return true;
        } else {
             console.error('Error loading NPC favorites:', result.message);
             favoritosNPCs = {};
             return false;
        }
    } catch (error) {
        console.error('Error al cargar favoritos de NPCs:', error);
        favoritosNPCs = {};
        return false;
    }
};

window.saveFavoritosNPCs = async () => {
    try {
        const response = await fetch(`${BASE_URL}/save-favoritos-npcs`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                favoritos_npcs: favoritosNPCs,
                timestamp: new Date().toISOString()
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();

        if (result.status !== 'success') {
            console.error('Error saving favoritosNPCs:', result.message || 'Unknown error');
            showToast('Error al guardar favoritos de NPCs', '#ef4444');
            return false;
        }

        console.log('Favoritos NPCs guardados correctamente');
        return true;

    } catch (error) {
        console.error('Error al guardar favoritos de NPCs:', error);
        showToast(`Error al guardar favoritos: ${error.message}`, '#ef4444');
        return false;
    }
};

// Función para ejecutar el ejecutable standalone desde el escritorio
function launchOfflineMode() {
    fetch(`${BASE_URL}/launch-offline-mode`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'}
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === 'success') {
            showToast('Offline mode launched successfully!', '#10b981');
        } else {
            showToast('Failed to launch offline mode', '#ef4444');
        }
    })
    .catch(error => {
        console.error('Error launching offline mode:', error);
        showToast('Connection error', '#ef4444');
    });
}

async function ensureNpcPluginsDataLoaded() {
    if (window.currentNpcPluginsData && window.currentNpcPluginsData.plugins) {
        return;
    }
    try {
        const response = await fetch(`${BASE_URL}/load-npcs-list-json`);
        if (!response.ok) {
            return;
        }
        const data = await response.json();
        if (data.status === 'success') {
            const jsonData = JSON.parse(data.content || '{}');
            window.currentNpcPluginsData = jsonData;
        }
    } catch (error) {
        console.error('Error loading NPC plugins data:', error);
    }
}

function normalizeId(id) {
    if (!id) return '';
    return String(id).trim().toLowerCase();
}

async function buildFavoriteNpc(pluginName, npc) {
    await ensureNpcPluginsDataLoaded();
    const pluginsData = window.currentNpcPluginsData?.plugins || {};
    const pluginData = pluginsData[pluginName];
    if (pluginData && Array.isArray(pluginData.npcs)) {
        let match = null;
        if (npc.editor_id) {
            match = pluginData.npcs.find(x => x.editor_id === npc.editor_id);
        }
        if (!match && npc.form_id) {
            const targetId = normalizeId(npc.form_id);
            match = pluginData.npcs.find(x => normalizeId(x.form_id) === targetId);
        }
        if (!match && npc.base_id) {
            const targetBase = normalizeId(npc.base_id);
            match = pluginData.npcs.find(x => normalizeId(x.base_id) === targetBase);
        }
        if (!match && npc.name) {
            const nameLower = npc.name.toLowerCase();
            const gender = npc.gender;
            match = pluginData.npcs.find(x => {
                if (!x.name) return false;
                const sameName = x.name.toLowerCase() === nameLower;
                if (!sameName) return false;
                if (!gender || !x.gender) return sameName;
                return x.gender === gender;
            });
        }
        if (match) {
            return {
                name: match.name,
                editor_id: match.editor_id,
                form_id: match.form_id,
                base_id: match.base_id,
                race: match.race,
                gender: match.gender
            };
        }
    }
    return {
        name: npc.name || '',
        editor_id: npc.editor_id || npc.form_id || npc.base_id || npc.name || '',
        form_id: npc.form_id || npc.base_id || '',
        base_id: npc.base_id || npc.form_id || '',
        race: npc.race || '',
        gender: npc.gender || ''
    };
}

async function toggleNpcStar(event) {
    event.stopPropagation();
    const star = event.target;
    console.log('toggleNpcStar called', event.target, event.target.classList);
    star.classList.toggle('active');
    console.log('after toggle', event.target.classList);

    const pluginName = String(star.dataset.plugin || '').trim();
    const npcB64 = star.dataset.npc;
    let npc;
    try {
        npc = JSON.parse(atob(npcB64));
    } catch (err) {
        console.error('NPC parse error', err);
        return;
    }

    const favoriteNpc = await buildFavoriteNpc(pluginName, npc);
    console.log('Toggle NPC favorite entry', favoriteNpc.editor_id);
    favoritosNPCs[pluginName] ||= {npcs:[], all_favorites: false};
    const isFavorito = favoritosNPCs[pluginName].npcs.some(n => n.editor_id === favoriteNpc.editor_id);

    if (!isFavorito && pluginName && pluginName.toLowerCase() !== 'unknown') {
        try {
            const saveResponse = await fetch(`${BASE_URL}/save-npc-plugin-selector`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ plugin: pluginName, enabled: true })
            });
            const result = await saveResponse.json().catch(() => ({}));
            if (!saveResponse.ok || result.error) {
                throw new Error(result.error || ('HTTP ' + saveResponse.status));
            }
        } catch (error) {
            console.error('Error enabling NPC plugin in Act2_NPCs.ini:', error);
        }
    }
    if (isFavorito) {
        favoritosNPCs[pluginName].npcs = favoritosNPCs[pluginName].npcs.filter(n => n.editor_id !== favoriteNpc.editor_id);
    } else {
        favoritosNPCs[pluginName].npcs.push(favoriteNpc);
    }

    const totalNPCs = window.currentNpcPluginsData?.plugins[pluginName]?.npcs?.length || 0;
    favoritosNPCs[pluginName].all_favorites = favoritosNPCs[pluginName].npcs.length === totalNPCs && totalNPCs > 0;
    saveFavoritosNPCs();
    console.log('Updated all_favorites for', pluginName, 'to', favoritosNPCs[pluginName].all_favorites);

    const masterStars = document.querySelectorAll('.master-star[data-plugin="' + pluginName + '"]');
    masterStars.forEach(ms => {
        ms.classList.toggle('active', favoritosNPCs[pluginName].all_favorites);
    });

    const total = window.currentNpcPluginsData?.plugins[pluginName]?.npcs?.length || 0;
    const favCount = favoritosNPCs[pluginName]?.npcs?.length || 0;
    const badgeFav = document.querySelector('#npcPluginsDetailsContent .badge-fav');
    if (badgeFav) {
        badgeFav.textContent = `Fav: ${favCount}/${total}`;
        badgeFav.className = 'badge-fav';
    }
    
    displayFavoritosNPCs();

    const audio = new Audio('Sound/ding-small-bell-sfx.wav');
    audio.play();
}

function updateOutfitMasterStar(pluginName) {
    const masterStar = document.querySelector(`.master-star[data-plugin="${pluginName}"]`);
    if (masterStar) {
        const isAllFavorites = favoritosOutfits[pluginName]?.all_favorites || false;
        masterStar.classList.toggle('active', isAllFavorites);
        // masterStar.style.color = '#ffd700'; // Handled by CSS
    }
}

function updateOutfitAllFavorites(pluginName) {
    const pluginData = window.currentPluginsData?.plugins[pluginName];
    if (!pluginData) return;

    // Calcular total de items (armors + outfits + weapons + items dentro de outfits)
    const totalArmors = pluginData.armors?.length || 0;
    const totalOutfits = pluginData.outfits?.length || 0;
    const totalWeapons = pluginData.weapons?.length || 0;

    // Contar items dentro de outfits (armors anidadas)
    let totalItemsInOutfits = 0;
    if (pluginData.outfits) {
        pluginData.outfits.forEach(outfit => {
            if (outfit.items) {
                totalItemsInOutfits += outfit.items.length;
            }
        });
    }

    const totalItems = totalArmors + totalOutfits + totalWeapons + totalItemsInOutfits;

    // Calcular items favoritos
    const favArmors = favoritosOutfits[pluginName]?.armors?.length || 0;
    const favOutfits = favoritosOutfits[pluginName]?.outfits?.length || 0;
    const favWeapons = favoritosOutfits[pluginName]?.weapons?.length || 0;

    // Contar items dentro de outfits que están marcados como favoritos
    let favItemsInOutfits = 0;
    if (pluginData.outfits && favoritosOutfits[pluginName]?.armors) {
        pluginData.outfits.forEach(outfit => {
            if (outfit.items) {
                outfit.items.forEach(item => {
                    // Verificar si este item está en favoritos (como armor individual)
                    const isItemFavorito = favoritosOutfits[pluginName].armors.some(
                        favItem => favItem.form_id === item.form_id
                    );
                    if (isItemFavorito) {
                        favItemsInOutfits++;
                    }
                });
            }
        });
    }

    const favItems = favArmors + favOutfits + favWeapons + favItemsInOutfits;

    // Actualizar all_favorites
    favoritosOutfits[pluginName].all_favorites = favItems === totalItems && totalItems > 0;
}

function updateStarVisuals(pluginName, formId, isFavorito) {
    // Actualizar todas las estrellas que coincidan con el formId y plugin
    const selector = `.star[data-plugin="${pluginName}"][data-form-id="${formId}"]`;
    document.querySelectorAll(selector).forEach(star => {
        star.classList.toggle('active', isFavorito);
        // star.style.color = isFavorito ? '#ffd700' : ''; // Handled by CSS
    });
}

function updateAllStarsForPlugin(pluginName, isActive) {
    // 1. Update stars in Plugin Details Panel
    const panel = document.getElementById('pluginsDetailsContent');
    if (panel) {
        const allStars = panel.querySelectorAll(`.star[data-plugin="${pluginName}"]`);
        allStars.forEach(star => {
            star.classList.toggle('active', isActive);
            star.style.removeProperty('color');
        });
    }

    // 2. Update stars in Favorites List
    const favoritesList = document.getElementById('favoritosOutfitsList');
    if (favoritesList) {
        const favStars = favoritesList.querySelectorAll(`.star[data-plugin="${pluginName}"]`);
        favStars.forEach(star => {
            star.classList.toggle('active', isActive);
            star.style.removeProperty('color');
        });
    }

    // 3. Update Master Stars (everywhere)
    const masterStars = document.querySelectorAll(`.master-star[data-plugin="${pluginName}"]`);
    masterStars.forEach(star => {
        star.classList.toggle('active', isActive);
        star.style.removeProperty('color');
    });

    // 4. Update stars in Plugin Cards (Main View)
    const pluginCards = document.querySelectorAll(`.act2-npc-card[data-plugin="${pluginName}"]`);
    pluginCards.forEach(card => {
         // Also update master star inside card if not caught above
         const masterStar = card.querySelector('.master-star');
         if (masterStar) {
             masterStar.classList.toggle('active', isActive);
             masterStar.style.removeProperty('color');
         }
         // If there are other stars in the card
         const stars = card.querySelectorAll('.star');
         stars.forEach(star => {
             star.classList.toggle('active', isActive);
             star.style.removeProperty('color');
         });
    });
}

function toggleOutfitStar(event) {
    event.stopPropagation();
    const star = event.target;
    console.log('toggleOutfitStar called', event.target, event.target.classList);

    const enablePluginSelector = async (pluginName) => {
        const plugin = String(pluginName || '').trim();
        if (!plugin) return;
        try {
            const saveResponse = await fetch(`${BASE_URL}/save-plugin-selector`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ plugin, enabled: true })
            });
            const result = await saveResponse.json().catch(() => ({}));
            if (!saveResponse.ok || result.error) {
                throw new Error(result.error || ('HTTP ' + saveResponse.status));
            }
        } catch (error) {
            console.error('Error enabling plugin in Act2_Plugins.ini:', error);
        }
    };

    // Verificar si es la estrella maestra (master star)
    const isMasterStar = star.classList.contains('master-star');

    if (isMasterStar) {
        // Manejar clic en la estrella maestra del plugin
        const pluginName = star.dataset.plugin;
        const isActive = !star.classList.contains('active');

        // Actualizar el estado all_favorites
        favoritosOutfits[pluginName] ||= {armors: [], outfits: [], weapons: [], all_favorites: false};
        favoritosOutfits[pluginName].all_favorites = isActive;

        // Obtener todos los items del plugin
        const pluginData = window.currentPluginsData?.plugins[pluginName];
        if (pluginData) {
            // Limpiar todas las listas de favoritos
            favoritosOutfits[pluginName].armors = [];
            favoritosOutfits[pluginName].outfits = [];
            favoritosOutfits[pluginName].weapons = [];

            // Si se está activando, agregar todos los items a favoritos
            if (isActive) {
                // Agregar todas las armaduras
                if (pluginData.armors) {
                    favoritosOutfits[pluginName].armors = pluginData.armors.map(armor => ({
                        name: armor.name,
                        form_id: armor.form_id,
                        plugin: pluginName,
                        category: 'armor'
                    }));
                }

                // Agregar todos los outfits
                if (pluginData.outfits) {
                    favoritosOutfits[pluginName].outfits = pluginData.outfits.map(outfit => ({
                        name: outfit.name,
                        form_id: outfit.form_id,
                        plugin: pluginName,
                        category: 'outfit'
                    }));
                }

                // Agregar todas las armas
                if (pluginData.weapons) {
                    favoritosOutfits[pluginName].weapons = pluginData.weapons.map(weapon => ({
                        name: weapon.name,
                        form_id: weapon.form_id,
                        plugin: pluginName,
                        category: 'weapon'
                    }));
                }
            }

            // Guardar cambios
            saveFavoritosOutfits();
            console.log('Master star toggled for', pluginName, 'all_favorites:', isActive);

            if (isActive) {
                enablePluginSelector(pluginName);
            }

            // Actualizar visualmente todas las estrellas del plugin
            updateAllStarsForPlugin(pluginName, isActive);

            // Actualizar el color de la estrella maestra
            // star.style.color = '#ffd700'; // Handled by CSS
            star.classList.toggle('active', isActive);

            // Reproducir sonido
            const audio = new Audio('Sound/ding-small-bell-sfx.wav');
            audio.play();
            return;
        }
    } else {
        // Manejar clic en estrella individual (lógica existente)
        // star.classList.toggle('active'); // Handled by updateStarVisuals
        console.log('after toggle', event.target.classList);

        // Save to JSON
        const pluginName = star.dataset.plugin;
        const itemType = star.dataset.type || 'outfit'; // 'armor', 'outfit', 'weapon'
        const itemName = star.dataset.name;
        const formId = star.dataset.formId;
        const category = star.dataset.category || itemType;

        console.log('Toggle Item', {pluginName, itemType, itemName, formId, category});

        // Initialize plugin structure if not exists
        favoritosOutfits[pluginName] ||= {armors: [], outfits: [], weapons: [], all_favorites: false};

        // Ensure the specific category array exists
        favoritosOutfits[pluginName][category + 's'] ||= [];

        // Find the item object from currentPluginsData based on type
        let item = null;
        if (window.currentPluginsData?.plugins[pluginName]) {
            if (category === 'armor' && window.currentPluginsData.plugins[pluginName].armors) {
                item = window.currentPluginsData.plugins[pluginName].armors.find(a => a.form_id === formId);
            } else if (category === 'outfit' && window.currentPluginsData.plugins[pluginName].outfits) {
                item = window.currentPluginsData.plugins[pluginName].outfits.find(o => o.form_id === formId);
            } else if (category === 'weapon' && window.currentPluginsData.plugins[pluginName].weapons) {
                item = window.currentPluginsData.plugins[pluginName].weapons.find(w => w.form_id === formId);
            }
        }

        // Check if item is already favorito
        const categoryArray = favoritosOutfits[pluginName][category + 's'];
        const wasFavorito = categoryArray.some(i => i.form_id === formId);
        const newIsFavorito = !wasFavorito;

        if (newIsFavorito) {
            enablePluginSelector(pluginName);
        }

        if (wasFavorito) {
            // Remove from favorites
            favoritosOutfits[pluginName][category + 's'] = categoryArray.filter(i => i.form_id !== formId);
        } else {
            // Add to favorites
            if (item) {
                favoritosOutfits[pluginName][category + 's'].push(item);
            } else {
                // Create minimal item object if not found in current data
                favoritosOutfits[pluginName][category + 's'].push({
                    name: itemName,
                    form_id: formId,
                    plugin: pluginName,
                    category: category
                });
            }
        }

        // Update visuals for ALL stars representing this item
        updateStarVisuals(pluginName, formId, newIsFavorito);

        // Verificar si todos los items del plugin están marcados para actualizar "all_favorites"
        const pluginData = window.currentPluginsData?.plugins[pluginName];
        if (pluginData) {
            // Calcular total de items (armors + outfits + weapons + items dentro de outfits)
            const totalArmors = pluginData.armors?.length || 0;
            const totalOutfits = pluginData.outfits?.length || 0;
            const totalWeapons = pluginData.weapons?.length || 0;

            // Contar items dentro de outfits (armors anidadas)
            let totalItemsInOutfits = 0;
            if (pluginData.outfits) {
                pluginData.outfits.forEach(outfit => {
                    if (outfit.items) {
                        totalItemsInOutfits += outfit.items.length;
                    }
                });
            }

            const totalItems = totalArmors + totalOutfits + totalWeapons + totalItemsInOutfits;

            // Calcular items favoritos
            const favArmors = favoritosOutfits[pluginName].armors?.length || 0;
            const favOutfits = favoritosOutfits[pluginName].outfits?.length || 0;
            const favWeapons = favoritosOutfits[pluginName].weapons?.length || 0;

            // Contar items dentro de outfits que están marcados como favoritos
            // Para esto, necesitamos verificar si los items individuales están en favoritos
            let favItemsInOutfits = 0;
            if (pluginData.outfits && favoritosOutfits[pluginName].armors) {
                pluginData.outfits.forEach(outfit => {
                    if (outfit.items) {
                        outfit.items.forEach(item => {
                            // Verificar si este item está en favoritos (como armor individual)
                            const isItemFavorito = favoritosOutfits[pluginName].armors.some(
                                favItem => favItem.form_id === item.form_id
                            );
                            if (isItemFavorito) {
                                favItemsInOutfits++;
                            }
                        });
                    }
                });
            }

            const favItems = favArmors + favOutfits + favWeapons + favItemsInOutfits;

            // Actualizar all_favorites
            favoritosOutfits[pluginName].all_favorites = favItems === totalItems && totalItems > 0;
            console.log('Updated all_favorites for', pluginName, 'to', favoritosOutfits[pluginName].all_favorites, 'fav:', favItems, 'total:', totalItems);

            // Actualizar la estrella maestra
            const masterStar = document.querySelector(`.master-star[data-plugin="${pluginName}"]`);
            if (masterStar) {
                masterStar.classList.toggle('active', favoritosOutfits[pluginName].all_favorites);
                // masterStar.style.color = favoritosOutfits[pluginName].all_favorites ? '#ffd700' : '#666'; // Handled by CSS
            }
        }

        saveFavoritosOutfits();

        // Actualizar color de la estrella individual
        // star.style.color = '#ffd700'; // Handled by CSS

        // Refresh the favorites display
        displayFavoritosOutfits();

        const audio = new Audio('Sound/ding-small-bell-sfx.wav');
        audio.play();
    }
}



function toggleOutfitFavorito(formId, event) {
    event.stopPropagation(); // Prevent triggering any other action
    let pluginName = null;
    let removed = false;

    // Find and remove the outfit from favoritosOutfits
    for (const plugin in favoritosOutfits) {
        if (favoritosOutfits[plugin].armors) {
            const initialLength = favoritosOutfits[plugin].armors.length;
            favoritosOutfits[plugin].armors = favoritosOutfits[plugin].armors.filter(outfit => outfit.form_id !== formId);
            if (favoritosOutfits[plugin].armors.length < initialLength) {
                pluginName = plugin;
                removed = true;
            }
        }
        if (favoritosOutfits[plugin].outfits) {
            const initialLength = favoritosOutfits[plugin].outfits.length;
            favoritosOutfits[plugin].outfits = favoritosOutfits[plugin].outfits.filter(outfit => outfit.form_id !== formId);
            if (favoritosOutfits[plugin].outfits.length < initialLength) {
                pluginName = plugin;
                removed = true;
            }
        }
        if (favoritosOutfits[plugin].weapons) {
            const initialLength = favoritosOutfits[plugin].weapons.length;
            favoritosOutfits[plugin].weapons = favoritosOutfits[plugin].weapons.filter(outfit => outfit.form_id !== formId);
            if (favoritosOutfits[plugin].weapons.length < initialLength) {
                pluginName = plugin;
                removed = true;
            }
        }
    }

    if (removed && pluginName) {
        // Update all_favorites flag considering items inside outfits
        const pluginData = window.currentPluginsData?.plugins[pluginName];
        if (pluginData) {
            // Calcular total de items (armors + outfits + weapons + items dentro de outfits)
            const totalArmors = pluginData.armors?.length || 0;
            const totalOutfits = pluginData.outfits?.length || 0;
            const totalWeapons = pluginData.weapons?.length || 0;

            // Contar items dentro de outfits (armors anidadas)
            let totalItemsInOutfits = 0;
            if (pluginData.outfits) {
                pluginData.outfits.forEach(outfit => {
                    if (outfit.items) {
                        totalItemsInOutfits += outfit.items.length;
                    }
                });
            }

            const totalItems = totalArmors + totalOutfits + totalWeapons + totalItemsInOutfits;

            // Calcular items favoritos
            const favArmors = favoritosOutfits[pluginName].armors?.length || 0;
            const favOutfits = favoritosOutfits[pluginName].outfits?.length || 0;
            const favWeapons = favoritosOutfits[pluginName].weapons?.length || 0;

            // Contar items dentro de outfits que están marcados como favoritos
            let favItemsInOutfits = 0;
            if (pluginData.outfits && favoritosOutfits[pluginName].armors) {
                pluginData.outfits.forEach(outfit => {
                    if (outfit.items) {
                        outfit.items.forEach(item => {
                            // Verificar si este item está en favoritos (como armor individual)
                            const isItemFavorito = favoritosOutfits[pluginName].armors.some(
                                favItem => favItem.form_id === item.form_id
                            );
                            if (isItemFavorito) {
                                favItemsInOutfits++;
                            }
                        });
                    }
                });
            }

            const favItems = favArmors + favOutfits + favWeapons + favItemsInOutfits;

            // Actualizar all_favorites
            favoritosOutfits[pluginName].all_favorites = favItems === totalItems && totalItems > 0;
            console.log('Updated all_favorites for', pluginName, 'to', favoritosOutfits[pluginName].all_favorites);

            // Actualizar la estrella maestra
            const masterStar = document.querySelector(`.master-star[data-plugin="${pluginName}"]`);
            if (masterStar) {
                masterStar.classList.toggle('active', favoritosOutfits[pluginName].all_favorites);
                // masterStar.style.color = favoritosOutfits[pluginName].all_favorites ? '#ffd700' : '#666'; // Handled by CSS
            }

            // Actualizar las estrellas del ítem específico en el panel principal
            updateStarVisuals(pluginName, formId, false);
        }
    }

    saveFavoritosOutfits();
    // Re-render the favorites display
    displayFavoritosOutfits();
    // Play sound when toggling favorite
    const audio = new Audio('Sound/ding-small-bell-sfx.wav');
    audio.play();
}

function togglePluginStars(event) {
    event.stopPropagation();
    const masterStar = event.target;
    const pluginName = masterStar.dataset.plugin;
    
    if (!pluginName) return;

    masterStar.classList.toggle('active');
    const isActive = masterStar.classList.contains('active');

    // Update Data
    if (window.currentPluginsData && window.currentPluginsData.plugins && window.currentPluginsData.plugins[pluginName]) {
        const pluginData = window.currentPluginsData.plugins[pluginName];
        
        // Initialize if missing
        if (!favoritosOutfits[pluginName]) {
            favoritosOutfits[pluginName] = {
                armors: [],
                outfits: [],
                weapons: [],
                all_favorites: false
            };
        }

        if (isActive) {
            // Add all armors
            if (pluginData.armors) {
                pluginData.armors.forEach(armor => {
                     if (!favoritosOutfits[pluginName].armors.some(f => f.form_id === armor.form_id)) {
                         favoritosOutfits[pluginName].armors.push(armor);
                     }
                });
            }
            // Add all outfits
            if (pluginData.outfits) {
                pluginData.outfits.forEach(outfit => {
                     if (!favoritosOutfits[pluginName].outfits.some(f => f.form_id === outfit.form_id)) {
                         favoritosOutfits[pluginName].outfits.push(outfit);
                     }
                });
            }
            // Add all weapons
            if (pluginData.weapons) {
                pluginData.weapons.forEach(weapon => {
                     if (!favoritosOutfits[pluginName].weapons.some(f => f.form_id === weapon.form_id)) {
                         favoritosOutfits[pluginName].weapons.push(weapon);
                     }
                });
            }
        } else {
            // Remove all
            favoritosOutfits[pluginName].armors = [];
            favoritosOutfits[pluginName].outfits = [];
            favoritosOutfits[pluginName].weapons = [];
        }
        
        favoritosOutfits[pluginName].all_favorites = isActive;
        saveFavoritosOutfits();
        console.log(`Plugin ${pluginName} master toggle: ${isActive}`);
    }

    // Update Visuals using the centralized function
    updateAllStarsForPlugin(pluginName, isActive);

    // Refresh Favorites List
    displayFavoritosOutfits();

    const audio = new Audio('Sound/ding-small-bell-sfx.wav');
    audio.play();
}

function toggleNpcPluginStars(event) {
    event.stopPropagation();
    const masterStar = event.target;
    const pluginName = masterStar.dataset.plugin;
    const isActive = !masterStar.classList.contains('active'); // Calculate new state based on current state (toggle happens below)
    
    // Toggle all master stars for this plugin
    const allMasterStars = document.querySelectorAll(`.master-star[data-plugin="${pluginName}"]`);
    allMasterStars.forEach(ms => ms.classList.toggle('active', isActive));

    const panel = document.getElementById('npcPluginsDetailsContent');

    // Update JSON
    if (window.currentNpcPluginsData && window.currentNpcPluginsData.plugins[pluginName]) {
        const npcs = window.currentNpcPluginsData.plugins[pluginName].npcs || [];
        favoritosNPCs[pluginName] ||= {npcs:[], all_favorites: false};
        if (isActive) {
            // Add all NPCs to favorites
            npcs.forEach(npc => {
                if (!favoritosNPCs[pluginName].npcs.some(fav => fav.editor_id === npc.editor_id)) {
                    favoritosNPCs[pluginName].npcs.push(npc);
                }
            });
        } else {
            // Remove all NPCs from favorites
            favoritosNPCs[pluginName].npcs = favoritosNPCs[pluginName].npcs.filter(fav => !npcs.some(npc => npc.editor_id === fav.editor_id));
        }
        // Set all_favorites flag
        favoritosNPCs[pluginName].all_favorites = isActive;
        saveFavoritosNPCs();
        console.log('Master toggle for', pluginName, 'all_favorites:', isActive);

        if (isActive && pluginName && pluginName.toLowerCase() !== 'unknown') {
            (async () => {
                try {
                    const saveResponse = await fetch(`${BASE_URL}/save-npc-plugin-selector`, {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({ plugin: pluginName, enabled: true })
                    });
                    const result = await saveResponse.json().catch(() => ({}));
                    if (!saveResponse.ok || result.error) {
                        throw new Error(result.error || ('HTTP ' + saveResponse.status));
                    }
                } catch (error) {
                    console.error('Error enabling NPC plugin in Act2_NPCs.ini:', error);
                }
            })();
        }

        // Update badge
        const total = window.currentNpcPluginsData?.plugins[pluginName]?.npcs?.length || 0;
        const favCount = favoritosNPCs[pluginName]?.npcs?.length || 0;
        const badgeFav = document.querySelector('#npcPluginsDetailsContent .badge-fav');
        if (badgeFav) {
            badgeFav.textContent = `Fav: ${favCount}/${total}`;
            badgeFav.className = 'badge-fav';
        }

        // Update individual stars based on JSON
        if (panel) {
            const allStars = panel.querySelectorAll('.npc-star');
            allStars.forEach(star => {
                const npcB64 = star.dataset.npc;
                let npc;
                try {
                    npc = JSON.parse(atob(npcB64));
                } catch (err) {
                    return;
                }
                const isFavorito = favoritosNPCs[pluginName].npcs.some(n => n.editor_id === npc.editor_id);
                star.classList.toggle('active', isFavorito);
            });
        }
        
        // Update favorites list
        displayFavoritosNPCs();
    }

    const audio = new Audio('Sound/ding-small-bell-sfx.wav');
    audio.play();
}

// Inicializar el estado de Skyrim cuando se carga la página
document.addEventListener('DOMContentLoaded', async function() {
    updateSkyrimStatus();
    setInterval(updateSkyrimStatus, 2000);

    // Initialize INI polling
    await initializeIniHash();
    startIniPolling();

    // Event listeners para los botones del modal
    const reloadWebpageBtn = document.getElementById('reloadWebpageBtn');
    const launchOfflineModeBtn = document.getElementById('launchOfflineModeBtn');

    if (reloadWebpageBtn) {
        reloadWebpageBtn.addEventListener('click', function() {
            location.reload();
        });
    }

    if (launchOfflineModeBtn) {
        launchOfflineModeBtn.addEventListener('click', function() {
            launchOfflineMode();
            hideSkyrimConnectionLostModal();
        });
    }

    // Add event listeners for the new header buttons in tab-plugins
    const toggleGifBtn = document.getElementById('toggleGifBtn');
    const toggleGifBtnNpc = document.getElementById('toggleGifBtnNpc');
    const refreshBtn = document.getElementById('refreshBtn');

    if (toggleGifBtn) {
        toggleGifBtn.addEventListener('click', () => {
            console.log('toggleGifBtn clicked');
            try {
                const audio = new Audio('./Sound/miau-PDA.wav');
                audio.play().then(() => {
                    console.log('Audio played successfully');
                }).catch(error => {
                    console.error('Audio play failed:', error);
                });
            } catch (error) {
                console.error('Audio creation failed:', error);
            }
            toggleGifVisibility();
        });
    }

    if (toggleGifBtnNpc) {
        toggleGifBtnNpc.addEventListener('click', () => {
            console.log('toggleGifBtnNpc clicked');
            try {
                const audio = new Audio('./Sound/miau-PDA.wav');
                audio.play().then(() => {
                    console.log('Audio played successfully');
                }).catch(error => {
                    console.error('Audio play failed:', error);
                });
            } catch (error) {
                console.error('Audio creation failed:', error);
            }
            toggleGifVisibility();
        });
    }

    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => location.reload());
    }

    const refreshNewsBtn = document.getElementById('refreshNewsBtn');
    if (refreshNewsBtn) {
        refreshNewsBtn.addEventListener('click', () => {
            const iframe = document.getElementById('newsIframe');
            if (iframe) {
                // Reset iframe to original URL
                iframe.src = `https://john95ac.github.io/website-documents-John95AC/NEWS_MCM/index.html?v=${Date.now()}`;
            }
        });
    }

    const folderBtn = document.getElementById('folderBtn');
    if (folderBtn) {
        folderBtn.addEventListener('click', async (e) => {
            silentlyLockButton(e.currentTarget, 1000);
            try {
                const response = await fetch(`${BASE_URL}/run-folder-script`, {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'}
                });
                if (!response.ok) throw new Error('HTTP ' + response.status);
                const result = await response.json();
                if (result.status === 'success') {
                    showToast('Folder opened successfully', '#10b981');
                } else {
                    showToast('Error opening folder', '#ef4444');
                }
            } catch (error) {
                console.error('Error:', error);
                showToast('Connection error', '#ef4444');
            }
        });
    }

    const openBtn = document.getElementById('openBtn');
    const iniFileInput = document.getElementById('iniFileInput');
    const generatedRuleEl = document.getElementById('generatedRule');

    if (openBtn && iniFileInput) {
        async function openIniWithNativeDialog() {
            try {
                const response = await fetch(`${BASE_URL}/open-ini-dialog`, { method: 'POST' });
                if (!response.ok) throw new Error('HTTP ' + response.status);
                const result = await response.json();

                if (result.status === 'success') {
                    showToast('INI loaded', '#10b981');
                    await loadTempContentToGeneratedRules();
                    return true;
                }

                if (result.status === 'cancelled') {
                    showToast('Cancelled', '#9ca3af');
                    return true;
                }

                showToast(result.message || 'Error opening INI', '#ef4444');
                return false;
            } catch (error) {
                console.error('Error opening INI dialog:', error);
                showToast('Connection error', '#ef4444');
                return false;
            }
        }

        openBtn.addEventListener('click', (e) => {
            silentlyLockButton(e.currentTarget, 1000);
            loadPresetLists();
            openIniWithNativeDialog().then((handled) => {
                if (!handled) {
                    iniFileInput.click();
                }
            });
        });

        iniFileInput.addEventListener('change', async (event) => {
            const file = event.target.files[0];
            if (!file) return;

            await uploadIniFile(file);

            // Reset the input so the same file can be selected again
            event.target.value = '';
        });
    }

    // Drag & Drop functionality for Generated Rules area
    if (generatedRuleEl) {
        let dragCounter = 0;

        generatedRuleEl.addEventListener('dragenter', (e) => {
            e.preventDefault();
            e.stopPropagation();
            dragCounter++;
            if (e.dataTransfer.types.includes('Files')) {
                generatedRuleEl.classList.add('drag-over');
            }
        });

        generatedRuleEl.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
        });

        generatedRuleEl.addEventListener('dragleave', (e) => {
            e.preventDefault();
            e.stopPropagation();
            dragCounter--;
            if (dragCounter === 0) {
                generatedRuleEl.classList.remove('drag-over');
            }
        });

        generatedRuleEl.addEventListener('drop', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            dragCounter = 0;
            generatedRuleEl.classList.remove('drag-over');
            
            // Capture the file directly from drag event
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                const file = files[0];
                await uploadIniFile(file);
            }
        });

        async function uploadIniFile(file) {
            const formData = new FormData();
            formData.append('iniFile', file);
            try {
                const response = await fetch(`${BASE_URL}/upload-ini`, {
                    method: 'POST',
                    body: formData
                });
                if (!response.ok) throw new Error('HTTP ' + response.status);
                const result = await response.json();
                if (result.status === 'success') {
                    showToast('INI file uploaded successfully', '#10b981');
                    await loadTempContentToGeneratedRules();
                } else {
                    showToast('Error uploading INI file: ' + (result.message || 'Unknown error'), '#ef4444');
                }
            } catch (error) {
                console.error('Error uploading INI file:', error);
                showToast('Connection error', '#ef4444');
            }
        }
    }

    async function uploadIniFile(file) {
        const formData = new FormData();
        formData.append('iniFile', file);

        try {
            const response = await fetch(`${BASE_URL}/upload-ini`, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) throw new Error('HTTP ' + response.status);
            const result = await response.json();

            if (result.status === 'success') {
                showToast('INI file uploaded successfully', '#10b981');
                // Load the uploaded INI content immediately to Generated Rules
                await loadTempContentToGeneratedRules();
            } else {
                showToast('Error uploading INI file: ' + (result.message || 'Unknown error'), '#ef4444');
            }
        } catch (error) {
            console.error('Error uploading INI file:', error);
            showToast('Connection error', '#ef4444');
        }
    }

    // Add CSS style for header buttons
    const style = document.createElement('style');
    style.textContent = `
        .header-left-buttons {
            position: absolute;
            left: 10px;
            top: 10px;
            display: flex;
            gap: 5px;
        }

        .header-btn {
            font-size: 1.2rem;
            background: rgba(0, 0, 0, 0.3);
            border: 1px solid rgba(255, 255, 255, 0.2);
            color: white;
            border-radius: 4px;
            padding: 2px 8px;
            cursor: pointer;
            transition: all 0.2s;
        }

        .header-btn:hover {
            background: rgba(0, 0, 0, 0.5);
            transform: scale(1.1);
        }

        .btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }
    `;
    document.head.appendChild(style);

    // Initialize port validation
    if (portInput) {
        validatePort();
        loadPort();
    }

    // Start polling for new temp content
    startTempContentPolling();
    
    // Polling for new temp content
    let tempContentPollingInterval;
    
    function startTempContentPolling() {
        if (tempContentPollingInterval) {
            clearInterval(tempContentPollingInterval);
        }
        tempContentPollingInterval = setInterval(async () => {
            if (hasLocalGeneratedRulesEdits) {
                return;
            }
            try {
                const response = await fetch(`${BASE_URL}/check-new-temp-content`);
                if (!response.ok) throw new Error('HTTP ' + response.status);
                const result = await response.json();
                if (result.status === 'success' && result.has_new_content) {
                    console.log('New temp content detected, loading...');
                    await loadTempContentToGeneratedRules();
                }
            } catch (error) {
                console.error('Error checking for new temp content:', error);
            }
        }, 2000); // Check every 2 seconds
    }
    
    async function loadTempContentToGeneratedRules() {
        try {
            const response = await fetch(`${BASE_URL}/load-temp-ini`);
            if (!response.ok) throw new Error('HTTP ' + response.status);
            const result = await response.json();
            if (result.status === 'success' && typeof result.content === 'string') {
                permanentRules = removeDefaultRuleMessage(result.content);
                const generatedRuleEl = document.getElementById('generatedRule');
                if (generatedRuleEl) {
                    if (permanentRules) {
                        generatedRuleEl.innerHTML = highlightRule(permanentRules);
                    } else {
                        generatedRuleEl.innerHTML = DEFAULT_RULE_MESSAGE;
                    }
                    console.log('Temp content loaded to Generated Rules section');
                }
            }
        } catch (error) {
            console.error('Error loading temp content:', error);
        }
    }

    // Initialize default tab to ensure loadVersionStatus() runs on page load
    activateTab('tab-indice');


    // Add event listener for updateFromNexusBtn
    const updateFromNexusBtn = document.getElementById('updateFromNexusBtn');
    if (updateFromNexusBtn) {
        updateFromNexusBtn.addEventListener('click', () => {
            bellAudio.currentTime = 0;
            bellAudio.play().then(() => {
                window.open('https://next.nexusmods.com/profile/John1995ac', '_blank');
            });
        });
    }

});
