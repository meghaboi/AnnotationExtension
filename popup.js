document.addEventListener('DOMContentLoaded', () => {
    const noteInput = document.getElementById('note-input');
    const currentDomainSpan = document.getElementById('current-domain');
    const charCountSpan = document.getElementById('char-count');
    const saveStatusSpan = document.getElementById('save-status');
    const deleteBtn = document.getElementById('delete-btn');
    const toggleOverlay = document.getElementById('toggle-overlay');

    let currentHostname = '';
    let debounceTimer;

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

    // 2. Load Notes
    function loadNotes(hostname) {
        chrome.storage.local.get([hostname], (result) => {
            const data = result[hostname] || { text: '', visible: true }; // Default visible: true
            noteInput.value = data.text || '';
            toggleOverlay.checked = data.visible !== false; // Default to true if undefined
            updateCharCount();
        });
    }

    // 3. Save Logic
    function saveNotes() {
        if (!currentHostname) return;

        const text = noteInput.value;
        const visible = toggleOverlay.checked;

        saveStatusSpan.textContent = 'Saving...';
        saveStatusSpan.className = 'saving';

        // We need to preserve the position if it exists, so we get it first
        chrome.storage.local.get([currentHostname], (result) => {
            const existingData = result[currentHostname] || {};
            const newData = {
                ...existingData, // Preserve all existing fields (position, size, minimized, etc.)
                text: text,
                visible: visible
            };

            // Ensure defaults if they don't exist yet (for first save)
            if (!newData.position) newData.position = { top: '20px', right: '20px' };

            chrome.storage.local.set({ [currentHostname]: newData }, () => {
                saveStatusSpan.textContent = 'Saved';
                saveStatusSpan.className = 'saved';
            });
        });
    }

    // 4. Auto-save with Dedounce
    noteInput.addEventListener('input', () => {
        updateCharCount();
        saveStatusSpan.textContent = 'Typing...';
        saveStatusSpan.className = '';

        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(saveNotes, 750);
    });

    // 5. Toggle Overlay
    toggleOverlay.addEventListener('change', () => {
        saveNotes();
    });

    // 6. Delete Note
    deleteBtn.addEventListener('click', () => {
        if (confirm('Are you sure you want to delete notes for this domain?')) {
            noteInput.value = '';
            toggleOverlay.checked = true; // Reset visibility
            updateCharCount();
            saveNotes(); // Save empty state
        }
    });

    function updateCharCount() {
        charCountSpan.textContent = `${noteInput.value.length} chars`;
    }
});
