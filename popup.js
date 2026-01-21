document.addEventListener('DOMContentLoaded', () => {
    const noteInput = document.getElementById('note-input');
    const currentDomainSpan = document.getElementById('current-domain');
    const charCountSpan = document.getElementById('char-count');
    const saveStatusSpan = document.getElementById('save-status');
    const deleteBtn = document.getElementById('delete-btn');
    const toggleOverlay = document.getElementById('toggle-overlay');

    // Design Controls
    const themeSelect = document.getElementById('theme-select');
    const bgColorInput = document.getElementById('bg-color');
    const bgOpacityInput = document.getElementById('bg-opacity');
    const textColorInput = document.getElementById('text-color');

    let currentHostname = '';
    let debounceTimer;

    // Theme Presets
    const PRESETS = {
        glass: { bg: '#1e1e2e', text: '#cdd6f4', opacity: 0.4, border: 'rgba(255, 255, 255, 0.1)' },
        paper: { bg: '#ffffff', text: '#202124', opacity: 0.95, border: '#e0e0e0' },
        postit: { bg: '#fff740', text: '#202124', opacity: 0.95, border: 'rgba(0,0,0,0.1)' },
        custom: { bg: '#1e1e2e', text: '#cdd6f4', opacity: 0.6, border: 'rgba(255, 255, 255, 0.1)' }
    };

    // 1. Get Current Tab Hostname
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs.length === 0) return;

        try {
            const url = new URL(tabs[0].url);
            currentHostname = url.hostname;
            currentDomainSpan.textContent = currentHostname;
            loadNotes(currentHostname);
        } catch (e) {
            currentDomainSpan.textContent = "Invalid Domain";
            noteInput.disabled = true;
        }
    });

    // 2. Load Notes & Styles
    function loadNotes(hostname) {
        chrome.storage.local.get([hostname], (result) => {
            const data = result[hostname] || { text: '', visible: true };

            noteInput.value = data.text || '';
            toggleOverlay.checked = data.visible !== false;

            // Load Style
            if (data.style) {
                // Determine if it matches a preset
                const savedType = data.style.type || 'glass';
                themeSelect.value = savedType;

                bgColorInput.value = data.style.bg;
                textColorInput.value = data.style.text;
                bgOpacityInput.value = data.style.opacity;
            } else {
                // Default
                resetToPreset('glass');
            }

            updateCharCount();
        });
    }

    // 3. Save Logic
    function saveNotes() {
        if (!currentHostname) return;

        const text = noteInput.value;
        const visible = toggleOverlay.checked;

        // Build Style Object
        const style = {
            type: themeSelect.value,
            bg: bgColorInput.value,
            text: textColorInput.value,
            opacity: bgOpacityInput.value,
            // We can infer border or keep it simple
            border: themeSelect.value === 'paper' || themeSelect.value === 'postit' ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)'
        };

        saveStatusSpan.textContent = 'Saving...';
        saveStatusSpan.className = 'saving';

        chrome.storage.local.get([currentHostname], (result) => {
            const existingData = result[currentHostname] || {};
            const newData = {
                ...existingData,
                text: text,
                visible: visible,
                style: style
            };

            if (!newData.position) newData.position = { top: '20px', right: '20px' };

            chrome.storage.local.set({ [currentHostname]: newData }, () => {
                saveStatusSpan.textContent = 'Saved';
                saveStatusSpan.className = 'saved';
            });
        });
    }

    // 4. Events

    // Theme Select Change
    themeSelect.addEventListener('change', (e) => {
        const type = e.target.value;
        if (type !== 'custom') {
            resetToPreset(type);
        }
        saveNotes();
    });

    function resetToPreset(type) {
        const preset = PRESETS[type];
        if (preset) {
            bgColorInput.value = preset.bg;
            textColorInput.value = preset.text;
            bgOpacityInput.value = preset.opacity;
        }
    }

    // Color/Input Changes -> Switch to Custom & Save
    [bgColorInput, textColorInput, bgOpacityInput].forEach(input => {
        input.addEventListener('input', () => {
            if (themeSelect.value !== 'custom') {
                themeSelect.value = 'custom';
            }
            saveNotes(); // Real-time preview
        });
    });

    // Note Input
    noteInput.addEventListener('input', () => {
        updateCharCount();
        saveStatusSpan.textContent = 'Typing...';
        saveStatusSpan.className = '';
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(saveNotes, 750);
    });

    toggleOverlay.addEventListener('change', () => {
        saveNotes();
    });

    deleteBtn.addEventListener('click', () => {
        if (confirm('Are you sure you want to delete notes for this domain?')) {
            noteInput.value = '';
            toggleOverlay.checked = true;
            updateCharCount();
            saveNotes();
        }
    });

    function updateCharCount() {
        charCountSpan.textContent = `${noteInput.value.length} chars`;
    }
});
