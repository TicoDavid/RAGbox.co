"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.info = info;
exports.success = success;
exports.warn = warn;
exports.error = error;
exports.debug = debug;
exports.header = header;
exports.subheader = subheader;
exports.table = table;
exports.json = json;
exports.keyValue = keyValue;
exports.citation = citation;
exports.answer = answer;
exports.confidence = confidence;
exports.formatBytes = formatBytes;
exports.formatDate = formatDate;
exports.truncate = truncate;
exports.brand = brand;
const chalk_1 = __importDefault(require("chalk"));
const config_store_js_1 = require("./config-store.js");
// RAGbox brand colors
const colors = {
    primary: chalk_1.default.hex('#00F0FF'), // Electric Cyan
    warning: chalk_1.default.hex('#FFAB00'), // Amber
    danger: chalk_1.default.hex('#FF3D00'), // Neon Red
    success: chalk_1.default.hex('#00FF88'), // Success Green
    muted: chalk_1.default.hex('#888888'), // Text Muted
};
function info(message) {
    console.log(colors.primary('ℹ'), message);
}
function success(message) {
    console.log(colors.success('✓'), message);
}
function warn(message) {
    console.log(colors.warning('⚠'), message);
}
function error(message) {
    console.error(colors.danger('✗'), message);
}
function debug(message) {
    const config = (0, config_store_js_1.getConfig)();
    if (config.verbose) {
        console.log(colors.muted('⋯'), colors.muted(message));
    }
}
function header(title) {
    console.log();
    console.log(colors.primary('━'.repeat(50)));
    console.log(colors.primary.bold(`  ${title}`));
    console.log(colors.primary('━'.repeat(50)));
    console.log();
}
function subheader(title) {
    console.log();
    console.log(colors.primary.bold(`▸ ${title}`));
    console.log();
}
function table(headers, rows) {
    const config = (0, config_store_js_1.getConfig)();
    if (config.outputFormat === 'json') {
        const data = rows.map(row => {
            const obj = {};
            headers.forEach((h, i) => {
                obj[h.toLowerCase().replace(/\s+/g, '_')] = row[i];
            });
            return obj;
        });
        console.log(JSON.stringify(data, null, 2));
        return;
    }
    // Calculate column widths
    const colWidths = headers.map((h, i) => {
        const maxDataWidth = Math.max(...rows.map(r => (r[i] || '').length));
        return Math.max(h.length, maxDataWidth);
    });
    // Print header
    const headerRow = headers
        .map((h, i) => colors.primary.bold(h.padEnd(colWidths[i])))
        .join('  ');
    console.log(headerRow);
    // Print separator
    const separator = colWidths
        .map(w => colors.muted('─'.repeat(w)))
        .join('  ');
    console.log(separator);
    // Print data rows
    rows.forEach(row => {
        const dataRow = row
            .map((cell, i) => (cell || '').padEnd(colWidths[i]))
            .join('  ');
        console.log(dataRow);
    });
}
function json(data) {
    console.log(JSON.stringify(data, null, 2));
}
function keyValue(pairs) {
    const config = (0, config_store_js_1.getConfig)();
    if (config.outputFormat === 'json') {
        const obj = {};
        pairs.forEach(([key, value]) => {
            obj[key.toLowerCase().replace(/\s+/g, '_')] = value;
        });
        console.log(JSON.stringify(obj, null, 2));
        return;
    }
    const maxKeyLength = Math.max(...pairs.map(([k]) => k.length));
    pairs.forEach(([key, value]) => {
        const paddedKey = key.padEnd(maxKeyLength);
        const displayValue = value === undefined ? colors.muted('(not set)') : String(value);
        console.log(`${colors.primary(paddedKey)}  ${displayValue}`);
    });
}
function citation(index, documentName, excerpt, relevance) {
    console.log();
    console.log(colors.primary(`[${index}]`), colors.warning.bold(documentName));
    console.log(colors.muted('    Relevance:'), `${(relevance * 100).toFixed(1)}%`);
    console.log(colors.muted('    "') + excerpt.slice(0, 200) + (excerpt.length > 200 ? '...' : '') + colors.muted('"'));
}
function answer(text) {
    console.log();
    // Format answer with proper line wrapping
    const lines = text.split('\n');
    lines.forEach(line => {
        if (line.trim()) {
            console.log('  ' + line);
        }
        else {
            console.log();
        }
    });
    console.log();
}
function confidence(score, threshold = 0.85) {
    const percentage = (score * 100).toFixed(1);
    const color = score >= threshold ? colors.success : colors.warning;
    const label = score >= threshold ? 'HIGH CONFIDENCE' : 'LOW CONFIDENCE';
    console.log(color(`  Confidence: ${percentage}% (${label})`));
}
function formatBytes(bytes) {
    if (bytes === 0)
        return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleString();
}
function truncate(str, maxLength) {
    if (str.length <= maxLength)
        return str;
    return str.slice(0, maxLength - 3) + '...';
}
function brand() {
    console.log();
    console.log(colors.primary.bold('  ╔═══════════════════════════════════════════╗'));
    console.log(colors.primary.bold('  ║') + '                                           ' + colors.primary.bold('║'));
    console.log(colors.primary.bold('  ║') + colors.primary.bold('            RAGbox.co CLI              ') + colors.primary.bold('║'));
    console.log(colors.primary.bold('  ║') + colors.muted('     Your Files Speak. We Make Them Testify.') + colors.primary.bold(' ║'));
    console.log(colors.primary.bold('  ║') + '                                           ' + colors.primary.bold('║'));
    console.log(colors.primary.bold('  ╚═══════════════════════════════════════════╝'));
    console.log();
}
//# sourceMappingURL=output.js.map