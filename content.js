(() => {
    // 1. Configuration & State
    const HOSTNAME = window.location.hostname;
    let overlayContainer = null;
    let shadowRoot = null;

    // State
    let state = {
        text: '',
        visible: true,
        minimized: false,
        position: { top: '20px', right: '20px' },
        size: { width: '300px', height: 'auto' }
    };

    // 2. Initialization
    function init() {
        chrome.storage.local.get([HOSTNAME], (result) => {
            const data = result[HOSTNAME];
            if (data && data.text && data.text.trim().length > 0) {
                // Merge loaded data into state
                state = { ...state, ...data };

                if (state.visible) {
                    createOverlay();
                }
            }
        });
    }

    // 3. Create Overlay
    function createOverlay() {
        if (overlayContainer) {
            updateOverlayUI();
            return;
        }

        // Create Host
        overlayContainer = document.createElement('div');
        overlayContainer.id = 'website-notes-overlay-host';

        // Shadow DOM for isolation
        shadowRoot = overlayContainer.attachShadow({ mode: 'open' });

        // Inject Styles
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = chrome.runtime.getURL('content.css');
        shadowRoot.appendChild(link);

        // Create Wrapper
        const wrapper = document.createElement('div');
        wrapper.className = `note-overlay ${state.minimized ? 'minimized' : ''}`;

        // Construct HTML
        wrapper.innerHTML = `
            <div class="note-header">
                <span class="drag-handle-icon">⋮⋮</span>
                <div class="controls">
                    <button class="control-btn minimize-btn" title="${state.minimized ? 'Expand' : 'Minimize'}">
                        ${state.minimized ? '□' : '_'}
                    </button>
                </div>
            </div>
            <div class="note-content-wrapper">
                <div class="note-content" title="Double-click to edit"></div>
            </div>
        `;

        // Apply Dimensions & Position
        applyStyles(wrapper);

        shadowRoot.appendChild(wrapper);
        document.body.appendChild(overlayContainer);

        // Bind Events
        bindEvents(wrapper);

        // Initial Render
        renderContent(wrapper.querySelector('.note-content'));
    }

    function applyStyles(wrapper) {
        Object.assign(wrapper.style, state.position);

        if (!state.minimized) {
            // Only apply size if not minimized
            wrapper.style.width = state.size.width || '300px';
            wrapper.style.height = state.size.height || 'auto';
        } else {
            wrapper.style.width = 'auto'; // Reset for minimized state handled by CSS class
            wrapper.style.height = 'auto';
        }
    }

    function renderContent(container) {
        if (!container) return;
        // Make links clickable
        const linkedText = linkify(state.text);
        container.innerHTML = linkedText;
    }

    function linkify(text) {
        if (!text) return '';
        // Simple regex for URLs
        const urlRegex = /(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig;
        return escapeHtml(text).replace(urlRegex, (url) => {
            return `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`;
        }).replace(/\n/g, '<br>');
    }

    function updateOverlayUI() {
        if (!overlayContainer || !shadowRoot) return;

        const wrapper = shadowRoot.querySelector('.note-overlay');
        if (!wrapper) return;

        // Update Minimize State
        if (state.minimized) {
            wrapper.classList.add('minimized');
            wrapper.querySelector('.minimize-btn').textContent = '□';
            wrapper.querySelector('.minimize-btn').title = 'Expand';
        } else {
            wrapper.classList.remove('minimized');
            wrapper.querySelector('.minimize-btn').textContent = '_';
            wrapper.querySelector('.minimize-btn').title = 'Minimize';
        }

        // Update Header/Content Visibility
        if (state.visible) {
            wrapper.style.display = 'flex';
        } else {
            wrapper.style.display = 'none';
        }

        // Update Content
        const contentDiv = wrapper.querySelector('.note-content');
        if (contentDiv && !contentDiv.querySelector('textarea')) {
            renderContent(contentDiv);
        }

        applyStyles(wrapper);
    }

    function bindEvents(wrapper) {
        // Dragging (Header only)
        const header = wrapper.querySelector('.note-header');
        header.addEventListener('mousedown', startDrag);

        // Minimize
        const minBtn = wrapper.querySelector('.minimize-btn');
        minBtn.addEventListener('click', toggleMinimize);

        // Resize Observer
        // Only observe if not minimized
        const resizeObserver = new ResizeObserver(entries => {
            if (state.minimized) return;
            for (let entry of entries) {
                const { width, height } = entry.contentRect;
                // We want the style.width (border-box usually behaves better for saving)
                // Actually with content-box default, contentRect is inner.
                // Let's just grab style.width from element after a timeout or on mouseup of resize
            }
        });
        resizeObserver.observe(wrapper);

        // Better resize save: MouseUp on wrapper ? 
        // Resize handle usually implies user is dragging corner.
        wrapper.addEventListener('mouseup', () => {
            if (!state.minimized) {
                const newWidth = wrapper.style.width;
                const newHeight = wrapper.style.height;
                if (newWidth && newHeight && (newWidth !== state.size.width || newHeight !== state.size.height)) {
                    state.size = { width: newWidth, height: newHeight };
                    saveState();
                }
            }
        });

        // Double Click to Edit
        const contentWrapper = wrapper.querySelector('.note-content-wrapper');
        const contentDiv = wrapper.querySelector('.note-content');

        contentDiv.addEventListener('dblclick', () => {
            // Switch to edit mode
            const textarea = document.createElement('textarea');
            textarea.className = 'edit-textarea';
            textarea.value = state.text;

            contentDiv.innerHTML = '';
            contentDiv.appendChild(textarea);
            textarea.focus();

            // Handle Save on Blur
            textarea.addEventListener('blur', () => {
                state.text = textarea.value;
                saveState();
                renderContent(contentDiv); // Switch back to view
            });

            // Stop propagation to avoid bubbling to drag listeners etc if any
            textarea.addEventListener('mousedown', e => e.stopPropagation());
            textarea.addEventListener('dblclick', e => e.stopPropagation());
        });
    }

    // Drag Logic
    function startDrag(e) {
        if (e.target.tagName === 'BUTTON') return; // Don't drag if clicking buttons

        const wrapper = shadowRoot.querySelector('.note-overlay');
        let startX = e.clientX;
        let startY = e.clientY;

        const rect = wrapper.getBoundingClientRect();

        // Lock to px to avoid issues
        wrapper.style.right = 'auto';
        wrapper.style.bottom = 'auto';
        wrapper.style.left = rect.left + 'px';
        wrapper.style.top = rect.top + 'px';

        function onMouseMove(e) {
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;

            const currentLeft = parseFloat(wrapper.style.left);
            const currentTop = parseFloat(wrapper.style.top);

            wrapper.style.left = (currentLeft + dx) + 'px';
            wrapper.style.top = (currentTop + dy) + 'px';

            startX = e.clientX;
            startY = e.clientY;
        }

        function onMouseUp() {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);

            // Save position
            state.position = {
                left: wrapper.style.left,
                top: wrapper.style.top,
                right: 'auto',
                bottom: 'auto'
            };
            saveState();
        }

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
        e.preventDefault();
    }

    // Actions
    function toggleMinimize() {
        state.minimized = !state.minimized;
        updateOverlayUI();
        saveState();
    }

    function saveState() {
        chrome.storage.local.get([HOSTNAME], (prev) => {
            const newData = { ...prev[HOSTNAME], ...state };
            chrome.storage.local.set({ [HOSTNAME]: newData });
        });
    }

    // Storage Sync
    chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'local' && changes[HOSTNAME]) {
            const val = changes[HOSTNAME].newValue;
            if (!val) {
                if (overlayContainer) overlayContainer.remove();
                overlayContainer = null;
                return;
            }

            // Update state safely
            // If we are currently editing (textarea focused), don't overwrite text with old value unless it's a "remote" change?
            // For simplicity, last write wins. If user is typing in popup, it updates here.
            // If user is editing here (textarea), we should be careful.

            const isEditingHere = shadowRoot?.querySelector('textarea:focus');

            // Updates
            state = { ...state, ...val };

            if (isEditingHere) {
                // Don't interrupt edit mode with text update? 
                // Or maybe just update background state.
            }

            if (state.visible && state.text) {
                if (!overlayContainer) createOverlay();
                else updateOverlayUI();
            } else if (!state.visible && overlayContainer) {
                overlayContainer.style.display = 'none'; // Or remove
                // remove? user might just want to hide temporarily.
                // CSS handles display: none
                updateOverlayUI();
            }
        }
    });

    // Helper
    function escapeHtml(text) {
        if (!text) return '';
        // We only escape for the view mode "innerHTML". 
        // But since we are linkifying with regex, we need to be careful not to double escape if we do it inside linkify.
        // Linkify calls escapeHtml first.
        return text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    init();

})();
