// saint-patrick-effects.js
(function() {
    let saintPatrickInterval = null; // Variable global para el intervalo



    // Crear efectos de San Patricio
    function activateSaintPatrickEffects() {
        let container = document.getElementById('saint-patrick-effects-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'saint-patrick-effects-container';
            document.body.appendChild(container);
            console.warn('Saint Patrick effects container created dynamically');
        }


        // Limpiar intervalo anterior si existe
        if (saintPatrickInterval) clearInterval(saintPatrickInterval);

        const emojis = ['🍀', '☘️', '🍺', '🌈', '🥃', '🕺', '🍸', '🍾', '🍷', '🍹', '🍻', '🥴', '🥳', '🥤', '🧉'];
        saintPatrickInterval = setInterval(() => {
            const emoji = document.createElement('div');
            emoji.textContent = emojis[Math.floor(Math.random() * emojis.length)];
            emoji.style.position = 'absolute';
            emoji.style.left = Math.random() * 100 + 'vw';
            emoji.style.fontSize = (Math.random() * 2 + 1) + 'rem';
            emoji.style.opacity = '0.2';
            emoji.style.filter = 'blur(1px)';
            emoji.style.animation = 'saint-patrick-fall 10s linear forwards';
            container.appendChild(emoji);

            setTimeout(() => emoji.remove(), 10000);
        }, 1000);

        // Agregar emoji fijo de San Patricio en esquina inferior derecha
        const fixedSaintPatrick = document.createElement('div');
        fixedSaintPatrick.textContent = '🍀';
        fixedSaintPatrick.style.position = 'fixed';
        fixedSaintPatrick.style.bottom = '-10px';
        fixedSaintPatrick.style.right = '20px';
        fixedSaintPatrick.style.fontSize = '4rem';
        fixedSaintPatrick.style.opacity = '0.3';
        fixedSaintPatrick.style.filter = 'blur(0.5px)';
        fixedSaintPatrick.style.zIndex = '1';
        fixedSaintPatrick.style.pointerEvents = 'none';
        container.appendChild(fixedSaintPatrick);
        // Agregar segundo emoji fijo de San Patricio en esquina inferior izquierda
        const fixedSaintPatrickLeft = document.createElement('div');
        fixedSaintPatrickLeft.textContent = '🍻';
        fixedSaintPatrickLeft.style.position = 'fixed';
        fixedSaintPatrickLeft.style.bottom = '-25px';
        fixedSaintPatrickLeft.style.left = '10px';
        fixedSaintPatrickLeft.style.fontSize = '8rem';
        fixedSaintPatrickLeft.style.opacity = '0.3';
        fixedSaintPatrickLeft.style.filter = 'blur(0.5px)';
        fixedSaintPatrickLeft.style.zIndex = '1';
        fixedSaintPatrickLeft.style.pointerEvents = 'none';
        container.appendChild(fixedSaintPatrickLeft);


        // CSS para animación
        const style = document.createElement('style');
        style.textContent = `
            @keyframes saint-patrick-fall {
                0% { transform: translateY(-100px) rotate(0deg); }
                100% { transform: translateY(100vh) rotate(360deg); }
            }
        `;
        document.head.appendChild(style);

        // Detener después de 5 horas para no sobrecargar
        setTimeout(() => {
            if (saintPatrickInterval) {
                clearInterval(saintPatrickInterval);
                saintPatrickInterval = null;
            }
        }, 18000000);
    }

    // Función para detener efectos
    function stopSaintPatrickEffects() {
        if (saintPatrickInterval) {
            clearInterval(saintPatrickInterval);
            saintPatrickInterval = null;
        }
        const container = document.getElementById('saint-patrick-effects-container');
        if (container) {
            container.innerHTML = ''; // Limpiar emojis existentes
        }
    }

    // Exponer funciones globales
    window.activateSaintPatrickEffects = activateSaintPatrickEffects;
    window.stopSaintPatrickEffects = stopSaintPatrickEffects;
})();