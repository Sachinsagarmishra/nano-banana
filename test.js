    <script>
        // ─── State ───
        const FREE_GENERATIONS = 2;
        const state = {
            referenceImages: [], // Combined uploaded and figma refs
            generatedImageUrl: null,
            isGenerating: false,
            selection: null,
            authToken: localStorage.getItem('nb_token'),
            user: null,
            isSignUp: true,
            freeUsed: parseInt(localStorage.getItem('nb_free_used') || '0')
        };

        const MAX_REFERENCE_IMAGES = 8;
        const MAX_FILE_SIZE = 30 * 1024 * 1024;

        // ─── Theme Toggle ───
        function toggleTheme() {
            const html = document.documentElement;
            const current = html.getAttribute('data-theme') || 'dark';
            const next = current === 'dark' ? 'light' : 'dark';
            html.setAttribute('data-theme', next);
            localStorage.setItem('nano_banana_theme', next);
            document.getElementById('themeToggle').innerHTML = next === 'dark' ? '<i class="fa-regular fa-moon"></i>' : '<i class="fa-regular fa-sun"></i>';
        }

        function initTheme() {
            const saved = localStorage.getItem('nano_banana_theme') || 'dark';
            document.documentElement.setAttribute('data-theme', saved);
            document.getElementById('themeToggle').innerHTML = saved === 'dark' ? '<i class="fa-regular fa-moon"></i>' : '<i class="fa-regular fa-sun"></i>';
        }

        // ─── Auth Functions ───
        function toggleAuthMode() {
            state.isSignUp = !state.isSignUp;
            document.getElementById('nameField').classList.toggle('hidden', !state.isSignUp);
            document.getElementById('authBtn').textContent = state.isSignUp ? 'Create Free Account' : 'Sign In';
            document.getElementById('authToggleText').textContent = state.isSignUp ? 'Already have an account?' : "Don't have an account?";
            document.getElementById('authToggleLink').textContent = state.isSignUp ? 'Sign In' : 'Sign Up';
            document.getElementById('signupWallMsg').style.display = state.isSignUp ? 'block' : 'none';
        }

        async function handleAuth() {
            const email = document.getElementById('authEmail').value.trim();
            const password = document.getElementById('authPassword').value;
            if (!email || !password) return showToast('Enter email and password', 'error');

            const endpoint = state.isSignUp ? '/api/auth/signup' : '/api/auth/login';
            const body = { email, password };
            if (state.isSignUp) body.full_name = document.getElementById('authName').value.trim();

            try {
                const res = await fetch(`${VERCEL_URL}${endpoint}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body)
                });
                const data = await res.json();
                if (data.error) return showToast(data.error, 'error');

                state.authToken = data.session.access_token;
                state.user = data.profile || data.user;
                localStorage.setItem('nb_token', state.authToken);
                showMainUI();
                showToast(state.isSignUp ? 'Account created!' : 'Welcome back!', 'success');
            } catch (e) {
                showToast('Auth failed: ' + e.message, 'error');
            }
        }

        async function checkExistingSession() {
            if (!state.authToken) return false;
            try {
                const res = await fetch(`${VERCEL_URL}/api/auth/profile`, {
                    headers: { 'Authorization': `Bearer ${state.authToken}` }
                });
                const data = await res.json();
                if (data.error || !data.profile) { localStorage.removeItem('nb_token'); return false; }
                state.user = data.profile;
                return true;
            } catch (e) { return false; }
        }

        function showMainUI() {
            document.getElementById('authOverlay').classList.add('hidden');
            updateCreditsDisplay();
        }

        function updateCreditsDisplay() {
            const badgeArea = document.querySelector('.profile-area');
            const existingPill = document.getElementById('creditsPill');
            if (existingPill) existingPill.remove();

            const pill = document.createElement('span');
            pill.className = 'free-counter';
            pill.id = 'creditsPill';

            const userInitial = document.getElementById('userInitial');
            const userCircle = document.getElementById('userCircle');

            if (state.user) {
                const credits = state.user.credits !== undefined ? state.user.credits : '?';
                pill.innerHTML = `<i class="fa-regular fa-star"></i> ${credits} credits`;
                pill.title = `${credits} credits remaining`;

                // Update Initial
                const name = state.user.full_name || state.user.email || 'User';
                userInitial.textContent = name[0].toUpperCase();
                userCircle.style.display = 'flex';
                // Remove login button if exists
                const existingLogin = document.getElementById('headerLoginBtn');
                if (existingLogin) existingLogin.remove();

                userCircle.title = `Logged in as ${name} (Click to Logout)`;
            } else {
                const freeLeft = Math.max(0, FREE_GENERATIONS - state.freeUsed);
                pill.innerHTML = `<i class="fa-regular fa-gift"></i> ${freeLeft} free`;
                pill.title = `${freeLeft} free generation(s) remaining`;

                // Show Login Button instead of circle
                userCircle.style.display = 'none';
                let loginBtn = document.getElementById('headerLoginBtn');
                if (!loginBtn) {
                    loginBtn = document.createElement('button');
                    loginBtn.id = 'headerLoginBtn';
                    loginBtn.className = 'login-btn-header';
                    loginBtn.textContent = 'Login';
                    loginBtn.onclick = () => showSignupWall();
                    badgeArea.insertBefore(loginBtn, userCircle);
                }
            }
            badgeArea.insertBefore(pill, badgeArea.firstChild);
        }

        function showSignupWall() {
            state.isSignUp = true;
            document.getElementById('nameField').classList.remove('hidden');
            document.getElementById('authBtn').textContent = 'Create Free Account';
            document.getElementById('authToggleText').textContent = 'Already have an account?';
            document.getElementById('authToggleLink').textContent = 'Sign In';
            document.getElementById('signupWallMsg').style.display = 'block';
            document.getElementById('authOverlay').classList.remove('hidden');
        }

        function pluginLogout() {
            if (!state.user) {
                showSignupWall();
                return;
            }
            localStorage.removeItem('nb_token');
            state.authToken = null;
            state.user = null;
            document.getElementById('authOverlay').classList.remove('hidden');
            updateCreditsDisplay();
        }

        // ─── Init ───
        window.onload = async () => {
            initTheme();
            parent.postMessage({ pluginMessage: { type: 'get-selection-info' } }, '*');

            // Setup file input listener safely
            const fileInput = document.getElementById('fileInput');
            if (fileInput) {
                fileInput.addEventListener('change', (e) => {
                    const files = Array.from(e.target.files);
                    for (const file of files) {
                        if (state.referenceImages.length >= MAX_REFERENCE_IMAGES) {
                            showToast('Maximum 8 reference images allowed', 'error');
                            break;
                        }
                        if (file.size > MAX_FILE_SIZE) {
                            showToast(`${file.name} is too large (max 30MB)`, 'error');
                            continue;
                        }

                        const reader = new FileReader();
                        reader.onload = (ev) => {
                            addAndUploadRef({
                                dataUrl: ev.target.result,
                                source: 'PC',
                                name: file.name
                            });
                        };
                        reader.onerror = () => showToast('Failed to read file', 'error');
                        reader.readAsDataURL(file);
                    }
                    e.target.value = '';
                });
            }

            // Check if logged in
            if (await checkExistingSession()) {
                showMainUI();
            }
            // Always update credits display
            updateCreditsDisplay();
            renderRefGrid(); // Initial render
        };

        // ─── Messages from Plugin Backend ───
        window.onmessage = (event) => {
            const msg = event.data.pluginMessage;
            if (!msg) return;

            switch (msg.type) {
                case 'selection-info':
                    handleSelectionInfo(msg);
                    break;
                case 'selection-exported':
                    handleSelectionExported(msg);
                    break;
                case 'selection-error':
                    showToast(msg.message, 'error');
                    break;
                case 'image-placed':
                    if (msg.success) {
                        showToast('Image placed on canvas!', 'success');
                    } else {
                        showToast('Failed to place image: ' + msg.error, 'error');
                    }
                    break;
                case 'generation-status':
                    handleGenerationStatus(msg);
                    break;
                case 'generation-complete':
                    handleGenerationComplete(msg);
                    break;
                case 'generation-error':
                    handleGenerationError(msg);
                    break;
            }
        };

        // ─── Selection Handling ───
        function handleSelectionInfo(msg) {
            state.selection = msg.hasSelection ? msg : null;
            const noSel = document.getElementById('noSelection');
            const card = document.getElementById('selectionCard');

            if (msg.hasSelection) {
                noSel.classList.add('hidden');
                card.classList.remove('hidden');
                document.getElementById('selectionName').textContent = msg.name;
                document.getElementById('selectionType').textContent = msg.nodeType;
            } else {
                noSel.classList.remove('hidden');
                card.classList.add('hidden');
            }
        }

        function exportSelection() {
            parent.postMessage({ pluginMessage: { type: 'export-selection' } }, '*');
            showToast('Capturing element...', 'info');
        }

        function handleSelectionExported(msg) {
            if (state.referenceImages.length >= MAX_REFERENCE_IMAGES) {
                showToast('Maximum 8 reference images allowed', 'error');
                return;
            }

            try {
                // Ensure data is Uint8Array
                const bytes = msg.data instanceof Uint8Array ? msg.data : new Uint8Array(msg.data);

                // Use a safer chunked conversion for large images
                let binary = '';
                const chunk = 1024 * 64; // 64KB chunks
                for (let i = 0; i < bytes.length; i += chunk) {
                    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
                }
                const base64 = window.btoa(binary);
                const dataUrl = 'data:image/png;base64,' + base64;

                addAndUploadRef({
                    dataUrl,
                    source: 'FIGMA',
                    name: msg.name || 'Figma Capture'
                });
                showToast('Captured from Figma!', 'success');
            } catch (err) {
                console.error('Export handling failed:', err);
                showToast('Failed to process capture', 'error');
            }
        }

        function addAndUploadRef(ref) {
            const id = Date.now() + Math.random();
            const newRef = {
                id,
                dataUrl: ref.dataUrl,
                source: ref.source,
                name: ref.name,
                status: 'pending',
                progress: 0,
                uploadedUrl: null
            };

            state.referenceImages.push(newRef);
            renderRefGrid();
            // Removed automatic upload as per user request
        }

        async function uploadRef(ref) {
            ref.status = 'uploading';
            renderRefGrid();
            try {
                const xhr = new XMLHttpRequest();
                xhr.open('POST', `${VERCEL_URL}/api/upload`, true);
                xhr.setRequestHeader('Content-Type', 'application/json');

                xhr.upload.onprogress = (e) => {
                    if (e.lengthComputable) {
                        const percent = Math.round((e.loaded / e.total) * 100);
                        ref.progress = percent;
                        updateRefProgressUI(ref.id, percent);
                    }
                };

                xhr.onload = () => {
                    if (xhr.status === 200) {
                        const data = JSON.parse(xhr.responseText);
                        ref.status = 'ready';
                        ref.progress = 100;
                        ref.uploadedUrl = data.url;
                        renderRefGrid();
                    } else {
                        throw new Error('Upload failed');
                    }
                };

                xhr.onerror = () => {
                    ref.status = 'error';
                    renderRefGrid();
                    showToast('Upload failed for ' + ref.name, 'error');
                };

                xhr.send(JSON.stringify({ image: ref.dataUrl }));

            } catch (err) {
                ref.status = 'error';
                renderRefGrid();
                showToast('Upload error', 'error');
            }
        }

        function updateRefProgressUI(id, percent) {
            const fill = document.querySelector(`[data-progress-id="${id}"]`);
            const text = document.querySelector(`[data-text-id="${id}"]`);
            if (fill) fill.style.width = percent + '%';
            if (text) text.textContent = percent + '%';
        }

        // ─── Render Reference Grid ───
        function renderRefGrid() {
            const grid = document.getElementById('refGrid');
            if (!grid) return;
            grid.innerHTML = '';

            state.referenceImages.forEach((ref, i) => {
                const item = document.createElement('div');
                item.className = 'ref-item';

                let overlay = '';
                if (ref.status === 'uploading') {
                    overlay = `
                        <div class="ref-overlay">
                            <div class="ref-upload-text" data-text-id="${ref.id}">${ref.progress}%</div>
                            <div class="ref-progress-container">
                                <div class="ref-progress-fill" style="width: ${ref.progress}%" data-progress-id="${ref.id}"></div>
                            </div>
                        </div>
                    `;
                } else if (ref.status === 'error') {
                    overlay = `
                        <div class="ref-overlay" style="background: rgba(239, 68, 68, 0.7)">
                            <div class="ref-upload-text">ERROR</div>
                            <button class="btn btn-xs" style="margin-top:4px;font-size:8px;padding:2px 6px;" onclick="uploadRef(state.referenceImages[${i}])">Retry</button>
                        </div>
                    `;
                } else if (ref.status === 'pending') {
                    overlay = `
                        <div class="ref-overlay" style="background: rgba(0,0,0,0.4)">
                            <button class="btn btn-xs" style="font-size:9px;padding:3px 8px;background:var(--primary);color:black;border:none;" onclick="uploadRef(state.referenceImages[${i}])">Upload</button>
                        </div>
                    `;
                }

                item.innerHTML = `
                    <img src="${ref.dataUrl}" alt="${ref.name}" />
                    ${overlay}
                    <button class="remove-btn" onclick="removeRef(${i})">✕</button>
                    <div class="ref-item-badge">${ref.source}</div>
                `;
                grid.appendChild(item);
            });

            // Add button
            if (state.referenceImages.length < MAX_REFERENCE_IMAGES) {
                const addBtn = document.createElement('button');
                addBtn.className = 'ref-add';
                addBtn.onclick = () => document.getElementById('fileInput').click();
                addBtn.innerHTML = `
                    <span class="ref-add-icon">+</span>
                    <span class="ref-add-text">Add (${state.referenceImages.length}/8)</span>
                `;
                grid.appendChild(addBtn);
            }

            // Global Upload Button for all pending
            const pending = state.referenceImages.filter(r => r.status === 'pending');
            if (pending.length > 0) {
                const uploadAllBtn = document.createElement('div');
                uploadAllBtn.style.gridColumn = '1 / -1';
                uploadAllBtn.style.marginTop = '8px';
                uploadAllBtn.innerHTML = `
                    <button class="btn btn-primary" style="width:100%;font-size:11px;padding:8px;" onclick="uploadAllPending()">
                        <i class="fa-solid fa-cloud-arrow-up"></i> Upload ${pending.length} Image${pending.length > 1 ? 's' : ''}
                    </button>
                `;
                grid.appendChild(uploadAllBtn);
            }
        }

        async function uploadAllPending() {
            const pending = state.referenceImages.filter(r => r.status === 'pending');
            for (const ref of pending) {
                uploadRef(ref);
            }
        }

        function removeRef(index) {
            state.referenceImages.splice(index, 1);
            renderRefGrid();
        }

        // ─── Tabs ───
        function switchRefTab(tab) {
            document.getElementById('tab-upload').classList.toggle('active', tab === 'upload');
            document.getElementById('tab-figma').classList.toggle('active', tab === 'figma');
            document.getElementById('tab-content-upload').classList.toggle('hidden', tab !== 'upload');
            document.getElementById('tab-content-figma').classList.toggle('hidden', tab !== 'figma');
        }

        // ─── Sections Toggle ───
        function toggleSection(id) {
            const body = document.getElementById('body-' + id);
            const chevron = document.getElementById('chevron-' + id);
            body.classList.toggle('collapsed');
            chevron.classList.toggle('collapsed');
        }

        // ─── Character Count ───
        function updateCharCount() {
            const textarea = document.getElementById('promptInput');
            const count = textarea.value.length;
            const el = document.getElementById('charCount');
            el.textContent = `${count.toLocaleString()} / 20,000`;

            if (count > 18000) el.className = 'label-hint danger';
            else if (count > 15000) el.className = 'label-hint warn';
            else el.className = 'label-hint';
        }



        // ─── Toast ───
        function showToast(message, type = 'info') {
            const container = document.getElementById('toastContainer');
            const toast = document.createElement('div');
            toast.className = `toast ${type}`;
            const icons = { success: '✅', error: '❌', info: 'ℹ️' };
            toast.innerHTML = `<span>${icons[type] || 'ℹ️'}</span><span>${message}</span>`;
            container.appendChild(toast);
            setTimeout(() => {
                toast.style.opacity = '0';
                toast.style.transform = 'translateY(-10px)';
                toast.style.transition = 'all 0.3s';
                setTimeout(() => toast.remove(), 300);
            }, 4000);
        }

        // ─── Status Bar ───
        function showStatus(icon, text, subtext, spinning = false, progress = null) {
            const bar = document.getElementById('statusBar');
            bar.classList.add('visible');

            const iconEl = document.getElementById('statusIcon');
            iconEl.textContent = icon;
            iconEl.className = spinning ? 'status-icon spinning' : 'status-icon';

            document.getElementById('statusText').textContent = text;
            document.getElementById('statusSubtext').textContent = subtext || '';

            const fill = document.getElementById('progressFill');
            if (progress === 'indeterminate') {
                fill.className = 'progress-fill indeterminate';
                fill.style.width = '30%';
            } else if (progress !== null) {
                fill.className = 'progress-fill';
                fill.style.width = progress + '%';
            }
        }

        function hideStatus() {
            document.getElementById('statusBar').classList.remove('visible');
        }

        // ─── API Base URL ───
        // When served from Vercel: relative URLs (same origin)
        // When loaded locally in Figma: set your Vercel deployment URL here
        const VERCEL_URL = (window.location.hostname && (window.location.hostname.includes('vercel.app') || window.location.hostname === 'localhost'))
            ? ''
            : 'https://nano-banana-mu-lemon.vercel.app';

        const POLL_INTERVAL = 3000;
        const MAX_POLL_ATTEMPTS = 120;

        // ─── Upload image via Vercel API (server-side, no CORS issues) ───
        async function uploadImageToHost(url) {
            // Fetch the image as a blob (works for both data: and blob: URLs)
            const blobRes = await fetch(url);
            const blob = await blobRes.blob();

            // Detect MIME type
            const mime = blob.type || 'image/png';
            const ext = mime === 'image/jpeg' ? 'jpg' : mime === 'image/webp' ? 'webp' : 'png';

            // Convert to base64 for the API
            const reader = new FileReader();
            const dataUrl = await new Promise((resolve) => {
                reader.onload = () => resolve(reader.result);
                reader.readAsDataURL(blob);
            });

            const res = await fetch(`${VERCEL_URL}/api/upload`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ image: dataUrl })
            });

            const data = await res.json();
            if (!res.ok || data.error) throw new Error(data.error || `Upload failed (${res.status})`);
            return data.url;
        }

        // ─── GENERATE IMAGE (via Vercel API) ───
        async function generateImage() {
            // Check if user needs to sign up
            if (!state.user && state.freeUsed >= FREE_GENERATIONS) {
                showSignupWall();
                showToast('Sign up to continue generating!', 'info');
                return;
            }

            const prompt = document.getElementById('promptInput').value.trim();
            if (!prompt) {
                showToast('Please enter a prompt', 'error');
                return;
            }

            if (prompt.length > 20000) {
                showToast('Prompt exceeds 20,000 character limit', 'error');
                return;
            }

            // Disable button
            const btn = document.getElementById('generateBtn');
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin-pulse"></i><span>Generating...</span>';
            state.isGenerating = true;

            // Hide previous result
            document.getElementById('resultSection').classList.remove('visible');

            showStatus('⏳', 'Checking inputs...', '', true, 'indeterminate');

            try {
                console.log('Starting generation...', { promptLength: prompt.length, refImages: state.referenceImages.length });
                // Check if all images are uploaded
                const uploadingCount = state.referenceImages.filter(r => r.status === 'uploading').length;
                if (uploadingCount > 0) {
                    showToast('Please wait for images to finish uploading', 'error');
                    resetGenerateBtn();
                    return;
                }

                const uploadedUrls = state.referenceImages
                    .filter(r => r.status === 'ready')
                    .map(r => r.uploadedUrl);

                // Step 2: Create generation task via Vercel API
                const aspectRatio = document.getElementById('aspectRatio').value;
                const resolution = document.getElementById('resolution').value;
                const outputFormat = document.getElementById('outputFormat').value;

                console.log('API Request:', {
                    url: `${VERCEL_URL}/api/generate`,
                    headers: { 'Authorization': state.authToken ? 'Present' : 'None' },
                    payload: { prompt, imageInputCount: uploadedUrls.length }
                });

                showStatus('<i class="fa-regular fa-paper-plane"></i>', 'Creating generation task...', 'Sending to Kie AI', true, 'indeterminate');

                const createRes = await fetch(`${VERCEL_URL}/api/generate`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': state.authToken ? `Bearer ${state.authToken}` : ''
                    },
                    body: JSON.stringify({
                        prompt,
                        imageInput: uploadedUrls,
                        aspectRatio: aspectRatio === 'auto' ? null : aspectRatio,
                        resolution,
                        outputFormat
                    })
                });

                console.log('API Response Status:', createRes.status);
                const createData = await createRes.json();
                console.log('API Response Data:', createData);

                if (createData.code !== 200 && !createData.taskId) {
                    throw new Error(createData.error || createData.msg || `API Error: ${createData.code || createRes.status}`);
                }

                // If guest user, increment free counter
                if (!state.user) {
                    state.freeUsed++;
                    localStorage.setItem('nb_free_used', state.freeUsed);
                    updateCreditsDisplay();
                }

                const taskId = createData.data.taskId;
                showStatus('<i class="fa-regular fa-clock"></i>', 'Task created! Generating...', `Task: ${taskId.substring(0, 12)}...`, true, 'indeterminate');

                // Step 3: Poll for results via Vercel API
                await pollTaskStatus(taskId);

            } catch (error) {
                showStatus('<i class="fa-regular fa-circle-xmark"></i>', 'Error', error.message, false, 0);
                showToast('Error: ' + error.message, 'error');
                resetGenerateBtn();
            }
        }

        // ─── Poll Task Status (via Vercel API) ───
        async function pollTaskStatus(taskId) {
            let attempts = 0;

            const poll = async () => {
                attempts++;
                if (attempts > MAX_POLL_ATTEMPTS) {
                    showStatus('<i class="fa-regular fa-circle-xmark"></i>', 'Timed out', 'Task took too long', false, 0);
                    showToast('Task timed out after 6 minutes', 'error');
                    resetGenerateBtn();
                    return;
                }

                const elapsed = attempts * (POLL_INTERVAL / 1000);

                try {
                    const res = await fetch(`${VERCEL_URL}/api/status?taskId=${taskId}`, {
                        headers: {
                            'Authorization': state.authToken ? `Bearer ${state.authToken}` : ''
                        }
                    });
                    const data = await res.json();

                    if (data.code !== 200) {
                        showStatus('<i class="fa-regular fa-circle-question"></i>', 'Query error', data.msg || '', true, 'indeterminate');
                        setTimeout(poll, POLL_INTERVAL);
                        return;
                    }

                    const taskState = data.data.state;

                    if (taskState === 'success') {
                        const resultJson = JSON.parse(data.data.resultJson);
                        const resultUrls = resultJson.resultUrls || [];

                        if (resultUrls.length === 0) {
                            showStatus('❌', 'No image generated', '', false, 0);
                            showToast('No image was generated', 'error');
                            resetGenerateBtn();
                            return;
                        }

                        const imageUrl = resultUrls[0];
                        state.generatedImageUrl = imageUrl;

                        const costTime = data.data.costTime
                            ? `${(data.data.costTime / 1000).toFixed(1)}s`
                            : `${elapsed.toFixed(0)}s`;

                        showStatus('✅', 'Generation complete!', `Completed in ${costTime}`, false, 100);
                        document.getElementById('resultImage').src = imageUrl;
                        document.getElementById('resultSection').classList.add('visible');
                        showToast('Image generated successfully! 🎉', 'success');
                        resetGenerateBtn();

                    } else if (taskState === 'fail') {
                        const failMsg = data.data.failMsg || 'Task failed';
                        showStatus('❌', 'Generation failed', failMsg, false, 0);
                        showToast('Error: ' + failMsg, 'error');
                        resetGenerateBtn();

                    } else {
                        showStatus('⏳', 'Generating image...', `Elapsed: ${elapsed.toFixed(0)}s`, true, 'indeterminate');
                        setTimeout(poll, POLL_INTERVAL);
                    }

                } catch (err) {
                    showStatus('🔄', 'Connection error, retrying...', err.message, true, 'indeterminate');
                    setTimeout(poll, POLL_INTERVAL);
                }
            };

            setTimeout(poll, POLL_INTERVAL);
        }

        // ─── Handle messages from Figma sandbox (only for canvas operations) ───
        function handleGenerationStatus(msg) {
            const elapsed = msg.elapsed ? `Elapsed: ${msg.elapsed.toFixed(0)}s` : '';
            showStatus('⏳', msg.message || 'Generating...', elapsed, true, 'indeterminate');
        }

        function handleGenerationComplete(msg) {
            state.generatedImageUrl = msg.imageUrl;
            showStatus('✅', 'Generation complete!', `Completed in ${msg.costTime}`, false, 100);
            document.getElementById('resultImage').src = msg.imageUrl;
            document.getElementById('resultSection').classList.add('visible');
            showToast('Image generated successfully! 🎉', 'success');
            resetGenerateBtn();
        }

        function handleGenerationError(msg) {
            showStatus('❌', 'Generation failed', msg.message, false, 0);
            showToast('Error: ' + msg.message, 'error');
            resetGenerateBtn();
        }

        function resetGenerateBtn() {
            state.isGenerating = false;
            const btn = document.getElementById('generateBtn');
            btn.disabled = false;
            btn.innerHTML = '<span>🍌</span><span>Generate Image</span>';
        }

        // ─── Place on Canvas ───
        function placeOnCanvas() {
            if (!state.generatedImageUrl) {
                showToast('No image to place', 'error');
                return;
            }

            // Calculate dimensions from aspect ratio
            const ratio = document.getElementById('aspectRatio').value;
            const resolution = document.getElementById('resolution').value;
            let width = 1024, height = 1024;

            const baseSize = resolution === '4K' ? 2048 : resolution === '2K' ? 1536 : 1024;

            if (ratio !== 'auto') {
                const [w, h] = ratio.split(':').map(Number);
                if (w > h) {
                    width = baseSize;
                    height = Math.round(baseSize * h / w);
                } else {
                    height = baseSize;
                    width = Math.round(baseSize * w / h);
                }
            } else {
                width = baseSize;
                height = baseSize;
            }

            parent.postMessage({
                pluginMessage: {
                    type: 'place-image',
                    imageUrl: state.generatedImageUrl,
                    width: width,
                    height: height
                }
            }, '*');

            showToast('Placing image on canvas...', 'info');
        }

        // ─── Open in Browser ───
        function openInBrowser() {
            if (state.generatedImageUrl) {
                window.open(state.generatedImageUrl, '_blank');
            }
        }
    </script>
