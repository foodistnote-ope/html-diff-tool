/**
 * diff.js
 * Structure-safe HTML text node diff tool for code viewing.
 */

// Simple escape function to display HTML directly on the page without rendering its elements.
function escapeHtml(unsafe) {
    if (!unsafe) return "";
    return unsafe.toString()
        .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

/**
 * Tokenize HTML into an array of logical parts:
 * 1. HTML tag complete string (e.g., `<p id="x">`)
 * 2. Whitespaces (e.g., `   `, `\n`)
 * 3. Text words (e.g., `Hello`, `テスト記事`)
 */
function tokenizeHTMLForDiff(html) {
    const tokens = [];
    // Match: HTML tag OR Whitespace OR Word (non-whitespace, non-tag-start)
    const regex = /(<[^>]*>)|(\s+)|([^\s<]+)/g;
    let match;
    while ((match = regex.exec(html)) !== null) {
        if (match[0].length > 0) {
            tokens.push(match[0]);
        }
    }
    return tokens;
}

/**
 * Generate a safe diff that highlights code changes clearly 
 * without injecting <ins> or <del> into HTML tags' contents!
 */
function generateSafeDiff(oldHtml, newHtml) {
    if (typeof Diff === 'undefined' || !Diff.diffArrays) {
        return '<span style="color:red; font-weight:bold;">エラー: 差分ライブラリ (JSDiff) が正しく読み込まれていません。<br>ネットワーク接続を確認するか、リロードをお試しください。</span>';
    }

    const oldTokens = tokenizeHTMLForDiff(oldHtml);
    const newTokens = tokenizeHTMLForDiff(newHtml);

    // Diff an Array of tokens! This safely treats a whole tag like "<p id='x'>" 
    // as a single token, which guarantees tags are never split open and corrupted.
    const differences = Diff.diffArrays(oldTokens, newTokens);

    let htmlOut = '';
    differences.forEach(part => {
        // JSDiff gives part.value as an Array of the tokens that were matched
        const text = part.value.join('');
        const escaped = escapeHtml(text);

        if (part.added) {
            htmlOut += `<ins>${escaped}</ins>`;
        } else if (part.removed) {
            htmlOut += `<del>${escaped}</del>`;
        } else {
            // Unchanged
            htmlOut += escaped;
        }
    });

    return htmlOut;
}
