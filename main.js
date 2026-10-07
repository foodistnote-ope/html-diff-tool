document.addEventListener('DOMContentLoaded', () => {
    // Elements
    const codeLeft = document.getElementById('code-left');
    const previewLeft = document.getElementById('preview-left');
    const codeRight = document.getElementById('code-right');
    const previewRight = document.getElementById('preview-right');

    // Buttons
    const btnCompare = document.getElementById('btn-compare');
    const btnCopy = document.getElementById('btn-copy');
    const btnClear = document.getElementById('btn-clear');
    const btnSwitchVisual = document.getElementById('btn-switch-visual');

    // Displays
    const diffList = document.getElementById('diff-list');
    const toast = document.getElementById('toast');

    // Sync Scroll feature
    function setupSyncScroll(el1, el2) {
        let isSyncing1 = false;
        let isSyncing2 = false;

        el1.addEventListener('scroll', () => {
            if (!isSyncing1) {
                isSyncing2 = true;
                const scrollRange1 = el1.scrollHeight - el1.clientHeight;
                const scrollRange2 = el2.scrollHeight - el2.clientHeight;
                if (scrollRange1 > 0 && scrollRange2 > 0) {
                    const percent = el1.scrollTop / scrollRange1;
                    el2.scrollTop = percent * scrollRange2;
                }
            }
            isSyncing1 = false;
        });

        el2.addEventListener('scroll', () => {
            if (!isSyncing2) {
                isSyncing1 = true;
                const scrollRange1 = el1.scrollHeight - el1.clientHeight;
                const scrollRange2 = el2.scrollHeight - el2.clientHeight;
                if (scrollRange1 > 0 && scrollRange2 > 0) {
                    const percent = el2.scrollTop / scrollRange2;
                    el1.scrollTop = percent * scrollRange1;
                }
            }
            isSyncing2 = false;
        });
    }

    setupSyncScroll(codeLeft, codeRight);
    setupSyncScroll(previewLeft, previewRight);

    // Tab switching logic
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const tabsContainer = btn.closest('.tabs');
            const contentContainer = btn.closest('.column').querySelector('.tab-content');

            tabsContainer.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            contentContainer.querySelectorAll('.code-input, .preview-area').forEach(el => el.classList.add('hidden'));

            const targetId = btn.dataset.target;
            const targetEl = document.getElementById(targetId);
            targetEl.classList.remove('hidden');

            // Synchronization when changing tabs
            if (targetId.startsWith('preview')) {
                // Switching from Code to Preview
                const isRight = targetId.includes('right');
                const codeEl = isRight ? codeRight : codeLeft;
                const prevEl = isRight ? previewRight : previewLeft;
                prevEl.innerHTML = codeEl.value; // Render HTML

                if (isRight) {
                    if (!isUpdatingFromAltList) renderAltList();
                    document.getElementById('edit-toolbar-right').classList.remove('hidden');
                } else {
                    document.getElementById('edit-toolbar-left').classList.remove('hidden');
                }
            } else {
                // Switching from Preview to Code
                if (targetId === 'code-right') {
                    codeRight.value = previewRight.innerHTML;
                    document.getElementById('edit-toolbar-right').classList.add('hidden');
                    if (!isUpdatingFromAltList) renderAltList();
                } else if (targetId === 'code-left') {
                    document.getElementById('edit-toolbar-left').classList.add('hidden');
                }
            }
        });
    });

    // ContentEditable handling (Right Preview)
    // Sync to code immediately on input
    previewRight.addEventListener('input', () => {
        if (!document.getElementById('code-right').classList.contains('hidden')) {
            // If code is visible? Code isn't visible when preview is.
            // But we keep them synced anyway.
        }
        codeRight.value = previewRight.innerHTML;
        if (!isUpdatingFromAltList) renderAltList();
    });

    let codeRightDebounceTimer;
    codeRight.addEventListener('input', () => {
        if (!isUpdatingFromAltList) {
            clearTimeout(codeRightDebounceTimer);
            codeRightDebounceTimer = setTimeout(() => {
                renderAltList();
            }, 300);
        }
    });

    // Strict structure preserve: Avoid generic wrapper injection if possible
    previewRight.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            // Attempt to ensure paragraphs are used instead of divs
            document.execCommand('defaultParagraphSeparator', false, 'p');
        }
    });

    // Handle paste: only allow plain text to avoid polluting HTML structure
    previewRight.addEventListener('paste', (e) => {
        e.preventDefault();
        const text = (e.originalEvent || e).clipboardData.getData('text/plain');
        document.execCommand('insertText', false, text);
    });

    // Compare logic
    btnCompare.addEventListener('click', () => {
        const diffSection = document.getElementById('diff-section');
        const infoContainer = document.getElementById('info-container');

        if (!diffSection.classList.contains('hidden')) {
            // Hide diff section
            diffSection.classList.add('hidden');
            infoContainer.classList.remove('diff-active');
            btnCompare.textContent = "比較する";
            return;
        }

        // Show diff section
        diffSection.classList.remove('hidden');
        infoContainer.classList.add('diff-active');
        btnCompare.textContent = "差分を閉じる";

        // Ensure both Code values are up-to-date with Previews before compare
        if (!previewLeft.classList.contains('hidden')) {
            codeLeft.value = previewLeft.innerHTML;
        }
        if (!previewRight.classList.contains('hidden')) {
            codeRight.value = previewRight.innerHTML;
            if (!isUpdatingFromAltList) renderAltList();
        }

        const leftText = codeLeft.value;
        const rightText = codeRight.value;
        const diffHtml = generateSafeDiff(leftText, rightText);
        diffList.innerHTML = diffHtml;
    });

    // Copy Final HTML
    btnCopy.addEventListener('click', () => {
        // Always get from right preview innerHTML to ensure exact structure is copied
        // Wait, if they only edited in the Code view, we must copy that.
        // Sync them first:
        let finalHtml = codeRight.value;
        if (!document.getElementById('preview-right').classList.contains('hidden')) {
            // Currently on preview, sync to code
            finalHtml = previewRight.innerHTML;
            codeRight.value = finalHtml;
        }

        navigator.clipboard.writeText(finalHtml).then(() => {
            toast.classList.remove('hidden');
            setTimeout(() => toast.classList.add('hidden'), 3000);
        }).catch(err => {
            alert('コピーに失敗しました。お使いのブラウザでは手動でコピーしてください。');
        });
    });

    let isUpdatingFromAltList = false;

    function updateAltText(index, newAlt) {
        isUpdatingFromAltList = true;
        const isVisualActive = !document.getElementById('preview-right').classList.contains('hidden');

        if (isVisualActive) {
            const img = previewRight.querySelectorAll('img')[index];
            if (img) {
                img.setAttribute('alt', newAlt);
                codeRight.value = previewRight.innerHTML;
            }
        } else {
            const code = codeRight.value;
            let matchCount = 0;
            const escapedAlt = newAlt.replace(/&/g, '&amp;')
                                     .replace(/"/g, '&quot;')
                                     .replace(/</g, '&lt;')
                                     .replace(/>/g, '&gt;');
            
            codeRight.value = code.replace(/<img(?:\s+[^>]*)?>/gi, (match) => {
                if (matchCount === index) {
                    matchCount++;
                    const altRegex = /\balt\s*=\s*(["'])([\s\S]*?)\1/i;
                    if (altRegex.test(match)) {
                        return match.replace(altRegex, () => `alt="${escapedAlt}"`);
                    }
                    const altUnquotedRegex = /\balt\s*=\s*([^\s>]+)/i;
                    if (altUnquotedRegex.test(match)) {
                        return match.replace(altUnquotedRegex, () => `alt="${escapedAlt}"`);
                    }
                    if (/^<img>$/i.test(match)) {
                        return `<img alt="${escapedAlt}">`;
                    }
                    return match.replace(/^<img\s+/i, () => `<img alt="${escapedAlt}" `);
                }
                matchCount++;
                return match;
            });
        }
        isUpdatingFromAltList = false;
    }

    function renderAltList() {
        const listContainer = document.getElementById('alt-list');
        const summarySpan = document.getElementById('alt-summary');
        
        if (!listContainer || !summarySpan) return;
        
        listContainer.innerHTML = ''; 

        let imgs = [];
        const isVisualActive = !document.getElementById('preview-right').classList.contains('hidden');

        if (isVisualActive) {
            imgs = Array.from(previewRight.querySelectorAll('img')).map((img, i) => ({
                src: img.getAttribute('src') || '',
                alt: img.getAttribute('alt'),
                hasAlt: img.hasAttribute('alt'),
                index: i
            }));
        } else {
            const parser = new DOMParser();
            const doc = parser.parseFromString(codeRight.value, 'text/html');
            imgs = Array.from(doc.querySelectorAll('img')).map((img, i) => ({
                src: img.getAttribute('src') || '',
                alt: img.getAttribute('alt'),
                hasAlt: img.hasAttribute('alt'),
                index: i
            }));
        }

        if (imgs.length === 0) {
            summarySpan.textContent = '';
            const emptyMsg = document.createElement('div');
            emptyMsg.textContent = '画像がありません';
            emptyMsg.style.padding = '16px';
            emptyMsg.style.color = '#6b7280';
            emptyMsg.style.fontSize = '14px';
            listContainer.appendChild(emptyMsg);
            return;
        }

        imgs.forEach((imgData) => {
            const { src, alt, hasAlt, index } = imgData;
            const isWarning = !hasAlt || alt === null || alt.trim() === '';

            const item = document.createElement('div');
            item.className = 'alt-item';

            const numSpan = document.createElement('span');
            numSpan.className = 'alt-num';
            numSpan.textContent = index + 1;

            const thumbWrap = document.createElement('div');
            thumbWrap.className = 'alt-thumb-wrap';
            
            const safeSrc = (src.startsWith('http:') || src.startsWith('https:') || src.startsWith('data:image/') || src.startsWith('./') || src.startsWith('/') || src.startsWith('../') || !src.includes(':')) ? src : '';
            
            if (safeSrc) {
                const thumb = document.createElement('img');
                thumb.className = 'alt-thumb';
                thumb.src = safeSrc;
                thumb.alt = 'thumbnail';
                thumb.onerror = () => {
                    thumbWrap.innerHTML = '';
                    const errSpan = document.createElement('span');
                    errSpan.className = 'alt-thumb-error';
                    errSpan.appendChild(document.createTextNode('画像を読み込め'));
                    errSpan.appendChild(document.createElement('br'));
                    errSpan.appendChild(document.createTextNode('ません'));
                    thumbWrap.appendChild(errSpan);
                };
                thumb.onclick = () => {
                    window.open(safeSrc, '_blank', 'noopener,noreferrer');
                };
                thumbWrap.appendChild(thumb);
            } else {
                const errSpan = document.createElement('span');
                errSpan.className = 'alt-thumb-error';
                errSpan.appendChild(document.createTextNode('画像を読み込め'));
                errSpan.appendChild(document.createElement('br'));
                errSpan.appendChild(document.createTextNode('ません'));
                thumbWrap.appendChild(errSpan);
            }

            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'alt-input';
            input.value = hasAlt && alt !== null ? alt : '';
            input.placeholder = 'altテキストを入力...';

            const badge = document.createElement('span');
            badge.className = `badge ${isWarning ? 'danger' : 'success'}`;
            badge.textContent = isWarning ? '未設定' : 'OK';

            input.addEventListener('input', (e) => {
                const newAlt = e.target.value;
                const newIsWarning = newAlt.trim() === '';
                badge.className = `badge ${newIsWarning ? 'danger' : 'success'}`;
                badge.textContent = newIsWarning ? '未設定' : 'OK';

                updateAltText(index, newAlt);
                updateSummary();
            });

            item.appendChild(numSpan);
            item.appendChild(thumbWrap);
            item.appendChild(input);
            item.appendChild(badge);

            listContainer.appendChild(item);
        });

        function updateSummary() {
            const currentWarnings = listContainer.querySelectorAll('.badge.danger').length;
            if (currentWarnings > 0) {
                summarySpan.textContent = `(画像${imgs.length}件 / 未設定${currentWarnings}件)`;
                summarySpan.style.color = 'var(--danger)';
                summarySpan.style.fontWeight = 'bold';
            } else {
                summarySpan.textContent = `(画像${imgs.length}件 / 問題なし)`;
                summarySpan.style.color = '#16a34a';
                summarySpan.style.fontWeight = 'normal';
            }
        }
        
        updateSummary();
    }


    // Bulk Switch Visual Button
    btnSwitchVisual.addEventListener('click', () => {
        document.querySelector('[data-target="preview-left"]').click();
        document.querySelector('[data-target="preview-right"]').click();
    });

    // Clear Button
    btnClear.addEventListener('click', () => {
        if (confirm('入力をクリアしますか？')) {
            codeLeft.value = '';
            codeRight.value = '';
            previewLeft.innerHTML = '';
            previewRight.innerHTML = '';
            if (!isUpdatingFromAltList) renderAltList();
            diffList.innerHTML = '「比較する」ボタンを押すとHTMLコード差分が表示されます。';

            document.getElementById('diff-section').classList.add('hidden');
            document.getElementById('info-container').classList.remove('diff-active');
            btnCompare.textContent = "比較する";

            // Reset tabs to HTML Code view
            document.querySelector('[data-target="code-left"]').click();
            document.querySelector('[data-target="code-right"]').click();
        }
    });

    // Formatting Toolbar Logic
    document.querySelectorAll('.toolbar-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const command = btn.dataset.command;
            const value = btn.dataset.value || null;
            
            // Execute command
            document.execCommand(command, false, value);
            
            // Focus back to editor to keep selection visible if needed
            previewRight.focus();
            
            // Sync to code immediately
            codeRight.value = previewRight.innerHTML;
            if (!isUpdatingFromAltList) renderAltList();
        });
    });

    // Scroll to Top feature
    function setupScrollTop(btnId, scrollableIds) {
        const btn = document.getElementById(btnId);
        const scrollables = scrollableIds.map(id => document.getElementById(id));

        const updateVisibility = () => {
            const activeScrollable = scrollables.find(el => !el.classList.contains('hidden'));
            if (activeScrollable && activeScrollable.scrollTop > 300) {
                btn.classList.remove('hidden');
            } else {
                btn.classList.add('hidden');
            }
        };

        btn.addEventListener('click', () => {
            const activeScrollable = scrollables.find(el => !el.classList.contains('hidden'));
            if (activeScrollable) {
                activeScrollable.scrollTo({
                    top: 0,
                    behavior: 'smooth'
                });
            }
        });

        // Add scroll listener to all scrollables in this column
        scrollables.forEach(el => {
            el.addEventListener('scroll', updateVisibility);
        });

        // Also check when switching tabs (since the active element changes)
        document.querySelectorAll('.tab-btn').forEach(tabBtn => {
            tabBtn.addEventListener('click', () => {
                // Short timeout to wait for 'hidden' class changes in main tab logic
                setTimeout(updateVisibility, 10);
            });
        });
    }

    setupScrollTop('btn-scroll-top-left', ['code-left', 'preview-left']);
    setupScrollTop('btn-scroll-top-right', ['code-right', 'preview-right']);

    // Init Editor behavior
    document.execCommand('defaultParagraphSeparator', false, 'p');

    // Initial render
    if (typeof isUpdatingFromAltList !== 'undefined' && !isUpdatingFromAltList) renderAltList();
});
