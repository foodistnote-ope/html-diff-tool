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
    const altWarnings = document.getElementById('alt-warnings');
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
                    checkAltAttributes(prevEl);
                    document.getElementById('edit-toolbar-right').classList.remove('hidden');
                } else {
                    document.getElementById('edit-toolbar-left').classList.remove('hidden');
                }
            } else {
                // Switching from Preview to Code
                if (targetId === 'code-right') {
                    codeRight.value = previewRight.innerHTML;
                    document.getElementById('edit-toolbar-right').classList.add('hidden');
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
        checkAltAttributes(previewRight);
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

    // Alt Check Logic
    function checkAltAttributes(container) {
        const imgs = container.querySelectorAll('img');
        let warningsHTML = '';
        let count = 0;

        imgs.forEach(img => {
            const hasAlt = img.hasAttribute('alt');
            const altVal = img.getAttribute('alt');

            let issues = [];
            if (!hasAlt) issues.push('alt属性なし');
            else if (altVal === "") issues.push('alt=""（値が空）');
            else if (altVal.trim() === "" && altVal.length > 0) issues.push('alt=" "（空白のみ）');

            if (issues.length > 0) {
                count++;
                const src = img.getAttribute('src') || 'No src';
                warningsHTML += `<li><span class="badge danger">警告</span> ${issues.join(', ')} <br/> <code>&lt;img src="${src}"&gt;</code></li>`;
            }
        });

        if (count === 0) {
            altWarnings.innerHTML = '<li>🎉 alt未設定の画像はありません。</li>';
        } else {
            altWarnings.innerHTML = `<li style="background:none; border:none; padding:0 0 8px 0; font-weight:bold; color:var(--danger)">${count}件の警告があります</li>` + warningsHTML;
        }
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
            altWarnings.innerHTML = '<li>チェック対象がありません。</li>';
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
            checkAltAttributes(previewRight);
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
});
